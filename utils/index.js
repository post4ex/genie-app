// ── Global utils barrel ────────────────────────────────────────────────────
// Import domain helpers from one place instead of reaching into individual
// files, e.g.:
//
//   import { calculateFreight, fmtDate, searchPin, InputValidator } from '../utils';
//
// Only pure-logic domain modules are re-exported here. Vendor/browser bundles
// (tesseract, jspdf, qrcode, JsBarcode, zxing, cropper, chart, pdf.min, caman)
// stay private in ./utils and are imported directly by the few consumers that
// need them.

export { parseDate, fmtDate, fromIST, toUnix } from './formatIST';

export {
  calculateFreight,
  getHelperTableData,
  calculateAllCharges,
  recalculateAllBoxWeights,
} from './calculations';

export { generateInvoiceId } from './invoice-utils';

export {
  AWB_PATTERNS,
  detectProductFromAWB,
  detectCarrierFromAWB,
  detectProductCode,
} from './awb-detect';

export {
  STATE_MAP,
  getStateInfo,
  getPincodeCount,
  searchCity,
  inferZone,
  searchPin,
} from './searchpin';

export { InputValidator, FieldValidation } from './input-validator';

export { getCountryNames, searchGlobalZip, resolveGlobalLocation } from './zipfinder';

export {
  resolveUploadUri,
  isImageUpload,
  isPdfUpload,
  downloadUploadNative,
  openUploadExternally,
  UploadViewer,
} from './upload-viewer';

export {
  setDocgenContext,
  buildSingleDocHtml,
  buildAllDocsHtml,
  docToAttachment,
  openDocInNewTab,
  downloadDocBlob,
  formatCarrierName,
  getLabelStyles,
  getReceiptStyles,
  getPackingSlipStyles,
  buildLabel,
  buildReceipt,
  buildPOD,
  buildOfficeCopy,
  buildDocs,
  buildMultibox,
  buildDocsAndBox,
} from './docgen';
