// -----------------------------------------------------------------------------
// Baby Buddy API client (Django REST framework, `/api/`), authenticated by the
// API key of a user in the `Authorization: Token <key>` header. Checked against
// a real server (lscr.io/linuxserver/babybuddy, October 2026).
//
//   GET    children/?limit=100                      { results: Child[] }
//   GET    timers/?limit=100                        { results: Timer[] } running timers
//   GET    <list>/?child=<id>&ordering=-<field>&limit=50   newest first
//   POST   changes/   { child, wet, solid }          time = now
//   POST   timers/    { child, name }                start = now
//   POST   sleep/     { timer }                      start = timer start, end = now; deletes it
//   POST   feedings/  { timer, type, method }        same
//   DELETE timers/<id>/
//
// Datetimes come back in UTC (`...Z`). A wrong key is a 403, not a 401.
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify (self-signed without the option)
  AUTH: 'auth', // missing, wrong or revoked API key
  NOT_BABYBUDDY: 'not_babybuddy', // something answers, but not the Baby Buddy API
  REDIRECT: 'redirect', // HTTP redirected to HTTPS, or a login portal
  RATE_LIMIT: 'rate_limit', // 429
  HTTP: 'http', // any other unexpected answer
});

export class BabyBuddyError extends Error {
  constructor(kind, message, status, details = null) {
    super(message);
    this.name = 'BabyBuddyError';
    this.kind = kind;
    this.status = status;
    /** The validation errors of a 400, as Baby Buddy sent them. */
    this.details = details;
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function networkError(err) {
  if (TLS_CODES.has(err.code)) {
    return new BabyBuddyError(ERROR_KINDS.TLS, `Certificate refused (${err.code})`);
  }
  return new BabyBuddyError(ERROR_KINDS.UNREACHABLE, err.code ? `${err.code}` : err.message);
}

const parse = (body) => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

/** The validation messages of a 400, flattened, without the HTML links Baby Buddy adds. */
export function validationText(details) {
  if (!details || typeof details !== 'object') {
    return '';
  }
  return Object.values(details)
    .flat()
    .filter((text) => typeof text === 'string')
    .map((text) => text.replace(/<[^>]*>/g, ''))
    .join(' ')
    .slice(0, 200);
}

const LISTS = {
  feedings: 'end',
  changes: 'time',
  sleep: 'end',
  temperature: 'time',
  weight: 'date',
};

// Enough for a day of entries (a newborn: about 12 feedings and 10 changes).
const PAGE = 50;

export class BabyBuddyClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, without trailing slash
   * @param {string} options.apiKey API key of a Baby Buddy user
   * @param {boolean} [options.insecure] accept a self-signed certificate
   * @param {Function} [options.request] HTTP seam (src/babybuddy/http.js)
   */
  constructor({ url, apiKey, insecure = false, request = httpRequest }) {
    this.url = url;
    this.apiKey = apiKey;
    this.insecure = insecure;
    this.request = request;
  }

  async call(path, { method = 'GET', json } = {}) {
    let response;
    try {
      response = await this.request(`${this.url}/api/${path}`, {
        method,
        json,
        insecure: this.insecure,
        headers: { authorization: `Token ${this.apiKey}` },
      });
    } catch (err) {
      throw networkError(err);
    }
    const { status, body } = response;
    if (status === 401 || status === 403) {
      throw new BabyBuddyError(ERROR_KINDS.AUTH, `HTTP ${status}`, status);
    }
    if (status === 429) {
      throw new BabyBuddyError(ERROR_KINDS.RATE_LIMIT, 'HTTP 429', status);
    }
    if (status >= 300 && status < 400) {
      throw new BabyBuddyError(ERROR_KINDS.REDIRECT, `HTTP ${status}`, status);
    }
    if (status === 204) {
      return null;
    }
    const parsed = parse(body);
    if (parsed === undefined) {
      // A login page, a reverse proxy page, another application.
      throw new BabyBuddyError(
        status === 200 || status === 404 ? ERROR_KINDS.NOT_BABYBUDDY : ERROR_KINDS.HTTP,
        `HTTP ${status}, not JSON`,
        status,
      );
    }
    if (status === 400) {
      throw new BabyBuddyError(
        ERROR_KINDS.HTTP,
        `HTTP 400 ${validationText(parsed)}`.trim(),
        400,
        parsed,
      );
    }
    if (status < 200 || status >= 300) {
      throw new BabyBuddyError(ERROR_KINDS.HTTP, `HTTP ${status}`, status);
    }
    return parsed;
  }

  async list(path) {
    const answer = await this.call(path);
    if (!answer || !Array.isArray(answer.results)) {
      throw new BabyBuddyError(ERROR_KINDS.NOT_BABYBUDDY, 'No "results" in the answer', 200);
    }
    return answer.results;
  }

  children() {
    return this.list('children/?limit=100');
  }

  timers() {
    return this.list('timers/?limit=100');
  }

  /** The newest entries of a child, for the lists of LISTS. */
  entries(kind, childId) {
    return this.list(
      `${kind}/?child=${encodeURIComponent(childId)}&ordering=-${LISTS[kind]}&limit=${PAGE}`,
    );
  }

  addChange(childId, { wet, solid }) {
    return this.call('changes/', { method: 'POST', json: { child: childId, wet, solid } });
  }

  startTimer(childId, name) {
    return this.call('timers/', { method: 'POST', json: { child: childId, name } });
  }

  /** Turn a timer into a sleep entry (Baby Buddy deletes the timer). */
  sleepFromTimer(timerId) {
    return this.call('sleep/', { method: 'POST', json: { timer: timerId } });
  }

  /** Turn a timer into a feeding entry (Baby Buddy deletes the timer). */
  feedingFromTimer(timerId, { type, method }) {
    return this.call('feedings/', { method: 'POST', json: { timer: timerId, type, method } });
  }
}

export const ENTRY_KINDS = Object.keys(LISTS);
