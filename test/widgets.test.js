// -----------------------------------------------------------------------------
// The "Baby Buddy" widget: content within the core budget (validated by the
// SDK's validateWidgetContent), the chosen child, the buttons and the
// degraded states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LOU, SACHA, childId, createWorld } from './helpers/world.js';
import { formatMinutes } from '../src/widgets.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function content(w, settings = {}, language = 'en') {
  const ack = await w.fake.widgetGet('child_summary', { settings, language, units: 'metric' });
  assert.equal(ack.success, true, ack.error);
  const { content: tree } = ack.data;
  assert.deepEqual(validateWidgetContent(tree), [], 'within the core vocabulary and budget');
  assert.ok(tree.components.length <= 8);
  return tree;
}

const ofType = (data, type) => data.components.filter((component) => component.type === type);

test('the first child by default: tiles, status, four buttons', async (t) => {
  const w = await world(t);
  const data = await content(w);
  assert.deepEqual(
    ofType(data, 'value').map((tile) => tile.value),
    ['2 h 00', '1 h 55', '7 h 20'],
  );
  assert.deepEqual(
    ofType(data, 'status')[0].items.map((row) => [row.label, row.value]),
    [
      ['Lou', 'Asleep since 14:50'],
      ['Feeding', 'Last at 13:15'],
      ['Diaper', 'Wet · 13:20'],
    ],
  );
  assert.deepEqual(
    ofType(data, 'button').map((button) => [button.label, button.action.key, button.action.params]),
    [
      ['Wet diaper', 'diaper_wet', { child: LOU }],
      ['Dirty diaper', 'diaper_solid', { child: LOU }],
      ['Woke up', 'sleep_timer', { child: LOU, command: 'stop' }],
      ['Start feeding', 'feeding_timer', { child: LOU, command: 'start' }],
    ],
  );
});

test('the child chosen in the settings, in French', async (t) => {
  const w = await world(t);
  const data = await content(w, { device: childId(w.gladys, SACHA).device }, 'fr');
  assert.equal(ofType(data, 'value')[0].value, '…', 'a feeding is in progress');
  assert.deepEqual(ofType(data, 'status')[0].items[1].value, 'En cours depuis 15:05');
  assert.equal(ofType(data, 'button')[3].label, 'Fin repas');
});

test('the buttons write in Baby Buddy and answer a toast', async (t) => {
  const w = await world(t);
  let ack = await w.fake.widgetAction('child_summary', 'diaper_solid', { child: LOU });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.fr, 'Couche sale notée pour Lou.');
  assert.deepEqual(
    [w.server.data.changes.at(-1).wet, w.server.data.changes.at(-1).solid],
    [false, true],
  );
  ack = await w.fake.widgetAction('child_summary', 'sleep_timer', { child: LOU, command: 'stop' });
  assert.equal(ack.data.message.en, 'Sleep of Lou recorded: 25 min.');
  // The same stale button again: nothing is started.
  const timers = w.server.timers.length;
  ack = await w.fake.widgetAction('child_summary', 'sleep_timer', { child: LOU, command: 'stop' });
  assert.equal(ack.data.message.en, 'No sleep timer is running for Lou.');
  assert.equal(w.server.timers.length, timers);
  const bad = await w.fake.widgetAction('child_summary', 'sleep_timer', { child: LOU });
  assert.equal(bad.success, false);
  const unknown = await w.fake.widgetAction('child_summary', 'reboot', { child: LOU });
  assert.equal(unknown.success, false);
});

test('degraded states: not configured, unknown child, no answer, stale values', async (t) => {
  const empty = await world(t, { config: {} });
  assert.match((await content(empty)).components[0].text, /Enter the address/);

  const w = await world(t);
  assert.match(
    (await content(w, { device: 'babybuddy:child:child-99' })).components[0].text,
    /no longer in Baby Buddy/,
  );
  w.server.online = false;
  await w.hub.poll();
  const stale = await content(w);
  assert.equal(stale.components[0].variant, 'caption');
  assert.equal(ofType(stale, 'button').length, 0, 'no button while Baby Buddy does not answer');

  const server = (await import('./helpers/world.js')).FakeBabyBuddy;
  const down = new server();
  down.online = false;
  const never = await world(t, { server: down });
  assert.match((await content(never)).components[0].text, /does not answer/);
});

test('durations fit a tile', () => {
  assert.equal(formatMinutes(0), '0 min');
  assert.equal(formatMinutes(59), '59 min');
  assert.equal(formatMinutes(65), '1 h 05');
  assert.equal(formatMinutes(6000), '99+ h');
  for (const minutes of [0, 59, 61, 5999, 99999]) {
    assert.ok(formatMinutes(minutes).length <= 12);
  }
});
