// ============================================================================
// uploader-engine.js — React-safe port of jawaS/uploader.js + mini-uploader.js
// ============================================================================

export const MAX_FILES = 50;
export const UPLOAD_TYPES = ['POD', 'Reciept', 'KYC', 'Product', 'MultiBox'];
export const DEFAULT_HIDDEN_TYPES = ['KYC'];

export const KYC_OPTIONS = [
  'Aadhaar Card', 'PAN Card', 'Indian Passport', 'Voter ID Card',
  'Driving License', 'NREGA Job Card', 'Partnership Deed',
  'Certificate of Incorporation', 'GST Registration', 'MoA & AoA',
  'Board Resolution',
];

// Web kycOptionsHTML parity — the KYC type selector renders two optgroups
// (Individual / Business) in the exact same order as the web <select>.
export const KYC_OPTION_GROUPS = [
  { label: 'Individual', options: ['Aadhaar Card', 'PAN Card', 'Indian Passport', 'Voter ID Card', 'Driving License', 'NREGA Job Card'] },
  { label: 'Business', options: ['Partnership Deed', 'Certificate of Incorporation', 'GST Registration', 'MoA & AoA', 'Board Resolution'] },
];

export const BARCODE_FORMATS = ['code_128', 'code_39', 'ean_13', 'qr_code', 'upc_a', 'itf'];

// Camera constraint ladder — web uploader-camera.js parity (Chrome tries 4K
// first for max resolution, then falls back to 1920 and finally any camera).
export const CAM_CONSTRAINTS = [
  { facingMode: { exact: 'environment' }, width: { ideal: 4096 }, height: { ideal: 4096 } },
  { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
  { facingMode: { exact: 'environment' } },
  { facingMode: { ideal: 'environment' } },
];

const asList = (value) => Array.isArray(value) ? value : Object.values(value || {});
const text = (value) => String(value ?? '');

export const normalizeUploaderData = ({ orders = {}, b2b2c = {}, products = {}, uploads = {} } = {}) => {
  const ordersList = asList(orders).filter((row) => row?.REFERENCE);
  const contacts = new Map(asList(b2b2c).filter((row) => row?.UID).map((row) => [String(row.UID), row]));
  const productMap = new Map();
  asList(products).forEach((row) => {
    if (!row?.REFERENCE) return;
    const key = String(row.REFERENCE);
    if (!productMap.has(key)) productMap.set(key, []);
    productMap.get(key).push(row);
  });
  const uploadMap = new Map();
  asList(uploads).forEach((row) => {
    const key = row?.REFERENCE;
    if (!key) return;
    const ref = String(key);
    if (!uploadMap.has(ref)) uploadMap.set(ref, []);
    uploadMap.get(ref).push(row);
  });
  return { orders: ordersList, contacts, productMap, uploadMap };
};

export const filterOrders = (orders, contacts, searchTerm = '', displayDays = 90, now = Date.now()) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - displayDays);
  cutoff.setHours(0, 0, 0, 0);
  const q = text(searchTerm).toLowerCase();
  return [...orders]
    .filter((order) => {
      const rawDate = Number(order.ORDER_DATE);
      const date = rawDate ? new Date(rawDate > 1e10 ? rawDate : rawDate * 1000) : new Date(order.ORDER_DATE);
      if (!Number.isNaN(date.getTime()) && date < cutoff) return false;
      if (!q) return true;
      const cnor = contacts.get(String(order.CONSIGNOR)) || {};
      const cnee = contacts.get(String(order.CONSIGNEE)) || {};
      const formattedDate = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
      return [order.REFERENCE, order.AWB_NUMBER, cnor.NAME, cnee.NAME, order.DEST_CITY, formattedDate]
        .filter(Boolean).map(String).join('|').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const toMs = (value) => {
        const n = Number(value);
        if (n) return n > 1e10 ? n : n * 1000;
        return Date.parse(value) || 0;
      };
      return toMs(b.ORDER_DATE) - toMs(a.ORDER_DATE);
    });
};

