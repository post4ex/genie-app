import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Modal, Alert, Clipboard, Linking, ActivityIndicator, Share, Platform,
  useWindowDimensions
} from 'react-native';
import Svg, { Path, Rect, Polyline } from 'react-native-svg';
import { COLORS } from '../styles/theme';
import { getSheet, deleteFromSheet } from '../core/storage';
import { fmtDate, parseDate } from '../utils/formatIST';
import * as docgen from '../utils/docgen.js';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { UploadViewer, resolveUploadUri, isPdfUpload, downloadUploadNative } from '../utils/upload-viewer';
import UploaderScreen from './UploaderScreen';
import UpdateStatusModal from '../components/UpdateStatusModal';

// ── Web SVG Icons (Exact GENIE_WEB shipments.js _docIco 1-to-1 match) ──────────
const CheckmarkCircleIcon = ({ size = 14, color = '#0284c7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <Polyline points="22 4 12 14.01 9 11.01" />
  </Svg>
);

const WhatsAppIcon = ({ size = 14, color = '#25D366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </Svg>
);

const PrintIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </Svg>
);

const MailIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </Svg>
);

const DownloadIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </Svg>
);

const UploadIcon = ({ size = 14, color = '#16a34a' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
  </Svg>
);

const LayoutIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Rect x="3" y="3" width="7" height="7" rx="1" />
    <Rect x="14" y="3" width="7" height="7" rx="1" />
    <Rect x="3" y="14" width="7" height="7" rx="1" />
    <Rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
);

const EditIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </Svg>
);

const CopyIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </Svg>
);

const ShareIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </Svg>
);

const DeleteIcon = ({ size = 14, color = '#ef4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </Svg>
);

const RefreshIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </Svg>
);

const CalendarIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const EyeIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
  </Svg>
);

// ── 14 Web-Matching Shipment Tiles (GENIE_WEB Shipments.html) ──────────────────
const TILES = [
  { id: 'all',            label: 'Total',            icon: '📦', color: '#374151', border: '#e5e7eb', bg: '#ffffff' },
  { id: 'assign-carrier', label: 'Assign Carrier',   icon: '🚚', color: '#0369a1', border: '#e0f2fe', bg: '#f0f9ff' },
  { id: 'overduetat',     label: 'Overdue TAT',      icon: '🔥', color: '#b91c1c', border: '#fca5a5', bg: '#fef2f2' },
  { id: 'exceptions',     label: 'Exceptions',       icon: '⚠️', color: '#b91c1c', border: '#fee2e2', bg: '#fff1f1' },
  { id: 'pending-pod',    label: 'Pending PODs',     icon: '📝', color: '#6b21a8', border: '#f3e8ff', bg: '#faf5ff' },
  { id: 'topay',          label: 'To Pay',           icon: '💰', color: '#d97706', border: '#fef3c7', bg: '#fffbeb' },
  { id: 'cod',            label: 'COD',              icon: '💵', color: '#6b21a8', border: '#ede9fe', bg: '#f5f3ff' },
  { id: 'ofd',            label: 'Out for Delivery', icon: '🚐', color: '#1d4ed8', border: '#dbeafe', bg: '#eff6ff' },
  { id: 'new-bookings',   label: 'New Bookings',     icon: '📅', color: '#a16207', border: '#fefce8', bg: '#fefce8' },
  { id: 'tat',            label: 'TAT Due (3 Days)', icon: '⏰', color: '#dc2626', border: '#fee2e2', bg: '#fef2f2' },
  { id: 'heavy',          label: 'Heavy (>25 kg)',   icon: '🏋️', color: '#047857', border: '#d1fae5', bg: '#ecfdf5' },
  { id: 'highvalue',      label: 'High Value (>1L)', icon: '💎', color: '#1d4ed8', border: '#bfdbfe', bg: '#eff6ff' },
  { id: 'fov',            label: 'FOV',              icon: '📄', color: '#0f766e', border: '#ccfbf1', bg: '#f0fdf4' },
  { id: 'delivered',      label: 'Delivered',        icon: '✅', color: '#15803d', border: '#bbf7d0', bg: '#f0fdf4' },
];

const STATE_CONFIG = {
  delivered:       { label: 'Delivered',        bg: '#dcfce7', color: '#15803d' },
  rto:             { label: 'RTO',              bg: '#fee2e2', color: '#b91c1c' },
  outfordelivery:  { label: 'Out for Delivery', bg: '#dbeafe', color: '#1d4ed8' },
  exception:       { label: 'Exception',        bg: '#ffedd5', color: '#c2410c' },
  intransit:       { label: 'In Transit',       bg: '#fef3c7', color: '#b45309' },
  pending:         { label: 'Pending',          bg: '#f1f5f9', color: '#475569' },
  booked:          { label: 'Booked',           bg: '#e0e7ff', color: '#3730a3' },
  pickup:          { label: 'Pickup',           bg: '#f3e8ff', color: '#6b21a8' },
  deleted:         { label: 'Deleted',          bg: '#fee2e2', color: '#b91c1c' },
};

// ── Web-parity helpers (GENIE_WEB jawaS/shipments.js 1-to-1) ──────────────────
// ORDER_DATE may be unix seconds or milliseconds — normalize (>1e10 → ms).
const _orderMs = (o) => {
  const t = parseFloat(o?.ORDER_DATE);
  if (!t) return 0;
  return t > 1e10 ? t : t * 1000;
};

const _isTatDue = (o) => {
  const tat = parseInt(o?.TAT, 10);
  if (!tat || !o.ORDER_DATE) return false;
  const dueMs = _orderMs(o) + tat * 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(today.getDate() + 3); limit.setHours(23, 59, 59, 999);
  return dueMs >= today.getTime() && dueMs <= limit.getTime();
};

const _isOverdueTat = (o, state) => {
  const tat = parseInt(o?.TAT, 10);
  if (!tat || !o.ORDER_DATE) return false;
  const dueMs = _orderMs(o) + tat * 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);
  // Overdue = past due date, but not older than 1 month, and not delivered
  if (!(dueMs < today.getTime() && dueMs >= monthAgo.getTime())) return false;
  if (state === 'delivered') return false;
  return true;
};

const _isNewBooking = (o) => {
  // New Bookings = no carrier/awb AND order date within 24 hours
  if (o?.CARRIER && o?.AWB_NUMBER) return false;
  if (!o?.ORDER_DATE) return false;
  const msSince = Date.now() - _orderMs(o);
  return msSince >= 0 && msSince <= 86400000;
};

const _hasPODUpload = (uploads) =>
  Array.isArray(uploads) && uploads.some(u => (u.UPLOAD_TYPE || '').toUpperCase() === 'POD');

// Shipment state values arrive from different carriers with spaces, hyphens, or
// underscores (for example, "Out for Delivery"). The web compares canonical
// values such as `outfordelivery`, so use the same normalization for every tile,
// count, filter, and TAT quick-filter predicate.
const normalizeShipmentState = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const ASSIGN_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const parseAssignmentDate = (value) => {
  const match = ASSIGN_DATE_RE.exec(String(value ?? '').trim());
  if (!match) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Date.parse normalizes impossible dates (e.g. 2025-02-31), so reject them.
  if (date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() + 1 !== Number(match[2]) ||
      date.getUTCDate() !== Number(match[3])) return null;
  return date;
};

const STATUSES_LIST = ['ALL', 'delivered', 'outfordelivery', 'intransit', 'exception', 'pending'];
const PAY_MODES_LIST = ['ALL', 'TOPAY', 'COD', 'PREPAID'];

