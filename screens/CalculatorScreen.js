import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView,
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
const PRODUCT_TYPES = [
  { code: 'INV', name: 'Invoice (INV)' },
  { code: 'CLN', name: 'Challan (CLN)' },
  { code: 'DEC', name: 'Declaration (DEC)' },
  { code: 'ADH', name: 'Adhar / ID (ADH)' },
  { code: 'DOX', name: 'Document (DOX)' },
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
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close picker"><Text style={styles.closeText}>×</Text></TouchableOpacity>
          </View>
          {search ? (
            <TextInput value={query} onChangeText={setQuery} placeholder="Search..." placeholderTextColor="#94a3b8" style={styles.modalSearch} autoFocus />
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
  const [picker, setPicker] = useState(null);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('info');

  // Input Focus Chaining Refs
  const destPinRef = useRef(null);
  const boxLengthRef = useRef(null);
  const boxBreadthRef = useRef(null);
  const boxHeightRef = useRef(null);
  const productDocNoRef = useRef(null);
  const productAmountRef = useRef(null);
  const productEwayRef = useRef(null);

  const clients = useMemo(() => (Array.isArray(b2bList) ? b2bList : []), [b2bList]);
  const modes = useMemo(() => {
    const fromMap = Object.values(modesMap || {}).map(item => ({
      code: String(item.CODE || item.MODE_CODE || item.key || ''),
      name: item.MODE || item.NAME || item.code || '',
      volIngr: Number(item.VOL_INGR || item.vol_ingr || 4700),
    })).filter(item => item.code);
    return fromMap.length ? fromMap : DEFAULT_MODES;
  }, [modesMap]);
  const carriers = useMemo(() => {
    const fromMap = Object.values(carriersMap || {}).map(item => ({
      code: String(item.CODE || item.COMPANY_CODE || item.key || ''),
      name: item.CARRIER || item.COMPANY_NAME || item.NAME || item.code || '',
    })).filter(item => item.code);
    return fromMap.length ? fromMap : DEFAULT_CARRIERS;
  }, [carriersMap]);

  useEffect(() => {
    if (!customerCode && clients.length) setCustomerCode(String(clients[0].CODE || clients[0].UID || ''));
  }, [clients, customerCode]);

  useEffect(() => {
    if (!selectedMode && modes.length) setSelectedMode(modes[0].code);
  }, [modes, selectedMode]);

  useEffect(() => {
    if (!selectedCarrier && carriers.length) setSelectedCarrier(carriers[0].code);
  }, [carriers, selectedCarrier]);

  useEffect(() => {
    if (originPin.length !== 6) { setOriginData(null); return; }
    let cancelled = false;
    setLookupLoading(prev => ({ ...prev, origin: true }));
    searchPin(originPin).then(res => {
      if (cancelled) return;
      setLookupLoading(prev => ({ ...prev, origin: false }));
      if (res && res.CITY) setOriginData(res);
      else { setOriginData(null); showMessage(`Origin pincode ${originPin} not found.`, 'error'); }
    }).catch(() => {
      if (!cancelled) { setLookupLoading(prev => ({ ...prev, origin: false })); setOriginData(null); }
    });
    return () => { cancelled = true; };
  }, [originPin]);

  useEffect(() => {
    if (destPin.length !== 6) { setDestData(null); return; }
    let cancelled = false;
    setLookupLoading(prev => ({ ...prev, dest: true }));
    searchPin(destPin).then(res => {
      if (cancelled) return;
      setLookupLoading(prev => ({ ...prev, dest: false }));
      if (res && res.CITY) setDestData(res);
      else { setDestData(null); showMessage(`Destination pincode ${destPin} not found.`, 'error'); }
    }).catch(() => {
      if (!cancelled) { setLookupLoading(prev => ({ ...prev, dest: false })); setDestData(null); }
    });
    return () => { cancelled = true; };
  }, [destPin]);

  const setPaymentFlag = (key) => setPayment(prev => ({ ...prev, [key]: !prev[key] }));
  const showMessage = (text, kind = 'info') => { setMessage(text); setMessageKind(kind); };
  const clearMessage = () => setMessage('');

  const customer = useMemo(() => clients.find(item => String(item.CODE || item.UID) === customerCode) || {}, [clients, customerCode]);
  const availableModes = useMemo(() => {
    const b2bMode = customer.MODE || customer.TRANS_MODE;
    if (!b2bMode) return modes;
    const allowed = String(b2bMode).split(/[,/|]/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!allowed.length) return modes;
    const filtered = modes.filter(m => allowed.includes(m.code.toUpperCase()) || allowed.includes(m.name.toUpperCase()));
    return filtered.length ? filtered : modes;
  }, [customer, modes]);

  const zone = normalizeZone(destData?.ZONE);
  const activeVolIngr = useMemo(() => modes.find(item => item.code === selectedMode)?.volIngr || 4700, [modes, selectedMode]);

  const helper = useMemo(() => getHelperTableData({
    customerCode, mode: selectedMode, carrier: selectedCarrier, zone, ratesMap,
  }), [customerCode, selectedMode, selectedCarrier, zone, ratesMap]);

  const summary = useMemo(() => {
    const totalAmount = products.reduce((sum, item) => sum + asNumber(item.AMOUNT), 0);
    if (payment.dox) {
      const w = asNumber(dox.weight);
      return { totalWeight: w, chargeWeight: w, pieces: 1, totalAmount };
    }
    const totalWeight = boxes.reduce((sum, item) => sum + asNumber(item.WEIGHT), 0);
    const chargeWeight = boxes.reduce((sum, item) => sum + asNumber(item.CHG_WT), 0);
    const pieces = boxes.length;
    return { totalWeight, chargeWeight, pieces, totalAmount };
  }, [boxes, dox, payment.dox, products]);

  const charges = useMemo(() => {
    const rate = Number(helper.rate);
    const addRate = Number(helper.add_rate);
    const fright = calculateFreight(selectedMode, rate, addRate, Number(helper.weight_ceiling), Number(helper.weight_zone));
    const all = calculateAllCharges({
      freight: fright.amount,
      mode: selectedMode,
      totalValue: summary.totalAmount,
      isTopay: payment.topay,
      isCod: payment.cod,
      isFov: payment.fov,
      codAmount: payment.cod ? summary.totalAmount : 0,
      pcsCount: summary.pieces,
      ewayCount: products.filter(item => String(item.EWAY_IF || '').trim()).length,
      originState: originData?.STATE || customer.STATE || '',
      destState: destData?.STATE || '',
    });
    return { fright: fright.amount, ...all };
  }, [customer, destData, helper, modeLabel, originData, payment, products, selectedMode, summary]);

  const addBox = () => {
    const weight = asNumber(box.weight);
    const length = asNumber(box.length);
    const breadth = asNumber(box.breadth);
    const height = asNumber(box.height);
    if (!weight || !length || !breadth || !height) {
      showMessage('Please fill Weight, L, B, and H for the box.', 'error');
      return;
    }
    const count = payment.pcs ? Math.max(1, parseInt(pcsCount || '1', 10)) : 1;
    const newItems = Array.from({ length: count }, (_, index) => {
      const volume = (length * breadth * height) / activeVolIngr;
      return {
        BOX_NUM: boxes.length + index + 1,
        WEIGHT: weight, LENGTH: length, BREADTH: breadth, HIGHT: height,
        VOLUME: volume, CHG_WT: Math.max(weight, volume),
      };
    });
    const updated = recalculateAllBoxWeights([...boxes, ...newItems], activeVolIngr);
    setBoxes(updated);
    setBox({ weight: '', length: '', breadth: '', height: '' });
    setPcsCount('1');
    showMessage(`${count} box${count > 1 ? 'es' : ''} added.`, 'success');
  };

  const addDox = () => {
    const size = DOX_SIZES[dox.type] || DOX_SIZES.DL;
    const volume = (size.l * size.b * 1) / activeVolIngr;
    setBoxes([{ BOX_NUM: 1, WEIGHT: asNumber(dox.weight), LENGTH: size.l, BREADTH: size.b, HIGHT: 1, VOLUME: volume, CHG_WT: Math.max(asNumber(dox.weight), volume) }]);
    setProducts([{ PRODUCT: 'Documents/Papers', DOC_NUMBER: dox.type, DOC_TYPE: 'DOX', EWAY_IF: '', AMOUNT: 100 }]);
    showMessage('Dox envelope added.', 'success');
  };

  const addProduct = () => {
    const amount = asNumber(product.amount);
    if (!product.name.trim() || !product.docNo.trim() || !product.amount.trim()) {
      showMessage('Product, DocNo and Amount fields are required.', 'error');
      return;
    }
    if (product.eway && !/^\d{12}$/.test(product.eway)) {
      showMessage('EWay bill must be a 12-digit numeric number.', 'error');
      return;
    }
    setProducts(prev => [...prev, {
      PRODUCT: product.name.trim(), DOC_NUMBER: product.docNo.trim(),
      DOC_TYPE: product.type || 'INV', EWAY_IF: product.eway, AMOUNT: amount,
    }]);
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
  const productTypeLabel = PRODUCT_TYPES.find(item => item.code === product.type)?.name || product.type || 'INV';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Rate Estimate</Text>
          <Text style={styles.subtitle}>Calculator</Text>
        </View>

        <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop]}>
          {/* LEFT COLUMN: Input Forms */}
          <View style={[styles.formColumn, isDesktop && styles.formColumnDesktop]}>
            {/* Shipment Details */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Shipment Details</Text>
              <SelectField label="Customer" value={customerLabel} placeholder="Select Customer" onPress={() => setPicker('customer')} />
              <View style={styles.twoColumns}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>From Pincode *</Text>
                  <TextInput
                    value={originPin}
                    onChangeText={value => { setOriginPin(digitsOnly(value)); clearMessage(); }}
                    placeholder="Origin pincode"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="next"
                    onSubmitEditing={() => destPinRef.current?.focus()}
                    style={styles.input}
                  />
                  <Text style={styles.detailsText}>{lookupLoading.origin ? 'Searching…' : originData ? `${originData.CITY || 'N/A'} · ${originData.STATE || ''}` : 'Enter pincode for city.'}</Text>
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>To Pincode *</Text>
                  <TextInput
                    ref={destPinRef}
                    value={destPin}
                    onChangeText={value => { setDestPin(digitsOnly(value)); clearMessage(); }}
                    placeholder="Destination pincode"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={styles.input}
                  />
                  <Text style={styles.detailsText}>{lookupLoading.dest ? 'Searching…' : destData ? `${destData.CITY || 'N/A'} · ${destData.STATE || ''} · Zone: ${destData.ZONE || 'N/A'}` : 'Enter pincode for city & zone.'}</Text>
                </View>
              </View>
              <View style={styles.twoColumns}>
                <View style={styles.halfField}><SelectField label="Transport Mode" value={modeLabel} placeholder="Select Mode" onPress={() => setPicker('mode')} /></View>
                <View style={styles.halfField}><SelectField label="Carrier" value={carrierLabel} placeholder="Select Carrier" onPress={() => setPicker('carrier')} /></View>
              </View>
              <View style={styles.paymentRow}>
                {PAYMENT_LABELS.map(([key, label]) => (
                  <TouchableOpacity key={key} style={styles.paymentItem} onPress={() => setPaymentFlag(key)} accessibilityRole="checkbox" accessibilityState={{ checked: payment[key] }}>
                    <View style={[styles.checkbox, payment[key] && styles.checkboxChecked]}>
                      {payment[key] ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.paymentLabel}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Dox or Add Box Card */}
            {payment.dox ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Dox Envelope</Text>
                <View style={styles.twoColumns}>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Weight (kg)</Text>
                    <TextInput value={dox.weight} onChangeText={value => setDox(prev => ({ ...prev, weight: numberText(value) }))} keyboardType="decimal-pad" style={styles.input} />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Size</Text>
                    <View style={styles.typeRow}>
                      {Object.keys(DOX_SIZES).map(type => (
                        <TouchableOpacity key={type} style={[styles.typeButton, dox.type === type && styles.typeButtonActive]} onPress={() => setDox(prev => ({ ...prev, type }))}>
                          <Text style={[styles.typeButtonText, dox.type === type && styles.typeButtonTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={addDox}><Text style={styles.primaryButtonText}>Add Dox Envelope</Text></TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add Box</Text>
                <View style={styles.fourColumns}>
                  <View style={styles.smallField}>
                    <Text style={styles.fieldLabel}>Wgt (kg)</Text>
                    <TextInput value={box.weight} onChangeText={v => setBox(p => ({ ...p, weight: numberText(v) }))} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={() => boxLengthRef.current?.focus()} style={styles.input} />
                  </View>
                  <View style={styles.smallField}>
                    <Text style={styles.fieldLabel}>L (cm)</Text>
                    <TextInput ref={boxLengthRef} value={box.length} onChangeText={v => setBox(p => ({ ...p, length: numberText(v) }))} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={() => boxBreadthRef.current?.focus()} style={styles.input} />
                  </View>
                  <View style={styles.smallField}>
                    <Text style={styles.fieldLabel}>B (cm)</Text>
                    <TextInput ref={boxBreadthRef} value={box.breadth} onChangeText={v => setBox(p => ({ ...p, breadth: numberText(v) }))} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={() => boxHeightRef.current?.focus()} style={styles.input} />
                  </View>
                  <View style={styles.smallField}>
                    <Text style={styles.fieldLabel}>H (cm)</Text>
                    <TextInput ref={boxHeightRef} value={box.height} onChangeText={v => setBox(p => ({ ...p, height: numberText(v) }))} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={addBox} style={styles.input} />
                  </View>
                </View>
                {payment.pcs ? (
                  <View style={styles.pcsLine}>
                    <Text style={styles.fieldLabel}>Pcs</Text>
                    <TextInput value={pcsCount} onChangeText={v => setPcsCount(digitsOnly(v, 3))} keyboardType="number-pad" style={styles.pcsInput} />
                  </View>
                ) : null}
                <TouchableOpacity style={styles.primaryButton} onPress={addBox}><Text style={styles.primaryButtonText}>+ Add Box</Text></TouchableOpacity>
              </View>
            )}

            {/* Add Product Card */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Add Product</Text>
              <View style={styles.twoColumns}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Product *</Text>
                  <TextInput value={product.name} onChangeText={v => setProduct(p => ({ ...p, name: v }))} placeholder="Product Name" placeholderTextColor="#94a3b8" returnKeyType="next" onSubmitEditing={() => productDocNoRef.current?.focus()} style={styles.input} />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Doc No *</Text>
                  <TextInput ref={productDocNoRef} value={product.docNo} onChangeText={v => setProduct(p => ({ ...p, docNo: v }))} placeholder="DocNo" placeholderTextColor="#94a3b8" returnKeyType="next" onSubmitEditing={() => productAmountRef.current?.focus()} style={styles.input} />
                </View>
              </View>
              <View style={styles.twoColumns}>
                <View style={styles.halfField}>
                  <SelectField label="Product Type" value={productTypeLabel} placeholder="Select Type" onPress={() => setPicker('productType')} />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Amount *</Text>
                  <TextInput ref={productAmountRef} value={product.amount} onChangeText={v => setProduct(p => ({ ...p, amount: numberText(v) }))} placeholder="0.00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={() => productEwayRef.current?.focus()} style={styles.input} />
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>EWay Bill</Text>
                <TextInput ref={productEwayRef} value={product.eway} onChangeText={v => setProduct(p => ({ ...p, eway: digitsOnly(v, 12) }))} placeholder="12-digit number" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={12} returnKeyType="done" onSubmitEditing={addProduct} style={styles.input} />
              </View>
              <TouchableOpacity style={styles.secondaryButton} onPress={addProduct}><Text style={styles.secondaryButtonText}>+ Add Product</Text></TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.resetButton} onPress={reset}><Text style={styles.resetText}>Reset</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonWide} onPress={estimate}><Text style={styles.primaryButtonText}>Estimate</Text></TouchableOpacity>
            </View>
            {message ? <Text style={[styles.message, messageKind === 'success' ? styles.successMessage : messageKind === 'info' ? styles.infoMessage : styles.errorMessage]}>{message}</Text> : null}
          </View>

          {/* RIGHT COLUMN: Multibox Cards, Product Cards, Summary, Helper & Charges */}
          <View style={[styles.resultColumn, isDesktop && styles.resultColumnDesktop]}>
            {/* Multibox Cards List */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionTitle}>Multibox ({boxes.length})</Text>
                {boxes.length > 0 && (
                  <TouchableOpacity onPress={() => setBoxes([])}>
                    <Text style={styles.clearDangerText}>Clear Multibox</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!boxes.length ? (
                <Text style={styles.emptyTable}>No boxes added.</Text>
              ) : (
                boxes.map((item, index) => (
                  <View key={`${item.BOX_NUM}-${index}`} style={styles.itemCard}>
                    <View style={styles.itemCardHeader}>
                      <Text style={styles.itemCardTitle}>Box #{item.BOX_NUM}</Text>
                      <TouchableOpacity onPress={() => setBoxes(prev => prev.filter((_, i) => i !== index))} style={styles.deleteIconBtn}>
                        <Text style={styles.deleteIconText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemCardGrid}>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>Actual Wgt</Text>
                        <Text style={styles.itemCardValue}>{item.WEIGHT} kg</Text>
                      </View>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>L × B × H</Text>
                        <Text style={styles.itemCardValue}>{item.LENGTH}×{item.BREADTH}×{item.HIGHT} cm</Text>
                      </View>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>Vol. Wgt</Text>
                        <Text style={styles.itemCardValue}>{asNumber(item.VOLUME).toFixed(2)} kg</Text>
                      </View>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>Chg. Wgt</Text>
                        <Text style={styles.itemCardValueStrong}>{asNumber(item.CHG_WT).toFixed(2)} kg</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Product Cards List */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionTitle}>Products ({products.length})</Text>
                {products.length > 0 && (
                  <TouchableOpacity onPress={() => setProducts([])}>
                    <Text style={styles.clearDangerText}>Clear Products</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!products.length ? (
                <Text style={styles.emptyTable}>No products added.</Text>
              ) : (
                products.map((item, index) => (
                  <View key={`${item.DOC_NUMBER}-${index}`} style={styles.itemCard}>
                    <View style={styles.itemCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.itemCardTitle}>{item.PRODUCT}</Text>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{item.DOC_TYPE}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => setProducts(prev => prev.filter((_, i) => i !== index))} style={styles.deleteIconBtn}>
                        <Text style={styles.deleteIconText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemCardGrid}>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>Doc No</Text>
                        <Text style={styles.itemCardValue}>{item.DOC_NUMBER}</Text>
                      </View>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>E-Way Bill</Text>
                        <Text style={styles.itemCardValue}>{item.EWAY_IF || '—'}</Text>
                      </View>
                      <View style={styles.itemCardCell}>
                        <Text style={styles.itemCardLabel}>Amount</Text>
                        <Text style={styles.itemCardValueStrong}>₹{asNumber(item.AMOUNT).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Summary */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.metricsRow}>
                <Metric label="WEIGHT" value={summary.totalWeight ? summary.totalWeight.toFixed(2) : '---'} />
                <Metric label="CHG_WT" value={summary.chargeWeight ? summary.chargeWeight.toFixed(2) : '---'} />
                <Metric label="PIECES" value={summary.pieces || '---'} />
                <Metric label="VALUE" value={summary.totalAmount ? `₹${summary.totalAmount.toFixed(2)}` : '---'} />
              </View>
              <View style={styles.routeStrip}>
                <Text>From: <Text style={styles.routeStrong}>{originData?.CITY || '---'}</Text> ({originPin || '---'})</Text>
                <Text>To: <Text style={styles.routeStrong}>{destData?.CITY || '---'}</Text> ({destPin || '---'})</Text>
                <Text>Zone: <Text style={styles.routeStrong}>{zone || '---'}</Text></Text>
                <Text>Mode: <Text style={styles.routeStrong}>{modeLabel || '---'}</Text></Text>
                <Text>Carrier: <Text style={styles.routeStrong}>{carrierLabel || '---'}</Text></Text>
              </View>
            </View>

            {/* Helper Rate */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Helper Rate</Text>
              <View style={styles.helperGrid}>
                {[
                  ['WEIGHT_CEILING', helper.weight_ceiling],
                  ['WEIGHT_ZONE', helper.weight_zone],
                  ['RATE_UID', helper.rate_uid],
                  ['RATE', helper.rate],
                  ['ADD_RATE', helper.add_rate],
                ].map(([label, value]) => (
                  <View key={label} style={styles.helperCell}>
                    <Text style={styles.helperLabel}>{label}</Text>
                    <Text style={styles.helperValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Charges & Taxes */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Charges & Taxes</Text>
              <ChargeRow label="Freight" value={charges.fright} />
              {[
                ['Fuel Surcharge', charges.fuel_chg], ['COD Charge', charges.cod_chg],
                ['ToPay Charge', charges.topay_chg], ['FOV Charge', charges.fov_chg],
                ['AWB Charge', charges.awb_chg], ['Packing Charge', charges.pack_chg],
                ['Delivery Charge', charges.dev_chg], ['eWay Bill', charges.eway_chg],
              ].filter(([, value]) => asNumber(value) > 0).map(([label, value]) => (
                <ChargeRow key={label} label={label} value={value} />
              ))}
              <ChargeRow label="Taxable Amount" value={charges.taxable} />
              {[
                ['SGST', charges.sgst], ['CGST', charges.cgst], ['IGST', charges.igst],
              ].filter(([, value]) => asNumber(value) > 0).map(([label, value]) => (
                <ChargeRow key={label} label={label} value={value} />
              ))}
              <ChargeRow label="TOTAL" value={charges.total} strong />
            </View>
          </View>
        </View>

        {/* Modal Pickers */}
        <ModalPicker
          visible={picker === 'customer'}
          title="Select Customer"
          items={clients.map(item => ({ code: String(item.CODE || item.UID || ''), name: item.B2B_NAME || item.NAME || item.CODE }))}
          selected={customerCode}
          onSelect={item => { setCustomerCode(item.code); setPicker(null); }}
          onClose={() => setPicker(null)}
          search
        />
        <ModalPicker
          visible={picker === 'mode'}
          title="Select Transport Mode"
          items={availableModes}
          selected={selectedMode}
          onSelect={item => { setSelectedMode(item.code); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
        <ModalPicker
          visible={picker === 'carrier'}
          title="Select Carrier"
          items={carriers}
          selected={selectedCarrier}
          onSelect={item => { setSelectedCarrier(item.code); setPicker(null); }}
          onClose={() => setPicker(null)}
          search
        />
        <ModalPicker
          visible={picker === 'productType'}
          title="Select Product Type"
          items={PRODUCT_TYPES}
          selected={product.type}
          onSelect={item => { setProduct(prev => ({ ...prev, type: item.code })); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 15 },
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
  emptyTable: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12, padding: 14, textAlign: 'center' },
  clearDangerText: { color: '#dc2626', fontFamily: FONTS.semiBold, fontSize: 11 },
  itemCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 6, marginBottom: 6 },
  itemCardTitle: { fontFamily: FONTS.bold, color: COLORS.textPrimary, fontSize: 13 },
  typeBadge: { backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { color: '#1e40af', fontFamily: FONTS.bold, fontSize: 10 },
  deleteIconBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  deleteIconText: { color: '#dc2626', fontSize: 12, fontWeight: 'bold' },
  itemCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemCardCell: { flex: 1, minWidth: 80 },
  itemCardLabel: { color: COLORS.textSecondary, fontFamily: FONTS.semiBold, fontSize: 9, textTransform: 'uppercase' },
  itemCardValue: { color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 11, marginTop: 2 },
  itemCardValueStrong: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 11, marginTop: 2 },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.60)', justifyContent: 'flex-end', paddingTop: Platform.OS === 'ios' ? 50 : 36 },
  pickerModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '75%', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 17 },
  closeText: { color: COLORS.textSecondary, fontSize: 30, lineHeight: 30 },
  modalSearch: { minHeight: 40, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, color: COLORS.textPrimary, marginBottom: 8 },
  pickerList: { maxHeight: 380 },
  pickerRow: { paddingVertical: 13, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between' },
  pickerRowSelected: { backgroundColor: '#fef2f2' },
  pickerRowText: { color: COLORS.textPrimary, fontFamily: FONTS.semiBold, fontSize: 14 },
  pickerRowTextSelected: { color: COLORS.primary },
  pickerCode: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12 },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.body, textAlign: 'center', padding: 18 },
});
