// ============================================================================
// utils/barcode-scanner.js — Barcode scanning Web Components
//
// Provides two custom HTML elements:
//
//   <scan-barcode>
//     Auto-detects device type:
//       • Mobile  → opens inline camera stream, scans in real-time
//       • Desktop → opens file picker, decodes barcode from selected image
//     Attributes:
//       label="…"   — button text (default: "Scan Barcode")
//       icon-only   — show camera icon only, no label
//
//   <read-barcode>
//     Always opens a file/image picker regardless of device.
//     Use when you explicitly want image-based decoding on any device.
//     Attributes: same as <scan-barcode> (default label: "Read from Image")
//
// Both elements fire the same events (bubbles up the DOM):
//   scanned    → e.detail.value   — the decoded barcode string
//   scan-error → e.detail.message — human-readable error description
//
// Usage:
//   <script type="module" src="utils/barcode-scanner.js"></script>
//
//   <scan-barcode id="s"></scan-barcode>
//   <script>
//     document.getElementById('s').addEventListener('scanned', e => {
//       console.log(e.detail.value);
//     });
//   </script>
// ============================================================================

import { scanBarcode, stopBarcode, readBarcodeFromImage } from './barcode.js';

const _isMobile = () => ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const _SCAN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 00-1 1v3M7 8h10M7 12h10M7 16h4"/>
</svg>`;

const _IMG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4-4 4 4 4-6 4 6M4 6h16"/>
</svg>`;

const _INLINE_SCANNER = `
<style>
    @keyframes laserScan {
        0%, 100% { top: 0%; }
        50% { top: 100%; }
    }
</style>
<div class="scan-wrap" style="display:none;position:fixed;left:0;width:100vw;height:100vw;top:50%;transform:translateY(-50%);z-index:99999;background:#000;box-shadow:0 0 40px rgba(0,0,0,0.65);overflow:hidden;">
    <video muted playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>
    <div style="position:absolute;inset:15%;border:2px solid rgba(255,255,255,0.45);border-radius:8px;pointer-events:none;">
        <!-- Corners -->
        <div style="position:absolute;top:0;left:0;width:20px;height:20px;border-top:4px solid #ef4444;border-left:4px solid #ef4444;border-radius:4px 0 0 0;"></div>
        <div style="position:absolute;top:0;right:0;width:20px;height:20px;border-top:4px solid #ef4444;border-right:4px solid #ef4444;border-radius:0 4px 0 0;"></div>
        <div style="position:absolute;bottom:0;left:0;width:20px;height:20px;border-bottom:4px solid #ef4444;border-left:4px solid #ef4444;border-radius:0 0 0 4px;"></div>
        <div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-bottom:4px solid #ef4444;border-right:4px solid #ef4444;border-radius:0 0 4px 0;"></div>
        <!-- Laser -->
        <div style="position:absolute;left:5%;right:5%;height:2px;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:laserScan 2s infinite ease-in-out;"></div>
    </div>
    <!-- Cancel button at top-right -->
    <button class="scan-cancel" type="button" style="position:absolute;top:1rem;right:1rem;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:0.5rem;padding:0.5rem 1rem;font-size:0.75rem;font-weight:700;cursor:pointer;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">✕ Cancel</button>
    <!-- Hint at bottom -->
    <div style="position:absolute;bottom:1rem;left:0;right:0;text-align:center;color:#fff;font-size:0.75rem;font-weight:600;z-index:10;text-shadow:0 1px 3px rgba(0,0,0,0.8);pointer-events:none;">Align barcode within the square</div>
</div>`;

function _filePickerMode(host, icon, label) {
    host.innerHTML = `
        <button type="button" style="cursor:pointer;display:inline-flex;align-items:center;background:none;border:none;padding:0;">
            ${icon}${label ? `<span style="margin-left:0.25rem;">${label}</span>` : ''}
        </button>
        <input type="file" accept="image/*" style="display:none;">
        <span class="rb-status" style="display:none;font-size:0.75rem;color:#6b7280;margin-left:0.5rem;"></span>`;

    const btn    = host.querySelector('button');
    const input  = host.querySelector('input');
    const status = host.querySelector('.rb-status');

    let _picking = false;
    btn.addEventListener('click', () => {
        if (_picking) return;
        _picking = true;
        input.click();
        setTimeout(() => { _picking = false; }, 1000);
    });
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        input.value = '';
        status.textContent = 'Reading…'; status.style.display = 'inline';
        try {
            const value = await readBarcodeFromImage(file);
            status.style.display = 'none';
            host.dispatchEvent(new CustomEvent('scanned',    { bubbles: true, detail: { value } }));
        } catch (e) {
            status.style.display = 'none';
            host.dispatchEvent(new CustomEvent('scan-error', { bubbles: true, detail: { message: e.message } }));
        }
    });
}

// ── <scan-barcode> ────────────────────────────────────────────────────────────
class ScanBarcode extends HTMLElement {
    connectedCallback() {
        if (this._init) return;
        this._init = true;
        const iconOnly = this.hasAttribute('icon-only');
        const label    = iconOnly ? '' : (this.getAttribute('label') || 'Scan Barcode');

        if (_isMobile()) {
            // Render only the trigger button inside the component
            this.innerHTML = `
                <button class="scan-trigger" type="button" style="background:none;border:none;padding:0.25rem;cursor:pointer;color:rgba(0,0,0,0.45);display:inline-flex;align-items:center;">
                    ${_SCAN_ICON}${label ? `<span>${label}</span>` : ''}
                </button>`;

            // Inject overlay directly on <body> so position:fixed is never
            // trapped by a CSS transform/filter on an ancestor element.
            // NOTE: _INLINE_SCANNER starts with <style>, so we cannot use
            // firstElementChild — we wrap it in a div and querySelector instead.
            const tmp = document.createElement('div');
            tmp.innerHTML = _INLINE_SCANNER;
            document.body.appendChild(tmp);
            this._wrap = tmp; // keep ref to container for cleanup

            const wrap   = tmp.querySelector('.scan-wrap');
            const video  = tmp.querySelector('video');
            const cancel = tmp.querySelector('.scan-cancel');
            const close  = () => { stopBarcode(); wrap.style.display = 'none'; };

            this.querySelector('.scan-trigger').addEventListener('click', () => {
                wrap.style.display = 'block';
                scanBarcode(
                    video,
                    val => { close(); this.dispatchEvent(new CustomEvent('scanned',    { bubbles: true, detail: { value: val } })); },
                    msg => { close(); this.dispatchEvent(new CustomEvent('scan-error', { bubbles: true, detail: { message: msg } })); }
                );
            });
            cancel.addEventListener('click', close);
        } else {
            _filePickerMode(this, _SCAN_ICON, label);
        }
    }

    disconnectedCallback() {
        // Clean up body-level overlay container when element is removed
        if (this._wrap && this._wrap.parentNode) {
            stopBarcode();
            this._wrap.parentNode.removeChild(this._wrap);
            this._wrap = null;
        }
    }
}

customElements.define('scan-barcode', ScanBarcode);

// ── <read-barcode> ────────────────────────────────────────────────────────────
class ReadBarcode extends HTMLElement {
    connectedCallback() {
        if (this._init) return;
        this._init = true;
        const iconOnly = this.hasAttribute('icon-only');
        const label    = iconOnly ? '' : (this.getAttribute('label') || 'Read from Image');
        _filePickerMode(this, _IMG_ICON, label);
    }
}

customElements.define('read-barcode', ReadBarcode);
