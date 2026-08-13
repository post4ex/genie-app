import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { COLORS, FONTS } from '../styles/theme';
import { calculateAllCharges, calculateFreight, getHelperTableData, recalculateAllBoxWeights } from '../utils/calculations';
import { searchPin } from '../utils/searchpin';

const DEFAULT_MODES = [
  { code: 'S', name: 'Surface', volIngr: 4700 },
  { code: 'A', name: 'Air', volIngr: 5000 },
  { code: 'E', name: 'Express', volIngr: 5000 },
  { code: 'C', name: 'Cargo', volIngr: 4700 },
];
const DEFAULT_CARRIERS = [
  { code: 'JTL', name: 'JetLine Logistics' },
  { code: 'TK', name: 'Trackon Couriers' },
  { code: 'DEL', name: 'Delhivery' },
  { code: 'AIR', name: 'Airways Express' },
];
const DOX_SIZES = { DL: { l: 22, b: 11 }, A4: { l: 32, b: 25 }, BG: { l: 40, b: 30 } };
const PAYMENT_LABELS = [
  ['dox', 'Dox'], ['pcs', 'Pcs'], ['topay', 'Topay'], ['cod', 'COD'], ['fov', 'FOV'],
];

const numberText = (value) => String(value ?? '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const digitsOnly = (value, max = 6) => String(value ?? '').replace(/\D/g, '').slice(0, max);
const asNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const normalizeZone = (value) => {
  const match = String(value ?? '').trim().toUpperCase().match(/^Z?(\d+)$/);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 14) return '';
  return `Z${Number(match[1])}`;
};

