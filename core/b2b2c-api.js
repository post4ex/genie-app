// B2B2C API — payload builders + callApi wrappers

async function b2b2cCreate(data) {
    ['EXPRESS_TAT', 'AIRLINE_TAT', 'SURFACE_TAT', 'PREMIUM_TAT'].forEach(f => {
        data[f] = parseFloat(data[f]) || 0;
    });
    return await callApi('/api/writeB2B2C', data, 'POST');
}

async function b2b2cUpdate(uid, { MOBILE, EMAIL, ADDRESS, CARRIER }) {
    return await callApi('/api/updateB2B2C', { UID: uid, MOBILE, EMAIL, ADDRESS, CARRIER }, 'PATCH');
}

async function b2b2cDelete(uid) {
    return await callApi('/api/deleteB2B2C', { UID: uid }, 'DELETE');
}
