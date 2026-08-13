import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, Modal, PanResponder, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { FilterImage } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { recognizeText } from 'expo-ocr-kit';
import PdfPageImageModule from 'expo-pdf-page-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';
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

// Native preview equivalent of the web CSS filters. FilterImage keeps the
// controls live on Android/iOS without pretending that ImageManipulator has
// unsupported brightness/contrast actions.
const buildNativeFilters = (opts = {}) => {
  const brightness = (Number(opts.brightness) || 0) / 100;
  const contrast = (100 + (Number(opts.contrast) || 0) * 2) / 100;
  const offset = 0.5 * (1 - contrast) + brightness;
  const gray = [0.2126, 0.7152, 0.0722];
  const matrix = opts.bw || opts.greyscale
    ? [gray[0] * contrast, gray[1] * contrast, gray[2] * contrast, 0, offset,
      gray[0] * contrast, gray[1] * contrast, gray[2] * contrast, 0, offset,
      gray[0] * contrast, gray[1] * contrast, gray[2] * contrast, 0, offset,
      0, 0, 0, 1, 0]
    : [contrast, 0, 0, 0, offset,
      0, contrast, 0, 0, offset,
      0, 0, contrast, 0, offset,
      0, 0, 0, 1, 0];
  if (opts.bw) {
    matrix[0] *= 1.7; matrix[1] *= 1.7; matrix[2] *= 1.7;
    matrix[5] *= 1.7; matrix[6] *= 1.7; matrix[7] *= 1.7;
    matrix[10] *= 1.7; matrix[11] *= 1.7; matrix[12] *= 1.7;
  }
  return [{ name: 'feColorMatrix', type: 'matrix', values: matrix }];
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
  const [existingViewer, setExistingViewer] = useState(null);
  const [deletingUpload, setDeletingUpload] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [enhancements, setEnhancements] = useState({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
  const [nativeProcessingSize, setNativeProcessingSize] = useState({ width: 1024, height: 1024 });
  const [deletedUploadIds, setDeletedUploadIds] = useState(() => new Set());
  const [submitStates, setSubmitStates] = useState({});
  const webInputRef = useRef(null);
  const sessionGenerationRef = useRef(0);
  const [kycPickerVisible, setKycPickerVisible] = useState(false);
  const [enhancePanelVisible, setEnhancePanelVisible] = useState(false);
  // ── Native crop modal (web initCropper parity: 95% box, drag-move, corner resize, rotate) ──
  const [nativeCropVisible, setNativeCropVisible] = useState(false);
  const [cropImageUri, setCropImageUri] = useState('');
  const [cropRect, setCropRect] = useState(null);
  const [cropBusy, setCropBusy] = useState(false);
  const cropRectRef = useRef(null);
  const cropStageSizeRef = useRef(null);
  const cropBoundsRef = useRef(null);
  const cropGestureRef = useRef(null);
  const cropPanResponderRef = useRef(null);
  // Drag-to-move / corner-resize for the crop box. Refs only, so the responder
  // never goes stale across renders.
  if (!cropPanResponderRef.current) {
    cropPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const rect = cropRectRef.current;
        if (!rect) return;
        const { locationX, locationY } = evt.nativeEvent;
        let mode = 'move';
        const tolerance = 28;
        const corners = [['tl', 0, 0], ['tr', rect.w, 0], ['bl', 0, rect.h], ['br', rect.w, rect.h]];
        for (const [key, cx, cy] of corners) {
          if (Math.abs(locationX - cx) <= tolerance && Math.abs(locationY - cy) <= tolerance) { mode = key; break; }
        }
        cropGestureRef.current = { mode, orig: { ...rect } };
      },
      onPanResponderMove: (evt) => {
        const gesture = cropGestureRef.current;
        const bounds = cropBoundsRef.current;
        if (!gesture || !bounds) return;
        const { dx, dy } = evt.nativeEvent;
        const min = 48;
        const minX = bounds.offsetX;
        const minY = bounds.offsetY;
        const maxX = bounds.offsetX + bounds.renderedW;
        const maxY = bounds.offsetY + bounds.renderedH;
        const rect = { ...gesture.orig };
        if (gesture.mode === 'move') {
          rect.x = Math.max(minX, Math.min(maxX - rect.w, gesture.orig.x + dx));
          rect.y = Math.max(minY, Math.min(maxY - rect.h, gesture.orig.y + dy));
        } else if (gesture.mode === 'br') {
          rect.w = Math.max(min, Math.min(maxX - rect.x, gesture.orig.w + dx));
          rect.h = Math.max(min, Math.min(maxY - rect.y, gesture.orig.h + dy));
        } else if (gesture.mode === 'tl') {
          const nx = Math.min(gesture.orig.x + gesture.orig.w - min, Math.max(minX, gesture.orig.x + dx));
          const ny = Math.min(gesture.orig.y + gesture.orig.h - min, Math.max(minY, gesture.orig.y + dy));
          rect.w = gesture.orig.x + gesture.orig.w - nx;
          rect.h = gesture.orig.y + gesture.orig.h - ny;
          rect.x = nx;
          rect.y = ny;
        } else if (gesture.mode === 'tr') {
          const nx = Math.max(minX, Math.min(maxX - min, gesture.orig.x + dx));
          rect.x = nx;
          rect.w = Math.max(min, gesture.orig.x + gesture.orig.w - nx);
          rect.h = Math.max(min, Math.min(maxY - rect.y, gesture.orig.h + dy));
        } else if (gesture.mode === 'bl') {
          const ny = Math.max(minY, Math.min(maxY - min, gesture.orig.y + dy));
          rect.y = ny;
          rect.h = Math.max(min, gesture.orig.y + gesture.orig.h - ny);
          rect.w = Math.max(min, Math.min(maxX - rect.x, gesture.orig.w + dx));
        }
        cropRectRef.current = rect;
        setCropRect({ ...rect });
      },
      onPanResponderTerminationRequest: () => false,
    });
  }

  // ── Web-parity engine state (cropper / camera / OCR / scan) ────────────────
  const [cropMode, setCropMode] = useState(false);        // web inline Cropper.js overlay
  const [enhanceVisible, setEnhanceVisible] = useState(false); // web cropper enhancement controls
  const [webCameraActive, setWebCameraActive] = useState(false); // web getUserMedia live feed
  const [webCaptured, setWebCaptured] = useState(false);  // web 'Cancel' -> 'Done' after first capture
  const [nativeScanVisible, setNativeScanVisible] = useState(false); // expo-camera live scanner
  const [nativeCameraActive, setNativeCameraActive] = useState(false);
  const [nativeCameraReady, setNativeCameraReady] = useState(false);
  const [nativeCameraCaptured, setNativeCameraCaptured] = useState(false);
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
  const nativeCameraRef = useRef(null);
  const nativeProcessingRef = useRef(null);
  const streamRef = useRef(null);             // active MediaStream
  const pdfPageUrisRef = useRef(new Set());
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
    setDeletedUploadIds(new Set());
    setSubmitStates({});
    setKycPickerVisible(false);
    setNativeCropVisible(false);
    setNativeCameraActive(false);
    setNativeCameraReady(false);
    setNativeCameraCaptured(false);
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
  const nativeFilters = buildNativeFilters(enhancements);
  const parties = selectedOrder ? getOrderParties(selectedOrder, normalized.contacts) : null;
  // Raw PDF is only a defensive fallback; selected native PDFs are rasterized
  // into page images before entering the queue, matching the web pipeline.
  const isPdfItem = String(currentImage || '').startsWith('data:application/pdf');

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web' || !currentImage || isPdfItem) return undefined;
    (async () => {
      try {
        const uri = await dataUrlToCacheUri(currentImage);
        const size = await new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
        const scale = Math.min(1024 / size.width, 1024 / size.height, 1);
        if (active) setNativeProcessingSize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) });
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [currentImage, isPdfItem]);

  const setMessage = (message, error = false) => { setStatus(message); setStatusError(error); };

  // uploader.html loads these browser libraries before uploader.js. Expo web
  // has no HTML script list, so load the same libraries on demand before a
  // crop/PDF/OCR/submit operation starts.
  const webLibrariesPromiseRef = useRef(null);
  const loadWebScript = (src, globalName) => new Promise((resolve, reject) => {
    if (globalThis[globalName]) { resolve(globalThis[globalName]); return; }
    const existing = document.querySelector(`script[data-genie-uploader="${globalName}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis[globalName]), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.genieUploader = globalName;
    script.onload = () => globalThis[globalName] ? resolve(globalThis[globalName]) : reject(new Error(`${globalName} did not load`));
    script.onerror = () => reject(new Error(`Could not load ${globalName}`));
    document.head.appendChild(script);
  });
  const ensureWebLibraries = () => {
    if (Platform.OS !== 'web') return Promise.resolve();
    if (!webLibrariesPromiseRef.current) {
      const cropCss = document.querySelector('link[data-genie-uploader="cropper-css"]') || document.createElement('link');
      if (!cropCss.parentNode) {
        cropCss.rel = 'stylesheet';
        cropCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css';
        cropCss.dataset.genieUploader = 'cropper-css';
        document.head.appendChild(cropCss);
      }
      webLibrariesPromiseRef.current = Promise.all([
        loadWebScript('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js', 'Cropper'),
        loadWebScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js', 'pdfjsLib'),
        loadWebScript('https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js', 'Tesseract'),
        loadWebScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf'),
      ]).catch((error) => {
        webLibrariesPromiseRef.current = null;
        throw error;
      });
    }
    return webLibrariesPromiseRef.current;
  };

  // Keep DOM OCR/barcode handlers on the latest closure (web engine parity).
  // applyScanResultRef.current is refreshed right after applyScanResult's
  // definition below so every render exposes the freshest closure.

  // ── Web Cropper lifecycle (web initCropper parity) ──────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !cropMode || !currentImage) return;
    const imgEl = webCropperImgRef.current;
    if (!imgEl) return;
    if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
    setEnhancements({ brightness: 0, contrast: 0, sharpen: false, greyscale: false, bw: false });
    let timer;
    let initialized = false;
    let cancelled = false;
    const initialize = () => {
      if (cancelled || initialized || !imgEl.naturalWidth || typeof globalThis.Cropper !== 'function') return;
      initialized = true;
      webCropperRef.current = new globalThis.Cropper(imgEl, {
        viewMode: 1, background: false, autoCrop: true, autoCropArea: 0.95,
        zoomable: true, movable: true, scalable: true,
      });
      // web initCropper parity: auto-enhance + reveal controls after 200ms
      timer = setTimeout(() => {
        setEnhancements({ brightness: 10, contrast: 10, sharpen: true, greyscale: false, bw: false });
        setEnhanceVisible(true);
      }, 200);
    };
    imgEl.onload = initialize;
    imgEl.src = currentImage;
    ensureWebLibraries().then(() => {
      if (cancelled) return;
      if (imgEl.complete) initialize();
    }).catch((error) => {
      if (!cancelled) { setMessage(`Uploader libraries could not load: ${error.message}`, true); setCropMode(false); }
    });
    if (imgEl.complete) initialize();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      imgEl.onload = null;
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
    if (Platform.OS !== 'web' && pdfPageUrisRef.current.size) {
      PdfPageImageModule.cleanupPages([...pdfPageUrisRef.current]).catch(() => {});
      pdfPageUrisRef.current.clear();
    }
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

  const startNativeCamera = async () => {
    if (processingImage || nativeCameraActive) return;
    resetUploader();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setMessage('Camera permission is required.', true); return; }
    setImageQueue([]);
    setImageIndex(0);
    setNativeCameraReady(false);
    setNativeCameraCaptured(false);
    setNativeCameraActive(true);
    setMessage('Starting camera...');
  };

  const stopNativeCamera = () => {
    setNativeCameraActive(false);
    setNativeCameraReady(false);
    setNativeCameraCaptured(false);
  };

  const captureNativeFrame = async () => {
    if (processingImage || !nativeCameraRef.current || !nativeCameraReady) {
      setMessage('Camera is still starting…', true);
      return;
    }
    if (imageQueue.length >= MAX_FILES) { setMessage(`Maximum of ${MAX_FILES} images reached.`, true); return; }
    setProcessingImage(true);
    try {
      const picture = await nativeCameraRef.current.takePictureAsync({ base64: true, quality: 0.95, skipProcessing: false });
      const dataUrl = picture?.base64 ? `data:image/jpeg;base64,${picture.base64}` : picture?.uri;
      if (!dataUrl) throw new Error('Camera returned no image.');
      setImageQueue((queue) => [...queue, dataUrl]);
      setImageIndex(0);
      setNativeCameraCaptured(true);
      setMessage(`${imageQueue.length + 1} image(s) captured.`);
    } catch (error) { setMessage(`Capture failed: ${error.message}`, true); }
    finally { setProcessingImage(false); }
  };

  const doneNativeCamera = () => {
    const firstImage = imageQueue[0];
    stopNativeCamera();
    if (firstImage) {
      setImageIndex(0);
      openNativeCrop(firstImage);
    }
  };

  const captureWebFrame = async () => {
    const video = webVideoRef.current;
    if (!video || !streamRef.current) return;
    if (imageQueue.length >= MAX_FILES) { setMessage(`Maximum of ${MAX_FILES} images reached.`, true); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) { setMessage('Camera is still starting…', true); return; }
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2, sy = (vh - size) / 2;
    const canvas = document.createElement('canvas');
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
    resetUploader();
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
  const runNativeOcr = async (source = currentImage) => {
    if (!source) { setMessage('No image in preview. Capture or upload an image first.', true); return; }
    setProcessingImage(true);
    setMessage('Running OCR…');
    try {
      const localUri = await dataUrlToCacheUri(source);
      const result = await recognizeText(localUri);
      const text = String(result?.text || '').trim();
      const cleanText = text.replace(/\s+/g, ' ');
      const mobiles = [...new Set(cleanText.match(/(?:\+91|91)?\s*[6-9]\d{9}/g) || [])];
      const gsts = [...new Set(cleanText.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/gi) || [])];
      const pins = [...new Set(cleanText.match(/\b\d{6}\b/g) || [])];
      if (!text) { setMessage('OCR found no text.', true); return; }
      const candidate = text.replace(/\s+/g, '').trim();
      const matched = normalized.orders.find((order) => String(order.REFERENCE) === candidate || String(order.AWB_NUMBER) === candidate);
      if (matched) {
        selectOrder(matched);
        setMessage(`OCR matched: ${candidate}. Loading tasks...`);
      } else if (selectedTaskIndex != null && tasks[selectedTaskIndex]?.type && tasks[selectedTaskIndex].type !== 'complete') {
        applyScanResult(candidate);
      } else {
        Alert.alert('OCR extraction complete', `Mobiles: ${mobiles.length ? mobiles.join(', ') : 'None found'}\nGSTs: ${gsts.length ? gsts.join(', ') : 'None found'}\nPINs: ${pins.length ? pins.join(', ') : 'None found'}\n\nText: ${text.slice(0, 500)}`);
        setMessage('OCR extraction complete.');
      }
    } catch (error) {
      setMessage(`OCR failed: ${error.message}`, true);
    } finally { setProcessingImage(false); }
  };

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
    if (Platform.OS !== 'web') return;
    setProcessingImage(true);
    setMessage('Running OCR extraction... Please wait.');
    try {
      await ensureWebLibraries();
      if (!webCropperRef.current) throw new Error('Cropper is not ready.');
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
    setImageIndex(index);
    if (Platform.OS === 'web') setCropMode(true);
    else if (imageQueue[index]) openNativeCrop(imageQueue[index]);
  };

  const onPressCrop = () => {
    if (Platform.OS === 'web') { setCropMode(true); return; }
    openNativeCrop(currentImage);
  };

  // ── Native crop modal (web initCropper parity) ─────────────────────────────
  // autoCropArea 0.95 like the web, drag to move, corner handles to resize,
  // Rotate (90°) applied to the source, Crop bakes + compresses the selection
  // (mini 100 KB/1024 px, full 200 KB/2048 px) and replaces the queue item.
  const openNativeCrop = (uri) => {
    if (!uri) { setMessage('No image in preview. Capture or upload an image first.', true); return; }
    setCropImageUri(uri);
    setCropRect(null);
    setCropBusy(false);
    setNativeCropVisible(true);
  };

  const measureCrop = async () => {
    const stageW = cropStageSizeRef.current?.width;
    const stageH = cropStageSizeRef.current?.height;
    if (!stageW || !stageH || !cropImageUri) return;
    try {
      const src = await dataUrlToCacheUri(cropImageUri);
      const size = await new Promise((resolve, reject) => Image.getSize(src, (width, height) => resolve({ width, height }), reject));
      const scale = Math.min(stageW / size.width, stageH / size.height);
      const renderedW = size.width * scale;
      const renderedH = size.height * scale;
      const offsetX = (stageW - renderedW) / 2;
      const offsetY = (stageH - renderedH) / 2;
      const rectW = renderedW * 0.95;
      const rectH = renderedH * 0.95;
      cropBoundsRef.current = { stageW, stageH, natW: size.width, natH: size.height, renderedW, renderedH, offsetX, offsetY };
      const rect = { x: offsetX + (renderedW - rectW) / 2, y: offsetY + (renderedH - rectH) / 2, w: rectW, h: rectH };
      cropRectRef.current = rect;
      setCropRect({ ...rect });
    } catch (_) {
      setMessage('Could not load the image for cropping.', true);
    }
  };

  const onCropLayout = (event) => {
    cropStageSizeRef.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
    measureCrop();
  };

  // Re-measure after a rotate swaps the image dimensions.
  useEffect(() => {
    if (nativeCropVisible && cropImageUri) measureCrop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropImageUri, nativeCropVisible]);

  const rotateNativeCrop = async () => {
    if (cropBusy || !cropImageUri) return;
    setCropBusy(true);
    try {
      const src = await dataUrlToCacheUri(cropImageUri);
      const result = await manipulateAsync(src, [{ rotate: 90 }], { compress: 0.92, format: SaveFormat.JPEG, base64: true });
      if (result?.base64) setCropImageUri(`data:image/jpeg;base64,${result.base64}`);
      else setMessage('Rotate failed.', true);
    } catch (error) { setMessage(`Rotate failed: ${error.message}`, true); }
    finally { setCropBusy(false); }
  };

  const confirmNativeCrop = async () => {
    if (cropBusy) return;
    const bounds = cropBoundsRef.current;
    const rect = cropRectRef.current;
    if (!bounds || !rect) return;
    setCropBusy(true);
    try {
      // Map the on-screen crop box back to source pixel coordinates.
      const scaleX = bounds.natW / bounds.renderedW;
      const scaleY = bounds.natH / bounds.renderedH;
      let sx = (rect.x - bounds.offsetX) * scaleX;
      let sy = (rect.y - bounds.offsetY) * scaleY;
      let sw = rect.w * scaleX;
      let sh = rect.h * scaleY;
      sx = Math.max(0, Math.min(bounds.natW, sx));
      sy = Math.max(0, Math.min(bounds.natH, sy));
      sw = Math.max(1, Math.min(bounds.natW - sx, sw));
      sh = Math.max(1, Math.min(bounds.natH - sy, sh));
      const cropped = await processNativeImage(
        cropImageUri, 0, false, modalMode ? 100 : 200, modalMode ? 1024 : 2048,
        { originX: Math.round(sx), originY: Math.round(sy), width: Math.round(sw), height: Math.round(sh) },
      );
      setImageQueue((queue) => queue.map((item, index) => (index === imageIndex ? cropped : item)));
      setRotation(0);
      setNativeCropVisible(false);
      setMessage('Crop applied.');
    } catch (error) { setMessage(`Crop failed: ${error.message}`, true); }
    finally { setCropBusy(false); }
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
    if (Platform.OS !== 'web') { await runNativeOcr(currentImage); return; }
    try {
      await ensureWebLibraries();
      if (!globalThis.Tesseract) throw new Error('OCR library did not load.');
      setMessage('Running OCR…');
      const result = await globalThis.Tesseract.recognize(currentImage, 'eng');
      const value = String(result?.data?.text || '').trim().replace(/\s+/g, ' ');
      if (!value) { setMessage('OCR found no text.', true); return; }
      applyScanResult(value);
    } catch (error) { setMessage(`OCR failed: ${error.message}`, true); }
  };

  // Native Upload parity: the web file input accepts image/* + application/pdf.
  // expo-document-picker covers both on Android/iOS; native PDFs are rendered
  // into PNG page images before entering the same queue as photographs.
  const pickDocuments = async () => {
    if (busy || processingImage) return;
    const sessionGeneration = sessionGenerationRef.current;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length || sessionGeneration !== sessionGenerationRef.current) return;
      const next = [];
      for (const asset of result.assets) {
        if (next.length >= MAX_FILES) break;
        if (!asset?.uri) continue;
        const isPdf = asset.mimeType === 'application/pdf' || /\.pdf$/i.test(asset.name || asset.uri);
        if (isPdf) {
          if (Platform.OS === 'web') {
            const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
            next.push(`data:application/pdf;base64,${base64}`);
          } else {
            setMessage(`Rendering PDF ${asset.name || ''}...`);
            const pages = await PdfPageImageModule.generateAllPages(asset.uri, 2);
            pages.slice(0, MAX_FILES - next.length).forEach((page) => {
              if (page?.uri) { pdfPageUrisRef.current.add(page.uri); next.push(page.uri); }
            });
          }
        } else {
          const dataUrl = await assetData(asset);
          if (dataUrl) next.push(dataUrl);
        }
      }
      if (sessionGeneration !== sessionGenerationRef.current) return;
      if (!next.length) { setMessage('No valid files selected.', true); return; }
      setImageQueue(next);
      setImageIndex(0);
      setRotation(0);
      setMessage(`${next.length} file(s) loaded.`);
      if (Platform.OS !== 'web') openNativeCrop(next[0]);
    } catch (error) { setMessage(`Could not load file: ${error.message}`, true); }
  };

  const chooseAssets = async (camera = false) => {
    if (busy || processingImage) return;
    const sessionGeneration = sessionGenerationRef.current;
    if (camera && Platform.OS === 'web') {
      // Web parity: live getUserMedia feed with click-to-capture (not a picker)
      startWebCamera();
      return;
    }
    if (camera && Platform.OS !== 'web') {
      startNativeCamera();
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
      // Web parity: a camera capture enters the crop flow immediately.
      if (camera && Platform.OS !== 'web') openNativeCrop(next[0]);
      if (camera && Platform.OS === 'web') setCropMode(true);
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
        if (file.type === 'application/pdf') {
          await ensureWebLibraries();
          // web handlePdfFile parity: worker CDN fallback + 2x render + JPEG 0.9
          if (globalThis.pdfjsLib?.GlobalWorkerOptions) {
            globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          }
          if (!globalThis.pdfjsLib?.getDocument) throw new Error('PDF renderer did not load.');
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
      // uploader.js file-input flow calls displayImage(0), which opens the
      // inline Cropper immediately for the first selected image/page.
      if (Platform.OS === 'web') setCropMode(true);
    } catch (error) { setMessage(`Could not process files: ${error.message}`, true); }
    finally { if (event?.target) event.target.value = ''; }
  };

  const cleanupPdfPages = () => {
    if (Platform.OS === 'web' || !pdfPageUrisRef.current.size) return;
    const uris = [...pdfPageUrisRef.current];
    pdfPageUrisRef.current.clear();
    PdfPageImageModule.cleanupPages(uris).catch(() => {});
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
    } else {
      stopNativeCamera();
      cleanupPdfPages();
    }
    setNativeScanVisible(false);
    setNativeCropVisible(false);
    setKycPickerVisible(false);
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
    setNativeCropVisible(false);
    setKycPickerVisible(false);
    setSelectedTaskIndex(null);
    if (Platform.OS !== 'web') {
      stopNativeCamera();
      cleanupPdfPages();
    }
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
    setSubmitStates({});
    setKycPickerVisible(false);
    setMessage(`Ready. Uploading for: ${order.AWB_NUMBER || order.REFERENCE}`);
  };

  // Each web pickup-table row owns its own inputs. Keeping fields keyed by the
  // task prevents POD/receipt rows and the two KYC rows from sharing values.
  const taskKey = (task, index = 0) => [task?.type || '', task?.ref || '', task?.customerUid || task?.docNumber || task?.awb || '', index].join('|');
  const getTaskFields = (task, index = 0) => rowFields[taskKey(task, index)] || {};
  const setTaskField = (task, index, key, value) => setRowFields((current) => ({
    ...current,
    [taskKey(task, index)]: { ...(current[taskKey(task, index)] || {}), [key]: value },
  }));
  const setField = (key, value) => {
    if (selectedTaskIndex == null || !tasks[selectedTaskIndex]) return;
    setTaskField(tasks[selectedTaskIndex], selectedTaskIndex, key, value);
  };

  const processNativeImage = async (dataUrl, degrees = 0, centerCrop = false, targetKB = 100, maxDimension = 1024, customCrop = null) => {
    const sourceUri = await dataUrlToCacheUri(dataUrl);
    const size = await new Promise((resolve, reject) => Image.getSize(sourceUri, (width, height) => resolve({ width, height }), reject));
    let crop = customCrop || null;
    let workingWidth = size.width;
    let workingHeight = size.height;
    if (customCrop) {
      workingWidth = customCrop.width;
      workingHeight = customCrop.height;
    } else if (centerCrop) {
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
    // Web parity (jawaS/uploader.js pick): rotate the preview and compress it
    // to mini 100 KB/1024 px or full 200 KB/2048 px. Native FilterImage is
    // captured before this compression so enhancement controls affect bytes.
    try {
      if (Platform.OS !== 'web') {
        // Capture the same native FilterImage used by the preview so native
        // brightness/contrast/greyscale/B&W adjustments are present in bytes,
        // then run the normal size/quality compressor.
        if (nativeProcessingRef.current && !isPdfItem) {
          await new Promise((resolve) => setTimeout(resolve, 40));
          const filteredBase64 = await captureRef(nativeProcessingRef.current, {
            format: 'jpg', quality: 0.95, result: 'base64',
            width: nativeProcessingSize.width, height: nativeProcessingSize.height,
          });
          if (filteredBase64) return await processNativeImage(`data:image/jpeg;base64,${filteredBase64}`, rotation, false, modalMode ? 100 : 200, modalMode ? 1024 : 2048);
        }
        return await processNativeImage(dataUrl, rotation, false, modalMode ? 100 : 200, modalMode ? 1024 : 2048);
      }
      if (!String(dataUrl).startsWith('data:image/')) return dataUrl;
      const rotated = rotation ? await getRotatedImage(dataUrl, rotation) : dataUrl;
      return await compressImage(rotated, modalMode ? 100 : 200, modalMode ? 1024 : 2048);
    } catch (_) {
      return dataUrl;
    }
  };

  const pickTask = async (task, taskIndex = tasks.indexOf(task)) => {
    if (task.type === 'empty' || task.type === 'complete' || processingImage) return;
    if (!currentImage) { setMessage('No image in preview. Capture or upload an image first.', true); return; }
    const sessionGeneration = sessionGenerationRef.current;
    setProcessingImage(true);
    try {
      const fields = { ...getTaskFields(task, taskIndex), branch: selectedOrder?.BRANCH || '', code: selectedOrder?.CODE || '' };
      const preparedImage = await prepareImageForUpload(currentImage);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      const row = { ...makeUploadRow(task, fields, preparedImage), rowId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      const validation = validateUploadRow(row);
      if (validation) { setMessage(validation, true); return; }
      setStagedRows((current) => mergeStagedRow(current, row));
      setRowFields({});
      setMessage(`Added ${task.type} for ${task.ref} to the table.`);
      if (!locked) {
        // Web pick parity: splice the used image and open the next one while
        // preserving the staged submit table.
        if (imageQueue.length > 0) {
          const remaining = imageQueue.length - 1;
          const nextIndex = imageIndex < remaining ? imageIndex : 0;
          setImageQueue((q) => q.filter((_, i) => i !== imageIndex));
          if (remaining > 0) {
            selectImageAt(nextIndex);
          } else {
            // Keep stagedRows and the selected order alive: the web reset only
            // clears the media preview after the last image is picked, so the
            // submit table remains visible and usable.
            setImageIndex(0);
            setRotation(0);
            setMessage(`Added ${task.type} for ${task.ref}. Review the table and submit.`);
          }
        } else {
          setMessage(`Added ${task.type} for ${task.ref}. Review the table and submit.`);
        }
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
    if (Platform.OS !== 'web' && nativeCameraActive) {
      if (nativeCameraCaptured && imageQueue.length > 0) doneNativeCamera();
      else stopNativeCamera();
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

  const nativeImagesAsDataUrls = async (images) => Promise.all(images.map(async (image) => {
    if (String(image).startsWith('data:')) return image;
    const base64 = await FileSystem.readAsStringAsync(image, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/png;base64,${base64}`;
  }));

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
          if (Platform.OS === 'web') await ensureWebLibraries();
          const Pdf = getJsPdfConstructor();
          if (images.length > 1 && Platform.OS === 'web' && !Pdf) {
            throw new Error('PDF bundling is unavailable in this web build. Please select one image or enable jsPDF.');
          }
          if (images.length > 1 && Platform.OS === 'web' && Pdf) {
            // Web parity: createPdfFromImages — A4, 10mm margins, aspect-ratio fit
            const dataUri = await createPdfFromImages(images);
            fileData = dataUri.split(',')[1]; contentType = 'application/pdf';
          } else if (images.length > 1 && Platform.OS !== 'web') {
            const printableImages = await nativeImagesAsDataUrls(images);
            const html = `<html><head><style>@page{size:A4;margin:10mm}html,body{margin:0;padding:0} .page{page-break-after:always;width:190mm;height:277mm;display:flex;align-items:flex-start;justify-content:center;overflow:hidden}.page:last-child{page-break-after:auto}img{max-width:190mm;max-height:277mm;object-fit:contain}</style></head><body>${printableImages.map((image) => `<div class="page"><img src="${image}" /></div>`).join('')}</body></html>`;
            const pdf = await Print.printToFileAsync({ html, width: 794, height: 1123, margins: { left: 38, right: 38, top: 38, bottom: 38 } });
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
          setStagedRows([]); setSubmitStates({});
          cleanupPdfPages();
          setMessage('Table cleared.');
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
            {visibleOrders.length > 0 && visibleOrders.length < totalOrders && <TouchableOpacity style={styles.loadMore} onPress={() => setDisplayDays((value) => value + 90)}><Text style={styles.loadMoreText}>{Platform.OS === 'web' ? `Load More (${visibleOrders.length} / ${totalOrders})` : 'Load More (+90 days)'}</Text></TouchableOpacity>}
          </ScrollView>
        </>
      ) : null}
    </View>
  );

  // ── Unified web-mobile tables (render on EVERY platform — web + native) ────
  // These mirror the web mini-uploader tables (TYPE/REFERENCE/DETAILS/INPUT/
  // ACTION pickup table, staged data table, existing-uploads table). Rows are
  // laid out with fixed column widths inside a horizontal ScrollView, exactly
  // like the web tables overflow on a phone.
  const tableHeaderCell = (label, width, hidden = false) => (
    <Text key={label} style={[styles.tblTh, { width }, hidden && styles.tblHidden]}>{label}</Text>
  );

  const renderPickupTable = () => {
    if (!tasks.length) return null;
    const headers = ['TYPE', 'REFERENCE', 'DETAILS', 'INPUT', 'ACTION'];
    const widths = [72, 128, 148, 208, 78];
    return (
      <View style={[styles.tblWrap, styles.pickupTblWrap]}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.tblHeaderRow}>{headers.map((h, i) => tableHeaderCell(h, widths[i]))}</View>
            {tasks.map((task, index) => {
              if (task.type === 'empty' || task.type === 'complete') {
                return <Text key={`${task.type}-${index}`} style={[styles.tblMessage, task.type === 'complete' && styles.tblMessageOk]}>{task.message}</Text>;
              }
              let details = 'Status';
              if (task.type === 'KYC') details = task.customerName || '';
              else if (task.type === 'Product') details = `Doc: ${task.docNumber || 'N/A'} (${task.docType || 'N/A'})`;
              else if (task.type === 'MultiBox') details = 'Child AWB';
              const inputKey = task.type === 'Product' ? 'remark' : task.type === 'MultiBox' ? 'childAwb' : 'status';
              const placeholder = task.type === 'POD' ? 'Delivered (default)' : task.type === 'Reciept' ? 'Booked (default)' : task.type === 'Product' ? 'PAPERS UPLOADED (default)' : `Enter Child AWB (default: ${task.awb || ''})`;
              const selected = selectedTaskIndex === index;
              const fields = getTaskFields(task, index);
              return (
                <TouchableOpacity key={`${task.type}-${index}`} style={[styles.tblRow, selected && styles.tblRowSelected]} activeOpacity={0.75} onPress={() => setSelectedTaskIndex(index)}>
                  <Text style={[styles.tblCell, { width: 72 }]}>{task.type}</Text>
                  <Text style={[styles.tblCell, { width: 128 }]}>{task.type === 'MultiBox' ? `${task.ref} / ${task.awb || ''}` : task.ref}</Text>
                  <Text style={[styles.tblCell, { width: 148 }]}>{details}</Text>
                  <View style={[styles.tblCell, { width: 208 }]}>
                    {task.type === 'KYC' ? (
                      <View style={styles.kycCell}>
                        <TextInput style={styles.tblInput} placeholder="KYC Number" placeholderTextColor="#94a3b8" value={fields.kycNumber || ''} onFocus={() => setSelectedTaskIndex(index)} onChangeText={(value) => setTaskField(task, index, 'kycNumber', value)} />
                        <TouchableOpacity style={styles.kycSelect} onPress={() => { setSelectedTaskIndex(index); setKycPickerVisible(true); }}>
                          <Text style={styles.kycSelectText} numberOfLines={1}>{fields.kycType || KYC_OPTIONS[0]}</Text>
                          <Text style={styles.kycSelectChevron}>▾</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TextInput style={styles.tblInput} placeholder={placeholder} placeholderTextColor="#94a3b8" value={fields[inputKey] || ''} onFocus={() => setSelectedTaskIndex(index)} onChangeText={(value) => setTaskField(task, index, inputKey, value)} />
                    )}
                  </View>
                  <TouchableOpacity style={[styles.pickCellBtn, processingImage && styles.disabled]} disabled={processingImage} onPress={() => pickTask(task, index)}>
                    <Text style={styles.pickCellText}>{processingImage ? 'Picking...' : 'Pick'}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDataTable = () => {
    if (!stagedRows.length) return null;
    const headers = ['STATUS', 'REFERENCE / AWB', 'CUSTOMER / KYC INFO', 'DOCUMENT INFO', 'ACTION'];
    const widths = [150, 190, 210, 190, 92];
    return (
      <>
      <View style={styles.tblWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.tblHeaderRow}>{headers.map((h, i) => tableHeaderCell(h, widths[i]))}</View>
            {stagedRows.map((row, index) => {
              const detail = describeStagedRow(row);
              const state = submitStates[stagedRowKey(row, index)];
              const grouped = !!bundleKey(row);
              const statusText = grouped
                ? `${detail.type} (${detail.imageCount} image${detail.imageCount > 1 ? 's' : ''})`
                : `${detail.type}${detail.status ? ` - ${detail.status}` : ''}`;
              const images = row.images?.length ? row.images : [row.imageData];
              const refLines = detail.refAwb.split('·');
              const kycLines = detail.customerKyc ? detail.customerKyc.split('·') : ['N/A'];
              const docLines = detail.docInfo ? detail.docInfo.split('·') : ['N/A'];
              return (
                <View key={stagedRowKey(row, index)} style={[styles.tblRow, state === 'success' && styles.tblRowSuccess, state === 'error' && styles.tblRowError]}>
                  <Text style={[styles.tblCell, { width: 150 }]}>{statusText}</Text>
                  <View style={[styles.tblCell, { width: 190 }]}>{refLines.map((line, i) => <Text key={i} style={styles.tblCellLine}>{line}</Text>)}</View>
                  <View style={[styles.tblCell, { width: 210 }]}>{kycLines.map((line, i) => <Text key={i} style={styles.tblCellLine}>{line}</Text>)}</View>
                  <View style={[styles.tblCell, { width: 190 }]}>{docLines.map((line, i) => <Text key={i} style={styles.tblCellLine}>{line}</Text>)}</View>
                  <TouchableOpacity style={styles.previewCellBtn} onPress={() => setExistingViewer({ uri: images[0], title: `${detail.type} — staged`, isPdf: false })}><Text style={styles.previewCellText}>Preview</Text></TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
      <View style={styles.tblActions}>
        <TouchableOpacity style={styles.tblDangerBtn} onPress={deleteLastStagedRow}><Text style={styles.tblDangerText}>Delete Last</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tblDangerBtn} onPress={() => { setStagedRows([]); setSubmitStates({}); }}><Text style={styles.tblDangerText}>Clear All</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tblPrimaryBtn} disabled={busy} onPress={submitRows}><Text style={styles.tblPrimaryText}>{busy ? 'Submitting...' : 'Submit'}</Text></TouchableOpacity>
      </View>
      </>
    );
  };

  const renderExistingTable = () => {
    if (!existingUploads.length) return null;
    const headers = ['STATUS', 'REFERENCE / AWB', 'CUSTOMER / KYC INFO', 'DOCUMENT INFO', 'ACTION'];
    const widths = [150, 190, 210, 190, 110];
    const canDelete = (ROLE_LEVELS[role] || 0) >= ROLE_LEVELS.MANAGER;
    return (
      <View style={styles.existingSection}>
        <Text style={styles.existingHeading}>Existing Uploads for this Order</Text>
        <View style={styles.tblWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.tblHeaderRow}>{headers.map((h, i) => tableHeaderCell(h, widths[i]))}</View>
              {existingUploads.map((upload, index) => {
                const uri = resolveUploadUri(upload.FILE_URL || upload.url, apiBase);
                const refAwb = upload.UPLOAD_TYPE === 'MultiBox'
                  ? `Ref: ${upload.REFERENCE || upload.AWB_NUMBER} · Child: ${upload.CHILD_AWB}`
                  : `Ref: ${upload.REFERENCE || ''} · AWB: ${upload.AWB_NUMBER || ''}`;
                const customerKyc = upload.UPLOAD_TYPE === 'KYC'
                  ? `Cust: ${parties?.consignorName || 'N/A'} · UID: ${upload.CUSTOMER_UID || ''} · KYC: ${upload.KYC_NUMBER} (${upload.KYC_TYPE})`
                  : '';
                const docInfo = upload.UPLOAD_TYPE === 'Product'
                  ? `Doc: ${upload.DOC_NUMBER || ''} · Type: ${upload.DOC_TYPE || ''} · Remark: ${upload.STATUS_REMARK || ''}`
                  : '';
                let statusText = `${upload.UPLOAD_TYPE || 'N/A'} - ${upload.STATUS_REMARK || ''}`;
                if (upload.UPLOAD_TYPE === 'Reciept' && !upload.STATUS_REMARK) statusText = 'Reciept - Booked';
                if (upload.UPLOAD_TYPE === 'POD' && !upload.STATUS_REMARK) statusText = 'POD - Delivered';
                const refLines = refAwb.split('·');
                const kycLines = customerKyc ? customerKyc.split('·') : ['N/A'];
                const docLines = docInfo ? docInfo.split('·') : ['N/A'];
                return (
                  <View key={upload.UPLOAD_UID || index} style={styles.tblRow}>
                    <Text style={[styles.tblCell, { width: 150 }]}>{statusText}</Text>
                    <View style={[styles.tblCell, { width: 190 }]}>{refLines.map((line, i) => <Text key={i} style={styles.tblCellLine}>{line}</Text>)}</View>
                    <View style={[styles.tblCell, { width: 210 }]}>{kycLines.map((line, i) => <Text key={i} style={styles.tblCellLine}>{line}</Text>)}</View>
                    <View style={[styles.tblCell, { width: 190 }]}>{docLines.map((line, i) => <Text key={i} style={styles.tblCellLine}>{line}</Text>)}</View>
                    <View style={[styles.tblCell, { width: 110, flexDirection: 'row', gap: 4 }]}>
                      {uri ? <TouchableOpacity style={styles.previewCellBtn} onPress={() => setExistingViewer({ uri, title: `${upload.UPLOAD_TYPE || 'Upload'} — ${selectedOrder?.AWB_NUMBER || selectedOrder?.REFERENCE}`, isPdf: isPdfUpload(upload) })}><Text style={styles.previewCellText}>Preview</Text></TouchableOpacity> : null}
                      {canDelete ? <TouchableOpacity style={[styles.previewCellBtn, styles.previewCellBtnDanger]} onPress={() => deleteExistingUpload(upload)}><Text style={[styles.previewCellText, { color: '#b91c1c' }]}>Delete</Text></TouchableOpacity> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  // ── Web-mobile card mode (uploader.html ≤1023px: thead hidden, each row
  //     becomes a white card; td::before shows the label, td the value; N/A
  //     cells are hidden; the ACTION cell is a full-width button) ────────────
  const cardRow = (label, value, valueFlex = true) => (
    <View style={styles.cardRow}><Text style={styles.cardLabel}>{label}</Text><Text style={[styles.cardValue, !valueFlex && styles.cardValueStatic]}>{value}</Text></View>
  );

  const renderPickupCards = () => {
    if (!tasks.length) return null;
    // Web parity: the pickup cards live inside #dynamic-input-area (border
    // #e2e8f0, bg #fafafa) — the table becomes cards but the box stays.
    return (
      <View style={styles.dynamicInputBox}>
        {tasks.map((task, index) => {
          if (task.type === 'empty' || task.type === 'complete') {
            return <Text key={`${task.type}-${index}`} style={[styles.cardMessage, task.type === 'complete' && styles.cardMessageOk]}>{task.message}</Text>;
          }
          let details = 'Status';
          if (task.type === 'KYC') details = task.customerName || '';
          else if (task.type === 'Product') details = `Doc: ${task.docNumber || 'N/A'} (${task.docType || 'N/A'})`;
          else if (task.type === 'MultiBox') details = 'Child AWB';
          const inputKey = task.type === 'Product' ? 'remark' : task.type === 'MultiBox' ? 'childAwb' : 'status';
          const placeholder = task.type === 'POD' ? 'Delivered (default)' : task.type === 'Reciept' ? 'Booked (default)' : task.type === 'Product' ? 'PAPERS UPLOADED (default)' : `Enter Child AWB (default: ${task.awb || ''})`;
          const selected = selectedTaskIndex === index;
          const fields = getTaskFields(task, index);
          return (
            <TouchableOpacity key={`${task.type}-${index}`} style={[styles.card, selected && styles.cardSelected]} activeOpacity={0.8} onPress={() => setSelectedTaskIndex(index)}>
              {cardRow('TYPE', task.type)}
              {cardRow('REFERENCE', task.type === 'MultiBox' ? `${task.ref} / ${task.awb || ''}` : task.ref)}
              {cardRow('DETAILS', details)}
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>INPUT</Text>
                {task.type === 'KYC' ? (
                  <View style={[styles.kycCell, styles.cardValueFlex]}>
                    <TextInput style={[styles.tblInput, styles.cardInput]} placeholder="KYC Number" placeholderTextColor="#94a3b8" value={fields.kycNumber || ''} onFocus={() => setSelectedTaskIndex(index)} onChangeText={(value) => setTaskField(task, index, 'kycNumber', value)} />
                    <TouchableOpacity style={styles.kycSelect} onPress={() => { setSelectedTaskIndex(index); setKycPickerVisible(true); }}>
                      <Text style={styles.kycSelectText} numberOfLines={1}>{fields.kycType || KYC_OPTIONS[0]}</Text>
                      <Text style={styles.kycSelectChevron}>▾</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TextInput style={[styles.tblInput, styles.cardInput, styles.cardValueFlex]} placeholder={placeholder} placeholderTextColor="#94a3b8" value={fields[inputKey] || ''} onFocus={() => setSelectedTaskIndex(index)} onChangeText={(value) => setTaskField(task, index, inputKey, value)} />
                )}
              </View>
              <TouchableOpacity style={[styles.pickBtnFull, processingImage && styles.disabled]} disabled={processingImage} onPress={() => pickTask(task, index)}>
                <Text style={styles.pickBtnFullText}>{processingImage ? 'Picking...' : 'Pick'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderDataCards = () => {
    if (!stagedRows.length) return null;
    // Web parity: staged cards live inside .data-table-container (border #ccc)
    // and #table-actions sits OUTSIDE it as a sibling (web HTML order).
    return (
      <View style={styles.cardSection}>
        <View style={styles.dataTableBox}>
        {stagedRows.map((row, index) => {
          const detail = describeStagedRow(row);
          const state = submitStates[stagedRowKey(row, index)];
          const grouped = !!bundleKey(row);
          const statusText = grouped
            ? `${detail.type} (${detail.imageCount} image${detail.imageCount > 1 ? 's' : ''})`
            : `${detail.type}${detail.status ? ` - ${detail.status}` : ''}`;
          const images = row.images?.length ? row.images : [row.imageData];
          const refLines = detail.refAwb.split('·');
          const kycLines = detail.customerKyc ? detail.customerKyc.split('·') : [];
          const docLines = detail.docInfo ? detail.docInfo.split('·') : [];
          return (
            <View key={stagedRowKey(row, index)} style={[styles.card, state === 'success' && styles.cardSuccess, state === 'error' && styles.cardError]}>
              {cardRow('STATUS', statusText)}
              {cardRow('REFERENCE / AWB', refLines.join(' · '))}
              {kycLines.length ? cardRow('CUSTOMER / KYC INFO', kycLines.join(' · ')) : null}
              {docLines.length ? cardRow('DOCUMENT INFO', docLines.join(' · ')) : null}
              <View style={[styles.cardRow, styles.cardRowLast]}>
                <Text style={styles.cardLabel}>ACTION</Text>
                <TouchableOpacity style={styles.v1Btn} onPress={() => setExistingViewer({ uri: images[0], title: `${detail.type} — staged`, isPdf: false })}><Text style={styles.v1BtnText}>Preview</Text></TouchableOpacity>
              </View>
            </View>
          );
        })}
        </View>
        <View style={[styles.tableActions, isCompactMobile && styles.tableActionsCenter]}>
          <TouchableOpacity style={styles.dangerBtn} onPress={deleteLastStagedRow}><Text style={styles.dangerBtnText}>Delete Last</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => { setStagedRows([]); setSubmitStates({}); }}><Text style={styles.dangerBtnText}>Clear All</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} disabled={busy} onPress={submitRows}><Text style={styles.primaryBtnText}>{busy ? 'Submitting...' : 'Submit'}</Text></TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderExistingCards = () => {
    if (!existingUploads.length) return null;
    const canDelete = (ROLE_LEVELS[role] || 0) >= ROLE_LEVELS.MANAGER;
    return (
      <View style={styles.existingSection}>
        <Text style={styles.existingHeading}>Existing Uploads for this Order</Text>
        <View style={styles.dataTableBox}>
        {existingUploads.map((upload, index) => {
          const uri = resolveUploadUri(upload.FILE_URL || upload.url, apiBase);
          const refAwb = upload.UPLOAD_TYPE === 'MultiBox'
            ? `Ref: ${upload.REFERENCE || upload.AWB_NUMBER} · Child: ${upload.CHILD_AWB}`
            : `Ref: ${upload.REFERENCE || ''} · AWB: ${upload.AWB_NUMBER || ''}`;
          const customerKyc = upload.UPLOAD_TYPE === 'KYC'
            ? `Cust: ${parties?.consignorName || 'N/A'} · UID: ${upload.CUSTOMER_UID || ''} · KYC: ${upload.KYC_NUMBER} (${upload.KYC_TYPE})`
            : '';
          const docInfo = upload.UPLOAD_TYPE === 'Product'
            ? `Doc: ${upload.DOC_NUMBER || ''} · Type: ${upload.DOC_TYPE || ''} · Remark: ${upload.STATUS_REMARK || ''}`
            : '';
          let statusText = `${upload.UPLOAD_TYPE || 'N/A'} - ${upload.STATUS_REMARK || ''}`;
          if (upload.UPLOAD_TYPE === 'Reciept' && !upload.STATUS_REMARK) statusText = 'Reciept - Booked';
          if (upload.UPLOAD_TYPE === 'POD' && !upload.STATUS_REMARK) statusText = 'POD - Delivered';
          const refLines = refAwb.split('·');
          const kycLines = customerKyc ? customerKyc.split('·') : [];
          const docLines = docInfo ? docInfo.split('·') : [];
          return (
            <View key={upload.UPLOAD_UID || index} style={styles.card}>
              {cardRow('STATUS', statusText)}
              {cardRow('REFERENCE / AWB', refLines.join(' · '))}
              {kycLines.length ? cardRow('CUSTOMER / KYC INFO', kycLines.join(' · ')) : null}
              {docLines.length ? cardRow('DOCUMENT INFO', docLines.join(' · ')) : null}
              <View style={[styles.cardRow, styles.cardRowLast]}>
                <Text style={styles.cardLabel}>ACTION</Text>
                <View style={styles.cardActions}>
                  {uri ? <TouchableOpacity style={styles.v1Btn} onPress={() => setExistingViewer({ uri, title: `${upload.UPLOAD_TYPE || 'Upload'} — ${selectedOrder?.AWB_NUMBER || selectedOrder?.REFERENCE}`, isPdf: isPdfUpload(upload) })}><Text style={styles.v1BtnText}>Preview</Text></TouchableOpacity> : null}
                  {canDelete ? <TouchableOpacity style={[styles.v1Btn, styles.v1BtnDanger]} onPress={() => deleteExistingUpload(upload)}><Text style={[styles.v1BtnText, { color: '#dc3545' }]}>Delete</Text></TouchableOpacity> : null}
                </View>
              </View>
            </View>
          );
        })}
        </View>
      </View>
    );
  };

  // ── KYC type picker (web kycOptionsHTML optgroups: Individual / Business) ──
  const renderKycTypePicker = () => (
    <Modal visible={kycPickerVisible} transparent animationType="fade" onRequestClose={() => setKycPickerVisible(false)}>
      <TouchableOpacity style={styles.kycPickerOverlay} activeOpacity={1} onPress={() => setKycPickerVisible(false)}>
        <View style={styles.kycPickerCard}>
          <Text style={styles.kycPickerTitle}>KYC Type</Text>
          {KYC_OPTION_GROUPS.map((group) => (
            <View key={group.label}>
              <Text style={styles.kycPickerGroup}>{group.label}</Text>
              {group.options.map((option) => {
                const pickerTask = selectedTaskIndex != null ? tasks[selectedTaskIndex] : null;
                const pickerFields = pickerTask ? getTaskFields(pickerTask, selectedTaskIndex) : {};
                return (
                  <TouchableOpacity key={option} style={[styles.kycPickerOption, pickerFields.kycType === option && styles.kycPickerOptionActive]} onPress={() => { if (pickerTask) setTaskField(pickerTask, selectedTaskIndex, 'kycType', option); setKycPickerVisible(false); }}>
                    <Text style={[styles.kycPickerOptionText, pickerFields.kycType === option && styles.kycPickerOptionTextActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <TouchableOpacity style={styles.kycPickerCancel} onPress={() => setKycPickerVisible(false)}><Text style={styles.kycPickerCancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );


  const closeWebCropper = () => {
    if (webCropperRef.current) { webCropperRef.current.destroy(); webCropperRef.current = null; }
    setCropMode(false);
    setEnhanceVisible(false);
  };

  const renderWebCropper = () => (
    <View style={styles.inlineWebCropper}>
      <View style={styles.webCropCard}>
        <View ref={webCropperWrapRef} style={styles.webCropArea}>
          {React.createElement('img', { ref: webCropperImgRef, alt: 'Crop', style: { display: 'block', maxWidth: '100%' } })}
        </View>
        <View style={styles.webCropButtons}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1e3a5f' }]} onPress={() => webCropperRef.current?.rotate(90)}><Text style={styles.actionText}>Rotate</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1e3a5f' }]} onPress={() => setEnhanceVisible((value) => !value)}><Text style={styles.actionText}>Enhance</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#007bff' }]} onPress={runOcrExtraction}><Text style={styles.actionText}>Extract Data (OCR)</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#15803d' }]} onPress={confirmWebCrop}><Text style={styles.actionText}>Crop</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={closeWebCropper}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
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
  );

  const cameraActive = webCameraActive || nativeCameraActive;
  const showPreviewControls = !!currentImage && !cameraActive && !cropMode && !nativeCropVisible;
  const showMainControls = !cropMode && !nativeCropVisible;

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          <View style={styles.pageHeaderTitles}><Text style={styles.title}>Document Uploader</Text><Text style={styles.subtitle}>POD, receipt, KYC, product and multibox uploads</Text></View>
          {modalMode && onClose ? <TouchableOpacity style={styles.headerClose} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close uploader"><Text style={styles.headerCloseText}>✕</Text></TouchableOpacity> : null}
        </View>
      </View>
      {Platform.OS === 'web' ? <>{React.createElement('input', { ref: webInputRef, type: 'file', accept: 'image/*,application/pdf', multiple: true, onChange: handleWebFiles, style: { display: 'none' } })}</> : null}
      {/* Web main-controls-strip: idle = type/Camera/Upload; streaming = Capture/Cancel; preview = Rotate/Lock/Cancel/Cancel All. */}
      {showMainControls ? (
        <View style={[styles.controlsStrip, isCompactMobile && styles.controlsStripMobile, Platform.OS === 'web' && isCompactMobile && styles.controlsStripWebMobile]}>
          {!cameraActive ? (
            <>
              <View style={styles.typeStrip}>
                {UPLOAD_TYPES.filter((type) => !effectiveHiddenTypes.has(type)).map((type) => (
                  <TouchableOpacity key={type} style={[styles.typeBtn, uploadType === type && styles.typeBtnActive]} onPress={() => chooseType(type)}>
                    <Text style={[styles.typeBtnText, uploadType === type && styles.typeBtnTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!isCompactMobile ? <View style={styles.stripSeparator} /> : null}
            </>
          ) : null}
          <View style={styles.buttonGroup}>
            {!showPreviewControls ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                if (Platform.OS === 'web') { if (webCameraActive) captureWebFrame(); else startWebCamera(); }
                else if (nativeCameraActive) captureNativeFrame();
                else startNativeCamera();
              }}><Text style={styles.actionBtnText}>{cameraActive ? 'Capture' : 'Camera'}</Text></TouchableOpacity>
            ) : null}
            {!cameraActive && !showPreviewControls ? <TouchableOpacity style={styles.actionBtn} onPress={() => (Platform.OS === 'web' ? chooseAssets(false) : pickDocuments())}><Text style={styles.actionBtnText}>Upload</Text></TouchableOpacity> : null}
            {showPreviewControls ? <TouchableOpacity style={styles.dangerBtn} onPress={() => setRotation((value) => (value + 90) % 360)}><Text style={styles.dangerBtnText}>Rotate</Text></TouchableOpacity> : null}
            {showPreviewControls ? <TouchableOpacity style={[styles.dangerBtn, locked && styles.dangerBtnActive]} onPress={() => setLocked((value) => !value)}><Text style={[styles.dangerBtnText, locked && styles.dangerBtnTextActive]}>{locked ? 'Unlock' : 'Lock'}</Text></TouchableOpacity> : null}
            {(cameraActive || showPreviewControls) ? <TouchableOpacity style={styles.dangerBtn} onPress={cancelCurrentImage}><Text style={styles.dangerBtnText}>{(webCameraActive && webCaptured) || (nativeCameraActive && nativeCameraCaptured) ? 'Done' : 'Cancel'}</Text></TouchableOpacity> : null}
            {showPreviewControls ? <TouchableOpacity style={styles.dangerBtn} onPress={resetUploader}><Text style={styles.dangerBtnText}>Cancel All</Text></TouchableOpacity> : null}
          </View>
        </View>
      ) : null}
      {Platform.OS !== 'web' && currentImage && !isPdfItem && enhancePanelVisible ? (
        <View style={styles.enhanceSliderPanel}>
          <View style={styles.nativeEnhanceButtons}>
            <TouchableOpacity style={styles.nativeEnhanceBtn} onPress={autoEnhance}><Text style={styles.nativeEnhanceText}>Auto</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.nativeEnhanceBtn, enhancements.greyscale && styles.nativeEnhanceBtnActive]} onPress={toggleGreyscale}><Text style={styles.nativeEnhanceText}>Greyscale</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.nativeEnhanceBtn, enhancements.bw && styles.nativeEnhanceBtnActive]} onPress={toggleBlackWhite}><Text style={styles.nativeEnhanceText}>B&amp;W Doc</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.nativeEnhanceBtn, enhancements.sharpen && styles.nativeEnhanceBtnActive]} onPress={toggleSharpen}><Text style={styles.nativeEnhanceText}>Sharpen</Text></TouchableOpacity>
            <TouchableOpacity style={styles.nativeEnhanceBtn} onPress={resetEnhancements}><Text style={styles.nativeEnhanceText}>Reset</Text></TouchableOpacity>
          </View>
          <View style={styles.enhanceSliderRow}><Text style={styles.enhanceSliderLabel}>Brightness</Text><Slider style={styles.enhanceSlider} minimumValue={-50} maximumValue={50} step={1} minimumTrackTintColor="#1e3a5f" maximumTrackTintColor="#cbd5e1" thumbTintColor="#1e3a5f" value={Number(enhancements.brightness) || 0} onValueChange={(value) => setEnhancementValue('brightness', value)} /></View>
          <View style={styles.enhanceSliderRow}><Text style={styles.enhanceSliderLabel}>Contrast</Text><Slider style={styles.enhanceSlider} minimumValue={-50} maximumValue={50} step={1} minimumTrackTintColor="#1e3a5f" maximumTrackTintColor="#cbd5e1" thumbTintColor="#1e3a5f" value={Number(enhancements.contrast) || 0} onValueChange={(value) => setEnhancementValue('contrast', value)} /></View>
        </View>
      ) : null}
      <View style={[styles.body, isCompactMobile && styles.bodyMobile, modalMode && styles.bodyModal]}>
        <ScrollView nestedScrollEnabled={isCompactMobile} style={styles.workPane} contentContainerStyle={styles.workContent}>
          {!selectedOrder && !webCameraActive && !nativeCameraActive ? (
            <>
              <View style={styles.viewArea}><Text style={styles.viewAreaPlaceholder}>Select Camera or Upload to begin</Text></View>
              <View style={[styles.statusBar, statusError && styles.statusBarError]}><Text style={[styles.statusBarText, statusError && styles.statusBarErrorText]}>{status}</Text></View>
              {isCompactMobile && !modalMode ? renderOrderPane(true) : null}
              <Text style={styles.placeholder}>Select an order from the list to begin.</Text>
            </>
          ) : (
            <>
              {imageQueue.length > 1 ? (
                <View style={styles.scrollerWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollerContent}>
                    {imageQueue.map((image, index) => (
                      <TouchableOpacity key={`${index}-${image.slice(-12)}`} onPress={() => selectImageAt(index)}>
                        <Image source={{ uri: image }} style={[styles.scrollerImg, index === imageIndex && styles.scrollerImgActive]} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {Platform.OS === 'web' && cropMode ? renderWebCropper() : webCameraActive || nativeCameraActive ? (
                <View style={[styles.viewArea, styles.cameraViewArea, { position: 'relative' }]}>
                  {Platform.OS === 'web' ? React.createElement('video', { ref: webVideoRef, autoPlay: true, playsInline: true, onClick: captureWebFrame, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : (
                    <CameraView ref={nativeCameraRef} style={styles.nativeCamera} facing="back" mode="picture" onCameraReady={() => setNativeCameraReady(true)} />
                  )}
                  <View style={styles.cameraOverlayControls}>
                    <Text style={styles.cameraOverlayText}>Tap the feed or Capture · {imageQueue.length} captured</Text>
                    {Platform.OS !== 'web' ? <TouchableOpacity style={styles.inlineCaptureBtn} onPress={captureNativeFrame}><Text style={styles.inlineCaptureText}>Capture photo</Text></TouchableOpacity> : null}
                  </View>
                </View>
              ) : currentImage ? (
                <View ref={webPreviewRef} style={[styles.viewArea, { position: 'relative' }]}>
                  <TouchableOpacity style={styles.viewAreaFill} onPress={() => setPreviewVisible(true)}>
                    {currentImage.startsWith('data:application/pdf') ? (
                      <View style={styles.pdfPreview}><Text style={styles.pdfBadge}>PDF</Text><Text style={styles.pdfPreviewText}>PDF document ready for upload</Text></View>
                    ) : Platform.OS !== 'web' ? (
                      <FilterImage source={{ uri: currentImage }} filters={nativeFilters} style={[styles.viewImage, { transform: [{ rotate: `${rotation}deg` }] }]} resizeMode="contain" />
                    ) : (
                      <Image source={{ uri: currentImage }} style={[styles.viewImage, { transform: [{ rotate: `${rotation}deg` }] }]} resizeMode="contain" />
                    )}
                  </TouchableOpacity>
                  {Platform.OS === 'web' ? React.createElement('canvas', { ref: webSelectionCanvasRef, style: { position: 'absolute', top: 0, left: 0, zIndex: 10, display: 'none' } }) : null}
                  <Text style={styles.viewAreaHint}>{imageQueue.length} file(s) · Tap to preview{Platform.OS === 'web' ? ' · Drag to OCR' : ''}</Text>
                </View>
              ) : (
                <View style={styles.viewArea}><Text style={styles.viewAreaPlaceholder}>Select Camera or Upload to begin</Text></View>
              )}
              {Platform.OS === 'web' ? React.createElement('img', { ref: webImageRef, src: currentImage || '', style: { display: 'none' } }) : null}
              {Platform.OS !== 'web' && currentImage && !isPdfItem ? (
                <View ref={nativeProcessingRef} pointerEvents="none" style={[styles.nativeProcessingStage, { width: nativeProcessingSize.width, height: nativeProcessingSize.height }]}>
                  <FilterImage source={{ uri: currentImage }} filters={nativeFilters} style={styles.nativeProcessingImage} resizeMode="contain" />
                </View>
              ) : null}
              {Platform.OS !== 'web' && currentImage && !isPdfItem && !cropMode ? (
                <View style={styles.utilityRow}>
                  <TouchableOpacity style={[styles.utilBtn, isCompactMobile && styles.utilBtnSmall]} onPress={onPressCrop}><Text style={styles.utilBtnText}>Crop</Text></TouchableOpacity>
                  {Platform.OS !== 'web' ? <TouchableOpacity style={[styles.utilBtn, isCompactMobile && styles.utilBtnSmall, enhancePanelVisible && styles.utilBtnActive]} onPress={() => setEnhancePanelVisible((value) => !value)}><Text style={styles.utilBtnText}>Enhance</Text></TouchableOpacity> : null}
                  <TouchableOpacity style={[styles.utilBtn, isCompactMobile && styles.utilBtnSmall]} onPress={scanBarcode}><Text style={styles.utilBtnText}>Barcode</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.utilBtn, isCompactMobile && styles.utilBtnSmall]} onPress={runOCR}><Text style={styles.utilBtnText}>OCR</Text></TouchableOpacity>
                </View>
              ) : null}
              {/* Web #status-bar parity: grey rounded bar below the view area */}
              <View style={[styles.statusBar, statusError && styles.statusBarError]}><Text style={[styles.statusBarText, statusError && styles.statusBarErrorText]}>{status}</Text></View>
              {isCompactMobile && !modalMode ? renderOrderPane(true) : null}
              {isCompactMobile ? renderPickupCards() : renderPickupTable()}
              {isCompactMobile ? renderDataCards() : renderDataTable()}
              {isCompactMobile ? renderExistingCards() : renderExistingTable()}
            </>
          )}
        </ScrollView>
        {!modalMode && !isCompactMobile ? renderOrderPane(false) : null}
      </View>
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}><View style={styles.modal}><TouchableOpacity onPress={() => setPreviewVisible(false)}><Text style={styles.close}>✕ Close</Text></TouchableOpacity>{currentImage?.startsWith('data:application/pdf') ? <View style={styles.pdfLargePreview}><Text style={styles.pdfBadge}>PDF</Text><Text style={styles.pdfPreviewText}>The original PDF will be sent with this upload.</Text></View> : currentImage ? <Image source={{ uri: currentImage }} style={styles.largePreview} resizeMode="contain" /> : null}</View></Modal>
      <UploadViewer visible={!!existingViewer} uri={existingViewer?.uri} title={existingViewer?.title} isPdf={existingViewer?.isPdf} onClose={() => setExistingViewer(null)} />

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

      {/* ── Native crop modal (web inline-cropper parity: 95% box, drag-move, corner-resize, rotate) ── */}
      <Modal visible={nativeCropVisible} transparent animationType="fade" onRequestClose={() => setNativeCropVisible(false)}>
        <View style={styles.cropOverlay}>
          <View style={styles.cropCard}>
            <View style={styles.cropHeader}>
              <Text style={styles.cropTitle}>Crop image</Text>
              <TouchableOpacity onPress={() => setNativeCropVisible(false)} accessibilityRole="button" accessibilityLabel="Cancel crop"><Text style={styles.cropHeaderClose}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.cropStage} onLayout={onCropLayout}>
              {cropImageUri ? <FilterImage source={{ uri: cropImageUri }} filters={nativeFilters} style={styles.cropImage} resizeMode="contain" /> : null}
              {cropRect ? (
                <>
                  <View style={[styles.cropMask, { top: 0, left: 0, right: 0, height: cropRect.y }]} />
                  <View style={[styles.cropMask, { top: cropRect.y + cropRect.h, left: 0, right: 0, bottom: 0 }]} />
                  <View style={[styles.cropMask, { top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h }]} />
                  <View style={[styles.cropMask, { top: cropRect.y, left: cropRect.x + cropRect.w, right: 0, height: cropRect.h }]} />
                  <View {...(cropPanResponderRef.current?.panHandlers || {})} style={[styles.cropBox, { left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }]}>
                    {/* pointerEvents="none" keeps the box as the touch target so
                        locationX/Y stay box-relative for corner detection */}
                    <View pointerEvents="none" style={[styles.cropHandle, styles.cropHandleTL]} />
                    <View pointerEvents="none" style={[styles.cropHandle, styles.cropHandleTR]} />
                    <View pointerEvents="none" style={[styles.cropHandle, styles.cropHandleBL]} />
                    <View pointerEvents="none" style={[styles.cropHandle, styles.cropHandleBR]} />
                  </View>
                </>
              ) : null}
            </View>
            <View style={styles.cropButtons}>
              <TouchableOpacity style={styles.dangerBtn} disabled={cropBusy} onPress={rotateNativeCrop}><Text style={styles.dangerBtnText}>Rotate</Text></TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} disabled={cropBusy} onPress={() => runNativeOcr(cropImageUri)}><Text style={styles.dangerBtnText}>OCR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={() => setNativeCropVisible(false)}><Text style={styles.dangerBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} disabled={cropBusy} onPress={confirmNativeCrop}><Text style={styles.primaryBtnText}>{cropBusy ? 'Cropping…' : 'Crop'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── KYC type picker (web optgroups: Individual / Business) ── */}
      {renderKycTypePicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  pageHeader: { padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  pageHeaderTitles: { flex: 1, paddingRight: 10 },
  headerClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  headerCloseText: { color: '#b91c1c', fontSize: 16, fontWeight: '900' },
  title: { fontSize: 19, fontWeight: '900', color: '#0f172a' }, subtitle: { marginTop: 3, fontSize: 11, color: '#64748b' },
  controlsStrip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 8, backgroundColor: '#e9ecef', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  typeStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' },
  stripSeparator: { width: 1, height: 28, backgroundColor: '#ced4da' },
  typeBtn: { borderWidth: 2, borderColor: '#1e3a5f', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  typeBtnActive: { backgroundColor: '#1e3a5f' },
  typeBtnText: { color: '#1e3a5f', fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  actionBtn: { borderWidth: 2, borderColor: '#9C2007', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { color: '#9C2007', fontSize: 14, fontWeight: '600' },
  dangerBtn: { borderWidth: 2, borderColor: '#1e3a5f', backgroundColor: 'transparent', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  dangerBtnActive: { backgroundColor: '#1e3a5f' },
  dangerBtnText: { color: '#1e3a5f', fontSize: 14, fontWeight: '600' },
  dangerBtnTextActive: { color: '#fff' },
  primaryBtn: { borderWidth: 2, borderColor: '#9C2007', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 18, paddingVertical: 8 },
  primaryBtnText: { color: '#9C2007', fontSize: 14, fontWeight: '700' },
  controlsStripMobile: { gap: 4, padding: 6 }, controlsStripWebMobile: { position: 'sticky', top: 0, zIndex: 20 },
  typeButton: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#fff' }, compactButton: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5 }, typeButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, typeText: { fontSize: 11, fontWeight: '800', color: '#334155' }, typeTextActive: { color: '#fff' },
  actionButton: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#1e3a5f' }, actionText: { color: '#fff', fontSize: 11, fontWeight: '800' }, locked: { backgroundColor: '#15803d' }, cancelButton: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fee2e2' }, cancelText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },
  enhancementInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', borderRadius: 7, paddingHorizontal: 5 }, compactEnhancementInputGroup: { paddingHorizontal: 3, borderRadius: 5 }, enhancementLabel: { color: '#334155', fontSize: 10, fontWeight: '900' }, enhancementInput: { width: 34, height: 28, paddingHorizontal: 3, paddingVertical: 2, color: '#0f172a', fontSize: 10, textAlign: 'center' },
  status: { paddingHorizontal: 12, paddingVertical: 7, color: '#475569', fontSize: 11, fontWeight: '700', backgroundColor: '#fff' }, statusError: { color: '#b91c1c', backgroundColor: '#fef2f2' },  body: { flex: 1, flexDirection: 'row' }, bodyMobile: { flexDirection: 'column' }, bodyModal: { flexDirection: 'column' },  orderPane: { width: '20%', minWidth: 0, borderLeftWidth: 1, borderLeftColor: '#e2e8f0', backgroundColor: '#f7fafc', padding: 10 },  orderPaneMobile: { width: '100%', minWidth: 0, maxHeight: 360, borderLeftWidth: 0, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 8, marginTop: 10, borderRadius: 8, overflow: 'hidden' },
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
  inlineWebCropper: { width: '100%', paddingVertical: 10, backgroundColor: '#fff' },
  webCropOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.82)', padding: 10, justifyContent: 'center' },
  webCropCard: { width: '100%', maxWidth: 860, alignSelf: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, padding: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#1E3A8A' },
  webCropArea: { width: '100%', height: '60vh', backgroundColor: '#0f172a', overflow: 'hidden' },
  webCropButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 },
  webEnhanceBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ccc' },
  webEnhanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  webSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 280, justifyContent: 'center', marginTop: 10, alignSelf: 'center' },
  webSliderLabel: { color: '#334155', fontSize: 11, fontWeight: '700', width: 64 },

  // Native live scanner
  scanModal: { flex: 1, backgroundColor: '#020617' },
  scanHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#334155' },
  scanTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  scanClose: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', padding: 4 },
  scanner: { flex: 1 },
  scanHint: { color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 12, lineHeight: 16 },
  cameraViewArea: { backgroundColor: '#020617' },
  nativeCamera: { width: '100%', height: '100%' },
  cameraOverlayControls: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', padding: 10, backgroundColor: 'rgba(2,6,23,0.45)' },
  cameraOverlayText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  inlineCaptureBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: '#9C2007' },
  inlineCaptureText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Unified web-mobile tables (all platforms)
  tblWrap: { width: '100%', marginTop: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, backgroundColor: '#fff', overflow: 'hidden', maxHeight: 400 },
  pickupTblWrap: { maxHeight: 280 },
  tblHeaderRow: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  tblTh: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 12, fontWeight: '700', color: '#334155', textAlign: 'left' },
  tblHidden: { display: 'none' },
  tblRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 6, minHeight: 40 },
  tblRowSelected: { backgroundColor: '#e0e7ff' },
  tblRowSuccess: { backgroundColor: '#d4edda' },
  tblRowError: { backgroundColor: '#f8d7da' },
  tblCell: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, color: '#334155' },
  tblCellLine: { fontSize: 11, color: '#475569', lineHeight: 15 },
  tblMessage: { padding: 14, textAlign: 'center', color: '#888' },
  tblMessageOk: { color: '#15803d', fontWeight: '700' },
  tblInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, backgroundColor: '#fff', minWidth: 120 },
  kycCell: { gap: 5 },
  kycSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#fff' },
  kycSelectText: { fontSize: 12, color: '#334155', flex: 1 },
  kycSelectChevron: { color: '#64748b', fontSize: 12, marginLeft: 6 },
  pickCellBtn: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 5, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  pickCellText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },
  previewCellBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  previewCellBtnDanger: { backgroundColor: '#f8d7da', borderColor: '#f5c6cb' },
  previewCellText: { color: '#0369a1', fontSize: 10, fontWeight: '800' },
  tblActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tblDangerBtn: { backgroundColor: '#f8d7da', borderWidth: 1, borderColor: '#f5c6cb', borderRadius: 5, paddingHorizontal: 12, paddingVertical: 8 },
  tblDangerText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  tblPrimaryBtn: { backgroundColor: '#1e3a5f', borderRadius: 5, paddingHorizontal: 16, paddingVertical: 8 },
  tblPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  existingSection: { marginTop: 20, borderTopWidth: 2, borderTopColor: '#1E3A8A', paddingTop: 10 },
  existingHeading: { fontSize: 17, fontWeight: '700', color: '#1E3A8A', marginBottom: 8 },

  // Native enhance sliders panel (web brightness/contrast sliders parity)
  enhanceSliderPanel: { backgroundColor: '#eef2f7', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 8 },
  nativeEnhanceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 6 },
  nativeEnhanceBtn: { borderWidth: 1, borderColor: '#1e3a5f', borderRadius: 5, backgroundColor: '#fff', paddingHorizontal: 9, paddingVertical: 6 },
  nativeEnhanceBtnActive: { backgroundColor: '#d4edda' },
  nativeEnhanceText: { color: '#1e3a5f', fontSize: 10, fontWeight: '700' },
  enhanceSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 3 },
  enhanceSliderLabel: { width: 72, color: '#334155', fontSize: 11, fontWeight: '700' },
  enhanceSlider: { flex: 1, height: 32 },

  // KYC type picker modal
  kycPickerOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.55)', justifyContent: 'center', padding: 24 },
  kycPickerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '78%' },
  kycPickerTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
  kycPickerGroup: { fontSize: 12, fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  kycPickerOption: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  kycPickerOptionActive: { backgroundColor: '#e0e7ff' },
  kycPickerOptionText: { fontSize: 13, color: '#334155' },
  kycPickerOptionTextActive: { color: '#1e3a8a', fontWeight: '800' },
  kycPickerCancel: { marginTop: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 },
  kycPickerCancelText: { color: '#475569', fontSize: 13, fontWeight: '800' },

  // Web view area (uploader.html #image-view-area: square dashed box)
  viewArea: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#ccc', backgroundColor: '#f0f0f0', width: '100%', aspectRatio: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nativeProcessingStage: { position: 'absolute', left: -10000, top: 0, backgroundColor: '#fff', overflow: 'hidden' },
  nativeProcessingImage: { width: '100%', height: '100%' },
  viewAreaFill: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  viewImage: { width: '100%', height: '100%' },
  viewAreaPlaceholder: { color: '#888', fontSize: 14, padding: 20, textAlign: 'center' },
  viewAreaHint: { position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', color: '#cbd5e1', fontSize: 10 },
  // Web image scroller (80px strip of 70px thumbs)
  scrollerWrap: { width: '100%', height: 80, backgroundColor: '#eee', borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 5, marginBottom: 15 },
  scrollerContent: { alignItems: 'center', gap: 5 },
  scrollerImg: { width: 70, height: 66, borderRadius: 2, borderWidth: 2, borderColor: 'transparent' },
  scrollerImgActive: { borderColor: '#1E3A8A' },
  // Web #status-bar (grey rounded bar)
  statusBar: { minHeight: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e9ecef', borderRadius: 4, marginTop: 15, paddingHorizontal: 10, paddingVertical: 6 },
  statusBarText: { color: '#495057', fontSize: 13, textAlign: 'center' },
  statusBarError: { backgroundColor: '#fef2f2' },
  statusBarErrorText: { color: '#dc3545', fontWeight: '700' },
  // Utility row (Crop / Enhance / Barcode / OCR) — kept out of the strip to
  // match the web strip exactly (web does these inside the cropper/preview)
  utilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 },
  utilBtn: { borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  utilBtnSmall: { paddingHorizontal: 9, paddingVertical: 5 },
  utilBtnText: { color: '#333', fontSize: 12, fontWeight: '500' },
  utilBtnActive: { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' },
  // Web-mobile table-to-card (uploader.html ≤1023px). The cards keep living
  // inside the web's bordered boxes (#dynamic-input-area / .data-table-container).
  cardSection: { marginTop: 15 },
  dynamicInputBox: { marginTop: 15, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, backgroundColor: '#fafafa', padding: 10 },
  dataTableBox: { marginTop: 15, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, backgroundColor: '#fff', padding: 10 },
  cardRowLast: { borderBottomWidth: 0 },
  cardInput: { fontSize: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardSelected: { backgroundColor: '#e0e7ff' },
  cardSuccess: { backgroundColor: '#d4edda' },
  cardError: { backgroundColor: '#f8d7da' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee', borderStyle: 'dashed' },
  cardLabel: { color: '#333', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginRight: 12 },
  cardValue: { color: '#333', fontSize: 13, flex: 1, textAlign: 'right' },
  cardValueStatic: { flex: 0 },
  cardValueFlex: { flex: 1 },
  cardMessage: { color: '#888', fontSize: 13, textAlign: 'center', padding: 16 },
  cardMessageOk: { color: '#15803d', fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 6 },
  pickBtnFull: { borderWidth: 2, borderColor: '#1e3a5f', backgroundColor: 'transparent', borderRadius: 6, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  pickBtnFullText: { color: '#1e3a5f', fontSize: 14, fontWeight: '700' },
  v1Btn: { borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  v1BtnDanger: { backgroundColor: '#f8d7da', borderColor: '#f5c6cb' },
  v1BtnText: { color: '#0369a1', fontSize: 12, fontWeight: '500' },
  tableActions: { width: '100%', marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  tableActionsCenter: { justifyContent: 'center' },

  // Native crop modal
  cropOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.82)', justifyContent: 'center', padding: 12 },
  cropCard: { backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  cropHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  cropTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  cropHeaderClose: { color: '#64748b', fontSize: 16, fontWeight: '800', padding: 4 },
  cropStage: { width: '100%', aspectRatio: 1, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  cropImage: { width: '100%', height: '100%' },
  cropMask: { position: 'absolute', backgroundColor: 'rgba(2,6,23,0.55)' },
  cropBox: { position: 'absolute', borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'transparent' },
  cropHandle: { position: 'absolute', width: 22, height: 22, borderWidth: 2, borderColor: '#fff', backgroundColor: '#1e3a5f' },
  cropHandleTL: { top: -2, left: -2, borderTopLeftRadius: 4 },
  cropHandleTR: { top: -2, right: -2, borderTopRightRadius: 4 },
  cropHandleBL: { bottom: -2, left: -2, borderBottomLeftRadius: 4 },
  cropHandleBR: { bottom: -2, right: -2, borderBottomRightRadius: 4 },
  cropButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 },
});
