import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../styles/theme';
import { ROLE_LEVELS } from '../core/config';
import { UploadViewer, resolveUploadUri, isPdfUpload } from '../utils/upload-viewer';
import {
  BARCODE_FORMATS, CAM_CONSTRAINTS,  DEFAULT_HIDDEN_TYPES, KYC_OPTIONS, KYC_OPTION_GROUPS,
  MAX_FILES, UPLOAD_TYPES, bundleKey, restrictedUploadTypes,
  buildDynamicTasks, buildUploadPayload, describeStagedRow,
  filterOrders, getOrderParties, makeUploadRow, mergeStagedRow,
  normalizeUploaderData, validateUploadRow,
} from '../core/uploader-engine';
import { compressImage, getRotatedImage, createPdfFromImages } from '../core/uploader-image';
import { submitUpload } from '../core/upload-api';

const displayDate = (value) => {
  const n = Number(value);
  const date = n ? new Date(n > 1e10 ? n : n * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

const assetData = async (asset) => {
  if (asset?.base64) return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  if (asset?.uri && Platform.OS !== 'web') {
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:${asset.mimeType || 'image/jpeg'};base64,${base64}`;
    } catch (_) {}
  }
  return asset?.uri || '';
};

const dataUrlToCacheUri = async (dataUrl) => {
  if (!String(dataUrl).startsWith('data:')) return dataUrl;
  const encoded = String(dataUrl).split(',')[1] || '';
  const uri = `${FileSystem.cacheDirectory}genie-uploader-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.writeAsStringAsync(uri, encoded, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
};

// ── Web-only DOM styles (web uploader.html parity) ─────────────────────────
// Plain CSS objects (not StyleSheet) so they can be applied to real DOM nodes
// created with React.createElement on the web build.
const webTd = { border: '1px solid #ccc', padding: 8, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap', verticalAlign: 'middle' };
const webTh = { ...webTd, backgroundColor: '#f0f0f0', fontWeight: 700, position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' };
const webTable = { width: '100%', borderCollapse: 'collapse' };
const webTableWrap = { width: '100%', marginTop: 15, overflowX: 'auto', maxHeight: 400, border: '1px solid #ccc', borderRadius: 4 };
const webBtn = { padding: '8px 16px', border: '1px solid #ccc', background: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 500, color: '#333', fontSize: '0.875rem', transition: 'background-color 0.2s, border-color 0.2s' };
const webBtnDanger = { ...webBtn, background: '#f8d7da', borderColor: '#f5c6cb' };
const webBtnPrimary = { ...webBtn, background: '#1e3a5f', color: '#fff', borderColor: '#1e3a5f' };
const webInput = { padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.875rem', background: '#fff', width: '100%', minWidth: 150, boxSizing: 'border-box' };
const webPickupTh = { padding: 10, borderBottom: '1px solid #eee', fontSize: '0.875rem', textAlign: 'left', backgroundColor: '#f8f8f8', fontWeight: 600, color: '#333', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' };
const webPickupTd = { padding: 10, borderBottom: '1px solid #eee', fontSize: '0.875rem', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'normal' };
const webPickupTable = { width: '100%', borderCollapse: 'collapse' };
const webPickupWrap = { width: '100%', marginTop: 15, border: '1px solid #e2e8f0', borderRadius: 4, backgroundColor: '#fafafa', maxHeight: 280, overflowY: 'auto' };

// Web applyEnhancements() parity — the exact CSS filter string used for both
// the cropper preview and the baked crop output. Sharpen is a preview-only
// control in the web app and never enters the filter string.
const buildFilterString = (opts = {}) => {
  if (opts.bw) return 'grayscale(100%) contrast(170%) brightness(105%)';
  if (opts.greyscale) return 'grayscale(100%)';
  const b = Number(opts.brightness) || 0;
  const c = Number(opts.contrast) || 0;
  return `brightness(${100 + b * 2}%) contrast(${100 + c * 2}%)`;
};

export default function UploaderScreen({
  orders = [], b2b2cMap = {}, productsMap = {}, uploadsMap = {}, token = '', apiBase = '',
  role = 'STAFF', onRefresh, onClose, initialOrder = null, initialType = null,
  defaultType = null, hiddenTypes = [], enforceRoleRestrictions = false, modalMode = false,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // The web uploader switches to its stacked mobile layout below 1024px.
  const isCompactMobile = windowWidth < 1024;
  const normalized = useMemo(() => normalizeUploaderData({ orders, b2b2c: b2b2cMap, products: productsMap, uploads: uploadsMap }), [orders, b2b2cMap, productsMap, uploadsMap]);
  const [search, setSearch] = useState('');
  const [displayDays, setDisplayDays] = useState(90);
  const [mobileOrderListCollapsed, setMobileOrderListCollapsed] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [uploadType, setUploadType] = useState(null);
  const [imageQueue, setImageQueue] = useState([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [stagedRows, setStagedRows] = useState([]);
  const [rowFields, setRowFields] = useState({});
  const [locked, setLocked] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Select an order or start capture.');
  const [statusError, setStatusError] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [existingVisible, setExistingVisible] = useState(false);
  const [existingViewer, setExistingViewer] = useState(null);
  const [deletingUpload, setDeletingUpload] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [enhancements, setEnhancements] = useState({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
  const [deletedUploadIds, setDeletedUploadIds] = useState(() => new Set());
  const [submitStates, setSubmitStates] = useState({});
  const webInputRef = useRef(null);
  const sessionGenerationRef = useRef(0);

  // ── Web-parity engine state (cropper / camera / OCR / scan) ────────────────
  const [cropMode, setCropMode] = useState(false);        // web inline Cropper.js overlay
  const [enhanceVisible, setEnhanceVisible] = useState(false); // web cropper enhancement controls
  const [webCameraActive, setWebCameraActive] = useState(false); // web getUserMedia live feed
  const [webCaptured, setWebCaptured] = useState(false);  // web 'Cancel' -> 'Done' after first capture
  const [nativeScanVisible, setNativeScanVisible] = useState(false); // expo-camera live scanner
  const [scanPaused, setScanPaused] = useState(false);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(null); // web pickup-row selection
  const [scanPermission, requestScanPermission] = useCameraPermissions();

  const webCropperRef = useRef(null);
  const webCropperImgRef = useRef(null);      // DOM <img> Cropper attaches to
  const webCropperWrapRef = useRef(null);     // DOM container (filter queries)
  const webPreviewRef = useRef(null);         // DOM preview area (selection OCR)
  const webSelectionCanvasRef = useRef(null); // DOM canvas overlay (selection rect)
  const webImageRef = useRef(null);           // hidden <img> with natural dims / detector source
  const webVideoRef = useRef(null);           // DOM <video> live feed
  const streamRef = useRef(null);             // active MediaStream
  const lastScanRef = useRef(0);              // native scanner throttle
  const rotationRef = useRef(0);              // mirror for DOM OCR handlers
  const isSelectingRef = useRef(false);
  const isProcessingOCRRef = useRef(false);
  const selectionStateRef = useRef({ rect: { startX: 0, startY: 0 }, ctx: null });
  const applyScanResultRef = useRef(null);    // latest applyScanResult for DOM handlers

  // mini-uploader.js setReference()/setReferenceWithDefaultType() parity:
  // callers can open this same state machine for one order and one type, while
  // the full uploader keeps the searchable order list and all type buttons.
  useEffect(() => {
    // Every mini-uploader reference is a new upload session. Invalidate any
    // asynchronous picker/processing work belonging to the previous target.
    sessionGenerationRef.current += 1;
    // Clear transient
    // camera/table state so images or staged rows from another shipment can
    // never be submitted against this reference.
    setImageQueue([]);
    setImageIndex(0);
    setStagedRows([]);
    setRowFields({});
    setLocked(false);
    setRotation(0);
    setEnhancements({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
    setExistingViewer(null);
    setExistingVisible(false);
    setDeletedUploadIds(new Set());
    setSubmitStates({});
    setUploadType(initialType || defaultType || null);
    setMobileOrderListCollapsed(Boolean(initialOrder));
    if (!initialOrder) {
      setSelectedOrder(null);
      setMessage('Select an order or start capture.');
      return;
    }
    setSelectedOrder(initialOrder);
    setMessage(`Ready. Uploading for: ${initialOrder.AWB_NUMBER || initialOrder.REFERENCE}`);
  }, [initialOrder, initialType, defaultType]);

  const effectiveHiddenTypes = useMemo(() => {
    const configured = hiddenTypes?.length ? hiddenTypes : (modalMode ? DEFAULT_HIDDEN_TYPES : []);
    const result = new Set(restrictedUploadTypes(role, configured, enforceRoleRestrictions));
    if (defaultType) UPLOAD_TYPES.filter((type) => type !== defaultType).forEach((type) => result.add(type));
    return result;
  }, [hiddenTypes, defaultType, modalMode, role, enforceRoleRestrictions]);

  const visibleOrders = useMemo(
    () => filterOrders(normalized.orders, normalized.contacts, search, displayDays),
    [normalized, search, displayDays],
  );
  // Web parity: the Load More label shows (rendered / total-by-search) — no date cut.
  const totalOrders = useMemo(
    () => filterOrders(normalized.orders, normalized.contacts, search, 9999999).length,
    [normalized, search],
  );
  const existingUploads = selectedOrder ? (normalized.uploadMap.get(String(selectedOrder.REFERENCE)) || []).filter((item) => !deletedUploadIds.has(String(item.UPLOAD_UID || ''))) : [];
  // Rebuild the task input map after a local delete so the task list updates
  // immediately, without waiting for the next full sync/refresh.
  const uploadMapForTasks = useMemo(() => {
    if (!selectedOrder) return normalized.uploadMap;
    const next = new Map(normalized.uploadMap);
    next.set(String(selectedOrder.REFERENCE), existingUploads);
    return next;
  }, [normalized.uploadMap, selectedOrder, existingUploads]);
  const tasks = useMemo(() => buildDynamicTasks(
    selectedOrder,
    normalized.contacts,
    normalized.productMap,
    uploadMapForTasks,
    uploadType,
    effectiveHiddenTypes,
    role,
    stagedRows,
    enforceRoleRestrictions,
  ), [selectedOrder, normalized, uploadMapForTasks, uploadType, effectiveHiddenTypes, role, stagedRows, enforceRoleRestrictions]);
  const currentImage = imageQueue[imageIndex] || '';
  const parties = selectedOrder ? getOrderParties(selectedOrder, normalized.contacts) : null;
  // PDFs can't be edited (web rasterizes them; a raw PDF here goes straight to upload)
  const isPdfItem = String(currentImage || '').startsWith('data:application/pdf');

  const setMessage = (message, error = false) => { setStatus(message); setStatusError(error); };

  // Keep DOM OCR/barcode handlers on the latest closure (web engine parity).
  // applyScanResultRef.current is refreshed right after applyScanResult's
  // definition below so every render exposes the freshest closure.

  // ── Web Cropper lifecycle (web initCropper parity) ──────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !cropMode || !currentImage) return;
    const Cropper = globalThis.Cropper;
    if (typeof Cropper !== 'function') {
      setMessage('Cropper library not loaded; using center crop.', true);
      setCropMode(false);
      return;
    }
    const imgEl = webCropperImgRef.current;
    if (!imgEl) return;
    if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
    imgEl.src = currentImage;
    setEnhancements({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
    webCropperRef.current = new Cropper(imgEl, {
      viewMode: 1, background: false, autoCrop: true, autoCropArea: 0.95,
      zoomable: true, movable: true, scalable: true,
    });
    // web initCropper parity: auto-enhance + reveal controls after 200ms
    const timer = setTimeout(() => {
      setEnhancements({ brightness: 10, contrast: 10, sharpen: true, greyscale: false, bw: false });
      setEnhanceVisible(true);
    }, 200);
    return () => {
      clearTimeout(timer);
      if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
    };
  }, [cropMode, currentImage]);

  // Live CSS filters on the cropper preview (web applyEnhancements parity)
  useEffect(() => {
    if (Platform.OS !== 'web' || !cropMode || !webCropperWrapRef.current) return;
    const wrap = webCropperWrapRef.current;
    const canvasImg = wrap.querySelector('.cropper-canvas img');
    const viewboxImg = wrap.querySelector('.cropper-view-box img');
    const filterStr = buildFilterString(enhancements);
    if (canvasImg) canvasImg.style.filter = filterStr;
    if (viewboxImg) viewboxImg.style.filter = filterStr;
  }, [enhancements, cropMode]);

  // Mirror rotation for the DOM selection-OCR handler
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  // Attach the web live-camera <video> when the camera modal opens
  useEffect(() => {
    if (!webCameraActive || !webVideoRef.current || !streamRef.current) return;
    webVideoRef.current.srcObject = streamRef.current;
    webVideoRef.current.play().catch(() => {});
  }, [webCameraActive]);

  // Stop the web camera + destroy the cropper if the screen unmounts mid-session
  useEffect(() => () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
  }, []);

  // Web preview selection-OCR listeners (web onSelectionStart/Move/Up parity)
  useEffect(() => {
    if (Platform.OS !== 'web' || cropMode || webCameraActive) return;
    const node = webPreviewRef.current;
    const canvas = webSelectionCanvasRef.current;
    const imgEl = webImageRef.current;
    if (!node || !canvas || !imgEl || !currentImage) return;

    const move = (e) => {
      if (!isSelectingRef.current) return;
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      const x = point.clientX - rect.left;
      const y = point.clientY - rect.top;
      const s = selectionStateRef.current;
      s.ctx.clearRect(0, 0, canvas.width, canvas.height);
      s.ctx.strokeStyle = 'red';
      s.ctx.lineWidth = 2;
      s.ctx.strokeRect(s.rect.startX, s.rect.startY, x - s.rect.startX, y - s.rect.startY);
    };

    const up = async (e) => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      canvas.style.display = 'none';
      selectionStateRef.current.ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = node.getBoundingClientRect();
      const point = e.changedTouches ? e.changedTouches[0] : e;
      const s = selectionStateRef.current;
      const endX = point.clientX - rect.left;
      const endY = point.clientY - rect.top;
      const selX1 = Math.min(s.rect.startX, endX), selY1 = Math.min(s.rect.startY, endY);
      const selX2 = Math.max(s.rect.startX, endX), selY2 = Math.max(s.rect.startY, endY);
      const selW = selX2 - selX1, selH = selY2 - selY1;
      if (selW < 10 || selH < 10) return;
      const naturalW = imgEl.naturalWidth || 0, naturalH = imgEl.naturalHeight || 0;
      const containerW = rect.width, containerH = rect.height;
      if (!naturalW || !naturalH || !containerW || !containerH) {
        setMessage('OCR failed: Image dimensions are zero.', true);
        return;
      }
      const imgAspect = naturalW / naturalH, contAspect = containerW / containerH;
      let renderedW, renderedH;
      if (imgAspect > contAspect) { renderedW = containerW; renderedH = containerW / imgAspect; }
      else { renderedH = containerH; renderedW = containerH * imgAspect; }
      const offsetX = (containerW - renderedW) / 2, offsetY = (containerH - renderedH) / 2;
      const scaleFactor = naturalW / renderedW;
      const centerX = containerW / 2, centerY = containerH / 2;
      const angle = (-rotationRef.current * Math.PI) / 180, cos = Math.cos(angle), sin = Math.sin(angle);
      const unrotatePoint = (x, y) => {
        const tx = x - centerX, ty = y - centerY;
        const rx = (tx * cos) - (ty * sin), ry = (tx * sin) + (ty * cos);
        return { x: rx + centerX, y: ry + centerY };
      };
      const p1 = unrotatePoint(selX1, selY1), p2 = unrotatePoint(selX2, selY1);
      const p3 = unrotatePoint(selX1, selY2), p4 = unrotatePoint(selX2, selY2);
      const unrotatedSelX = Math.min(p1.x, p2.x, p3.x, p4.x);
      const unrotatedSelY = Math.min(p1.y, p2.y, p3.y, p4.y);
      const unrotatedSelW = Math.max(p1.x, p2.x, p3.x, p4.x) - unrotatedSelX;
      const unrotatedSelH = Math.max(p1.y, p2.y, p3.y, p4.y) - unrotatedSelY;
      const sourceX = (unrotatedSelX - offsetX) * scaleFactor;
      const sourceY = (unrotatedSelY - offsetY) * scaleFactor;
      const sourceWidth = unrotatedSelW * scaleFactor;
      const sourceHeight = unrotatedSelH * scaleFactor;
      if (sourceX < 0 || sourceY < 0 || (sourceX + sourceWidth) > naturalW || (sourceY + sourceHeight) > naturalH) {
        setMessage('Selection was outside the image area.', true);
        return;
      }
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = sourceWidth; cropCanvas.height = sourceHeight;
      cropCanvas.getContext('2d').drawImage(imgEl, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
      if (!globalThis.Tesseract) { setMessage('OCR library not loaded.', true); return; }
      isProcessingOCRRef.current = true;
      setMessage('Running OCR on selected area...');
      try {
        const { data: { text } } = await globalThis.Tesseract.recognize(cropCanvas, 'eng');
        const ocrText = text.trim().replace(/\s+/g, '');
        if (ocrText) applyScanResultRef.current(ocrText);
        else setMessage('OCR could not find any text in the selected area.');
      } catch (err) { setMessage('OCR failed on selection.', true); }
      finally { setTimeout(() => { isProcessingOCRRef.current = false; }, 300); }
    };

    const start = (e) => {
      if (isSelectingRef.current || isProcessingOCRRef.current) return;
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = rect.height;
      canvas.style.display = 'block';
      isSelectingRef.current = true;
      const point = e.touches ? e.touches[0] : e;
      selectionStateRef.current = {
        rect: { startX: point.clientX - rect.left, startY: point.clientY - rect.top },
        ctx: canvas.getContext('2d'),
      };
      window.addEventListener('mousemove', move, { passive: false });
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('mouseup', up, { once: true });
      window.addEventListener('touchend', up, { once: true });
    };
    node.addEventListener('mousedown', start);
    node.addEventListener('touchstart', start, { passive: false });
    return () => {
      node.removeEventListener('mousedown', start);
      node.removeEventListener('touchstart', start);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
    };
  }, [cropMode, webCameraActive, currentImage, selectedOrder]);

  // Web crop-confirm (web confirmCropHandler parity) — bakes CSS filters into bytes
  const confirmWebCrop = async () => {
    const cropper = webCropperRef.current;
    if (!cropper || processingImage) return;
    setProcessingImage(true);
    try {
      const croppedCanvas = cropper.getCroppedCanvas({
        minWidth: 256, minHeight: 256, maxWidth: 4096, maxHeight: 4096,
        fillColor: '#fff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
      });
      if (!croppedCanvas) { setMessage('Crop failed.', true); return; }
      const filteredCanvas = document.createElement('canvas');
      filteredCanvas.width = croppedCanvas.width;
      filteredCanvas.height = croppedCanvas.height;
      const fCtx = filteredCanvas.getContext('2d');
      const filterStr = buildFilterString(enhancements);
      if (fCtx.filter !== undefined) fCtx.filter = filterStr;
      fCtx.drawImage(croppedCanvas, 0, 0);
      const dataUrl = filteredCanvas.toDataURL('image/jpeg', 0.95);
      if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
      setCropMode(false);
      setEnhanceVisible(false);
      setImageQueue((q) => q.map((item, i) => (i === imageIndex ? dataUrl : item)));
      setRotation(0);
      setMessage('Crop applied.');
      scanBarcodeFromData(dataUrl); // web parity: auto-scan after crop confirm
    } catch (err) { setMessage(`Crop failed: ${err.message}`, true); }
    finally { setProcessingImage(false); }
  };

  // ── Web live camera (web uploader-camera.js getUserMedia parity) ──────────
  const stopWebCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setWebCameraActive(false);
    setWebCaptured(false);
  };

  const captureWebFrame = async () => {
    const video = webVideoRef.current;
    if (!video || !streamRef.current) return;
    if (imageQueue.length >= MAX_FILES) { setMessage(`Maximum of ${MAX_FILES} images reached.`, true); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) { setMessage('Camera is still starting…', true); return; }
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2, sy = (vh - size) / 2;
    canvas.width = size; canvas.height = size;
    canvas.getContext('2d').drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    setImageQueue((q) => [...q, dataUrl]);
    setImageIndex(0);
    setWebCaptured(true);
    setMessage(`${imageQueue.length + 1} image(s) captured.`);
  };

  const startWebCamera = async () => {
    if (processingImage) return;
    if (streamRef.current) { captureWebFrame(); return; } // 'Capture' while streaming
    setMessage('Starting camera...');
    let opened = null;
    for (const vc of CAM_CONSTRAINTS) {
      try { opened = await navigator.mediaDevices.getUserMedia({ video: vc }); break; } catch (_) {}
    }
    if (!opened) { setMessage('Could not access camera. Check permissions.', true); return; }
    streamRef.current = opened;
    const track = opened.getVideoTracks()[0];
    if (track && typeof track.applyConstraints === 'function') {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
    if (typeof globalThis.ImageCapture === 'function' && track) {
      setTimeout(() => { try { new globalThis.ImageCapture(track).grabFrame().catch(() => {}); } catch (_) {} }, 600);
    }
    setWebCaptured(false);
    setWebCameraActive(true);
  };

  const doneWebCamera = () => {
    stopWebCamera();
    if (imageQueue.length > 0) { setImageIndex(0); setCropMode(true); } // web Done -> displayImage(0) cropper
  };

  // ── Scan / OCR result handling (web scanBarcodeFromPreview + OCR parity) ──
  const applyScanResult = (value) => {
    const task = selectedTaskIndex != null ? tasks[selectedTaskIndex] : null;
    if (task && task.type && task.type !== 'empty' && task.type !== 'complete') {
      if (task.type === 'KYC') setField('kycNumber', value);
      else if (task.type === 'Product') setField('remark', value);
      else if (task.type === 'MultiBox') setField('childAwb', value);
      else setField('status', value);
      setMessage(`Filled selected row with: ${value}`);
      return;
    }
    const matched = normalized.orders.find((o) => String(o.REFERENCE) === value || String(o.AWB_NUMBER) === value);
    if (matched) { selectOrder(matched); setMessage(`Matched: ${value}. Loading tasks...`); return; }
    setSearch(value);
    setMessage(`${value} (No exact match. Filtering list...).`);
  };
  // Refresh the ref after the definition so DOM handlers always see the latest
  // applyScanResult (tasks / selectedTaskIndex / orders change every render).
  applyScanResultRef.current = applyScanResult;

  const scanBarcodeFromData = async (dataUrl) => {
    if (Platform.OS !== 'web' || !dataUrl || !globalThis.BarcodeDetector) return;
    try {
      setMessage('Attempting barcode scan...');
      const img = new globalThis.Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const detector = new globalThis.BarcodeDetector({ formats: BARCODE_FORMATS });
      const barcodes = await detector.detect(img);
      if (barcodes.length > 0) {
        applyScanResult(String(barcodes[0].rawValue || '').trim());
      } else {
        setMessage('No barcode found. Select an area for OCR.');
      }
    } catch (err) {
      setMessage('Barcode scan failed. Select area for OCR.', true);
    }
  };

  // ── Native live barcode/QR scanner (expo-camera) ──────────────────────────
  const openNativeScanner = async () => {
    if (!scanPermission?.granted) {
      const perm = await requestScanPermission();
      if (!perm.granted) { Alert.alert('Camera permission required', 'Enable camera access to scan barcodes and QR codes.'); return; }
    }
    lastScanRef.current = 0;
    setScanPaused(false);
    setNativeScanVisible(true);
  };

  const onNativeBarcode = ({ data }) => {
    const now = Date.now();
    if (!data || now - lastScanRef.current < 1500) return;
    lastScanRef.current = now;
    setScanPaused(true);
    setNativeScanVisible(false);
    applyScanResult(String(data).trim());
  };

  // Extract Data (OCR) — web runOcrExtraction parity (mobiles / GSTs / PINs)
  const runOcrExtraction = async () => {
    if (Platform.OS !== 'web' || !webCropperRef.current) return;
    if (!globalThis.Tesseract) { setMessage('OCR library not loaded.', true); return; }
    setProcessingImage(true);
    setMessage('Running OCR extraction... Please wait.');
    try {
      const extractCanvas = webCropperRef.current.getCroppedCanvas({
        minWidth: 256, minHeight: 256, maxWidth: 2048, maxHeight: 2048,
        fillColor: '#fff', imageSmoothingEnabled: true,
      });
      const wrap = webCropperWrapRef.current;
      const canvasImg = wrap?.querySelector('.cropper-canvas img');
      const fCtx = extractCanvas.getContext('2d');
      if (canvasImg && canvasImg.style.filter && fCtx.filter !== undefined) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = extractCanvas.width; tempCanvas.height = extractCanvas.height;
        tempCanvas.getContext('2d').drawImage(extractCanvas, 0, 0);
        fCtx.filter = canvasImg.style.filter;
        fCtx.drawImage(tempCanvas, 0, 0);
      }
      const { data: { text } } = await globalThis.Tesseract.recognize(extractCanvas, 'eng');
      const cleanText = text.replace(/\s+/g, ' ');
      const mobiles = [...new Set(cleanText.match(/(?:\+91|91)?\s*[6-9]\d{9}/g) || [])];
      const gsts = [...new Set(cleanText.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/gi) || [])];
      const pins = [...new Set(cleanText.match(/\b\d{6}\b/g) || [])];
      Alert.alert('Extraction Complete', `Mobiles: ${mobiles.length ? mobiles.join(', ') : 'None found'}\nGSTs: ${gsts.length ? gsts.join(', ') : 'None found'}\nPINs: ${pins.length ? pins.join(', ') : 'None found'}`);
      setMessage('Extraction complete.');
    } catch (err) { setMessage('OCR Extraction failed.', true); }
    finally { setProcessingImage(false); }
  };

  const selectImageAt = (index) => {
    if (Platform.OS === 'web') { setImageIndex(index); setCropMode(true); }
    else setImageIndex(index);
  };

  const onPressCrop = () => {
    if (Platform.OS === 'web') { setCropMode(true); return; }
    cropCurrentImage();
  };

  const cropCurrentImage = async () => {
    if (!currentImage) return;
    try {
      let cropped;
      if (Platform.OS === 'web' && currentImage.startsWith('data:image/')) {
        cropped = await new Promise((resolve) => {
          const image = new globalThis.Image();
          image.onload = () => {
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side;
            canvas.getContext('2d').drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, side, side);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
          image.onerror = () => resolve(currentImage);
          image.src = currentImage;
        });
      } else if (Platform.OS !== 'web') {
        cropped = await processNativeImage(currentImage, 0, true, 100, 1024);
      } else {
        setMessage('Center crop is available for image files.', true);
        return;
      }
      setImageQueue((queue) => queue.map((item, index) => index === imageIndex ? cropped : item));
      setRotation(0);
      setMessage('Center crop applied.');
    } catch (error) {
      setMessage(`Crop failed: ${error.message}`, true);
    }
  };

  const autoEnhance = () => { setEnhancements((value) => ({ ...value, brightness: 10, contrast: 10, sharpen: true, greyscale: false, bw: false })); setMessage('Auto enhancement enabled.'); };
  const toggleSharpen = () => setEnhancements((value) => ({ ...value, sharpen: !value.sharpen }));
  const toggleGreyscale = () => setEnhancements((value) => ({ ...value, greyscale: !value.greyscale, bw: false }));
  const toggleBlackWhite = () => setEnhancements((value) => ({ ...value, bw: !value.bw, greyscale: false }));
  const setEnhancementValue = (key, value) => setEnhancements((current) => {
    // Keep a transient minus sign so users can enter the web-supported -50…50
    // range on keyboards that emit the value in multiple keystrokes.
    if (value === '' || value === '-') return { ...current, [key]: value };
    const numeric = Number(value);
    return Number.isFinite(numeric) ? { ...current, [key]: Math.max(-50, Math.min(50, numeric)) } : current;
  });
  const resetEnhancements = () => { setEnhancements({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false }); setMessage('Enhancements reset.'); };

  const scanBarcode = async () => {
    if (!currentImage) { setMessage('No image in preview. Capture or upload an image first.', true); return; }
    if (Platform.OS === 'web') { await scanBarcodeFromData(currentImage); return; }
    // Native: live expo-camera scanner (fills selected row / matches order / filters)
    openNativeScanner();
  };

  const runOCR = async () => {
    if (!currentImage) { setMessage('No image in preview. Capture or upload an image first.', true); return; }
    if (Platform.OS !== 'web' || !globalThis.Tesseract) { setMessage('OCR is available on the web build (drag a region or tap OCR).', true); return; }
    try {
      setMessage('Running OCR…');
      const result = await globalThis.Tesseract.recognize(currentImage, 'eng');
      const value = String(result?.data?.text || '').trim().replace(/\s+/g, ' ');
      if (!value) { setMessage('OCR found no text.', true); return; }
      applyScanResult(value);
    } catch (error) { setMessage(`OCR failed: ${error.message}`, true); }
  };

  const chooseAssets = async (camera = false) => {
    if (busy || processingImage) return;
    const sessionGeneration = sessionGenerationRef.current;
    if (camera && Platform.OS === 'web') {
      // Web parity: live getUserMedia feed with click-to-capture (not a picker)
      startWebCamera();
      return;
    }
    if (!camera && Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
    }
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setMessage('Media permission is required.', true); return; }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.9, mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.9, allowsMultipleSelection: true, selectionLimit: MAX_FILES, mediaTypes: ['images'] });
      if (result.canceled || !result.assets?.length || sessionGeneration !== sessionGenerationRef.current) return;
      const next = (await Promise.all(result.assets.map(assetData))).filter(Boolean).slice(0, MAX_FILES);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      setImageQueue(next);
      setImageIndex(0);
      setRotation(0);
      setMessage(`${next.length} image(s) loaded.`);
    } catch (error) { setMessage(`Could not load image: ${error.message}`, true); }
  };

  const readWebFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleWebFiles = async (event) => {
    const sessionGeneration = sessionGenerationRef.current;
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;
    setMessage('Processing uploaded files...');
    try {
      const valid = files.filter((file) => file.type === 'application/pdf' || file.type.startsWith('image/')).slice(0, MAX_FILES);
      const data = [];
      for (const file of valid) {
        // The browser web module rasterizes PDF pages when pdfjsLib is loaded.
        // Preserve the original PDF as a valid upload when the optional worker
        // is not present rather than silently discarding the selected file.
        if (file.type === 'application/pdf' && globalThis.pdfjsLib?.getDocument) {
          // web handlePdfFile parity: worker CDN fallback + 2x render + JPEG 0.9
          if (globalThis.pdfjsLib.GlobalWorkerOptions) {
            globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          }
          const buffer = await file.arrayBuffer();
          const pdf = await globalThis.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
          for (let pageNo = 1; pageNo <= pdf.numPages && data.length < MAX_FILES; pageNo += 1) {
            setMessage(`Processing PDF page ${pageNo} of ${pdf.numPages}...`);
            const page = await pdf.getPage(pageNo);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            data.push(canvas.toDataURL('image/jpeg', 0.9));
          }
        } else {
          data.push(await readWebFile(file));
        }
      }
      if (!data.length || sessionGeneration !== sessionGenerationRef.current) { if (!data.length) setMessage('No valid images or PDFs found.', true); return; }
      setImageQueue(data.slice(0, MAX_FILES));
      setImageIndex(0);
      setRotation(0);
      setMessage(`${Math.min(data.length, MAX_FILES)} file(s) loaded.`);
    } catch (error) { setMessage(`Could not process files: ${error.message}`, true); }
    finally { if (event?.target) event.target.value = ''; }
  };

  const resetUploader = () => {
    // Invalidate any pick/capture promise that is still processing. Its result
    // must not be allowed to repopulate a session the user just cancelled.
    sessionGenerationRef.current += 1;
    if (Platform.OS === 'web') {
      stopWebCamera();
      if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
      setCropMode(false);
      setEnhanceVisible(false);
    }
    setNativeScanVisible(false);
    setSelectedTaskIndex(null);
    setImageQueue([]); setImageIndex(0); setStagedRows([]); setRowFields({}); setSubmitStates({}); setLocked(false); setRotation(0); setEnhancements({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
    setMessage('Select an order or start capture.');
  };

  const selectOrder = (order) => {
    sessionGenerationRef.current += 1;
    setSelectedOrder(order);
    setDeletedUploadIds(new Set());
    setUploadType(null);
    setMobileOrderListCollapsed(true);
    setSelectedTaskIndex(null);
    if (Platform.OS === 'web') {
      stopWebCamera();
      if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
      setCropMode(false);
      setEnhanceVisible(false);
    }
    setImageQueue([]);
    setImageIndex(0);
    setStagedRows([]);
    setRowFields({});
    setLocked(false);
    setRotation(0);
    setEnhancements({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
    setExistingViewer(null);
    setExistingVisible(false);
    setSubmitStates({});
    setMessage(`Ready. Uploading for: ${order.AWB_NUMBER || order.REFERENCE}`);
  };

  const setField = (key, value) => setRowFields((current) => ({ ...current, [key]: value }));

  const processNativeImage = async (dataUrl, degrees = 0, centerCrop = false, targetKB = 100, maxDimension = 1024) => {
    const sourceUri = await dataUrlToCacheUri(dataUrl);
    const size = await new Promise((resolve, reject) => Image.getSize(sourceUri, (width, height) => resolve({ width, height }), reject));
    let crop;
    let workingWidth = size.width;
    let workingHeight = size.height;
    if (centerCrop) {
      const side = Math.min(size.width, size.height);
      crop = { originX: Math.floor((size.width - side) / 2), originY: Math.floor((size.height - side) / 2), width: side, height: side };
      workingWidth = side;
      workingHeight = side;
    }
    const actions = [];
    if (crop) actions.push({ crop });
    if (workingWidth > maxDimension || workingHeight > maxDimension) {
      const scale = maxDimension / Math.max(workingWidth, workingHeight);
      actions.push({ resize: { width: Math.round(workingWidth * scale), height: Math.round(workingHeight * scale) } });
    }
    if (degrees) actions.push({ rotate: degrees });
    let quality = 0.9;
    let result;
    do {
      result = await manipulateAsync(sourceUri, actions, { compress: quality, format: SaveFormat.JPEG, base64: true });
      const sizeBytes = (result.base64 || '').length * 0.75;
      if (sizeBytes <= targetKB * 1024 || quality <= 0.1) break;
      quality = Math.max(0.1, quality - 0.1);
    } while (quality >= 0.1);
    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : result.uri;
  };

  const prepareImageForUpload = async (dataUrl) => {
    // Web parity (jawaS/uploader.js pick): getRotatedImage(preview, rotation) then
    // compressImage — mini 100 KB/1024 px, full 200 KB/2048 px. Enhancements are
    // NOT baked here; the web bakes CSS filters only at crop-confirm time.
    try {
      if (Platform.OS !== 'web') return await processNativeImage(dataUrl, rotation, false, modalMode ? 100 : 200, modalMode ? 1024 : 2048);
      if (!String(dataUrl).startsWith('data:image/')) return dataUrl;
      const rotated = rotation ? await getRotatedImage(dataUrl, rotation) : dataUrl;
      return await compressImage(rotated, modalMode ? 100 : 200, modalMode ? 1024 : 2048);
    } catch (_) {
      return dataUrl;
    }
  };

  const pickTask = async (task) => {
    if (task.type === 'empty' || task.type === 'complete' || processingImage) return;
    if (!currentImage) { setMessage('No image in preview. Capture or upload an image first.', true); return; }
    const sessionGeneration = sessionGenerationRef.current;
    setProcessingImage(true);
    try {
      const fields = { ...rowFields, branch: selectedOrder?.BRANCH || '', code: selectedOrder?.CODE || '' };
      const preparedImage = await prepareImageForUpload(currentImage);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      const row = { ...makeUploadRow(task, fields, preparedImage), rowId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      const validation = validateUploadRow(row);
      if (validation) { setMessage(validation, true); return; }
      setStagedRows((current) => mergeStagedRow(current, row));
      setRowFields({});
      setMessage(`Added ${task.type} for ${task.ref} to the table.`);
      if (!locked) {
        // Web pick parity: splice the used image and open the next one (or reset)
        if (imageQueue.length > 0) {
          const remaining = imageQueue.length - 1;
          const nextIndex = imageIndex < remaining ? imageIndex : 0;
          setImageQueue((q) => q.filter((_, i) => i !== imageIndex));
          if (remaining > 0) selectImageAt(nextIndex); else resetUploader();
        } else { resetUploader(); }
      }
    } finally { setProcessingImage(false); }
  };

  const chooseType = (type) => setUploadType((current) => current === type ? null : type);

  const cancelCurrentImage = () => {
    if (processingImage) return;
    // Web cancel parity: streaming -> stop; locked or empty -> full reset;
    // otherwise remove the current queue item and show the next in the cropper.
    if (Platform.OS === 'web' && webCameraActive) {
      if (webCaptured && imageQueue.length > 0) doneWebCamera();
      else stopWebCamera();
      return;
    }
    if (locked || imageQueue.length === 0) { resetUploader(); return; }
    const remaining = imageQueue.length - 1;
    const nextIndex = imageIndex < remaining ? imageIndex : 0;
    setImageQueue((q) => q.filter((_, i) => i !== imageIndex));
    if (remaining > 0) selectImageAt(nextIndex); else resetUploader();
  };

  const stagedRowKey = (row, index = 0) => row?.rowId || [row?.uploadType, row?.refNumber, row?.awbNumber, row?.customerUid, row?.docNumber, index].join('|');

  const deleteLastStagedRow = () => {
    if (!stagedRows.length) return;
    const index = stagedRows.length - 1;
    const key = stagedRowKey(stagedRows[index], index);
    setStagedRows((rows) => rows.slice(0, -1));
    setSubmitStates((states) => {
      const next = { ...states };
      delete next[key];
      return next;
    });
  };

  const deleteExistingUpload = (upload) => {
    if (!upload?.UPLOAD_UID || deletingUpload) return;
    Alert.alert('Delete upload', 'Permanently remove this upload file?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeletingUpload(true);
        try {
          const response = await fetch(`${apiBase}/api/upload/${encodeURIComponent(upload.UPLOAD_UID)}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          const json = await response.json().catch(() => ({}));
          if (!response.ok || json.status === 'error') throw new Error(json.message || json.detail || `Delete failed (${response.status})`);
          setDeletedUploadIds((current) => {
            const next = new Set(current);
            next.add(String(upload.UPLOAD_UID));
            return next;
          });
          setMessage('Upload deleted successfully.');
          onRefresh?.();
        } catch (error) { setMessage(`Delete failed: ${error.message}`, true); }
        finally { setDeletingUpload(false); }
      } },
    ]);
  };

  const getJsPdfConstructor = () => Platform.OS === 'web' && typeof globalThis !== 'undefined' ? globalThis.jspdf?.jsPDF : null;

  const submitRows = async () => {
    if (busy) return;
    if (!stagedRows.length) { setMessage('No data in the table to submit.', true); return; }
    if (!token) { setMessage('Authentication error: Please re-login.', true); return; }
    setBusy(true);
    const submitGeneration = sessionGenerationRef.current;
    let completed = 0;
    let aborted = false;
    const failures = [];
    const nextStates = { ...submitStates };
    try {
      for (let index = 0; index < stagedRows.length; index += 1) {
        if (submitGeneration !== sessionGenerationRef.current) {
          aborted = true;
          break;
        }
        const row = stagedRows[index];
        const key = stagedRowKey(row, index);
        // Web submit keeps successful rows green and skips them on retry.
        if (nextStates[key] === 'success') continue;
        setMessage(`Submitting row ${index + 1} of ${stagedRows.length}...`);
        nextStates[key] = 'pending';
        setSubmitStates({ ...nextStates });
        const images = row.images?.length ? row.images : [row.imageData];
        try {
          const firstImage = images[0] || '';
          let fileData = firstImage.split(',')[1] || '';
          let contentType = firstImage.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
          const hasPdf = images.some((image) => String(image).startsWith('data:application/pdf'));
          if (images.length > 1 && hasPdf) throw new Error('PDF files cannot be bundled with other images. Submit the PDF separately.');
          const Pdf = getJsPdfConstructor();
          if (images.length > 1 && Platform.OS === 'web' && !Pdf) {
            throw new Error('PDF bundling is unavailable in this web build. Please select one image or enable jsPDF.');
          }
          if (images.length > 1 && Platform.OS === 'web' && Pdf) {
            // Web parity: createPdfFromImages — A4, 10mm margins, aspect-ratio fit
            const dataUri = await createPdfFromImages(images);
            fileData = dataUri.split(',')[1]; contentType = 'application/pdf';
          } else if (images.length > 1 && Platform.OS !== 'web') {
            const html = `<html><body style="margin:0">${images.map((image) => `<div style="page-break-after:always"><img src="${image}" style="width:100%;max-height:100%;object-fit:contain" /></div>`).join('')}</body></html>`;
            const pdf = await Print.printToFileAsync({ html });
            fileData = await FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 });
            contentType = 'application/pdf';
          }
          if (!fileData) throw new Error('The selected file could not be converted to base64.');
          await submitUpload(buildUploadPayload(row, fileData, contentType), { apiBase, token });
          nextStates[key] = 'success';
          completed += 1;
        } catch (error) {
          nextStates[key] = 'error';
          failures.push(`${index + 1}: ${error.message}`);
        }
        setSubmitStates({ ...nextStates });
      }
      if (aborted) {
        setMessage('Submission stopped because the selected order changed.', true);
        return;
      }
      if (failures.length) {
        setMessage(`Failed rows: ${failures.join('; ')}. Fix and retry.`, true);
      } else {
        setMessage(`All ${stagedRows.length} row(s) submitted successfully.`);
        // Web leaves the green rows visible briefly, then clears the table.
        setTimeout(() => {
          if (submitGeneration !== sessionGenerationRef.current) return;
          setStagedRows([]); setSubmitStates({}); setMessage('Table cleared.');
        }, 2000);
        onRefresh?.();
      }
    } finally { setBusy(false); }
  };

  const renderOrderPane = (mobile = false) => (
    <View style={[styles.orderPane, mobile && styles.orderPaneMobile, mobile && { height: Math.max(56, Math.round(windowHeight * 0.5)), maxHeight: Math.max(56, Math.round(windowHeight * 0.5)) }, mobile && mobileOrderListCollapsed && styles.orderPaneCollapsed]}>
      {mobile ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={mobileOrderListCollapsed ? 'Expand order list' : 'Collapse order list'}
          style={styles.mobileOrderHeader}
          onPress={() => setMobileOrderListCollapsed((value) => !value)}
        >
          <View>
            <Text style={styles.mobileOrderTitle}>Select shipment</Text>
            <Text style={styles.mobileOrderSummary}>{selectedOrder ? (selectedOrder.AWB_NUMBER || selectedOrder.REFERENCE) : `${visibleOrders.length} available orders`}</Text>
          </View>
          <Text style={styles.mobileOrderChevron}>{mobileOrderListCollapsed ? '⌄' : '⌃'}</Text>
        </TouchableOpacity>
      ) : null}
      {(!mobile || !mobileOrderListCollapsed) ? (
        <>
          <TextInput style={styles.search} placeholder="Search AWB, Ref, Client, City..." value={search} onChangeText={setSearch} />
          <Text style={styles.listSummary}>{visibleOrders.length} orders · last {displayDays} days</Text>
          <ScrollView nestedScrollEnabled={mobile} style={[styles.orderList, mobile && { maxHeight: Math.max(110, Math.round(windowHeight * 0.5) - 112) }]}>
            {visibleOrders.map((order) => {
              const party = getOrderParties(order, normalized.contacts);
              return <TouchableOpacity key={order.REFERENCE} style={[styles.orderItem, selectedOrder?.REFERENCE === order.REFERENCE && styles.orderSelected]} onPress={() => selectOrder(order)}><Text style={styles.orderAwb}>{order.AWB_NUMBER || order.REFERENCE}</Text><Text style={styles.orderParties}>{party.consignorName} → {party.consigneeName}</Text><Text style={styles.orderMeta}>{order.DEST_CITY || 'N/A'} · {displayDate(order.ORDER_DATE)}</Text></TouchableOpacity>;
            })}
            {!visibleOrders.length ? <Text style={styles.emptyText}>No matching orders found.</Text> : null}
            {visibleOrders.length >= 1 && <TouchableOpacity style={styles.loadMore} onPress={() => setDisplayDays((value) => value + 90)}><Text style={styles.loadMoreText}>{Platform.OS === 'web' ? `Load More (${visibleOrders.length} / ${totalOrders})` : 'Load More (+90 days)'}</Text></TouchableOpacity>}
          </ScrollView>
        </>
      ) : null}
    </View>
  );

  const renderTask = (task, index) => {
    if (task.type === 'empty' || task.type === 'complete') return <Text key={`${task.type}-${index}`} style={task.type === 'complete' ? styles.completeTask : styles.emptyTask}>{task.message}</Text>;
    const fields = task.type === 'KYC'
      ? [
        ['kycNumber', 'KYC Number', 'numeric'],
        ['kycType', 'KYC Type', 'default'],
      ]
      : task.type === 'Product'
        ? [['remark', 'Remark', 'default']]
        : task.type === 'MultiBox'
          ? [['childAwb', 'Child AWB', 'default']]
          : [['status', 'Status', 'default']];
    const blocked = task.type === 'KYC' && fields[0] && !rowFields.kycNumber;
    return (
      <View key={`${task.type}-${index}`} style={styles.taskCard}>
        <View style={styles.taskHeading}>
          <Text style={styles.taskType}>{task.type}</Text>
          <Text style={styles.taskRef}>{task.ref}{task.awb ? ` · ${task.awb}` : ''}</Text>
        </View>
        {task.customerName ? <Text style={styles.taskHint}>{task.customerName} · UID: {task.customerUid}</Text> : null}
        {fields.map(([key, label, kind]) => kind === 'default' ? (
          <TextInput key={key} style={styles.field} placeholder={`${label}${task.defaultValue ? ` (${task.defaultValue})` : ''}`} value={rowFields[key] || ''} onChangeText={(value) => setField(key, value)} />
        ) : (
          <TextInput key={key} style={styles.field} placeholder={label} keyboardType="default" value={rowFields[key] || ''} onChangeText={(value) => setField(key, value)} />
        ))}
        {task.type === 'KYC' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kycOptions}>
            {KYC_OPTIONS.map((option) => <TouchableOpacity key={option} style={[styles.optionChip, rowFields.kycType === option && styles.optionChipActive]} onPress={() => setField('kycType', option)}><Text style={[styles.optionText, rowFields.kycType === option && styles.optionTextActive]}>{option}</Text></TouchableOpacity>)}
          </ScrollView>
        ) : null}
        <TouchableOpacity style={[styles.pickButton, (blocked || processingImage) && styles.disabled]} disabled={blocked || processingImage} onPress={() => pickTask(task)}><Text style={styles.pickButtonText}>{processingImage ? 'Processing…' : 'Pick current image'}</Text></TouchableOpacity>
      </View>
    );
  };

  // ── Web pickup table (web renderDynamicInputs parity: TYPE/REFERENCE/DETAILS/INPUT/ACTION) ──
  const renderWebPickupTable = () => {
    if (!tasks.length) return null;
    const rows = tasks.map((task, index) => {
      if (task.type === 'empty' || task.type === 'complete') {
        return React.createElement('tr', { key: `${task.type}-${index}` }, React.createElement('td', { colSpan: 5, style: task.type === 'complete' ? { textAlign: 'center', padding: 15, color: '#15803d', fontWeight: 700 } : { textAlign: 'center', padding: 15, color: '#888' } }, task.message));
      }
      let details = 'Status';
      if (task.type === 'KYC') details = task.customerName || '';
      else if (task.type === 'Product') details = `Doc: ${task.docNumber || 'N/A'} (${task.docType || 'N/A'})`;
      else if (task.type === 'MultiBox') details = 'Child AWB';
      const inputCell = task.type === 'KYC'
        ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
            React.createElement('input', { type: 'text', style: webInput, placeholder: 'KYC Number', value: rowFields.kycNumber || '', onChange: (e) => setField('kycNumber', e.target.value) }),
            React.createElement('select', { style: webInput, value: rowFields.kycType || KYC_OPTIONS[0], onChange: (e) => setField('kycType', e.target.value) },
              KYC_OPTION_GROUPS.map((group) => React.createElement('optgroup', { key: group.label, label: group.label },
                group.options.map((option) => React.createElement('option', { key: option, value: option }, option))
              ))
            )
          )
        : (() => {
          const placeholder = task.type === 'POD' ? 'Delivered (default)' : task.type === 'Reciept' ? 'Booked (default)' : task.type === 'Product' ? 'PAPERS UPLOADED (default)' : `Enter Child AWB (default: ${task.awb || ''})`;
          const key = task.type === 'Product' ? 'remark' : task.type === 'MultiBox' ? 'childAwb' : 'status';
          return React.createElement('input', { type: 'text', style: webInput, placeholder, value: rowFields[key] || '', onChange: (e) => setField(key, e.target.value) });
        })();
      const cells = [
        React.createElement('td', { key: 'type', style: webPickupTd }, task.type),
        React.createElement('td', { key: 'ref', style: webPickupTd }, task.type === 'MultiBox' ? `${task.ref} / ${task.awb || ''}` : task.ref),
        React.createElement('td', { key: 'details', style: webPickupTd }, details),
        React.createElement('td', { key: 'input', style: webPickupTd }, inputCell),
        React.createElement('td', { key: 'action', style: webPickupTd },
          React.createElement('button', { style: { ...webBtnDanger, fontSize: '0.8rem' }, disabled: processingImage, onClick: () => pickTask(task) }, processingImage ? 'Picking...' : 'Pick')
        ),
      ];
      return React.createElement('tr', {
        key: `${task.type}-${index}`,
        onClick: () => setSelectedTaskIndex(index),
        style: selectedTaskIndex === index ? { backgroundColor: '#e0e7ff', fontWeight: 600 } : {},
      }, cells);
    });
    return React.createElement('div', { style: webPickupWrap },
      React.createElement('table', { style: webPickupTable },
        React.createElement('thead', null, React.createElement('tr', null, ['TYPE', 'REFERENCE', 'DETAILS', 'INPUT', 'ACTION'].map((h) => React.createElement('th', { key: h, style: webPickupTh }, h)))),
        React.createElement('tbody', null, rows)
      )
    );
  };

  // ── Web staged data table (STATUS/REFERENCE/CUSTOMER-KYC/DOC INFO/ACTION) ──
  const renderWebDataTable = () => {
    const rows = stagedRows.map((row, index) => {
      const detail = describeStagedRow(row);
      const state = submitStates[stagedRowKey(row, index)];
      const images = row.images?.length ? row.images : [row.imageData];
      const grouped = !!bundleKey(row);
      const statusText = grouped
        ? `${detail.type} (${detail.imageCount} image${detail.imageCount > 1 ? 's' : ''})`
        : `${detail.type}${detail.status ? ` - ${detail.status}` : ''}`;
      const br = (value) => ({ __html: String(value || '').replace(/·/g, '<br>') });
      return React.createElement('tr', { key: `${detail.type}-${index}`, style: state === 'success' ? { backgroundColor: '#d4edda' } : state === 'error' ? { backgroundColor: '#f8d7da' } : {} },
        React.createElement('td', { style: webTd }, statusText),
        React.createElement('td', { style: webTd, dangerouslySetInnerHTML: br(detail.refAwb) }),
        React.createElement('td', { style: webTd }, detail.customerKyc ? React.createElement('span', { dangerouslySetInnerHTML: br(detail.customerKyc) }) : 'N/A'),
        React.createElement('td', { style: webTd }, detail.docInfo ? React.createElement('span', { dangerouslySetInnerHTML: br(detail.docInfo) }) : 'N/A'),
        React.createElement('td', { style: webTd }, React.createElement('button', { style: webBtn, onClick: () => setExistingViewer({ uri: images[0], title: `${detail.type} — staged`, isPdf: false }) }, 'Preview')),
        React.createElement('td', { style: { display: 'none' } }, `Branch: ${row.branch}, Code: ${row.code}`),
      );
    });
    return React.createElement('div', { style: webTableWrap },
      React.createElement('table', { style: webTable },
        React.createElement('thead', null, React.createElement('tr', null, ['STATUS', 'REFERENCE / AWB', 'CUSTOMER / KYC INFO', 'DOCUMENT INFO', 'ACTION', 'BRANCH / CODE'].map((h, i) => React.createElement('th', { key: i, style: i === 5 ? { ...webTh, display: 'none' } : webTh }, h)))),
        React.createElement('tbody', null, rows)
      )
    );
  };

  // ── Web existing-uploads table (web renderExistingUploadsForOrder parity) ──
  const renderWebExistingTable = () => {
    if (!existingUploads.length) return null;
    const rows = existingUploads.map((upload, index) => {
      const uri = resolveUploadUri(upload.FILE_URL || upload.url, apiBase);
      const canDelete = (ROLE_LEVELS[role] || 0) >= ROLE_LEVELS.MANAGER;
      const refAwb = upload.UPLOAD_TYPE === 'MultiBox'
        ? `Ref: ${upload.REFERENCE || upload.AWB_NUMBER} <br> Child: ${upload.CHILD_AWB}`
        : `Ref: ${upload.REFERENCE || ''} <br> AWB: ${upload.AWB_NUMBER || ''}`;
      const customerKyc = upload.UPLOAD_TYPE === 'KYC'
        ? `Cust: ${parties?.consignorName || 'N/A'} <br> UID: ${upload.CUSTOMER_UID || ''} <br> KYC: ${upload.KYC_NUMBER} (${upload.KYC_TYPE})`
        : '';
      const docInfo = upload.UPLOAD_TYPE === 'Product'
        ? `Doc: ${upload.DOC_NUMBER || ''} <br> Type: ${upload.DOC_TYPE || ''} <br> Remark: ${upload.STATUS_REMARK || ''}`
        : '';
      let statusText = `${upload.UPLOAD_TYPE || 'N/A'} - ${upload.STATUS_REMARK || ''}`;
      if (upload.UPLOAD_TYPE === 'Reciept' && !upload.STATUS_REMARK) statusText = 'Reciept - Booked';
      if (upload.UPLOAD_TYPE === 'POD' && !upload.STATUS_REMARK) statusText = 'POD - Delivered';
      const html = (value) => ({ __html: value });
      return React.createElement('tr', { key: upload.UPLOAD_UID || index },
        React.createElement('td', { style: webTd }, statusText),
        React.createElement('td', { style: webTd, dangerouslySetInnerHTML: html(refAwb) }),
        React.createElement('td', { style: webTd }, customerKyc ? React.createElement('span', { dangerouslySetInnerHTML: html(customerKyc) }) : 'N/A'),
        React.createElement('td', { style: webTd }, docInfo ? React.createElement('span', { dangerouslySetInnerHTML: html(docInfo) }) : 'N/A'),
        React.createElement('td', { style: webTd },
          uri ? React.createElement('button', { style: webBtn, onClick: () => setExistingViewer({ uri, title: `${upload.UPLOAD_TYPE || 'Upload'} — ${selectedOrder?.AWB_NUMBER || selectedOrder?.REFERENCE}`, isPdf: isPdfUpload(upload) }) }, 'Preview') : null,
          canDelete ? React.createElement('button', { style: { ...webBtnDanger, marginLeft: 4 }, onClick: () => deleteExistingUpload(upload) }, 'Delete') : null
        ),
        React.createElement('td', { style: { display: 'none' } }, `Branch: ${upload.BRANCH}, Code: ${upload.CODE}`),
      );
    });
    return React.createElement('div', { style: { display: 'block', marginTop: 25, borderTop: '2px solid #1E3A8A', paddingTop: 10 } },
      React.createElement('h3', { style: { fontSize: 18, fontWeight: 600, marginBottom: 10, color: '#1E3A8A' } }, 'Existing Uploads for this Order'),
      React.createElement('div', { style: { ...webTableWrap, maxHeight: 300 } },
        React.createElement('table', { style: webTable },
          React.createElement('thead', null, React.createElement('tr', null, ['STATUS', 'REFERENCE / AWB', 'CUSTOMER / KYC INFO', 'DOCUMENT INFO', 'ACTION', 'BRANCH / CODE'].map((h, i) => React.createElement('th', { key: i, style: i === 5 ? { ...webTh, display: 'none' } : webTh }, h)))),
          React.createElement('tbody', null, rows)
        )
      )
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}><Text style={styles.title}>Document Uploader</Text><Text style={styles.subtitle}>Web-parity POD, receipt, KYC, product and multibox uploads</Text></View>
      {Platform.OS === 'web' ? <>{React.createElement('input', { ref: webInputRef, type: 'file', accept: 'image/*,application/pdf', multiple: true, onChange: handleWebFiles, style: { display: 'none' } })}</> : null}
      <View style={[styles.controlsStrip, isCompactMobile && styles.controlsStripMobile, Platform.OS === 'web' && isCompactMobile && styles.controlsStripWebMobile]}>
        {UPLOAD_TYPES.filter((type) => !effectiveHiddenTypes.has(type)).map((type) => <TouchableOpacity key={type} style={[styles.typeButton, isCompactMobile && styles.compactButton, uploadType === type && styles.typeButtonActive]} onPress={() => chooseType(type)}><Text style={[styles.typeText, uploadType === type && styles.typeTextActive]}>{type}</Text></TouchableOpacity>)}
        <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={() => { if (Platform.OS === 'web') { if (webCameraActive) captureWebFrame(); else startWebCamera(); } else chooseAssets(true); }}><Text style={styles.actionText}>{webCameraActive ? 'Capture' : 'Camera'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={() => chooseAssets(false)}><Text style={styles.actionText}>Upload</Text></TouchableOpacity>
        {currentImage || webCameraActive ? <>
          {!isPdfItem ? <>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={() => setRotation((value) => (value + 90) % 360)}><Text style={styles.actionText}>Rotate</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={onPressCrop}><Text style={styles.actionText}>Crop</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={autoEnhance}><Text style={styles.actionText}>Auto</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={toggleGreyscale}><Text style={styles.actionText}>Gray</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={toggleBlackWhite}><Text style={styles.actionText}>B/W</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton, enhancements.sharpen && styles.locked]} onPress={toggleSharpen}><Text style={styles.actionText}>Sharpen</Text></TouchableOpacity>
            {Platform.OS !== 'web' ? <>
              <View style={[styles.enhancementInputGroup, isCompactMobile && styles.compactEnhancementInputGroup]}><Text style={styles.enhancementLabel}>B</Text><TextInput style={styles.enhancementInput} value={String(enhancements.brightness)} onChangeText={(value) => setEnhancementValue('brightness', value)} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} maxLength={3} /></View>
              <View style={[styles.enhancementInputGroup, isCompactMobile && styles.compactEnhancementInputGroup]}><Text style={styles.enhancementLabel}>C</Text><TextInput style={styles.enhancementInput} value={String(enhancements.contrast)} onChangeText={(value) => setEnhancementValue('contrast', value)} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} maxLength={3} /></View>
            </> : null}
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={resetEnhancements}><Text style={styles.actionText}>Reset</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={scanBarcode}><Text style={styles.actionText}>Barcode</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton]} onPress={runOCR}><Text style={styles.actionText}>OCR</Text></TouchableOpacity>
          </> : null}
          <TouchableOpacity style={[styles.actionButton, isCompactMobile && styles.compactButton, locked && styles.locked]} onPress={() => setLocked((value) => !value)}><Text style={styles.actionText}>{locked ? 'Unlock' : 'Lock'}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, isCompactMobile && styles.compactButton]} onPress={cancelCurrentImage}><Text style={styles.cancelText}>{webCameraActive && webCaptured ? 'Done' : 'Cancel'}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, isCompactMobile && styles.compactButton]} onPress={resetUploader}><Text style={styles.cancelText}>Cancel All</Text></TouchableOpacity>
        </> : null}
      </View>
      <Text style={[styles.status, statusError && styles.statusError]}>{status}</Text>
      {modalMode && onClose ? <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}><Text style={styles.modalCloseText}>✕ Close</Text></TouchableOpacity> : null}
      <View style={[styles.body, isCompactMobile && styles.bodyMobile, modalMode && styles.bodyModal]}>
        {!modalMode && !isCompactMobile ? renderOrderPane(false) : null}
        <ScrollView nestedScrollEnabled={isCompactMobile} style={styles.workPane} contentContainerStyle={styles.workContent}>
          {!selectedOrder ? (
            <>
              {isCompactMobile ? <View style={styles.previewEmptyMobile}><Text style={styles.previewEmptyText}>Select an order to begin</Text></View> : null}
              {isCompactMobile && !modalMode ? renderOrderPane(true) : null}
              <Text style={styles.placeholder}>Select an order from the list to begin.</Text>
            </>
          ) : (
            <>
              {webCameraActive ? (
                <View style={[styles.previewCard, styles.previewCardMobile, { position: 'relative' }]}>
                  {Platform.OS === 'web' ? React.createElement('video', { ref: webVideoRef, autoPlay: true, playsInline: true, onClick: captureWebFrame, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : null}
                  <Text style={styles.previewHint}>Tap the feed to capture · {imageQueue.length} captured</Text>
                </View>
              ) : currentImage ? (
                <View ref={webPreviewRef} style={[styles.previewCard, isCompactMobile && styles.previewCardMobile, { position: 'relative' }]}>
                  <TouchableOpacity style={styles.previewCardFill} onPress={() => setPreviewVisible(true)}>{currentImage.startsWith('data:application/pdf') ? <View style={[styles.pdfPreview, isCompactMobile && styles.pdfPreviewMobile]}><Text style={styles.pdfBadge}>PDF</Text><Text style={styles.pdfPreviewText}>PDF document ready for upload</Text></View> : <Image source={{ uri: currentImage }} style={[styles.preview, isCompactMobile && styles.previewMobile, { transform: [{ rotate: `${rotation}deg` }] }]} resizeMode="contain" />}</TouchableOpacity>
                  {Platform.OS === 'web' ? React.createElement('canvas', { ref: webSelectionCanvasRef, style: { position: 'absolute', top: 0, left: 0, zIndex: 10, display: 'none' } }) : null}
                  <Text style={[styles.previewHint, isCompactMobile && styles.previewHintMobile]}>{imageQueue.length} file(s) · Tap to preview{Platform.OS === 'web' ? ' · Drag to OCR' : ''}</Text>
                </View>
              ) : <View style={[styles.previewEmpty, isCompactMobile && styles.previewEmptyMobile]}><Text style={styles.previewEmptyText}>Select Camera or Upload to begin</Text></View>}
              {Platform.OS === 'web' ? React.createElement('img', { ref: webImageRef, src: currentImage || '', style: { display: 'none' } }) : null}
              {imageQueue.length > 1 ? <ScrollView horizontal style={styles.thumbs}>{imageQueue.map((image, index) => <TouchableOpacity key={`${index}-${image.slice(-12)}`} onPress={() => selectImageAt(index)}><Image source={{ uri: image }} style={[styles.thumb, index === imageIndex && styles.thumbActive]} /></TouchableOpacity>)}</ScrollView> : null}
              {isCompactMobile && !modalMode ? renderOrderPane(true) : null}
              <View style={styles.selectedCard}><Text style={styles.selectedTitle}>{parties.consignorName} → {parties.consigneeName}</Text><Text style={styles.selectedMeta}>Ref: {selectedOrder.REFERENCE} · AWB: {selectedOrder.AWB_NUMBER || 'N/A'}</Text></View>
              <View style={styles.taskHeader}><Text style={styles.sectionTitle}>Upload tasks</Text>{Platform.OS === 'web' && !isCompactMobile ? (existingUploads.length ? <Text style={styles.link}>{`Existing (${existingUploads.length})`}</Text> : null) : <TouchableOpacity onPress={() => setExistingVisible((value) => !value)}><Text style={styles.link}>{existingVisible ? 'Hide existing' : `Existing (${existingUploads.length})`}</Text></TouchableOpacity>}</View>
              {Platform.OS === 'web' && !isCompactMobile ? renderWebExistingTable() : existingVisible ? <View style={styles.existingBox}>{existingUploads.length ? existingUploads.map((item, index) => {
                const uri = resolveUploadUri(item.FILE_URL || item.url, apiBase);
                const canDelete = (ROLE_LEVELS[role] || 0) >= ROLE_LEVELS.MANAGER;
                return <View key={item.UPLOAD_UID || index} style={styles.existingRow}>
                  <View style={styles.existingInfo}><Text style={styles.existingType}>{item.UPLOAD_TYPE || 'Upload'}</Text><Text style={styles.existingDetail}>{item.STATUS_REMARK || (item.UPLOAD_TYPE === 'POD' ? 'Delivered' : item.UPLOAD_TYPE === 'Reciept' ? 'Booked' : item.FILE_URL || 'No file URL')}</Text></View>
                  <View style={styles.existingActions}>{uri ? <TouchableOpacity style={styles.existingAction} onPress={() => setExistingViewer({ uri, title: `${item.UPLOAD_TYPE || 'Upload'} — ${selectedOrder.AWB_NUMBER || selectedOrder.REFERENCE}`, isPdf: isPdfUpload(item) })}><Text style={styles.existingActionText}>View</Text></TouchableOpacity> : null}{canDelete ? <TouchableOpacity style={[styles.existingAction, styles.existingDelete]} onPress={() => deleteExistingUpload(item)}><Text style={[styles.existingActionText, { color: '#b91c1c' }]}>Delete</Text></TouchableOpacity> : null}</View>
                </View>;
              }) : <Text style={styles.emptyText}>No existing uploads.</Text>}</View> : null}
              {Platform.OS === 'web' && !isCompactMobile
                ? renderWebPickupTable()
                : <View style={isCompactMobile ? styles.dynamicInputMobile : null}>{tasks.map(renderTask)}</View>}
              {Platform.OS === 'web' && !isCompactMobile ? (
                <>
                  {renderWebDataTable()}
                  <View style={styles.webTableActions}>
                    {React.createElement('button', { style: webBtnDanger, onClick: deleteLastStagedRow }, 'Delete Last')}
                    {React.createElement('button', { style: webBtnDanger, onClick: () => { setStagedRows([]); setSubmitStates({}); } }, 'Clear All')}
                    {React.createElement('button', { style: webBtnPrimary, disabled: busy, onClick: submitRows }, busy ? 'Submitting...' : 'Submit')}
                  </View>
                </>
              ) : stagedRows.length ? <View style={styles.stagedBox}><View style={styles.stagedHeader}><Text style={styles.sectionTitle}>Ready to submit ({stagedRows.length})</Text><View style={styles.stagedHeaderActions}><TouchableOpacity onPress={deleteLastStagedRow}><Text style={styles.link}>Delete last</Text></TouchableOpacity><TouchableOpacity onPress={() => { setStagedRows([]); setSubmitStates({}); }}><Text style={[styles.link, { color: '#b91c1c' }]}>Clear all</Text></TouchableOpacity></View></View>{stagedRows.map((row, index) => { const detail = describeStagedRow(row); const rowState = submitStates[stagedRowKey(row, index)]; return <View key={`${detail.type}-${index}`} style={[styles.stagedRow, rowState === 'success' && styles.stagedSuccess, rowState === 'error' && styles.stagedFailure]}><Text style={styles.stagedMain}>{detail.type} · {detail.imageCount} image(s){rowState === 'success' ? ' · Submitted' : rowState === 'error' ? ' · Failed' : ''}</Text><Text style={styles.stagedSub}>{detail.refAwb}{detail.customerKyc ? ` · ${detail.customerKyc}` : ''}{detail.docInfo ? ` · ${detail.docInfo}` : ''}</Text></View>; })}<TouchableOpacity style={styles.submitButton} disabled={busy} onPress={submitRows}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit {stagedRows.length} Upload(s)</Text>}</TouchableOpacity></View> : null}
            </>
          )}
        </ScrollView>
      </View>
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}><View style={styles.modal}><TouchableOpacity onPress={() => setPreviewVisible(false)}><Text style={styles.close}>✕ Close</Text></TouchableOpacity>{currentImage?.startsWith('data:application/pdf') ? <View style={styles.pdfLargePreview}><Text style={styles.pdfBadge}>PDF</Text><Text style={styles.pdfPreviewText}>The original PDF will be sent with this upload.</Text></View> : currentImage ? <Image source={{ uri: currentImage }} style={styles.largePreview} resizeMode="contain" /> : null}</View></Modal>
      <UploadViewer visible={!!existingViewer} uri={existingViewer?.uri} title={existingViewer?.title} isPdf={existingViewer?.isPdf} onClose={() => setExistingViewer(null)} />

      {/* ── Web inline Cropper modal (web inline-cropper-wrapper parity) ── */}
      {Platform.OS === 'web' ? (
        <Modal
          visible={cropMode}
          transparent
          animationType="fade"
          onRequestClose={() => { if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; } setCropMode(false); setEnhanceVisible(false); }}
        >
          <View style={styles.webCropOverlay}>
            <View style={styles.webCropCard}>
              <View ref={webCropperWrapRef} style={styles.webCropArea}>
                {React.createElement('img', { ref: webCropperImgRef, alt: 'Crop', style: { display: 'block', maxWidth: '100%' } })}
              </View>
              <View style={styles.webCropButtons}>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1e3a5f' }]} onPress={() => webCropperRef.current?.rotate(90)}><Text style={styles.actionText}>Rotate</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1e3a5f' }]} onPress={() => setEnhanceVisible((value) => !value)}><Text style={styles.actionText}>Enhance</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#007bff' }]} onPress={runOcrExtraction}><Text style={styles.actionText}>Extract Data (OCR)</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#15803d' }]} onPress={confirmWebCrop}><Text style={styles.actionText}>Crop</Text></TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => { if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; } setCropMode(false); setEnhanceVisible(false); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              </View>
              {enhanceVisible ? (
                <View style={styles.webEnhanceBox}>
                  <View style={styles.webEnhanceRow}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1e3a5f' }]} onPress={autoEnhance}><Text style={styles.actionText}>Auto</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, enhancements.greyscale && styles.locked]} onPress={toggleGreyscale}><Text style={styles.actionText}>Greyscale</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, enhancements.bw && styles.locked]} onPress={toggleBlackWhite}><Text style={styles.actionText}>B&W Doc</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, enhancements.sharpen && styles.locked]} onPress={toggleSharpen}><Text style={styles.actionText}>Sharpen</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={resetEnhancements}><Text style={styles.actionText}>Reset</Text></TouchableOpacity>
                  </View>
                  <View style={styles.webSliderRow}><Text style={styles.webSliderLabel}>Brightness</Text>{React.createElement('input', { type: 'range', min: -50, max: 50, value: String(enhancements.brightness), onChange: (e) => setEnhancementValue('brightness', Number(e.target.value)), style: { flexGrow: 1 } })}</View>
                  <View style={styles.webSliderRow}><Text style={styles.webSliderLabel}>Contrast</Text>{React.createElement('input', { type: 'range', min: -50, max: 50, value: String(enhancements.contrast), onChange: (e) => setEnhancementValue('contrast', Number(e.target.value)), style: { flexGrow: 1 } })}</View>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}

      {/* ── Native live barcode/QR scanner (expo-camera) ── */}
      <Modal visible={nativeScanVisible} animationType="slide" onRequestClose={() => setNativeScanVisible(false)}>
        <View style={styles.scanModal}>
          <View style={styles.scanHeader}>
            <Text style={styles.scanTitle}>Scan barcode / QR</Text>
            <TouchableOpacity onPress={() => setNativeScanVisible(false)}><Text style={styles.scanClose}>✕ Close</Text></TouchableOpacity>
          </View>
          <CameraView
            style={styles.scanner}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'datamatrix', 'pdf417', 'aztec', 'code93', 'codabar'] }}
            onBarcodeScanned={scanPaused ? undefined : onNativeBarcode}
          />
          <Text style={styles.scanHint}>Point the camera at a barcode or QR code. It auto-detects and fills the selected task row, matches an order, or filters the list.</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  pageHeader: { padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 19, fontWeight: '900', color: '#0f172a' }, subtitle: { marginTop: 3, fontSize: 11, color: '#64748b' },
  controlsStrip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 9, backgroundColor: '#e9ecef', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  controlsStripMobile: { gap: 4, padding: 6 }, controlsStripWebMobile: { position: 'sticky', top: 0, zIndex: 20 },
  typeButton: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#fff' }, compactButton: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5 }, typeButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, typeText: { fontSize: 11, fontWeight: '800', color: '#334155' }, typeTextActive: { color: '#fff' },
  actionButton: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#1e3a5f' }, actionText: { color: '#fff', fontSize: 11, fontWeight: '800' }, locked: { backgroundColor: '#15803d' }, cancelButton: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fee2e2' }, cancelText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },
  enhancementInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', borderRadius: 7, paddingHorizontal: 5 }, compactEnhancementInputGroup: { paddingHorizontal: 3, borderRadius: 5 }, enhancementLabel: { color: '#334155', fontSize: 10, fontWeight: '900' }, enhancementInput: { width: 34, height: 28, paddingHorizontal: 3, paddingVertical: 2, color: '#0f172a', fontSize: 10, textAlign: 'center' },
  status: { paddingHorizontal: 12, paddingVertical: 7, color: '#475569', fontSize: 11, fontWeight: '700', backgroundColor: '#fff' }, statusError: { color: '#b91c1c', backgroundColor: '#fef2f2' },  body: { flex: 1, flexDirection: 'row' }, bodyMobile: { flexDirection: 'column' }, bodyModal: { flexDirection: 'column' }, orderPane: { width: '34%', minWidth: 230, borderRightWidth: 1, borderRightColor: '#e2e8f0', backgroundColor: '#fff', padding: 10 },  orderPaneMobile: { width: '100%', minWidth: 0, maxHeight: 360, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 8, marginTop: 10, borderRadius: 8, overflow: 'hidden' },
  orderPaneCollapsed: { maxHeight: 56, height: 56, paddingBottom: 6 },
  mobileOrderHeader: { minHeight: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5 },
  mobileOrderTitle: { color: '#0f172a', fontSize: 12, fontWeight: '900' },
  mobileOrderSummary: { color: '#64748b', fontSize: 10, marginTop: 2 },
  mobileOrderChevron: { color: COLORS.primary, fontSize: 22, fontWeight: '900', paddingHorizontal: 8 }, workPane: { flex: 1 }, workContent: { padding: 12, paddingBottom: 32 }, search: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, backgroundColor: '#f8fafc' }, listSummary: { color: '#64748b', fontSize: 10, fontWeight: '700', marginVertical: 8 },  orderList: { flex: 1 }, orderItem: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 7, backgroundColor: '#fff' }, orderSelected: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' }, orderAwb: { color: '#0f172a', fontWeight: '900', fontSize: 12 }, orderParties: { color: '#334155', fontSize: 11, fontWeight: '700', marginTop: 3 }, orderMeta: { color: '#64748b', fontSize: 10, marginTop: 3 }, loadMore: { padding: 10, alignItems: 'center' }, loadMoreText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' }, emptyText: { color: '#94a3b8', fontSize: 12, padding: 12, textAlign: 'center' },
  selectedCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 10 }, pdfPreview: { alignItems: 'center', justifyContent: 'center', minHeight: 190 }, pdfPreviewMobile: { minHeight: 0, flex: 1, width: '100%' }, pdfLargePreview: { alignItems: 'center', justifyContent: 'center', flex: 1 }, pdfBadge: { backgroundColor: '#dc2626', color: '#fff', fontSize: 22, fontWeight: '900', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }, pdfPreviewText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  stagedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, stagedHeaderActions: { flexDirection: 'row', gap: 10 },
 selectedTitle: { color: '#1e3a8a', fontSize: 14, fontWeight: '900' }, selectedMeta: { color: '#64748b', fontSize: 11, marginTop: 4 }, previewCard: { backgroundColor: '#0f172a', minHeight: 200, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 8 },  previewCardMobile: { minHeight: 0, aspectRatio: 1, width: '100%', borderRadius: 4, padding: 5, position: 'relative' }, preview: { width: '100%', height: 250 },  previewMobile: { flex: 1, width: '100%', height: '100%', aspectRatio: undefined }, previewHint: { color: '#cbd5e1', fontSize: 10, marginTop: 4 }, previewHintMobile: { position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', marginTop: 0 }, previewEmpty: { minHeight: 180, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, previewEmptyMobile: { minHeight: 0, aspectRatio: 1, width: '100%', borderRadius: 4, marginBottom: 8 }, previewEmptyText: { color: '#64748b', fontSize: 12 }, thumbs: { marginVertical: 8 }, thumb: { width: 56, height: 56, marginRight: 6, borderRadius: 5, borderWidth: 2, borderColor: 'transparent' }, thumbActive: { borderColor: COLORS.primary },
  dynamicInputMobile: { width: '100%', marginTop: 5, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, backgroundColor: '#fafafa', padding: 6 }, taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 }, sectionTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900' }, link: { color: COLORS.primary, fontSize: 11, fontWeight: '800' }, taskCard: { backgroundColor: '#fff', borderRadius: 9, borderWidth: 1, borderColor: '#e2e8f0', padding: 10, marginBottom: 8 }, taskHeading: { flexDirection: 'row', justifyContent: 'space-between' }, taskType: { color: '#0369a1', fontSize: 12, fontWeight: '900' }, taskRef: { color: '#64748b', fontSize: 10 }, taskHint: { color: '#64748b', fontSize: 10, marginVertical: 5 }, field: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7, marginTop: 6, fontSize: 12, backgroundColor: '#f8fafc' }, kycOptions: { gap: 6, paddingVertical: 7 }, optionChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5 }, optionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, optionText: { fontSize: 9, color: '#475569', fontWeight: '700' }, optionTextActive: { color: '#fff' }, pickButton: { marginTop: 8, backgroundColor: '#16a34a', borderRadius: 7, paddingVertical: 8, alignItems: 'center' }, pickButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' }, disabled: { opacity: 0.45 }, emptyTask: { color: '#94a3b8', padding: 10 }, existingBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 8, padding: 8 }, existingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, existingInfo: { flex: 1, paddingRight: 8 }, existingType: { color: '#334155', fontSize: 10, fontWeight: '900' }, existingDetail: { color: '#64748b', fontSize: 9, marginTop: 2 }, existingActions: { flexDirection: 'row', gap: 5 }, existingAction: { borderWidth: 1, borderColor: '#93c5fd', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 }, existingDelete: { borderColor: '#fca5a5' }, existingActionText: { color: '#0369a1', fontSize: 9, fontWeight: '900' },  stagedBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac', borderRadius: 9, padding: 10, marginTop: 8 }, stagedRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#bbf7d0' }, stagedSuccess: { backgroundColor: '#d4edda' }, stagedFailure: { backgroundColor: '#f8d7da' }, stagedMain: { color: '#166534', fontSize: 11, fontWeight: '900' }, stagedSub: { color: '#4d7c0f', fontSize: 10, marginTop: 2 }, completeTask: { color: '#15803d', fontWeight: '900', padding: 14, textAlign: 'center' }, submitButton: { backgroundColor: COLORS.primary, borderRadius: 7, paddingVertical: 10, alignItems: 'center', marginTop: 9 }, submitText: { color: '#fff', fontWeight: '900', fontSize: 12 }, placeholder: { color: '#94a3b8', textAlign: 'center', padding: 30 },  modal: { flex: 1, backgroundColor: 'rgba(2,6,23,.9)', padding: 18, justifyContent: 'center' }, close: { color: '#fff', fontSize: 14, fontWeight: '800', alignSelf: 'flex-end', marginBottom: 10 }, largePreview: { width: '100%', height: '80%' },

  modalCloseButton: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginTop: 4, borderRadius: 7, backgroundColor: '#fee2e2' }, modalCloseText: { color: '#b91c1c', fontSize: 11, fontWeight: '900' },
  previewCardFill: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },

  // Web cropper modal
  webCropOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.82)', padding: 10, justifyContent: 'center' },
  webCropCard: { width: '100%', maxWidth: 860, alignSelf: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, padding: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#1E3A8A' },
  webCropArea: { width: '100%', height: '60vh', backgroundColor: '#0f172a', overflow: 'hidden' },
  webCropButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 },
  webEnhanceBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ccc' },
  webEnhanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  webSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 280, justifyContent: 'center', marginTop: 10, alignSelf: 'center' },
  webSliderLabel: { color: '#334155', fontSize: 11, fontWeight: '700', width: 64 },
  webTableActions: { width: '100%', marginTop: 15, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },

  // Native live scanner
  scanModal: { flex: 1, backgroundColor: '#020617' },
  scanHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#334155' },
  scanTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  scanClose: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', padding: 4 },
  scanner: { flex: 1 },
  scanHint: { color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 12, lineHeight: 16 },
});
