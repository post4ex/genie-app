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
  return asString(record?.[keyField] ?? record?.REFERENCE ?? record?.id ?? record?.PB_ID ?? fallback);
};

const recordId = (record) => asString(record?.id ?? record?.PB_ID);
const recordTimestamp = (record) => {
  const value = Number(record?.TIME_STAMP ?? record?.time_stamp ?? 0);
  return Number.isFinite(value) ? value : 0;
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
    CREATE INDEX IF NOT EXISTS idx_replica_collection ON replica_records(collection);
    CREATE INDEX IF NOT EXISTS idx_replica_record_id ON replica_records(collection, record_id);
    CREATE INDEX IF NOT EXISTS idx_replica_pb_id ON replica_records(collection, pb_id);
    CREATE INDEX IF NOT EXISTS idx_replica_timestamp ON replica_records(collection, time_stamp);
    CREATE TABLE IF NOT EXISTS replica_meta (
      name TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return db;
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
        ? parsed.map((record) => [recordKey(collection, record), record])
        : Object.entries(parsed || {});
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

export async function initializeLocalDatabase() {
  if (!isNativeSQLite()) return false;
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const db = await nativeInitialize();
      await migrateLegacyAsyncStorage(db);
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
  const result = {};
  for (const collection of collections) {
    const row = await db.getFirstAsync(
      'SELECT COUNT(*) AS count FROM replica_records WHERE collection = ?',
      collection
    );
    result[collection] = Number(row?.count || 0);
  }
  return result;
}

export async function sqliteUpsertMany(collection, data, newerOnly = false, suppliedDb = null) {
  const db = suppliedDb || await ensureNativeDatabase();
  if (!db) return 0;
  const entries = normalizeEntries(collection, data).filter(([, record]) => record && typeof record === 'object');
  if (!entries.length) return 0;
  let written = 0;
  await db.withTransactionAsync(async () => {
    for (const [fallbackKey, rawRecord] of entries) {
      const key = recordKey(collection, rawRecord, fallbackKey);
      if (!key) continue;
      const record = { ...rawRecord };
      const incomingTs = recordTimestamp(record);
      if (newerOnly) {
        const existing = await db.getFirstAsync(
          'SELECT time_stamp FROM replica_records WHERE collection = ? AND record_key = ?',
          collection,
          key
        );
        const existingTs = Number(existing?.time_stamp || 0);
        if (existingTs && incomingTs && incomingTs <= existingTs) continue;
      }
      await db.runAsync(
        `INSERT OR REPLACE INTO replica_records
          (collection, record_key, record_id, pb_id, time_stamp, payload)
         VALUES (?, ?, ?, ?, ?, ?)`,
        collection,
        key,
        asString(record?.id),
        asString(record?.PB_ID),
        incomingTs,
        JSON.stringify(record)
      );
      written += 1;
    }
  });
  return written;
}

export async function sqliteReplaceSheet(collection, data) {
  const db = await ensureNativeDatabase();
  if (!db) return 0;
  await db.runAsync('DELETE FROM replica_records WHERE collection = ?', collection);
  return sqliteUpsertMany(collection, data, false, db);
}

export async function sqliteDeleteMany(collection, keys) {
  const db = await ensureNativeDatabase();
  if (!db) return 0;
  const wanted = new Set((Array.isArray(keys) ? keys : [keys]).filter((key) => key != null).map(asString));
  if (!wanted.size) return 0;
  const rows = await db.getAllAsync(
    'SELECT record_key, record_id, pb_id, payload FROM replica_records WHERE collection = ?',
    collection
  );
  const keyField = SHEET_KEYS[collection] || 'id';
  const deleteKeys = [];
  for (const row of rows) {
    const record = parsePayload(row.payload);
    const candidates = [
      row.record_key,
      row.record_id,
      row.pb_id,
      record.id,
      record.PB_ID,
      record[keyField],
      record.REFERENCE,
    ].filter((value) => value != null).map(asString);
    if (candidates.some((candidate) => wanted.has(candidate))) deleteKeys.push(row.record_key);
  }
  if (!deleteKeys.length) return 0;
  await db.withTransactionAsync(async () => {
    for (const key of deleteKeys) {
      await db.runAsync(
        'DELETE FROM replica_records WHERE collection = ? AND record_key = ?',
        collection,
        key
      );
    }
  });
  return deleteKeys.length;
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
