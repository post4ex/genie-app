import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView, Share, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { COLORS } from '../styles/theme';
import { DOC_CATALOG, DOC_SCHEMAS, DECISION_GUIDE } from '../utils/native-docs-config';
import { validateDocField, validateDocument } from '../utils/native-docs-validation';
import { searchPin } from '../utils/searchpin';

const TABLE_DEFAULTS = {
  items_table: [{ marks: '', desc: '', hsn: '', qty: '', unit: 'PCS', rate: '', amount: '' }],
  packing_table: [{ carton: '', desc: '', qty: '', net: '', gross: '', l: '', b: '', h: '', vol: '' }],
  nondg_table: [{ marks: '', description: '', quantity: '' }],
  neg_table: [{ marks: '', description: '', country: '' }],
  mcd_table: [{ marks: '', description: '', mfgOps: '', mfgDate: '', mfgCountry: '', material: '', materialDate: '', prodCountry: '', exportDate: '' }],
};

const TABLE_COLUMNS = {
  items_table: [['marks', 'Marks'], ['desc', 'Description'], ['hsn', 'HSN'], ['qty', 'Qty'], ['unit', 'Unit'], ['rate', 'Rate'], ['amount', 'Amount']],
  packing_table: [['carton', 'Carton'], ['desc', 'Description'], ['qty', 'Qty'], ['net', 'N.W.'], ['gross', 'G.W.'], ['l', 'L'], ['b', 'B'], ['h', 'H'], ['vol', 'Vol.Wt']],
  nondg_table: [['marks', 'Marks'], ['description', 'Description'], ['quantity', 'Net Qty']],
  neg_table: [['marks', 'Marks'], ['description', 'Description / Quantity'], ['country', 'Country']],
  mcd_table: [['marks', 'Marks'], ['description', 'Description'], ['mfgOps', 'Mfg Ops'], ['mfgDate', 'Mfg Date'], ['mfgCountry', 'Mfg Country'], ['material', 'Material'], ['materialDate', 'Material Date'], ['prodCountry', 'Prod. Country'], ['exportDate', 'Export Date']],
};

const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const escapeHtml = (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const userKey = (user) => String(user?.UID || user?.CODE || user?.EMAIL || user?.USERNAME || 'default');

function initialForm(schema) {
  const values = {};
  const tables = {};
  schema.fields.forEach((field) => {
    if (field.type === 'heading') return;
    if (field.type?.endsWith('_table')) tables[field.key] = (TABLE_DEFAULTS[field.type] || [{}]).map((row) => ({ ...row }));
    else values[field.key] = field.value || '';
  });
  return { values, tables };
}

function Picker({ visible, field, onSelect, onClose }) {
  if (!field) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.pickerCard}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{field.label}</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View>
          <ScrollView>{(field.options || []).map((option) => <TouchableOpacity key={option} style={styles.option} onPress={() => onSelect(option)}><Text style={styles.optionText}>{option}</Text></TouchableOpacity>)}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TableEditor({ type, rows, onChange }) {
  const columns = TABLE_COLUMNS[type] || [];
  const addRow = () => onChange([...(rows || []), { ...(TABLE_DEFAULTS[type]?.[0] || {}) }]);
  const updateRow = (index, key, value) => onChange((rows || []).map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const removeRow = (index) => onChange((rows || []).length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : []);
  return (
    <View style={styles.tableBox}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.tableRow}>{columns.map(([, label]) => <Text key={label} style={[styles.tableCell, styles.tableHead]}>{label}</Text>)}<Text style={[styles.tableCell, styles.tableHead]}> </Text></View>
          {(rows || []).map((row, index) => <View key={index} style={styles.tableRow}>{columns.map(([key]) => <TextInput key={key} value={String(row[key] ?? '')} onChangeText={(value) => updateRow(index, key, key === 'amount' && !value && row.qty && row.rate ? String(Number(row.qty) * Number(row.rate)) : value)} placeholder={key === 'unit' ? 'PCS' : ''} keyboardType={['qty', 'rate', 'amount', 'net', 'gross', 'l', 'b', 'h', 'vol', 'quantity'].includes(key) ? 'decimal-pad' : 'default'} style={styles.tableInput} />)}<TouchableOpacity style={styles.removeRow} onPress={() => removeRow(index)}><Text style={styles.removeText}>×</Text></TouchableOpacity></View>)}
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.addRowButton} onPress={addRow}><Text style={styles.addRowText}>＋ Add {type === 'packing_table' ? 'Package' : 'Item'}</Text></TouchableOpacity>
    </View>
  );
}

