// ============================================================================
// APP-API.JS — Network, Data Engine & Date Utilities
// ============================================================================

async function fetchClientIP() {
    // IP detection removed — was calling external api.ipify.org but value was never used
}

const MUTATING_ENDPOINTS = [
    // kept for reference only — SSE broadcasts replace post-write sync
    '/api/bookOrder', '/api/updateOrder',
    '/api/writeB2B', '/api/deleteB2B', '/api/writeRateList', '/api/deleteRateList',
    '/api/writeB2B2C', '/api/updateB2B2C', '/api/deleteB2B2C',
    '/api/writeStaff', '/api/deleteStaff',
    '/api/writeBranch', '/api/deleteBranch',
    '/api/writeCarrier', '/api/deleteCarrier',
    '/api/writeMode', '/api/deleteMode',
    '/api/uploadOrders', '/api/editUpload', '/api/deleteOrder', '/api/closeInvoice',
];

async function callApi(endpoint, payload = {}, method = 'POST', timeoutMs = 30000) {
    const token = getSessionId();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const options = { method, headers, signal: controller.signal };
    if (method !== 'GET') options.body = JSON.stringify(payload);

    const base = CONSTANTS.OPERATIONS_URL;
    if (!endpoint.startsWith('/api/')) throw new Error('Invalid endpoint');
    const safeEndpoint = endpoint;
    
    try {
        const res = await fetch(`${base}${safeEndpoint}`, options);
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('[API] Expected JSON but got:', text.substring(0, 150));
            throw new Error('Invalid Server Response (Not JSON)');
        }

        const json = await res.json();
        if (json.status === 'error') {
            if (json.message.includes('Session expired')) {
                console.warn('[API] Session Expired. Logging out.');
                handleLogout();
            }
            throw new Error(json.message);
        }

        return json;
    } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            throw new Error('Request Timeout');
        }
        throw e;
    }
}

// --- DATE UTILITIES ---
// Formatting is handled by core/formatIST.js — fmtDate() and fromIST() are global.

// --- DATA ENGINE ---

window._syncInProgress = false;
window._sseBuffer      = [];

async function _applyDelta({ collection, action, key, data, id }) {
    if (!window.appDB || !window.appDB.db) return;
    const deltaMap = {};

    if (action === 'upsert') {
        deltaMap[collection] = { [key]: data };
    } else if (action === 'delete') {
        // Resolve deletes — try key first, fall back to UUID (id) via secondary index
        const deletes = [key];
        if (id && id !== key) {
            const rec = await window.appDB.getByPbId(collection, id);
            if (rec) {
                const keyPath = window.appDB.sheetKeys[collection] || 'id';
                if (!deletes.includes(rec[keyPath])) deletes.push(rec[keyPath]);
            }
        }
        deltaMap[collection] = { __deletes: deletes };

        // Cascaded deletes for ORDERS — remove child records (boxes, docs, uploads)
        if (collection === 'ORDERS') {
            const ref = key;
            for (const childCol of ['MULTIBOX', 'PRODUCTS', 'UPLOADS']) {
                try {
                    const childKeyPath = window.appDB.sheetKeys[childCol] || 'id';
                    const allChildren = await window.appDB.getSheet(childCol);
                    const childDeletes = Object.values(allChildren)
                        .filter(r => r.REFERENCE === ref)
                        .map(r => r[childKeyPath]);
                    if (childDeletes.length > 0) {
                        deltaMap[childCol] = { __deletes: childDeletes };
                    }
                } catch (_) {}
            }
        }
    }

    await window.appDB.bulkMerge(deltaMap);
}
window._applyDelta = _applyDelta;

