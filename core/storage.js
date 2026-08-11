import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHEETS } from './config';
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

export const initializeStorage = async () => {
  if (useSQLite()) await initializeLocalDatabase();
};

export const saveSession = async (user, token, expires = 0) => {
  try {
    await AsyncStorage.setItem('user_session', JSON.stringify({ user, token, expires }));
  } catch (e) {
    console.warn('[Storage] saveSession error:', e.message);
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
    if (ownerId) await AsyncStorage.setItem('local_cache_owner', String(ownerId));
  } catch (_) {}
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
  } catch (e) {
    console.warn('[Storage] clearLocalReplica error:', e.message);
  }
};

export const putSheet = async (sheetName, data) => {
  try {
    if (useSQLite()) {
      await sqliteUpsertMany(sheetName, data, false);
      return;
    }
    const current = await getSheet(sheetName);
    const merged = { ...current, ...data };
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
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`[Storage] setSheet error for ${sheetName}:`, e.message);
  }
};

export const getSheet = async (sheetName) => {
  try {
    if (useSQLite()) return await sqliteGetSheet(sheetName);
    const val = await AsyncStorage.getItem(`sheet_${sheetName}`);
    return val ? JSON.parse(val) : {};
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
  try {
    await AsyncStorage.setItem('last_event_stamp', String(timestamp));
  } catch (e) {}
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
  const inTs = Number(incoming?.TIME_STAMP);
  const exTs = Number(existing?.TIME_STAMP);
  if (!inTs || !exTs) return true;
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
    for (const [key, record] of Object.entries(data || {})) {
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
    const list = Array.isArray(keys) ? keys : [keys];
    const next = { ...current };
    for (const key of list) delete next[key];
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(next));
  } catch (e) {
    console.warn(`[Storage] deleteFromSheet error for ${sheetName}:`, e.message);
  }
};
