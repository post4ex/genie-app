import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Modal, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert
} from 'react-native';
import { COLORS } from '../styles/theme';

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

export default function UpdateStatusModal({
  visible,
  onClose,
  order,
  token,
  apiBase,
  role = 'STAFF',
  onSuccess
}) {
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
  const [primaryPickerOpen, setPrimaryPickerOpen] = useState(false);
  const [subPickerOpen, setSubPickerOpen] = useState(false);

  const reference = order?.REFERENCE || order?.AWB_NUMBER || '';
  const isClientRole = (role || '').toUpperCase() === 'CLIENT';

  const isCodTopay = React.useMemo(() => {
    if (!order) return false;
    const str = JSON.stringify(order).toUpperCase();
    if (str.includes('"COD"') || str.includes('"C.O.D"') || str.includes('TOPAY') || str.includes('TO PAY') || str.includes('TO-PAY')) return true;
    if (parseFloat(order.COD_AMOUNT || order.cod_amount || order.COD || 0) > 0) return true;
    return false;
  }, [order]);

  useEffect(() => {
    if (visible && order) {
      const initPrimary = isClientRole ? 'Delivered' : (order.STATUS || order.STATE || 'In Transit');
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
  }, [visible, order, isClientRole]);

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
      onClose();
      if (onSuccess) onSuccess(reference, primaryStatus, finalRemark);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Network error updating shipment status');
    }
  };

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Update Shipment Status</Text>
              <Text style={styles.refBadge}>REF: {reference}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form Scroll Area */}
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Primary Status Dropdown */}
            <Text style={styles.fieldLabel}>Primary Status *</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setPrimaryPickerOpen(true)}
            >
              <Text style={styles.dropdownTriggerText}>{primaryStatus || 'Select Primary Status'}</Text>
              <Text style={styles.dropdownChevron}>▼</Text>
            </TouchableOpacity>

            {/* Sub-Status Reason Dropdown */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Sub-Status Reason *</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setSubPickerOpen(true)}
            >
              <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                {subStatus || '-- Select Sub-Status Reason (Required) --'}
              </Text>
              <Text style={styles.dropdownChevron}>▼</Text>
            </TouchableOpacity>

            {/* Concerned Person Fields */}
            {showPersonFields && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionBoxTitle}>Contact Person / Recipient Info (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Person Name (e.g. Rahul Sharma)"
                  placeholderTextColor="#94a3b8"
                  value={personName}
                  onChangeText={setPersonName}
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Phone Number (e.g. 9876543210)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={personPhone}
                  onChangeText={setPersonPhone}
                />
                <Text style={[styles.subLabel, { marginTop: 8 }]}>Relation / Role</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={styles.chipRow}>
                    {RELATION_OPTIONS.map((rel) => (
                      <TouchableOpacity
                        key={rel}
                        style={[styles.chip, personRelation === rel && styles.chipActive]}
                        onPress={() => setPersonRelation(personRelation === rel ? '' : rel)}
                      >
                        <Text style={[styles.chipText, personRelation === rel && styles.chipTextActive]}>{rel}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Next Delivery Attempt Day */}
            {showAttemptDayField && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionBoxTitle}>Next Delivery Attempt Day *</Text>
                <View style={styles.chipRow}>
                  {DAY_OPTIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.chip, attemptDay === d && styles.chipActive]}
                      onPress={() => setAttemptDay(d)}
                    >
                      <Text style={[styles.chipText, attemptDay === d && styles.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Payment Collection Fields */}
            {showPayFields && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionBoxTitle}>Payment Method (COD / To-Pay)</Text>
                <View style={styles.chipRow}>
                  {PAYMODE_OPTIONS.map((pm) => (
                    <TouchableOpacity
                      key={pm}
                      style={[styles.chip, payMode === pm && styles.chipActive]}
                      onPress={() => setPayMode(pm)}
                    >
                      <Text style={[styles.chipText, payMode === pm && styles.chipTextActive]}>{pm}</Text>
                    </TouchableOpacity>
                  ))}
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
              </View>
            )}

            {/* Custom Remark */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Custom Remark (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="e.g. Received by reception / Next attempt scheduled"
              placeholderTextColor="#94a3b8"
              multiline
              value={customRemark}
              onChangeText={setCustomRemark}
            />
          </ScrollView>

          {/* Modal Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Status</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

      {/* Primary Status Dropdown Modal */}
      <Modal visible={primaryPickerOpen} animationType="fade" transparent onRequestClose={() => setPrimaryPickerOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Primary Status</Text>
              <TouchableOpacity onPress={() => setPrimaryPickerOpen(false)}>
                <Text style={styles.pickerCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {(isClientRole ? ['Delivered'] : PRIMARY_STATUS_LIST).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.pickerOption, primaryStatus === st && styles.pickerOptionActive]}
                  onPress={() => {
                    handlePrimaryChange(st);
                    setPrimaryPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, primaryStatus === st && styles.pickerOptionTextActive]}>{st}</Text>
                  {primaryStatus === st ? <Text style={styles.pickerCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sub-Status Reason Dropdown Modal */}
      <Modal visible={subPickerOpen} animationType="fade" transparent onRequestClose={() => setSubPickerOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Sub-Status Reason</Text>
              <TouchableOpacity onPress={() => setSubPickerOpen(false)}>
                <Text style={styles.pickerCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {(SUBSTATUS_OPTIONS[primaryStatus] || []).map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.pickerOption, subStatus === sub && styles.pickerOptionActive]}
                  onPress={() => {
                    setSubStatus(sub);
                    setSubPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, subStatus === sub && styles.pickerOptionTextActive]}>{sub}</Text>
                  {subStatus === sub ? <Text style={styles.pickerCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12
  },
  dialogContainer: {
    width: '95%',
    maxWidth: 500,
    height: '80%',
    maxHeight: 560,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  refBadge: { color: '#475569', fontSize: 10, fontWeight: '800', backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#64748b', fontSize: 16, fontWeight: '800' },
  formScroll: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 24 },
  errorBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorBannerText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  fieldLabel: { color: '#475569', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  subLabel: { color: '#64748b', fontSize: 10, fontWeight: '700' },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4
  },
  dropdownTriggerText: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '700' },
  dropdownChevron: { color: '#64748b', fontSize: 10, marginLeft: 8 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerContent: { width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  pickerCloseX: { fontSize: 16, fontWeight: '800', color: '#64748b', padding: 2 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerOptionActive: { backgroundColor: '#eff6ff' },
  pickerOptionText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  pickerOptionTextActive: { color: COLORS.primary, fontWeight: '800' },
  pickerCheck: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#ffffff' },
  sectionBox: { marginTop: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12 },
  sectionBoxTitle: { color: '#334155', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, color: '#0f172a', fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#e2e8f0' },
  cancelBtnText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: COLORS.primary, minWidth: 100, alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' }
});
