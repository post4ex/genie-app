const GEONAMES_BASE = 'https://secure.geonames.org';
const GEONAMES_USER = 'aruntomar';
const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

async function cachedJson(url, key = url) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.value;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const value = await response.json();
  cache.set(key, { time: Date.now(), value });
  return value;
}

export async function getCountryNames(codes) {
  const names = {};
  await Promise.all((codes || []).map(async (code) => {
    try {
      const data = await cachedJson(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=name`, `country:${code}`);
      names[code] = data?.[0]?.name?.common || data?.name?.common || code;
    } catch (_) {
      names[code] = code;
    }
  }));
  return names;
}

function mergeLocation(item, isPostal) {
  const city = isPostal ? item.placeName : item.name;
  const country = item.countryCode || '';
  if (!city || !country) return null;
  return {
    city,
    state: item.adminName1 || '',
    country,
    lat: item.lat,
    lng: item.lng,
  };
}

export async function searchGlobalZip(zip) {
  const value = String(zip || '').trim().replace(/\s/g, '');
  if (!value) return [];

  const [postal, general] = await Promise.all([
    cachedJson(`${GEONAMES_BASE}/postalCodeSearchJSON?postalcode=${encodeURIComponent(value)}&maxRows=100&username=${GEONAMES_USER}`, `postal:${value}`),
    cachedJson(`${GEONAMES_BASE}/searchJSON?q=${encodeURIComponent(value)}&maxRows=100&username=${GEONAMES_USER}`, `search:${value}`),
  ]);

  const seen = new Set();
  const merged = [];
  for (const item of postal?.postalCodes || []) {
    const location = mergeLocation(item, true);
    if (!location) continue;
    const key = `${location.country}-${location.city}-${location.state}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); merged.push(location); }
  }
  for (const item of general?.geonames || []) {
    const location = mergeLocation(item, false);
    if (!location) continue;
    const key = `${location.country}-${location.city}-${location.state}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); merged.push(location); }
  }
  return merged;
}

export async function resolveGlobalLocation(location) {
  if (!location?.country) throw new Error('A country must be selected.');
  const countryData = await cachedJson(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(location.country)}`, `country-full:${location.country}`);
  const country = countryData?.[0] || countryData || {};
  const currencies = country.currencies || {};
  const currencyCode = Object.keys(currencies)[0] || location.country;
  const currency = currencies[currencyCode] || {};

  const nearbyUrl = `${GEONAMES_BASE}/findNearbyJSON?lat=${encodeURIComponent(location.lat)}&lng=${encodeURIComponent(location.lng)}&featureCode=AIRP&featureCode=PRT&radius=150&maxRows=1&username=${GEONAMES_USER}`;
  const ratesUrl = 'https://open.er-api.com/v6/latest/USD';
  const [nearby, rates] = await Promise.all([
    cachedJson(nearbyUrl, `nearby:${location.lat}:${location.lng}`),
    cachedJson(ratesUrl, 'rates:USD'),
  ]);

  const hub = nearby?.geonames?.[0];
  const rateVsUsd = Number(rates?.rates?.[currencyCode]);
  const inrRateVsUsd = Number(rates?.rates?.INR);
  const conversion = rateVsUsd && inrRateVsUsd ? (rateVsUsd / inrRateVsUsd).toFixed(4) : null;

  return {
    ...location,
    countryName: country.name?.common || location.country,
    port: hub ? `${hub.name} (${hub.fcode === 'AIRP' ? 'AIR' : 'SEA'})` : 'No Hub found',
    inr: conversion ? `1 INR = ${conversion} ${currencyCode}` : 'Rate unavailable',
    usd: Number.isFinite(rateVsUsd) ? `1 USD = ${rateVsUsd.toFixed(4)} ${currencyCode}` : 'Rate unavailable',
    ram: Number.isFinite(rateVsUsd) ? `${currency.symbol || currencyCode} ${rateVsUsd.toFixed(2)} (RAM)` : 'Rate unavailable',
  };
}
