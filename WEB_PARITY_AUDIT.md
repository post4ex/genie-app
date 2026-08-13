# GENIE_WEB → GENIE_REACT parity audit

**Audit scope:** `../GENIE_WEB` compared with the current `GENIE_REACT` application.

**Audit date:** 2026-08-13

**Purpose:** Keep a durable, file-by-file checklist of every web page/source file, its behavior, current React coverage, missing behavior, and the dependencies needed to reproduce it natively. This document is an audit backlog, not a claim that every item is already implemented.

## Status vocabulary

- **Covered:** A React screen/core module currently implements the main behavior.
- **Partial:** Some behavior exists, but important web controls, states, or edge cases are still absent.
- **Missing:** No equivalent React screen/feature is currently wired.
- **Native adaptation:** The web behavior exists, but browser APIs must be replaced with native APIs before it can be considered equivalent.
- **Asset/runtime:** Catalogued; it is not application logic.

## React baseline inspected

| Area | Current React coverage |
|---|---|
| Screens | `LoginScreen`, `DashboardScreen`, `OrdersScreen`, `BookOrderScreen`, `TrackingScreen`, `UploaderScreen`, `AdminScreen` |
| Shared shell | `App.js`, `Header`, `Footer`, `BottomMenuSheet`, `NotificationsPanel` |
| Storage/sync | SQLite-backed storage adapter, full sync, delta sync, SSE listener, reconciliation, native notifications |
| Existing native packages | Expo 54, SQLite, camera, image/document picker, image manipulator, print/sharing, location, notifications, OCR, PDF page rasterization, view-shot, slider, SVG |
| Navigation model | Manual `activeTab` state in `App.js`; it is not yet a route for every web page |
| Important limitation | Browser-only web files copied into `core/` or `utils/` cannot be assumed native-safe merely because they exist. Any use of `window`, `document`, `localStorage`, IndexedDB, DOM, Canvas, `navigator`, or browser CDN globals needs a React/native adapter. |

---

# 1. Root pages and runtime/config files

Each row is a separate web file audited before moving to the next file.

