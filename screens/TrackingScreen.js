import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, Keyboard
} from 'react-native';
import { COLORS } from '../styles/theme';
import Tray from '../components/Tray';
import TrackingPane from '../components/TrackingPane';
import PincodeResult from '../components/PincodeResult';
import Dropdown from '../components/Dropdown';

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

  const subCarrierList = carrier === 'tc' ? TC_CARRIERS : carrier === '17track' ? T17_CARRIERS : [];

  // ── Track Shipment ──────────────────────────────────────────────────────────
  const doTrack = async (forceLive = false) => {
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
      } else if (activeTab === 'live' || forceLive) {
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
      Keyboard.dismiss();
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
      Keyboard.dismiss();
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
        <Tray style={styles.trackCard}>
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
            // Never offer the app's saved user/pass here — Google Smart Lock
            // shows its login popup on any text field without this.
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
          />
          <TouchableOpacity style={styles.trackBtn} onPress={doPincode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.trackBtnText}>SEARCH PINCODE</Text>}
          </TouchableOpacity>
        </Tray>
      ) : (
        /* ── TRACKING TAB ── */
        <Tray style={styles.trackCard}>
          {/* Custom carrier pickers */}
          {activeTab === 'custom' && (
            <>
              <Dropdown
                label="SELECT CARRIER"
                value={carrier}
                options={CUSTOM_CARRIERS.map(c => ({ value: c.value, label: c.label }))}
                onChange={value => { setCarrier(value); setSubCarrier(''); }}
                searchable
                placeholder="Select Carrier"
                style={{ marginBottom: 10 }}
              />

              {/* Sub-carrier picker for tc/17track */}
              {(carrier === 'tc' || carrier === '17track') && (
                <Dropdown
                  label="SELECT SUB-CARRIER"
                  value={subCarrier}
                  options={subCarrierList.map(value => ({ value, label: value }))}
                  onChange={setSubCarrier}
                  searchable
                  placeholder="Select Sub-Carrier"
                  style={{ marginBottom: 10 }}
                />
              )}
            </>
          )}

          <Text style={styles.cardLabel}>AWB / REFERENCE NUMBER</Text>
          <TextInput
            style={styles.input}
            placeholder={activeTab === 'default' ? 'Enter 14-digit Ref or AWB' : 'Enter AWB Number'}
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            autoCorrect={false}
            value={trackRef}
            onChangeText={setTrackRef}
            onSubmitEditing={() => doTrack()}
          />
          {activeTab === 'live' && (
            <Text style={styles.modeHint}>🔴 Fetches live data directly from the carrier API</Text>
          )}
          {activeTab === 'custom' && (
            <Text style={styles.modeHint}>⚙️ Custom carrier — direct API call to selected carrier</Text>
          )}
          <TouchableOpacity style={styles.trackBtn} onPress={() => doTrack()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.trackBtnText}>TRACK SHIPMENT</Text>}
          </TouchableOpacity>
        </Tray>
      )}

      {/* ── Error ── */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* ── Tracking Result ── */}
      {trackResult && (
        <TrackResult
          result={trackResult}
          loading={loading}
          onRefresh={() => doTrack(true)}
        />
      )}

      {/* ── Pincode Result ── */}
      {pincodeResult && <PincodeResult data={pincodeResult} />}
    </ScrollView>
  );
}

// ── Tracking Result Component ─────────────────────────────────────────────────
function TrackResult({ result, loading = false, onRefresh }) {
  const inner = result?.data || result || {};
  const shipment = result?.shipment !== undefined
    ? result.shipment || {}
    : inner.shipment || (inner.movements ? inner : {});
  const movements = result?.shipment !== undefined
    ? result.movements || []
    : inner.movements || [];

  return (
    <TrackingPane
      shipment={shipment}
      movements={movements}
      splitByType
      title="Tracking and History"
      loading={loading}
      onRefresh={onRefresh}
    />
  );
}

function normaliseTracking(data) {
  if (data.shipment !== undefined) return data;
  const inner = data.data || data;
  return {
    ...data,
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

  // Search card — shell (violet sparkling border) lives in components/Tray.js
  trackCard: { padding: 16, marginBottom: 8 },
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

});
