// -----------------------------------------------------------------------------
// The Baby Buddy hub: reads the instance on a timer of the container, publishes
// the states of each child when they change, fires the "no feeding for N
// hours" scene event, and writes entries for the widget and the scene actions
// (diaper change, sleep and feeding timers).
//
// Gladys never polls these devices (should_poll: false, and GladysAssistant/
// Gladys#3198): the hub ticks every minute, recomputes the "minutes since"
// counters from what it read, and reads Baby Buddy again once the configured
// interval has passed.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { hostOf } from './config.js';
import { buildChild, childIds, childStates } from './devices.js';
import { BabyBuddyClient, BabyBuddyError, ENTRY_KINDS, ERROR_KINDS } from './babybuddy/client.js';
import {
  ACTIVITIES,
  TIMER_NAMES,
  localDay,
  minutesSince,
  parseChildren,
  parseEntries,
  parseTimers,
  resolveTimeZone,
  summarize,
} from './babybuddy/model.js';
import {
  ACTION_TEXT,
  CONNECTION_TEXT,
  DONE_TEXT,
  ERROR_TEXT,
  REPORT_TEXT,
  allLanguages,
  pick,
} from './texts.js';

const logger = createLogger({ name: 'babybuddy-hub' });

export const WIDGET_KEY = 'child_summary';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  FEEDING_OVERDUE: 'feeding_overdue',
});

// The hours offered by the trigger (manifest `hours` options).
export const OVERDUE_HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

export const DIAPER_KINDS = Object.freeze({ WET: 'wet', SOLID: 'solid', BOTH: 'both' });
export const COMMANDS = Object.freeze({ START: 'start', STOP: 'stop', TOGGLE: 'toggle' });

export const HUB_TIMINGS = {
  // The "minutes since" counters move on this tick, whatever the interval.
  tickMs: 60_000,
  // A failed read is tried again on the next tick, at most this often.
  retryMs: 30_000,
  // Re-send unchanged values this often: Gladys shows "no recent value" after 48 h.
  heartbeatMs: 12 * 60 * 60_000,
};

const HOUR = 60 * 60_000;
// The reading after an entry is awaited at most this long: the scene action
// and the widget button answer within their 20 s.
const REFRESH_WAIT_MS = 3_000;

