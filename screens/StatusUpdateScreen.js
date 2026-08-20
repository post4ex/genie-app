// screens/StatusUpdateScreen.js — "Update Shipment Status" picker.
// Docket / Runsheet / Manifest mode toggle (Runsheet & Manifest are
// placeholders until the modules land) above the Orders-parity search:
// SearchBar (scan + filter buttons)
// → FilterBar pills → Tray-wrapped FlatList of ListItem rows (consignee
// title, AWB/meta/route subtitles, floating gradient state chip).
// Scan (or exact AWB/REF match) opens the UpdateStatusModal instantly.
// Flow stays: find → pick → UpdateStatusModal (shared with Orders detail).
// Fully static list — no Animated.

import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../styles/theme';
import GradientText from '../components/GradientText';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar';
import FilterModal from '../components/FilterModal';
import ListItem from '../components/ListItem';
import SegmentedToggle from '../components/SegmentedToggle';
import Tray from '../components/Tray';
import { GradientGlyph } from '../components/icons';
import { useToast } from '../components/Toast';
import UpdateStatusModal from '../components/UpdateStatusModal';
import AssignCarrierModal from '../components/AssignCarrierModal';

// Brand page accent (modal BRAND parity) + success green for the recent tray.
const PAGE_GRAD = ['#9C2007', '#f59e0b'];
const SUCCESS_GRAD = ['#16a34a', '#84cc16'];

// ── Web parity: state → label map + normalization (OrdersScreen 1-to-1) ──────
const STATE_CONFIG = {
  delivered:       { label: 'Delivered' },
  rto:             { label: 'RTO' },
  outfordelivery:  { label: 'Out for Delivery' },
  exception:       { label: 'Exception' },
  intransit:       { label: 'In Transit' },
  pending:         { label: 'Pending' },
  booked:          { label: 'Booked' },
  pickup:          { label: 'Pickup' },
  deleted:         { label: 'Deleted' },
};

// Shipment state values arrive with spaces/hyphens/underscores; the web
// compares canonical values like `outfordelivery`, so normalize the same way.
const normalizeShipmentState = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

// Order state — SHIPMENTS sheet first, then the order record (web parity).
const getOrderState = (o, shipmentsMap) => {
  const s = shipmentsMap[o?.REFERENCE];
  return normalizeShipmentState(s?.state || s?.STATE || o?.STATE || o?.state || o?.STATUS || o?.status || 'pending');
};

// Filter dropdown options (same lists as Orders).
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

