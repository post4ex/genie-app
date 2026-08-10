// ============================================================================
// UPLOAD-API.JS (core) — Upload API: payload builder + API call
// ============================================================================

function buildUploadPayload(rowData, fileData, contentType) {
    return {
        upload_type:   rowData.uploadType   || '',
        content_type:  contentType,
        data:          fileData,
        reference:     rowData.refNumber    || '',
        awb_number:    rowData.awbNumber    || '',
        branch:        rowData.branch       || '',
        code:          rowData.code         || '',
        status_remark: rowData.statusRemark || '',
        child_awb:     rowData.childAwb     || '',
        customer_uid:  rowData.customerUid  || '',
        kyc_number:    rowData.kycNumber    || '',
        kyc_type:      rowData.kycType      || '',
        doc_number:    rowData.docNumber    || '',
        doc_type:      rowData.docType      || '',
    };
}

async function submitUpload(payload) {
    return await callApi('/api/upload', payload);
}
