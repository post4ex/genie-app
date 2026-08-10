/**
 * docs-templates.js
 * Print view generators for all document types.
 * Contains specialized HTML templates for regulatory compliance.
 */

// ============================================================================
// SECURITY: HTML SANITIZATION
// ============================================================================
/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} str - Input string to sanitize
 * @returns {string} - Sanitized string safe for HTML insertion
 */
function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Helper to safely get and sanitize values
 */
const val = (data, key, fallback = '') => sanitizeHTML(data[key] || fallback);

/**
 * Helper to combine structured address fields into a single formatted address
 */
const formatAddress = (data, prefix) => {
    const parts = [];
    if (data[`${prefix}_name`]) parts.push(sanitizeHTML(data[`${prefix}_name`]));
    if (data[`${prefix}_address_line1`]) parts.push(sanitizeHTML(data[`${prefix}_address_line1`]));
    if (data[`${prefix}_address_line2`]) parts.push(sanitizeHTML(data[`${prefix}_address_line2`]));
    
    const cityStatePincode = [];
    if (data[`${prefix}_city`]) cityStatePincode.push(sanitizeHTML(data[`${prefix}_city`]));
    if (data[`${prefix}_state`]) cityStatePincode.push(sanitizeHTML(data[`${prefix}_state`]));
    if (data[`${prefix}_pincode`]) cityStatePincode.push(sanitizeHTML(data[`${prefix}_pincode`]));
    
    if (cityStatePincode.length > 0) {
        parts.push(cityStatePincode.join(', '));
    }
    
    if (data[`${prefix}_country`]) parts.push(sanitizeHTML(data[`${prefix}_country`]));
    
    return parts.join('<br>');
};

/**
 * Helper to get legacy address field or construct from structured fields
 */
const getAddress = (data, legacyKey, prefix) => {
    // Try legacy field first
    if (data[legacyKey]) {
        return sanitizeHTML(data[legacyKey]);
    }
    // Fall back to structured fields
    return formatAddress(data, prefix);
};

/**
 * Generates the specific Commercial Invoice print view.
 * @param {object} data
 */
function generateCommercialInvoicePrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    // Helper to format data, with fallback
    const val = (key, fallback = '____________________') => sanitizeHTML(data[key] || fallback);
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // --- Currency Conversion Logic ---
    const currency = data.currency || 'USD';
    const exRate = parseFloat(data.exchange_rate) || 1;
    
    let products = data.products || [];
    if (products.length === 0) {
        products = [{ sno: 1, marks: '-', desc: 'Sample Product', hsn: '0000', qty: 1, unit: 'PCS', rate: 0, amount: 0 }];
    }

    // Convert INR values to Target Currency
    const displayProducts = products.map(p => ({
        ...p,
        rate: (p.rate / exRate),
        amount: (p.amount / exRate)
    }));

    const totalAmount = displayProducts.reduce((sum, p) => sum + p.amount, 0);
    const toWords = (num) => `${currency} ${num.toFixed(2)} (Exchange Rate: ${exRate})`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Commercial Invoice - ${val('invoice_no')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 10px; }
            .container { max-width: 800px; margin: 0 auto; }
            
            @media print {
                body { padding: 0; }
                .no-print { display: none; }
                .invoice-box { border: 1px solid #000; }
            }

            .invoice-box { max-width: 800px; margin: auto; padding: 0; border: 1px solid #ccc; font-size: 11px; line-height: 16px; color: #000; background: white; }
            .invoice-table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
            .invoice-table td { padding: 5px; vertical-align: top; border: 1px solid #000; }
            
            .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; cursor: pointer; border: none; margin: 5px; }
            .btn:hover { background: #1d4ed8; }
            .btn-close { background: #6b7280; }
            
            .header-title { text-align: center; font-size: 18px; font-weight: bold; border-bottom: 1px solid #000; padding: 10px; }
            .bold { font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f0f0f0;">
            <button onclick="window.print()" class="btn">Print Invoice</button>
            <button onclick="window.close()" class="btn btn-close">Close</button>
        </div>

        <div class="container">
            <div class="invoice-box">
                <table class="invoice-table">
                    <tr>
                        <td colspan="4" class="header-title">COMMERCIAL INVOICE</td>
                    </tr>
                    <tr>
                        <td colspan="2" rowspan="2" width="50%">
                            <div class="bold">Exporter:</div>
                            ${getAddress(data, 'exporter_details', 'exporter')}
                        </td>
                        <td colspan="1" width="25%">
                            <div class="bold">Invoice No. & Date:</div>
                            ${val('invoice_no')} <br> ${val('invoice_date')}
                        </td>
                        <td colspan="1" width="25%">
                            <div class="bold">Exporter's Ref:</div>
                            ${val('exporter_ref')}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <div class="bold">Buyer's Order No. & Date:</div>
                            ${val('buyer_order')} ${val('buyer_date') ? '/ ' + val('buyer_date') : ''}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" rowspan="2">
                            <div class="bold">Consignee:</div>
                            ${getAddress(data, 'consignee_details', 'consignee')}
                        </td>
                        <td colspan="2">
                            <div class="bold">Other References:</div>
                            ${val('other_ref')}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <div class="bold">Buyer (if other than Consignee):</div>
                            ${val('buyer_details', 'Same as Consignee').replace(/\n/g, '<br>')}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="bold">Pre-Carriage by:</div>${val('pre_carriage')}
                        </td>
                        <td>
                            <div class="bold">Place of Receipt:</div>${val('place_receipt')}
                        </td>
                        <td colspan="2">
                            <div class="bold">Country of Origin:</div> ${val('country_origin')}<br>
                            <div class="bold">Country of Destination:</div> ${val('country_dest')}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="bold">Vessel/Flight No.:</div>${val('vessel_flight_no')}
                        </td>
                        <td>
                            <div class="bold">Port of Loading:</div>${val('port_loading')}
                        </td>
                        <td colspan="2">
                            <div class="bold">Terms of Delivery & Payment:</div>
                            ${val('terms')} / ${val('payment_terms')}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="bold">Port of Discharge:</div>${val('port_discharge')}
                        </td>
                        <td>
                            <div class="bold">Final Destination:</div>${val('final_dest')}
                        </td>
                        <td colspan="2">
                            <div class="bold">IEC Code:</div> ${val('iec')}
                        </td>
                    </tr>
                </table>

                <table class="invoice-table" style="border-top: none;">
                    <tr style="background: #eee; font-weight: bold; text-align: center;">
                        <td>Marks & No.</td>
                        <td>Description of Goods</td>
                        <td>HSN/SAC</td>
                        <td>Qty</td>
                        <td>Rate (${currency})</td>
                        <td>Amount (${currency})</td>
                    </tr>
                        ${displayProducts.map(p => `
                        <tr>
                            <td>${p.marks || '-'}</td>
                            <td>${p.desc}</td>
                            <td>${p.hsn}</td>
                            <td>${p.qty} ${p.unit}</td>
                            <td style="text-align:right;">${p.rate.toFixed(2)}</td>
                            <td style="text-align:right;">${p.amount.toFixed(2)}</td>
                        </tr>`).join('')}
                    <tr>
                        <td colspan="5" style="text-align:right; font-weight:bold;">Total</td>
                        <td style="text-align:right; font-weight:bold;">${totalAmount.toFixed(2)}</td>
                    </tr>
                </table>
                
                <div style="padding: 10px; border: 1px solid #000; border-top: none;">
                    <div class="bold">Amount Chargeable (in words):</div> ${toWords(totalAmount)}
                </div>

                <div style="display: flex; border: 1px solid #000; border-top: none;">
                    <div style="width: 50%; padding: 10px; border-right: 1px solid #000;">
                        <div class="bold">Declaration:</div>
                        ${val('declaration')}
                    </div>
                    <div style="width: 50%; padding: 10px; text-align: right; position: relative;">
                        <br><br><br>
                        <div class="bold">Signature & Date</div>
                        <span style="font-size: 10px;">(Company Stamp)</span>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generates the specific Packing List print view.
 * @param {object} data
 */
function generatePackingListPrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => data[key] || fallback;
    const packages = data.packages || [];
    
    // Calculate Summaries
    const totalNet = packages.reduce((sum, p) => sum + p.net, 0);
    const totalGross = packages.reduce((sum, p) => sum + p.gross, 0);
    const totalVol = packages.reduce((sum, p) => sum + p.vol, 0);
    const totalPkgs = packages.length;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Packing List - ${val('invoice_no')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 11px; }
            .container { max-width: 800px; margin: 0 auto; }
            @media print { .no-print { display: none; } }
            
            .company-header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1565c0; }
            .company-name { font-size: 24px; font-weight: bold; color: #1565c0; margin-bottom: 5px; }
            
            .doc-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .section-title { font-size: 12px; font-weight: bold; color: #1565c0; margin-bottom: 5px; border-bottom: 1px solid #ddd; }
            .info-row { margin-bottom: 4px; }
            .label { font-weight: bold; margin-right: 5px; }
            
            .packing-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10px; }
            .packing-table th { background: #1565c0; color: white; padding: 8px; text-align: left; }
            .packing-table td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            
            .summary-box { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .summary-row.total { font-weight: bold; border-top: 1px solid #1565c0; padding-top: 5px; margin-top: 5px; }
            
            .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-line { width: 200px; border-bottom: 1px solid #000; margin-top: 40px; }
            
            .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; cursor: pointer; border: none; margin: 5px; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>

        <div class="container">
            <div class="company-header">
                <div class="company-name">PACKING LIST</div>
                <div>Invoice No: ${val('invoice_no')} | Date: ${val('invoice_date')}</div>
            </div>
            
            <div class="doc-header">
                <div style="width: 48%;">
                    <div class="section-title">EXPORTER</div>
                    <div>${getAddress(data, 'exporter_details', 'exporter')}</div>
                </div>
                <div style="width: 48%;">
                    <div class="section-title">CONSIGNEE</div>
                    <div>${getAddress(data, 'consignee_details', 'consignee')}</div>
                </div>
            </div>

            <div class="doc-header">
                <div style="width: 48%;">
                    <div class="info-row"><span class="label">Buyer Order:</span> ${val('buyer_order')}</div>
                    <div class="info-row"><span class="label">Vessel/Flight:</span> ${val('vessel_flight')}</div>
                </div>
                <div style="width: 48%;">
                    <div class="info-row"><span class="label">Port of Loading:</span> ${val('port_loading')}</div>
                    <div class="info-row"><span class="label">Final Dest:</span> ${val('final_dest')}</div>
                </div>
            </div>
            
            <div class="section-title">PACKAGE DETAILS</div>
            <table class="packing-table">
                <thead>
                    <tr>
                        <th>Carton No</th><th>Description</th><th>Quantity</th>
                        <th class="text-right">N.W. (Kgs)</th><th class="text-right">G.W. (Kgs)</th>
                        <th class="text-center">Dims (cm)</th><th class="text-right">Vol. Wt.</th>
                    </tr>
                </thead>
                <tbody>
                    ${packages.map(p => `
                    <tr>
                        <td class="text-center">${p.carton}</td><td>${p.desc}</td><td>${p.qty}</td>
                        <td class="text-right">${p.net.toFixed(2)}</td><td class="text-right">${p.gross.toFixed(2)}</td>
                        <td class="text-center">${p.dims}</td><td class="text-right">${p.vol.toFixed(2)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            
            <div class="summary-box">
                <div class="summary-row"><span>Total Packages:</span><span>${totalPkgs}</span></div>
                <div class="summary-row"><span>Total Net Weight:</span><span>${totalNet.toFixed(2)} Kgs</span></div>
                <div class="summary-row"><span>Total Gross Weight:</span><span>${totalGross.toFixed(2)} Kgs</span></div>
                <div class="summary-row total"><span>Chargeable Weight (Max of Gross/Vol):</span><span>${Math.max(totalGross, totalVol).toFixed(2)} Kgs</span></div>
            </div>
            
            <div class="doc-header">
                <div style="width: 48%;">
                    <div class="section-title">MARKS & NUMBERS</div>
                    <div>${val('marks_numbers').replace(/\n/g, '<br>')}</div>
                </div>
                <div style="width: 48%;">
                    <div class="section-title">SPECIAL INSTRUCTIONS</div>
                    <div>${val('special_instructions').replace(/\n/g, '<br>')}</div>
                </div>
            </div>
            
            <div class="signature-section">
                <div style="text-align: center;"><div class="signature-line"></div><b>Prepared By</b></div>
                <div style="text-align: center;"><div class="signature-line"></div><b>Authorized Signatory</b></div>
            </div>
        </div>
    </body>
    </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generates the specific KYC Form print view.
 * @param {object} data 
 */
function generateKYCPrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const isChecked = (val) => data.entity_type === val ? 'checked' : '';
    
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>KYC Form - ${data.entity_name || 'Draft'}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            
            @media print {
                body { padding: 0; }
                .no-print { display: none; }
                .document-preview { box-shadow: none; border: none; margin: 0; width: 100%; }
            }

            .document-preview { background: white; padding: 40px; width: 100%; position: relative; }
            .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.05); font-weight: bold; z-index: 1; pointer-events: none; }
            .document-content { position: relative; z-index: 2; }
            .form-title { text-align: center; font-size: 20px; font-weight: bold; color: #2e7d32; margin-bottom: 30px; text-decoration: underline; }
            .form-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            .form-table td { padding: 10px; border: 1px solid #ddd; vertical-align: top; }
            .form-label { font-weight: bold; color: #2e7d32; width: 200px; }
            .checkbox-group { margin: 10px 0; }
            .checkbox-item { display: block; margin-bottom: 5px; }
            .checkbox-box { display: inline-block; width: 16px; height: 16px; border: 1px solid #000; margin-right: 5px; vertical-align: middle; }
            .checkbox-box.checked { background: #000; }
            
            .text-field { width: 100%; border: none; border-bottom: 1px dashed #999; padding: 5px 0; font-family: monospace; font-size: 12px; color: #000; }
            .textarea-field { width: 100%; border: none; border-bottom: 1px dashed #999; padding: 5px 0; font-family: monospace; font-size: 12px; color: #000; white-space: pre-wrap; }
            
            .section-title { background: #e8f5e9; padding: 10px; font-weight: bold; color: #2e7d32; margin: 20px 0 10px; border-left: 4px solid #2e7d32; }
            .declaration-box { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; margin: 30px 0; font-size: 11px; line-height: 1.6; text-align: justify; }
            
            .signature-section { margin-top: 40px; padding-top: 20px; border-top: 2px solid #2e7d32; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; }
            .signature-line { width: 100%; border-bottom: 1px solid #000; margin: 60px 0 5px; }
            .signature-label { font-size: 12px; font-weight: bold; margin-bottom: 5px; }
            .stamp-area { width: 150px; height: 80px; border: 2px dashed #999; display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px; margin-top: 10px; float: right; }
            
            .page-footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
            
            .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; cursor: pointer; border: none; margin: 5px; }
            .btn:hover { background: #1d4ed8; }
            .btn-close { background: #6b7280; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f0f0f0;">
            <button onclick="window.print()" class="btn">Print Document</button>
            <button onclick="window.close()" class="btn btn-close">Close</button>
        </div>

        <div class="container">
            <div class="document-preview">
                <div class="watermark">KYC FORM</div>
                <div class="document-content">
                    <div class="form-title"># Form KYC (Know Your Customer)</div>
                    
                    <table class="form-table">
                        <tr>
                            <td width="30" class="form-label">1.</td>
                            <td class="form-label">Category</td>
                            <td>
                                <div class="checkbox-group">
                                    <div class="checkbox-item"><span class="checkbox-box ${isChecked('Individual/Proprietary firm')}"></span> Individual/Proprietary firm</div>
                                    <div class="checkbox-item"><span class="checkbox-box ${isChecked('Company')}"></span> Company</div>
                                    <div class="checkbox-item"><span class="checkbox-box ${isChecked('Trusts/Foundations')}"></span> Trusts/Foundations</div>
                                    <div class="checkbox-item"><span class="checkbox-box ${isChecked('Partnership firm')}"></span> Partnership firm</div>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td class="form-label">2.</td>
                            <td class="form-label">Name</td>
                            <td>
                                <div class="text-field">${data.entity_name || ''}</div>
                                <div style="font-size: 10px; color: #666; margin-top: 5px;">Name of the individual including alias/ Proprietary Firm/Company/Trusts/Foundations/ Partnership firm (name of all partners)</div>
                            </td>
                        </tr>
                        <tr>
                            <td class="form-label">3.</td>
                            <td class="form-label">Permanent/Registered Address</td>
                            <td><div class="textarea-field">${getAddress(data, 'permanent_address', 'permanent')}</div></td>
                        </tr>
                        <tr>
                            <td class="form-label">4.</td>
                            <td class="form-label">Principal Business Address</td>
                            <td><div class="textarea-field">${getAddress(data, 'business_address', 'business')}</div></td>
                        </tr>
                        <tr>
                            <td class="form-label">5.</td>
                            <td class="form-label">Authorized Signatories</td>
                            <td>
                                <div class="textarea-field">${(data.auth_signatories || '').replace(/\n/g, '<br>')}</div>
                                <div style="font-size: 10px; color: #666; margin-top: 5px;">(Please provide recent passport size self attested photographs of each signatory)</div>
                            </td>
                        </tr>
                        <tr>
                            <td class="form-label">6.</td>
                            <td class="form-label">IEC No.</td>
                            <td>
                                <div class="text-field">${data.iec_no || ''}</div>
                                <div style="margin-top: 5px; font-weight: bold; font-size: 11px;">Copy Attached: [ &nbsp; ] Yes</div>
                            </td>
                        </tr>
                        <tr>
                            <td class="form-label">7.</td>
                            <td class="form-label">PAN No.</td>
                            <td>
                                <div class="text-field">${data.pan || ''}</div>
                                <div style="margin-top: 5px; font-weight: bold; font-size: 11px;">Copy Attached: [ &nbsp; ] Yes</div>
                            </td>
                        </tr>
                    </table>
                    
                    <div class="section-title">DECLARATION</div>
                    <div class="declaration-box">
                        ${(data.declaration_text || '').replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="signature-section">
                        <div class="signature-box">
                            <div class="signature-label">Place: ${data.declaration_place || ''}</div>
                            <div class="signature-label">Date: ${data.declaration_date || ''}</div>
                            <div class="signature-line"></div>
                            <div class="signature-label" style="text-align: center;">Signature</div>
                        </div>
                        <div class="signature-box" style="text-align: right;">
                            <div class="stamp-area">OFFICIAL SEAL<br>(for all other than individuals)</div>
                            <div style="clear: both; height: 20px;"></div>
                            <div class="signature-label" style="text-align: right;">Name: ${data.authorized_signatory_name || ''}</div>
                            <div class="signature-label" style="text-align: right;">Designation: ${data.authorized_signatory_designation || ''}</div>
                        </div>
                    </div>
                    
                    <div class="page-footer">
                        Page 1 of 1 | Generated: ${new Date().toLocaleString()} | KYC Form DOC-003
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// Add other print view functions here as needed...
// (Due to length constraints, I'm showing the pattern with these key functions)

/**
 * Generates the specific SDF Form print view.
 * @param {object} data 
 */
function generateSDFPrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => data[key] || fallback;
    const isSellerChecked = data.seller_consignor === 'SELLER' ? 'checked' : '';
    const isConsignorChecked = data.seller_consignor === 'CONSIGNOR' ? 'checked' : '';
    const isValueAChecked = data.value_ascertainment?.includes('A -') ? 'checked' : '';
    const isValueBChecked = data.value_ascertainment?.includes('B -') ? 'checked' : '';
    const isCautionListYes = data.rbi_caution_list === 'am/are' ? 'am/are' : 'am/are not';
    const strikeYes = data.rbi_caution_list === 'am/are' ? '' : 'strike-text';
    const strikeNo = data.rbi_caution_list === 'am/are' ? 'strike-text' : '';

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>SDF Form - ${val('shipping_bill_no')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 12px; }
            .container { max-width: 800px; margin: 0 auto; }
            @media print { .no-print { display: none; } }
            
            .document-preview { background: white; padding: 40px; border: 1px solid #ddd; position: relative; }
            .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.1); font-weight: bold; z-index: 1; }
            .document-content { position: relative; z-index: 2; }
            .form-title { text-align: center; font-size: 20px; font-weight: bold; color: #6a1b9a; margin-bottom: 30px; }
            .form-section { margin-bottom: 25px; }
            .section-title { font-weight: bold; color: #6a1b9a; margin-bottom: 10px; font-size: 14px; }
            .strike-text { text-decoration: line-through; color: #999; }
            .active-text { color: #6a1b9a; font-weight: bold; }
            .form-field { margin: 15px 0; }
            .field-label { font-weight: bold; display: block; margin-bottom: 5px; color: #555; }
            .field-input { border: none; border-bottom: 1px solid #000; padding: 2px 5px; font-family: monospace; }
            .declaration-text { margin-bottom: 15px; line-height: 1.6; }
            .checkbox-item { margin: 8px 0; }
            .checkbox-box { display: inline-block; width: 16px; height: 16px; border: 1px solid #000; margin-right: 8px; vertical-align: middle; }
            .checkbox-box.checked { background: #000; }
            .signature-section { margin-top: 60px; }
            .signature-line { width: 300px; border-bottom: 1px solid #000; margin: 40px 0 5px; }
            .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; cursor: pointer; border: none; margin: 5px; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>

        <div class="container">
            <div class="document-preview">
                <div class="watermark">SDF FORM</div>
                <div class="document-content">
                    <div class="form-title">
                        APPENDIX I<br>
                        <small>FORM SDF</small>
                    </div>
                    
                    <div class="form-field">
                        <span class="field-label">Shipping Bill No. and Date:</span>
                        <span class="field-input">${val('shipping_bill_no')} Dated: ${val('shipping_bill_date')}</span>
                    </div>
                    
                    <div class="form-section">
                        <div class="section-title">Declaration under Foreign Exchange Regulation Act, 1973:</div>
                        
                        <div class="declaration-text">
                            1. I/We hereby declare that I/We am/are the 
                            <span class="${data.seller_consignor === 'SELLER' ? 'active-text' : 'strike-text'}">*SELLER</span>/
                            <span class="${data.seller_consignor === 'CONSIGNOR' ? 'active-text' : 'strike-text'}">*CONSIGNOR</span>
                            of the goods in respect of which this declaration is made and that the particulars given in the Shipping Bill no <strong>${val('shipping_bill_no')}</strong> dated <strong>${val('shipping_bill_date')}</strong> are true and that,
                        </div>
                        
                        <div style="margin: 20px 0; padding: 10px; background: #f9f9f9; border-left: 3px solid #6a1b9a;">
                            <div class="checkbox-item">
                                <span class="checkbox-box ${isValueAChecked}"></span> 
                                <span class="${isValueAChecked ? 'active-text' : 'strike-text'}">A)* The value as contracted with the buyer is same as the full export value in the above shipping bills.</span>
                            </div>
                            <div class="checkbox-item">
                                <span class="checkbox-box ${isValueBChecked}"></span> 
                                <span class="${isValueBChecked ? 'active-text' : 'strike-text'}">B)* The full export value of the goods are not ascertainable at the time of export and that the value declared is that which I/We, having regard to the prevailing market conditions, accept to receive on the sale of goods in the overseas market.</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="declaration-text">
                            2. I/We undertake that I/We will deliver to the bank named herein 
                            <span class="field-input" style="width: 300px;">${val('bank_name')}</span>
                            the foreign exchange representing the full export value of the goods on or before 
                            <span class="field-input" style="width: 150px;">${val('repatriation_date')}</span>
                            in the manner prescribed in Rule 9 of the Foreign Exchange Regulation Rules, 1974.
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="declaration-text">
                            3. I/We further declares that I/We am/are resident in India and I/We have place of Business in India.
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="declaration-text">
                            4. I./We <span class="${strikeYes}">am/are</span> <span class="${strikeNo}">am/are not</span> in Caution list of the Reserve Bank of India.
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <div class="declaration-text">
                            <strong>Note:</strong> Strike out whichever is not applicable.
                        </div>
                    </div>
                    
                    <div class="form-field">
                        <span class="field-label">Date:</span>
                        <span class="field-input">${val('declaration_date')}</span>
                    </div>
                    
                    <div class="signature-section">
                        <div class="signature-line"></div>
                        <div style="font-weight: bold; margin-bottom: 20px;">Signature of Exporter</div>
                        
                        <div>
                            <span class="field-label">Name:</span>
                            <span class="field-input" style="width: 400px;">${val('exporter_name')}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #666; padding-top: 10px; border-top: 1px solid #ddd;">
                        Page 1 of 1 | Generated: ${new Date().toLocaleString()} | SDF Form DOC-004
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generates the Domestic Invoice print view.
 * @param {object} data 
 */
function generateDomesticInvoicePrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => sanitizeHTML(data[key] || fallback);
    const products = data.products || [];
    const totalAmount = products.reduce((sum, p) => sum + (p.amount || 0), 0);
    const cgstAmount = totalAmount * 0.09;
    const sgstAmount = totalAmount * 0.09;
    const igstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + cgstAmount + sgstAmount;    const supplierStateCode = data.supplier_gst_code || (data.supplier_gstin || '').substring(0, 2);
    const buyerStateCode = data.receiver_gst_code || (data.buyer_gstin || '').substring(0, 2);
    const isInterState = !!(supplierStateCode && buyerStateCode && supplierStateCode !== buyerStateCode);

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Tax Invoice cum Delivery Challan - ${val('invoice_no')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 11px; }
            .container { max-width: 800px; margin: 0 auto; }
            @media print { .no-print { display: none; } }
            
            .invoice-header { text-align: center; font-size: 18px; font-weight: bold; color: #3498db; margin-bottom: 20px; }
            .company-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .invoice-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .invoice-table th, .invoice-table td { padding: 8px; border: 1px solid #000; text-align: left; }
            .invoice-table th { background: #3498db; color: white; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row { font-weight: bold; background: #f0f0f0; }
            .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>

        <div class="container">
            <div class="invoice-header">TAX INVOICE CUM DELIVERY CHALLAN</div>
            
            <div class="company-details">
                <div style="display: flex; justify-content: space-between;">
                    <div style="width: 48%;">
                        <strong>From:</strong><br>
                        ${val('supplier_details').replace(/\n/g, '<br>')}
                    </div>
                    <div style="width: 48%;">
                        <strong>Invoice No:</strong> ${val('invoice_no')}<br>
                        <strong>Date:</strong> ${val('invoice_date')}<br>
                        <strong>GSTIN:</strong> ${val('supplier_gstin')}
                    </div>
                </div>
            </div>
            
            <div class="company-details">
                <strong>To:</strong><br>
                ${val('buyer_details').replace(/\n/g, '<br>')}<br>
                <strong>GSTIN:</strong> ${val('buyer_gstin')}
            </div>
            
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map((p, i) => `
                    <tr>
                        <td class="text-center">${i + 1}</td>
                        <td>${p.desc || ''}</td>
                        <td>${p.hsn || ''}</td>
                        <td class="text-center">${p.qty || 0}</td>
                        <td class="text-right">₹${(p.rate || 0).toFixed(2)}</td>
                        <td class="text-right">₹${(p.amount || 0).toFixed(2)}</td>
                    </tr>`).join('')}
                    <tr class="total-row">
                        <td colspan="5" class="text-right">Subtotal</td>
                        <td class="text-right">₹${totalAmount.toFixed(2)}</td>
                    </tr>
                    ${!isInterState
                      ? `<tr><td colspan="5" class="text-right">CGST @ 9%</td><td class="text-right">₹${cgstAmount.toFixed(2)}</td></tr>
                    <tr><td colspan="5" class="text-right">SGST @ 9%</td><td class="text-right">₹${sgstAmount.toFixed(2)}</td></tr>`
                      : `<tr><td colspan="5" class="text-right">IGST @ 18%</td><td class="text-right">₹${igstAmount.toFixed(2)}</td></tr>`}
                    <tr class="total-row">
                        <td colspan="5" class="text-right">Grand Total</td>
                        <td class="text-right">₹${grandTotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                <div>Terms & Conditions:<br>${val('terms_conditions').replace(/\n/g, '<br>')}</div>
                <div style="text-align: right;">
                    <div style="margin-top: 60px; border-top: 1px solid #000; padding-top: 5px;">Authorized Signatory</div>
                </div>
            </div>
        </div>
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generates the BL/AWB print view.
 * @param {object} data 
 */
function generateBLAWBPrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => sanitizeHTML(data[key] || fallback);
    const docType = data.document_type === 'awb' ? 'AIR WAYBILL' : 'BILL OF LADING';

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${docType} - ${val('bl_awb_number')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 11px; }
            .container { max-width: 800px; margin: 0 auto; }
            @media print { .no-print { display: none; } }
            
            .doc-header { text-align: center; font-size: 20px; font-weight: bold; color: #e74c3c; margin-bottom: 20px; border-bottom: 2px solid #e74c3c; padding-bottom: 10px; }
            .info-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .info-table td { padding: 8px; border: 1px solid #000; vertical-align: top; }
            .label { font-weight: bold; background: #f8f9fa; width: 30%; }
            .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; text-align: center; }
            .signature-line { border-bottom: 1px solid #000; margin: 40px 0 5px; }
            .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>

        <div class="container">
            <div class="doc-header">${docType}</div>
            
            <table class="info-table">
                <tr>
                    <td class="label">Document Number</td>
                    <td>${val('bl_awb_number')}</td>
                    <td class="label">Issue Date</td>
                    <td>${val('issue_date')}</td>
                </tr>
                <tr>
                    <td class="label">Carrier/Airline</td>
                    <td colspan="3">${val('carrier_name')}</td>
                </tr>
                <tr>
                    <td class="label">Shipper</td>
                    <td colspan="3">${val('shipper_details').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Consignee</td>
                    <td colspan="3">${val('consignee_details').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Port of Loading</td>
                    <td>${val('port_loading')}</td>
                    <td class="label">Port of Discharge</td>
                    <td>${val('port_discharge')}</td>
                </tr>
                <tr>
                    <td class="label">Vessel/Flight</td>
                    <td>${val('vessel_flight')}</td>
                    <td class="label">Voyage Date</td>
                    <td>${val('voyage_date')}</td>
                </tr>
                <tr>
                    <td class="label">Description of Goods</td>
                    <td colspan="3">${val('goods_description').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Gross Weight</td>
                    <td>${val('gross_weight')} KGS</td>
                    <td class="label">Volume</td>
                    <td>${val('volume')} CBM</td>
                </tr>
                <tr>
                    <td class="label">Freight Terms</td>
                    <td>${val('freight_terms')}</td>
                    <td class="label">On Board Date</td>
                    <td>${val('onboard_date')}</td>
                </tr>
            </table>
            
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <strong>For Carrier</strong><br>
                    Authorized Signature & Stamp
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <strong>Shipper's Declaration</strong><br>
                    Shipper's Signature & Date
                </div>
            </div>
        </div>
    </body>
    </html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generates the Insurance Certificate print view.
 * @param {object} data 
 */
function generateInsuranceCertPrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => sanitizeHTML(data[key] || fallback);

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Insurance Certificate - ${val('certificate_number')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 11px; }
            .container { max-width: 800px; margin: 0 auto; }
            @media print { .no-print { display: none; } }
            
            .cert-header { text-align: center; font-size: 20px; font-weight: bold; color: #2ecc71; margin-bottom: 20px; border-bottom: 2px solid #2ecc71; padding-bottom: 10px; }
            .cert-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .cert-table td { padding: 10px; border: 1px solid #000; vertical-align: top; }
            .label { font-weight: bold; background: #e8f5e9; width: 30%; }
            .summary-box { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; text-align: center; }
            .signature-line { border-bottom: 1px solid #000; margin: 40px 0 5px; }
            .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>

        <div class="container">
            <div class="cert-header">INSURANCE CERTIFICATE</div>
            
            <div class="summary-box">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span><strong>Policy Number:</strong> ${val('certificate_number')}</span>
                    <span><strong>Insured Value:</strong> ${val('currency')} ${val('sum_insured')}</span>
                </div>
                <div><strong>Voyage:</strong> ${val('voyage_details')}</div>
            </div>
            
            <table class="cert-table">
                <tr>
                    <td class="label">Certificate Number</td>
                    <td>${val('certificate_number')}</td>
                    <td class="label">Issue Date</td>
                    <td>${val('issue_date')}</td>
                </tr>
                <tr>
                    <td class="label">Insurer/Underwriter</td>
                    <td colspan="3">${val('insurer_name')}<br>${val('insurer_address')}</td>
                </tr>
                <tr>
                    <td class="label">Insured Party</td>
                    <td colspan="3">${val('insured_party').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Sum Insured</td>
                    <td>${val('currency')} ${val('sum_insured')}</td>
                    <td class="label">Risks Covered</td>
                    <td>${val('risks_covered')}</td>
                </tr>
                <tr>
                    <td class="label">Description of Goods</td>
                    <td colspan="3">${val('goods_description').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Voyage Details</td>
                    <td colspan="3">${val('voyage_details').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Claims Payable At</td>
                    <td>${val('claims_payable')}</td>
                    <td class="label">Deductible</td>
                    <td>${val('deductible')}</td>
                </tr>
                <tr>
                    <td class="label">Linked Documents</td>
                    <td colspan="3">Invoice: ${val('invoice_number')} | BL/AWB: ${val('bl_awb_number')}</td>
                </tr>
            </table>
            
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <strong>For the Insurer</strong><br>
                    Authorized Signature & Company Stamp
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <strong>Date of Issue</strong><br>
                    ${val('issue_date')}
                </div>
            </div>
        </div>
    </body>
    </html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generates the ARE-1 Form print view.
 * @param {object} data 
 */
function generateARE1PrintView(data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => sanitizeHTML(data[key] || fallback);
    const goods = data.goods || [];
    const totalValue = goods.reduce((sum, g) => sum + (g.assessable_value || 0), 0);

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>ARE-1 Form - ${val('are1_number')}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #fff; padding: 20px; font-size: 11px; }
            .container { max-width: 800px; margin: 0 auto; }
            @media print { .no-print { display: none; } }
            
            .form-header { text-align: center; font-size: 20px; font-weight: bold; color: #9b59b6; margin-bottom: 20px; border-bottom: 2px solid #9b59b6; padding-bottom: 10px; }
            .form-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .form-table td { padding: 8px; border: 1px solid #000; vertical-align: top; }
            .label { font-weight: bold; background: #f3e5f5; width: 30%; }
            .goods-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10px; }
            .goods-table th { background: #9b59b6; color: white; padding: 8px; text-align: left; }
            .goods-table td { padding: 6px; border: 1px solid #ddd; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; }
            .signature-line { border-bottom: 1px solid #000; margin: 40px 0 5px; }
            .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>

        <div class="container">
            <div class="form-header">ARE-1 FORM<br><small>Application for Removal of Excisable Goods for Export</small></div>
            
            <table class="form-table">
                <tr>
                    <td class="label">ARE-1 Serial Number</td>
                    <td>${val('are1_number')}</td>
                    <td class="label">Date of Application</td>
                    <td>${val('application_date')}</td>
                </tr>
                <tr>
                    <td class="label">Exporter Name</td>
                    <td colspan="3">${val('exporter_name')}</td>
                </tr>
                <tr>
                    <td class="label">Exporter Address</td>
                    <td colspan="3">${val('exporter_address').replace(/\n/g, '<br>')}</td>
                </tr>
                <tr>
                    <td class="label">Exporter GSTIN</td>
                    <td>${val('exporter_gstin')}</td>
                    <td class="label">IE Code</td>
                    <td>${val('exporter_iecode')}</td>
                </tr>
                <tr>
                    <td class="label">Manufacturer</td>
                    <td>${val('manufacturer_name')}</td>
                    <td class="label">Manufacturer GSTIN</td>
                    <td>${val('manufacturer_gstin')}</td>
                </tr>
                <tr>
                    <td class="label">Overseas Consignee</td>
                    <td colspan="3">${val('consignee_details').replace(/\n/g, '<br>')}</td>
                </tr>
            </table>
            
            <div style="font-weight: bold; color: #9b59b6; margin: 20px 0 10px; font-size: 14px;">GOODS DETAILS</div>
            <table class="goods-table">
                <thead>
                    <tr>
                        <th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th><th>USD Value</th><th>Assessable Value (INR)</th>
                    </tr>
                </thead>
                <tbody>
                    ${goods.map((g, i) => `
                    <tr>
                        <td class="text-center">${i + 1}</td>
                        <td>${g.description || ''}</td>
                        <td>${g.hsn || ''}</td>
                        <td class="text-center">${g.quantity || 0}</td>
                        <td>${g.unit || ''}</td>
                        <td class="text-right">${(g.usd_value || 0).toFixed(2)}</td>
                        <td class="text-right">${(g.assessable_value || 0).toLocaleString('en-IN')}</td>
                    </tr>`).join('')}
                    <tr style="font-weight: bold; background: #f0f0f0;">
                        <td colspan="6" class="text-right">Total Assessable Value (INR)</td>
                        <td class="text-right">${totalValue.toLocaleString('en-IN')}</td>
                    </tr>
                </tbody>
            </table>
            
            <table class="form-table">
                <tr>
                    <td class="label">Destination Port/ICD</td>
                    <td>${val('destination_port')}</td>
                    <td class="label">Removal Date & Time</td>
                    <td>${val('removal_date')}</td>
                </tr>
                <tr>
                    <td class="label">Transporter</td>
                    <td>${val('transporter_name')}</td>
                    <td class="label">Vehicle Number</td>
                    <td>${val('vehicle_number')}</td>
                </tr>
                <tr>
                    <td class="label">Central Tax Rate</td>
                    <td>${val('central_tax_rate')}%</td>
                    <td class="label">Central Tax Amount</td>
                    <td>₹${val('central_tax_amount')}</td>
                </tr>
                <tr>
                    <td class="label">State Tax Rate</td>
                    <td>${val('state_tax_rate')}%</td>
                    <td class="label">State Tax Amount</td>
                    <td>₹${val('state_tax_amount')}</td>
                </tr>
                <tr>
                    <td class="label">Bond Details</td>
                    <td colspan="3">${val('bond_details')}</td>
                </tr>
            </table>
            
            <div class="signature-section">
                <div class="signature-box">
                    <strong>Central Tax Officer at Origin</strong>
                    <div class="signature-line"></div>
                    <div>Name: ${val('origin_officer_name')}</div>
                    <div>Date: ${val('verification_date')}</div>
                </div>
                <div class="signature-box">
                    <strong>Customs Officer at Destination</strong>
                    <div class="signature-line"></div>
                    <div>Name: ${val('destination_officer_name')}</div>
                    <div>Export Date: ${val('export_date')}</div>
                </div>
            </div>
        </div>
    </body>
    </html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

// Add placeholder functions for all other print views
function generateAnnexure1PrintView(data) { generateGenericPrintView('ANN_1', data); }
function generateSLIPrintView(data) { generateGenericPrintView('SLI', data); }
function generateAnnexure2PrintView(data) { generateGenericPrintView('ANN_2', data); }
function generateAppendix3PrintView(data) { generateGenericPrintView('APP_3', data); }
function generateAppendix4PrintView(data) { generateGenericPrintView('APP_4', data); }
function generateAppendix2PrintView(data) { generateGenericPrintView('APP_2', data); }
function generateAnnexureC1PrintView(data) { generateGenericPrintView('ANN_C1', data); }
function generateSingleCountryDeclarationPrintView(data) { generateGenericPrintView('SCD', data); }
function generateMultipleCountryDeclarationPrintView(data) { generateGenericPrintView('MCD', data); }
function generateNegativeDeclarationPrintView(data) { generateGenericPrintView('NEG_DEC', data); }
function generateQuotaChargeStatementPrintView(data) { generateGenericPrintView('QUOTA', data); }
function generateNonDGPrintView(data) { generateGenericPrintView('NON_DG', data); }
function generateTSCAPrintView(data) { generateGenericPrintView('TSCA', data); }
function generateGRSamplePrintView(data) { generateGenericPrintView('GR_SAMPLE', data); }
function generateGRRepairPrintView(data) { generateGenericPrintView('GR_REPAIR', data); }
function generateMSDSPrintView(data) { generateGenericPrintView('MSDS', data); }
/**
 * Generates the Tax Invoice cum Delivery Challan print view with design selection.
 * @param {object} data
 * @param {number} designId - Design variant (1-10)
 */
function generateTaxChallanPrintView(data, designId = 1) {
    // Check if designId is passed in data object
    if (data.designId) {
        designId = parseInt(data.designId) || 1;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => sanitizeHTML(data[key] || fallback);
    const products = data.products || [];
    const subtotal = products.reduce((sum, p) => sum + (p.amount || 0), 0);
    const cgstRate = 9; // 9% CGST
    const sgstRate = 9; // 9% SGST
    const cgstAmount = subtotal * (cgstRate / 100);
    const sgstAmount = subtotal * (sgstRate / 100);
    const igstAmount = subtotal * 0.18;
    const grandTotal = subtotal + cgstAmount + sgstAmount;
    const supplierStateCode = data.supplier_gst_code || (data.supplier_gstin || '').substring(0, 2);
    const receiverStateCode = data.receiver_gst_code || (data.receiver_gstin || '').substring(0, 2);
    const isInterState = !!(supplierStateCode && receiverStateCode && supplierStateCode !== receiverStateCode);

    const designs = {
        1: generateTaxChallanDesign1(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        2: generateTaxChallanDesign2(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        3: generateTaxChallanDesign3(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        4: generateTaxChallanDesign4(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        5: generateTaxChallanDesign5(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        6: generateTaxChallanDesign6(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        7: generateTaxChallanDesign7(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        8: generateTaxChallanDesign8(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        9: generateTaxChallanDesign9(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState),
        10: generateTaxChallanDesign10(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState)
    };

    const html = designs[designId] || designs[1];
    printWindow.document.write(html);
    printWindow.document.close();
}
function generateLOAPrintView(data) { generateGenericPrintView('LOA', data); }
function generateCOOPrintView(data) { generateGenericPrintView('COO', data); }
function generateAnnexureDPrintView(data) { generateGenericPrintView('ANN_D', data); }
/**
 * Generates the Delivery Challan & Packaging List print view with design selection.
 * @param {object} data
 * @param {number} designId - Design variant (1-10)
 */
function generateDeliveryChallanPrintView(data, designId = 1) {
    // Check if designId is passed in data object
    if (data.designId) {
        designId = parseInt(data.designId) || 1;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const val = (key, fallback = '') => sanitizeHTML(data[key] || fallback);
    const products = data.products || [];
    const packages = data.packages || [];
    const totalNet = packages.reduce((sum, p) => sum + (p.net || 0), 0);
    const totalGross = packages.reduce((sum, p) => sum + (p.gross || 0), 0);
    const totalVol = packages.reduce((sum, p) => sum + (p.vol || 0), 0);

    const designs = {
        1: generateDeliveryChallanDesign1(data, val, products, packages, totalNet, totalGross, totalVol),
        2: generateDeliveryChallanDesign2(data, val, products, packages, totalNet, totalGross, totalVol),
        3: generateDeliveryChallanDesign3(data, val, products, packages, totalNet, totalGross, totalVol),
        4: generateDeliveryChallanDesign4(data, val, products, packages, totalNet, totalGross, totalVol),
        5: generateDeliveryChallanDesign5(data, val, products, packages, totalNet, totalGross, totalVol),
        6: generateDeliveryChallanDesign6(data, val, products, packages, totalNet, totalGross, totalVol),
        7: generateDeliveryChallanDesign7(data, val, products, packages, totalNet, totalGross, totalVol),
        8: generateDeliveryChallanDesign8(data, val, products, packages, totalNet, totalGross, totalVol),
        9: generateDeliveryChallanDesign9(data, val, products, packages, totalNet, totalGross, totalVol),
        10: generateDeliveryChallanDesign10(data, val, products, packages, totalNet, totalGross, totalVol)
    };

    const html = designs[designId] || designs[1];
    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Generic print view fallback for documents without specialized templates
 */
function generateGenericPrintView(docId, data) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${docId} - Generic View</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .data-table { width: 100%; border-collapse: collapse; }
            .data-table td { padding: 8px; border: 1px solid #ddd; }
            .label { font-weight: bold; background: #f5f5f5; width: 30%; }
            .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; }
        </style>
    </head>
    <body>
        <div style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>
        <div class="header">
            <h1>${docId} Document</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        <table class="data-table">
            ${Object.entries(data).map(([key, value]) => `
                <tr>
                    <td class="label">${key}</td>
                    <td>${value || '-'}</td>
                </tr>
            `).join('')}
        </table>
    </body>
    </html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

// ============================================================================
// TAX CHALLAN DESIGN VARIANTS (10 Different Styles)
// ============================================================================

function generateTaxChallanDesign1(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { padding: 20px; font-size: 11px; }
        .header { text-align: center; font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 20px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .info-table td { padding: 8px; border: 1px solid #000; }
        .label { font-weight: bold; background: #f0f8ff; width: 30%; }
        .product-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .product-table th { background: #2563eb; color: white; padding: 8px; text-align: left; }
        .product-table td { padding: 6px; border: 1px solid #ddd; }
        .text-right { text-align: right; }
        .total-row { font-weight: bold; background: #f0f8ff; }
        .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>
        <div class="header">TAX INVOICE CUM DELIVERY CHALLAN</div>
        <table class="info-table">
            <tr><td class="label">Challan No:</td><td>${val('challan_no')}</td><td class="label">Date:</td><td>${val('challan_date')}</td></tr>
            <tr><td class="label">From:</td><td colspan="3">${val('supplier_name')}<br>${val('supplier_address')}<br>GSTIN: ${val('supplier_gstin')}</td></tr>
            <tr><td class="label">To:</td><td colspan="3">${val('receiver_name')}<br>${val('receiver_address')}<br>GSTIN: ${val('receiver_gstin')}</td></tr>
            <tr><td class="label">Vehicle:</td><td>${val('vehicle_no')}</td><td class="label">E-Way Bill:</td><td>${val('eway_bill')}</td></tr>
        </table>
        <table class="product-table">
            <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
                ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td class="text-right">₹${(p.rate || 0).toFixed(2)}</td><td class="text-right">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                <tr class="total-row"><td colspan="5" class="text-right">Subtotal</td><td class="text-right">₹${subtotal.toFixed(2)}</td></tr>
                ${!isInterState
                  ? `<tr><td colspan="5" class="text-right">CGST @ 9%</td><td class="text-right">₹${cgstAmount.toFixed(2)}</td></tr>
                <tr><td colspan="5" class="text-right">SGST @ 9%</td><td class="text-right">₹${sgstAmount.toFixed(2)}</td></tr>`
                  : `<tr><td colspan="5" class="text-right">IGST @ 18%</td><td class="text-right">₹${igstAmount.toFixed(2)}</td></tr>`}
                <tr class="total-row"><td colspan="5" class="text-right">Grand Total</td><td class="text-right">₹${grandTotal.toFixed(2)}</td></tr>
            </tbody>
        </table>
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div>Terms: ${val('terms_conditions')}</div>
            <div style="text-align: right;"><div style="margin-top: 60px; border-top: 1px solid #000; padding-top: 5px;">Authorized Signatory</div></div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign2(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Times New Roman', serif; }
        body { padding: 20px; font-size: 12px; background: #fafafa; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #667eea; background: #f8f9ff; }
        .section-title { font-weight: bold; color: #667eea; margin-bottom: 10px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .product-table { width: 100%; border-collapse: collapse; margin: 20px 0; border-radius: 8px; overflow: hidden; }
        .product-table th { background: #667eea; color: white; padding: 12px; text-align: left; }
        .product-table td { padding: 10px; border-bottom: 1px solid #eee; }
        .product-table tr:nth-child(even) { background: #f8f9ff; }
        .total-section { background: #667eea; color: white; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .btn { background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } body { background: white; } .container { box-shadow: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print Invoice</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>
        <div class="container">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <p>Invoice No: ${val('challan_no')} | Date: ${val('challan_date')}</p>
            </div>
            <div class="grid">
                <div class="section">
                    <div class="section-title">SUPPLIER DETAILS</div>
                    <div><strong>${val('supplier_name')}</strong></div>
                    <div>${val('supplier_address')}</div>
                    <div><strong>GSTIN:</strong> ${val('supplier_gstin')}</div>
                </div>
                <div class="section">
                    <div class="section-title">RECEIVER DETAILS</div>
                    <div><strong>${val('receiver_name')}</strong></div>
                    <div>${val('receiver_address')}</div>
                    <div><strong>GSTIN:</strong> ${val('receiver_gstin')}</div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">TRANSPORT DETAILS</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <div><strong>Vehicle:</strong> ${val('vehicle_no')}</div>
                    <div><strong>E-Way Bill:</strong> ${val('eway_bill')}</div>
                    <div><strong>LR No:</strong> ${val('lr_no')}</div>
                </div>
            </div>
            <table class="product-table">
                <thead><tr><th>S.No</th><th>Description of Goods</th><th>HSN Code</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                <tbody>
                    ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td style="text-align:right;">${(p.rate || 0).toFixed(2)}</td><td style="text-align:right;">${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="total-section">
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center;">
                    <div>
                        <div><strong>Subtotal:</strong> ₹${subtotal.toFixed(2)}</div>
                        ${!isInterState
                          ? `<div><strong>CGST @ 9%:</strong> ₹${cgstAmount.toFixed(2)}</div>
                        <div><strong>SGST @ 9%:</strong> ₹${sgstAmount.toFixed(2)}</div>`
                          : `<div><strong>IGST @ 18%:</strong> ₹${igstAmount.toFixed(2)}</div>`}
                    </div>
                    <div style="font-size: 18px; font-weight: bold;">
                        <div>Grand Total: ₹${grandTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 40px; text-align: right;">
                <div style="display: inline-block; text-align: center;">
                    <div style="width: 200px; height: 60px; border-bottom: 1px solid #000; margin-bottom: 5px;"></div>
                    <div><strong>Authorized Signatory</strong></div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign3(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Courier New', monospace; }
        body { padding: 15px; font-size: 10px; background: #f5f5f5; }
        .invoice { background: white; border: 2px solid #000; }
        .header { background: #000; color: white; text-align: center; padding: 15px; }
        .header h1 { font-size: 16px; letter-spacing: 2px; }
        .content { padding: 20px; }
        .row { display: flex; margin: 10px 0; }
        .col { flex: 1; padding: 5px; border: 1px solid #000; }
        .col-label { background: #000; color: white; font-weight: bold; }
        .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .table th, .table td { border: 1px solid #000; padding: 8px; text-align: left; }
        .table th { background: #000; color: white; }
        .table .total { background: #000; color: white; font-weight: bold; }
        .signature { margin-top: 30px; text-align: right; }
        .btn { background: #000; color: white; padding: 10px 20px; border: none; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">PRINT</button>
            <button onclick="window.close()" class="btn">CLOSE</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <div>CHALLAN NO: ${val('challan_no')} | DATE: ${val('challan_date')}</div>
            </div>
            <div class="content">
                <div class="row">
                    <div class="col col-label">FROM</div>
                    <div class="col">${val('supplier_name')}<br>${val('supplier_address')}<br>GSTIN: ${val('supplier_gstin')}</div>
                    <div class="col col-label">TO</div>
                    <div class="col">${val('receiver_name')}<br>${val('receiver_address')}<br>GSTIN: ${val('receiver_gstin')}</div>
                </div>
                <div class="row">
                    <div class="col col-label">VEHICLE</div>
                    <div class="col">${val('vehicle_no')}</div>
                    <div class="col col-label">E-WAY BILL</div>
                    <div class="col">${val('eway_bill')}</div>
                </div>
                <table class="table">
                    <thead><tr><th>SR</th><th>DESCRIPTION</th><th>HSN</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td>₹${(p.rate || 0).toFixed(2)}</td><td>₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        <tr><td colspan="5">SUBTOTAL</td><td>₹${subtotal.toFixed(2)}</td></tr>
                        ${!isInterState
                          ? `<tr><td colspan="5">CGST @ 9%</td><td>₹${cgstAmount.toFixed(2)}</td></tr>
                        <tr><td colspan="5">SGST @ 9%</td><td>₹${sgstAmount.toFixed(2)}</td></tr>`
                          : `<tr><td colspan="5">IGST @ 18%</td><td>₹${igstAmount.toFixed(2)}</td></tr>`}
                        <tr class="total"><td colspan="5">GRAND TOTAL</td><td>₹${grandTotal.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div class="signature">
                    <div style="width: 200px; margin-left: auto;">
                        <div style="height: 50px; border-bottom: 1px solid #000; margin-bottom: 5px;"></div>
                        <div style="text-align: center; font-weight: bold;">AUTHORIZED SIGNATORY</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign4(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Georgia', serif; }
        body { padding: 20px; font-size: 11px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
        .invoice { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 25px; text-align: center; }
        .header h1 { font-size: 22px; margin-bottom: 8px; }
        .header p { opacity: 0.9; }
        .content { padding: 25px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
        .info-card { background: #fff5f5; border-left: 4px solid #ff6b6b; padding: 15px; border-radius: 8px; }
        .info-card h3 { color: #ff6b6b; margin-bottom: 10px; font-size: 14px; }
        .transport-info { background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
        .product-table th { background: #ff6b6b; color: white; padding: 12px; }
        .product-table td { padding: 10px; border-bottom: 1px solid #fee; }
        .product-table tr:hover { background: #fff5f5; }
        .totals { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .btn { background: #ff6b6b; color: white; padding: 12px 24px; border: none; border-radius: 25px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Invoice</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">❌ Close</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <p>Invoice No: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="info-grid">
                    <div class="info-card">
                        <h3>📤 SUPPLIER DETAILS</h3>
                        <div><strong>${val('supplier_name')}</strong></div>
                        <div>${val('supplier_address')}</div>
                        <div><strong>GSTIN:</strong> ${val('supplier_gstin')}</div>
                    </div>
                    <div class="info-card">
                        <h3>📥 RECEIVER DETAILS</h3>
                        <div><strong>${val('receiver_name')}</strong></div>
                        <div>${val('receiver_address')}</div>
                        <div><strong>GSTIN:</strong> ${val('receiver_gstin')}</div>
                    </div>
                </div>
                <div class="transport-info">
                    <h3 style="color: #2563eb; margin-bottom: 10px;">🚛 TRANSPORT INFORMATION</h3>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                        <div><strong>Vehicle No:</strong> ${val('vehicle_no')}</div>
                        <div><strong>E-Way Bill:</strong> ${val('eway_bill')}</div>
                        <div><strong>LR Number:</strong> ${val('lr_no')}</div>
                    </div>
                </div>
                <table class="product-table">
                    <thead><tr><th>S.No</th><th>📦 Description</th><th>🏷️ HSN</th><th>📊 Qty</th><th>💰 Rate</th><th>💵 Amount</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="totals">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px;">
                        <div>
                            <div>Subtotal: ₹${subtotal.toFixed(2)}</div>
                            ${!isInterState
                              ? `<div>CGST @ 9%: ₹${cgstAmount.toFixed(2)}</div>
                            <div>SGST @ 9%: ₹${sgstAmount.toFixed(2)}</div>`
                              : `<div>IGST @ 18%: ₹${igstAmount.toFixed(2)}</div>`}
                        </div>
                        <div style="font-size: 20px; font-weight: bold;">
                            Grand Total: ₹${grandTotal.toFixed(2)}
                        </div>
                    </div>
                </div>
                <div style="margin-top: 30px; text-align: right;">
                    <div style="display: inline-block; text-align: center;">
                        <div style="width: 200px; height: 60px; border-bottom: 2px solid #ff6b6b; margin-bottom: 5px;"></div>
                        <div style="color: #ff6b6b; font-weight: bold;">✍️ Authorized Signatory</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign5(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Helvetica', sans-serif; }
        body { padding: 15px; font-size: 10px; background: #f8f9fa; }
        .invoice { background: white; border: 1px solid #dee2e6; }
        .header { background: #28a745; color: white; padding: 20px; }
        .header h1 { font-size: 18px; text-align: center; }
        .header .details { display: flex; justify-content: space-between; margin-top: 10px; }
        .section { padding: 15px; border-bottom: 1px solid #dee2e6; }
        .section:last-child { border-bottom: none; }
        .section-title { background: #28a745; color: white; padding: 8px; margin: -15px -15px 15px -15px; font-weight: bold; }
        .flex { display: flex; gap: 20px; }
        .flex > div { flex: 1; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
        .table th { background: #28a745; color: white; }
        .table .total-row { background: #d4edda; font-weight: bold; }
        .btn { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6c757d;">Close</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <div class="details">
                    <div>Challan No: ${val('challan_no')}</div>
                    <div>Date: ${val('challan_date')}</div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">PARTY DETAILS</div>
                <div class="flex">
                    <div>
                        <h4>Supplier:</h4>
                        <div>${val('supplier_name')}</div>
                        <div>${val('supplier_address')}</div>
                        <div><strong>GSTIN:</strong> ${val('supplier_gstin')}</div>
                    </div>
                    <div>
                        <h4>Receiver:</h4>
                        <div>${val('receiver_name')}</div>
                        <div>${val('receiver_address')}</div>
                        <div><strong>GSTIN:</strong> ${val('receiver_gstin')}</div>
                    </div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">TRANSPORT DETAILS</div>
                <div class="flex">
                    <div><strong>Vehicle No:</strong> ${val('vehicle_no')}</div>
                    <div><strong>E-Way Bill:</strong> ${val('eway_bill')}</div>
                    <div><strong>Transporter:</strong> ${val('transporter')}</div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">GOODS DETAILS</div>
                <table class="table">
                    <thead><tr><th>S.No</th><th>Description</th><th>HSN Code</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td style="text-align:right;">${(p.rate || 0).toFixed(2)}</td><td style="text-align:right;">${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        <tr><td colspan="5" style="text-align:right;"><strong>Subtotal</strong></td><td style="text-align:right;"><strong>₹${subtotal.toFixed(2)}</strong></td></tr>
                        ${!isInterState
                          ? `<tr><td colspan="5" style="text-align:right;">CGST @ 9%</td><td style="text-align:right;">₹${cgstAmount.toFixed(2)}</td></tr>
                        <tr><td colspan="5" style="text-align:right;">SGST @ 9%</td><td style="text-align:right;">₹${sgstAmount.toFixed(2)}</td></tr>`
                          : `<tr><td colspan="5" style="text-align:right;">IGST @ 18%</td><td style="text-align:right;">₹${igstAmount.toFixed(2)}</td></tr>`}
                        <tr class="total-row"><td colspan="5" style="text-align:right;"><strong>Grand Total</strong></td><td style="text-align:right;"><strong>₹${grandTotal.toFixed(2)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="section">
                <div style="display: flex; justify-content: space-between; align-items: end;">
                    <div>
                        <strong>Terms & Conditions:</strong><br>
                        ${val('terms_conditions')}
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 200px; height: 60px; border-bottom: 1px solid #000; margin-bottom: 5px;"></div>
                        <div><strong>Authorized Signatory</strong></div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}
function generateTaxChallanDesign6(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Trebuchet MS', sans-serif; }
        body { padding: 20px; font-size: 11px; background: #e8f4f8; }
        .invoice { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
        .header { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; padding: 30px; text-align: center; position: relative; }
        .header::after { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 20px solid transparent; border-right: 20px solid transparent; border-top: 20px solid #0083b0; }
        .header h1 { font-size: 24px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .content { padding: 30px; }
        .card { background: #f8fdff; border: 1px solid #b3e5fc; border-radius: 10px; padding: 20px; margin: 15px 0; }
        .card-header { background: #00b4db; color: white; padding: 10px 15px; margin: -20px -20px 15px -20px; border-radius: 10px 10px 0 0; font-weight: bold; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; padding: 15px; text-align: left; }
        .product-table td { padding: 12px; border-bottom: 1px solid #e1f5fe; }
        .product-table tr:nth-child(even) { background: #f1f8e9; }
        .total-card { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; border-radius: 15px; padding: 25px; margin-top: 20px; }
        .btn { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; padding: 12px 25px; border: none; border-radius: 25px; margin: 5px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Invoice</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(45deg, #6b7280, #4b5563);">❌ Close</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <p style="font-size: 16px; margin-top: 10px;">Invoice No: ${val('challan_no')} | Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header">📤 SUPPLIER INFORMATION</div>
                        <div style="line-height: 1.6;">
                            <div style="font-size: 14px; font-weight: bold; color: #00b4db;">${val('supplier_name')}</div>
                            <div>${val('supplier_address')}</div>
                            <div style="margin-top: 8px;"><strong>GSTIN:</strong> <span style="color: #00b4db;">${val('supplier_gstin')}</span></div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">📥 RECEIVER INFORMATION</div>
                        <div style="line-height: 1.6;">
                            <div style="font-size: 14px; font-weight: bold; color: #00b4db;">${val('receiver_name')}</div>
                            <div>${val('receiver_address')}</div>
                            <div style="margin-top: 8px;"><strong>GSTIN:</strong> <span style="color: #00b4db;">${val('receiver_gstin')}</span></div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">🚛 TRANSPORT & LOGISTICS</div>
                    <div class="grid-3">
                        <div><strong>Vehicle Number:</strong><br><span style="color: #00b4db; font-size: 14px;">${val('vehicle_no')}</span></div>
                        <div><strong>E-Way Bill:</strong><br><span style="color: #00b4db; font-size: 14px;">${val('eway_bill')}</span></div>
                        <div><strong>LR Number:</strong><br><span style="color: #00b4db; font-size: 14px;">${val('lr_no')}</span></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">📦 GOODS DETAILS</div>
                    <table class="product-table">
                        <thead><tr><th>S.No</th><th>Description of Goods</th><th>HSN Code</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="font-weight: bold;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #00b4db; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="total-card">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 30px; align-items: center;">
                        <div style="line-height: 1.8;">
                            <div>Subtotal: ₹${subtotal.toFixed(2)}</div>
                            ${!isInterState
                              ? `<div>CGST @ 9%: ₹${cgstAmount.toFixed(2)}</div>
                            <div>SGST @ 9%: ₹${sgstAmount.toFixed(2)}</div>`
                              : `<div>IGST @ 18%: ₹${igstAmount.toFixed(2)}</div>`}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 14px;">Grand Total</div>
                            <div style="font-size: 28px; font-weight: bold;">₹${grandTotal.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 40px; text-align: right;">
                    <div style="display: inline-block; text-align: center;">
                        <div style="width: 250px; height: 80px; border: 2px dashed #00b4db; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #00b4db; font-style: italic;">Signature & Company Stamp</div>
                        <div style="color: #00b4db; font-weight: bold; font-size: 14px;">Authorized Signatory</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign7(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Arial Black', sans-serif; }
        body { padding: 10px; font-size: 10px; background: #1a1a1a; color: white; }
        .invoice { background: #2d2d2d; border: 2px solid #ff6b35; border-radius: 10px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 25px; text-align: center; }
        .header h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
        .content { padding: 25px; }
        .section { background: #3d3d3d; border: 1px solid #ff6b35; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .section-title { color: #ff6b35; font-size: 14px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item { margin: 8px 0; }
        .info-label { color: #ff6b35; font-weight: bold; }
        .product-table { width: 100%; border-collapse: collapse; background: #3d3d3d; border-radius: 8px; overflow: hidden; }
        .product-table th { background: #ff6b35; color: white; padding: 15px; text-align: left; font-weight: bold; }
        .product-table td { padding: 12px; border-bottom: 1px solid #555; }
        .product-table tr:hover { background: #4d4d4d; }
        .total-section { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 25px; border-radius: 8px; margin-top: 20px; }
        .btn { background: #ff6b35; color: white; padding: 12px 25px; border: none; border-radius: 5px; margin: 5px; cursor: pointer; font-weight: bold; text-transform: uppercase; }
        @media print { .no-print { display: none; } body { background: white; color: black; } .invoice { background: white; } .section { background: #f5f5f5; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ PRINT</button>
            <button onclick="window.close()" class="btn" style="background: #666;">❌ CLOSE</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <div style="font-size: 14px; margin-top: 10px;">INVOICE: ${val('challan_no')} | DATE: ${val('challan_date')}</div>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">📋 INVOICE DETAILS</div>
                    <div class="grid">
                        <div>
                            <div class="info-item"><span class="info-label">SUPPLIER:</span> ${val('supplier_name')}</div>
                            <div class="info-item">${val('supplier_address')}</div>
                            <div class="info-item"><span class="info-label">GSTIN:</span> ${val('supplier_gstin')}</div>
                        </div>
                        <div>
                            <div class="info-item"><span class="info-label">RECEIVER:</span> ${val('receiver_name')}</div>
                            <div class="info-item">${val('receiver_address')}</div>
                            <div class="info-item"><span class="info-label">GSTIN:</span> ${val('receiver_gstin')}</div>
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">🚛 TRANSPORT INFO</div>
                    <div class="grid">
                        <div class="info-item"><span class="info-label">VEHICLE:</span> ${val('vehicle_no')}</div>
                        <div class="info-item"><span class="info-label">E-WAY BILL:</span> ${val('eway_bill')}</div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">📦 GOODS BREAKDOWN</div>
                    <table class="product-table">
                        <thead><tr><th>#</th><th>DESCRIPTION</th><th>HSN</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="color: #ff6b35; font-weight: bold;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #ff6b35;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; color: #ff6b35; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="total-section">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 30px; align-items: center;">
                        <div>
                            <div style="margin: 5px 0;">SUBTOTAL: ₹${subtotal.toFixed(2)}</div>
                            ${!isInterState
                              ? `<div style="margin: 5px 0;">CGST @ 9%: ₹${cgstAmount.toFixed(2)}</div>
                            <div style="margin: 5px 0;">SGST @ 9%: ₹${sgstAmount.toFixed(2)}</div>`
                              : `<div style="margin: 5px 0;">IGST @ 18%: ₹${igstAmount.toFixed(2)}</div>`}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 16px;">GRAND TOTAL</div>
                            <div style="font-size: 32px; font-weight: bold;">₹${grandTotal.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 30px; text-align: right;">
                    <div style="display: inline-block; text-align: center;">
                        <div style="width: 200px; height: 60px; border: 2px solid #ff6b35; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #ff6b35;">AUTHORIZED SIGNATURE</div>
                        <div style="color: #ff6b35; font-weight: bold;">COMPANY SEAL</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign8(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Verdana', sans-serif; }
        body { padding: 20px; font-size: 11px; background: #f0f2f5; }
        .invoice { background: white; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 25px; text-align: center; position: relative; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="80" r="2" fill="rgba(255,255,255,0.1)"/></svg>'); }
        .header h1 { font-size: 22px; margin-bottom: 8px; position: relative; z-index: 1; }
        .header p { position: relative; z-index: 1; opacity: 0.9; }
        .content { padding: 30px; }
        .badge { background: #8e44ad; color: white; padding: 5px 12px; border-radius: 15px; font-size: 10px; font-weight: bold; display: inline-block; margin-bottom: 10px; }
        .info-row { display: flex; margin: 15px 0; gap: 20px; }
        .info-box { flex: 1; background: #f8f9fa; border-left: 4px solid #8e44ad; padding: 15px; border-radius: 0 8px 8px 0; }
        .info-title { color: #8e44ad; font-weight: bold; margin-bottom: 8px; font-size: 12px; }
        .transport-bar { background: linear-gradient(90deg, #3498db, #8e44ad); color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .transport-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 15px; text-align: left; }
        .product-table td { padding: 12px; border-bottom: 1px solid #ecf0f1; }
        .product-table tr:nth-child(even) { background: #f8f9fa; }
        .summary-card { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 25px; border-radius: 12px; margin-top: 25px; }
        .btn { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 12px 24px; border: none; border-radius: 25px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Invoice</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #6b7280, #4b5563);">❌ Close</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <p>Invoice No: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="badge">📄 INVOICE DETAILS</div>
                <div class="info-row">
                    <div class="info-box">
                        <div class="info-title">📤 SUPPLIER DETAILS</div>
                        <div style="font-weight: bold; color: #2c3e50;">${val('supplier_name')}</div>
                        <div style="margin: 5px 0; line-height: 1.4;">${val('supplier_address')}</div>
                        <div><strong>GSTIN:</strong> <span style="color: #8e44ad;">${val('supplier_gstin')}</span></div>
                    </div>
                    <div class="info-box">
                        <div class="info-title">📥 RECEIVER DETAILS</div>
                        <div style="font-weight: bold; color: #2c3e50;">${val('receiver_name')}</div>
                        <div style="margin: 5px 0; line-height: 1.4;">${val('receiver_address')}</div>
                        <div><strong>GSTIN:</strong> <span style="color: #8e44ad;">${val('receiver_gstin')}</span></div>
                    </div>
                </div>
                <div class="transport-bar">
                    <div style="margin-bottom: 10px; font-weight: bold;">🚛 TRANSPORT INFORMATION</div>
                    <div class="transport-grid">
                        <div><strong>Vehicle:</strong> ${val('vehicle_no')}</div>
                        <div><strong>E-Way Bill:</strong> ${val('eway_bill')}</div>
                        <div><strong>LR Number:</strong> ${val('lr_no')}</div>
                    </div>
                </div>
                <div class="badge">📦 GOODS DETAILS</div>
                <table class="product-table">
                    <thead><tr><th>S.No</th><th>Description of Goods</th><th>HSN Code</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #8e44ad;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #3498db; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="summary-card">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 30px; align-items: center;">
                        <div style="line-height: 1.8;">
                            <div>💰 Subtotal: ₹${subtotal.toFixed(2)}</div>
                            ${!isInterState
                              ? `<div>🏛️ CGST @ 9%: ₹${cgstAmount.toFixed(2)}</div>
                            <div>🏛️ SGST @ 9%: ₹${sgstAmount.toFixed(2)}</div>`
                              : `<div>🏛️ IGST @ 18%: ₹${igstAmount.toFixed(2)}</div>`}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 16px; opacity: 0.9;">Grand Total</div>
                            <div style="font-size: 32px; font-weight: bold;">₹${grandTotal.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 40px; text-align: right;">
                    <div style="display: inline-block; text-align: center;">
                        <div style="width: 220px; height: 70px; border: 2px dashed #8e44ad; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #8e44ad; font-style: italic;">Digital Signature & Stamp</div>
                        <div style="color: #8e44ad; font-weight: bold;">✍️ Authorized Signatory</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign9(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { padding: 15px; font-size: 11px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .invoice { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.2); max-width: 900px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%); padding: 30px; text-align: center; position: relative; }
        .header::before { content: '✨'; position: absolute; top: 20px; left: 30px; font-size: 24px; }
        .header::after { content: '✨'; position: absolute; top: 20px; right: 30px; font-size: 24px; }
        .header h1 { font-size: 26px; color: #2d3748; margin-bottom: 10px; font-weight: 300; letter-spacing: 1px; }
        .header p { color: #4a5568; font-size: 14px; }
        .content { padding: 35px; }
        .section { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 15px; margin: 20px 0; }
        .section-content { background: white; color: #2d3748; padding: 20px; border-radius: 10px; margin-top: 15px; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .info-card { background: #f7fafc; border-radius: 12px; padding: 20px; border-left: 5px solid #ff9a9e; }
        .info-label { color: #ff9a9e; font-weight: bold; font-size: 12px; margin-bottom: 5px; }
        .info-value { color: #2d3748; font-weight: 600; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #2d3748; padding: 18px; text-align: left; font-weight: 600; }
        .product-table td { padding: 15px; border-bottom: 1px solid #e2e8f0; }
        .product-table tr:nth-child(even) { background: #f8fafc; }
        .product-table tr:hover { background: #edf2f7; }
        .total-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-top: 25px; }
        .btn { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #2d3748; padding: 15px 30px; border: none; border-radius: 25px; margin: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Beautiful Invoice</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #a0aec0, #718096);">❌ Close Window</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>TAX INVOICE CUM DELIVERY CHALLAN</h1>
                <p>Invoice No: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">👥 PARTY INFORMATION</div>
                    <div class="section-content">
                        <div class="info-grid">
                            <div class="info-card">
                                <div class="info-label">📤 SUPPLIER DETAILS</div>
                                <div class="info-value" style="font-size: 14px; margin-bottom: 8px;">${val('supplier_name')}</div>
                                <div style="line-height: 1.5; margin-bottom: 8px;">${val('supplier_address')}</div>
                                <div><span class="info-label">GSTIN:</span> <span style="color: #667eea; font-weight: bold;">${val('supplier_gstin')}</span></div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">📥 RECEIVER DETAILS</div>
                                <div class="info-value" style="font-size: 14px; margin-bottom: 8px;">${val('receiver_name')}</div>
                                <div style="line-height: 1.5; margin-bottom: 8px;">${val('receiver_address')}</div>
                                <div><span class="info-label">GSTIN:</span> <span style="color: #667eea; font-weight: bold;">${val('receiver_gstin')}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">🚛 LOGISTICS & TRANSPORT</div>
                    <div class="section-content">
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                            <div class="info-card">
                                <div class="info-label">Vehicle Number</div>
                                <div class="info-value" style="font-size: 16px;">${val('vehicle_no')}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">E-Way Bill</div>
                                <div class="info-value" style="font-size: 16px;">${val('eway_bill')}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">LR Number</div>
                                <div class="info-value" style="font-size: 16px;">${val('lr_no')}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">📦 GOODS & SERVICES</div>
                    <div class="section-content">
                        <table class="product-table">
                            <thead><tr><th>S.No</th><th>Description of Goods</th><th>HSN Code</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                            <tbody>
                                ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #667eea;">${i + 1}</td><td style="font-weight: 500;">${p.desc || ''}</td><td style="color: #ff9a9e; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center; font-weight: 600;">${p.qty || 0}</td><td style="text-align:right; font-weight: 600;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold; color: #667eea;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="total-section">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: center;">
                        <div style="line-height: 2;">
                            <div style="font-size: 16px;">💰 Subtotal: ₹${subtotal.toFixed(2)}</div>
                            ${!isInterState
                              ? `<div style="font-size: 16px;">🏛️ CGST @ 9%: ₹${cgstAmount.toFixed(2)}</div>
                            <div style="font-size: 16px;">🏛️ SGST @ 9%: ₹${sgstAmount.toFixed(2)}</div>`
                              : `<div style="font-size: 16px;">🏛️ IGST @ 18%: ₹${igstAmount.toFixed(2)}</div>`}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 18px; opacity: 0.9;">Grand Total</div>
                            <div style="font-size: 36px; font-weight: bold;">₹${grandTotal.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 40px; text-align: right;">
                    <div style="display: inline-block; text-align: center;">
                        <div style="width: 250px; height: 80px; border: 3px dashed #ff9a9e; border-radius: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; color: #ff9a9e; font-style: italic; font-size: 14px;">Authorized Signature & Company Seal</div>
                        <div style="color: #667eea; font-weight: bold; font-size: 16px;">✍️ Authorized Signatory</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateTaxChallanDesign10(data, val, products, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal, isInterState) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Tax Invoice - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Comic Sans MS', cursive; }
        body { padding: 20px; font-size: 12px; background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57); background-size: 400% 400%; animation: gradientShift 15s ease infinite; }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .invoice { background: white; border-radius: 25px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 5px solid #ff6b6b; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%); color: white; padding: 30px; text-align: center; position: relative; }
        .header::before { content: '🎉'; position: absolute; top: 15px; left: 20px; font-size: 30px; animation: bounce 2s infinite; }
        .header::after { content: '🎉'; position: absolute; top: 15px; right: 20px; font-size: 30px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
        .header h1 { font-size: 28px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); animation: pulse 3s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        .content { padding: 30px; }
        .fun-section { background: linear-gradient(135deg, #feca57 0%, #ff9ff3 100%); border-radius: 20px; padding: 25px; margin: 20px 0; border: 3px dashed #ff6b6b; }
        .fun-title { font-size: 18px; font-weight: bold; color: #2d3436; margin-bottom: 15px; text-align: center; }
        .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .party-card { background: white; border-radius: 15px; padding: 20px; border: 3px solid #4ecdc4; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .party-title { color: #4ecdc4; font-weight: bold; font-size: 14px; margin-bottom: 10px; }
        .transport-fun { background: linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%); color: white; border-radius: 20px; padding: 20px; margin: 20px 0; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 15px; overflow: hidden; border: 3px solid #00b894; }
        .product-table th { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; padding: 15px; text-align: left; font-weight: bold; }
        .product-table td { padding: 12px; border-bottom: 2px solid #ddd; }
        .product-table tr:nth-child(even) { background: #f1f2f6; }
        .product-table tr:hover { background: #ddd; transform: scale(1.02); transition: all 0.3s; }
        .total-fun { background: linear-gradient(135deg, #e17055 0%, #fdcb6e 100%); color: white; padding: 30px; border-radius: 20px; margin-top: 25px; border: 3px solid #e17055; }
        .btn { background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%); color: white; padding: 15px 30px; border: none; border-radius: 25px; margin: 8px; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transition: all 0.3s; }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
        @media print { .no-print { display: none; } body { background: white; animation: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Fun Invoice!</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #636e72, #2d3436);">❌ Close Fun Window</button>
        </div>
        <div class="invoice">
            <div class="header">
                <h1>🎊 TAX INVOICE CUM DELIVERY CHALLAN 🎊</h1>
                <p style="font-size: 16px;">Invoice: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="fun-section">
                    <div class="fun-title">👥 PARTY TIME! WHO'S WHO? 👥</div>
                    <div class="party-grid">
                        <div class="party-card">
                            <div class="party-title">📤 SUPPLIER (THE SENDER!)</div>
                            <div style="font-weight: bold; color: #2d3436; font-size: 14px; margin-bottom: 8px;">${val('supplier_name')}</div>
                            <div style="line-height: 1.5; margin-bottom: 8px;">${val('supplier_address')}</div>
                            <div><strong>GSTIN:</strong> <span style="color: #00b894; font-weight: bold;">${val('supplier_gstin')}</span></div>
                        </div>
                        <div class="party-card">
                            <div class="party-title">📥 RECEIVER (THE LUCKY ONE!)</div>
                            <div style="font-weight: bold; color: #2d3436; font-size: 14px; margin-bottom: 8px;">${val('receiver_name')}</div>
                            <div style="line-height: 1.5; margin-bottom: 8px;">${val('receiver_address')}</div>
                            <div><strong>GSTIN:</strong> <span style="color: #00b894; font-weight: bold;">${val('receiver_gstin')}</span></div>
                        </div>
                    </div>
                </div>
                <div class="transport-fun">
                    <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 15px;">🚛 TRANSPORT ADVENTURE! 🚛</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                        <div><strong>🚗 Vehicle:</strong><br><span style="font-size: 16px;">${val('vehicle_no')}</span></div>
                        <div><strong>📋 E-Way Bill:</strong><br><span style="font-size: 16px;">${val('eway_bill')}</span></div>
                        <div><strong>📄 LR Number:</strong><br><span style="font-size: 16px;">${val('lr_no')}</span></div>
                    </div>
                </div>
                <div class="fun-section">
                    <div class="fun-title">📦 AWESOME GOODS BREAKDOWN! 📦</div>
                    <table class="product-table">
                        <thead><tr><th>🔢 S.No</th><th>📝 What's This?</th><th>🏷️ HSN Code</th><th>📊 How Many?</th><th>💰 Price Each</th><th>💵 Total Cost</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #00b894; font-size: 14px;">${i + 1}</td><td style="font-weight: 600;">${p.desc || ''}</td><td style="color: #e17055; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center; font-weight: 600;">${p.qty || 0}</td><td style="text-align:right; font-weight: 600;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold; color: #00b894; font-size: 14px;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="total-fun">
                    <div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px;">💸 MONEY MATTERS! 💸</div>
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 30px; align-items: center;">
                        <div style="line-height: 2; font-size: 16px;">
                            <div>💰 Subtotal: ₹${subtotal.toFixed(2)}</div>
                            ${!isInterState
                              ? `<div>🏛️ CGST @ 9%: ₹${cgstAmount.toFixed(2)}</div>
                            <div>🏛️ SGST @ 9%: ₹${sgstAmount.toFixed(2)}</div>`
                              : `<div>🏛️ IGST @ 18%: ₹${igstAmount.toFixed(2)}</div>`}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px;">🎯 GRAND TOTAL</div>
                            <div style="font-size: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">₹${grandTotal.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 40px; text-align: right;">
                    <div style="display: inline-block; text-align: center;">
                        <div style="width: 280px; height: 90px; border: 4px dashed #ff6b6b; border-radius: 20px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; color: #ff6b6b; font-style: italic; font-size: 16px; font-weight: bold;">🖋️ Sign Here & Stamp It! 🖋️</div>
                        <div style="color: #4ecdc4; font-weight: bold; font-size: 18px;">✍️ The Boss's Signature!</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}
// ============================================================================
// DELIVERY CHALLAN DESIGN VARIANTS (10 Different Styles)
// ============================================================================

function generateDeliveryChallanDesign1(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { padding: 20px; font-size: 11px; }
        .header { text-align: center; font-size: 18px; font-weight: bold; color: #16a085; margin-bottom: 20px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .info-table td { padding: 8px; border: 1px solid #000; }
        .label { font-weight: bold; background: #e8f8f5; width: 25%; }
        .product-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .product-table th { background: #16a085; color: white; padding: 8px; text-align: left; }
        .product-table td { padding: 6px; border: 1px solid #ddd; }
        .text-right { text-align: right; }
        .summary-box { background: #e8f8f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .btn { background: #16a085; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>
        <div class="header">DELIVERY CHALLAN & PACKAGING LIST</div>
        <table class="info-table">
            <tr><td class="label">Challan No:</td><td>${val('challan_no')}</td><td class="label">Date:</td><td>${val('challan_date')}</td></tr>
            <tr><td class="label">From:</td><td>${val('from_company')}<br>${val('from_address')}</td><td class="label">To:</td><td>${val('to_company')}<br>${val('to_address')}</td></tr>
            <tr><td class="label">Vehicle:</td><td>${val('vehicle_no')}</td><td class="label">Driver:</td><td>${val('driver_name')}</td></tr>
        </table>
        <h3 style="color: #16a085; margin: 20px 0 10px;">GOODS DETAILS</h3>
        <table class="product-table">
            <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
                ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td class="text-right">₹${(p.rate || 0).toFixed(2)}</td><td class="text-right">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
            </tbody>
        </table>
        <h3 style="color: #16a085; margin: 20px 0 10px;">PACKAGING DETAILS</h3>
        <table class="product-table">
            <thead><tr><th>Carton#</th><th>Description</th><th>Qty</th><th>Net Wt</th><th>Gross Wt</th><th>Dimensions</th><th>Vol Wt</th></tr></thead>
            <tbody>
                ${packages.map(p => `<tr><td>${p.carton}</td><td>${p.desc}</td><td>${p.qty}</td><td class="text-right">${p.net.toFixed(2)}</td><td class="text-right">${p.gross.toFixed(2)}</td><td>${p.dims}</td><td class="text-right">${p.vol.toFixed(2)}</td></tr>`).join('')}
            </tbody>
        </table>
        <div class="summary-box">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div><strong>Total Packages:</strong> ${packages.length}</div>
                <div><strong>Total Net Weight:</strong> ${totalNet.toFixed(2)} KGS</div>
                <div><strong>Total Gross Weight:</strong> ${totalGross.toFixed(2)} KGS</div>
            </div>
        </div>
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div style="text-align: center;"><div style="width: 200px; border-bottom: 1px solid #000; margin: 40px 0 5px;"></div><strong>Sender's Signature</strong></div>
            <div style="text-align: center;"><div style="width: 200px; border-bottom: 1px solid #000; margin: 40px 0 5px;"></div><strong>Receiver's Signature</strong></div>
        </div>
    </body></html>`;
}

function generateDeliveryChallanDesign2(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Times New Roman', serif; }
        body { padding: 20px; font-size: 12px; background: #f8f9fa; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; text-align: center; padding: 25px; border-radius: 8px; margin-bottom: 25px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .section { margin: 25px 0; padding: 20px; border-left: 4px solid #e74c3c; background: #fdf2f2; border-radius: 0 8px 8px 0; }
        .section-title { font-weight: bold; color: #e74c3c; margin-bottom: 15px; font-size: 14px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .info-card { background: white; padding: 15px; border-radius: 8px; border: 1px solid #fadbd8; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .product-table th { background: #e74c3c; color: white; padding: 12px; text-align: left; }
        .product-table td { padding: 10px; border-bottom: 1px solid #fadbd8; }
        .product-table tr:nth-child(even) { background: #fdf2f2; }
        .summary-card { background: #e74c3c; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .btn { background: #e74c3c; color: white; padding: 12px 24px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } body { background: white; } .container { box-shadow: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print Challan</button>
            <button onclick="window.close()" class="btn" style="background: #6b7280;">Close</button>
        </div>
        <div class="container">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <p>Challan No: ${val('challan_no')} | Date: ${val('challan_date')}</p>
            </div>
            <div class="section">
                <div class="section-title">📋 CHALLAN INFORMATION</div>
                <div class="grid">
                    <div class="info-card">
                        <div><strong>From Company:</strong></div>
                        <div style="margin: 8px 0; font-weight: 600;">${val('from_company')}</div>
                        <div>${val('from_address')}</div>
                    </div>
                    <div class="info-card">
                        <div><strong>To Company:</strong></div>
                        <div style="margin: 8px 0; font-weight: 600;">${val('to_company')}</div>
                        <div>${val('to_address')}</div>
                    </div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">🚛 TRANSPORT DETAILS</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <div class="info-card"><strong>Vehicle:</strong> ${val('vehicle_no')}</div>
                    <div class="info-card"><strong>Driver:</strong> ${val('driver_name')}</div>
                    <div class="info-card"><strong>Delivery Date:</strong> ${val('delivery_date')}</div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">📦 GOODS BREAKDOWN</div>
                <table class="product-table">
                    <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td style="text-align:right;">${(p.rate || 0).toFixed(2)}</td><td style="text-align:right;">${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="section">
                <div class="section-title">📋 PACKAGING BREAKDOWN</div>
                <table class="product-table">
                    <thead><tr><th>Carton</th><th>Contents</th><th>Qty</th><th>Net Wt (KG)</th><th>Gross Wt (KG)</th><th>Dimensions</th><th>Vol Wt</th></tr></thead>
                    <tbody>
                        ${packages.map(p => `<tr><td>${p.carton}</td><td>${p.desc}</td><td>${p.qty}</td><td style="text-align:right;">${p.net.toFixed(2)}</td><td style="text-align:right;">${p.gross.toFixed(2)}</td><td>${p.dims}</td><td style="text-align:right;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="summary-card">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                    <div><div style="font-size: 18px; font-weight: bold;">${packages.length}</div><div>Total Packages</div></div>
                    <div><div style="font-size: 18px; font-weight: bold;">${totalNet.toFixed(2)} KG</div><div>Net Weight</div></div>
                    <div><div style="font-size: 18px; font-weight: bold;">${totalGross.toFixed(2)} KG</div><div>Gross Weight</div></div>
                </div>
            </div>
            <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                <div style="text-align: center;"><div style="width: 200px; height: 60px; border-bottom: 2px solid #e74c3c; margin-bottom: 8px;"></div><div style="color: #e74c3c; font-weight: bold;">Sender's Signature</div></div>
                <div style="text-align: center;"><div style="width: 200px; height: 60px; border-bottom: 2px solid #e74c3c; margin-bottom: 8px;"></div><div style="color: #e74c3c; font-weight: bold;">Receiver's Signature</div></div>
            </div>
        </div>
    </body></html>`;
}

function generateDeliveryChallanDesign3(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Courier New', monospace; }
        body { padding: 15px; font-size: 10px; background: #2c3e50; color: white; }
        .challan { background: #34495e; border: 2px solid #f39c12; border-radius: 10px; }
        .header { background: #f39c12; color: #2c3e50; text-align: center; padding: 20px; font-weight: bold; }
        .header h1 { font-size: 18px; letter-spacing: 2px; }
        .content { padding: 25px; }
        .section { background: #2c3e50; border: 1px solid #f39c12; border-radius: 5px; padding: 20px; margin: 15px 0; }
        .section-title { color: #f39c12; font-size: 12px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item { margin: 8px 0; }
        .info-label { color: #f39c12; font-weight: bold; }
        .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .table th, .table td { border: 1px solid #f39c12; padding: 8px; text-align: left; }
        .table th { background: #f39c12; color: #2c3e50; font-weight: bold; }
        .summary { background: #f39c12; color: #2c3e50; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .btn { background: #f39c12; color: #2c3e50; padding: 10px 20px; border: none; margin: 5px; cursor: pointer; font-weight: bold; }
        @media print { .no-print { display: none; } body { background: white; color: black; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">PRINT CHALLAN</button>
            <button onclick="window.close()" class="btn">CLOSE</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <div>CHALLAN: ${val('challan_no')} | DATE: ${val('challan_date')}</div>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">DELIVERY INFORMATION</div>
                    <div class="info-grid">
                        <div>
                            <div class="info-item"><span class="info-label">FROM:</span> ${val('from_company')}</div>
                            <div class="info-item">${val('from_address')}</div>
                        </div>
                        <div>
                            <div class="info-item"><span class="info-label">TO:</span> ${val('to_company')}</div>
                            <div class="info-item">${val('to_address')}</div>
                        </div>
                    </div>
                    <div style="margin-top: 15px;">
                        <div class="info-item"><span class="info-label">VEHICLE:</span> ${val('vehicle_no')} | <span class="info-label">DRIVER:</span> ${val('driver_name')}</div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">GOODS LIST</div>
                    <table class="table">
                        <thead><tr><th>SR</th><th>DESCRIPTION</th><th>HSN</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td>₹${(p.rate || 0).toFixed(2)}</td><td>₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="section">
                    <div class="section-title">PACKAGE DETAILS</div>
                    <table class="table">
                        <thead><tr><th>CARTON</th><th>CONTENTS</th><th>QTY</th><th>NET</th><th>GROSS</th><th>DIMS</th><th>VOL</th></tr></thead>
                        <tbody>
                            ${packages.map(p => `<tr><td>${p.carton}</td><td>${p.desc}</td><td>${p.qty}</td><td>${p.net.toFixed(2)}</td><td>${p.gross.toFixed(2)}</td><td>${p.dims}</td><td>${p.vol.toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="summary">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                        <div><strong>PACKAGES: ${packages.length}</strong></div>
                        <div><strong>NET: ${totalNet.toFixed(2)} KG</strong></div>
                        <div><strong>GROSS: ${totalGross.toFixed(2)} KG</strong></div>
                    </div>
                </div>
                <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;"><div style="width: 150px; height: 50px; border-bottom: 1px solid #f39c12; margin-bottom: 5px;"></div><strong>SENDER</strong></div>
                    <div style="text-align: center;"><div style="width: 150px; height: 50px; border-bottom: 1px solid #f39c12; margin-bottom: 5px;"></div><strong>RECEIVER</strong></div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateDeliveryChallanDesign4(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Georgia', serif; }
        body { padding: 20px; font-size: 11px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .challan { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.2); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { font-size: 26px; margin-bottom: 10px; }
        .content { padding: 30px; }
        .elegant-section { background: #f8f9ff; border-left: 5px solid #667eea; padding: 25px; margin: 20px 0; border-radius: 0 15px 15px 0; }
        .section-title { color: #667eea; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .info-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; text-align: left; }
        .product-table td { padding: 12px; border-bottom: 1px solid #e1e8ff; }
        .product-table tr:nth-child(even) { background: #f8f9ff; }
        .summary-elegant { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; margin-top: 25px; }
        .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 25px; border: none; border-radius: 25px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Elegant Challan</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #6b7280, #4b5563);">❌ Close</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <p style="font-size: 16px; opacity: 0.9;">Challan No: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="elegant-section">
                    <div class="section-title">📋 DELIVERY INFORMATION</div>
                    <div class="info-grid">
                        <div class="info-card">
                            <div style="color: #667eea; font-weight: bold; margin-bottom: 10px;">📤 FROM</div>
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">${val('from_company')}</div>
                            <div style="line-height: 1.5;">${val('from_address')}</div>
                        </div>
                        <div class="info-card">
                            <div style="color: #667eea; font-weight: bold; margin-bottom: 10px;">📥 TO</div>
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">${val('to_company')}</div>
                            <div style="line-height: 1.5;">${val('to_address')}</div>
                        </div>
                    </div>
                </div>
                <div class="elegant-section">
                    <div class="section-title">🚛 TRANSPORT DETAILS</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div class="info-card" style="text-align: center;">
                            <div style="color: #667eea; font-weight: bold;">Vehicle Number</div>
                            <div style="font-size: 16px; font-weight: bold; margin-top: 5px;">${val('vehicle_no')}</div>
                        </div>
                        <div class="info-card" style="text-align: center;">
                            <div style="color: #667eea; font-weight: bold;">Driver Name</div>
                            <div style="font-size: 16px; font-weight: bold; margin-top: 5px;">${val('driver_name')}</div>
                        </div>
                        <div class="info-card" style="text-align: center;">
                            <div style="color: #667eea; font-weight: bold;">Delivery Date</div>
                            <div style="font-size: 16px; font-weight: bold; margin-top: 5px;">${val('delivery_date')}</div>
                        </div>
                    </div>
                </div>
                <div class="elegant-section">
                    <div class="section-title">📦 GOODS DETAILS</div>
                    <table class="product-table">
                        <thead><tr><th>S.No</th><th>Description</th><th>HSN Code</th><th>Quantity</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #667eea;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #764ba2; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="elegant-section">
                    <div class="section-title">📋 PACKAGING DETAILS</div>
                    <table class="product-table">
                        <thead><tr><th>Carton#</th><th>Contents</th><th>Qty</th><th>Net Wt (KG)</th><th>Gross Wt (KG)</th><th>Dimensions</th><th>Vol Wt</th></tr></thead>
                        <tbody>
                            ${packages.map(p => `<tr><td style="font-weight: bold; color: #667eea;">${p.carton}</td><td>${p.desc}</td><td style="text-align: center;">${p.qty}</td><td style="text-align:right;">${p.net.toFixed(2)}</td><td style="text-align:right;">${p.gross.toFixed(2)}</td><td style="text-align: center;">${p.dims}</td><td style="text-align:right;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="summary-elegant">
                    <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px;">📊 SUMMARY</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; text-align: center;">
                        <div><div style="font-size: 24px; font-weight: bold;">${packages.length}</div><div>Total Packages</div></div>
                        <div><div style="font-size: 24px; font-weight: bold;">${totalNet.toFixed(2)}</div><div>Net Weight (KG)</div></div>
                        <div><div style="font-size: 24px; font-weight: bold;">${totalGross.toFixed(2)}</div><div>Gross Weight (KG)</div></div>
                    </div>
                </div>
                <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <div style="width: 220px; height: 70px; border: 2px dashed #667eea; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #667eea; font-style: italic;">Sender's Signature & Stamp</div>
                        <div style="color: #667eea; font-weight: bold;">Authorized Sender</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 220px; height: 70px; border: 2px dashed #667eea; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #667eea; font-style: italic;">Receiver's Signature & Stamp</div>
                        <div style="color: #667eea; font-weight: bold;">Authorized Receiver</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateDeliveryChallanDesign5(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Helvetica', sans-serif; }
        body { padding: 15px; font-size: 10px; background: #ecf0f1; }
        .challan { background: white; border: 1px solid #bdc3c7; }
        .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
        .header h1 { font-size: 18px; }
        .section { padding: 15px; border-bottom: 1px solid #ecf0f1; }
        .section:last-child { border-bottom: none; }
        .section-title { background: #27ae60; color: white; padding: 8px; margin: -15px -15px 15px -15px; font-weight: bold; }
        .info-flex { display: flex; gap: 20px; }
        .info-flex > div { flex: 1; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { border: 1px solid #bdc3c7; padding: 8px; text-align: left; }
        .table th { background: #27ae60; color: white; }
        .summary-bar { background: #2ecc71; color: white; padding: 15px; display: flex; justify-content: space-around; text-align: center; }
        .btn { background: #27ae60; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">Print</button>
            <button onclick="window.close()" class="btn" style="background: #7f8c8d;">Close</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <div>Challan: ${val('challan_no')} | Date: ${val('challan_date')}</div>
            </div>
            <div class="section">
                <div class="section-title">DELIVERY DETAILS</div>
                <div class="info-flex">
                    <div><h4>From:</h4><div>${val('from_company')}</div><div>${val('from_address')}</div></div>
                    <div><h4>To:</h4><div>${val('to_company')}</div><div>${val('to_address')}</div></div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">TRANSPORT INFO</div>
                <div class="info-flex">
                    <div><strong>Vehicle:</strong> ${val('vehicle_no')}</div>
                    <div><strong>Driver:</strong> ${val('driver_name')}</div>
                    <div><strong>Delivery Date:</strong> ${val('delivery_date')}</div>
                </div>
            </div>
            <div class="section">
                <div class="section-title">GOODS LIST</div>
                <table class="table">
                    <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td>${i + 1}</td><td>${p.desc || ''}</td><td>${p.hsn || ''}</td><td>${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="section">
                <div class="section-title">PACKAGING INFO</div>
                <table class="table">
                    <thead><tr><th>Carton</th><th>Contents</th><th>Qty</th><th>Net Wt</th><th>Gross Wt</th><th>Dims</th><th>Vol Wt</th></tr></thead>
                    <tbody>
                        ${packages.map(p => `<tr><td>${p.carton}</td><td>${p.desc}</td><td>${p.qty}</td><td style="text-align:right;">${p.net.toFixed(2)}</td><td style="text-align:right;">${p.gross.toFixed(2)}</td><td>${p.dims}</td><td style="text-align:right;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="summary-bar">
                <div><strong>Packages: ${packages.length}</strong></div>
                <div><strong>Net: ${totalNet.toFixed(2)} KG</strong></div>
                <div><strong>Gross: ${totalGross.toFixed(2)} KG</strong></div>
            </div>
            <div class="section">
                <div style="display: flex; justify-content: space-between;">
                    <div style="text-align: center;"><div style="width: 200px; height: 60px; border-bottom: 1px solid #000; margin-bottom: 5px;"></div><strong>Sender</strong></div>
                    <div style="text-align: center;"><div style="width: 200px; height: 60px; border-bottom: 1px solid #000; margin-bottom: 5px;"></div><strong>Receiver</strong></div>
                </div>
            </div>
        </div>
    </body></html>`;
}
function generateDeliveryChallanDesign6(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Trebuchet MS', sans-serif; }
        body { padding: 20px; font-size: 11px; background: #e8f4f8; }
        .challan { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
        .header { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; padding: 30px; text-align: center; position: relative; }
        .header::after { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 20px solid transparent; border-right: 20px solid transparent; border-top: 20px solid #0083b0; }
        .header h1 { font-size: 24px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .content { padding: 30px; }
        .card { background: #f8fdff; border: 1px solid #b3e5fc; border-radius: 10px; padding: 20px; margin: 15px 0; }
        .card-header { background: #00b4db; color: white; padding: 10px 15px; margin: -20px -20px 15px -20px; border-radius: 10px 10px 0 0; font-weight: bold; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; padding: 15px; text-align: left; }
        .product-table td { padding: 12px; border-bottom: 1px solid #e1f5fe; }
        .product-table tr:nth-child(even) { background: #f1f8e9; }
        .summary-card { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; border-radius: 15px; padding: 25px; margin-top: 20px; }
        .btn { background: linear-gradient(45deg, #00b4db, #0083b0); color: white; padding: 12px 25px; border: none; border-radius: 25px; margin: 5px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Challan</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(45deg, #6b7280, #4b5563);">❌ Close</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <p style="font-size: 16px; margin-top: 10px;">Challan No: ${val('challan_no')} | Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header">📤 FROM COMPANY</div>
                        <div style="line-height: 1.6;">
                            <div style="font-size: 14px; font-weight: bold; color: #00b4db;">${val('from_company')}</div>
                            <div>${val('from_address')}</div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">📥 TO COMPANY</div>
                        <div style="line-height: 1.6;">
                            <div style="font-size: 14px; font-weight: bold; color: #00b4db;">${val('to_company')}</div>
                            <div>${val('to_address')}</div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">🚛 TRANSPORT & DELIVERY</div>
                    <div class="grid-3">
                        <div><strong>Vehicle Number:</strong><br><span style="color: #00b4db; font-size: 14px;">${val('vehicle_no')}</span></div>
                        <div><strong>Driver Name:</strong><br><span style="color: #00b4db; font-size: 14px;">${val('driver_name')}</span></div>
                        <div><strong>Delivery Date:</strong><br><span style="color: #00b4db; font-size: 14px;">${val('delivery_date')}</span></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">📦 GOODS DETAILS</div>
                    <table class="product-table">
                        <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="font-weight: bold;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #00b4db; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="card">
                    <div class="card-header">📋 PACKAGING DETAILS</div>
                    <table class="product-table">
                        <thead><tr><th>Carton#</th><th>Contents</th><th>Qty</th><th>Net Wt</th><th>Gross Wt</th><th>Dims</th><th>Vol Wt</th></tr></thead>
                        <tbody>
                            ${packages.map(p => `<tr><td style="font-weight: bold;">${p.carton}</td><td>${p.desc}</td><td style="text-align: center;">${p.qty}</td><td style="text-align:right;">${p.net.toFixed(2)}</td><td style="text-align:right;">${p.gross.toFixed(2)}</td><td style="text-align: center;">${p.dims}</td><td style="text-align:right;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="summary-card">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; text-align: center;">
                        <div><div style="font-size: 28px; font-weight: bold;">${packages.length}</div><div>Total Packages</div></div>
                        <div><div style="font-size: 28px; font-weight: bold;">${totalNet.toFixed(2)}</div><div>Net Weight (KG)</div></div>
                        <div><div style="font-size: 28px; font-weight: bold;">${totalGross.toFixed(2)}</div><div>Gross Weight (KG)</div></div>
                    </div>
                </div>
                <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <div style="width: 250px; height: 80px; border: 2px dashed #00b4db; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #00b4db; font-style: italic;">Sender Signature & Stamp</div>
                        <div style="color: #00b4db; font-weight: bold; font-size: 14px;">Authorized Sender</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 250px; height: 80px; border: 2px dashed #00b4db; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #00b4db; font-style: italic;">Receiver Signature & Stamp</div>
                        <div style="color: #00b4db; font-weight: bold; font-size: 14px;">Authorized Receiver</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}

function generateDeliveryChallanDesign7(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Arial Black', sans-serif; }
        body { padding: 10px; font-size: 10px; background: #1a1a1a; color: white; }
        .challan { background: #2d2d2d; border: 2px solid #ff6b35; border-radius: 10px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 25px; text-align: center; }
        .header h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
        .content { padding: 25px; }
        .section { background: #3d3d3d; border: 1px solid #ff6b35; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .section-title { color: #ff6b35; font-size: 14px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item { margin: 8px 0; }
        .info-label { color: #ff6b35; font-weight: bold; }
        .product-table { width: 100%; border-collapse: collapse; background: #3d3d3d; border-radius: 8px; overflow: hidden; }
        .product-table th { background: #ff6b35; color: white; padding: 15px; text-align: left; font-weight: bold; }
        .product-table td { padding: 12px; border-bottom: 1px solid #555; }
        .product-table tr:hover { background: #4d4d4d; }
        .summary-section { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 25px; border-radius: 8px; margin-top: 20px; }
        .btn { background: #ff6b35; color: white; padding: 12px 25px; border: none; border-radius: 5px; margin: 5px; cursor: pointer; font-weight: bold; text-transform: uppercase; }
        @media print { .no-print { display: none; } body { background: white; color: black; } .challan { background: white; } .section { background: #f5f5f5; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ PRINT</button>
            <button onclick="window.close()" class="btn" style="background: #666;">❌ CLOSE</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <div style="font-size: 14px; margin-top: 10px;">CHALLAN: ${val('challan_no')} | DATE: ${val('challan_date')}</div>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">📋 DELIVERY INFO</div>
                    <div class="grid">
                        <div>
                            <div class="info-item"><span class="info-label">FROM:</span> ${val('from_company')}</div>
                            <div class="info-item">${val('from_address')}</div>
                        </div>
                        <div>
                            <div class="info-item"><span class="info-label">TO:</span> ${val('to_company')}</div>
                            <div class="info-item">${val('to_address')}</div>
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">🚛 TRANSPORT</div>
                    <div class="grid">
                        <div class="info-item"><span class="info-label">VEHICLE:</span> ${val('vehicle_no')}</div>
                        <div class="info-item"><span class="info-label">DRIVER:</span> ${val('driver_name')}</div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">📦 GOODS</div>
                    <table class="product-table">
                        <thead><tr><th>#</th><th>DESCRIPTION</th><th>HSN</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="color: #ff6b35; font-weight: bold;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #ff6b35;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; color: #ff6b35; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="section">
                    <div class="section-title">📋 PACKAGES</div>
                    <table class="product-table">
                        <thead><tr><th>CARTON</th><th>CONTENTS</th><th>QTY</th><th>NET</th><th>GROSS</th><th>DIMS</th><th>VOL</th></tr></thead>
                        <tbody>
                            ${packages.map(p => `<tr><td style="color: #ff6b35; font-weight: bold;">${p.carton}</td><td>${p.desc}</td><td style="text-align: center;">${p.qty}</td><td style="text-align:right;">${p.net.toFixed(2)}</td><td style="text-align:right;">${p.gross.toFixed(2)}</td><td style="text-align: center;">${p.dims}</td><td style="text-align:right;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="summary-section">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; text-align: center;">
                        <div><div style="font-size: 32px; font-weight: bold;">${packages.length}</div><div>PACKAGES</div></div>
                        <div><div style="font-size: 32px; font-weight: bold;">${totalNet.toFixed(2)}</div><div>NET KG</div></div>
                        <div><div style="font-size: 32px; font-weight: bold;">${totalGross.toFixed(2)}</div><div>GROSS KG</div></div>
                    </div>
                </div>
                <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <div style="width: 200px; height: 60px; border: 2px solid #ff6b35; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #ff6b35;">SENDER SIGNATURE</div>
                        <div style="color: #ff6b35; font-weight: bold;">AUTHORIZED SENDER</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 200px; height: 60px; border: 2px solid #ff6b35; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #ff6b35;">RECEIVER SIGNATURE</div>
                        <div style="color: #ff6b35; font-weight: bold;">AUTHORIZED RECEIVER</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}
function generateDeliveryChallanDesign8(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Verdana', sans-serif; }
        body { padding: 20px; font-size: 11px; background: #f0f2f5; }
        .challan { background: white; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 25px; text-align: center; }
        .header h1 { font-size: 22px; margin-bottom: 8px; }
        .content { padding: 30px; }
        .badge { background: #8e44ad; color: white; padding: 5px 12px; border-radius: 15px; font-size: 10px; font-weight: bold; display: inline-block; margin-bottom: 10px; }
        .info-row { display: flex; margin: 15px 0; gap: 20px; }
        .info-box { flex: 1; background: #f8f9fa; border-left: 4px solid #8e44ad; padding: 15px; border-radius: 0 8px 8px 0; }
        .info-title { color: #8e44ad; font-weight: bold; margin-bottom: 8px; font-size: 12px; }
        .transport-bar { background: linear-gradient(90deg, #3498db, #8e44ad); color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .transport-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 15px; text-align: left; }
        .product-table td { padding: 12px; border-bottom: 1px solid #ecf0f1; }
        .product-table tr:nth-child(even) { background: #f8f9fa; }
        .summary-card { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 25px; border-radius: 12px; margin-top: 25px; }
        .btn { background: linear-gradient(135deg, #8e44ad 0%, #3498db 100%); color: white; padding: 12px 24px; border: none; border-radius: 25px; margin: 5px; cursor: pointer; }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Challan</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #6b7280, #4b5563);">❌ Close</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <p>Challan No: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="badge">📄 DELIVERY DETAILS</div>
                <div class="info-row">
                    <div class="info-box">
                        <div class="info-title">📤 FROM COMPANY</div>
                        <div style="font-weight: bold; color: #2c3e50;">${val('from_company')}</div>
                        <div style="margin: 5px 0; line-height: 1.4;">${val('from_address')}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-title">📥 TO COMPANY</div>
                        <div style="font-weight: bold; color: #2c3e50;">${val('to_company')}</div>
                        <div style="margin: 5px 0; line-height: 1.4;">${val('to_address')}</div>
                    </div>
                </div>
                <div class="transport-bar">
                    <div style="margin-bottom: 10px; font-weight: bold;">🚛 TRANSPORT INFORMATION</div>
                    <div class="transport-grid">
                        <div><strong>Vehicle:</strong> ${val('vehicle_no')}</div>
                        <div><strong>Driver:</strong> ${val('driver_name')}</div>
                        <div><strong>Delivery Date:</strong> ${val('delivery_date')}</div>
                    </div>
                </div>
                <div class="badge">📦 GOODS DETAILS</div>
                <table class="product-table">
                    <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                    <tbody>
                        ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #8e44ad;">${i + 1}</td><td>${p.desc || ''}</td><td style="color: #3498db; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center;">${p.qty || 0}</td><td style="text-align:right;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="badge">📋 PACKAGING DETAILS</div>
                <table class="product-table">
                    <thead><tr><th>Carton#</th><th>Contents</th><th>Qty</th><th>Net Wt</th><th>Gross Wt</th><th>Dims</th><th>Vol Wt</th></tr></thead>
                    <tbody>
                        ${packages.map(p => `<tr><td style="font-weight: bold; color: #8e44ad;">${p.carton}</td><td>${p.desc}</td><td style="text-align: center;">${p.qty}</td><td style="text-align:right;">${p.net.toFixed(2)}</td><td style="text-align:right;">${p.gross.toFixed(2)}</td><td style="text-align: center;">${p.dims}</td><td style="text-align:right;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="summary-card">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; text-align: center;">
                        <div><div style="font-size: 32px; font-weight: bold;">${packages.length}</div><div>Total Packages</div></div>
                        <div><div style="font-size: 32px; font-weight: bold;">${totalNet.toFixed(2)}</div><div>Net Weight (KG)</div></div>
                        <div><div style="font-size: 32px; font-weight: bold;">${totalGross.toFixed(2)}</div><div>Gross Weight (KG)</div></div>
                    </div>
                </div>
                <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <div style="width: 220px; height: 70px; border: 2px dashed #8e44ad; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #8e44ad; font-style: italic;">Sender Signature & Stamp</div>
                        <div style="color: #8e44ad; font-weight: bold;">✍️ Authorized Sender</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 220px; height: 70px; border: 2px dashed #8e44ad; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #8e44ad; font-style: italic;">Receiver Signature & Stamp</div>
                        <div style="color: #8e44ad; font-weight: bold;">✍️ Authorized Receiver</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}
function generateDeliveryChallanDesign9(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { padding: 15px; font-size: 11px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .challan { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.2); max-width: 900px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%); padding: 30px; text-align: center; position: relative; }
        .header::before { content: '✨'; position: absolute; top: 20px; left: 30px; font-size: 24px; }
        .header::after { content: '✨'; position: absolute; top: 20px; right: 30px; font-size: 24px; }
        .header h1 { font-size: 26px; color: #2d3748; margin-bottom: 10px; font-weight: 300; letter-spacing: 1px; }
        .header p { color: #4a5568; font-size: 14px; }
        .content { padding: 35px; }
        .section { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 15px; margin: 20px 0; }
        .section-content { background: white; color: #2d3748; padding: 20px; border-radius: 10px; margin-top: 15px; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .info-card { background: #f7fafc; border-radius: 12px; padding: 20px; border-left: 5px solid #ff9a9e; }
        .info-label { color: #ff9a9e; font-weight: bold; font-size: 12px; margin-bottom: 5px; }
        .info-value { color: #2d3748; font-weight: 600; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .product-table th { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #2d3748; padding: 18px; text-align: left; font-weight: 600; }
        .product-table td { padding: 15px; border-bottom: 1px solid #e2e8f0; }
        .product-table tr:nth-child(even) { background: #f8fafc; }
        .product-table tr:hover { background: #edf2f7; }
        .summary-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-top: 25px; }
        .btn { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #2d3748; padding: 15px 30px; border: none; border-radius: 25px; margin: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        @media print { .no-print { display: none; } body { background: white; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Beautiful Challan</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #a0aec0, #718096);">❌ Close Window</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>DELIVERY CHALLAN & PACKAGING LIST</h1>
                <p>Challan No: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">🏢 COMPANY INFORMATION</div>
                    <div class="section-content">
                        <div class="info-grid">
                            <div class="info-card">
                                <div class="info-label">📤 FROM COMPANY</div>
                                <div class="info-value" style="font-size: 14px; margin-bottom: 8px;">${val('from_company')}</div>
                                <div style="line-height: 1.5; margin-bottom: 8px;">${val('from_address')}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">📥 TO COMPANY</div>
                                <div class="info-value" style="font-size: 14px; margin-bottom: 8px;">${val('to_company')}</div>
                                <div style="line-height: 1.5; margin-bottom: 8px;">${val('to_address')}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">🚛 LOGISTICS & TRANSPORT</div>
                    <div class="section-content">
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                            <div class="info-card">
                                <div class="info-label">Vehicle Number</div>
                                <div class="info-value" style="font-size: 16px;">${val('vehicle_no')}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Driver Name</div>
                                <div class="info-value" style="font-size: 16px;">${val('driver_name')}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Delivery Date</div>
                                <div class="info-value" style="font-size: 16px;">${val('delivery_date')}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">📦 GOODS & SERVICES</div>
                    <div class="section-content">
                        <table class="product-table">
                            <thead><tr><th>S.No</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                            <tbody>
                                ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #667eea;">${i + 1}</td><td style="font-weight: 500;">${p.desc || ''}</td><td style="color: #ff9a9e; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center; font-weight: 600;">${p.qty || 0}</td><td style="text-align:right; font-weight: 600;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold; color: #667eea;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">📋 PACKAGING BREAKDOWN</div>
                    <div class="section-content">
                        <table class="product-table">
                            <thead><tr><th>Carton#</th><th>Contents</th><th>Qty</th><th>Net Wt</th><th>Gross Wt</th><th>Dims</th><th>Vol Wt</th></tr></thead>
                            <tbody>
                                ${packages.map(p => `<tr><td style="font-weight: bold; color: #667eea;">${p.carton}</td><td style="font-weight: 500;">${p.desc}</td><td style="text-align: center; font-weight: 600;">${p.qty}</td><td style="text-align:right; font-weight: 600;">${p.net.toFixed(2)}</td><td style="text-align:right; font-weight: 600;">${p.gross.toFixed(2)}</td><td style="text-align: center;">${p.dims}</td><td style="text-align:right; font-weight: 600;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="summary-section">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; text-align: center;">
                        <div><div style="font-size: 36px; font-weight: bold;">${packages.length}</div><div style="font-size: 16px;">Total Packages</div></div>
                        <div><div style="font-size: 36px; font-weight: bold;">${totalNet.toFixed(2)}</div><div style="font-size: 16px;">Net Weight (KG)</div></div>
                        <div><div style="font-size: 36px; font-weight: bold;">${totalGross.toFixed(2)}</div><div style="font-size: 16px;">Gross Weight (KG)</div></div>
                    </div>
                </div>
                <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <div style="width: 250px; height: 80px; border: 3px dashed #ff9a9e; border-radius: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; color: #ff9a9e; font-style: italic; font-size: 14px;">Sender Signature & Company Seal</div>
                        <div style="color: #667eea; font-weight: bold; font-size: 16px;">✍️ Authorized Sender</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 250px; height: 80px; border: 3px dashed #ff9a9e; border-radius: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; color: #ff9a9e; font-style: italic; font-size: 14px;">Receiver Signature & Company Seal</div>
                        <div style="color: #667eea; font-weight: bold; font-size: 16px;">✍️ Authorized Receiver</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}
function generateDeliveryChallanDesign10(data, val, products, packages, totalNet, totalGross, totalVol) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Delivery Challan - ${val('challan_no')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Comic Sans MS', cursive; }
        body { padding: 20px; font-size: 12px; background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57); background-size: 400% 400%; animation: gradientShift 15s ease infinite; }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .challan { background: white; border-radius: 25px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 5px solid #ff6b6b; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%); color: white; padding: 30px; text-align: center; position: relative; }
        .header::before { content: '🎉'; position: absolute; top: 15px; left: 20px; font-size: 30px; animation: bounce 2s infinite; }
        .header::after { content: '🎉'; position: absolute; top: 15px; right: 20px; font-size: 30px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
        .header h1 { font-size: 28px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); animation: pulse 3s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        .content { padding: 30px; }
        .fun-section { background: linear-gradient(135deg, #feca57 0%, #ff9ff3 100%); border-radius: 20px; padding: 25px; margin: 20px 0; border: 3px dashed #ff6b6b; }
        .fun-title { font-size: 18px; font-weight: bold; color: #2d3436; margin-bottom: 15px; text-align: center; }
        .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .party-card { background: white; border-radius: 15px; padding: 20px; border: 3px solid #4ecdc4; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .party-title { color: #4ecdc4; font-weight: bold; font-size: 14px; margin-bottom: 10px; }
        .transport-fun { background: linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%); color: white; border-radius: 20px; padding: 20px; margin: 20px 0; }
        .product-table { width: 100%; border-collapse: collapse; border-radius: 15px; overflow: hidden; border: 3px solid #00b894; }
        .product-table th { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; padding: 15px; text-align: left; font-weight: bold; }
        .product-table td { padding: 12px; border-bottom: 2px solid #ddd; }
        .product-table tr:nth-child(even) { background: #f1f2f6; }
        .product-table tr:hover { background: #ddd; transform: scale(1.02); transition: all 0.3s; }
        .summary-fun { background: linear-gradient(135deg, #e17055 0%, #fdcb6e 100%); color: white; padding: 30px; border-radius: 20px; margin-top: 25px; border: 3px solid #e17055; }
        .btn { background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%); color: white; padding: 15px 30px; border: none; border-radius: 25px; margin: 8px; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transition: all 0.3s; }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
        @media print { .no-print { display: none; } body { background: white; animation: none; } }
    </style></head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" class="btn">🖨️ Print Fun Challan!</button>
            <button onclick="window.close()" class="btn" style="background: linear-gradient(135deg, #636e72, #2d3436);">❌ Close Fun Window</button>
        </div>
        <div class="challan">
            <div class="header">
                <h1>🎊 DELIVERY CHALLAN & PACKAGING LIST 🎊</h1>
                <p style="font-size: 16px;">Challan: ${val('challan_no')} • Date: ${val('challan_date')}</p>
            </div>
            <div class="content">
                <div class="fun-section">
                    <div class="fun-title">🏢 COMPANY PARTY! WHO'S SENDING & RECEIVING? 🏢</div>
                    <div class="party-grid">
                        <div class="party-card">
                            <div class="party-title">📤 FROM COMPANY (THE SENDER!)</div>
                            <div style="font-weight: bold; color: #2d3436; font-size: 14px; margin-bottom: 8px;">${val('from_company')}</div>
                            <div style="line-height: 1.5; margin-bottom: 8px;">${val('from_address')}</div>
                        </div>
                        <div class="party-card">
                            <div class="party-title">📥 TO COMPANY (THE LUCKY RECEIVER!)</div>
                            <div style="font-weight: bold; color: #2d3436; font-size: 14px; margin-bottom: 8px;">${val('to_company')}</div>
                            <div style="line-height: 1.5; margin-bottom: 8px;">${val('to_address')}</div>
                        </div>
                    </div>
                </div>
                <div class="transport-fun">
                    <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 15px;">🚛 TRANSPORT ADVENTURE! 🚛</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                        <div><strong>🚗 Vehicle:</strong><br><span style="font-size: 16px;">${val('vehicle_no')}</span></div>
                        <div><strong>👨‍✈️ Driver:</strong><br><span style="font-size: 16px;">${val('driver_name')}</span></div>
                        <div><strong>📅 Delivery:</strong><br><span style="font-size: 16px;">${val('delivery_date')}</span></div>
                    </div>
                </div>
                <div class="fun-section">
                    <div class="fun-title">📦 AWESOME GOODS LIST! 📦</div>
                    <table class="product-table">
                        <thead><tr><th>🔢 S.No</th><th>📝 What's This?</th><th>🏷️ HSN Code</th><th>📊 How Many?</th><th>💰 Price Each</th><th>💵 Total Cost</th></tr></thead>
                        <tbody>
                            ${products.map((p, i) => `<tr><td style="font-weight: bold; color: #00b894; font-size: 14px;">${i + 1}</td><td style="font-weight: 600;">${p.desc || ''}</td><td style="color: #e17055; font-weight: bold;">${p.hsn || ''}</td><td style="text-align: center; font-weight: 600;">${p.qty || 0}</td><td style="text-align:right; font-weight: 600;">₹${(p.rate || 0).toFixed(2)}</td><td style="text-align:right; font-weight: bold; color: #00b894; font-size: 14px;">₹${(p.amount || 0).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="fun-section">
                    <div class="fun-title">📋 SUPER COOL PACKAGING BREAKDOWN! 📋</div>
                    <table class="product-table">
                        <thead><tr><th>📦 Carton#</th><th>📝 What's Inside?</th><th>📊 Qty</th><th>⚖️ Net Wt</th><th>📏 Gross Wt</th><th>📐 Dimensions</th><th>🎈 Vol Wt</th></tr></thead>
                        <tbody>
                            ${packages.map(p => `<tr><td style="font-weight: bold; color: #00b894; font-size: 14px;">${p.carton}</td><td style="font-weight: 600;">${p.desc}</td><td style="text-align: center; font-weight: 600;">${p.qty}</td><td style="text-align:right; font-weight: 600;">${p.net.toFixed(2)}</td><td style="text-align:right; font-weight: 600;">${p.gross.toFixed(2)}</td><td style="text-align: center;">${p.dims}</td><td style="text-align:right; font-weight: 600;">${p.vol.toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="summary-fun">
                    <div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px;">📊 AMAZING SUMMARY! 📊</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; text-align: center;">
                        <div><div style="font-size: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${packages.length}</div><div style="font-size: 16px;">🎁 Total Packages</div></div>
                        <div><div style="font-size: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${totalNet.toFixed(2)}</div><div style="font-size: 16px;">⚖️ Net Weight (KG)</div></div>
                        <div><div style="font-size: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${totalGross.toFixed(2)}</div><div style="font-size: 16px;">📏 Gross Weight (KG)</div></div>
                    </div>
                </div>
                <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <div style="width: 280px; height: 90px; border: 4px dashed #ff6b6b; border-radius: 20px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; color: #ff6b6b; font-style: italic; font-size: 16px; font-weight: bold;">🖋️ Sender Sign Here! 🖋️</div>
                        <div style="color: #4ecdc4; font-weight: bold; font-size: 18px;">✍️ The Sender Boss!</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 280px; height: 90px; border: 4px dashed #ff6b6b; border-radius: 20px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; color: #ff6b6b; font-style: italic; font-size: 16px; font-weight: bold;">🖋️ Receiver Sign Here! 🖋️</div>
                        <div style="color: #4ecdc4; font-weight: bold; font-size: 18px;">✍️ The Receiver Boss!</div>
                    </div>
                </div>
            </div>
        </div>
    </body></html>`;
}