# Changelog

All notable changes to the Genie mobile app are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.1] — 2026-08-13

### Added
- **Web Parity Major Feature Release**: 10 brand-new native React Screens matching full web platform functionality:
  - `CalculatorScreen.js` — Shipping rate calculator & volume converter (`calc.html`).
  - `CalendarScreen.js` — Operational calendar & holiday schedule (`calendar.html`).
  - `ComplaintScreen.js` — Customer service ticket and dispute manager (`complaint.html`).
  - `DocsScreen.js` — System documentation and user guides (`docs.html`).
  - `InvoiceScreen.js` — Billing invoice generator and statement viewer (`invoice.html`).
  - `MemosScreen.js` — Internal branch announcements and circulars (`memos.html`).
  - `PincodeScreen.js` — Serviceability pin code lookup engine (`Pincode.html`).
  - `ServicesScreen.js` — Carrier services directory (`services.html`).
  - `VaultScreen.js` — Secure document storage vault (`vault.html`).
  - `ZipFinderScreen.js` — International postal code & zone finder (`zipfinder.html`).
- **Native Push & System Notifications** (`core/native-notifications.js`): Integrated native Expo notification handling.
- **Document Config & Validation Engines** (`utils/native-docs-config.js`, `utils/native-docs-validation.js`): Rules engine for document verification.

### Changed
- `version` bumped to `1.1.1`.
- `versionCode` bumped to `16`.
- `runtimeVersion` updated to `1.1.1`.

---

## [1.0.14] — 2026-08-12

### Added
- **Supabase Backend Integration**: Backend PostgreSQL migrated to Supabase (`us-east-1`) with generic `ACTIVE_DB` selector.
- **Document & Image Uploader Engine** (`core/uploader-engine.js`, `screens/UploaderScreen.js`): Refactored image & document upload workflow with progress tracking.
- **Admin Management & Viewer Screens** (`screens/AdminScreen.js`, `utils/upload-viewer.js`): Added dedicated admin control interfaces and document previewer.
- **Enhanced Storage & Sync Caching** (`core/sqlite-app.js`, `core/storage.js`): Improved SQLite cache resilience and local replica indexing.

### Changed
- `version` bumped to `1.0.14`.
- `versionCode` bumped to `15`.
- `runtimeVersion` updated to `1.0.14`.

---

## [1.0.13] — 2026-08-11

### Fixed
- **Carrier & Mode maps now store full records** (`App.js`): `carriersMap` and
  `modesMap` were reduced to plain strings (display name only) — this broke
  `BookOrderScreen` which needs `COMPANY_CODE`, `VOL_INGR`, `MIN_WT`, zone flags etc.
  Both maps now carry the complete object; display name is derived at point of use.
- **Mode name resolution hardened** (`OrdersScreen.js`, `docgen.js`): fixed a crash
  when `modesMap[key]` is an object instead of a string — now safely reads `.MODE`
  or `.NAME` field with a string fallback.
- **Rates lookup key unified** (`App.js`): `ratesLookup` was keyed by `RATE_UID`
  (legacy) which mismatched `UID` (server authoritative) — rates now keyed strictly
  by `UID`, eliminating silent rate-card misses during booking.

### Added
- **Booking confirmation wait** (`App.js`): after a successful `POST /api/bookOrder`,
  the app now waits up to 15 s for the ORDERS row to land in the local SQLite replica
  (via bounded `pullDeltaSince` with `AbortController`) before showing success. This
  matches web behavior and prevents a false "booked" state when SSE is momentarily down.
- **AbortSignal support in `pullDeltaSince`** (`core/sync.js`): accepts an optional
  `abortSignal` so bounded callers (booking confirmation) can cancel the fetch without
  affecting the regular background catch-up path's retry behavior.
- **Keyboard handling in `BookOrderScreen`** (`screens/BookOrderScreen.js`):
  `KeyboardAvoidingView` + `softwareKeyboardLayoutMode: resize` in `app.json` — form
  fields no longer hidden behind the software keyboard on Android.
- **Input accessibility** (`BookOrderScreen.js`, `LoginScreen.js`): `accessibilityRole`,
  `accessibilityLabel`, `accessibilityState` added to checkboxes and buttons;
  `returnKeyType` + `onSubmitEditing` wired for keyboard tab-through on all login flows.
- **SSE gap-fill polling** (`core/sse.js`): when SSE disconnects, a 15-second interval
  fires `onFallback` → `runDeltaCatchup` until SSE reconnects. Cuts worst-case missed-
  event delay from ~5 min (safety-net tick) to 15 s.

### Changed
- `runtimeVersion` updated to `1.0.13`.
- `versionCode` bumped from 13 to 14.
- `softwareKeyboardLayoutMode: "resize"` added to Android config in `app.json`.

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
