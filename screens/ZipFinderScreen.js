import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { COLORS, FONTS } from '../styles/theme';
import { getCountryNames, resolveGlobalLocation, searchGlobalZip } from '../utils/zipfinder';

const emptySide = () => ({
  zip: '', loading: false, error: '', results: [], countryNames: {},
  selectedCountry: '', cityIndex: '', selected: null,
});

function PickerModal({ visible, title, items, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.picker}>
          <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>{title}</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
          <ScrollView>
            {items.map(item => (
              <TouchableOpacity key={item.value} style={styles.pickerItem} onPress={() => onSelect(item.value)}>
                <Text style={styles.pickerItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            {!items.length ? <Text style={styles.emptyText}>No options available.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReadonlyField({ label, value, accent }) {
  return <View style={styles.outputField}><Text style={[styles.fieldLabel, accent && { color: accent }]}>{label}</Text><Text style={styles.outputValue}>{value || '—'}</Text></View>;
}

function LocationPanel({ side, state, setState, onSearch, onCountry, onCity, onOpenCountry, onOpenCity, countryOpen, cityOpen }) {
  const isFrom = side === 'from';
  const accent = isFrom ? '#2563eb' : '#059669';
  const countryCodes = Object.keys(state.countryNames || {});
  const filtered = state.results.filter(item => !state.selectedCountry || item.country === state.selectedCountry);
  const selectedCountryName = state.countryNames[state.selectedCountry] || state.selectedCountry;
  const selectedCity = state.cityIndex === '' ? null : state.results[Number(state.cityIndex)];

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}><Text style={[styles.panelTitle, { color: accent }]}>{isFrom ? 'ORIGIN (FROM)' : 'DESTINATION (TO)'}</Text>{state.loading ? <ActivityIndicator color={accent} size="small" /> : null}</View>
      <Text style={styles.fieldLabel}>ENTER ZIP / PIN CODE</Text>
      <View style={styles.searchRow}>
        <TextInput
          value={state.zip}
          onChangeText={value => setState(prev => ({ ...prev, zip: value, error: '', selected: null }))}
          onSubmitEditing={() => onSearch(side)}
          placeholder={isFrom ? 'e.g. 248001' : 'e.g. 101000'}
          placeholderTextColor="#94a3b8"
          style={[styles.input, { borderColor: isFrom ? '#bfdbfe' : '#a7f3d0' }]}
          returnKeyType="go"
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.goButton} onPress={() => { Keyboard.dismiss(); onSearch(side); }}><Text style={styles.goText}>Go</Text></TouchableOpacity>
      </View>
      {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}

      {countryCodes.length > 1 ? (
        <View style={styles.stepBlock}>
          <Text style={[styles.stepLabel, { color: accent }]}>STEP 1: SELECT COUNTRY</Text>
          <TouchableOpacity style={styles.selectBox} onPress={onOpenCountry}><Text style={styles.selectText}>{selectedCountryName || '-- Select Country --'}</Text><Text>▾</Text></TouchableOpacity>
        </View>
      ) : null}
      {countryCodes.length === 1 && !state.selectedCountry ? <Text style={styles.detailsText}>{state.countryNames[countryCodes[0]]}</Text> : null}

      {state.selectedCountry && filtered.length > 1 ? (
        <View style={styles.stepBlock}>
          <Text style={[styles.stepLabel, { color: accent }]}>STEP 2: SELECT CITY / REGION</Text>
          <TouchableOpacity style={styles.selectBox} onPress={onOpenCity}><Text style={styles.selectText}>{selectedCity ? `${selectedCity.city} (${selectedCity.state || 'N/A'})` : '-- Select City --'}</Text><Text>▾</Text></TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.outputGrid}>
        <ReadonlyField label="COUNTRY" value={state.selected?.countryName || selectedCountryName} />
        <ReadonlyField label="STATE / REGION" value={state.selected?.state} />
        <ReadonlyField label="CITY / LOCATION" value={state.selected?.city} />
        <ReadonlyField label="NEAREST PORT / HUB" value={state.selected?.port} />
        <View style={styles.currencyBox}>
          <ReadonlyField label="BASE (INR)" value={state.selected?.inr} accent="#ea580c" />
          <ReadonlyField label="GLOBAL (USD)" value={state.selected?.usd} accent="#2563eb" />
          <ReadonlyField label="RAM CURRENCY" value={state.selected?.ram} accent="#9333ea" />
        </View>
      </View>

      <PickerModal visible={countryOpen} title="Select Country" items={countryCodes.map(code => ({ value: code, label: state.countryNames[code] || code }))} onSelect={onCountry} onClose={() => onOpenCountry(false)} />
      <PickerModal visible={cityOpen} title="Select City / Region" items={filtered.map((item, index) => ({ value: String(state.results.indexOf(item)), label: `${item.city} (${item.state || 'N/A'})` }))} onSelect={onCity} onClose={() => onOpenCity(false)} />
    </View>
  );
}

export default function ZipFinderScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [from, setFrom] = useState(emptySide());
  const [to, setTo] = useState(emptySide());
  const [openPicker, setOpenPicker] = useState(null);

  const getSide = (side) => side === 'from' ? from : to;
  const setSide = (side, updater) => side === 'from' ? setFrom(updater) : setTo(updater);

  const fetchLocation = async (side) => {
    const current = getSide(side);
    const zip = current.zip.trim().replace(/\s/g, '');
    if (!zip) { setSide(side, prev => ({ ...prev, error: 'Enter a ZIP / PIN code.' })); return; }
    setSide(side, prev => ({ ...prev, loading: true, error: '', results: [], countryNames: {}, selectedCountry: '', cityIndex: '', selected: null }));
    try {
      const results = await searchGlobalZip(zip);
      if (!results.length) throw new Error('No results found.');
      const codes = [...new Set(results.map(item => item.country))].sort();
      const names = await getCountryNames(codes);
      const next = { zip, loading: false, error: '', results, countryNames: names, selectedCountry: codes.length === 1 ? codes[0] : '', cityIndex: '', selected: null };
      setSide(side, next);
      if (codes.length === 1) {
        const inCountry = results.filter(item => item.country === codes[0]);
        if (inCountry.length === 1) await chooseLocation(side, results.indexOf(inCountry[0]), next);
      }
    } catch (error) {
      setSide(side, prev => ({ ...prev, loading: false, error: error?.message || 'API Error.' }));
    }
  };

  const chooseLocation = async (side, index, snapshot = null) => {
    const current = snapshot || getSide(side);
    const location = current.results[Number(index)];
    if (!location) return;
    setSide(side, prev => ({ ...prev, loading: true, cityIndex: String(index), selected: null, error: '' }));
    try {
      const selected = await resolveGlobalLocation(location);
      setSide(side, prev => ({ ...prev, loading: false, selected }));
    } catch (error) {
      setSide(side, prev => ({ ...prev, loading: false, error: error?.message || 'Could not load location details.' }));
    }
  };

  const chooseCountry = (side, code) => {
    setOpenPicker(null);
    setSide(side, prev => ({ ...prev, selectedCountry: code, cityIndex: '', selected: null }));
    const current = getSide(side);
    const candidates = current.results.filter(item => item.country === code);
    if (candidates.length === 1) chooseLocation(side, current.results.indexOf(candidates[0]), { ...current, selectedCountry: code });
  };

  const panelProps = (side, state, setState) => ({
    side, state, setState, onSearch: fetchLocation,
    onCountry: code => chooseCountry(side, code),
    onCity: index => { setOpenPicker(null); chooseLocation(side, Number(index)); },
    onOpenCountry: value => setOpenPicker(value === false ? null : `${side}-country`),
    onOpenCity: value => setOpenPicker(value === false ? null : `${side}-city`),
    countryOpen: openPicker === `${side}-country`,
    cityOpen: openPicker === `${side}-city`,
  });

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Text style={styles.title}>Logistics Data Entry</Text><Text style={styles.subtitle}>Global Search with INR Base, USD Global, and RAM calculations.</Text></View>
      <View style={[styles.panels, isDesktop && styles.panelsDesktop]}>
        <LocationPanel {...panelProps('from', from, setFrom)} />
        <LocationPanel {...panelProps('to', to, setTo)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 34 },
  header: { width: '100%', maxWidth: 1180, alignSelf: 'center', marginBottom: 20 },
  title: { color: '#111827', fontFamily: FONTS.bold, fontSize: 28 },
  subtitle: { color: '#6b7280', fontFamily: FONTS.body, fontSize: 13, marginTop: 4 },
  panels: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  panelsDesktop: { flexDirection: 'row', gap: 20 },
  panel: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 18, marginBottom: 16, ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 7px rgba(15,23,42,0.08)' } : { elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }) },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  panelTitle: { fontFamily: FONTS.bold, fontSize: 17, letterSpacing: 0.6 },
  fieldLabel: { color: '#6b7280', fontFamily: FONTS.bold, fontSize: 10, marginBottom: 5, letterSpacing: 0.4 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  input: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, color: '#374151', fontFamily: FONTS.semiBold, fontSize: 14, backgroundColor: COLORS.white },
  goButton: { minWidth: 52, minHeight: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  goText: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 13 },
  errorText: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 8, borderRadius: 5, fontFamily: FONTS.body, fontSize: 12, marginTop: 6 },
  detailsText: { color: '#64748b', fontFamily: FONTS.body, fontSize: 12, marginVertical: 8 },
  stepBlock: { marginTop: 14 },
  stepLabel: { fontFamily: FONTS.bold, fontSize: 10, marginBottom: 5 },
  selectBox: { minHeight: 42, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eff6ff' },
  selectText: { color: '#374151', fontFamily: FONTS.semiBold, fontSize: 13 },
  outputGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 20, paddingTop: 14 },
  outputField: { width: '50%', paddingRight: 8, marginBottom: 13 },
  outputValue: { minHeight: 38, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 7, backgroundColor: '#f9fafb', paddingHorizontal: 9, paddingVertical: 10, color: '#374151', fontFamily: FONTS.semiBold, fontSize: 12 },
  currencyBox: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#f8fafc', borderRadius: 10, padding: 9, marginTop: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' },
  picker: { maxHeight: '75%', backgroundColor: COLORS.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { color: '#111827', fontFamily: FONTS.bold, fontSize: 17 },
  closeText: { color: '#64748b', fontSize: 30 },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { color: '#374151', fontFamily: FONTS.semiBold, fontSize: 14 },
  emptyText: { color: '#64748b', fontFamily: FONTS.body, textAlign: 'center', padding: 20 },
});
