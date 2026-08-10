/**
 * docs-api.js
 * API utilities for auto-populating location data based on pincode/zipcode
 */

// API Configuration
const API_CONFIG = {
    // Indian Pincode API
    INDIA_PINCODE: {
        url: 'https://api.postalpincode.in/pincode/',
        backup: 'https://api.zippopotam.us/in/'
    },
    // International Zipcode API
    INTERNATIONAL: {
        url: 'https://api.zippopotam.us/',
        countries: {
            'US': 'us', 'UK': 'gb', 'CA': 'ca', 'AU': 'au', 
            'DE': 'de', 'FR': 'fr', 'IT': 'it', 'ES': 'es',
            'NL': 'nl', 'BE': 'be', 'CH': 'ch', 'AT': 'at'
        }
    },
    // Currency Exchange API
    EXCHANGE_RATE: {
        url: 'https://api.exchangerate-api.com/v4/latest/',
        backup: 'https://api.fixer.io/latest'
    },
    // Airport/Port API
    LOCATION: {
        airports: 'https://api.aviationapi.com/v1/airports',
        ports: 'https://api.searoutes.com/ports'
    }
};

// Cache for API responses (5 minute cache)
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Generic API call with caching and enhanced error handling
 */
async function apiCall(url, cacheKey = null) {
    // Input validation
    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
    }
    
    // Check cache first
    if (cacheKey && apiCache.has(cacheKey)) {
        const cached = apiCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        apiCache.delete(cacheKey);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DocsApp/1.0'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Invalid response format - expected JSON');
        }
        
        const data = await response.json();
        
        // Validate response data
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response data');
        }
        
        // Cache successful response
        if (cacheKey) {
            apiCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
        }
        
        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`API call timeout: ${url}`);
        } else {
            console.warn(`API call failed: ${url}`, error.message);
        }
        return null;
    }
}

/**
 * Get location data from Indian pincode with enhanced validation
 */
