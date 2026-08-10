// invoice-utils.js — INVOICE_ID generation at booking time
// BILL_CYCLE: E=each, D=daily, W=weekly, F=fortnightly, M=monthly

export function generateInvoiceId(code, billCycle, orderDateUnix, isTopay) {
    if (!code || !billCycle) return '';
    if (billCycle === 'E') return '';

    const ms = orderDateUnix > 1e10 ? orderDateUnix : orderDateUnix * 1000;
    const d  = new Date(ms);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);

    let base = '';
    if (billCycle === 'D') base = `${code}-${dd}-${mm}-${yy}`;
    else if (billCycle === 'M') base = `${code}-${mm}-${yy}`;
    else if (billCycle === 'F') {
        const half = d.getUTCDate() <= 15 ? 'F1' : 'F2';
        base = `${code}-${half}-${mm}-${yy}`;
    } else if (billCycle === 'W') {
        const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
        const ww   = String(Math.ceil(((d - jan4) / 86400000 + jan4.getUTCDay() + 1) / 7)).padStart(2, '0');
        base = `${code}-W${ww}-${yy}`;
    }

    return base ? (isTopay ? `${base}-TOPAY` : base) : '';
}
