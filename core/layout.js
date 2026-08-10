// ============================================================================
// LAYOUT.JS — Dispatcher / Orchestrator
// ============================================================================

// Add overlay class immediately — before DOMContentLoaded, before first paint
// CSS in style.css renders body::before/::after as the spinner overlay
document.documentElement.classList.add('needs-sync');

// Synchronously inject cached header/footer to prevent page load flash
(() => {
    try {
        const cachedHeader = sessionStorage.getItem('component-header.html');
        if (cachedHeader) {
            const el = document.getElementById('header-placeholder');
            if (el && el.getAttribute('data-fully-loaded') !== 'true') {
                const doc = new DOMParser().parseFromString(cachedHeader, 'text/html');
                const scripts = Array.from(doc.querySelectorAll('script'));
                el.innerHTML = '';
                while (doc.body.firstChild) el.appendChild(doc.body.firstChild);
                
                // Run script tags synchronously to hydrate login/logout states and render navigation instantly
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    if (script.src) newScript.src = script.src;
                    else newScript.textContent = script.textContent;
                    document.head.appendChild(newScript);
                });
                if (typeof checkLoginStatus === 'function') {
                    checkLoginStatus();
                }
                el.setAttribute('data-fully-loaded', 'true');
            }
        }
        const cachedFooter = sessionStorage.getItem('component-footer.html');
        if (cachedFooter) {
            const el = document.getElementById('footer-placeholder');
            if (el && el.getAttribute('data-fully-loaded') !== 'true') {
                const doc = new DOMParser().parseFromString(cachedFooter, 'text/html');
                const scripts = Array.from(doc.querySelectorAll('script'));
                el.innerHTML = '';
                while (doc.body.firstChild) el.appendChild(doc.body.firstChild);
                
                // Run script tags synchronously
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    if (script.src) newScript.src = script.src;
                    else newScript.textContent = script.textContent;
                    document.head.appendChild(newScript);
                });
                el.setAttribute('data-fully-loaded', 'true');
            }
        }
    } catch (_) {}
})();

// AppRefresh — global helper to preserve UI state across appDataRefreshed
// Usage: AppRefresh.register({ save: () => snap, restore: (snap) => ... })
window.AppRefresh = (() => {
    let _handler = null;
    window.addEventListener('appDataRefreshed', () => {
        if (!_handler) return;
        const snap = _handler.save();
        if (snap === undefined || snap === null) return;
        // hide active view to prevent flash during re-render
        const active = document.querySelector('[data-refresh-view]');
        if (active) active.style.visibility = 'hidden';
        requestAnimationFrame(() => {
            _handler?.restore(snap);
            if (active) active.style.visibility = '';
        });
    }, true);
    return {
        register:   (h) => { _handler = h; },
        unregister: ()  => { _handler = null; },
    };
})();

const _ALLOWED_COMPONENTS = ['header.html', 'footer.html'];

function _injectComponentHTML(placeholder, htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script'));

    placeholder.innerHTML = '';
    while (doc.body.firstChild) {
        placeholder.appendChild(doc.body.firstChild);
    }

    // Run script tags after the HTML elements are fully injected into the DOM
    scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
            newScript.src = script.src;
        } else {
            newScript.textContent = script.textContent;
        }
        document.head.appendChild(newScript);
    });
}

