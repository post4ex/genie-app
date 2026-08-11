# 📘 Exhaustive Technical Specification & Helper Plan: Exact SQLite Engine for `GENIE_REACT`

This document details the complete architectural design and explicit helper specifications for building an **exact, 1-to-1 native local SQLite replica engine** inside `GENIE_REACT` (React Native & Web), mirroring FastAPI's `sqlitedb.py` and `sqlite_indexing_helper.py`.

---

## 📐 1. System Architecture & Module Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Server (sqlitedb.py)                            │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            │ SSE Deltas (<2ms) + NDJSON Stream Sync
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  GENIE_REACT Helper Architecture                        │
│                                                                                        │
│   ┌────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────┐ │
│   │    `sqlite-app.js`     │  │   `sqlite-indexing.js`  │  │  `sqlite-reconcile.js` │ │
│   │  Core SQLite Engine &  │  │  Types, Constraints &   │  │  5-Min Parity Audit &  │ │
│   │   Batch Transaction    │  │   182+ B-Tree Indexes   │  │   Auto-Reconciliation  │ │
│   └───────────┬────────────┘  └────────────┬────────────┘  └───────────┬────────────┘ │
│               │                            │                           │              │
│               └────────────────────────────┼───────────────────────────┘              │
│                                            ▼                                          │
│                                ┌────────────────────────┐                             │
│                                │      `storage.js`      │                             │
│                                │ Universal Storage API  │                             │
│                                └───────────┬────────────┘                             │
│                                            ▼                                          │
│                            ┌────────────────────────────────┐                         │
│                            │    `expo-sqlite` Database      │                         │
│                            │      (`genie_replica.db`)      │                         │
│                            └────────────────────────────────┘                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 2. Detailed Specification of Every Helper Module

### Module 1: `GENIE_REACT/core/sqlite-indexing.js` (Types & Indexes Helper)

Replicates `sqlite_indexing_helper.py` from FastAPI.

#### 1.1 Field Storage Affinities (`SQLITE_FIELD_TYPES`)
```javascript
export const SQLITE_FIELD_TYPES = {
  // Integers (Math.floor(Number(v)))
  ORDER_DATE: 'INTEGER',
  PIECES: 'INTEGER',
  TIMESTAMP: 'INTEGER',
  TIME_STAMP: 'INTEGER',
  IS_ACTIVE: 'INTEGER',
  UNBILLED_ORDERS_COUNT: 'INTEGER',
  NOTIF_ID: 'INTEGER',
  TXN_DATE: 'INTEGER',
  QUANTITY: 'INTEGER',
  HOLIDAY_DATE: 'INTEGER',
  DOCUMENT_DATE: 'INTEGER',

  // Reals / Floats (parseFloat(v))
  WEIGHT: 'REAL',
  TOTAL: 'REAL',
  BASE_RATE: 'REAL',
  ADDON_RATE: 'REAL',
  VALUE: 'REAL',
  COD_AMOUNT: 'REAL',
  CLOSING_BALANCE: 'REAL',
  OPENING_BALANCE: 'REAL',
  AMOUNT: 'REAL',
  PRICE: 'REAL',
  UNBILLED_USAGE: 'REAL',
  CREDIT_LIMIT: 'REAL',
  TOTAL_AMOUNT: 'REAL',

  // Text (String(v))
  REFERENCE: 'TEXT',
  CODE: 'TEXT',
  UID: 'TEXT',
  DOX_KEY: 'TEXT',
  BRANCH: 'TEXT',
  CARRIER: 'TEXT',
  CONSIGNEE: 'TEXT',
  ORIGIN_CITY: 'TEXT',
  USER: 'TEXT',
  EMAIL: 'TEXT',
  STAFF_CODE: 'TEXT',
  ADDRESS: 'TEXT',
};
```

#### 1.2 Type Coercion Function: `coerceRecord(col, record)`
* **Input**: Collection name (`col`) and raw record JS object (`record`).
* **Behavior**:
  - Iterates over object entries `[k, v]`.
  - If `v === null` or `v === undefined`, retains `null`.
  - Checks `SQLITE_FIELD_TYPES[k]`:
    - `INTEGER`: `const num = Math.floor(Number(v)); record[k] = isNaN(num) ? null : num;`
    - `REAL`: `const num = parseFloat(v); record[k] = isNaN(num) ? null : num;`
    - `TEXT`: If object or array, `JSON.stringify(v)`; else `String(v)`.
