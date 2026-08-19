import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Pressable,
  Alert, Modal, useWindowDimensions,
  KeyboardAvoidingView, Platform, Keyboard, BackHandler, findNodeHandle
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../styles/theme';
import GradientText from '../components/GradientText';
import Tray from '../components/Tray';
import Button from '../components/Button';
import Dropdown from '../components/Dropdown';
import DatePickerModal from '../components/DatePickerModal';
import SegmentedToggle from '../components/SegmentedToggle';
import StyledTable from '../components/StyledTable';
import SearchBar from '../components/SearchBar';
import Icon, { GradientGlyph } from '../components/icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { startWebBarcodeScan } from '../utils/web-barcode';

// GENIE_WEB parity — reuse the exact shared engines instead of inlined copies
// (Point 2 & 13: single source of truth with GENIE_WEB utils/calculations.js etc.)
import { getHelperTableData, calculateFreight, calculateAllCharges, recalculateAllBoxWeights } from '../utils/calculations';
import { generateInvoiceId } from '../utils/invoice-utils';
import { detectCarrierFromAWB, detectProductFromAWB, detectProductCode } from '../utils/awb-detect';
import { searchPin } from '../utils/searchpin';
import { getMetadata, setMetadata } from '../core/storage';
import { InputValidator } from '../utils/input-validator';

// Brand accent for section trays + page title (modal/status BRAND parity).
const BOOK_GRAD = ['#9C2007', '#f59e0b'];

// Multi-flag Segmented Toggle row matching the app's SegmentedToggle language
const PaymentSegmentedToggle = ({ options = [], colors = BOOK_GRAD }) => (
  <View style={styles.segGroup}>
    {options.map((item) => {
      const active = Boolean(item.value);
      return (
        <Pressable
          key={item.key}
          onPress={() => !item.disabled && item.onChange(!active)}
          disabled={item.disabled}
          accessibilityRole="tab"
          accessibilityState={{ selected: active, disabled: item.disabled }}
          style={({ pressed }) => [
            styles.segBtn,
            styles.segBtnFlex,
            active && (Platform.OS === 'web'
              ? { boxShadow: '0 2px 8px rgba(156,32,7,0.35)' }
              : { shadowColor: colors[0], shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }),
            item.disabled && styles.segDisabled,
            pressed && styles.segPressed,
          ]}
        >
          {active ? (
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.segItem}
            >
              <Text style={styles.segTextActive} numberOfLines={1}>
                {item.label}
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.segItem}>
              <Text style={styles.segText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          )}
        </Pressable>
      );
    })}
  </View>
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

// Web rate tables and mode availability flags use the canonical Z1…Z14
// column names. Contacts may contain a numeric or padded legacy value, so
// normalize it once at the screen boundary before lookup, validation, or send.
const normalizeZone = (value) => {
  if (value == null || String(value).trim() === '') return '';
  const raw = String(value).trim().toUpperCase();
  const match = raw.match(/^Z?(\d+)$/);
  if (!match) return '';
  const number = Number(match[1]);
  // Only the backend's defined rate columns are valid. Treat Z15+ (or Z0)
  // as unresolved instead of allowing an invalid column into lookup/payloads.
  return number >= 1 && number <= 14 ? `Z${number}` : '';
};

const uppercaseText = (value) => String(value ?? '').toUpperCase();

