import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { searchPin, searchCity } from '../utils/searchpin';
import { COLORS, FONTS } from '../styles/theme';

const TAT_FIELDS = [
  ['Express TAT', 'EXPRESS_TAT'],
  ['Airline TAT', 'AIRLINE_TAT'],
  ['Surface TAT', 'SURFACE_TAT'],
  ['Premium TAT', 'PREMIUM_TAT'],
];

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? 'N/A' : String(value);
}

function tatValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (value === 'N' || value === false) return 'Not serviceable';
  return `${value} day${Number(value) === 1 ? '' : 's'}`;
}

function ResultField({ label, value }) {
  return (
    <View style={styles.resultField}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{valueOrDash(value)}</Text>
    </View>
  );
}

function MessageBox({ message, error }) {
  if (!message) return null;
  return (
    <View style={[styles.messageBox, error ? styles.errorBox : styles.successBox]} accessibilityRole="alert">
      <Text style={[styles.messageText, error ? styles.errorText : styles.successText]}>{message}</Text>
    </View>
  );
}

export default function PincodeScreen() {
  const [searchType, setSearchType] = useState('pincode');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [pincodeResult, setPincodeResult] = useState(null);
  const [cityResults, setCityResults] = useState([]);

  const placeholder = searchType === 'pincode' ? 'Enter 6-digit Pincode' : 'Enter City Name';
  const maxLength = searchType === 'pincode' ? 6 : 50;

  const clearResult = () => {
    setMessage('');
    setMessageError(false);
    setPincodeResult(null);
    setCityResults([]);
  };

  const switchSearchType = (type) => {
    setSearchType(type);
    setQuery('');
    clearResult();
  };

  const showMessage = (text, error = false) => {
    setMessage(text);
    setMessageError(error);
  };

  const handleQueryChange = (value) => {
    setQuery(searchType === 'pincode' ? value.replace(/[^0-9]/g, '') : value);
    if (message) clearResult();
  };

  const handleSearch = async () => {
    Keyboard.dismiss();
    const value = query.trim();
    clearResult();

    if (searchType === 'pincode' && !/^\d{6}$/.test(value)) {
      showMessage('Please enter a valid 6-digit pincode.', true);
      return;
    }
    if (searchType === 'city' && value.length < 3) {
      showMessage('Please enter at least 3 characters for city search.', true);
      return;
    }

    setLoading(true);
    try {
      if (searchType === 'pincode') {
        const result = await searchPin(value);
        if (!result?.found) showMessage(result?.error || 'Pincode not found.', true);
        else setPincodeResult({ pin: value, ...result });
      } else {
        const offices = await searchCity(value);
        if (!offices.length) showMessage('No results found for that city.', true);
        else setCityResults(offices);
      }
    } catch (error) {
      showMessage(`An error occurred: ${error?.message || 'Search failed.'}`, true);
    } finally {
      setLoading(false);
    }
  };

  const cityHeader = useMemo(() => cityResults[0] || null, [cityResults]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    >
      <View style={styles.card}>
        <Text style={styles.pageTitle}>Pincode Serviceability</Text>

        <View style={styles.searchCard}>
          <View style={styles.modeToggle} accessibilityRole="tablist">
            <TouchableOpacity
              style={[styles.modeButton, searchType === 'pincode' && styles.modeButtonActive]}
              onPress={() => switchSearchType('pincode')}
              accessibilityRole="tab"
              accessibilityState={{ selected: searchType === 'pincode' }}
            >
              <Text style={[styles.modeButtonText, searchType === 'pincode' && styles.modeButtonTextActive]}>Pincode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, searchType === 'city' && styles.modeButtonActive]}
              onPress={() => switchSearchType('city')}
              accessibilityRole="tab"
              accessibilityState={{ selected: searchType === 'city' }}
            >
              <Text style={[styles.modeButtonText, searchType === 'city' && styles.modeButtonTextActive]}>City</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            maxLength={maxLength}
            inputMode={searchType === 'pincode' ? 'numeric' : 'text'}
            autoCapitalize={searchType === 'city' ? 'words' : 'none'}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            style={styles.input}
            accessibilityLabel={placeholder}
          />

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.disabledButton]}
            onPress={handleSearch}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Search pincode or city"
          >
            {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.searchButtonText}>Search</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.resultsCard}>
          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Searching for pincode details...</Text>
            </View>
          ) : null}

          <MessageBox message={message} error={messageError} />

          {pincodeResult ? (
            <View style={styles.resultSection}>
              <View style={styles.resultHeadingRow}>
                <Text style={styles.resultTitle}>Serviceability for Pincode: {pincodeResult.pin}</Text>
                <Text style={styles.foundBadge}>Found</Text>
              </View>
              <View style={styles.fieldsGrid}>
                <ResultField label="City" value={pincodeResult.CITY} />
                <ResultField label="State" value={pincodeResult.STATE} />
                <ResultField label="Zone" value={pincodeResult.ZONE} />
                <ResultField label="ODA" value={pincodeResult.ODA} />
              </View>
              <View style={styles.tatCard}>
                <Text style={styles.tatTitle}>Transit Time</Text>
                <View style={styles.fieldsGrid}>
                  {TAT_FIELDS.map(([label, key]) => (
                    <ResultField key={key} label={label} value={tatValue(pincodeResult[key])} />
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {cityResults.length > 0 ? (
            <View style={styles.resultSection}>
              <Text style={styles.resultTitle}>Results for: {query.trim()}</Text>
              {cityHeader?.DISTRICT ? <Text style={styles.subheading}>District: {cityHeader.DISTRICT}</Text> : null}
              {cityHeader?.STATE ? <Text style={styles.subheading}>State: {cityHeader.STATE}</Text> : null}
              <Text style={styles.availableTitle}>Available Post Offices</Text>
              {cityResults.map((office, index) => (
                <View key={`${office.PINCODE || 'office'}-${index}`} style={styles.officeCard}>
                  <Text style={styles.officeName}>{office.NAME || 'Unnamed Post Office'}</Text>
                  <Text style={styles.officeMeta}>{office.PINCODE || 'N/A'}</Text>
                  {office.BRANCH_TYPE ? <Text style={styles.officeMeta}>{office.BRANCH_TYPE}</Text> : null}
                  {office.DELIVERY_STATUS ? <Text style={styles.officeMeta}>{office.DELIVERY_STATUS}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  card: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  pageTitle: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 18 },
  searchCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 10px 30px rgba(15, 23, 42, 0.10)' }
      : { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }),
  },
  modeToggle: { flexDirection: 'row', width: '100%', marginBottom: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.primary },
  modeButton: { flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: COLORS.white },
  modeButtonActive: { backgroundColor: COLORS.primary },
  modeButtonText: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 14 },
  modeButtonTextActive: { color: COLORS.white },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 12, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 15, marginBottom: 12 },
  searchButton: { minHeight: 44, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  disabledButton: { opacity: 0.65 },
  searchButtonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 14 },
  resultsCard: { backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 18, minHeight: 72 },
  loadingArea: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  loadingText: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 13 },
  messageBox: { borderWidth: 1, borderRadius: 9, padding: 13, marginBottom: 12 },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  successBox: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  messageText: { fontFamily: FONTS.semiBold, fontSize: 13 },
  errorText: { color: '#b91c1c' },
  successText: { color: '#15803d' },
  resultSection: { marginTop: 2 },
  resultHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  resultTitle: { flex: 1, color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 17, marginBottom: 8 },
  foundBadge: { color: '#15803d', backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, fontFamily: FONTS.bold, fontSize: 11 },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  resultField: { width: '50%', padding: 4, minHeight: 60 },
  resultLabel: { color: COLORS.textSecondary, fontFamily: FONTS.semiBold, fontSize: 11, marginBottom: 4 },
  resultValue: { color: COLORS.textPrimary, fontFamily: FONTS.semiBold, fontSize: 14 },
  tatCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginTop: 10 },
  tatTitle: { color: COLORS.textLabel, fontFamily: FONTS.semiBold, fontSize: 13, marginBottom: 5 },
  subheading: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 13, marginBottom: 3 },
  availableTitle: { color: COLORS.textLabel, fontFamily: FONTS.bold, fontSize: 15, marginTop: 16, marginBottom: 8 },
  officeCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, padding: 12, marginBottom: 8 },
  officeName: { color: COLORS.textPrimary, fontFamily: FONTS.semiBold, fontSize: 14, marginBottom: 4 },
  officeMeta: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },
});