| Web file | Web feature/logic | React status | Missing work / required dependency |
|---|---|---|---|
| `main.html` | Public home; fraud warning; locator, docs, DGR, calendar, awareness, FAQ, about, memo, registration/contact tiles; public/authenticated tracking widget; barcode component; dynamic service tray and FAQ/contact modals. | **Partial** — `DashboardScreen` and `TrackingScreen` cover authenticated portions. | Add a public `HomeScreen`/content screens, dynamic service carousel, FAQ/contact modals, public tracking endpoint, and scanner result flow. Native: `expo-camera` barcode scanning; no extra package for modals/carousel if implemented in RN. |
| `login.html` | Login, registration initiation/OTP confirmation, forgot-password OTP/verify/reset, KYC view, password visibility, validation, cached header/footer injection, loading/error states. | **Partial** — `LoginScreen` covers login; inspect and extend for all web views. | Registration, forgot-password and KYC parity; keyboard/Enter behavior; secure session handling. Recommended native storage is existing SQLite/AsyncStorage, with `expo-secure-store` if tokens need OS secure storage. |
| `dashboard.html` | Authenticated dashboard, date/branch filters, counts, charts, branch contact, refresh/SSE-driven redraw. | **Partial** — `DashboardScreen` renders order summary/navigation. | Port all dashboard chart series, branch controls, quick actions, date handling, and empty/loading/error states. Existing `react-native-svg` can support charts; no chart package is installed. |
| `orders.html` | Order list/search/filter/tile counts, split list/detail view, order detail, edit/delete, upload/document/tracking actions. | **Partial** — `OrdersScreen` exists and has detail/navigation/upload/document work. | Complete web filter/tile semantics, all detail actions, delete API confirmation/error state, image/PDF viewers, document actions, and list/detail/back stack. Existing `expo-sharing`, `expo-print`, custom viewer utilities; a native PDF viewer package is still missing if in-app PDF pages must be viewed rather than shared. |
| `Shipments.html` | Shipment tiles and filters; TAT/overdue/heavy/high-value/exception/POD/OFD/new-booking/FOV/delivered categories; shipment detail; tracking; parties/products/boxes; uploads; label/receipt/POD/office/docs-and-box docs; mail/WhatsApp; assign carrier; status update. | **Partial** — merged substantially into `OrdersScreen`; no separate shipment route. | Verify every tile/filter/count and action against `jawaS/shipments.js`; add image/PDF viewer, mail/WhatsApp API actions, assign-carrier/status actions, document previews, and exact TAT refresh logic. Native: viewer implementation; platform share is already available. |
| `BookOrder.html` | Full booking form, client/consignor/consignee selection, origin/destination, mode/carrier filtering, payments, multibox, products, calculation/helper/charges/taxes, AWB, date, booking SSE confirmation, mini-uploader. | **Covered/Partial** — `BookOrderScreen` is the React port. | Continue exact web regression audit for all validation, rate UID mapping, date serialization, mode revalidation, focus/keyboard, and booking confirmation timing. Keep `Add Box`/`Add Product`; do not replace with a less capable flow. |
| `EditOrder.html` | Prefilled booking form, editable order fields, recalculation, document/uploader actions, update/delete flow. | **Partial** — edit is routed through `BookOrderScreen` from `OrdersScreen`. | Match every web edit-only restriction, payload field, date format, update response, and post-update SSE refresh. |
| `uploader.html` | Full uploader: order pane/search/date filter/load-more, pickup-task table, camera state machine, multiple images, PDF pages, crop, enhancement, OCR, barcode, rotation/lock/cancel, row-specific fields, retry/delete/clear/submit. | **Partial/Native adaptation** — `UploaderScreen` has the major port and native modules. | Recent fixes: all five types visible in full-page mode (KYC no longer force-hidden), native PDFs rasterized page-by-page via `expo-pdf-page-image` (2× scale, one queue item per page, `cleanupPages` wired), camera cancel/reset + delete-last/clear-all media-cache parity, web rotate barcode rescan, MAX_FILES truncation warning. Remaining: live visual/interaction comparison, crop gestures, enhancement bytes, submit/retry row isolation. |
| `admin.html` | Master tiles and split list/detail panels for users, registrations, services, branches, staff, attendance, pincodes, clients, B2B2C, holidays, shifts, modes, carriers; OTP/SUDO dialogs; GPS and service controls. | **Partial** — `AdminScreen` covers the main audited management tiles and native GPS/notifications. | Finish every list/detail form, role gate, approval state, service log/action, branch/staff/attendance fields, and mobile split-view parity. Existing `expo-location`; no extra dependency for forms. |
| `Tracking.html` | Referenced by navigation/config in the web project; tracking page behavior is represented by `jawaS/tracking.js` and related layout. **No file with this exact name exists in the current GENIE_WEB root inventory.** | **Partial** — `TrackingScreen` exists. | Keep the discrepancy documented; use `TrackingScreen` as the canonical React destination and do not add a phantom web page. |
| `Pincode.html` | Pincode/city mode switch, validation, local-network lookup with public fallback, Enter-key search, summary/TAT/ODA result rendering, city post-office results, responsive layout, inline services. | **Implemented (bundle validated)** — `screens/PincodeScreen.js` is wired to the Pincode Search menu item. | Uses existing `utils/searchpin.js`; added `searchCity()` using the same India Post fallback family. No new dependency. Live API/device verification remains a manual follow-up. |
| `calc.html` | Estimate calculator: customer, origin/destination pincode, mode/carrier, mutually exclusive payment flags, DOX envelope, multibox/product entry, helper rate table, freight/surcharge/taxes/total, reset/estimate, mobile popups. | **Implemented (bundle validated)** — `screens/CalculatorScreen.js` is wired to the Rate Estimate menu item and has no booking API side effects. | Reuses `utils/calculations.js` and `utils/searchpin.js`; no new dependency. Live rate-data/device verification remains a manual follow-up. |
| `search.html` | Global database search: source selector, query, mapped fields, result count/list/detail, search filters. | **Partial** — tracking/search entry exists in `TrackingScreen`/header. | Add a real `GlobalSearchScreen` over the SQLite replica, with schema/source selection and result detail. No extra dependency. |
| `zipfinder.html` | Global ZIP lookup through GeoNames, country/city selection, country metadata, nearest airport/port hub, INR/USD/RAM currency display and loading/error flow. | **Implemented (bundle validated)** — `screens/ZipFinderScreen.js` is wired to the Global ZIP Finder menu item. | Uses new native-safe `utils/zipfinder.js` for GeoNames, REST Countries, exchange rates and nearby hubs. No new dependency. External API/device verification remains a manual follow-up. |
| `complaint.html` | AWB/reference search through the complaint Apps Script endpoint, consignment detail card, category/mobile/email/message form, `sendComplaint` POST, loading/error/success states and reset-after-submit. | **Implemented (bundle validated)** — `screens/ComplaintScreen.js` is wired to Raise Complaint. | Uses the same public Google Apps Script endpoint and payload; no new dependency. The web inline script contains a malformed fragment, so React follows its clearly intended flow. Live endpoint verification remains a manual follow-up. |
| `calendar.html` | Operations Dashboard with fixed 2024–2026 public-holiday manifest, 2024/25/26 session selector, month navigation, today action, holiday/task markers, selected-date details, booking deadlines, office/service/support cards, holiday table and optional `CALENDAR_EVENTS` tasks. | **Implemented (bundle validated)** — `screens/CalendarScreen.js` is wired to the Operations Calendar menu item; it keeps the calendar manifest separate from Admin holiday CRUD and loads optional authenticated tasks with a local fallback. | No new dependency. Uses `core/storage.js` for offline event data and native-safe `Intl` date formatting; live task endpoint/device verification remains a manual follow-up. |
| `memos.html` | Internal memo list/detail, search, priority/category filters, statistics, unread/readBy state, admin compose/delete, email reply, download, load-more, plus external government/industry/logistics updates with filters, refresh, sorting, load-more and 30-minute auto-refresh. | **Implemented (bundle validated)** — `screens/MemosScreen.js` is wired to Company Memos and preserves the web’s intended `getMemos`/`getPublicMemos`, `getExternalNews`, and `fbWrite` contracts. | No new dependency. `Linking` replaces mailto browser opening and `Share` replaces text-file download; the web memo script has malformed create/delete fragments, so the native implementation follows the surrounding explicit payload contracts. |
| `invoice.html` | Static tax-invoice print layout with billing party, shipment rows, charge/tax totals, UPI QR, bank information and terms. | **Implemented (bundle validated)** — `screens/InvoiceScreen.js` is wired to Tax Invoice, renders the synced order rows/totals instead of the web sample rows, and supports native printing. | No new dependency. Uses existing `expo-print` and the same QR Server UPI payload as the web template; QR/device network and print verification remain manual follow-ups. |
| `docs.html` | Document Center: document catalog/search, schemas, dynamic rows, validation checklist, drafts, saved documents, import, preview, print, PDF/DOCX download and delete/copy. | **Implemented (native adaptation)** — `screens/DocsScreen.js` is wired to Document Center and preserves all web document IDs, catalog groups, decision guide, schema forms, dynamic tables, shipment import, validation, local save/copy/delete, preview, print and PDF/share actions. | Browser IndexedDB/DOM/jsPDF/DOCX paths are replaced by per-account AsyncStorage, React Native tables, `expo-print`, and native `Share`. DOCX remains a native adaptation gap because the existing browser `docx`/FileSaver path cannot run directly in RN. |
| `vault.html` | Accounting/finance tiles, branch selection, Manager.io toggle, split list/detail, reports/print, billing, invoices, customers, purchases, inventory, payments, payroll, expenses, journals, taxes, approvals, close FY. | **Implemented (native adaptation)** — `screens/VaultScreen.js` is wired to The Vault and includes role-filtered tiles, branch context, Manager.io toggle, local HEADER/LEDGER/B2B summaries and statements, invoice/purchase/note/payment lists, customer/supplier tabs, tax details, inventory/bank/COA live views, service actions, actions for receipts/payments/notes, and native report printing. | Browser split-pane DOM modules are replaced by React list/detail panes. Manager.io/GST endpoints remain live API calls. Native charting and some specialized web forms (full payroll, bulk import, close-FY wizard, cheque detail editing) remain follow-up enhancements; no new dependency was required. |
| `wallet.html` | Recharge tab, amount stepper/custom amount, QR payment modal, transaction ID validation/verification, success/error feedback, transactions list. | **Missing**. | Add `WalletScreen`; use native QR renderer and existing API auth. Payment provider/UPI launch behavior must be specified; no payment SDK is currently installed. |
| `services.html` | Service catalog/content page used as an inline dynamic section from home/Pincode. | **Implemented (bundle validated)** — `screens/ServicesScreen.js` is wired to the Services menu item with the web hero, nine capability cards, feature badges and authenticated CTA adaptation. | Static page; no new dependency. The authenticated CTA opens Book Order because the React shell already has a logged-in session. |
| `about.html` | Public company/about content page. | **Missing**. | Add static `AboutScreen`; no dependency. |
| `awareness.html` | Fraud/security awareness content page. | **Missing**. | Add static `AwarenessScreen`; no dependency. |
| `dgr.html` | Dangerous Goods Regulations reference/content page. | **Missing**. | Add `DgrScreen`; no dependency unless later adding document/image assets. |
| `faqs.html` | FAQ content page used both directly and in the home modal. | **Missing**. | Add reusable `FaqScreen`/accordion/modal. No dependency. |
| `service-agreement.html` | Service agreement/legal content page. | **Missing**. | Add legal content screen; no dependency. |
| `404.html` | Branded not-found page and navigation back to home. | **Missing** in manual-tab navigation. | Add a fallback screen or route-level unknown destination handling. A navigation library would help but is not mandatory. |
| `header.html` | Shared responsive header, logo, public/private navigation, sidebar, profile, refresh (delta/full-sync), search, notifications, logout, role filtering, cached injection. | **Partial/Covered shell** — `Header`, `BottomMenuSheet`, notification panel and App sync exist. | Add every web nav destination, role-aware menu parity, sidebar/submenus, refresh gesture semantics, profile detail and sync status visuals. Existing `NotificationsPanel`; no dependency. |
| `footer.html` | Shared footer and dynamic copyright/support text. | **Covered/Partial** — `Footer` exists. | Verify exact content, support contact, and public/private layout placement. No dependency. |
| `dev_url.json` | Development backend URL (`https://post4ex-app.hf.space`). | **Covered differently** — React uses `core/config.js`. | Keep one environment source of truth; do not duplicate production URLs in screens. No dependency. |
| `tailwind.config.js` | Tailwind scans root HTML and provides web build styling. | **Not applicable** to RN styles. | Convert any remaining missing visual behavior to `StyleSheet`/responsive dimensions; no RN Tailwind dependency currently installed. |
| `_worker.js` | Cloudflare Pages API proxy to backend and static asset serving. | **Not applicable in native**; React calls `API_BASE` directly. | Ensure native CORS/auth/timeout/error behavior matches proxy-backed web requests. No dependency. |
| `sw.js` | Browser service worker: stream sync, background delta polling, IndexedDB merge/delete, notifications, notification click handling. | **Partial/native adaptation** — React has SQLite sync/SSE/reconcile/native notifications. | Native background execution is not equivalent to a browser SW. Add/verify OS background task strategy if true closed-app sync is required; likely `expo-task-manager` + background fetch, subject to OS limits. |
| `_headers` | Cloudflare no-index/content-type deployment headers. | **Not applicable**. | No native work. |
| `_redirects` | Cloudflare root/hidden-file redirects. | **Not applicable**. | No native work. |
| `deploy.sh` | Temporary API URL patch and Cloudflare Pages deploy. | **Not applicable**. | Native release uses EAS/OTA; document separate deployment pipeline. |
| `.hfignore` | Hugging Face asset ignore list. | **Not applicable**. | No native work. |
| `.gitignore` | Web repository ignore rules. | **Not applicable**. | No native work. |

