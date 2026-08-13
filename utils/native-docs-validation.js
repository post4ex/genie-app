const RULES = {
  reference_id: { maxLength: 50 },
  invoice_no: { maxLength: 30, pattern: /^[A-Z0-9\-/]+$/ },
  invoice_date: { date: true },
  awb_number: { minLength: 8, maxLength: 20, pattern: /^[A-Z0-9-]+$/ },
  country_dest: { minLength: 2, maxLength: 50 },
  gstin: { minLength: 15, maxLength: 15, pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
  iec: { minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
  iec_no: { minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
  iec_number: { minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
  pan: { minLength: 10, maxLength: 10, pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
  e_code: { minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
  eway_bill: { minLength: 12, maxLength: 12, pattern: /^[0-9]{12}$/ },
  shipping_bill_no: { minLength: 5, maxLength: 20, pattern: /^[A-Z0-9\-/]+$/ },
  supplier_gstin: { minLength: 15, maxLength: 15, pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
  receiver_gstin: { minLength: 15, maxLength: 15, pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
  pincode: { minLength: 6, maxLength: 6, pattern: /^\d{6}$/ },
};

export function validateDocField(field, rawValue) {
  const value = String(rawValue == null ? '' : rawValue).trim();
  const rule = RULES[field.key] || {};
  if (field.required && !value) return { valid: false, error: `${field.label} is required` };
  if (!value) return { valid: true, error: '' };
  if (rule.minLength && value.length < rule.minLength) return { valid: false, error: `${field.label} must be at least ${rule.minLength} characters` };
  if (rule.maxLength && value.length > rule.maxLength) return { valid: false, error: `${field.label} must be ${rule.maxLength} characters or less` };
  if (rule.pattern && !rule.pattern.test(value)) return { valid: false, error: `${field.label} has an invalid format` };
  if (rule.date && Number.isNaN(Date.parse(value))) return { valid: false, error: `${field.label} must be a valid date` };
  if (field.pincode && !/^\d{6}$/.test(value)) return { valid: false, error: `${field.label} must be a six-digit pincode` };
  return { valid: true, error: '' };
}

export function validateDocument(schema, values) {
  const errors = {};
  schema.fields.forEach((field) => {
    if (field.type === 'heading' || field.type?.endsWith('_table')) return;
    const result = validateDocField(field, values[field.key]);
    if (!result.valid) errors[field.key] = result.error;
  });
  return { valid: Object.keys(errors).length === 0, errors };
}
