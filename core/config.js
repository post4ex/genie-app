export const API_BASE = "https://post4ex-app.hf.space";

// Web parity (GENIE_WEB/sw.js sheetKeys + indexeddb.js): NOTIFICATIONS added so
// SSE notification events have a home; sync-layer flags tracked as meta keys.
export const SHEETS = [
  'ORDERS', 'B2B', 'B2B2C', 'RATES', 'STAFF', 'ATTENDANCE',
  'BRANCHES', 'MODES', 'CARRIERS', 'MULTIBOX', 'PRODUCTS',
  'UPLOADS', 'NOTIFICATIONS', 'HOLIDAYS', 'LEDGER', 'SHIPMENTS', 'HEADER'
];

// Per-sheet unique key fields — web sheetKeys (used for delete resolution).
export const SHEET_KEYS = {
  'ORDERS':        'REFERENCE',
  'B2B':           'CODE',
  'B2B2C':         'UID',
  'RATES':         'UID',
  'STAFF':         'STAFF_CODE',
  'ATTENDANCE':    'ATTENDANCE_ID',
  'BRANCHES':      'BRANCH_CODE',
  'MODES':         'SHORT',
  'CARRIERS':      'COMPANY_CODE',
  'MULTIBOX':      'MB_UID',
  'PRODUCTS':      'PD_UID',
  'UPLOADS':       'UPLOAD_UID',
  'NOTIFICATIONS': 'NOTIF_ID',
  'HOLIDAYS':      'HOLIDAY_ID',
  'LEDGER':        'TXN_ID',
  // Shipments are joined to ORDERS and UI lookups by REFERENCE, exactly like
  // the FastAPI KEY_FIELDS map and the web IndexedDB adapter.
  'SHIPMENTS':     'REFERENCE',
  'HEADER':        'DOX_KEY',
};

export const ROLE_LEVELS = {
  'MASTER': 100,
  'ADMIN': 90,
  'AUDITOR': 70,
  'ACCOUNTANT': 60,
  'MANAGER': 50,
  'STAFF': 10,
  'CLIENT': 1,
  'GUEST': 0
};
