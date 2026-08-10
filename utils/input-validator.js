// --- Global pattern validators ---
export const InputValidator = {
  mobile:      (v) => !v || /^91[0-9]{10}$/.test(v),
  email:       (v) => !v || /^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/i.test(v),
  gstin:       (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
  pan:         (v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v),
  aadhar:      (v) => !v || /^[0-9]{12}$/.test(v),
  pin:         (v) => !v || /^[0-9]{6}$/.test(v),
  ifsc:        (v) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v),
  gstCode:     (v) => !v || /^[0-9]{2}$/.test(v),
  year:        (v) => !v || /^[0-9]{4}$/.test(v),
  bigint:      (v) => v != null && /^[1-9][0-9]*$/.test(String(v)),
  positive:    (v) => v != null && parseFloat(v) > 0,
  nonNegative: (v) => v != null && parseFloat(v) >= 0,
  uppercase:   (v) => !v || v === v.toUpperCase(),

  // Kept from original
  upi:         (v) => !v || /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(v),
  bankAccount: (v) => !v || /^[0-9]{9,18}$/.test(v),
  stateCode:   (v) => !v || /^[A-Z]{2}$/.test(v),
  branchCode:  (v) => !v || /^[A-Z]{3}$/.test(v),
  age18: (dob) => {
    if (!dob) return true;
    const today = new Date(), birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 18;
  },
};

// --- Per-collection validators ---
// Returns { field: errorMessage } — empty = valid.