### Referenced by web navigation/scripts but absent from the current root inventory

These are not silently counted as implemented pages: `ticket.html`, `task.html`, `PickupRequest.html`, `OutMenifest.html`, `InMenifest.html`, `RunSheet.html`, `Update.html`, `POD.html`, `CRM.html`, `ReportBooking.html`, `ReportMenifest.html`, `ReportUpdate.html`, `ReportRunsheet.html`, `ReportCRM.html`, and `core/b2b-api.js` are referenced by web navigation or script tags but were not present in the current `GENIE_WEB` directory listing. They need a separate product decision: restore/implement them, or remove their dead links from both web and React navigation.

---

# 2. `core/` application files

React contains same-named ports for almost all core files. “Port exists” does not mean browser behavior is fully native-safe; each entry below must remain tracked.

| Web file | Responsibility | React coverage / gap | Native/dependency notes |
|---|---|---|---|
| `core/app-config.js` | Constants, API URL, roles, page permissions, data schema/instructions, date fields. | **Covered** by `GENIE_REACT/core/config.js` plus app config; compare every constant and role/page entry. | No dependency. |
| `core/app-api.js` | Authenticated API wrapper, timeout/content-type checks, SSE delta application, event catch-up, full-sync trigger, retry banner, data engine. | **Covered/Partial** by `core/app-api.js` and `core/sync.js`; React App also applies deltas. | Must stay free of DOM/global `window`; use React callbacks for retry UI. |
| `core/app-auth.js` | Session helpers, idle heartbeat, expiry warning, logout, role/page guard and profile population. | **Partial** — React auth/session refresh exists in `App.js`; page guard/profile UI is not equivalent. | Existing SQLite/AsyncStorage; `expo-secure-store` recommended for durable credentials. |
| `core/login.js` | Browser login/register/forgot/KYC view machine, cached component injection, form validation. | **Partial** — `LoginScreen` handles login; other views need verification/port. | RN forms, keyboard/focus and native alerts replace DOM. |
| `core/indexeddb.js` | WebIndexedDB stores, sheet keys, timestamp guarded merge, delete, metadata, PB-ID lookup, counts. | **Covered by SQLite adapter** (`storage.js`, `sqlite-app.js`) and reconcile. | Must test SQLite transaction serialization; no IndexedDB in native. |
| `core/docs-db.js` | Separate DocumentsDB IndexedDB wrapper, sanitization, save/get/delete/clear by user. | **Missing native document persistence equivalent**. | Add document tables to SQLite or a dedicated storage adapter; do not use DOM sanitization as the only safety layer. |
| `core/sse-worker.js` | SharedWorker single SSE connection, watchdog, reconnect backoff, broadcast to tabs. | **Native adaptation** — `core/sse.js` is the RN listener; App manages one instance. | `react-native-sse` is installed. Background/closed-app behavior cannot be guaranteed by SSE alone. |
| `core/layout.js` | Header/footer injection, dynamic allowed page loading, prefetch, sync worker messages, SSE direct fallback/watchdog, refresh scheduling. | **Partial** — shell/sync logic is split into App/components. | Remove DOM assumptions; route callbacks and AppState replace visibility/document events. |
| `core/app-notify.js` | Notification modal/toasts, local notification sheet, file preview modal, mark/read/clear, external preview allow-list. | **Partial/Covered** by `NotificationsPanel` and native-notifications helper. | File preview still needs native image/PDF viewer; external URL policy needs `Linking`/WebView decision. |
| `core/services-api.js` | Service status, ping, worker trigger, restart, WhatsApp status/logout, Manager.io toggle and logs. | **Partial** in `AdminScreen` service controls. | No dependency. Test role/error/log response parity. |
| `core/searchpinweb.js` | Pincode modal, carrier-specific result schemas, responsive tables/cards, serviceability/errors. | **Partial** helper exists; no dedicated result screen. | Native list/table renderer required; no dependency. |
| `core/assign-carrier-api.js` | PATCH order carrier assignment. | **Partial** — API wrapper exists; UI/action coverage in Orders must be verified. | No dependency. |
| `core/upload-api.js` | Upload payload shape and `/api/upload` submission. | **Covered/Partial** in uploader engine/screen. | Must preserve exact content type/base64/PDF payload fields. |
| `core/navigation-guard.js` | Browser dirty-form beforeunload/link/form guard. | **Native adaptation** — no browser beforeunload. | Implement BackHandler/modal confirmation for dirty RN forms; no package required. |
| `core/search-modal.js` | Header tracking modal, default/live/custom carrier tabs, subcarrier selection, barcode scan, pincode search, tracking result/timeline. | **Partial** — TrackingScreen covers basic tracking. | Add custom carrier modes, subcarrier lists, pincode result view, native barcode camera/file flow. `expo-camera` exists. |
| `core/docs-api.js` | Location/pincode/international ZIP, FX rates, airports/ports, caching/rate limiting and form autofill. | **Missing/Partial** — no docs screen consumes the complete API. | No dependency; native cache should use SQLite/storage. |
| `core/formatIST.js` | Canonical date parsing/IST formatting for raw timestamps and display formats. | **Covered** by React format utility, but date regressions must remain tested. | No dependency; never serialize display text as server date. |
| `core/b2b2c-api.js` | B2B2C create/update/delete endpoint wrappers. | **Partial** — admin/book contact paths exist. | No dependency. |
| `core/uploader-image.js` | Browser compression, rotation, image→A4 PDF bundling. | **Native adaptation** — React uploader engine uses image manipulator/PDF page module/print. | Existing `expo-image-manipulator`, `expo-pdf-page-image`, `expo-print`, `react-native-view-shot`. |
| `core/admin-api.js` | Admin CRUD/API wrappers for all master sheets. | **Partial** — AdminScreen uses selected wrappers/inline fetches. | Audit every endpoint and payload; no dependency. |
| `core/book-order.js` | Shared booking/edit payload builder, submit, delete. | **Covered/Partial** by React booking logic and calculation helpers. | Keep date serialization and HTTP method exact; add unit tests around payloads. |

