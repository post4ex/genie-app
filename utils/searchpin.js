import { PINCODE } from '../assets/Network/network-data.map.min.js';

// State code mapping: 2-letter code -> { name, gstCode }
export const STATE_MAP = {
    'JK': { name: 'JAMMU AND KASHMIR', gstCode: '01' },
    'HP': { name: 'HIMACHAL PRADESH', gstCode: '02' },
    'PB': { name: 'PUNJAB', gstCode: '03' },
    'CH': { name: 'CHANDIGARH', gstCode: '04' },
    'UK': { name: 'UTTARAKHAND', gstCode: '05' },
    'HR': { name: 'HARYANA', gstCode: '06' },
    'DL': { name: 'DELHI', gstCode: '07' },
    'RJ': { name: 'RAJASTHAN', gstCode: '08' },
    'UP': { name: 'UTTAR PRADESH', gstCode: '09' },
    'BR': { name: 'BIHAR', gstCode: '10' },
    'SK': { name: 'SIKKIM', gstCode: '11' },
    'AR': { name: 'ARUNACHAL PRADESH', gstCode: '12' },
    'NL': { name: 'NAGALAND', gstCode: '13' },
    'MN': { name: 'MANIPUR', gstCode: '14' },
    'MZ': { name: 'MIZORAM', gstCode: '15' },
    'TR': { name: 'TRIPURA', gstCode: '16' },
    'ML': { name: 'MEGHALAYA', gstCode: '17' },
    'AS': { name: 'ASSAM', gstCode: '18' },
    'WB': { name: 'WEST BENGAL', gstCode: '19' },
    'JH': { name: 'JHARKHAND', gstCode: '20' },
    'OR': { name: 'ODISHA', gstCode: '21' },
    'CG': { name: 'CHHATTISGARH', gstCode: '22' },
    'MP': { name: 'MADHYA PRADESH', gstCode: '23' },
    'GJ': { name: 'GUJARAT', gstCode: '24' },
    'DD': { name: 'DAMAN AND DIU', gstCode: '25' },
    'DN': { name: 'DADRA AND NAGAR HAVELI', gstCode: '26' },
    'MH': { name: 'MAHARASHTRA', gstCode: '27' },
    'KA': { name: 'KARNATAKA', gstCode: '29' },
    'GA': { name: 'GOA', gstCode: '30' },
    'LD': { name: 'LAKSHADWEEP', gstCode: '31' },
    'KL': { name: 'KERALA', gstCode: '32' },
    'TN': { name: 'TAMIL NADU', gstCode: '33' },
    'PY': { name: 'PUDUCHERRY', gstCode: '34' },
    'AN': { name: 'ANDAMAN AND NICOBAR ISLANDS', gstCode: '35' },
    'TS': { name: 'TELANGANA', gstCode: '36' },
    'AP': { name: 'ANDHRA PRADESH', gstCode: '37' },
    'LA': { name: 'LADAKH', gstCode: '38' }
};

/**
 * Get state info from 2-letter state code
 * @param {string} stateCode - 2-letter state code (e.g., 'DL', 'HR')
 * @returns {object} { code, name, gstCode } or null if not found
 */
export function getStateInfo(stateCode) {
    const info = STATE_MAP[stateCode];
    if (!info) return null;
    return {
        code: stateCode,
        name: info.name,
        gstCode: info.gstCode
    };
}

/**
 * Look up a 6-digit pincode from the local network map.
 * Falls back to public API if not found locally.
 *
 * Returns an object on hit:
 *   { found: true, CITY, STATE, STATE_CODE, STATE_NAME, GST_CODE, ZONE, ODA, EXPRESS_TAT, AIRLINE_TAT, SURFACE_TAT, PREMIUM_TAT }
 *
 * TAT values are numbers when serviceable, or "N" when not.
 * Returns { found: false } when pincode is not found in either source.
 */
export function getPincodeCount() {
    return PINCODE.size;
}

export async function searchCity(city) {
    const query = String(city || '').trim();
    if (query.length < 3) return [];

    try {
        const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(query)}`);
        const data = await res.json();
        const offices = data?.[0]?.Status === 'Success' && Array.isArray(data[0].PostOffice)
            ? data[0].PostOffice
            : [];
        return offices.map((office) => ({
            NAME: office.Name || office.Name,
            PINCODE: office.Pincode,
            DISTRICT: office.District,
            STATE: office.State,
            BRANCH_TYPE: office.BranchType,
            DELIVERY_STATUS: office.DeliveryStatus,
        }));
    } catch (error) {
        console.warn('City search API fallback failed:', error);
        return [];
    }
}

export async function searchPin(pincode) {
    const pin = String(pincode).trim();
    
    // Try local network map first
    const entry = PINCODE.get(pin);
    if (entry) {
        const [CITY, STATE_CODE, ZONE, ODA, EXPRESS_TAT, AIRLINE_TAT, SURFACE_TAT, PREMIUM_TAT] = entry;
        const stateInfo = getStateInfo(STATE_CODE);
        return {
            found: true,
            CITY,
            STATE: stateInfo?.name || STATE_CODE,
            STATE_CODE,
            STATE_NAME: stateInfo?.name || STATE_CODE,
            GST_CODE: stateInfo?.gstCode || '',
            ZONE,
            ODA,
            EXPRESS_TAT,
            AIRLINE_TAT,
            SURFACE_TAT,
            PREMIUM_TAT
        };
    }

    // Fallback to public API
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
            const po = data[0].PostOffice[0];
            // Match state name — normalize to plain uppercase, treating & and AND as equivalent
            const normalize = s => s.toUpperCase().replace(/&/g, 'AND').replace(/\s+/g, ' ').trim();
            const apiState = normalize(po.State);
            let stateCode = '';
            let gstCode = '';
            let stateName = po.State.toUpperCase();
            for (const [code, info] of Object.entries(STATE_MAP)) {
                if (normalize(info.name) === apiState) {
                    stateCode = code;
                    gstCode = info.gstCode;
                    stateName = info.name;
                    break;
                }
            }
            return {
                found: true,
                CITY: po.District.toUpperCase(),
                STATE: stateName,
                STATE_CODE: stateCode,
                STATE_NAME: stateName,
                GST_CODE: gstCode,
                ZONE: null,
                ODA: null,
                EXPRESS_TAT: null,
                AIRLINE_TAT: null,
                SURFACE_TAT: null,
                PREMIUM_TAT: null
            };
        }
    } catch (err) {
        console.warn('Pincode API fallback failed:', err);
    }

    return { found: false };
}
