// components/UpdateStatusModal.js — Update Shipment Status popup, redesigned on
// the app's shared design system: bottom sheet shell, sparkling gradient header,
// the centralized Dropdown for Primary / Sub-status, switchable gradient chips
// for relation / attempt-day / payment, and the global Button footer.
// All validation + payload logic unchanged. Fully static — no Animated.

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Modal, ScrollView, Pressable,
  TextInput, Platform, Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import Dropdown from './Dropdown';
import GradientText from './GradientText';
import { GradientGlyph } from './icons';

const BRAND = ['#9C2007', '#f59e0b'];   // brand maroon → amber

const SUBSTATUS_OPTIONS = {
  'In Transit': [
    'Arrived at Hub',
    'Departed Hub',
    'Air Cargo Dispatched',
    'Arrived at Destination Hub',
    'Transit Delay'
  ],
  'Out for Delivery': [
    'Loaded on Delivery Vehicle',
    'Out for Delivery (Attempt 1)',
    'Out for Delivery (Re-attempt)',
    'OTP Verification Pending'
  ],
  'Delivered': [
    'Delivered to Recipient',
    'Delivered — Signed',
    'Delivered — Signature & Stamp',
    'Delivered — OTP Verified',
    'Delivered — E-Signature Captured',
    'Delivered to Security / Neighbor',
    'Digital POD Uploaded'
  ],
  'Delivery Exception': [
    'No Service Area',
    'Out of Delivery Area (ODA)',
    'Weekly Service Area',
    'Weekly Coloading Area',
    'Customer has to Collect from Office',
    'Customer informed to Collect from office',
    'Informed customer to collect from office',
    'COD Payment Not Ready',
    'COD Amount Dispute',
    'COD / Cash Refused by Recipient',
    'To-Pay Freight Charges Refused',
    'To-Pay Payment Not Ready',
    'Customer Unavailable',
    'Phone Unreachable',
    'Call Not Picked Up',
    'Invalid Phone Number',
    'Consignee Shifted Address',
    'Premises Closed',
    'Address Incomplete',
    'Address Untraceable',
    'Incorrect Pincode',
    'Gate / Security Entry Denied',
    'Delivery OTP Not Shared',
    'Refused by Recipient',
    'Order Cancelled by Customer',
    'Refused — Outer Package Damaged',
    'Refused — Seal Tampered / Opened',
    'Refused — Wrong Product Expected',
    'Climate Exception',
    'Heavy Rain / Monsoon Waterlogging',
    'Time Over / Window Expired',
    'Lift / Elevator Unavailable',
    'Road Damaged',
    'Road Sinkhole / Cave-In',
    'Severe Traffic Gridlock',
    'E-Way Bill Expired in Transit',
    'E-Way Bill / Invoice Mismatch',
    'State Entry Tax / Octroi Hold',
    'Customs Inspection Hold',
    'Delivery Vehicle Breakdown',
    'Cargo Damaged in Transit'
  ],
  'RTO Initiated': [
    'RTO — Max Delivery Attempts Failed',
    'RTO — Customer Refused Receipt',
    'RTO — Unresolvable Address',
    'RTO — Recall Requested by Shipper',
    'RTO — Damaged Beyond Delivery',
    'RTO Initiated',
    'RTO In Transit',
    'Arrived at Origin Hub',
    'RTO Out for Return Delivery',
    'RTO Delivered to Shipper'
  ],
  'Order Booked': [
    'Manifest Generated',
    'AWB Assigned',
    'Space Confirmed',
    'Awaiting Handover to Hub'
  ],
  'Order Pickup': [
    'Pickup Scheduled',
    'En Route to Pickup',
    'Pickup Rescheduled',
    'Pickup Attempted (Failed)',
    'Picked Up / Received'
  ]
};

const PRIMARY_STATUS_LIST = [
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Delivery Exception',
  'RTO Initiated',
  'Order Booked',
  'Order Pickup'
];