---

# 3. `jawaS/` page/feature files

These files hold most web page-specific behavior. The React equivalent is listed explicitly so missing pages are not hidden by copied `core/` files.

| Web file | Main feature set | React status |
|---|---|---|
| `jawaS/dashboard.js` | Dashboard counts, charts, hash/debounced refresh, branch contact. | **Partial** — `DashboardScreen`; chart and branch parity pending. |
| `jawaS/orders.js` | Orders page list/filter/search/detail actions. | **Partial** — `OrdersScreen`; continue exact filter/detail audit. |
| `jawaS/shipments.js` | Shipment tiles, filters, details, tracking, upload/document/mail/WhatsApp actions. | **Partial** — merged into `OrdersScreen`; several actions need verification. |
| `jawaS/shipments-assign-carrier-tile.js` | Assign-carrier tile/list/action UI. | **Partial** — API exists; UI parity pending. |
| `jawaS/track-tile.js` | Shipment tracking tile/card/history/status rendering. | **Partial** — `TrackingScreen`/order detail. |
| `jawaS/tracking.js` | Public/auth tracking request and result renderer. | **Partial** — basic native tracking; custom/public modes pending. |
| `jawaS/book-order.js` | Booking submit/result/SSE wait, last-booked panel. | **Covered/Partial** — `BookOrderScreen` + App wait; verify all states. |
| `jawaS/edit-order.js` | Edit booking state/payload/result. | **Partial** — routed through `BookOrderScreen`. |
| `jawaS/book-order-add-contact.js` | Add consignor/consignee contact modal, pincode/carrier-derived logistics, return/select contact. | **Partial** — native contact flow exists but exact web lockups/return semantics need verification. |
| `jawaS/calc.js` | Calculator UI, data loading, mode/payment/box/product controls and estimate rendering. | **Implemented (React adaptation)** — `screens/CalculatorScreen.js` ports the calculator flow with shared native-safe helpers. |
| `jawaS/calc-add-contact.js` | Calculator contact modal and logistics autofill. | **Missing screen**. |
| `jawaS/uploader.js` | Full uploader order list, task rows, state transitions, submit/retry. | **Partial/native adaptation** — `UploaderScreen`. | Type visibility (KYC), camera cancel/Done semantics, delete-last/clear-all image-cache reset and web rotate barcode rescan now match; submit/retry loop verified. |
| `jawaS/mini-uploader.js` | Shipment/booking mini-uploader task restrictions, row inputs, uploads, previews and submit. | **Partial/native adaptation** — reused `UploaderScreen` modal. | KYC default hiding + client Reciept/POD RBAC stay confined to modal contexts (Orders/BookOrder), matching the web mini-uploader; remaining: exact mini layout/flow verification. |
| `jawaS/updatestatus.js` | Shipment status update form/action. | **Missing/Partial** — no clearly separate native status editor. |
| `jawaS/docs-gen.js` | Document center list, schemas, dynamic forms, validation, drafts, saved docs, print/PDF/DOCX/import. | **Missing screen**. |
| `jawaS/admin.js` | Master tile counts, split list/detail controller, role/SUDO/OTP modal coordination. | **Partial** — `AdminScreen`; continue tile/list/detail parity. |
| `jawaS/admin-users.js` | User list/detail/add/update/delete and role/status management. | **Partial** — some user flow/OTP exists. |
| `jawaS/admin-registrations.js` | Pending registration approval/rejection and detail. | **Partial** — audit native approval actions. |
| `jawaS/admin-branches.js` | Branch CRUD, pincode lookup, GPS/geotag, manager/contact data. | **Partial** — AdminScreen has pincode/GPS; exact CRUD/detail pending. |
| `jawaS/admin-staff.js` | Staff CRUD, branch/role/pincode and staff detail. | **Partial**. |
| `jawaS/admin-attendance.js` | Attendance list, in/out, GPS coordinates, date/branch filters. | **Partial** — location fields added; full history/actions pending. |
| `jawaS/admin-pincodes.js` | Pincode master/list/search/manage. | **Partial** — pincode lookup exists; master management pending. |
| `jawaS/admin-holidays.js` | Holiday CRUD, branch/state/status/date selection. | **Partial** — tile exists; full form/state logic pending. |
| `jawaS/admin-shifts.js` | Shift setup, staff assignment, leave/history views. | **Partial**. |
| `jawaS/admin-modes.js` | Mode master CRUD, limits/volume/zone/service flags. | **Partial** — mode data is consumed by booking; CRUD UI pending. |
| `jawaS/admin-carriers.js` | Carrier master CRUD, company code and service settings. | **Partial**. |
| `jawaS/admin-services.js` | Service status/action/logs dashboard. | **Partial** — service tiles/actions added; exact log view pending. |
| `jawaS/admin-clients.js` | B2B client master CRUD and details. | **Partial** — selection exists in booking; master CRUD pending. |
| `jawaS/admin-b2b2c.js` | B2B2C contact list/detail/create/update/delete. | **Partial** — contact flow exists; exact list/detail parity pending. |
| `jawaS/b2b2c.js` | B2B2C page-specific list/form/selection behavior. | **Partial** — no separate native B2B2C screen currently guaranteed. |
| `jawaS/vault.js` | Vault tile controller, branch selection, split-view navigation, Manager.io state. | **Missing screen**. |
| `jawaS/vault-coa.js` | Chart of accounts list/detail/create/edit and account hierarchy. | **Missing**. |
| `jawaS/vault-summary.js` | Financial summary reports/cards. | **Missing**. |
| `jawaS/vault-billing.js` | Billing list/detail/actions. | **Missing**. |
| `jawaS/vault-sales-invoices.js` | Sales invoice list/create/detail/print. | **Missing**. |
| `jawaS/vault-credit-notes.js` | Credit note list/create/detail. | **Missing**. |
| `jawaS/vault-customers.js` | Accounting customer records. | **Missing**. |
| `jawaS/vault-purchases.js` | Purchase bills/list/detail. | **Missing**. |
| `jawaS/vault-debit-notes.js` | Debit note list/create/detail. | **Missing**. |
| `jawaS/vault-suppliers.js` | Supplier records. | **Missing**. |
| `jawaS/vault-inventory.js` | Inventory and stock view. | **Missing**. |
| `jawaS/vault-product-items.js` | Inventory/product item records. | **Missing**. |
| `jawaS/vault-service-items.js` | Service item records. | **Missing**. |
| `jawaS/vault-receipts.js` | Receipt/payment-in list and entry. | **Missing**. |
| `jawaS/vault-expenses.js` | Expense claims/entries. | **Missing**. |
| `jawaS/vault-payroll.js` | Employee/payroll processing. | **Missing**. |
| `jawaS/vault-accounts.js` | Bank/account master. | **Missing**. |
| `jawaS/vault-journal.js` | Journal/recurring/opening balance entries. | **Missing**. |
| `jawaS/vault-gst.js` | GST reports/reconciliation. | **Missing**. |
| `jawaS/vault-taxes.js` | Tax configuration/records. | **Missing**. |
| `jawaS/vault-pending-approvals.js` | Pending approval workflow. | **Missing**. |
| `jawaS/vault-close-fy.js` | Financial-year closing flow. | **Missing**. |