async function loadComponent(componentUrl, placeholderId) {
    try {
        const placeholder = document.getElementById(placeholderId);
        if (!placeholder) return;

        const isHeader = placeholderId === 'header-placeholder';
        const cached = sessionStorage.getItem(`component-${componentUrl}`);

        if (cached) {
            if (placeholder.getAttribute('data-fully-loaded') === 'true') {
                // Already visually injected and script executed synchronously by IIFE.
                // Do not re-inject or re-run scripts to prevent any flicker.
            } else {
                if (placeholder.querySelector('header') || placeholder.querySelector('footer')) {
                    const doc = new DOMParser().parseFromString(cached, 'text/html');
                    Array.from(doc.querySelectorAll('script')).forEach(script => {
                        const newScript = document.createElement('script');
                        if (script.src) newScript.src = script.src;
                        else newScript.textContent = script.textContent;
                        document.head.appendChild(newScript);
                    });
                } else {
                    _injectComponentHTML(placeholder, cached);
                }
                placeholder.setAttribute('data-fully-loaded', 'true');
            }
        } else {
            placeholder.innerHTML = isHeader
                ? '<div class="animate-pulse bg-gray-200 h-14 w-full rounded"></div>'
                : '<div class="animate-pulse bg-gray-200 h-10 w-full rounded"></div>';
            placeholder.style.minHeight = isHeader ? '56px' : '26px';
        }

        const safeComponent = _ALLOWED_COMPONENTS.find(c => c === componentUrl);
        if (!safeComponent) throw new Error(`Disallowed component: ${componentUrl}`);
        const response = await fetch(safeComponent, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Failed to load ${componentUrl}`);

        const text = await response.text();
        if (text !== cached) {
            sessionStorage.setItem(`component-${componentUrl}`, text);
            _injectComponentHTML(placeholder, text);
            placeholder.setAttribute('data-fully-loaded', 'true');
        }
    } catch (error) {
        console.warn(`[Component Engine] Failed loading ${componentUrl}:`, error);
        const placeholder = document.getElementById(placeholderId);
        if (placeholder && !placeholder.querySelector('header') && !placeholder.querySelector('footer')) {
            placeholder.innerHTML = `<div class="text-red-500 text-sm p-2">Failed to load ${componentUrl}</div>`;
        }
    }
}

const _ALLOWED_PAGES = ['services.html', 'dgr.html', 'awareness.html', 'Pincode.html', 'faqs.html',
                        'services', 'dgr', 'awareness', 'Pincode', 'faqs'];

function _skeletonHTML() {
    return `<div class="skeleton-loader">${[1,2,3,4,5,6].map(i =>
        `<div class="skeleton-line ${i === 2 ? 'skeleton-line-w' : i === 5 ? 'skeleton-line-n' : ''}"></div>`
    ).join('')}</div>`;
}

async function loadDynamicContent(url, targetElementId) {
    const el = document.getElementById(targetElementId);
    if (!el) return;

    // Fade out current content
    el.classList.add('page-transitioning', 'page-fade-out');
    await new Promise(r => setTimeout(r, 150));

    // Show skeleton loader
    el.innerHTML = _skeletonHTML();
    await new Promise(r => requestAnimationFrame(r)); // allow paint

    try {
        const safeUrl = _ALLOWED_PAGES.find(p => p === url);
        if (!safeUrl) throw new Error(`Disallowed page: ${url}`);
        const cacheBuster = safeUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${safeUrl}${cacheBuster}v=${Date.now()}`);
        if (!res.ok) throw new Error('Load failed');

        const txt = await res.text();
        const doc = new DOMParser().parseFromString(txt, 'text/html');
        const content = doc.querySelector('main .container');

        if (content) {
            el.innerHTML = content.innerHTML;
            setTimeout(() => {
                doc.body.querySelectorAll('script:not([src])').forEach(s => {
                    const ns = document.createElement('script');
                    ns.textContent = s.textContent;
                    document.body.appendChild(ns).remove();
                });
            }, 0);
        }

        // Fade in new content
        el.classList.remove('page-fade-out');
        el.classList.add('page-fade-in');
        setTimeout(() => el.classList.remove('page-transitioning', 'page-fade-in'), 300);
    } catch (e) {
        el.innerHTML = `<div class="text-red-500 text-center">Content unavailable.</div>`;
        el.classList.remove('page-fade-out', 'page-transitioning');
    }
}

