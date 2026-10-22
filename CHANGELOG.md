# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-17

### Added

- Baby Buddy in Gladys: one device per child, with the minutes since the last
  feeding and the last diaper change, the feedings and diaper changes of the
  day, sleep today, whether the child sleeps or eats (a timer runs), and the
  last temperature and weight.
- Dashboard widget "Baby Buddy": time since the last feeding and diaper, sleep
  today, and buttons to log a wet or dirty diaper and to start or stop the
  sleep and feeding timers.
- Scene trigger "No feeding for a while", after 1 to 8 hours, once per feeding.
- Scene actions "Log a diaper change" and "Sleep or feeding timer" (start, stop
  or toggle, for a single button by the cot).
- A "Test the connection" button and a connection status naming the problem.
- Every text in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-babybuddy/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-babybuddy/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-babybuddy/releases/tag/v1.0.0