export class BabyBuddyHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {Function} [options.request] HTTP seam (src/babybuddy/http.js)
   * @param {boolean} [options.timers] periodic timer (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   * @param {string} [options.timeZone] defaults to TZ, set by the Gladys supervisor
   */
  constructor({ gladys, request, timers = true, timings, now, timeZone }) {
    this.gladys = gladys;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.timeZone = resolveTimeZone(timeZone ?? process.env.TZ);
    this.config = null;
    this.client = null;
    this.reset();
    this.connection = null;
    this.devicesSignature = null;
    this.widgetSignature = null;
    this.transports = new Map();
    this.timer = null;
    this.polling = null;
    this.stopped = false;
    /** Problems already logged, by key: repeats go to debug. */
    this.warned = new Set();
  }

  reset() {
    this.children = [];
    this.timers = [];
    /** Entries of each child, by child id: { feedings, changes, sleep, ... }. */
    this.entries = new Map();
    this.error = null;
    this.downSince = null;
    this.readAt = 0;
    this.connectedLogged = false;
    /** Per child: the last feeding seen and the hours already announced for it. */
    this.overdue = new Map();
  }

  // --- Logs ------------------------------------------------------------------
  // Info keeps the lifecycle only (connected, lost, back, user commands). A
  // problem that repeats is logged once, then at debug until it clears.

  problem(key, message, level = 'warn') {
    if (this.warned.has(key)) {
      logger.debug(message);
      return;
    }
    this.warned.add(key);
    logger[level](message);
  }

  resolved(key, message) {
    if (this.warned.delete(key) && message) {
      logger.info(message);
    }
  }

  get language() {
    return this.config?.language ?? 'en';
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.connection = null;
    this.devicesSignature = null;
    this.transports.clear();
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const same =
      previous &&
      previous.url === config.url &&
      previous.apiKey === config.apiKey &&
      previous.allowSelfSigned === config.allowSelfSigned;
    if (!same) {
      this.reset();
      this.client =
        config.url && config.apiKey
          ? new BabyBuddyClient({
              url: config.url,
              apiKey: config.apiKey,
              insecure: config.allowSelfSigned,
              request: this.request,
            })
          : null;
    }
    // A new language or unit: the devices and their states are published again.
    this.devicesSignature = null;
    this.gladys.forgetPublishedStates?.();
    await this.poll();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.polling?.catch(() => {});
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.timer = setTimeout(() => {
      this.tick().catch((err) => this.problem('tick', `Tick failed: ${err.message}`, 'error'));
    }, this.timings.tickMs);
  }

  /** Every minute: read Baby Buddy when due, else recompute from what was read. */
  async tick() {
    const now = this.now();
    const due = this.error
      ? now - this.lastAttempt >= this.timings.retryMs
      : now - this.readAt >= this.config.pollIntervalMs - this.timings.tickMs / 2;
    if (due) {
      await this.poll();
      return;
    }
    const run = async () => {
      try {
        await this.publish(now);
      } finally {
        this.schedule();
      }
    };
    this.polling = (this.polling ?? Promise.resolve()).catch(() => {}).then(run);
    await this.polling;
  }

  // --- Reading ---------------------------------------------------------------

  /** One reading at a time: a call during a reading waits for it, then reads. */
  poll() {
    const run = async () => {
      try {
        await this.read();
      } finally {
        this.schedule();
      }
    };
    this.polling = (this.polling ?? Promise.resolve()).catch(() => {}).then(run);
    return this.polling;
  }

  async read() {
    if (!this.client) {
      await this.publishConnectionStatus();
      return;
    }
    const now = this.now();
    this.lastAttempt = now;
    const { client } = this;
    try {
      const [children, timers] = await Promise.all([client.children(), client.timers()]);
      const parsedChildren = parseChildren(children);
      const entries = new Map(
        await Promise.all(
          parsedChildren.map(async (child) => {
            const lists = await Promise.all(
              ENTRY_KINDS.map((kind) => client.entries(kind, child.id)),
            );
            return [
              child.id,
              Object.fromEntries(
                ENTRY_KINDS.map((kind, index) => [kind, parseEntries(kind, lists[index])]),
              ),
            ];
          }),
        ),
      );
      if (client !== this.client) {
        // The configuration changed during the reading: this is the old
        // instance; the new one is being read.
        return;
      }
      this.children = parsedChildren;
      this.timers = parseTimers(timers);
      this.entries = entries;
      this.readAt = now;
      this.recovered(now);
    } catch (err) {
      if (client !== this.client) {
        return;
      }
      this.failed(err, now);
    }
    await this.publish(now);
  }

  async publish(now) {
    if (this.children.length > 0) {
      await this.publishDevices();
      if (!this.error) {
        await this.publishStates(now);
        await this.fireEvents(now);
      }
    }
    await this.publishTransports();
    await this.publishConnectionStatus();
    this.refreshWidget(now);
  }

  recovered(now) {
    const host = hostOf(this.config.url);
    if (this.downSince !== null) {
      const minutes = Math.round((now - this.downSince) / 60_000);
      this.resolved('read', `Baby Buddy at ${host} answers again after ${minutes} min`);
    }
    if (!this.connectedLogged) {
      this.connectedLogged = true;
      logger.info(`Connected to Baby Buddy at ${host}: ${this.children.length} child(ren)`);
    }
    this.error = null;
    this.downSince = null;
  }

  failed(err, now) {
    const kind = err instanceof BabyBuddyError ? err.kind : ERROR_KINDS.HTTP;
    this.error = { kind, message: err.message };
    this.downSince ??= now;
    this.problem('read', `Baby Buddy at ${hostOf(this.config.url)}: ${err.message}`, 'error');
  }

  /** The child of a device external id, null when none. */
  childOf(externalId) {
    return (
      this.children.find((child) => childIds(this.gladys, child.id).device === externalId) ?? null
    );
  }

  summary(childId, now = this.now()) {
    const entries = this.entries.get(childId) ?? {
      feedings: [],
      changes: [],
      sleep: [],
      temperature: [],
      weight: [],
    };
    return summarize(
      entries,
      this.timers.filter((timer) => timer.childId === childId),
      { now, day: localDay(now, this.timeZone) },
    );
  }

  // --- Publishing to Gladys --------------------------------------------------

  devices() {
    return this.children.map((child) => buildChild(this.gladys, child, this.config));
  }

  async publishDevices() {
    const devices = this.devices();
    const signature = JSON.stringify(devices);
    if (signature === this.devicesSignature) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.devicesSignature = signature;
      this.resolved('devices');
    } catch (err) {
      this.problem('devices', `Discovered devices refused: ${err.message}`);
    }
  }

  /** "Search" in the Discovery tab. */
  async rediscover() {
    this.devicesSignature = null;
    await this.poll();
  }

  /** The user added a device: the states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    this.gladys.forgetPublishedStates?.(device?.external_id);
    if (!this.error && this.children.length > 0) {
      await this.publishStates(this.now());
    }
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  states(now) {
    return this.children.flatMap((child) =>
      childStates(this.gladys, child.id, this.summary(child.id, now), { now, ...this.config }),
    );
  }

  async publishStates(now) {
    try {
      // Only the changes, and every value again after `heartbeatMs`.
      await this.gladys.publishChangedStates(this.states(now), {
        heartbeat: this.timings.heartbeatMs,
      });
      this.resolved('states');
    } catch (err) {
      this.problem('states', `States refused: ${err.message}`);
    }
  }

  async publishTransports() {
    if (this.children.length === 0 || (this.error === null && this.readAt === 0)) {
      return;
    }
    const transport = this.error ? DEVICE_TRANSPORTS.UNREACHABLE : DEVICE_TRANSPORTS.LOCAL;
    const entries = this.devices()
      .map((device) => ({ external_id: device.external_id, transport }))
      .filter((entry) => this.transports.get(entry.external_id) !== entry.transport);
    if (entries.length === 0) {
      return;
    }
    try {
      await this.gladys.publishTransports(entries);
      for (const entry of entries) {
        this.transports.set(entry.external_id, entry.transport);
      }
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transports refused: ${err.message}`);
    }
  }

  connectionStatus() {
    if (!this.config.url) {
      return {
        connected: false,
        message: this.config.urlTyped ? CONNECTION_TEXT.invalidUrl : CONNECTION_TEXT.noUrl,
      };
    }
    if (!this.config.apiKey) {
      return { connected: false, message: CONNECTION_TEXT.noKey };
    }
    if (this.error) {
      return { connected: false, message: ERROR_TEXT[this.error.kind] };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  refreshWidget(now) {
    // The widget shows minutes: a new minute is a new content.
    const signature = JSON.stringify([
      this.error?.kind ?? null,
      this.children,
      this.timers,
      [...this.entries],
      Math.floor(now / 60_000),
    ]);
    if (signature !== this.widgetSignature) {
      this.widgetSignature = signature;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  // --- Scene event -----------------------------------------------------------

  /**
   * "No feeding for N hours": once per feeding and per whole hour crossed,
   * from 1 to 8, with `hours` = N, so the trigger's `hours` filter picks its
   * threshold (a select: the core compares it as the string "3"). Nothing while a feeding timer runs. What is already crossed at
   * the first reading of a child (a restart) is known, not news.
   */
  async fireEvents(now) {
    for (const child of this.children) {
      const summary = this.summary(child.id, now);
      const feeding = summary.lastFeeding;
      if (!feeding) {
        continue;
      }
      const hours = Math.floor(Math.max(0, now - feeding.endAt) / HOUR);
      const seen = this.overdue.get(child.id);
      if (!seen || seen.feedingId !== feeding.id) {
        // First reading of this child, or a new feeding: start counting from here.
        this.overdue.set(child.id, { feedingId: feeding.id, announced: seen ? 0 : hours });
        if (!seen) {
          continue;
        }
      }
      const state = this.overdue.get(child.id);
      if (summary.feedingTimer || hours <= state.announced) {
        continue;
      }
      const from = state.announced;
      state.announced = hours;
      for (const crossed of OVERDUE_HOURS.filter((h) => h > from && h <= hours)) {
        await this.fire(TRIGGERS.FEEDING_OVERDUE, {
          child: childIds(this.gladys, child.id).device,
          hours: crossed,
          child_name: child.firstName,
          minutes_since: minutesSince(feeding.endAt, now),
          last_feeding: new Date(feeding.endAt).toISOString(),
        });
      }
    }
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.resolved('scene-event');
    } catch (err) {
      this.problem('scene-event', `Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Commands --------------------------------------------------------------

  /** A Baby Buddy error, in the user's words. */
  translate(err) {
    const language = this.language;
    if (!(err instanceof BabyBuddyError)) {
      return err;
    }
    if (err.status === 400) {
      const text = JSON.stringify(err.details ?? '');
      if (/intersects/i.test(text)) {
        return new Error(pick(ACTION_TEXT.overlap, language), { cause: err });
      }
      return new Error(
        `${pick(ACTION_TEXT.refused, language)} ${err.message.replace(/^HTTP 400 ?/, '')}`
          .trim()
          .slice(0, 200),
        { cause: err },
      );
    }
    const colon = language === 'fr' ? ' : ' : ': ';
    const status = err.status ? ` (HTTP ${err.status})` : '';
    return new Error(`Baby Buddy${colon}${pick(ERROR_TEXT[err.kind], language)}${status}`, {
      cause: err,
    });
  }

  /**
   * The child of a device external id, read again if unknown (a child added
   * in Baby Buddy a minute ago).
   */
  async resolveChild(externalId) {
    if (!this.client) {
      throw new Error(pick(ACTION_TEXT.notConfigured, this.language));
    }
    let child = this.childOf(externalId);
    if (!child) {
      try {
        this.children = parseChildren(await this.client.children());
      } catch (err) {
        throw this.translate(err);
      }
      child = this.childOf(externalId);
    }
    if (!child) {
      throw new Error(pick(ACTION_TEXT.unknownChild, this.language));
    }
    return child;
  }

  /** Read again so states, widget and events follow, without holding the answer. */
  async refreshAfterCommand() {
    const refresh = this.poll().catch(() => {});
    let timeout;
    await Promise.race([
      refresh,
      new Promise((resolve) => {
        timeout = setTimeout(resolve, REFRESH_WAIT_MS);
      }),
    ]);
    clearTimeout(timeout);
  }

  /**
   * Log a diaper change now.
   * @returns {Promise<{ child: object, kind: string, message: object }>}
   */
  async logDiaper(externalId, kind) {
    if (!Object.values(DIAPER_KINDS).includes(kind)) {
      throw new Error(pick(ACTION_TEXT.badField, this.language));
    }
    const child = await this.resolveChild(externalId);
    try {
      await this.client.addChange(child.id, {
        wet: kind !== DIAPER_KINDS.SOLID,
        solid: kind !== DIAPER_KINDS.WET,
      });
    } catch (err) {
      throw this.translate(err);
    }
    logger.info(`Diaper change (${kind}) logged for child #${child.id} from Gladys`);
    await this.refreshAfterCommand();
    return {
      child,
      kind,
      message: allLanguages((language) => DONE_TEXT[language][kind](child.firstName)),
    };
  }

  /**
   * Start, stop or toggle the sleep or feeding timer of a child. Stopping
   * turns the timer into a Baby Buddy entry (start = timer start, end = now).
   * Starting a running timer, or stopping none, changes nothing.
   * @returns {Promise<{ child: object, running: boolean, minutes: number, message: object }>}
   */
  async activity(externalId, activity, command) {
    if (
      !Object.values(ACTIVITIES).includes(activity) ||
      !Object.values(COMMANDS).includes(command)
    ) {
      throw new Error(pick(ACTION_TEXT.badField, this.language));
    }
    const child = await this.resolveChild(externalId);
    let running;
    try {
      // A fresh list: the timer may have been started or stopped in Baby Buddy.
      this.timers = parseTimers(await this.client.timers());
      running =
        this.timers.find((timer) => timer.childId === child.id && timer.activity === activity) ??
        null;
    } catch (err) {
      throw this.translate(err);
    }
    const wanted =
      command === COMMANDS.TOGGLE ? (running ? COMMANDS.STOP : COMMANDS.START) : command;
    const done = (outcome, isRunning, minutes = 0) => ({
      child,
      running: isRunning,
      minutes,
      message: allLanguages((language) =>
        DONE_TEXT[language][`${activity}${outcome}`](child.firstName, minutes),
      ),
    });

    if (wanted === COMMANDS.START) {
      if (running) {
        return done('Running', true);
      }
      try {
        await this.client.startTimer(child.id, pick(TIMER_NAMES[activity], this.language));
      } catch (err) {
        throw this.translate(err);
      }
      logger.info(`${activity} timer started for child #${child.id} from Gladys`);
      await this.refreshAfterCommand();
      return done('Started', true);
    }

    if (!running) {
      return done('None', false);
    }
    let entry;
    try {
      entry =
        activity === ACTIVITIES.SLEEP
          ? await this.client.sleepFromTimer(running.id)
          : await this.client.feedingFromTimer(running.id, {
              type: this.config.feedingType,
              method: this.config.feedingMethod,
            });
    } catch (err) {
      throw this.translate(err);
    }
    const start = Date.parse(entry?.start ?? '');
    const end = Date.parse(entry?.end ?? '');
    const minutes =
      Number.isFinite(start) && Number.isFinite(end)
        ? Math.max(0, Math.round((end - start) / 60_000))
        : minutesSince(running.startAt, this.now());
    logger.info(`${activity} recorded for child #${child.id} from Gladys (${minutes} min)`);
    await this.refreshAfterCommand();
    return done('Stopped', false, minutes);
  }

  /** The "Test the connection" action: read now, report. */
  async testConnection() {
    await this.poll();
    const status = this.connectionStatus();
    if (!status.connected) {
      const message = allLanguages((language) =>
        REPORT_TEXT[language].failed(pick(status.message, language)),
      );
      throw new Error(message[this.language]);
    }
    return allLanguages((language) =>
      REPORT_TEXT[language].ok(this.children.length, this.timers.length),
    );
  }
}