export default function DocsScreen({ orders = [], b2bList = [], user }) {
  const [selectedId, setSelectedId] = useState('');
  const [listVisible, setListVisible] = useState(true);
  const [savedVisible, setSavedVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [values, setValues] = useState({});
  const [tables, setTables] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [pickerField, setPickerField] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [savedDocs, setSavedDocs] = useState([]);
  const [savedId, setSavedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pinLoading, setPinLoading] = useState({});

  const storageKey = `genie.document-center.${userKey(user)}`;
  const schema = selectedId ? DOC_SCHEMAS[selectedId] : null;
  const filteredCatalog = useMemo(() => DOC_CATALOG.filter((doc) => `${doc.title} ${doc.desc} ${doc.group}`.toLowerCase().includes(search.toLowerCase())), [search]);

  useEffect(() => { AsyncStorage.getItem(storageKey).then((raw) => { if (raw) setSavedDocs(JSON.parse(raw)); }).catch(() => {}); }, [storageKey]);
  const persistSaved = async (next) => { setSavedDocs(next); await AsyncStorage.setItem(storageKey, JSON.stringify(next)); };

  const selectDocument = (id) => {
    const next = initialForm(DOC_SCHEMAS[id]);
    setSelectedId(id); setValues(next.values); setTables(next.tables); setErrors({}); setTouched({}); setSavedId(null); setSavedVisible(false); setListVisible(false);
  };

  const updateValue = async (field, rawValue) => {
    const value = field.type === 'text' && !field.key.includes('name') && !field.key.includes('address') ? rawValue.toUpperCase() : rawValue;
    setValues((previous) => ({ ...previous, [field.key]: value }));
    setTouched((previous) => ({ ...previous, [field.key]: true }));
    const result = validateDocField(field, value);
    setErrors((previous) => ({ ...previous, [field.key]: result.valid ? '' : result.error }));
    if (field.pincode && /^\d{6}$/.test(value)) {
      setPinLoading((previous) => ({ ...previous, [field.key]: true }));
      const resultPin = await searchPin(value);
      setPinLoading((previous) => ({ ...previous, [field.key]: false }));
      if (resultPin?.found) {
        const prefix = field.key.replace(/_pincode$/, '');
        setValues((previous) => ({ ...previous, [`${prefix}_city`]: resultPin.CITY || '', [`${prefix}_state`]: resultPin.STATE || '', [`${prefix}_state_code`]: resultPin.STATE_CODE || '', [`${prefix}_gst_code`]: resultPin.GST_CODE || '' }));
      }
    }
  };

  const importShipment = (order = orders[0]) => {
    if (!order) { Alert.alert('Import unavailable', 'No shipment is available in local data.'); return; }
    const consignee = b2bList.find((item) => String(item.UID || item.CODE || '') === String(order.CONSIGNEE || '') || String(item.NAME || '').toUpperCase() === String(order.CONSIGNEE || '').toUpperCase()) || {};
    const consignor = b2bList.find((item) => String(item.UID || item.CODE || '') === String(order.CONSIGNOR || '') || String(item.NAME || '').toUpperCase() === String(order.CONSIGNOR || '').toUpperCase()) || {};
    const merged = { ...order, ...consignor, ...consignee };
    const aliases = { reference_id: 'REFERENCE', awb_number: 'AWB_NUMBER', invoice_no: 'REFERENCE', invoice_date: 'ORDER_DATE', exporter_name: 'CONSIGNOR_NAME', consignee_name: 'CONSIGNEE_NAME', exporter_city: 'ORIGIN_CITY', port_loading: 'ORIGIN_CITY', port_discharge: 'DESTINATION_CITY', consignee_city: 'DESTINATION_CITY', exporter_pincode: 'ORIGIN_PINCODE', consignee_pincode: 'DESTINATION_PINCODE', description_of_goods: 'PRODUCT', goods_description: 'PRODUCT', currency: 'CURRENCY', country_dest: 'DESTINATION_COUNTRY' };
    const next = { ...values };
    schema.fields.forEach((field) => { const key = aliases[field.key] || field.key.toUpperCase(); const found = Object.keys(merged).find((sourceKey) => sourceKey.toUpperCase() === key); if (found && merged[found] != null) next[field.key] = String(merged[found]); });
    setValues(next);
    if (next.reference_id) setErrors((previous) => ({ ...previous, reference_id: '' }));
    Alert.alert('Shipment imported', `Fields filled from ${order.REFERENCE || order.AWB_NUMBER || 'shipment'}.`);
  };

  const collectData = () => ({ ...values, ...Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, rows])) });
  const validate = () => {
    const result = validateDocument(schema, values);
    setErrors(result.errors); setTouched(Object.fromEntries(schema.fields.filter((field) => field.key).map((field) => [field.key, true])));
    if (!result.valid) Alert.alert('Validation failed', Object.values(result.errors).slice(0, 8).join('\n'));
    return result.valid;
  };

  const makeHtml = () => {
    const data = collectData();
    const rows = schema.fields.filter((field) => field.type !== 'heading' && !field.type?.endsWith('_table')).map((field) => `<tr><td class="label">${escapeHtml(field.label)}</td><td>${escapeHtml(data[field.key] || field.value || '-').replace(/\n/g, '<br>')}</td></tr>`).join('');
    const tablesHtml = Object.entries(tables).map(([key, tableRows]) => `<h3>${escapeHtml(titleCase(key))}</h3><table>${(tableRows || []).map((row) => `<tr>${Object.entries(row).map(([name, value]) => `<td>${escapeHtml(`${titleCase(name)}: ${value}`)}</td>`).join('')}</tr>`).join('')}</table>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(schema.title)}</title><style>body{font-family:Arial;color:#111;padding:24px;font-size:11px}h1{border-bottom:2px solid #1e3a5f;padding-bottom:10px}h2{font-size:13px;color:#1e3a5f}h3{margin-top:18px;color:#1e3a5f}table{width:100%;border-collapse:collapse;margin:8px 0 14px}td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}.label{width:32%;font-weight:bold;background:#f1f5f9}.meta{color:#64748b;font-size:10px}</style></head><body><h1>${escapeHtml(schema.title)}</h1><p class="meta">${escapeHtml(schema.desc)}</p><table>${rows}</table>${tablesHtml}<p class="meta">Generated via GENIE Document Center • ${new Date().toLocaleString('en-IN')}</p></body></html>`;
  };

  const printDocument = async () => {
    if (!validate()) return;
    setBusy(true);
    try { await Print.printAsync({ html: makeHtml() }); } catch (error) { Alert.alert('Print failed', error.message || 'Unable to open print preview.'); } finally { setBusy(false); }
  };
  const createPdfAndShare = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const html = makeHtml();
      // The browser print dialog is the web equivalent of the web app's PDF
      // download path. Native printToFileAsync creates the actual PDF first.
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const result = await Print.printToFileAsync({ html });
      await Share.share({ title: schema.title, message: `PDF generated for ${schema.title}. File: ${result.uri}` });
    } catch (error) { Alert.alert('PDF failed', error.message || 'Unable to create PDF.'); } finally { setBusy(false); }
  };
  const saveDraft = async () => {
    if (!schema) return;
    setBusy(true);
    const entry = { id: savedId || `${selectedId}-${Date.now()}`, docId: selectedId, title: schema.title, data: collectData(), createdAt: new Date().toISOString() };
    const next = [entry, ...savedDocs.filter((doc) => doc.id !== entry.id)];
    await persistSaved(next); setSavedId(entry.id); setBusy(false); Alert.alert('Saved', 'Document saved locally for this account.');
  };
  const loadSaved = (doc) => { const next = initialForm(DOC_SCHEMAS[doc.docId]); const data = doc.data || {}; const nextValues = { ...next.values, ...Object.fromEntries(Object.keys(next.values).map((key) => [key, data[key] == null ? next.values[key] : String(data[key])])) }; const nextTables = { ...next.tables }; Object.keys(nextTables).forEach((key) => { if (Array.isArray(data[key])) nextTables[key] = data[key]; }); setSelectedId(doc.docId); setValues(nextValues); setTables(nextTables); setSavedId(doc.id); setSavedVisible(false); setListVisible(false); };
  const copySaved = (doc) => { const copy = { ...doc, id: `${doc.docId}-${Date.now()}`, title: `${doc.title} (Copy)`, createdAt: new Date().toISOString() }; persistSaved([copy, ...savedDocs]); };
  const deleteSaved = (doc) => Alert.alert('Delete document?', doc.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => persistSaved(savedDocs.filter((item) => item.id !== doc.id)) }]);

  const renderField = (field) => {
    if (field.type === 'heading') return <Text key={field.label} style={styles.fieldHeading}>{field.label}</Text>;
    if (field.type?.endsWith('_table')) return <View key={field.key} style={styles.tableSection}><Text style={styles.fieldLabel}>{field.label}</Text><TableEditor type={field.type} rows={tables[field.key] || []} onChange={(rows) => setTables((previous) => ({ ...previous, [field.key]: rows }))} /></View>;
    const error = touched[field.key] && errors[field.key];
    const value = String(values[field.key] ?? field.value ?? '');
    if (field.type === 'select') return <View key={field.key} style={styles.field}><Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text><TouchableOpacity style={[styles.selectInput, error && styles.inputError]} onPress={() => setPickerField(field)}><Text style={value ? styles.inputText : styles.placeholder}>{value || 'Select'}</Text><Text>▾</Text></TouchableOpacity>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>;
    return <View key={field.key} style={styles.field}><Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text><View><TextInput value={value} onChangeText={(text) => updateValue(field, text)} onBlur={() => { setTouched((previous) => ({ ...previous, [field.key]: true })); }} placeholder={field.placeholder || ''} multiline={field.type === 'textarea'} numberOfLines={field.type === 'textarea' ? 4 : 1} keyboardType={field.type === 'number' || field.pincode ? 'decimal-pad' : 'default'} autoCapitalize={field.type === 'text' && !field.key.includes('name') && !field.key.includes('address') ? 'characters' : 'sentences'} style={[styles.input, field.type === 'textarea' && styles.textarea, error && styles.inputError]} />{field.pincode && pinLoading[field.key] ? <ActivityIndicator style={styles.pinSpinner} size="small" color={COLORS.primary} /> : null}</View>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>;
  };

  if (!schema) return <View style={styles.screen}><View style={styles.hero}><Text style={styles.title}>Document Center</Text><Text style={styles.subtitle}>Create, validate, save and print export, domestic and regulatory documents.</Text></View><View style={styles.guideCard}><Text style={styles.sectionTitle}>Document Decision Guide</Text>{DECISION_GUIDE.map((rule) => <View key={rule.condition} style={styles.guideRow}><Text style={styles.guideCondition}>{rule.condition}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{rule.documents.map((id) => <TouchableOpacity key={id} style={styles.guideChip} onPress={() => selectDocument(id)}><Text style={styles.guideChipText}>{DOC_SCHEMAS[id]?.title || id}</Text></TouchableOpacity>)}</ScrollView></View>)}</View><TouchableOpacity style={styles.primaryButton} onPress={() => setListVisible(true)}><Text style={styles.primaryButtonText}>Browse Documents</Text></TouchableOpacity>{savedDocs.length > 0 ? <TouchableOpacity style={styles.secondaryButton} onPress={() => setSavedVisible(true)}><Text style={styles.secondaryButtonText}>Open Saved Documents ({savedDocs.length})</Text></TouchableOpacity> : null}{savedVisible ? <SavedList docs={savedDocs} onLoad={loadSaved} onCopy={copySaved} onDelete={deleteSaved} onClose={() => setSavedVisible(false)} /> : null}</View>;

  return <View style={styles.screen}><View style={styles.topBar}><TouchableOpacity onPress={() => { setSelectedId(''); setListVisible(true); }}><Text style={styles.backText}>‹ Documents</Text></TouchableOpacity><Text style={styles.topTitle}>{schema.title}</Text><TouchableOpacity onPress={() => setListVisible(true)}><Text style={styles.backText}>List</Text></TouchableOpacity></View><ScrollView contentContainerStyle={styles.content}><View style={styles.documentHeader}><Text style={styles.title}>{schema.title}</Text><Text style={styles.subtitle}>{schema.desc}</Text><View style={styles.actionRow}><TouchableOpacity style={styles.smallButton} onPress={() => importShipment()}><Text style={styles.smallButtonText}>Import Shipment</Text></TouchableOpacity><TouchableOpacity style={styles.smallButton} onPress={() => setPreviewVisible(true)}><Text style={styles.smallButtonText}>Preview</Text></TouchableOpacity></View></View>{schema.fields.map(renderField)}<View style={styles.footerActions}><TouchableOpacity style={styles.secondaryButton} onPress={saveDraft} disabled={busy}><Text style={styles.secondaryButtonText}>Save Draft</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButton} onPress={printDocument} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Print Document</Text>}</TouchableOpacity><TouchableOpacity style={styles.pdfButton} onPress={createPdfAndShare} disabled={busy}><Text style={styles.pdfButtonText}>PDF / Share</Text></TouchableOpacity></View><TouchableOpacity style={styles.clearButton} onPress={() => { const next = initialForm(schema); setValues(next.values); setTables(next.tables); setErrors({}); setSavedId(null); }}><Text style={styles.clearText}>Clear Form</Text></TouchableOpacity></ScrollView><Picker visible={!!pickerField} field={pickerField} onClose={() => setPickerField(null)} onSelect={(option) => { updateValue(pickerField, option); setPickerField(null); }} />{previewVisible ? <PreviewModal visible={previewVisible} schema={schema} data={collectData()} onClose={() => setPreviewVisible(false)} onPrint={printDocument} /> : null}<Modal visible={listVisible} transparent animationType="slide" onRequestClose={() => setListVisible(false)}><View style={styles.modalBackdrop}><View style={styles.listCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Documents</Text><TouchableOpacity onPress={() => setListVisible(false)}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View><TextInput value={search} onChangeText={setSearch} placeholder="Search documents..." style={styles.input} />{savedDocs.length > 0 ? <TouchableOpacity style={styles.savedLink} onPress={() => setSavedVisible(true)}><Text style={styles.savedLinkText}>▣ Saved Documents ({savedDocs.length})</Text></TouchableOpacity> : null}<ScrollView>{filteredCatalog.map((doc) => <TouchableOpacity key={doc.id} style={[styles.docLink, selectedId === doc.id && styles.docLinkActive]} onPress={() => selectDocument(doc.id)}><Text style={styles.docGroup}>{doc.group}</Text><Text style={styles.docTitle}>{doc.title}</Text><Text style={styles.docDesc}>{doc.desc}</Text></TouchableOpacity>)}</ScrollView></View></View></Modal>{savedVisible ? <SavedList docs={savedDocs} onLoad={loadSaved} onCopy={copySaved} onDelete={deleteSaved} onClose={() => setSavedVisible(false)} /> : null}</View>;
}

