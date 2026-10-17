// -----------------------------------------------------------------------------
// The timer of the container. Gladys never polls a device published with
// should_poll: false (nor one created without should_poll,
// GladysAssistant/Gladys#3198): Baby Buddy must be read by the hub's own
// timer, with no onPoll at all.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_KEY, LOU, childId, createAll, createClock, createWorld } from './helpers/world.js';

const settle = async () => {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const reads = (server) => server.requests.filter((r) => r.path === '/api/children/').length;

test('the internal timer reads Baby Buddy without any onPoll from Gladys', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = createClock();
  const w = await createWorld({
    clock,
    config: { url: 'http://192.0.2.30:8000', api_key: API_KEY, poll_interval: '120' },
    timers: true,
  });
  t.after(() => w.app.stop());
  await createAll(w);
  assert.equal(w.fake.discoveredDevices[0].should_poll, false, 'Gladys is not asked to poll');
  const since = childId(w.gladys, LOU).feature('minutes_since_feeding');
  const before = reads(w.server);
  for (let i = 0; i < 4; i += 1) {
    clock.advance(60_000);
    t.mock.timers.tick(60_000);
    await settle();
  }
  assert.equal(reads(w.server) - before, 2, 'one reading every two minutes');
  assert.equal(w.fake.lastState(since), 124, 'the counter moved every minute');
});

test('the timer stops with the integration', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = await createWorld({ timers: true });
  await w.app.stop();
  const before = w.server.requests.length;
  t.mock.timers.tick(60 * 60_000);
  await settle();
  assert.equal(w.server.requests.length, before);
});
