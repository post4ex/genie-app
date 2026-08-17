// components/PincodeResult.js — Shared pincode serviceability result renderer.
// Mirrors GENIE_WEB _smPincodeResult + _smCarrierBlock + _smMobileCards; reused
// by the Track screen and the header Track modal so the result looks identical
// everywhere. Fully static — no Animated.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import Tray from './Tray';

// ── Per-carrier column definitions — mirrors GENIE_WEB _SM_CARRIER_TABLES ─────
const CARRIER_COLS = {
  Jetline: {
    cols: [
      { k: 'pincode', l: 'Pincode' },
      { k: 'city',    l: 'City Name' },
      { k: 'area',    l: 'Area Name' },
      { k: 'state',   l: 'State' },
      { k: 'dox',            l: 'Dox',          yn: true },
      { k: 'ndox',           l: 'Ndox',         yn: true },
      { k: 'topay',          l: 'Topay',        yn: true },
      { k: 'cod',            l: 'COD',          yn: true },
      { k: 'secure',         l: 'Secure',       yn: true },
      { k: 'reverse_pickup', l: 'Rev Pickup',   yn: true },
      { k: 'oda',            l: 'ODA',          yn: true },
    ],
    rows: null,
  },
  Airways: {
    cols: [
      { k: 'pincode', l: 'Pincode' },
      { k: 'city',    l: 'City' },
      { k: 'state',   l: 'State' },
      { k: 'zone',    l: 'Zone' },
      { k: 'area',    l: 'Area' },
      { k: 'oda',     l: 'ODA', yn: true },
    ],
    rows: null,
  },
  Trackon: {
    cols: [
      { k: 'city',             l: 'City' },
      { k: 'state',            l: 'State' },
      { k: 'branch',           l: 'Branch' },
      { k: 'dox',              l: 'Dox',          yn: true },
      { k: 'non_dox',          l: 'Non-Dox',      yn: true },
      { k: 'smart_express',    l: 'Smart Exp',    yn: true },
      { k: 'to_pay',           l: 'To-Pay',       yn: true },
      { k: 'std_oda',          l: 'STD-ODA',      yn: true },
      { k: 'road_exp',         l: 'Road Exp',     yn: true },
      { k: 'road_oda',         l: 'Road ODA',     yn: true },
      { k: 'prime',            l: 'Prime',        yn: true },
      { k: 'prime_plus_12pm',  l: 'Prime +12PM',  yn: true },
      { k: 'e_xpress',         l: 'e-Xpress',     yn: true },
      { k: 'reverse_pickup',   l: 'Rev Pickup',   yn: true },
      { k: 'ops_bm_contactno', l: 'Contact' },
    ],
    rows: null,
  },
  TPC: {
    cols: [
      { k: 'area',        l: 'Area' },
      { k: 'standard',    l: 'Standard',    yn: true },
      { k: 'doc',         l: 'Doc',         yn: true },
      { k: 'parcel',      l: 'Parcel',      yn: true },
      { k: 'pro_premium', l: 'Pro Premium', yn: true },
      { k: 'cod',         l: 'COD',         yn: true },
      { k: 'std_freq',    l: 'Std Freq' },
      { k: 'timing',      l: 'Timing' },
    ],
    rows: r => r.areas || [],
  },
  ShreeMaruti: {
    cols: [
      { k: 'hub',       l: 'Hub' },
      { k: 'area',      l: 'Area' },
      { k: 'area_type', l: 'Type' },
    ],
    rows: r => (r.areas || []).map(a => ({ hub: r.hub, area: a.area, area_type: a.type })),
  },
  Skyking: {
    cols: [
      { k: 'district',    l: 'District' },
      { k: 'state',       l: 'State' },
      { k: 'area',        l: 'Area' },
      { k: 'serviceable', l: 'Serviceable', yn: true },
    ],
    rows: r => (r.areas || []).map(a => ({ district: r.district, state: r.state, area: a.area, serviceable: a.serviceable })),
  },
  PostOffice: {
    cols: [
      { k: 'district', l: 'District' },
      { k: 'state',    l: 'State' },
      { k: 'name',     l: 'Post Office' },
      { k: 'type',     l: 'Type' },
      { k: 'delivery', l: 'Delivery', yn: true },
    ],
    rows: r => (r.offices || []).map(o => ({ district: r.district, state: r.state, name: o.name, type: o.type, delivery: o.delivery })),
  },
  ShreeAnjani: {
    cols: [
      { k: 'center',    l: 'Center' },
      { k: 'franchise', l: 'Franchise' },
      { k: 'contact',   l: 'Contact' },
      { k: 'hub',       l: 'Hub' },
    ],
    rows: r => r.centers || [],
  },
};

