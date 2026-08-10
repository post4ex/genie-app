// ============================================================================
// SEARCH-MODAL.JS — Header search/track modal (default, live, custom carrier)
// ============================================================================

const CUSTOM_CARRIERS = [
    { value: 'jetline',    label: 'Jetline',         type: 'slug' },
    { value: 'trackon',    label: 'Trackon',         type: 'slug' },
    { value: 'delhivery',  label: 'Delhivery',       type: 'slug' },
    { value: 'shiprocket', label: 'Shiprocket',      type: 'slug' },
    { value: 'bigship',    label: 'Bigship',         type: 'slug' },
    { value: 'airways',    label: 'Airways Courier', type: 'slug' },
    { value: 'stcourier',  label: 'ST Courier',      type: 'slug' },
    { value: 'tc',         label: 'TrackCourier',    type: 'tc'   },
    { value: '17track',    label: '17Track',         type: '17t'  },
];

// Carriers that need a sub-carrier param for tc/17track
const TC_CARRIERS = ['DTDC','BLUEDART','INDIAPOST','SPEEDPOST','XPRESSBEES','ECOM','SHADOWFAX','SPOTON','GATI','PROFESSIONAL','SAFEXPRESS','TCI','VXPRESS','MARUTI','VRL'];
const T17_CARRIERS = ['INDIAPOST','SPEEDPOST','DTDC','BLUEDART','XPRESSBEES','ECOM','SHADOWFAX','SPOTON','GATI','PROFESSIONAL','SAFEXPRESS','TCI','MARUTI','DHL','DHLEXPRESS','FEDEX','UPS','ARAMEX'];