---

# 4. `utils/` files and runtime dependencies

| Web file | Behavior | React status / required adaptation |
|---|---|---|
| `utils/calculations.js` | Freight, add-rate, ceiling/zone lookup, all charges, GST split, box weight recalculation. | **Covered/critical** in booking; keep exact pure-function tests and rate UID mapping. |
| `utils/invoice-utils.js` | Invoice ID/bill-cycle/date helpers. | **Partial**; needed by future invoice/vault screens. |
| `utils/vault-print-templates.js` | Accounting/Vault report and print templates. | **Missing consumer**; needs native print/preview adapter. |
| `utils/docgen.js` | Label, receipt, POD, office copy, docs-and-box HTML builders; print/download/mail; barcode script injection. | **Partial/native adaptation**; React builders/viewers exist but HTML/DOM print paths need native rendering and barcode verification. |
| `utils/docs-config.js` | Document field mappings, schemas and decision guide. | **Missing consumer**; must feed `DocsScreen`. |
| `utils/docs-validation.js` | Large validation schema and per-document profiles. | **Missing consumer**; port pure validation to RN-safe module and test. |
| `utils/docs-templates.js` | Print HTML for invoices, packing list, KYC, customs, tax and delivery documents plus 10 designs each for some documents. | **Missing native renderer**; use `expo-print` for HTML where possible, or build native preview; never rely on `document` in native. |
| `utils/uploader-camera.js` | Browser camera stream, canvas capture, PDF.js rasterization, Cropper.js crop, barcode detector, OCR region selection, Caman filters, reset lifecycle. | **Native adaptation** in `UploaderScreen`; verify every control and byte output. |
| `utils/uploader-image.js` equivalent/core | Browser compression/rotate/image-to-PDF helper. | **Native adaptation** using installed Expo modules. |
| `utils/awb-detect.js` | AWB/carrier/product pattern detection and suffix mapping. | **Partial**; must be used by booking/orders/uploader consistently. |
| `utils/searchpin.js` | Public pincode/Post Office lookup. | **Partial**; helper exists but no dedicated React page. |
| `utils/geo.js` | Browser geolocation, retry/high accuracy, distance calculation, GPS button wiring. | **Native adaptation** via installed `expo-location`; web fallback remains separate. |
| `utils/input-validator.js` | Shared pin/mobile/email/GST/AWB/field validators and input guards. | **Partial**; port must be used consistently by every React form. |
| `utils/docs-db.js` (not present; web equivalent is `core/docs-db.js`) | Document persistence. | **Missing SQLite document tables/adapter**. |
| `utils/awb-detect.js` | AWB recognition and carrier/product inference. | **Partial**; verify all callers. |
| `utils/barcode.js` | ZXing/native BarcodeDetector barcode formats and video/canvas scanning. | **Native adaptation**; `expo-camera` supports native scanning, while web component remains browser-only. |
| `utils/barcode-scanner.js` | Web custom elements `<scan-barcode>`/`<read-barcode>`, camera/file picker UI, scanned events. | **Partial**; native screens need explicit camera scanner components and event callbacks. |
| `utils/qrcode.min.js` | Browser QR generation library. | **Native missing equivalent** for generated QR previews; use an RN-compatible QR/SVG implementation or server-generated QR. |
| `utils/zxing-browser.min.js` | Bundled browser ZXing implementation. | **Not directly usable native**; replace with `expo-camera`/native module. |
| `utils/pdf.min.js` | Bundled PDF.js browser renderer. | **Native replaced** by `expo-pdf-page-image`; an in-app PDF viewer is still required for viewing uploaded PDFs. |
| `utils/cropper.min.js` | Bundled Cropper.js browser cropper. | **Native replaced** by RN crop UI; web build can keep this dependency. |
| `utils/caman.full.min.js` | Browser image enhancement/filter engine. | **Native replacement required**; current view-shot/image-manipulator pipeline must prove filters are baked into bytes. |
| `utils/tesseract.min.js` | Browser OCR engine. | **Native replaced** by installed `expo-ocr-kit`; web/native outputs need the same field extraction. |
| `utils/jspdf.umd.min.js` | Browser PDF generation. | **Partial/native adaptation** via `expo-print`; verify A4/margins/images and sharing. |
| `utils/JsBarcode.all.min.js` | Browser barcode rendering. | **Native missing equivalent** in generated/printed native docs; use SVG/barcode generator or server barcode image. |
| `utils/barcode.js` | Barcode detection helper. | **Native adaptation** required as above. |
| `utils/chart.js` | Bundled browser chart library. | **Native missing equivalent**; use `react-native-svg` custom charts or add a compatible chart library after approval. |
| `utils/awb-detect.js` | Pattern inference. | **Partial**; centralize and test. |
| `utils/cropper.min.css` equivalent in assets | Cropper styling. | **Not applicable** to native. |

