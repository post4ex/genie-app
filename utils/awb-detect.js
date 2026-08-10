// ============================================================================
// utils/awb-detect.js — AWB Carrier Detection & Product Code Utility
// ============================================================================
// PURPOSE:
//   1. detectCarrierFromAWB(awb)  — identify carrier from AWB number pattern
//   2. detectProductCode(order)   — determine AWB stock product code for an order
//
// USAGE:
//   Include this file before any page that needs AWB detection.
//   Both functions are globally available.
//
// TO ADD A NEW CARRIER PATTERN:
//   Add an entry to AWB_PATTERNS array below.
//   Rules are checked in ORDER — put more specific rules BEFORE general ones.
//   e.g. 'startsWith 152724' must come before 'startsWith 15' to avoid false match.
// ============================================================================


// ============================================================================
// SECTION 1: AWB PATTERNS
// Used by: detectCarrierFromAWB(awb)
// ============================================================================
// Each rule has:
//   carrier : string — must match CARRIER field value used in ORDERS collection
//   test    : function(awb, len) => boolean
//   note    : human readable description (remove when stable)
// ============================================================================

export const AWB_PATTERNS = [

    // --- POSTOFFICE ---
    // Format: XX 123456789 IN
    //   First 2 chars : service code (letters)
    //   Middle 9 chars: unique serial number (digits)
    //   Last 2 chars  : country code IN
    // Checked first because it is alphanumeric — won't conflict with numeric patterns
    {
        carrier: 'PostOffice',
        test: (awb) => /^[A-Z]{2}\d{9}IN$/i.test(awb),
        note: '2 letters + 9 digits + IN — India Post domestic tracking format'
    },

    // --- EXPRESSBEES ---
    // 15 digits, starts with 15
    // NOTE: Must be checked BEFORE JetLine 8-digit (starts with 15) and
    // Delhivery 13-14 digit (starts with 150) — length 15 is unique enough
    {
        carrier: 'ExpressBees',
        test: (awb, len) => len === 15 && awb.startsWith('15'),
        note: '15 digits, starts with 15'
    },

    // --- DELHIVERY ---
    // 13-14 digits, starts with 130 / 170 / 190 / 150
    // Used for single piece shipments only
    // Multiple series exist — 130903xx, 170793xx, 19040xx, 15048xx
    // We match on first 3 digits only as remaining digits are not meaningful for detection
    {
        carrier: 'Delhivery',
        test: (awb, len) => (len === 14 || len === 13) && (
            awb.startsWith('130') ||
            awb.startsWith('170') ||
            awb.startsWith('190') ||
            awb.startsWith('150')
        ),
        note: '13-14 digits, starts with 130/170/190/150 — single piece only'
    },

    // --- DELHIVERY LTL ---
    // 9 digits, starts with 28 / 29 / 30
    // Used for multi-piece / heavy freight shipments
    // Separate AWB series from regular Delhivery
    {
        carrier: 'Delhivery-LTL',
        test: (awb, len) => len === 9 && (
            awb.startsWith('28') ||
            awb.startsWith('29') ||
            awb.startsWith('30')
        ),
        note: '9 digits, starts with 28/29/30 — multi-piece LTL shipments'
    },

    // --- AIRWAYS ---
    // 11 digits, starts with 91/92/93/94/95/96/97/98 — standard series
    {
        carrier: 'Airways',
        test: (awb, len) => len === 11 && (
            awb.startsWith('91') ||
            awb.startsWith('92') ||
            awb.startsWith('93') ||
            awb.startsWith('94') ||
            awb.startsWith('95') ||
            awb.startsWith('96') ||
            awb.startsWith('97') ||
            awb.startsWith('98')
        ),
        note: '11 digits, starts with 91-98 — Airways standard series'
    },
    // 11 digits, starts with 88 — VAS series (COD/TOPAY)
    {
        carrier: 'Airways',
        test: (awb, len) => len === 11 && awb.startsWith('88'),
        note: '11 digits, starts with 88 — Airways VAS series (COD/TOPAY)'
    },

    // --- BLUEDART ---
    // 11 digits, starts with 9 / 7 / 6
    // NOTE: Trackon also uses 12-digit starting with 9 — length differentiates them
    // BlueDart is strictly 11 digits
    {
        carrier: 'BlueDart',
        test: (awb, len) => len === 11 && (
            awb.startsWith('9') ||
            awb.startsWith('7') ||
            awb.startsWith('6')
        ),
        note: '11 digits, starts with 9/7/6'
    },

    // --- TRACKON ---
    // Three separate AWB series based on use case:
    //
    // 200xxxxxxxxx (12 digits) — PREMIUM service (PRO product)
    {
        carrier: 'Trackon',
        test: (awb, len) => len === 12 && awb.startsWith('200'),
        note: '12 digits, starts with 200 — Premium (PRO)'
    },
    // 500xxxxxxxxx (12 digits) — PREPAID, weight 3kg and above (PARX product)
    {
        carrier: 'Trackon',
        test: (awb, len) => len === 12 && awb.startsWith('500'),
        note: '12 digits, starts with 500 — prepaid, 3kg and above (PARX)'
    },
    // 100xxxxxxxxx (12 digits) — PREPAID, weight below 3kg (STD product)
    {
        carrier: 'Trackon',
        test: (awb, len) => len === 12 && awb.startsWith('100'),
        note: '12 digits, starts with 100 — prepaid, below 3kg (STD)'
    },
    // 900xxxxxxxxx (12 digits) — TOPAY or COD shipments (VAS product)
    // NOTE: BlueDart also starts with 9 but is 11 digits — length differentiates
    {
        carrier: 'Trackon',
        test: (awb, len) => len === 12 && awb.startsWith('900'),
        note: '12 digits, starts with 900 — TOPAY/COD (VAS)'
    },

    // --- DAILYX (Discontinued) ---
    // No new AWBs being issued — patterns kept for historical data detection only
    // 9 digits, starts with 4102 — was used for 3kg and above
    {
        carrier: 'DAILYX',
        test: (awb, len) => len === 9 && awb.startsWith('4102'),
        note: '9 digits, starts with 4102 — DISCONTINUED, 3kg and above'
    },
    // 8 digits, starts with 155 — was used for below 3kg
    {
        carrier: 'DAILYX',
        test: (awb, len) => len === 8 && awb.startsWith('155'),
        note: '8 digits, starts with 155 — DISCONTINUED, below 3kg'
    },

    // --- JETLINE ---
    // Three AWB series:
    //
    // 9 digits, starts with 90 — weight 3kg and above (PARX product)
    // Also used for TOPAY/COD until JETLINE-VAS series is launched
    {
        carrier: 'JetLine',
        test: (awb, len) => len === 9 && awb.startsWith('90'),
        note: '9 digits, starts with 90 — 3kg and above (PARX), also used for TOPAY/COD'
    },
    // 8 digits, starts with 50 — PREMIUM service (PRO product)
    {
        carrier: 'JetLine',
        test: (awb, len) => len === 8 && awb.startsWith('50'),
        note: '8 digits, starts with 50 — Premium (PRO)'
    },
    // 8 digits, starts with 11/13/14/15 — weight below 3kg (STD product)
    // NOTE: DAILYX 155 (8 digit) is checked before this — no conflict
    {
        carrier: 'JetLine',
        test: (awb, len) => len === 8 && (
            awb.startsWith('11') ||
            awb.startsWith('13') ||
            awb.startsWith('14') ||
            awb.startsWith('15')
        ),
        note: '8 digits, starts with 11/13/14/15 — below 3kg (STD)'
    },

    // --- MARUTI ---
    // 14 digits, starts with 25
    {
        carrier: 'Maruti',
        test: (awb, len) => len === 14 && awb.startsWith('25'),
        note: '14 digits, starts with 25'
    },

    // --- POSTMAN (internal/legacy) ---
    // 10 digits, starts with 10000
    // Was used as internal AWB — now order REFERENCE is used directly
    {
        carrier: 'POSTMAN',
        test: (awb, len) => len === 10 && awb.startsWith('10000'),
        note: '10 digits, starts with 10000 — legacy internal AWB, now uses order reference'
    },

];