const STATE_BADGE = {
    delivered:      { icon: 'fa-circle-check',         label: 'Delivered',        bg: 'linear-gradient(135deg,#9C2007,#7a1805)', glow: 'rgba(156,32,7,0.3)'    },
    outfordelivery: { icon: 'fa-truck',                label: 'Out for Delivery', bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)', glow: 'rgba(37,99,235,0.3)'   },
    intransit:      { icon: 'fa-route',                label: 'In Transit',       bg: 'linear-gradient(135deg,#d97706,#b45309)', glow: 'rgba(217,119,6,0.3)'   },
    exception:      { icon: 'fa-triangle-exclamation', label: 'Exception',        bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', glow: 'rgba(220,38,38,0.3)'   },
    pending:        { icon: 'fa-clock',                label: 'Pending',          bg: 'linear-gradient(135deg,#6b7280,#4b5563)', glow: 'rgba(107,114,128,0.2)' },
};

// ============================================================================
// DOM injection (once)
// ============================================================================
function _injectModal() {
    if (document.getElementById('sm-overlay')) return;

    const canLive   = typeof hasPermission === 'function' && hasPermission('STAFF');
    const canCustom = typeof hasPermission === 'function' && hasPermission('MANAGER');
    const showTabs  = canLive || canCustom;

    if (!document.getElementById('sm-style')) {
        const s = document.createElement('style');
        s.id = 'sm-style';
        s.textContent = `
            .sm-tabs-group { display:flex; gap:0.25rem; flex-shrink:0; }
            @media (max-width:640px) {
                .sm-tabs-group { width:100%; }
                .sm-tabs-group .sm-tab { flex:1; }
                #sm-carrier-wrap, #sm-subcarrier-wrap { flex:1; }
            }
        `;
        document.head.appendChild(s);
    }

    const el = document.createElement('div');
    el.innerHTML = `
<div id="sm-overlay" role="dialog" aria-modal="true" aria-label="Track" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);justify-content:center;align-items:flex-start;padding-top:3rem;" tabindex="-1">
    <div id="sm-box" style="background:#fff;border-radius:1rem;box-shadow:0 24px 64px rgba(0,0,0,0.18);width:100%;max-width:1200px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;margin:0 1rem;">
        <!-- Header -->
        <div style="padding:0.75rem 1.25rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:0.5rem;flex-shrink:0;background:linear-gradient(to right,#f8fafc,#fff);position:sticky;top:0;z-index:1;flex-wrap:wrap;">
            <i class="fa-solid fa-magnifying-glass" style="color:#9C2007;font-size:0.85rem;flex-shrink:0;"></i>
            <span style="font-size:0.85rem;font-weight:800;color:#1e293b;white-space:nowrap;">Search</span>
            <div style="flex:1;min-width:0.5rem;"></div>
            <input id="sm-pincode-input" type="text" inputmode="numeric" maxlength="6"
                   placeholder="Pincode"
                   style="height:2rem;width:5rem;padding:0.35rem 0.6rem;border:1px solid #9C2007;
                          border-radius:0.375rem;font-size:0.78rem;outline:none;color:#1e293b;
                          text-align:center;letter-spacing:0.1em;box-sizing:border-box;" />
            <button id="sm-pincode-search-btn"
                style="height:2rem;padding:0 0.7rem;background:#9C2007;color:#fff;border:none;
                       border-radius:0.375rem;font-size:0.72rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;box-sizing:border-box;">
                <i class="fa-solid fa-magnifying-glass" style="margin-right:0.2rem;"></i>Track
            </button>
            <button id="sm-close" aria-label="Close" class="btn-close" tabindex="0">✕</button>
        </div>

        <!-- Controls -->
        <div style="padding:1rem 1.25rem;border-bottom:1px solid #f1f5f9;">
            <!-- Row 1: Track controls -->
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                ${showTabs ? `
                <div class="sm-tabs-group" role="group" aria-label="Tracking mode">
                    <button class="btn btn-sm sm-tab btn-active" data-mode="default">Default</button>
                    ${canLive   ? `<button class="btn btn-sm sm-tab" data-mode="live">Live</button>`     : ''}
                    ${canCustom ? `<button class="btn btn-sm sm-tab" data-mode="custom">Custom</button>` : ''}
                </div>` : ''}
                <div id="sm-carrier-wrap" style="display:none;">
                    <select id="sm-carrier-sel" aria-label="Select carrier" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:0.78rem;color:#374151;background:#fff;outline:none;min-width:130px;">
                        <option value="">— Carrier —</option>
                        ${CUSTOM_CARRIERS.map(c => `<option value="${c.value}" data-type="${c.type}">${c.label}</option>`).join('')}
                    </select>
                </div>
                <div id="sm-subcarrier-wrap" style="display:none;">
                    <select id="sm-subcarrier-sel" aria-label="Select sub-carrier" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:0.78rem;color:#374151;background:#fff;outline:none;min-width:130px;"></select>
                </div>
                <div class="sm-input-group" style="display:flex;gap:0.5rem;align-items:center;flex:1;min-width:180px;">
                    <input id="sm-input" type="text" placeholder="AWB or Reference number" aria-label="AWB or Reference number"
                        style="flex:1;padding:0.55rem 0.875rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:0.82rem;outline:none;color:#1e293b;" />
                    <button id="sm-scan-btn" type="button" title="Scan barcode" aria-label="Scan barcode" style="display:flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;padding:0;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:0.5rem;cursor:pointer;color:#374151;flex-shrink:0;transition:background 0.15s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="1" y="3" width="2" height="18"/><rect x="5" y="3" width="1" height="18"/><rect x="8" y="3" width="2" height="18"/><rect x="12" y="3" width="1" height="18"/><rect x="15" y="3" width="2" height="18"/><rect x="19" y="3" width="1" height="18"/><rect x="22" y="3" width="1" height="18"/></svg>
                    </button>
                    <button id="sm-search-btn" style="padding:0.55rem 1.1rem;background:#9C2007;color:#fff;border:none;border-radius:0.5rem;font-size:0.8rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background 0.15s;flex-shrink:0;">
                        <i class="fa-solid fa-magnifying-glass" style="margin-right:0.3rem;"></i>Track
                    </button>
                </div>
            </div>
        </div>
        <!-- Result area -->
        <div id="sm-result-wrap" style="padding:1rem 1.25rem;display:none;">
            <div id="sm-msg"    class="hidden" style="padding:0.6rem 0.875rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-align:center;margin-bottom:0.75rem;"></div>
            <div id="sm-loader" class="hidden" style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem;margin-bottom:0.5rem;display:block;"></i>Fetching tracking data…
            </div>
            <div id="sm-result" class="hidden"></div>
        </div>
    </div>
</div>`;

    // Replace el with its inner div
    document.body.insertAdjacentHTML('beforeend', el.innerHTML);
    _bindModalEvents();
}

// ============================================================================
// Events
// ============================================================================
function _bindModalEvents() {
    const overlay = document.getElementById('sm-overlay');
    const box     = document.getElementById('sm-box');
    const closeBtn = document.getElementById('sm-close');
    const searchBtn = document.getElementById('sm-search-btn');
    const input   = document.getElementById('sm-input');
    const carrierSel = document.getElementById('sm-carrier-sel');
    const subSel  = document.getElementById('sm-subcarrier-sel');

    // Close
    closeBtn.addEventListener('click', closeSearchModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeSearchModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearchModal(); });

    // Mode tabs
    document.querySelectorAll('.sm-tab').forEach(tab => {
        tab.addEventListener('click', () => _setMode(tab.dataset.mode));
    });

    // Carrier select → show sub-carrier if needed
    carrierSel.addEventListener('change', () => _onCarrierChange());

    // Scan button — uses <scan-barcode> web component if available, else file picker fallback
    const scanBtn = document.getElementById('sm-scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            // Dynamically inject <scan-barcode> component on first use
            if (!document.querySelector('script[src*="barcode-scanner"]')) {
                const sc = document.createElement('script');
                sc.type = 'module';
                sc.src = (window.location.pathname.includes('/core/') ? '../' : '') + 'utils/barcode-scanner.js';
                document.head.appendChild(sc);
            }
            // Create a hidden <scan-barcode> element, trigger it
            let el = document.getElementById('sm-scanner-el');
            if (!el) {
                el = document.createElement('scan-barcode');
                el.id = 'sm-scanner-el';
                el.setAttribute('icon-only', '');
                el.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';
                document.getElementById('sm-box').appendChild(el);
                el.addEventListener('scanned', e => {
                    const inp = document.getElementById('sm-input');
                    if (inp) { inp.value = e.detail.value; inp.focus(); }
                });
            }
            el.querySelector('.scan-trigger, button')?.click();
        });
    }

    // Search
    searchBtn.addEventListener('click', _doSearch);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') _doSearch(); });

    // Pincode search
    const pincodeSearchBtn = document.getElementById('sm-pincode-search-btn');
    const pincodeInput = document.getElementById('sm-pincode-input');
    if (pincodeSearchBtn) pincodeSearchBtn.addEventListener('click', _doPincodeSearch);
    if (pincodeInput) pincodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') _doPincodeSearch(); });
}

let _currentMode = 'default';
let _smResizeHandler = null;