// Format date into DD-MM-YYYY (e.g. 18-08-2026)
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return 'Select Date';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  const parts = String(dateStr).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export default function BookOrderScreen({
  bookForm = {}, setBookForm, onBookOrder, bookingLoading,
  b2b2cMap = {}, b2bList = [], carriersMap = {}, modesMap = {}, ratesMap = {}, branchesMap = {},
  token = '', apiBase = '', onContactCreated = null, editOrder = null, onEditDone = null,
  onOpenUploader = null
}) {
  // --- 1. Top Section Local States ---
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderDateModalVisible, setOrderDateModalVisible] = useState(false);

  const [clientCode, setClientCode] = useState(bookForm.code || '');
  const { width: windowWidth } = useWindowDimensions();
  const isCompactMobile = windowWidth < 640;

  // Web starts both selectors empty. In particular, do not treat App's legacy
  // display-only `bookForm.carrier` default as a real carrier selection.
  const [selectedMode, setSelectedMode] = useState(bookForm.mode || '');
  const [selectedCarrier, setSelectedCarrier] = useState('');

  // Form Locking state (GENIE_WEB isBookingLocked / wasModeUnlocked)
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [modeTemporarilyUnlocked, setModeTemporarilyUnlocked] = useState(false);
  const [needsModeSelection, setNeedsModeSelection] = useState(false);
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
  const acNameInputRef = useRef(null);
  const acMobileInputRef = useRef(null);
  const acPincodeInputRef = useRef(null);
  const acZoneInputRef = useRef(null);
  const acAddressInputRef = useRef(null);
  const acEmailInputRef = useRef(null);
  const acGstinInputRef = useRef(null);
  const acCarrierInputRef = useRef(null);

  // --- Handle Customer Selection (Web: handleCustomerSelectionChange) ---
  const handleSelectClient = (client) => {
    const code = client.CODE || client.UID || '';
    setClientCode(code);

    // Web parity (handleCustomerSelectionChange): auto-select sender ONLY when
    // contact.NAME === client.B2B_NAME AND contact.CODE === selected customer code.
    // No fallback — Retail/MuscleX etc. clients that have contacts under their code
    // but whose NAME doesn't match B2B_NAME must NOT auto-fill a sender.
    const b2bName = client.B2B_NAME || '';
    const matchingSender = b2bName ? contactsList.find(c => c.NAME === b2bName && c.CODE === code) : null;
    if (matchingSender) {
      setSelectedSender(matchingSender);
      setSenderQuery(uppercaseText(matchingSender.NAME || ''));
      if (matchingSender.PINCODE) setOriginPincodeInput(String(matchingSender.PINCODE));
      if (matchingSender.CITY) setOriginCityInput(uppercaseText(matchingSender.CITY));
      // A client with an auto-selected consignor goes directly to consignee.
      focusInput(receiverInputRef);
    } else {
      setSelectedSender(null);
      setSenderQuery('');
      setOriginPincodeInput('');
      setOriginCityInput('');
      focusInput(senderInputRef);
    }

    // Contacts are scoped to the selected client. Do not carry a receiver from
    // the previous client into a new booking.
    setSelectedReceiver(null);
    setReceiverQuery('');
    setDestCityInput('');
    setDestPincodeInput('');
    setSelectedCarrier('');
    setModeTemporarilyUnlocked(false);
    setUserMadeInitialModeChoice(false);

    // Web parity (handleCustomerSelectionChange): default mode = Express when not editing
    if (!editRef) {
      const expressOption = MODE_OPTIONS_LIST.find(m => (m.name || '').toUpperCase() === 'EXPRESS') || MODE_OPTIONS_LIST.find(m => (m.rawObj?.MODE || '').toUpperCase() === 'EXPRESS');
      if (expressOption) setSelectedMode(expressOption.code);
      else if (!selectedMode) setSelectedMode('E');
    }
  };

  // Web parity (setupAutocomplete sender): selecting a sender fills origin pincode
  const handleSelectSender = (contact) => {
    setSelectedSender(contact);
    setSenderQuery(uppercaseText(contact.NAME || ''));
    if (contact.PINCODE) setOriginPincodeInput(String(contact.PINCODE));
    if (contact.CITY) setOriginCityInput(uppercaseText(contact.CITY));
    focusInput(receiverInputRef);
  };

  // Web parity (populateModeDropdown(zone)): mode is available only when zone key === 'Y'
  // (exactly like web's `!zone || mode[zone] === 'Y'` — missing zone key means unavailable)
  const isModeAvailableForZone = (modeObj) => {
    const zone = normalizeZone(selectedReceiver?.ZONE);
    if (!zone || !modeObj || !modeObj.rawObj) return true;
    return modeObj.rawObj[zone] === 'Y';
  };

  // Web parity (transportTypeSelect change): changing mode recalculates all box weights
  // with the NEW mode's VOL_INGR (renderMultiboxTable). This is invoked only after
  // the user explicitly chooses a mode.
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
    // Any explicit choice is remembered, including a choice made during the
    // web-style temporary unlock after zone revalidation. It must not later be
    // auto-reverted by weight revalidation.
    setUserMadeInitialModeChoice(true);
    setModeTemporarilyUnlocked(false);
    setNeedsModeSelection(false);
    recomputeBoxesForMode(modeObj.volIngr);
    // Carrier selection is user-initiated only. Do not interrupt box/product
    // entry with a second popup after a mode choice.
    if (selectedCarrier) focusInput(boxWeightInputRef);
  };

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
    setReceiverQuery(uppercaseText(contact.NAME || ''));
    if (contact.PINCODE) setDestPincodeInput(String(contact.PINCODE));
    if (contact.CITY) setDestCityInput(uppercaseText(contact.CITY));
    // Web assigns the receiver's carrier value, including blank. Do not retain
    // a carrier from a previous receiver when the selected receiver has none.
    setSelectedCarrier(contact.CARRIER || '');
    setModeTemporarilyUnlocked(false);
    setNeedsModeSelection(false);
    // Destination city/pincode are derived and hidden. Continue directly to
    // box entry only when it is actually editable. If the receiver has no
    // carrier, the carrier selector remains available for an explicit choice;
    // never try to focus a disabled weight input.
    const receiverCarrier = contact.CARRIER || '';
    if (clientCode && selectedSender?.UID && selectedMode && receiverCarrier) {
      focusInput(boxWeightInputRef);
    }
  };

  // Check if main details are complete (Web: areMainDetailsComplete)
  const isMainDetailsComplete = useMemo(() => {
    const hasClient = !!clientCode;
    // Match the web's areMainDetailsComplete(): typed text alone is not a
    // valid contact selection and must not be sent as a booked contact.
    const hasSender = !!selectedSender?.UID;
    const hasReceiver = !!selectedReceiver?.UID;
    const hasMode = !!selectedMode;
    const hasCarrier = !!selectedCarrier;
    return hasClient && hasSender && hasReceiver && hasMode && hasCarrier;
  }, [clientCode, selectedSender, senderQuery, selectedReceiver, receiverQuery, selectedMode, selectedCarrier]);

  // Mode & Carrier Options List
  const MODE_OPTIONS_LIST = useMemo(() => {
    if (modesMap && Object.keys(modesMap).length > 0) {
      return Object.entries(modesMap).map(([k, v]) => ({
        // MODES is keyed by SHORT in the web. Prefer the record's SHORT field
        // so a legacy storage key cannot change the rate UID or freight mode.
        code: typeof v === 'object' && v?.SHORT ? String(v.SHORT).trim() : String(k).trim(),
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
      return Object.entries(carriersMap).map(([k]) => ({
        // Web populateCarrierDropdown displays COMPANY_CODE as both value and label.
        code: k,
        name: k
      }));
    }
    return DEFAULT_CARRIERS;
  }, [carriersMap]);

  // ── Shared Dropdown option lists (client / mode / carrier) ──
  const clientOptions = useMemo(() => clientsArray
    .map(c => ({
      value: c.CODE || c.UID || '',
      label: c.B2B_NAME || c.NAME || 'Unnamed Client',
      sublabel: c.CODE ? `Code: ${c.CODE}` : undefined,
    }))
    .filter(o => o.value), [clientsArray]);

  const handleClientDropdownChange = (code) => {
    const client = clientsArray.find(c => (c.CODE || c.UID || '') === code);
    if (client) handleSelectClient(client);
  };

  const modeOptions = useMemo(() => MODE_OPTIONS_LIST.map(m => {
    const available = isModeAvailableForZone(m);
    return {
      value: m.code,
      label: m.name,
      sublabel: `Code: ${m.code}${available ? '' : ' · not available for this zone'}`,
    };
  }), [MODE_OPTIONS_LIST, selectedReceiver?.ZONE]);

  const handleModeDropdownChange = (code) => {
    const mode = MODE_OPTIONS_LIST.find(m => m.code === code);
    if (!mode || !isModeAvailableForZone(mode)) return;
    handleSelectMode(mode);
  };

  const carrierOptions = useMemo(() => CARRIER_OPTIONS_LIST.map(c => ({
    value: c.code,
    label: c.name,
    sublabel: `Code: ${c.code}`,
  })), [CARRIER_OPTIONS_LIST]);

  const handleCarrierDropdownChange = (code) => {
    setSelectedCarrier(code);
    focusInput(boxWeightInputRef);
  };

  // Payment Flags & Options
  const [flagDox, setFlagDox] = useState(false);
  const [doxWeight, setDoxWeight] = useState('0.1');
  const [doxType, setDoxType] = useState('DL');

  const [flagPcs, setFlagPcs] = useState(false);
  const [pcsCount, setPcsCount] = useState('1');
  const [boxMode, setBoxMode] = useState('Single');

  const [flagTopay, setFlagTopay] = useState(bookForm.topay === 'Yes');
  const [flagCod, setFlagCod] = useState(false);
  const [flagFov, setFlagFov] = useState(false);
  const [flagSav, setFlagSav] = useState(false);

  // Inline E-Way Barcode Scanner State (attached below Product Table)
  const [ewayPermission, requestEwayPermission] = useCameraPermissions();
  const [ewayScanning, setEwayScanning] = useState(false);
  const [ewayScanLine, setEwayScanLine] = useState(10);
  const [ewayScanError, setEwayScanError] = useState('');
  const ewayWebVideoRef = useRef(null);
  const ewayWebStopRef = useRef(null);

  useEffect(() => {
    if (!ewayScanning) return;
    let dir = 1;
    const t = setInterval(() => {
      setEwayScanLine((y) => {
        let next = y + dir * 2;
        if (next >= 85) { dir = -1; next = 85; }
        if (next <= 10) { dir = 1; next = 10; }
        return next;
      });
    }, 34);
    return () => clearInterval(t);
  }, [ewayScanning]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !ewayScanning) return;
    const el = ewayWebVideoRef.current;
    if (!el) return;
    const stop = startWebBarcodeScan(el, (code) => {
      finishEwayScan(String(code).trim());
    }, (msg) => setEwayScanError(msg));
    ewayWebStopRef.current = stop;
    return () => {
      if (ewayWebStopRef.current) {
        ewayWebStopRef.current();
        ewayWebStopRef.current = null;
      }
    };
  }, [ewayScanning]);

  const stopEwayScanning = () => {
    if (ewayWebStopRef.current) {
      ewayWebStopRef.current();
      ewayWebStopRef.current = null;
    }
    setEwayScanning(false);
    setEwayScanError('');
  };

  const startEwayScanning = () => {
    setEwayScanError('');
    if (Platform.OS !== 'web' && ewayPermission && !ewayPermission.granted) {
      requestEwayPermission();
    }
    setEwayScanning(true);
  };

  const finishEwayScan = (code) => {
    if (!code) return;
    stopEwayScanning();
    const digits = digitsOnly(code, 12);
    setProdEway(digits);
    scheduleDelayedAction(() => productAmountInputRef.current?.focus?.(), 100);
  };

  // Box Adder State
  const [boxWgt, setBoxWgt] = useState('');
  const [boxLength, setBoxLength] = useState('');
  const [boxBreadth, setBoxBreadth] = useState('');
  const [boxHeight, setBoxHeight] = useState('');
  const [boxes, setBoxes] = useState([]);

  // Keyboard navigation follows the web booking form's Enter sequence. Native Tab
  // navigation remains intact; these refs only handle deliberate Enter actions.
  const senderInputRef = useRef(null);
  const receiverInputRef = useRef(null);
  const doxWeightInputRef = useRef(null);
  const pcsCountInputRef = useRef(null);
  const boxWeightInputRef = useRef(null);
  const boxLengthInputRef = useRef(null);
  const boxBreadthInputRef = useRef(null);
  const boxHeightInputRef = useRef(null);
  const productNameInputRef = useRef(null);
  const productDocNoInputRef = useRef(null);
  const productEwayInputRef = useRef(null);
  const productAmountInputRef = useRef(null);
  const awbInputRef = useRef(null);
  const keyboardScrollRef = useRef(null);
  const focusTimerRef = useRef(null);
  const delayedActionTimersRef = useRef(new Set());

  const scheduleDelayedAction = (callback, delay = 120) => {
    const timer = setTimeout(() => {
      delayedActionTimersRef.current.delete(timer);
      callback();
    }, delay);
    delayedActionTimersRef.current.add(timer);
    return timer;
  };

  // Keep the active field above the native keyboard. Refs may point to
  // composite/web wrappers, so use only the guarded ScrollView responder on
  // native and the DOM scrolling API on React Native Web.
  const ensureInputVisible = (ref, needsDropdownRoom = false) => {
    const node = ref?.current;
    if (!node) return;

    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }

    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;

      const scroll = keyboardScrollRef.current;
      const responder = scroll?.getScrollResponder?.() || scroll;
      const handle = findNodeHandle(node);
      // A larger offset places autocomplete/dropdown inputs nearer the upper
      // edge, leaving room for their results below the field and above the
      // keyboard. No native measurement call is used here.
      const keyboardOffset = needsDropdownRoom ? 300 : 120;

      if (
        responder &&
        handle &&
        typeof responder.scrollResponderScrollNativeHandleToKeyboard === 'function'
      ) {
        try {
          responder.scrollResponderScrollNativeHandleToKeyboard(handle, keyboardOffset, true);
        } catch (_) {
          // KeyboardAvoidingView still handles the native resize.
        }
      }

      if (Platform.OS === 'web') {
        const domNode = node.getScrollableNode?.() || node;
        if (typeof domNode?.scrollIntoView === 'function') {
          // Keep the upper-edge position below the fixed app header while
          // leaving room for autocomplete/dropdown results.
          if (needsDropdownRoom && domNode.style) {
            domNode.style.scrollMarginTop = '96px';
          }
          domNode.scrollIntoView({
            block: needsDropdownRoom ? 'start' : 'center',
            behavior: 'smooth'
          });
        }
      }
    }, 260);
  };

  const focusInput = (ref, needsDropdownRoom = false) => {
    scheduleDelayedAction(() => {
      ref?.current?.focus?.();
      ensureInputVisible(ref, needsDropdownRoom);
    }, 120);
  };

  // Enter must never silently skip an empty entry field.
  const focusNextIfFilled = (value, ref) => {
    if (String(value ?? '').trim() === '') return;
    focusInput(ref);
  };

  // Product Adder State
  const [prodName, setProdName] = useState('');
  const [prodDocNo, setProdDocNo] = useState('');
  const [prodDocType, setProdDocType] = useState('INV');
  const [prodEway, setProdEway] = useState('');
  const [prodAmount, setProdAmount] = useState('');
  const [products, setProducts] = useState([]);

  // Increment Dox weight in sets of 0.25 kg (max 2.0 kg)
  const handleIncrementDoxWeight = () => {
    const cur = parseFloat(doxWeight) || 0;
    let nextVal;
    if (cur <= 0.1) {
      nextVal = 0.25;
    } else {
      nextVal = Math.round((cur + 0.25) * 100) / 100;
    }
    if (nextVal > 2.0) nextVal = 2.0;
    const clean = nextVal % 1 === 0 ? String(nextVal.toFixed(0)) : String(nextVal);
    setDoxWeight(clean);
  };

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

    const modeObj = MODE_OPTIONS_LIST.find(m => m.code === selectedMode);
    const volDivisor = modeObj?.volIngr || 5000;
    // Match web _doxRenderEntry exactly: DOX uses the shared volumetric
    // recalculation, so CHG_WT is max(actual, volumetric), not always actual.
    const [doxComputed] = recalculateAllBoxWeights([{
      actualWeight: wgt,
      length: size.l,
      breadth: size.b,
      height: h
    }], volDivisor);
    const doxBox = {
      BOX_NUM: 1,
      WEIGHT: wgt,
      LENGTH: size.l,
      BREADTH: size.b,
      HIGHT: h,
      VOLUME: doxComputed.volWeight,
      CHG_WT: doxComputed.chargeWeight
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
    // Match web updateSummaryDisplay(): MIN_WT applies whenever the
    // consignment has a box OR product. It is zero only for an empty form.
    const hasConsignment = boxes.length > 0 || products.length > 0;
    const minWt = hasConsignment && modeObj && modeObj.minWt ? parseFloat(modeObj.minWt) : 0;
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
    // Match the web's empty tables: no box/product means no billable weight,
    // no rate lookup, and no freight. This prevents stale customer rates from
    // appearing before the first consignment row is entered.
    const hasConsignment = boxes.length > 0 || products.length > 0;
    if (!hasConsignment) {
      return {
        weightCeiling: 0,
        weightZone: '---',
        rateUid: '---',
        rate: null,
        addRate: null,
        fright: 0
      };
    }
    const client = activeClient || {};
    // RATES columns and MODES availability flags use Z1…Z14. Keep the
    // receiver value in that exact canonical form for both paths.
    const receiverZone = normalizeZone(selectedReceiver?.ZONE) || null;
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
    // Preserve the web's NaN sentinel for missing rate/add-rate cells. A
    // missing base rate must produce zero; a missing ADD_RATE must use the
    // standard-mode fallback (weightCeiling * rate), not silently become 0.
    const fright = calculateFreight(
      selectedMode,
      isNaN(rate) ? NaN : rate,
      isNaN(addRate) ? NaN : addRate,
      weightCeiling,
      weightZone
    );
    return {
      weightCeiling: weightCeiling,
      weightZone: weightZone,
      rateUid: helper.rate_uid,
      rate: isNaN(rate) ? null : rate,
      addRate: isNaN(addRate) ? null : addRate,
      fright: Math.max(0, fright)
    };
  }, [boxes.length, products.length, summaryTotals, activeClient, clientCode, selectedMode, selectedReceiver, ratesMap]);

  // Exact Web Calculation Engine — delegated to SHARED calculateAllCharges
  // (includes within-state SGST+CGST 9/9 vs inter-state IGST 18% split via branchesMap,
  //  GST_INC inclusive pricing, COD/TOPAY/FOV/EWay/AWB/Packing/Dev charges)
  const calculatedCharges = useMemo(() => {
    // Do not show customer-level AWB/fuel/packing/GST charges while the
    // multibox/product tables are empty. The web starts with a blank estimate.
    if (boxes.length === 0 && products.length === 0) {
      return {
        fright: '0.00', otherCharges: '0.00', gstTotal: '0.00', total: '0.00',
        taxable: '0.00', fuelChg: '0.00', codChg: '0.00', topayChg: '0.00',
        fovChg: '0.00', ewayChg: '0.00', awbChg: '0.00', packChg: '0.00',
        devChg: '0.00', sgst: '0.00', cgst: '0.00', igst: '0.00',
        taxMode: 'No GST'
      };
    }
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
  }, [boxes.length, products.length, helperTableData, summaryTotals, activeClient, flagCod, flagTopay, flagFov, branchesMap]);

  // --- Mode revalidation (Web: revalidateMode) ---
  // 1) Express weight limit: exceed customer's WEIGHT_CHANGE → switch away from Express;
  //    back within limit → revert to Express.
  const expressModeObj = useMemo(() =>
    MODE_OPTIONS_LIST.find(m => (m.name || '').toUpperCase() === 'EXPRESS' || (m.rawObj?.MODE || '').toUpperCase() === 'EXPRESS'),
    [MODE_OPTIONS_LIST]);

  useEffect(() => {
    if (editRef) return; // editing — user controls the mode
    // A manually chosen mode is always respected. Validation can still expose
    // a message/unlock state, but it must never interrupt entry by opening a
    // selection popup on its own.
    if (userMadeInitialModeChoice) return;
    if (!expressModeObj) return;
    const weightChangeLimit = parseFloat(activeClient?.WEIGHT_CHANGE);
    if (isNaN(weightChangeLimit)) return;
    let msg = '';
    // Web revalidateMode compares summaryTotals.totalChgWt (MIN_WT-adjusted), not raw box weight
    if (summaryTotals.totalChgWt > weightChangeLimit && selectedMode === expressModeObj.code) {
      const receiverModeRaw = String(selectedReceiver?.MODE || '').trim();
      const newModeObj = MODE_OPTIONS_LIST.find(m => m.code === receiverModeRaw)
        || MODE_OPTIONS_LIST.find(m => String(m.name || '').trim().toUpperCase() === receiverModeRaw.toUpperCase());
      const newMode = newModeObj?.code || '';
      if (newMode && newMode !== selectedMode) {
        setSelectedMode(newMode);
        // Keep the selector available for an explicit user change, but do not
        // open a modal automatically while the user is entering boxes/products.
        setModeTemporarilyUnlocked(true);
        setNeedsModeSelection(true);
        // Web renderMultiboxTable() after auto-switch — CHG_WT follows the new mode's VOL_INGR
        if (newModeObj) recomputeBoxesForMode(newModeObj.volIngr);
        msg = `Mode auto-switched to ${newMode} based on weight.`;
      } else {
        msg = `Weight exceeds Express limit (${weightChangeLimit}kg). Please select a new mode.`;
        setModeTemporarilyUnlocked(true);
        setNeedsModeSelection(true);
      }
    } else if (summaryTotals.totalChgWt <= weightChangeLimit && selectedMode && selectedMode !== expressModeObj.code) {
      setSelectedMode(expressModeObj.code);
      // Web renderMultiboxTable() on revert to Express — CHG_WT follows Express VOL_INGR
      recomputeBoxesForMode(expressModeObj.volIngr);
      msg = 'Weight is within limit. Mode reverted to Express.';
    }
    setModeChangeMsg(msg);
  }, [summaryTotals.totalChgWt, selectedMode, selectedReceiver?.MODE, activeClient?.WEIGHT_CHANGE, expressModeObj, MODE_OPTIONS_LIST, editRef, userMadeInitialModeChoice, needsModeSelection]);

  // 2) Zone availability: current mode not available for receiver zone → auto-switch to Surface
  useEffect(() => {
    if (editRef) return;
    if (userMadeInitialModeChoice && !modeTemporarilyUnlocked) return;
    const zone = normalizeZone(selectedReceiver?.ZONE);
    if (!zone) return;
    const modeData = MODE_OPTIONS_LIST.find(m => m.code === selectedMode);
    if (modeData && modeData.rawObj && modeData.rawObj[zone] === 'N') {
      const surface = MODE_OPTIONS_LIST.find(m => (m.name || '').toUpperCase() === 'SURFACE' || (m.rawObj?.MODE || '').toUpperCase() === 'SURFACE');
      if (surface && surface.code !== selectedMode) {
        setSelectedMode(surface.code);
        // Web revalidateMode temporarily unlocks the selector so the user can
        // choose another available mode; adding the next row re-locks it.
        setModeTemporarilyUnlocked(true);
        // Web renderMultiboxTable() after mode change — CHG_WT follows Surface VOL_INGR
        recomputeBoxesForMode(surface.volIngr);
        setModeChangeMsg(`Mode ${modeData.name} not available for ${zone}. Switched to Surface. Select another mode if needed.`);
      }
    }
  }, [selectedReceiver?.ZONE, selectedMode, MODE_OPTIONS_LIST, editRef, userMadeInitialModeChoice, modeTemporarilyUnlocked]);

  // AWB Input
  // Web input-validator parity: keep numeric fields numeric at the boundary,
  // rather than allowing malformed text into calculations/payloads.
  const digitsOnly = (value, maxLength) => String(value || '').replace(/\D/g, '').slice(0, maxLength);
  const decimalOnly = (value) => {
    const cleaned = String(value || '').replace(/[^0-9.]/g, '');
    const [whole, ...fraction] = cleaned.split('.');
    return fraction.length ? `${whole}.${fraction.join('')}` : whole;
  };

  const [awbNumber, setAwbNumber] = useState(bookForm.awb || '');

  // Add Box Handler (Web: addMultiboxEntry -> requires Wgt+L+B+H, considers Pcs multiplier,
  // uses shared recalculateAllBoxWeights with the mode's VOL_INGR)
  const handleAddBox = () => {
    if (!isMainDetailsComplete) {
      Alert.alert('Required Fields Missing', 'Please select Customer, Consignor, Consignee, Mode and Carrier first.');
      return false;
    }
    const w = parseFloat(boxWgt) || 0;
    const l = parseFloat(boxLength) || 0;
    const b = parseFloat(boxBreadth) || 0;
    const h = parseFloat(boxHeight) || 0;

    // Web parity: all four of Wgt, L, B and H must be filled
    if (!w || !l || !b || !h) {
      Alert.alert('Error', 'Please fill all Wgt, L, B, and H fields to add a box.');
      return false;
    }
    const pcsMultiplier = boxMode === 'Multi' ? (parseInt(pcsCount) || 1) : 1;
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
    setModeTemporarilyUnlocked(false);
    setBoxWgt('');
    setBoxLength('');
    setBoxBreadth('');
    setBoxHeight('');
    setPcsCount('1');
    Alert.alert(
      'Box Added',
      'Do you want to add another box?',
      [
        { text: 'No', onPress: () => focusInput(productNameInputRef) },
        { text: 'Yes', onPress: () => focusInput(boxWeightInputRef) }
      ],
      { cancelable: false }
    );
    return true;
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
      return false;
    }
    if (!prodName.trim() || !prodDocNo.trim() || !prodAmount.trim()) {
      Alert.alert('Error', 'Product, DocNo and Amount fields are required.');
      return false;
    }
    const amt = parseFloat(prodAmount) || 0;
    if (amt >= 50000 && !prodEway) {
      Alert.alert('EWay Required', 'EWay Bill is mandatory for invoice value ₹50,000 and above.');
      return false;
    }
    if (prodEway && !/^\d{12}$/.test(prodEway.trim())) {
      Alert.alert('Invalid EWay Bill', 'EWay bill must be a 12-digit numeric number.');
      return false;
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
    setModeTemporarilyUnlocked(false);
    // Preserve the previous product name so the next product can reuse it or
    // edit it, matching the requested rapid-entry workflow.
    setProdDocNo('');
    setProdEway('');
    setProdAmount('');
    setProdDocType('INV');
    Alert.alert(
      'Product Added',
      'Do you want to enter another product?',
      [
        { text: 'No', onPress: () => focusInput(awbInputRef) },
        { text: 'Yes', onPress: () => focusInput(productNameInputRef) }
      ],
      { cancelable: false }
    );
    return true;
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

  // Match the web button: AWB allocation is not implemented by the client.
  // Never synthesize an AWB locally; staff/carrier allocation or the server must
  // provide it. A blank field must remain blank in the booking payload.
  const handleGenerateAwb = () => {
    showBookingMessage('AWB fetch logic is not implemented yet. Enter an AWB manually if one was assigned.', 'info', 6000);
    awbInputRef.current?.focus?.();
  };

  // --- Payment flag helper (Web: Dox unchecks Pcs/Topay/COD/FOV; those uncheck Dox;
  //     Dox also auto-selects Express mode when not editing) ---
  const setPaymentFlag = (name, val) => {
    if (name === 'dox') {
      if (val) {
        setFlagPcs(false);
        if (!editRef && expressModeObj) setSelectedMode(expressModeObj.code);
      }
      setFlagDox(val);
      setBoxMode(val ? 'DOX' : 'Single');
    } else if (name === 'pcs') {
      setFlagPcs(val);
    } else if (name === 'topay') {
      setFlagTopay(val);
    } else if (name === 'cod') {
      setFlagCod(val);
    } else if (name === 'fov') {
      setFlagFov(val);
    } else if (name === 'sav' || name === 'keep') {
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
    const consignorUid = selectedSender?.UID || '';
    const consigneeUid = selectedReceiver?.UID || '';
    const invoiceId = generateInvoiceId(activeClient?.CODE || clientCode, activeClient?.BILL_CYCLE, unixDate, flagTopay);

    const order = {
      INVOICE_ID: invoiceId,
      CODE: clientCode,
      BRANCH: activeClient?.BRANCH || '',
      ORDER_DATE: unixDate,
      CARRIER: selectedCarrier,
      // Web sends exactly what is in the AWB field. In particular, blank stays
      // blank; do not invent a client-side JTL value.
      AWB_NUMBER: awbNumber.trim(),
      TRANSIT_DATE: unixDate,
      CONSIGNOR: consignorUid,
      ORIGIN_CITY: originCityInput || selectedSender?.CITY || '',
      ORIGIN_PINCODE: originPincodeInput || '',
      CONSIGNEE: consigneeUid,
      DEST_CITY: destCityInput || selectedReceiver?.CITY || '',
      DEST_PINCODE: destPincodeInput || '',
      TAT: tat,
      ZONE: normalizeZone(selectedReceiver?.ZONE),
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
    setFlagCod(false);
    setFlagTopay(false);
    setFlagPcs(false);
    setModeChangeMsg('');
    // The web resets the mode for every next booking, even when SAV preserves
    // the customer/sender context.
    setSelectedMode('');
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
    setModeTemporarilyUnlocked(false);
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

  // App-level edit navigation (Orders detail → Edit → book tab). Re-runs only when a
  // different order is picked (App clears editOrder after edit/submit via onEditDone).
  useEffect(() => {
    if (editOrder) startEditFromPayload(editOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrder]);

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
    if (mobile.length !== 10 || !InputValidator.mobile(`91${mobile}`)) {
      setAcError('Mobile number must be exactly 10 digits.');
      return;
    }
    if (!InputValidator.pin(pincode)) {
      setAcError('Pincode must be exactly 6 digits.');
      return;
    }
    if (acForm.email.trim() && !InputValidator.email(acForm.email.trim())) {
      setAcError('Enter a valid email address.');
      return;
    }
    const gstin = acForm.gstin.trim().toUpperCase();
    if (gstin && !InputValidator.gstin(gstin)) {
      setAcError('Enter a valid GSTIN.');
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
        GSTIN: gstin || null,
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
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    delayedActionTimersRef.current.forEach(timer => clearTimeout(timer));
    delayedActionTimersRef.current.clear();
    Keyboard.dismiss();
  }, []);

  // While BookOrder is mounted, Android Back never leaves the booking page.
  // An open popup gets first priority and is dismissed before the event is
  // consumed; with no popup open, the form remains exactly where it is.
  useEffect(() => {
    if (Platform.OS !== 'android' || !BackHandler?.addEventListener) return undefined;
    const handleBookOrderBack = () => {
      // Cancel delayed focus/modal actions first. Otherwise a queued carrier,
      // focus, or mode opener could act just after Back dismissed a popup.
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      delayedActionTimersRef.current.forEach(timer => clearTimeout(timer));
      delayedActionTimersRef.current.clear();
      if (addContactVisible) {
        setAddContactVisible(false);
        return true;
      }
      if (orderDateModalVisible) {
        setOrderDateModalVisible(false);
        return true;
      }
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBookOrderBack);
    return () => subscription?.remove?.();
  }, [addContactVisible, orderDateModalVisible]);

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
        setLastBookedOrder({
          ...payload.order,
          REFERENCE: payload.order.REFERENCE || ref,
          reference: ref,
          boxes: payload.multibox,
          products: payload.products,
        });
        setEditRef(null);
        onEditDone && onEditDone();
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
    setNeedsModeSelection(false);
    setModeTemporarilyUnlocked(false);
    setIsFormLocked(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardPage}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      <ScrollView
        ref={keyboardScrollRef}
        style={[styles.scrollPage, isCompactMobile && styles.scrollPageCompact]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 180 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
      <View style={styles.pageTitleBlock}>
        <GradientText colors={BOOK_GRAD} style={styles.pageTitle}>Book Order</GradientText>
        <LinearGradient colors={BOOK_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pageTitleBar} />
      </View>

      {/* ── EDIT BANNER (Web: prefillEditOrder banner) ── */}
      {editRef && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>✏️ Editing Order: {editRef}</Text>
          <TouchableOpacity onPress={() => { setEditRef(null); setBookingMessage(''); onEditDone && onEditDone(); }}>
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

      {/* ── SECTION 1: Order Date & Client ── */}
      <Tray
        title="1 · Order Date"
        icon="calendar"
        iconColors={BOOK_GRAD}
        floating
        bottomTitle="2 · Client"
        bottomIcon="crm"
        bottomColors={BOOK_GRAD}
        style={isFormLocked && styles.trayLocked}
      >
        <View style={[styles.rowGrid, isCompactMobile && styles.rowGridMobile]}>
          <View style={{ flex: 2 }}>
            <TouchableOpacity
              accessible
              accessibilityRole="button"
              accessibilityLabel="Choose order date"
              disabled={isFormLocked}
              style={[styles.calendarTriggerBtn, isFormLocked && styles.btnDisabled]}
              onPress={() => setOrderDateModalVisible(true)}
            >
              <Icon name="calendar" size={14} color={isFormLocked ? '#94a3b8' : '#0284c7'} />
              <Text style={[styles.calendarTriggerText, isFormLocked && styles.textDisabled]}>
                {formatDateDisplay(orderDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 3 }}>
            <Dropdown
              value={clientCode}
              options={clientOptions}
              onChange={handleClientDropdownChange}
              searchable
              placeholder="Select Client"
              disabled={isFormLocked}
            />
          </View>
        </View>
      </Tray>

      {/* ── SECTION 2: Consignor & Consignee ── */}
      <Tray
        title="3 · Consignor"
        icon="package-up"
        iconColors={BOOK_GRAD}
        floating
        bottomTitle="4 · Consignee"
        bottomIcon="package-down"
        bottomColors={BOOK_GRAD}
        style={isFormLocked && styles.trayLocked}
      >
        {/* Consignor (Sender) */}
        <View style={styles.partyBlock}>
          <TextInput
            ref={senderInputRef}
            onFocus={() => ensureInputVisible(senderInputRef, true)}
            editable={!isFormLocked}
            style={[styles.inputWeb, isFormLocked && styles.inputDisabled, styles.trayInput]}
            placeholder="Type consignor name or phone..."
            placeholderTextColor="#94a3b8"
            value={senderQuery}
            onChangeText={(text) => {
              setSenderQuery(uppercaseText(text));
              if (selectedSender) setSelectedSender(null);
            }}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (filteredSenders.length > 0) {
                handleSelectSender(filteredSenders[0]);
                receiverInputRef.current?.focus?.();
              } else {
                receiverInputRef.current?.focus?.();
              }
            }}
          />

          {filteredSenders.length > 0 && !isFormLocked ? (
            <View style={styles.autocompleteBox}>
              {filteredSenders.map((c, idx) => (
                <TouchableOpacity
                  key={idx}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Select sender ${c.NAME || ''}`}
                  style={styles.autocompleteItem}
                  onPress={() => handleSelectSender(c)}
                >
                  <Text style={styles.autocompleteName}>{c.NAME}</Text>
                  <Text style={styles.autocompleteSub}>{c.CITY || 'City N/A'} | Ph: {c.MOBILE || 'N/A'}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity accessible accessibilityRole="button" accessibilityLabel="Add new sender contact" style={styles.autocompleteAddNew} onPress={() => { openAddContact('sender'); }}>
                <Text style={styles.autocompleteAddNewText}>+ Add New Contact</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {selectedSender ? (
            <View style={styles.selectedContactCard}>
              <Text style={styles.contactName}>{selectedSender.NAME}</Text>
              <Text style={styles.contactDetail}>{selectedSender.ADDRESS || 'No Address'}</Text>
              <Text style={styles.contactDetail}>{selectedSender.CITY} - {selectedSender.PINCODE} ({selectedSender.STATE || 'State N/A'})</Text>
              <Text style={styles.contactDetail}>Mobile: {selectedSender.MOBILE || 'N/A'}</Text>
              <Text style={styles.contactDetail}>Origin: {originCityInput || selectedSender.CITY || 'N/A'} - {originPincodeInput || selectedSender.PINCODE || 'N/A'}</Text>
            </View>
          ) : null}
        </View>

        {/* Route Separator: Matching violet line with overlapping rounded pill */}
        <View style={styles.routeSeparatorWrap}>
          <View style={styles.routeSeparatorLine} />
          <View style={styles.routePill}>
            <Icon name="truck" size={13} color="#8b5cf6" />
            <GradientText colors={BOOK_GRAD} style={styles.routePillText}>
              {`${(originCityInput || selectedSender?.CITY || 'ORIGIN').toUpperCase()}  ⇄  ${(destCityInput || selectedReceiver?.CITY || 'DESTINATION').toUpperCase()}`}
            </GradientText>
          </View>
        </View>

        {/* Consignee (Receiver) */}
        <View style={styles.partyBlockConsignee}>
          <TextInput
            ref={receiverInputRef}
            onFocus={() => ensureInputVisible(receiverInputRef, true)}
            editable={!isFormLocked}
            style={[styles.inputWeb, isFormLocked && styles.inputDisabled, styles.trayInput]}
            placeholder="Type consignee name or phone..."
            placeholderTextColor="#94a3b8"
            value={receiverQuery}
            onChangeText={(text) => {
              setReceiverQuery(uppercaseText(text));
              if (selectedReceiver) setSelectedReceiver(null);
            }}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (filteredReceivers.length > 0) {
                handleSelectReceiver(filteredReceivers[0]);
              } else {
                receiverInputRef.current?.focus?.();
              }
            }}
          />

          {filteredReceivers.length > 0 && !isFormLocked ? (
            <View style={styles.autocompleteBox}>
              {filteredReceivers.map((c, idx) => (
                <TouchableOpacity
                  key={idx}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Select receiver ${c.NAME || ''}`}
                  style={styles.autocompleteItem}
                  onPress={() => handleSelectReceiver(c)}
                >
                  <Text style={styles.autocompleteName}>{c.NAME}</Text>
                  <Text style={styles.autocompleteSub}>{c.CITY || 'City N/A'} | Ph: {c.MOBILE || 'N/A'}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity accessible accessibilityRole="button" accessibilityLabel="Add new receiver contact" style={styles.autocompleteAddNew} onPress={() => { openAddContact('receiver'); }}>
                <Text style={styles.autocompleteAddNewText}>+ Add New Contact</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {selectedReceiver ? (
            <View style={styles.selectedContactCard}>
              <Text style={styles.contactName}>{selectedReceiver.NAME}</Text>
              <Text style={styles.contactDetail}>{selectedReceiver.ADDRESS || 'No Address'}</Text>
              <Text style={styles.contactDetail}>{selectedReceiver.CITY} - {selectedReceiver.PINCODE} ({selectedReceiver.STATE || 'State N/A'})</Text>
              <Text style={styles.contactDetail}>Mobile: {selectedReceiver.MOBILE || 'N/A'} | Zone: {selectedReceiver.ZONE || 'N/A'}</Text>
            </View>
          ) : null}
        </View>
      </Tray>

      {/* ── SECTION 5: Mode & Carrier ── */}
      <Tray
        title="5 · Mode"
        icon="mode"
        iconColors={BOOK_GRAD}
        floating
        bottomTitle="6 · Carrier"
        bottomIcon="carrier"
        bottomColors={BOOK_GRAD}
        style={isFormLocked && styles.trayLocked}
      >
        <View style={[styles.rowGrid, isCompactMobile && styles.rowGridMobile]}>
          <View style={{ flex: 1 }}>
            <Dropdown
              value={selectedMode}
              options={modeOptions}
              onChange={handleModeDropdownChange}
              placeholder="Select Mode"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Dropdown
              value={selectedCarrier}
              options={carrierOptions}
              onChange={handleCarrierDropdownChange}
              searchable
              placeholder="Select Carrier"
            />
          </View>
        </View>
        {/* Web parity (modeChangeMessage): auto-switch notices */}
        {modeChangeMsg ? <Text style={styles.modeChangeMsg}>{modeChangeMsg}</Text> : null}
      </Tray>

      {/* ── SECTION 7: Payment Type & Options ── */}
      <Tray title="7 · Payment Type & Options" icon="cash" iconColors={BOOK_GRAD} floating>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 3 }}>
            <PaymentSegmentedToggle
              options={[
                { key: 'topay', label: 'TOPAY', value: flagTopay, disabled: isFormLocked, onChange: (v) => setPaymentFlag('topay', v) },
                { key: 'cod', label: 'COD', value: flagCod, disabled: isFormLocked, onChange: (v) => setPaymentFlag('cod', v) },
                { key: 'fov', label: 'FOV', value: flagFov, disabled: isFormLocked, onChange: (v) => setPaymentFlag('fov', v) },
              ]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PaymentSegmentedToggle
              options={[
                { key: 'keep', label: 'KEEP', value: flagSav, disabled: false, onChange: (v) => setPaymentFlag('keep', v) },
              ]}
            />
          </View>
        </View>
      </Tray>

      {/* ── SECTION 8 & 9: Consignment Boxes / Documents & Product Details ── */}
      <Tray
        title={boxMode === 'DOX' ? `8 · Document Envelopes (${boxes.length})` : `8 · Consignment Boxes (${boxes.length})`}
        icon={boxMode === 'DOX' ? 'envelope' : 'boxes'}
        iconColors={BOOK_GRAD}
        floating
        bottomTitle={`9 · Products & Invoice (${products.length})`}
        bottomIcon="product"
        bottomColors={BOOK_GRAD}
        style={!isMainDetailsComplete && styles.trayDisabled}
        right={
          boxes.length > 0 ? (
            <TouchableOpacity
              accessible
              accessibilityRole="button"
              accessibilityLabel="Clear all boxes"
              onPress={handleClearBoxes}
              style={styles.clearCornerIconBtn}
              hitSlop={8}
              activeOpacity={0.75}
            >
              <Icon name="trash" size={13} color="#ef4444" />
            </TouchableOpacity>
          ) : null
        }
        bottomLeft={
          products.length > 0 ? (
            <TouchableOpacity
              accessible
              accessibilityRole="button"
              accessibilityLabel="Clear all products"
              onPress={handleClearProducts}
              style={styles.clearCornerIconBtn}
              hitSlop={8}
              activeOpacity={0.75}
            >
              <Icon name="trash" size={13} color="#ef4444" />
            </TouchableOpacity>
          ) : null
        }
      >
        {!isMainDetailsComplete && (
          <Text style={styles.lockNoticeText}>⚠️ Complete Customer, Sender, Receiver, Mode & Carrier to add boxes & products.</Text>
        )}

        {/* Consignment Boxes / Document Section */}
        <View style={styles.partyBlock}>
          {boxMode === 'DOX' ? (
            <View style={styles.doxRow}>
              <View style={styles.doxInputBox}>
                <TextInput
                  ref={doxWeightInputRef}
                  onFocus={() => ensureInputVisible(doxWeightInputRef)}
                  style={styles.doxWeightInput}
                  value={doxWeight}
                  keyboardType="numeric"
                  onChangeText={(t) => setDoxWeight(decimalOnly(t))}
                  placeholder="Wgt (kg)"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="done"
                  onSubmitEditing={handleAddDoxEnvelope}
                />
                <Button
                  colors={BOOK_GRAD}
                  size="sm"
                  icon="plus"
                  iconOnly
                  onPress={handleIncrementDoxWeight}
                  accessibilityLabel="Increase Dox weight by 0.25 kg"
                  style={{ marginHorizontal: 3 }}
                />
                <View style={styles.doxToggleWrap}>
                  <SegmentedToggle
                    options={[
                      { key: 'DL', label: 'DL' },
                      { key: 'A4', label: 'A4' },
                      { key: 'BG', label: 'BG' },
                    ]}
                    value={doxType}
                    onChange={setDoxType}
                    colors={BOOK_GRAD}
                    size="md"
                    flex
                  />
                </View>
              </View>

              <Button
                variant="primary"
                size="md"
                icon="plus"
                iconOnly
                onPress={handleAddDoxEnvelope}
                accessibilityLabel={`Add Dox Envelope (${doxType})`}
              />
            </View>
          ) : (
            <View style={styles.boxTableWrap}>
              <View style={styles.boxTable}>
                {/* PCS Cell when in Multi box mode */}
                {boxMode === 'Multi' && (
                  <View style={[styles.boxTableCell, { flex: 0.85 }]}>
                    <Text style={styles.boxCellLabel}>PCS</Text>
                    <TextInput
                      ref={pcsCountInputRef}
                      onFocus={() => ensureInputVisible(pcsCountInputRef)}
                      editable={isMainDetailsComplete}
                      style={[styles.boxCellInput, !isMainDetailsComplete && styles.inputDisabled, { color: '#8b5cf6' }]}
                      placeholder="1"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={pcsCount}
                      onChangeText={(t) => setPcsCount(digitsOnly(t, 4))}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focusNextIfFilled(pcsCount, boxWeightInputRef)}
                    />
                  </View>
                )}

                {/* Weight Cell */}
                <View style={styles.boxTableCell}>
                  <Text style={styles.boxCellLabel}>WT (KG)</Text>
                  <TextInput
                    ref={boxWeightInputRef}
                    onFocus={() => ensureInputVisible(boxWeightInputRef)}
                    editable={isMainDetailsComplete}
                    style={[styles.boxCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                    placeholder="0.0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={boxWgt}
                    onChangeText={(t) => setBoxWgt(decimalOnly(t))}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusNextIfFilled(boxWgt, boxLengthInputRef)}
                  />
                </View>

                {/* Length Cell */}
                <View style={styles.boxTableCell}>
                  <Text style={styles.boxCellLabel}>L (CM)</Text>
                  <TextInput
                    ref={boxLengthInputRef}
                    onFocus={() => ensureInputVisible(boxLengthInputRef)}
                    editable={isMainDetailsComplete}
                    style={[styles.boxCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={boxLength}
                    onChangeText={(t) => setBoxLength(decimalOnly(t))}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusNextIfFilled(boxLength, boxBreadthInputRef)}
                  />
                </View>

                {/* Breadth Cell */}
                <View style={styles.boxTableCell}>
                  <Text style={styles.boxCellLabel}>B (CM)</Text>
                  <TextInput
                    ref={boxBreadthInputRef}
                    onFocus={() => ensureInputVisible(boxBreadthInputRef)}
                    editable={isMainDetailsComplete}
                    style={[styles.boxCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={boxBreadth}
                    onChangeText={(t) => setBoxBreadth(decimalOnly(t))}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusNextIfFilled(boxBreadth, boxHeightInputRef)}
                  />
                </View>

                {/* Height Cell */}
                <View style={[styles.boxTableCell, styles.boxTableCellLast]}>
                  <Text style={styles.boxCellLabel}>H (CM)</Text>
                  <TextInput
                    ref={boxHeightInputRef}
                    onFocus={() => ensureInputVisible(boxHeightInputRef)}
                    editable={isMainDetailsComplete}
                    style={[styles.boxCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={boxHeight}
                    onChangeText={(t) => setBoxHeight(decimalOnly(t))}
                    returnKeyType="done"
                    onSubmitEditing={() => { handleAddBox(); }}
                  />
                </View>
              </View>

              <Button
                variant="primary"
                size="md"
                icon="plus"
                iconOnly
                disabled={!isMainDetailsComplete}
                onPress={handleAddBox}
                accessibilityLabel="Add Box"
              />
            </View>
          )}

          {boxes.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              {boxes.map((b, bi) => (
                <View key={bi} style={styles.boxRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boxRowTitle}>{boxMode === 'DOX' ? `Envelope #${b.BOX_NUM}` : `Box #${b.BOX_NUM}`}</Text>
                    <Text style={styles.boxRowSub}>
                      {boxMode === 'DOX'
                        ? `Weight: ${b.WEIGHT} kg | Size: ${b.LENGTH || doxType || 'DL'}`
                        : `Weight: ${b.WEIGHT} kg | ${b.LENGTH}x${b.BREADTH}x${b.HIGHT} cm | Chg Wt: ${(b.CHG_WT || b.WEIGHT).toFixed(2)} kg`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveBox(bi)} hitSlop={8} style={styles.rowRemoveBtn}>
                    <Icon name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Middle Separator with Dual Toggles on Same Row */}
        <View style={styles.routeSeparatorWrap}>
          <View style={styles.routeSeparatorLine} />
          <View style={styles.separatorDualToggles}>
            <View style={{ flex: 1 }}>
              <SegmentedToggle
                options={[
                  { key: 'DOX', label: 'DOX' },
                  { key: 'Single', label: 'Single' },
                  { key: 'Multi', label: 'Multi' },
                ]}
                value={boxMode}
                onChange={(mode) => {
                  setBoxMode(mode);
                  setFlagDox(mode === 'DOX');
                }}
                colors={BOOK_GRAD}
                size="sm"
                flex
              />
            </View>
            <View style={{ flex: 1 }}>
              <SegmentedToggle
                options={[
                  { key: 'INV', label: 'INV' },
                  { key: 'CLN', label: 'CLN' },
                  { key: 'DEC', label: 'DEC' },
                ]}
                value={prodDocType}
                onChange={setProdDocType}
                colors={BOOK_GRAD}
                size="sm"
                flex
              />
            </View>
          </View>
        </View>

        {/* Product & Invoice Details Section */}
        <View style={styles.partyBlockConsignee}>
          {boxMode !== 'DOX' && (
            <View style={styles.prodTableWrap}>
              <View style={styles.prodTable}>
                {/* Row 1: Product Name & Doc # */}
                <View style={styles.prodTableRow}>
                  <View style={[styles.prodTableCell, { flex: 1.8, borderRightWidth: 1, borderRightColor: '#e2e8f0' }]}>
                    <Text style={styles.prodCellLabel}>PRODUCT NAME</Text>
                    <TextInput
                      ref={productNameInputRef}
                      onFocus={() => ensureInputVisible(productNameInputRef)}
                      editable={isMainDetailsComplete}
                      style={[styles.prodCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                      placeholder="e.g. Spare Parts"
                      placeholderTextColor="#94a3b8"
                      value={prodName}
                      onChangeText={(text) => setProdName(uppercaseText(text))}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focusNextIfFilled(prodName, productDocNoInputRef)}
                    />
                  </View>

                  <View style={[styles.prodTableCell, { flex: 1.2 }]}>
                    <Text style={styles.prodCellLabel}>DOC #</Text>
                    <TextInput
                      ref={productDocNoInputRef}
                      onFocus={() => ensureInputVisible(productDocNoInputRef)}
                      editable={isMainDetailsComplete}
                      style={[styles.prodCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                      placeholder="Doc No"
                      placeholderTextColor="#94a3b8"
                      value={prodDocNo}
                      onChangeText={(text) => setProdDocNo(uppercaseText(text))}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focusNextIfFilled(prodDocNo, productEwayInputRef)}
                    />
                  </View>
                </View>

                {/* Row 2: 12-Digit EWay & Amount */}
                <View style={[styles.prodTableRow, styles.prodTableRowLast]}>
                  <View style={[styles.prodTableCell, { flex: 1.8, borderRightWidth: 1, borderRightColor: '#e2e8f0' }]}>
                    <Text style={styles.prodCellLabel}>12 DIGIT EWAY</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        ref={productEwayInputRef}
                        onFocus={() => ensureInputVisible(productEwayInputRef)}
                        editable={isMainDetailsComplete}
                        style={[styles.prodCellInput, { flex: 1 }, !isMainDetailsComplete && styles.inputDisabled]}
                        placeholder="12 digit EWay"
                        keyboardType="numeric"
                        maxLength={12}
                        placeholderTextColor="#94a3b8"
                        value={prodEway}
                        onChangeText={(t) => setProdEway(digitsOnly(t, 12))}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => focusNextIfFilled(prodEway, productAmountInputRef)}
                      />
                      <TouchableOpacity
                        onPress={() => isMainDetailsComplete && (ewayScanning ? stopEwayScanning() : startEwayScanning())}
                        disabled={!isMainDetailsComplete}
                        style={[styles.tinyBarcodeBtn, ewayScanning && styles.tinyBarcodeBtnActive]}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={ewayScanning ? "Close Scanner" : "Scan E-Way Barcode"}
                      >
                        <GradientGlyph
                          name={ewayScanning ? "close" : "barcode-scan"}
                          size={16}
                          colors={ewayScanning ? ['#f59e0b', '#ef4444'] : ['#0ea5e9', '#2563eb']}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.prodTableCell, { flex: 1.2 }]}>
                    <Text style={styles.prodCellLabel}>AMOUNT (₹)</Text>
                    <TextInput
                      ref={productAmountInputRef}
                      onFocus={() => ensureInputVisible(productAmountInputRef)}
                      editable={isMainDetailsComplete}
                      style={[styles.prodCellInput, !isMainDetailsComplete && styles.inputDisabled]}
                      placeholder="0.00"
                      keyboardType="numeric"
                      placeholderTextColor="#94a3b8"
                      value={prodAmount}
                      onChangeText={(t) => setProdAmount(decimalOnly(t))}
                      returnKeyType="done"
                      onSubmitEditing={() => { handleAddProduct(); }}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                accessible
                accessibilityRole="button"
                accessibilityLabel="Add Product"
                disabled={!isMainDetailsComplete}
                onPress={handleAddProduct}
                activeOpacity={0.8}
                style={[
                  styles.prodAddBtnStretched,
                  !isMainDetailsComplete && styles.btnDisabled,
                ]}
              >
                <LinearGradient
                  colors={['#9C2007', '#ef4444']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.prodAddBtnGradient}
                >
                  <Icon name="plus" size={18} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Inline Attached Barcode Scanner Stage (expands below product entry table) */}
          <View style={[styles.ewayScanPanel, ewayScanning && styles.ewayScanPanelOpen]}>
            {ewayScanning ? (
              <View style={styles.ewayScanStage}>
                {Platform.OS === 'web' ? (
                  React.createElement('video', {
                    ref: ewayWebVideoRef,
                    autoPlay: true,
                    playsInline: true,
                    muted: true,
                    style: { width: '100%', height: '100%', objectFit: 'cover' },
                  })
                ) : ewayPermission?.granted ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: [
                        'code128', 'code39', 'code93', 'ean13', 'ean8',
                        'qr', 'pdf417', 'datamatrix', 'itf14', 'codabar', 'aztec', 'upc_a', 'upc_e',
                      ],
                    }}
                    onBarcodeScanned={(res) => finishEwayScan(res?.data || res?.raw)}
                  />
                ) : (
                  <View style={styles.ewayScanPerm}>
                    <Text style={styles.ewayScanPermText}>Camera permission required</Text>
                    <TouchableOpacity onPress={requestEwayPermission} style={styles.ewayScanPermBtn}>
                      <Text style={styles.ewayScanPermBtnText}>Grant Permission</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Dark vignette overlay + scanning reticle */}
                <View style={styles.ewayScanDark} pointerEvents="none">
                  <View style={styles.ewayScanFrame}>
                    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.ewayCorner, styles.ewayCornerTL]} />
                    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.ewayCorner, styles.ewayCornerTR]} />
                    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.ewayCorner, styles.ewayCornerBL]} />
                    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.ewayCorner, styles.ewayCornerBR]} />
                    <LinearGradient
                      colors={['transparent', '#ef4444', '#ef4444', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.ewayScanLine, { top: `${ewayScanLine}%` }]}
                    />
                    <Text style={styles.ewayScanHint}>Align 12-digit E-Way barcode</Text>
                  </View>
                </View>

                {/* Close scan button */}
                <TouchableOpacity
                  onPress={stopEwayScanning}
                  style={styles.ewayScanCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={13} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {products.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              {products.map((p, pi) => (
                <View key={pi} style={styles.boxRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boxRowTitle}>{p.PRODUCT}</Text>
                    <Text style={styles.boxRowSub}>
                      Doc: {p.DOC_NUMBER || 'N/A'} ({p.DOC_TYPE}) | EWay: {p.EWAY_IF || 'N/A'} | ₹{p.AMOUNT}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveProduct(pi)} hitSlop={8} style={styles.rowRemoveBtn}>
                    <Icon name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          </View>
        </Tray>
      )}

      {/* ── SECTION 10 & 11: Consignment Live Totals & Charges Breakdown (Merged Tray) ── */}
      <Tray
        title="10 · Consignment Live Totals"
        icon="calculator-variant"
        iconColors={['#059669', '#10b981']}
        floating
        bottomTitle="11 · Charges & Taxes Breakdown"
        bottomIcon="chart-box-outline"
        bottomColors={['#0284c7', '#2563eb']}
      >
        {/* Consignment Live Metrics & Rate Tiers */}
        <StyledTable>
          {/* Row 1: Live Totals */}
          <StyledTable.Row>
            <StyledTable.Cell label="ACTUAL WT" value={`${summaryTotals.totalWgt.toFixed(2)} kg`} />
            <StyledTable.Cell
              label="CHG WT"
              value={`${summaryTotals.totalChgWt.toFixed(2)} kg`}
              highlight
              highlightBg="#f0fdf4"
              highlightColor="#047857"
            />
            <StyledTable.Cell label="PIECES" value={String(summaryTotals.boxCount)} />
            <StyledTable.Cell label="VALUE" value={`₹${summaryTotals.totalAmount.toFixed(2)}`} last />
          </StyledTable.Row>

          {/* Row 2: Rate Tier Details */}
          <StyledTable.Row style={{ backgroundColor: '#f8fafc' }} last>
            <StyledTable.Cell
              label="BASE RATE"
              value={helperTableData.rate != null ? `₹${helperTableData.rate}` : '—'}
            />
            <StyledTable.Cell
              label="ADD RATE"
              value={helperTableData.addRate != null ? `₹${helperTableData.addRate}` : '—'}
            />
            <StyledTable.Cell
              label="CEILING"
              value={helperTableData.weightCeiling ? `${helperTableData.weightCeiling} kg` : '—'}
            />
            <StyledTable.Cell
              label="ZONE"
              value={helperTableData.weightZone ? `${helperTableData.weightZone}${helperTableData.rateUid ? ` (${helperTableData.rateUid})` : ''}` : '—'}
              last
            />
          </StyledTable.Row>
        </StyledTable>

        {/* Middle Route Separator */}
        <View style={styles.routeSeparatorWrap}>
          <View style={styles.routeSeparatorLine} />
        </View>

        {/* Charges & Taxes Breakdown */}
        <StyledTable>
          {/* Row 1: Freight, Other Charges, Taxable Value */}
          <StyledTable.Row>
            <StyledTable.Cell label="FREIGHT" value={`₹${calculatedCharges.fright}`} />
            <StyledTable.Cell label="OTHER CHARGES" value={`₹${calculatedCharges.otherCharges}`} />
            <StyledTable.Cell label="TAXABLE VALUE" value={`₹${calculatedCharges.taxable}`} last />
          </StyledTable.Row>

          {/* Row 2: Tax Components (SGST, CGST, IGST) */}
          <StyledTable.Row style={{ backgroundColor: '#f8fafc' }}>
            <StyledTable.Cell label="SGST" value={`₹${calculatedCharges.sgst}`} />
            <StyledTable.Cell label="CGST" value={`₹${calculatedCharges.cgst}`} />
            <StyledTable.Cell label="IGST" value={`₹${calculatedCharges.igst}`} last />
          </StyledTable.Row>

          {/* Row 3: Grand Total Banner */}
          <StyledTable.Footer
            icon={<Icon name="check-circle" size={16} color="#15803d" />}
            label="TOTAL AMOUNT"
            value={`₹${calculatedCharges.total}`}
          />
        </StyledTable>
      </Tray>

      {/* ── SECTION 12: Finalize Order ── */}
      <Tray title="12 · Finalize Order" icon="check-circle" iconColors={BOOK_GRAD} floating>
        <Text style={styles.labelWeb}>AWB NUMBER</Text>
        <SearchBar
          value={awbNumber}
          onChangeText={(t) => {
            const value = uppercaseText(t);
            setAwbNumber(value);
            validateAwbPattern(value);
          }}
          placeholder="Enter or scan AWB number"
          hints={['Enter AWB number…', 'Tap barcode to scan…', 'Tap refresh to Get AWB…']}
          onActionPress={handleGenerateAwb}
          actionIcon="refresh"
          actionLabel="Get AWB"
          actionColors={BOOK_GRAD}
          onSubmitEditing={handleSubmit}
          style={{ marginBottom: 0 }}
        />

        {/* Web parity: validateAwbPattern hint (informational) */}
        {Boolean(awbHint) ? (
          <Text style={[
            styles.awbHint,
            awbHint.kind === 'success' && styles.awbHintSuccess,
            awbHint.kind === 'error' && styles.awbHintError,
            awbHint.kind === 'warn' && styles.awbHintWarn
          ]}>
            {awbHint.text}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Button variant="secondary" size="md" label="Clear All" onPress={handleClearAll} style={{ flex: 1 }} />
          <Button
            variant="primary"
            size="md"
            label={editRef ? 'UPDATE ORDER' : 'BOOK ORDER'}
            loading={bookingLoading}
            onPress={handleSubmit}
            style={{ flex: 2 }}
          />
        </View>
      </Tray>

      {/* ── LAST BOOKED SHIPMENT (Web: renderLastBooked — shown after booking) ── */}
      {Boolean(lastBookedOrder) ? (
        <Tray
          title={`✓ Shipment Booked: ${lastBookedOrder.AWB_NUMBER || 'No AWB'}`}
          icon="check-circle"
          iconColors={['#16a34a', '#84cc16']}
          right={
            <TouchableOpacity onPress={() => setLastBookedOrder(null)} hitSlop={8}>
              <Text style={styles.clearSmallText}>✕</Text>
            </TouchableOpacity>
          }
        >
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
            <Text style={styles.lastBookedChip}>Date: {formatDateDisplay(fmtFromUnix(lastBookedOrder.ORDER_DATE))}</Text>
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
            <TouchableOpacity
              style={styles.lastBookedActionBtn}
              accessibilityRole="button"
              accessibilityLabel="Upload shipment documents"
              onPress={() => onOpenUploader?.({
                ...lastBookedOrder,
                REFERENCE: lastBookedOrder.REFERENCE || lastBookedOrder.reference,
              })}
            >
              <Text style={styles.lastBookedActionUpload}>⬆ Upload</Text>
            </TouchableOpacity>
          </View>
        </Tray>
      ) : null}

      {/* ── BOOKING TRANSACTIONS (booked / pending / error log) ── */}
      {bookingTxns.length > 0 ? (
        <Tray
          title="Booking Transactions"
          icon="history"
          iconColors={BOOK_GRAD}
          right={
            <TouchableOpacity onPress={clearBookingTxns} hitSlop={8}>
              <Text style={styles.clearSmallText}>Clear</Text>
            </TouchableOpacity>
          }
        >
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
        </Tray>
      ) : null}

      {/* ── Order Date Calendar Picker Modal (Global Component) ── */}
      <DatePickerModal
        visible={orderDateModalVisible}
        value={orderDate}
        onChange={(newDate) => setOrderDate(newDate)}
        onClose={() => setOrderDateModalVisible(false)}
        colors={BOOK_GRAD}
      />

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
            <TextInput ref={acNameInputRef} onFocus={() => ensureInputVisible(acNameInputRef)} style={styles.inputWeb} placeholder="Full name" placeholderTextColor="#94a3b8" value={acForm.name} onChangeText={(t) => setAcForm(f => ({ ...f, name: uppercaseText(t) }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => acMobileInputRef.current?.focus?.()} />

            <Text style={styles.labelWeb}>MOBILE (10 DIGITS) *</Text>
            <TextInput
              ref={acMobileInputRef}
              onFocus={() => ensureInputVisible(acMobileInputRef)}
              style={styles.inputWeb}
              placeholder="10-digit mobile"
              keyboardType="numeric"
              maxLength={10}
              placeholderTextColor="#94a3b8"
              value={acForm.mobile}
              onChangeText={(t) => setAcForm(f => ({ ...f, mobile: t.replace(/\D/g, '').slice(0, 10) }))}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => acPincodeInputRef.current?.focus?.()}
            />

            <View style={[styles.rowGrid, isCompactMobile && styles.rowGridMobile]}>
              <View style={{ flex: 2 }}>
                <Text style={styles.labelWeb}>PINCODE *</Text>
                <TextInput
                  ref={acPincodeInputRef}
                  onFocus={() => ensureInputVisible(acPincodeInputRef)}
                  style={styles.inputWeb}
                  placeholder="6-digit pincode"
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94a3b8"
                  value={acForm.pincode}
                  onChangeText={(t) => handleAcPincodeChange(digitsOnly(t, 6))}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => acZoneInputRef.current?.focus?.()}
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
            <TextInput ref={acZoneInputRef} onFocus={() => ensureInputVisible(acZoneInputRef)} style={styles.inputWeb} placeholder="Zone (e.g. NORTH, WEST)" placeholderTextColor="#94a3b8" value={acPinResult?.zone || ''} onChangeText={(t) => setAcPinResult(r => (r ? { ...r, zone: uppercaseText(t) } : r))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => acAddressInputRef.current?.focus?.()} />

            <Text style={styles.labelWeb}>ADDRESS *</Text>
            <TextInput ref={acAddressInputRef} onFocus={() => ensureInputVisible(acAddressInputRef)} style={styles.inputWeb} placeholder="Full address" placeholderTextColor="#94a3b8" value={acForm.address} onChangeText={(t) => setAcForm(f => ({ ...f, address: uppercaseText(t) }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => acEmailInputRef.current?.focus?.()} />

            <View style={[styles.rowGrid, isCompactMobile && styles.rowGridMobile]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>EMAIL</Text>
                <TextInput ref={acEmailInputRef} onFocus={() => ensureInputVisible(acEmailInputRef)} style={styles.inputWeb} placeholder="Email" placeholderTextColor="#94a3b8" value={acForm.email} onChangeText={(t) => setAcForm(f => ({ ...f, email: t }))} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => acGstinInputRef.current?.focus?.()} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelWeb}>GSTIN</Text>
                <TextInput ref={acGstinInputRef} onFocus={() => ensureInputVisible(acGstinInputRef)} style={styles.inputWeb} placeholder="GSTIN" maxLength={15} placeholderTextColor="#94a3b8" value={acForm.gstin} onChangeText={(t) => setAcForm(f => ({ ...f, gstin: uppercaseText(t) }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => acCarrierInputRef.current?.focus?.()} />
              </View>
            </View>

            <Text style={styles.labelWeb}>CARRIER</Text>
            <TextInput ref={acCarrierInputRef} onFocus={() => ensureInputVisible(acCarrierInputRef)} style={styles.inputWeb} placeholder="Carrier company code" placeholderTextColor="#94a3b8" value={acForm.carrier} onChangeText={(t) => setAcForm(f => ({ ...f, carrier: uppercaseText(t) }))} returnKeyType="done" onSubmitEditing={handleAcSave} />

            {acError ? <Text style={styles.acError}>{acError}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button variant="secondary" size="md" label="Cancel" onPress={() => setAddContactVisible(false)} style={{ flex: 1 }} />
              <Button variant="primary" size="md" label="Save Contact" loading={acSaving} onPress={handleAcSave} style={{ flex: 1.4 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardPage: { flex: 1, minHeight: 0 },
  scrollPage: { flex: 1, padding: 14, backgroundColor: '#f8fafc' },
  scrollPageCompact: { padding: 8 },

  // Page title — gradient heading + underline bar (Orders parity).
  pageTitleBlock: { alignItems: 'center', marginTop: 6, marginBottom: 38 },
  pageTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pageTitleBar: { width: 46, height: 3, borderRadius: 2, marginTop: 8 },

  // Tray state overrides (locking logic preserved without visual blur/fade)
  trayLocked: {},
  trayDisabled: {},
  clearCornerIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(239,68,68,0.15)' }
      : { shadowColor: '#ef4444', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }),
  },
  cornerPcsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    minHeight: 28,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(15,23,42,0.08)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }),
  },
  cornerPcsBtnActive: {
    backgroundColor: '#9C2007',
    borderColor: '#9C2007',
  },
  cornerPcsBtnText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#8b5cf6',
    letterSpacing: 0.3,
  },
  cornerPcsBtnTextActive: {
    color: '#ffffff',
  },
  pcsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  pcsCountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  pcsCountInput: {
    width: 60,
    minHeight: 30,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 2,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  rowRemoveBtn: { padding: 4 },

  lockNoticeText: { fontSize: 11, fontWeight: '700', color: '#b45309', marginBottom: 10, backgroundColor: '#fef3c7', padding: 8, borderRadius: 8 },
  labelWeb: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 },
  inputWeb: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1.5, borderColor: '#94a3b8', borderStyle: 'solid', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600', marginBottom: 10, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  inputDisabled: {},
  btnDisabled: {},
  textDisabled: {},
  rowGrid: { flexDirection: 'row', gap: 10 },
  rowGridMobile: { gap: 6 },
  partyBlock: { width: '100%' },
  partyBlockConsignee: { width: '100%', paddingBottom: 6, marginBottom: 6 },
  routeSeparatorWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    width: '100%',
  },
  separatorDualToggles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
    width: '100%',
    paddingHorizontal: 2,
  },
  routeSeparatorLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#c4b5fd',
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(15,23,42,0.08)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }),
  },
  routePillText: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trayInput: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginBottom: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  doxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doxInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'solid',
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 3,
    marginBottom: 0,
  },
  doxWeightInput: {
    width: 65,
    minHeight: 44,
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '700',
    paddingHorizontal: 0,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  doxToggleWrap: {
    flex: 1,
    marginLeft: 6,
    justifyContent: 'center',
  },

  // Styled Table Row for Box Entry (WT, L, B, H)
  boxTableWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boxTable: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'solid',
    minHeight: 52,
    overflow: 'hidden',
  },
  boxTableCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTableCellLast: {
    borderRightWidth: 0,
  },
  boxCellLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  boxCellInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 2,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // Styled 2-Row Table for Product & Invoice Entry
  prodTableWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  prodTable: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'solid',
    overflow: 'hidden',
  },
  prodTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  prodTableRowLast: {
    borderBottomWidth: 0,
  },
  prodTableCell: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  prodCellLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prodCellInput: {
    width: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 2,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: 24,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  tinyBarcodeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  tinyBarcodeBtnActive: {
    backgroundColor: '#fee2e2',
  },

  // Inline Attached E-Way Barcode Scanner Stage
  ewayScanPanel: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease' } : null),
  },
  ewayScanPanelOpen: {
    height: 180,
    opacity: 1,
    marginTop: 8,
  },
  ewayScanStage: {
    flex: 1,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#020617',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ewayScanPerm: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  ewayScanPermText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  ewayScanPermBtn: {
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ewayScanPermBtnText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  ewayScanDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ewayScanFrame: {
    width: 140,
    height: 110,
    position: 'relative',
  },
  ewayCorner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  ewayCornerTL: { top: -2, left: -2, borderTopLeftRadius: 10 },
  ewayCornerTR: { top: -2, right: -2, borderTopRightRadius: 10 },
  ewayCornerBL: { bottom: -2, left: -2, borderBottomLeftRadius: 10 },
  ewayCornerBR: { bottom: -2, right: -2, borderBottomRightRadius: 10 },
  ewayScanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.95,
  },
  ewayScanHint: {
    position: 'absolute',
    bottom: 8,
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    width: '100%',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  ewayScanCloseBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  prodAddBtnStretched: {
    width: 44,
    borderRadius: 13,
    overflow: 'hidden',
    alignSelf: 'stretch',
    elevation: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 5px 14px rgba(239, 68, 68, 0.35)' }
      : { shadowColor: '#ef4444', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }),
  },
  prodAddBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 10,
  },

  placeholderTextItalic: { fontSize: 11.5, fontStyle: 'italic', color: '#94a3b8', paddingVertical: 6 },

  // Live Totals (inside the green Floating Tray)
  kpiCardsGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiCardHighlight: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiUnit: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
  },
  ratePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratePillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  ratePillVal: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f172a',
  },

  // Calendar Trigger Button — matches the Dropdown field height/look
  calendarTriggerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderRadius: 13, borderWidth: 1.5, borderColor: '#94a3b8', borderStyle: 'solid', paddingHorizontal: 13, paddingVertical: 9, marginBottom: 10, minHeight: 46 },
  calendarTriggerText: { fontSize: 13, fontWeight: '700', color: '#0284c7' },

  // Modals (add-contact)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.60)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalCloseX: { fontSize: 18, fontWeight: '700', color: '#94a3b8', padding: 4 },

  // Autocomplete
  autocompleteBox: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, overflow: 'hidden' },
  autocompleteItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  autocompleteName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  autocompleteSub: { fontSize: 11, color: '#64748b' },
  autocompleteAddNew: { padding: 10, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'center' },
  autocompleteAddNewText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  selectedContactCard: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 10 },
  contactName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  contactDetail: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Chip Select (doc types)
  chipRowSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  selectChip: { borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 7 },
  selectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  selectChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  selectChipTextActive: { color: '#ffffff' },

  // Payment options — multi-flag segmented toggle matching SegmentedToggle.js design
  segGroup: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    padding: 3,
    gap: 2,
    marginBottom: 4,
  },
  segBtn: { borderRadius: 999, overflow: 'hidden' },
  segBtnFlex: { flex: 1 },
  segDisabled: { opacity: 0.45 },
  segPressed: { opacity: 0.75 },
  segItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  segText: { color: '#64748b', fontWeight: '800', letterSpacing: 0.3, fontSize: 11.5 },
  segTextActive: { color: '#ffffff', fontWeight: '900', letterSpacing: 0.3, fontSize: 11.5 },

  // Box / Product rows
  boxRowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  boxRowTitle: { fontSize: 12.5, fontWeight: '800', color: '#0f172a' },
  boxRowSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // AWB row
  awbInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  // Charges Modern Box
  chargesModernBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  chargesModernRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chargesTaxRow: {
    backgroundColor: '#f8fafc',
  },
  chargesModernItem: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  chargesModernLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  chargesModernVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  chargesGrandTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1.5,
    borderTopColor: '#bbf7d0',
  },
  chargesGrandTotalLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.6,
  },
  chargesGrandTotalVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#15803d',
  },

  // Edit Banner (Web: prefillEditOrder)
  editBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', padding: 12, marginBottom: 12 },
  editBannerText: { fontSize: 13, fontWeight: '800', color: '#b45309' },

  // Booking Message (Web: bookingMessage)
  bookingMsgBox: { backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', padding: 12, marginBottom: 12 },
  bookingMsgSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  bookingMsgError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bookingMsgWarn: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  bookingMsgText: { fontSize: 12, fontWeight: '700', color: '#0f172a', textAlign: 'center' },

  // Last Booked (inside the success Tray)
  lastBookedRoute: { fontSize: 13, color: '#0f172a', fontWeight: '800', marginBottom: 10 },
  lastBookedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lastBookedChip: { fontSize: 10.5, fontWeight: '800', color: '#065f46', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, overflow: 'hidden' },
  lastBookedActions: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  lastBookedActionBtn: { flex: 1, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 9 },
  lastBookedActionEdit: { fontSize: 11.5, fontWeight: '800', color: '#4338ca' },
  lastBookedActionDelete: { fontSize: 11.5, fontWeight: '800', color: '#dc2626' },
  lastBookedActionUpload: { fontSize: 11.5, fontWeight: '800', color: '#15803d' },

  // Booking transactions log (inside the Tray)
  txnRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txnIcon: { fontSize: 14, fontWeight: '900', marginRight: 9, marginTop: 1, color: '#64748b' },
  txnIconOk: { color: '#16a34a' },
  txnIconErr: { color: '#dc2626' },
  txnIconWarn: { color: '#d97706' },
  txnMain: { fontSize: 12.5, fontWeight: '700', color: '#0f172a', lineHeight: 17 },
  txnSub: { fontSize: 10.5, color: '#94a3b8', marginTop: 1, fontWeight: '600' },

  // Mode change message
  modeChangeMsg: { fontSize: 11, fontWeight: '700', color: '#1d4ed8', marginTop: 2 },

  // Rate strip (Web: Helper Table)
  rateStrip: { marginTop: 10, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', padding: 10 },
  rateStripText: { fontSize: 10.5, fontWeight: '700', color: '#166534', lineHeight: 16 },

  // AWB pattern hint
  awbHint: { fontSize: 11, fontWeight: '700', color: '#1e293b', marginTop: 6, borderRadius: 8, padding: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  awbHintSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' },
  awbHintError: { backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' },
  awbHintWarn: { backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#b45309' },

  // Add Contact modal
  acModalScroll: { flex: 1, width: '100%' },
  acModalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, marginHorizontal: 16, marginVertical: 40 },
  acPinStatus: { fontSize: 18, fontWeight: '900', color: '#94a3b8', textAlign: 'center' },
  acDerivedBox: { backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', padding: 10, marginBottom: 10 },
  acDerivedRow: { fontSize: 10.5, fontWeight: '600', color: '#475569', lineHeight: 16 },
  acDerivedStrong: { fontWeight: '800', color: '#0369a1' },
  acDerivedWarn: { fontSize: 10.5, fontWeight: '700', color: '#d97706', marginTop: 2 },
  acError: { fontSize: 12, fontWeight: '700', color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, marginTop: 6 },
});

