// utils/web-barcode.js — Web-only live barcode scanner for the RN web build.
//
// Mirror of utils/barcode.js (BarcodeDetector → ZXing fallback, same constraints
// cascade and center-60% decode crop) with one deliberate difference: ZXing is
// loaded from `window.location.origin + '/utils/zxing-browser.min.js'` instead of
// `import.meta.url`, because babel-preset-expo (Hermes) rejects `import.meta`
// syntax and would fail the whole Metro bundle if utils/barcode.js were imported.
//
//   const stop = startWebBarcodeScan(videoEl, (code) => {...}, (err) => {...});
//   stop(); // release camera + cancel the decode loop

const BARCODE_FORMATS = ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'itf', 'pdf417', 'data_matrix'];

let _rafId = null;
let _stream = null;

function _stop() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
}

async function _loadZXing() {
  if (window.ZXing) return window.ZXing;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = window.location.origin + '/utils/zxing-browser.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.ZXing;
}

async function _scanNative(video, canvas, onResult) {
  const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
  const ctx = canvas.getContext('2d');
  const tick = async () => {
    if (!_stream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const results = await detector.detect(canvas);
        if (results.length) { _stop(); onResult(results[0].rawValue); return; }
      } catch (_) {}
    }
    _rafId = requestAnimationFrame(tick);
  };
  _rafId = requestAnimationFrame(tick);
}

async function _scanZXing(video, canvas, onResult, onError) {
  try {
    const ZXing = await _loadZXing();
    const reader = new ZXing.MultiFormatReader();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.QR_CODE,  ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,    ZXing.BarcodeFormat.ITF,
      ZXing.BarcodeFormat.PDF_417,  ZXing.BarcodeFormat.DATA_MATRIX,
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    const ctx = canvas.getContext('2d');
    let last = 0;

    const tick = (ts) => {
      if (!_stream) return;
      if (ts - last < 150) { _rafId = requestAnimationFrame(tick); return; }
      last = ts;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        // Decode the center 60% of the frame, matching the visual scan box.
        const sw = Math.floor(video.videoWidth * 0.6);
        const sh = Math.floor(video.videoHeight * 0.6);
        const sx = Math.floor((video.videoWidth - sw) / 2);
        const sy = Math.floor((video.videoHeight - sh) / 2);
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        try {
          const lum = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
          for (const Bin of [ZXing.GlobalHistogramBinarizer, ZXing.HybridBinarizer]) {
            try {
              const result = reader.decode(new ZXing.BinaryBitmap(new Bin(lum)));
              if (result) { _stop(); onResult(result.getText()); return; }
            } catch (_) {}
          }
        } catch (_) {}
      }
      _rafId = requestAnimationFrame(tick);
    };
    _rafId = requestAnimationFrame(tick);
  } catch (e) {
    onError('Barcode scanner unavailable.');
  }
}

/**
 * Start scanning barcodes from a live camera stream attached to `videoEl`.
 * @param {HTMLVideoElement} videoEl  Raw <video> element (web only).
 * @param {(code: string) => void} onResult
 * @param {(message: string) => void} [onError]
 * @returns {() => void} stop function (release camera + cancel decode loop)
 */
export function startWebBarcodeScan(videoEl, onResult, onError = console.error) {
  _stop();

  // Same constraints cascade as utils/barcode.js (Firefox-safe HD ideals).
  const _camConstraints = [
    { facingMode: { exact: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 } },
    { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    { facingMode: { exact: 'environment' }, width: { ideal: 720 }, height: { ideal: 1280 } },
    { facingMode: { exact: 'environment' } },
    { facingMode: { ideal: 'environment' } },
  ];

  (async () => {
    let opened = false;
    for (const vc of _camConstraints) {
      try {
        _stream = await navigator.mediaDevices.getUserMedia({ video: vc });
        opened = true;
        break;
      } catch (_) {}
    }
    if (!opened) { onError('Camera access denied.'); return; }

    videoEl.srcObject = _stream;
    try { await videoEl.play(); } catch (_) {}

    const track = _stream.getVideoTracks()[0];
    if (track?.applyConstraints) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
    if ('ImageCapture' in window && track) {
      setTimeout(() => {
        try { new ImageCapture(track).grabFrame().catch(() => {}); } catch (_) {}
      }, 600);
    }

    const canvas = document.createElement('canvas');
    if ('BarcodeDetector' in window) {
      _scanNative(videoEl, canvas, onResult);
    } else {
      _scanZXing(videoEl, canvas, onResult, onError);
    }
  })();

  return _stop;
}