export const FieldValidation = {

  attendance(data) {
    const e = {};
    for (const f of ['IN_TIME', 'OUT_TIME', 'ATTEN_DATE', 'TIME_STAMP'])
      if (f in data && !InputValidator.bigint(data[f])) e[f] = `${f} must be Unix ms bigint`;
    if ('STATUS' in data && !['PRESENT','ABSENT','HALF_DAY','LEAVE'].includes(data.STATUS))
      e.STATUS = 'Invalid STATUS';
    return e;
  },

  b2b(data) {
    const e = {};
    if (!data.CODE) e.CODE = 'CODE is required';
    if ('MOBILE_NUMBER' in data && !InputValidator.mobile(data.MOBILE_NUMBER))
      e.MOBILE_NUMBER = 'MOBILE_NUMBER must be 91XXXXXXXXXX';
    if ('EMAIL'    in data && !InputValidator.email(data.EMAIL))    e.EMAIL   = 'Invalid EMAIL';
    if ('GSTIN'    in data && !InputValidator.gstin(data.GSTIN))    e.GSTIN   = 'Invalid GSTIN';
    if ('PAN'      in data && !InputValidator.pan(data.PAN))        e.PAN     = 'Invalid PAN';
    if ('AADHAAR'  in data && !InputValidator.aadhar(data.AADHAAR)) e.AADHAAR = 'AADHAAR must be 12 digits';
    if ('GST_CODE' in data && !InputValidator.gstCode(data.GST_CODE)) e.GST_CODE = 'GST_CODE must be 2 digits';
    if ('B2B_PINCODE' in data && !InputValidator.pin(data.B2B_PINCODE)) e.B2B_PINCODE = 'B2B_PINCODE must be 6 digits';
    if ('CREDIT_LIMIT' in data && !InputValidator.nonNegative(data.CREDIT_LIMIT)) e.CREDIT_LIMIT = 'CREDIT_LIMIT must be >= 0';
    if ('USED_LIMIT'   in data && !InputValidator.nonNegative(data.USED_LIMIT))   e.USED_LIMIT   = 'USED_LIMIT must be >= 0';
    if ('MAX_USERS_ALLOWED' in data && (isNaN(data.MAX_USERS_ALLOWED) || parseInt(data.MAX_USERS_ALLOWED) <= 0))
      e.MAX_USERS_ALLOWED = 'MAX_USERS_ALLOWED must be > 0';
    if ('MAX_LOGINS_PER_USER' in data && (isNaN(data.MAX_LOGINS_PER_USER) || parseInt(data.MAX_LOGINS_PER_USER) <= 0))
      e.MAX_LOGINS_PER_USER = 'MAX_LOGINS_PER_USER must be > 0';
    if ('B2B_TYPE' in data && !['CLIENT','VENDOR','SUPPLIER'].includes(data.B2B_TYPE))
      e.B2B_TYPE = 'Invalid B2B_TYPE';
    if ('SUBSCRIPTION_TYPE' in data && !['Basic','Standard','Premium','Enterprise'].includes(data.SUBSCRIPTION_TYPE))
      e.SUBSCRIPTION_TYPE = 'Invalid SUBSCRIPTION_TYPE';
    return e;
  },

  b2b2c(data) {
    const e = {};
    if (!data.UID) e.UID = 'UID is required';
    if ('MOBILE'   in data && !InputValidator.mobile(data.MOBILE))   e.MOBILE   = 'MOBILE must be 91XXXXXXXXXX';
    if ('GSTIN'    in data && !InputValidator.gstin(data.GSTIN))     e.GSTIN    = 'Invalid GSTIN';
    if ('PAN'      in data && !InputValidator.pan(data.PAN))         e.PAN      = 'Invalid PAN';
    if ('AADHAAR'  in data && !InputValidator.aadhar(data.AADHAAR))  e.AADHAAR  = 'AADHAAR must be 12 digits';
    if ('GST_CODE' in data && !InputValidator.gstCode(data.GST_CODE)) e.GST_CODE = 'GST_CODE must be 2 digits';
    if ('PINCODE'  in data && !InputValidator.pin(data.PINCODE))     e.PINCODE  = 'PINCODE must be 6 digits';
    return e;
  },

  branches(data) {
    const e = {};
    if (!data.BRANCH_CODE) e.BRANCH_CODE = 'BRANCH_CODE is required';
    if ('BRANCH_GSTIN'         in data && !InputValidator.gstin(data.BRANCH_GSTIN))          e.BRANCH_GSTIN         = 'Invalid GSTIN';
    if ('BRANCH_PAN'           in data && !InputValidator.pan(data.BRANCH_PAN))              e.BRANCH_PAN           = 'Invalid PAN';
    if ('BRANCH_IFSC'          in data && !InputValidator.ifsc(data.BRANCH_IFSC))            e.BRANCH_IFSC          = 'Invalid IFSC';
    if ('BRANCH_MOBILE'        in data && !InputValidator.mobile(data.BRANCH_MOBILE))        e.BRANCH_MOBILE        = 'BRANCH_MOBILE must be 91XXXXXXXXXX';
    if ('BRANCH_MANAGER_PHONE' in data && !InputValidator.mobile(data.BRANCH_MANAGER_PHONE)) e.BRANCH_MANAGER_PHONE = 'BRANCH_MANAGER_PHONE must be 91XXXXXXXXXX';
    if ('BRANCH_PINCODE'       in data && !InputValidator.pin(data.BRANCH_PINCODE))          e.BRANCH_PINCODE       = 'BRANCH_PINCODE must be 6 digits';
    if ('BRANCH_STATUS' in data && !['Active','Inactive','Closed'].includes(data.BRANCH_STATUS))
      e.BRANCH_STATUS = 'Invalid BRANCH_STATUS';
    return e;
  },

  carriers(data) {
    const e = {};
    if (!data.COMPANY_CODE) e.COMPANY_CODE = 'COMPANY_CODE is required';
    if ('GSTIN'          in data && !InputValidator.gstin(data.GSTIN))          e.GSTIN          = 'Invalid GSTIN';
    if ('IFSC'           in data && !InputValidator.ifsc(data.IFSC))            e.IFSC           = 'Invalid IFSC';
    if ('MOBILE'         in data && !InputValidator.mobile(data.MOBILE))        e.MOBILE         = 'MOBILE must be 91XXXXXXXXXX';
    if ('CONTACT_MOBILE' in data && !InputValidator.mobile(data.CONTACT_MOBILE)) e.CONTACT_MOBILE = 'CONTACT_MOBILE must be 91XXXXXXXXXX';
    return e;
  },

  config(data) {
    const e = {};
    if (!data.KEY) e.KEY = 'KEY is required';
    if (data.VALUE == null || data.VALUE === '') e.VALUE = 'VALUE must not be empty';
    return e;
  },

  holidays(data) {
    const e = {};
    if ('HOLIDAY_DATE' in data && !InputValidator.bigint(data.HOLIDAY_DATE))
      e.HOLIDAY_DATE = 'HOLIDAY_DATE must be Unix ms bigint';
    if ('HOLIDAY_TYPE' in data && !['Regional','National','Optional'].includes(data.HOLIDAY_TYPE))
      e.HOLIDAY_TYPE = 'Invalid HOLIDAY_TYPE';
    if ('YEAR' in data && !InputValidator.year(data.YEAR))
      e.YEAR = 'YEAR must be 4 digits';
    return e;
  },

  ledger(data) {
    const e = {};
    if (!data.ENTRY_ID) e.ENTRY_ID = 'ENTRY_ID is required';
    if ('STATUS'    in data && !data.STATUS)    e.STATUS    = 'STATUS is required';
    if ('DIRECTION' in data && !data.DIRECTION) e.DIRECTION = 'DIRECTION is required';
    for (const f of ['CREDIT','DEBIT','BALANCE','CASH_AMOUNT'])
      if (f in data && data[f] != null && !InputValidator.nonNegative(data[f])) e[f] = `${f} must be >= 0`;
    for (const f of ['ENTRY_DATE','CHEQUE_DATE','APPROVED_AT'])
      if (f in data && data[f] != null && !InputValidator.bigint(data[f])) e[f] = `${f} must be Unix ms bigint`;
    return e;
  },

  modes(data) {
    const e = {};
    if (!data.MODE)  e.MODE  = 'MODE is required';
    else if (!InputValidator.uppercase(data.MODE))  e.MODE  = 'MODE must be uppercase';
    if (!data.SHORT) e.SHORT = 'SHORT is required';
    else if (!InputValidator.uppercase(data.SHORT)) e.SHORT = 'SHORT must be uppercase';
    return e;
  },

  multibox(data) {
    const e = {};
    if (!data.MB_UID) e.MB_UID = 'MB_UID is required';
    for (const f of ['WEIGHT','VOLUME','LENGTH','BREADTH','HIGHT'])
      if (f in data && data[f] != null && !InputValidator.positive(data[f])) e[f] = `${f} must be > 0`;
    return e;
  },

  orders(data) {
    const e = {};
    if (!data.REFERENCE) e.REFERENCE = 'REFERENCE is required';
    if (!data.AWB_HASH)  e.AWB_HASH  = 'AWB_HASH is required';
    if ('PIECS' in data && data.PIECS != null && (isNaN(data.PIECS) || parseInt(data.PIECS) < 1))
      e.PIECS = 'PIECS must be >= 1';
    if ('WEIGHT' in data && data.WEIGHT != null && !InputValidator.positive(data.WEIGHT))
      e.WEIGHT = 'WEIGHT must be > 0';
    for (const f of ['ORDER_DATE','INVOICE_DATE','TRANSIT_DATE'])
      if (f in data && data[f] != null && !InputValidator.bigint(data[f])) e[f] = `${f} must be Unix ms bigint`;
    return e;
  },

  products(data) {
    const e = {};
    if (!data.PD_UID) e.PD_UID = 'PD_UID is required';
    if ('AMOUNT' in data && data.AMOUNT != null && !InputValidator.nonNegative(data.AMOUNT))
      e.AMOUNT = 'AMOUNT must be >= 0';
    return e;
  },

  rates(data) {
    const e = {};
    if (!data.UID) e.UID = 'UID is required';
    for (let i = 1; i <= 14; i++) {
      const z = `Z${i}`;
      if (z in data && data[z] != null && isNaN(parseFloat(data[z]))) e[z] = `${z} must be a float`;
    }
    return e;
  },

  registrations(data) {
    const e = {};
    if ('EMAIL'  in data && !InputValidator.email(data.EMAIL))   e.EMAIL  = 'Invalid EMAIL';
    if ('MOBILE' in data && !InputValidator.mobile(data.MOBILE)) e.MOBILE = 'MOBILE must be 91XXXXXXXXXX';
    if ('ROLE'   in data && !data.ROLE)   e.ROLE   = 'ROLE is required';
    if ('STATUS' in data && !data.STATUS) e.STATUS = 'STATUS is required';
    return e;
  },

  shipments(data) {
    const e = {};
    if (!data.REFERENCE) e.REFERENCE = 'REFERENCE is required';
    for (const f of ['ADDED_AT','LAST_UPDATED','LAST_TRACKED','ORDER_DATE','TRANSIT_DATE'])
      if (f in data && data[f] != null && !InputValidator.bigint(data[f])) e[f] = `${f} must be Unix ms bigint`;
    return e;
  },

  staff(data) {
    const e = {};
    if (!data.STAFF_CODE) e.STAFF_CODE = 'STAFF_CODE is required';
    if ('MOBILE'           in data && !InputValidator.mobile(data.MOBILE))           e.MOBILE           = 'MOBILE must be 91XXXXXXXXXX';
    if ('EMAIL'            in data && !InputValidator.email(data.EMAIL))             e.EMAIL            = 'Invalid EMAIL';
    if ('EMERGENCY_CONTACT' in data && !InputValidator.mobile(data.EMERGENCY_CONTACT)) e.EMERGENCY_CONTACT = 'EMERGENCY_CONTACT must be 91XXXXXXXXXX';
    if ('GST_CODE'         in data && !InputValidator.gstin(data.GST_CODE))          e.GST_CODE         = 'Invalid GSTIN in GST_CODE';
    if ('PAN_NUM'          in data && !InputValidator.pan(data.PAN_NUM))             e.PAN_NUM          = 'Invalid PAN';
    if ('ADHAR_NUM'        in data && !InputValidator.aadhar(data.ADHAR_NUM))        e.ADHAR_NUM        = 'ADHAR_NUM must be 12 digits';
    if ('BANK_IFSC'        in data && !InputValidator.ifsc(data.BANK_IFSC))          e.BANK_IFSC        = 'Invalid IFSC';
    if ('PINCODE'          in data && !InputValidator.pin(data.PINCODE))             e.PINCODE          = 'PINCODE must be 6 digits';
    if ('STATUS' in data && !['Active','Inactive'].includes(data.STATUS))
      e.STATUS = 'Invalid STATUS';
    if ('GENDER' in data && !['Male','Female','Other'].includes(data.GENDER))
      e.GENDER = 'Invalid GENDER';
    for (const f of ['DATE_BIRTH','DATE_JOIN','DATE_LEAVE'])
      if (f in data && data[f] != null && !InputValidator.bigint(data[f])) e[f] = `${f} must be Unix ms bigint`;
    return e;
  },

  uploads(data) {
    const e = {};
    if (!data.UPLOAD_UID)  e.UPLOAD_UID  = 'UPLOAD_UID is required';
    if (!data.UPLOAD_TYPE) e.UPLOAD_TYPE = 'UPLOAD_TYPE is required';
    return e;
  },

  users(data) {
    const e = {};
    if ('EMAIL'  in data && !InputValidator.email(data.EMAIL))   e.EMAIL  = 'Invalid EMAIL';
    if ('MOBILE' in data && !InputValidator.mobile(data.MOBILE)) e.MOBILE = 'MOBILE must be 91XXXXXXXXXX';
    if ('STATUS' in data && !['ACTIVE','INACTIVE'].includes(data.STATUS))
      e.STATUS = 'Invalid STATUS';
    return e;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InputValidator, FieldValidation };
}
if (typeof window !== 'undefined') {
  window.InputValidator = InputValidator;
  window.FieldValidation = FieldValidation;
}