function SelectField({ label, value, placeholder, onPress }) {
  return (
    <View style={styles.fieldBlock}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity style={styles.selectField} onPress={onPress} accessibilityRole="button">
        <Text style={[styles.selectText, !value && styles.placeholderText]} numberOfLines={1}>{value || placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
    </View>
  );
}

function ModalPicker({ visible, title, items, selected, onSelect, onClose, search = false }) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item => `${item.name || ''} ${item.code || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.pickerModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity>
          </View>
          {search ? (
            <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor="#94a3b8" style={styles.modalSearch} autoFocus />
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.pickerList}>
            {items.length === 0 ? <Text style={styles.emptyText}>No options available.</Text> : null}
            {filtered.map(item => (
              <TouchableOpacity key={item.code} style={[styles.pickerRow, selected === item.code && styles.pickerRowSelected]} onPress={() => onSelect(item)}>
                <Text style={[styles.pickerRowText, selected === item.code && styles.pickerRowTextSelected]}>{item.name || item.code}</Text>
                {item.name && item.code ? <Text style={styles.pickerCode}>{item.code}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Metric({ label, value }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function ChargeRow({ label, value, strong = false }) {
  return <View style={[styles.chargeRow, strong && styles.totalRow]}><Text style={[styles.chargeLabel, strong && styles.totalLabel]}>{label}</Text><Text style={[styles.chargeValue, strong && styles.totalValue]}>₹{value}</Text></View>;
}

export default function CalculatorScreen({ b2bList = [], modesMap = {}, carriersMap = {}, ratesMap = {}, branchesMap = {} }) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const [customerCode, setCustomerCode] = useState('');
  const [originPin, setOriginPin] = useState('');
  const [destPin, setDestPin] = useState('');
  const [originData, setOriginData] = useState(null);
  const [destData, setDestData] = useState(null);
  const [lookupLoading, setLookupLoading] = useState({ origin: false, dest: false });
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [payment, setPayment] = useState({ dox: false, pcs: false, topay: false, cod: false, fov: false });
  const [boxes, setBoxes] = useState([]);
  const [products, setProducts] = useState([]);
  const [box, setBox] = useState({ weight: '', length: '', breadth: '', height: '' });
  const [pcsCount, setPcsCount] = useState('1');
  const [dox, setDox] = useState({ weight: '0.1', type: 'DL' });
  const [product, setProduct] = useState({ name: '', docNo: '', type: 'INV', eway: '', amount: '' });
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('');
  const [picker, setPicker] = useState(null);

  const clients = useMemo(() => Array.isArray(b2bList) ? b2bList : Object.values(b2bList || {}), [b2bList]);
  const customer = useMemo(() => clients.find(c => String(c.CODE || c.UID || '') === String(customerCode)) || {}, [clients, customerCode]);
  const modes = useMemo(() => {
    if (Object.keys(modesMap || {}).length) {
      return Object.entries(modesMap).map(([key, raw]) => ({
        code: String(raw?.SHORT || key),
        name: raw?.MODE || raw?.NAME || key,
        volIngr: asNumber(raw?.VOL_INGR) || 5000,
        raw,
      }));
    }
    return DEFAULT_MODES;
  }, [modesMap]);
  const carriers = useMemo(() => {
    if (Object.keys(carriersMap || {}).length) {
      return Object.entries(carriersMap).map(([key, raw]) => ({ code: String(raw?.COMPANY_CODE || key), name: String(raw?.COMPANY_CODE || key), raw }));
    }
    return DEFAULT_CARRIERS;
  }, [carriersMap]);
  const zone = normalizeZone(destData?.ZONE);
  const availableModes = useMemo(() => modes.filter(mode => !zone || !mode.raw || mode.raw[zone] !== 'N'), [modes, zone]);

  const showMessage = (text, kind = 'error') => { setMessage(text); setMessageKind(kind); };
  const clearMessage = () => { setMessage(''); setMessageKind(''); };

  const lookup = async (type, value) => {
    const pin = String(value || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      if (type === 'origin') setOriginData(null); else setDestData(null);
      return;
    }
    setLookupLoading(prev => ({ ...prev, [type]: true }));
    try {
      const result = await searchPin(pin);
      if (type === 'origin') setOriginData(result?.found ? result : null);
      else setDestData(result?.found ? result : null);
      if (!result?.found) showMessage(`${type === 'origin' ? 'Origin' : 'Destination'} pincode not found.`, 'error');
      else clearMessage();
    } catch (_) {
      showMessage('Pincode lookup failed. Please check your connection.', 'error');
    } finally {
      setLookupLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  useEffect(() => { const timer = setTimeout(() => lookup('origin', originPin), 350); return () => clearTimeout(timer); }, [originPin]);
  useEffect(() => { const timer = setTimeout(() => lookup('dest', destPin), 350); return () => clearTimeout(timer); }, [destPin]);

  useEffect(() => {
    if (!zone || !selectedMode || availableModes.some(mode => mode.code === selectedMode)) return;
    const surface = modes.find(mode => String(mode.name).toUpperCase() === 'SURFACE');
    setSelectedMode(surface?.code || '');
    showMessage(`Selected mode is not available for ${zone}; switched to Surface.`, 'info');
  }, [zone, selectedMode, availableModes, modes]);

  const summary = useMemo(() => {
    const totalWeight = boxes.reduce((sum, item) => sum + asNumber(item.WEIGHT), 0);
    const rawChargeWeight = boxes.reduce((sum, item) => sum + asNumber(item.CHG_WT), 0);
    const totalAmount = products.reduce((sum, item) => sum + asNumber(item.AMOUNT), 0);
    const mode = modes.find(item => item.code === selectedMode);
    const minWeight = boxes.length || products.length ? asNumber(mode?.raw?.MIN_WT) : 0;
    return {
      totalWeight,
      rawChargeWeight,
      chargeWeight: Math.max(rawChargeWeight, minWeight),
      pieces: boxes.length,
      totalAmount,
      mode,
    };
  }, [boxes, products, modes, selectedMode]);

  const helper = useMemo(() => {
    if (!boxes.length && !products.length) return { weight_ceiling: '0.00', weight_zone: '---', rate_uid: '---', rate: '---', add_rate: '---', fright: 0 };
    const data = getHelperTableData(summary.chargeWeight, customer, selectedMode, zone || null, ratesMap);
    const rate = Number(data.rate);
    const addRate = Number(data.add_rate);
    const fright = calculateFreight(selectedMode, rate, addRate, Number(data.weight_ceiling), Number(data.weight_zone));
    return { ...data, fright: Math.max(0, fright) };
  }, [boxes.length, products.length, summary.chargeWeight, customer, selectedMode, zone, ratesMap]);

  const charges = useMemo(() => {
    if (!boxes.length && !products.length) {
      return { fright: '0.00', fuel_chg: '0.00', cod_chg: '0.00', topay_chg: '0.00', fov_chg: '0.00', eway_chg: '0.00', awb_chg: '0.00', pack_chg: '0.00', dev_chg: '0.00', taxable: '0.00', sgst: '0.00', cgst: '0.00', igst: '0.00', total: '0.00' };
    }
    return calculateAllCharges(
      helper.fright,
      { ...summary, totalChgWt: summary.chargeWeight },
      customer,
      { cod: { checked: payment.cod }, topay: { checked: payment.topay }, fov: { checked: payment.fov } },
      products.map(item => ({ type: item.DOC_TYPE, amount: item.AMOUNT, ewayBill: item.EWAY_IF })),
      summary.chargeWeight,
      branchesMap,
    );
  }, [boxes.length, products.length, helper.fright, summary, customer, payment, branchesMap, products]);

  const setPaymentFlag = (name) => {
    setPayment(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (name === 'dox' && next.dox) return { dox: true, pcs: false, topay: false, cod: false, fov: false };
      if (name !== 'dox' && next[name]) next.dox = false;
      return next;
    });
  };

  const addBox = () => {
    const weight = asNumber(box.weight), length = asNumber(box.length), breadth = asNumber(box.breadth), height = asNumber(box.height);
    if (!weight || !length || !breadth || !height) { showMessage('Please fill all Wgt, L, B, and H fields to add a box.', 'error'); return; }
    const mode = modes.find(item => item.code === selectedMode);
    const divisor = mode?.volIngr || 5000;
    const count = payment.pcs ? Math.max(1, parseInt(pcsCount, 10) || 1) : 1;
    const rows = Array.from({ length: count }, () => ({ actualWeight: weight, length, breadth, height }));
    const computed = recalculateAllBoxWeights(rows, divisor).map((item, index) => ({
      BOX_NUM: boxes.length + index + 1,
      WEIGHT: item.actualWeight,
      LENGTH: item.length,
      BREADTH: item.breadth,
      HIGHT: item.height,
      VOLUME: item.volWeight,
      CHG_WT: item.chargeWeight,
    }));
    setBoxes(prev => [...prev, ...computed]);
    setBox({ weight: '', length: '', breadth: '', height: '' });
    setPcsCount('1');
    showMessage('Box added.', 'success');
  };

  const addDox = () => {
    const weight = asNumber(dox.weight);
    if (!weight || weight > 2) { showMessage('Dox weight must be greater than 0 and cannot exceed 2 kg.', 'error'); return; }
    const size = DOX_SIZES[dox.type];
    const height = weight <= 0.1 ? 0.5 : weight <= 0.5 ? 1 : weight <= 1 ? 2 : 3;
    const mode = modes.find(item => item.code === selectedMode);
    const [computed] = recalculateAllBoxWeights([{ actualWeight: weight, length: size.l, breadth: size.b, height }], mode?.volIngr || 5000);
    setBoxes([{ BOX_NUM: 1, WEIGHT: weight, LENGTH: size.l, BREADTH: size.b, HIGHT: height, VOLUME: computed.volWeight, CHG_WT: computed.chargeWeight }]);
    setProducts([{ PRODUCT: 'Documents/Papers', DOC_NUMBER: dox.type, DOC_TYPE: 'DOX', EWAY_IF: '', AMOUNT: 100 }]);
    showMessage('Dox envelope added.', 'success');
  };

  const addProduct = () => {
    const amount = asNumber(product.amount);
    if (!product.name.trim() || !product.docNo.trim() || !product.amount.trim()) { showMessage('Product, DocNo and Amount fields are required.', 'error'); return; }
    if (product.eway && !/^\d{12}$/.test(product.eway)) { showMessage('EWay bill must be a 12-digit numeric number.', 'error'); return; }
    setProducts(prev => [...prev, { PRODUCT: product.name.trim(), DOC_NUMBER: product.docNo.trim(), DOC_TYPE: product.type, EWAY_IF: product.eway, AMOUNT: amount }]);
    setProduct(prev => ({ ...prev, docNo: '', eway: '', amount: '' }));
    showMessage('Product added.', 'success');
  };

  const reset = () => {
    setCustomerCode(''); setOriginPin(''); setDestPin(''); setOriginData(null); setDestData(null);
    setSelectedMode(''); setSelectedCarrier(''); setPayment({ dox: false, pcs: false, topay: false, cod: false, fov: false });
    setBoxes([]); setProducts([]); setBox({ weight: '', length: '', breadth: '', height: '' }); setProduct({ name: '', docNo: '', type: 'INV', eway: '', amount: '' });
    setMessage(''); setMessageKind('');
  };

  const estimate = () => {
    Keyboard.dismiss();
    if (!/^\d{6}$/.test(destPin)) { showMessage('Please enter a valid destination pincode first.', 'error'); return; }
    if (!destData) { showMessage('Pincode not resolved. Please wait for lookup to complete.', 'error'); return; }
    showMessage('Calculation refreshed ✓', 'success');
  };

  const customerLabel = customer.B2B_NAME || customer.NAME || customerCode;
  const modeLabel = modes.find(item => item.code === selectedMode)?.name || '';
  const carrierLabel = carriers.find(item => item.code === selectedCarrier)?.name || '';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow}><Text style={styles.pageTitle}>Rate Estimate</Text><Text style={styles.subtitle}>Calculator</Text></View>
      <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop]}>
        <View style={[styles.formColumn, isDesktop && styles.formColumnDesktop]}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipment Details</Text>
            <SelectField label="Customer" value={customerLabel} placeholder="Select Customer" onPress={() => setPicker('customer')} />
            <View style={styles.twoColumns}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>From Pincode *</Text>
                <TextInput value={originPin} onChangeText={value => { setOriginPin(digitsOnly(value)); clearMessage(); }} placeholder="Enter origin pincode" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={6} returnKeyType="next" style={styles.input} />
                <Text style={styles.detailsText}>{lookupLoading.origin ? 'Searching…' : originData ? `${originData.CITY || 'N/A'} · ${originData.STATE || ''}` : 'Enter pincode to auto-fill city.'}</Text>
              </View>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>To Pincode *</Text>
                <TextInput value={destPin} onChangeText={value => { setDestPin(digitsOnly(value)); clearMessage(); }} placeholder="Enter destination pincode" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={6} returnKeyType="next" style={styles.input} />
                <Text style={styles.detailsText}>{lookupLoading.dest ? 'Searching…' : destData ? `${destData.CITY || 'N/A'} · ${destData.STATE || ''} · Zone: ${destData.ZONE || 'N/A'}` : 'Enter pincode to auto-fill city & zone.'}</Text>
              </View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.halfField}><SelectField label="Transport Mode" value={modeLabel} placeholder="Select Mode" onPress={() => setPicker('mode')} /></View>
              <View style={styles.halfField}><SelectField label="Carrier" value={carrierLabel} placeholder="Select Carrier" onPress={() => setPicker('carrier')} /></View>
            </View>
            <View style={styles.paymentRow}>
              {PAYMENT_LABELS.map(([key, label]) => <TouchableOpacity key={key} style={styles.paymentItem} onPress={() => setPaymentFlag(key)} accessibilityRole="checkbox" accessibilityState={{ checked: payment[key] }}><View style={[styles.checkbox, payment[key] && styles.checkboxChecked]}>{payment[key] ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.paymentLabel}>{label}</Text></TouchableOpacity>)}
            </View>
          </View>

          {payment.dox ? (
            <View style={styles.card}><Text style={styles.sectionTitle}>Dox Envelope</Text><View style={styles.twoColumns}><View style={styles.halfField}><Text style={styles.fieldLabel}>Weight (kg)</Text><TextInput value={dox.weight} onChangeText={value => setDox(prev => ({ ...prev, weight: numberText(value) }))} keyboardType="decimal-pad" style={styles.input} /></View><View style={styles.halfField}><Text style={styles.fieldLabel}>Size</Text><View style={styles.typeRow}>{Object.keys(DOX_SIZES).map(type => <TouchableOpacity key={type} style={[styles.typeButton, dox.type === type && styles.typeButtonActive]} onPress={() => setDox(prev => ({ ...prev, type }))}><Text style={[styles.typeButtonText, dox.type === type && styles.typeButtonTextActive]}>{type}</Text></TouchableOpacity>)}</View></View></View><TouchableOpacity style={styles.primaryButton} onPress={addDox}><Text style={styles.primaryButtonText}>Add Dox Envelope</Text></TouchableOpacity></View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Add Box</Text>
              <View style={styles.fourColumns}>{[['weight', 'Wgt (kg)'], ['length', 'L (cm)'], ['breadth', 'B (cm)'], ['height', 'H (cm)']].map(([key, label]) => <View key={key} style={styles.smallField}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={box[key]} onChangeText={value => setBox(prev => ({ ...prev, [key]: numberText(value) }))} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.input} /></View>)}</View>{payment.pcs ? <View style={styles.pcsLine}><Text style={styles.fieldLabel}>Pcs</Text><TextInput value={pcsCount} onChangeText={value => setPcsCount(digitsOnly(value, 3))} keyboardType="number-pad" style={styles.pcsInput} /></View> : null}<TouchableOpacity style={styles.primaryButton} onPress={addBox}><Text style={styles.primaryButtonText}>+ Add Box</Text></TouchableOpacity></View>
          )}

          <View style={styles.card}><Text style={styles.sectionTitle}>Add Product</Text><View style={styles.twoColumns}><View style={styles.halfField}><Text style={styles.fieldLabel}>Product *</Text><TextInput value={product.name} onChangeText={value => setProduct(prev => ({ ...prev, name: value }))} placeholder="Product" placeholderTextColor="#94a3b8" style={styles.input} /></View><View style={styles.halfField}><Text style={styles.fieldLabel}>Doc No *</Text><TextInput value={product.docNo} onChangeText={value => setProduct(prev => ({ ...prev, docNo: value }))} placeholder="DocNo" placeholderTextColor="#94a3b8" style={styles.input} /></View></View><View style={styles.twoColumns}><View style={styles.halfField}><Text style={styles.fieldLabel}>Type</Text><View style={styles.typeRow}>{['INV', 'CLN', 'DEC', 'ADH', 'DOX'].map(type => <TouchableOpacity key={type} style={[styles.typeButton, product.type === type && styles.typeButtonActive]} onPress={() => setProduct(prev => ({ ...prev, type }))}><Text style={[styles.typeButtonText, product.type === type && styles.typeButtonTextActive]}>{type}</Text></TouchableOpacity>)}</View></View><View style={styles.halfField}><Text style={styles.fieldLabel}>Amount *</Text><TextInput value={product.amount} onChangeText={value => setProduct(prev => ({ ...prev, amount: numberText(value) }))} placeholder="0.00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.input} /></View></View><View style={styles.fieldBlock}><Text style={styles.fieldLabel}>EWay Bill</Text><TextInput value={product.eway} onChangeText={value => setProduct(prev => ({ ...prev, eway: digitsOnly(value, 12) }))} placeholder="12-digit number" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={12} style={styles.input} /></View><TouchableOpacity style={styles.secondaryButton} onPress={addProduct}><Text style={styles.secondaryButtonText}>+ Add Product</Text></TouchableOpacity></View>

          <View style={styles.actionRow}><TouchableOpacity style={styles.resetButton} onPress={reset}><Text style={styles.resetText}>Reset</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButtonWide} onPress={estimate}><Text style={styles.primaryButtonText}>Estimate</Text></TouchableOpacity></View>
          {message ? <Text style={[styles.message, messageKind === 'success' ? styles.successMessage : messageKind === 'info' ? styles.infoMessage : styles.errorMessage]}>{message}</Text> : null}
        </View>

        <View style={[styles.resultColumn, isDesktop && styles.resultColumnDesktop]}>
          <View style={styles.card}><Text style={styles.sectionTitle}>Multibox</Text><ScrollView horizontal><View style={styles.table}><View style={styles.tableHeader}>{['BoxNum', 'Wgt', 'L', 'B', 'H', 'Vol.Wt', 'Chg.Wt'].map(item => <Text key={item} style={styles.tableHeaderCell}>{item}</Text>)}</View>{boxes.map((item, index) => <View key={`${item.BOX_NUM}-${index}`} style={styles.tableRow}>{[item.BOX_NUM, item.WEIGHT, item.LENGTH, item.BREADTH, item.HIGHT, asNumber(item.VOLUME).toFixed(2), asNumber(item.CHG_WT).toFixed(2)].map((value, cellIndex) => <Text key={cellIndex} style={styles.tableCell}>{String(value)}</Text>)}</View>)}{!boxes.length ? <Text style={styles.emptyTable}>No boxes added.</Text> : null}</View></ScrollView></View>
          <View style={styles.card}><Text style={styles.sectionTitle}>Products</Text><ScrollView horizontal><View style={styles.table}><View style={styles.tableHeader}>{['SrNo', 'Product', 'DocNo', 'EWay', 'Type', 'Amount'].map(item => <Text key={item} style={styles.tableHeaderCell}>{item}</Text>)}</View>{products.map((item, index) => <View key={`${item.DOC_NUMBER}-${index}`} style={styles.tableRow}>{[index + 1, item.PRODUCT, item.DOC_NUMBER, item.EWAY_IF || '—', item.DOC_TYPE, `₹${asNumber(item.AMOUNT).toFixed(2)}`].map((value, cellIndex) => <Text key={cellIndex} style={styles.tableCell}>{String(value)}</Text>)}</View>)}{!products.length ? <Text style={styles.emptyTable}>No products added.</Text> : null}</View></ScrollView><View style={styles.clearRow}><TouchableOpacity onPress={() => setBoxes([])}><Text style={styles.clearText}>Clear Multibox</Text></TouchableOpacity><TouchableOpacity onPress={() => setProducts([])}><Text style={styles.clearDangerText}>Clear Product</Text></TouchableOpacity><TouchableOpacity onPress={() => { setBoxes([]); setProducts([]); }}><Text style={styles.clearText}>Clear All</Text></TouchableOpacity></View></View>
          <View style={styles.card}><Text style={styles.sectionTitle}>Summary</Text><View style={styles.metricsRow}><Metric label="WEIGHT" value={summary.totalWeight ? summary.totalWeight.toFixed(2) : '---'} /><Metric label="CHG_WT" value={summary.chargeWeight ? summary.chargeWeight.toFixed(2) : '---'} /><Metric label="PIECES" value={summary.pieces || '---'} /><Metric label="VALUE" value={summary.totalAmount ? `₹${summary.totalAmount.toFixed(2)}` : '---'} /></View><View style={styles.routeStrip}><Text>From: <Text style={styles.routeStrong}>{originData?.CITY || '---'}</Text> ({originPin || '---'})</Text><Text>To: <Text style={styles.routeStrong}>{destData?.CITY || '---'}</Text> ({destPin || '---'})</Text><Text>Zone: <Text style={styles.routeStrong}>{zone || '---'}</Text></Text><Text>Mode: <Text style={styles.routeStrong}>{modeLabel || '---'}</Text></Text><Text>Carrier: <Text style={styles.routeStrong}>{carrierLabel || '---'}</Text></Text></View></View>
          <View style={styles.card}><Text style={styles.sectionTitle}>Helper Rate</Text><View style={styles.helperGrid}>{[['WEIGHT_CEILING', helper.weight_ceiling], ['WEIGHT_ZONE', helper.weight_zone], ['RATE_UID', helper.rate_uid], ['RATE', helper.rate], ['ADD_RATE', helper.add_rate]].map(([label, value]) => <View key={label} style={styles.helperCell}><Text style={styles.helperLabel}>{label}</Text><Text style={styles.helperValue}>{String(value)}</Text></View>)}</View></View>
          <View style={styles.card}><Text style={styles.sectionTitle}>Charges & Taxes</Text><ChargeRow label="Freight" value={charges.fright} />{[['Fuel Surcharge', charges.fuel_chg], ['COD Charge', charges.cod_chg], ['ToPay Charge', charges.topay_chg], ['FOV Charge', charges.fov_chg], ['AWB Charge', charges.awb_chg], ['Packing Charge', charges.pack_chg], ['Delivery Charge', charges.dev_chg], ['eWay Bill', charges.eway_chg]].filter(([, value]) => asNumber(value) > 0).map(([label, value]) => <ChargeRow key={label} label={label} value={value} />)}<ChargeRow label="Taxable Amount" value={charges.taxable} />{[['SGST', charges.sgst], ['CGST', charges.cgst], ['IGST', charges.igst]].filter(([, value]) => asNumber(value) > 0).map(([label, value]) => <ChargeRow key={label} label={label} value={value} />)}<ChargeRow label="TOTAL" value={charges.total} strong /></View>
        </View>
      </View>
      <ModalPicker visible={picker === 'customer'} title="Select Customer" items={clients.map(item => ({ code: String(item.CODE || item.UID || ''), name: item.B2B_NAME || item.NAME || item.CODE }))} selected={customerCode} onSelect={item => { setCustomerCode(item.code); setPicker(null); }} onClose={() => setPicker(null)} search />
      <ModalPicker visible={picker === 'mode'} title="Select Transport Mode" items={availableModes} selected={selectedMode} onSelect={item => { setSelectedMode(item.code); setPicker(null); }} onClose={() => setPicker(null)} />
      <ModalPicker visible={picker === 'carrier'} title="Select Carrier" items={carriers} selected={selectedCarrier} onSelect={item => { setSelectedCarrier(item.code); setPicker(null); }} onClose={() => setPicker(null)} search />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 10, paddingBottom: 32 },
  titleRow: { alignItems: 'center', marginBottom: 10 },
  pageTitle: { fontFamily: FONTS.bold, color: COLORS.textPrimary, fontSize: 22 },
  subtitle: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },
  mainGrid: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  formColumn: { width: '100%' },
  resultColumn: { width: '100%' },
  mainGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  formColumnDesktop: { width: '50%', paddingRight: 4 },
  resultColumnDesktop: { width: '50%', paddingLeft: 4 },
  card: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#d1d5db', padding: 12, marginBottom: 8, borderRadius: 6 },
  sectionTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 10 },
  fieldBlock: { flex: 1, marginBottom: 8 },
  fieldLabel: { color: COLORS.textLabel, fontFamily: FONTS.semiBold, fontSize: 11, marginBottom: 4 },
  input: { width: '100%', minHeight: 40, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 13, backgroundColor: COLORS.white },
  selectField: { minHeight: 40, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white },
  selectText: { flex: 1, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 13 },
  placeholderText: { color: '#94a3b8' },
  chevron: { color: COLORS.textSecondary, fontSize: 15, marginLeft: 8 },
  twoColumns: { flexDirection: 'row', gap: 8 },
  halfField: { flex: 1 },
  fourColumns: { flexDirection: 'row', gap: 6 },
  smallField: { flex: 1 },
  detailsText: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 10, minHeight: 28, paddingTop: 4 },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 6, paddingTop: 10, gap: 12 },
  paymentItem: { flexDirection: 'row', alignItems: 'center' },
  paymentLabel: { color: COLORS.textLabel, fontFamily: FONTS.body, fontSize: 12, marginLeft: 4 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  typeButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 5, paddingVertical: 8, paddingHorizontal: 9 },
  typeButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeButtonText: { color: COLORS.textLabel, fontFamily: FONTS.semiBold, fontSize: 11 },
  typeButtonTextActive: { color: COLORS.white },
  pcsLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pcsInput: { width: 90, minHeight: 38, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, color: COLORS.textPrimary },
  primaryButton: { backgroundColor: COLORS.primary, minHeight: 42, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 8 },
  primaryButtonWide: { flex: 1, backgroundColor: COLORS.primary, minHeight: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 13 },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.primary, minHeight: 42, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryButtonText: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  resetButton: { flex: 1, minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  resetText: { color: COLORS.textLabel, fontFamily: FONTS.bold, fontSize: 13 },
  message: { textAlign: 'center', padding: 9, borderRadius: 5, fontFamily: FONTS.semiBold, fontSize: 12, marginBottom: 8 },
  successMessage: { backgroundColor: '#f0fdf4', color: '#15803d' },
  infoMessage: { backgroundColor: '#eff6ff', color: '#1d4ed8' },
  errorMessage: { backgroundColor: '#fef2f2', color: '#b91c1c' },
  table: { minWidth: 620, borderWidth: 1, borderColor: '#9ca3af' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e5e7eb' },
  tableHeaderCell: { width: 88, padding: 8, color: '#374151', fontFamily: FONTS.bold, fontSize: 10, borderRightWidth: 1, borderRightColor: '#9ca3af' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#d1d5db' },
  tableCell: { width: 88, padding: 8, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 11, borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  emptyTable: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12, padding: 14, textAlign: 'center' },
  clearRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 10 },
  clearText: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 11 },
  clearDangerText: { color: '#dc2626', fontFamily: FONTS.semiBold, fontSize: 11 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 5 },
  metric: { flex: 1, minWidth: 72, alignItems: 'center', paddingVertical: 9 },
  metricLabel: { color: COLORS.textSecondary, fontFamily: FONTS.semiBold, fontSize: 9 },
  metricValue: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 15, marginTop: 3 },
  routeStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 },
  routeStrong: { color: COLORS.textPrimary, fontFamily: FONTS.bold },
  helperGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: '#9ca3af' },
  helperCell: { width: '50%', padding: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#d1d5db' },
  helperLabel: { color: COLORS.textSecondary, fontFamily: FONTS.bold, fontSize: 9 },
  helperValue: { color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 12, marginTop: 3 },
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 7 },
  chargeLabel: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12 },
  chargeValue: { color: COLORS.textPrimary, fontFamily: FONTS.semiBold, fontSize: 12 },
  totalRow: { backgroundColor: '#eff6ff', paddingHorizontal: 5, paddingVertical: 10, borderBottomWidth: 0 },
  totalLabel: { color: '#1e40af', fontFamily: FONTS.bold, fontSize: 14 },
  totalValue: { color: '#1e40af', fontFamily: FONTS.bold, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  pickerModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '80%', padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 17 },
  closeText: { color: COLORS.textSecondary, fontSize: 30, lineHeight: 30 },
  modalSearch: { minHeight: 40, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, color: COLORS.textPrimary, marginBottom: 8 },
  pickerList: { maxHeight: 440 },
  pickerRow: { paddingVertical: 13, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between' },
  pickerRowSelected: { backgroundColor: '#fef2f2' },
  pickerRowText: { color: COLORS.textPrimary, fontFamily: FONTS.semiBold, fontSize: 14 },
  pickerRowTextSelected: { color: COLORS.primary },
  pickerCode: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12 },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.body, textAlign: 'center', padding: 18 },
});
