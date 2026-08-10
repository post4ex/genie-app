// ============================================================================
// SEARCHPINWEB.JS — Pincode Search Modal
// ============================================================================
// Public API: openPincodeModal(), closePincodeModal()

// Per-carrier table definitions: { cols, rows }
// cols  = desktop column headers (array of {k, l, t})
// rows  = function(r) → array of row objects (for carriers with sub-rows like areas)
// If rows is null, single row from r itself
var _PM_CARRIER_TABLES = window._PM_CARRIER_TABLES || {
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
    // Shiprocket sub-carriers (via expansion) — auto-fields handles these
};

var _pmResizeHandler = window._pmResizeHandler || null;
var _pmLastData = window._pmLastData || null;

// ============================================================================
// Modal shell
// ============================================================================
function _injectPincodeModal() {
    if (document.getElementById('pm-overlay')) return;
    if (!document.getElementById('pm-style')) {
        const s = document.createElement('style');
        s.id = 'pm-style';
        s.textContent = '@media(max-width:640px){.pm-search-label{display:none;} #pm-input{width:5.5rem;} #pm-search-btn{padding:0.45rem 0.65rem;}}';
        document.head.appendChild(s);
    }
    document.body.insertAdjacentHTML('beforeend', `
<div id="pm-overlay" role="dialog" aria-modal="true" aria-label="Pincode Search"
     style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);
            backdrop-filter:blur(4px);justify-content:center;align-items:flex-start;
            padding-top:3rem;" tabindex="-1">
    <div id="pm-box" style="background:#fff;border-radius:1rem;box-shadow:0 24px 64px rgba(0,0,0,0.18);
                             width:100%;max-width:1200px;max-height:90vh;overflow-y:auto;
                             display:flex;flex-direction:column;margin:0 1rem;">
        <div style="padding:0.75rem 1.25rem;border-bottom:1px solid #f1f5f9;display:flex;
                    align-items:center;gap:0.75rem;flex-shrink:0;
                    background:linear-gradient(to right,#f8fafc,#fff);position:sticky;top:0;z-index:1;">
            <i class="fa-solid fa-location-dot" style="color:#9C2007;font-size:0.9rem;flex-shrink:0;"></i>
            <input id="pm-input" type="text" inputmode="numeric" maxlength="6"
                   placeholder="6-digit pincode"
                   style="width:7rem;flex:none;padding:0.45rem 0.75rem;border:1px solid #e2e8f0;
                          border-radius:0.5rem;font-size:0.82rem;outline:none;color:#1e293b;text-align:center;letter-spacing:0.1em;" />
            <button id="pm-search-btn"
                style="padding:0.45rem 1rem;background:#9C2007;color:#fff;border:none;
                       border-radius:0.5rem;font-size:0.8rem;font-weight:700;cursor:pointer;
                       white-space:nowrap;flex-shrink:0;">
                <i class="fa-solid fa-magnifying-glass"></i><span class="pm-search-label" style="margin-left:0.3rem;">Search</span>
            </button>
            <div style="flex:1;"></div>
            <button id="pm-close" aria-label="Close"
                style="display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;
                       border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;
                       color:#374151;font-size:1.1rem;flex-shrink:0;"
                onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                &#x2715;
            </button>
        </div>
        <div id="pm-result-wrap" style="padding:1rem 1.25rem;display:none;">
            <div id="pm-msg" style="display:none;padding:0.6rem 0.875rem;border-radius:0.5rem;
                                    font-size:0.78rem;font-weight:600;text-align:center;margin-bottom:0.75rem;"></div>
            <div id="pm-loader" style="display:none;text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem;margin-bottom:0.5rem;display:block;"></i>
                Checking all carriers&hellip;
            </div>
            <div id="pm-result" style="display:none;"></div>
        </div>
    </div>
</div>`);
    _bindPincodeEvents();
}

function _bindPincodeEvents() {
    document.getElementById('pm-close').addEventListener('click', closePincodeModal);
    document.getElementById('pm-overlay').addEventListener('click', e => {
        if (e.target === document.getElementById('pm-overlay')) closePincodeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePincodeModal(); });
    document.getElementById('pm-search-btn').addEventListener('click', _doPincodeSearch);
    document.getElementById('pm-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') _doPincodeSearch();
    });
}