> The web `utils/` directory also contains large third-party/minified assets. They are catalogued above as runtime dependencies, not treated as application logic to port line-for-line.

---

# 5. Web styles/assets/deployment files

| Web file/group | Purpose | React status |
|---|---|---|
| `assets/css/style.css` | Global web layout, cards, buttons, tiles, split panes, responsive breakpoints and forms. | **Partial translation** into RN `StyleSheet`; exact web CSS cannot be reused. |
| `assets/css/inter-font.css` | Inter font face/import. | **Covered differently** by `@expo-google-fonts/inter`. |
| `assets/css/fontawesome.css` | Font Awesome icon CSS. | **Partial** — React uses SVG/text/icons in places; exact icon parity still pending. |
| `assets/css/cropper.min.css` | Cropper.js visual styling. | **Web only**; native crop modal has separate styles. |
| `assets/images/favicon.svg` | Browser favicon. | **Web only**. |
| `assets/images/genie-logo.svg` | Web logo. | React uses configured PNG/assets; verify visual parity. |
| `assets/images/post4ex-logo.svg` | Web brand logo. | No confirmed native usage. |
| `assets/images/office-bg.jpg` | Web background asset. | No confirmed native usage. |
| `assets/images/quote-greeting-img-001.png` | Public/content image. | No confirmed native screen usage. |
| `assets/fonts/montserrat-black.woff2` | Web Montserrat font asset. | Covered by Expo Google Montserrat package. |
| `assets/webfonts/fa-solid-900.woff2` | Font Awesome solid glyphs. | Replace with SVG/icon component or native font setup. |
| `assets/webfonts/fa-brands-400.woff2` | Font Awesome brands glyphs. | Replace with SVG/icon component. |
| `assets/webfonts/fa-regular-400.woff2` | Font Awesome regular glyphs. | Replace with SVG/icon component. |
| `assets/Network/network-data.map.min.js` | Bundled network/IP data. | No confirmed React consumer; investigate before adding size. |
| `.wrangler/**` | Cloudflare generated cache/runtime metadata. | **Not application logic**; do not port. |

