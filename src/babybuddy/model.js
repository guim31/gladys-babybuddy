// -----------------------------------------------------------------------------
// Baby Buddy data, as the integration uses it: children, running timers, the
// newest entries of each child, and the summary of a child for the local day
// (src/devices.js publishes it, src/widgets.js shows it).
// -----------------------------------------------------------------------------

export const ACTIVITIES = Object.freeze({ SLEEP: 'sleep', FEEDING: 'feeding' });

// Baby Buddy timers have a free name (or none). A timer counts as a sleep or a
// feeding by its name, in the four languages of Gladys and the usual words of
// the Baby Buddy interface; an unnamed timer is neither.
const TIMER_WORDS = {
  [ACTIVITIES.SLEEP]: /sleep|nap|sommeil|dodo|sieste|schlaf|nickerchen|sueno|siesta/,
  [ACTIVITIES.FEEDING]:
    /feed|meal|bottle|breast|nursing|repas|biberon|tetee|allaitement|essen|mahlzeit|flasche|stillen|comida|toma|lactancia/,
};

// Names of the timers Gladys starts (matched by TIMER_WORDS).
export const TIMER_NAMES = {
  [ACTIVITIES.SLEEP]: { en: 'Sleep', fr: 'Sommeil', de: 'Schlaf', es: 'Sueño' },
  [ACTIVITIES.FEEDING]: { en: 'Feeding', fr: 'Repas', de: 'Mahlzeit', es: 'Comida' },
};

const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** The activity of a timer, by its name: `sleep`, `feeding` or null. */
export function timerActivity(name) {
  const folded = fold(name);
  if (!folded) {
    return null;
  }
  for (const [activity, words] of Object.entries(TIMER_WORDS)) {
    if (words.test(folded)) {
      return activity;
    }
  }
  return null;
}

const time = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};
const integer = (value) => (Number.isInteger(value) ? value : null);
const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function parseChildren(list) {
  return list
    .filter((child) => integer(child?.id) !== null)
    .map((child) => ({
      id: child.id,
      name:
        [child.first_name, child.last_name]
          .filter((part) => typeof part === 'string' && part.trim())
          .join(' ')
          .trim() || `#${child.id}`,
      firstName:
        typeof child.first_name === 'string' && child.first_name.trim()
          ? child.first_name.trim()
          : `#${child.id}`,
    }))
    .sort((a, b) => a.id - b.id);
}

export function parseTimers(list) {
  return (
    list
      // Baby Buddy 1.x keeps stopped timers in the list, with `active: false`.
      .filter(
        (timer) =>
          integer(timer?.id) !== null && integer(timer.child) !== null && timer.active !== false,
      )
      .map((timer) => ({
        id: timer.id,
        childId: timer.child,
        name: typeof timer.name === 'string' ? timer.name : '',
        startAt: time(timer.start),
        activity: timerActivity(timer.name),
      }))
      .filter((timer) => timer.startAt !== null)
      // The oldest first: the timer of an activity is its first one.
      .sort((a, b) => a.startAt - b.startAt || a.id - b.id)
  );
}

/** Entries of a child, newest first, with `startAt`/`endAt` (or `at`) in ms. */
export function parseEntries(kind, list) {
  const entries = list.filter((entry) => integer(entry?.id) !== null);
  switch (kind) {
    case 'feedings':
    case 'sleep':
      return entries
        .map((entry) => ({
          id: entry.id,
          startAt: time(entry.start),
          endAt: time(entry.end),
          amount: number(entry.amount),
        }))
        .filter((entry) => entry.startAt !== null && entry.endAt !== null)
        .sort((a, b) => b.endAt - a.endAt);
    case 'changes':
      return entries
        .map((entry) => ({
          id: entry.id,
          at: time(entry.time),
          wet: entry.wet === true,
          solid: entry.solid === true,
        }))
        .filter((entry) => entry.at !== null)
        .sort((a, b) => b.at - a.at);
    case 'temperature':
      return entries
        .map((entry) => ({ id: entry.id, at: time(entry.time), value: number(entry.temperature) }))
        .filter((entry) => entry.at !== null && entry.value !== null)
        .sort((a, b) => b.at - a.at);
    case 'weight':
      return entries
        .map((entry) => ({ id: entry.id, date: entry.date, value: number(entry.weight) }))
        .filter((entry) => typeof entry.date === 'string' && entry.value !== null)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    default:
      return [];
  }
}

const MINUTE = 60_000;

/**
 * The summary of a child at `now`, for the local day `day`.
 * @param {{ feedings: Array, changes: Array, sleep: Array, temperature: Array, weight: Array }} entries
 * @param {Array} timers the running timers of this child
 */
export function summarize(entries, timers, { now, day }) {
  const lastFeeding = entries.feedings[0] ?? null;
  const lastChange = entries.changes[0] ?? null;
  const sleepMs = entries.sleep.reduce((total, entry) => {
    const start = Math.max(entry.startAt, day.start);
    const end = Math.min(entry.endAt, now);
    return end > start ? total + (end - start) : total;
  }, 0);
  const timerOf = (activity) => timers.find((timer) => timer.activity === activity) ?? null;
  return {
    lastFeeding,
    feedingsToday: entries.feedings.filter((entry) => entry.startAt >= day.start).length,
    lastChange,
    changesToday: entries.changes.filter((entry) => entry.at >= day.start).length,
    sleepTodayMinutes: Math.floor(sleepMs / MINUTE),
    sleepTimer: timerOf(ACTIVITIES.SLEEP),
    feedingTimer: timerOf(ACTIVITIES.FEEDING),
    temperature: entries.temperature[0] ?? null,
    weight: entries.weight[0] ?? null,
  };
}

/** Whole minutes from `since` to `now`, never negative. */
export const minutesSince = (since, now) => Math.max(0, Math.floor((now - since) / MINUTE));

// --- Local day (the TZ of Gladys) ---------------------------------------------

const partsFormatters = new Map();

function zonedParts(ms, timeZone) {
  let format = partsFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]),
  );
  return parts;
}

/** Offset of `timeZone` from UTC at `ms`, in milliseconds. */
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** UTC instant of local midnight of a local calendar day (DST-safe). */
function localMidnight(year, month, day, timeZone) {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetAt(guess, timeZone);
  let start = guess - offsetAt(first, timeZone);
  // Where the clocks jump at midnight (Chile, Cuba), 00:00 does not exist and
  // the instant found is 23:00 the day before: the day starts an hour later.
  if (zonedParts(start, timeZone).day !== day) {
    start += 60 * 60_000;
  }
  return start;
}

/** A time zone Intl knows, else the one of the process. */
export function resolveTimeZone(timeZone) {
  try {
    if (timeZone) {
      new Intl.DateTimeFormat('en-US', { timeZone });
      return timeZone;
    }
  } catch {
    // fall through
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Start and end (exclusive) of the local day holding `now`. */
export function localDay(now, timeZone) {
  const p = zonedParts(now, timeZone);
  const start = localMidnight(p.year, p.month, p.day, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = localMidnight(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  return { start, end };
}