// ============================================================================
// API call
// ============================================================================
async function _doPincodeSearch() {
    let input = document.getElementById('pm-input');
    if (!input) {
        _injectPincodeModal();
        input = document.getElementById('pm-input');
        if (!input) return;
    }
    const pincode = input.value.trim();
    const _pinValid = typeof InputValidator !== 'undefined'
        ? InputValidator.pin
        : v => !v || /^[0-9]{6}$/.test(v);
    if (!pincode || !_pinValid(pincode)) { _pmShowMsg('Enter a valid 6-digit pincode.', 'error'); return; }
    const token = typeof getSessionId === 'function' ? getSessionId() : '';
    if (!token) { _pmShowMsg('Session expired. Please log in again.', 'error'); return; }
    const base = (window.CONSTANTS || {}).OPERATIONS_URL || '';
    _pmShowLoader();
    try {
        const res = await fetch(`${base}/api/pincode?pincode=${pincode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        _pmHideLoader();
        if (res.status === 401) { typeof handleLogout === 'function' && handleLogout(); return; }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            _pmShowMsg(body.detail || `Request failed (${res.status}).`, 'error'); return;
        }
        const data = await res.json();
        _renderPincodeResult(data);
    } catch (e) {
        _pmHideLoader();
        _pmShowMsg('Network error. Please check your connection.', 'error');
    }
}

// ============================================================================
// Render helpers
// ============================================================================
function _pmVal(v, t) {
    if (t === 'yn') {
        if (v === true  || v === 'Y' || v === 'YES' || v === 'Yes') return '<span style="color:#15803d;font-weight:700;">Y</span>';
        if (v === false || v === 'N' || v === 'NO'  || v === 'No')  return '<span style="color:#b91c1c;">N</span>';
    }
    if (v === null || v === undefined || v === '') return '<span style="color:#cbd5e1;">—</span>';
    return String(v);
}

// Build desktop <table> for a carrier
function _pmDesktopTable(def, r) {
    const cols = def.cols;
    const dataRows = def.rows ? def.rows(r) : [r];
    if (!dataRows.length) return '<p style="padding:0.5rem 0.75rem;font-size:0.72rem;color:#94a3b8;">No data</p>';

    let thead = '';
    for (let j = 0; j < cols.length; j++) {
        thead += `<th style="padding:0.4rem 0.65rem;font-size:0.6rem;font-weight:700;color:#6b7280;text-transform:uppercase;
                             letter-spacing:0.05em;text-align:left;border-bottom:1px solid #e2e8f0;
                             background:#f8fafc;white-space:nowrap;">${cols[j].l}</th>`;
    }

    let tbody = '';
    for (let i = 0; i < dataRows.length; i++) {
        let tds = '';
        for (let j = 0; j < cols.length; j++) {
            tds += `<td style="padding:0.4rem 0.65rem;font-size:0.75rem;color:#374151;
                               border-bottom:1px solid #f1f5f9;white-space:nowrap;
                               ${i === 0 ? 'font-weight:600;' : ''}">${_pmVal(dataRows[i][cols[j].k], cols[j].t)}</td>`;
        }
        tbody += `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">${tds}</tr>`;
    }

    return `<div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr>${thead}</tr></thead>
            <tbody>${tbody}</tbody>
        </table>
    </div>`;
}

// Build mobile cards for a carrier
function _pmMobileCards(def, r) {
    const cols = def.cols;
    const dataRows = def.rows ? def.rows(r) : [r];
    if (!dataRows.length) return '<p style="padding:0.5rem;font-size:0.72rem;color:#94a3b8;">No data</p>';

    let html = '';
    for (let i = 0; i < dataRows.length; i++) {
        let rows = '';
        for (let j = 0; j < cols.length; j++) {
            const v = _pmVal(dataRows[i][cols[j].k], cols[j].t);
            rows += `<div style="display:flex;justify-content:space-between;align-items:center;
                                 padding:0.3rem 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:0.6rem;color:#9C2007;font-weight:700;text-transform:uppercase;
                             letter-spacing:0.06em;">${cols[j].l}</span>
                <span style="font-size:0.75rem;font-weight:600;color:#1e293b;text-align:right;">${v}</span>
            </div>`;
        }
        html += `<div style="border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.65rem;
                             margin-bottom:0.4rem;background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">${rows}</div>`;
    }
    return html;
}

// Auto-build def for unknown carriers (Shiprocket sub-carriers)
function _pmAutoDef(r) {
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

// One carrier block: header + desktop table (hidden on mobile) + mobile cards (hidden on desktop)
function _pmCarrierBlock(r, isMob) {
    const def = _PM_CARRIER_TABLES[r.carrier] || _pmAutoDef(r);
    const svc = r.serviceable;
    const borderColor = svc ? '#bbf7d0' : '#e2e8f0';
    const bgColor     = svc ? '#f0fdf4'  : '#f8fafc';
    const badge = svc
        ? '<span style="background:#dcfce7;color:#15803d;font-size:0.62rem;font-weight:700;padding:0.12rem 0.5rem;border-radius:2rem;white-space:nowrap;">✓ Serviceable</span>'
        : '<span style="background:#f1f5f9;color:#6b7280;font-size:0.62rem;font-weight:700;padding:0.12rem 0.5rem;border-radius:2rem;white-space:nowrap;">Not Serviceable</span>';
    const via = r._via ? `<span style="font-size:0.58rem;color:#6b7280;font-weight:600;">via ${r._via}</span>` : '';

    const body = isMob ? _pmMobileCards(def, r) : _pmDesktopTable(def, r);

    return `<div style="border:1px solid ${borderColor};border-radius:0.625rem;overflow:hidden;background:#fff;margin-bottom:0.75rem;">
        <div style="padding:0.55rem 0.875rem;display:flex;justify-content:space-between;align-items:center;
                    background:${bgColor};border-bottom:1px solid ${borderColor};">
            <div style="display:flex;flex-direction:column;gap:0.1rem;">
                <span style="font-size:0.82rem;font-weight:800;color:#1e293b;">${r.carrier}</span>
                ${via}
            </div>
            ${badge}
        </div>
        ${body}
    </div>`;
}

// ============================================================================
// Main render
// ============================================================================
function _renderPincodeResult(data) {
    _pmClearResult();
    _pmLastData = data;
    const rc = document.getElementById('pm-result');
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

    let html = '';

    // summary row
    const svcBadge = serviceable.length
        ? `<span style="background:#dcfce7;color:#15803d;font-size:0.68rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:2rem;">${serviceable.length} serviceable</span>`
        : `<span style="background:#fef2f2;color:#b91c1c;font-size:0.68rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:2rem;">None serviceable</span>`;
    html += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.875rem;">
        <i class="fa-solid fa-location-dot" style="color:#9C2007;font-size:0.9rem;"></i>
        <span style="font-size:0.9rem;font-weight:800;color:#1e293b;">${data.pincode}</span>
        ${svcBadge}
    </div>`;

    if (serviceable.length) {
        html += `<p style="font-size:0.62rem;font-weight:700;color:#15803d;text-transform:uppercase;
                           letter-spacing:0.07em;margin:0 0 0.5rem;">
            <i class="fa-solid fa-circle-check" style="margin-right:0.25rem;"></i>
            ${serviceable.length} Carrier${serviceable.length > 1 ? 's' : ''} Service This Pincode</p>`;
        for (const r of serviceable) html += _pmCarrierBlock(r, isMob);
    }

    if (notServiced.length) {
        html += `<p style="font-size:0.62rem;font-weight:700;color:#9ca3af;text-transform:uppercase;
                           letter-spacing:0.07em;margin:0.75rem 0 0.5rem;">
            <i class="fa-solid fa-circle-xmark" style="margin-right:0.25rem;"></i>
            ${notServiced.length} Not Servicing</p>`;
        for (const r of notServiced) html += _pmCarrierBlock(r, isMob);
    }

    if (errors.length) {
        let errItems = '';
        for (const e of errors) {
            const ec = String(e.carrier || '').replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
            const em = String(e.error   || '').replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
            errItems += `<div style="font-size:0.65rem;color:#b91c1c;background:#fef2f2;padding:0.3rem 0.6rem;border-radius:0.375rem;">${ec}: ${em}</div>`;
        }
        html += `<details style="margin-top:0.5rem;">
            <summary style="font-size:0.68rem;color:#9ca3af;cursor:pointer;font-weight:600;">
                ${errors.length} scraper error${errors.length > 1 ? 's' : ''} (click to expand)
            </summary>
            <div style="margin-top:0.4rem;display:flex;flex-direction:column;gap:0.25rem;">${errItems}</div>
        </details>`;
    }

    if (!results.length && !errors.length) {
        html += '<p style="text-align:center;color:#94a3b8;font-size:0.78rem;padding:1.5rem;">No data returned.</p>';
    }

    rc.innerHTML = `<div style="font-family:'Inter',sans-serif;">${html}</div>`;
    rc.style.display = 'block';
    document.getElementById('pm-result-wrap').style.display = 'block';

    window.removeEventListener('resize', _pmResizeHandler);
    _pmResizeHandler = () => { if (_pmLastData) _renderPincodeResult(_pmLastData); };
    window.addEventListener('resize', _pmResizeHandler);
}

// ============================================================================
// Helpers
// ============================================================================
function _pmShowMsg(text, type) {
    _pmHideLoader();
    const el = document.getElementById('pm-msg');
    if (!el) return;
    el.textContent = text;
    el.style.background = type === 'error' ? '#fef2f2' : '#eff6ff';
    el.style.color       = type === 'error' ? '#b91c1c'  : '#1d4ed8';
    el.style.display = 'block';
    document.getElementById('pm-result-wrap').style.display = 'block';
}
function _pmShowLoader() {
    document.getElementById('pm-msg').style.display    = 'none';
    document.getElementById('pm-result').style.display = 'none';
    document.getElementById('pm-loader').style.display = 'block';
    document.getElementById('pm-result-wrap').style.display = 'block';
}
function _pmHideLoader() {
    document.getElementById('pm-loader').style.display = 'none';
}
function _pmClearResult() {
    _pmLastData = null;
    document.getElementById('pm-msg').style.display    = 'none';
    const rc = document.getElementById('pm-result');
    if (rc) { rc.style.display = 'none'; rc.innerHTML = ''; }
    document.getElementById('pm-result-wrap').style.display = 'none';
}

// ============================================================================
// Public API
// ============================================================================
function openPincodeModal() {
    _injectPincodeModal();
    const overlay = document.getElementById('pm-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('pm-input').value = '';
    _pmClearResult();
    document.getElementById('pm-input').focus();
}
function closePincodeModal() {
    const overlay = document.getElementById('pm-overlay');
    if (overlay) overlay.style.display = 'none';
    window.removeEventListener('resize', _pmResizeHandler);
}

window.openPincodeModal  = openPincodeModal;
window.closePincodeModal = closePincodeModal;