// ============================================================================
// detectProductFromAWB(awb)
// ============================================================================
// Detects the product suffix directly from AWB series pattern
// Returns e.g. 'JETLINE-STD', 'TRACKON-VAS', 'JETLINE-PRO' or null
// This is independent of form values — purely AWB-series based
// ============================================================================
const AWB_PRODUCT_PATTERNS = [
    { test: (a, l) => /^[A-Z]{2}\d{9}IN$/i.test(a),                          product: 'POSTOFFICE-STD'    },
    { test: (a, l) => l === 15 && a.startsWith('15'),                         product: 'EXPRESSBEES-ECOM'  },
    { test: (a, l) => (l===14||l===13) && (a.startsWith('130')||a.startsWith('170')||a.startsWith('190')||a.startsWith('150')), product: 'DELHIVERY-ECOM' },
    { test: (a, l) => l === 9  && (a.startsWith('28')||a.startsWith('29')||a.startsWith('30')), product: 'DELHIVERY-LTL' },
    { test: (a, l) => l === 11 && (a.startsWith('91')||a.startsWith('92')||a.startsWith('93')||a.startsWith('94')||a.startsWith('95')||a.startsWith('96')||a.startsWith('97')||a.startsWith('98')), product: 'AIRWAYS-STD' },
    { test: (a, l) => l === 11 && a.startsWith('88'),                         product: 'AIRWAYS-VAS'       },
    { test: (a, l) => l === 11 && (a.startsWith('9')||a.startsWith('7')||a.startsWith('6')),    product: 'BLUEDART-ECOM' },
    { test: (a, l) => l === 12 && a.startsWith('200'),                        product: 'TRACKON-PRO'       },
    { test: (a, l) => l === 12 && a.startsWith('500'),                        product: 'TRACKON-PARX'      },
    { test: (a, l) => l === 12 && a.startsWith('100'),                        product: 'TRACKON-STD'       },
    { test: (a, l) => l === 12 && a.startsWith('900'),                        product: 'TRACKON-VAS'       },
    { test: (a, l) => l === 9  && a.startsWith('4102'),                       product: 'DAILYX-PARX'       },
    { test: (a, l) => l === 8  && a.startsWith('155'),                        product: 'DAILYX-STD'        },
    { test: (a, l) => l === 9  && a.startsWith('90'),                         product: 'JETLINE-PARX'      },
    { test: (a, l) => l === 8  && a.startsWith('50'),                         product: 'JETLINE-PRO'       },
    { test: (a, l) => l === 8  && (a.startsWith('11')||a.startsWith('13')||a.startsWith('14')||a.startsWith('15')), product: 'JETLINE-STD' },
    { test: (a, l) => l === 14 && a.startsWith('25'),                         product: 'MARUTI-STD'        },
    { test: (a, l) => l === 10 && a.startsWith('10000'),                      product: 'POSTMAN-STD'       },
];