function _setMode(mode) {
    _currentMode = mode;
    document.querySelectorAll('.sm-tab').forEach(t => {
        if (t.dataset.mode === mode) {
            t.classList.add('btn-active');
        } else {
            t.classList.remove('btn-active');
        }
    });
    const carrierWrap = document.getElementById('sm-carrier-wrap');
    const subWrap     = document.getElementById('sm-subcarrier-wrap');
    const inputGroup  = document.querySelector('.sm-input-group');
    if (mode === 'custom') {
        carrierWrap.style.display = 'block';
        _onCarrierChange();
    } else {
        carrierWrap.style.display = 'none';
        subWrap.style.display = 'none';
    }
    // On mobile, break input to its own row only when dropdowns are visible
    if (inputGroup) {
        inputGroup.style.flexBasis = (mode === 'custom' && window.innerWidth <= 640) ? '100%' : '';
    }
    _clearResult();
}

function _onCarrierChange() {
    const sel    = document.getElementById('sm-carrier-sel');
    const subWrap = document.getElementById('sm-subcarrier-wrap');
    const subSel  = document.getElementById('sm-subcarrier-sel');
    const opt     = sel.options[sel.selectedIndex];
    const type    = opt ? opt.dataset.type : '';

    if (type === 'tc') {
        subWrap.style.display = 'block';
        subSel.innerHTML = '<option value="">— Sub-Carrier —</option>' + TC_CARRIERS.map(c => `<option value="${c}">${c}</option>`).join('');
    } else if (type === '17t') {
        subWrap.style.display = 'block';
        subSel.innerHTML = '<option value="">— Sub-Carrier —</option>' + T17_CARRIERS.map(c => `<option value="${c}">${c}</option>`).join('');
    } else {
        subWrap.style.display = 'none';
        subSel.innerHTML = '';
    }
}

// ============================================================================
// API call
// ============================================================================
async function _doSearch() {
    const raw   = document.getElementById('sm-input').value.trim();
    const query = raw.replace(/[^a-zA-Z0-9\-\/]/g, '');  // strip special chars
    if (!query || query.length < 4) {
        _showMsg('Enter at least 4 characters (letters and digits only).', 'error');
        return;
    }

    const token = typeof getSessionId === 'function' ? getSessionId() : '';
    if (!token) { _showMsg('Session expired. Please log in again.', 'error'); return; }

    const base  = (window.CONSTANTS || {}).OPERATIONS_URL || '';

    let url;

    if (_currentMode === 'custom') {
        const carrier = document.getElementById('sm-carrier-sel').value;
        if (!carrier) { _showMsg('Select a carrier.', 'error'); return; }

        const opt    = document.getElementById('sm-carrier-sel').options[document.getElementById('sm-carrier-sel').selectedIndex];
        const type   = opt ? opt.dataset.type : '';
        const subSel = document.getElementById('sm-subcarrier-sel');
        const sub    = subSel ? subSel.value : '';

        if ((type === 'tc' || type === '17t') && !sub) {
            _showMsg('Select a sub-carrier.', 'error'); return;
        }

        if (type === 'tc') {
            url = `${base}/api/track/custom/tc?carrier=${encodeURIComponent(sub)}&awb=${encodeURIComponent(query)}`;
        } else if (type === '17t') {
            url = `${base}/api/track/custom/17track?carrier=${encodeURIComponent(sub)}&awb=${encodeURIComponent(query)}`;
        } else {
            url = `${base}/api/track/custom/${carrier}?awb=${encodeURIComponent(query)}`;
        }
    } else if (_currentMode === 'live') {
        url = `${base}/api/track/live?${_refOrAwb(query)}`;
    } else {
        // Default: local cache, no outbound HF call
        url = `${base}/api/movements?${_refOrAwb(query)}`;
    }

    _showLoader();
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        _hideLoader();
        if (res.status === 401) { typeof handleLogout === 'function' && handleLogout(); return; }
        if (res.status === 403) { _showMsg('This tracking mode is not available for your role.', 'error'); return; }
        if (res.status === 404) { _showMsg('Shipment not found.', 'error'); return; }
        if (res.status === 400) { _showMsg('Invalid AWB or reference number.', 'error'); return; }
        if (res.status >= 500)  { _showMsg('Server error. Please try again shortly.', 'error'); return; }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            _showMsg(body.detail || `Request failed (${res.status}).`, 'error');
            return;
        }
        const data = await res.json();
        if (!data || (Array.isArray(data) && !data.length)) {
            _showMsg('No tracking data found.', 'error'); return;
        }
        _renderResult(data);
    } catch {
        _hideLoader();
        _showMsg('Network error. Please check your connection.', 'error');
    }
}

function _refOrAwb(q) {
    return q.match(/^\d{14}$/) ? `ref=${encodeURIComponent(q)}` : `awb=${encodeURIComponent(q)}`;
}

// ============================================================================
// Sort movements — newest first
// ============================================================================
function _sortMovements(movements) {
    if (!movements || !movements.length) return [];
    return movements.map((m, i) => ({ m, i })).sort((a, b) => {
        const aStamp = a.m.activity_stamp || a.m.ACTIVITY_STAMP || 0;
        const bStamp = b.m.activity_stamp || b.m.ACTIVITY_STAMP || 0;
        if (aStamp !== bStamp) return bStamp - aStamp;

        // Tiebreaker: TIME_STAMP (insertion/discovery time — already sorted correctly by backend)
        const aTs = a.m.time_stamp || a.m.TIME_STAMP || 0;
        const bTs = b.m.time_stamp || b.m.TIME_STAMP || 0;
        if (aTs !== bTs) return bTs - aTs;

        return a.i - b.i; // preserve backend order on full tie
    }).map(x => x.m);
}