* **Output**: Coerced clean record object ready for SQLite SQL execution.

#### 1.3 B-Tree Index Definitions (`SQLITE_COLLECTION_INDEXES`)
* Exports array of 182 SQL `CREATE INDEX IF NOT EXISTS` statements:
  - `CREATE INDEX IF NOT EXISTS idx_orders_branch ON "ORDERS"("BRANCH");`
  - `CREATE INDEX IF NOT EXISTS idx_orders_code ON "ORDERS"("CODE");`
  - `CREATE INDEX IF NOT EXISTS idx_orders_date ON "ORDERS"("ORDER_DATE");`
  - `CREATE INDEX IF NOT EXISTS idx_orders_total ON "ORDERS"("TOTAL");`
  - `CREATE INDEX IF NOT EXISTS idx_movements_ref ON "MOVEMENTS"("REFERENCE");`
  - `CREATE INDEX IF NOT EXISTS idx_movements_date ON "MOVEMENTS"("TIME_STAMP");`
  - `CREATE INDEX IF NOT EXISTS idx_shipments_ref ON "SHIPMENTS"("REFERENCE");`
  - `CREATE INDEX IF NOT EXISTS idx_ledger_code ON "LEDGER"("CLIENT_CODE");`
  - `CREATE INDEX IF NOT EXISTS idx_ledger_date ON "LEDGER"("TXN_DATE");`

---

### Module 2: `GENIE_REACT/core/sqlite-app.js` (Core Local Engine & CRUD Helper)

Replicates `sqlitedb.py` core DB connection, statement execution, and key mapping.

#### 2.1 Primary Key Registry (`KEY_FIELDS`)
```javascript
export const KEY_FIELDS = {
  ORDERS:        'REFERENCE',
  USERS:         'USER',
  REGISTRATIONS: 'EMAIL',
  BRANCHES:      'BRANCH_CODE',
  B2B:           'CODE',
  B2B2C:         'UID',
  RATES:         'UID',
  STAFF:         'STAFF_CODE',
  ATTENDANCE:    'ATTENDANCE_ID',
  MODES:         'SHORT',
  CARRIERS:      'COMPANY_CODE',
  MULTIBOX:      'MB_UID',
  PRODUCTS:      'PD_UID',
  UPLOADS:       'UPLOAD_UID',
  NOTIFICATIONS: 'NOTIF_ID',
  HOLIDAYS:      'HOLIDAY_ID',
  HEADER:        'DOX_KEY',
  LEDGER:        'TXN_ID',
  SHIPMENTS:     'id',
  EVENTS:        'id',
  MOVEMENTS:     'id',
};
```

#### 2.2 Core Engine Functions

