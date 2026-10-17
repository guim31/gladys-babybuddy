# Baby Buddy for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that brings the baby care log of a self-hosted
[Baby Buddy](https://github.com/babybuddy/babybuddy) into Gladys, over the
local network: time since the last feeding and diaper, sleep, and a button to
log a diaper or start and stop a timer at night.

> **Feedback welcome.** The integration was checked against a real Baby Buddy
> server (Docker image `lscr.io/linuxserver/babybuddy`, October 2026), but not
> yet in everyday use with a real Gladys. Please report what works and what
> does not in the [issues](https://github.com/guim31/gladys-babybuddy/issues).

## Features

- **One device per child**, with nine features: minutes since the last
  feeding, feedings today, feeding in progress, minutes since the last diaper
  change, diaper changes today, sleeping, sleep today (minutes), last
  temperature, last weight (text).
- **Dashboard widget** "Baby Buddy": three tiles (since the last feeding,
  since the last diaper, sleep today), the state of the child, and four
  buttons: wet diaper, dirty diaper, sleep timer, feeding timer.
- **Scene trigger** _No feeding for a while_: once per feeding, after 1 to 8
  hours (a filter), never while a feeding timer runs.
- **Scene actions** _Log a diaper change_ (wet, dirty, both) and _Sleep or
  feeding timer_ (start, stop, or toggle: one Zigbee button by the cot is
  enough). A stopped timer becomes a sleep or feeding entry in Baby Buddy.
- The minute counters move every minute; Baby Buddy is read every 1, 2 or 5
  minutes.
- A **Test the connection** button, a connection status that names the
  problem (key refused, no Baby Buddy at this address, certificate…), and a
  transport badge per device.
- Every text in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later (widgets, scene triggers and actions).
- A **self-hosted Baby Buddy**, reachable from Gladys, and the **API key** of
  one of its users (Baby Buddy → user menu → API key). Entries are written as
  this user.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the
   address of this repository: `https://github.com/guim31/gladys-babybuddy`
   (or install **Baby Buddy** from the catalog once it is listed).
2. In **Configuration**, enter the address of Baby Buddy
   (`http://192.168.1.20:8000`, `https://baby.example.org`…) and the API key.
   Save, then click **Test the connection**.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

The integration uses the REST API of Baby Buddy (`/api/`, header
`Authorization: Token <key>`):

| Request                                                                                               | Use                                                       |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GET children/`, `GET timers/`                                                                        | children, running timers                                  |
| `GET feedings/`, `changes/`, `sleep/`, `temperature/`, `weight/` with `child`, `ordering`, `limit=50` | the newest entries of each child                          |
| `POST changes/` `{ child, wet, solid }`                                                               | log a diaper change, now                                  |
| `POST timers/` `{ child, name }`                                                                      | start a timer                                             |
| `POST sleep/` `{ timer }`, `POST feedings/` `{ timer, type, method }`                                 | turn a timer into an entry (Baby Buddy deletes the timer) |

A timer counts as sleep or feeding by its name (`Sleep`, `Nap`, `Sommeil`,
`Feeding`, `Bottle`, `Biberon`… in the four languages); the timers started
from Gladys are named so. Baby Buddy is read on a timer of the container, the
devices are published with `should_poll: false`. States are published only
when they change, and every 12 hours otherwise. Nothing is written under
`/data`.

## Checked on a real Baby Buddy, and what was not

Checked against `lscr.io/linuxserver/babybuddy` (image of 17/10/2026, SQLite)
in a Docker network: two children, feedings, diaper changes, sleep across
midnight, temperature, weight and two running timers created through the API;
the real answers are in `test/fixtures/babybuddy/` and drive the tests. The
integration ran in its own container under the Gladys sandbox limits
(read-only root, no capabilities, 256 MB), read the server, logged diapers and
started and stopped timers, checked on the Baby Buddy side.

Baby Buddy 2.x is the target (a stopped timer of 1.x, still listed with
`active: false`, is ignored).

Not checked: a real Gladys instance (the tests use the SDK's fake Gladys),
Baby Buddy behind a reverse proxy with a path prefix, the Home Assistant
add-on of Baby Buddy.

## Limitations

- Reads feedings, diapers, sleep, timers, temperature and weight; writes only
  diaper changes and sleep and feeding timers. Pumping, tummy time,
  medication and notes are not handled.
- A change made in Baby Buddy shows up within the refresh interval.
- A feeding stopped from Gladys gets the type and method of the configuration.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`)
and an in-memory Baby Buddy (`test/helpers/fakeBabyBuddy.js`) built from real
answers. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [Baby Buddy](https://github.com/babybuddy/babybuddy) by its authors
  (BSD-2-Clause): the integration only talks to its API.
- The Home Assistant integration
  [baby_buddy_homeassistant](https://github.com/jcgoette/baby_buddy_homeassistant)
  by jcgoette and contributors (MIT), read for the API usage; no code was
  copied.
- The architecture and the conformity tests follow
  [gladys-donetick](https://github.com/guim31/gladys-donetick) and
  [gladys-wled](https://github.com/guim31/gladys-wled).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Baby Buddy. The
cover is an original illustration, without the Baby Buddy logo.

## License

Apache-2.0
