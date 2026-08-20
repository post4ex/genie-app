import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { COLORS } from '../styles/theme';
import { ROLE_LEVELS } from '../core/config';
import { getAppData } from '../core/storage';
import { getPincodeCount, searchPin } from '../utils/searchpin';
import * as Location from 'expo-location';
import Tile from '../components/Tile';
import ListItem from '../components/ListItem';

const TILE_MIN_ROLE = {
  users: 'ADMIN', registrations: 'ADMIN', services: 'ADMIN', branches: 'CLIENT',
  staff: 'ADMIN', attendance: 'STAFF', pincodes: 'CLIENT', clients: 'CLIENT',
  b2b2c: 'CLIENT', holidays: 'STAFF', shifts: 'MANAGER', modes: 'MASTER', carriers: 'MASTER',
};

const TILES = [
  ['users', '👥', 'Users', 'ADMIN', 'USERS'],
  ['registrations', '📋', 'Registrations', 'ADMIN', 'REGISTRATIONS'],
  ['services', '⚙️', 'Services', 'ADMIN', null],
  ['branches', '🏢', 'Branches', 'CLIENT', 'BRANCHES'],
  ['staff', '🧑‍💼', 'Staff', 'ADMIN', 'STAFF'],
  ['attendance', '🕐', 'Attendance', 'STAFF', 'ATTENDANCE'],
  ['pincodes', '📍', 'Pincodes', 'CLIENT', null],
  ['clients', '🤝', 'Clients (B2B)', 'CLIENT', 'B2B'],
  ['b2b2c', '🛍️', 'B2B2C', 'CLIENT', 'B2B2C'],
  ['holidays', '🗓️', 'Holidays', 'STAFF', 'HOLIDAYS'],
  ['shifts', '🔄', 'Shifts & Leaves', 'MANAGER', 'ATTENDANCE'],
  ['modes', '🚚', 'Modes', 'MASTER', 'MODES'],
  ['carriers', '🏭', 'Carriers', 'MASTER', 'CARRIERS'],
];

const SERVICES = [
  ['app', '🖥️', 'App', 'Genie backend (FastAPI)'],
  ['pocketbase', '🗄️', 'PocketBase', 'Primary database'],
  ['tracking', '📦', 'Tracking', 'Carrier tracking service'],
  ['managerio', '💼', 'Manager.io', 'Accounting sync service'],
  ['whatsapp', '💬', 'WhatsApp', 'WA messaging service'],
  ['captcha', '🔒', 'Captcha', 'Captcha service'],
  ['mailjet', '📧', 'Mailjet', 'Transactional email'],
  ['brevo', '📨', 'Brevo', 'Email / SMS'],
  ['render', '☁️', 'Render', 'WA service host'],
  ['turso', '🗃️', 'Turso', 'Tracking/WA/mail logs'],
  ['ds-objects', '🗂️', 'HF Objects', 'Media files dataset'],
  ['ds-track-db', '💾', 'HF Track DB', 'Tracking SQLite dataset'],
  ['ds-pb', '💽', 'HF PocketBase', 'PocketBase dataset'],
  ['ds-todo', '📋', 'HF Todo', 'Todo/docs dataset'],
  ['r2', '🪣', 'R2 Bucket', 'Cloudflare R2 objects'],
  ['hfbucket', '🗑️', 'HF Bucket', 'HF S3 objects bucket'],
];

