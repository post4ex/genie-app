/**
 * ============================================================================
 * formatIST.js — IST Date Formatting Utility
 * Ported from GENIE_WEB/core/formatIST.js
 * ============================================================================
 */

const _istFull = new Intl.DateTimeFormat('en-GB', {
    timeZone:  'Asia/Kolkata',
    hour12:    false,
    year:      'numeric',
    month:     '2-digit',
    day:       '2-digit',
    hour:      '2-digit',
    minute:    '2-digit'
});

const _istDateOnly = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit'
});

export function parseDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date) return isNaN(val) ? null : val;

    if (typeof val === 'number' || (typeof val === 'string' && /^\d{10,}(\.\d+)?$/.test(val.trim()))) {
        let num = Math.trunc(Number(val));
        if (num > 0 && num < 1e11) num *= 1000;
        const d = new Date(num);
        return isNaN(d) ? null : d;
    }

    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        const d = new Date(val.trim() + 'T00:00:00Z');
        return isNaN(d) ? null : d;
    }

    const d = new Date(val);
    return isNaN(d) ? null : d;
}

export function fmtDate(val, format = 'display') {
    if (!val && val !== 0) return 'N/A';

    const d = parseDate(val);
    if (!d) return 'N/A';

    const isDateOnly = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());

    const getDay   = () => isDateOnly ? String(d.getUTCDate()).padStart(2, '0')        : String(d.getDate()).padStart(2, '0');
    const getMon   = () => isDateOnly ? String(d.getUTCMonth() + 1).padStart(2, '0')  : String(d.getMonth() + 1).padStart(2, '0');
    const getYear  = () => isDateOnly ? String(d.getUTCFullYear())                     : String(d.getFullYear());
    const getYear2 = () => getYear().slice(-2);

    if (format === 'input' || format === 'sort') {
        if (isDateOnly) return val.trim();
        const parts = _istDateOnly.formatToParts(d);
        const p = {};
        parts.forEach(({ type, value }) => { p[type] = value; });
        return `${p.year}-${p.month}-${p.day}`;
    }

    if (format === 'time') {
        if (isDateOnly) return '00:00';
        const parts = _istFull.formatToParts(d);
        const p = {};
        parts.forEach(({ type, value }) => { p[type] = value; });
        return `${p.hour}:${p.minute}`;
    }

    if (format === 'full') {
        if (isDateOnly) return `${getDay()}-${getMon()}-${getYear()} 00:00`;
        const parts = _istFull.formatToParts(d);
        const p = {};
        parts.forEach(({ type, value }) => { p[type] = value; });
        return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
    }

    if (format === 'date') {
        return `${getDay()}-${getMon()}-${getYear()}`;
    }

    return `${getDay()}-${getMon()}-${getYear2()}`;
}

export function fromIST(displayStr) {
    if (!displayStr) return '';
    const datePart = displayStr.trim().split(' ')[0];
    const parts    = datePart.split('-');
    if (parts.length !== 3) return '';

    const day  = parts[0].padStart(2, '0');
    const mon  = parts[1].padStart(2, '0');
    let   year = parts[2];

    if (year.length === 2) year = '20' + year;

    return `${year}-${mon}-${day}`;
}

export function toUnix(dateStr) {
    if (!dateStr) return 0;
    const d = parseDate(dateStr);
    return d ? d.getTime() : 0;
}
