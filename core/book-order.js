// ============================================================================
// BOOK-ORDER.JS (core) — Booking API: payload builder + API call
// ============================================================================

function buildBookingPayload(consignmentBoxes, consignmentProducts, summaryTotals, orderDateInput, billCycle) {
    const code      = document.getElementById('display_code').textContent || '';
    const orderDate = toUnix(orderDateInput.value);

    // Helper to convert "---" to appropriate values
    const cleanValue = (val, type = 'string') => {
        if (val === '---' || val === undefined || val === null) {
            if (type === 'number') return 0;
            if (type === 'float') return 0.0;
            return '';
        }
        if (type === 'number' || type === 'float') {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        }
        return val;
    };

    const orderData = {
        INVOICE_ID:     generateInvoiceId(code, billCycle || '', orderDate, document.getElementById('payment_topay')?.checked),
        CODE:           code,
        BRANCH:         cleanValue(document.getElementById('display_branch').textContent),
        ORDER_DATE:     orderDate,
        CARRIER:        cleanValue(document.getElementById('display_carrier').textContent),
        AWB_NUMBER:     document.getElementById('awb').value.trim(),
        TRANSIT_DATE:   toUnix(orderDateInput.value),
        CONSIGNOR:      cleanValue(document.getElementById('display_consignor').textContent),
        ORIGIN_CITY:    cleanValue(document.getElementById('display_origin_city').textContent),
        ORIGIN_PINCODE: cleanValue(document.getElementById('display_origin_pincode').textContent),
        CONSIGNEE:      cleanValue(document.getElementById('display_consignee').textContent),
        DEST_CITY:      cleanValue(document.getElementById('display_dest_city').textContent),
        DEST_PINCODE:   cleanValue(document.getElementById('display_dest_pincode').textContent),
        TAT:            cleanValue(document.getElementById('display_tat').textContent),
        ZONE:           cleanValue(document.getElementById('display_zone').textContent),
        MODE:           cleanValue(document.getElementById('display_mode').textContent),
        GLOBAL:         cleanValue(document.getElementById('display_global').textContent),
        COD:            cleanValue(document.getElementById('display_cod').textContent),
        TOPAY:          cleanValue(document.getElementById('display_topay').textContent),
        FOV:            cleanValue(document.getElementById('display_fov').textContent),
        WEIGHT:         cleanValue(document.getElementById('display_weight').textContent, 'float'),
        CHG_WT:         cleanValue(document.getElementById('display_chg_wt').textContent, 'float'),
        PIECS:          cleanValue(document.getElementById('display_pieces').textContent, 'number'),
        VALUE:          summaryTotals.totalAmount || 0,
        FRIGHT:         cleanValue(document.getElementById('display_fright').textContent, 'float'),
        FUEL_CHG:       cleanValue(document.getElementById('display_fuel_chg').textContent, 'float'),
        COD_CHG:        cleanValue(document.getElementById('display_cod_chg').textContent, 'float'),
        TOPAY_CHG:      cleanValue(document.getElementById('display_topay_chg').textContent, 'float'),
        FOV_CHG:        cleanValue(document.getElementById('display_fov_chg').textContent, 'float'),
        EWAY_CHG:       cleanValue(document.getElementById('display_eway_chg').textContent, 'float'),
        AWB_CHG:        cleanValue(document.getElementById('display_awb_chg').textContent, 'float'),
        PACK_CHG:       cleanValue(document.getElementById('display_pack_chg').textContent, 'float'),
        DEV_CHG:        cleanValue(document.getElementById('display_dev_chg').textContent, 'float'),
        TAXABLE:        cleanValue(document.getElementById('display_taxable').textContent, 'float'),
        SGST:           cleanValue(document.getElementById('display_sgst').textContent, 'float'),
        CGST:           cleanValue(document.getElementById('display_cgst').textContent, 'float'),
        IGST:           cleanValue(document.getElementById('display_igst').textContent, 'float'),
        TOTAL:          cleanValue(document.getElementById('display_total').textContent, 'float'),
    };

    return {
        order: orderData,
        multibox: consignmentBoxes.map(box => ({
            WEIGHT:  box.actualWeight,
            LENGTH:  box.length,
            BREADTH: box.breadth,
            HIGHT:   box.height,
            VOLUME:  box.volWeight,
            CHG_WT:  box.chargeWeight
        })),
        products: consignmentProducts.map(p => ({
                DOC_NUMBER: p.docNo,
                DOC_TYPE:   p.type,
                PRODUCT:    p.name,
                AMOUNT:     p.amount || 0,
                EWAY_IF:    p.ewayBill || ''
            }))
    };
}

async function submitBookOrder(payload) {
    return await callApi('/api/bookOrder', payload);
}

function buildEditPayload(consignmentBoxes, consignmentProducts, summaryTotals, orderDateInput, reference, billCycle) {
    const payload = buildBookingPayload(consignmentBoxes, consignmentProducts, summaryTotals, orderDateInput, billCycle);
    payload.order.REFERENCE    = reference;
    payload.deleteMultibox     = true;
    payload.deleteProducts     = true;
    return payload;
}

async function submitEditOrder(payload) {
    return await callApi('/api/editOrder', payload, 'PUT');
}

async function deleteOrder(reference) {
    return await callApi('/api/deleteOrder', { reference }, 'DELETE');
}
