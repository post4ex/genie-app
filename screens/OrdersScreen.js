import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Modal, Alert, Clipboard, Linking, ActivityIndicator, Share, Platform, BackHandler,
  useWindowDimensions
} from 'react-native';
import { COLORS } from '../styles/theme';
import { getSheet, deleteFromSheet } from '../core/storage';
import { fmtDate, parseDate } from '../utils/formatIST';
import * as docgen from '../utils/docgen.js';
import * as Print from 'expo-print';
import { UploadViewer, resolveUploadUri, isPdfUpload, downloadUploadNative, shareUploadNative } from '../utils/upload-viewer';
import UploaderScreen from './UploaderScreen';
import { useToast } from '../components/Toast';
import { shareViewAsImage } from '../utils/capture';
import UpdateStatusModal from '../components/UpdateStatusModal';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar';
import FilterModal from '../components/FilterModal';
import ListItem from '../components/ListItem';
import { accentSparkle } from '../components/Tile';
import Icon, { GradientGlyph, GradientIcon } from '../components/icons';
import GradientText from '../components/GradientText';
import Tray from '../components/Tray';
import DocCenterPane from '../components/DocCenterPane';
import ShipmentDetailsPane from '../components/ShipmentDetailsPane';
import TrackingPane from '../components/TrackingPane';
import PartiesPane from '../components/PartiesPane';
import PackagingsPane from '../components/PackagingsPane';
import { LinearGradient } from 'expo-linear-gradient';

// ── Shipment Tiles (Total → Delivered → OFD → In Transit → TATs → …) ──────────
// Per-tile identity: bold MaterialCommunityIcons glyph painted in the tile's
// gradient, plus a soft web-matching tint + border for the card.
// (Assign Carrier moves to the Scans screen; Reports is a utility tile.)
const TILES = [
  { id: 'all',          label: 'Total',            icon: 'package-variant-closed', grad: ['#64748b', '#475569'], bg: '#f8fafc', border: '#e2e8f0' },
  { id: 'delivered',    label: 'Delivered',        icon: 'check-circle',          grad: ['#16a34a', '#22c55e'], bg: '#f0fdf4', border: '#86efac' },
  { id: 'ofd',          label: 'Out for Delivery', icon: 'truck-fast',            grad: ['#3b82f6', '#06b6d4'], bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'intransit',    label: 'In Transit',       icon: 'truck-delivery',        grad: ['#f59e0b', '#d97706'], bg: '#fffbeb', border: '#fde68a' },
  { id: 'tat',          label: 'TAT Due (3 Days)', icon: 'timer-outline',         grad: ['#ef4444', '#dc2626'], bg: '#fef2f2', border: '#fca5a5' },
  { id: 'overduetat',   label: 'Overdue TAT',      icon: 'timer-sand',            grad: ['#ef4444', '#f97316'], bg: '#fef2f2', border: '#fecaca' },
  { id: 'exceptions',   label: 'Exceptions',       icon: 'alert',                 grad: ['#f43f5e', '#ef4444'], bg: '#fff1f1', border: '#fecaca' },
  { id: 'topay',        label: 'To Pay',           icon: 'cash',                  grad: ['#f59e0b', '#ea580c'], bg: '#fffbeb', border: '#fde68a' },
  { id: 'cod',          label: 'COD',              icon: 'credit-card',           grad: ['#8b5cf6', '#6d28d9'], bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'new-bookings', label: 'New Bookings',     icon: 'calendar-month',        grad: ['#ca8a04', '#f59e0b'], bg: '#fefce8', border: '#fde047' },
  { id: 'heavy',        label: 'Heavy (>25 kg)',   icon: 'weight-lifter',         grad: ['#059669', '#10b981'], bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'highvalue',    label: 'High Value (>1L)', icon: 'diamond-stone',         grad: ['#1d4ed8', '#3b82f6'], bg: '#eff6ff', border: '#93c5fd' },
  { id: 'fov',          label: 'FOV',              icon: 'file-document',         grad: ['#0d9488', '#14b8a6'], bg: '#f0fdf4', border: '#99f6e4' },
  { id: 'reports',      label: 'Reports',          icon: 'chart-bar',             grad: ['#6366f1', '#8b5cf6'], bg: '#f5f3ff', border: '#ddd6fe' },
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

// Full-name option lists for the filter dropdowns (cool, human-readable).
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'outfordelivery', label: 'Out for Delivery' },
  { value: 'intransit', label: 'In Transit' },
  { value: 'exception', label: 'Exception' },
  { value: 'pending', label: 'Pending' },
];
const PAY_OPTIONS = [
  { value: 'ALL', label: 'All Payment Modes' },
  { value: 'TOPAY', label: 'To Pay' },
  { value: 'COD', label: 'Cash on Delivery' },
  { value: 'PREPAID', label: 'Prepaid' },
];
const optionLabel = (options, v) => (options.find(o => o.value === v) || {}).label || v;