export const getOrderParties = (order, contacts) => {
  const consignor = contacts.get(String(order?.CONSIGNOR)) || {};
  const consignee = contacts.get(String(order?.CONSIGNEE)) || {};
  return {
    consignor,
    consignee,
    consignorName: consignor.NAME || (order?.CONSIGNOR ? `UID: ${order.CONSIGNOR}` : 'N/A'),
    consigneeName: consignee.NAME || (order?.CONSIGNEE ? `UID: ${order.CONSIGNEE}` : 'N/A'),
  };
};

export const checkUploadStatus = (reference, awb, uploadMap, stagedItems = []) => {
  const status = { pod: false, reciept: false };
  const matches = (row) => String(row?.reference || row?.REFERENCE || row?.keyRef || '') === String(reference) ||
    (awb && String(row?.awbNumber || row?.AWB_NUMBER || row?.keyRef || '') === String(awb));
  [...(uploadMap.get(String(reference)) || []), ...stagedItems.filter(matches)].forEach((row) => {
    const type = row?.uploadType || row?.UPLOAD_TYPE;
    if (type === 'POD') status.pod = true;
    if (type === 'Reciept') status.reciept = true;
  });
  return status;
};

export const restrictedUploadTypes = (role, hiddenTypes = DEFAULT_HIDDEN_TYPES, enforceRole = true) => {
  const level = { GUEST: 0, CLIENT: 1, STAFF: 10, MANAGER: 50, ACCOUNTANT: 60, AUDITOR: 70, ADMIN: 90, MASTER: 100 }[role] || 0;
  const restricted = [...new Set(hiddenTypes)];
  // mini-uploader.js adds these restrictions for client-level users. The full
  // uploader.js has no role-based type hiding, so callers explicitly opt in.
  if (enforceRole && level < 10) restricted.push('Reciept', 'POD');
  return [...new Set(restricted)];
};

export const buildDynamicTasks = (order, contacts, productMap, uploadMap, currentType = null, hiddenTypes = DEFAULT_HIDDEN_TYPES, role = 'STAFF', stagedItems = [], enforceRole = true) => {
  if (!order) return [];
  const { consignorName, consigneeName } = getOrderParties(order, contacts);
  const status = checkUploadStatus(order.REFERENCE, order.AWB_NUMBER, uploadMap, stagedItems);
  const hidden = new Set(restrictedUploadTypes(role, hiddenTypes, enforceRole));
  // Web parity: an existing POD ends the task list only when POD is actually
  // available to this caller. BookOrder/other contexts may intentionally hide
  // POD, in which case the remaining visible task types must still render.
  if (status.pod && !hidden.has('POD')) {
    return [{ type: 'complete', ref: order.REFERENCE, message: 'POD already uploaded for this order. No further tasks available.' }];
  }
  const details = { ref: order.REFERENCE, awb: order.AWB_NUMBER || '' };
  const tasks = [];
  const add = (type, extra = {}) => {
    if (!hidden.has(type) && (!currentType || currentType === type)) tasks.push({ type, ...details, ...extra });
  };
  add('POD', { inputLabel: 'Status', defaultValue: 'Delivered' });
  if (!status.reciept) add('Reciept', { inputLabel: 'Status', defaultValue: 'Booked' });
  add('KYC', { customerName: consignorName, customerUid: order.CONSIGNOR || '', inputLabel: 'KYC Number', secondInput: 'KYC Type' });
  add('KYC', { customerName: consigneeName, customerUid: order.CONSIGNEE || '', inputLabel: 'KYC Number', secondInput: 'KYC Type', party: 'consignee' });
  const products = productMap.get(String(order.REFERENCE)) || [];
  if (products.length) products.forEach((product) => add('Product', {
    docNumber: product.DOC_NUMBER || '', docType: product.TYPE || '', inputLabel: 'Remark', defaultValue: 'PAPERS UPLOADED',
  }));
  else if (currentType === 'Product') tasks.push({ type: 'empty', ref: order.REFERENCE, message: 'No products found for this order.' });
  add('MultiBox', { inputLabel: 'Child AWB', defaultValue: order.AWB_NUMBER || '' });
  return tasks;
};

