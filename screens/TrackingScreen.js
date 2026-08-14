import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Platform
} from 'react-native';
import { COLORS } from '../styles/theme';

const CUSTOM_CARRIERS = [
  { value: 'jetline',    label: 'Jetline'         },
  { value: 'trackon',    label: 'Trackon'         },
  { value: 'delhivery',  label: 'Delhivery'       },
  { value: 'shiprocket', label: 'Shiprocket'      },
  { value: 'bigship',    label: 'Bigship'         },
  { value: 'airways',    label: 'Airways Courier' },
  { value: 'stcourier',  label: 'ST Courier'      },
  { value: 'tc',         label: 'TrackCourier',   isMulti: true },
  { value: '17track',    label: '17Track',        isMulti: true },
];

const TC_CARRIERS = ['DTDC','BLUEDART','INDIAPOST','SPEEDPOST','XPRESSBEES','ECOM','SHADOWFAX','SPOTON','GATI','PROFESSIONAL','SAFEXPRESS','TCI','VXPRESS','MARUTI','VRL'];
const T17_CARRIERS = ['INDIAPOST','SPEEDPOST','DTDC','BLUEDART','XPRESSBEES','ECOM','SHADOWFAX','SPOTON','GATI','PROFESSIONAL','SAFEXPRESS','TCI','MARUTI','DHL','DHLEXPRESS','FEDEX','UPS','ARAMEX'];

const STATE_CONFIG = {
  delivered:      { label: 'Delivered',        bg: '#9C2007', icon: '✅' },
  outfordelivery: { label: 'Out for Delivery', bg: '#2563eb', icon: '🚚' },
  intransit:      { label: 'In Transit',       bg: '#d97706', icon: '📦' },
  exception:      { label: 'Exception',        bg: '#dc2626', icon: '⚠️' },
  pending:        { label: 'Pending / Booked', bg: '#6b7280', icon: '🕐' },
};

function refOrAwb(q) {
  return /^\d{14}$/.test(q) ? `ref=${encodeURIComponent(q)}` : `awb=${encodeURIComponent(q)}`;
}