const DOC_CENTER_ITEMS = [
  { label: 'Label' },
  { label: 'Receipt' },
  { label: 'POD' },
  { label: 'Office Copy' },
  { label: 'Docs + Box' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function OrdersScreen({
  orders = [], searchQuery, setSearchQuery, refreshing, onRefresh,
  b2b2cMap = {}, carriersMap = {}, modesMap = {}, productsMap = {}, multiboxMap = {}, uploadsMap = {}, shipmentsMap = {},
  branchesMap = {}, token = '', apiBase = '', onEditOrder = null, role = 'STAFF'
}) {
  const [currentView, setCurrentView] = useState('tiles');
  const [selectedTile, setSelectedTile] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [filterCode, setFilterCode] = useState('ALL');
  const [filterCarrier, setFilterCarrier] = useState('ALL');
  const [filterPayMode, setFilterPayMode] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Dedicated Assign Carrier tile state (web shipments-assign-carrier-tile.js parity)
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSelectedOrder, setAssignSelectedOrder] = useState(null);
  const [assignCarrier, setAssignCarrier] = useState('');
  const [assignAwb, setAssignAwb] = useState('');
  const [assignOrderDate, setAssignOrderDate] = useState('');
  const [assignTransitDate, setAssignTransitDate] = useState('');
  const [assignDynaAwb, setAssignDynaAwb] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMessage, setAssignMessage] = useState('');
  const [assignFormDirty, setAssignFormDirty] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  // Visual Calendar Picker State
  const [calendarTarget, setCalendarTarget] = useState(null); // 'start' | 'end' | null
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Tracking API State
  const [liveTracking, setLiveTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [podImageUrl, setPodImageUrl] = useState(null); // Active upload viewer URI
  const [podViewerTitle, setPodViewerTitle] = useState('Upload preview');
  const [podViewerIsPdf, setPodViewerIsPdf] = useState(false);
  const [tatQuickFilter, setTatQuickFilter] = useState(null); // 'delivered' | 'outfordelivery' | 'intransit' | null
  const [updateStatusTargetOrder, setUpdateStatusTargetOrder] = useState(null);

  // Web parity — state comes from the SHIPMENTS sheet first (shipmentsDataMap),
  // falling back to the order record (web: `s?.state || s?.STATE || order...`).
  const getOrderState = (o) => {
    const s = shipmentsMap[o?.REFERENCE];
    return normalizeShipmentState(s?.state || s?.STATE || o?.STATE || o?.state || 'pending');
  };

  // Web parity (_sortMovements): newest activity_stamp first, then time_stamp.
  const sortMovements = (movs) => {
    if (!movs || !movs.length) return [];
    return movs.map((m, i) => ({ m, i })).sort((a, b) => {
      const aStamp = a.m.activity_stamp || a.m.ACTIVITY_STAMP || 0;
      const bStamp = b.m.activity_stamp || b.m.ACTIVITY_STAMP || 0;
      if (aStamp !== bStamp) return bStamp - aStamp;
      const aTs = a.m.time_stamp || a.m.TIME_STAMP || 0;
      const bTs = b.m.time_stamp || b.m.TIME_STAMP || 0;
      if (aTs !== bTs) return bTs - aTs;
      return a.i - b.i;
    }).map(x => x.m);
  };

  // Web parity (callApi): POST/DELETE to the operations server with the bearer token.
  const apiCall = async (path, body, method = 'POST') => {
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      // The web sends JSON for POST, PUT, and DELETE. DELETE /api/deleteOrder
      // requires { reference }; omitting it makes FastAPI reject the request.
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 'error') throw new Error(json.message || json.detail || `HTTP ${res.status}`);
    return json;
  };

  const partyEmails = (o) => [...new Set([b2b2cMap[o?.CONSIGNOR]?.EMAIL, b2b2cMap[o?.CONSIGNEE]?.EMAIL].filter(Boolean))];
  const partyMobiles = (o) => [b2b2cMap[o?.CONSIGNOR]?.MOBILE, b2b2cMap[o?.CONSIGNEE]?.MOBILE].filter(Boolean).join(',');

  const tileCounts = useMemo(() => {
    const counts = { all: orders.length, topay: 0, cod: 0, tat: 0, overduetat: 0, heavy: 0, highvalue: 0, exceptions: 0, 'pending-pod': 0, ofd: 0, 'new-bookings': 0, fov: 0, delivered: 0, 'assign-carrier': 0 };
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // assign-carrier 30-day window

    orders.forEach(o => {
      const state = getOrderState(o);
      const isDelivered = state === 'delivered';
      const weight = parseFloat(o.WEIGHT || 0);
      const val = parseFloat(o.VALUE || 0);

      // Exclude delivered from: To Pay, COD, FOV, Heavy, High Value
      if (o.TOPAY === 'Yes' && !isDelivered) counts.topay++;
      if (o.COD && parseFloat(o.COD) > 0 && !isDelivered) counts.cod++;
      if (_isTatDue(o)) counts.tat++;
      if (_isOverdueTat(o, state)) counts.overduetat++;
      if (weight > 25 && !isDelivered) counts.heavy++;
      if (val > 100000 && !isDelivered) counts.highvalue++;
      if (state === 'exception') counts.exceptions++;
      if (state === 'outfordelivery') counts.ofd++;
      if (state === 'delivered') counts.delivered++;
      if (_isNewBooking(o)) counts['new-bookings']++;
      if (o.FOV === 'Yes' && !isDelivered) counts.fov++;
      if (state === 'delivered' && !_hasPODUpload(uploadsMap[o.REFERENCE])) counts['pending-pod']++;
    });

    // Assign Carrier = no CARRIER/AWB within the last 30 days (web parity)
    counts['assign-carrier'] = orders.filter(o => {
      if (o.CARRIER && o.AWB_NUMBER) return false;
      const orderTs = parseDate(o.ORDER_DATE)?.getTime() || 0;
      return orderTs >= cutoff;
    }).length;

    return counts;
  }, [orders, shipmentsMap, uploadsMap]);

  // Web parity (applyFilters): when NO explicit filters, default the view to the
  // 1st of the current month (or 1st of the previous month when today ≤ 10th).
  const implicitDefaultStart = useMemo(() => {
    const today = new Date();
    let firstDay;
    if (today.getDate() <= 10 && today.getMonth() > 0)
      firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    else if (today.getDate() <= 10 && today.getMonth() === 0)
      firstDay = new Date(today.getFullYear() - 1, 11, 1);
    else
      firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  }, []);

  // Web populateFilters keeps the actual order values (rather than a hardcoded
  // catalog), so a backend branch/code/carrier is always selectable.
  const filterBranchOptions = useMemo(() => ['ALL', ...new Set(orders.map(o => String(o?.BRANCH ?? '')).filter(Boolean).sort())], [orders]);
  const filterCodeOptions = useMemo(() => ['ALL', ...new Set(orders.map(o => String(o?.CODE ?? '')).filter(Boolean).sort())], [orders]);
  const filterCarrierOptions = useMemo(() => ['ALL', ...new Set(orders.map(o => String(o?.CARRIER ?? '')).filter(Boolean).sort())], [orders]);
  const assignmentCarrierOptions = useMemo(() => {
    const fromData = Object.entries(carriersMap || {}).map(([key, value]) => String(value?.COMPANY_CODE || key).trim()).filter(Boolean);
    return [...new Set(fromData.length ? fromData : filterCarrierOptions.filter(v => v !== 'ALL'))].sort();
  }, [carriersMap, filterCarrierOptions]);

  const hasExplicitFilters = filterStatus !== 'ALL' || filterBranch !== 'ALL' || filterCode !== 'ALL' ||
    filterCarrier !== 'ALL' || filterPayMode !== 'ALL' || filterStartDate !== '' || filterEndDate !== '' || !!searchQuery;
  // Status/payment are React-only conveniences. Keep the web's implicit
  // month-start date when only one of those conveniences is selected; the web
  // equivalent filters (branch/code/carrier/search/date) intentionally disable it.
  const hasWebEquivalentFilters = filterBranch !== 'ALL' || filterCode !== 'ALL' ||
    filterCarrier !== 'ALL' || filterStartDate !== '' || filterEndDate !== '' || !!searchQuery;

  const filteredOrders = useMemo(() => {
    // Web parity: date bounds — explicit dates, else the implicit month start
    const effStart = filterStartDate || (!hasWebEquivalentFilters ? implicitDefaultStart : '');
    // Match the web's explicit UTC boundaries exactly; local-time parsing shifts
    // records near midnight on devices outside the server timezone.
    const startMs = effStart ? new Date(effStart + 'T00:00:00Z').getTime() : 0;
    const endMs = filterEndDate ? new Date(filterEndDate + 'T23:59:59Z').getTime() : 0;

    const list = orders.filter(o => {
      const state = getOrderState(o);
      const isDelivered = state === 'delivered';

      // ── Tile filters (web _tileFilterMatch parity) ──
      if (selectedTile === 'topay' && (o.TOPAY !== 'Yes' || isDelivered)) return false;
      if (selectedTile === 'cod' && (!o.COD || parseFloat(o.COD) <= 0 || isDelivered)) return false;
      if (selectedTile === 'heavy' && (parseFloat(o.WEIGHT || 0) <= 25 || isDelivered)) return false;
      if (selectedTile === 'highvalue' && (parseFloat(o.VALUE || 0) <= 100000 || isDelivered)) return false;
      if (selectedTile === 'exceptions' && state !== 'exception') return false;
      if (selectedTile === 'ofd' && state !== 'outfordelivery') return false;
      if (selectedTile === 'delivered' && state !== 'delivered') return false;
      if (selectedTile === 'fov' && (o.FOV !== 'Yes' || isDelivered)) return false;
      if (selectedTile === 'new-bookings' && !_isNewBooking(o)) return false;
      if (selectedTile === 'pending-pod' && !(state === 'delivered' && !_hasPODUpload(uploadsMap[o.REFERENCE]))) return false;
      if (selectedTile === 'assign-carrier') {
        if (o.CARRIER && o.AWB_NUMBER) return false;
        const orderTs = parseDate(o.ORDER_DATE)?.getTime() || 0;
        if (orderTs < Date.now() - 30 * 24 * 60 * 60 * 1000) return false; // 30-day window
      }
      if (selectedTile === 'tat') {
        if (!_isTatDue(o)) return false;
        if (tatQuickFilter) {
          if (tatQuickFilter === 'intransit') return state && state !== 'delivered' && state !== 'outfordelivery';
          return state === tatQuickFilter;
        }
      }
      if (selectedTile === 'overduetat') {
        if (!_isOverdueTat(o, state)) return false;
        if (tatQuickFilter) {
          if (tatQuickFilter === 'intransit') return state && state !== 'delivered' && state !== 'outfordelivery';
          return state === tatQuickFilter;
        }
      }

      // ── Advanced filters ──
      if (filterStatus !== 'ALL' && state !== filterStatus) return false;
      // Web uses exact option values for these three dynamically populated
      // selects; do not silently merge distinct backend codes by case.
      if (filterBranch !== 'ALL' && String(o.BRANCH ?? '') !== filterBranch) return false;
      if (filterCode !== 'ALL' && String(o.CODE ?? '') !== filterCode) return false;
      if (filterCarrier !== 'ALL' && String(o.CARRIER ?? '') !== filterCarrier) return false;
      if (filterPayMode === 'TOPAY' && o.TOPAY !== 'Yes') return false;
      if (filterPayMode === 'COD' && (!o.COD || parseFloat(o.COD) <= 0)) return false;
      if (filterPayMode === 'PREPAID' && (o.TOPAY === 'Yes' || (o.COD && parseFloat(o.COD) > 0))) return false;

      // ── Date range (web applyFilters parity) ──
      const orderDate = parseDate(o.ORDER_DATE);
      // Web excludes records with an invalid/missing ORDER_DATE even when the
      // user has supplied another filter and no date range.
      if (!orderDate) return false;
      if (startMs && orderDate.getTime() < startMs) return false;
      if (endMs && (!orderDate || orderDate.getTime() > endMs)) return false;

      // ── Search (web parity: ref/awb/names/cities/pincodes) ──
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const cnor = b2b2cMap[o.CONSIGNOR] || {};
        const cnee = b2b2cMap[o.CONSIGNEE] || {};
        const haystack = [
          o.REFERENCE, o.AWB_NUMBER, cnor.NAME || o.CONSIGNOR, cnee.NAME || o.CONSIGNEE,
          cnee.CITY || o.DEST_CITY, cnee.PINCODE || o.DEST_PINCODE, cnor.CITY || o.ORIGIN_CITY,
        ].filter(Boolean).map(String).join('|').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // ── Web tile-specific sorts (applyFilters parity) ──
    if (selectedTile === 'tat' || selectedTile === 'overduetat') {
      list.sort((a, b) => (_orderMs(a) + parseInt(a.TAT || 0, 10) * 86400000) - (_orderMs(b) + parseInt(b.TAT || 0, 10) * 86400000));
    } else if (selectedTile === 'heavy') {
      list.sort((a, b) => parseFloat(b.WEIGHT || 0) - parseFloat(a.WEIGHT || 0));
    } else if (selectedTile === 'highvalue') {
      list.sort((a, b) => parseFloat(b.VALUE || 0) - parseFloat(a.VALUE || 0));
    } else {
      list.sort((a, b) => {
        const aTime = parseDate(a.ORDER_DATE || a.TIME_STAMP || a.TRANSIT_DATE)?.getTime() || 0;
        const bTime = parseDate(b.ORDER_DATE || b.TIME_STAMP || b.TRANSIT_DATE)?.getTime() || 0;
        return bTime - aTime;
      });
    }
    return list;
  }, [orders, selectedTile, tatQuickFilter, filterStatus, filterBranch, filterCode, filterCarrier, filterPayMode,
    filterStartDate, filterEndDate, searchQuery, b2b2cMap, shipmentsMap, uploadsMap,
    implicitDefaultStart, hasWebEquivalentFilters]);

  const activeTileObj = TILES.find(t => t.id === selectedTile) || TILES[0];
  const hasActiveAdvancedFilters = filterStatus !== 'ALL' || filterBranch !== 'ALL' || filterCode !== 'ALL' ||
    filterCarrier !== 'ALL' || filterPayMode !== 'ALL' || filterStartDate !== '' || filterEndDate !== '';

  // Quick Date Presets Helper
  const applyDatePreset = (type) => {
    const today = new Date();
    const yyyyMmDd = (d) => d.toISOString().split('T')[0];
    if (type === 'today') {
      setFilterStartDate(yyyyMmDd(today));
      setFilterEndDate(yyyyMmDd(today));
    } else if (type === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setFilterStartDate(yyyyMmDd(past));
      setFilterEndDate(yyyyMmDd(today));
    } else if (type === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterStartDate(yyyyMmDd(firstDay));
      setFilterEndDate(yyyyMmDd(today));
    } else if (type === 'clear') {
      setFilterStartDate('');
      setFilterEndDate('');
    }
  };

  // Calendar Days Grid Calculator
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }
    return days;
  }, [calYear, calMonth]);

  const handleSelectCalendarDay = (dayNum) => {
    if (!dayNum) return;
    const mStr = String(calMonth + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const formatted = `${calYear}-${mStr}-${dStr}`;
    if (calendarTarget === 'start') {
      setFilterStartDate(formatted);
    } else if (calendarTarget === 'end') {
      setFilterEndDate(formatted);
    }
    setCalendarTarget(null);
  };

  // ── Fetch Live Tracking History API Call ──
  const fetchTrackingHistory = async (ref, live = false) => {
    if (!ref) return;
    setTrackingLoading(true);
    try {
      // Web parity (app-api.js): non-live = cached movements via /api/movements,
      // live = forced carrier scrape via /api/track?live=true
      const url = live
        ? `${apiBase}/api/track?ref=${encodeURIComponent(ref)}&live=true`
        : `${apiBase}/api/movements?ref=${encodeURIComponent(ref)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json && (json.shipment || json.movements)) {
        setLiveTracking(json);
      }
    } catch (e) {
      console.log('Tracking fetch error:', e);
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'detail' && selectedOrder?.REFERENCE) {
      setLiveTracking(null);
      setPodImageUrl(null); // don't leak a previous order's POD modal into this one
      fetchTrackingHistory(selectedOrder.REFERENCE, false);
    }
  }, [currentView, selectedOrder]);

  const handleSelectTile = (tileId) => {
    setSelectedTile(tileId);
    setTatQuickFilter(null);
    setAssignMessage('');
    if (tileId === 'assign-carrier') {
      setAssignSearch('');
      setAssignSelectedOrder(null);
      setCurrentView('assign-carrier');
    } else {
      setCurrentView('list');
    }
  };

  // ── Web-parity Mail / WhatsApp / Delete actions (real API calls) ─────────────
  const toast = (title, msg) => Alert.alert(title, msg);

  // Escape user fields interpolated into email HTML (harden the mail templates)
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const resolveFileUrl = (url) => resolveUploadUri(url, apiBase, token);

  const openUploadViewer = (uploadOrUri, title = 'Upload preview') => {
    const upload = typeof uploadOrUri === 'string' ? { FILE_URL: uploadOrUri } : (uploadOrUri || {});
    const uri = resolveUploadUri(upload.FILE_URL || upload.url || upload.pod_image || upload.POD_IMAGE, apiBase, token);
    if (!uri) return;
    setPodImageUrl(uri);
    setPodViewerTitle(title || upload.UPLOAD_TYPE || 'Upload preview');
    setPodViewerIsPdf(isPdfUpload(upload));
  };

  const mailShipment = async (o) => {
    const emails = partyEmails(o);
    if (!emails.length) { toast('No Email', 'No email address on file for consignor or consignee.'); return; }
    try {
      await apiCall('/api/mailOrder', { reference: o.REFERENCE, to: emails.join(','), template: 'SHIPMENT_DETAIL', template_vars: {} });
      toast('✅ Email sent', `To: ${emails.join(', ')}`);
    } catch (e) { toast('❌ Mail failed', e.message); }
  };

  const mailShipmentTracking = async (o) => {
    const emails = partyEmails(o);
    if (!emails.length) { toast('No Email', 'No email address on file.'); return; }
    const s = liveTracking?.shipment || {};
    const movs = liveTracking?.movements || [];
    const sc = STATE_CONFIG[normalizeShipmentState(s.state)] || STATE_CONFIG.intransit;
    const movRows = movs.map(m => `<tr><td style='border:1px solid #ddd;padding:5px'>${esc(m.date)}</td><td style='border:1px solid #ddd;padding:5px'>${esc(m.time)}</td><td style='border:1px solid #ddd;padding:5px'>${esc(m.location)}</td><td style='border:1px solid #ddd;padding:5px'>${esc(m.activity)}</td></tr>`).join('');
    const movTable = movs.length
      ? `<table style='border-collapse:collapse;width:100%;font-size:12px'><thead><tr><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Date</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Time</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Location</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Activity</th></tr></thead><tbody>${movRows}</tbody></table>`
      : '<p style="font-size:12px;color:#999">No movement history available.</p>';
    try {
      await apiCall('/api/mailOrder', {
        reference: o.REFERENCE, to: emails.join(','), template: 'SHIPMENT_TRACKING',
        template_vars: {
          STATUS_LABEL: sc.label,
          STATUS_ROW: s.status_raw ? `<tr><td style='padding:8px 10px;font-weight:bold;background:#f5f5f5'>Status</td><td style='padding:8px 10px'>${esc(s.status_raw)}</td></tr>` : '',
          ORIGIN_ROW: s.carrier_origin ? `<tr><td style='padding:8px 10px;font-weight:bold'>Origin</td><td style='padding:8px 10px'>${esc(s.carrier_origin)}</td></tr>` : '',
          DEST_ROW: s.carrier_destination ? `<tr><td style='padding:8px 10px;font-weight:bold;background:#f5f5f5'>Destination</td><td style='padding:8px 10px'>${esc(s.carrier_destination)}</td></tr>` : '',
          MOV_TABLE: movTable,
        },
      });
      toast('✅ Email sent', `Tracking status to ${emails.join(', ')}`);
    } catch (e) { toast('❌ Mail failed', e.message); }
  };

  const mailShipmentUploads = async (o) => {
    const emails = partyEmails(o);
    if (!emails.length) { toast('No Email', 'No email address on file.'); return; }
    const prods = productsMap[o.REFERENCE] || [];
    const boxes = multiboxMap[o.REFERENCE] || [];
    const ups = uploadsMap[o.REFERENCE] || uploadsMap[o.AWB_NUMBER] || [];
    const row = (cells) => `<tr>${cells.map(c => `<td style='border:1px solid #ddd;padding:5px'>${esc(c)}</td>`).join('')}</tr>`;
    const prodTable = prods.length ? `<h3 style='font-size:13px;color:#1a237e;margin:16px 0 6px'>Products</h3><table style='border-collapse:collapse;width:100%;font-size:12px'><thead><tr><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Product</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Doc#</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>EWay</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Amount</th></tr></thead><tbody>${prods.map(p => row([p.PRODUCT || '', p.DOC_NUMBER || '', p.EWAY_IF || '', parseFloat(p.AMOUNT || 0).toFixed(2)])).join('')}</tbody></table>` : '';
    const boxTable = boxes.length ? `<h3 style='font-size:13px;color:#1a237e;margin:16px 0 6px'>MultiBox</h3><table style='border-collapse:collapse;width:100%;font-size:12px'><thead><tr><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Box#</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Weight</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>L×B×H</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>ChgWt</th></tr></thead><tbody>${boxes.map(b => row([b.BOX_NUM || '', b.WEIGHT || 0, `${parseFloat(b.LENGTH || 0)}×${parseFloat(b.BREADTH || 0)}×${parseFloat(b.HIGHT || 0)}`, parseFloat(b.CHG_WT || 0).toFixed(2)])).join('')}</tbody></table>` : '';
    const uplTable = ups.length ? `<h3 style='font-size:13px;color:#1a237e;margin:16px 0 6px'>Uploads</h3><table style='border-collapse:collapse;width:100%;font-size:12px'><thead><tr><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Type</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Doc#/ID</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Details</th><th style='border:1px solid #ddd;padding:5px;background:#f5f5f5'>Date</th></tr></thead><tbody>${ups.map(u => {
      const idt = u.AWB_NUMBER || u.KYC_NUMBER || u.REFERENCE || '';
      let det = u.STATUS_REMARK || '';
      if (u.UPLOAD_TYPE === 'MultiBox') det = `Child:${u.CHILD_AWB || ''}`;
      else if (u.UPLOAD_TYPE === 'KYC') det = `${u.CUSTOMER_UID || ''}(${u.KYC_TYPE || ''})`;
      else if (u.UPLOAD_TYPE === 'Product') det = `${u.DOC_NUMBER || ''}(${u.DOC_TYPE || ''})`;
      return row([u.UPLOAD_TYPE || '', idt, det, u.TIME_STAMP || '']);
    }).join('')}</tbody></table>` : '';
    try {
      await apiCall('/api/mailOrder', {
        reference: o.REFERENCE, to: emails.join(','), template: 'SHIPMENT_UPLOADS',
        template_vars: { PRODUCTS_TABLE: prodTable, MULTIBOX_TABLE: boxTable, UPLOADS_TABLE: uplTable },
      });
      toast('✅ Email sent', `Uploads summary to ${emails.join(', ')}`);
    } catch (e) { toast('❌ Mail failed', e.message); }
  };

  const waOrder = async (o, payload) => {
    try {
      const res = await apiCall('/api/waOrder', { reference: o.REFERENCE, to: partyMobiles(o), audience: 'b2b', ...payload });
      toast('✅ WhatsApp sent', (res.sent_to || []).join(', ') || 'Message delivered');
    } catch (e) { toast('❌ WhatsApp failed', e.message); }
  };

  const waShipment = (o) => waOrder(o, { template: 'SHIPMENT_DETAIL' });

  const waShipmentTracking = (o) => {
    const s = liveTracking?.shipment || {};
    const movs = liveTracking?.movements || [];
    const sc = STATE_CONFIG[normalizeShipmentState(s.state)] || STATE_CONFIG.intransit;
    const movText = movs.slice(0, 10).map(m => `  ${[m.date, m.time].filter(Boolean).join(' ')} | ${m.location || ''} | ${m.activity || ''}`).join('\n') || 'No history';
    return waOrder(o, {
      template: 'SHIPMENT_TRACKING',
      template_vars: {
        status: sc.label + (s.status_raw ? ` — ${s.status_raw}` : ''),
        origin_line: s.carrier_origin ? `Origin: ${s.carrier_origin}\n` : '',
        dest_line: s.carrier_destination ? `Dest: ${s.carrier_destination}\n` : '',
        movements: movText,
      },
    });
  };

  const waShipmentUploads = (o) => {
    const ups = uploadsMap[o.REFERENCE] || uploadsMap[o.AWB_NUMBER] || [];
    const uploadTypes = [...new Set(ups.map(u => u.UPLOAD_TYPE).filter(Boolean))].join(', ') || 'None';
    const fileUrls = ups.filter(u => u.FILE_URL).map(u => ({
      url: u.FILE_URL, caption: `${u.UPLOAD_TYPE} — ${o.AWB_NUMBER || o.REFERENCE}`, filename: u.FILE_URL.split('/').pop(),
    }));
    return waOrder(o, { template: 'SHIPMENT_UPLOADS', template_vars: { upload_types: uploadTypes }, file_urls: fileUrls });
  };

  // Per-doc WhatsApp (web _waSelectedShipmentDoc parity — 'Reciept' is the backend typo)
  const waDoc = (o, docType) => {
    const typeMap = { 'Receipt': 'Reciept', 'POD': 'POD', 'Label': null, 'Office Copy': null, 'Docs + Box': null };
    const uploadType = typeMap[docType];
    const ups = uploadsMap[o.REFERENCE] || uploadsMap[o.AWB_NUMBER] || [];
    const relevant = uploadType ? ups.filter(u => u.UPLOAD_TYPE === uploadType && u.FILE_URL) : [];
    return waOrder(o, {
      template: 'SHIPMENT_DETAIL',
      file_urls: relevant.map(u => ({ url: u.FILE_URL, caption: `${docType} — ${o.AWB_NUMBER || o.REFERENCE}`, filename: u.FILE_URL.split('/').pop() })),
    });
  };

  const removeOrderFromLocalReplica = async (reference) => {
    if (!reference) return;
    const orderSheet = await getSheet('ORDERS');
    const orderKeys = Object.entries(orderSheet || {})
      .filter(([, row]) => String(row?.REFERENCE ?? '') === String(reference))
      .map(([key]) => key);
    if (orderKeys.length) await deleteFromSheet('ORDERS', orderKeys);
    for (const collection of ['MULTIBOX', 'PRODUCTS', 'UPLOADS', 'SHIPMENTS']) {
      const sheet = await getSheet(collection);
      const childKeys = Object.entries(sheet || {})
        .filter(([, row]) => String(row?.REFERENCE ?? '') === String(reference))
        .map(([key]) => key);
      if (childKeys.length) await deleteFromSheet(collection, childKeys);
    }
  };

  const deleteOrder = (o) => {
    Alert.alert('Delete order', `Delete order ${o.REFERENCE}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiCall('/api/deleteOrder', { reference: o.REFERENCE }, 'DELETE');
            // Do not wait for the next SSE/full-sync cycle to remove the row:
            // the web removes it from its current replica immediately too.
            try {
              await removeOrderFromLocalReplica(o.REFERENCE);
            } catch (localError) {
              // Server deletion succeeded; a later refresh/SSE will reconcile
              // the replica even if the immediate local cleanup is unavailable.
              console.warn('[Orders] local delete cleanup:', localError.message);
            }
            toast('✅ Deleted', `Order ${o.REFERENCE} deleted`);
            setCurrentView('tiles');
            setSelectedOrder(null);
            if (onRefresh) onRefresh();
          } catch (e) { toast('❌ Delete failed', e.message); }
        },
      },
    ]);
  };

  const deleteUpload = (up) => {
    Alert.alert('Delete upload', 'Permanently remove this upload file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiCall(`/api/upload/${up.UPLOAD_UID}`, {}, 'DELETE');
            toast('✅ Deleted', 'Upload record removed');
            if (onRefresh) onRefresh();
          } catch (e) { toast('❌ Delete failed', e.message); }
        },
      },
    ]);
  };

  // ── Document Center actions (web printSelectedShipment*/download*/mail* parity) ──
  const [labelLayout, setLabelLayout] = useState('2up-landscape'); // '2up-landscape' | '4up-portrait' (web window._labelLayout)
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);

  useEffect(() => {
    docgen.setDocgenContext({
      modesDataMap: new Map(Object.entries(modesMap || {})),
      branchDataMap: new Map(Object.entries(branchesMap || {})),
      labelLayout,
    });
  }, [modesMap, branchesMap, labelLayout]);

  const DOC_KIND_SLUG = { 'Label': 'Label', 'Receipt': 'Receipt', 'POD': 'POD', 'Office Copy': 'OfficeCopy', 'Docs + Box': 'DocsAndBox' };
  const DOC_KIND_LABEL = { 'Label': 'Shipping Label', 'Receipt': 'Receipt', 'POD': 'Proof of Delivery', 'Office Copy': 'Office Copy', 'Docs + Box': 'Docs & Box Labels' };

  const _docCtx = (o) => ({
    cnor: b2b2cMap[o.CONSIGNOR],
    cnee: b2b2cMap[o.CONSIGNEE],
    products: productsMap[o.REFERENCE] || [],
    multiboxItems: multiboxMap[o.REFERENCE] || [],
    branch: branchesMap[o.BRANCH],
    layout: labelLayout,
  });

  const printDoc = async (o, kind) => {
    const slug = DOC_KIND_SLUG[kind] || kind;
    const html = docgen.buildSingleDocHtml(slug, o, _docCtx(o));
    const title = `${kind} - ${o.AWB_NUMBER || o.REFERENCE}`;
    try {
      if (Platform.OS === 'web') docgen.openDocInNewTab(title, html);
      else await Print.printAsync({ html });
    } catch (e) { toast('❌ Print failed', e.message); }
  };

  const printAllDocs = async (o) => {
    const html = docgen.buildAllDocsHtml(o, _docCtx(o));
    try {
      if (Platform.OS === 'web') docgen.openDocInNewTab(`All Docs - ${o.AWB_NUMBER || o.REFERENCE}`, html);
      else await Print.printAsync({ html });
    } catch (e) { toast('❌ Print failed', e.message); }
  };

  const _saveOrShareDoc = async (title, html) => {
    const path = `${FileSystem.cacheDirectory || ''}${title}.html`;
    await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/html', dialogTitle: title, UTI: 'public.html' });
    } else {
      toast('✅ Saved', `Saved: ${title}.html`);
    }
  };

  const downloadDoc = async (o, kind) => {
    const slug = DOC_KIND_SLUG[kind] || kind;
    const html = docgen.buildSingleDocHtml(slug, o, _docCtx(o));
    const title = `${slug} - ${o.AWB_NUMBER || o.REFERENCE}`;
    try {
      if (Platform.OS === 'web') { docgen.downloadDocBlob(title, html); toast('✅ Downloading', `${title}.html`); }
      else await _saveOrShareDoc(title, html);
    } catch (e) { toast('❌ Download failed', e.message); }
  };

  const downloadAllDocs = async (o) => {
    const title = `AllDocs - ${o.AWB_NUMBER || o.REFERENCE}`;
    try {
      const html = docgen.buildAllDocsHtml(o, _docCtx(o));
      if (Platform.OS === 'web') { docgen.downloadDocBlob(title, html); toast('✅ Downloading', `${title}.html`); }
      else await _saveOrShareDoc(title, html);
    } catch (e) { toast('❌ Download failed', e.message); }
  };

  const mailDoc = async (o, kind) => {
    const emails = partyEmails(o);
    if (!emails.length) { toast('No Email', 'No email address on file for consignor or consignee.'); return; }
    try {
      const slug = DOC_KIND_SLUG[kind] || kind;
      const html = docgen.buildSingleDocHtml(slug, o, _docCtx(o));
      const att = docgen.docToAttachment(`${slug} - ${o.AWB_NUMBER || o.REFERENCE}`, html);
      await apiCall('/api/mailOrder', {
        reference: o.REFERENCE,
        to: emails.join(','),
        template: 'SHIPMENT_DOC',
        template_vars: { DOC_LABEL: DOC_KIND_LABEL[kind] || kind },
        attachment_b64: att.b64,
        attachment_name: att.name,
      });
      toast('✅ Email sent', `Attachment to ${emails.join(', ')}`);
    } catch (e) { toast('❌ Mail failed', e.message); }
  };

  const toggleLabelLayout = () => {
    const next = labelLayout === '4up-portrait' ? '2up-landscape' : '4up-portrait';
    setLabelLayout(next);
    toast('Label Layout', next === '4up-portrait' ? 'Switched to 4-up Portrait' : 'Switched to 2-up Landscape');
  };

  const openUpload = (o) => { setUploadTarget(o); setUploadVisible(true); };
  const closeUpload = () => { setUploadVisible(false); setUploadTarget(null); };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setCurrentView('detail');
  };

  const handleResetAdvancedFilters = () => {
    setFilterStatus('ALL');
    setFilterBranch('ALL');
    setFilterCode('ALL');
    setFilterCarrier('ALL');
    setFilterPayMode('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    setTatQuickFilter(null);
  };

  // Web Assign Carrier tile: recent shipments are sorted with incomplete rows
  // first, then complete rows, both newest-first. The tile's count itself still
  // counts only incomplete recent rows, exactly like the web.
  const assignRows = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = orders.filter((o) => (parseDate(o?.ORDER_DATE)?.getTime() || 0) >= cutoff);
    const q = assignSearch.trim().toLowerCase();
    const matches = (o) => {
      if (!q) return true;
      const consignor = b2b2cMap[o.CONSIGNOR]?.NAME || o.CONSIGNOR || '';
      const consignee = b2b2cMap[o.CONSIGNEE]?.NAME || o.CONSIGNEE || '';
      return [o.REFERENCE, o.AWB_NUMBER, consignor, consignee]
        .filter(Boolean).map(String).join('|').toLowerCase().includes(q);
    };
    return recent.filter(matches).sort((a, b) => {
      const incompleteA = !a.CARRIER || !a.AWB_NUMBER;
      const incompleteB = !b.CARRIER || !b.AWB_NUMBER;
      if (incompleteA !== incompleteB) return incompleteA ? -1 : 1;
      return (parseDate(b.ORDER_DATE)?.getTime() || 0) - (parseDate(a.ORDER_DATE)?.getTime() || 0);
    });
  }, [orders, assignSearch, b2b2cMap]);

  // If SSE/full sync removes or replaces the selected record, never leave an
  // orphaned assign form editing a shipment that no longer exists. Keep the
  // input values intact so an in-progress edit is not unexpectedly overwritten.
  useEffect(() => {
    if (!assignSelectedOrder?.REFERENCE) return;
    const latest = orders.find(o => String(o?.REFERENCE) === String(assignSelectedOrder.REFERENCE));
    if (!latest) {
      setAssignSelectedOrder(null);
      setAssignFormDirty(false);
      setAssignMessage('');
      return;
    }
    if (latest !== assignSelectedOrder) {
      // Never submit a form based on a record changed by SSE while it was being
      // edited. A clean form is refreshed; a dirty form is safely invalidated.
      if (assignFormDirty) {
        setAssignSelectedOrder(null);
        setAssignFormDirty(false);
        setAssignMessage('Shipment changed on the server. Select it again.');
      } else {
        setAssignSelectedOrder(latest);
        setAssignCarrier(latest.CARRIER || '');
        setAssignAwb(latest.AWB_NUMBER || '');
        setAssignOrderDate(toAssignmentDate(latest.ORDER_DATE));
        setAssignTransitDate(toAssignmentDate(latest.TRANSIT_DATE));
        setAssignDynaAwb(latest.DYNA_AWB || '');
      }
    }
  }, [orders, assignSelectedOrder?.REFERENCE, assignFormDirty]);

  const toAssignmentDate = (value) => {
    const date = parseDate(value);
    if (!date) return '';
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  };

  const selectAssignOrder = (order) => {
    setAssignSelectedOrder(order);
    setAssignFormDirty(false);
    setAssignCarrier(order.CARRIER || '');
    setAssignAwb(order.AWB_NUMBER || '');
    setAssignOrderDate(toAssignmentDate(order.ORDER_DATE));
    setAssignTransitDate(toAssignmentDate(order.TRANSIT_DATE));
    setAssignDynaAwb(order.DYNA_AWB || '');
    setAssignMessage('');
  };

  const saveAssignOrder = async () => {
    if (!assignSelectedOrder) return;
    if (!assignCarrier.trim() || !assignAwb.trim()) {
      setAssignMessage('Carrier and AWB are required.');
      return;
    }
    const orderDate = assignOrderDate ? parseAssignmentDate(assignOrderDate) : null;
    const transitDate = assignTransitDate ? parseAssignmentDate(assignTransitDate) : null;
    if ((assignOrderDate && !orderDate) || (assignTransitDate && !transitDate)) {
      setAssignMessage('Dates must be valid YYYY-MM-DD values.');
      return;
    }
    const fields = {
      CARRIER: assignCarrier.trim(),
      AWB_NUMBER: assignAwb.trim(),
    };
    if (orderDate) fields.ORDER_DATE = orderDate.getTime();
    if (transitDate) fields.TRANSIT_DATE = transitDate.getTime();
    if (assignDynaAwb.trim()) fields.DYNA_AWB = assignDynaAwb.trim();

    setAssignSaving(true);
    setAssignMessage('Updating…');
    try {
      await apiCall('/api/updateOrder', { reference: assignSelectedOrder.REFERENCE, ...fields }, 'PATCH');
      const updated = { ...assignSelectedOrder, ...fields };
      setAssignSelectedOrder(updated);
      setAssignFormDirty(false);
      setAssignMessage('Order updated successfully.');
      onRefresh?.();
    } catch (error) {
      setAssignMessage(`Update failed: ${error.message}`);
    } finally {
      setAssignSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // STAGE VIEWS RENDER
  // ────────────────────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (currentView === 'tiles') {
      return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Text style={styles.pageTitle}>Shipments</Text>
        <Text style={styles.pageSubtitle}>Select a category tile to view shipments</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search Ref, AWB, Consignee, City..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={(q) => {
            setSearchQuery(q);
            if (q) setCurrentView('list');
          }}
        />

        <View style={styles.tileGrid}>
          {TILES.map(tile => {
            const count = tileCounts[tile.id] ?? 0;
            return (
              <TouchableOpacity
                key={tile.id}
                activeOpacity={0.8}
                style={[styles.gridTile, { borderColor: tile.border, backgroundColor: tile.bg }]}
                onPress={() => handleSelectTile(tile.id)}
              >
                <Text style={styles.gridTileIcon}>{tile.icon}</Text>
                <Text style={[styles.gridTileCount, { color: tile.color }]}>{count}</Text>
                <Text style={styles.gridTileLabel}>{tile.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ASSIGN CARRIER VIEW (GENIE_WEB shipments-assign-carrier-tile.js parity)
  // ────────────────────────────────────────────────────────────────────────────
  if (currentView === 'assign-carrier') {
    const isCompact = screenWidth < 720;
    return (
      <View style={styles.container}>
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { setAssignSelectedOrder(null); setCurrentView('tiles'); }}>
            <Text style={styles.backBtnText}>‹ Tiles</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>🚚 Assign Carrier</Text>
        </View>
        <View style={[styles.assignLayout, isCompact && styles.assignLayoutCompact]}>
          {(!isCompact || !assignSelectedOrder) && (
            <View style={[styles.assignListPane, isCompact && styles.assignListPaneCompact]}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search AWB, Ref, Consignor, Consignee..."
                placeholderTextColor="#94a3b8"
                value={assignSearch}
                onChangeText={setAssignSearch}
              />
              <Text style={styles.assignListSummary}>{assignRows.length} recent shipment(s)</Text>
              <ScrollView style={styles.assignList}>
                {assignRows.length ? assignRows.map((order) => {
                  const incomplete = !order.CARRIER || !order.AWB_NUMBER;
                  const consignor = b2b2cMap[order.CONSIGNOR]?.NAME || order.CONSIGNOR || 'Unknown';
                  const consignee = b2b2cMap[order.CONSIGNEE]?.NAME || order.CONSIGNEE || 'Unknown';
                  return (
                    <TouchableOpacity
                      key={order.REFERENCE}
                      style={[styles.assignItem, incomplete && styles.assignItemIncomplete, assignSelectedOrder?.REFERENCE === order.REFERENCE && styles.assignItemSelected]}
                      onPress={() => selectAssignOrder(order)}
                    >
                      <Text style={styles.assignItemAwb}>{order.AWB_NUMBER || 'No AWB'}</Text>
                      <Text style={styles.assignItemRoute}>{consignor} → {consignee}</Text>
                      <Text style={styles.assignItemMeta}>Ref: {order.REFERENCE} · {fmtDate(order.ORDER_DATE, 'display')}</Text>
                      <Text style={styles.assignItemCarrier}>{order.CARRIER || 'No Carrier'}</Text>
                    </TouchableOpacity>
                  );
                }) : <Text style={styles.emptyText}>No recent shipments found.</Text>}
              </ScrollView>
            </View>
          )}

          {(!isCompact || assignSelectedOrder) && (
            <ScrollView style={[styles.assignFormPane, isCompact && styles.assignFormPaneCompact]} contentContainerStyle={styles.assignFormContent}>
              {!assignSelectedOrder ? (
                <Text style={styles.placeholder}>Select a shipment to assign its carrier and AWB.</Text>
              ) : (
                <>
                  {isCompact ? (
                    <TouchableOpacity style={styles.assignBackToListBtn} onPress={() => setAssignSelectedOrder(null)}>
                      <Text style={styles.assignBackToListBtnText}>‹ Back to Shipments List</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.assignFormTitle}>Update Shipment</Text>
                  <Text style={styles.assignFormRef}>Reference: {assignSelectedOrder.REFERENCE}</Text>
                  <Text style={styles.assignLabel}>Carrier *</Text>
                  <View style={styles.assignChipRow}>
                    {assignmentCarrierOptions.map((carrier) => (
                      <TouchableOpacity key={carrier} style={[styles.assignChip, assignCarrier === carrier && styles.assignChipActive]} onPress={() => { setAssignFormDirty(true); setAssignCarrier(carrier); }}>
                        <Text style={[styles.assignChipText, assignCarrier === carrier && styles.assignChipTextActive]}>{carrier}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput style={styles.assignInput} placeholder="Carrier code" placeholderTextColor="#94a3b8" value={assignCarrier} onChangeText={(value) => { setAssignFormDirty(true); setAssignCarrier(value); }} />
                  <Text style={styles.assignLabel}>AWB Number *</Text>
                  <TextInput style={styles.assignInput} placeholder="Enter AWB number" placeholderTextColor="#94a3b8" value={assignAwb} onChangeText={(value) => { setAssignFormDirty(true); setAssignAwb(value); }} autoCapitalize="characters" />
                  <Text style={styles.assignLabel}>Order Date</Text>
                  <TextInput style={styles.assignInput} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={assignOrderDate} onChangeText={(value) => { setAssignFormDirty(true); setAssignOrderDate(value); }} />
                  <Text style={styles.assignLabel}>Transit Date</Text>
                  <TextInput style={styles.assignInput} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={assignTransitDate} onChangeText={(value) => { setAssignFormDirty(true); setAssignTransitDate(value); }} />
                  <Text style={styles.assignLabel}>Dynamic AWB</Text>
                  <TextInput style={styles.assignInput} placeholder="Optional" placeholderTextColor="#94a3b8" value={assignDynaAwb} onChangeText={(value) => { setAssignFormDirty(true); setAssignDynaAwb(value); }} autoCapitalize="characters" />
                  {assignMessage ? <Text style={[styles.assignMessage, assignMessage.includes('failed') || assignMessage.includes('required') ? styles.assignMessageError : styles.assignMessageSuccess]}>{assignMessage}</Text> : null}
                  <TouchableOpacity style={[styles.assignSubmit, assignSaving && styles.btnDisabled]} disabled={assignSaving} onPress={saveAssignOrder}>
                    {assignSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.assignSubmitText}>Update Order</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STAGE 2: LIST VIEW
  // ────────────────────────────────────────────────────────────────────────────
  if (currentView === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentView('tiles')}>
            <Text style={styles.backBtnText}>‹ Tiles</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>
            {activeTileObj.icon} {activeTileObj.label} ({filteredOrders.length})
          </Text>
        </View>

        <View style={styles.searchFilterRow}>
          <TextInput
            style={[styles.searchInput, { flex: 1, marginBottom: 0 }]}
            placeholder="Search AWB, Ref, Client..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={[styles.filterIconBtn, hasActiveAdvancedFilters && styles.filterIconBtnActive]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Text style={[styles.filterIconBtnText, hasActiveAdvancedFilters && styles.filterIconBtnTextActive]}>
              ⚙️ Filter
            </Text>
          </TouchableOpacity>
        </View>

        {hasActiveAdvancedFilters && (
          <View style={styles.activePillsBar}>
            {filterStatus !== 'ALL' && <Text style={styles.activePill}>Status: {filterStatus}</Text>}
            {filterBranch !== 'ALL' && <Text style={styles.activePill}>Branch: {filterBranch}</Text>}
            {filterCode !== 'ALL' && <Text style={styles.activePill}>Code: {filterCode}</Text>}
            {filterCarrier !== 'ALL' && <Text style={styles.activePill}>Carrier: {filterCarrier}</Text>}
            {filterPayMode !== 'ALL' && <Text style={styles.activePill}>Pay: {filterPayMode}</Text>}
            {(filterStartDate || filterEndDate) && (
              <Text style={styles.activePill}>
                Date: {filterStartDate || '...'} to {filterEndDate || '...'}
              </Text>
            )}
            <TouchableOpacity onPress={handleResetAdvancedFilters}>
              <Text style={styles.clearPillsText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TAT Quick Filters (web _renderTatQuickFilters parity) ── */}
        {(selectedTile === 'tat' || selectedTile === 'overduetat') && (
          <View style={styles.tatPillsRow}>
            {[
              { key: 'delivered', label: 'Delivered' },
              { key: 'outfordelivery', label: 'OFD' },
              { key: 'intransit', label: 'In Transit' },
            ].map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.tatPill, tatQuickFilter === p.key && styles.tatPillActive]}
                onPress={() => setTatQuickFilter(tatQuickFilter === p.key ? null : p.key)}
              >
                <Text style={[styles.tatPillText, tatQuickFilter === p.key && styles.tatPillTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!hasWebEquivalentFilters && (
          <Text style={styles.defaultViewNote}>Default view from {implicitDefaultStart} — use filters to widen</Text>
        )}

        <FlatList
          data={filteredOrders}
          keyExtractor={(item, index) => item.REFERENCE || item.id || index.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <WebShipmentListItem
              order={item}
              b2b2cMap={b2b2cMap}
              shipmentsMap={shipmentsMap}
              isSelected={selectedOrder?.REFERENCE === item.REFERENCE}
              onPress={() => handleSelectOrder(item)}
              onUpdateStatus={(target) => setUpdateStatusTargetOrder(target)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No orders match filters.</Text>
            </View>
          }
        />

        {/* ── Filter Modal (With Interactive Calendar Date Picker) ── */}
        <Modal
          visible={filterModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter Shipments</Text>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                  <Text style={styles.modalCloseX}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }}>
                {/* Date Range Section */}
                <Text style={styles.filterSectionTitle}>DATE RANGE</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity style={styles.chip} onPress={() => applyDatePreset('today')}>
                    <Text style={styles.chipText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chip} onPress={() => applyDatePreset('7days')}>
                    <Text style={styles.chipText}>7 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chip} onPress={() => applyDatePreset('month')}>
                    <Text style={styles.chipText}>This Month</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, { backgroundColor: '#fee2e2' }]} onPress={() => applyDatePreset('clear')}>
                    <Text style={[styles.chipText, { color: '#ef4444' }]}>Clear Date</Text>
                  </TouchableOpacity>
                </View>

                {/* Calendar Trigger Input Buttons */}
                <View style={styles.dateInputsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateInputLabel}>From Date:</Text>
                    <TouchableOpacity style={styles.calendarTriggerBtn} onPress={() => setCalendarTarget('start')}>
                      <CalendarIcon size={14} color="#0284c7" />
                      <Text style={styles.calendarTriggerText}>
                        {filterStartDate || 'Select Date'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateInputLabel}>To Date:</Text>
                    <TouchableOpacity style={styles.calendarTriggerBtn} onPress={() => setCalendarTarget('end')}>
                      <CalendarIcon size={14} color="#0284c7" />
                      <Text style={styles.calendarTriggerText}>
                        {filterEndDate || 'Select Date'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.filterSectionTitle}>SHIPMENT STATUS</Text>
                <View style={styles.chipRow}>
                  {STATUSES_LIST.map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.chip, filterStatus === st && styles.chipActive]}
                      onPress={() => setFilterStatus(st)}
                    >
                      <Text style={[styles.chipText, filterStatus === st && styles.chipTextActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>BRANCH</Text>
                <View style={styles.chipRow}>
                  {filterBranchOptions.map((branch) => (
                    <TouchableOpacity key={branch} style={[styles.chip, filterBranch === branch && styles.chipActive]} onPress={() => setFilterBranch(branch)}>
                      <Text style={[styles.chipText, filterBranch === branch && styles.chipTextActive]}>{branch}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>CODE</Text>
                <View style={styles.chipRow}>
                  {filterCodeOptions.map((code) => (
                    <TouchableOpacity key={code} style={[styles.chip, filterCode === code && styles.chipActive]} onPress={() => setFilterCode(code)}>
                      <Text style={[styles.chipText, filterCode === code && styles.chipTextActive]}>{code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>CARRIER</Text>
                <View style={styles.chipRow}>
                  {filterCarrierOptions.map((car) => (
                    <TouchableOpacity key={car} style={[styles.chip, filterCarrier === car && styles.chipActive]} onPress={() => setFilterCarrier(car)}>
                      <Text style={[styles.chipText, filterCarrier === car && styles.chipTextActive]}>{car}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>PAYMENT MODE</Text>
                <View style={styles.chipRow}>
                  {PAY_MODES_LIST.map(pm => (
                    <TouchableOpacity
                      key={pm}
                      style={[styles.chip, filterPayMode === pm && styles.chipActive]}
                      onPress={() => setFilterPayMode(pm)}
                    >
                      <Text style={[styles.chipText, filterPayMode === pm && styles.chipTextActive]}>
                        {pm}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.resetModalBtn} onPress={handleResetAdvancedFilters}>
                  <Text style={styles.resetModalBtnText}>Reset Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyModalBtn} onPress={() => setFilterModalVisible(false)}>
                  <Text style={styles.applyModalBtnText}>Apply ({filteredOrders.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Interactive Calendar Modal Picker ── */}
        <Modal
          visible={calendarTarget !== null}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setCalendarTarget(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.calendarModalContent}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  onPress={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                    else { setCalMonth(m => m - 1); }
                  }}
                  style={styles.calNavBtn}
                >
                  <Text style={styles.calNavBtnText}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.calendarMonthTitle}>
                  {MONTH_NAMES[calMonth]} {calYear}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                    else { setCalMonth(m => m + 1); }
                  }}
                  style={styles.calNavBtn}
                >
                  <Text style={styles.calNavBtnText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Day Headers */}
              <View style={styles.calWeekRow}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, di) => (
                  <Text key={di} style={styles.calWeekDayText}>{d}</Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calGrid}>
                {calendarDays.map((dayNum, idx) => (
                  <TouchableOpacity
                    key={idx}
                    disabled={!dayNum}
                    style={[
                      styles.calDayBox,
                      dayNum && styles.calDayBoxActive
                    ]}
                    onPress={() => handleSelectCalendarDay(dayNum)}
                  >
                    <Text style={[styles.calDayText, !dayNum && styles.calDayTextEmpty]}>
                      {dayNum || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.calCancelBtn} onPress={() => setCalendarTarget(null)}>
                <Text style={styles.calCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STAGE 3: DETAIL VIEW (Exact Web Order of 7 Cards + Implanted Tracking API)
  // ────────────────────────────────────────────────────────────────────────────
  if (currentView === 'detail' && selectedOrder) {
    const o = selectedOrder;
    const stateRaw = getOrderState(o);
    const stateCfg = STATE_CONFIG[stateRaw] || STATE_CONFIG.pending;

    const cnorObj = b2b2cMap[o.CONSIGNOR] || {};
    const cneeObj = b2b2cMap[o.CONSIGNEE] || {};

    const cnorName = cnorObj.NAME || o.CONSIGNOR || '';
    const cnorCity = cnorObj.CITY || o.ORIGIN_CITY || '';
    const cnorPin  = cnorObj.PINCODE || o.ORIGIN_PINCODE || o.CONSIGNOR_PINCODE || '';
    const cnorState= cnorObj.STATE || o.CONSIGNOR_STATE || '';
    const cnorAddr = cnorObj.ADDRESS || o.CONSIGNOR_ADDRESS || '';
    const cnorMob  = cnorObj.MOBILE || o.CONSIGNOR_MOBILE || '';

    const cneeName = cneeObj.NAME || o.CONSIGNEE || '';
    const cneeCity = cneeObj.CITY || o.DEST_CITY || '';
    const cneePin  = cneeObj.PINCODE || o.DEST_PINCODE || o.CONSIGNEE_PINCODE || '';
    const cneeState= cneeObj.STATE || o.CONSIGNEE_STATE || '';
    const cneeAddr = cneeObj.ADDRESS || o.CONSIGNEE_ADDRESS || '';
    const cneeMob  = cneeObj.MOBILE || o.CONSIGNEE_MOBILE || '';

    const carrierRecord = carriersMap[o.CARRIER];
    const carrierName = (typeof carrierRecord === 'string' ? carrierRecord : (carrierRecord?.COMPANY_NAME || carrierRecord?.NAME)) || o.CARRIER || 'N/A';
    const modeRecord = modesMap[o.MODE];
    const modeName = (typeof modeRecord === 'string' ? modeRecord : (modeRecord?.MODE || modeRecord?.NAME)) || o.MODE || 'N/A';

    const formattedOrderDate   = fmtDate(o.ORDER_DATE, 'date');
    const formattedTransitDate = fmtDate(o.TRANSIT_DATE, 'date');
    const formattedInvoiceDate = fmtDate(o.INVOICE_DATE, 'date');

    const products  = productsMap[o.REFERENCE] || o.products || [];
    const boxes     = multiboxMap[o.REFERENCE] || o.multibox || [];
    const uploads   = uploadsMap[o.REFERENCE] || uploadsMap[o.AWB_NUMBER] || o.uploads || o.UPLOADS || [];
    const shipment  = liveTracking?.shipment || shipmentsMap[o.REFERENCE] || {};
    // Web parity (_sortMovements): newest activity_stamp first, then time_stamp
    const movements = sortMovements(liveTracking?.movements || shipment.movements || o.movements || []);

    const buildOrderText = () => {
      const totalChgWt = boxes.reduce((s, b) => s + parseFloat(b.CHG_WT || 0), 0);
      const lines = [
        `Date: ${fmtDate(o.ORDER_DATE)}, AWB: ${o.AWB_NUMBER || 'N/A'},`,
        `Carrier: ${carrierName}`,
        o.TOPAY === 'Yes' ? `ToPay: Yes (${o.TOTAL || 'N/A'})` : null,
        o.COD && parseFloat(o.COD) > 0 ? `COD: ${o.COD}` : null,
        ``,
        `Consignee: ${cneeName || 'N/A'}`,
        cneeAddr ? `  ${cneeAddr}` : null,
        cneeCity ? `  ${cneeCity} - ${cneePin}` : null,
        cneeMob  ? `  Ph: ${cneeMob}` : null,
        ``,
        `Consignor: ${cnorName || 'N/A'}`,
        cnorCity ? `  ${cnorCity} - ${cnorPin}` : null,
        cnorMob  ? `  Ph: ${cnorMob}` : null,
        products.length > 0 ? `` : null,
        products.length > 0 ? `Products: Value: ${o.VALUE || 'N/A'}` : null,
        ...products.map(p => `  ${p.PRODUCT || 'N/A'} | Doc: ${p.DOC_NUMBER || 'N/A'} | Amt: ${p.AMOUNT || 0}`),
        boxes.length > 0 ? `` : null,
        boxes.length > 0 ? `Boxes:  Pcs: ${o.PIECS || 'N/A'},  Wt: ${o.WEIGHT || 'N/A'} kg, Chg: ${totalChgWt.toFixed(1)} kg` : null,
        ...boxes.map(b => `  Box#${b.BOX_NUM || 'N/A'} | Wt:${b.WEIGHT || 0} | ${parseFloat(b.LENGTH)||0}x${parseFloat(b.BREADTH)||0}x${parseFloat(b.HIGHT)||0} | ChgWt:${parseFloat(b.CHG_WT||0).toFixed(2)}`),
      ];
      return lines.filter(l => l !== null).join('\n');
    };

    const handleCopy = () => {
      Clipboard.setString(buildOrderText());
      Alert.alert('✅ Copied', 'Shipment details copied to clipboard!');
    };

    const handleShare = async () => {
      try { await Share.share({ message: buildOrderText() }); } catch (e) { /* dismissed */ }
    };

    const shipmentDetailsTable = [
      { l: 'Carrier',   v: carrierName },
      { l: 'Mode',      v: modeName },
      { l: 'TAT',       v: o.TAT || '—' },
      { l: 'Zone',      v: o.ZONE || '—' },
      { l: 'Wt(kg)',    v: o.WEIGHT || '—' },
      { l: 'ChgWt(kg)', v: o.CHG_WT || o.WEIGHT || '—' },
      { l: 'Pcs',       v: o.PIECS || o.PIECES || '1' },
      { l: 'Value',     v: o.VALUE ? `₹${o.VALUE}` : '—' },
      { l: 'COD',       v: o.COD && parseFloat(o.COD) > 0 ? `₹${o.COD}` : 'No' },
      { l: 'ToPay',     v: o.TOPAY || 'No' },
      { l: 'FOV',       v: o.FOV || 'No' },
      { l: 'Global',    v: o.GLOBAL || 'No' },
    ];

    const hasNoSubData = products.length === 0 && boxes.length === 0 && uploads.length === 0;

    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <View style={styles.navBackGroup}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentView('list')}>
              <Text style={styles.backBtnText}>‹ List</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setSelectedOrder(null); setCurrentView('tiles'); }}>
              <Text style={styles.backBtnText}>‹ Tiles</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.navTitle} numberOfLines={1}>Ref: {o.REFERENCE}</Text>
        </View>

        {/* ── CARD 1: Document Center ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Document Center</Text>
            <View style={styles.actionIconGroup}>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => openUpload(o)} title="Upload">
                <UploadIcon size={14} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={toggleLabelLayout} title="Toggle Layout">
                <LayoutIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => printAllDocs(o)} title="Print All">
                <PrintIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => downloadAllDocs(o)} title="Download All">
                <DownloadIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => mailShipment(o)} title="Mail All">
                <MailIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => waShipment(o)} title="WhatsApp All">
                <WhatsAppIcon size={14} color="#25D366" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.docRowsDivide}>
            {DOC_CENTER_ITEMS.map((item, idx) => (
              <View key={idx} style={styles.docRowItem}>
                <Text style={styles.docRowLabel}>{item.label}</Text>
                <View style={styles.docRowActionBtns}>
                  <TouchableOpacity style={styles.docItemBtn} onPress={() => printDoc(o, item.label)}>
                    <PrintIcon size={13} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.docItemBtn} onPress={() => mailDoc(o, item.label)}>
                    <MailIcon size={13} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.docItemBtn} onPress={() => downloadDoc(o, item.label)}>
                    <DownloadIcon size={13} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.docItemBtn, { backgroundColor: '#dcfce7' }]} onPress={() => waDoc(o, item.label)}>
                    <WhatsAppIcon size={13} color="#25D366" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── CARD 2: Shipment Details Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Shipment Details</Text>
            <View style={styles.actionIconGroup}>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#e0f2fe' }]} onPress={() => setUpdateStatusTargetOrder(o)} title="Update Status">
                <CheckmarkCircleIcon size={14} color="#0284c7" />
              </TouchableOpacity>
              {!o.INV_NUMBER && (
                <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => (onEditOrder ? onEditOrder({ ...o, boxes: multiboxMap[o.REFERENCE] || [], products: productsMap[o.REFERENCE] || [] }) : toast('Edit', 'Edit order ' + o.REFERENCE))} title="Edit">
                  <EditIcon size={14} color="#64748b" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={handleCopy} title="Copy">
                <CopyIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={handleShare} title="Share">
                <ShareIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => mailShipment(o)} title="Email">
                <MailIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => waShipment(o)} title="WhatsApp">
                <WhatsAppIcon size={14} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#fef2f2' }]} onPress={() => deleteOrder(o)} title="Delete">
                <DeleteIcon size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.webTableGrid}>
            {shipmentDetailsTable.map((item, idx) => (
              <View key={idx} style={styles.webTableCellRow}>
                <View style={styles.webTableCellLabelBox}>
                  <Text style={styles.webTableCellLabelText}>{item.l}</Text>
                </View>
                <View style={styles.webTableCellValueBox}>
                  <Text style={styles.webTableCellValueText}>{item.v}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── CARD 3: Consignor Details ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Consignor Details</Text>
          </View>
          <DetailRow label="Name" value={cnorName} />
          <DetailRow label="City" value={cnorCity} />
          <DetailRow label="Pincode" value={cnorPin} />
          <DetailRow label="State" value={cnorState} />
          <DetailRow label="Address" value={cnorAddr} />
          <DetailRow label="Mobile" value={cnorMob} />
        </View>

        {/* ── CARD 4: Consignee Details ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Consignee Details</Text>
          </View>
          <DetailRow label="Name" value={cneeName} />
          <DetailRow label="City" value={cneeCity} />
          <DetailRow label="Pincode" value={cneePin} />
          <DetailRow label="State" value={cneeState} />
          <DetailRow label="Address" value={cneeAddr} />
          <DetailRow label="Mobile" value={cneeMob} />
        </View>

        {/* ── CARD 5: Product, Box & Upload Details ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Product, Box & Upload Details</Text>
            <View style={styles.actionIconGroup}>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => openUpload(o)} title="Upload File">
                <UploadIcon size={14} color="#16a34a" />
              </TouchableOpacity>
              {uploads.length > 0 && (
                <>
                  <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => mailShipmentUploads(o)} title="Mail All">
                    <MailIcon size={14} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => waShipmentUploads(o)} title="WhatsApp All">
                    <WhatsAppIcon size={14} color="#25D366" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {hasNoSubData ? (
            <Text style={styles.noSubDataText}>No product, box, or upload details.</Text>
          ) : (
            <View>
              {/* Product Section */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.subSectionHeader}>Product</Text>
                {products.length === 0 ? (
                  <Text style={styles.noneText}>None</Text>
                ) : (
                  products.map((p, pi) => (
                    <View key={pi} style={styles.subItemBox}>
                      <Text style={styles.subItemTitle}>{p.PRODUCT || 'N/A'}</Text>
                      <View style={styles.subItemDetailRow}>
                        <Text style={styles.subItemLabel}>Doc#:</Text>
                        <Text style={styles.subItemValue}>{p.DOC_NUMBER || 'N/A'}</Text>
                      </View>
                      <View style={styles.subItemDetailRow}>
                        <Text style={styles.subItemLabel}>EWay:</Text>
                        <Text style={styles.subItemValue}>{p.EWAY_IF || 'N/A'}</Text>
                      </View>
                      <View style={styles.subItemDetailRow}>
                        <Text style={styles.subItemLabel}>Amt:</Text>
                        <Text style={styles.subItemValue}>{parseFloat(p.AMOUNT || 0).toFixed(2)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* MultiBox Section */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.subSectionHeader}>MultiBox</Text>
                {boxes.length === 0 ? (
                  <Text style={styles.noneText}>None</Text>
                ) : (
                  boxes.map((b, bi) => {
                    const lbh = `${parseFloat(b.LENGTH) || 0}*${parseFloat(b.BREADTH) || 0}*${parseFloat(b.HIGHT) || 0}`;
                    return (
                      <View key={bi} style={styles.subItemBox}>
                        <Text style={styles.subItemTitle}>Box#: {b.BOX_NUM || 'N/A'}</Text>
                        <View style={styles.subItemDetailRow}>
                          <Text style={styles.subItemLabel}>Weight:</Text>
                          <Text style={styles.subItemValue}>{b.WEIGHT || 0}</Text>
                        </View>
                        <View style={styles.subItemDetailRow}>
                          <Text style={styles.subItemLabel}>L*B*H:</Text>
                          <Text style={styles.subItemValue}>{lbh}</Text>
                        </View>
                        <View style={styles.subItemDetailRow}>
                          <Text style={styles.subItemLabel}>Chg Wt:</Text>
                          <Text style={styles.subItemValue}>{parseFloat(b.CHG_WT || 0).toFixed(2)}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Uploads Section */}
              <View>
                <Text style={styles.subSectionHeader}>Uploads</Text>
                {uploads.length === 0 ? (
                  <Text style={styles.noneText}>None</Text>
                ) : (
                  uploads.map((up, ui) => {
                    const ud = fmtDate(up.TIME_STAMP, 'full');
                    const idt = up.AWB_NUMBER || up.KYC_NUMBER || up.REFERENCE;
                    let det = up.STATUS_REMARK || 'N/A';
                    if (up.UPLOAD_TYPE === 'MultiBox') det = `Child:${up.CHILD_AWB || 'N/A'}`;
                    else if (up.UPLOAD_TYPE === 'KYC') det = `${up.CUSTOMER_UID || 'N/A'}(${up.KYC_TYPE || 'N/A'})`;
                    else if (up.UPLOAD_TYPE === 'Product') det = `${up.DOC_NUMBER || 'N/A'}(${up.DOC_TYPE || 'N/A'})`;

                    return (
                      <View key={ui} style={styles.uploadItemBox}>
                        <View style={styles.subItemHeaderRow}>
                          <Text style={styles.uploadTypeTitle}>{up.UPLOAD_TYPE || 'Upload'}</Text>
                          <Text style={styles.uploadDateText}>{ud}</Text>
                        </View>
                        <View style={styles.subItemDetailRow}>
                          <Text style={styles.subItemLabel}>ID:</Text>
                          <Text style={styles.subItemValue}>{idt || 'N/A'}</Text>
                        </View>
                        <View style={styles.subItemDetailRow}>
                          <Text style={styles.subItemLabel}>Details:</Text>
                          <Text style={styles.subItemValue}>{det}</Text>
                        </View>

                        <View style={styles.uploadActionRow}>
                          {up.FILE_URL ? (
                            <>
                              <TouchableOpacity style={styles.uploadActionBtn} onPress={() => openUploadViewer(up, `${up.UPLOAD_TYPE || 'Upload'} — ${o.AWB_NUMBER || o.REFERENCE}`)}>
                                <EyeIcon size={13} color="#0284c7" />
                                <Text style={styles.uploadActionBtnText}>View</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.uploadActionBtn} onPress={() => downloadUploadNative(resolveFileUrl(up.FILE_URL), `${up.UPLOAD_TYPE || 'Upload'}_${o.AWB_NUMBER || o.REFERENCE}`)}>
                                <DownloadIcon size={13} color="#0284c7" />
                                <Text style={styles.uploadActionBtnText}>Download</Text>
                              </TouchableOpacity>
                            </>
                          ) : null}
                          <TouchableOpacity style={[styles.uploadActionBtn, { borderColor: '#fca5a5' }]} onPress={() => deleteUpload(up)}>
                            <DeleteIcon size={13} color="#ef4444" />
                            <Text style={[styles.uploadActionBtnText, { color: '#ef4444' }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── CARD 6: Tracking Status (Implanted API call, AT END) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardTitle}>Tracking Status</Text>
              <View style={[styles.stateBadge, { backgroundColor: stateCfg.bg }]}>
                <Text style={[styles.stateBadgeText, { color: stateCfg.color }]}>{stateCfg.label}</Text>
              </View>
            </View>
            <View style={styles.actionIconGroup}>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => mailShipmentTracking(o)} title="Mail">
                <MailIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => waShipmentTracking(o)} title="WhatsApp">
                <WhatsAppIcon size={14} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => fetchTrackingHistory(o.REFERENCE, true)} title="Refresh Live Tracking">
                <RefreshIcon size={14} color="#64748b" />
              </TouchableOpacity>
              {shipment.pod_image ? (
                <TouchableOpacity
                  style={[styles.docHeaderActionBtn, { backgroundColor: '#e0e7ff' }]}
                  onPress={() => openUploadViewer(shipment.pod_image, `POD — ${o.AWB_NUMBER || o.REFERENCE}`)}
                  title="Show POD Image"
                >
                  <EyeIcon size={14} color="#4f46e5" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {trackingLoading && (
            <View style={{ paddingVertical: 10, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Fetching live tracking...</Text>
            </View>
          )}

          <View style={styles.webTableGrid}>
            <View style={styles.webTableCellRow}>
              <View style={styles.webTableCellLabelBox}>
                <Text style={styles.webTableCellLabelText}>AWB Number</Text>
              </View>
              <View style={styles.webTableCellValueBox}>
                <Text style={styles.webTableCellValueText}>{o.AWB_NUMBER || shipment.awb_number || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.webTableCellRow}>
              <View style={styles.webTableCellLabelBox}>
                <Text style={styles.webTableCellLabelText}>Order Date</Text>
              </View>
              <View style={styles.webTableCellValueBox}>
                <Text style={styles.webTableCellValueText}>{formattedOrderDate}</Text>
              </View>
            </View>
            <View style={styles.webTableCellRow}>
              <View style={styles.webTableCellLabelBox}>
                <Text style={styles.webTableCellLabelText}>Transit Date</Text>
              </View>
              <View style={styles.webTableCellValueBox}>
                <Text style={styles.webTableCellValueText}>{formattedTransitDate}</Text>
              </View>
            </View>
            <View style={styles.webTableCellRow}>
              <View style={styles.webTableCellLabelBox}>
                <Text style={styles.webTableCellLabelText}>Doc Date</Text>
              </View>
              <View style={styles.webTableCellValueBox}>
                <Text style={styles.webTableCellValueText}>{formattedInvoiceDate}</Text>
              </View>
            </View>

            {shipment.status_raw ? (
              <View style={[styles.webTableCellRow, { width: '100%' }]}>
                <View style={[styles.webTableCellLabelBox, { width: '25%' }]}>
                  <Text style={styles.webTableCellLabelText}>Status Raw</Text>
                </View>
                <View style={[styles.webTableCellValueBox, { width: '75%' }]}>
                  <Text style={styles.webTableCellValueText}>{shipment.status_raw}</Text>
                </View>
              </View>
            ) : null}

            {shipment.carrier_origin ? (
              <View style={styles.webTableCellRow}>
                <View style={styles.webTableCellLabelBox}>
                  <Text style={styles.webTableCellLabelText}>Origin</Text>
                </View>
                <View style={styles.webTableCellValueBox}>
                  <Text style={styles.webTableCellValueText}>{shipment.carrier_origin}</Text>
                </View>
              </View>
            ) : null}

            {shipment.carrier_destination ? (
              <View style={styles.webTableCellRow}>
                <View style={styles.webTableCellLabelBox}>
                  <Text style={styles.webTableCellLabelText}>Destination</Text>
                </View>
                <View style={styles.webTableCellValueBox}>
                  <Text style={styles.webTableCellValueText}>{shipment.carrier_destination}</Text>
                </View>
              </View>
            ) : null}

            {shipment.booked_date ? (
              <View style={styles.webTableCellRow}>
                <View style={styles.webTableCellLabelBox}>
                  <Text style={styles.webTableCellLabelText}>Booked</Text>
                </View>
                <View style={styles.webTableCellValueBox}>
                  <Text style={styles.webTableCellValueText}>{shipment.booked_date}</Text>
                </View>
              </View>
            ) : null}

            {shipment.additional_info ? (
              <View style={[styles.webTableCellRow, { width: '100%' }]}>
                <View style={[styles.webTableCellLabelBox, { width: '25%' }]}>
                  <Text style={styles.webTableCellLabelText}>Info</Text>
                </View>
                <View style={[styles.webTableCellValueBox, { width: '75%' }]}>
                  <Text style={styles.webTableCellValueText}>{shipment.additional_info}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── CARD 7: Tracking History / Movements (Implanted API call, AT END) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Tracking History</Text>
          </View>

          {movements.length === 0 ? (
            <Text style={styles.noSubDataText}>
              {trackingLoading ? 'Loading movement history...' : 'No movement history available.'}
            </Text>
          ) : (
            movements.map((m, mi) => (
              <View key={mi} style={styles.movementItemCard}>
                <Text style={styles.movementActivityText}>{m.activity || m.STATUS_REMARK || 'N/A'}</Text>
                <Text style={styles.movementDateText}>
                  {[m.date || m.DATE, m.time || m.TIME].filter(Boolean).join(' ')}
                </Text>
                {(m.location || m.LOCATION) ? (
                  <Text style={styles.movementLocationText}>📍 {m.location || m.LOCATION}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* ── Mini-uploader adapter (web mini-uploader.setReference parity) ── */}
        <Modal
          visible={uploadVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeUpload}
        >
          <UploaderScreen
            orders={uploadTarget ? [uploadTarget] : []}
            b2b2cMap={b2b2cMap}
            productsMap={productsMap}
            uploadsMap={uploadsMap}
            token={token}
            apiBase={apiBase}
            role={role}
            enforceRoleRestrictions
            hiddenTypes={['KYC']}
            initialOrder={uploadTarget}
            modalMode
            onClose={closeUpload}
            onRefresh={onRefresh}
          />
        </Modal>

        <UploadViewer
          visible={podImageUrl !== null}
          uri={podImageUrl}
          title={podViewerTitle}
          isPdf={podViewerIsPdf}
          onClose={() => setPodImageUrl(null)}
        />

      </ScrollView>
    );
  }

  return null;
};

return (
  <View style={{ flex: 1 }}>
    {renderContent()}
    <UpdateStatusModal
      visible={updateStatusTargetOrder !== null}
      onClose={() => setUpdateStatusTargetOrder(null)}
      order={updateStatusTargetOrder}
      token={token}
      apiBase={apiBase}
      role={role}
      onSuccess={(ref, statusRaw) => {
        if (onRefresh) onRefresh();
      }}
    />
  </View>
);
}

// ── Web Shipment List Item ─────────────────────────────────────────────────────
function WebShipmentListItem({ order, b2b2cMap, shipmentsMap = {}, isSelected, onPress }) {
  const ref = order.REFERENCE || 'N/A';
  const awb = order.AWB_NUMBER || 'No AWB';

  const cnorObj = b2b2cMap[order.CONSIGNOR] || {};
  const cneeObj = b2b2cMap[order.CONSIGNEE] || {};

  const cnor = cnorObj.NAME || order.CONSIGNOR || 'Unknown';
  const cnee = cneeObj.NAME || order.CONSIGNEE || 'Unknown';

  // Web parity — state badge from the SHIPMENTS sheet first (shipmentsDataMap)
  const shipState = shipmentsMap[order.REFERENCE];
  const stateRaw = normalizeShipmentState(shipState?.state || shipState?.STATE || order.STATE || order.state || 'pending');
  const stateCfg = STATE_CONFIG[stateRaw] || STATE_CONFIG.pending;
  const dateStr = fmtDate(order.ORDER_DATE || order.TIME_STAMP, 'display');

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.webListItem,
        isSelected && styles.webListItemSelected
      ]}
    >
      <Text style={styles.webListItemAwb}>{awb}</Text>
      <Text style={styles.webListItemSub} numberOfLines={1}>
        {cnor} ➔ {cnee}
      </Text>
      <View style={styles.webListItemMeta}>
        <Text style={styles.webListItemRefDate}>
          Ref: {ref} | {dateStr}
        </Text>
        <View style={[styles.stateBadge, { backgroundColor: stateCfg.bg }]}>
          <Text style={[styles.stateBadgeText, { color: stateCfg.color }]}>
            {stateCfg.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }) {
  if (!value || String(value).trim() === '' || String(value).trim() === 'N/A') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}:</Text>
      <Text style={styles.detailRowValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },

  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  pageSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  searchInput: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1.5, borderColor: '#cbd5e1', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontWeight: '600', marginBottom: 12 },

  // Stage 1: Tiles Grid View
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  gridTile: { width: '48%', borderRadius: 12, borderWidth: 1.5, padding: 14, alignItems: 'center', justifyContent: 'center' },
  gridTileIcon: { fontSize: 24, marginBottom: 4 },
  gridTileCount: { fontSize: 20, fontWeight: '900' },
  gridTileLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 4, color: '#475569', textAlign: 'center', letterSpacing: 0.5 },

  // Stage 2 & 3 Nav Bar
  navHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  navBackGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  backBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  navTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', flex: 1 },

  // Assign Carrier tile view
  assignLayout: { flex: 1, flexDirection: 'row', gap: 10 },
  assignLayoutCompact: { flexDirection: 'column' },
  assignListPane: { flex: 1, minWidth: 220, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  assignListPaneCompact: { minWidth: 0, flex: 1, maxHeight: undefined },
  assignFormPane: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  assignFormPaneCompact: { minHeight: 0, flex: 1 },
  assignFormContent: { padding: 14, paddingBottom: 30 },
  assignList: { flex: 1 },
  assignListSummary: { color: '#64748b', fontSize: 10, fontWeight: '700', marginBottom: 8 },
  assignItem: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 7, backgroundColor: '#fff' },
  assignItemIncomplete: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  assignItemSelected: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  assignItemAwb: { color: '#0f172a', fontSize: 12, fontWeight: '900' },
  assignItemRoute: { color: '#334155', fontSize: 10, fontWeight: '700', marginTop: 3 },
  assignItemMeta: { color: '#64748b', fontSize: 9, marginTop: 3 },
  assignItemCarrier: { color: '#0369a1', fontSize: 10, fontWeight: '800', marginTop: 3 },
  assignFormTitle: { color: '#1e293b', fontSize: 17, fontWeight: '900' },
  assignFormRef: { color: '#64748b', fontSize: 11, marginTop: 3, marginBottom: 14 },
  assignLabel: { color: '#475569', fontSize: 11, fontWeight: '800', marginTop: 8, marginBottom: 5 },
  assignInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, color: '#0f172a', fontSize: 12 },
  assignChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  assignChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#f8fafc' },
  assignChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  assignChipText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  assignChipTextActive: { color: '#fff' },
  assignMessage: { marginTop: 12, padding: 8, borderRadius: 6, fontSize: 11, fontWeight: '700' },
  assignMessageError: { color: '#b91c1c', backgroundColor: '#fef2f2' },
  assignMessageSuccess: { color: '#166534', backgroundColor: '#f0fdf4' },
  assignSubmit: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 7, paddingVertical: 10, alignItems: 'center' },
  assignSubmitText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  assignBackToListBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f1f5f9', borderRadius: 6, alignSelf: 'flex-start' },
  assignBackToListBtnText: { color: '#0284c7', fontSize: 12, fontWeight: '800' },

  searchFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  filterIconBtn: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center' },
  filterIconBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterIconBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterIconBtnTextActive: { color: '#ffffff' },

  activePillsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 },
  activePill: { fontSize: 10, fontWeight: '700', color: COLORS.primary, backgroundColor: '#fff8f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5' },
  clearPillsText: { fontSize: 10.5, fontWeight: '700', color: '#64748b', marginLeft: 4 },

  // Web List Item
  webListItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  webListItemSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
    borderLeftWidth: 4,
  },
  webListItemAwb: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
  },
  webListItemSub: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 6,
  },
  webListItemMeta: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  webListItemRefDate: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  stateBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  stateBadgeText: { fontSize: 10, fontWeight: '700' },

  // Stage 3 Detail View Cards
  card: { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },

  docHeaderActionBtn: { backgroundColor: '#f8fafc', padding: 5, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  actionIconGroup: { flexDirection: 'row', gap: 4 },

  docRowsDivide: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  docRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  docRowLabel: { fontSize: 12, fontWeight: '700', color: '#334155', width: 90 },
  docRowActionBtns: { flexDirection: 'row', gap: 6 },
  docItemBtn: { backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },

  // Web Table Grid
  webTableGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, overflow: 'hidden' },
  webTableCellRow: { width: '50%', flexDirection: 'row', borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#e2e8f0' },
  webTableCellLabelBox: { width: '50%', backgroundColor: '#f8fafc', padding: 6, borderRightWidth: 0.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  webTableCellLabelText: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  webTableCellValueBox: { width: '50%', backgroundColor: '#ffffff', padding: 6, justifyContent: 'center' },
  webTableCellValueText: { fontSize: 10.5, fontWeight: '700', color: '#1e293b' },

  noSubDataText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 4 },
  loadingText: { fontSize: 11, color: '#64748b', marginTop: 4 },
  noneText: { fontSize: 11, color: '#94a3b8' },
  subSectionHeader: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  subItemBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  subItemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subItemTitle: { fontSize: 12.5, fontWeight: '800', color: '#1e293b' },
  subItemDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  subItemLabel: { fontSize: 11, color: '#64748b' },
  subItemValue: { fontSize: 11, fontWeight: '700', color: '#1e293b' },

  uploadItemBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  uploadTypeTitle: { fontSize: 13, fontWeight: '800', color: '#0369a1' },
  uploadDateText: { fontSize: 10, color: '#64748b' },
  uploadActionRow: { flexDirection: 'row', gap: 6, marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0', justifyContent: 'flex-end' },
  uploadActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f0f9ff' },
  uploadActionBtnText: { fontSize: 10.5, fontWeight: '700', color: '#0284c7' },

  // Tracking Movements Timeline Card
  movementItemCard: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  movementActivityText: { fontSize: 12.5, fontWeight: '800', color: '#1e293b' },
  movementDateText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  movementLocationText: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 2 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailRowLabel: { fontSize: 11.5, fontWeight: '600', color: '#64748b' },
  detailRowValue: { fontSize: 12, fontWeight: '700', color: '#1e293b', flexShrink: 1, textAlign: 'right', marginLeft: 10 },

  emptyBox: { alignItems: 'center', padding: 30 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },

  // TAT Quick Filters (web _renderTatQuickFilters parity)
  tatPillsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tatPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', opacity: 0.7 },
  tatPillActive: { opacity: 1, borderColor: COLORS.primary, backgroundColor: '#fff8f6' },
  tatPillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  tatPillTextActive: { color: COLORS.primary },

  defaultViewNote: { fontSize: 10.5, color: '#64748b', fontStyle: 'italic', marginBottom: 8 },

  // POD Image Viewer (web _showPodImage parity)
  podModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  podModalClose: { position: 'absolute', top: 46, right: 16, zIndex: 2, backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  podModalCloseText: { fontSize: 13, fontWeight: '800', color: '#b91c1c' },
  podImage: { width: '94%', height: '72%' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: '100%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  modalCloseX: { fontSize: 20, fontWeight: '700', color: '#64748b', padding: 4 },

  filterSectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#ffffff' },

  dateInputsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 6 },
  dateInputLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 2 },
  calendarTriggerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 10, paddingVertical: 8 },
  calendarTriggerText: { fontSize: 12, fontWeight: '700', color: '#0284c7' },

  // Calendar Modal Picker
  calendarModalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, width: '90%', maxWidth: 340, borderWidth: 1, borderColor: '#cbd5e1' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  calendarMonthTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  calNavBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  calNavBtnText: { fontSize: 18, fontWeight: '800', color: '#475569' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  calWeekDayText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#94a3b8' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  calDayBox: { width: '14.28%', height: 36, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  calDayBoxActive: { backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
  calDayText: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
  calDayTextEmpty: { color: 'transparent' },
  calCancelBtn: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', alignItems: 'center' },
  calCancelBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  resetModalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  resetModalBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  applyModalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  applyModalBtnText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },

  // Upload Modal (web mini-uploader)
  uploadModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  uploadModalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, width: '92%', maxWidth: 380, borderWidth: 1, borderColor: '#cbd5e1' },
  uploadModalTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  uploadModalRef: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 12 },
  uploadModalLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  uploadTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploadTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  uploadTypeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  uploadTypeChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  uploadTypeChipTextActive: { color: '#ffffff' },
});
