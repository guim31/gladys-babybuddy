// -----------------------------------------------------------------------------
// An in-memory Baby Buddy, answering the routes the integration calls the way
// the real server does (DRF pages, `child`/`ordering`/`limit` filters, 403 on
// a wrong key, 400 with the overlap message, timers turned into entries). Its
// starting data are real answers of lscr.io/linuxserver/babybuddy in Docker
// (17/10/2026, about 15:13 in Paris, test/fixtures/babybuddy/real-*.json):
// Lou (#1), asleep on a "Sommeil" timer since 14:50, and Sacha (#2), on a
// "Repas" timer since 15:05.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/babybuddy/${name}.json`, import.meta.url), 'utf8'))
    .results;

export const API_KEY = '0123456789abcdef0123456789abcdef01234567';
export const LOU = 1;
export const SACHA = 2;

const KINDS = ['feedings', 'changes', 'sleep', 'temperature', 'weight'];
const json = (status, value) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});
const iso = (ms) => new Date(ms).toISOString();
const duration = (ms) => new Date(ms).toISOString().slice(11, 19);

export class FakeBabyBuddy {
  constructor({ now = () => Date.now(), apiKey = API_KEY } = {}) {
    this.now = now;
    this.apiKey = apiKey;
    this.children = fixture('real-children');
    this.timers = fixture('real-timers');
    this.data = Object.fromEntries(
      KINDS.map((kind) => [kind, [...fixture(`real-${kind}-1`), ...fixture(`real-${kind}-2`)]]),
    );
    this.online = true;
    this.requests = [];
    this.nextId = 100;
  }

  overlaps(kind, child, start, end) {
    return this.data[kind].some(
      (entry) =>
        entry.child === child && Date.parse(entry.start) < end && Date.parse(entry.end) > start,
    );
  }

  fromTimer(kind, body) {
    const timer = this.timers.find((item) => item.id === body.timer);
    if (!timer) {
      return json(400, { timer: [`Invalid pk "${body.timer}" - object does not exist.`] });
    }
    const start = Date.parse(timer.start);
    const end = this.now();
    if (this.overlaps(kind, timer.child, start, end)) {
      return json(400, {
        non_field_errors: [
          `Another entry intersects the specified time period. Conflicting entry: <a href="/${kind}/1/">x</a>`,
        ],
      });
    }
    const entry = {
      id: this.nextId++,
      child: timer.child,
      start: iso(start),
      end: iso(end),
      duration: duration(end - start),
      ...(kind === 'feedings'
        ? { type: body.type, method: body.method, amount: null }
        : { nap: false }),
      notes: null,
      tags: [],
    };
    this.data[kind].push(entry);
    this.timers = this.timers.filter((item) => item.id !== timer.id);
    return json(201, entry);
  }

  handle(url, { method = 'GET', headers = {}, json: body } = {}) {
    const { pathname, searchParams } = new URL(url);
    this.requests.push({ method, path: pathname, search: searchParams.toString(), body });
    if (!pathname.startsWith('/api/')) {
      return { status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html>' };
    }
    if (headers.authorization !== `Token ${this.apiKey}`) {
      return json(403, { detail: 'Invalid token.' });
    }
    const route = pathname.slice('/api/'.length);
    if (method === 'GET') {
      const kind = route.replace(/\/$/, '');
      let list;
      if (kind === 'children') {
        list = this.children;
      } else if (kind === 'timers') {
        list = this.timers;
      } else if (KINDS.includes(kind)) {
        list = this.data[kind];
      } else {
        return json(404, { detail: 'Not found.' });
      }
      if (searchParams.has('child')) {
        list = list.filter((item) => item.child === Number(searchParams.get('child')));
      }
      const ordering = searchParams.get('ordering');
      if (ordering) {
        const field = ordering.replace(/^-/, '');
        const sign = ordering.startsWith('-') ? -1 : 1;
        list = [...list].sort((a, b) =>
          a[field] < b[field] ? -sign : a[field] > b[field] ? sign : 0,
        );
      }
      const limit = Number(searchParams.get('limit') ?? 100);
      return json(200, {
        count: list.length,
        next: null,
        previous: null,
        results: list.slice(0, limit),
      });
    }
    if (method === 'POST' && route === 'changes/') {
      if (!this.children.some((child) => child.id === body.child)) {
        return json(400, { child: [`Invalid pk "${body.child}" - object does not exist.`] });
      }
      const entry = {
        id: this.nextId++,
        child: body.child,
        time: iso(this.now()),
        wet: body.wet,
        solid: body.solid,
        color: '',
        amount: null,
        notes: null,
        tags: [],
      };
      this.data.changes.push(entry);
      return json(201, entry);
    }
    if (method === 'POST' && route === 'timers/') {
      const timer = {
        id: this.nextId++,
        child: body.child,
        name: body.name ?? null,
        start: iso(this.now()),
        duration: '00:00:00',
        user: 1,
      };
      this.timers.push(timer);
      return json(201, timer);
    }
    if (method === 'POST' && route === 'sleep/') {
      return this.fromTimer('sleep', body);
    }
    if (method === 'POST' && route === 'feedings/') {
      return this.fromTimer('feedings', body);
    }
    return json(405, { detail: `Method "${method}" not allowed.` });
  }
}

/** The network: one fake server per base URL; anything else does not answer. */
export function createNetwork(servers) {
  return {
    servers,
    async request(url, options = {}) {
      const base = Object.keys(servers).find((origin) => url.startsWith(`${origin}/`));
      const server = base ? servers[base] : null;
      if (!server || !server.online) {
        const error = new Error('connect ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        throw error;
      }
      return server.handle(url, options);
    },
  };
}
