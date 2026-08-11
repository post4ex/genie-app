import { API_BASE, SHEETS } from './config';
import { getSheet, setSheet, getMetadata } from './storage';

const RECONCILE_COLLECTIONS = SHEETS.filter(
  (collection) => !['NOTIFICATIONS'].includes(collection)
);

export async function auditAndReconcile(token) {
  if (!token) return { ok: false, mismatches: [] };
  try {
    const countResponse = await fetch(`${API_BASE}/api/sync/counts`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!countResponse.ok) throw new Error(`count audit HTTP ${countResponse.status}`);
    const countJson = await countResponse.json();
    const serverCounts = countJson?.counts || {};
    // A count endpoint is safe for diagnostics, but repair requires a
    // server-provided window-aware snapshot. Until that contract exists, never
    // replace a deliberately partial local cache with all historical rows.
    if (countJson?.reconcile_ready !== true) {
      return { ok: true, skipped: true, mismatches: [], counts: serverCounts };
    }
    const serverFlags = countJson?.flags || {};
    const requiredLayers = ['current_fy'];
    for (const [name, value] of Object.entries(serverFlags)) {
      if (name.startsWith('bg_') && name.endsWith('_done') && value !== 'n/a') {
        requiredLayers.push(name.slice(3, -5));
      }
    }
    const completedLayers = [];
    for (const layer of requiredLayers) {
      if ((await getMetadata(`sync_layer_${layer}`)) === '1') completedLayers.push(layer);
    }
    // Counts represent the complete server cache. Do not compare them while
    // the client intentionally has only its current-FY/active-layer subset.
    if (completedLayers.length !== requiredLayers.length) {
      return { ok: true, skipped: true, mismatches: [] };
    }
    const mismatches = [];

    for (const collection of RECONCILE_COLLECTIONS) {
      if (!(collection in serverCounts)) continue;
      const local = await getSheet(collection);
      const localCount = Object.keys(local || {}).length;
      const serverCount = Number(serverCounts[collection] || 0);
      if (localCount !== serverCount) mismatches.push(collection);
    }

    for (const collection of mismatches) {
      const response = await fetch(
        `${API_BASE}/api/getData?collection=${encodeURIComponent(collection)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`reconcile ${collection} HTTP ${response.status}`);
      const json = await response.json();
      if (json?.status === 'success' && json.data) {
        // setSheet replaces the collection, so stale local records are removed
        // as well as missing records being restored.
        await setSheet(collection, json.data);
      }
    }

    return { ok: true, mismatches };
  } catch (error) {
    console.warn('[Sync] local parity audit failed:', error.message);
    return { ok: false, mismatches: [] };
  }
}
