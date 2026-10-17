// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only. A normal reading writes nothing, a failure that repeats is logged
// once, and its end once. Never the API key.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_KEY, LOU, childId, createClock, createWorld } from './helpers/world.js';

function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({
        stream,
        text: args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '),
      });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  t.mock.method(console, 'warn', record('err'));
  return {
    lines,
    clear: () => lines.splice(0),
    texts: () => lines.map((line) => line.text),
  };
}

async function world(t, options = {}) {
  const w = await createWorld({ clock: createClock(), ...options });
  t.after(() => w.app.stop());
  return w;
}

test('a normal reading cycle writes nothing at info', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  assert.ok(
    logs.texts().some((text) => text.includes('Connected to Baby Buddy')),
    'the start is logged',
  );
  logs.clear();
  for (let i = 0; i < 5; i += 1) {
    w.clock.advance(60_000);
    await w.hub.tick();
  }
  assert.deepEqual(logs.texts(), []);
});

test('an outage is logged once, and once when Baby Buddy is back', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.server.online = false;
  for (let i = 0; i < 6; i += 1) {
    w.clock.advance(60_000);
    await w.hub.poll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  logs.clear();
  w.server.online = true;
  await w.hub.poll();
  await w.hub.poll();
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /answers again after 5 min/);
});

test('an entry from Gladys writes one line; never the API key, even at debug', async (t) => {
  const logs = captureLogs(t, 'debug');
  const w = await world(t);
  await w.fake.sceneAction('log_diaper', { child: childId(w.gladys, LOU).device, kind: 'wet' });
  w.server.online = false;
  await w.hub.poll();
  const text = logs.texts().join('\n');
  assert.match(text, /Diaper change \(wet\) logged for child #1 from Gladys/);
  assert.ok(!text.includes(API_KEY), 'never the key');

  const refused = await world(t, {
    config: { url: 'http://192.0.2.30:8000', api_key: 'secret_wrong_key' },
  });
  await refused.hub.poll();
  assert.ok(!logs.texts().join('\n').includes('secret_wrong_key'), 'never a refused key');
});
