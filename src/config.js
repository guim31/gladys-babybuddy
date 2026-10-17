// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// One Baby Buddy instance (its address and the API key of one of its users),
// read on a timer of the container.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Refresh intervals offered in the configuration, in seconds.
export const POLL_INTERVALS = ['60', '120', '300'];

// Baby Buddy stores numbers without unit: the user says which ones they type.
export const WEIGHT_UNITS = ['kg', 'lb'];
export const TEMPERATURE_UNITS = ['celsius', 'fahrenheit'];

// Values of the Baby Buddy API (core/models.py), used when a feeding timer is
// stopped from Gladys.
export const FEEDING_TYPES = ['breast milk', 'formula', 'fortified breast milk', 'solid food'];
export const FEEDING_METHODS = [
  'both breasts',
  'left breast',
  'right breast',
  'bottle',
  'parent fed',
  'self fed',
];

export const DEFAULT_CONFIG = {
  url: '',
  api_key: '',
  feeding_type: 'breast milk',
  feeding_method: 'both breasts',
  weight_unit: 'kg',
  temperature_unit: 'celsius',
  allow_self_signed: false,
  poll_interval: '60',
  language: 'fr',
};

/**
 * Parse the address typed by the user into a base URL: a bare host or IP
 * (`192.0.2.10:8000`), or a URL copied from the browser
 * (`https://baby.example.org/children/lou/`). HTTP by default. A path prefix
 * is kept (Baby Buddy behind a reverse proxy under `/babybuddy`), the known
 * screens of the web app are dropped.
 * @param {unknown} raw
 * @returns {string|null} `http(s)://host[:port][/prefix]`, null when unusable
 */
export function parseServerUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials in the address would end up in the logs.
  if (url.username || url.password) {
    return null;
  }
  const path = url.pathname
    .replace(/\/api(\/.*)?$/, '')
    .replace(
      /\/(dashboard|children|feedings|changes|sleep|timers|login|user|welcome|tummy-time|notes)(\/.*)?$/,
      '',
    )
    .replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/** Host part shown to the user (no scheme). */
export const hostOf = (url) => url.replace(/^https?:\/\//, '');

const bool = (value) => value === true || value === 'true';
const oneOf = (list, value, fallback) => (list.includes(value) ? value : fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const typed = typeof source.url === 'string' ? source.url.trim() : '';
  return {
    url: parseServerUrl(typed),
    urlTyped: typed !== '',
    // Keys are kept as typed, minus the blanks a copy and paste adds around them.
    apiKey: typeof source.api_key === 'string' ? source.api_key.trim() : '',
    feedingType: oneOf(FEEDING_TYPES, source.feeding_type, DEFAULT_CONFIG.feeding_type),
    feedingMethod: oneOf(FEEDING_METHODS, source.feeding_method, DEFAULT_CONFIG.feeding_method),
    weightUnit: oneOf(WEIGHT_UNITS, source.weight_unit, DEFAULT_CONFIG.weight_unit),
    temperatureUnit: oneOf(
      TEMPERATURE_UNITS,
      source.temperature_unit,
      DEFAULT_CONFIG.temperature_unit,
    ),
    allowSelfSigned: bool(source.allow_self_signed),
    pollIntervalMs:
      Number(
        oneOf(POLL_INTERVALS, String(source.poll_interval ?? ''), DEFAULT_CONFIG.poll_interval),
      ) * 1000,
    language: oneOf(LANGUAGES, source.language, DEFAULT_CONFIG.language),
  };
}