// ============================================================================
// Render result — self-contained, no external dependency
// ============================================================================
function _renderResult(data) {
    _clearResult();
    const rc = document.getElementById('sm-result');
    if (!rc) return;

    // Normalise: proxy /tracking → {status,shipment,movements}
    //            proxy /track/{carrier} → {status,data:{movements,...}}
    let shipment, movements;
    if (data.shipment !== undefined) {
        shipment  = data.shipment  || {};
        movements = data.movements || [];
    } else {
        const inner = data.data || data;
        shipment  = inner.shipment || (inner.movements ? inner : {});
        movements = inner.movements || [];
    }

    movements = _sortMovements(movements);

    const st = STATE_BADGE[shipment.state] || STATE_BADGE.pending;
    const stateStyles = {
        delivered:      { bg: 'linear-gradient(135deg,#9C2007,#7a1805)', glow: 'rgba(156,32,7,0.3)'    },
        outfordelivery: { bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)', glow: 'rgba(37,99,235,0.3)'   },
        intransit:      { bg: 'linear-gradient(135deg,#d97706,#b45309)', glow: 'rgba(217,119,6,0.3)'   },
        exception:      { bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', glow: 'rgba(220,38,38,0.3)'   },
        pending:        { bg: 'linear-gradient(135deg,#6b7280,#4b5563)', glow: 'rgba(107,114,128,0.2)' },
    };
    const ss = stateStyles[shipment.state] || stateStyles.pending;

    const infoItems = [
        { label: 'Reference',   value: shipment.reference,                                      icon: 'fa-fingerprint'     },
        { label: 'AWB No.',     value: shipment.awb || shipment.carrier_awb,                    icon: 'fa-hashtag'         },
        { label: 'Origin',      value: shipment.carrier_origin || shipment.origin,              icon: 'fa-circle-dot'      },
        { label: 'Destination', value: shipment.carrier_destination || shipment.destination,    icon: 'fa-location-dot'    },
        { label: 'Booked On',   value: shipment.booked_date || shipment.order_date,             icon: 'fa-calendar-days'   },
        { label: 'Weight',      value: shipment.weight ? `${shipment.weight} kg · ${shipment.pieces||1} pcs` : null, icon: 'fa-weight-hanging' },
    ].filter(i => i.value);

    // Desktop movement table
    const movRows = movements.map((m, i) => {
        const sysTs = m.activity_stamp || m.time_stamp || 0;
        const sysTime = sysTs ? (typeof fmtDate === 'function' ? fmtDate(sysTs, 'full') : sysTs) : '—';
        return `
        <tr style="background:${i===0?'rgba(37,99,235,0.06)':i%2===0?'#fff':'#f9fafb'};">
            <td style="padding:0.6rem 0.875rem;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-size:0.72rem;font-weight:700;color:#374151;">${m.date||m.DATE||''}</td>
            <td style="padding:0.6rem 0.875rem;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-size:0.72rem;color:#9ca3af;">${m.time||m.TIME||''}</td>
            <td style="padding:0.6rem 0.875rem;border-bottom:1px solid #f1f5f9;font-size:0.72rem;color:#6b7280;">${m.location||m.LOCATION||''}</td>
            <td style="padding:0.6rem 0.875rem;border-bottom:1px solid #f1f5f9;font-size:0.75rem;color:#374151;font-weight:${i===0?700:500};">${m.activity||m.ACTIVITY||''}</td>
            <td style="padding:0.6rem 0.875rem;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-size:0.68rem;color:#94a3b8;">${sysTime}</td>
        </tr>`;
    }).join('');

    // Mobile movement cards
    const movCards = movements.map((m, i) => `
        <div style="border-radius:0.625rem;padding:0.65rem 0.875rem;border:1px solid ${i===0?'#bfdbfe':'#e2e8f0'};background:${i===0?'#eff6ff':'#f8fafc'};margin-bottom:0.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.2rem;">
                <span style="font-size:0.75rem;font-weight:700;color:${i===0?'#1d4ed8':'#374151'};">${m.activity||m.ACTIVITY||''}</span>
                <span style="font-size:0.65rem;color:#94a3b8;white-space:nowrap;flex-shrink:0;">${m.date||m.DATE||''} ${m.time||m.TIME||''}</span>
            </div>
            ${(m.location||m.LOCATION)?`<p style="font-size:0.65rem;color:#6b7280;margin:0;">${m.location||m.LOCATION}</p>`:''}
        </div>`).join('');

    const noMov = '<p style="text-align:center;color:#94a3b8;font-size:0.78rem;padding:1.5rem;">No movements recorded yet.</p>';
    const isMobile = window.innerWidth <= 640;

    rc.innerHTML = `
        <div style="font-family:'Inter',sans-serif;">
            <!-- Shipment summary: 2-row table (desktop) / 2 cards (mobile) -->
            <div style="margin-bottom:0.875rem;border:1px solid #e2e8f0;border-radius:0.875rem;overflow:hidden;">

                <!-- DESKTOP: 2-row table -->
                <table id="sm-info-desktop" style="display:${isMobile?'none':'table'};width:100%;border-collapse:collapse;">
                    <tbody>
                        <tr>
                            ${infoItems.map((item, i) => `
                            <td style="padding:0.55rem 0.875rem;border-bottom:1px solid #f1f5f9;${i>0?'border-left:1px solid #f1f5f9;':''}vertical-align:top;background:#f8fafc;">
                                <p style="font-size:0.58rem;color:#9C2007;opacity:0.8;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 0.15rem;">
                                    <i class="fa-solid ${item.icon}" style="margin-right:0.25rem;"></i>${item.label}
                                </p>
                            </td>`).join('')}
                            <td style="padding:0.55rem 0.875rem;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;vertical-align:top;background:${ss.bg};">
                                <p style="font-size:0.58rem;color:rgba(255,255,255,0.7);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 0.15rem;">
                                    <i class="fa-solid fa-circle-dot" style="margin-right:0.25rem;"></i>Status
                                </p>
                            </td>
                        </tr>
                        <tr>
                            ${infoItems.map((item, i) => `
                            <td style="padding:0.55rem 0.875rem;${i>0?'border-left:1px solid #f1f5f9;':''}vertical-align:top;">
                                <p style="font-size:0.82rem;font-weight:700;color:#1e293b;margin:0;">${item.value}</p>
                            </td>`).join('')}
                            <td style="padding:0.55rem 0.875rem;border-left:1px solid #f1f5f9;vertical-align:middle;background:${ss.bg};">
                                <div style="display:flex;align-items:center;gap:0.5rem;">
                                    <i class="fa-solid ${st.icon}" style="color:white;font-size:0.9rem;"></i>
                                    <span style="color:white;font-size:0.85rem;font-weight:800;">${st.label}</span>
                                </div>
                                ${shipment.carrier_name||shipment.carrier ? `<p style="color:rgba(255,255,255,0.75);font-size:0.68rem;font-weight:600;margin:0.2rem 0 0;">${shipment.carrier_name||shipment.carrier}</p>` : ''}
                                ${shipment.status_raw ? `<p style="color:rgba(255,255,255,0.65);font-size:0.65rem;margin:0.15rem 0 0;">${shipment.status_raw}</p>` : ''}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- MOBILE: 2 cards -->
                <div id="sm-info-mobile" style="display:${isMobile?'flex':'none'};flex-direction:column;gap:0.5rem;padding:0.75rem;">
                    <!-- Card 1: info fields in grid -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
                        ${infoItems.map(item => `
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.65rem;">
                            <p style="font-size:0.58rem;color:#9C2007;opacity:0.8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 0.15rem;">
                                <i class="fa-solid ${item.icon}" style="margin-right:0.2rem;"></i>${item.label}
                            </p>
                            <p style="font-size:0.78rem;font-weight:700;color:#1e293b;margin:0;">${item.value}</p>
                        </div>`).join('')}
                    </div>
                    <!-- Card 2: status -->
                    <div style="background:${ss.bg};border-radius:0.5rem;padding:0.75rem 0.875rem;display:flex;align-items:center;gap:0.75rem;">
                        <i class="fa-solid ${st.icon}" style="color:white;font-size:1.1rem;flex-shrink:0;"></i>
                        <div>
                            <p style="color:white;font-size:0.9rem;font-weight:800;margin:0;">${st.label}</p>
                            ${shipment.carrier_name||shipment.carrier ? `<p style="color:rgba(255,255,255,0.75);font-size:0.7rem;margin:0.1rem 0 0;">${shipment.carrier_name||shipment.carrier}</p>` : ''}
                            ${shipment.status_raw ? `<p style="color:rgba(255,255,255,0.65);font-size:0.65rem;margin:0.1rem 0 0;">${shipment.status_raw}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Movement history -->
            <div style="background:white;border:1px solid #e2e8f0;border-radius:0.875rem;overflow:hidden;">
                <div style="padding:0.75rem 0.875rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;">
                    <span style="font-size:0.7rem;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.07em;">
                        <i class="fa-solid fa-timeline" style="color:#2563eb;margin-right:0.4rem;"></i>Movement History
                    </span>
                    ${movements.length ? `<span style="background:#eff6ff;color:#2563eb;font-size:0.62rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:2rem;">${movements.length} events</span>` : ''}
                </div>
                <!-- Desktop table -->
                <div id="sm-mov-desktop" style="display:${isMobile?'none':'block'};">
                    ${movRows ? `<table style="width:100%;border-collapse:collapse;">
                        <thead><tr style="background:#f8fafc;position:sticky;top:0;">
                            <th style="text-align:left;padding:0.5rem 0.875rem;font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Date</th>
                            <th style="text-align:left;padding:0.5rem 0.875rem;font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Time</th>
                            <th style="text-align:left;padding:0.5rem 0.875rem;font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Location</th>
                            <th style="text-align:left;padding:0.5rem 0.875rem;font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Activity</th>
                            <th style="text-align:left;padding:0.5rem 0.875rem;font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Sys Time</th>
                        </tr></thead>
                        <tbody>${movRows}</tbody>
                    </table>` : noMov}
                </div>
                <!-- Mobile cards -->
                <div id="sm-mov-mobile" style="display:${isMobile?'block':'none'};padding:0.75rem;">
                    ${movCards || noMov}
                </div>
            </div>
        </div>`;

    rc.classList.remove('hidden');
    document.getElementById('sm-result-wrap').style.display = 'block';

    // Responsive toggle on resize
    const desktop   = rc.querySelector('#sm-mov-desktop');
    const mobile    = rc.querySelector('#sm-mov-mobile');
    const infoDesk  = rc.querySelector('#sm-info-desktop');
    const infoMob   = rc.querySelector('#sm-info-mobile');
    const _resize = () => {
        const mob = window.innerWidth <= 640;
        if (desktop)  desktop.style.display  = mob ? 'none'  : 'table';
        if (mobile)   mobile.style.display   = mob ? 'block' : 'none';
        if (infoDesk) infoDesk.style.display = mob ? 'none'  : 'table';
        if (infoMob)  infoMob.style.display  = mob ? 'flex'  : 'none';
    };
    window.removeEventListener('resize', _smResizeHandler);
    _smResizeHandler = _resize;
    window.addEventListener('resize', _resize);
}

// ============================================================================
// Per-carrier table definitions (from searchpinweb.js)
// ============================================================================
// cols  = desktop column headers (array of {k, l, t})
// rows  = function(r) → array of row objects (for carriers with sub-rows like areas)
// If rows is null, single row from r itself
var _SM_CARRIER_TABLES = window._SM_CARRIER_TABLES || {
    Jetline: {
        cols: [
            { k: 'pincode', l: 'Pincode' },
            { k: 'city',    l: 'City Name' },
            { k: 'area',    l: 'Area Name' },
            { k: 'state',   l: 'State' },
            { k: 'dox',     l: 'Dox',           t: 'yn' },
            { k: 'ndox',    l: 'Ndox',          t: 'yn' },
            { k: 'topay',   l: 'Topay',         t: 'yn' },
            { k: 'cod',     l: 'Cod',           t: 'yn' },
            { k: 'secure',  l: 'Secure',        t: 'yn' },
            { k: 'reverse_pickup', l: 'ReversePickup', t: 'yn' },
            { k: 'oda',     l: 'Oda',           t: 'yn' },
        ],
        rows: null,
    },
    Airways: {
        cols: [
            { k: 'pincode', l: 'Pincode' },
            { k: 'city',    l: 'City' },
            { k: 'state',   l: 'State' },
            { k: 'zone',    l: 'Zone' },
            { k: 'area',    l: 'Area' },
            { k: 'oda',     l: 'ODA', t: 'yn' },
        ],
        rows: null,
    },
    Trackon: {
        cols: [
            { k: 'city',             l: 'City' },
            { k: 'state',            l: 'State' },
            { k: 'branch',           l: 'Branch' },
            { k: 'dox',              l: 'Dox',        t: 'yn' },
            { k: 'non_dox',          l: 'Non-Dox',    t: 'yn' },
            { k: 'smart_express',    l: 'Smart Exp',  t: 'yn' },
            { k: 'to_pay',           l: 'To-Pay',     t: 'yn' },
            { k: 'std_oda',          l: 'STD-ODA',    t: 'yn' },
            { k: 'road_exp',         l: 'Road Exp',   t: 'yn' },
            { k: 'road_oda',         l: 'Road ODA',   t: 'yn' },
            { k: 'prime',            l: 'Prime',      t: 'yn' },
            { k: 'prime_plus_12pm',  l: 'Prime +12PM',t: 'yn' },
            { k: 'e_xpress',         l: 'e-Xpress',   t: 'yn' },
            { k: 'reverse_pickup',   l: 'Rev Pickup', t: 'yn' },
            { k: 'ops_bm_contactno', l: 'Contact' },
        ],
        rows: null,
    },
    TPC: {
        cols: [
            { k: 'area',        l: 'Area' },
            { k: 'standard',    l: 'Standard',    t: 'yn' },
            { k: 'doc',         l: 'Doc',         t: 'yn' },
            { k: 'parcel',      l: 'Parcel',      t: 'yn' },
            { k: 'pro_premium', l: 'Pro Premium', t: 'yn' },
            { k: 'cod',         l: 'COD',         t: 'yn' },
            { k: 'std_freq',    l: 'Std Freq' },
            { k: 'timing',      l: 'Timing' },
        ],
        rows: r => r.areas || [],
    },
    ShreeMaruti: {
        cols: [
            { k: 'hub',       l: 'Hub' },
            { k: 'area',      l: 'Area' },
            { k: 'area_type', l: 'Type' },
        ],
        rows: r => (r.areas || []).map(a => ({ hub: r.hub, area: a.area, area_type: a.type })),
    },
    Skyking: {
        cols: [
            { k: 'district',    l: 'District' },
            { k: 'state',       l: 'State' },
            { k: 'area',        l: 'Area' },
            { k: 'serviceable', l: 'Serviceable', t: 'yn' },
        ],
        rows: r => (r.areas || []).map(a => ({ district: r.district, state: r.state, area: a.area, serviceable: a.serviceable })),
    },
    PostOffice: {
        cols: [
            { k: 'district', l: 'District' },
            { k: 'state',    l: 'State' },
            { k: 'name',     l: 'Post Office' },
            { k: 'type',     l: 'Type' },
            { k: 'delivery', l: 'Delivery', t: 'yn' },
        ],
        rows: r => (r.offices || []).map(o => ({ district: r.district, state: r.state, name: o.name, type: o.type, delivery: o.delivery })),
    },
    ShreeAnjani: {
        cols: [
            { k: 'center',    l: 'Center' },
            { k: 'franchise', l: 'Franchise' },
            { k: 'contact',   l: 'Contact' },
            { k: 'hub',       l: 'Hub' },
        ],
        rows: r => r.centers || [],
    },
};

let _smPincodeResizeHandler = null;
let _smPincodeLastData = null;

// ============================================================================
// Pincode render helpers
// ============================================================================
function _smPmVal(v, t) {
    if (t === 'yn') {
        if (v === true  || v === 'Y' || v === 'YES' || v === 'Yes') return '<span style="color:#15803d;font-weight:700;">Y</span>';
        if (v === false || v === 'N' || v === 'NO'  || v === 'No')  return '<span style="color:#b91c1c;">N</span>';
    }
    if (v === null || v === undefined || v === '') return '<span style="color:#cbd5e1;">—</span>';
    return String(v);
}

function _smDesktopTable(def, r) {
    const cols = def.cols;
    const dataRows = def.rows ? def.rows(r) : [r];
    if (!dataRows.length) return '<p style="padding:0.5rem 0.75rem;font-size:0.72rem;color:#94a3b8;">No data</p>';
    let thead = '';
    for (let j = 0; j < cols.length; j++) {
        thead += '<th style="padding:0.4rem 0.65rem;font-size:0.6rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;white-space:nowrap;">' + cols[j].l + '</th>';
    }
    let tbody = '';
    for (let i = 0; i < dataRows.length; i++) {
        let tds = '';
        for (let j = 0; j < cols.length; j++) {
            tds += '<td style="padding:0.4rem 0.65rem;font-size:0.75rem;color:#374151;border-bottom:1px solid #f1f5f9;white-space:nowrap;' + (i === 0 ? 'font-weight:600;' : '') + '">' + _smPmVal(dataRows[i][cols[j].k], cols[j].t) + '</td>';
        }
        tbody += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9fafb') + ';">' + tds + '</tr>';
    }
    return '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table></div>';
}

function _smMobileCards(def, r) {
    const cols = def.cols;
    const dataRows = def.rows ? def.rows(r) : [r];
    if (!dataRows.length) return '<p style="padding:0.5rem;font-size:0.72rem;color:#94a3b8;">No data</p>';
    let html = '';
    for (let i = 0; i < dataRows.length; i++) {
        let rows = '';
        for (let j = 0; j < cols.length; j++) {
            const v = _smPmVal(dataRows[i][cols[j].k], cols[j].t);
            rows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:0.6rem;color:#9C2007;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">' + cols[j].l + '</span><span style="font-size:0.75rem;font-weight:600;color:#1e293b;text-align:right;">' + v + '</span></div>';
        }
        html += '<div style="border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.65rem;margin-bottom:0.4rem;background:' + (i % 2 === 0 ? '#fff' : '#f9fafb') + ';">' + rows + '</div>';
    }
    return html;
}

function _smAutoDef(r) {
    const skip = { carrier: 1, serviceable: 1, _via: 1, pincode: 1, couriers: 1, areas: 1, offices: 1, centers: 1 };
    const cols = [];
    for (const k of Object.keys(r)) {
        if (skip[k] || r[k] === null || r[k] === undefined) continue;
        const l = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const t = (typeof r[k] === 'boolean') ? 'yn' : undefined;
        cols.push({ k, l, t });
    }
    return { cols, rows: null };
}

function _smCarrierBlock(r, isMob) {
    const def = _SM_CARRIER_TABLES[r.carrier] || _smAutoDef(r);
    const svc = r.serviceable;
    const borderColor = svc ? '#bbf7d0' : '#e2e8f0';
    const bgColor     = svc ? '#f0fdf4'  : '#f8fafc';
    const badge = svc
        ? '<span style="background:#dcfce7;color:#15803d;font-size:0.62rem;font-weight:700;padding:0.12rem 0.5rem;border-radius:2rem;white-space:nowrap;">✓ Serviceable</span>'
        : '<span style="background:#f1f5f9;color:#6b7280;font-size:0.62rem;font-weight:700;padding:0.12rem 0.5rem;border-radius:2rem;white-space:nowrap;">Not Serviceable</span>';
    const via = r._via ? '<span style="font-size:0.58rem;color:#6b7280;font-weight:600;">via ' + r._via + '</span>' : '';
    const body = isMob ? _smMobileCards(def, r) : _smDesktopTable(def, r);
    return '<div style="border:1px solid ' + borderColor + ';border-radius:0.625rem;overflow:hidden;background:#fff;margin-bottom:0.75rem;"><div style="padding:0.55rem 0.875rem;display:flex;justify-content:space-between;align-items:center;background:' + bgColor + ';border-bottom:1px solid ' + borderColor + ';"><div style="display:flex;flex-direction:column;gap:0.1rem;"><span style="font-size:0.82rem;font-weight:800;color:#1e293b;">' + r.carrier + '</span>' + via + '</div>' + badge + '</div>' + body + '</div>';
}

// ============================================================================
// Pincode search
// ============================================================================
async function _doPincodeSearch() {
    const pincode = document.getElementById('sm-pincode-input').value.trim();
    if (!pincode || !/^[0-9]{6}$/.test(pincode)) { _showMsg('Enter a valid 6-digit pincode.', 'error'); return; }
    const token = typeof getSessionId === 'function' ? getSessionId() : '';
    if (!token) { _showMsg('Session expired.', 'error'); return; }
    const base = (window.CONSTANTS || {}).OPERATIONS_URL || '';
    _showLoader();
    try {
        const res = await fetch(`${base}/api/pincode?pincode=${pincode}`, { headers: { 'Authorization': `Bearer ${token}` } });
        _hideLoader();
        if (res.status === 401) { typeof handleLogout === 'function' && handleLogout(); return; }
        if (!res.ok) { _showMsg(`Request failed (${res.status}).`, 'error'); return; }
        const data = await res.json();
        _renderPincodeResult(data);
    } catch { _hideLoader(); _showMsg('Network error.', 'error'); }
}

function _renderPincodeResult(data) {
    _clearResult();
    _smPincodeLastData = data;
    const rc = document.getElementById('sm-result');
    if (!rc) return;

    let results = data.results || [];
    const errors = data.errors || [];

    // Expand Shiprocket couriers into individual rows
    const expanded = [];
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.carrier === 'Shiprocket' && Array.isArray(r.couriers) && r.couriers.length) {
            for (const c of r.couriers) {
                expanded.push({
                    carrier: c.name, serviceable: true, _via: 'Shiprocket',
                    cod: c.cod, surface: c.surface, oda: c.oda, etd: c.etd, days: c.days,
                });
            }
        } else {
            expanded.push(r);
        }
    }
    results = expanded;

    const isMob = window.innerWidth <= 640;
    const serviceable = results.filter(r => r.serviceable);
    const notServiced = results.filter(r => !r.serviceable);

    const svcBadge = serviceable.length
        ? '<span style="background:#dcfce7;color:#15803d;font-size:0.68rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:2rem;">' + serviceable.length + ' serviceable</span>'
        : '<span style="background:#fef2f2;color:#b91c1c;font-size:0.68rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:2rem;">None serviceable</span>';

    let html = '<div style="font-family:Inter,sans-serif;"><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.875rem;"><i class="fa-solid fa-location-dot" style="color:#9C2007;font-size:0.9rem;"></i><span style="font-size:0.9rem;font-weight:800;color:#1e293b;">' + data.pincode + '</span>' + svcBadge + '</div>';

    if (serviceable.length) {
        html += '<p style="font-size:0.62rem;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 0.5rem;"><i class="fa-solid fa-circle-check" style="margin-right:0.25rem;"></i>' + serviceable.length + ' Carrier' + (serviceable.length > 1 ? 's' : '') + ' Service This Pincode</p>';
        for (const r of serviceable) html += _smCarrierBlock(r, isMob);
    }

    if (notServiced.length) {
        html += '<p style="font-size:0.62rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em;margin:0.75rem 0 0.5rem;"><i class="fa-solid fa-circle-xmark" style="margin-right:0.25rem;"></i>' + notServiced.length + ' Not Servicing</p>';
        for (const r of notServiced) html += _smCarrierBlock(r, isMob);
    }

    if (errors.length) {
        let errItems = '';
        for (const e of errors) {
            const ec = String(e.carrier || '').replace(/[<>"&]/g, function(c) { return {'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]; });
            const em = String(e.error || '').replace(/[<>"&]/g, function(c) { return {'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]; });
            errItems += '<div style="font-size:0.65rem;color:#b91c1c;background:#fef2f2;padding:0.3rem 0.6rem;border-radius:0.375rem;">' + ec + ': ' + em + '</div>';
        }
        html += '<details style="margin-top:0.5rem;"><summary style="font-size:0.68rem;color:#9ca3af;cursor:pointer;font-weight:600;">' + errors.length + ' scraper error' + (errors.length > 1 ? 's' : '') + ' (click to expand)</summary><div style="margin-top:0.4rem;display:flex;flex-direction:column;gap:0.25rem;">' + errItems + '</div></details>';
    }

    if (!results.length && !errors.length) {
        html += '<p style="text-align:center;color:#94a3b8;font-size:0.78rem;padding:1.5rem;">No data returned.</p>';
    }

    html += '</div>';
    rc.innerHTML = html;
    rc.classList.remove('hidden');
    document.getElementById('sm-result-wrap').style.display = 'block';

    // Resize handler: re-render on desktop/mobile toggle
    window.removeEventListener('resize', _smPincodeResizeHandler);
    _smPincodeResizeHandler = function() { if (_smPincodeLastData) _renderPincodeResult(_smPincodeLastData); };
    window.addEventListener('resize', _smPincodeResizeHandler);
}

// ============================================================================
// Helpers
// ============================================================================
function _showMsg(text, type) {
    _hideLoader();
    const el = document.getElementById('sm-msg');
    if (!el) return;
    el.textContent = text;
    el.style.background = type === 'error' ? '#fef2f2' : '#eff6ff';
    el.style.color       = type === 'error' ? '#b91c1c'  : '#1d4ed8';
    el.classList.remove('hidden');
    document.getElementById('sm-result-wrap').style.display = 'block';
}

function _showLoader() {
    document.getElementById('sm-msg')?.classList.add('hidden');
    document.getElementById('sm-result')?.classList.add('hidden');
    document.getElementById('sm-loader')?.classList.remove('hidden');
    document.getElementById('sm-result-wrap').style.display = 'block';
}

function _hideLoader() {
    document.getElementById('sm-loader')?.classList.add('hidden');
}

function _clearResult() {
    document.getElementById('sm-msg')?.classList.add('hidden');
    document.getElementById('sm-result')?.classList.add('hidden');
    document.getElementById('sm-result-wrap').style.display = 'none';
    const rc = document.getElementById('sm-result');
    if (rc) rc.innerHTML = '';
    // Clean up pincode resize handler to avoid stale re-renders
    _smPincodeLastData = null;
    window.removeEventListener('resize', _smPincodeResizeHandler);
}

// ============================================================================
// Public API
// ============================================================================
function openSearchModal() {
    _injectModal();
    const overlay = document.getElementById('sm-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    // reset
    _setMode('default');
    document.getElementById('sm-input').value = '';
    const pci = document.getElementById('sm-pincode-input');
    if (pci) pci.value = '';
    _clearResult();
    document.getElementById('sm-input').focus();
}

function closeSearchModal() {
    const overlay = document.getElementById('sm-overlay');
    if (overlay) overlay.style.display = 'none';
}

window.openSearchModal  = openSearchModal;
window.closeSearchModal = closeSearchModal;
