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
