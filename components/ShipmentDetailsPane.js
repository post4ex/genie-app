// components/ShipmentDetailsPane.js — Shipment Details pane (view-pane card #2
// of the Orders detail view). Extracted from OrdersScreen.js so the whole
// detail view is composed from centralized pane components instead of inline
// cards.
//
//   <ShipmentDetailsPane
//     rows={shipmentDetailsTable}          // [{ l: label, v: value }]
//     canEdit={!o.INV_NUMBER}
//     onUpdateStatus={() => setUpdateStatusTargetOrder(o)}
//     onEdit={...}
//     onCopy={handleCopy}
//     onShare={handleShare}
//     onMail={() => mailShipment(o)}
//     onWhatsApp={() => waShipment(o)}
//     onDelete={() => deleteOrder(o)}
//   />
//
// Futuristic treatment: sparkle-tinted grid border (shared accentSparkle),
// gradient tick per label, gradient-painted money/numeric values (GradientText),
// Yes/No as tinted pills, placeholders muted.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Tray from './Tray';
import IconTray from './IconTray';
import GradientText from './GradientText';
import { accentSparkle } from './Tile';

// Pane identity gradients (match the floating title chip)
const PANE_GRAD = ['#0ea5e9', '#2563eb'];   // sky → blue
const MONEY_GRAD = ['#0d9488', '#14b8a6'];  // teal → light teal

// Exported so the Carrier Tracking card (still inline in OrdersScreen) reuses
// the same table grid — one source of truth for the label/value table look.
export const DETAIL_TABLE_STYLES = StyleSheet.create({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderRadius: 12, overflow: 'hidden', borderWidth: 1.5,
    ...accentSparkle('#2563eb'),
  },
  row: { width: '50%', flexDirection: 'row', borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#eef2f7' },
  labelBox: { width: '50%', backgroundColor: '#f8fafc', paddingVertical: 7, paddingHorizontal: 9, borderRightWidth: 0.5, borderColor: '#eef2f7', justifyContent: 'center' },
  labelText: { fontSize: 9.5, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  valueBox: { width: '50%', backgroundColor: '#ffffff', paddingVertical: 7, paddingHorizontal: 9, justifyContent: 'center' },
  valueText: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
});

// Smart value renderer: ₹ amounts → teal gradient, numbers → pane gradient,
// Yes/No → tinted pills, empty/placeholder → muted italic.
function SmartValue({ v }) {
  const str = String(v == null ? '' : v);
  if (!str || str === '—' || str === '-' || /^n\/?a$/i.test(str)) {
    return <Text style={[DETAIL_TABLE_STYLES.valueText, styles.valueMuted]}>{str || '—'}</Text>;
  }
  if (/^yes$/i.test(str)) {
    return (
      <View style={[styles.badge, styles.badgeYes]}>
        <Text style={styles.badgeYesText}>Yes</Text>
      </View>
    );
  }
  if (/^no$/i.test(str)) {
    return (
      <View style={[styles.badge, styles.badgeNo]}>
        <Text style={styles.badgeNoText}>No</Text>
      </View>
    );
  }
  if (/^₹/.test(str)) {
    return <GradientText colors={MONEY_GRAD} style={styles.valueNum}>{str}</GradientText>;
  }
  if (/\d/.test(str)) {
    return <GradientText colors={PANE_GRAD} style={styles.valueNum}>{str}</GradientText>;
  }
  return <Text style={DETAIL_TABLE_STYLES.valueText}>{str}</Text>;
}

export default function ShipmentDetailsPane({
  rows = [],
  canEdit = true,
  onUpdateStatus,
  onEdit,
  onCopy,
  onShare,
  onMail,
  onWhatsApp,
  onDelete,
}) {
  const actions = [
    { icon: 'checkCircle', label: 'Update Status', onPress: onUpdateStatus },
    ...(canEdit ? [{ icon: 'edit', label: 'Edit', onPress: onEdit }] : []),
    { icon: 'copy', label: 'Copy', onPress: onCopy },
    { icon: 'share', label: 'Share', onPress: onShare },
    { icon: 'envelope', label: 'Email', onPress: onMail },
    { icon: 'whatsapp', label: 'WhatsApp', onPress: onWhatsApp },
    { icon: 'trash', label: 'Delete', onPress: onDelete },
  ];

  return (
    <Tray
      title="Shipment Details"
      colors={PANE_GRAD}
      floating
      actionTray={
        <IconTray actions={actions} />
      }
    >
      <View style={DETAIL_TABLE_STYLES.grid}>
        {rows.map((item, idx) => (
          <View key={idx} style={[DETAIL_TABLE_STYLES.row, item.full && styles.rowFull]}>
            <View style={[DETAIL_TABLE_STYLES.labelBox, item.full && styles.labelThird]}>
              <View style={styles.labelRow}>
                <LinearGradient colors={PANE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.labelTick} />
                <Text style={DETAIL_TABLE_STYLES.labelText}>{item.l}</Text>
              </View>
            </View>
            <View style={[DETAIL_TABLE_STYLES.valueBox, item.full && styles.valueThreeQ]}>
              <SmartValue v={item.v} />
            </View>
          </View>
        ))}
      </View>
    </Tray>
  );
}

const styles = StyleSheet.create({
  rowFull: { width: '100%' },
  labelThird: { width: '25%' },
  valueThreeQ: { width: '75%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelTick: { width: 3, height: 12, borderRadius: 2 },
  valueNum: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  valueMuted: { color: '#94a3b8', fontWeight: '600', fontStyle: 'italic' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeYes: { backgroundColor: '#dcfce7' },
  badgeYesText: { color: '#15803d', fontSize: 10, fontWeight: '800' },
  badgeNo: { backgroundColor: '#f1f5f9' },
  badgeNoText: { color: '#64748b', fontSize: 10, fontWeight: '700' },
});