const FORM_FIELDS = {
  users: [
    ['USER', 'Username', 'default'], ['NAME', 'Name', 'text'], ['EMAIL', 'Email', 'email-address'], ['MOBILE', 'Mobile', 'phone-pad'],
    ['BRANCH', 'Branch', 'text'], ['ROLE', 'Role', 'text'], ['STATUS', 'Status', 'text'], ['CODE', 'Client code', 'text'],
    ['COL_FILTER', 'Column filter', 'text'], ['FILTER_VALUE', 'Filter value', 'text'],
  ],
  branches: [
    ['BRANCH_CODE', 'Branch code', 'text'], ['BRANCH_NAME', 'Branch name', 'text'], ['BRANCH_STATUS', 'Status', 'text'],
    ['BRANCH_GSTIN', 'GSTIN', 'text'], ['BRANCH_PAN', 'PAN', 'text'], ['BRANCH_ADDRESS', 'Address', 'text'],
    ['BRANCH_LANDMARK', 'Landmark', 'text'], ['BRANCH_PINCODE', 'Pincode', 'numeric'], ['BRANCH_CITY', 'City', 'text'],
    ['BRANCH_STATE', 'State', 'text'], ['CODE_STATE', 'State code', 'text'], ['GST_CODE', 'GST code', 'text'],
    ['BRANCH_MOBILE', 'Mobile', 'phone-pad'], ['BRANCH_EMAIL', 'Email', 'email-address'], ['BRANCH_MANAGER', 'Manager', 'text'],
    ['BRANCH_MANAGER_PHONE', 'Manager phone', 'phone-pad'], ['BRANCH_OPEN_TIME', 'Open time', 'text'], ['BRANCH_CLOSE_TIME', 'Close time', 'text'],
    ['BRANCH_UPI', 'UPI', 'text'], ['BRANCH_UPI_NAME', 'UPI name', 'text'], ['BRANCH_BANK_AC', 'Bank account', 'numeric'],
    ['BRANCH_IFSC', 'IFSC', 'text'], ['BRANCH_BANK_NAME', 'Bank name', 'text'], ['BRANCH_GEO_TEG', 'Geo tag', 'text'],
    ['CREDIT_LIMIT', 'Credit limit', 'numeric'], ['CROSS_LIMIT', 'Cross limit', 'text'],
  ],
  staff: [
    ['STAFF_CODE', 'Staff code', 'text'], ['STAFF_NAME', 'Staff name', 'text'], ['BRANCH', 'Branch', 'text'],
    ['STATUS', 'Status', 'text'], ['ROLE', 'Role', 'text'], ['DEPARTMENT', 'Department', 'text'], ['GENDER', 'Gender', 'text'],
    ['BLOOD_GROUP', 'Blood group', 'text'], ['MOBILE', 'Mobile', 'phone-pad'], ['EMAIL', 'Email', 'email-address'],
    ['EMERGENCY_CONTACT', 'Emergency contact', 'phone-pad'], ['ADHAR_NUM', 'Aadhaar', 'numeric'], ['PAN_NUM', 'PAN', 'text'],
    ['FATHERS_NAME', "Father's name", 'text'], ['DATE_BIRTH', 'Date of birth (YYYY-MM-DD)', 'default'],
    ['DATE_JOIN', 'Date of joining (YYYY-MM-DD)', 'default'], ['DATE_LEAVE', 'Date of leaving (YYYY-MM-DD)', 'default'],
    ['EPF_UID', 'EPF UID', 'text'], ['ESI_UID', 'ESI UID', 'text'], ['UAN', 'UAN', 'text'], ['BANK_AC', 'Bank account', 'numeric'],
    ['BANK_IFSC', 'Bank IFSC', 'text'], ['BANK_NAME', 'Bank name', 'text'], ['DRIVING_LICENSE', 'Driving license', 'text'],
    ['VEHICLE_NUM', 'Vehicle number', 'text'], ['ADDRESS', 'Address', 'text'], ['PINCODE', 'Pincode', 'numeric'],
    ['CITY', 'City', 'text'], ['STATE', 'State', 'text'], ['CODE_STATE', 'State code', 'text'], ['GST_CODE', 'GST code', 'text'],
  ],
  clients: [
    ['CODE', 'Client code', 'text'], ['B2B_NAME', 'B2B name', 'text'], ['MOBILE_NUMBER', 'Mobile', 'phone-pad'], ['EMAIL', 'Email', 'email-address'],
    ['B2B_ADDRESS', 'Address', 'text'], ['B2B_LANDMARK', 'Landmark', 'text'], ['B2B_PINCODE', 'Pincode', 'numeric'], ['B2B_CITY', 'City', 'text'],
    ['B2B_STATE', 'State', 'text'], ['CODE_STATE', 'State code', 'text'], ['GST_CODE', 'GST code', 'text'], ['GSTIN', 'GSTIN', 'text'],
    ['PAN', 'PAN', 'text'], ['AADHAAR', 'Aadhaar', 'numeric'], ['BRANCH', 'Branch', 'text'], ['B2B_TYPE', 'B2B type', 'text'],
    ['STATUS', 'Status', 'text'], ['RATE_LIST', 'Rate list (SIMPLIFIED/DYNAMIC)', 'text'], ['CLEARING_CHG', 'Clearing charge', 'numeric'],
    ['WEIGHT_CHANGE', 'Weight change', 'numeric'], ['PCT_TOPAY_IF', 'To-pay rate', 'numeric'], ['PCT_COD_IF', 'COD rate', 'numeric'],
    ['PCT_FOV_IF', 'FOV rate', 'numeric'], ['EWAY_IF', 'E-way charge', 'numeric'], ['AWB_CHARGES', 'AWB charge', 'numeric'],
    ['PACKING_CHARGES', 'Packing charge', 'numeric'], ['FUEL_CHARGES', 'Fuel rate', 'numeric'], ['DEV_CHARGES', 'Development rate', 'numeric'],
    ['BILL_CYCLE', 'Bill cycle', 'text'], ['CREDIT_LIMIT', 'Credit limit', 'numeric'], ['MAX_USERS_ALLOWED', 'Max users', 'numeric'],
    ['MAX_LOGINS_PER_USER', 'Max logins/user', 'numeric'], ['SUBSCRIPTION_TYPE', 'Subscription', 'text'],
  ],
  b2b2c: [
    ['UID', 'UID', 'text'], ['NAME', 'Name', 'text'], ['MOBILE', 'Mobile', 'phone-pad'], ['EMAIL', 'Email', 'email-address'],
    ['ADDRESS', 'Address', 'text'], ['CARRIER', 'Carrier', 'text'], ['PINCODE', 'Pincode', 'numeric'], ['CITY', 'City', 'text'],
    ['STATE', 'State', 'text'], ['ZONE', 'Zone', 'text'], ['ODA', 'ODA', 'text'], ['BRANCH', 'Branch', 'text'], ['CODE', 'Parent code', 'text'],
    ['EXPRESS_TAT', 'Express TAT', 'numeric'], ['AIRLINE_TAT', 'Airline TAT', 'numeric'], ['SURFACE_TAT', 'Surface TAT', 'numeric'], ['PREMIUM_TAT', 'Premium TAT', 'numeric'],
  ],
  attendance: [
    ['STATUS', 'Status', 'text'], ['SHIFT', 'Shift', 'text'], ['LEAVE_TYPE', 'Leave type', 'text'], ['IN_TIME', 'In time (HH:MM)', 'default'], ['OUT_TIME', 'Out time (HH:MM)', 'default'], ['GEO_TAG_IN', 'GPS in location', 'text'], ['GEO_TAG_OUT', 'GPS out location', 'text'], ['REMARKS', 'Remarks', 'text'],
  ],
  shifts: [
    ['SHIFT', 'Shift', 'text'], ['STATUS', 'Status', 'text'], ['LEAVE_TYPE', 'Leave type', 'text'], ['START_DATE', 'Start date (YYYY-MM-DD)', 'default'], ['END_DATE', 'End date (YYYY-MM-DD)', 'default'], ['REMARKS', 'Remarks', 'text'],
  ],
  holidays: [
    ['HOLIDAY_NAME', 'Holiday name', 'text'], ['HOLIDAY_DATE', 'Date (YYYY-MM-DD)', 'default'], ['HOLIDAY_TYPE', 'Type', 'text'],
    ['STATE_CODE', 'State codes (comma separated)', 'text'], ['OPEN_BRANCHES', 'Open branches (comma separated)', 'text'], ['YEAR', 'Year', 'numeric'],
  ],
  modes: [
    ['MODE', 'Mode', 'text'], ['SHORT', 'Short name', 'text'], ['VOL_INGR', 'Volumetric divisor', 'numeric'], ['MIN_WT', 'Minimum weight', 'numeric'],
    ...Array.from({ length: 14 }, (_, index) => [`Z${index + 1}`, `Zone Z${index + 1} availability (Y/N)`, 'text']),
  ],
  carriers: [
    ['COMPANY_CODE', 'Company code', 'text'], ['COMPANY_NAME', 'Company name', 'text'], ['LOGO_URL_GDRIVE', 'Logo URL (G-Drive)', 'url'],
    ['LOGO_URL_POSTIMG', 'Logo URL (PostIMG)', 'url'], ['GSTIN', 'GSTIN', 'text'], ['TRANSPORT_ID', 'Transport ID', 'text'],
    ['COMPANY_ADDRESS', 'Address', 'text'], ['COMPANY_PINCODE', 'Pincode', 'numeric'], ['COMPANY_CITY', 'City', 'text'], ['COMPANY_STATE', 'State', 'text'],
    ['EMAIL', 'Email', 'email-address'], ['MOBILE', 'Company mobile', 'phone-pad'], ['CONTACT_PERSON', 'Contact person', 'text'],
    ['CONTACT_MOBILE', 'Contact mobile', 'phone-pad'], ['BANK_NAME', 'Bank name', 'text'], ['BANK_AC', 'Bank account', 'numeric'], ['IFSC', 'IFSC', 'text'], ['UPI', 'UPI ID', 'text'],
  ],
};

const keyFor = (tile, record) => ({
  branches: record.BRANCH_CODE || record.CODE, staff: record.STAFF_CODE, clients: record.CODE,
  b2b2c: record.UID || record.CODE, holidays: record.HOLIDAY_ID, modes: record.SHORT || record.MODE,
  carriers: record.COMPANY_CODE || record.CODE, attendance: record.STAFF_CODE, shifts: record.STAFF_CODE,
}[tile] || record.id || record.USER || record.REFERENCE || record.PINCODE);

const asRecords = (value) => Array.isArray(value) ? value : Object.values(value || {});
const roleLevel = (role) => ROLE_LEVELS[role] || 0;
const can = (role, required) => roleLevel(role) >= (ROLE_LEVELS[required] || 0);
const displayValue = (value) => value == null || value === '' ? '—' : String(value);

