// -----------------------------------------------------------------------------
// The configuration as typed by the user: the address, the key, the options.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseServerUrl } from '../src/config.js';
import { timerActivity } from '../src/babybuddy/model.js';

test('the address: bare host, copied URL, reverse proxy prefix', () => {
  assert.equal(parseServerUrl('192.0.2.30:8000'), 'http://192.0.2.30:8000');
  assert.equal(parseServerUrl(' https://baby.example.org/ '), 'https://baby.example.org');
  assert.equal(
    parseServerUrl('https://baby.example.org/children/lou-martin/dashboard/'),
    'https://baby.example.org',
  );
  assert.equal(parseServerUrl('http://192.0.2.30/babybuddy/api/'), 'http://192.0.2.30/babybuddy');
  assert.equal(parseServerUrl('http://user:pass@192.0.2.30'), null, 'no credentials');
  assert.equal(parseServerUrl('ftp://192.0.2.30'), null);
  assert.equal(parseServerUrl(''), null);
});

test('the defaults and the unknown values', () => {
  const config = normalizeConfig({ url: 'x', api_key: ' key ', poll_interval: '7' });
  assert.equal(config.apiKey, 'key');
  assert.equal(config.pollIntervalMs, 60_000);
  assert.equal(config.language, 'fr');
  assert.equal(config.feedingType, 'breast milk');
  assert.equal(config.feedingMethod, 'both breasts');
  assert.equal(normalizeConfig({ poll_interval: 300 }).pollIntervalMs, 300_000);
  assert.equal(normalizeConfig({ feeding_type: 'milkshake' }).feedingType, 'breast milk');
});

test('a timer counts as sleep or feeding by its name, in four languages', () => {
  for (const name of ['Sleep', 'Nap', 'Sommeil', 'sieste', 'Schlaf', 'Sueño', 'Lou dodo']) {
    assert.equal(timerActivity(name), 'sleep', name);
  }
  for (const name of ['Feeding', 'Bottle', 'Repas', 'Tétée', 'Biberon', 'Mahlzeit', 'Comida']) {
    assert.equal(timerActivity(name), 'feeding', name);
  }
  for (const name of [null, '', 'Bath', 'Timer 1']) {
    assert.equal(timerActivity(name), null, String(name));
  }
});