---

# 6. Feature-level gap list

## Pages/destinations still missing

1. Public Home/content experience as a real React screen.
2. Global database search screen.
3. Wallet/recharge/transactions screen.
4. About, Awareness, DGR, FAQ and Service Agreement content screens.
5. Explicit 404/fallback destination.
6. Dedicated B2B2C master screen if users must manage contacts outside booking/admin.

## Existing React areas requiring further parity work

- **Orders/Shipments:** all web tile definitions, date/TAT filters, assignment, status update, upload rows, document buttons, mail/WhatsApp, image viewer and PDF viewer.
- **Book Order:** exact rate UID mapping, empty multibox behavior, charges zero-state, payment/mode/carrier locks, date payload, keyboard focus, AWB validation and SSE confirmation state.
- **Uploader:** full/mobile layout, camera/crop/enhance controls, image queue slider, inline capture, PDF page processing, OCR/barcode extraction, row table and retry lifecycle.
- **Admin:** every tile's list/detail/action/OTP/SUDO/role behavior, branch/staff/attendance GPS, holidays/shifts, service logs and mobile split navigation.
- **Sync:** background execution limits, SQLite lock serialization, event cursor/deletes/cascades, notification persistence and reconciliation.
- **Shell:** all web navigation destinations, role-gated menu entries, profile details, refresh semantics and back behavior.