export function detectProductFromAWB(awb) {
    if (!awb) return null;
    const a = String(awb).trim();
    const l = a.length;
    for (const rule of AWB_PRODUCT_PATTERNS) {
        if (rule.test(a, l)) return rule.product;
    }
    return null;
}

export function detectCarrierFromAWB(awb) {
    if (!awb) return null;
    const a = String(awb).trim();
    const len = a.length;
    for (const rule of AWB_PATTERNS) {
        if (rule.test(a, len)) return rule.carrier;
    }
    return null;
}


// ============================================================================
// SECTION 2: PRODUCT CODE DETECTION
// Used by: detectProductCode(order)
// ============================================================================

// Mode SHORT codes (from MODES collection) that override weight/payment logic
// These are checked FIRST — mode always wins over weight and payment
const MODE_PRODUCT_SUFFIX = {
    'P': 'PRO',  // Premium         — overrides STD/PARX/VAS
    'D': 'NDO',  // Next Day Out    — overrides STD/PARX/VAS
    'F': 'NFO',  // Next Flight Out — overrides STD/PARX/VAS
    'L': 'LTL',  // Less Truck Load — overrides STD/PARX/VAS
    'T': 'FTL',  // Full Truck Load — overrides STD/PARX/VAS
    'V': 'VAC',  // Vaccine on Run  — overrides STD/PARX/VAS
    // NOTE: PRO and VAS are mutually exclusive — PRO shipment cannot be VAS
    // NOTE: When mode suffix applies, weight variation (STD/PARX) is ignored
};

// Carriers that have no weight or payment variation — always one product suffix
// These skip the VAS/weight logic entirely
const CARRIER_FIXED_SUFFIX = {
    'DELHIVERY':   'ECOM',  // single piece, no weight variation
    'BLUEDART':    'ECOM',
    'EXPRESSBEES': 'ECOM',
    'MARUTI':      'STD',
    'POSTOFFICE':  'STD',
    'POSTMAN':     'STD',
};