// Link prefetching — on hover > 200ms, fetch page in background
function initLinkPrefetch() {
    let _prefetchTimer = null;
    let _prefetchAbort = null;

    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('http')) return;
        if (!_ALLOWED_PAGES.some(p => href.includes(p))) return;

        clearTimeout(_prefetchTimer);
        _prefetchTimer = setTimeout(async () => {
            _prefetchAbort?.abort();
            _prefetchAbort = new AbortController();
            try {
                await fetch(href, { signal: _prefetchAbort.signal, cache: 'force-cache' });
            } catch (_) { /* ignore aborts */ }
        }, 200);

        // Cancel on mouseleave the link
        const onLeave = () => {
            clearTimeout(_prefetchTimer);
            _prefetchAbort?.abort();
            link.removeEventListener('mouseleave', onLeave);
        };
        link.addEventListener('mouseleave', onLeave, { once: true });
    }, true);
}

const setActiveNavOnLoad = () => {
    const currentPath = window.location.pathname.split('/').pop();
    // derive pageId from filename without extension, lowercase
    const pageId = currentPath.replace(/\.html$/i, '').toLowerCase() || 'home';

    setTimeout(() => {
        document.querySelectorAll('a[id^="nav-"], a[id^="dropdown-"]').forEach(link => {
            const linkPage = (link.id || '').split('-')[1];
            link.classList.remove('bg-gray-600', 'font-bold', 'btn-active');
            if (linkPage === pageId) link.classList.add('btn-active');
        });
        document.querySelectorAll('#container-sidebar-nav a').forEach(link => {
            const href = (link.getAttribute('href') || '').split('/').pop();
            link.classList.toggle('btn-active', href === currentPath);
        });
    }, 150);
};

function initializeUI() {

    const sb = document.getElementById('sidebar');
    const tg = document.getElementById('sidebar-toggle');
    const ov = document.getElementById('sidebar-overlay');
    if (sb && tg) {
        const toggleFn = () => { sb.classList.toggle('-translate-x-full'); ov.classList.toggle('hidden'); };
        tg.addEventListener('click', toggleFn);
        if (ov) ov.addEventListener('click', toggleFn);
    }

    initNotifications();

    document.querySelectorAll('[id*="logout"]').forEach(b => b.addEventListener('click', handleLogout));

    window.checkAppData = async () => {
        if (!window.appDB) { console.warn('IndexedDB not available'); return null; }
        const data = await getAppData();
        console.group('APP DATA INSPECTOR (IndexedDB)');
        Object.keys(data).forEach(sheet => console.log(`${sheet}: ${Object.keys(data[sheet] || {}).length} records`));
        console.groupEnd();
        return data;
    };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// --- SSE state ---
window._lastEventTime  = null;
window._lastDeltaSync  = null;
window._sseConnected   = false;
window._sseGapStart    = null;
window._idbLastStamp   = 0;
window._idbHasData     = false;
window._initialSyncComplete = false;

let _sseWorker              = null;
let _sseConnectedOnce       = false;
let _refreshTimer           = null;
let _refreshInteractionTimer = null;

function _handleSWMessage(event) {
    const payload = event.data || {};
    const type = payload.type;
    console.log('[Layout] Received SW message:', type, payload);

    if (type === 'sync_progress') {
        const textEl = document.getElementById('sync-progress-text');
        if (textEl) {
            textEl.innerText = `Synced: ${payload.loaded} records...`;
        }
    } else if (type === 'layer_done') {
        if (payload.layer === 'current_fy') {
            console.log('[Layout] Initial current_fy layer synced. Unlocking UI.');
            document.documentElement.classList.remove('needs-sync');
            window._initialSyncComplete = true;
            window._syncInProgress = false;
            
            if (_syncLeader) {
                localStorage.removeItem('genie-sync-active');
                localStorage.removeItem('genie-sync-active-ts');
                _syncChannel.postMessage('sync-complete');
            }
            
            getAppData().then(fullData => {
                window.dispatchEvent(new CustomEvent('appDataLoaded', { detail: { data: fullData } }));
                window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
                window.dispatchEvent(new CustomEvent('syncComplete'));
            });
            // Catch events that occurred during stream sync
            window.appDB?.getLastEventStamp().then(stamp => {
                if (stamp && stamp > 0) pullDeltaSince(stamp).catch(() => {});
            }).catch(() => {});
        }
    } else if (type === 'sync_complete') {
        console.log('[Layout] Streaming sync completed. Total records:', payload.count);
        window._initialSyncComplete = true;
        window._syncInProgress = false;
        
        if (_syncLeader) {
            localStorage.removeItem('genie-sync-active');
            localStorage.removeItem('genie-sync-active-ts');
            _syncChannel.postMessage('sync-complete');
        }
        
        getAppData().then(fullData => {
            window.dispatchEvent(new CustomEvent('appDataLoaded', { detail: { data: fullData } }));
            window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
            window.dispatchEvent(new CustomEvent('syncComplete'));
        });
        // Catch events that occurred during stream sync
        window.appDB?.getLastEventStamp().then(stamp => {
            if (stamp && stamp > 0) pullDeltaSince(stamp).catch(() => {});
        }).catch(() => {});
        showNotification(`✅ Sync Complete (${payload.count} records)`, 'success');
        
    } else if (type === 'bg_delta_complete') {
        console.log('[Layout] Background delta refresh completed.');
        getAppData().then(fullData => {
            window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
            _scheduleRefresh();
        });
    } else if (type === 'sync_failed') {
        window._syncInProgress = false;
        window.dispatchEvent(new CustomEvent('syncComplete'));
        if (_syncLeader) {
            localStorage.removeItem('genie-sync-active');
            localStorage.removeItem('genie-sync-active-ts');
        }
        showNotification(`⚠️ Background Sync Failed: ${payload.message}`, 'error');
    }
}

function _scheduleRefresh() {
    // Interaction guard: if user is typing in a field, defer until blur or 5s timeout
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        clearTimeout(_refreshInteractionTimer);
        const deferredRefresh = () => {
            clearTimeout(_refreshInteractionTimer);
            _refreshInteractionTimer = null;
            _doRefresh();
        };
        activeEl.addEventListener('blur', deferredRefresh, { once: true });
        _refreshInteractionTimer = setTimeout(() => {
            activeEl.removeEventListener('blur', deferredRefresh);
            _doRefresh();
        }, 5000);
        return;
    }
    _doRefresh();
}

