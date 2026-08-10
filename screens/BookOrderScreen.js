import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Switch, Modal
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { COLORS } from '../styles/theme';

// GENIE_WEB parity — reuse the exact shared engines instead of inlined copies
// (Point 2 & 13: single source of truth with GENIE_WEB utils/calculations.js etc.)
import { getHelperTableData, calculateFreight, calculateAllCharges, recalculateAllBoxWeights } from '../utils/calculations';
import { generateInvoiceId } from '../utils/invoice-utils';
import { detectCarrierFromAWB, detectProductFromAWB, detectProductCode } from '../utils/awb-detect';
import { searchPin } from '../utils/searchpin';
import { getMetadata, setMetadata } from '../core/storage';

const RefreshIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </Svg>
);

const TrashIcon = ({ size = 14, color = '#ef4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </Svg>
);

const CalendarIcon = ({ size = 14, color = '#64748b' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const WebCheckbox = ({ value, onValueChange, label, title }) => (
  <TouchableOpacity
    style={styles.checkboxContainer}
    onPress={() => onValueChange(!value)}
    activeOpacity={0.7}
  >
    <View style={[styles.checkboxSquare, value && styles.checkboxSquareChecked]}>
      {value && <Text style={styles.checkmarkText}>✓</Text>}
    </View>
    <Text style={styles.checkboxLabel}>{label}</Text>
  </TouchableOpacity>
);

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DEFAULT_MODES = [
  { code: 'S', name: 'Surface', volIngr: 4700 },
  { code: 'A', name: 'Air', volIngr: 5000 },
  { code: 'E', name: 'Express', volIngr: 5000 },
  { code: 'C', name: 'Cargo', volIngr: 4700 }
];

const DEFAULT_CARRIERS = [
  { code: 'JTL', name: 'JetLine Logistics' },
  { code: 'TK', name: 'Trackon Couriers' },
  { code: 'DEL', name: 'Delhivery' },
  { code: 'AIR', name: 'Airways Express' }
];

const DOX_SIZES = {
  DL: { l: 22, b: 11 },
  A4: { l: 32, b: 25 },
  BG: { l: 40, b: 30 }
};

export default function BookOrderScreen({
  bookForm = {}, setBookForm, onBookOrder, bookingLoading,
  b2b2cMap = {}, b2bList = [], carriersMap = {}, modesMap = {}, ratesMap = {}, branchesMap = {},
  token = '', apiBase = '', onContactCreated = null
}) {
  // --- 1. Top Section Local States ---
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderDateModalVisible, setOrderDateModalVisible] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const [clientCode, setClientCode] = useState(bookForm.code || '');
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  const [modeModalVisible, setModeModalVisible] = useState(false);
  const [carrierModalVisible, setCarrierModalVisible] = useState(false);

  const [selectedMode, setSelectedMode] = useState(bookForm.mode || '');
  const [selectedCarrier, setSelectedCarrier] = useState(bookForm.carrier || '');

  // Form Locking state (GENIE_WEB isBookingLocked)
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [lastBookedOrder, setLastBookedOrder] = useState(null);

  // Normalize B2B Customers Array
  const clientsArray = useMemo(() => {
    return Array.isArray(b2bList) ? b2bList : Object.values(b2bList || {});
  }, [b2bList]);

  const activeClient = useMemo(() => {
    if (clientCode) {
      const found = clientsArray.find(c => (c.CODE || c.UID || '') === clientCode);
      if (found) return found;
    }
    return null;
  }, [clientsArray, clientCode]);

  const selectedClientName = activeClient ? (activeClient.B2B_NAME || activeClient.NAME || activeClient.CODE || '') : (clientCode || '');

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clientsArray;
    const q = clientSearchQuery.toLowerCase();
    return clientsArray.filter(c => (c.B2B_NAME || c.NAME || '').toLowerCase().includes(q) || (c.CODE || '').toLowerCase().includes(q));
  }, [clientsArray, clientSearchQuery]);

  // Normalize B2B2C Contacts List
  const contactsList = useMemo(() => {
    if (!b2b2cMap) return [];
    return Array.isArray(b2b2cMap) ? b2b2cMap : Object.values(b2b2cMap || {});
  }, [b2b2cMap]);

  // Sender & Receiver Contact Auto-complete State
  const [senderQuery, setSenderQuery] = useState('');
  const [selectedSender, setSelectedSender] = useState(null);

  const [receiverQuery, setReceiverQuery] = useState('');
  const [selectedReceiver, setSelectedReceiver] = useState(null);

  const [destCityInput, setDestCityInput] = useState(bookForm.destCity || '');
  const [destPincodeInput, setDestPincodeInput] = useState(bookForm.destPincode || '');

  // Origin derived from sender (Web: originPincodeInput / origin city from sender contact)
  const [originCityInput, setOriginCityInput] = useState('');
  const [originPincodeInput, setOriginPincodeInput] = useState('');

  // Edit mode (Web: prefillEditOrder + editOrderRef + edit banner)
  const [editRef, setEditRef] = useState(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingMessageKind, setBookingMessageKind] = useState('info'); // 'info' | 'success' | 'error' | 'warn'

  // ── Booking transactions log — every submit attempt (booked / pending / error) ──
  const [bookingTxns, setBookingTxns] = useState([]);
  const txnLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getMetadata('booking_txn');
        if (raw) setBookingTxns(JSON.parse(raw));
      } catch (_) {}
      finally { txnLoadedRef.current = true; }
    })();
  }, []);

  // Persist whenever the log changes (survives tab switches / app restarts).
  // Guarded so the mount-time run can't wipe saved history before it loads.
  useEffect(() => {
    if (txnLoadedRef.current) setMetadata('booking_txn', JSON.stringify(bookingTxns));
  }, [bookingTxns]);

  const recordBookingTxn = (txn) => {
    setBookingTxns((prev) => [txn, ...prev].slice(0, 15));
  };

  const clearBookingTxns = () => setBookingTxns([]);

  // AWB pattern hint (Web: validateAwbPattern)
  const [awbHint, setAwbHint] = useState(null); // { text, kind }

  // Mode revalidation message (Web: modeChangeMessage)
  const [modeChangeMsg, setModeChangeMsg] = useState('');

  // Web parity (revalidateMode): once the user explicitly picks a mode, stop auto-switching it
  const [userMadeInitialModeChoice, setUserMadeInitialModeChoice] = useState(false);
  // Race guard for async pincode lookup in Add Contact
  const acPinLatest = useRef('');

  // Add Contact modal (Web: book-order-add-contact.js)
  const [addContactVisible, setAddContactVisible] = useState(false);
  const [addContactType, setAddContactType] = useState('sender'); // 'sender' | 'receiver'
  const [acSaving, setAcSaving] = useState(false);
  const [acError, setAcError] = useState('');
  const [acForm, setAcForm] = useState({ name: '', mobile: '', pincode: '', address: '', email: '', gstin: '', carrier: '' });
  const [acPinResult, setAcPinResult] = useState(null); // { found, city, state, stateCode, gstCode, zone, oda, tat fields, manualZone }
  const [acPinStatus, setAcPinStatus] = useState(''); // '' | '…' | '✔' | '✖' | '⚠'

  // --- Handle Customer Selection (Web: handleCustomerSelectionChange) ---
  const handleSelectClient = (client) => {
    const code = client.CODE || client.UID || '';
    setClientCode(code);
    setClientModalVisible(false);

    // Web parity (handleCustomerSelectionChange): auto-select sender ONLY when
    // contact.NAME === client.B2B_NAME AND contact.CODE === selected customer code.
    // No fallback — Retail/MuscleX etc. clients that have contacts under their code
    // but whose NAME doesn't match B2B_NAME must NOT auto-fill a sender.
    const b2bName = client.B2B_NAME || '';
    const matchingSender = b2bName ? contactsList.find(c => c.NAME === b2bName && c.CODE === code) : null;
    if (matchingSender) {
      setSelectedSender(matchingSender);
      setSenderQuery(matchingSender.NAME || '');
      if (matchingSender.PINCODE) setOriginPincodeInput(String(matchingSender.PINCODE));
      if (matchingSender.CITY) setOriginCityInput(matchingSender.CITY);
    } else {
      setSelectedSender(null);
      setSenderQuery('');
      setOriginPincodeInput('');
      setOriginCityInput('');
    }

    // Web parity (handleCustomerSelectionChange): default mode = Express when not editing
    if (!editRef) {
      const expressOption = MODE_OPTIONS_LIST.find(m => (m.name || '').toUpperCase() === 'EXPRESS') || MODE_OPTIONS_LIST.find(m => (m.rawObj?.MODE || '').toUpperCase() === 'EXPRESS');
      if (expressOption) setSelectedMode(expressOption.code);
      else if (!selectedMode) setSelectedMode('E');
    }
    if (!selectedCarrier && CARRIER_OPTIONS_LIST.length > 0) setSelectedCarrier(CARRIER_OPTIONS_LIST[0].code);
  };

  // Web parity (setupAutocomplete sender): selecting a sender fills origin pincode
  const handleSelectSender = (contact) => {
    setSelectedSender(contact);
    setSenderQuery(contact.NAME || '');
    if (contact.PINCODE) setOriginPincodeInput(String(contact.PINCODE));
    if (contact.CITY) setOriginCityInput(contact.CITY);
  };

  // Web parity (populateModeDropdown(zone)): mode is available only when zone key === 'Y'
  // (exactly like web's `!zone || mode[zone] === 'Y'` — missing zone key means unavailable)
  const isModeAvailableForZone = (modeObj) => {
    const zone = selectedReceiver?.ZONE;
    if (!zone || !modeObj || !modeObj.rawObj) return true;
    return modeObj.rawObj[zone] === 'Y';
  };

  // Web parity (transportTypeSelect change): changing mode recalculates all box weights
  // with the NEW mode's VOL_INGR (renderMultiboxTable). Shared by manual selection and the
  // auto-switch effects below — the web calls renderMultiboxTable() in BOTH paths.
  const recomputeBoxesForMode = (volIngr) => {
    if (boxes.length === 0) return;
    const mapped = boxes.map(b => ({ actualWeight: b.WEIGHT, length: b.LENGTH, breadth: b.BREADTH, height: b.HIGHT }));
    recalculateAllBoxWeights(mapped, volIngr);
    setBoxes(mapped.map((b, i) => ({
      BOX_NUM: i + 1,
      WEIGHT: b.actualWeight,
      LENGTH: b.length,
      BREADTH: b.breadth,
      HIGHT: b.height,
      VOLUME: b.volWeight,
      CHG_WT: b.chargeWeight
    })));
  };

  // Web parity (transportTypeSelect change): changing mode recalculates all box weights,
  // and marks the mode as user-chosen so revalidation stops auto-switching it
  const handleSelectMode = (modeObj) => {
    setSelectedMode(modeObj.code);
    setUserMadeInitialModeChoice(true);
    setModeModalVisible(false);
    recomputeBoxesForMode(modeObj.volIngr);
  };

  // Calendar Days Grid Calculator
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  // Filtered Senders matching customer code
  const filteredSenders = useMemo(() => {
    if (!senderQuery || selectedSender) return [];
    const q = senderQuery.toLowerCase();
    return contactsList.filter(c => {
      const matchCust = !clientCode || c.CODE === clientCode;
      const matchText = (c.NAME || '').toLowerCase().includes(q) || (c.MOBILE || '').includes(q);
      return matchCust && matchText;
    }).slice(0, 5);
  }, [senderQuery, selectedSender, contactsList, clientCode]);

  // Filtered Receivers matching customer code
  const filteredReceivers = useMemo(() => {
    if (!receiverQuery || selectedReceiver) return [];
    const q = receiverQuery.toLowerCase();
    return contactsList.filter(c => {
      const matchCust = !clientCode || c.CODE === clientCode;
      const matchText = (c.NAME || '').toLowerCase().includes(q) || (c.MOBILE || '').includes(q) || (c.CITY || '').toLowerCase().includes(q);
      return matchCust && matchText;
    }).slice(0, 5);
  }, [receiverQuery, selectedReceiver, contactsList, clientCode]);

  // Handle Receiver Selection (Web: autofill carrier, city, pincode, zone modes)
  const handleSelectReceiver = (contact) => {
    setSelectedReceiver(contact);
    setReceiverQuery(contact.NAME || '');
    if (contact.PINCODE) setDestPincodeInput(String(contact.PINCODE));
    if (contact.CITY) setDestCityInput(contact.CITY);
    if (contact.CARRIER) setSelectedCarrier(contact.CARRIER);
  };

  // Check if main details are complete (Web: areMainDetailsComplete)
  const isMainDetailsComplete = useMemo(() => {
    const hasClient = !!clientCode;
    const hasSender = !!selectedSender || !!senderQuery;
    const hasReceiver = !!selectedReceiver || !!receiverQuery;
    const hasMode = !!selectedMode;
    const hasCarrier = !!selectedCarrier;
    return hasClient && hasSender && hasReceiver && hasMode && hasCarrier;
  }, [clientCode, selectedSender, senderQuery, selectedReceiver, receiverQuery, selectedMode, selectedCarrier]);

  // Mode & Carrier Options List
  const MODE_OPTIONS_LIST = useMemo(() => {
    if (modesMap && Object.keys(modesMap).length > 0) {
      return Object.entries(modesMap).map(([k, v]) => ({
        code: k,
        name: typeof v === 'string' ? v : (v.MODE || v.NAME || k),
        volIngr: parseFloat(v.VOL_INGR) || 5000,
        minWt: parseFloat(v.MIN_WT) || 0,
        rawObj: v
      }));
    }
    return DEFAULT_MODES;
  }, [modesMap]);

  const CARRIER_OPTIONS_LIST = useMemo(() => {
    if (carriersMap && Object.keys(carriersMap).length > 0) {
      return Object.entries(carriersMap).map(([k, v]) => ({
        code: k,
        name: typeof v === 'string' ? v : (v.COMPANY_NAME || v.NAME || k)
      }));
    }
    return DEFAULT_CARRIERS;
  }, [carriersMap]);

  // Payment Flags & Options
  const [flagDox, setFlagDox] = useState(false);
  const [doxWeight, setDoxWeight] = useState('0.1');
  const [doxType, setDoxType] = useState('DL');

  const [flagPcs, setFlagPcs] = useState(false);
  const [pcsCount, setPcsCount] = useState('1');

  const [flagTopay, setFlagTopay] = useState(bookForm.topay === 'Yes');
  const [flagCod, setFlagCod] = useState(false);
  const [codAmount, setCodAmount] = useState(bookForm.cod || '');
  const [flagFov, setFlagFov] = useState(false);
  const [flagSav, setFlagSav] = useState(false);

  // Box Adder State
  const [boxWgt, setBoxWgt] = useState('');
  const [boxLength, setBoxLength] = useState('');
  const [boxBreadth, setBoxBreadth] = useState('');
  const [boxHeight, setBoxHeight] = useState('');
  const [boxes, setBoxes] = useState([]);

  // Product Adder State
  const [prodName, setProdName] = useState('');
  const [prodDocNo, setProdDocNo] = useState('');
  const [prodDocType, setProdDocType] = useState('INV');
  const [prodEway, setProdEway] = useState('');
  const [prodAmount, setProdAmount] = useState('');
  const [products, setProducts] = useState([]);

  // --- Add Dox Envelope Handler (Exact Web logic window._doxRenderEntry L1365-1395) ---
  const handleAddDoxEnvelope = () => {
    if (!isMainDetailsComplete) {
      Alert.alert('Required Fields Missing', 'Please select Customer, Consignor, Consignee, Mode and Carrier first.');
      return;
    }
    const wgt = parseFloat(doxWeight);
    if (!wgt || wgt <= 0) {
      Alert.alert('Error', 'Please enter a valid Dox weight in kg.');
      return;
    }
    if (wgt > 2.0) {
      Alert.alert('Weight Exceeded', 'Dox weight cannot exceed 2.0 kg.');
      return;
    }
    const size = DOX_SIZES[doxType] || DOX_SIZES.DL;
    const h = wgt <= 0.1 ? 0.5 : wgt <= 0.5 ? 1 : wgt <= 1.0 ? 2 : 3;

    const doxBox = {
      BOX_NUM: 1,
      WEIGHT: wgt,
      LENGTH: size.l,
      BREADTH: size.b,
      HIGHT: h,
      VOLUME: (size.l * size.b * h) / 5000,
      CHG_WT: wgt
    };
    const doxProd = {
      PRODUCT: 'Documents/Papers',
      DOC_NUMBER: doxType,
      DOC_TYPE: 'DOX',
      EWAY_IF: '',
      AMOUNT: 100
    };

    setBoxes([doxBox]);
    setProducts([doxProd]);
    setIsFormLocked(true);
  };

  // Live Calculations Summary (Web: updateSummaryDisplay — applies mode MIN_WT to CHG_WT)
  const summaryTotals = useMemo(() => {
    let wgt = 0;
    let chg = 0;
    let amt = 0;
    boxes.forEach(b => {
      wgt += b.WEIGHT || 0;
      chg += b.CHG_WT || 0;
    });
    products.forEach(p => {
      amt += p.AMOUNT || 0;
    });
    const modeObj = MODE_OPTIONS_LIST.find(m => m.code === selectedMode);
    const minWt = modeObj && modeObj.minWt ? parseFloat(modeObj.minWt) : 0;
    const finalTotalChgWt = Math.max(chg, minWt);
    return {
      totalWgt: wgt,
      totalChgWt: finalTotalChgWt,
      rawChgWt: chg,
      boxCount: boxes.length,
      totalAmount: amt
    };
  }, [boxes, products, selectedMode, MODE_OPTIONS_LIST]);

  // Exact Web Helper Table & Rate Lookup — now delegated to the SHARED engine
  // (GENIE_WEB/GENIE_REACT utils/calculations.js getHelperTableData + calculateFreight)
  const helperTableData = useMemo(() => {
    const client = activeClient || {};
    const receiverZone = selectedReceiver?.ZONE || null;
    const helper = getHelperTableData(
      summaryTotals.totalChgWt || 0,
      client,
      selectedMode,
      receiverZone,
      ratesMap
    );
    const rate = parseFloat(helper.rate);
    const addRate = parseFloat(helper.add_rate);
    const weightCeiling = parseFloat(helper.weight_ceiling) || 0;
    // weight_zone is 0.5 (E/P), a number threshold, or '---' — pass through exactly like web
    const weightZone = helper.weight_zone;
    const fright = calculateFreight(selectedMode, isNaN(rate) ? 0 : rate, isNaN(addRate) ? 0 : addRate, weightCeiling, weightZone);
    return {
      weightCeiling: weightCeiling,
      weightZone: weightZone,
      rateUid: helper.rate_uid,
      rate: isNaN(rate) ? null : rate,
      addRate: isNaN(addRate) ? null : addRate,
      fright: Math.max(0, fright)
    };
  }, [summaryTotals, activeClient, clientCode, selectedMode, selectedReceiver, ratesMap]);

  // Exact Web Calculation Engine — delegated to SHARED calculateAllCharges
  // (includes within-state SGST+CGST 9/9 vs inter-state IGST 18% split via branchesMap,
  //  GST_INC inclusive pricing, COD/TOPAY/FOV/EWay/AWB/Packing/Dev charges)
  const calculatedCharges = useMemo(() => {
    const client = activeClient || {};
    const frightValue = helperTableData.fright || 0;
    // Web expects products as { type, amount, ewayBill } (lowercase keys)
    const productsMapped = products.map(p => ({ type: p.DOC_TYPE, amount: p.AMOUNT || 0, ewayBill: p.EWAY_IF || '' }));
    const charges = calculateAllCharges(
      frightValue,
      summaryTotals,
      client,
      { cod: { checked: flagCod }, topay: { checked: flagTopay }, fov: { checked: flagFov } },
      productsMapped,
      summaryTotals.totalChgWt || 0,
      branchesMap
    );
    const igst = parseFloat(charges.igst) || 0;
    const sgst = parseFloat(charges.sgst) || 0;
    const cgst = parseFloat(charges.cgst) || 0;
    return {
      fright: charges.fright,
      otherCharges: charges.other_chg,
      gstTotal: charges.gst_total,
      total: charges.total,
      taxable: charges.taxable,
      fuelChg: charges.fuel_chg,
      codChg: charges.cod_chg,
      topayChg: charges.topay_chg,
      fovChg: charges.fov_chg,
      ewayChg: charges.eway_chg,
      awbChg: charges.awb_chg,
      packChg: charges.pack_chg,
      devChg: charges.dev_chg,
      sgst: charges.sgst,
      cgst: charges.cgst,
      igst: charges.igst,
      taxMode: igst > 0 ? 'IGST (Inter-state 18%)' : ((sgst > 0 || cgst > 0) ? 'SGST + CGST (Within-state 9%+9%)' : 'No GST')
    };
  }, [helperTableData, summaryTotals, activeClient, flagCod, flagTopay, flagFov, products, branchesMap]);

  // --- Mode revalidation (Web: revalidateMode) ---
  // 1) Express weight limit: exceed customer's WEIGHT_CHANGE → switch away from Express;
  //    back within limit → revert to Express.
  const expressModeObj = useMemo(() =>
    MODE_OPTIONS_LIST.find(m => (m.name || '').toUpperCase() === 'EXPRESS' || (m.rawObj?.MODE || '').toUpperCase() === 'EXPRESS'),
    [MODE_OPTIONS_LIST]);

  useEffect(() => {
    if (editRef) return; // editing — user controls the mode
    if (userMadeInitialModeChoice) return; // user explicitly chose a mode — don't fight them
    if (!expressModeObj) return;
    const weightChangeLimit = parseFloat(activeClient?.WEIGHT_CHANGE);
    if (isNaN(weightChangeLimit)) return;
    let msg = '';
    // Web revalidateMode compares summaryTotals.totalChgWt (MIN_WT-adjusted), not raw box weight
    if (summaryTotals.totalChgWt > weightChangeLimit && selectedMode === expressModeObj.code) {
      const newMode = selectedReceiver?.MODE;
      if (newMode && newMode !== selectedMode) {
        const newModeObj = MODE_OPTIONS_LIST.find(m => m.code === newMode);
        setSelectedMode(newMode);
        // Web renderMultiboxTable() after auto-switch — CHG_WT follows the new mode's VOL_INGR
        if (newModeObj) recomputeBoxesForMode(newModeObj.volIngr);
        msg = `Mode auto-switched to ${newMode} based on weight.`;
      } else {
        msg = `Weight exceeds Express limit (${weightChangeLimit}kg). Please select a new mode.`;
      }
    } else if (summaryTotals.totalChgWt <= weightChangeLimit && selectedMode && selectedMode !== expressModeObj.code) {
      setSelectedMode(expressModeObj.code);
      // Web renderMultiboxTable() on revert to Express — CHG_WT follows Express VOL_INGR
      recomputeBoxesForMode(expressModeObj.volIngr);
      msg = 'Weight is within limit. Mode reverted to Express.';
    }
    setModeChangeMsg(msg);
  }, [summaryTotals.totalChgWt, selectedMode, selectedReceiver?.MODE, activeClient?.WEIGHT_CHANGE, expressModeObj, MODE_OPTIONS_LIST, editRef, userMadeInitialModeChoice]);

  // 2) Zone availability: current mode not available for receiver zone → auto-switch to Surface
  useEffect(() => {
    if (editRef) return;
    if (userMadeInitialModeChoice) return;
    const zone = selectedReceiver?.ZONE;
    if (!zone) return;
    const modeData = MODE_OPTIONS_LIST.find(m => m.code === selectedMode);
    if (modeData && modeData.rawObj && modeData.rawObj[zone] === 'N') {
      const surface = MODE_OPTIONS_LIST.find(m => (m.name || '').toUpperCase() === 'SURFACE' || (m.rawObj?.MODE || '').toUpperCase() === 'SURFACE');
      if (surface && surface.code !== selectedMode) {
        setSelectedMode(surface.code);
        // Web renderMultiboxTable() after mode change — CHG_WT follows Surface VOL_INGR
        recomputeBoxesForMode(surface.volIngr);
        setModeChangeMsg(`Mode ${modeData.name} not available for ${zone}. Switched to Surface. Select another mode if needed.`);
      }
    }
  }, [selectedReceiver?.ZONE, selectedMode, MODE_OPTIONS_LIST, editRef, userMadeInitialModeChoice]);

  // AWB Input
  const [awbNumber, setAwbNumber] = useState(bookForm.awb || '');

  // Add Box Handler (Web: addMultiboxEntry -> requires Wgt+L+B+H, considers Pcs multiplier,
  // uses shared recalculateAllBoxWeights with the mode's VOL_INGR)
  const handleAddBox = () => {
    if (!isMainDetailsComplete) {
      Alert.alert('Required Fields Missing', 'Please select Customer, Consignor, Consignee, Mode and Carrier first.');
      return;
    }
    const w = parseFloat(boxWgt) || 0;
    const l = parseFloat(boxLength) || 0;
    const b = parseFloat(boxBreadth) || 0;
    const h = parseFloat(boxHeight) || 0;

    // Web parity: all four of Wgt, L, B and H must be filled
    if (!w || !l || !b || !h) {
      Alert.alert('Error', 'Please fill all Wgt, L, B, and H fields to add a box.');
      return;
    }
    const pcsMultiplier = flagPcs ? (parseInt(pcsCount) || 1) : 1;
    const modeObj = MODE_OPTIONS_LIST.find(m => m.code === selectedMode);
    const volDivisor = modeObj ? modeObj.volIngr : 5000;
    const [computed] = recalculateAllBoxWeights([{ actualWeight: w, length: l, breadth: b, height: h }], volDivisor);
    const volWt = computed.volWeight;
    const chgWt = computed.chargeWeight;

    const addedBoxes = [];
    for (let i = 0; i < pcsMultiplier; i++) {
      addedBoxes.push({
        BOX_NUM: boxes.length + i + 1,
        WEIGHT: w,
        LENGTH: l,
        BREADTH: b,
        HIGHT: h,
        VOLUME: volWt,
        CHG_WT: chgWt
      });
    }
    setBoxes([...boxes, ...addedBoxes]);
    setIsFormLocked(true);
    setBoxWgt('');
    setBoxLength('');
    setBoxBreadth('');
    setBoxHeight('');
    setPcsCount('1');
  };

  const handleRemoveBox = (index) => {
    const updated = boxes.filter((_, i) => i !== index);
    setBoxes(updated);
    if (updated.length === 0 && products.length === 0) setIsFormLocked(false);
  };

  const handleClearBoxes = () => {
    setBoxes([]);
    if (products.length === 0) setIsFormLocked(false);
  };

  // Add Product Handler (Web: addProductEntry -> requires Prod + DocNo + Amount, locks top form,
  // EWay mandatory ≥ ₹50,000 and must be 12 digits)
  const handleAddProduct = () => {
    if (!isMainDetailsComplete) {
      Alert.alert('Required Fields Missing', 'Please select Customer, Consignor, Consignee, Mode and Carrier first.');
      return;
    }
    if (!prodName.trim() || !prodDocNo.trim() || !prodAmount.trim()) {
      Alert.alert('Error', 'Product, DocNo and Amount fields are required.');
      return;
    }
    const amt = parseFloat(prodAmount) || 0;
    if (amt >= 50000 && !prodEway) {
      Alert.alert('EWay Required', 'EWay Bill is mandatory for invoice value ₹50,000 and above.');
      return;
    }
    if (prodEway && !/^\d{12}$/.test(prodEway.trim())) {
      Alert.alert('Invalid EWay Bill', 'EWay bill must be a 12-digit numeric number.');
      return;
    }
    const newProd = {
      PRODUCT: prodName,
      DOC_NUMBER: prodDocNo,
      DOC_TYPE: prodDocType,
      EWAY_IF: prodEway.trim(),
      AMOUNT: amt
    };
    setProducts([...products, newProd]);
    setIsFormLocked(true);
    setProdName('');
    setProdDocNo('');
    setProdEway('');
    setProdAmount('');
    setProdDocType('INV');
  };

  const handleRemoveProduct = (index) => {
    const updated = products.filter((_, i) => i !== index);
    setProducts(updated);
    if (updated.length === 0 && boxes.length === 0) setIsFormLocked(false);
  };

  const handleClearProducts = () => {
    setProducts([]);
    if (boxes.length === 0) setIsFormLocked(false);
  };

  // AWB pattern validation (Web: validateAwbPattern — informational, does NOT block submission)
  const validateAwbPattern = (raw) => {
    const val = raw !== undefined ? raw : awbNumber;
    const trimmed = (val || '').trim();
    if (!trimmed) { setAwbHint(null); return; }
    const carrier = selectedCarrier || '';
    const mode = selectedMode || '';
    const weight = parseFloat(boxWgt) || summaryTotals.totalWgt || 0;
    const detectedCarrier = detectCarrierFromAWB(trimmed);
    const awbProduct = detectProductFromAWB(trimmed);
    const expectedProduct = detectProductCode({
      CARRIER: carrier, MODE: mode, WEIGHT: weight,
      COD: flagCod ? 'Y' : '0', TOPAY: flagTopay ? 'Y' : 'N', TOPAY_CHG: 0
    });
    if (!detectedCarrier) {
      setAwbHint({ text: '⚠ AWB pattern not recognised — verify carrier manually', kind: 'warn' });
    } else if (carrier && detectedCarrier.toLowerCase() !== carrier.toLowerCase()) {
      setAwbHint({ text: `⚠ AWB looks like ${detectedCarrier} but carrier selected is ${carrier}`, kind: 'error' });
    } else if (expectedProduct && awbProduct && expectedProduct !== awbProduct) {
      setAwbHint({ text: `⚠ AWB series matches ${awbProduct} but shipment needs ${expectedProduct}`, kind: 'warn' });
    } else {
      setAwbHint({ text: `✓ AWB pattern matches ${expectedProduct || detectedCarrier}`, kind: 'success' });
    }
  };

  // Auto Generate AWB (web "Get AWB" button — this app generates instead of the web stub)
  const handleGenerateAwb = () => {
    const gen = 'JTL' + Math.floor(10000000 + Math.random() * 90000000);
    setAwbNumber(gen);
    validateAwbPattern(gen);
  };

  // --- Payment flag helper (Web: Dox unchecks Pcs/Topay/COD/FOV; those uncheck Dox;
  //     Dox also auto-selects Express mode when not editing) ---
  const setPaymentFlag = (name, val) => {
    if (name === 'dox') {
      if (val) {
        setFlagPcs(false);
        setFlagTopay(false);
        setFlagCod(false);
        setFlagFov(false);
        if (!editRef && expressModeObj) setSelectedMode(expressModeObj.code);
      }
      setFlagDox(val);
    } else if (name === 'pcs') {
      if (val) setFlagDox(false);
      setFlagPcs(val);
    } else if (name === 'topay') {
      if (val) setFlagDox(false);
      setFlagTopay(val);
    } else if (name === 'cod') {
      if (val) setFlagDox(false);
      setFlagCod(val);
    } else if (name === 'fov') {
      if (val) setFlagDox(false);
      setFlagFov(val);
    } else if (name === 'sav') {
      setFlagSav(val);
    }
  };

  const fmtFromUnix = (u) => {
    const ms = Number(u) > 1e10 ? Number(u) : Number(u) * 1000;
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // --- Web-shaped payload builder (core/book-order.js buildBookingPayload) ---
  // DATES: must be Unix MILLISECONDS (UTC midnight) — exactly what web's toUnix()
  // (core/formatIST.js) sends. fmtDate()/the server parse numeric values as ms, so
  // sending seconds (e.g. 1775836800) renders as 1970s dates.
  const buildBookingPayload = () => {
    const unixDate = new Date(orderDate + 'T00:00:00Z').getTime() || Date.now();
    const modeObj = MODE_OPTIONS_LIST.find(m => m.code === selectedMode);
    const modeName = (modeObj?.name || selectedMode || '').toUpperCase().replace(/ /g, '_');
    const tat = selectedReceiver ? (selectedReceiver[`${modeName}_TAT`] || '') : '';
    const consignorUid = selectedSender ? (selectedSender.UID || selectedSender.NAME) : (senderQuery.trim() || '');
    const consigneeUid = selectedReceiver ? (selectedReceiver.UID || selectedReceiver.NAME) : (receiverQuery.trim() || '');
    const invoiceId = generateInvoiceId(activeClient?.CODE || clientCode, activeClient?.BILL_CYCLE, unixDate, flagTopay);

    const order = {
      INVOICE_ID: invoiceId,
      CODE: clientCode,
      BRANCH: activeClient?.BRANCH || '',
      ORDER_DATE: unixDate,
      CARRIER: selectedCarrier,
      // Web sends the AWB as typed; keep the previous auto-generate fallback so the
      // reference/messaging never shows an empty AWB
      AWB_NUMBER: awbNumber.trim() || ('JTL' + Math.floor(10000000 + Math.random() * 90000000)),
      TRANSIT_DATE: unixDate,
      CONSIGNOR: consignorUid,
      ORIGIN_CITY: originCityInput || selectedSender?.CITY || '',
      ORIGIN_PINCODE: originPincodeInput || '',
      CONSIGNEE: consigneeUid,
      DEST_CITY: destCityInput || selectedReceiver?.CITY || '',
      DEST_PINCODE: destPincodeInput || '',
      TAT: tat,
      ZONE: selectedReceiver?.ZONE || '',
      MODE: selectedMode,
      GLOBAL: flagDox ? 'Yes' : 'No',
      COD: flagCod ? 'Yes' : 'No',
      TOPAY: flagTopay ? 'Yes' : 'No',
      FOV: flagFov ? 'Yes' : 'No',
      WEIGHT: summaryTotals.totalWgt || 0,
      CHG_WT: summaryTotals.totalChgWt || 0,
      PIECS: boxes.length || 0,
      VALUE: summaryTotals.totalAmount || 0,
      FRIGHT: parseFloat(calculatedCharges.fright) || 0,
      FUEL_CHG: parseFloat(calculatedCharges.fuelChg) || 0,
      COD_CHG: parseFloat(calculatedCharges.codChg) || 0,
      TOPAY_CHG: parseFloat(calculatedCharges.topayChg) || 0,
      FOV_CHG: parseFloat(calculatedCharges.fovChg) || 0,
      EWAY_CHG: parseFloat(calculatedCharges.ewayChg) || 0,
      AWB_CHG: parseFloat(calculatedCharges.awbChg) || 0,
      PACK_CHG: parseFloat(calculatedCharges.packChg) || 0,
      DEV_CHG: parseFloat(calculatedCharges.devChg) || 0,
      TAXABLE: parseFloat(calculatedCharges.taxable) || 0,
      SGST: parseFloat(calculatedCharges.sgst) || 0,
      CGST: parseFloat(calculatedCharges.cgst) || 0,
      IGST: parseFloat(calculatedCharges.igst) || 0,
      TOTAL: parseFloat(calculatedCharges.total) || 0,
    };
    const volDivisor = modeObj ? modeObj.volIngr : 5000;
    const multibox = boxes.map(b => ({
      WEIGHT: b.WEIGHT,
      LENGTH: b.LENGTH,
      BREADTH: b.BREADTH,
      HIGHT: b.HIGHT,
      VOLUME: b.VOLUME || ((b.LENGTH * b.BREADTH * b.HIGHT) / volDivisor),
      CHG_WT: b.CHG_WT
    }));
    const productsMapped = products.map(p => ({
      DOC_NUMBER: p.DOC_NUMBER,
      DOC_TYPE: p.DOC_TYPE,
      PRODUCT: p.PRODUCT,
      AMOUNT: p.AMOUNT || 0,
      EWAY_IF: p.EWAY_IF || ''
    }));
    return { order, multibox, products: productsMapped };
  };

  // Reset after booking (Web: resetForNextBooking — SAV preserves customer/consignor/consignee/carrier)
  const resetForNextBooking = () => {
    const sav = flagSav;
    const dox = flagDox;
    setBoxes([]);
    setProducts([]);
    setAwbNumber('');
    setAwbHint(null);
    setCodAmount('');
    setFlagCod(false);
    setFlagTopay(false);
    setFlagPcs(false);
    setModeChangeMsg('');
    if (!sav) {
      setSelectedReceiver(null);
      setReceiverQuery('');
      setSelectedCarrier('');
      setDestCityInput('');
      setDestPincodeInput('');
    }
    if (!(sav && dox)) setFlagDox(false);
    else { setDoxWeight('0.1'); setDoxType('DL'); }
    setUserMadeInitialModeChoice(false);
    setIsFormLocked(false);
  };

  // Start editing an order from its payload (Web: prefillEditOrder)
  const startEditFromPayload = (payload) => {
    const order = payload.order || payload;
    const boxesList = payload.boxes || [];
    const productsList = payload.products || [];
    setEditRef(order.REFERENCE || payload.REFERENCE || order.AWB_NUMBER || null);
    setBookingMessage('');
    setBookingMessageKind('info');
    if (order.CODE) {
      setClientCode(order.CODE);
      const client = clientsArray.find(c => (c.CODE || c.UID || '') === order.CODE);
      if (client) handleSelectClient(client);
    }
    const cnor = order.CONSIGNOR ? contactsList.find(c => c.UID === order.CONSIGNOR) : null;
    if (cnor) {
      setSelectedSender(cnor);
      setSenderQuery(cnor.NAME || '');
      if (cnor.PINCODE) setOriginPincodeInput(String(cnor.PINCODE));
      if (cnor.CITY) setOriginCityInput(cnor.CITY);
    } else {
      setSenderQuery(order.CONSIGNOR || '');
      setSelectedSender(null);
    }
    const cnee = order.CONSIGNEE ? contactsList.find(c => c.UID === order.CONSIGNEE) : null;
    if (cnee) {
      setSelectedReceiver(cnee);
      setReceiverQuery(cnee.NAME || '');
      if (cnee.PINCODE) setDestPincodeInput(String(cnee.PINCODE));
      if (cnee.CITY) setDestCityInput(cnee.CITY);
      if (cnee.CARRIER) setSelectedCarrier(cnee.CARRIER);
    } else {
      setReceiverQuery(order.CONSIGNEE || '');
      setSelectedReceiver(null);
      setDestCityInput(order.DEST_CITY || '');
      setDestPincodeInput(order.DEST_PINCODE || '');
    }
    setSelectedMode(order.MODE || '');
    setSelectedCarrier(order.CARRIER || '');
    setAwbNumber(order.AWB_NUMBER || '');
    setAwbHint(null);
    if (order.ORDER_DATE) setOrderDate(fmtFromUnix(order.ORDER_DATE));
    setFlagDox(order.GLOBAL === 'Yes');
    setFlagTopay(order.TOPAY === 'Yes');
    setFlagCod(order.COD === 'Yes');
    setFlagFov(order.FOV === 'Yes');
    setBoxes(boxesList.map((b, i) => ({ ...b, BOX_NUM: b.BOX_NUM || (i + 1) })));
    setProducts(productsList);
    setIsFormLocked(false);
    if (productsList.some(p => p.DOC_TYPE === 'DOX')) setFlagDox(true);
  };

  // --- Add Contact (Web: jawaS/book-order-add-contact.js) ---
  const openAddContact = (type) => {
    setAddContactType(type);
    setAddContactVisible(true);
    setAcForm({ name: '', mobile: '', pincode: '', address: '', email: '', gstin: '', carrier: '' });
    setAcPinResult(null);
    setAcPinStatus('');
    setAcError('');
  };

  const handleAcPincodeChange = async (pin) => {
    acPinLatest.current = pin;
    setAcForm(f => ({ ...f, pincode: pin }));
    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      setAcPinStatus('…');
      const r = await searchPin(pin);
      // Race guard — ignore stale responses for an older pincode
      if (acPinLatest.current !== pin) return;
      if (r.found) {
        const manualZone = r.ZONE === null || r.ZONE === undefined;
        setAcPinResult({
          found: true,
          city: r.CITY,
          state: r.STATE,
          stateCode: r.STATE_CODE || '',
          gstCode: r.GST_CODE || '',
          zone: manualZone ? '' : r.ZONE || '',
          oda: r.ODA || '',
          expressTat: r.EXPRESS_TAT !== 'N' ? r.EXPRESS_TAT : '',
          airlineTat: r.AIRLINE_TAT !== 'N' ? r.AIRLINE_TAT : '',
          surfaceTat: r.SURFACE_TAT !== 'N' ? r.SURFACE_TAT : '',
          premiumTat: r.PREMIUM_TAT !== 'N' ? r.PREMIUM_TAT : '',
          manualZone
        });
        setAcPinStatus(manualZone ? '⚠' : '✔');
      } else {
        setAcPinResult({ found: false });
        setAcPinStatus('✖');
      }
    } else {
      setAcPinResult(null);
      setAcPinStatus('');
    }
  };

  const handleAcSave = async () => {
    setAcError('');
    const name = acForm.name.trim();
    const mobile = acForm.mobile.trim();
    const address = acForm.address.trim();
    const pincode = acForm.pincode.trim();
    const zone = (acPinResult?.zone || '').trim();
    if (!name || !mobile || !address || !pincode) {
      setAcError('Name, Mobile, Address and Pincode are required.');
      return;
    }
    if (mobile.length !== 10) {
      setAcError('Mobile number must be exactly 10 digits.');
      return;
    }
    if (!acPinResult?.found || !acPinResult.city) {
      setAcError('Pincode not resolved — enter a valid pincode.');
      return;
    }
    if (!zone) {
      setAcError('Zone is required. Enter it manually if not auto-filled.');
      return;
    }
    setAcSaving(true);
    try {
      const payload = {
        NAME: name,
        MOBILE: '91' + mobile,
        ADDRESS: address,
        PINCODE: pincode,
        EMAIL: acForm.email.trim() || null,
        GSTIN: acForm.gstin.trim().toUpperCase() || null,
        PAN: null,
        AADHAAR: null,
        CARRIER: acForm.carrier.trim() || null,
        BRANCH: activeClient?.BRANCH || '',
        CODE: clientCode,
        CITY: acPinResult.city,
        STATE: acPinResult.state,
        CODE_STATE: acPinResult.stateCode,
        GST_CODE: acPinResult.gstCode,
        ZONE: zone,
        ODA: acPinResult.oda || null,
        EXPRESS_TAT: parseFloat(acPinResult.expressTat) || 0,
        AIRLINE_TAT: parseFloat(acPinResult.airlineTat) || 0,
        SURFACE_TAT: parseFloat(acPinResult.surfaceTat) || 0,
        PREMIUM_TAT: parseFloat(acPinResult.premiumTat) || 0,
      };
      const res = await fetch(`${apiBase}/api/writeB2B2C`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.status === 'error') throw new Error(json.message || 'Failed to save contact');
      const record = json.record || json.data || { ...payload };
      if (!record.UID) record.UID = json.uid || ('UID_' + Date.now());
      if (!record.NAME) record.NAME = name;
      if (onContactCreated) onContactCreated(record);
      if (addContactType === 'sender') handleSelectSender(record);
      else handleSelectReceiver(record);
      setAddContactVisible(false);
    } catch (err) {
      setAcError(err.message || 'Failed to save contact.');
    } finally {
      setAcSaving(false);
    }
  };

  // Auto-dismissing booking message — it must not linger on screen forever.
  const bookingMsgTimerRef = useRef(null);
  const showBookingMessage = (msg, kind = 'info', duration = 5000) => {
    if (bookingMsgTimerRef.current) clearTimeout(bookingMsgTimerRef.current);
    setBookingMessage(msg);
    setBookingMessageKind(kind);
    if (duration > 0) {
      bookingMsgTimerRef.current = setTimeout(() => {
        setBookingMessage('');
        setBookingMessageKind('info');
      }, duration);
    }
  };

  useEffect(() => () => {
    if (bookingMsgTimerRef.current) clearTimeout(bookingMsgTimerRef.current);
  }, []);

  // Submit Handler (Web: book_button click — edit → PUT /api/editOrder, new → POST /api/bookOrder,
  // waits for server confirmation, then renders the last-booked card)
  const handleSubmit = async () => {
    if (bookingMsgTimerRef.current) clearTimeout(bookingMsgTimerRef.current);
    setBookingMessage('');
    setBookingMessageKind('info');
    if (!isMainDetailsComplete) {
      showBookingMessage('Please fill Customer, Sender, Receiver, Mode and Carrier.', 'error', 6000);
      return;
    }
    if (boxes.length === 0 && products.length === 0) {
      showBookingMessage('Please add at least one Box or Product.', 'error', 6000);
      return;
    }
    const payload = buildBookingPayload();
    if (editRef) {
      payload.order.REFERENCE = editRef;
      payload.deleteMultibox = true;
      payload.deleteProducts = true;
    }
    setBookForm(payload);
    try {
      const result = await onBookOrder(payload);
      const ref = result?.reference || editRef || payload.order.AWB_NUMBER;
      if (result?.ok) {
        if (editRef) {
          showBookingMessage(result.confirmed ? `Order ${ref} updated successfully!` : `Updated (Ref: ${ref}) — server confirmation pending.`, result.confirmed ? 'success' : 'warn', 5000);
        } else {
          showBookingMessage(result.confirmed ? `Booked successfully! Reference: ${ref}` : `Booked (Ref: ${ref}) — server confirmation pending.`, result.confirmed ? 'success' : 'warn', 5000);
        }
        // Web parity (renderLastBooked): the card renders the FLAT order record —
        // NOT the nested { order, multibox, products } payload, else every field
        // shows as NaN/blank. Boxes/products ride along so Edit can re-prefill them.
        // Record the transaction (booked / pending)
        recordBookingTxn({ id: `${Date.now()}-${ref || 'x'}`, ts: Date.now(), status: result.confirmed ? 'booked' : 'pending', ref });
        setLastBookedOrder({ ...payload.order, reference: ref, boxes: payload.multibox, products: payload.products });
        setEditRef(null);
        resetForNextBooking();
      } else {
        showBookingMessage(`Booking failed: ${result?.message || 'Unknown error'}`, 'error', 8000);
        recordBookingTxn({ id: `${Date.now()}-err`, ts: Date.now(), status: 'error', ref, message: result?.message || 'Unknown error' });
      }
    } catch (e) {
      showBookingMessage(`Booking failed: ${e.message}`, 'error', 8000);
      recordBookingTxn({ id: `${Date.now()}-err2`, ts: Date.now(), status: 'error', ref: editRef || payload.order.AWB_NUMBER, message: e.message });
    }
  };

  // Delete order (Web: boDeleteOrder → DELETE /api/deleteOrder)
  const handleDeleteOrder = async (ref) => {
    if (!ref) return;
    Alert.alert('Delete Order', `Delete order ${ref}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${apiBase}/api/deleteOrder`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: ref })
            });
            const json = await res.json();
            if (json.status === 'error') throw new Error(json.message);
            setLastBookedOrder(null);
            Alert.alert('Deleted', `Order ${ref} deleted.`);
          } catch (err) {
            Alert.alert('Delete Failed', err.message);
          }
        }
      }
    ]);
  };

  // Clear All Form (Web: resetFullForm)
  const handleClearAll = () => {
    setSelectedSender(null);
    setSenderQuery('');
    setSelectedReceiver(null);
    setReceiverQuery('');
    setDestCityInput('');
    setDestPincodeInput('');
    setOriginCityInput('');
    setOriginPincodeInput('');
    setBoxes([]);
    setProducts([]);
    setAwbNumber('');
    setAwbHint(null);
    setCodAmount('');
    setFlagCod(false);
    setFlagTopay(false);
    setFlagDox(false);
    setFlagPcs(false);
    setFlagSav(false);
    setClientCode('');
    setSelectedMode('');
    setSelectedCarrier('');
    setEditRef(null);
    setBookingMessage('');
    setModeChangeMsg('');
    setUserMadeInitialModeChoice(false);
    setIsFormLocked(false);
  };

  return (
    <ScrollView style={styles.scrollPage} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.pageTitle}>Book Order</Text>

      {/* ── EDIT BANNER (Web: prefillEditOrder banner) ── */}
      {editRef && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>✏️ Editing Order: {editRef}</Text>
          <TouchableOpacity onPress={() => { setEditRef(null); setBookingMessage(''); }}>
            <Text style={{ color: '#b45309', fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── BOOKING MESSAGE (Web: bookingMessage) ── */}
      {bookingMessage ? (
        <View style={[styles.bookingMsgBox, bookingMessageKind === 'success' && styles.bookingMsgSuccess, bookingMessageKind === 'error' && styles.bookingMsgError, bookingMessageKind === 'warn' && styles.bookingMsgWarn]}>
          <Text style={styles.bookingMsgText}>{bookingMessage}</Text>
        </View>
      ) : null}

      {/* ── SECTION 1: Top Controls (Order Date Calendar & Client Dropdown 2:3 Ratio) ── */}
      <View style={[styles.cardWeb, isFormLocked && styles.cardLocked]}>
        <Text style={styles.sectionHeaderTitle}>1. Order Info & Client</Text>
        <View style={styles.rowGrid}>
          <View style={{ flex: 2 }}>
            <Text style={styles.labelWeb}>ORDER DATE</Text>
            <TouchableOpacity
              disabled={isFormLocked}
              style={[styles.calendarTriggerBtn, isFormLocked && styles.btnDisabled]}
              onPress={() => setOrderDateModalVisible(true)}
            >
              <CalendarIcon size={14} color={isFormLocked ? "#94a3b8" : "#0284c7"} />
              <Text style={[styles.calendarTriggerText, isFormLocked && styles.textDisabled]}>
                {orderDate || 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 3 }}>
            <Text style={styles.labelWeb}>CLIENT NAME</Text>
            <TouchableOpacity
              disabled={isFormLocked}
              style={[styles.clientSelectorBtn, isFormLocked && styles.btnDisabled]}
              onPress={() => setClientModalVisible(true)}
            >
              <Text style={[styles.clientSelectorText, isFormLocked && styles.textDisabled]} numberOfLines={1}>
                {selectedClientName || 'Select Client'}
              </Text>
              <Text style={styles.clientSelectorArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── SECTION 2: Consignor (Sender) Details ── */}
      <View style={[styles.cardWeb, isFormLocked && styles.cardLocked]}>
        <Text style={styles.sectionHeaderTitle}>2. Consignor (Sender) Details</Text>
        <Text style={styles.labelWeb}>SEARCH SENDER (NAME / MOBILE)</Text>
        <TextInput
          editable={!isFormLocked}
          style={[styles.inputWeb, isFormLocked && styles.inputDisabled]}
          placeholder="Type consignor name or phone..."
          placeholderTextColor="#94a3b8"
          value={senderQuery}
          onChangeText={(text) => {
            setSenderQuery(text);
            if (selectedSender) setSelectedSender(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (filteredSenders.length > 0) {
              handleSelectSender(filteredSenders[0]);
            }
          }}
        />

        {filteredSenders.length > 0 && !isFormLocked && (
          <View style={styles.autocompleteBox}>
            {filteredSenders.map((c, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.autocompleteItem}
                onPress={() => handleSelectSender(c)}
              >
                <Text style={styles.autocompleteName}>{c.NAME}</Text>
                <Text style={styles.autocompleteSub}>{c.CITY || 'City N/A'} | Ph: {c.MOBILE || 'N/A'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.autocompleteAddNew} onPress={() => { openAddContact('sender'); }}>
              <Text style={styles.autocompleteAddNewText}>+ Add New Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedSender ? (
          <View style={styles.selectedContactCard}>
            <Text style={styles.contactName}>{selectedSender.NAME}</Text>
            <Text style={styles.contactDetail}>{selectedSender.ADDRESS || 'No Address'}</Text>
            <Text style={styles.contactDetail}>{selectedSender.CITY} - {selectedSender.PINCODE} ({selectedSender.STATE || 'State N/A'})</Text>
            <Text style={styles.contactDetail}>Mobile: {selectedSender.MOBILE || 'N/A'}</Text>
            <Text style={styles.contactDetail}>Origin: {originCityInput || selectedSender.CITY || 'N/A'} - {originPincodeInput || selectedSender.PINCODE || 'N/A'}</Text>
          </View>
        ) : (
          <Text style={styles.placeholderTextItalic}>Select a customer to autofill sender or type consignor name.</Text>
        )}
      </View>

      {/* ── SECTION 3: Consignee (Receiver) Details ── */}
      <View style={[styles.cardWeb, isFormLocked && styles.cardLocked]}>
        <Text style={styles.sectionHeaderTitle}>3. Consignee (Receiver) Details</Text>
        <Text style={styles.labelWeb}>SEARCH RECEIVER (NAME / MOBILE)</Text>
        <TextInput
          editable={!isFormLocked}
          style={[styles.inputWeb, isFormLocked && styles.inputDisabled]}
          placeholder="Type consignee name or phone..."
          placeholderTextColor="#94a3b8"
          value={receiverQuery}
          onChangeText={(text) => {
            setReceiverQuery(text);
            if (selectedReceiver) setSelectedReceiver(null);
          }}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (filteredReceivers.length > 0) {
              const top = filteredReceivers[0];
              handleSelectReceiver(top);
            }
          }}
        />

        {filteredReceivers.length > 0 && !isFormLocked && (
          <View style={styles.autocompleteBox}>
            {filteredReceivers.map((c, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.autocompleteItem}
                onPress={() => handleSelectReceiver(c)}
              >
                <Text style={styles.autocompleteName}>{c.NAME}</Text>
                <Text style={styles.autocompleteSub}>{c.CITY || 'City N/A'} | Ph: {c.MOBILE || 'N/A'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.autocompleteAddNew} onPress={() => { openAddContact('receiver'); }}>
              <Text style={styles.autocompleteAddNewText}>+ Add New Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedReceiver && (
          <View style={styles.selectedContactCard}>
            <Text style={styles.contactName}>{selectedReceiver.NAME}</Text>
            <Text style={styles.contactDetail}>{selectedReceiver.ADDRESS || 'No Address'}</Text>
            <Text style={styles.contactDetail}>{selectedReceiver.CITY} - {selectedReceiver.PINCODE} ({selectedReceiver.STATE || 'State N/A'})</Text>
            <Text style={styles.contactDetail}>Mobile: {selectedReceiver.MOBILE || 'N/A'} | Zone: {selectedReceiver.ZONE || 'N/A'}</Text>
          </View>
        )}

        <View style={styles.rowGrid}>
          <View style={{ flex: 1 }}>
            <Text style={styles.labelWeb}>DESTINATION CITY</Text>
            <TextInput
              editable={!isFormLocked}
              style={[styles.inputWeb, isFormLocked && styles.inputDisabled]}
              placeholder="e.g. MUMBAI"
              placeholderTextColor="#94a3b8"
              value={destCityInput}
              onChangeText={setDestCityInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.labelWeb}>PINCODE</Text>
            <TextInput
              editable={!isFormLocked}
              style={[styles.inputWeb, isFormLocked && styles.inputDisabled]}
              placeholder="e.g. 400001"
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor="#94a3b8"
              value={destPincodeInput}
              onChangeText={setDestPincodeInput}
            />
          </View>
        </View>
      </View>

      {/* ── SECTION 4: Mode & Carrier Selection (Side-by-side Dropdowns) ── */}
      <View style={[styles.cardWeb, isFormLocked && styles.cardLocked]}>
        <Text style={styles.sectionHeaderTitle}>4. Mode & Carrier</Text>
        <View style={styles.rowGrid}>
          <View style={{ flex: 1 }}>
            <Text style={styles.labelWeb}>MODE</Text>
            <TouchableOpacity
              disabled={isFormLocked}
              style={[styles.clientSelectorBtn, isFormLocked && styles.btnDisabled]}
              onPress={() => setModeModalVisible(true)}
            >
              <Text style={[styles.clientSelectorText, isFormLocked && styles.textDisabled]} numberOfLines={1}>
                {(MODE_OPTIONS_LIST.find(m => m.code === selectedMode) || {}).name || selectedMode || 'Select Mode'}
              </Text>
              <Text style={styles.clientSelectorArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.labelWeb}>CARRIER</Text>
            <TouchableOpacity
              disabled={isFormLocked}
              style={[styles.clientSelectorBtn, isFormLocked && styles.btnDisabled]}
              onPress={() => setCarrierModalVisible(true)}
            >
              <Text style={[styles.clientSelectorText, isFormLocked && styles.textDisabled]} numberOfLines={1}>
                {(CARRIER_OPTIONS_LIST.find(c => c.code === selectedCarrier) || {}).name || selectedCarrier || 'Select Carrier'}
              </Text>
              <Text style={styles.clientSelectorArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Web parity (modeChangeMessage): auto-switch notices */}
        {modeChangeMsg ? <Text style={styles.modeChangeMsg}>{modeChangeMsg}</Text> : null}
      </View>

      {/* ── SECTION 5: Payment Types & Flags (1-to-1 Web Matching Row L276-300) ── */}
      <View style={styles.cardWeb}>
        <Text style={styles.sectionHeaderTitle}>5. Payment Type & Options</Text>
        <View style={styles.webPaymentRow}>
          <WebCheckbox label="Dox" value={flagDox} onValueChange={(v) => setPaymentFlag('dox', v)} />
          <WebCheckbox label="Pcs" value={flagPcs} onValueChange={(v) => setPaymentFlag('pcs', v)} />
          <WebCheckbox label="Topay" value={flagTopay} onValueChange={(v) => setPaymentFlag('topay', v)} />
          <WebCheckbox label="COD" value={flagCod} onValueChange={(v) => setPaymentFlag('cod', v)} />
          <WebCheckbox label="FOV" value={flagFov} onValueChange={(v) => setPaymentFlag('fov', v)} />
          <WebCheckbox label="SAV" value={flagSav} onValueChange={(v) => setPaymentFlag('sav', v)} title="Preserve customer/consignor/consignee for next booking" />
        </View>

        {/* Dox Mode Envelope Options Card (Single row: Wt, DL, A4, BG) */}
        {flagDox && (
          <View style={{ marginTop: 10, backgroundColor: '#f0f9ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' }}>
            <Text style={styles.labelWeb}>DOX ENVELOPE (WT & SIZE)</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flex: 1.2 }}>
                <TextInput
                  style={[styles.inputWeb, { marginBottom: 0, paddingHorizontal: 8 }]}
                  value={doxWeight}
                  keyboardType="numeric"
                  onChangeText={setDoxWeight}
                  placeholder="Wgt (kg)"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              {['DL', 'A4', 'BG'].map(env => (
                <TouchableOpacity
                  key={env}
                  style={[
                    styles.selectChip,
                    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 8 },
                    doxType === env && styles.selectChipActive
                  ]}
                  onPress={() => setDoxType(env)}
                >
                  <Text style={[styles.selectChipText, doxType === env && styles.selectChipTextActive]}>
                    {env}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAddDoxEnvelope}>
              <Text style={styles.addBtnText}>+ Add Dox Envelope ({doxType})</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pcs Mode Options (Web: pcs_count) */}
        {flagPcs && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.labelWeb}>PIECES COUNT MULTIPLIER</Text>
            <TextInput
              style={styles.inputWeb}
              value={pcsCount}
              keyboardType="numeric"
              onChangeText={setPcsCount}
              placeholder="1"
            />
          </View>
        )}

        {flagCod && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.labelWeb}>COD AMOUNT (₹)</Text>
            <TextInput
              style={styles.inputWeb}
              placeholder="e.g. 1500"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
              value={codAmount}
              onChangeText={setCodAmount}
            />
          </View>
        )}
      </View>

      {/* ── SECTION 6: Consignment Box Adder (Web: toggleWeightProductEntry) ── */}
      <View style={[styles.cardWeb, !isMainDetailsComplete && styles.cardDisabled]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionHeaderTitle, { marginBottom: 0 }]}>6. Consignment Boxes ({boxes.length})</Text>
          {boxes.length > 0 && (
            <TouchableOpacity onPress={handleClearBoxes}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444' }}>Clear Boxes</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isMainDetailsComplete && (
          <Text style={styles.lockNoticeText}>⚠️ Complete Customer, Sender, Receiver, Mode & Carrier to add boxes.</Text>
        )}

        {!flagDox && (
          <>
            <View style={styles.rowGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>WEIGHT (KG)</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="Weight"
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={boxWgt}
                  onChangeText={setBoxWgt}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>LENGTH (CM)</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="L"
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={boxLength}
                  onChangeText={setBoxLength}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>BREADTH (CM)</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="B"
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={boxBreadth}
                  onChangeText={setBoxBreadth}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>HEIGHT (CM)</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="H"
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={boxHeight}
                  onChangeText={setBoxHeight}
                />
              </View>
            </View>

            <TouchableOpacity
              disabled={!isMainDetailsComplete}
              style={[styles.addBtn, !isMainDetailsComplete && styles.btnDisabled]}
              onPress={handleAddBox}
            >
              <Text style={[styles.addBtnText, !isMainDetailsComplete && styles.textDisabled]}>+ Add Box</Text>
            </TouchableOpacity>
          </>
        )}

        {boxes.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {boxes.map((b, bi) => (
              <View key={bi} style={styles.boxRowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boxRowTitle}>Box #{b.BOX_NUM}</Text>
                  <Text style={styles.boxRowSub}>
                    Weight: {b.WEIGHT} kg | {b.LENGTH}x{b.BREADTH}x{b.HIGHT} cm | Chg Wt: {(b.CHG_WT || b.WEIGHT).toFixed(2)} kg
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveBox(bi)}>
                  <TrashIcon size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── SECTION 7: Product Adder (Web: toggleWeightProductEntry) ── */}
      <View style={[styles.cardWeb, !isMainDetailsComplete && styles.cardDisabled]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionHeaderTitle, { marginBottom: 0 }]}>7. Product & Invoice Details ({products.length})</Text>
          {products.length > 0 && (
            <TouchableOpacity onPress={handleClearProducts}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444' }}>Clear Products</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isMainDetailsComplete && (
          <Text style={styles.lockNoticeText}>⚠️ Complete Customer, Sender, Receiver, Mode & Carrier to add products.</Text>
        )}

        {!flagDox && (
          <>
            <Text style={styles.labelWeb}>PRODUCT NAME</Text>
            <TextInput
              editable={isMainDetailsComplete}
              style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
              placeholder="e.g. Spare Parts"
              placeholderTextColor="#94a3b8"
              value={prodName}
              onChangeText={setProdName}
            />

            <View style={styles.rowGrid}>
              <View style={{ flex: 2 }}>
                <Text style={styles.labelWeb}>DOC NO</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="Doc #"
                  placeholderTextColor="#94a3b8"
                  value={prodDocNo}
                  onChangeText={setProdDocNo}
                />
              </View>

              <View style={{ flex: 3 }}>
                <Text style={styles.labelWeb}>DOC TYPE</Text>
                <View style={styles.chipRowSelect}>
                  {['INV', 'CLN', 'DEC', 'DOX'].map(dt => (
                    <TouchableOpacity
                      key={dt}
                      disabled={!isMainDetailsComplete}
                      style={[styles.selectChip, prodDocType === dt && styles.selectChipActive]}
                      onPress={() => setProdDocType(dt)}
                    >
                      <Text style={[styles.selectChipText, prodDocType === dt && styles.selectChipTextActive]}>{dt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.rowGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>EWAY BILL</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="12 digit EWay"
                  keyboardType="numeric"
                  maxLength={12}
                  placeholderTextColor="#94a3b8"
                  value={prodEway}
                  onChangeText={setProdEway}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>AMOUNT (₹)</Text>
                <TextInput
                  editable={isMainDetailsComplete}
                  style={[styles.inputWeb, !isMainDetailsComplete && styles.inputDisabled]}
                  placeholder="Amount"
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={prodAmount}
                  onChangeText={setProdAmount}
                />
              </View>
            </View>

            <TouchableOpacity
              disabled={!isMainDetailsComplete}
              style={[styles.addBtn, !isMainDetailsComplete && styles.btnDisabled]}
              onPress={handleAddProduct}
            >
              <Text style={[styles.addBtnText, !isMainDetailsComplete && styles.textDisabled]}>+ Add Product</Text>
            </TouchableOpacity>
          </>
        )}

        {products.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {products.map((p, pi) => (
              <View key={pi} style={styles.boxRowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boxRowTitle}>{p.PRODUCT}</Text>
                  <Text style={styles.boxRowSub}>
                    Doc: {p.DOC_NUMBER || 'N/A'} ({p.DOC_TYPE}) | EWay: {p.EWAY_IF || 'N/A'} | ₹{p.AMOUNT}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveProduct(pi)}>
                  <TrashIcon size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── LIVE CALCULATIONS SUMMARY CARD (Web: updateSummaryDisplay) ── */}
      <View style={styles.summaryCard}>
        <Text style={styles.sectionHeaderTitle}>Consignment Live Totals</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Wt</Text>
            <Text style={styles.summaryValue}>{summaryTotals.totalWgt.toFixed(2)} kg</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Chg Wt</Text>
            <Text style={styles.summaryValue}>{summaryTotals.totalChgWt.toFixed(2)} kg</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pieces</Text>
            <Text style={styles.summaryValue}>{summaryTotals.boxCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Value</Text>
            <Text style={styles.summaryValue}>₹{summaryTotals.totalAmount.toFixed(2)}</Text>
          </View>
        </View>
        {/* Web parity: Helper Table (WEIGHT_CEILING / WEIGHT_ZONE / RATE_UID / RATE / ADD_RATE) */}
        <View style={styles.rateStrip}>
          <Text style={styles.rateStripText}>
            Rate: {helperTableData.rate != null ? `₹${helperTableData.rate}` : '---'}{'   '}
            Add: {helperTableData.addRate != null ? `₹${helperTableData.addRate}` : '---'}{'   '}
            Ceiling: {helperTableData.weightCeiling} kg{'   '}
            Zone: {helperTableData.weightZone}{'   '}
            {helperTableData.rateUid}
          </Text>
        </View>
      </View>

      {/* ── CHARGES & TAXES BREAKDOWN TABLE (Web: Charges Section L600-635) ── */}
      <View style={styles.chargesCard}>
        <Text style={styles.sectionHeaderTitle}>Charges & Taxes Breakdown</Text>
        <View style={styles.chargesGridTable}>
          <View style={styles.chargesRow}>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>FRIGHT</Text></View>
            <View style={styles.chargesCellValue}><Text style={styles.chargesValueText}>₹{calculatedCharges.fright}</Text></View>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>OTHER CHARGES</Text></View>
            <View style={styles.chargesCellValue}>
              <Text style={styles.chargesValueText}>₹{calculatedCharges.otherCharges}</Text>
            </View>
          </View>

          <View style={styles.chargesRow}>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>{calculatedCharges.taxMode}</Text></View>
            <View style={styles.chargesCellValue}>
              <Text style={styles.chargesValueText}>₹{calculatedCharges.gstTotal}</Text>
            </View>
            <View style={[styles.chargesCellLabel, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.chargesLabelText, { color: '#1e40af', fontWeight: '800' }]}>TOTAL</Text>
            </View>
            <View style={[styles.chargesCellValue, { backgroundColor: '#eff6ff' }]}>
              <Text style={[styles.chargesValueText, { color: '#1e40af', fontWeight: '800', fontSize: 14 }]}>
                ₹{calculatedCharges.total}
              </Text>
            </View>
          </View>
          {/* Tax split (Web: SGST/CGST/IGST hidden spans) */}
          <View style={styles.chargesRow}>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>SGST</Text></View>
            <View style={styles.chargesCellValue}><Text style={styles.chargesValueText}>₹{calculatedCharges.sgst}</Text></View>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>CGST</Text></View>
            <View style={styles.chargesCellValue}><Text style={styles.chargesValueText}>₹{calculatedCharges.cgst}</Text></View>
          </View>
          <View style={styles.chargesRow}>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>IGST</Text></View>
            <View style={styles.chargesCellValue}><Text style={styles.chargesValueText}>₹{calculatedCharges.igst}</Text></View>
            <View style={styles.chargesCellLabel}><Text style={styles.chargesLabelText}>TAXABLE</Text></View>
            <View style={styles.chargesCellValue}><Text style={styles.chargesValueText}>₹{calculatedCharges.taxable}</Text></View>
          </View>
        </View>
      </View>

      {/* ── SECTION 8: AWB Number & Action Buttons ── */}
      <View style={styles.cardWeb}>
        <Text style={styles.sectionHeaderTitle}>8. Finalize Order</Text>
        <Text style={styles.labelWeb}>AWB NUMBER</Text>
        <View style={styles.awbInputRow}>
          <TextInput
            style={[styles.inputWeb, { flex: 1, marginBottom: 0 }]}
            placeholder="Enter AWB or tap Auto Get"
            placeholderTextColor="#94a3b8"
            value={awbNumber}
            onChangeText={(t) => { setAwbNumber(t); validateAwbPattern(t); }}
          />
          <TouchableOpacity style={styles.getAwbBtn} onPress={handleGenerateAwb}>
            <RefreshIcon size={14} color="#0284c7" />
            <Text style={styles.getAwbBtnText}>Get AWB</Text>
          </TouchableOpacity>
        </View>

        {/* Web parity: validateAwbPattern hint (informational) */}
        {awbHint && (
          <Text style={[
            styles.awbHint,
            awbHint.kind === 'success' && styles.awbHintSuccess,
            awbHint.kind === 'error' && styles.awbHintError,
            awbHint.kind === 'warn' && styles.awbHintWarn
          ]}>
            {awbHint.text}
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={bookingLoading}>
            {bookingLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>{editRef ? 'UPDATE ORDER' : 'BOOK ORDER'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LAST BOOKED SHIPMENT CARD (Web: renderLastBooked — shown after booking) ── */}
      {lastBookedOrder && (
        <View style={styles.lastBookedCard}>
          <View style={styles.lastBookedHeader}>
            <Text style={styles.lastBookedTitle}>✓ Shipment Booked: {lastBookedOrder.AWB_NUMBER || 'No AWB'}</Text>
            <TouchableOpacity onPress={() => setLastBookedOrder(null)}>
              <Text style={{ color: '#64748b', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.lastBookedRoute}>
            {(() => {
              const cnor = contactsList.find(c => c.UID === lastBookedOrder.CONSIGNOR)?.NAME || lastBookedOrder.CONSIGNOR || 'Sender';
              const cnee = contactsList.find(c => c.UID === lastBookedOrder.CONSIGNEE)?.NAME || lastBookedOrder.CONSIGNEE || 'Receiver';
              return `${cnor} → ${cnee}`;
            })()}
          </Text>

          <View style={styles.lastBookedGrid}>
            <Text style={styles.lastBookedChip}>Ref: {lastBookedOrder.reference || lastBookedOrder.REFERENCE}</Text>
            <Text style={styles.lastBookedChip}>Carrier: {lastBookedOrder.CARRIER || 'N/A'}</Text>
            <Text style={styles.lastBookedChip}>Mode: {lastBookedOrder.MODE || 'N/A'}</Text>
            <Text style={styles.lastBookedChip}>Date: {fmtFromUnix(lastBookedOrder.ORDER_DATE)}</Text>
            <Text style={styles.lastBookedChip}>Dest: {lastBookedOrder.DEST_CITY || 'N/A'} {lastBookedOrder.DEST_PINCODE || ''}</Text>
            <Text style={styles.lastBookedChip}>Zone: {lastBookedOrder.ZONE || 'N/A'}</Text>
            <Text style={styles.lastBookedChip}>TAT: {lastBookedOrder.TAT || 'N/A'}</Text>
            <Text style={styles.lastBookedChip}>Wt: {parseFloat(lastBookedOrder.WEIGHT) || 0} kg</Text>
            <Text style={styles.lastBookedChip}>ChgWt: {parseFloat(lastBookedOrder.CHG_WT) || 0} kg</Text>
            <Text style={styles.lastBookedChip}>Pcs: {lastBookedOrder.PIECS || 0}</Text>
            <Text style={styles.lastBookedChip}>Value: ₹{parseFloat(lastBookedOrder.VALUE) || 0}</Text>
            {lastBookedOrder.COD === 'Yes' ? <Text style={styles.lastBookedChip}>COD</Text> : null}
            {lastBookedOrder.TOPAY === 'Yes' ? <Text style={styles.lastBookedChip}>ToPay</Text> : null}
            {lastBookedOrder.FOV === 'Yes' ? <Text style={styles.lastBookedChip}>FOV</Text> : null}
          </View>

          {/* Action row (Web: Edit / Delete buttons on the card) */}
          <View style={styles.lastBookedActions}>
            <TouchableOpacity style={styles.lastBookedActionBtn} onPress={() => startEditFromPayload(lastBookedOrder)}>
              <Text style={styles.lastBookedActionEdit}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.lastBookedActionBtn} onPress={() => handleDeleteOrder(lastBookedOrder.reference || lastBookedOrder.REFERENCE)}>
              <Text style={styles.lastBookedActionDelete}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── BOOKING TRANSACTIONS (booked / pending / error log) ── */}
      {bookingTxns.length > 0 && (
        <View style={styles.txnCard}>
          <View style={styles.txnHeader}>
            <Text style={styles.sectionHeaderTitle}>Booking Transactions</Text>
            <TouchableOpacity onPress={clearBookingTxns}>
              <Text style={styles.txnClear}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
          {bookingTxns.map((t) => (
            <View key={t.id} style={styles.txnRow}>
              <Text style={[styles.txnIcon, t.status === 'booked' && styles.txnIconOk, t.status === 'error' && styles.txnIconErr, t.status === 'pending' && styles.txnIconWarn]}>
                {t.status === 'booked' ? '✓' : t.status === 'pending' ? '⏳' : '✗'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnMain} numberOfLines={2}>
                  {t.status === 'booked' ? `Booked — Ref: ${t.ref}` : t.status === 'pending' ? `Pending — Ref: ${t.ref}` : `Error — ${t.message || 'Booking failed'}`}
                </Text>
                <Text style={styles.txnSub}>
                  {new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {t.status === 'booked' ? ' · Booked' : t.status === 'error' ? ' · Failed' : ' · Waiting'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Client Selection Dropdown Modal ── */}
      <Modal
        visible={clientModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setClientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client / Customer</Text>
              <TouchableOpacity onPress={() => setClientModalVisible(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search Client Name or Code..."
              placeholderTextColor="#94a3b8"
              value={clientSearchQuery}
              onChangeText={setClientSearchQuery}
            />

            <ScrollView style={{ maxHeight: 350 }}>
              {filteredClients.length === 0 ? (
                <Text style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No clients found.</Text>
              ) : (
                filteredClients.map((client, ci) => (
                  <TouchableOpacity
                    key={ci}
                    style={styles.clientModalItem}
                    onPress={() => handleSelectClient(client)}
                  >
                    <Text style={styles.clientModalName}>{client.B2B_NAME || client.NAME || 'Unnamed Client'}</Text>
                    <Text style={styles.clientModalCode}>Code: {client.CODE || client.UID || 'N/A'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Mode Selection Modal ── */}
      <Modal
        visible={modeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Transport Mode</Text>
              <TouchableOpacity onPress={() => setModeModalVisible(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {MODE_OPTIONS_LIST.map((m, mi) => {
                const available = isModeAvailableForZone(m);
                return (
                  <TouchableOpacity
                    key={mi}
                    disabled={!available}
                    style={[styles.clientModalItem, !available && styles.clientModalItemDisabled]}
                    onPress={() => handleSelectMode(m)}
                  >
                    <Text style={[styles.clientModalName, !available && styles.textDisabled]}>{m.name}</Text>
                    <Text style={styles.clientModalCode}>
                      Code: {m.code}{!available ? ' (not available for ' + (selectedReceiver?.ZONE || 'zone') + ')' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Carrier Selection Modal ── */}
      <Modal
        visible={carrierModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCarrierModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Carrier</Text>
              <TouchableOpacity onPress={() => setCarrierModalVisible(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {CARRIER_OPTIONS_LIST.map((c, ci) => (
                <TouchableOpacity
                  key={ci}
                  style={styles.clientModalItem}
                  onPress={() => {
                    setSelectedCarrier(c.code);
                    setCarrierModalVisible(false);
                  }}
                >
                  <Text style={styles.clientModalName}>{c.name}</Text>
                  <Text style={styles.clientModalCode}>Code: {c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Order Date Calendar Picker Modal ── */}
      <Modal
        visible={orderDateModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setOrderDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else { setCalMonth(m => m - 1); }
                }}
                style={styles.calNavBtn}
              >
                <Text style={styles.calNavBtnText}>‹</Text>
              </TouchableOpacity>

              <Text style={styles.calendarMonthTitle}>
                {MONTH_NAMES[calMonth]} {calYear}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else { setCalMonth(m => m + 1); }
                }}
                style={styles.calNavBtn}
              >
                <Text style={styles.calNavBtnText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, di) => (
                <Text key={di} style={styles.calWeekDayText}>{d}</Text>
              ))}
            </View>

            <View style={styles.calGrid}>
              {calendarDays.map((dayNum, idx) => (
                <TouchableOpacity
                  key={idx}
                  disabled={!dayNum}
                  style={[styles.calDayBox, dayNum && styles.calDayBoxActive]}
                  onPress={() => {
                    if (dayNum) {
                      const mStr = String(calMonth + 1).padStart(2, '0');
                      const dStr = String(dayNum).padStart(2, '0');
                      setOrderDate(`${calYear}-${mStr}-${dStr}`);
                      setOrderDateModalVisible(false);
                    }
                  }}
                >
                  <Text style={[styles.calDayText, !dayNum && styles.calDayTextEmpty]}>
                    {dayNum || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.calCancelBtn} onPress={() => setOrderDateModalVisible(false)}>
              <Text style={styles.calCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ADD CONTACT MODAL (Web: jawaS/book-order-add-contact.js) ── */}
      <Modal
        visible={addContactVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddContactVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.acModalScroll} contentContainerStyle={styles.acModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {addContactType === 'sender' ? 'Sender' : 'Receiver'} Contact</Text>
              <TouchableOpacity onPress={() => setAddContactVisible(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.labelWeb}>NAME *</Text>
            <TextInput style={styles.inputWeb} placeholder="Full name" placeholderTextColor="#94a3b8" value={acForm.name} onChangeText={(t) => setAcForm(f => ({ ...f, name: t }))} />

            <Text style={styles.labelWeb}>MOBILE (10 DIGITS) *</Text>
            <TextInput
              style={styles.inputWeb}
              placeholder="10-digit mobile"
              keyboardType="numeric"
              maxLength={10}
              placeholderTextColor="#94a3b8"
              value={acForm.mobile}
              onChangeText={(t) => setAcForm(f => ({ ...f, mobile: t.replace(/\D/g, '') }))}
            />

            <View style={styles.rowGrid}>
              <View style={{ flex: 2 }}>
                <Text style={styles.labelWeb}>PINCODE *</Text>
                <TextInput
                  style={styles.inputWeb}
                  placeholder="6-digit pincode"
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94a3b8"
                  value={acForm.pincode}
                  onChangeText={handleAcPincodeChange}
                />
              </View>
              <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 10 }}>
                <Text style={[styles.acPinStatus, acPinStatus === '✔' && { color: '#15803d' }, (acPinStatus === '✖' || acPinStatus === '⚠') && { color: acPinStatus === '✖' ? '#dc2626' : '#d97706' }]}>{acPinStatus}</Text>
              </View>
            </View>

            {acPinResult?.found ? (
              <View style={styles.acDerivedBox}>
                <Text style={styles.acDerivedRow}>City: <Text style={styles.acDerivedStrong}>{acPinResult.city || '—'}</Text> | State: <Text style={styles.acDerivedStrong}>{acPinResult.state || '—'}</Text></Text>
                <Text style={styles.acDerivedRow}>GST Code: {acPinResult.gstCode || '—'} | ODA: {acPinResult.oda || '—'}</Text>
                <Text style={styles.acDerivedRow}>TATs — Express: {acPinResult.expressTat || 'N'} | Airline: {acPinResult.airlineTat || 'N'} | Surface: {acPinResult.surfaceTat || 'N'} | Premium: {acPinResult.premiumTat || 'N'}</Text>
                {acPinResult.manualZone ? <Text style={styles.acDerivedWarn}>⚠ City/State filled. Zone must be entered manually.</Text> : null}
              </View>
            ) : acPinStatus === '✖' ? (
              <Text style={styles.acDerivedWarn}>Pincode not found in network map or API.</Text>
            ) : null}

            <Text style={styles.labelWeb}>ZONE *</Text>
            <TextInput style={styles.inputWeb} placeholder="Zone (e.g. NORTH, WEST)" placeholderTextColor="#94a3b8" value={acPinResult?.zone || ''} onChangeText={(t) => setAcPinResult(r => (r ? { ...r, zone: t.toUpperCase() } : r))} />

            <Text style={styles.labelWeb}>ADDRESS *</Text>
            <TextInput style={styles.inputWeb} placeholder="Full address" placeholderTextColor="#94a3b8" value={acForm.address} onChangeText={(t) => setAcForm(f => ({ ...f, address: t }))} />

            <View style={styles.rowGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>EMAIL</Text>
                <TextInput style={styles.inputWeb} placeholder="Email" placeholderTextColor="#94a3b8" value={acForm.email} onChangeText={(t) => setAcForm(f => ({ ...f, email: t }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>GSTIN</Text>
                <TextInput style={styles.inputWeb} placeholder="GSTIN" maxLength={15} placeholderTextColor="#94a3b8" value={acForm.gstin} onChangeText={(t) => setAcForm(f => ({ ...f, gstin: t }))} />
              </View>
            </View>

            <Text style={styles.labelWeb}>CARRIER</Text>
            <TextInput style={styles.inputWeb} placeholder="Carrier company code" placeholderTextColor="#94a3b8" value={acForm.carrier} onChangeText={(t) => setAcForm(f => ({ ...f, carrier: t }))} />

            {acError ? <Text style={styles.acError}>{acError}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={styles.clearBtn} onPress={() => setAddContactVisible(false)}>
                <Text style={styles.clearBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, acSaving && styles.btnDisabled]} onPress={handleAcSave} disabled={acSaving}>
                {acSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Save Contact</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollPage: { flex: 1, padding: 14, backgroundColor: '#f8fafc' },
  pageTitle: { color: '#1e293b', fontSize: 24, fontWeight: '800', marginBottom: 14 },

  // Last Booked Card
  lastBookedCard: { backgroundColor: '#e0e7ff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#6366f1', marginBottom: 14 },
  lastBookedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lastBookedTitle: { fontSize: 13, fontWeight: '800', color: '#4338ca' },
  lastBookedRoute: { fontSize: 12, color: '#374151', fontWeight: '600', marginBottom: 8 },
  lastBookedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lastBookedChip: { fontSize: 10.5, fontWeight: '700', color: '#4338ca', backgroundColor: '#ffffff', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },

  cardWeb: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  cardLocked: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  cardDisabled: { opacity: 0.6, backgroundColor: '#f1f5f9' },
  lockNoticeText: { fontSize: 11, fontWeight: '700', color: '#b45309', marginBottom: 10, backgroundColor: '#fef3c7', padding: 6, borderRadius: 6 },
  sectionHeaderTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 6 },
  labelWeb: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  inputWeb: { backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a', paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  inputDisabled: { backgroundColor: '#e2e8f0', color: '#64748b' },
  btnDisabled: { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' },
  textDisabled: { color: '#94a3b8' },
  rowGrid: { flexDirection: 'row', gap: 10 },

  placeholderTextItalic: { fontSize: 11.5, fontStyle: 'italic', color: '#94a3b8', paddingVertical: 6 },

  // Live Summary Card
  summaryCard: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 14 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#166534' },
  summaryValue: { fontSize: 13, fontWeight: '800', color: '#15803d', marginTop: 2 },

  // Calendar Trigger Button
  calendarTriggerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0f9ff', borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  calendarTriggerText: { fontSize: 12.5, fontWeight: '700', color: '#0284c7' },

  // Client Selector Button
  clientSelectorBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  clientSelectorText: { fontSize: 12.5, fontWeight: '700', color: '#1e293b', flex: 1 },
  clientSelectorArrow: { fontSize: 10, color: '#64748b', marginLeft: 6 },

  // Modal Overlay & Calendar Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, width: '100%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  modalCloseX: { fontSize: 18, fontWeight: '700', color: '#64748b', padding: 4 },
  searchInput: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  clientModalItem: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  clientModalName: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  clientModalCode: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Calendar Modal Picker
  calendarModalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, width: '90%', maxWidth: 340, borderWidth: 1, borderColor: '#cbd5e1' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  calendarMonthTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  calNavBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  calNavBtnText: { fontSize: 18, fontWeight: '800', color: '#475569' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  calWeekDayText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#94a3b8' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  calDayBox: { width: '14.28%', height: 36, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  calDayBoxActive: { backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
  calDayText: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
  calDayTextEmpty: { color: 'transparent' },
  calCancelBtn: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', alignItems: 'center' },
  calCancelBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  // Autocomplete
  autocompleteBox: { backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 10 },
  autocompleteItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  autocompleteName: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  autocompleteSub: { fontSize: 11, color: '#64748b' },

  selectedContactCard: { backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', padding: 10, marginBottom: 10 },
  contactName: { fontSize: 13, fontWeight: '800', color: '#0369a1' },
  contactDetail: { fontSize: 11, color: '#475569', marginTop: 2 },

  // Chip Select
  chipRowSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  selectChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  selectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  selectChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  selectChipTextActive: { color: '#ffffff' },

  // Flags Grid
  flagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
  flagItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },

  // Add Button & Box Card
  addBtn: { backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  addBtnText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  boxRowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  boxRowTitle: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  boxRowSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // AWB & Submits
  awbInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  getAwbBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f9ff', borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 10, paddingVertical: 8 },
  getAwbBtnText: { fontSize: 11.5, fontWeight: '700', color: '#0284c7' },

  clearBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  clearBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  submitBtn: { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  submitBtnText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },

  // Charges & Taxes Breakdown Table
  chargesCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 14 },
  chargesGridTable: { borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', overflow: 'hidden' },
  chargesRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  chargesCellLabel: { flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRightWidth: 1, borderRightColor: '#e2e8f0', justifyContent: 'center' },
  chargesCellValue: { flex: 1, backgroundColor: '#ffffff', padding: 8, alignItems: 'flex-end', borderRightWidth: 1, borderRightColor: '#e2e8f0', justifyContent: 'center' },
  chargesLabelText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chargesValueText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },

  // Web Payment Checkboxes (L276-300)
  webPaymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 8, paddingHorizontal: 6, marginBottom: 10 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkboxSquare: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: '#94a3b8', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
  checkboxSquareChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmarkText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  checkboxLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },

  // Edit Banner (Web: prefillEditOrder)
  editBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#fcd34d', padding: 10, marginBottom: 12 },
  editBannerText: { fontSize: 13, fontWeight: '800', color: '#b45309' },

  // Booking Message (Web: bookingMessage)
  bookingMsgBox: { backgroundColor: '#eff6ff', borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', padding: 10, marginBottom: 12 },
  bookingMsgSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  bookingMsgError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bookingMsgWarn: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  bookingMsgText: { fontSize: 12, fontWeight: '700', color: '#1e293b', textAlign: 'center' },

  // Last Booked Actions
  lastBookedActions: { flexDirection: 'row', gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: '#c7d2fe', paddingTop: 8 },
  lastBookedActionBtn: { flex: 1, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#c7d2fe', paddingVertical: 7 },
  lastBookedActionEdit: { fontSize: 11.5, fontWeight: '800', color: '#4338ca' },
  lastBookedActionDelete: { fontSize: 11.5, fontWeight: '800', color: '#dc2626' },

  // Booking transactions log
  txnCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  txnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  txnClear: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  txnRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txnIcon: { fontSize: 14, fontWeight: '900', marginRight: 9, marginTop: 1, color: '#64748b' },
  txnIconOk: { color: '#16a34a' },
  txnIconErr: { color: '#dc2626' },
  txnIconWarn: { color: '#d97706' },
  txnMain: { fontSize: 12.5, fontWeight: '700', color: '#1e293b', lineHeight: 17 },
  txnSub: { fontSize: 10.5, color: '#94a3b8', marginTop: 1, fontWeight: '600' },

  // Mode change message
  modeChangeMsg: { fontSize: 11, fontWeight: '700', color: '#1d4ed8', marginTop: 2 },

  // Rate strip (Web: Helper Table)
  rateStrip: { marginTop: 10, backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0', padding: 8 },
  rateStripText: { fontSize: 10.5, fontWeight: '700', color: '#166534', lineHeight: 16 },

  // AWB pattern hint
  awbHint: { fontSize: 11, fontWeight: '700', color: '#1e293b', marginTop: 6, borderRadius: 6, padding: 7, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  awbHintSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' },
  awbHintError: { backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' },
  awbHintWarn: { backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#b45309' },

  // Order Details grid

  // Autocomplete add-new
  autocompleteAddNew: { padding: 10, backgroundColor: '#f1f5f9', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  autocompleteAddNewText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  // Mode modal disabled item
  clientModalItemDisabled: { opacity: 0.45 },

  // Add Contact modal
  acModalScroll: { flex: 1, width: '100%' },
  acModalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginHorizontal: 16, marginVertical: 40 },
  acPinStatus: { fontSize: 18, fontWeight: '900', color: '#94a3b8', textAlign: 'center' },
  acDerivedBox: { backgroundColor: '#f0f9ff', borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd', padding: 8, marginBottom: 10 },
  acDerivedRow: { fontSize: 10.5, fontWeight: '600', color: '#475569', lineHeight: 16 },
  acDerivedStrong: { fontWeight: '800', color: '#0369a1' },
  acDerivedWarn: { fontSize: 10.5, fontWeight: '700', color: '#d97706', marginTop: 2 },
  acError: { fontSize: 12, fontWeight: '700', color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 6, padding: 8, marginTop: 6 },
});