// Canonical carrier name map — normalises variations in CARRIER field spelling
// e.g. 'Jetline', 'JetLine', 'JETLINE' all → 'JETLINE'
const CARRIER_CANONICAL = [
    { match: 'airways',                       name: 'AIRWAYS'       },
    { match: 'airways courier',               name: 'AIRWAYS'       },
    { match: 'jetline',                       name: 'JETLINE'       },
    { match: 'delhivery-ltl',                 name: 'DELHIVERY' },  // legacy data entry — normalise to DELHIVERY, mode L adds -LTL
    { match: 'delhivery ltl',                 name: 'DELHIVERY' },  // same
    { match: 'delhivery',                     name: 'DELHIVERY'     },
    { match: 'trackon',                       name: 'TRACKON'       },
    { match: 'bluedart',                      name: 'BLUEDART'      },
    { match: 'expressbees',                   name: 'EXPRESSBEES'   },
    { match: 'xpressbees',                    name: 'EXPRESSBEES'   },
    { match: 'maruti',                        name: 'MARUTI'        },
    { match: 'postoffice',                    name: 'POSTOFFICE'    },
    { match: 'post office',                   name: 'POSTOFFICE'    },
    { match: 'postman',                       name: 'POSTMAN'       },
    { match: 'post4ex',                       name: 'POSTMAN'       },
    { match: 'dailyx',                        name: 'DAILYX'        },
];


// ============================================================================
// detectProductCode(order)
// ============================================================================
// Takes an order object, returns product code string for AWB stock lookup
//
// Priority:
//   1. Mode override  (P/D/F/L/T/V) → PRO/NDO/NFO/LTL/FTL/VAC
//   2. Fixed carrier  (Delhivery/BlueDart/ExpressBees/Maruti) → ECOM/STD
//   3. VAS            (TOPAY or COD) → VAS  [except JetLine — VAS not launched]
//   4. Weight         (below 3kg → STD, 3kg+ → PARX)
//
// Special cases:
//   - JetLine TOPAY/COD → PARX (VAS series not yet launched by carrier)
//   - Delhivery + LTL mode → returns 'DELHIVERY-LTL' (separate carrier name)
//   - Delhivery-LTL carrier → always returns 'DELHIVERY-LTL'
//
// Example outputs:
//   JetLine, 5kg, prepaid, Surface(S)  → 'JETLINE-PARX'
//   JetLine, 5kg, COD,     Surface(S)  → 'JETLINE-PARX'  (VAS not launched)
//   JetLine, 1kg, prepaid, Surface(S)  → 'JETLINE-STD'
//   Trackon, 5kg, prepaid, Surface(S)  → 'TRACKON-PARX'
//   Trackon, 5kg, TOPAY,   Surface(S)  → 'TRACKON-VAS'
//   Trackon, 1kg, prepaid, Surface(S)  → 'TRACKON-STD'
//   Delhivery, any, any,   Premium(P)  → 'DELHIVERY-PRO'
//   Delhivery, any, any,   LTL(L)      → 'DELHIVERY-LTL'
//   BlueDart,  any, any,   LTL(L)      → 'BLUEDART-LTL'
//   Trackon,   any, any,   FTL(T)      → 'TRACKON-FTL'
//   Delhivery, any, any,   Surface(S)  → 'DELHIVERY-ECOM'
// ============================================================================
export function detectProductCode(order) {
    if (!order) return null;

    const mode   = (order.MODE    || '').trim().toUpperCase();
    const weight = parseFloat(order.WEIGHT || 0);
    const isCOD  = order.COD   === 'Y' || parseFloat(order.COD)   > 0;
    const isTopay= order.TOPAY === 'Y' || order.TOPAY === 'Yes' || parseFloat(order.TOPAY_CHG) > 0;
    const isVAS  = isCOD || isTopay;

    // Normalise carrier name
    const raw = (order.CARRIER || '').trim().toLowerCase();
    let carrier = order.CARRIER.trim().toUpperCase(); // fallback
    for (const c of CARRIER_CANONICAL) {
        if (raw.includes(c.match)) { carrier = c.name; break; }
    }

    // Step 1: Mode override
    const modeSuffix = MODE_PRODUCT_SUFFIX[mode];
    if (modeSuffix) return `${carrier}-${modeSuffix}`;

    // Step 3: Fixed suffix carriers — no weight/payment variation, use same product always
    const fixedSuffix = CARRIER_FIXED_SUFFIX[carrier];
    if (fixedSuffix) return `${carrier}-${fixedSuffix}`;

    // Step 4: VAS (TOPAY/COD) — JetLine excluded until VAS series launches
    if (isVAS && carrier !== 'JETLINE') return `${carrier}-VAS`;

    // Step 5: Weight variation
    if (weight < 3) return `${carrier}-STD`;
    return `${carrier}-PARX`;
    // NOTE: If a specific product (PRO/NDO/NFO/VAS/STD) is not available in stock
    // for a carrier, the allotment logic should fall back to PARX as the default.
    // PARX is the most widely available series across all carriers.
}
