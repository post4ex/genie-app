import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHEETS, SHEET_KEYS } from './config';

// The native app uses a durable SQLite database. Web keeps the existing
// AsyncStorage fallback because expo-sqlite's native driver is not available in
// a plain browser export without a WASM/OPFS setup.
let nativeSQLite = null;
if (Platform.OS !== 'web') {
  try {
    nativeSQLite = require('expo-sqlite');
  } catch (_) {
    nativeSQLite = null;
  }
}

let databasePromise = null;
let initializationPromise = null;

const asString = (value) => value == null ? '' : String(value);

const recordKey = (collection, record, fallback = '') => {
  const keyField = SHEET_KEYS[collection] || 'id';
  // Never use REFERENCE as a universal fallback: child collections such as
  // MULTIBOX/PRODUCTS can contain many rows for one order. Their configured
  // key must remain authoritative, then id/PB_ID, then the caller's key.
  return asString(record?.[keyField] ?? record?.id ?? record?.PB_ID ?? fallback);
};

const recordId = (record) => asString(record?.id);
const recordPbId = (record) => asString(record?.PB_ID);
const recordTimestamp = (record) => {
  const raw = (
    record?.TIME_STAMP
    ?? record?.time_stamp
    ?? record?.ORDER_DATE
    ?? record?.TXN_DATE
    ?? record?.DOX_DATE
    ?? record?.ATTEN_DATE
    ?? record?.HOLIDAY_DATE
    ?? 0
  );
  if (!raw) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 0 && raw < 1e11 ? raw * 1000 : raw;
  }
  const s = String(raw).trim();
  const num = Number(s);
  if (Number.isFinite(num) && num > 0) {
    return num < 1e11 ? num * 1000 : num;
  }
  const parsedDate = Date.parse(s);
  if (Number.isFinite(parsedDate) && parsedDate > 0) {
    return parsedDate;
  }
  return 0;
};

const parsePayload = (value) => {
  try {
    return value && typeof value === 'string' ? JSON.parse(value) : (value || {});
  } catch (_) {
    return {};
  }
};

export const isNativeSQLite = () => !!nativeSQLite && Platform.OS !== 'web';

async function openDatabase() {
  if (!isNativeSQLite()) return null;
  if (!databasePromise) {
    databasePromise = nativeSQLite.openDatabaseAsync('genie_replica.db');
  }
  return databasePromise;
}

async function nativeInitialize() {
  const db = await openDatabase();
  if (!db) return null;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS replica_records (
      collection TEXT NOT NULL,
      record_key TEXT NOT NULL,
      record_id TEXT,
      pb_id TEXT,
      time_stamp INTEGER,
      payload TEXT NOT NULL,
      PRIMARY KEY (collection, record_key)
    );
    CREATE TABLE IF NOT EXISTS replica_meta (
      name TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // CREATE TABLE IF NOT EXISTS does not upgrade databases made by older app
  // versions. Add new identity columns before creating their indexes.
  const columns = await db.getAllAsync('PRAGMA table_info(replica_records)');
  const existing = new Set(columns.map((column) => column.name));
  for (const [name, type] of [['record_id', 'TEXT'], ['pb_id', 'TEXT'], ['time_stamp', 'INTEGER']]) {
    if (!existing.has(name)) await db.execAsync(`ALTER TABLE replica_records ADD COLUMN ${name} ${type}`);
  }
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_replica_collection ON replica_records(collection);
    CREATE INDEX IF NOT EXISTS idx_replica_record_id ON replica_records(collection, record_id);
    CREATE INDEX IF NOT EXISTS idx_replica_pb_id ON replica_records(collection, pb_id);
    CREATE INDEX IF NOT EXISTS idx_replica_timestamp ON replica_records(collection, time_stamp);
  `);
  return db;
}

async function backfillExistingIdentityFields(db) {
  const marker = await db.getFirstAsync(
    'SELECT value FROM replica_meta WHERE name = ?',
    'identity_backfill_version'
  );
  if (marker?.value === '1') return;

  const rows = await db.getAllAsync(`
    SELECT collection, record_key, payload
      FROM replica_records
     WHERE record_id IS NULL OR record_id = ''
        OR pb_id IS NULL OR pb_id = ''
        OR time_stamp IS NULL
  `);
  if (rows.length) {
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        const record = parsePayload(row.payload);
        await db.runAsync(
          `UPDATE replica_records
              SET record_id = CASE WHEN record_id IS NULL OR record_id = '' THEN ? ELSE record_id END,
                  pb_id = CASE WHEN pb_id IS NULL OR pb_id = '' THEN ? ELSE pb_id END,
                  time_stamp = CASE WHEN time_stamp IS NULL THEN ? ELSE time_stamp END
            WHERE collection = ? AND record_key = ?`,
          recordId(record),
          recordPbId(record),
          recordTimestamp(record),
          row.collection,
          row.record_key
        );
      }
    });
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO replica_meta(name, value) VALUES(?, ?)',
    'identity_backfill_version',
    '1'
  );
}

async function migrateLegacyAsyncStorage(db) {
  const marker = await db.getFirstAsync('SELECT value FROM replica_meta WHERE name = ?', 'legacy_migrated');
  if (marker?.value === '1') return;

  let migratedAnything = false;
  try {
    for (const collection of SHEETS) {
      const raw = await AsyncStorage.getItem(`sheet_${collection}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed)
        ? parsed.map((record, index) => [recordKey(collection, record, `legacy-${index}`), record])
        : Object.entries(parsed || {}).map(([fallback, record]) => [
            recordKey(collection, record, fallback),
            record,
          ]);
      if (!entries.length) continue;
      await sqliteUpsertMany(collection, entries, false, db);
      migratedAnything = true;
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO replica_meta(name, value) VALUES(?, ?)',
      'legacy_migrated',
      '1'
    );
    // Remove only the old duplicate representation after the SQLite copy is
    // committed. Session metadata is intentionally left untouched.
    if (migratedAnything || SHEETS.some((s) => true)) {
      for (const collection of SHEETS) {
        await AsyncStorage.removeItem(`sheet_${collection}`);
      }
    }
  } catch (error) {
    console.warn('[SQLite] legacy migration failed; keeping legacy sheets:', error.message);
  }
}

