// -----------------------------------------------------------------------------
// The hub against the fake Baby Buddy: states of each child, the "no feeding
// for N hours" event, diaper changes and timers from scenes, outages. The
// clock starts on 17/10/2026 at 15:15 in Paris: Lou (#1) ate until 13:15,
// had a diaper at 13:20 and sleeps on a timer since 14:50; Sacha (#2) ate
// until 12:30 and is eating again on a timer since 15:05.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_KEY, LOU, SACHA, START, childId, createClock, createWorld } from './helpers/world.js';

const HOUR = 60 * 60_000;

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const states = (w, id) => {
  const ids = childId(w.gladys, id);
  return Object.fromEntries(
    [
      'minutes_since_feeding',
      'feedings_today',
      'feeding_in_progress',
      'minutes_since_change',
      'changes_today',
      'sleeping',
      'sleep_today',
      'temperature',
      'weight',
    ].map((key) => [key, w.fake.lastState(ids.feature(key))]),
  );
};

test('the states of each child, from the real answers', async (t) => {
  const w = await world(t);
  assert.deepEqual(states(w, LOU), {
    minutes_since_feeding: 120,
    feedings_today: 4,
    feeding_in_progress: 0,
    minutes_since_change: 115,
    changes_today: 3,
    sleeping: 1,
    // 00:00-03:00, 03:40-06:20 and 10:30-12:10: the night before midnight is not today.
    sleep_today: 440,
    temperature: 37.4,
    weight: '4.85 kg',
  });
  assert.deepEqual(states(w, SACHA), {
    minutes_since_feeding: 165,
    feedings_today: 1,
    feeding_in_progress: 1,
    minutes_since_change: 255,
    changes_today: 1,
    sleeping: 0,
    sleep_today: 420,
    temperature: undefined,
    weight: '9.2 kg',
  });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => device.name),
    ['Baby Buddy Lou', 'Baby Buddy Sacha'],
  );
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('the French names and the decimal comma', async (t) => {
  const w = await world(t, { config: { url: 'http://192.0.2.30:8000', api_key: API_KEY } });
  assert.equal(states(w, LOU).weight, '4,85 kg');
  const names = w.fake.discoveredDevices[0].features.map((feature) => feature.name);
  assert.ok(names.includes('Depuis le dernier repas'));
});

test('the minute counters move on each tick without reading Baby Buddy', async (t) => {
  const w = await world(t, {
    config: {
      url: 'http://192.0.2.30:8000',
      api_key: API_KEY,
      language: 'en',
      poll_interval: '300',
    },
  });
  const before = w.server.requests.length;
  w.clock.advance(60_000);
  await w.hub.tick();
  assert.equal(w.server.requests.length, before, 'no reading before the interval');
  assert.equal(states(w, LOU).minutes_since_feeding, 121);
  w.clock.advance(4 * 60_000);
  await w.hub.tick();
  assert.ok(w.server.requests.length > before, 'read once the interval has passed');
});

test('"no feeding for N hours": once per whole hour, not for what was already crossed', async (t) => {
  const w = await world(t);
  const fired = () => w.fake.sceneEvents.filter((event) => event.key === 'feeding_overdue');
  // At start, Lou is at 2 h and Sacha at 2 h 45: known, not news.
  assert.equal(fired().length, 0);
  w.clock.advance(HOUR);
  await w.hub.poll();
  // Lou crosses 3 h; Sacha crosses 3 h too, but eats on a timer: nothing for her.
  assert.deepEqual(
    fired().map((event) => [event.data.child_name, event.data.hours]),
    [['Lou', 3]],
  );
  assert.equal(fired()[0].data.child, childId(w.gladys, LOU).device);
  assert.equal(fired()[0].data.minutes_since, 180);
  assert.equal(fired()[0].data.last_feeding, new Date(START - 2 * HOUR).toISOString());
  await w.hub.poll();
  assert.equal(fired().length, 1, 'not twice for the same hour');
  // Three hours of outage: 4, 5 and 6 h are announced when Baby Buddy is back.
  w.server.online = false;
  w.clock.advance(3 * HOUR);
  await w.hub.poll();
  w.server.online = true;
  await w.hub.poll();
  assert.deepEqual(
    fired().map((event) => event.data.hours),
    [3, 4, 5, 6],
  );
});

test('a new feeding starts the count again', async (t) => {
  const w = await world(t);
  const fired = () => w.fake.sceneEvents.filter((event) => event.key === 'feeding_overdue');
  w.clock.advance(HOUR);
  const ack = await w.fake.sceneAction('track_activity', {
    child: childId(w.gladys, SACHA).device,
    activity: 'feeding',
    command: 'stop',
  });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.duration_minutes, 70);
  assert.equal(ack.data.outputs.running, false);
  const feeding = w.server.data.feedings.at(-1);
  assert.equal(feeding.type, 'breast milk');
  assert.equal(feeding.method, 'both breasts');
  assert.equal(states(w, SACHA).feeding_in_progress, 0);
  assert.equal(states(w, SACHA).minutes_since_feeding, 0);
  w.clock.advance(HOUR + 60_000);
  await w.hub.poll();
  assert.deepEqual(
    fired()
      .filter((event) => event.data.child_name === 'Sacha')
      .map((event) => event.data.hours),
    [1],
  );
});