// ── Assign / Docket / Runsheet / Manifest mode switch ──
const VIEW_MODES = [
  { key: 'assign', label: 'Assign', icon: 'truck-check' },
  { key: 'docket', label: 'Docket', icon: 'package-variant-closed' },
  { key: 'runsheet', label: 'Runsheet', icon: 'truck-fast' },
  { key: 'manifest', label: 'Manifest', icon: 'file-document-multiple' },
];

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const parseOrderDateMs = (val) => {
  if (!val) return 0;
  const num = Number(val);
  if (!isNaN(num)) return num > 1e10 ? num : num * 1000;
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const getAwbNumber = (o, shipmentsMap = {}) => {
  const s = shipmentsMap[o?.REFERENCE] || {};
  return String(o?.AWB_NUMBER || o?.awb_number || o?.AWB || s?.AWB_NUMBER || s?.awb_number || s?.awb || s?.AWB || '').trim();
};

const getCarrier = (o, shipmentsMap = {}) => {
  const s = shipmentsMap[o?.REFERENCE] || {};
  return String(o?.CARRIER || o?.carrier || s?.CARRIER || s?.carrier || '').trim();
};

const checkIsNoAwb = (o, shipmentsMap = {}) => {
  const awb = getAwbNumber(o, shipmentsMap);
  return !awb || ['', '0', 'na', 'n/a', 'null', 'undefined', 'pending', 'no awb', 'no_awb', 'none', '—'].includes(awb.toLowerCase());
};

// ── List row — identical to the Orders page (WebShipmentListItem) ────────────
function StatusRow({ order, b2b2cMap, modesMap, shipmentsMap, isAssignMode, onPress }) {
  const isNoAwb = checkIsNoAwb(order, shipmentsMap);
  const stateRaw = getOrderState(order, shipmentsMap);
  const stateCfg = STATE_CONFIG[stateRaw] || STATE_CONFIG.pending;
  const consignee = b2b2cMap[order?.CONSIGNEE]?.NAME || order?.CONSIGNEE || 'Unknown';
  const modeRec = modesMap[order?.MODE];
  const modeName = (typeof modeRec === 'string' ? modeRec : (modeRec?.MODE || modeRec?.NAME)) || order?.MODE || '';
  const hasCod = order?.COD && parseFloat(order.COD) > 0;
  const awbDisplay = getAwbNumber(order, shipmentsMap);
  const carrierDisplay = getCarrier(order, shipmentsMap);

  const meta = [
    order?.CODE || '',
    order?.WEIGHT ? `${order.WEIGHT}kg` : '',
    order?.PIECS ? `${order.PIECS} pcs` : '',
    modeName,
    order?.TOPAY === 'Yes' ? 'ToPay' : '',
    hasCod ? `COD ₹${order.COD}` : '',
  ].filter(Boolean).join(' | ');

  return (
    <View style={isAssignMode && isNoAwb ? { backgroundColor: '#fff7ed', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fde68a' } : null}>
      <ListItem
        title={consignee}
        subtitle={[
          `AWB: ${awbDisplay || 'No AWB'} | Carrier: ${carrierDisplay || 'No Carrier'} | Ref: ${order?.REFERENCE || '—'}`,
          meta,
          `📍 ${order?.ORIGIN_CITY || 'DDN'} → 🏁 ${order?.DEST_CITY || 'DEST'}`,
        ]}
        status={isAssignMode && isNoAwb ? 'UNASSIGNED' : stateCfg.label}
        onPress={onPress}
      />
    </View>
  );
}

export default function StatusUpdateScreen({
  orders = [], token = '', apiBase = '', role = 'STAFF', onRefresh,
  b2b2cMap = {}, modesMap = {}, shipmentsMap = {},
}) {
  const [viewMode, setViewMode] = useState('assign'); // 'assign' | 'docket' | 'runsheet' | 'manifest'
  const modeCfg = VIEW_MODES.find((m) => m.key === viewMode) || VIEW_MODES[0];
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null); // order selected for status update
  const [assignTarget, setAssignTarget] = useState(null); // order selected for carrier & AWB assignment
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useToast();

  // Advanced filters (Status + Payment Mode — same model as Orders).
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPayMode, setFilterPayMode] = useState('ALL');

  // Set when the modal was opened by an exact AWB/REF match (scan/typed) so we
  // can clear the search box on close instead of leaving a single-row filter.
  const autoOpenedRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = orders.filter((o) => {
      const state = getOrderState(o, shipmentsMap);
      if (filterStatus !== 'ALL' && state !== filterStatus) return false;
      if (filterPayMode === 'TOPAY' && o.TOPAY !== 'Yes') return false;
      if (filterPayMode === 'COD' && (!o.COD || parseFloat(o.COD) <= 0)) return false;
      if (filterPayMode === 'PREPAID' && (o.TOPAY === 'Yes' || (o.COD && parseFloat(o.COD) > 0))) return false;

      // Search — web parity: ref/awb/names/cities/pincodes.
      if (!q) return true;
      const cnor = b2b2cMap[o.CONSIGNOR] || {};
      const cnee = b2b2cMap[o.CONSIGNEE] || {};
      const awbVal = getAwbNumber(o, shipmentsMap);
      const haystack = [
        o.REFERENCE, awbVal, cnor.NAME || o.CONSIGNOR, cnee.NAME || o.CONSIGNEE,
        cnee.CITY || o.DEST_CITY, cnee.PINCODE || o.DEST_PINCODE, cnor.CITY || o.ORIGIN_CITY,
      ].filter(Boolean).map(String).join('|').toLowerCase();
      return haystack.includes(q);
    });

    if (viewMode === 'assign') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const activeList = list.filter((s) => {
        const state = getOrderState(s, shipmentsMap);
        if (state === 'delivered') return false; // exclude delivered orders
        const ms = parseOrderDateMs(s?.ORDER_DATE || s?.time);
        return ms === 0 || ms >= cutoff;
      });
      const sortByDate = (a, b) => parseOrderDateMs(b?.ORDER_DATE || b?.time) - parseOrderDateMs(a?.ORDER_DATE || a?.time);

      const incomplete = activeList.filter((s) => checkIsNoAwb(s, shipmentsMap)).sort(sortByDate);
      const complete = activeList.filter((s) => !checkIsNoAwb(s, shipmentsMap)).sort(sortByDate);
      return [...incomplete, ...complete];
    }

    return list;
  }, [orders, query, filterStatus, filterPayMode, b2b2cMap, shipmentsMap, viewMode]);

  const hasActiveAdvancedFilters = filterStatus !== 'ALL' || filterPayMode !== 'ALL';
  const activeFilterCount = [filterStatus, filterPayMode].filter(v => v !== 'ALL').length;
  const activeFilterPills = [
    ...(filterStatus !== 'ALL' ? [`Status: ${optionLabel(STATUS_OPTIONS, filterStatus)}`] : []),
    ...(filterPayMode !== 'ALL' ? [`Pay: ${optionLabel(PAY_OPTIONS, filterPayMode)}`] : []),
  ];

  const handleResetAdvancedFilters = () => {
    setFilterStatus('ALL');
    setFilterPayMode('ALL');
  };

  // Search/scan — an exact AWB_NUMBER or REFERENCE match opens the update
  // popup instantly (no extra tap needed).
  const handleQueryChange = (q) => {
    setQuery(q);
    const t = String(q || '').trim().toUpperCase();
    if (!t) return;
    const hit = orders.find((o) =>
      String(o?.AWB_NUMBER || '').trim().toUpperCase() === t ||
      String(o?.REFERENCE || '').trim().toUpperCase() === t
    );
    if (hit) {
      autoOpenedRef.current = true;
      setTarget(hit);
    }
  };

  const closeModal = () => {
    if (autoOpenedRef.current) {
      autoOpenedRef.current = false;
      setQuery('');
    }
    setTarget(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.resolve(onRefresh?.()).finally(() => setTimeout(() => setRefreshing(false), 600));
  };

  const handleSuccess = (reference, primaryStatus, remark) => {
    setRecent((prev) => [
      { reference, primaryStatus, remark, time: Date.now() },
      ...prev,
    ].slice(0, 10));
    showToast({ title: 'Status Updated', msg: `${reference} → ${primaryStatus}`, tone: 'success' });
    if (onRefresh) onRefresh();
  };

  const recentBlock = recent.length > 0 ? (
    <View style={styles.recentBox}>
      <View style={styles.recentHead}>
        <GradientGlyph name="history" size={16} colors={SUCCESS_GRAD} />
        <GradientText colors={SUCCESS_GRAD} style={styles.recentTitle}>Recently Updated</GradientText>
      </View>
      {recent.map((r, i) => (
        <View key={`${r.reference}-${r.time}`} style={[styles.recentRow, i === 0 && styles.recentRowFirst]}>
          <GradientGlyph name="check-circle" size={16} colors={SUCCESS_GRAD} style={styles.recentGlyph} />
          <View style={styles.recentBody}>
            <View style={styles.recentTop}>
              <Text style={styles.recentRef} numberOfLines={1}>{r.reference}</Text>
              <LinearGradient colors={SUCCESS_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.recentChip}>
                <Text style={styles.recentChipText} numberOfLines={1}>{r.primaryStatus}</Text>
              </LinearGradient>
            </View>
            {r.remark ? <Text style={styles.recentRemark} numberOfLines={1}>{r.remark}</Text> : null}
            <Text style={styles.recentTime}>{timeAgo(r.time)}</Text>
          </View>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {/* Page title — Orders tiles-view block, brand accent */}
      <View style={styles.pageTitleBlock}>
        <GradientText colors={PAGE_GRAD} style={styles.pageTitle}>Update Status</GradientText>
        <LinearGradient colors={PAGE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pageTitleBar} />
      </View>
      {/* ── Assign / Docket / Runsheet / Manifest mode switch ── */}
      <View style={styles.viewToggleRow}>
        <SegmentedToggle options={VIEW_MODES} value={viewMode} onChange={setViewMode} colors={PAGE_GRAD} size="md" />
      </View>

      {viewMode === 'docket' || viewMode === 'assign' ? (
        <>
          {/* Search + filter — same row as the Orders page */}
          <View style={styles.searchFilterRow}>
            <SearchBar
              placeholder="Search AWB, Ref, Client..."
              hints={['Scan or type an AWB…', 'Try a reference…', 'Try a consignee…', 'Try a city…']}
              value={query}
              onChangeText={handleQueryChange}
              onFilterPress={() => setFilterModalVisible(true)}
              filterActive={hasActiveAdvancedFilters}
              filterCount={activeFilterCount}
              style={styles.searchFilterInput}
            />
          </View>

          <FilterBar pills={activeFilterPills} onReset={handleResetAdvancedFilters} />

          {/* ── Tray-wrapped list (centralized Tray — same as Orders) ── */}
          <Tray
            title={viewMode === 'assign' ? `Assign Carrier (${filtered.length})` : `Shipments (${filtered.length})`}
            icon={viewMode === 'assign' ? 'truck-check' : 'status'}
            iconColors={PAGE_GRAD}
            headerStyle={styles.listTrayHeader}
            style={styles.listTrayFill}
          >
            <FlatList
              data={filtered}
              keyExtractor={(o, i) => o?.REFERENCE || o?.AWB_NUMBER || String(i)}
              renderItem={({ item }) => (
                <StatusRow
                  order={item}
                  b2b2cMap={b2b2cMap}
                  modesMap={modesMap}
                  shipmentsMap={shipmentsMap}
                  isAssignMode={viewMode === 'assign'}
                  onPress={() => {
                    if (viewMode === 'assign') {
                      setAssignTarget(item);
                    } else {
                      setTarget(item);
                    }
                  }}
                />
              )}
              ListHeaderComponent={recentBlock}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <GradientGlyph name={orders.length ? 'magnify-close' : 'clipboard-alert-outline'} size={30} colors={['#cbd5e1', '#94a3b8']} />
                  <Text style={styles.emptyTitle}>
                    {orders.length ? 'No shipments match your search' : 'No shipments synced yet'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {orders.length
                      ? 'Try a different reference, AWB, consignee or city.'
                      : 'Pull down to refresh, or wait for the background sync.'}
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={COLORS.primary}
                  colors={[COLORS.primary]}
                />
              }
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </Tray>
        </>
      ) : (
        /* ── Runsheet / Manifest module — not implemented yet ── */
        <Tray title={modeCfg.label} icon={modeCfg.icon} iconColors={PAGE_GRAD}>
          <View style={styles.placeholder}>
            <GradientGlyph name="tools" size={40} colors={['#cbd5e1', '#94a3b8']} />
            <Text style={styles.placeholderTitle}>{modeCfg.label} module coming soon</Text>
            <Text style={styles.placeholderSub}>
              Status updates currently cover Docket shipments only. The {modeCfg.label}
              flow isn't implemented yet.
            </Text>
          </View>
        </Tray>
      )}

      <FilterModal
        visible={filterModalVisible}
        title="Filter Shipments"
        // Show the result count only when filters are actually active (Orders parity).
        resultCount={hasActiveAdvancedFilters ? filtered.length : undefined}
        sections={[
          { title: 'SHIPMENT STATUS', options: STATUS_OPTIONS, selected: filterStatus, onSelect: setFilterStatus, half: true },
          { title: 'PAYMENT MODE', options: PAY_OPTIONS, selected: filterPayMode, onSelect: setFilterPayMode, half: true },
        ]}
        onApply={() => setFilterModalVisible(false)}
        onReset={handleResetAdvancedFilters}
        onClose={() => setFilterModalVisible(false)}
      />

      <UpdateStatusModal
        visible={!!target}
        onClose={closeModal}
        order={target}
        token={token}
        apiBase={apiBase}
        role={role}
        defaultStatus="Delivered"
        b2b2cMap={b2b2cMap}
        onSuccess={handleSuccess}
      />

      <AssignCarrierModal
        visible={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        order={assignTarget}
        token={token}
        apiBase={apiBase}
        b2b2cMap={b2b2cMap}
        onSuccess={(ref, carrier, awb) => {
          showToast({ title: 'Carrier & AWB Assigned', msg: `${ref} → ${carrier} (${awb})`, tone: 'success' });
          if (onRefresh) onRefresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingTop: 12 },

  // Page title block — Orders parity.
  pageTitleBlock: { alignItems: 'center', marginBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pageTitleBar: { width: 46, height: 3, borderRadius: 2, marginTop: 8 },
  // ── Docket / Runsheet / Manifest mode switch (shell lives in components/SegmentedToggle.js) ──
  viewToggleRow: { alignItems: 'center', marginBottom: 12 },

  // Runsheet placeholder.
  placeholder: { alignItems: 'center', paddingVertical: 28, gap: 8, paddingHorizontal: 16 },
  placeholderTitle: { color: '#475569', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  placeholderSub: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },

  // Search + filter row — same as the Orders page.
  searchFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  searchFilterInput: { flex: 1 },

  // Tray-wrapped list — flex fill + tighter header (shell lives in components/Tray.js).
  listTrayFill: { flex: 1 },
  listTrayHeader: { marginBottom: 8 },

  // Recently Updated block (list header — success-green, not a nested tray).
  recentBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  recentHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  recentTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  recentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#bbf7d0' },
  recentRowFirst: { borderTopWidth: 0, paddingTop: 2 },
  recentGlyph: { marginTop: 1 },
  recentBody: { flex: 1, minWidth: 0 },
  recentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recentRef: { flex: 1, color: '#0f172a', fontSize: 12.5, fontWeight: '700' },
  recentChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 130 },
  recentChipText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  recentRemark: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 2 },
  recentTime: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginTop: 2 },

  listContent: { paddingTop: 12, paddingBottom: 10 },
  empty: { alignItems: 'center', paddingVertical: 44, gap: 6, paddingHorizontal: 24 },
  emptyTitle: { color: '#475569', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: '#94a3b8', fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
});