function _doRefresh() {
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(async () => {
        const fullData = await getAppData();
        window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
    }, 300);
}

async function _handleSSEMessage(payload) {
    window._lastEventTime = Date.now();

    if (payload.type === 'heartbeat') {
        window._lastHeartbeat = Date.now();
        window._sseConnected  = true;
        window._sseGapStart   = null;
        _sseConnectedOnce     = true;
        _sseBackoff           = 3000;
        console.log('[SSE] heartbeat ts:', payload.ts);
        return;
    }

    if (payload.type === 'logout') {
        handleLogout();
        return;
    }

    if (payload.type === 'resync') {
        console.log('[SSE] resync received, _syncInProgress:', window._syncInProgress, '_sseConnectedOnce:', _sseConnectedOnce);
        if (!window._syncInProgress)
            verifyAndFetchAppData(_sseConnectedOnce).catch(() => {});
        return;
    }

    if (payload.type === 'notif_count') {
        const badge = document.getElementById('notification-badge-global');
        if (badge && payload.unread > 0) {
            badge.innerText = payload.unread;
            badge.classList.remove('hidden');
            // Also load fresh notifications from server and render — badge alone isn't enough
            if (typeof fetchAndSaveNotifications === 'function') {
                fetchAndSaveNotifications().catch(() => {}).then(() => {
                    if (typeof loadNotificationsFromStorage === 'function') {
                        loadNotificationsFromStorage();
                    }
                });
            }
        }
        return;
    }

    if (payload.type === 'notification') {
        if (!window.appDB || !window.appDB.db) return;
        const notif = { ...payload.data, IS_READ: false };
        await window.appDB.mergeSheet('NOTIFICATIONS', { [notif.NOTIF_ID]: notif });
        await loadNotificationsFromStorage();  // re-render full list instead of prepend
        return;
    }

    if (payload.type === 'system_status') return;

    if (payload.type === 'delta') {
        if (!window.appDB || !window.appDB.db) return;
        if (window._syncInProgress) { window._sseBuffer.push(payload); return; }
        console.log('[SSE] delta applying:', payload.collection, payload.action, payload.key);
        await _applyDelta(payload);
        if (payload.ts) await window.appDB.setMetadata('lastEventStamp', payload.ts).catch(() => {});
        // Always write to IDB. Only skip UI refresh if tab is hidden.
        if (document.hidden) return;
        _scheduleRefresh();
    }
}

