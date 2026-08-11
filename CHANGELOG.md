# Changelog

All notable changes to the Genie mobile app are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.12] — 2026-08-11

### Fixed
- **Delta sync 400 Bad Request storm**: `fetchEvents` was returning events for internal
  collections (`USERS`, `MOVEMENTS`, `REGISTRATIONS`) that the client cannot fetch via
  `getRecords`. This caused a flood of `400 Bad Request` responses on every delta
  catch-up, wasting network and slowing sync considerably.
- **Client-side filter** (`sync.js`, `app-api.js`): `pullDeltaSince` now skips event
  entries for collections not in the client's known fetchable sheet set before calling
  `getRecords` — zero 400s from unknown collections.
- **Server-side filter** (`GENIE_APP/data.py`): `GET /api/fetchEvents` now only returns
  events whose `COLLECTION` field is in `SYNC_CONFIG` — internal collections are excluded
  at the source, reducing response payload size.

### Changed
- `runtimeVersion` updated to `1.0.12` for OTA compatibility.
- `versionCode` bumped from 12 to 13.

---

## [1.0.11] — 2026-08-11

### Fixed
- OTA bundle hash corrected to `bfd0be5cd9da68d27280d64480717eeb` in `android-index.json`.
- `runtimeVersion` field aligned to ensure over-the-air update delivery to installed apps.

---

## [1.0.10] — 2026-08-11

### Added
- **5-minute client-side count audit** (`reconcile.js`): periodically compares local
  SQLite record counts against server `GET /api/sync/counts` and triggers a full re-sync
  on mismatch — prevents silent data drift.

### Fixed
- **Date parsing hardened** across `sqlite-app.js`, `formatIST.js`, `DashboardScreen.js`:
  restored all 732 orders previously hidden due to epoch/ISO timestamp parse mismatch.
- OTA bundle published with correct manifest and asset hashes.

---

## [1.0.9] — 2026-08-10

### Added
- **Sub-second SQLite batch upserts**: `sqliteUpsertMany` uses a single
  `withTransactionAsync` block — 1,000 records write in < 400 ms vs ~8 s previously.
- **Dynamic version display** in About panel: reads `package.json` version at runtime.
- **AppState `active` listener**: triggers delta catch-up on every app resume from background.
- **5-minute background audit tick**: safety-net interval to catch events missed during long sessions.

---

## [1.0.8] — 2026-08-09

### Added
- **Native expo-sqlite replica engine** (`sqlite-app.js`): replaces AsyncStorage for all
  sheet data on Android/iOS with WAL journal mode and composite indexes.
- **Automatic migration** from legacy AsyncStorage keys to SQLite on first launch.
- **1-minute safety-net query**: overlaps `since_ms` window by 60 s to prevent event boundary races.
- **SHIPMENTS key alignment**: `REFERENCE` as canonical key field, matching server KEY_FIELDS.
- **5-minute parity audit**: `auditAndReconcile` runs post-sync and on every app foreground.

---

## [1.0.7] — 2026-08-08

### Added
- GitHub Releases CI workflow: automated APK attachment on tagged release.
- OTA update checker in About panel using GitHub Releases API.

---

## [1.0.6] — 2026-08-08

### Fixed
- Duplicate `webp` mipmap resource collision causing Android AAPT build failure.

---

## [1.0.5] — 2026-08-07

### Added
- Complete PNG launcher, round, and foreground mipmaps for all Android DPI buckets.

---

## [1.0.4] — 2026-08-07

### Added
- GitHub-hosted OTA bundle delivery via raw.githubusercontent.com CDN.
- `android-index.json` manifest for self-hosted Expo Updates.
- Direct GitHub Releases update checker replacing Expo EAS dependency.

---

## [1.0.3] — 2026-08-06

### Added
- Premium Genie app icon with gold border and layered emblem.
- Updated splash screen and all Android mipmap launcher icons.

---

## [1.0.2] — 2026-08-05

### Added
- Explicit `runtimeVersion: "1.0.2"` in `app.json` to enable OTA update delivery.

---

## [1.0.1] — 2026-08-04

### Added
- **About App panel**: displays app version, build info, and update history.
- **OTA update flow**: checks GitHub Releases for a newer APK without Play Store.

---

## [1.0.0] — 2026-08-01

### Added
- Initial release of Genie React Native app.
- Login with JWT + refresh token session management.
- Full offline-first data sync via NDJSON streaming (`/api/sync/stream`).
- Real-time updates via Server-Sent Events (SSE) listener.
- Dashboard, Orders, Book Order, and Tracking screens.
- Business-year layered historical data sync.
- expo-sqlite local replica with timestamp-guarded conflict resolution.
