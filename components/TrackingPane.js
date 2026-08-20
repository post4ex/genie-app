// components/TrackingPane.js — Tracking & History pane (view-pane of the
// Orders detail view). Matches the other panes in the screen: shared Tray
// shell with floating gradient title chip, sparkle border, tinted action
// buttons, GradientText section headers and the shared hairline detail table.

import React, { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Tray from './Tray';
import IconTray from './IconTray';
import GradientText from './GradientText';
import SegmentedToggle from './SegmentedToggle';
import { GradientGlyph } from './icons';
import { accentSparkle } from './Tile';
import { DETAIL_TABLE_STYLES } from './ShipmentDetailsPane';
import { shareViewAsImage } from '../utils/capture';
import { useToast } from './Toast';
import { fmtDate } from '../utils/formatIST';

// Pane identity gradients (match the floating title chip) — violet → fuchsia
// neon only; no blue/cyan anywhere in this pane.
const PANE_GRAD = ['#8b5cf6', '#e879f9'];
// AWB hero strip gets its own identity — amber → orange, so the spec sheet
// is not all one violet/blue family.
const HERO_GRAD = ['#f59e0b', '#ea580c'];

const STATUS_CONFIG = {
  delivered: { label: 'Delivered', color: '#15803d', icon: '✅' },
  outfordelivery: { label: 'Out for Delivery', color: '#1d4ed8', icon: '🚚' },
  intransit: { label: 'In Transit', color: '#b45309', icon: '📦' },
  exception: { label: 'Exception', color: '#b91c1c', icon: '⚠️' },
  rto: { label: 'RTO', color: '#be123c', icon: '↩️' },
  pickup: { label: 'Pickup', color: '#7e22ce', icon: '📦' },
  pending: { label: 'Pending / Booked', color: '#3730a3', icon: '🕐' },
};

const normalizeState = (value) => String(value || 'pending')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const movementType = (movement) => String(
  movement?.move_type || movement?.MOVE_TYPE || 'TRACK'
).toUpperCase();

const movementNumber = (movement) => {
  const value = movement?.row_number ?? movement?.ROW_NUMBER;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const movementStamp = (movement) => Number(
  movement?.activity_stamp || movement?.ACTIVITY_STAMP || movement?.time_stamp || movement?.TIME_STAMP || 0
) || 0;

const movementActivity = (movement) => movement?.activity || movement?.ACTIVITY || movement?.STATUS_REMARK || 'N/A';
const movementDate = (movement) => [movement?.date || movement?.DATE, movement?.time || movement?.TIME].filter(Boolean).join(' ');
const movementLocation = (movement) => movement?.location || movement?.LOCATION;

function sortMovements(movements) {
  return (Array.isArray(movements) ? movements : [])
    .map((movement, index) => ({ movement, index }))
    .sort((a, b) => {
      const rowOrder = movementNumber(b.movement) - movementNumber(a.movement);
      if (rowOrder) return rowOrder;
      const stampOrder = movementStamp(b.movement) - movementStamp(a.movement);
      return stampOrder || a.index - b.index;
    })
    .map(({ movement }) => movement);
}

function defaultInfoRows(shipment) {
  return [
    { l: 'Reference', v: shipment?.reference || shipment?.REFERENCE },
    { l: 'AWB Number', v: shipment?.awb || shipment?.awb_number || shipment?.carrier_awb },
    { l: 'Origin', v: shipment?.carrier_origin || shipment?.origin },
    { l: 'Destination', v: shipment?.carrier_destination || shipment?.destination },
    // Format the booked date for display (timestamps → readable date) so the
    // hero chip never shows a raw epoch number or mangled string.
    { l: 'Booked Date', v: fmtDate(shipment?.booked_date || shipment?.order_date, 'date') },
  ].filter(row => row.v !== null && row.v !== undefined && row.v !== '' && row.v !== 'N/A');
}

// Light holographic status strip — frosted card, gradient badge with a soft
// static glow ring. No motion (all plain, no Animated).
function StatusLine({ status, raw, loading }) {
  return (
    <View style={styles.statusStrip}>
      {/* Holographic badge — violet→fuchsia gradient disc + static glow ring */}
      <View style={styles.statusBadgeWrap}>
        <LinearGradient colors={PANE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusBadge}>
          <Text style={styles.statusBadgeIcon}>{status.icon}</Text>
        </LinearGradient>
        <View style={styles.statusBadgeGlow} pointerEvents="none" />
      </View>

      <View style={styles.statusTextWrap}>
        <View style={styles.statusLabelRow}>
          <Text style={styles.statusLabel} numberOfLines={1}>{status.label}</Text>
          {loading ? <Text style={styles.statusSyncing}>⟳ syncing…</Text> : null}
        </View>
        {raw ? <Text style={styles.statusRaw} numberOfLines={1}>{raw}</Text> : null}
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <GradientGlyph name={icon} size={15} colors={PANE_GRAD} />
      <GradientText colors={PANE_GRAD} style={styles.sectionTitle}>{title}</GradientText>
    </View>
  );
}

function Timeline({ movements, splitByType, title }) {
  // Joined single-select segmented control — Scans is the default view.
  const [selected, setSelected] = useState('scans');
  const segments = [
    { key: 'scans', label: 'Scans', icon: 'scan' },
    { key: 'system', label: 'System', icon: 'gear' },
  ];
  const visible = movements.filter((movement) => {
    const isSystem = movementType(movement) === 'SYSTEM';
    return selected === 'system' ? isSystem : !isSystem;
  });
  const systemOnly = selected === 'system';
  // Kind label only when the pane is sectioned by type (standalone tracking).
  const showKindFinal = splitByType;

  return (
    <View>
      <View style={styles.timelineHeader}>
        <SectionHeader icon="scan" title={title} />
        <SegmentedToggle options={segments} value={selected} onChange={setSelected} colors={PANE_GRAD} size="sm" iconSize={11} />
      </View>

      {visible.length ? visible.map((movement, index) => {
        const system = movementType(movement) === 'SYSTEM';
        const latest = index === 0 && !systemOnly;
        // Keep the existing movement sort unchanged; only reverse the visual
        // sequence number so the newest-first list displays N ... 2, 1.
        const num = visible.length - index;
        return (
          <View key={`${movementNumber(movement)}-${movementStamp(movement)}-${index}`} style={styles.movRow}>
            <View style={styles.rail}>
              <View style={[styles.railNode, system ? styles.railNodeSystem : styles.railNodeTrack, latest && styles.railNodeLatest]}>
                {latest ? (
                  <GradientGlyph name="check" size={10} colors={['#ffffff', '#ffffff']} />
                ) : (
                  <Text style={[styles.railNodeNum, system && styles.railNodeNumSystem]}>{num}</Text>
                )}
              </View>
              {index < visible.length - 1 ? (
                <LinearGradient
                  colors={system ? ['#bbf7d0', '#f3fbf5'] : ['#c4b5fd', '#f2edfd']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.railLine}
                />
              ) : null}
            </View>
            <View style={[styles.movCard, system && styles.movCardSystem, latest && styles.movCardLatest]}>
              <LinearGradient
                colors={system ? ['#34d399', '#10b981'] : latest ? PANE_GRAD : ['#a78bfa', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.movEdge}
              />
              <View style={styles.movTop}>
                {showKindFinal ? (
                  <View style={[styles.movKindChip, system ? styles.movKindChipSystem : styles.movKindChipTrack]}>
                    <View style={[styles.movKindDot, { backgroundColor: system ? '#16a34a' : '#7c3aed' }]} />
                    <Text style={[styles.movKind, system && styles.movKindSystem]}>
                      {system ? 'SYSTEM EVENT' : 'COURIER SCAN'}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.movKindChip, system ? styles.movKindChipSystem : styles.movKindChipTrack]}>
                    <View style={[styles.movKindDot, { backgroundColor: system ? '#16a34a' : '#7c3aed' }]} />
                    <Text style={[styles.movKind, system && styles.movKindSystem]}>
                      {system ? 'System' : 'Scan'}
                    </Text>
                  </View>
                )}
                {movementDate(movement) ? <Text style={styles.movTime}>{movementDate(movement)}</Text> : null}
              </View>
              <Text style={styles.movAct}>{movementActivity(movement)}</Text>
              {movementLocation(movement) ? <Text style={styles.movLoc}>📍 {movementLocation(movement)}</Text> : null}
            </View>
          </View>
        );
      }) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {systemOnly ? 'No system events recorded.' : 'No scans recorded.'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TrackingPane({
  shipment = {},
  movements = [],
  infoRows,
  title = 'Tracking and History',
  splitByType = false,
  historyTitle = 'Scans and Movements',
  loading = false,
  onMail,
  onWhatsApp,
  onRefresh,
  onViewPod,
  podLabel = 'Show POD',
  style,
}) {
  const status = STATUS_CONFIG[normalizeState(shipment.state || shipment.STATE || shipment.status)] || STATUS_CONFIG.pending;
  const sortedMovements = useMemo(() => sortMovements(movements), [movements]);
  const rows = infoRows || defaultInfoRows(shipment);
  const paneRef = useRef(null);
  const showToast = useToast();

  // Capture this whole pane card as a PNG and share/download it. Uses the
  // global utils/capture.js (view-shot + expo-sharing): native opens the OS
  // share sheet, web downloads the image.
  const shareAsImage = async () => {
    if (!paneRef.current) return;
    try {
      await shareViewAsImage(paneRef, { title: `${title} - ${status.label}` });
      if (Platform.OS === 'web') showToast({ title: 'Image ready', msg: 'PNG downloaded', tone: 'success' });
    } catch (e) {
      showToast({ title: 'Share failed', msg: e.message, tone: 'error' });
    }
  };

  return (
    <View ref={paneRef} collapsable={false} style={styles.shareWrap}>
    <Tray
      title={title}
      colors={PANE_GRAD}
      icon="scan"
      iconColors={PANE_GRAD}
      floating
      style={[styles.tray, style]}
      actionTray={
        <IconTray
          actions={[
            { icon: 'shareImage', label: 'Share as image', onPress: shareAsImage },
            ...(onRefresh ? [{ icon: 'refresh', label: 'Refresh live tracking', onPress: onRefresh }] : []),
            ...(onMail ? [{ icon: 'envelope', label: 'Email tracking', onPress: onMail }] : []),
            ...(onWhatsApp ? [{ icon: 'whatsapp', label: 'WhatsApp tracking', onPress: onWhatsApp }] : []),
            ...(onViewPod ? [{ icon: 'eye', label: podLabel, onPress: onViewPod }] : []),
          ]}
        />
      }
    >
      <StatusLine status={status} raw={shipment.status_raw} loading={loading} />

      {/* ── Shipment details — spec sheet (hero + route + tiles + fallback) ── */}
      <View style={styles.specSheet}>
        {/* Hero strip — AWB badge + date chip */}
        {(rows.find(r => /^awb|reference/i.test(r.l))) ? (
          <View style={styles.specHero}>
            <LinearGradient colors={HERO_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.specHeroBadge}>
              <GradientGlyph name="scan" size={16} colors={['#ffffff', '#ffffff']} />
            </LinearGradient>
            <View style={styles.specHeroBody}>
              <Text style={styles.specHeroLabel}>{rows.find(r => /^awb|reference/i.test(r.l)).l}</Text>
              <GradientText colors={HERO_GRAD} style={styles.specHeroValue} numberOfLines={1}>
                {String(rows.find(r => /^awb|reference/i.test(r.l)).v)}
              </GradientText>
            </View>
            {(rows.find(r => /^(order|booked).*date|date$/i.test(r.l))) ? (
              <View style={styles.specDateChip}>
                <Text style={styles.specDateLabel}>{rows.find(r => /^(order|booked).*date|date$/i.test(r.l)).l}</Text>
                <Text style={styles.specDateValue} numberOfLines={1}>{String(rows.find(r => /^(order|booked).*date|date$/i.test(r.l)).v)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Route line — Origin → Destination */}
        {(rows.find(r => /^origin$/i.test(r.l)) && rows.find(r => /^destination$/i.test(r.l))) ? (
          <View style={styles.specRoute}>
            <View style={styles.specRouteNode}>
              <Text style={styles.specRouteLabel}>Origin</Text>
              <Text style={styles.specRouteValue} numberOfLines={1}>{String(rows.find(r => /^origin$/i.test(r.l)).v)}</Text>
            </View>
            <View style={styles.specRouteArrow}>
              <View style={styles.specRouteLine} />
              <GradientGlyph name="forward" size={13} colors={PANE_GRAD} />
              <View style={styles.specRouteLine} />
            </View>
            <View style={[styles.specRouteNode, { alignItems: 'flex-end' }]}>
              <Text style={styles.specRouteLabel}>Destination</Text>
              <Text style={[styles.specRouteValue, { textAlign: 'right' }]} numberOfLines={1}>{String(rows.find(r => /^destination$/i.test(r.l)).v)}</Text>
            </View>
          </View>
        ) : null}

        {/* Metric tile — Weight (if present) */}
        {(rows.find(r => /^weight|wt\(kg\)/i.test(r.l))) ? (
          <View style={styles.specTileRow}>
            {rows.filter(r => /^weight|wt\(kg\)/i.test(r.l)).map((m, i) => (
              <View key={i} style={styles.specTile}>
                <LinearGradient colors={PANE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.specTileEdge} />
                <Text style={styles.specTileLabel}>{m.l}</Text>
                <GradientText colors={PANE_GRAD} style={styles.specTileValue} numberOfLines={1}>{String(m.v)}</GradientText>
              </View>
            ))}
          </View>
        ) : null}

        {/* Fallback hairline grid — anything not already shown */}
        {(() => {
          const shown = (r) => /^awb|reference/i.test(r.l)
            || /^(order|booked).*date|date$/i.test(r.l)
            || /^origin$/i.test(r.l)
            || /^destination$/i.test(r.l)
            || /^weight|wt\(kg\)/i.test(r.l);
          const rest = rows.filter(r => !shown(r));
          if (!rest.length) return null;
          return (
            <View style={DETAIL_TABLE_STYLES.grid}>
              {rest.map((item, idx) => (
                <View key={idx} style={[DETAIL_TABLE_STYLES.row, item.full && styles.rowFull]}>
                  <View style={[DETAIL_TABLE_STYLES.labelBox, item.full && styles.labelThird]}>
                    <View style={styles.labelRow}>
                      <LinearGradient colors={PANE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.labelTick} />
                      <Text style={DETAIL_TABLE_STYLES.labelText}>{item.l}</Text>
                    </View>
                  </View>
                  <View style={[DETAIL_TABLE_STYLES.valueBox, item.full && styles.valueThreeQ]}>
                    <Text style={DETAIL_TABLE_STYLES.valueText} numberOfLines={item.full ? 3 : 1}>{String(item.v)}</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })()}
      </View>

      <View style={styles.historyBlock}>
        <Timeline movements={sortedMovements} splitByType={splitByType} title={historyTitle} />
      </View>
    </Tray>
    </View>
  );
}

export { normalizeState, sortMovements };

const styles = StyleSheet.create({
  // Capture wrapper — invisible, just anchors the view-shot ref for sharing.
  shareWrap: { alignSelf: 'stretch' },
  tray: { marginTop: 12 },

  // Light holographic status strip
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    backgroundColor: '#fdfbff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...accentSparkle('#e879f9'),
  },
  statusBadgeWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusBadgeIcon: { fontSize: 15 },
  statusBadgeGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 121, 249, 0.28)',
  },
  statusTextWrap: { flex: 1, minWidth: 0 },
  statusLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusLabel: { fontSize: 13.5, fontWeight: '900', letterSpacing: 0.2, color: '#1e293b' },
  statusRaw: { color: '#64748b', fontSize: 10.5, marginTop: 1 },
  statusSyncing: { color: PANE_GRAD[1], fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },

  // Shipment details — spec sheet
  specSheet: { marginBottom: 12 },
  specHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: '#fffbf3',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    ...accentSparkle('#f59e0b'),
  },
  specHeroBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  specHeroBody: { flex: 1, minWidth: 0 },
  specHeroLabel: { fontSize: 8.5, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 },
  specHeroValue: { fontSize: 15, fontWeight: '900', letterSpacing: 0.2, marginTop: 1 },
  specDateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  specDateLabel: { fontSize: 8, fontWeight: '800', color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.5 },
  specDateValue: { fontSize: 10.5, fontWeight: '900', color: '#92400e', marginTop: 1 },

  // Route line
  specRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  specRouteNode: { flex: 1, minWidth: 0 },
  specRouteLabel: { fontSize: 8, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  specRouteValue: { fontSize: 11.5, fontWeight: '800', color: '#1e293b', marginTop: 1 },
  specRouteArrow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specRouteLine: { width: 14, height: 1.5, backgroundColor: '#e9d5ff' },

  // Metric tiles
  specTileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  specTile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },
  specTileEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 3 },
  specTileLabel: { fontSize: 8.5, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 },
  specTileValue: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },

  // Shared table helpers (full-width rows)
  rowFull: { width: '100%' },
  labelThird: { width: '25%' },
  valueThreeQ: { width: '75%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelTick: { width: 3, height: 12, borderRadius: 2 },

  // Timeline section
  historyBlock: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 },

  // Movement rows — numbered nodes on a gradient rail + gradient-edge cards
  movRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 30, alignItems: 'center' },
  railNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#ede9fe',
  },
  railNodeTrack: { backgroundColor: '#ede9fe', borderColor: '#a78bfa' },
  railNodeSystem: { backgroundColor: '#d1fae5', borderColor: '#34d399' },
  railNodeLatest: {
    backgroundColor: PANE_GRAD[1],
    borderColor: PANE_GRAD[1],
    ...(typeof window !== 'undefined'
      ? { boxShadow: '0 0 0 3px rgba(232, 121, 249, 0.22), 0 0 10px rgba(232, 121, 249, 0.45)' }
      : { shadowColor: '#e879f9', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 }),
  },
  railNodeNum: { fontSize: 9, fontWeight: '900', color: '#7c3aed' },
  railNodeNumSystem: { color: '#15803d' },
  railLine: { position: 'absolute', top: 20, bottom: 0, width: 2.5, borderRadius: 2 },
  movCard: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  movCardSystem: { backgroundColor: '#fbfefc', borderColor: '#d1fae5' },
  movCardLatest: {
    backgroundColor: '#fdfbff',
    borderColor: '#e9d5ff',
    ...accentSparkle('#e879f9'),
  },
  movEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3.5 },
  movTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 },
  movKindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderWidth: 1,
  },
  movKindChipTrack: { backgroundColor: '#f5f3ff', borderColor: '#e9d5ff' },
  movKindChipSystem: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  movKindDot: { width: 5, height: 5, borderRadius: 3 },
  movKind: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7, color: '#7c3aed' },
  movKindSystem: { color: '#15803d' },
  movTime: { color: '#94a3b8', fontSize: 9.5, fontWeight: '700' },
  movAct: { color: '#0f172a', fontSize: 12.5, fontWeight: '800', lineHeight: 17 },
  movLoc: { color: '#64748b', fontSize: 10.5, marginTop: 4, fontWeight: '600' },
  emptyBox: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
});
