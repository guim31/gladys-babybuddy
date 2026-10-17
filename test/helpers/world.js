// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Baby Buddy on a fake
// network, a manual clock and the Paris time zone, with the integration wired
// on top through registerHandlers. No timer runs unless `timers: true` (with
// node:test mock timers): the tests read Baby Buddy with `world.hub.poll()`.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { API_KEY, FakeBabyBuddy, LOU, SACHA, createNetwork } from './fakeBabyBuddy.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const URL_1 = 'http://192.0.2.30:8000';
export const TIME_ZONE = 'Europe/Paris';
// The fixtures were captured on 17/10/2026 at about 13:13 UTC (15:13 in Paris).
export const START = Date.UTC(2026, 9, 17, 13, 15, 0);

export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const BASE_CONFIG = { url: URL_1, api_key: API_KEY, language: 'en' };

export async function createWorld({
  clock = createClock(),
  server,
  config = BASE_CONFIG,
  devices = [],
  connect = true,
  timings = {},
  timers = false,
} = {}) {
  const babybuddy = server ?? new FakeBabyBuddy({ now: clock.now });
  const network = createNetwork({ [URL_1]: babybuddy });
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    request: network.request,
    timers,
    timings,
    now: clock.now,
    timeZone: TIME_ZONE,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, server: babybuddy, app, hub: app.hub, clock };
}

export const childId = (gladys, id) => gladys.externalIds('child', `child-${id}`);

/** Add every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

export { API_KEY, FakeBabyBuddy, LOU, SACHA };