// --- Direct SSE fallback (mobile / Safari / no SharedWorker) ---
let _sseDirect   = false;
let _sseAbort    = null;
let _sseBackoff  = 3000;
let _sseWatchdog = null;

function _resetWatchdog() {
    clearTimeout(_sseWatchdog);
    _sseWatchdog = setTimeout(() => {
        _sseAbort?.abort();
        _sseDirect = false;
        _openSSEDirect();
    }, 45000);
}

async function _openSSEDirect() {
    if (_sseDirect) { console.log('[SSE-direct] already running, skip'); return; }
    if (!isLoggedIn()) return;
    const token = getSessionId();
    if (!token) { handleLogout(); return; }
    console.log('[SSE-direct] opening connection...');
    _sseDirect = true;
    if (_sseAbort) _sseAbort.abort();
    _sseAbort = new AbortController();
    try {
        const res = await fetch(`${CONSTANTS.OPERATIONS_URL}/api/events`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal:  _sseAbort.signal,
            cache:   'no-store',
        });
        if (res.status === 401) { _sseDirect = false; handleLogout(); return; }
        if (!res.ok || !res.body) throw new Error('SSE failed');
        console.log('[SSE-direct] connected, reading stream...');
        _resetWatchdog();
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop();
            for (const part of parts) {
                const line = part.trim();
                if (!line.startsWith('data:')) continue;
                try { _handleSSEMessage(JSON.parse(line.slice(5).trim())); } catch (_) {}
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') { _sseDirect = false; return; }
        console.warn('[SSE-direct] error:', e.message);
    }
    clearTimeout(_sseWatchdog);
    _sseDirect  = false;
    const delay = _sseBackoff;
    _sseBackoff = Math.min(_sseBackoff * 2, 30000);
    console.log('[SSE-direct] reconnecting in', delay, 'ms');
    if (isLoggedIn()) setTimeout(_openSSEDirect, delay);
}

function openSSE() {
    if (!isLoggedIn()) return;
    if (typeof SharedWorker !== 'undefined') {
        console.log('[SSE] SharedWorker path');
        if (!_sseWorker) {
            try {
                _sseWorker = new SharedWorker('core/sse-worker.js');
                _sseWorker.port.start();
                _sseWorker.port.onmessage = (e) => { _handleSSEMessage(e.data); };
                _sseWorker.onerror = () => { console.warn('[SSE] SharedWorker error'); _sseWorker = null; };
                console.log('[SSE] SharedWorker created');
            } catch (e) {
                console.warn('[SSE] SharedWorker failed:', e.message);
                _sseWorker = null;
                return;
            }
        }
        _sseWorker.port.postMessage({ type: 'init', token: getSessionId(), url: CONSTANTS.OPERATIONS_URL });
        console.log('[SSE] init sent to worker, url:', CONSTANTS.OPERATIONS_URL);
        if (_sseConnectedOnce && !window._sseConnected)
            window._sseGapStart = window._sseGapStart || Date.now();
    } else {
        console.log('[SSE] direct path (no SharedWorker)');
        _openSSEDirect();
    }
}

// clear sync lock on page unload/navigation — prevents stuck state if sync was mid-flight
window.addEventListener('pagehide', () => {
    if (_syncLeader) {
        localStorage.removeItem('genie-sync-active');
        localStorage.removeItem('genie-sync-active-ts');
    }
});