const SKIP_KEYS = new Set(['carrier', 'serviceable', '_via', 'pincode', 'couriers', 'areas', 'offices', 'centers']);

// Mirrors _smAutoDef — auto detect cols from object keys when no table definition
function getColDef(carrierName, r) {
  const def = CARRIER_COLS[carrierName];
  if (def) return def;
  const cols = Object.keys(r)
    .filter(k => !SKIP_KEYS.has(k) && r[k] !== null && r[k] !== undefined)
    .map(k => ({
      k,
      l: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      yn: typeof r[k] === 'boolean',
    }));
  return { cols, rows: null };
}

// Mirrors _smPmVal — format Y/N booleans as coloured text
function fmtVal(v, yn) {
  if (yn) {
    if (v === true  || v === 'Y' || v === 'YES' || v === 'Yes') return { text: 'Y', color: '#15803d', bold: true };
    if (v === false || v === 'N' || v === 'NO'  || v === 'No')  return { text: 'N', color: '#b91c1c', bold: false };
  }
  if (v === null || v === undefined || v === '') return { text: '—', color: '#cbd5e1', bold: false };
  return { text: String(v), color: '#1e293b', bold: false };
}

// Mirrors _smCarrierBlock — carrier header + _smMobileCards body, accordion
function CarrierBlock({ r, isOpen, onToggle }) {
  const svc = r.serviceable;
  const def = getColDef(r.carrier, r);
  const dataRows = def.rows ? def.rows(r) : [r];

  return (
    <View style={[styles.carrierBlock, { borderColor: svc ? '#bbf7d0' : '#e2e8f0' }]}>
      {/* Carrier header — tap to expand/collapse */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onToggle}
        style={[styles.carrierBlockHeader, { backgroundColor: svc ? '#f0fdf4' : '#f8fafc', borderBottomColor: svc ? '#bbf7d0' : '#e2e8f0', borderBottomWidth: isOpen ? 1 : 0 }]}
      >
        <View>
          <Text style={styles.carrierBlockName}>{r.carrier}</Text>
          {r._via ? <Text style={styles.carrierBlockVia}>via {r._via}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.svcBadge, { backgroundColor: svc ? '#dcfce7' : '#f1f5f9' }]}>
            <Text style={[styles.svcBadgeText, { color: svc ? '#15803d' : '#6b7280' }]}>
              {svc ? '✓ Serviceable' : 'Not Serviceable'}
            </Text>
          </View>
          <Text style={styles.accordionArrow}>{isOpen ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Body — only shown when this card is the open one */}
      {isOpen && (
        dataRows.length === 0 ? (
          <Text style={styles.noDataText}>No data</Text>
        ) : (
          dataRows.map((row, ri) => (
            <View key={ri} style={[styles.mobileDataCard, { backgroundColor: ri % 2 === 0 ? '#fff' : '#f9fafb' }]}>
              {def.cols.map((col, ci) => {
                const { text, color } = fmtVal(row[col.k], col.yn);
                return (
                  <View key={ci} style={styles.mobileDataRow}>
                    <Text style={styles.mobileDataLabel}>{col.l}</Text>
                    <Text style={[styles.mobileDataValue, { color }]}>{text}</Text>
                  </View>
                );
              })}
            </View>
          ))
        )
      )}
    </View>
  );
}

