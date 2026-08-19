// components/PartiesPane.js — Consignor + Consignee in a single pane
// (view-pane card #3 of the Orders detail view). Extracted from OrdersScreen.js
// so the detail view stays composed of centralized pane components.
//
//   <PartiesPane
//     consignor={[{ l: 'Name', v: cnorName }, ...]}
//     consignee={[{ l: 'Name', v: cneeName }, ...]}
//   />
//
// Each party renders as a colour-coded mini card (amber sender / sky receiver)
// with a GradientGlyph icon, gradient title and label/value detail lines.
// Empty or N/A values are skipped automatically.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Tray from './Tray';
import GradientText from './GradientText';
import { GradientGlyph } from './icons';
import { accentSparkle } from './Tile';

const CONSIGNOR_GRAD = ['#f59e0b', '#ea580c']; // amber → orange (sender)
const CONSIGNEE_GRAD = ['#0ea5e9', '#2563eb']; // sky → blue (receiver)

const isEmpty = (v) => !v || String(v).trim() === '' || String(v).trim() === 'N/A';

function PartyCard({ title, grad, icon, data }) {
  return (
    <View style={[styles.partyCard, accentSparkle(grad[1])]}>
      <View style={styles.partyHeader}>
        <GradientGlyph name={icon} size={18} colors={grad} />
        <GradientText colors={grad} style={styles.partyTitle}>{title}</GradientText>
      </View>
      {data.filter((r) => !isEmpty(r.v)).map((r, i) => (
        <View key={i} style={styles.partyRow}>
          <Text style={styles.partyLabel}>{r.l}</Text>
          <Text style={styles.partyValue} numberOfLines={2}>{String(r.v)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PartiesPane({ consignor = [], consignee = [] }) {
  return (
    <Tray title="Consignor & Consignee" colors={['#9C2007', '#f59e0b']} floating style={styles.trayPad}>
      <View style={styles.columns}>
        <PartyCard title="Consignor" grad={CONSIGNOR_GRAD} icon="package-up" data={consignor} />
        <PartyCard title="Consignee" grad={CONSIGNEE_GRAD} icon="package-down" data={consignee} />
      </View>
    </Tray>
  );
}

const styles = StyleSheet.create({
  columns: { gap: 10 },
  // Extra top padding so the floating title chip clears the Consignor card's border
  trayPad: { paddingTop: 10 },
  partyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  partyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  partyTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 3.5,
    borderTopWidth: 0.5,
    borderTopColor: '#f1f5f9',
  },
  partyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partyValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1e293b',
    flexShrink: 1,
    textAlign: 'right',
  },
});