// online / visibilitychange recovery
window.addEventListener('online', () => {
    if (!isLoggedIn()) return;
    const since = window._lastEventTime ?? window._idbLastStamp;
    console.log('[online] pullDeltaSince:', since, 'openSSE');
    if (since !== null && since !== undefined) pullDeltaSince(since).catch(() => {});
    openSSE();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !isLoggedIn()) return;
    const since = window._lastEventTime ?? window._idbLastStamp;
    // skip delta pull if SSE is live and recent (< 60s)
    const sseRecent = window._sseConnected && window._lastEventTime && (Date.now() - window._lastEventTime) < 60000;
    if (!sseRecent && since !== null && since !== undefined) pullDeltaSince(since).catch(() => {});
    console.log('[visibilitychange] visible, since:', since, '_sseConnected:', window._sseConnected, '_lastHeartbeat age:', Date.now() - (window._lastHeartbeat||0), 'ms');
    if (!_sseConnectedOnce || (Date.now() - (window._lastHeartbeat || 0)) > 45000) openSSE();
});

// 5-min safety net tick
setInterval(() => {
    if (document.hidden || !isLoggedIn()) return;
    if (window._sseConnected && window._lastEventTime && (Date.now() - window._lastEventTime) < 60000) return;
    const since = window._lastEventTime ?? window._idbLastStamp;
    console.log('[5min-tick] pullDeltaSince:', since);
    if (since !== null && since !== undefined) pullDeltaSince(since).catch(() => {});
}, 5 * 60 * 1000);

// multi-tab sync coordination (#10)
const _syncChannel = new BroadcastChannel('genie-sync');
let _syncLeader = false;
_syncChannel.addEventListener('message', async (e) => {
    if (e.data === 'sync-started') {
        localStorage.setItem('genie-sync-active', '1');
        localStorage.setItem('genie-sync-active-ts', Date.now().toString());
    }
    if (e.data === 'sync-complete') {
        localStorage.removeItem('genie-sync-active');
        localStorage.removeItem('genie-sync-active-ts');
        const fullData = await getAppData();
        window.dispatchEvent(new CustomEvent('appDataLoaded',    { detail: { data: fullData } }));
        window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
    }
});

