/**
 * ============================================================================
 * formatIST.js — IST Date Formatting Utility
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a single global function `fmtDate(val, format)` that handles ALL
 * date/time formatting needs across the app. Raw data is stored as-is in
 * IndexedDB and formatted on-demand using this function.
 *
 * WHY A SEPARATE FILE:
 * Previously each page had its own local formatDate / formatDateForDisplay
 * function with inconsistent logic. This centralises everything in one place.
 * applyDateFormatting() has been removed from the sync pipeline — it was
 * slowing down sync and corrupting sort/filter operations by converting raw
 * values before they were used.
 *
 * ============================================================================
 * RAW DATA FORMATS COMING FROM THE DATABASE:
 * ============================================================================
 *
 *  TIME_STAMP   → Unix milliseconds as string  e.g. "1737123456789"
 *  ORDER_DATE   → YYYY-MM-DD string            e.g. "2025-01-17"
 *  TRANSIT_DATE → YYYY-MM-DD string            e.g. "2025-01-18"
 *  INVOICE_DATE → YYYY-MM-DD string            e.g. "2025-01-17"
 *  BOOKING_DATE → YYYY-MM-DD string            e.g. "2025-01-17"
 *  ATTEN_DATE   → YYYY-MM-DD string            e.g. "2025-01-17"
 *  DATE_BIRTH   → YYYY-MM-DD string            e.g. "1990-05-20"
 *  DATE_JOIN    → YYYY-MM-DD string            e.g. "2022-03-01"
 *  DATE_LEAVE   → YYYY-MM-DD string            e.g. "2024-12-31"
 *  DATE_TIME    → ISO string or Unix ms        e.g. "2025-01-17T10:30:00Z"
 *
 * ============================================================================
 * OUTPUT FORMATS — fmtDate(val, format):
 * ============================================================================
 *
 *  'display'  → DD-MM-YY           e.g. "17-01-25"   ← default, use in tables/lists
 *  'full'     → DD-MM-YYYY HH:MM   e.g. "17-01-2025 15:30"  ← use for timestamps
 *  'date'     → DD-MM-YYYY         e.g. "17-01-2025"  ← use when year clarity needed
 *  'input'    → YYYY-MM-DD         e.g. "2025-01-17"  ← use for <input type="date">
 *  'time'     → HH:MM              e.g. "15:30"        ← use for time-only display
 *  'sort'     → YYYY-MM-DD         e.g. "2025-01-17"  ← use for sorting (same as input)
 *
 * ============================================================================
 * HOW TO USE:
 * ============================================================================
 *
 *  // In a table cell — compact date
 *  td.textContent = fmtDate(order.ORDER_DATE);
 *
 *  // Timestamp with time
 *  span.textContent = fmtDate(order.TIME_STAMP, 'full');
 *
 *  // Populate a date input
 *  input.value = fmtDate(order.ORDER_DATE, 'input');
 *
 *  // Set today's date on a date input
 *  input.value = fmtDate(new Date(), 'input');
 *
 *  // Time only from a timestamp
 *  span.textContent = fmtDate(order.TIME_STAMP, 'time');
 *
 *  // Sorting — use parseDate() for reliable comparison across all raw formats
 *  orders.sort((a, b) => (parseDate(b.ORDER_DATE)?.getTime() || 0) - (parseDate(a.ORDER_DATE)?.getTime() || 0));
 *
 * ============================================================================
 * REVERSE — fromIST(displayStr):
 * ============================================================================
 *
 * Converts a display string back to YYYY-MM-DD for sending to the server.
 *
 *  fromIST("17-01-25")        → "2025-01-17"
 *  fromIST("17-01-2025")      → "2025-01-17"
 *  fromIST("17-01-2025 15:30")→ "2025-01-17"
 *
 * ============================================================================
 */

(function () {

    // Internal IST formatter for timestamps (Unix ms or ISO strings)
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

    /**
     * Parse any supported raw value into a Date object.
     * Handles: Unix ms string/number, YYYY-MM-DD, ISO string, Date object.
     */
    function _parse(val) {
        if (!val && val !== 0) return null;
        if (val instanceof Date) return isNaN(val) ? null : val;

        // Unix milliseconds (number or numeric string > 10 digits)
        if (typeof val === 'number' || (typeof val === 'string' && /^\d{10,}(\.\d+)?$/.test(val.trim()))) {
            const d = new Date(Math.trunc(Number(val)));
            return isNaN(d) ? null : d;
        }

        // YYYY-MM-DD — parse as UTC to avoid timezone shift
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
            const d = new Date(val.trim() + 'T00:00:00Z');
            return isNaN(d) ? null : d;
        }

        // ISO string or any other string — let Date parse it
        const d = new Date(val);
        return isNaN(d) ? null : d;
    }

    /**
     * fmtDate(val, format)
     *
     * @param {string|number|Date} val    — raw value from DB or JS Date
     * @param {string}             format — 'display' | 'full' | 'date' | 'input' | 'time' | 'sort'
     * @returns {string}
     */
    window.fmtDate = function (val, format = 'display') {
        if (!val && val !== 0) return 'N/A';

        const d = _parse(val);
        if (!d) return 'N/A';

        // For YYYY-MM-DD inputs (no time component), use UTC methods to avoid day shift
        const isDateOnly = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());

        const getDay   = () => isDateOnly ? String(d.getUTCDate()).padStart(2, '0')        : String(d.getDate()).padStart(2, '0');
        const getMon   = () => isDateOnly ? String(d.getUTCMonth() + 1).padStart(2, '0')  : String(d.getMonth() + 1).padStart(2, '0');
        const getYear  = () => isDateOnly ? String(d.getUTCFullYear())                     : String(d.getFullYear());
        const getYear2 = () => getYear().slice(-2);

        if (format === 'input' || format === 'sort') {
            // Always return YYYY-MM-DD
            if (isDateOnly) return val.trim();
            // For timestamps, convert to IST date
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

        // default: 'display' → DD-MM-YY
        return `${getDay()}-${getMon()}-${getYear2()}`;
    };

    /**
     * fromIST(displayStr)
     *
     * Converts a formatted display string back to YYYY-MM-DD.
     * Use this before sending a date value back to the server.
     *
     * @param {string} displayStr — e.g. "17-01-25", "17-01-2025", "17-01-2025 15:30"
     * @returns {string} YYYY-MM-DD or empty string if unparseable
     */
    window.fromIST = function (displayStr) {
        if (!displayStr) return '';
        // Strip time part if present
        const datePart = displayStr.trim().split(' ')[0];
        const parts    = datePart.split('-');
        if (parts.length !== 3) return '';

        const day  = parts[0].padStart(2, '0');
        const mon  = parts[1].padStart(2, '0');
        let   year = parts[2];

        // Handle 2-digit year — assume 2000s
        if (year.length === 2) year = '20' + year;

        return `${year}-${mon}-${day}`;
    };

    /**
     * toUnix(dateStr)
     *
     * Converts a YYYY-MM-DD string to Unix milliseconds (UTC midnight).
     * Use this before sending date values to the server.
     *
     * @param {string} dateStr — e.g. "2025-01-17"
     * @returns {number} Unix ms or 0 if unparseable
     */
    window.toUnix = function (dateStr) {
        if (!dateStr) return 0;
        const d = _parse(dateStr);
        return d ? d.getTime() : 0;
    };

    // parseDate — expose _parse publicly so any module can get a Date object
    // from any raw value (Unix ms, YYYY-MM-DD, ISO string, Date object)
    window.parseDate = function (val) {
        return _parse(val);
    };

})();
