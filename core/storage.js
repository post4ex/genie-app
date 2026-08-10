import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHEETS } from './config';

export const saveSession = async (user, token, expires = 0) => {
  try {
    await AsyncStorage.setItem('user_session', JSON.stringify({ user, token, expires }));
  } catch (e) {
    console.warn('[Storage] saveSession error:', e.message);
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

export const removeSession = async () => {
  try {
    await AsyncStorage.removeItem('user_session');
    await AsyncStorage.removeItem('last_sync_time');
    await AsyncStorage.removeItem('last_event_stamp');
    // sync-layer flags + other meta keys
    for (const key of Object.keys(await AsyncStorage.getAllKeys())) {
      if (key.startsWith('meta_')) await AsyncStorage.removeItem(key);
    }
    for (const sheet of SHEETS) {
      await AsyncStorage.removeItem(`sheet_${sheet}`);
    }
  } catch (e) {
    console.warn('[Storage] removeSession error:', e.message);
  }
};

export const putSheet = async (sheetName, data) => {
  try {
    const current = await getSheet(sheetName);
    const merged = { ...current, ...data };
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(merged));
  } catch (e) {
    console.warn(`[Storage] putSheet error for ${sheetName}:`, e.message);
  }
};

export const setSheet = async (sheetName, data) => {
  try {
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`[Storage] setSheet error for ${sheetName}:`, e.message);
  }
};

export const getSheet = async (sheetName) => {
  try {
    const val = await AsyncStorage.getItem(`sheet_${sheetName}`);
    return val ? JSON.parse(val) : {};
  } catch (e) {
    return {};
  }
};

export const getAppData = async () => {
  const result = {};
  for (const sheet of SHEETS) {
    result[sheet] = await getSheet(sheet);
  }
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
    await AsyncStorage.setItem('last_sync_time', timestamp.toString());
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
    await AsyncStorage.setItem('last_event_stamp', timestamp.toString());
  } catch (e) {}
};

// ── Generic metadata (web IndexedDB _metadata store parity) ────────────────
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

// ── Zombie Shield (web indexeddb.js _checkAndPut parity) ────────────────────
// Merge records into a sheet, but only overwrite an existing record when the
// incoming TIME_STAMP is strictly newer. Prevents stale sync data from clobber-
// ing fresher SSE/delta writes. Records without TIME_STAMP always pass through.
const _isNewer = (incoming, existing) => {
  if (!existing) return true;
  const inTs = Number(incoming?.TIME_STAMP);
  const exTs = Number(existing?.TIME_STAMP);
  if (!inTs || !exTs) return true;   // missing timestamps — can't compare, write
  return inTs > exTs;
};

export const putSheetNewer = async (sheetName, data) => {
  try {
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

// Remove a record from a sheet by its unique key (web bulkMerge __deletes parity).
export const deleteFromSheet = async (sheetName, keys) => {
  try {
    const current = await getSheet(sheetName);
    const list = Array.isArray(keys) ? keys : [keys];
    const next = { ...current };
    for (const k of list) delete next[k];
    await AsyncStorage.setItem(`sheet_${sheetName}`, JSON.stringify(next));
  } catch (e) {
    console.warn(`[Storage] deleteFromSheet error for ${sheetName}:`, e.message);
  }
};