async function getIndianPincodeData(pincode) {
    // Enhanced validation
    if (!pincode || typeof pincode !== 'string') {
        console.warn('Invalid pincode type:', typeof pincode);
        return null;
    }
    
    const cleanPincode = pincode.trim().replace(/\D/g, ''); // Remove non-digits
    if (!/^[0-9]{6}$/.test(cleanPincode)) {
        console.warn('Invalid pincode format:', pincode);
        return null;
    }
    
    const cacheKey = `in_${cleanPincode}`;
    
    try {
        // Try primary API
        let data = await apiCall(`${API_CONFIG.INDIA_PINCODE.url}${cleanPincode}`, cacheKey);
        
        if (data && Array.isArray(data) && data[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
            const postOffice = data[0].PostOffice[0];
            return {
                city: postOffice.District || '',
                state: postOffice.State || '',
                country: 'INDIA',
                region: postOffice.Region || '',
                division: postOffice.Division || ''
            };
        }
        
        // Try backup API if primary fails
        data = await apiCall(`${API_CONFIG.INDIA_PINCODE.backup}${cleanPincode}`, `backup_${cacheKey}`);
        
        if (data && data.country && data.places?.length > 0) {
            return {
                city: data.places[0]?.['place name'] || '',
                state: data.places[0]?.state || '',
                country: 'INDIA'
            };
        }
        
        console.warn('No valid data found for pincode:', cleanPincode);
        return null;
        
    } catch (error) {
        console.error('Indian pincode lookup failed:', error.message);
        return null;
    }
}

/**
 * Get location data from international zipcode
 */
async function getInternationalZipcodeData(zipcode, countryCode) {
    if (!zipcode || !countryCode) return null;
    
    const country = API_CONFIG.INTERNATIONAL.countries[countryCode.toUpperCase()];
    if (!country) return null;
    
    const cacheKey = `${country}_${zipcode}`;
    const data = await apiCall(`${API_CONFIG.INTERNATIONAL.url}${country}/${zipcode}`, cacheKey);
    
    if (data && data.country) {
        return {
            city: data.places[0]?.['place name'] || '',
            state: data.places[0]?.state || data.places[0]?.['state abbreviation'] || '',
            country: data.country,
            latitude: data.places[0]?.latitude,
            longitude: data.places[0]?.longitude
        };
    }
    
    return null;
}

// Rate limiting for API calls
const rateLimiter = {
    calls: new Map(),
    maxCalls: 10,
    timeWindow: 60000, // 1 minute
    
    canMakeCall(apiType) {
        const now = Date.now();
        const calls = this.calls.get(apiType) || [];
        
        // Remove old calls outside time window
        const recentCalls = calls.filter(time => now - time < this.timeWindow);
        this.calls.set(apiType, recentCalls);
        
        if (recentCalls.length >= this.maxCalls) {
            console.warn(`Rate limit exceeded for ${apiType}. Try again later.`);
            return false;
        }
        
        recentCalls.push(now);
        this.calls.set(apiType, recentCalls);
        return true;
    }
};

/**
 * Get exchange rates for currency conversion with rate limiting
 */
async function getExchangeRates(baseCurrency = 'INR') {
    if (!rateLimiter.canMakeCall('exchange')) {
        return null;
    }
    
    // Input validation
    if (!baseCurrency || typeof baseCurrency !== 'string' || baseCurrency.length !== 3) {
        console.warn('Invalid currency code:', baseCurrency);
        return null;
    }
    
    const cacheKey = `exchange_${baseCurrency.toUpperCase()}`;
    
    try {
        // Try primary API
        let data = await apiCall(`${API_CONFIG.EXCHANGE_RATE.url}${baseCurrency.toUpperCase()}`, cacheKey);
        
        if (data && data.rates && typeof data.rates === 'object') {
            return {
                base: data.base || baseCurrency,
                rates: data.rates,
                date: data.date || new Date().toISOString().split('T')[0]
            };
        }
        
        console.warn('No valid exchange rate data found for:', baseCurrency);
        return null;
        
    } catch (error) {
        console.error('Exchange rate lookup failed:', error.message);
        return null;
    }
}

/**
 * Get nearby airports based on city/coordinates
 */
async function getNearbyAirports(city, country = 'INDIA') {
    // This would require a more specific airport API
    // For now, return common airports based on major cities
    const majorAirports = {
        'INDIA': {
            'Mumbai': ['BOM - Chhatrapati Shivaji Maharaj International'],
            'Delhi': ['DEL - Indira Gandhi International'],
            'Bangalore': ['BLR - Kempegowda International'],
            'Chennai': ['MAA - Chennai International'],
            'Kolkata': ['CCU - Netaji Subhas Chandra Bose International'],
            'Hyderabad': ['HYD - Rajiv Gandhi International'],
            'Pune': ['PNQ - Pune Airport'],
            'Ahmedabad': ['AMD - Sardar Vallabhbhai Patel International']
        }
    };
    
    return majorAirports[country]?.[city] || [];
}

/**
 * Get nearby ports based on city/state
 */
async function getNearbyPorts(city, state, country = 'INDIA') {
    const majorPorts = {
        'INDIA': {
            'Maharashtra': ['JNPT - Jawaharlal Nehru Port', 'Mumbai Port'],
            'Gujarat': ['Kandla Port', 'Mundra Port'],
            'Tamil Nadu': ['Chennai Port', 'Tuticorin Port'],
            'West Bengal': ['Kolkata Port', 'Haldia Port'],
            'Karnataka': ['New Mangalore Port'],
            'Kerala': ['Cochin Port'],
            'Andhra Pradesh': ['Visakhapatnam Port']
        }
    };
    
    return majorPorts[country]?.[state] || [];
}

/**
 * Main function to populate location data based on pincode/zipcode
 */
async function populateLocationData(pincode, country = 'INDIA', fieldPrefix = '') {
    let locationData = null;
    
    if (country === 'INDIA') {
        locationData = await getIndianPincodeData(pincode);
    } else {
        const countryCode = getCountryCode(country);
        locationData = await getInternationalZipcodeData(pincode, countryCode);
    }
    
    if (!locationData) return {};
    
    // Get additional data
    const airports = await getNearbyAirports(locationData.city, country);
    const ports = await getNearbyPorts(locationData.city, locationData.state, country);
    const exchangeRates = country !== 'INDIA' ? await getExchangeRates() : null;
    
    // Build field updates object
    const updates = {};
    if (fieldPrefix) {
        updates[`${fieldPrefix}_city`] = locationData.city;
        updates[`${fieldPrefix}_state`] = locationData.state;
        updates[`${fieldPrefix}_country`] = locationData.country;
    } else {
        updates.city = locationData.city;
        updates.state = locationData.state;
        updates.country = locationData.country;
    }
    
    // Add additional data
    if (airports.length > 0) {
        updates.nearest_airport = airports[0];
    }
    if (ports.length > 0) {
        updates.nearest_port = ports[0];
    }
    if (exchangeRates) {
        updates.exchange_rates = exchangeRates.rates;
    }
    
    return updates;
}

/**
 * Get country code from country name
 */
function getCountryCode(countryName) {
    const countryCodes = {
        'USA': 'US', 'UNITED STATES': 'US',
        'UK': 'GB', 'UNITED KINGDOM': 'GB', 'BRITAIN': 'GB',
        'CANADA': 'CA',
        'AUSTRALIA': 'AU',
        'GERMANY': 'DE',
        'FRANCE': 'FR',
        'ITALY': 'IT',
        'SPAIN': 'ES',
        'NETHERLANDS': 'NL',
        'BELGIUM': 'BE',
        'SWITZERLAND': 'CH',
        'AUSTRIA': 'AT'
    };
    
    return countryCodes[countryName.toUpperCase()] || countryName.substring(0, 2).toUpperCase();
}

/**
 * Initialize pincode/zipcode auto-population with enhanced error handling
 */
function initializePincodeAutofill() {
    document.addEventListener('input', async function(e) {
        const field = e.target;
        
        // Check if this is a pincode/zipcode field with api_trigger
        if (!field.hasAttribute('data-api-trigger')) return;
        
        const value = field.value.trim();
        if (!value) return;
        
        const fieldPrefix = field.id.replace(/_pincode$|_zipcode$/, '');
        
        // Determine country from form context
        const countryField = document.getElementById(`${fieldPrefix}_country`);
        const country = countryField?.value || 'INDIA';
        
        // Validate pincode/zipcode format
        if (country === 'INDIA' && !/^[0-9]{6}$/.test(value)) return;
        if (country !== 'INDIA' && value.length < 3) return;
        
        // Debounce API calls
        clearTimeout(field._apiTimeout);
        field._apiTimeout = setTimeout(async () => {
            // Show loading indicator
            showLoadingIndicator(fieldPrefix);
            
            try {
                const updates = await populateLocationData(value, country, fieldPrefix);
                
                if (updates && Object.keys(updates).length > 0) {
                    // Update form fields
                    Object.entries(updates).forEach(([key, val]) => {
                        const targetField = document.getElementById(key);
                        if (targetField && !targetField.value && val) {
                            targetField.value = val;
                            // Trigger change event for validation
                            targetField.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                } else {
                    console.warn('No location data found for:', value);
                }
                
            } catch (error) {
                console.error('Failed to populate location data:', error.message);
                showErrorIndicator(fieldPrefix, 'Failed to fetch location data');
            } finally {
                hideLoadingIndicator(fieldPrefix);
            }
        }, 500); // 500ms debounce
    });
}

/**
 * Show loading indicator for address fields
 */
function showLoadingIndicator(fieldPrefix) {
    const cityField = document.getElementById(`${fieldPrefix}_city`);
    if (cityField) {
        cityField.style.background = '#f0f8ff url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMyIgZmlsbD0iIzMzNzNkYyI+CjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIHZhbHVlcz0iMzs1OzMiIGR1cj0iMXMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+CjwvY2lyY2xlPgo8L3N2Zz4=") no-repeat right 10px center';
    }
}

/**
 * Hide loading indicator for address fields
 */
function hideLoadingIndicator(fieldPrefix) {
    const cityField = document.getElementById(`${fieldPrefix}_city`);
    if (cityField) {
        cityField.style.background = '';
    }
}

// Export functions for use in other modules
window.DocsAPI = {
    populateLocationData,
    getExchangeRates,
    getNearbyAirports,
    getNearbyPorts,
    initializePincodeAutofill
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePincodeAutofill);
} else {
    initializePincodeAutofill();
}
/**
 * Show error indicator for address fields
 */
function showErrorIndicator(fieldPrefix, message) {
    const cityField = document.getElementById(`${fieldPrefix}_city`);
    if (cityField) {
        cityField.style.borderColor = '#ef4444';
        cityField.title = message;
        
        // Clear error after 3 seconds
        setTimeout(() => {
            cityField.style.borderColor = '';
            cityField.title = '';
        }, 3000);
    }
}