function SavedList({ docs, onLoad, onCopy, onDelete, onClose }) { return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.listCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Saved Documents</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View><ScrollView>{docs.length === 0 ? <Text style={styles.emptyText}>No saved documents.</Text> : docs.map((doc) => <View key={doc.id} style={styles.savedRow}><View style={{ flex: 1 }}><Text style={styles.docTitle}>{doc.title}</Text><Text style={styles.docDesc}>{new Date(doc.createdAt).toLocaleString('en-IN')}</Text></View><TouchableOpacity onPress={() => onLoad(doc)}><Text style={styles.rowAction}>Open</Text></TouchableOpacity><TouchableOpacity onPress={() => onCopy(doc)}><Text style={styles.rowAction}>Copy</Text></TouchableOpacity><TouchableOpacity onPress={() => onDelete(doc)}><Text style={styles.deleteAction}>Delete</Text></TouchableOpacity></View>)}</ScrollView></View></View></Modal>; }

function PreviewModal({ visible, schema, data, onClose, onPrint }) { return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={styles.previewScreen}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Preview</Text><View style={styles.actionRow}><TouchableOpacity style={styles.smallButton} onPress={onPrint}><Text style={styles.smallButtonText}>Print</Text></TouchableOpacity><TouchableOpacity onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View></View><ScrollView>{schema.fields.map((field) => field.type === 'heading' ? <Text key={field.label} style={styles.fieldHeading}>{field.label}</Text> : field.type?.endsWith('_table') ? <View key={field.key} style={styles.previewTable}><Text style={styles.fieldLabel}>{field.label}</Text>{(data[field.key] || []).map((row, index) => <Text key={index} style={styles.previewLine}>{Object.entries(row).map(([key, value]) => `${titleCase(key)}: ${value || '-'}`).join('  •  ')}</Text>)}</View> : <View key={field.key} style={styles.previewLine}><Text style={styles.previewLabel}>{field.label}</Text><Text style={styles.previewValue}>{data[field.key] || field.value || '-'}</Text></View>)}</ScrollView></View></Modal>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 14, paddingBottom: 40 }, hero: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, title: { color: '#0f172a', fontSize: 24, fontWeight: '800' }, subtitle: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 5 }, topBar: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, topTitle: { flex: 1, textAlign: 'center', fontWeight: '800', color: '#0f172a' }, backText: { color: COLORS.primary, fontWeight: '700' }, guideCard: { margin: 14, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }, sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e3a5f', marginBottom: 12 }, guideRow: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 10 }, guideCondition: { color: '#334155', fontWeight: '700', marginBottom: 7 }, guideChip: { backgroundColor: '#dbeafe', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 15, marginRight: 6 }, guideChipText: { color: '#1e40af', fontSize: 11, fontWeight: '700' }, documentHeader: { backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, field: { backgroundColor: '#fff', borderRadius: 9, padding: 10, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0' }, fieldHeading: { color: '#1e3a5f', fontSize: 15, fontWeight: '800', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingVertical: 10, marginTop: 8, marginBottom: 8 }, fieldLabel: { color: '#475569', fontSize: 11, fontWeight: '700', marginBottom: 6 }, input: { minHeight: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9, color: '#0f172a', backgroundColor: '#fff' }, textarea: { minHeight: 90, textAlignVertical: 'top' }, selectInput: { minHeight: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, inputText: { color: '#0f172a' }, placeholder: { color: '#94a3b8' }, inputError: { borderColor: '#dc2626', backgroundColor: '#fff7f7' }, errorText: { color: '#dc2626', fontSize: 10, marginTop: 4 }, pinSpinner: { position: 'absolute', right: 10, top: 13 }, footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }, primaryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, alignItems: 'center', margin: 5 }, primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 }, secondaryButton: { backgroundColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, alignItems: 'center', margin: 5 }, secondaryButtonText: { color: '#334155', fontWeight: '800', fontSize: 12 }, pdfButton: { backgroundColor: '#1e3a5f', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, alignItems: 'center', margin: 5 }, pdfButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 }, smallButton: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 }, smallButtonText: { color: '#1e40af', fontSize: 11, fontWeight: '800' }, clearButton: { alignSelf: 'center', padding: 10, marginTop: 5 }, clearText: { color: '#dc2626', fontWeight: '700' }, tableSection: { backgroundColor: '#fff', borderRadius: 9, padding: 10, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0' }, tableBox: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' }, tableRow: { flexDirection: 'row', alignItems: 'center' }, tableCell: { width: 105, minHeight: 38, padding: 7, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0', fontSize: 10 }, tableHead: { backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '800' }, tableInput: { width: 105, height: 38, paddingHorizontal: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0', fontSize: 10, color: '#0f172a' }, removeRow: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0' }, removeText: { color: '#dc2626', fontSize: 22 }, addRowButton: { padding: 10, backgroundColor: '#f8fafc' }, addRowText: { color: '#2563eb', fontWeight: '800', fontSize: 11 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end', paddingTop: Platform.OS === 'ios' ? 50 : 36 }, pickerCard: { maxHeight: '70%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }, listCard: { height: '85%', backgroundColor: '#f8fafc', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }, modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' }, closeText: { color: '#64748b', fontSize: 20, padding: 4 }, option: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, optionText: { color: '#0f172a', fontWeight: '600' }, docLink: { backgroundColor: '#fff', padding: 12, marginBottom: 7, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }, docLinkActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' }, docGroup: { color: '#64748b', fontSize: 9, textTransform: 'uppercase', fontWeight: '800' }, docTitle: { color: '#1e293b', fontWeight: '800', fontSize: 13, marginTop: 2 }, docDesc: { color: '#64748b', fontSize: 10, marginTop: 3 }, savedLink: { padding: 11, backgroundColor: '#ede9fe', borderRadius: 8, marginVertical: 8 }, savedLinkText: { color: '#6d28d9', fontWeight: '800' }, savedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12, gap: 8 }, rowAction: { color: '#2563eb', fontWeight: '800', fontSize: 11 }, deleteAction: { color: '#dc2626', fontWeight: '800', fontSize: 11 }, emptyText: { color: '#64748b', textAlign: 'center', padding: 30 }, previewScreen: { flex: 1, padding: 16, backgroundColor: '#fff' }, previewLine: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, previewLabel: { color: '#64748b', fontSize: 10, fontWeight: '800' }, previewValue: { color: '#0f172a', marginTop: 3 }, previewTable: { marginTop: 12, padding: 10, backgroundColor: '#f8fafc' }
});
