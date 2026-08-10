// core/assign-carrier-api.js
// API wrapper for AssignCarrier.html

async function updateOrder(reference, fields) {
    return await callApi('/api/updateOrder', { reference, ...fields }, 'PATCH');
}
