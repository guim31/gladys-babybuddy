// -----------------------------------------------------------------------------
// Gladys devices: one per Baby Buddy child.
//
// Identity: the id Baby Buddy gives the child (stable, never its name):
// `child` / `child-<id>`.
//
// Features (category/type couples of the core table, test/gladys-rules.test.js):
//   - minutes since the last feeding, since the last diaper change, sleep
//     today: duration/integer, in minutes;
//   - feedings today, diaper changes today: counter-sensor/integer;
//   - sleeping, feeding in progress: input/binary (1 = a timer of that
//     activity is running, src/babybuddy/model.js);
//   - temperature: device-temperature-sensor/decimal, NOT temperature-sensor:
//     the core averages every temperature-sensor of a room, and a child's
//     37.5 °C would become the temperature of the nursery;
//   - weight: text/text ("4.85 kg"): the core has no weight category or unit.
//
// A feature without data (no feeding recorded yet) gets no state.
// The devices are published with should_poll: false: the hub reads Baby Buddy
// on its own timer (src/hub.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { minutesSince } from './babybuddy/model.js';

export const CHILD_TYPE = 'child';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  SINCE_FEEDING: 'minutes_since_feeding',
  FEEDINGS_TODAY: 'feedings_today',
  SINCE_CHANGE: 'minutes_since_change',
  CHANGES_TODAY: 'changes_today',
  SLEEPING: 'sleeping',
  SLEEP_TODAY: 'sleep_today',
  FEEDING: 'feeding_in_progress',
  TEMPERATURE: 'temperature',
  WEIGHT: 'weight',
});

// Feature names, in the language chosen in the configuration (Gladys does not
// tell a device integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [FEATURE_KEYS.SINCE_FEEDING]: 'Since last feeding',
    [FEATURE_KEYS.FEEDINGS_TODAY]: 'Feedings today',
    [FEATURE_KEYS.SINCE_CHANGE]: 'Since last diaper change',
    [FEATURE_KEYS.CHANGES_TODAY]: 'Diaper changes today',
    [FEATURE_KEYS.SLEEPING]: 'Sleeping',
    [FEATURE_KEYS.SLEEP_TODAY]: 'Sleep today',
    [FEATURE_KEYS.FEEDING]: 'Feeding in progress',
    [FEATURE_KEYS.TEMPERATURE]: 'Temperature',
    [FEATURE_KEYS.WEIGHT]: 'Weight',
  },
  fr: {
    [FEATURE_KEYS.SINCE_FEEDING]: 'Depuis le dernier repas',
    [FEATURE_KEYS.FEEDINGS_TODAY]: "Repas aujourd'hui",
    [FEATURE_KEYS.SINCE_CHANGE]: 'Depuis la dernière couche',
    [FEATURE_KEYS.CHANGES_TODAY]: "Couches aujourd'hui",
    [FEATURE_KEYS.SLEEPING]: 'Dort',
    [FEATURE_KEYS.SLEEP_TODAY]: "Sommeil aujourd'hui",
    [FEATURE_KEYS.FEEDING]: 'Repas en cours',
    [FEATURE_KEYS.TEMPERATURE]: 'Température',
    [FEATURE_KEYS.WEIGHT]: 'Poids',
  },
  de: {
    [FEATURE_KEYS.SINCE_FEEDING]: 'Seit der letzten Mahlzeit',
    [FEATURE_KEYS.FEEDINGS_TODAY]: 'Mahlzeiten heute',
    [FEATURE_KEYS.SINCE_CHANGE]: 'Seit dem letzten Wickeln',
    [FEATURE_KEYS.CHANGES_TODAY]: 'Windeln heute',
    [FEATURE_KEYS.SLEEPING]: 'Schläft',
    [FEATURE_KEYS.SLEEP_TODAY]: 'Schlaf heute',
    [FEATURE_KEYS.FEEDING]: 'Mahlzeit läuft',
    [FEATURE_KEYS.TEMPERATURE]: 'Temperatur',
    [FEATURE_KEYS.WEIGHT]: 'Gewicht',
  },
  es: {
    [FEATURE_KEYS.SINCE_FEEDING]: 'Desde la última toma',
    [FEATURE_KEYS.FEEDINGS_TODAY]: 'Tomas hoy',
    [FEATURE_KEYS.SINCE_CHANGE]: 'Desde el último pañal',
    [FEATURE_KEYS.CHANGES_TODAY]: 'Pañales hoy',
    [FEATURE_KEYS.SLEEPING]: 'Durmiendo',
    [FEATURE_KEYS.SLEEP_TODAY]: 'Sueño hoy',
    [FEATURE_KEYS.FEEDING]: 'Toma en curso',
    [FEATURE_KEYS.TEMPERATURE]: 'Temperatura',
    [FEATURE_KEYS.WEIGHT]: 'Peso',
  },
};

// Display bounds (the core never applies them on write).
const WEEK_MINUTES = 7 * 24 * 60;
const DAY_MINUTES = 24 * 60;
const COUNTER_MAX = 100;
const TEMPERATURE_BOUNDS = { celsius: [30, 45], fahrenheit: [86, 113] };