async function normalizeStoredKeys(db) {
  const marker = await db.getFirstAsync(
    'SELECT value FROM replica_meta WHERE name = ?',
    'mapping_version'
  );
  if (marker?.value === '2') return;

  // Older builds stored SHIPMENTS by PostgreSQL id. Re-key every stored
  // payload through the same business-key map used for all future writes so
  // Orders/Dashboard/Tracking can join it by REFERENCE immediately after an
  // upgrade. The old row is deleted only after the canonical row is written.
  for (const collection of SHEETS) {
    const rows = await db.getAllAsync(
      'SELECT record_key, payload FROM replica_records WHERE collection = ?',
      collection
    );
    for (const row of rows) {
      const record = parsePayload(row.payload);
      const canonicalKey = recordKey(collection, record, row.record_key);
      if (!canonicalKey || canonicalKey === String(row.record_key)) continue;
      // Prefer the already-canonical row if both old and new keys exist; an
      // upgrade must never let an older duplicate overwrite fresher data.
      const written = await sqliteUpsertMany(collection, { [canonicalKey]: record }, true, db);
      const canonicalRow = await db.getFirstAsync(
        'SELECT record_key FROM replica_records WHERE collection = ? AND record_key = ?',
        collection,
        canonicalKey
      );
      // Once the canonical row exists, the legacy key is redundant—even when
      // timestamp protection correctly skipped the old payload.
      if (written > 0 || canonicalRow) {
        await db.runAsync(
          'DELETE FROM replica_records WHERE collection = ? AND record_key = ?',
          collection,
          row.record_key
        );
      }
    }
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO replica_meta(name, value) VALUES(?, ?)',
    'mapping_version',
    '2'
  );
}

export async function initializeLocalDatabase() {
  if (!isNativeSQLite()) return false;
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const db = await nativeInitialize();
      await migrateLegacyAsyncStorage(db);
      await backfillExistingIdentityFields(db);
      await normalizeStoredKeys(db);
      return true;
    })().catch((error) => {
      initializationPromise = null;
      console.warn('[SQLite] initialization failed:', error.message);
      return false;
    });
  }
  return initializationPromise;
}

async function ensureNativeDatabase() {
  if (!isNativeSQLite()) return null;
  await initializeLocalDatabase();
  return openDatabase();
}

function normalizeEntries(collection, data) {
  if (Array.isArray(data)) {
    // Migration and callers may provide explicit [key, record] tuples.
    if (data.every((item) => Array.isArray(item) && item.length === 2)) return data;
    return data.map((record) => [recordKey(collection, record), record]);
  }
  return Object.entries(data || {}).map(([fallback, record]) => [recordKey(collection, record, fallback), record]);
}

export async function sqliteGetSheet(collection) {
  const db = await ensureNativeDatabase();
  if (!db) return {};
  const rows = await db.getAllAsync(
    'SELECT record_key, payload FROM replica_records WHERE collection = ?',
    collection
  );
  const result = {};
  for (const row of rows) {
    result[row.record_key] = parsePayload(row.payload);
  }
  return result;
}