export default function TrackingScreen({ token, apiBase, orders, shipmentsMap }) {
  const [activeTab, setActiveTab] = useState('default'); // 'default'|'live'|'custom'|'pincode'
  const [trackRef, setTrackRef] = useState('');
  const [pincode, setPincode] = useState('');
  const [carrier, setCarrier] = useState('');
  const [subCarrier, setSubCarrier] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackResult, setTrackResult] = useState(null);
  const [pincodeResult, setPincodeResult] = useState(null);
  const [error, setError] = useState('');

  const selectedCarrierObj = CUSTOM_CARRIERS.find(c => c.value === carrier);
  const subCarrierList = carrier === 'tc' ? TC_CARRIERS : carrier === '17track' ? T17_CARRIERS : [];

  // ── Track Shipment ──────────────────────────────────────────────────────────
  const doTrack = async () => {
    const raw = trackRef.trim().replace(/[^a-zA-Z0-9\-\/]/g, '');
    if (!raw || raw.length < 4) { setError('Enter at least 4 characters.'); return; }
    setLoading(true); setTrackResult(null); setPincodeResult(null); setError('');

    try {
      let url;
      if (activeTab === 'custom') {
        if (!carrier) { setError('Select a carrier.'); setLoading(false); return; }
        if ((carrier === 'tc' || carrier === '17track') && !subCarrier) {
          setError('Select a sub-carrier.'); setLoading(false); return;
        }
        if (carrier === 'tc') {
          url = `${apiBase}/api/track/custom/tc?carrier=${encodeURIComponent(subCarrier)}&awb=${encodeURIComponent(raw)}`;
        } else if (carrier === '17track') {
          url = `${apiBase}/api/track/custom/17track?carrier=${encodeURIComponent(subCarrier)}&awb=${encodeURIComponent(raw)}`;
        } else {
          url = `${apiBase}/api/track/custom/${carrier}?awb=${encodeURIComponent(raw)}`;
        }
      } else if (activeTab === 'live') {
        url = `${apiBase}/api/track/live?${refOrAwb(raw)}`;
      } else {
        // default
        url = `${apiBase}/api/movements?${refOrAwb(raw)}`;
      }

      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

      if (res.status === 401) { setError('Session expired. Please log in again.'); setLoading(false); return; }
      if (res.status === 404) { setError('Shipment not found.'); setLoading(false); return; }
      if (res.status === 400) { setError('Invalid AWB or reference number.'); setLoading(false); return; }
      if (!res.ok) { setError(`Request failed (${res.status}).`); setLoading(false); return; }

      const data = await res.json();
      if (!data || (Array.isArray(data) && !data.length)) {
        setError('No tracking data found.'); setLoading(false); return;
      }
      setTrackResult(normaliseTracking(data));
    } catch (e) {
      // Offline fallback — search local storage
      const qUpper = raw.toUpperCase();
      const localOrder = (orders || []).find(o =>
        (o.REFERENCE || '').toUpperCase() === qUpper ||
        (o.AWB_NUMBER || '').toUpperCase() === qUpper
      );
      const localShip = (shipmentsMap || {})[localOrder?.REFERENCE || raw] || {};
      if (localOrder || localShip.reference) {
        setTrackResult({
          shipment: {
            reference: localOrder?.REFERENCE || raw,
            awb: localOrder?.AWB_NUMBER || 'Pending',
            origin: localOrder?.ORIGIN_CITY || '',
            destination: localOrder?.DEST_CITY || '',
            booked_date: localOrder?.ORDER_DATE || '',
            weight: localOrder?.WEIGHT || '',
            state: localShip.state || localOrder?.STATE || 'pending',
            carrier_name: localOrder?.CARRIER || '',
          },
          movements: [],
        });
      } else {
        setError('Network error. No local data found for this reference.');
      }
    }
    setLoading(false);
  };

  // ── Pincode Search ──────────────────────────────────────────────────────────
  const doPincode = async () => {
    if (!pincode || !/^[0-9]{6}$/.test(pincode.trim())) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setLoading(true); setTrackResult(null); setPincodeResult(null); setError('');
    try {
      const res = await fetch(`${apiBase}/api/pincode?pincode=${pincode.trim()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { setError(`Request failed (${res.status}).`); setLoading(false); return; }
      const data = await res.json();
      setPincodeResult(data);
    } catch (e) {
      setError('Network error. Please check your connection.');
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.scrollPage} keyboardShouldPersistTaps="handled">
      <Text style={styles.pageTitle}>Track & Search</Text>

      {/* ── Mode Tabs ── */}
      <View style={styles.modeTabs}>
        {['default', 'live', 'custom', 'pincode'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.modeTab, activeTab === tab && styles.modeTabActive]}
            onPress={() => { setActiveTab(tab); setError(''); setTrackResult(null); setPincodeResult(null); }}
          >
            <Text style={[styles.modeTabText, activeTab === tab && styles.modeTabTextActive]}>
              {tab === 'default' ? 'Default' : tab === 'live' ? 'Live' : tab === 'custom' ? 'Custom' : '📍 Pincode'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PINCODE TAB ── */}
      {activeTab === 'pincode' ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>6-DIGIT PINCODE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 248001"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            maxLength={6}
            value={pincode}
            onChangeText={setPincode}
            onSubmitEditing={doPincode}
          />
          <TouchableOpacity style={styles.trackBtn} onPress={doPincode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.trackBtnText}>SEARCH PINCODE</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        /* ── TRACKING TAB ── */
        <View style={styles.card}>
          {/* Custom carrier pickers */}
          {activeTab === 'custom' && (
            <>
              <Text style={styles.cardLabel}>SELECT CARRIER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {CUSTOM_CARRIERS.map(c => (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.carrierChip, carrier === c.value && styles.carrierChipActive]}
                      onPress={() => { setCarrier(c.value); setSubCarrier(''); }}
                    >
                      <Text style={[styles.carrierChipText, carrier === c.value && styles.carrierChipTextActive]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Sub-carrier picker for tc/17track */}
              {(carrier === 'tc' || carrier === '17track') && (
                <>
                  <Text style={styles.cardLabel}>SELECT SUB-CARRIER</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {subCarrierList.map(sc => (
                        <TouchableOpacity
                          key={sc}
                          style={[styles.carrierChip, subCarrier === sc && styles.carrierChipActive]}
                          onPress={() => setSubCarrier(sc)}
                        >
                          <Text style={[styles.carrierChipText, subCarrier === sc && styles.carrierChipTextActive]}>
                            {sc}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </>
          )}

          <Text style={styles.cardLabel}>AWB / REFERENCE NUMBER</Text>
          <TextInput
            style={styles.input}
            placeholder={activeTab === 'default' ? 'Enter 14-digit Ref or AWB' : 'Enter AWB Number'}
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            value={trackRef}
            onChangeText={setTrackRef}
            onSubmitEditing={doTrack}
          />
          {activeTab === 'live' && (
            <Text style={styles.modeHint}>🔴 Fetches live data directly from the carrier API</Text>
          )}
          {activeTab === 'custom' && (
            <Text style={styles.modeHint}>⚙️ Custom carrier — direct API call to selected carrier</Text>
          )}
          <TouchableOpacity style={styles.trackBtn} onPress={doTrack} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.trackBtnText}>TRACK SHIPMENT</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Error ── */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* ── Tracking Result ── */}
      {trackResult && <TrackResult result={trackResult} />}

      {/* ── Pincode Result ── */}
      {pincodeResult && <PincodeResult data={pincodeResult} />}
    </ScrollView>
  );
}

// ── Tracking Result Component ─────────────────────────────────────────────────
function TrackResult({ result }) {
  let shipment, rawMovements;
  if (result.shipment !== undefined) {
    shipment = result.shipment || {};
    rawMovements = result.movements || [];
  } else {
    const inner = result.data || result;
    shipment = inner.shipment || (inner.movements ? inner : {});
    rawMovements = inner.movements || [];
  }

  // Separate TRACK and SYSTEM movements
  const trackMovs = [];
  const systemMovs = [];

  rawMovements.forEach(m => {
    const type = String(m.move_type || m.MOVE_TYPE || 'TRACK').toUpperCase();
    if (type === 'SYSTEM') {
      systemMovs.push(m);
    } else {
      trackMovs.push(m);
    }
  });

  const getRN = m => {
    const rn = m.row_number !== undefined ? m.row_number : m.ROW_NUMBER;
    return (rn !== null && rn !== undefined) ? Number(rn) : 0;
  };

  // Sort BOTH TRACK and SYSTEM descending by row_number (max row on top down to 1)
  trackMovs.sort((a, b) => getRN(b) - getRN(a));
  systemMovs.sort((a, b) => getRN(b) - getRN(a));

  const rawState = (shipment.state || shipment.STATE || 'pending').toLowerCase();
  const sc = STATE_CONFIG[rawState] || STATE_CONFIG.pending;

  const infoItems = [
    { label: 'Reference',   value: shipment.reference || shipment.REFERENCE },
    { label: 'AWB No.',     value: shipment.awb || shipment.carrier_awb },
    { label: 'Origin',      value: shipment.carrier_origin || shipment.origin },
    { label: 'Destination', value: shipment.carrier_destination || shipment.destination },
    { label: 'Booked On',   value: shipment.booked_date || shipment.order_date },
    { label: 'Weight',      value: shipment.weight ? `${shipment.weight} kg · ${shipment.pieces || 1} pcs` : null },
  ].filter(i => i.value);

  return (
    <View style={{ marginTop: 12 }}>
      {/* Info Grid */}
      <View style={styles.infoGrid}>
        {infoItems.map((item, i) => (
          <View key={i} style={styles.infoCard}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
        <Text style={styles.statusIcon}>{sc.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusLabel}>{sc.label}</Text>
          {(shipment.carrier_name || shipment.carrier) ? (
            <Text style={styles.statusCarrier}>{shipment.carrier_name || shipment.carrier}</Text>
          ) : null}
          {shipment.status_raw ? <Text style={styles.statusRaw}>{shipment.status_raw}</Text> : null}
        </View>
      </View>

      {/* ── Room 1: Courier Tracking Scans ── */}
      <Text style={styles.sectionHeader}>📍 COURIER TRACKING SCANS ({trackMovs.length})</Text>
      {trackMovs.length > 0 ? trackMovs.map((m, i) => (
        <View key={i} style={[styles.movCard, i === 0 ? styles.movCardLatest : styles.movCardPast]}>
          <View style={styles.movHeader}>
            <Text style={[styles.movAct, i === 0 && styles.movActLatest, { flex: 1 }]} numberOfLines={2}>
              {m.activity || m.ACTIVITY || ''}
            </Text>
            <Text style={styles.movTime}>{m.date || m.DATE || ''} {m.time || m.TIME || ''}</Text>
          </View>
          {(m.location || m.LOCATION) ? (
            <Text style={styles.movLoc}>📍 {m.location || m.LOCATION}</Text>
          ) : null}
        </View>
      )) : (
        <View style={[styles.emptyBox, { marginBottom: 16 }]}>
          <Text style={styles.emptyText}>No courier tracking scans recorded yet.</Text>
        </View>
      )}

      {/* ── Room 2: System & Booking Events ── */}
      <Text style={[styles.sectionHeader, { marginTop: 12 }]}>⚙️ SYSTEM & BOOKING EVENTS ({systemMovs.length})</Text>
      {systemMovs.length > 0 ? systemMovs.map((m, i) => (
        <View key={i} style={[styles.movCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <View style={styles.movHeader}>
            <Text style={[styles.movAct, { color: '#166534', flex: 1 }]} numberOfLines={2}>
              {m.activity || m.ACTIVITY || ''}
            </Text>
            <Text style={styles.movTime}>{m.date || m.DATE || ''} {m.time || m.TIME || ''}</Text>
          </View>
          {(m.location || m.LOCATION) ? (
            <Text style={styles.movLoc}>📍 {m.location || m.LOCATION}</Text>
          ) : null}
        </View>
      )) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No system events recorded.</Text>
        </View>
      )}
    </View>
  );
}

// ── Pincode Result Component ──────────────────────────────────────────────────
function PincodeResult({ data }) {
  const results = data.results || [];
  const errors = data.errors || [];
  // Single-open accordion: track which card is open by a unique key
  const [openKey, setOpenKey] = React.useState(null);
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
      {/* Header */}
      <View style={styles.pincodeHeader}>
        <Text style={styles.pincodeTitle}>📍 {data.pincode}</Text>
        <View style={[styles.pincodeBadge, { backgroundColor: serviceable.length ? '#dcfce7' : '#fef2f2' }]}>
          <Text style={[styles.pincodeBadgeText, { color: serviceable.length ? '#15803d' : '#b91c1c' }]}>
            {serviceable.length ? `${serviceable.length} serviceable` : 'None serviceable'}
          </Text>
        </View>
      </View>

      {serviceable.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>✅ {serviceable.length} CARRIER{serviceable.length > 1 ? 'S' : ''} SERVICE THIS PINCODE</Text>
          {serviceable.map((r, i) => {
            const k = `svc-${i}-${r.carrier}`;
            return <CarrierBlock key={k} r={r} isOpen={openKey === k} onToggle={() => toggle(k)} />;
          })}
        </>
      )}
      {notServiced.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { color: '#9ca3af' }]}>❌ {notServiced.length} NOT SERVICING</Text>
          {notServiced.map((r, i) => {
            const k = `ns-${i}-${r.carrier}`;
            return <CarrierBlock key={k} r={r} isOpen={openKey === k} onToggle={() => toggle(k)} />;
          })}
        </>
      )}
      {errors.length > 0 && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errors.length} scraper error(s)</Text>
        </View>
      )}
    </View>
  );
}

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

function normaliseTracking(data) {
  if (data.shipment !== undefined) return data;
  const inner = data.data || data;
  return {
    shipment: inner.shipment || (inner.movements ? inner : {}),
    movements: inner.movements || [],
  };
}

const styles = StyleSheet.create({
  scrollPage: { flex: 1, padding: 16 },
  pageTitle: { color: '#1e293b', fontSize: 22, fontWeight: '800', marginBottom: 12 },

  // Mode tabs
  modeTabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  modeTab: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  modeTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeTabText: { fontSize: 12, fontWeight: '700', color: '#475569', textAlign: 'center' },
  modeTabTextActive: { color: '#ffffff' },

  // Search card
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#e8c98a', marginBottom: 8 },
  cardLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderBottomWidth: 2, borderBottomColor: '#cbd5e1', paddingVertical: 10, paddingHorizontal: 6, fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 14 },
  modeHint: { fontSize: 11, color: '#64748b', marginBottom: 12, fontWeight: '600' },
  trackBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  trackBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Carrier chips
  carrierChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  carrierChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  carrierChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  carrierChipTextActive: { color: '#ffffff' },

  // Error
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  infoCard: { width: '48.5%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  infoLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },

  // Status banner
  statusBanner: { borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { fontSize: 26 },
  statusLabel: { color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  statusCarrier: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusRaw: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },

  // Movement
  sectionHeader: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 },
  movCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 8 },
  movCardLatest: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  movCardPast: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  movHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  movAct: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1, marginRight: 8 },
  movActLatest: { color: '#1d4ed8' },
  movTime: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  movLoc: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  emptyBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

  // Pincode result
  pincodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pincodeTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  pincodeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  pincodeBadgeText: { fontSize: 11, fontWeight: '700' },

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
});
