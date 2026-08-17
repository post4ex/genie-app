// utils/capture.js — Global "share an area as an image" utility.
// Capture any View ref as a PNG and deliver it:
//   native → saved to the documents directory + OS share sheet
//            (WhatsApp, gallery, Files…)
//   web    → .png browser download (expo-sharing is not available on web)
//
//   const areaRef = useRef(null);
//   <View ref={areaRef} collapsable={false}>…</View>
//   await shareViewAsImage(areaRef, { title: 'Tracking and History - Delivered' });
//
// Quality: pass `scale` (default 2) for a higher-resolution image.
//   • Web  → the DOM is re-rendered at that scale with html2canvas (real
//            detail, not an upscale).
//   • Native → the view-shot capture is already full device resolution; the
//            image is then resized up to `scale`× (capped at 4096px longest
//            side so tall panes can't exhaust memory).
//
// Notes:
//   • `collapsable={false}` on the captured View is required on Android so the
//     native view is not collapsed into its parent (uncapturable).
//   • Web capture is rendered with html2canvas, so external images must be
//     same-origin/CORS-safe.

import { Image, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Web-only: trigger a .png/.jpg download from a data URL.
function _downloadDataUrl(fileName, dataUrl) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 200);
}

function _resolveNode(ref) {
  // Accept a ref object ({ current }) or a raw DOM node / native tag.
  return ref && ref.current ? ref.current : ref;
}

function _mime(format) {
  return format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png';
}

// Native: capture at full device resolution, then optionally upscale (with a
// memory cap) so the shared image is larger and smoother.
async function _captureNative(ref, { format, quality, scale }) {
  const uri = await captureRef(ref, { format, quality, result: 'tmpfile' });
  let outUri = uri;
  if (scale && scale > 1) {
    try {
      const dims = await new Promise((resolve, reject) => {
        Image.getSize(uri, (w, h) => resolve({ w, h }), reject);
      });
      const longest = Math.max(dims.w, dims.h);
      const factor = Math.min(scale, 4096 / longest); // cap memory on tall panes
      if (factor > 1.05) {
        const resized = await manipulateAsync(
          uri,
          [{ resize: { width: Math.round(dims.w * factor), height: Math.round(dims.h * factor) } }],
          { compress: 1, format: format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG },
        );
        outUri = resized.uri;
      }
    } catch (_) {
      // Upscale is best-effort — keep the original capture on any failure.
    }
  }
  return outUri;
}

// Web: real high-resolution render via html2canvas (view-shot's web build
// doesn't expose a scale, so we drive html2canvas directly).
async function _captureWeb(ref, { format, quality, scale }) {
  const node = _resolveNode(ref);
  if (!node || typeof node.querySelectorAll !== 'function') {
    throw new Error('Could not find the view to capture.');
  }
  const html2canvas = require('html2canvas');
  const canvas = await html2canvas(node, {
    scale: scale || 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  return canvas.toDataURL(_mime(format), quality);
}

export async function shareViewAsImage(ref, { title = 'Share', format = 'png', quality = 1, scale = 2 } = {}) {
  const safe = String(title).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Share';

  if (Platform.OS === 'web') {
    const dataUrl = await _captureWeb(ref, { format, quality, scale });
    _downloadDataUrl(`${safe}.${format}`, dataUrl);
    return { fileName: `${safe}.${format}`, web: true };
  }

  // Native: capture, persist, then open the share sheet.
  const uri = await _captureNative(ref, { format, quality, scale });
  const dest = new File(Paths.document, `${safe}.${format}`);
  // copy() throws if the destination already exists — a repeat share of the
  // same title would fail. Remove any stale file first.
  if (dest.exists) dest.delete();
  new File(uri).copy(dest);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: _mime(format),
      dialogTitle: `${safe}.${format}`,
      UTI: format === 'png' ? 'public.png' : 'public.jpeg',
    });
  }
  return { uri: dest.uri, fileName: `${safe}.${format}` };
}

export default shareViewAsImage;
