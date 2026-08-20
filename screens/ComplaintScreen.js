import React, { useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { COLORS, FONTS } from '../styles/theme';

const COMPLAINT_API_URL = 'https://script.google.com/macros/s/AKfycbwdEPTko2RsIDO4T3-11nwsCUcVR3jtzC8Xpya5FTqZo13aNWfn1uNhZQ9Zfw_r7hk4aQ/exec';
const CATEGORIES = ['', 'Delay in Delivery', 'Damaged Consignment', 'Incorrect Status', 'Lost Consignment', 'Billing Issue', 'Other'];

function displayDate(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric < 1e11 ? numeric * 1000 : numeric)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ResultField({ label, value }) {
  return <Text style={styles.resultLine}>{label}: <Text style={styles.resultValue}>{value || 'N/A'}</Text></Text>;
}

export default function ComplaintScreen() {
  const [query, setQuery] = useState('');
  const [consignment, setConsignment] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('error');

  const showMessage = (text, kind = 'error') => { setMessage(text); setMessageKind(kind); };

  const searchConsignment = async () => {
    const value = query.trim();
    setConsignment(null);
    setMessage('');
    if (!value) { showMessage('Please enter a valid AWB/Ref Number.'); return; }
    Keyboard.dismiss();
    setSearchLoading(true);
    try {
      const response = await fetch(`${COMPLAINT_API_URL}?searchType=ref&query=${encodeURIComponent(value)}`);
      if (!response.ok) throw new Error('Network response was not ok.');
      const data = await response.json();
      if (data?.orders?.length > 0) {
        setConsignment(data.orders[0]);
        showMessage('Consignment details successfully loaded.', 'success');
      } else {
        showMessage('No consignment found for this number.');
      }
    } catch (error) {
      showMessage('Failed to fetch details. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const submitComplaint = async () => {
    if (!consignment) { showMessage('Please search for and load consignment details first.'); return; }
    const order = consignment.order || {};
    const awb = order['AWB Booked'] || order.Ref;
    if (!category || !mobile.trim() || !email.trim() || !complaintText.trim()) {
      showMessage('Please fill in all required fields (Category, Mobile, Email, and Message).');
      return;
    }

    setSubmitLoading(true);
    setMessage('');
    try {
      const response = await fetch(COMPLAINT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendComplaint',
          awb,
          category,
          mobile: mobile.trim(),
          email: email.trim(),
          message: complaintText.trim(),
        }),
      });
      if (!response.ok) throw new Error('Server response was not ok.');
      showMessage('Your complaint has been successfully submitted!', 'success');
      setQuery('');
      setConsignment(null);
      setCategory('');
      setMobile('');
      setEmail('');
      setComplaintText('');
    } catch (error) {
      showMessage('Failed to send complaint. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const order = consignment?.order || {};
  const track = consignment?.track || {};
  const awb = order['AWB Booked'] || order.Ref;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Raise a Complaint</Text>
          <Text style={styles.intro}>First, find your consignment by entering the AWB or Reference Number.</Text>

          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={searchConsignment}
              placeholder="Enter AWB/Ref Number"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              style={styles.searchInput}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={searchConsignment} disabled={searchLoading}>
              {searchLoading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.buttonText}>Search</Text>}
            </TouchableOpacity>
          </View>

          {searchLoading ? <Text style={styles.loadingText}>Fetching consignment details...</Text> : null}

          {consignment ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Consignment Details</Text>
              <ResultField label="AWB/Ref" value={awb} />
              <ResultField label="Status" value={track['Current Status']} />
              <ResultField label="Order Date" value={displayDate(order['Order Date'])} />
              <ResultField label="Destination" value={`${order['Consignee Name'] || 'N/A'} - ${order['Consignee City'] || 'N/A'}`} />
            </View>
          ) : null}

          <View style={styles.formDivider}>
            <Text style={styles.fieldLabel}>COMPLAINT CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {CATEGORIES.slice(1).map(item => (
                <TouchableOpacity key={item} style={[styles.categoryChip, category === item && styles.categoryChipActive]} onPress={() => setCategory(item)}>
                  <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>YOUR MOBILE NUMBER</Text>
            <TextInput value={mobile} onChangeText={setMobile} placeholder="Enter your mobile number" placeholderTextColor="#94a3b8" keyboardType="phone-pad" style={styles.input} />

            <Text style={styles.fieldLabel}>YOUR EMAIL ADDRESS</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="Enter your email address" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" style={styles.input} />

            <Text style={styles.fieldLabel}>YOUR MESSAGE</Text>
            <TextInput value={complaintText} onChangeText={setComplaintText} placeholder="Please provide details about your complaint" placeholderTextColor="#94a3b8" multiline numberOfLines={5} textAlignVertical="top" style={[styles.input, styles.messageInput]} />
          </View>

          <View style={styles.submitRow}>
            <TouchableOpacity style={[styles.submitButton, submitLoading && styles.disabled]} onPress={submitComplaint} disabled={submitLoading}>
              {submitLoading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.buttonText}>Submit Complaint</Text>}
            </TouchableOpacity>
            {submitLoading ? <Text style={styles.sendingText}>Sending...</Text> : null}
          </View>

          {message ? <View style={[styles.messageBox, messageKind === 'success' ? styles.successBox : styles.errorBox]}><Text style={[styles.messageText, messageKind === 'success' ? styles.successText : styles.errorText]}>{message}</Text></View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, paddingBottom: 32 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 20, ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 8px rgba(15,23,42,0.08)' } : { elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }) },
  title: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 24, marginBottom: 12 },
  intro: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 14, marginBottom: 14 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, color: COLORS.textPrimary, fontFamily: FONTS.body },
  searchButton: { minHeight: 46, minWidth: 94, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  buttonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 13 },
  loadingText: { color: COLORS.textSecondary, fontFamily: FONTS.body, textAlign: 'center', paddingVertical: 14 },
  resultCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, padding: 14, marginTop: 16 },
  resultTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 16, marginBottom: 8 },
  resultLine: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 13, marginTop: 5 },
  resultValue: { color: COLORS.textPrimary, fontFamily: FONTS.semiBold },
  formDivider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 20, paddingTop: 18 },
  fieldLabel: { color: COLORS.textLabel, fontFamily: FONTS.semiBold, fontSize: 12, marginBottom: 7, marginTop: 13 },
  categoryRow: { gap: 7, paddingBottom: 3 },
  categoryChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { color: COLORS.textLabel, fontFamily: FONTS.body, fontSize: 12 },
  categoryTextActive: { color: COLORS.white, fontFamily: FONTS.semiBold },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 14 },
  messageInput: { minHeight: 110, paddingTop: 12 },
  submitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  submitButton: { minHeight: 46, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  disabled: { opacity: 0.65 },
  sendingText: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 13 },
  messageBox: { padding: 13, borderWidth: 1, borderRadius: 8, marginTop: 16 },
  successBox: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  messageText: { fontFamily: FONTS.semiBold, fontSize: 13 },
  successText: { color: '#15803d' },
  errorText: { color: '#b91c1c' },
});
