import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, SHEET_KEYS } from './config';
import {
  putSheetNewer, deleteFromSheet, getSheet, setLastSyncTime,
  setLastEventStamp, getMetadata, setMetadata
} from './storage';

// ── Completed-layers tracking (web sw.js bg_<layer>_done parity) ────────────
export async function getCompletedLayers() {
  const layers = [];
  try {
    const keys = await AsyncStorage.getAllKeys();
    for (const k of keys || []) {
      const m = /^meta_sync_layer_(.+)$/.exec(k);
      if (m) layers.push(m[1]);
    }
  } catch (e) {
    console.warn('[Sync] getCompletedLayers error:', e.message);
  }
  return layers;
}

// ── Streaming full sync (web sw.js runStreamSync parity) ────────────────────
// POST /api/sync/stream → NDJSON lines: meta / data / layer_done.
// Batches 100 records → timestamp-guarded merge; marks each completed layer.
let _streamInProgress = false;

export async function streamSync(token, completedLayers = [], onProgress = null) {
  if (!token) return null;
  if (_streamInProgress) return -1; // already running — distinct from failure
  _streamInProgress = true;
  // Stall watchdog: if the stream produces no bytes for 60s, abort it so a hung
  // connection can never hold syncInProgressRef/_streamInProgress forever (which
  // would otherwise buffer all SSE deltas and gate catch-ups indefinitely).
  const controller = new AbortController();
  let lastDataAt = Date.now();
  const stallTimer = setInterval(() => {
    if (Date.now() - lastDataAt > 60000) controller.abort();
  }, 10000);
  try {
    const res = await fetch(`${API_BASE}/api/sync/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ completed_layers: completedLayers }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Stream HTTP ${res.status}`);
    if (!res.body || typeof res.body.getReader !== 'function') {
      throw new Error('ReadableStream not supported'); // native RN → caller falls back
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let recordCount = 0;
    let batchMap = {};
    let bufferedCount = 0;

    const flushBatch = async () => {
      if (bufferedCount === 0) return;
      for (const [col, records] of Object.entries(batchMap)) {
        await putSheetNewer(col, records);
      }
      batchMap = {};
      bufferedCount = 0;
      if (onProgress) onProgress(recordCount);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastDataAt = Date.now();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk;
        try { chunk = JSON.parse(line); } catch (_) { continue; }

        if (chunk.type === 'meta') {
          if (chunk.flags) await setMetadata('syncFlags', JSON.stringify(chunk.flags));
        } else if (chunk.type === 'data') {
          const col = chunk.sheet;
          const rec = chunk.record;
          if (!col || !rec) continue;
          const keyPath = SHEET_KEYS[col] || 'id';
          const key = rec[keyPath] || rec.id || rec.PB_ID || Math.random().toString(36).substring(2);
          if (!batchMap[col]) batchMap[col] = {};
          batchMap[col][key] = rec;
          bufferedCount++;
          recordCount++;
          if (bufferedCount >= 100) await flushBatch();
        } else if (chunk.type === 'layer_done') {
          await flushBatch();
          if (chunk.layer) await setMetadata(`sync_layer_${chunk.layer}`, '1');
        }
      }
    }

    await flushBatch();
    await setLastSyncTime(Date.now());
    return recordCount;
  } catch (e) {
    console.warn('[Sync] streamSync failed:', e.message);
    return null;
  } finally {
    clearInterval(stallTimer);
    _streamInProgress = false;
  }
}

// ── Full sync: streaming first (web path), JSON snapshot as fallback ────────
export async function fullSync(token) {
  if (!token) return null;
  const completed = await getCompletedLayers();
  const streamed = await streamSync(token, completed);
  if (streamed !== null && streamed !== -1) return streamed;
  if (streamed === -1) return null; // a stream is already running — don't double-sync

  // Fallback — legacy snapshot endpoint (used when stream is unavailable)
  try {
    const res = await fetch(`${API_BASE}/api/verifyAndFetchAppData`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      // Omit since_ms: FastAPI treats any supplied since_ms as DELTA mode.
      // An empty body is the true FULL snapshot request.
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      for (const [sheetName, sheetData] of Object.entries(json.data)) {
        if (sheetData && typeof sheetData === 'object') {
          await putSheetNewer(sheetName, sheetData);
        }
      }
      await setLastSyncTime(json.syncTimestamp || Date.now());
      return json.data;
    }
  } catch (e) {
    console.warn('[Sync] Full sync fallback error:', e.message);
  }
  return null;
}

// ── Business-year layers (web fetchBusinessYearData parity) ─────────────────
// Skips layers already marked complete (web completed_layers). Uses guarded
// merges so a slow layer never clobbers fresher SSE deltas.
export async function fetchAllBusinessLayers(token, onUpdate) {
  if (!token) return;
  const layers = ['t1', 't2', 't3', 'last_fy', '2nd_fy', '3rd_fy', '4th_fy', '5th_fy', '6th_fy'];
  const layerResults = {};
  const successfulLayers = [];

  await Promise.all(
    layers.map(async (layer) => {
      try {
        if ((await getMetadata(`sync_layer_${layer}`)) === '1') return; // already synced
        const res = await fetch(`${API_BASE}/api/fetchBusinessYear`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ layer })
        });
        const json = await res.json();
        if (json.status === 'success') {
          successfulLayers.push(layer); // web marks layer_done regardless of record count
          if (json.data) layerResults[layer] = json.data;
        }
      } catch (e) {
        console.warn(`[Sync] fetchBusinessYear ${layer} error:`, e.message);
      }
    })
  );

  const accumulatedData = {};
  for (const layerData of Object.values(layerResults)) {
    for (const [sheetName, sheetData] of Object.entries(layerData)) {
      if (sheetData && typeof sheetData === 'object') {
        accumulatedData[sheetName] = { ...(accumulatedData[sheetName] || {}), ...sheetData };
      }
    }
  }

  for (const [sheetName, sheetData] of Object.entries(accumulatedData)) {
    if (Object.keys(sheetData).length > 0) {
      await putSheetNewer(sheetName, sheetData);
    }
  }

  // Mark layers complete after their data has been merged (web layer_done parity)
  for (const layer of successfulLayers) {
    await setMetadata(`sync_layer_${layer}`, '1');
  }

  if (onUpdate) onUpdate();
}