export const makeUploadRow = (task, fields, imageData) => {
  const value = (name, fallback = '') => text(fields?.[name] ?? fallback).trim();
  const row = {
    uploadType: task.type,
    refNumber: task.ref,
    awbNumber: task.awb,
    childAwb: '', customerName: '', customerUid: '', kycNumber: '', kycType: '',
    docNumber: '', docType: '', statusRemark: '', branch: fields?.branch || '', code: fields?.code || '',
  };
  if (task.type === 'POD' || task.type === 'Reciept') row.statusRemark = value('status', task.defaultValue);
  if (task.type === 'KYC') {
    row.customerName = task.customerName || '';
    row.customerUid = task.customerUid || '';
    row.kycNumber = value('kycNumber');
    row.kycType = value('kycType', KYC_OPTIONS[0]);
  }
  if (task.type === 'Product') {
    row.docNumber = task.docNumber || '';
    row.docType = task.docType || '';
    row.statusRemark = value('remark', task.defaultValue);
  }
  if (task.type === 'MultiBox') row.childAwb = value('childAwb', task.defaultValue || task.awb);
  return { ...row, imageData, images: [imageData], keyRef: task.ref, keyType: task.type };
};

export const validateUploadRow = (row) => {
  if (!row?.imageData && !(row?.images || []).length) return 'Capture or select an image first.';
  if (row.uploadType === 'KYC' && !text(row.kycNumber).trim()) return 'KYC Number is required.';
  return '';
};

export const bundleKey = (row) => {
  if (row.uploadType === 'KYC') return `KYC_${row.refNumber}_${row.customerUid}`;
  if (row.uploadType === 'Product') return `PROD_${row.refNumber}_${row.docNumber}`;
  if (row.uploadType === 'MultiBox') return `MULTI_${row.awbNumber}`;
  return null;
};

export const mergeStagedRow = (rows, row) => {
  const key = bundleKey(row);
  if (!key) return [...rows, row];
  const index = rows.findIndex((item) => bundleKey(item) === key);
  if (index < 0) return [...rows, row];
  const next = [...rows];
  // A newly appended asset changes the upload payload. Give the merged row a
  // fresh identity so a previously successful row is submitted again with the
  // new image instead of being skipped by the retry state map.
  next[index] = {
    ...next[index],
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    images: [...(next[index].images || []), ...(row.images || [])],
    imageData: row.imageData,
  };
  return next;
};

export const buildUploadPayload = (row, fileData, contentType) => ({
  upload_type: row.uploadType || '', content_type: contentType, data: fileData,
  reference: row.refNumber || '', awb_number: row.awbNumber || '', branch: row.branch || '', code: row.code || '',
  status_remark: row.statusRemark || '', child_awb: row.childAwb || '', customer_uid: row.customerUid || '',
  kyc_number: row.kycNumber || '', kyc_type: row.kycType || '', doc_number: row.docNumber || '', doc_type: row.docType || '',
});

export const describeStagedRow = (row) => {
  const type = row.uploadType || 'N/A';
  return {
    type,
    status: row.statusRemark || '',
    refAwb: type === 'MultiBox' ? `Ref: ${row.refNumber} · Child: ${row.childAwb}` : `Ref: ${row.refNumber} · AWB: ${row.awbNumber}`,
    customerKyc: type === 'KYC' ? `Cust: ${row.customerName} · UID: ${row.customerUid} · KYC: ${row.kycNumber} (${row.kycType})` : '',
    docInfo: type === 'Product' ? `Doc: ${row.docNumber} · Type: ${row.docType} · Remark: ${row.statusRemark}` : '',
    imageCount: (row.images || []).length || 1,
  };
};
