export function calculateFreight(transportType, rate, addRate, weightCeiling, weightZone) {
    if (isNaN(rate) || isNaN(weightCeiling)) return 0;

    let fright = 0;

    if (transportType === 'E' || transportType === 'P') {
        fright = !isNaN(addRate) ? rate + ((weightCeiling * 2) - 1) * addRate : rate;
    } else {
        fright = (!isNaN(addRate) && !isNaN(weightZone))
            ? rate + ((weightCeiling - weightZone) * addRate)
            : weightCeiling * rate;
    }
    return fright > 0 ? fright : 0;
}

export function getHelperTableData(chgWt, selectedCustomerDetails, transportType, receiverZone, ratesData) {
    let weightCeiling = 0;
    const weightChange = parseFloat(selectedCustomerDetails.WEIGHT_CHANGE);

    if (!isNaN(weightChange) && chgWt <= weightChange) {
        weightCeiling = Math.ceil(chgWt * 2) / 2;
    } else {
        weightCeiling = Math.ceil(chgWt);
    }

    let weightZone = '---';
    if (transportType) {
        if (transportType === 'E' || transportType === 'P') {
            weightZone = 0.5;
        } else {
            const zoneThresholds = [3, 10, 25, 50, 100, 500, 1000];
            let calculatedZone = 0;
            for (const threshold of zoneThresholds) {
                if (weightCeiling >= threshold) calculatedZone = threshold;
                else break;
            }
            weightZone = calculatedZone;
        }
    }

    let rateUid = '---';
    const customerCode = selectedCustomerDetails.CODE;
    if (customerCode && transportType && weightZone !== '---') {
        rateUid = customerCode + transportType + weightZone;
    }

    let rate = '---', addRate = '---';
    if (rateUid !== '---' && receiverZone && ratesData) {
        const rateRow = ratesData[rateUid];
        if (rateRow && rateRow[receiverZone]) rate = rateRow[receiverZone];
        const addRateRow = ratesData[rateUid + 'A'];
        if (addRateRow && addRateRow[receiverZone]) addRate = addRateRow[receiverZone];
    }

    return {
        weight_ceiling: weightCeiling.toFixed(2),
        weight_zone:    weightZone,
        rate_uid:       rateUid,
        rate:           rate,
        add_rate:       addRate
    };
}

export function calculateAllCharges(frightValue, summaryTotals, selectedCustomerDetails, paymentCheckboxes, consignmentProducts, chgWt, branchesData) {
    const totalValue    = summaryTotals.totalAmount;
    const codCheckbox   = paymentCheckboxes.cod;
    const topayCheckbox = paymentCheckboxes.topay;
    const fovCheckbox   = paymentCheckboxes.fov;

    let codCharge = 0, topayCharge = 0, fovCharge = 0, awbCharge = 0,
        fuelCharge = 0, ewayCharge = 0, packCharge = 0, devCharge = 0;

    if (Object.keys(selectedCustomerDetails).length > 0) {
        if (codCheckbox && codCheckbox.checked && selectedCustomerDetails['PCT_COD_IF'])
            codCharge = Math.max(150, totalValue * parseFloat(selectedCustomerDetails['PCT_COD_IF']));
        if (topayCheckbox && topayCheckbox.checked && selectedCustomerDetails['PCT_TOPAY_IF'])
            topayCharge = Math.max(150, frightValue * parseFloat(selectedCustomerDetails['PCT_TOPAY_IF']));
        if (fovCheckbox && fovCheckbox.checked && selectedCustomerDetails['PCT_FOV_IF'])
            fovCharge = Math.max(100, totalValue * parseFloat(selectedCustomerDetails['PCT_FOV_IF']));

        awbCharge  = parseFloat(selectedCustomerDetails['AWB_CHARGES'])    || 0;
        fuelCharge = frightValue * (parseFloat(selectedCustomerDetails['FUEL_CHARGES'])   || 0);
        ewayCharge = consignmentProducts.filter(p => p.type === 'EWB').length * (parseFloat(selectedCustomerDetails['EWAY_IF']) || 0);
        packCharge = chgWt * (parseFloat(selectedCustomerDetails['PACKING_CHARGES']) || 0);
        devCharge  = frightValue * (parseFloat(selectedCustomerDetails['DEV_CHARGES'])    || 0);
    }

    const otherCharges  = fuelCharge + codCharge + topayCharge + fovCharge + ewayCharge + awbCharge + packCharge + devCharge;
    const subtotal      = frightValue + otherCharges;
    let taxableAmount = 0, sgst = 0, cgst = 0, igst = 0, total = 0;

    let isWithinState = false;
    const customerGstCode = selectedCustomerDetails.GST_CODE;
    if (customerGstCode && branchesData) {
        const branchCode = selectedCustomerDetails.BRANCH;
        if (branchCode) {
            const branch = Object.values(branchesData).find(b => b.BRANCH_CODE === branchCode);
            const branchGstCode = branch?.GST_CODE;
            if (branchGstCode && branchGstCode === customerGstCode) {
                isWithinState = true;
            }
        }
    }

    if (selectedCustomerDetails.GST_INC === 'Y') {
        taxableAmount = subtotal;
        if (isWithinState) {
            const totalTax = taxableAmount / 1.18 * 0.18;
            sgst = cgst = totalTax / 2;
        } else {
            igst = taxableAmount / 1.18 * 0.18;
        }
        total = taxableAmount;
    } else {
        taxableAmount = subtotal;
        if (isWithinState) {
            sgst = cgst = taxableAmount * 0.09;
        } else {
            igst = taxableAmount * 0.18;
        }
        total = taxableAmount + sgst + cgst + igst;
    }

    return {
        fright:    frightValue.toFixed(2),
        other_chg: otherCharges.toFixed(2),
        gst_total: (sgst + cgst + igst).toFixed(2),
        total:     total.toFixed(2),
        fuel_chg:  fuelCharge.toFixed(2),
        cod_chg:   codCharge.toFixed(2),
        topay_chg: topayCharge.toFixed(2),
        fov_chg:   fovCharge.toFixed(2),
        eway_chg:  ewayCharge.toFixed(2),
        awb_chg:   awbCharge.toFixed(2),
        pack_chg:  packCharge.toFixed(2),
        dev_chg:   devCharge.toFixed(2),
        taxable:   taxableAmount.toFixed(2),
        sgst:      sgst.toFixed(2),
        cgst:      cgst.toFixed(2),
        igst:      igst.toFixed(2)
    };
}

export function recalculateAllBoxWeights(consignmentBoxes, volIngr) {
    const volDivisor = volIngr || 4700;
    consignmentBoxes.forEach(box => {
        box.volWeight    = (box.length * box.breadth * box.height) / volDivisor;
        box.chargeWeight = Math.max(box.actualWeight, box.volWeight);
    });
    return consignmentBoxes;
}