export default function AdminScreen({
  token = '', apiBase = '', user = {}, onRefresh,
}) {
  const role = user?.ROLE || 'CLIENT';
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const [localData, setLocalData] = useState({});
  const [remote, setRemote] = useState({ users: [], registrations: [] });
  const [activeTile, setActiveTile] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mobileDetailVisible, setMobileDetailVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingRates, setEditingRates] = useState(false);
  const [rateRows, setRateRows] = useState([]);
  const [sudoVisible, setSudoVisible] = useState(false);
  const [sudoStep, setSudoStep] = useState('credentials');
  const [sudoUsername, setSudoUsername] = useState(user?.USER || '');
  const [sudoPassword, setSudoPassword] = useState('');
  const [sudoOtp, setSudoOtp] = useState('');
  const [sudoBusy, setSudoBusy] = useState(false);
  const [sudoError, setSudoError] = useState('');
  const [sudoResolver, setSudoResolver] = useState(null);
  const [sudoRejecter, setSudoRejecter] = useState(null);
  const [writeOtpVisible, setWriteOtpVisible] = useState(false);
  const [writeOtpCode, setWriteOtpCode] = useState('');
  const [writeOtpAction, setWriteOtpAction] = useState('');
  const [writeOtp, setWriteOtp] = useState('');
  const [writeOtpError, setWriteOtpError] = useState('');
  const [writeOtpBusy, setWriteOtpBusy] = useState(false);
  const [writeOtpResolver, setWriteOtpResolver] = useState(null);
  const [writeOtpRejecter, setWriteOtpRejecter] = useState(null);
  const [b2bOtpVisible, setB2bOtpVisible] = useState(false);
  const [b2bOtpCode, setB2bOtpCode] = useState('');
  const [b2bOtpAction, setB2bOtpAction] = useState('');
  const [b2bOtp, setB2bOtp] = useState('');
  const [b2bOtpError, setB2bOtpError] = useState('');
  const [b2bOtpBusy, setB2bOtpBusy] = useState(false);
  const [b2bOtpResolver, setB2bOtpResolver] = useState(null);
  const [b2bOtpRejecter, setB2bOtpRejecter] = useState(null);
  const [serviceStatuses, setServiceStatuses] = useState({});
  const [serviceLog, setServiceLog] = useState(null);
  const [serviceLogLoading, setServiceLogLoading] = useState(false);
  const [pinResult, setPinResult] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [addUserOtpVisible, setAddUserOtpVisible] = useState(false);
  const [addUserOtp, setAddUserOtp] = useState('');
  const [addUserOtpBusy, setAddUserOtpBusy] = useState(false);
  const [addUserOtpError, setAddUserOtpError] = useState('');
  const [pendingUserPayload, setPendingUserPayload] = useState(null);

  const apiCall = useCallback(async (path, body = {}, method = 'POST') => {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.status === 'error') {
      throw new Error(json.message || json.detail || `Request failed (${response.status})`);
    }
    return json;
  }, [apiBase, token]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [data, users, registrations] = await Promise.all([
        getAppData(),
        can(role, 'ADMIN') ? apiCall('/api/adminListUsers', {}, 'GET').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        can(role, 'ADMIN') ? apiCall('/api/fetchRegistrations', {}, 'GET').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setLocalData(data || {});
      setRemote({ users: users?.data || [], registrations: registrations?.data || [] });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [apiCall, role]);

  useEffect(() => { reload(); }, [reload]);

  const tileRecords = useMemo(() => {
    if (!activeTile) return [];
    if (activeTile === 'users') return remote.users;
    if (activeTile === 'registrations') return remote.registrations;
    if (activeTile === 'services') return SERVICES.map(([id, icon, name, desc]) => ({ id, icon, name, desc, ...serviceStatuses[id] }));
    if (activeTile === 'pincodes') return pinResult ? [{ PINCODE: pinResult.pin, CITY: pinResult.CITY, STATE: pinResult.STATE_NAME || pinResult.STATE }] : [];
    if (activeTile === 'attendance' || activeTile === 'shifts') return asRecords(localData.STAFF);
    return asRecords(localData[TILES.find(t => t[0] === activeTile)?.[4]]);
  }, [activeTile, localData, pinResult, remote, serviceStatuses]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || activeTile === 'pincodes') return tileRecords;
    return tileRecords.filter(record => Object.values(record || {}).some(value => String(value ?? '').toLowerCase().includes(q)));
  }, [activeTile, query, tileRecords]);

  const countFor = (tile) => {
    if (tile === 'users') return remote.users.length;
    if (tile === 'registrations') return remote.registrations.length;
    if (tile === 'services') return Object.keys(serviceStatuses).length ? `${Object.values(serviceStatuses).filter(s => s.status === 'online').length}/${SERVICES.length}` : '…';
    if (tile === 'pincodes') return getPincodeCount().toLocaleString('en-IN');
    const sheet = TILES.find(t => t[0] === tile)?.[4];
    return asRecords(localData[sheet]).length;
  };

  const openTile = async (tile) => {
    if (!can(role, TILE_MIN_ROLE[tile])) return;
    setActiveTile(tile); setSelected(null); setMobileDetailVisible(false); setQuery(''); setShowForm(false); setEditingRates(false); setMessage(''); setPinResult(null);
    if (tile === 'services') {
      try {
        const result = await apiCall('/api/services/status', {}, 'GET');
        setServiceStatuses(result.data || {});
      } catch (error) { setMessage(error.message); }
    }
  };

  const getSudoToken = () => new Promise((resolve, reject) => {
    setSudoUsername(user?.USER || ''); setSudoPassword(''); setSudoOtp(''); setSudoStep('credentials'); setSudoError(''); setSudoResolver(() => resolve); setSudoRejecter(() => reject); setSudoVisible(true);
  });

  const submitSudoCredentials = async () => {
    if (!sudoUsername.trim() || !sudoPassword) { setSudoError('Username and password are required.'); return; }
    setSudoBusy(true); setSudoError('');
    try {
      await apiCall('/api/initiateAdminAccess', { username: sudoUsername.trim(), password: sudoPassword });
      setSudoStep('otp');
    } catch (error) { setSudoError(error.message); }
    finally { setSudoBusy(false); }
  };

  const submitSudoOtp = async () => {
    if (sudoOtp.trim().length !== 6) { setSudoError('Enter the 6-digit OTP.'); return; }
    setSudoBusy(true); setSudoError('');
    try {
      const result = await apiCall('/api/verifyAdminAccess', { username: sudoUsername.trim(), otp: sudoOtp.trim() });
      setSudoVisible(false); setSudoResolver(null); setSudoRejecter(null); sudoResolver?.(result.sudo_token); setSudoStep('credentials');
    } catch (error) { setSudoError(error.message); }
    finally { setSudoBusy(false); }
  };

  const closeSudo = () => { setSudoVisible(false); sudoRejecter?.(new Error('cancelled')); setSudoResolver(null); setSudoRejecter(null); setSudoStep('credentials'); };

  // Staff mutations intentionally use the web's separate staff OTP contract,
  // not the admin sudo contract: sendStaffOtp -> verifyStaffOtp -> write_token.
  const getStaffWriteToken = async (code, action) => {
    await apiCall('/api/sendStaffOtp', { STAFF_CODE: code, action }, 'POST');
    setWriteOtpCode(code); setWriteOtpAction(action); setWriteOtp(''); setWriteOtpError(''); setWriteOtpVisible(true);
    return new Promise((resolve, reject) => { setWriteOtpResolver(() => resolve); setWriteOtpRejecter(() => reject); });
  };
  const verifyStaffWriteOtp = async () => {
    if (writeOtp.trim().length !== 6) { setWriteOtpError('Enter the 6-digit OTP.'); return; }
    setWriteOtpBusy(true); setWriteOtpError('');
    try {
      const result = await apiCall('/api/verifyStaffOtp', { STAFF_CODE: writeOtpCode, action: writeOtpAction, otp: writeOtp.trim() }, 'POST');
      setWriteOtpVisible(false); setWriteOtpResolver(null); setWriteOtpRejecter(null); writeOtpResolver?.(result.write_token);
    } catch (error) { setWriteOtpError(error.message); }
    finally { setWriteOtpBusy(false); }
  };
  const closeStaffOtp = () => { setWriteOtpVisible(false); writeOtpRejecter?.(new Error('cancelled')); setWriteOtpResolver(null); setWriteOtpRejecter(null); setWriteOtpError(''); };

  const getB2bWriteToken = async (code, action) => {
    await apiCall('/api/sendB2bOtp', { CODE: code, action }, 'POST');
    setB2bOtpCode(code); setB2bOtpAction(action); setB2bOtp(''); setB2bOtpError(''); setB2bOtpVisible(true);
    return new Promise((resolve, reject) => { setB2bOtpResolver(() => resolve); setB2bOtpRejecter(() => reject); });
  };
  const verifyB2bOtp = async () => {
    if (b2bOtp.trim().length !== 6) { setB2bOtpError('Enter the 6-digit OTP.'); return; }
    setB2bOtpBusy(true); setB2bOtpError('');
    try {
      const result = await apiCall('/api/verifyB2bOtp', { CODE: b2bOtpCode, action: b2bOtpAction, otp: b2bOtp.trim() }, 'POST');
      setB2bOtpVisible(false); setB2bOtpResolver(null); setB2bOtpRejecter(null); b2bOtpResolver?.(result.write_token);
    } catch (error) { setB2bOtpError(error.message); }
    finally { setB2bOtpBusy(false); }
  };
  const closeB2bOtp = () => { setB2bOtpVisible(false); b2bOtpRejecter?.(new Error('cancelled')); setB2bOtpResolver(null); setB2bOtpRejecter(null); setB2bOtpError(''); };

  const mutate = async (tile, record, isUpdate, writeToken = null) => {
    const key = keyFor(tile, record);
    const endpoints = {
      branches: ['/api/writeBranch', '/api/deleteBranch', 'POST'], staff: ['/api/writeStaff', '/api/deleteStaff', 'POST'],
      clients: ['/api/writeB2B', '/api/deleteB2B', 'POST'], b2b2c: ['/api/writeB2B2C', '/api/deleteB2B2C', 'POST'],
      holidays: ['/api/writeHoliday', '/api/deleteHoliday', 'POST'], modes: ['/api/writeMode', '/api/deleteMode', 'POST'],
      carriers: ['/api/writeCarrier', '/api/deleteCarrier', 'POST'],
    }[tile];
    if (!endpoints) throw new Error('This tile has no write action.');
    let payload;
    if (tile === 'b2b2c') {
      payload = isUpdate ? { UID: key, MOBILE: record.MOBILE, EMAIL: record.EMAIL, ADDRESS: record.ADDRESS, CARRIER: record.CARRIER } : { ...record, EXPRESS_TAT: Number(record.EXPRESS_TAT) || 0, AIRLINE_TAT: Number(record.AIRLINE_TAT) || 0, SURFACE_TAT: Number(record.SURFACE_TAT) || 0, PREMIUM_TAT: Number(record.PREMIUM_TAT) || 0 };
    } else if (tile === 'clients') {
      const { CODE, BRANCH, STATUS, RATE_LIST, ...extra } = record;
      payload = { CODE: CODE || key, BRANCH: BRANCH || '', STATUS: STATUS || 'ACTIVE', RATE_LIST: RATE_LIST || 'SIMPLIFIED', record_id: isUpdate ? key : null, extra, write_token: writeToken || '' };
    } else if (tile === 'holidays') {
      payload = { ...record, ...(isUpdate ? { record_id: record.id || key } : {}) };
    } else {
      payload = { data: record, record_id: record.id || (isUpdate ? key : null), ...(writeToken ? { write_token: writeToken } : {}) };
    }
    const result = isUpdate ? await apiCall(endpoints[0], payload, tile === 'b2b2c' ? 'PATCH' : 'POST') : await apiCall(endpoints[0], payload, 'POST');
    return result.record || result.data || record;
  };

  const saveRecord = async () => {
    if (!activeTile || activeTile === 'registrations') return;
    if (activeTile === 'attendance' || activeTile === 'shifts') {
      if (!selected) { setMessage('Select a staff member first.'); return; }
      setSaving(true); setMessage('');
      try {
        const today = new Date().toISOString().slice(0, 10);
        const toMs = value => value && /^\d{2}:\d{2}$/.test(value) ? new Date(`${today}T${value}:00`).getTime() : 0;
        const attendanceId = `${selected.STAFF_CODE}-${today}`;
        const data = { ...form, IN_TIME: toMs(form.IN_TIME), OUT_TIME: toMs(form.OUT_TIME), ATTEN_DATE: new Date(`${today}T00:00:00Z`).getTime(), STAFF_CODE: selected.STAFF_CODE, STAFF_NAME: selected.STAFF_NAME, BRANCH: selected.BRANCH, ATTENDANCE_ID: attendanceId };
        await apiCall('/api/writeAttendance', { data, record_id: form.id || null }, 'POST');
        setMessage(`${activeTile === 'shifts' ? 'Shift/leave' : 'Attendance'} saved.`); await onRefresh?.(); await reload(); setShowForm(false);
      } catch (error) { setMessage(error.message); } finally { setSaving(false); }
      return;
    }
    if (activeTile === 'users') {
      setSaving(true); setMessage('');
      try {
        if (!selected) {
          const payload = {
            USER: String(form.USER || '').trim(), NAME: String(form.NAME || '').trim(), EMAIL: String(form.EMAIL || '').trim(),
            MOBILE: String(form.MOBILE || '').trim(), BRANCH: String(form.BRANCH || '').trim(), ROLE: form.ROLE || 'CLIENT',
            CODE: String(form.CODE || '').trim(), STATUS: form.STATUS || 'ACTIVE', COL_FILTER: form.COL_FILTER || '', FILTER_VALUE: form.FILTER_VALUE || '', PASS: '',
          };
          if (!payload.USER || !payload.NAME) throw new Error('Username and name are required.');
          await apiCall('/api/initiateAddUser', payload, 'POST');
          setPendingUserPayload(payload); setAddUserOtp(''); setAddUserOtpError(''); setAddUserOtpVisible(true);
          setMessage('OTP sent. Verify it to create the user.');
        } else {
          const sudoToken = await getSudoToken();
          const fields = { ...form }; delete fields.USER;
          await apiCall('/api/adminUpdateUser', { username: selected.USER, sudo_token: sudoToken, fields }, 'PATCH');
          setMessage('User updated successfully.'); await reload(); setShowForm(false);
        }
      } catch (error) { setMessage(error.message); } finally { setSaving(false); }
      return;
    }
    const fields = FORM_FIELDS[activeTile] || [];
    const missing = fields.find(([name]) => ['BRANCH_CODE', 'STAFF_CODE', 'STAFF_NAME', 'CODE', 'B2B_NAME', 'NAME', 'HOLIDAY_NAME', 'HOLIDAY_DATE', 'MODE', 'COMPANY_CODE', 'COMPANY_NAME'].includes(name) && !String(form[name] || '').trim());
    if (missing) { setMessage(`${missing[1]} is required.`); return; }
    setSaving(true); setMessage('');
    try {
      let record = { ...form };
      if (activeTile === 'holidays' && /^\d{4}-\d{2}-\d{2}$/.test(record.HOLIDAY_DATE || '')) record.HOLIDAY_DATE = new Date(`${record.HOLIDAY_DATE}T00:00:00Z`).getTime();
      if (activeTile === 'clients') {
        record = { ...record, MOBILE_NUMBER: record.MOBILE_NUMBER || '', WP_ALERTS: [], WP_GROUP: [] };
        ['CREDIT_LIMIT', 'CLEARING_CHG'].forEach(field => { if (record[field] !== '') record[field] = Number(record[field]) || 0; });
      }
      let writeToken = null;
      if (activeTile === 'staff') writeToken = await getStaffWriteToken(record.STAFF_CODE || selected?.STAFF_CODE, selected ? 'update_staff' : 'new_staff');
      if (activeTile === 'clients') writeToken = await getB2bWriteToken(record.CODE || selected?.CODE, selected ? 'update_client' : 'new_client');
      const saved = await mutate(activeTile, record, Boolean(selected), writeToken);
      setMessage(`${TILES.find(t => t[0] === activeTile)?.[2] || 'Record'} saved successfully.`);
      await onRefresh?.(); await reload(); setSelected(saved); setShowForm(false);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const confirmAddUser = async () => {
    if (!pendingUserPayload || addUserOtp.trim().length !== 6) { setAddUserOtpError('Enter the 6-digit OTP.'); return; }
    setAddUserOtpBusy(true); setAddUserOtpError('');
    try {
      await apiCall(`/api/confirmAddUser?username=${encodeURIComponent(pendingUserPayload.USER)}`, { otp: addUserOtp.trim() }, 'POST');
      setAddUserOtpVisible(false); setPendingUserPayload(null); setShowForm(false); setMessage('User added successfully.'); await reload();
    } catch (error) {
      setAddUserOtpError(error.message);
    } finally {
      setAddUserOtpBusy(false);
    }
  };

  const deleteRecord = async (record) => {
    if (!record) return;
    Alert.alert('Confirm delete', `Delete ${displayValue(keyFor(activeTile, record))}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true); setMessage('');
        try {
          const key = keyFor(activeTile, record);
          let payload; let endpoint; let method = 'POST';
          if (activeTile === 'users') { const sudoToken = await getSudoToken(); endpoint = '/api/adminDeleteUser'; payload = { username: key, sudo_token: sudoToken }; method = 'DELETE'; }
          else if (activeTile === 'b2b2c') { endpoint = '/api/deleteB2B2C'; payload = { UID: key }; method = 'DELETE'; }
          else if (activeTile === 'clients') { const writeToken = await getB2bWriteToken(key, 'delete_client'); endpoint = '/api/deleteB2B'; payload = { CODE: key, write_token: writeToken }; }
          else if (activeTile === 'holidays') { endpoint = '/api/deleteHoliday'; payload = { record_id: record.id || key }; method = 'DELETE'; }
          else if (activeTile === 'staff') { const writeToken = await getStaffWriteToken(key, 'delete_staff'); endpoint = '/api/deleteStaff'; payload = { record_id: record.id, STAFF_CODE: key, write_token: writeToken }; }
          else { const spec = { branches: '/api/deleteBranch', modes: '/api/deleteMode', carriers: '/api/deleteCarrier' }[activeTile]; endpoint = spec; payload = activeTile === 'modes' ? { MODE: record.MODE || key } : activeTile === 'carriers' ? { COMPANY_CODE: key } : { record_id: record.id || key }; }
          await apiCall(endpoint, payload, method); setMessage('Deleted successfully.'); await onRefresh?.(); await reload(); setSelected(null); setMobileDetailVisible(false);
        } catch (error) { setMessage(error.message); } finally { setSaving(false); }
      } },
    ]);
  };

  const startRates = (client) => {
    const existing = asRecords(localData.RATES).filter(rate => rate.CODE === client.CODE);
    setSelected(client); setMobileDetailVisible(true); setRateRows(existing.length ? existing : [{ CODE: client.CODE, MODE: 'EXPRESS', WEIGHT: '0.5', ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`Z${i + 1}`, ''])) }]); setEditingRates(true); setShowForm(false); setMessage('');
  };
  const saveRates = async () => {
    if (!selected?.CODE || !rateRows.length) { setMessage('Client and at least one rate row are required.'); return; }
    setSaving(true); setMessage('');
    try {
      const writeToken = await getB2bWriteToken(selected.CODE, 'save_rates');
      await apiCall('/api/writeRateList', { CODE: selected.CODE, rates: rateRows.map(rate => ({ ...rate, CODE: selected.CODE })), write_token: writeToken }, 'POST');
      setMessage('Rate list saved successfully.'); setEditingRates(false); await onRefresh?.(); await reload();
    } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  };

  const startForm = (record = {}) => {
    const next = { ...record };
    if (activeTile === 'holidays' && next.HOLIDAY_DATE) next.HOLIDAY_DATE = new Date(Number(next.HOLIDAY_DATE)).toISOString().slice(0, 10);
    setForm(next); setShowForm(true); setMobileDetailVisible(true); setMessage('');
  };

  const searchPincode = async () => {
    const pin = query.trim();
    if (!/^\d{6}$/.test(pin)) { setMessage('Enter a 6-digit pincode.'); return; }
    setPinLoading(true); setMessage('');      try { const result = await searchPin(pin); setPinResult(result.found ? { pin, ...result } : null); if (result.found) setMobileDetailVisible(true); else setMessage('Pincode not found.'); }
    catch (error) { setMessage(error.message); }
    finally { setPinLoading(false); }
  };

  const captureLocation = async (field = 'BRANCH_GEO_TEG') => {
    if (Platform.OS === 'web') {
      setMessage('Use the browser location permission to capture GPS on web.');
      return;
    }
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission was denied.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = position.coords;
      setForm(current => ({ ...current, [field]: `${latitude.toFixed(6)},${longitude.toFixed(6)}` }));
      setMessage('GPS location captured.');
    } catch (error) {
      setMessage(error.message || 'Could not read the device location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleFormChange = async (name, value) => {
    const normalized = ['EMAIL'].includes(name) ? value : value.toUpperCase();
    setForm(current => ({ ...current, [name]: normalized }));
    const pinFields = {
      branches: { pin: 'BRANCH_PINCODE', city: 'BRANCH_CITY', state: 'BRANCH_STATE', stateCode: 'CODE_STATE', gst: 'GST_CODE' },
      staff: { pin: 'PINCODE', city: 'CITY', state: 'STATE', stateCode: 'CODE_STATE', gst: 'GST_CODE' },
      clients: { pin: 'B2B_PINCODE', city: 'B2B_CITY', state: 'B2B_STATE', stateCode: 'CODE_STATE', gst: 'GST_CODE' },
      b2b2c: { pin: 'PINCODE', city: 'CITY', state: 'STATE' },
      carriers: { pin: 'COMPANY_PINCODE', city: 'COMPANY_CITY', state: 'COMPANY_STATE' },
    }[activeTile];
    if (pinFields && name === pinFields.pin && /^\d{6}$/.test(value)) {
      try {
        const result = await searchPin(value);
        if (result?.found) {
          setForm(current => ({
            ...current,
            [pinFields.city]: result.CITY || '',
            [pinFields.state]: result.STATE_NAME || result.STATE || '',
            ...(pinFields.stateCode ? { [pinFields.stateCode]: result.STATE_CODE || '' } : {}),
            ...(pinFields.gst ? { [pinFields.gst]: result.GST_CODE || '' } : {}),
            ...(activeTile === 'b2b2c' ? { ZONE: result.ZONE || current.ZONE || '', ODA: result.ODA || current.ODA || '' } : {}),
          }));
        }
      } catch (_) {}
    }
  };

  const loadServiceLogs = async () => {
    if (!selected?.id) return;
    setServiceLogLoading(true);
    try {
      const logPath = {
        app: '/api/services/logs/app', pocketbase: '/api/services/logs/app', tracking: '/api/services/logs/tracking',
        managerio: '/api/services/logs/app', whatsapp: '/api/services/logs/wa', captcha: '/api/services/logs/hf/captcha',
        mailjet: '/api/services/logs/mail', brevo: '/api/services/logs/mail', render: '/api/services/logs/render',
        turso: '/api/services/logs/tracking',
      }[selected.id];
      if (!logPath) {
        setServiceLog({ message: 'This storage service exposes its files through the web dashboard only.' });
        return;
      }
      const result = await apiCall(logPath, {}, 'GET');
      setServiceLog(result.data || result.logs || result);
    } catch (error) {
      setServiceLog({ error: error.message });
    } finally {
      setServiceLogLoading(false);
    }
  };

  const runServiceAction = async (action) => {
    if (!selected?.id) return;
    setSaving(true); setMessage('');
    try {
      let result;
      if (action === 'worker') result = await apiCall('/api/services/tracking/triggerWorker?ignore_interval=true', {}, 'POST');
      if (action === 'restart') result = await apiCall('/api/services/render/restart', {}, 'POST');
      if (action === 'waStatus') result = await apiCall('/api/services/wa/status', {}, 'GET');
      if (action === 'waLogout') result = await apiCall('/api/services/wa/logout', {}, 'POST');
      if (action === 'managerToggle') result = await apiCall('/api/toggleManagerIO', { enabled: !selected.enabled }, 'POST');
      if (action === 'ping') result = await apiCall(`/api/services/ping/${selected.id}`, {}, 'GET');
      if (action === 'ping' || action === 'managerToggle') {
        setServiceStatuses(current => ({ ...current, [selected.id]: { ...current[selected.id], ...(result?.data || result), enabled: action === 'managerToggle' ? !selected.enabled : current[selected.id]?.enabled } }));
        setSelected(current => ({ ...current, ...(result?.data || result), enabled: action === 'managerToggle' ? !selected.enabled : current.enabled }));
      }
      setMessage(action === 'worker' ? `Worker completed: ${result?.tracked_count ?? result?.active_shipments ?? 'done'}.` : `${selected.name} action completed.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectRecord = (record) => {
    setSelected(record); setMobileDetailVisible(true); setShowForm(false); setMessage(''); setServiceLog(null);
  };

  const visibleTiles = useMemo(() => TILES.filter(item => can(role, item[3])), [role]);

  const renderTile = ({ item }) => {
    const [id, icon, label, minimum] = item;
    const allowed = can(role, minimum);
    if (!allowed) return null;
    return (
      <Tile
        label={label}
        value={countFor(id)}
        caption={`${icon}  ${minimum}+`}
        accent={id === 'services' ? ['#6366f1', '#8b5cf6'] : ['#9C2007', '#f59e0b']}
        size="md"
        onPress={() => openTile(id)}
        style={[styles.tileWrap, !isMobile && styles.tileWrapDesktop]}
      />
    );
  };

  const renderListRecord = ({ item }) => {
    const id = keyFor(activeTile, item);
    const isSelected = selected && keyFor(activeTile, selected) === id;
    if (activeTile === 'services') {
      return (
        <ListItem
          title={`${item.icon || '•'} ${item.name}`}
          subtitle={[item.desc, item.latency_ms ? `${item.status || '—'} · ${item.latency_ms}ms` : (item.status || '—')]}
          status={item.status || 'offline'}
          onPress={() => selectRecord(item)}
          style={isSelected ? styles.selectedListItem : undefined}
        />
      );
    }
    return (
      <ListItem
        title={displayValue(id)}
        subtitle={[
          displayValue(item.NAME || item.B2B_NAME || item.STAFF_NAME || item.BRANCH_NAME || item.COMPANY_NAME || item.MODE || item.EMAIL || item.CITY),
          displayValue(item.STATUS || item.ROLE || item.BRANCH || item.HOLIDAY_TYPE || item.SHORT),
        ]}
        status={item.STATUS || undefined}
        onPress={() => selectRecord(item)}
        style={isSelected ? styles.selectedListItem : undefined}
      />
    );
  };

  const renderDetails = () => {
    if (!selected) return <View style={styles.empty}><Text style={styles.emptyText}>Select an item to view details.</Text></View>;
    if (activeTile === 'registrations') return <View style={styles.detailCard}><Text style={styles.detailHeading}>{displayValue(selected.USER || selected.EMAIL)}</Text>{Object.entries(selected).filter(([key]) => !['PASS', 'RESET_TOKEN', 'id', 'created', 'updated'].includes(key)).map(([key, value]) => <View style={styles.detailPair} key={key}><Text style={styles.detailKey}>{key}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}{can(role, 'ADMIN') && <View style={styles.formActions}><TouchableOpacity style={styles.dangerButton} onPress={async () => { try { await apiCall('/api/declineRegistration', { record_id: selected.id }); setMessage('Registration declined.'); await reload(); setSelected(null); } catch (e) { setMessage(e.message); } }}><Text style={styles.dangerText}>Decline</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButton} onPress={async () => { try { const sudoToken = await getSudoToken(); const fields = { ...selected }; delete fields.id; delete fields.created; delete fields.updated; delete fields.PASS; delete fields.RESET_TOKEN; await apiCall('/api/approveRegistration', { record_id: selected.id, sudo_token: sudoToken, fields }); setMessage('Registration approved.'); await reload(); setSelected(null); } catch (e) { setMessage(e.message); } }}><Text style={styles.primaryText}>Quick approve</Text></TouchableOpacity></View>}</View>;
    if (activeTile === 'attendance' || activeTile === 'shifts') return <View style={styles.detailCard}><Text style={styles.detailHeading}>🧑‍💼 {displayValue(selected.STAFF_NAME || selected.STAFF_CODE)}</Text><Text style={styles.detailDescription}>{displayValue(selected.BRANCH)} · {activeTile === 'shifts' ? 'Shifts & leaves' : 'Today attendance'}</Text><TouchableOpacity style={styles.primaryButton} onPress={() => startForm(selected)}><Text style={styles.primaryText}>{activeTile === 'shifts' ? 'Record shift / leave' : 'Record attendance'}</Text></TouchableOpacity></View>;
    if (activeTile === 'users') return <View style={styles.detailCard}><View style={styles.detailHeader}><Text style={styles.detailHeading}>{displayValue(selected.USER)}</Text><View style={styles.headerButtons}>{can(role, 'ADMIN') && <TouchableOpacity style={styles.smallButton} onPress={() => startForm(selected)}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>}{can(role, 'MASTER') && <TouchableOpacity style={styles.dangerButton} onPress={() => deleteRecord(selected)}><Text style={styles.dangerText}>Delete</Text></TouchableOpacity>}</View></View>{Object.entries(selected).filter(([key]) => !['PASS', 'RESET_TOKEN', 'id', 'created', 'updated'].includes(key)).map(([key, value]) => <View style={styles.detailPair} key={key}><Text style={styles.detailKey}>{key}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}{can(role, 'ADMIN') && selected.USER !== user?.USER && <TouchableOpacity style={styles.secondaryButton} onPress={async () => { try { const sudoToken = await getSudoToken(); const status = selected.STATUS === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; await apiCall('/api/adminUpdateUser', { username: selected.USER, sudo_token: sudoToken, fields: { STATUS: status, CASCADED_BLOCK: false } }, 'PATCH'); setMessage(`User ${status.toLowerCase()}.`); await reload(); } catch (e) { setMessage(e.message); } }}><Text style={styles.secondaryText}>{selected.STATUS === 'ACTIVE' ? 'Deactivate user' : 'Activate user'}</Text></TouchableOpacity>}</View>;
    if (activeTile === 'clients' && editingRates) return <View style={styles.detailCard}><View style={styles.detailHeader}><Text style={styles.detailHeading}>Rates: {selected.CODE}</Text><TouchableOpacity style={styles.smallButton} onPress={() => setEditingRates(false)}><Text style={styles.smallButtonText}>Back</Text></TouchableOpacity></View>{rateRows.map((rate, index) => <View key={`${rate.UID || index}`} style={styles.rateRow}><TextInput style={[styles.input, styles.rateInput]} value={String(rate.MODE || '')} placeholder="MODE" onChangeText={value => setRateRows(rows => rows.map((row, i) => i === index ? { ...row, MODE: value } : row))} autoCapitalize="characters" /><TextInput style={[styles.input, styles.rateInput]} value={String(rate.WEIGHT || '')} placeholder="WEIGHT" onChangeText={value => setRateRows(rows => rows.map((row, i) => i === index ? { ...row, WEIGHT: value } : row))} /><TextInput style={[styles.input, styles.rateInput]} value={String(rate.Z1 || '')} placeholder="Z1" onChangeText={value => setRateRows(rows => rows.map((row, i) => i === index ? { ...row, Z1: value } : row))} keyboardType="numeric" /><TouchableOpacity style={styles.dangerSmall} onPress={() => setRateRows(rows => rows.filter((_, i) => i !== index))}><Text style={styles.dangerText}>×</Text></TouchableOpacity></View>)}<View style={styles.formActions}><TouchableOpacity style={styles.secondaryButton} onPress={() => setRateRows(rows => [...rows, { CODE: selected.CODE, MODE: 'EXPRESS', WEIGHT: '0.5', Z1: '' }])}><Text style={styles.secondaryText}>＋ Add rate</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButton} onPress={saveRates} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save all rates</Text>}</TouchableOpacity></View></View>;
    if (activeTile === 'services') return <View style={styles.detailCard}>
      <Text style={styles.detailHeading}>{selected.icon} {selected.name}</Text>
      <Text style={styles.detailDescription}>{selected.desc}</Text>
      <Text style={styles.detailRow}>Status: {displayValue(selected.status)}{selected.latency_ms != null ? ` · ${selected.latency_ms}ms` : ''}</Text>
      <View style={styles.serviceActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => runServiceAction('ping')} disabled={saving}><Text style={styles.secondaryText}>Ping</Text></TouchableOpacity>
        {selected.id === 'tracking' && <TouchableOpacity style={styles.secondaryButton} onPress={() => runServiceAction('worker')} disabled={saving}><Text style={styles.secondaryText}>⚡ Run worker</Text></TouchableOpacity>}
        {(selected.id === 'render' || selected.id === 'whatsapp') && <TouchableOpacity style={styles.secondaryButton} onPress={() => runServiceAction('restart')} disabled={saving}><Text style={styles.secondaryText}>Restart</Text></TouchableOpacity>}
        {selected.id === 'whatsapp' && <><TouchableOpacity style={styles.secondaryButton} onPress={() => runServiceAction('waStatus')} disabled={saving}><Text style={styles.secondaryText}>WA status</Text></TouchableOpacity><TouchableOpacity style={styles.dangerButton} onPress={() => runServiceAction('waLogout')} disabled={saving}><Text style={styles.dangerText}>WA logout</Text></TouchableOpacity></>}
        {selected.id === 'managerio' && <TouchableOpacity style={styles.secondaryButton} onPress={() => runServiceAction('managerToggle')} disabled={saving}><Text style={styles.secondaryText}>{selected.enabled ? 'Pause sync' : 'Enable sync'}</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondaryButton} onPress={loadServiceLogs} disabled={serviceLogLoading}><Text style={styles.secondaryText}>{serviceLogLoading ? 'Loading…' : 'View logs'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => openTile('services')}><Text style={styles.secondaryText}>Refresh statuses</Text></TouchableOpacity>
      </View>
      {serviceLog ? <ScrollView style={styles.serviceLog}><Text style={styles.serviceLogText}>{JSON.stringify(serviceLog, null, 2)}</Text></ScrollView> : null}
    </View>;
    if (activeTile === 'clients') return <View style={styles.detailCard}><View style={styles.detailHeader}><Text style={styles.detailHeading}>{displayValue(selected.B2B_NAME || selected.CODE)}</Text><View style={styles.headerButtons}>{can(role, 'ADMIN') && <TouchableOpacity style={styles.smallButton} onPress={() => startForm(selected)}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>}<TouchableOpacity style={styles.smallButton} onPress={() => startRates(selected)}><Text style={styles.smallButtonText}>Rates</Text></TouchableOpacity></View></View>{Object.entries(selected).filter(([key]) => !['id', 'created', 'updated', 'CROSSOVER'].includes(key)).map(([key, value]) => <View style={styles.detailPair} key={key}><Text style={styles.detailKey}>{key}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}{can(role, 'MANAGER') && <TouchableOpacity style={styles.dangerButton} onPress={() => deleteRecord(selected)}><Text style={styles.dangerText}>Delete</Text></TouchableOpacity>}</View>;
    return <View style={styles.detailCard}><View style={styles.detailHeader}><Text style={styles.detailHeading}>{displayValue(keyFor(activeTile, selected))}</Text>{FORM_FIELDS[activeTile] && can(role, activeTile === 'clients' || activeTile === 'branches' || activeTile === 'staff' || activeTile === 'holidays' || activeTile === 'users' ? 'ADMIN' : 'MASTER') && <TouchableOpacity style={styles.smallButton} onPress={() => startForm(selected)}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>}</View>{Object.entries(selected).filter(([key]) => !['id', 'created', 'updated'].includes(key)).map(([key, value]) => <View style={styles.detailPair} key={key}><Text style={styles.detailKey}>{key}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}{FORM_FIELDS[activeTile] && can(role, activeTile === 'users' || activeTile === 'clients' || activeTile === 'staff' || activeTile === 'holidays' ? 'ADMIN' : 'MASTER') && <TouchableOpacity style={styles.dangerButton} onPress={() => deleteRecord(selected)}><Text style={styles.dangerText}>Delete</Text></TouchableOpacity>}</View>;
  };

  const renderForm = () => <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.formHeading}>{selected ? 'Edit' : 'New'} {TILES.find(t => t[0] === activeTile)?.[2]}</Text>
      {(FORM_FIELDS[activeTile] || []).map(([name, label, keyboardType]) => {
        const isGeo = (activeTile === 'branches' && name === 'BRANCH_GEO_TEG') || (activeTile === 'attendance' && ['GEO_TAG_IN', 'GEO_TAG_OUT'].includes(name));
        const isReadOnly = (activeTile === 'branches' && ['BRANCH_CITY', 'BRANCH_STATE', 'CODE_STATE', 'GST_CODE'].includes(name))
          || (activeTile === 'staff' && ['CITY', 'STATE'].includes(name))
          || (activeTile === 'carriers' && ['COMPANY_CITY', 'COMPANY_STATE'].includes(name));
        return <View key={name} style={styles.field}>
          <Text style={styles.fieldLabel}>{label}{isReadOnly ? ' (from pincode)' : ''}</Text>
          <View style={isGeo ? styles.geoInputRow : null}>
            <TextInput
              style={[styles.input, isGeo && styles.geoInput, isReadOnly && styles.readOnlyInput]}
              value={String(form[name] ?? '')}
              onChangeText={value => handleFormChange(name, value)}
              placeholder={label}
              placeholderTextColor="#94a3b8"
              keyboardType={keyboardType}
              autoCapitalize={['EMAIL'].includes(name) ? 'none' : 'characters'}
              editable={!isReadOnly}
              returnKeyType="next"
            />
            {isGeo ? <TouchableOpacity style={styles.gpsButton} onPress={() => captureLocation(name)} disabled={locationLoading}>
              <Text style={styles.gpsText}>{locationLoading ? '…' : '📍 GPS'}</Text>
            </TouchableOpacity> : null}
          </View>
        </View>;
      })}
      <View style={styles.formActions}><TouchableOpacity style={styles.secondaryButton} onPress={() => { setShowForm(false); }}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButton} disabled={saving} onPress={saveRecord}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}</TouchableOpacity></View>
    </ScrollView>
  </KeyboardAvoidingView>;

  const renderPincode = () => <View style={styles.detailCard}><Text style={styles.detailHeading}>📍 Pincode lookup</Text><Text style={styles.detailDescription}>Read-only web parity lookup using the local network map with API fallback.</Text><View style={styles.pinSearch}><TextInput style={[styles.input, { flex: 1 }]} value={query} onChangeText={setQuery} placeholder="6-digit pincode" keyboardType="numeric" maxLength={6} onSubmitEditing={searchPincode} /><TouchableOpacity style={styles.primaryButton} onPress={searchPincode}>{pinLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Search</Text>}</TouchableOpacity></View>{pinResult && <View style={styles.pinGrid}>{[['City', pinResult.CITY], ['State', pinResult.STATE_NAME || pinResult.STATE], ['State code', pinResult.STATE_CODE], ['GST code', pinResult.GST_CODE], ['Zone', pinResult.ZONE], ['ODA', pinResult.ODA], ['Express TAT', pinResult.EXPRESS_TAT], ['Airline TAT', pinResult.AIRLINE_TAT], ['Surface TAT', pinResult.SURFACE_TAT], ['Premium TAT', pinResult.PREMIUM_TAT]].map(([key, value]) => <View style={styles.pinCell} key={key}><Text style={styles.detailKey}>{key}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}</View>}</View>;

  return <View style={styles.page}>
    <View style={styles.pageHeader}><Text style={styles.pageTitle}>{activeTile ? TILES.find(t => t[0] === activeTile)?.[2] : 'Master Panel'}</Text>{activeTile && <TouchableOpacity style={styles.backButton} onPress={() => { setActiveTile(null); setSelected(null); setMobileDetailVisible(false); setShowForm(false); setEditingRates(false); }}><Text style={styles.backText}>‹ Tiles</Text></TouchableOpacity>}</View>
    {!activeTile ? <FlatList key={`master-tiles-${isMobile ? 2 : 4}`} data={visibleTiles} renderItem={renderTile} keyExtractor={item => item[0]} numColumns={isMobile ? 2 : 4} contentContainerStyle={styles.tileGrid} columnWrapperStyle={styles.tileRow} ListHeaderComponent={<Text style={styles.subtitle}>Web-parity master data, administration and operational controls</Text>} /> : <View style={[styles.split, isMobile && styles.splitMobile]}>
      {(!isMobile || !mobileDetailVisible) ? <View style={[styles.listPane, isMobile && styles.listPaneMobile]}><View style={styles.searchRow}><TextInput style={[styles.input, { flex: 1 }]} value={query} onChangeText={setQuery} placeholder={activeTile === 'pincodes' ? '6-digit pincode' : 'Search…'} placeholderTextColor="#94a3b8" autoCapitalize="characters" onSubmitEditing={activeTile === 'pincodes' ? searchPincode : undefined} />{activeTile !== 'pincodes' && activeTile !== 'attendance' && activeTile !== 'shifts' && FORM_FIELDS[activeTile] && can(role, activeTile === 'clients' ? 'MANAGER' : (activeTile === 'modes' || activeTile === 'carriers' ? 'MASTER' : 'ADMIN')) && <TouchableOpacity style={styles.addButton} onPress={() => { setSelected(null); startForm(); }}><Text style={styles.addText}>＋</Text></TouchableOpacity>}</View>{activeTile === 'pincodes' ? <Text style={styles.hint}>Enter a 6-digit pincode, then press Enter.</Text> : <FlatList data={filteredRecords} renderItem={renderListRecord} keyExtractor={(item, index) => `${String(keyFor(activeTile, item))}-${index}`} ListEmptyComponent={<Text style={styles.hint}>{loading ? 'Loading…' : 'No records found.'}</Text>} />}</View> : null}
      {(!isMobile || mobileDetailVisible) ? <ScrollView nestedScrollEnabled={isMobile} style={[styles.detailPane, isMobile && styles.detailPaneMobile]} contentContainerStyle={styles.detailContent}>{isMobile ? <TouchableOpacity style={styles.backToListButton} onPress={() => { setMobileDetailVisible(false); setShowForm(false); setEditingRates(false); }}><Text style={styles.backText}>‹ List</Text></TouchableOpacity> : null}{message ? <Text style={styles.message}>{message}</Text> : null}{activeTile === 'pincodes' ? renderPincode() : showForm ? renderForm() : renderDetails()}</ScrollView> : null}
    </View>}

    {loading && <View style={styles.loadingBar}><ActivityIndicator color={COLORS.primary} /><Text style={styles.loadingText}>Loading master data…</Text></View>}
    <Modal visible={sudoVisible} transparent animationType="fade" onRequestClose={closeSudo}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{sudoStep === 'credentials' ? 'Confirm identity' : 'Verify admin OTP'}</Text><Text style={styles.modalHint}>{sudoStep === 'credentials' ? 'The web admin flow requires a fresh identity check before protected mutations.' : `OTP sent for ${sudoUsername}`}</Text>{sudoError ? <Text style={styles.error}>{sudoError}</Text> : null}{sudoStep === 'credentials' ? <><TextInput style={styles.input} value={sudoUsername} onChangeText={setSudoUsername} placeholder="Username" autoCapitalize="none" /><TextInput style={styles.input} value={sudoPassword} onChangeText={setSudoPassword} placeholder="Password" secureTextEntry /><TouchableOpacity style={styles.primaryButton} onPress={submitSudoCredentials} disabled={sudoBusy}>{sudoBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send OTP</Text>}</TouchableOpacity></> : <><TextInput style={styles.input} value={sudoOtp} onChangeText={setSudoOtp} placeholder="6-digit OTP" keyboardType="numeric" maxLength={6} onSubmitEditing={submitSudoOtp} /><TouchableOpacity style={styles.primaryButton} onPress={submitSudoOtp} disabled={sudoBusy}>{sudoBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}</TouchableOpacity></>}<TouchableOpacity style={styles.secondaryButton} onPress={closeSudo}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={writeOtpVisible} transparent animationType="fade" onRequestClose={closeStaffOtp}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>Verify staff write OTP</Text><Text style={styles.modalHint}>OTP sent for {writeOtpCode} ({writeOtpAction}).</Text>{writeOtpError ? <Text style={styles.error}>{writeOtpError}</Text> : null}<TextInput style={styles.input} value={writeOtp} onChangeText={setWriteOtp} placeholder="6-digit OTP" keyboardType="numeric" maxLength={6} onSubmitEditing={verifyStaffWriteOtp} /><TouchableOpacity style={styles.primaryButton} onPress={verifyStaffWriteOtp} disabled={writeOtpBusy}>{writeOtpBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}</TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={closeStaffOtp}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={b2bOtpVisible} transparent animationType="fade" onRequestClose={closeB2bOtp}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>Verify client write OTP</Text><Text style={styles.modalHint}>OTP sent for {b2bOtpCode} ({b2bOtpAction}).</Text>{b2bOtpError ? <Text style={styles.error}>{b2bOtpError}</Text> : null}<TextInput style={styles.input} value={b2bOtp} onChangeText={setB2bOtp} placeholder="6-digit OTP" keyboardType="numeric" maxLength={6} onSubmitEditing={verifyB2bOtp} /><TouchableOpacity style={styles.primaryButton} onPress={verifyB2bOtp} disabled={b2bOtpBusy}>{b2bOtpBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}</TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={closeB2bOtp}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={addUserOtpVisible} transparent animationType="fade" onRequestClose={() => setAddUserOtpVisible(false)}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>Verify add-user OTP</Text><Text style={styles.modalHint}>Enter the 6-digit OTP sent for {pendingUserPayload?.USER || 'this user'}.</Text>{addUserOtpError ? <Text style={styles.error}>{addUserOtpError}</Text> : null}<TextInput style={styles.input} value={addUserOtp} onChangeText={setAddUserOtp} placeholder="6-digit OTP" keyboardType="numeric" maxLength={6} onSubmitEditing={confirmAddUser} /><TouchableOpacity style={styles.primaryButton} onPress={confirmAddUser} disabled={addUserOtpBusy}>{addUserOtpBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirm user</Text>}</TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => setAddUserOtpVisible(false)}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  pageHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  pageTitle: { flex: 1, color: '#1e293b', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 12, marginBottom: 12, paddingHorizontal: 2 },
  backButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  backText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  tileGrid: { padding: 12, paddingBottom: 30 },
  tileRow: { gap: 10, marginBottom: 10 },
  tile: { flex: 1, minHeight: 132, maxWidth: '48%', padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 },
  tileDesktop: { maxWidth: '23.5%' },
  tileWrap: { flex: 1, maxWidth: '48%' },
  tileWrapDesktop: { maxWidth: '23.5%' },
  tileIcon: { fontSize: 27, marginBottom: 5 },
  tileCount: { color: COLORS.primary, fontSize: 23, fontWeight: '800' },
  tileLabel: { color: '#334155', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  tileRole: { color: '#94a3b8', fontSize: 8, marginTop: 4, letterSpacing: 0.5 },
  split: { flex: 1, flexDirection: 'row' },
  splitMobile: { flexDirection: 'column' },
  listPane: { width: '38%', minWidth: 145, borderRightWidth: 1, borderRightColor: '#e2e8f0', backgroundColor: '#f1f5f9', padding: 8 },
  listPaneMobile: { width: '100%', minWidth: 0, borderRightWidth: 0, padding: 10, backgroundColor: '#f1f5f9' },
  detailPane: { flex: 1, backgroundColor: '#f8fafc' },
  detailPaneMobile: { width: '100%', flex: 1, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  backToListButton: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 7, backgroundColor: '#fee2e2', marginBottom: 10 },
  detailContent: { padding: 14, paddingBottom: 36 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  input: { minHeight: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 10, color: '#1e293b', fontSize: 13, marginBottom: 8 },
  addButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 21, fontWeight: '700' },
  listCard: { padding: 10, marginBottom: 7, borderRadius: 9, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  selectedCard: { borderColor: COLORS.primary, backgroundColor: '#fff7f5' },
  selectedListItem: { borderColor: COLORS.primary, backgroundColor: '#fff7f5' },
  listTitle: { color: '#1e293b', fontSize: 13, fontWeight: '800' },
  listSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  listMeta: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 6, fontSize: 10, overflow: 'hidden' },
  good: { color: '#166534', backgroundColor: '#dcfce7' }, neutral: { color: '#64748b', backgroundColor: '#f1f5f9' },
  detailCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10, marginBottom: 10 },
  headerButtons: { flexDirection: 'row', gap: 6 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  rateInput: { flex: 1, minHeight: 38, marginBottom: 0, paddingHorizontal: 6, fontSize: 11 },
  dangerSmall: { width: 28, height: 36, borderRadius: 6, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  detailHeading: { flex: 1, color: '#1e293b', fontSize: 17, fontWeight: '800', marginBottom: 5 },
  detailDescription: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  detailPair: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f8fafc', paddingVertical: 7 },
  detailKey: { width: '42%', color: '#64748b', fontSize: 11, fontWeight: '700' },
  detailValue: { flex: 1, color: '#1e293b', fontSize: 12 },
  detailRow: { color: '#334155', fontSize: 13, marginVertical: 5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 180 },
  emptyText: { color: '#94a3b8', fontSize: 13 },
  formWrap: { flex: 1 },
  formHeading: { color: '#1e293b', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  field: { marginBottom: 7 },
  fieldLabel: { color: '#475569', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  primaryButton: { minHeight: 42, borderRadius: 8, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  smallButton: { backgroundColor: COLORS.primary, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  smallButtonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  dangerButton: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, marginTop: 14, alignItems: 'center' },
  dangerText: { color: '#b91c1c', fontSize: 12, fontWeight: '800' },
  pinSearch: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pinCell: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 8, padding: 9 },
  hint: { color: '#94a3b8', textAlign: 'center', fontSize: 12, paddingVertical: 24 },
  message: { color: '#9a3412', backgroundColor: '#ffedd5', borderRadius: 8, padding: 9, fontSize: 12, marginBottom: 10 },
  loadingBar: { position: 'absolute', bottom: 8, left: 14, right: 14, padding: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#64748b', fontSize: 11 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  serviceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  serviceLog: { maxHeight: 260, marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#0f172a' },
  serviceLogText: { color: '#dbeafe', fontSize: 10, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  geoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  geoInput: { flex: 1, marginBottom: 0 },
  gpsButton: { minHeight: 42, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#7dd3fc' },
  gpsText: { color: '#0369a1', fontSize: 11, fontWeight: '800' },
  readOnlyInput: { backgroundColor: '#f1f5f9', color: '#64748b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.55)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalTitle: { color: '#1e293b', fontSize: 18, fontWeight: '800', marginBottom: 5 },
  modalHint: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 8, borderRadius: 7, fontSize: 12, marginBottom: 8 },
});
