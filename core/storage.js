import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHEETS, SHEET_KEYS } from './config';
import {
  isNativeSQLite,
  initializeLocalDatabase,
  sqliteGetSheet,
  sqliteUpsertMany,
  sqliteReplaceSheet,
  sqliteDeleteMany,
  sqliteClearReplica,
} from './sqlite-app';

const useSQLite = () => isNativeSQLite();
let eventStampWrite = Promise.resolve();

const asString = (value) => value == null ? '' : String(value);

// Keep the browser fallback byte-for-byte compatible with SQLite: every sheet
// is exposed as an object keyed by its configured business key, while id/PB_ID
// remain fields used for event deletes.
const canonicalEntries = (sheetName, data) => {
  const keyField = SHEET_KEYS[sheetName] || 'id';
  const entries = Array.isArray(data)
    ? data.map((record, index) => [String(index), record])
    : Object.entries(data || {});
  const result = {};
  for (const [fallback, raw] of entries) {
    if (!raw || typeof raw !== 'object') continue;
    const key = asString(raw[keyField] ?? raw.id ?? raw.PB_ID ?? fallback);
    if (key) result[key] = raw;
  }
  return result;
};

const findDeleteKeys = (sheetName, current, keys) => {
  const wanted = new Set((Array.isArray(keys) ? keys : [keys])
    .filter((key) => key != null).map(asString));
  const found = [];
  for (const [storedKey, record] of Object.entries(current || {})) {
    const candidates = [
      storedKey,
      record?.id,
      record?.PB_ID,
      record?.[SHEET_KEYS[sheetName] || 'id'],
      record?.REFERENCE,
    ].filter((value) => value != null).map(asString);
    if (candidates.some((candidate) => wanted.has(candidate))) found.push(storedKey);
  }
  return found;
};

export const initializeStorage = async () => {
  if (useSQLite()) await initializeLocalDatabase();
};

export const getAccountKey = (user) => {
  const value = user?.USER ?? user?.username ?? user?.id;
  return value == null || String(value).trim() === '' ? '' : String(value).trim();
};

export const saveSession = async (user, token, expires = 0, refreshToken = '', sessionExpiresAt = 0) => {
  try {
    await AsyncStorage.setItem('user_session', JSON.stringify({
      user,
      token,
      expires,
      refreshToken,
      sessionExpiresAt,
    }));
    return true;
  } catch (e) {
    console.warn('[Storage] saveSession error:', e.message);
    return false;
  }
};

export const getLocalCacheOwner = async () => {
  try {
    return await AsyncStorage.getItem('local_cache_owner');
  } catch (_) {
    return null;
  }
};

export const setLocalCacheOwner = async (ownerId) => {
  try {
    if (!ownerId) return false;
    await AsyncStorage.setItem('local_cache_owner', String(ownerId));
    return (await AsyncStorage.getItem('local_cache_owner')) === String(ownerId);
  } catch (_) {
    return false;
  }
};

export const getSession = async () => {
  try {
    const val = await AsyncStorage.getItem('user_session');
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return null;
  }
};

// Logout removes credentials only. The local replica and sync cursors are
// deliberately retained so the next login can render cached data immediately
// and resume from the last processed event.
export const removeSession = async () => {
  try {
    await AsyncStorage.removeItem('user_session');
  } catch (e) {
    console.warn('[Storage] removeSession error:', e.message);
  }
};

// Explicit destructive operation used only when a different user signs in or
// when the user deliberately requests a local-data reset.
export const clearLocalReplica = async () => {
  try {
    if (useSQLite()) {
      await sqliteClearReplica();
    } else {
      const keys = await AsyncStorage.getAllKeys();
      const removable = keys.filter((key) =>
        key.startsWith('sheet_') ||
        key === 'last_sync_time' ||
        key === 'last_event_stamp' ||
        key.startsWith('meta_')
      );
      if (removable.length) await AsyncStorage.multiRemove(removable);
    }
    await AsyncStorage.multiRemove(['last_sync_time', 'last_event_stamp', 'local_cache_owner']);
    return true;
  } catch (e) {
    console.warn('[Storage] clearLocalReplica error:', e.message);
    return false;
  }
};

