// ============================================================================
// upload-api.js — Upload payload/API adapter shared by React uploader screens
// ============================================================================

export function buildUploadPayload(rowData, fileData, contentType) {
  return {
    upload_type: rowData.uploadType || '',
    content_type: contentType,
    data: fileData,
    reference: rowData.refNumber || '',
    awb_number: rowData.awbNumber || '',
    branch: rowData.branch || '',
    code: rowData.code || '',
    status_remark: rowData.statusRemark || '',
    child_awb: rowData.childAwb || '',
    customer_uid: rowData.customerUid || '',
    kyc_number: rowData.kycNumber || '',
    kyc_type: rowData.kycType || '',
    doc_number: rowData.docNumber || '',
    doc_type: rowData.docType || '',
  };
}

export async function submitUpload(payload, { apiBase, token } = {}) {
  const response = await fetch(`${apiBase || ''}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status === 'error') {
    throw new Error(json.message || json.detail || `Upload failed (${response.status})`);
  }
  return json;
}