function _isSyncActive() {
    const active = localStorage.getItem('genie-sync-active');
    if (!active) return false;
    // stale guard — if flag is older than 30s, treat as dead
    const ts = parseInt(localStorage.getItem('genie-sync-active-ts') || '0');
    if (Date.now() - ts > 10000) {
        localStorage.removeItem('genie-sync-active');
        localStorage.removeItem('genie-sync-active-ts');
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {

    // Resolve API URL
    try {
        const res = await fetch('dev_url.json', { cache: 'no-store' });
        if (res.ok) {
            const { url } = await res.json();
            if (url) CONSTANTS.OPERATIONS_URL = url;
        }
    } catch (_) {}

    // Final safety — never leave placeholder
    if (!CONSTANTS.OPERATIONS_URL || CONSTANTS.OPERATIONS_URL === '__API_URL__')
        CONSTANTS.OPERATIONS_URL = window.location.origin;

    createNotificationModal();
    fetchClientIP();

    // Loading overlay — CSS-driven (html.needs-sync), removed on syncComplete
    if (isLoggedIn()) {
        const _removeOverlay = () => document.documentElement.classList.remove('needs-sync');
        window.addEventListener('syncComplete', _removeOverlay, { once: true });
        setTimeout(_removeOverlay, 30000);
    } else {
        document.documentElement.classList.remove('needs-sync');
    }

    // Offline indicator
    const _offlineBanner = document.createElement('div');
    _offlineBanner.id = 'offline-banner';
    _offlineBanner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;text-align:center;padding:6px;font-size:13px;font-family:sans-serif;display:none;';
    _offlineBanner.textContent = '⚠️ No internet connection';
    document.body.appendChild(_offlineBanner);
    window.addEventListener('offline', () => { _offlineBanner.style.display = 'block'; });
    window.addEventListener('online',  () => { _offlineBanner.style.display = 'none'; });

    await loadComponent('header.html', 'header-placeholder');
    await loadComponent('footer.html', 'footer-placeholder');
    window.dispatchEvent(new CustomEvent('footerLoaded'));

    checkLoginStatus();
    setActiveNavOnLoad();
    initializeUI();
    initLinkPrefetch();

    // Wait for IndexedDB to be ready (appDB is set immediately but db is null until init completes)
    await new Promise((resolve) => {
        if (window.appDB && window.appDB.db) return resolve();
        let resolved = false;
        const timeout = setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 5000);
        window.addEventListener('indexedDBReady', () => {
            if (!resolved) { resolved = true; clearTimeout(timeout); resolve(); }
        }, { once: true });
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('[ServiceWorker] Registered, scope:', reg.scope);
        });
        navigator.serviceWorker.addEventListener('message', (event) => {
            _handleSWMessage(event);
        });
        
        // Request native OS notification permissions
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('[Notification] Native OS permission status:', permission);
            });
        }
    }

    if (isLoggedIn()) {
        const existing  = await getAppData();
        const timeFilteredSheets = ['ORDERS', 'MULTIBOX', 'PRODUCTS', 'UPLOADS', 'ATTENDANCE', 'STAFF'];
        const hasData   = existing && timeFilteredSheets.some(s => Object.keys(existing[s] || {}).length > 0);
        window._idbHasData = hasData;
        console.log('[Layout] hasData:', hasData, '| sheets:', timeFilteredSheets.map(s => `${s}:${Object.keys(existing?.[s]||{}).length}`).join(' '));

        const timeFiltered = ['ORDERS','MULTIBOX','PRODUCTS','UPLOADS','ATTENDANCE','STAFF'];
        window._idbLastStamp = window.appDB ? await window.appDB.getLastEventStamp().catch(() => 0) : 0;
        console.log('[Layout] _idbLastStamp:', window._idbLastStamp);

        if (!hasData && !_isSyncActive()) {
            console.log('[Layout] No data — running full verifyAndFetchAppData');
            _syncLeader = true;
            localStorage.setItem('genie-sync-active', '1');
            localStorage.setItem('genie-sync-active-ts', Date.now().toString());
            _syncChannel.postMessage('sync-started');
            verifyAndFetchAppData(); // Delegates to Service Worker (async)
        } else if (!_isSyncActive()) {
            console.log('[Layout] Has data — firing events, pullDeltaSince:', window._idbLastStamp);
            window._initialSyncComplete = true; // User has data, bypass overlay blocker
            const fullData = await getAppData();
            window.dispatchEvent(new CustomEvent('appDataLoaded',    { detail: { data: fullData } }));
            window.dispatchEvent(new CustomEvent('appDataRefreshed', { detail: { data: fullData } }));
            window.dispatchEvent(new CustomEvent('syncComplete'));  // drop overlay immediately — user already has data
            if (window._idbLastStamp !== null && window._idbLastStamp !== undefined) {
                pullDeltaSince(window._idbLastStamp).catch(() => {});
            } else if (typeof loadNotificationsFromStorage === 'function') {
                loadNotificationsFromStorage();
            }
            
            // Trigger stream verification in background to sync any updates
            _syncLeader = true;
            localStorage.setItem('genie-sync-active', '1');
            localStorage.setItem('genie-sync-active-ts', Date.now().toString());
            verifyAndFetchAppData();
        } else {
            console.log('[Layout] Sync already active — skipping');
        }
        openSSE();
        initHeartbeat();
    }

    if (window.location.pathname.includes('main.html') || window.location.pathname.endsWith('/main') || window.location.pathname.endsWith('/')) {
        const tray = document.getElementById('services-tray');
        if (window.innerWidth >= 1024) {
            if (tray) tray.style.display = 'block';
            loadDynamicContent('services.html', 'services-content-area');
        } else {
            if (tray) tray.style.display = 'block';
            if (typeof window.loadMobileServicesSlideshow === 'function') window.loadMobileServicesSlideshow();
        }
    }
});