async function pullDeltaSince(since_ms, retryCount) {
    if (retryCount === undefined) retryCount = 0;
    if (since_ms === null || since_ms === undefined || !isLoggedIn() || !window.appDB || !window.appDB.db) {
        console.log('[pullDeltaSince] skipped — since_ms:', since_ms, 'loggedIn:', isLoggedIn());
        return;
    }
    if (window._syncInProgress) {
        console.log('[pullDeltaSince] skipped — full sync in progress');
        return;
    }
    if (since_ms === 0) {
        console.log('[pullDeltaSince] skipped — since_ms=0, full sync will cover this');
        return;
    }
    console.log('[pullDeltaSince] since_ms:', since_ms, 'retry:', retryCount);
    try {
        const result = await callApi(`/api/fetchEvents?since_ms=${since_ms}`, {}, 'GET');
        if (result.status !== 'success') return;
        const events = result.data || [];
        console.log('[pullDeltaSince] fetchEvents returned', events.length, 'events');
        if (!events.length) { window._lastDeltaSync = Date.now(); return; }

        // Split into upserts and deletes
        const upserts = {}, deletes = {};
        for (const ev of events) {
            const { COLLECTION: col, ACTION: action, PB_ID: pb_id } = ev;
            if (!col || !pb_id) continue;
            if (action === 'create' || action === 'update') {
                (upserts[col] = upserts[col] || []).push(pb_id);
            } else if (action === 'delete') {
                (deletes[col] = deletes[col] || []).push(pb_id);
            }
        }
        console.log('[pullDeltaSince] upserts:', Object.keys(upserts), 'deletes:', Object.keys(deletes));

        const deltaMap = {};
        let hasNewData = false;

        // Upserts — all collections in parallel, then batch into deltaMap
        if (Object.keys(upserts).length) {
            const entries = Object.entries(upserts);
            const results = await Promise.all(
                entries.map(([col, ids]) => callApi('/api/getRecords', { collection: col, ids }, 'POST').catch(e => { console.warn('[pullDeltaSince] getRecords failed for', col, e.message); return null; }))
            );
            for (let i = 0; i < entries.length; i++) {
                const [col] = entries[i];
                const res = results[i];
                if (!res || !res.data) continue;
                const n = Object.keys(res.data).length;
                console.log('[pullDeltaSince] getRecords', col, ':', n, 'records merged');
                if (n > 0) {
                    deltaMap[col] = { ...(deltaMap[col] || {}), ...res.data };
                    hasNewData = true;
                }
            }
        }

        // Deletes — batch into deltaMap with __deletes
        for (const [col, pb_ids] of Object.entries(deletes)) {
            const keyPath = window.appDB.sheetKeys[col] || 'id';
            if (!deltaMap[col]) deltaMap[col] = {};
            if (!deltaMap[col].__deletes) deltaMap[col].__deletes = [];

            for (const pb_id of pb_ids) {
                if (keyPath === 'id') {
                    deltaMap[col].__deletes.push(pb_id);
                } else {
                    const rec = await window.appDB.getByPbId(col, pb_id);
                    if (rec) deltaMap[col].__deletes.push(rec[keyPath]);
                    else deltaMap[col].__deletes.push(pb_id); // best effort
                }
                hasNewData = true;
            }

            // Cascaded deletes for ORDERS
            if (col === 'ORDERS') {
                for (const pb_id of pb_ids) {
                    const rec = await window.appDB.getByPbId('ORDERS', pb_id);
                    if (!rec) continue;
                    const ref = rec.REFERENCE;
                    if (!ref) continue;
                    for (const childCol of ['MULTIBOX', 'PRODUCTS', 'UPLOADS']) {
                        try {
                            const childKeyPath = window.appDB.sheetKeys[childCol] || 'id';
                            const allChildren = await window.appDB.getSheet(childCol);
                            const childDeletes = Object.values(allChildren)
                                .filter(r => r.REFERENCE === ref)
                                .map(r => r[childKeyPath]);
                            if (childDeletes.length > 0) {
                                if (!deltaMap[childCol]) deltaMap[childCol] = { __deletes: [] };
                                else if (!deltaMap[childCol].__deletes) deltaMap[childCol].__deletes = [];
                                deltaMap[childCol].__deletes.push(...childDeletes);
                            }
                        } catch (_) {}
                    }
                }
            }
        }

        // Batch everything into atomic bulkMerge
        if (Object.keys(deltaMap).length) {
            await window.appDB.bulkMerge(deltaMap);
        }

        window._lastDeltaSync = Date.now();
        const maxTs = Math.max(...events.map(e => Number(e.TIME_STAMP) || 0));
        if (maxTs > 0) await window.appDB.setMetadata('lastEventStamp', maxTs).catch(() => {});
        if (hasNewData) _scheduleRefresh();
    } catch (e) {
        console.warn('[pullDeltaSince] error:', e.message);
        // Exponential backoff: min(30s, 2^retry * 1s + jitter)
        if (retryCount < 5) {
            const delay = Math.min(30000, Math.pow(2, retryCount) * 1000 + Math.random() * 1000);
            console.log('[pullDeltaSince] retrying in', Math.round(delay), 'ms (attempt', retryCount + 1, '/ 5)');
            await new Promise(r => setTimeout(r, delay));
            return pullDeltaSince(since_ms, retryCount + 1);
        } else {
            console.error('[pullDeltaSince] all 5 retries exhausted — sync stalled');
            _showRetryBanner('Sync Stalled — tap to retry');
        }
    }
}

