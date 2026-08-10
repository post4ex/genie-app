import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Modal, Alert, Clipboard, Linking, ActivityIndicator
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { COLORS } from '../styles/theme';
import { fmtDate, parseDate } from '../utils/formatIST';

// ── Web SVG Icons (Exact GENIE_WEB shipments.js _docIco 1-to-1 match) ──────────
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
    <Path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
};

const CARRIERS_LIST = ['ALL', 'Jetline', 'Trackon', 'Delhivery', 'Shiprocket', 'Airways', 'ST Courier', 'TrackCourier', '17Track'];
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
  b2b2cMap = {}, carriersMap = {}, modesMap = {}, productsMap = {}, multiboxMap = {}, uploadsMap = {}, shipmentsMap = {}, token = '', apiBase = ''
}) {
  const [currentView, setCurrentView] = useState('tiles');
  const [selectedTile, setSelectedTile] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCarrier, setFilterCarrier] = useState('ALL');
  const [filterPayMode, setFilterPayMode] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Visual Calendar Picker State
  const [calendarTarget, setCalendarTarget] = useState(null); // 'start' | 'end' | null
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Tracking API State
  const [liveTracking, setLiveTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const tileCounts = useMemo(() => {
    const counts = { all: orders.length, topay: 0, cod: 0, tat: 0, overduetat: 0, heavy: 0, highvalue: 0, exceptions: 0, 'pending-pod': 0, ofd: 0, 'new-bookings': 0, fov: 0, delivered: 0, 'assign-carrier': 0 };
    const now = Date.now();

    orders.forEach(o => {
      const state = (o.STATE || o.state || 'pending').toLowerCase();
      const isDelivered = state === 'delivered';
      const weight = parseFloat(o.WEIGHT || 0);
      const val = parseFloat(o.VALUE || 0);

      if (o.TOPAY === 'Yes' && !isDelivered) counts.topay++;
      if (o.COD && parseFloat(o.COD) > 0 && !isDelivered) counts.cod++;
      if (weight > 25 && !isDelivered) counts.heavy++;
      if (val > 100000 && !isDelivered) counts.highvalue++;
      if (state === 'exception') counts.exceptions++;
      if (state === 'outfordelivery') counts.ofd++;
      if (state === 'delivered') counts.delivered++;
      if (o.FOV === 'Yes' && !isDelivered) counts.fov++;

      if (!o.CARRIER || !o.AWB_NUMBER) counts['assign-carrier']++;

      const oDateObj = parseDate(o.ORDER_DATE);
      const oDateMs = oDateObj ? oDateObj.getTime() : 0;
      if (!o.CARRIER && !o.AWB_NUMBER && oDateMs && (now - oDateMs <= 86400000)) {
        counts['new-bookings']++;
      }

      const tatDays = parseInt(o.TAT || 0);
      if (tatDays && oDateMs) {
        const dueMs = oDateMs + tatDays * 86400000;
        const limitMs = now + 3 * 86400000;
        if (dueMs >= now && dueMs <= limitMs) counts.tat++;
        if (dueMs < now && !isDelivered) counts.overduetat++;
      }
    });

    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const list = orders.filter(o => {
      const state = (o.STATE || o.state || 'pending').toLowerCase();
      const isDelivered = state === 'delivered';

      if (selectedTile === 'topay' && (o.TOPAY !== 'Yes' || isDelivered)) return false;
      if (selectedTile === 'cod' && (!o.COD || parseFloat(o.COD) <= 0 || isDelivered)) return false;
      if (selectedTile === 'heavy' && (parseFloat(o.WEIGHT || 0) <= 25 || isDelivered)) return false;
      if (selectedTile === 'highvalue' && (parseFloat(o.VALUE || 0) <= 100000 || isDelivered)) return false;
      if (selectedTile === 'exceptions' && state !== 'exception') return false;
      if (selectedTile === 'ofd' && state !== 'outfordelivery') return false;
      if (selectedTile === 'delivered' && state !== 'delivered') return false;
      if (selectedTile === 'assign-carrier' && (o.CARRIER && o.AWB_NUMBER)) return false;
      if (selectedTile === 'fov' && (o.FOV !== 'Yes' || isDelivered)) return false;

      if (filterStatus !== 'ALL' && state !== filterStatus) return false;
      if (filterCarrier !== 'ALL' && (o.CARRIER || '').toLowerCase() !== filterCarrier.toLowerCase()) return false;
      if (filterPayMode === 'TOPAY' && o.TOPAY !== 'Yes') return false;
      if (filterPayMode === 'COD' && (!o.COD || parseFloat(o.COD) <= 0)) return false;
      if (filterPayMode === 'PREPAID' && (o.TOPAY === 'Yes' || (o.COD && parseFloat(o.COD) > 0))) return false;

      // Date Range Filtering (GENIE_WEB shipments.js line 466)
      const orderDate = parseDate(o.ORDER_DATE || o.TIME_STAMP);
      if (filterStartDate) {
        const startMs = new Date(filterStartDate + 'T00:00:00').getTime();
        if (!orderDate || orderDate.getTime() < startMs) return false;
      }
      if (filterEndDate) {
        const endMs = new Date(filterEndDate + 'T23:59:59').getTime();
        if (!orderDate || orderDate.getTime() > endMs) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const cnor = (b2b2cMap[o.CONSIGNOR]?.NAME || o.CONSIGNOR || '').toLowerCase();
        const cnee = (b2b2cMap[o.CONSIGNEE]?.NAME || o.CONSIGNEE || '').toLowerCase();
        const refMatch = (o.REFERENCE || '').toLowerCase().includes(q);
        const awbMatch = (o.AWB_NUMBER || '').toLowerCase().includes(q);
        const consMatch = cnee.includes(q) || cnor.includes(q);
        const origMatch = (o.ORIGIN_CITY || '').toLowerCase().includes(q);
        const destMatch = (o.DEST_CITY || '').toLowerCase().includes(q);
        if (!refMatch && !awbMatch && !consMatch && !origMatch && !destMatch) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const aTime = parseDate(a.ORDER_DATE || a.TIME_STAMP || a.TRANSIT_DATE)?.getTime() || 0;
      const bTime = parseDate(b.ORDER_DATE || b.TIME_STAMP || b.TRANSIT_DATE)?.getTime() || 0;
      return bTime - aTime;
    });
  }, [orders, selectedTile, filterStatus, filterCarrier, filterPayMode, filterStartDate, filterEndDate, searchQuery, b2b2cMap]);

  const activeTileObj = TILES.find(t => t.id === selectedTile) || TILES[0];
  const hasActiveAdvancedFilters = filterStatus !== 'ALL' || filterCarrier !== 'ALL' || filterPayMode !== 'ALL' || filterStartDate !== '' || filterEndDate !== '';

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
      const url = `${apiBase}/api/track?ref=${encodeURIComponent(ref)}${live ? '&live=true' : ''}`;
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
      fetchTrackingHistory(selectedOrder.REFERENCE, false);
    }
  }, [currentView, selectedOrder]);

  const handleSelectTile = (tileId) => {
    setSelectedTile(tileId);
    setCurrentView('list');
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setCurrentView('detail');
  };

  const handleResetAdvancedFilters = () => {
    setFilterStatus('ALL');
    setFilterCarrier('ALL');
    setFilterPayMode('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // ────────────────────────────────────────────────────────────────────────────
  // STAGE 1: TILES GRID VIEW
  // ────────────────────────────────────────────────────────────────────────────
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
  // STAGE 2: LIST VIEW
  // ────────────────────────────────────────────────────────────────────────────
  if (currentView === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentView('tiles')}>
            <Text style={styles.backBtnText}>‹ Back to Tiles</Text>
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

        <FlatList
          data={filteredOrders}
          keyExtractor={(item, index) => item.REFERENCE || item.id || index.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <WebShipmentListItem
              order={item}
              b2b2cMap={b2b2cMap}
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

                <Text style={styles.filterSectionTitle}>CARRIER</Text>
                <View style={styles.chipRow}>
                  {CARRIERS_LIST.map(car => (
                    <TouchableOpacity
                      key={car}
                      style={[styles.chip, filterCarrier === car && styles.chipActive]}
                      onPress={() => setFilterCarrier(car)}
                    >
                      <Text style={[styles.chipText, filterCarrier === car && styles.chipTextActive]}>
                        {car}
                      </Text>
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
    const stateRaw = (o.STATE || o.state || 'pending').toLowerCase();
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

    const carrierName = carriersMap[o.CARRIER] || o.CARRIER || 'N/A';
    const modeName    = modesMap[o.MODE] || o.MODE || 'N/A';

    const formattedOrderDate   = fmtDate(o.ORDER_DATE, 'date');
    const formattedTransitDate = fmtDate(o.TRANSIT_DATE, 'date');
    const formattedInvoiceDate = fmtDate(o.INVOICE_DATE, 'date');

    const products  = productsMap[o.REFERENCE] || o.products || [];
    const boxes     = multiboxMap[o.REFERENCE] || o.multibox || [];
    const uploads   = uploadsMap[o.REFERENCE] || uploadsMap[o.AWB_NUMBER] || o.uploads || o.UPLOADS || [];
    const shipment  = liveTracking?.shipment || shipmentsMap[o.REFERENCE] || {};
    const movements = liveTracking?.movements || shipment.movements || o.movements || [];

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

    const handleShare = () => {
      Alert.alert('Share', `Sharing shipment details for Ref: ${o.REFERENCE}`);
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
          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentView('tiles')}>
            <Text style={styles.backBtnText}>‹ Back to Tiles</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>Ref: {o.REFERENCE}</Text>
        </View>

        {/* ── CARD 1: Document Center ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Document Center</Text>
            <View style={styles.actionIconGroup}>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Upload', 'Upload doc')} title="Upload">
                <UploadIcon size={14} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Layout', 'Toggle layout')} title="Toggle Layout">
                <LayoutIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Print All', 'Print all docs')} title="Print All">
                <PrintIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Download All', 'Download all docs')} title="Download All">
                <DownloadIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Mail All', 'Mail all docs')} title="Mail All">
                <MailIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => Alert.alert('WhatsApp All', 'Sending WhatsApp')} title="WhatsApp All">
                <WhatsAppIcon size={14} color="#25D366" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.docRowsDivide}>
            {DOC_CENTER_ITEMS.map((item, idx) => (
              <View key={idx} style={styles.docRowItem}>
                <Text style={styles.docRowLabel}>{item.label}</Text>
                <View style={styles.docRowActionBtns}>
                  <TouchableOpacity style={styles.docItemBtn} onPress={() => Alert.alert('Print', `Print ${item.label}`)}>
                    <PrintIcon size={13} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.docItemBtn} onPress={() => Alert.alert('Mail', `Mail ${item.label}`)}>
                    <MailIcon size={13} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.docItemBtn} onPress={() => Alert.alert('Download', `Download ${item.label}`)}>
                    <DownloadIcon size={13} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.docItemBtn, { backgroundColor: '#dcfce7' }]} onPress={() => Alert.alert('WhatsApp', `WhatsApp ${item.label}`)}>
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
              {!o.INV_NUMBER && (
                <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Edit', 'Edit order ' + o.REFERENCE)} title="Edit">
                  <EditIcon size={14} color="#64748b" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={handleCopy} title="Copy">
                <CopyIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={handleShare} title="Share">
                <ShareIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Email', 'Emailing shipment details')} title="Email">
                <MailIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => Alert.alert('WhatsApp', 'WhatsApp shipment details')} title="WhatsApp">
                <WhatsAppIcon size={14} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#fef2f2' }]} onPress={() => Alert.alert('Delete', 'Delete order ' + o.REFERENCE)} title="Delete">
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
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Upload', 'Upload file for ' + o.REFERENCE)} title="Upload File">
                <UploadIcon size={14} color="#16a34a" />
              </TouchableOpacity>
              {uploads.length > 0 && (
                <>
                  <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Mail All', 'Mailing upload documents...')} title="Mail All">
                    <MailIcon size={14} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => Alert.alert('WhatsApp All', 'Sending WhatsApp')} title="WhatsApp All">
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
                              <TouchableOpacity style={styles.uploadActionBtn} onPress={() => Linking.openURL(up.FILE_URL)}>
                                <EyeIcon size={13} color="#0284c7" />
                                <Text style={styles.uploadActionBtnText}>View</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.uploadActionBtn} onPress={() => Linking.openURL(up.FILE_URL)}>
                                <DownloadIcon size={13} color="#0284c7" />
                                <Text style={styles.uploadActionBtnText}>Download</Text>
                              </TouchableOpacity>
                            </>
                          ) : null}
                          <TouchableOpacity style={[styles.uploadActionBtn, { borderColor: '#fca5a5' }]} onPress={() => Alert.alert('Delete', 'Delete upload record')}>
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
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => Alert.alert('Mail', 'Mailing tracking status...')} title="Mail">
                <MailIcon size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.docHeaderActionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => Alert.alert('WhatsApp', 'WhatsApp tracking status...')} title="WhatsApp">
                <WhatsAppIcon size={14} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.docHeaderActionBtn} onPress={() => fetchTrackingHistory(o.REFERENCE, true)} title="Refresh Live Tracking">
                <RefreshIcon size={14} color="#64748b" />
              </TouchableOpacity>
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
      </ScrollView>
    );
  }

  return null;
}

// ── Web Shipment List Item ─────────────────────────────────────────────────────
function WebShipmentListItem({ order, b2b2cMap, isSelected, onPress }) {
  const ref = order.REFERENCE || 'N/A';
  const awb = order.AWB_NUMBER || 'No AWB';

  const cnorObj = b2b2cMap[order.CONSIGNOR] || {};
  const cneeObj = b2b2cMap[order.CONSIGNEE] || {};

  const cnor = cnorObj.NAME || order.CONSIGNOR || 'Unknown';
  const cnee = cneeObj.NAME || order.CONSIGNEE || 'Unknown';

  const stateRaw = (order.STATE || order.state || 'pending').toLowerCase();
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
  backBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  backBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  navTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', flex: 1 },

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
});