export default function PincodeResult({ data }) {
  const results = data.results || [];
  const errors = data.errors || [];
  // Single-open accordion: track which card is open by a unique key
  const [openKey, setOpenKey] = useState(null);
  const toggle = (key) => setOpenKey(prev => prev === key ? null : key);

  // Expand Shiprocket couriers into individual rows (exactly like web)
  const expanded = [];
  for (const r of results) {
    if (r.carrier === 'Shiprocket' && Array.isArray(r.couriers) && r.couriers.length) {
      for (const c of r.couriers) {
        expanded.push({ carrier: c.name, serviceable: true, _via: 'Shiprocket',
          cod: c.cod, surface: c.surface, oda: c.oda, etd: c.etd, days: c.days });
      }
    } else {
      expanded.push(r);
    }
  }

  const serviceable = expanded.filter(r => r.serviceable);
  const notServiced = expanded.filter(r => !r.serviceable);

  return (
    <View style={{ marginTop: 12 }}>
      {/* ── 1. Serviceable Carriers Tray ── */}
      {serviceable.length > 0 ? (
        <Tray
          title={`Pincode ${data.pincode} — Serviceable`}
          icon="pincode"
          iconColors={['#10b981', '#22c55e']}
          colors={['#10b981', '#22c55e']}
          right={
            <View style={[styles.pincodeBadge, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.pincodeBadgeText, { color: '#15803d' }]}>
                ✓ {serviceable.length} CARRIER{serviceable.length > 1 ? 'S' : ''}
              </Text>
            </View>
          }
        >
          {serviceable.map((r, i) => {
            const k = `svc-${i}-${r.carrier}`;
            return <CarrierBlock key={k} r={r} isOpen={openKey === k} onToggle={() => toggle(k)} />;
          })}
        </Tray>
      ) : (
        <Tray
          title={`Pincode ${data.pincode}`}
          icon="pincode"
          iconColors={['#ef4444', '#dc2626']}
          colors={['#ef4444', '#dc2626']}
          right={
            <View style={[styles.pincodeBadge, { backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.pincodeBadgeText, { color: '#b91c1c' }]}>
                ✕ None Serviceable
              </Text>
            </View>
          }
        >
          <Text style={styles.noDataText}>No carriers currently service this pincode.</Text>
        </Tray>
      )}

      {/* ── 2. Non-Servicing Carriers Tray ── */}
      {notServiced.length > 0 && (
        <Tray
          title={`Non-Servicing (${notServiced.length})`}
          icon="complaint"
          iconColors={['#64748b', '#94a3b8']}
          colors={['#64748b', '#94a3b8']}
          right={
            <View style={[styles.pincodeBadge, { backgroundColor: '#f1f5f9' }]}>
              <Text style={[styles.pincodeBadgeText, { color: '#64748b' }]}>
                {notServiced.length} Carriers
              </Text>
            </View>
          }
          style={{ marginTop: 4 }}
        >
          {notServiced.map((r, i) => {
            const k = `ns-${i}-${r.carrier}`;
            return <CarrierBlock key={k} r={r} isOpen={openKey === k} onToggle={() => toggle(k)} />;
          })}
        </Tray>
      )}

      {/* Scraper Errors */}
      {errors.length > 0 && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errors.length} scraper error(s)</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Pincode result
  pincodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pincodeTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  pincodeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  pincodeBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionHeader: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 },

  // Carrier block — mirrors _smCarrierBlock
  carrierBlock: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 12, backgroundColor: '#fff' },
  carrierBlockHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  carrierBlockName: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  carrierBlockVia: { fontSize: 9, color: '#6b7280', fontWeight: '600', marginTop: 1 },
  svcBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  svcBadgeText: { fontSize: 10, fontWeight: '700' },
  accordionArrow: { fontSize: 11, color: '#94a3b8', fontWeight: '700' },
  noDataText: { fontSize: 11, color: '#94a3b8', padding: 8 },

  // Mobile data card — one per area/office/center row — mirrors _smMobileCards
  mobileDataCard: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  // Each field row inside a mobile card — mirrors _smMobileCards row div
  mobileDataRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  // Label — crimson uppercase small — mirrors span style color:#9C2007
  mobileDataLabel: { fontSize: 9.5, color: COLORS.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  // Value — right aligned — mirrors span style color:#1e293b
  mobileDataValue: { fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 0, marginLeft: 8 },

  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
});
