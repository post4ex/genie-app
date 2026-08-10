// ============================================================================
// GEO.JS — Geolocation helpers
// ============================================================================

/**
 * Get current GPS position as "lat,lon" string.
 * @param {object} [opts]
 * @param {function} opts.onStart   — called before GPS request (e.g. show spinner)
 * @param {function} opts.onSuccess — called with coords string "lat,lon"
 * @param {function} opts.onError   — called with error message string
 * @param {number}   [opts.decimals=6] — decimal precision
 */
function geoGetPosition({ onStart, onSuccess, onError, decimals = 6 } = {}) {
    if (!navigator.geolocation) {
        onError?.('GPS not supported on this device');
        return;
    }
    
    // Show global loading indicator
    document.documentElement.classList.add('needs-sync');
    
    onStart?.();

    const _toCoords = pos => {
        document.documentElement.classList.remove('needs-sync');
        return `${pos.coords.latitude.toFixed(decimals)},${pos.coords.longitude.toFixed(decimals)}`;
    };

    const _errCallback = err => {
        document.documentElement.classList.remove('needs-sync');
        onError?.(err);
    };

    const _errMsg = err => err.code === 1
        ? 'Location permission denied — allow it in browser settings.'
        : 'Could not get location. Try again.';

    // Pass 1 — low accuracy, accept cached position (warms up GPS chip)
    navigator.geolocation.getCurrentPosition(
        pos => {
            // Got a quick fix — now request high accuracy
            navigator.geolocation.getCurrentPosition(
                pos2 => onSuccess?.(_toCoords(pos2)),
                ()   => onSuccess?.(_toCoords(pos)), // high-acc failed, use low-acc result
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        },
        err => {
            // Low-acc also failed — try high accuracy as last resort
            navigator.geolocation.getCurrentPosition(
                pos => onSuccess?.(_toCoords(pos)),
                err2 => _errCallback(_errMsg(err2)),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
    );
}

/**
 * Calculate distance in km between two "lat,lon" strings using Haversine.
 * Returns distance as string fixed to 2 decimals, or null if inputs are invalid.
 * @param {string} coords1 — "lat,lon"
 * @param {string} coords2 — "lat,lon"
 * @returns {string|null}
 */
function geoCalcDistance(coords1, coords2) {
    if (!coords1 || !coords2) return null;
    const [lat1, lon1] = coords1.split(',').map(Number);
    const [lat2, lon2] = coords2.split(',').map(Number);
    if ([lat1, lon1, lat2, lon2].some(isNaN)) return null;
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

/**
 * Wire a GPS button to capture position into an input element.
 * @param {HTMLButtonElement} btn        — the button element
 * @param {HTMLInputElement}  input      — the input to fill with "lat,lon"
 * @param {object}            [opts]
 * @param {string}            [opts.label='GPS'] — button label text
 */
function geoWireButton(btn, input, { label = 'GPS' } = {}) {
    const txtEl = btn.querySelector('[data-geo-label]') || btn;
    btn.addEventListener('click', () => {
        geoGetPosition({
            onStart:   () => { txtEl.textContent = '…'; btn.disabled = true; },
            onSuccess: coords => { input.value = coords; txtEl.textContent = label; btn.disabled = false; },
            onError:   msg    => { showNotification('⚠️ ' + msg, 'error'); txtEl.textContent = label; btn.disabled = false; },
        });
    });
}

window.geoGetPosition  = geoGetPosition;
window.geoCalcDistance = geoCalcDistance;
window.geoWireButton   = geoWireButton;