// Resolve a PB_ID → actual sheet key (web appDB.getByPbId + keyPath parity).
function _resolveDeleteKeys(sheet, keyPath, pbIds) {
  const resolved = [];
  const entries = Object.entries(sheet);
  for (const pbId of pbIds) {
    // Direct hit (sheet keyed by the PB_ID)
    if (pbId in sheet) { resolved.push(pbId); continue; }
    // Secondary lookup via the record's id / PB_ID field
    const hit = entries.find(([, rec]) => [rec?.id, rec?.PB_ID]
      .filter((value) => value != null)
      .some((value) => String(value) === String(pbId)));
    if (hit) {
      resolved.push(keyPath !== 'id' ? (hit[1]?.[keyPath] || hit[0]) : hit[0]);
    } else {
      resolved.push(pbId); // best effort — web does the same for unknown keys
    }
  }
  return resolved;
}

// ── Delta catch-up (web app-api.js pullDeltaSince parity) ───────────────────
// fetchEvents → getRecords upserts (guarded merge) + resolved deletes, with
// cascaded ORDERS child deletes (MULTIBOX/PRODUCTS/UPLOADS) and retry backoff.
export async function pullDeltaSince(token, sinceMs, retryCount = 0) {
  if (!token || !sinceMs) return null;
  // 1-minute safety net overlap (60,000 ms) to catch in-flight boundary transactions
  const querySince = Math.max(0, sinceMs - 60000);
  try {
    const res = await fetch(`${API_BASE}/api/fetchEvents?since_ms=${querySince}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`fetchEvents ${res.status}`);
    const result = await res.json();
    if (result.status !== 'success' || !result.data || !result.data.length) return null;

    const events = result.data;
    const upserts = {};
    const deletes = {};

    for (const ev of events) {
      const { COLLECTION: col, ACTION: rawAction, PB_ID: pb_id } = ev;
      const action = String(rawAction || '').toLowerCase();
      if (!col || !pb_id) continue;
      if (action === 'create' || action === 'insert' || action === 'update') {
        (upserts[col] = upserts[col] || []).push(pb_id);
      } else if (action === 'delete' || action === 'remove') {
        (deletes[col] = deletes[col] || []).push(pb_id);
      }
    }

    // Upserts — normalized by keyPath + guarded merges. A failed group is a
    // failed catch-up: do not advance the cursor past it.
    if (Object.keys(upserts).length) {
      for (const [col, ids] of Object.entries(upserts)) {
        // FastAPI caps each getRecords request at 500 IDs. Chunking is required
        // so a large event burst cannot be silently dropped before the cursor
        // advances.
        for (let offset = 0; offset < ids.length; offset += 500) {
          const idBatch = ids.slice(offset, offset + 500);
          const recRes = await fetch(`${API_BASE}/api/getRecords`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
            body: JSON.stringify({ collection: col, ids: idBatch })
          });
          if (!recRes.ok) throw new Error(`getRecords ${col} HTTP ${recRes.status}`);
          const recJson = await recRes.json();
          if (recJson.status !== 'success' || !recJson.data) {
            throw new Error(`getRecords ${col} returned no success data`);
          }
          const keyPath = SHEET_KEYS[col] || 'id';
          const normalized = {};
          for (const [k, rec] of Object.entries(recJson.data)) {
            if (!rec || typeof rec !== 'object') continue;
            const key = rec[keyPath] || rec.id || rec.PB_ID || k;
            normalized[key] = rec;
          }
          if (Object.keys(normalized).length) await putSheetNewer(col, normalized);
        }
      }
    }

    // Deletes — PB_ID → key resolution + ORDERS cascade
    for (const [col, pbIds] of Object.entries(deletes)) {
      const keyPath = SHEET_KEYS[col] || 'id';
      const current = await getSheet(col);
      const resolved = _resolveDeleteKeys(current, keyPath, pbIds);
      if (resolved.length) await deleteFromSheet(col, resolved);

      if (col === 'ORDERS') {
        // Web parity: deleting an order removes its boxes/docs/products
        const refKeys = resolved;
        for (const childCol of ['MULTIBOX', 'PRODUCTS', 'UPLOADS']) {
          const child = await getSheet(childCol);
          const childDeletes = Object.entries(child)
            .filter(([, rec]) => refKeys.some(r => String(rec?.REFERENCE ?? '') === String(r)))
            .map(([k]) => k);
          if (childDeletes.length) await deleteFromSheet(childCol, childDeletes);
        }
      }
    }

    const maxTs = Math.max(...events.map(e => Number(e.TIME_STAMP) || 0));
    if (maxTs > 0) await setLastEventStamp(maxTs);
    await setLastSyncTime(Date.now());
    return true;
  } catch (e) {
    console.warn('[Sync] pullDeltaSince error:', e.message);
    // Web parity: retry with backoff (up to 5 attempts, min(30s, 2^n·1s + jitter))
    if (retryCount < 5) {
      const delay = Math.min(30000, Math.pow(2, retryCount) * 1000 + Math.random() * 1000);
      await new Promise(r => setTimeout(r, delay));
      return pullDeltaSince(token, sinceMs, retryCount + 1);
    }
  }
  return null;
}