const base = (category, type, extra = {}) => ({
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 0,
  ...extra,
});

const minutes = (max) =>
  base(DEVICE_FEATURE_CATEGORIES.DURATION, DEVICE_FEATURE_TYPES.DURATION.INTEGER, {
    unit: DEVICE_FEATURE_UNITS.MINUTES,
    max,
  });
const counter = () =>
  base(DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, DEVICE_FEATURE_TYPES.SENSOR.INTEGER, {
    max: COUNTER_MAX,
  });
const binary = () =>
  base(DEVICE_FEATURE_CATEGORIES.INPUT, DEVICE_FEATURE_TYPES.SENSOR.BINARY, { max: 1 });

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "4.85 kg", "4,85 kg": the weight as text, in the language of the names. */
export function weightText(value, unit, language) {
  const figure = new Intl.NumberFormat(LOCALES[language] ?? 'en-GB', {
    maximumFractionDigits: 3,
  }).format(value);
  return `${figure} ${unit}`;
}

// Order = display order in Gladys. `value` returns undefined when there is no data.
const FEATURES = [
  {
    key: FEATURE_KEYS.SINCE_FEEDING,
    definition: () => minutes(WEEK_MINUTES),
    value: (s, { now }) =>
      s.lastFeeding ? Math.min(WEEK_MINUTES, minutesSince(s.lastFeeding.endAt, now)) : undefined,
  },
  {
    key: FEATURE_KEYS.FEEDINGS_TODAY,
    definition: counter,
    value: (s) => Math.min(COUNTER_MAX, s.feedingsToday),
  },
  {
    key: FEATURE_KEYS.FEEDING,
    definition: binary,
    value: (s) => (s.feedingTimer ? 1 : 0),
  },
  {
    key: FEATURE_KEYS.SINCE_CHANGE,
    definition: () => minutes(WEEK_MINUTES),
    value: (s, { now }) =>
      s.lastChange ? Math.min(WEEK_MINUTES, minutesSince(s.lastChange.at, now)) : undefined,
  },
  {
    key: FEATURE_KEYS.CHANGES_TODAY,
    definition: counter,
    value: (s) => Math.min(COUNTER_MAX, s.changesToday),
  },
  {
    key: FEATURE_KEYS.SLEEPING,
    definition: binary,
    value: (s) => (s.sleepTimer ? 1 : 0),
  },
  {
    key: FEATURE_KEYS.SLEEP_TODAY,
    definition: () => minutes(DAY_MINUTES),
    value: (s) => Math.min(DAY_MINUTES, s.sleepTodayMinutes),
  },
  {
    key: FEATURE_KEYS.TEMPERATURE,
    definition: ({ temperatureUnit }) => {
      const [min, max] = TEMPERATURE_BOUNDS[temperatureUnit];
      return base(
        DEVICE_FEATURE_CATEGORIES.DEVICE_TEMPERATURE_SENSOR,
        DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
        {
          unit:
            temperatureUnit === 'fahrenheit'
              ? DEVICE_FEATURE_UNITS.FAHRENHEIT
              : DEVICE_FEATURE_UNITS.CELSIUS,
          min,
          max,
        },
      );
    },
    value: (s) => (s.temperature ? s.temperature.value : undefined),
  },
  {
    key: FEATURE_KEYS.WEIGHT,
    definition: () =>
      // NOT NULL in the core, even for a text (422 on "Add to Gladys" otherwise).
      base(DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, {
        keep_history: false,
      }),
    text: true,
    value: (s, { weightUnit, language }) =>
      s.weight ? weightText(s.weight.value, weightUnit, language) : undefined,
  },
];

export const childIds = (gladys, childId) => gladys.externalIds(CHILD_TYPE, `child-${childId}`);

export const childDeviceName = (child) => `Baby Buddy ${child.firstName}`.slice(0, 60);

/**
 * @param {object} gladys
 * @param {{ id: number, firstName: string }} child
 * @param {{ language: string, temperatureUnit: string }} config
 */
export function buildChild(gladys, child, config) {
  const ids = childIds(gladys, child.id);
  const names = NAMES[config.language] ?? NAMES.en;
  return {
    name: childDeviceName(child),
    external_id: ids.device,
    should_poll: false,
    features: FEATURES.map(({ key, definition }) => ({
      ...definition(config),
      name: names[key],
      external_id: ids.feature(key),
    })),
  };
}

/**
 * The states of a child (summary of src/babybuddy/model.js), in the
 * `publishStates` format: `state` for a number, `text` for a text.
 * @returns {Array<{ device_feature_external_id: string, state?: number, text?: string }>}
 */
export function childStates(gladys, childId, summary, { now, ...config }) {
  const ids = childIds(gladys, childId);
  const states = [];
  for (const feature of FEATURES) {
    const value = feature.value(summary, { now, ...config });
    if (value === undefined) {
      continue;
    }
    states.push(
      feature.text
        ? { device_feature_external_id: ids.feature(feature.key), text: value }
        : { device_feature_external_id: ids.feature(feature.key), state: value },
    );
  }
  return states;
}