test('log a diaper change from a scene', async (t) => {
  const w = await world(t);
  const ack = await w.fake.sceneAction('log_diaper', {
    child: childId(w.gladys, LOU).device,
    kind: 'both',
  });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, { child_name: 'Lou', kind: 'both' });
  const change = w.server.data.changes.at(-1);
  assert.deepEqual([change.child, change.wet, change.solid], [LOU, true, true]);
  assert.equal(states(w, LOU).minutes_since_change, 0);
  assert.equal(states(w, LOU).changes_today, 4);

  const unknown = await w.fake.sceneAction('log_diaper', { child: 'nope', kind: 'wet' });
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /no longer in Baby Buddy/);
  const bad = await w.fake.sceneAction('log_diaper', {
    child: childId(w.gladys, LOU).device,
    kind: 'blue',
  });
  assert.equal(bad.success, false);
});

test('the toggle starts, then stops, the sleep timer', async (t) => {
  const w = await world(t);
  const child = childId(w.gladys, SACHA).device;
  const toggle = () =>
    w.fake.sceneAction('track_activity', { child, activity: 'sleep', command: 'toggle' });
  let ack = await toggle();
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.running, true);
  const timer = w.server.timers.at(-1);
  assert.deepEqual([timer.child, timer.name], [SACHA, 'Sleep']);
  assert.equal(states(w, SACHA).sleeping, 1);
  w.clock.advance(45 * 60_000);
  ack = await toggle();
  assert.equal(ack.data.outputs.running, false);
  assert.equal(ack.data.outputs.duration_minutes, 45);
  assert.equal(states(w, SACHA).sleeping, 0);
  assert.equal(w.server.data.sleep.at(-1).child, SACHA);
  // Start twice, stop with none: nothing changes, no error.
  await w.fake.sceneAction('track_activity', { child, activity: 'sleep', command: 'start' });
  const count = w.server.timers.length;
  ack = await w.fake.sceneAction('track_activity', { child, activity: 'sleep', command: 'start' });
  assert.equal(ack.success, true);
  assert.equal(w.server.timers.length, count);
});

test('an overlap refused by Baby Buddy is explained, and the timer kept', async (t) => {
  const w = await world(t);
  // A feeding written in Baby Buddy meanwhile, overlapping Sacha's timer.
  w.server.data.feedings.push({
    id: 999,
    child: SACHA,
    start: new Date(START - 5 * 60_000).toISOString(),
    end: new Date(START).toISOString(),
  });
  const ack = await w.fake.sceneAction('track_activity', {
    child: childId(w.gladys, SACHA).device,
    activity: 'feeding',
    command: 'stop',
  });
  assert.equal(ack.success, false);
  assert.match(ack.error, /another entry already covers this time/);
  assert.ok(w.server.timers.some((timer) => timer.child === SACHA));
});

test('an outage: unreachable devices, connection status, back again', async (t) => {
  const w = await world(t);
  w.server.online = false;
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.equal(w.fake.transports.at(-1).transport, 'unreachable');
  w.server.online = true;
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.equal(w.fake.transports.at(-1).transport, 'local');
});

test('a wrong key and a missing configuration', async (t) => {
  const wrong = await world(t, {
    config: { url: 'http://192.0.2.30:8000', api_key: 'f'.repeat(40), language: 'en' },
  });
  assert.equal(wrong.fake.connectionStatus.connected, false);
  assert.match(wrong.fake.connectionStatus.message.en, /API key refused/);
  const test = await wrong.fake.action('test_connection', {});
  assert.equal(test.success, false);

  const empty = await world(t, { config: {} });
  assert.match(empty.fake.connectionStatus.message.en, /Enter the address/);
  const bad = await world(t, { config: { url: 'ftp://x', api_key: 'k' } });
  assert.match(bad.fake.connectionStatus.message.en, /Address not understood/);
});

test('the connection test reports the children and timers', async (t) => {
  const w = await world(t);
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.fr, 'Baby Buddy OK : 2 enfant(s), 2 minuteur(s) en cours.');
});

test('a device added in Gladys gets its states again', async (t) => {
  const w = await world(t, { clock: createClock() });
  const device = w.fake.discoveredDevices[0];
  const count = w.fake.states.length;
  await w.fake.deviceCreated(device);
  assert.ok(w.fake.states.length > count, 'states sent again');
});