const RELATION_OPTIONS = [
  'Self (Consignee)',
  'Family / Relative',
  'Brother / Sister',
  'Parent / Spouse',
  'Security Guard',
  'Receptionist',
  'Office Staff / Manager',
  'Colleague',
  'Neighbor',
  'Other'
];

const DAY_OPTIONS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const PAYMODE_OPTIONS = [
  '-- None / Pre-Paid --',
  'Cash',
  'UPI - Self',
  'UPI - Company',
  'Cheque',
  'UTR'
];

// Switchable gradient chip — active option gets the brand maroon→amber fill
// with a soft glow (TrackModal segmented-control language).
function ChoiceChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {active ? (
        <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chipBase, styles.chipActive]}>
          <Text style={styles.chipTextActive} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.chipBase, styles.chipIdle]}>
          <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Section card (person / attempt day / payment) ───────────────────────────
function SectionCard({ icon, title, required, children }) {
  return (
    <View style={styles.sectionBox}>
      <View style={styles.sectionHead}>
        <GradientGlyph name={icon} size={16} colors={BRAND} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {required ? <Text style={styles.requiredTag}>REQUIRED</Text> : <Text style={styles.optionalTag}>OPTIONAL</Text>}
      </View>
      {children}
    </View>
  );
}

export default function UpdateStatusModal({
  visible,
  onClose,
  order,
  token,
  apiBase,
  role = 'STAFF',
  defaultStatus, // optional — force the primary status pre-selected on open
  b2b2cMap = {}, // optional — resolves CONSIGNEE code → display name
  onSuccess
}) {
  const insets = useSafeAreaInsets();
  const [primaryStatus, setPrimaryStatus] = useState('In Transit');
  const [subStatus, setSubStatus] = useState('');
  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [personRelation, setPersonRelation] = useState('');
  const [attemptDay, setAttemptDay] = useState('');
  const [payMode, setPayMode] = useState('');
  const [utrNo, setUtrNo] = useState('');
  const [customRemark, setCustomRemark] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const reference = order?.REFERENCE || order?.AWB_NUMBER || '';
  const isClientRole = (role || '').toUpperCase() === 'CLIENT';

  // Header identity — AWB first (the operator's scan target), falling back to
  // the reference when no AWB is assigned yet, then a compact
  // Consignee / Nos / Weight strip in place of the old subtitle + REF badge.
  const awb = order?.AWB_NUMBER || reference || 'No AWB';
  const consigneeName = b2b2cMap[order?.CONSIGNEE]?.NAME || order?.CONSIGNEE || '—';
  const nos = order?.PIECS || '—';
  const weight = order?.WEIGHT ? `${order.WEIGHT}kg` : '—';

  const isCodTopay = React.useMemo(() => {
    if (!order) return false;
    const str = JSON.stringify(order).toUpperCase();
    if (str.includes('"COD"') || str.includes('"C.O.D"') || str.includes('TOPAY') || str.includes('TO PAY') || str.includes('TO-PAY')) return true;
    if (parseFloat(order.COD_AMOUNT || order.cod_amount || order.COD || 0) > 0) return true;
    return false;
  }, [order]);

  useEffect(() => {
    if (visible && order) {
      // Client role is always locked to Delivered; otherwise the initial primary
      // is the caller-provided default (e.g. the Status screen preselects
      // Delivered), falling back to the order's current status.
      const initPrimary = isClientRole ? 'Delivered' : (defaultStatus || order.STATUS || order.STATE || 'In Transit');
      const validPrimary = PRIMARY_STATUS_LIST.includes(initPrimary) ? initPrimary : 'In Transit';
      setPrimaryStatus(validPrimary);

      const subOpts = SUBSTATUS_OPTIONS[validPrimary] || [];
      setSubStatus(subOpts[0] || '');
      setPersonName('');
      setPersonPhone('');
      setPersonRelation('');
      setAttemptDay('');
      setPayMode('');
      setUtrNo('');
      setCustomRemark('');
      setErrorMsg('');
    }
  }, [visible, order, isClientRole, defaultStatus]);

  const handlePrimaryChange = (val) => {
    setPrimaryStatus(val);
    const subOpts = SUBSTATUS_OPTIONS[val] || [];
    setSubStatus(subOpts[0] || '');
  };

  const showPersonFields = primaryStatus === 'Delivered' || primaryStatus === 'Delivery Exception';
  const showAttemptDayField = subStatus === 'Weekly Service Area' || subStatus === 'Weekly Coloading Area';
  const showPayFields = primaryStatus === 'Delivered' && isCodTopay;
  const showUtrField = ['UPI - Self', 'UPI - Company', 'Cheque', 'UTR'].includes(payMode);

  const handleSubmit = async () => {
    if (!subStatus) {
      setErrorMsg('Please select a Sub-Status Reason.');
      return;
    }
    if (showAttemptDayField && !attemptDay) {
      setErrorMsg('Please select Next Delivery Attempt Day.');
      return;
    }
    if (showPayFields && showUtrField && !utrNo.trim()) {
      setErrorMsg(`Please enter UTR / Transaction Ref / Cheque number for ${payMode}.`);
      return;
    }

    let extraParts = [];
    if (attemptDay) {
      extraParts.push(`Next Attempt Day: ${attemptDay}`);
    }

    if (personName.trim() || personPhone.trim() || personRelation) {
      let pTokens = [];
      if (personName.trim()) pTokens.push(personName.trim());
      if (personRelation) pTokens.push(`Role: ${personRelation}`);
      if (personPhone.trim()) pTokens.push(`Ph: ${personPhone.trim()}`);

      const label = (primaryStatus === 'Delivered') ? 'Recipient' : 'Contact Person';
      extraParts.push(`${label}: ${pTokens.join(' - ')}`);
    }

    if (payMode && payMode !== '-- None / Pre-Paid --') {
      let payStr = `Payment: ${payMode}`;
      if (utrNo.trim()) {
        payStr += ` (Ref/UTR: ${utrNo.trim()})`;
      }
      extraParts.push(payStr);
    }

    let remarkTokens = [subStatus];
    if (extraParts.length > 0) {
      remarkTokens.push(extraParts.join(' | '));
    }
    if (customRemark.trim()) {
      remarkTokens.push(customRemark.trim());
    }
    const finalRemark = remarkTokens.join(' - ');

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        reference: reference,
        status_raw: primaryStatus,
        status_remark: finalRemark,
        status_time: Date.now()
      };

      const res = await fetch(`${apiBase}/api/updateShipmentStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Failed to update shipment status');
      }

      setLoading(false);
      Keyboard.dismiss();
      onClose();
      if (onSuccess) onSuccess(reference, primaryStatus, finalRemark);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Network error updating shipment status');
    }
  };

  if (!visible) return null;

  const primaryOptions = (isClientRole ? ['Delivered'] : PRIMARY_STATUS_LIST).map(s => ({ value: s, label: s }));
  const subOptions = (SUBSTATUS_OPTIONS[primaryStatus] || []).map(s => ({ value: s, label: s }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <GradientGlyph name="clipboard-check" size={20} colors={BRAND} />
              <View style={{ flex: 1 }}>
                <GradientText colors={BRAND} style={styles.title} numberOfLines={1}>Update Status : {awb}</GradientText>
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
                accessibilityLabel="Close update status"
                style={{ marginLeft: 6 }}
              />
            </View>
          </View>

          {/* Form Scroll Area */}
          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.bodyContent}
          >
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            {/* Primary + Sub-Status — flex in one row */}
            <View style={styles.dropdownRow}>
              <View style={styles.dropdownHalf}>
                <Dropdown
                  label="PRIMARY STATUS *"
                  value={primaryStatus}
                  options={primaryOptions}
                  onChange={handlePrimaryChange}
                  placeholder="Select Primary Status"
                />
              </View>
              <View style={styles.dropdownHalf}>
                <Dropdown
                  label="SUB-STATUS REASON *"
                  value={subStatus}
                  options={subOptions}
                  onChange={setSubStatus}
                  searchable
                  placeholder={subOptions.length ? 'Select Reason' : '-- No reasons --'}
                />
              </View>
            </View>

            {/* Concerned Person + Payment — merged handover card; Relation and
                Payment Method share one dropdown row when both apply */}
            {(showPersonFields || showPayFields) && (
              <SectionCard icon="clipboard-account-outline" title="Handover & Collection Details">
                {showPersonFields && (
                  <View style={styles.fieldRow}>
                    <TextInput
                      style={[styles.input, styles.fieldHalf]}
                      placeholder="Person Name (e.g. Rahul Sharma)"
                      placeholderTextColor="#94a3b8"
                      value={personName}
                      onChangeText={setPersonName}
                    />
                    <TextInput
                      style={[styles.input, styles.fieldHalf]}
                      placeholder="Phone Number"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={personPhone}
                      onChangeText={setPersonPhone}
                    />
                  </View>
                )}

                <View style={styles.dropdownRow}>
                  {showPersonFields && (
                    <View style={styles.dropdownHalf}>
                      <Dropdown
                        label="RELATION / ROLE"
                        value={personRelation}
                        options={RELATION_OPTIONS.map(s => ({ value: s, label: s }))}
                        onChange={setPersonRelation}
                        placeholder="Select relation / role"
                      />
                    </View>
                  )}
                  {showPayFields && (
                    <View style={styles.dropdownHalf}>
                      <Dropdown
                        label="PAYMENT METHOD"
                        value={payMode}
                        options={PAYMODE_OPTIONS.map(s => ({ value: s, label: s }))}
                        onChange={setPayMode}
                        placeholder="Select payment method"
                      />
                    </View>
                  )}
                </View>

                {showUtrField && (
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    placeholder="UTR / Transaction Ref / Cheque No. *"
                    placeholderTextColor="#94a3b8"
                    value={utrNo}
                    onChangeText={setUtrNo}
                  />
                )}
              </SectionCard>
            )}

            {/* Next Delivery Attempt Day */}
            {showAttemptDayField && (
              <SectionCard icon="calendar" title="Next Delivery Attempt Day" required>
                <View style={styles.chipRow}>
                  {DAY_OPTIONS.map((d) => (
                    <ChoiceChip
                      key={d}
                      label={d}
                      active={attemptDay === d}
                      onPress={() => setAttemptDay(d)}
                    />
                  ))}
                </View>
              </SectionCard>
            )}

            {/* Custom Remark */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>CUSTOM REMARK (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="e.g. Received by reception / Next attempt scheduled"
                placeholderTextColor="#94a3b8"
                multiline
                value={customRemark}
                onChangeText={setCustomRemark}
              />
            </View>
          </ScrollView>

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
              label="Save Status"
              onPress={handleSubmit}
              style={styles.footerSave}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
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
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 16, paddingBottom: 20 },
  errorBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorBannerText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  fieldLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },

  // ── Row helpers — dropdowns / inputs flex side-by-side ──
  dropdownRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dropdownHalf: { flex: 1, minWidth: 0 },
  fieldRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  fieldHalf: { flex: 1, minWidth: 0 },

  // ── Switchable gradient chips ──
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chipBase: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 3px 10px rgba(156, 32, 7, 0.28)' }
      : { shadowColor: '#9C2007', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }),
  },
  chipText: { color: '#475569', fontSize: 11.5, fontWeight: '700' },
  chipTextActive: { color: '#ffffff', fontSize: 11.5, fontWeight: '800' },
  pressed: { opacity: 0.75 },

  // ── Section card ──
  sectionBox: {
    marginTop: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionTitle: { flex: 1, color: '#1e293b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  requiredTag: { color: '#b45309', fontSize: 9, fontWeight: '800', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  optionalTag: { color: '#64748b', fontSize: 9, fontWeight: '800', backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 13,
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerCancel: { flex: 1 },
  footerSave: { flex: 1.4 },
});
