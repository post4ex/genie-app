// components/TrackModal.js — Header Track modal, redesigned on the app's shared
// components: joined segmented mode switch (TrackingPane style), the global
// SearchBar (magnify + barcode scan built in), Dropdown fields for custom
// carriers, and the shared PincodeResult. Result renders through TrackingPane.
// Fully static — no Animated (crash-safe pattern).

import React, { useState } from 'react';
import {
  StyleSheet, Modal, View, Text, TouchableOpacity,
  ScrollView, Platform, Keyboard, KeyboardAvoidingView, Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../styles/theme';
import { fmtDate } from '../utils/formatIST';
import Tray from './Tray';
import TrackingPane from './TrackingPane';
import PincodeResult from './PincodeResult';
import SearchBar from './SearchBar';
import Dropdown from './Dropdown';
import Button from './Button';
import GradientText from './GradientText';
import SegmentedToggle from './SegmentedToggle';
import { GradientGlyph } from './icons';

const MODE_GRAD = ['#9C2007', '#f59e0b'];   // brand maroon → amber

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

// Modes — Default / Live / Custom / Pincode (Track-Pincode swap restored).
const MODES = [
  { key: 'default', label: 'Default',  icon: 'package-variant-closed' },
  { key: 'live',    label: 'Live',     icon: 'radio-tower' },
  { key: 'custom',  label: 'Custom',   icon: 'truck-fast' },
  { key: 'pincode', label: 'Pincode',  icon: 'map-marker' },
];

function refOrAwb(q) {
  return /^\d{14}$/.test(q) ? `ref=${encodeURIComponent(q)}` : `awb=${encodeURIComponent(q)}`;
}

// Same shape normaliser the Track screen uses — /api/movements may return the
// { shipment, movements } object directly or a nested { data: … } wrapper.
function normaliseTracking(data) {
  if (data.shipment !== undefined) return data;
  const inner = data.data || data;
  return {
    ...data,
    shipment: inner.shipment || (inner.movements ? inner : {}),
    movements: inner.movements || [],
  };
}

export default function TrackModal({ visible, onClose, token, apiBase, orders = [], shipmentsMap = {} }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('default');
  const [trackRef, setTrackRef] = useState('');
  const [pincode, setPincode] = useState('');
  const [carrier, setCarrier] = useState('');
  const [subCarrier, setSubCarrier] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackResult, setTrackResult] = useState(null);
  const [pincodeResult, setPincodeResult] = useState(null);
  const [error, setError] = useState('');

  const subCarrierList = carrier === 'tc' ? TC_CARRIERS : carrier === '17track' ? T17_CARRIERS : [];
  const isPincode = activeTab === 'pincode';

  const close = () => {
    if (loading) return;
    onClose();
  };

  const reset = () => {
    setTrackResult(null);
    setPincodeResult(null);
    setError('');
  };

  const switchTab = (key) => {
    setActiveTab(key);
    setCarrier('');
    setSubCarrier('');
    reset();
  };

  const doTrack = async (forceLive = false) => {
    const raw = trackRef.trim().replace(/[^a-zA-Z0-9\-\/]/g, '');
    if (!raw || raw.length < 4) { setError('Enter at least 4 characters.'); return; }
    setLoading(true);
    setTrackResult(null);
    setPincodeResult(null);
    setError('');

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

  const doPincode = async () => {
    if (!pincode || !/^[0-9]{6}$/.test(pincode.trim())) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setLoading(true);
    setTrackResult(null);
    setPincodeResult(null);
    setError('');
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

  // Same lenient resolution as the Track screen's TrackResult — the pane shows
  // whether the API returns { shipment, movements }, a nested { data: … }
  // wrapper, or a bare movements array (inner is treated as the shipment).
  const rawResult = trackResult ? (trackResult.data || trackResult) : null;
  const result = rawResult && (rawResult.shipment !== undefined || rawResult.movements !== undefined) ? rawResult : null;
  const shipment = result?.shipment !== undefined
    ? (result.shipment || {})
    : (result?.movements ? result : {});
  const movements = result?.shipment !== undefined
    ? (result.movements || [])
    : (result?.movements || []);

  // Same spec-sheet rows Orders uses — Reference/AWB hero + Booked Date chip,
  // route line, no weight/extra date rows. Dates are formatted for display.
  // Prefer the local order's ORDER_DATE (authoritative booking date) over the
  // carrier's booked_date, which can be the carrier pickup date instead.
  const localOrder = (orders || []).find(o =>
    String(o?.REFERENCE || '') === String(shipment?.reference || '') ||
    (o?.AWB_NUMBER && shipment?.awb && String(o.AWB_NUMBER) === String(shipment.awb))
  );
  const bookedDate = localOrder?.ORDER_DATE || shipment?.booked_date || shipment?.order_date;
  const paneRows = [
    { l: 'AWB Number', v: shipment?.awb || shipment?.awb_number || shipment?.reference || 'N/A' },
    { l: 'Booked Date', v: fmtDate(bookedDate, 'date') },
    { l: 'Origin', v: shipment?.carrier_origin || shipment?.origin || localOrder?.ORIGIN_CITY },
    { l: 'Destination', v: shipment?.carrier_destination || shipment?.destination || localOrder?.DEST_CITY },
  ].filter(row => row.v !== null && row.v !== undefined && row.v !== '' && row.v !== 'N/A');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <GradientGlyph name="scan" size={20} colors={MODE_GRAD} />
                <View>
                  <GradientText colors={MODE_GRAD} style={styles.title}>Track Shipment</GradientText>
                  <Text style={styles.subtitle}>AWB / Reference · Pincode</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close track">
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 18 }}
            >
              {/* ── Joined segmented mode switch (shared SegmentedToggle) ── */}
              <SegmentedToggle
                options={MODES}
                value={activeTab}
                onChange={switchTab}
                colors={MODE_GRAD}
                size="sm"
                flex
                iconSize={12}
                idleIconColor={['#94a3b8', '#94a3b8']}
                style={styles.segGap}
              />

              {isPincode ? (
                /* ── PINCODE MODE ── */
                <Tray style={styles.trackCard}>
                  <Text style={styles.cardLabel}>6-DIGIT PINCODE</Text>
                  <SearchBar
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="e.g. 248001"
                    hideScanner
                    keyboardType="numeric"
                    maxLength={6}
                    onSubmitEditing={doPincode}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    icon="pincode"
                    loading={loading}
                    onPress={doPincode}
                    style={{ marginTop: 12 }}
                  >
                    SEARCH PINCODE
                  </Button>
                </Tray>
              ) : (
                /* ── TRACKING MODES ── */
                <Tray style={styles.trackCard}>
                  {activeTab === 'custom' && (
                    <View style={styles.dropdownRow}>
                      <Dropdown
                        label="CARRIER"
                        value={carrier}
                        options={CUSTOM_CARRIERS.map(c => ({ value: c.value, label: c.label }))}
                        onChange={setCarrier}
                        placeholder="Select carrier"
                        style={styles.dropdownHalf}
                      />
                      {(carrier === 'tc' || carrier === '17track') && (
                        <Dropdown
                          label="SUB-CARRIER"
                          value={subCarrier}
                          options={subCarrierList.map(s => ({ value: s, label: s }))}
                          onChange={setSubCarrier}
                          placeholder="Sub-carrier"
                          searchable
                          style={styles.dropdownHalf}
                        />
                      )}
                    </View>
                  )}

                  <Text style={[styles.cardLabel, activeTab === 'custom' && { marginTop: 12 }]}>
                    AWB / REFERENCE NUMBER
                  </Text>
                  <SearchBar
                    value={trackRef}
                    onChangeText={setTrackRef}
                    placeholder={activeTab === 'default' ? 'Enter 14-digit Ref or AWB' : 'Enter AWB Number'}
                    onSubmitEditing={() => doTrack()}
                  />

                  {activeTab === 'live' && (
                    <Text style={styles.modeHint}>🔴 Fetches live data directly from the carrier API</Text>
                  )}
                  {activeTab === 'custom' && (
                    <Text style={styles.modeHint}>⚙️ Custom carrier — direct API call to selected carrier</Text>
                  )}

                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    icon="search"
                    loading={loading}
                    onPress={() => doTrack()}
                    style={{ marginTop: 12 }}
                  >
                    TRACK SHIPMENT
                  </Button>
                </Tray>
              )}

              {/* Error */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              {/* Tracking result */}
              {result && (
                <TrackingPane
                  shipment={shipment}
                  movements={movements}
                  infoRows={paneRows}
                  splitByType
                  title="Tracking and History"
                  loading={loading}
                  onRefresh={() => doTrack(true)}
                />
              )}

              {/* Pincode result */}
              {pincodeResult && <PincodeResult data={pincodeResult} />}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 760 : '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '94%',
    alignSelf: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -4px 24px rgba(0, 0, 0, 0.18)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  body: { flex: 1, minHeight: 0, padding: 14 },

  // Carrier + sub-carrier dropdowns share one row (flex) when both visible
  dropdownRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  dropdownHalf: { flex: 1, minWidth: 0 },

  // Joined segmented mode switch (shell lives in components/SegmentedToggle.js)
  segGap: { marginBottom: 12 },

  // Search card
  trackCard: { padding: 16, marginBottom: 8 },
  cardLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  modeHint: { fontSize: 11, color: '#64748b', marginTop: 10, fontWeight: '600' },

  // Error
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
});