function _showRetryBanner(msg) {
    document.getElementById('sync-retry-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'sync-retry-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#7f1d1d;color:#fff;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px;font-size:13px;font-family:sans-serif;';
    banner.innerHTML = `<span>❌ ${msg}</span><button style="padding:4px 12px;background:#fff;color:#7f1d1d;border:none;border-radius:4px;font-weight:600;cursor:pointer;">Retry</button>`;
    banner.querySelector('button').addEventListener('click', () => {
        banner.remove();
        verifyAndFetchAppData();
    });
    document.body.appendChild(banner);
}

async function getCompletedLayersFromIDB() {
    if (!window.appDB) return [];
    try {
        const metadata = await window.appDB.getAllMetadata();
        const completed = [];
        for (const item of metadata) {
            if (item.key.startsWith('bg_') && item.key.endsWith('_done') && item.value === true) {
                const layer = item.key.replace(/^bg_/, '').replace(/_done$/, '');
                completed.push(layer);
            }
        }
        return completed;
    } catch (e) {
        return [];
    }
}

async function verifyAndFetchAppData(clearAll = false) {
    console.log('[verifyAndFetchAppData] called, clearAll:', clearAll);
    if (!isLoggedIn()) return;

    if (!window.appDB) {
        console.warn('[Data Engine] IndexedDB not available');
        showNotification('⚠️ Using localStorage fallback - Limited offline storage', 'info');
        return;
    }

    if (!window.appDB.db) {
        try {
            await window.appDB.init();
        } catch (error) {
            showNotification(`⚠️ Failed to initialize database: ${error.message}`, 'error');
            return;
        }
    }

    if (clearAll) {
        try {
            await window.appDB.clearAll();
        } catch (e) {
            console.warn('[Data Engine] Failed to clear DB:', e);
        }
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const completed_layers = await getCompletedLayersFromIDB();
        window._syncInProgress = true;
        navigator.serviceWorker.controller.postMessage({
            type: 'start_sync',
            completed_layers,
            token: getSessionId(),
            base: CONSTANTS.OPERATIONS_URL
        });
    } else {
        console.warn('[Data Engine] Service Worker controller not active yet. Retrying in 500ms...');
        setTimeout(() => verifyAndFetchAppData(clearAll), 500);
    }
}

let _lastStreamRefreshTime = 0;
let _streamRefreshTimeout = null;

function _scheduleStreamRefresh() {
    const now = Date.now();
    const throttleLimit = 1000; // Limit UI updates to once per 1 second
    
    if (_streamRefreshTimeout) return;
    
    const timeSinceLast = now - _lastStreamRefreshTime;
    if (timeSinceLast >= throttleLimit) {
        _lastStreamRefreshTime = now;
        if (typeof _scheduleRefresh === 'function') _scheduleRefresh();
    } else {
        _streamRefreshTimeout = setTimeout(() => {
            _streamRefreshTimeout = null;
            _lastStreamRefreshTime = Date.now();
            if (typeof _scheduleRefresh === 'function') _scheduleRefresh();
        }, throttleLimit - timeSinceLast);
    }
}

// fetchFile — fetch a private /api/file/... URL with auth and return a blob URL
// Use for <img src> and open-in-tab for private uploaded files
window.fetchFileUrl = async function (filePath) {
    const base  = CONSTANTS.OPERATIONS_URL;
    const token = getSessionId();
    const url   = filePath.startsWith('http') ? filePath : `${base}${filePath}`;
    const res   = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`File fetch failed: ${res.status}`);
    const blob  = await res.blob();
    return URL.createObjectURL(blob);
};