##### `initLocalDatabase()`
* Opens `genie_replica.db` using `expo-sqlite` (`openDatabaseSync`).
* Executes PRAGMA setup:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  ```
* Iterates through all 20 collections and creates tables if not present with primary key column.
* Executes all 182 B-Tree index creation statements from `sqlite-indexing.js`.

##### `sqliteUpsertMany(collection, records)`
* **Input**: Collection name, array of raw record objects.
* **Behavior**:
  - For each record, applies `coerceRecord(col, rec)`.
  - Determines primary key field `keyField = KEY_FIELDS[collection] || 'id'`.
  - Opens single `db.withTransactionAsync()` transaction.
  - Builds `INSERT OR REPLACE INTO "col" (keys...) VALUES (?, ?, ...)` dynamically.
  - Executes batch insertion for 100-record chunks.
* **Output**: `Promise<number>` (count of upserted records).

##### `sqliteDeleteMany(collection, keys)`
* **Input**: Collection name, array of key string identifiers (`keys`).
* **Behavior**:
  - Determines `keyField`.
  - Opens transaction and executes:
    ```sql
    DELETE FROM "COLLECTION" WHERE "keyField" = ? OR "id" = ?;
    ```
  - Dual matching ensures whether `k` is the custom key (`REFERENCE`, `CODE`, `USER`) or UUID `id`, record deletion is 100% successful.
* **Output**: `Promise<number>` (count of deleted records).

##### `sqliteQuery(collection, options)`
* **Input**: Collection name, optional `{ where, params, orderBy, limit, offset }`.
* **Behavior**:
  - Builds SQL query: `SELECT * FROM "col" WHERE ... ORDER BY ... LIMIT ...`.
  - Executes via `db.getAllAsync(sql, params)`.
  - Deserializes JSON string columns (`READ_BY`, `DISMISSED_BY`, array fields).
* **Output**: `Promise<Array<object>>`.

---

### Module 3: `GENIE_REACT/core/sqlite-reconcile.js` (Parity Audit & Reconciliation Helper)

Replicates `_audit_and_match_collection_counts()` and `_reconcile_collection()` from FastAPI `sqlitedb.py`.

#### 3.1 `auditAndMatchCollectionCounts(token)`
* **Execution Cadence**: Runs every 5 minutes in background.
* **Step 1 (Local SQLite Count)**:
  - Queries local `expo-sqlite`: `SELECT COUNT(*) FROM "col"` for all 19 core collections (excluding `EVENTS` and `NOTIFICATIONS`).
* **Step 2 (Server Count Query)**:
  - Calls FastAPI `/api/services/status` (or fast catalog count endpoint) to get server counts.
* **Step 3 (Comparison & Log)**:
  - Compares local counts vs server counts.
  - If 100% matched: Logs `[sqlite-audit] ✅ ALL 19 COLLECTIONS 100% MATCHED!`.
  - If mismatch detected: Logs `[sqlite-audit] ❌ MISMATCH: MOVEMENTS (Local: 2845, Server: 2849) --> Auto-triggering reconciliation!`.
  - Dispatches `reconcileCollection(token, col)` for mismatched collections.

#### 3.2 `reconcileCollection(token, collection)`
* **Behavior**:
  - Calls FastAPI `/api/fetchEvents?since_ms=0` or `/api/getRecords` to fetch full record list for target collection.
  - Computes set difference: `missing = serverIds - localIds`.
  - Upserts missing records into `expo-sqlite` via `sqliteUpsertMany()`.
  - Logs: `[sqlite-reconcile] MOVEMENTS: successfully restored 4 missing records into local SQLite!`.

---

### Module 4: Updated `GENIE_REACT/core/sync.js` (Stream Sync & Overlap Catch-Up Helper)

#### 4.1 `streamSync(token, completedLayers, onProgress)`
* NDJSON stream handler consuming `/api/sync/stream`.
* Parses data chunks line-by-line and pushes 100-record batches directly to `sqliteUpsertMany()`.

#### 4.2 `pullDeltaSince(token, sinceMs, retryCount)`
* **1-Minute Overlap Safety Net**:
  - Calculates `querySince = Math.max(0, sinceMs - 60000)`.
  - Calls `/api/fetchEvents?since_ms=${querySince}`.
  - Passes upsert payloads to `sqliteUpsertMany()` and delete payloads to `sqliteDeleteMany()`.
  - Advances `lastEventStamp = max(TIME_STAMP)`.

---

### Module 5: Updated `GENIE_REACT/core/storage.js` (Universal Abstraction Helper)

Replaces legacy `AsyncStorage` key-value pairs with high-performance SQLite queries:
* `getSheet(col)` → `sqliteQuery(col)`
* `putSheet(col, data)` → `sqliteUpsertMany(col, Object.values(data))`
* `putSheetNewer(col, data)` → Performs timestamp-guarded `sqliteUpsertMany`
* `deleteFromSheet(col, keys)` → `sqliteDeleteMany(col, keys)`

---

## 📅 3. Phased Implementation Roadmap

```
Phase 1: Foundation Setup
  ├── 1. Add expo-sqlite to package.json
  └── 2. Create GENIE_REACT/core/sqlite-indexing.js (Types & 182 Indexes)

Phase 2: Database Engine Core
  ├── 3. Create GENIE_REACT/core/sqlite-app.js (PRAGMAs, Tables, Transactions, CRUD)
  └── 4. Create GENIE_REACT/core/sqlite-reconcile.js (5-Min Audit & Reconciliation)

Phase 3: Pipeline Integration
  ├── 5. Update GENIE_REACT/core/storage.js (Route all calls to sqlite-app.js)
  └── 6. Update GENIE_REACT/core/sync.js (Stream sync, 1-min safety net)

Phase 4: Verification & UI Integration
  ├── 7. Update App.js & Screens (Indexed SQL queries)
  └── 8. Run empirical parity tests vs FastAPI server
```
