// components/AssignCarrierModal.js — Dedicated Assign Carrier & AWB bottom sheet modal,
// matching BookOrderScreen SearchBar AWB box, centralized Dropdown for Carriers,
// DatePickerModal for dates, and removing legacy Dynamic AWB field.

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, Modal, ScrollView, Pressable, TouchableOpacity,
  TextInput, Platform, Keyboard, KeyboardAvoidingView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import Dropdown from './Dropdown';
import DatePickerModal from './DatePickerModal';
import SearchBar from './SearchBar';
import GradientText from './GradientText';
import Icon, { GradientGlyph } from './icons';

const BRAND = ['#9C2007', '#f59e0b'];
const CARRIER_OPTIONS = [
  'DELHIVERY', 'BLUEDART', 'DTDC', 'TRACKON', 'PROFESSIONAL',
  'SAFEEXPRESS', 'SPOTON', 'V-XPRESS', 'TCI EXPRESS', 'FEDEX', 'DHL', 'OTHER'
];

export default function AssignCarrierModal({
  visible,
  onClose,
  order,
  token,
  apiBase,
  b2b2cMap = {},
  onSuccess
}) {
  const insets = useSafeAreaInsets();
  const [carrier, setCarrier] = useState('');
  const [awb, setAwb] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [transitDate, setTransitDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Date picker modal controls
  const [datePickerTarget, setDatePickerTarget] = useState(null); // 'order' | 'transit' | null

  const reference = order?.REFERENCE || order?.AWB_NUMBER || 'No Ref';
  const consigneeName = b2b2cMap[order?.CONSIGNEE]?.NAME || order?.CONSIGNEE || '—';
  const nos = order?.PIECS || '—';
  const weight = order?.WEIGHT ? `${order.WEIGHT}kg` : '—';

  useEffect(() => {
    if (visible && order) {
      setCarrier(order.CARRIER || '');
      setAwb(order.AWB_NUMBER || '');
      setOrderDate(order.ORDER_DATE ? formatDateStr(order.ORDER_DATE) : '');
      setTransitDate(order.TRANSIT_DATE ? formatDateStr(order.TRANSIT_DATE) : '');
      setErrorMsg('');
      setDatePickerTarget(null);
    }
  }, [visible, order]);

  const formatDateStr = (val) => {
    if (!val) return '';
    const date = new Date(typeof val === 'number' ? (val > 1e10 ? val : val * 1000) : val);
    if (isNaN(date.getTime())) return String(val);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSubmit = async () => {
    if (!carrier.trim()) {
      setErrorMsg('Please select a Carrier.');
      return;
    }
    if (!awb.trim()) {
      setErrorMsg('Please enter or scan an AWB Number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        reference: reference,
        CARRIER: carrier.trim().toUpperCase(),
        AWB_NUMBER: awb.trim().toUpperCase(),
      };
      if (orderDate.trim()) payload.ORDER_DATE = new Date(orderDate.trim()).getTime();
      if (transitDate.trim()) payload.TRANSIT_DATE = new Date(transitDate.trim()).getTime();

      const res = await fetch(`${apiBase}/api/updateOrder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Failed to assign carrier & AWB');
      }

      setLoading(false);
      Keyboard.dismiss();
      onClose();
      if (onSuccess) onSuccess(reference, carrier.trim().toUpperCase(), awb.trim().toUpperCase());
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Network error assigning carrier');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <GradientGlyph name="truck-check" size={22} colors={BRAND} />
                <View style={{ flex: 1 }}>
                  <GradientText colors={BRAND} style={styles.title} numberOfLines={1}>Assign Carrier : {reference}</GradientText>
                  {/* Consignee / Nos / Weight strip */}
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaValue, styles.metaConsignee]} numberOfLines={1}>{consigneeName}</Text>
                    <View style={styles.metaDivider} />
                    <Text style={styles.metaValue}>Nos: {nos}</Text>
                    <View style={styles.metaDivider} />
                    <Text style={styles.metaValue}>Wt: {weight}</Text>
                  </View>
                </View>
                <Button
                  variant="tint"
                  size="sm"
                  iconOnly
                  icon="close"
                  onPress={onClose}
                  accessibilityLabel="Close assign carrier modal"
                  style={{ marginLeft: 6 }}
                />
              </View>
            </View>

            {/* Form Scroll Area */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
                </View>
              ) : null}

              {/* Carrier Selection via Centralized Dropdown */}
              <View style={{ marginBottom: 12 }}>
                <Dropdown
                  label="CARRIER *"
                  value={carrier}
                  options={CARRIER_OPTIONS}
                  onChange={setCarrier}
                  searchable
                  placeholder="Select Carrier (e.g. DELHIVERY)"
                />
              </View>

              {/* AWB Number Input matching BookOrder SearchBar with barcode scanner */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.fieldLabel}>AWB NUMBER *</Text>
                <SearchBar
                  value={awb}
                  onChangeText={(t) => setAwb(t.toUpperCase())}
                  placeholder="Enter or scan AWB number"
                  hints={['Scan barcode…', 'Type AWB number…', 'Tap refresh to Get AWB…']}
                  onActionPress={() => {
                    showToast({ title: 'Get AWB', msg: 'AWB fetch logic is not implemented yet. Enter an AWB manually if assigned.', tone: 'info' });
                  }}
                  actionIcon="refresh"
                  actionLabel="Get AWB"
                  onSubmitEditing={handleSubmit}
                  style={{ marginBottom: 0 }}
                />
              </View>

              {/* Optional Dates with DatePickerModal */}
              <View style={styles.sectionCard}>
                <Text style={styles.fieldLabel}>OPTIONAL DATES</Text>
                <View style={styles.fieldRow}>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setDatePickerTarget('order')}
                  >
                    <Text style={styles.subLabel}>ORDER DATE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={styles.dateText}>{orderDate || 'Select Date'}</Text>
                      <Icon name="calendar-month" size={16} color="#64748b" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setDatePickerTarget('transit')}
                  >
                    <Text style={styles.subLabel}>TRANSIT DATE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={styles.dateText}>{transitDate || 'Select Date'}</Text>
                      <Icon name="calendar-month" size={16} color="#64748b" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* DatePickerModal Integration */}
            <DatePickerModal
              visible={Boolean(datePickerTarget)}
              value={datePickerTarget === 'order' ? orderDate : datePickerTarget === 'transit' ? transitDate : ''}
              onChange={(newDate) => {
                if (datePickerTarget === 'order') setOrderDate(newDate);
                if (datePickerTarget === 'transit') setTransitDate(newDate);
                setDatePickerTarget(null);
              }}
              onClose={() => setDatePickerTarget(null)}
            />

            {/* Footer Actions */}
            <View style={styles.footer}>
              <Button
                variant="secondary"
                size="md"
                label="Cancel"
                onPress={onClose}
                disabled={loading}
                style={styles.footerCancel}
              />
              <Button
                variant="primary"
                size="md"
                icon="check"
                loading={loading}
                label="Assign Carrier & AWB"
                onPress={handleSubmit}
                style={styles.footerSave}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
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
  sheetContainer: {
    width: '100%',
    height: '80%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 720 : '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    alignSelf: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -4px 24px rgba(0, 0, 0, 0.18)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  metaConsignee: { flexShrink: 1 },
  metaValue: { fontSize: 11, color: '#475569', fontWeight: '700' },
  metaDivider: { width: 1, height: 12, backgroundColor: '#e2e8f0' },
  body: { flex: 1, minHeight: 0 },
  bodyContent: { padding: 16, paddingBottom: 24 },
  errorBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorBannerText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  fieldLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  subLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  sectionCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  fieldRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  datePickerBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateText: { fontSize: 13, color: '#0f172a', fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  footerCancel: { flex: 1 },
  footerSave: { flex: 2 },
});