// deleteUploadRecord — shared handler for upload delete buttons on any page
// Requires MANAGER role (enforced server-side; button hidden client-side for lower roles)
window.deleteUploadRecord = async function (uploadUid, btnEl) {
    if (!confirm('Delete this upload? This will permanently remove the file.')) return;
    if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '0.4'; }
    try {
        await callApi(`/api/upload/${uploadUid}`, {}, 'DELETE');
        showNotification('\u2705 Upload deleted', 'success');
        const row = btnEl?.closest('tr') || btnEl?.closest('.p-3');
        if (row) row.remove();
    } catch (err) {
        showNotification(`\u274c Delete failed: ${err.message}`, 'error');
        if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = ''; }
    }
};

// trackShipment — shipment from IDB, movements from app cache
window.trackShipment = async function (ref) {
    const shipment = (await window.appDB?.getSheet('SHIPMENTS') || {})[ref];
    if (shipment) {
        // shipment already in IDB — just fetch movements from app cache
        const json = await callApi(`/api/movements?ref=${encodeURIComponent(ref)}`, {}, 'GET');
        const normShipment = Object.fromEntries(
            Object.entries(shipment).map(([k, v]) => [k.toLowerCase(), v])
        );
        return { shipment: normShipment, movements: json.movements };
    }
    // fallback — shipment not in IDB yet, get both from app cache via API
    const json = await callApi(`/api/movements?ref=${encodeURIComponent(ref)}`, {}, 'GET');
    if (json.status === 'error') throw new Error(json.message || 'Tracking failed');
    if (json.shipment) {
        json.shipment = Object.fromEntries(
            Object.entries(json.shipment).map(([k, v]) => [k.toLowerCase(), v])
        );
    }
    return json;  // {shipment, movements}
};

// trackShipmentLive — force live scrape via track service
window.trackShipmentLive = async function (ref) {
    const base  = CONSTANTS.OPERATIONS_URL;
    const token = getSessionId();
    const res   = await fetch(`${base}/api/track?ref=${encodeURIComponent(ref)}&live=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') throw new Error(json.message || json.detail || 'Tracking failed');
    if (json.shipment) {
        json.shipment = Object.fromEntries(
            Object.entries(json.shipment).map(([k, v]) => [k.toLowerCase(), v])
        );
    }
    return json;  // {shipment, movements}
};

async function fetchBusinessYearData(fyYear = null) {
    if (!window.appDB || !window.appDB.db) return;
    try {
        const payload = fyYear !== null ? { fy_year: fyYear } : {};
        const result  = await callApi('/api/fetchBusinessYear', payload);

        if (result.status === 'already_synced' || result.status === 'error') {
            showNotification('ℹ️ Data already synced for this period', 'info');
            return;
        }

        const incomingData = result.data || {};
        for (const [sheetName, sheetData] of Object.entries(incomingData)) {
            if (Object.keys(sheetData).length > 0)
                await window.appDB.putSheet(sheetName, sheetData);
        }

        // update sync boundary to include business year data
        if (result.from_ms && window.appDB)
            await window.appDB.setMetadata('syncFromMs', result.from_ms).catch(() => {});

        const fullData = await getAppData();
        window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
        showNotification(`✅ ${result.fy_label} loaded`, 'success', 2000);
    } catch (error) {
        showNotification(`❌ Failed to load business year: ${error.message}`, 'error');
    }
}

async function getAppData(sheetName = null) {
    if (!window.appDB || !window.appDB.db) {
        console.warn('IndexedDB not available');
        return null;
    }

    try {
        if (sheetName) return await window.appDB.getSheet(sheetName);

        const sheets = ['ORDERS', 'B2B', 'B2B2C', 'RATES', 'STAFF', 'ATTENDANCE', 'BRANCHES', 'MODES', 'CARRIERS', 'MULTIBOX', 'PRODUCTS', 'UPLOADS', 'HOLIDAYS', 'LEDGER', 'SHIPMENTS', 'HEADER'];
        const result  = {};
        const results = await Promise.all(sheets.map(s => window.appDB.getSheet(s).catch(() => ({}))));
        sheets.forEach((s, i) => result[s] = results[i]);
        return result;
    } catch (error) {
        console.error('Failed to get app data:', error);
        return null;
    }
}