export async function sqliteGetCounts(collections = SHEETS) {
  const db = await ensureNativeDatabase();
  if (!db) return {};
  const rows = await db.getAllAsync(
    'SELECT collection, COUNT(*) AS count FROM replica_records GROUP BY collection'
  );
  const result = {};
  for (const c of collections) result[c] = 0;
  for (const r of rows) result[r.collection] = Number(r.count || 0);
  return result;
}

export async function sqliteUpsertMany(collection, data, newerOnly = false, suppliedDb = null) {
  const db = suppliedDb || await ensureNativeDatabase();
  if (!db) return 0;
  const entries = normalizeEntries(collection, data).filter(([, record]) => record && typeof record === 'object');
  if (!entries.length) return 0;
  let written = 0;

  // Pre-load all existing timestamps for this collection in 1 single fast query
  // to avoid thousands of individual async SQL queries over the native bridge
  const existingMap = new Map();
  if (newerOnly) {
    const existingRows = await db.getAllAsync(
      'SELECT record_key, time_stamp FROM replica_records WHERE collection = ?',
      collection
    );
    for (const r of existingRows) {
      existingMap.set(r.record_key, Number(r.time_stamp || 0));
    }
  }

  await db.withTransactionAsync(async () => {
    for (const [fallbackKey, rawRecord] of entries) {
      const key = recordKey(collection, rawRecord, fallbackKey);
      if (!key) continue;
      const record = { ...rawRecord };
      const incomingTs = recordTimestamp(record);

      if (newerOnly && existingMap.has(key)) {
        const existingTs = existingMap.get(key);
        if (existingTs > 0 && incomingTs > 0 && incomingTs <= existingTs) continue;
      }

      await db.runAsync(
        `INSERT OR REPLACE INTO replica_records
          (collection, record_key, record_id, pb_id, time_stamp, payload)
         VALUES (?, ?, ?, ?, ?, ?)`,
        collection,
        key,
        recordId(record),
        recordPbId(record),
        incomingTs,
        JSON.stringify(record)
      );
      existingMap.set(key, incomingTs);
      written += 1;
    }
  });
  return written;
}

export async function sqliteReplaceSheet(collection, data) {
  const db = await ensureNativeDatabase();
  if (!db) return 0;
  const entries = normalizeEntries(collection, data)
    .filter(([, record]) => record && typeof record === 'object');
  let written = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM replica_records WHERE collection = ?', collection);
    for (const [fallbackKey, rawRecord] of entries) {
      const key = recordKey(collection, rawRecord, fallbackKey);
      if (!key) continue;
      const record = { ...rawRecord };
      await tx.runAsync(
        `INSERT OR REPLACE INTO replica_records
          (collection, record_key, record_id, pb_id, time_stamp, payload)
         VALUES (?, ?, ?, ?, ?, ?)`,
        collection,
        key,
        recordId(record),
        recordPbId(record),
        recordTimestamp(record),
        JSON.stringify(record)
      );
      written += 1;
    }
  });
  return written;
}

export async function sqliteDeleteMany(collection, keys) {
  const db = await ensureNativeDatabase();
  if (!db) return 0;
  const wanted = new Set((Array.isArray(keys) ? keys : [keys]).filter((key) => key != null).map(asString));
  if (!wanted.size) return 0;
  // All delete identities are indexed columns. Do not read/parse every payload
  // in ORDERS or SHIPMENTS just to resolve an event id.
  const placeholders = Array.from(wanted, () => '?').join(', ');
  const args = [collection, ...wanted, ...wanted, ...wanted];
  const result = await db.runAsync(
    `DELETE FROM replica_records
       WHERE collection = ?
         AND (record_key IN (${placeholders})
           OR record_id IN (${placeholders})
           OR pb_id IN (${placeholders}))`,
    ...args
  );
  return Number(result?.changes || 0);
}

export async function sqliteClearReplica() {
  const db = await ensureNativeDatabase();
  if (db) {
    await db.execAsync('DELETE FROM replica_records; DELETE FROM replica_meta;');
  }
  // Remove the legacy representation and sync metadata too, if an upgrade
  // was interrupted or the app was previously running without SQLite.
  const keys = await AsyncStorage.getAllKeys();
  const legacy = keys.filter((key) =>
    key.startsWith('sheet_') ||
    key.startsWith('meta_') ||
    key === 'last_sync_time' ||
    key === 'last_event_stamp'
  );
  if (legacy.length) await AsyncStorage.multiRemove(legacy);
}