export default function OrdersScreen({
  orders = [], searchQuery, setSearchQuery, refreshing, onRefresh,
  b2b2cMap = {}, b2bList = [], carriersMap = {}, modesMap = {}, productsMap = {}, multiboxMap = {}, uploadsMap = {}, shipmentsMap = {},
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

  // Tracking API State
  const [liveTracking, setLiveTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [podImageUrl, setPodImageUrl] = useState(null); // Active upload viewer URI
  const [podViewerTitle, setPodViewerTitle] = useState('Upload preview');
  const [podViewerIsPdf, setPodViewerIsPdf] = useState(false);
  const [tatQuickFilter, setTatQuickFilter] = useState(null); // 'delivered' | 'outfordelivery' | 'intransit' | null
  const [updateStatusTargetOrder, setUpdateStatusTargetOrder] = useState(null);

  // Scroll preservation refs & effect
  const flatListRef = useRef(null);
  const listScrollOffsetRef = useRef(0);

  useEffect(() => {
    if (currentView === 'list' && listScrollOffsetRef.current > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: listScrollOffsetRef.current,
          animated: false,
        });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

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

  // ── Advanced filters (status/branch/code/carrier/pay-mode/search) ──
  // Shared by the list view AND the tile counts, so the tiles live-update as
  // filters are applied. Date bounds are excluded here on purpose: the list
  // adds the implicit month-start default, the tiles apply only explicit dates.
  const matchAdvancedFilters = (o) => {
    const state = getOrderState(o);
    if (filterStatus !== 'ALL' && state !== filterStatus) return false;
    // Web uses exact option values for these three dynamically populated
    // selects; do not silently merge distinct backend codes by case.
    if (filterBranch !== 'ALL' && String(o.BRANCH ?? '') !== filterBranch) return false;
    if (filterCode !== 'ALL' && String(o.CODE ?? '') !== filterCode) return false;
    if (filterCarrier !== 'ALL' && String(o.CARRIER ?? '') !== filterCarrier) return false;
    if (filterPayMode === 'TOPAY' && o.TOPAY !== 'Yes') return false;
    if (filterPayMode === 'COD' && (!o.COD || parseFloat(o.COD) <= 0)) return false;
    if (filterPayMode === 'PREPAID' && (o.TOPAY === 'Yes' || (o.COD && parseFloat(o.COD) > 0))) return false;

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
  };

  // Base set the tiles count on: advanced filters + explicit dates only
  // (no implicit month start, no tile predicate).
  const tileBaseOrders = useMemo(() => {
    const startMs = filterStartDate ? new Date(filterStartDate + 'T00:00:00Z').getTime() : 0;
    const endMs = filterEndDate ? new Date(filterEndDate + 'T23:59:59Z').getTime() : 0;
    return orders.filter(o => {
      if (!matchAdvancedFilters(o)) return false;
      const orderDate = parseDate(o.ORDER_DATE);
      if (startMs || endMs) {
        if (!orderDate) return false;
        if (startMs && orderDate.getTime() < startMs) return false;
        if (endMs && orderDate.getTime() > endMs) return false;
      }
      return true;
    });
  }, [orders, filterStatus, filterBranch, filterCode, filterCarrier, filterPayMode,
    filterStartDate, filterEndDate, searchQuery, b2b2cMap, shipmentsMap]);

  const tileCounts = useMemo(() => {
    const counts = { all: tileBaseOrders.length, topay: 0, cod: 0, tat: 0, overduetat: 0, heavy: 0, highvalue: 0, exceptions: 0, ofd: 0, 'new-bookings': 0, fov: 0, delivered: 0, intransit: 0 };

    tileBaseOrders.forEach(o => {
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
      if (state === 'intransit') counts.intransit++;
      if (_isNewBooking(o)) counts['new-bookings']++;
      if (o.FOV === 'Yes' && !isDelivered) counts.fov++;
    });

    return counts;
  }, [tileBaseOrders]);

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

  // Full-name dropdown options — branch/carrier resolve their names from the
  // master maps (with the code kept as a muted sublabel).
  const branchFilterOptions = useMemo(() => filterBranchOptions.map(v => {
    if (v === 'ALL') return { value: 'ALL', label: 'All Branches' };
    const b = branchesMap[v];
    const name = (typeof b === 'string' ? b : (b?.BRANCH_NAME || b?.NAME)) || '';
    return { value: v, label: name || v, sublabel: name ? v : undefined };
  }), [filterBranchOptions, branchesMap]);
  // Client-name lookup — the order's CODE is the B2B customer's CODE || UID
  // (see BookOrderScreen), and the names live in the B2B customers list
  // (b2bList), NOT the b2b2c contacts map. Index every customer by
  // CODE and UID so the dropdown always resolves the display name.
  const clientNameByCode = useMemo(() => {
    const map = {};
    (Array.isArray(b2bList) ? b2bList : Object.values(b2bList || {})).forEach(c => {
      const name = (typeof c === 'string' ? c : (c?.B2B_NAME || c?.NAME)) || '';
      for (const k of [c?.CODE, c?.UID]) {
        if (k) map[k] = map[k] || name;
      }
    });
    return map;
  }, [b2bList]);

  // Client dropdown — filtering stays on the order's CODE, but the dropdown
  // displays the client's name (B2B name) with the code as a muted sublabel.
  const codeFilterOptions = useMemo(() => filterCodeOptions.map(v => {
    if (v === 'ALL') return { value: 'ALL', label: 'All Clients' };
    const name = clientNameByCode[v] || '';
    return { value: v, label: name || v, sublabel: name ? v : undefined };
  }), [filterCodeOptions, clientNameByCode]);
  const carrierFilterOptions = useMemo(() => filterCarrierOptions.map(v => {
    if (v === 'ALL') return { value: 'ALL', label: 'All Carriers' };
    const c = carriersMap[v];
    const name = (typeof c === 'string' ? c : (c?.COMPANY_NAME || c?.NAME)) || '';
    return { value: v, label: name || v, sublabel: name ? v : undefined };
  }), [filterCarrierOptions, carriersMap]);
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
      if (selectedTile === 'intransit' && state !== 'intransit') return false;
      if (selectedTile === 'fov' && (o.FOV !== 'Yes' || isDelivered)) return false;
      if (selectedTile === 'new-bookings' && !_isNewBooking(o)) return false;
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

      // ── Advanced filters + search (shared with tile counts) ──
      if (!matchAdvancedFilters(o)) return false;

      // ── Date range (web applyFilters parity) ──
      const orderDate = parseDate(o.ORDER_DATE);
      // Web excludes records with an invalid/missing ORDER_DATE even when the
      // user has supplied another filter and no date range.
      if (!orderDate) return false;
      if (startMs && orderDate.getTime() < startMs) return false;
      if (endMs && (!orderDate || orderDate.getTime() > endMs)) return false;
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

  const activeFilterCount = [filterStatus, filterBranch, filterCode, filterCarrier, filterPayMode]
    .filter(v => v !== 'ALL').length + ((filterStartDate || filterEndDate) ? 1 : 0);

  // Active-filter pills — shared by the tiles and list views.
  const activeFilterPills = [
    ...(filterStatus !== 'ALL' ? [`Status: ${optionLabel(STATUS_OPTIONS, filterStatus)}`] : []),
    ...(filterBranch !== 'ALL' ? [`Branch: ${optionLabel(branchFilterOptions, filterBranch)}`] : []),
    ...(filterCode !== 'ALL' ? [`Code: ${optionLabel(codeFilterOptions, filterCode)}`] : []),
    ...(filterCarrier !== 'ALL' ? [`Carrier: ${optionLabel(carrierFilterOptions, filterCarrier)}`] : []),
    ...(filterPayMode !== 'ALL' ? [`Pay: ${optionLabel(PAY_OPTIONS, filterPayMode)}`] : []),
    ...((filterStartDate || filterEndDate) ? [`Date: ${filterStartDate || '...'} to ${filterEndDate || '...'}`] : []),
  ];

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

  // Android hardware back: close the filter sheet first, then walk back
  // detail → list → tiles. On the tiles grid itself the event is not
  // consumed, so the OS default (exit) applies.
  useEffect(() => {
    if (Platform.OS !== 'android' || !BackHandler?.addEventListener) return undefined;
    const handleHardwareBack = () => {
      if (filterModalVisible) {
        setFilterModalVisible(false);
        return true;
      }
      if (currentView === 'detail') {
        setSelectedOrder(null);
        setCurrentView('list');
        return true;
      }
      if (currentView === 'list' || currentView === 'assign-carrier') {
        setSelectedOrder(null);
        setAssignSelectedOrder(null);
        setCurrentView('tiles');
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription?.remove?.();
  }, [currentView, filterModalVisible]);

  // Web browser back: each time we move into a sub-view push a history entry
  // so the browser's back button walks detail → list → tiles. A backHandledRef
  // guard prevents the reverse navigation from pushing a duplicate entry.
  const backHandledRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onPopState = () => {
      backHandledRef.current = true;
      if (currentView === 'detail') {
        setSelectedOrder(null);
        setCurrentView('list');
      } else if (currentView === 'list' || currentView === 'assign-carrier') {
        setSelectedOrder(null);
        setAssignSelectedOrder(null);
        setCurrentView('tiles');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentView]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (backHandledRef.current) {
      backHandledRef.current = false;
      return;
    }
    if (currentView !== 'tiles') {
      window.history.pushState({ view: currentView }, '');
    }
  }, [currentView]);

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
  const showToast = useToast(); // global auto-dismissing in-app notification
  const [uploadVisible, setUploadVisible] = useState(false);
  // Capture area for the Packagings & Uploads share-image button — wraps the
  // Shipment Details → Packagings region of the detail view (utils/capture.js).
  const captureAreaRef = useRef(null);

  // Share the Shipment Details → Packagings & Uploads region as a PNG.
  const shareShipmentArea = async (o) => {
    if (!captureAreaRef.current) return;
    try {
      await shareViewAsImage(captureAreaRef, { title: `${o?.AWB_NUMBER || o?.REFERENCE || 'Shipment'} - Details & Uploads` });
      if (Platform.OS === 'web') showToast({ title: 'Image ready', msg: 'PNG downloaded', tone: 'success' });
    } catch (e) {
      showToast({ title: 'Share failed', msg: e.message, tone: 'error' });
    }
  };
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

  // Download bundles the document HTML into a PDF via the global util
  // (utils/pdf.js): native renders + save/shares, web downloads the .pdf.
  // docgen.downloadDocAsPdf handles the doc-specific print wrapper/barcodes.
  const downloadDoc = async (o, kind) => {
    const slug = DOC_KIND_SLUG[kind] || kind;
    const html = docgen.buildSingleDocHtml(slug, o, _docCtx(o));
    const title = `${slug} - ${o.AWB_NUMBER || o.REFERENCE}`;
    try {
      await docgen.downloadDocAsPdf(title, html);
      toast('✅ PDF ready', `${title}.pdf`);
    } catch (e) { toast('❌ Download failed', e.message); }
  };

  const downloadAllDocs = async (o) => {
    const title = `AllDocs - ${o.AWB_NUMBER || o.REFERENCE}`;
    try {
      const html = docgen.buildAllDocsHtml(o, _docCtx(o));
      await docgen.downloadDocAsPdf(title, html);
      toast('✅ PDF ready', `${title}.pdf`);
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
    // Self-destructive confirmation — auto-dismisses, no OK button.
    showToast({ title: 'Label Layout', msg: next === '4up-portrait' ? 'Switched to 4-up Portrait' : 'Switched to 2-up Landscape' });
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
        <View style={styles.pageTitleBlock}>
          <GradientText colors={['#0ea5e9', '#2563eb']} style={styles.pageTitle}>Shipments</GradientText>
          <LinearGradient colors={['#0ea5e9', '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageTitleBar} />
        </View>
        <Text style={styles.pageSubtitle}>Select a category tile to view shipments</Text>

        <View style={styles.searchFilterRow}>
          <SearchBar
            placeholder="Search shipments…"
            hints={['Try an AWB number…', 'Try a consignee name…', 'Try a reference…', 'Try a destination city…']}
            value={searchQuery}
            onChangeText={(q) => {
              setSearchQuery(q);
              if (q) setCurrentView('list');
            }}
            onFilterPress={() => setFilterModalVisible(true)}
            filterActive={hasActiveAdvancedFilters}
            filterCount={activeFilterCount}
            style={styles.searchFilterInput}
          />
        </View>

        <FilterBar pills={activeFilterPills} onReset={handleResetAdvancedFilters} />

        <Tray title="Shipment Categories">
          <View style={styles.tileGrid}>
            {TILES.map(tile => {
              const isReports = tile.id === 'reports';
              const count = isReports ? null : (tileCounts[tile.id] ?? 0);
              const isSel = selectedTile === tile.id;
              return (
                <TouchableOpacity
                  key={tile.id}
                  activeOpacity={0.85}
                  style={[styles.gridTile, { backgroundColor: tile.bg }, accentSparkle(tile.grad[0], isSel)]}
                  onPress={() => {
                    if (isReports) { Alert.alert('Reports', 'Reports module coming soon.'); return; }
                    handleSelectTile(tile.id);
                  }}
                >
                  <GradientGlyph name={tile.icon} size={34} colors={tile.grad} />
                  {count != null ? (
                    <GradientText colors={tile.grad} style={styles.gridTileCount}>{count}</GradientText>
                  ) : null}
                  <Text style={styles.gridTileLabel}>{tile.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Tray>
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
          <Text style={styles.navTitle}>🚚 Assign Carrier</Text>
        </View>
        <View style={[styles.assignLayout, isCompact && styles.assignLayoutCompact]}>
          {(!isCompact || !assignSelectedOrder) && (
            <View style={[styles.assignListPane, isCompact && styles.assignListPaneCompact]}>
              <SearchBar
                placeholder="Search AWB, Ref, Consignor, Consignee..."
                value={assignSearch}
                onChangeText={setAssignSearch}
                style={styles.searchGap}
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
  // STAGE 2 & 3: LIST VIEW & DETAIL VIEW (Preserves Scroll Position)
  // ────────────────────────────────────────────────────────────────────────────
  if (currentView === 'list' || (currentView === 'detail' && selectedOrder)) {
    const o = selectedOrder;
    const stateRaw = o ? getOrderState(o) : 'pending';
    const stateCfg = STATE_CONFIG[stateRaw] || STATE_CONFIG.pending;

    const cnorObj = o ? (b2b2cMap[o.CONSIGNOR] || {}) : {};
    const cneeObj = o ? (b2b2cMap[o.CONSIGNEE] || {}) : {};

    const cnorName = cnorObj.NAME || o?.CONSIGNOR || '';
    const cnorCity = cnorObj.CITY || o?.ORIGIN_CITY || '';
    const cnorPin  = cnorObj.PINCODE || o?.ORIGIN_PINCODE || o?.CONSIGNOR_PINCODE || '';
    const cnorState= cnorObj.STATE || o?.CONSIGNOR_STATE || '';
    const cnorAddr = cnorObj.ADDRESS || o?.CONSIGNOR_ADDRESS || '';
    const cnorMob  = cnorObj.MOBILE || o?.CONSIGNOR_MOBILE || '';

    const cneeName = cneeObj.NAME || o?.CONSIGNEE || '';
    const cneeCity = cneeObj.CITY || o?.DEST_CITY || '';
    const cneePin  = cneeObj.PINCODE || o?.DEST_PINCODE || o?.CONSIGNEE_PINCODE || '';
    const cneeState= cneeObj.STATE || o?.CONSIGNEE_STATE || '';
    const cneeAddr = cneeObj.ADDRESS || o?.CONSIGNEE_ADDRESS || '';
    const cneeMob  = cneeObj.MOBILE || o?.CONSIGNEE_MOBILE || '';

    const carrierRecord = o ? carriersMap[o.CARRIER] : null;
    const carrierName = (typeof carrierRecord === 'string' ? carrierRecord : (carrierRecord?.COMPANY_NAME || carrierRecord?.NAME)) || o?.CARRIER || 'N/A';
    const modeRecord = o ? modesMap[o.MODE] : null;
    const modeName = (typeof modeRecord === 'string' ? modeRecord : (modeRecord?.MODE || modeRecord?.NAME)) || o?.MODE || 'N/A';

    const formattedOrderDate   = o ? fmtDate(o.ORDER_DATE, 'date') : '';

    const products  = o ? (productsMap[o.REFERENCE] || o.products || []) : [];
    const boxes     = o ? (multiboxMap[o.REFERENCE] || o.multibox || []) : [];
    const uploads   = o ? (uploadsMap[o.REFERENCE] || uploadsMap[o.AWB_NUMBER] || o.uploads || o.UPLOADS || []) : [];
    const shipment  = o ? (liveTracking?.shipment || shipmentsMap[o.REFERENCE] || {}) : {};
    const movements = o ? sortMovements(liveTracking?.movements || shipment.movements || o.movements || []) : [];

    const buildOrderText = () => {
      if (!o) return '';
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
      if (!o) return;
      Clipboard.setString(buildOrderText());
      Alert.alert('✅ Copied', 'Shipment details copied to clipboard!');
    };

    const handleShare = async () => {
      if (!o) return;
      try { await Share.share({ message: buildOrderText() }); } catch (e) { /* dismissed */ }
    };

    const shipmentDetailsTable = o ? [
      { l: 'Carrier',   v: carrierName, full: true },
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
    ] : [];

    return (
      <View style={{ flex: 1 }}>
        {/* STAGE 2: LIST VIEW — kept mounted with display toggle so scroll state is 100% preserved */}
        <View style={[styles.container, { display: currentView === 'list' ? 'flex' : 'none' }]}>
          <View style={styles.searchFilterRow}>
            <SearchBar
              placeholder="Search AWB, Ref, Client..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFilterPress={() => setFilterModalVisible(true)}
              filterActive={hasActiveAdvancedFilters}
              filterCount={activeFilterCount}
              style={styles.searchFilterInput}
            />
          </View>

          <FilterBar pills={activeFilterPills} onReset={handleResetAdvancedFilters} />

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

          {/* ── Tray-wrapped list (centralized Tray — same as Dashboard) ── */}
          <Tray
            title={`${activeTileObj.label} (${filteredOrders.length})`}
            icon={activeTileObj.icon}
            iconColors={activeTileObj.grad}
            headerStyle={styles.listTrayHeader}
            style={styles.listTrayFill}
          >
            <FlatList
              ref={flatListRef}
              data={filteredOrders}
              keyExtractor={(item, index) => item.REFERENCE || item.id || index.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 10 }}
              onScroll={(e) => {
                listScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <WebShipmentListItem
                  order={item}
                  b2b2cMap={b2b2cMap}
                  modesMap={modesMap}
                  shipmentsMap={shipmentsMap}
                  isSelected={selectedOrder?.REFERENCE === item.REFERENCE}
                  onPress={() => handleSelectOrder(item)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyTitle}>No orders match filters.</Text>
                </View>
              }
            />
          </Tray>
        </View>

        {/* STAGE 3: DETAIL VIEW */}
        {currentView === 'detail' && selectedOrder ? (
          <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Navigation Header — premium breadcrumb */}
            <View style={styles.navHeader}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setSelectedOrder(null); setCurrentView('list'); }}
                accessibilityLabel="Back to list"
              >
                <GradientIcon name="back" size={34} iconSize={15} />
              </TouchableOpacity>

              <View style={styles.navTitleBlock}>
                <Text style={styles.navCrumb}>Orders › Detail</Text>
                <GradientText colors={['#0ea5e9', '#2563eb']} style={styles.navTitleGradient} numberOfLines={1}>
                  Order — {o.REFERENCE}
                </GradientText>
                <Text style={styles.navSubtitle} numberOfLines={1}>
                  AWB {o.AWB_NUMBER || 'Pending'} · {formattedOrderDate}
                </Text>
              </View>

              <View style={[styles.navStatusBadge, { backgroundColor: stateCfg.bg }]}>
                <Text style={[styles.navStatusText, { color: stateCfg.color }]}>{stateCfg.label}</Text>
              </View>
            </View>

            {/* ── CARD 1: Document Center (centralized DocCenterPane) ── */}
            <DocCenterPane
              order={o}
              onUpload={openUpload}
              onToggleLayout={toggleLabelLayout}
              onPrintAll={printAllDocs}
              onDownloadAll={downloadAllDocs}
              onMailAll={mailShipment}
              onWhatsAppAll={waShipment}
              onPrintDoc={printDoc}
              onMailDoc={mailDoc}
              onDownloadDoc={downloadDoc}
              onWhatsAppDoc={waDoc}
            />

            {/* ── Cards 2–5: Shipment Details → Packagings & Uploads, wrapped in a
                capture ref so the pane's share-image button can share this whole
                area as a picture (utils/capture.js). ── */}
            <View ref={captureAreaRef} collapsable={false}>
              {/* ── CARD 2: Shipment Details (centralized ShipmentDetailsPane) ── */}
              <ShipmentDetailsPane
                rows={shipmentDetailsTable}
                canEdit={!o.INV_NUMBER}
                onUpdateStatus={() => setUpdateStatusTargetOrder(o)}
                onEdit={() => (onEditOrder ? onEditOrder({ ...o, boxes: multiboxMap[o.REFERENCE] || [], products: productsMap[o.REFERENCE] || [] }) : toast('Edit', 'Edit order ' + o.REFERENCE))}
                onCopy={handleCopy}
                onShare={handleShare}
                onMail={() => mailShipment(o)}
                onWhatsApp={() => waShipment(o)}
                onDelete={() => deleteOrder(o)}
              />

              {/* ── CARD 3+4: Consignor & Consignee (centralized PartiesPane) ── */}
              <PartiesPane
                consignor={[
                  { l: 'Name', v: cnorName },
                  { l: 'Origin', v: [cnorCity, cnorPin, cnorState].filter(Boolean).join(', ') },
                  { l: 'Address', v: cnorAddr },
                  { l: 'Mobile', v: cnorMob },
                ]}
                consignee={[
                  { l: 'Name', v: cneeName },
                  { l: 'Destination', v: [cneeCity, cneePin, cneeState].filter(Boolean).join(', ') },
                  { l: 'Address', v: cneeAddr },
                  { l: 'Mobile', v: cneeMob },
                ]}
              />

              {/* ── CARD 5: Packagings & Uploads (centralized PackagingsPane) ── */}
              <PackagingsPane
                products={products}
                boxes={boxes}
                uploads={uploads}
                onUpload={() => openUpload(o)}
                onMailAll={() => mailShipmentUploads(o)}
                onWhatsAppAll={() => waShipmentUploads(o)}
                onDownloadUpload={(up) => downloadUploadNative(resolveFileUrl(up.FILE_URL), `${up.UPLOAD_TYPE || 'Upload'}_${o.AWB_NUMBER || o.REFERENCE}`)}
                onShareUpload={(up) => shareUploadNative(resolveFileUrl(up.FILE_URL), `${up.UPLOAD_TYPE || 'Upload'} - ${o.AWB_NUMBER || o.REFERENCE}`)}
                onDeleteUpload={deleteUpload}
                onShareArea={() => shareShipmentArea(o)}
                resolveUrl={resolveFileUrl}
              />
            </View>

            {/* ── CARD 6/7: Tracking Status + History (centralized TrackingPane) ── */}
            <TrackingPane
              shipment={shipment}
              movements={movements}
              title="Tracking and History"
              infoRows={[
                { l: 'AWB Number', v: o.AWB_NUMBER || shipment.awb_number || 'N/A' },
                { l: 'Order Date', v: formattedOrderDate },
                { l: 'Origin', v: shipment.carrier_origin },
                { l: 'Destination', v: shipment.carrier_destination },
                { l: 'Info', v: shipment.additional_info, full: true },
              ].filter(row => row.v !== null && row.v !== undefined && row.v !== '')}
              onMail={() => mailShipmentTracking(o)}
              onWhatsApp={() => waShipmentTracking(o)}
              onRefresh={() => fetchTrackingHistory(o.REFERENCE, true)}
              onViewPod={shipment.pod_image
                ? () => openUploadViewer(shipment.pod_image, `POD — ${o.AWB_NUMBER || o.REFERENCE}`)
                : null}
            />

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
        ) : null}
      </View>
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
      b2b2cMap={b2b2cMap}
      onSuccess={(ref, statusRaw) => {
        if (onRefresh) onRefresh();
      }}
    />

    {/* ── Filter Modal — mounted for every view (tiles + list) ── */}
    <FilterModal
      visible={filterModalVisible}
      title="Filter Shipments"
      // Show the result count only when filters are actually active — with
      // nothing selected, “Apply” alone is honest (no misleading count).
      resultCount={hasActiveAdvancedFilters ? filteredOrders.length : undefined}
      dateRange={{
        start: filterStartDate,
        end: filterEndDate,
        onStart: setFilterStartDate,
        onEnd: setFilterEndDate,
      }}
      sections={[
        { title: 'SHIPMENT STATUS', options: STATUS_OPTIONS, selected: filterStatus, onSelect: setFilterStatus, half: true },
        { title: 'PAYMENT MODE', options: PAY_OPTIONS, selected: filterPayMode, onSelect: setFilterPayMode, half: true },
        { title: 'BRANCH', options: branchFilterOptions, selected: filterBranch, onSelect: setFilterBranch, half: true, flex: 2 },
        { title: 'CLIENT', options: codeFilterOptions, selected: filterCode, onSelect: setFilterCode, half: true, flex: 3 },
        { title: 'CARRIER', options: carrierFilterOptions, selected: filterCarrier, onSelect: setFilterCarrier },
      ]}
      onApply={() => setFilterModalVisible(false)}
      onReset={handleResetAdvancedFilters}
      onClose={() => setFilterModalVisible(false)}
    />
  </View>
);
}

// ── Shipment List Row — centralized ListItem (same design as Dashboard) ────────
function WebShipmentListItem({ order, b2b2cMap, modesMap = {}, shipmentsMap = {}, isSelected, onPress }) {
  // Web parity — state from the SHIPMENTS sheet first (shipmentsDataMap)
  const shipState = shipmentsMap[order.REFERENCE];
  const stateRaw = normalizeShipmentState(shipState?.state || shipState?.STATE || order.STATE || order.state || 'pending');
  const stateCfg = STATE_CONFIG[stateRaw] || STATE_CONFIG.pending;

  const consignee = (b2b2cMap[order.CONSIGNEE]?.NAME || order.CONSIGNEE || 'Unknown');
  const modeRec = modesMap[order.MODE];
  const modeName = (typeof modeRec === 'string' ? modeRec : (modeRec?.MODE || modeRec?.NAME)) || order.MODE || '';
  const hasCod = order.COD && parseFloat(order.COD) > 0;
  const meta = [
    order.CODE || '',
    order.WEIGHT ? `${order.WEIGHT}kg` : '',
    order.PIECS ? `${order.PIECS} pcs` : '',
    modeName,
    order.TOPAY === 'Yes' ? 'ToPay' : '',
    hasCod ? `COD ₹${order.COD}` : '',
  ].filter(Boolean).join(' | ');

  return (
    <ListItem
      title={consignee}
      subtitle={[
        `AWB: ${order.AWB_NUMBER || 'Pending'} | Carrier: ${order.CARRIER || '—'} | Ref: ${order.REFERENCE || '—'}`,
        meta,
        `📍 ${order.ORIGIN_CITY || 'DDN'} → 🏁 ${order.DEST_CITY || 'DEST'}`,
      ]}
      status={stateCfg.label}
      onPress={onPress}
      style={isSelected ? styles.listItemSelected : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },

  pageTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pageTitleBlock: { alignItems: 'center', marginBottom: 14 },
  pageTitleBar: { width: 46, height: 3, borderRadius: 2, marginTop: 8 },
  pageSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  searchGap: { marginBottom: 12 },

  // Stage 1: Tiles Grid View
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  gridTile: { width: '48%', borderRadius: 16, borderWidth: 1.5, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  gridTileCount: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  gridTileLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 2, color: '#475569', textAlign: 'center', letterSpacing: 0.5 },

  // Stage 2 & 3 Nav Bar
  navHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  navTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', flex: 1 },
  navTitleBlock: { flex: 1, minWidth: 0 },
  navCrumb: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  navTitleGradient: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  navSubtitle: { fontSize: 11, color: '#64748b', marginTop: 3 },
  navStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  navStatusText: { fontSize: 11, fontWeight: '800' },

  // Tray-wrapped list — flex fill + tighter header (shell lives in components/Tray.js)
  listTrayFill: { flex: 1 },
  listTrayHeader: { marginBottom: 8 },

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

  // flex-start keeps the filter button pinned to the top while the search bar
  // expands into its camera stage (center would float it mid-height).
  searchFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  searchFilterInput: { flex: 1 },

  // Selected row highlight (used via ListItem's style prop)
  listItemSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 0px 0px 2px rgba(2, 132, 199, 0.2), 0px 4px 14px rgba(2, 132, 199, 0.12)' }
      : {
          shadowColor: '#0284c7',
          shadowOpacity: 0.22,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
        }),
  },

  stateBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  stateBadgeText: { fontSize: 10, fontWeight: '700' },

  // Stage 3 Detail View Cards
  card: { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },

  docHeaderActionBtn: { backgroundColor: '#f8fafc', padding: 5, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  actionIconGroup: { flexDirection: 'row', gap: 4 },

  noSubDataText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 4 },
  loadingText: { fontSize: 11, color: '#64748b', marginTop: 4 },

  // Tracking Movements Timeline Card
  movementItemCard: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  movementActivityText: { fontSize: 12.5, fontWeight: '800', color: '#1e293b' },
  movementDateText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  movementLocationText: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 2 },


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