export const putSheet = async (sheetName, data) => {
  try {
    if (useSQLite()) {
      await sqliteUpsertMany(sheetName, data, false);
      return;
    }
    const current = await getSheet(sheetName);
    const merged = { ...current, ...canonicalEntries(sheetName, data) };
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(merged));
  } catch (e) {
    console.warn(`[Storage] putSheet error for ${sheetName}:`, e.message);
  }
};

export const setSheet = async (sheetName, data) => {
  try {
    if (useSQLite()) {
      await sqliteReplaceSheet(sheetName, data);
      return;
    }
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(canonicalEntries(sheetName, data)));
  } catch (e) {
    console.warn(`[Storage] setSheet error for ${sheetName}:`, e.message);
  }
};

export const getSheet = async (sheetName) => {
  try {
    if (useSQLite()) return await sqliteGetSheet(sheetName);
    const val = await AsyncStorage.getItem(`sheet_${sheetName}`);
    return val ? canonicalEntries(sheetName, JSON.parse(val)) : {};
  } catch (e) {
    return {};
  }
};

export const getAppData = async () => {
  const result = {};
  for (const sheet of SHEETS) result[sheet] = await getSheet(sheet);
  return result;
};

export const getLastSyncTime = async () => {
  try {
    const val = await AsyncStorage.getItem('last_sync_time');
    return val ? parseInt(val, 10) : 0;
  } catch (e) {
    return 0;
  }
};

export const setLastSyncTime = async (timestamp) => {
  try {
    await AsyncStorage.setItem('last_sync_time', String(timestamp));
  } catch (e) {}
};

export const getLastEventStamp = async () => {
  try {
    const val = await AsyncStorage.getItem('last_event_stamp');
    return val ? parseInt(val, 10) : 0;
  } catch (e) {
    return 0;
  }
};

export const setLastEventStamp = async (timestamp) => {
  const incoming = Number(timestamp) || 0;
  eventStampWrite = eventStampWrite
    .catch(() => {})
    .then(async () => {
      if (!incoming) return;
      const current = Number(await getLastEventStamp()) || 0;
      if (incoming > current) {
        await AsyncStorage.setItem('last_event_stamp', String(incoming));
      }
    });
  return eventStampWrite;
};

// Generic metadata remains small and is intentionally kept in AsyncStorage.
export const getMetadata = async (key) => {
  try {
    const val = await AsyncStorage.getItem(`meta_${key}`);
    return val == null ? null : val;
  } catch (e) {
    return null;
  }
};

export const setMetadata = async (key, value) => {
  try {
    await AsyncStorage.setItem(`meta_${key}`, String(value));
  } catch (e) {}
};

const _isNewer = (incoming, existing) => {
  if (!existing) return true;
  const inTs = Number(incoming?.TIME_STAMP ?? incoming?.time_stamp ?? 0);
  const exTs = Number(existing?.TIME_STAMP ?? existing?.time_stamp ?? 0);
  if (!inTs) return false;
  if (!exTs) return true;
  return inTs > exTs;
};

export const putSheetNewer = async (sheetName, data) => {
  try {
    if (useSQLite()) {
      await sqliteUpsertMany(sheetName, data, true);
      return;
    }
    const current = await getSheet(sheetName);
    const merged = { ...current };
    for (const [key, record] of Object.entries(canonicalEntries(sheetName, data))) {
      if (record && typeof record === 'object' && _isNewer(record, current[key])) {
        merged[key] = record;
      }
    }
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(merged));
  } catch (e) {
    console.warn(`[Storage] putSheetNewer error for ${sheetName}:`, e.message);
  }
};

export const deleteFromSheet = async (sheetName, keys) => {
  try {
    if (useSQLite()) {
      await sqliteDeleteMany(sheetName, keys);
      return;
    }
    const current = await getSheet(sheetName);
    const next = { ...current };
    for (const key of findDeleteKeys(sheetName, current, keys)) delete next[key];
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(next));
  } catch (e) {
    console.warn(`[Storage] deleteFromSheet error for ${sheetName}:`, e.message);
  }
};