---

# 7. Dependency matrix

## Already installed and actively relevant

| Package | Needed for |
|---|---|
| `expo-camera` | Camera capture, QR/barcode scanning, inline camera workflows. |
| `expo-document-picker` | Image/PDF selection. |
| `expo-image-picker` | Gallery/camera selection fallback. |
| `expo-image-manipulator` | Resize/rotate/compression and image preparation. |
| `expo-pdf-page-image` | Native PDF page rasterization. Requires a rebuilt development client. |
| `expo-ocr-kit` | Native OCR. Requires a rebuilt development client. |
| `react-native-view-shot` | Capturing enhanced/filter previews into actual upload bytes. Requires rebuild. |
| `expo-print` | Native HTML/PDF print generation. |
| `expo-sharing` | Share/download handoff for documents/uploads. |
| `expo-location` | Branch geotag and attendance GPS. Requires rebuild. |
| `expo-notifications` | Native notification channel/foreground alerts. Requires rebuild and OS permission. |
| `expo-sqlite` | Persistent local replica, event/data mapping and document storage expansion. |
| `react-native-sse` | Foreground SSE connection. |
| `react-native-svg` | SVG icons, QR/barcode/chart/native document visuals. |
| `@react-native-community/slider` | Uploader enhancement sliders. |

## Likely required before declaring full parity

| Need | Current state | Decision/implementation note |
|---|---|---|
| In-app PDF viewer | No confirmed native viewer package. | Add a native PDF viewer only if `expo-print`/sharing is insufficient; evaluate an Expo-compatible package before install. |
| Image viewer/zoom | Utility exists but full viewer parity is not confirmed. | Build a native modal with zoom/pan or add a compatible viewer package. |
| QR generation | Web `qrcode.min.js` only. | Use an RN SVG QR implementation or server image; do not load browser library in native. |
| Barcode generation | Web JsBarcode only. | Use SVG/native barcode generation or server-generated barcode for labels/docs. |
| Charts | Web `chart.js`; no RN chart dependency. | Implement with `react-native-svg` or add a compatible package after confirming bundle/platform support. |
| Background sync | Foreground SSE + AppState/audit exists. | True closed-app sync needs OS background task APIs; likely `expo-task-manager`/background-fetch strategy and platform-specific expectations. |
| Secure credential storage | Session currently uses the app storage adapter. | Evaluate `expo-secure-store` for tokens/refresh tokens before production hardening. |
| DOCX export | Web uses browser generation/download path. | Add server-side DOCX endpoint or native-safe generator; `expo-print` only solves PDF/print. |
| Navigation | Manual `activeTab` only. | A route stack becomes necessary once all pages are added; use an existing-compatible navigation solution rather than deep-link hacks. |

---

# 8. Recommended implementation order

1. **Navigation and shell:** add a route registry for all missing pages, role gates, back stack, header/sidebar parity and 404 fallback.
2. **Orders/Shipments completion:** finish viewers, document actions, filters, status/assignment and exact web tiles.
4. **Document Center + Invoice:** port schemas/validation and native preview/print/share.
5. **Admin completion:** finish all master CRUD/list/detail flows, approvals, holidays, shifts, service logs and B2B2C.
6. **Public content pages:** Home, Services, FAQ, About, Awareness, DGR and Service Agreement.
7. **Wallet and complaint/calendar/search.**
8. **Vault:** port accounting modules one tile at a time, beginning with summary, billing, invoices, customers and ledger.
9. **Background/runtime hardening:** SQLite lock queue, background task limitations, secure tokens, OS notification click routing and end-to-end sync tests.
10. **Parity validation:** each row above moves from `Missing`/`Partial` to `Covered` only after a behavior test on web and native, not after a file copy.

## Completion rule

A feature is not marked **Covered** merely because a similarly named React file exists. It is covered only when its user-visible states, payload shape, validation, persistence, error handling, permissions, back behavior and platform-specific replacement for browser APIs have been verified.
