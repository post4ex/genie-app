// utils/pdf.js — Global PDF bundling (the "download as PDF" action).
// One cross-platform entry so ANY screen can bundle HTML into a PDF:
//
//   import { bundleHtmlAsPdf } from '../utils/pdf';
//   await bundleHtmlAsPdf({ title: 'Label - 1234', html: docHtml });
//
//   Native → expo-print printToFileAsync renders the HTML into a real PDF
//            (same engine as printing), saved to the documents directory,
//            then the OS save/share sheet opens (application/pdf).
//   Web    → the HTML is rendered inside a hidden same-origin iframe (so the
//            document's <style> never bleeds into the app) and html2pdf.js
//            (loaded on demand from a CDN, same convention as the uploader's
//            web libs) produces a .pdf browser download.
//
// Options:
//   title      – file name (sanitized; `.pdf` appended)
//   html       – the HTML body to bundle
//   fullHtml   – (web) a complete HTML document string; defaults to a minimal
//                wrap of `html`
//   onReady    – (web) async hook called with the iframe document before the
//                capture, e.g. to wait for dynamically rendered barcodes
//   onFallback – (web) called if the CDN/render fails so callers can degrade
//                gracefully (e.g. the old .html download)

import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ── Native: render HTML → PDF file → OS save/share sheet ────────────────────
export async function saveHtmlAsPdfNative({ title, html }) {
  const safe = String(title).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Document';
  const pdf = await Print.printToFileAsync({ html });
  // New expo-file-system API (SDK 54) — copy into the persistent documents
  // directory; the legacy copyAsync is deprecated.
  const dest = new File(Paths.document, `${safe}.pdf`);
  // copy() throws if the destination already exists — a repeat download of
  // the same title would fail. Remove any stale file first.
  if (dest.exists) dest.delete();
  new File(pdf.uri).copy(dest);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${safe}.pdf`,
      UTI: 'com.adobe.pdf',
    });
  }
  return { uri: dest.uri, fileName: `${safe}.pdf` };
}

// ── Web: html2pdf.js (html2canvas + jsPDF) loaded on demand from a CDN ──────
let _html2pdfPromise = null;
function _loadHtml2Pdf() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('PDF bundling is not available on this platform.'));
  }
  if (globalThis.html2pdf) return Promise.resolve(globalThis.html2pdf);
  if (_html2pdfPromise) return _html2pdfPromise;
  _html2pdfPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-genie-pdf]');
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.html2pdf), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load html2pdf')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.dataset.geniePdf = '1';
    script.onload = () => (globalThis.html2pdf ? resolve(globalThis.html2pdf) : reject(new Error('html2pdf did not load')));
    script.onerror = () => reject(new Error('Could not load html2pdf'));
    document.head.appendChild(script);
  });
  return _html2pdfPromise;
}

function _minimalWrap(title, bodyHtml) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head><body style="margin:0;background:#ffffff">${bodyHtml}</body></html>`;
}

// Web-only: render a complete HTML document in a hidden iframe, capture it with
// html2pdf and trigger a .pdf download. Degrades to `onFallback` on failure so
// the user always gets the document.
export async function downloadHtmlAsPdfWeb({ title, fullHtml, onReady, onFallback }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([fullHtml], { type: 'text/html' }));
  const iframe = document.createElement('iframe');
  // A4 width @96dpi, hidden off-screen so the render is invisible.
  iframe.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;background:#fff;';
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Could not load document for PDF bundling'));
      iframe.src = url;
    });
    const frameDoc = iframe.contentDocument;
    if (!frameDoc || !frameDoc.body) throw new Error('Document render failed');
    if (onReady) await onReady(frameDoc);
    const html2pdf = await _loadHtml2Pdf();
    await html2pdf()
      .set({
        margin: 0,
        filename: `${title}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(frameDoc.body)
      .save();
  } catch (error) {
    // CDN unavailable or render failed — degrade to the caller's fallback so
    // the user always gets the document.
    console.warn('PDF bundling failed, falling back:', error);
    if (onFallback) onFallback();
  } finally {
    URL.revokeObjectURL(url);
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

// ── Cross-platform entry: bundle HTML into a PDF and deliver it ─────────────
export async function bundleHtmlAsPdf({ title, html, fullHtml, onReady, onFallback }) {
  if (Platform.OS === 'web') {
    return downloadHtmlAsPdfWeb({
      title,
      fullHtml: fullHtml || _minimalWrap(title, html || ''),
      onReady,
      onFallback,
    });
  }
  return saveHtmlAsPdfNative({ title, html });
}
