/**
 * ============================================================================
 * INDEXEDDB WRAPPER - HIGH PERFORMANCE DATA STORAGE
 * ============================================================================
 * 
 * This module provides a high-performance IndexedDB wrapper for storing
 * application data with better performance than localStorage.
 * 
 * Features:
 * - Automatic database initialization
 * - Promise-based API
 * - Efficient bulk operations
 * - Delta sync support
 * - Automatic cleanup
 */

class AppDatabase {
  constructor() {
    this.dbName = 'WEBIndexedDB';
    this.version = 11; // Added HEADER store, fixed LEDGER key
    this.db = null;
    
    // Define unique key for each sheet (must match PocketBase field names)
    this.sheetKeys = {
      'ORDERS':        'REFERENCE',
      'B2B':           'CODE',
      'B2B2C':         'UID',
      'RATES':         'UID',
      'STAFF':         'STAFF_CODE',
      'ATTENDANCE':    'ATTENDANCE_ID',
      'BRANCHES':      'BRANCH_CODE',
      'MODES':         'SHORT',
      'CARRIERS':      'COMPANY_CODE',
      'MULTIBOX':      'MB_UID',
      'PRODUCTS':      'PD_UID',
      'UPLOADS':       'UPLOAD_UID',
      'CALC_HISTORY':  'CALC_UID',
      'NOTIFICATIONS': 'NOTIF_ID',
      'HOLIDAYS':      'HOLIDAY_ID',
      'LEDGER':        'TXN_ID',
      'SHIPMENTS':     'REFERENCE',
      'HEADER':        'DOX_KEY',
    };
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Delete ALL existing stores for clean upgrade
        Array.from(db.objectStoreNames).forEach(name => db.deleteObjectStore(name));

        const sheets = [
          'ORDERS', 'B2B', 'B2B2C', 'RATES', 'STAFF',
          'ATTENDANCE', 'BRANCHES', 'MODES', 'CARRIERS',
          'MULTIBOX', 'PRODUCTS', 'UPLOADS', 'CALC_HISTORY',
          'NOTIFICATIONS', 'HOLIDAYS', 'LEDGER', 'SHIPMENTS', 'HEADER'
        ];
        
        // Create object stores with correct key paths
        sheets.forEach(sheetName => {
          const keyPath = this.sheetKeys[sheetName] || 'id';
          const store = db.createObjectStore(sheetName, { keyPath });
          store.createIndex('TIME_STAMP', 'TIME_STAMP', { unique: false });
          // IO_TIMESTAMP index for HEADER and LEDGER — document/transaction date
          if (sheetName === 'HEADER' || sheetName === 'LEDGER') {
            store.createIndex('IO_TIMESTAMP', 'IO_TIMESTAMP', { unique: false });
          }
          // id index for O(1) getByPbId lookup
          if (keyPath !== 'id') store.createIndex('id', 'id', { unique: false });
        });

        
        // Create metadata store
        db.createObjectStore('_metadata', { keyPath: 'key' });
      };
    });
  }

  async setMetadata(key, value) {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['_metadata'], 'readwrite');
    const store = transaction.objectStore('_metadata');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(key) {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['_metadata'], 'readonly');
    const store = transaction.objectStore('_metadata');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMetadata() {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['_metadata'], 'readonly');
    const store = transaction.objectStore('_metadata');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async putSheet(sheetName, data) {
    if (!this.db || !data || typeof data !== 'object') return;
    
    const transaction = this.db.transaction([sheetName], 'readwrite');
    const store = transaction.objectStore(sheetName);
    const keyPath = this.sheetKeys[sheetName] || 'id';
    
    const records = Object.keys(data).map(key => {
      const record = { ...data[key] };
      // Always use the object key as the primary key if the keyPath field is missing
      if (!record[keyPath] || record[keyPath] === '' || record[keyPath] === null || record[keyPath] === undefined) {
        record[keyPath] = key;
      }
      return record;
    });
    
    return new Promise((resolve, reject) => {
      let completed = 0;
      const total = records.length;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      records.forEach(record => {
        const request = store.put(record);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getSheet(sheetName) {
    if (!this.db) {
      console.warn(`[IndexedDB] Database not initialized for getSheet(${sheetName})`);
      return {};
    }
    const transaction = this.db.transaction([sheetName], 'readonly');
    const store = transaction.objectStore(sheetName);
    const request = store.getAll();
    const keyPath = this.sheetKeys[sheetName] || 'id';
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const records = request.result;
        const result = {};
        records.forEach(record => {
          const key = record[keyPath];
          if (key) {
            result[key] = record;
          }
        });
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async mergeSheet(sheetName, deltaData) {
    if (!this.db || !deltaData || typeof deltaData !== 'object') return;
    
    const transaction = this.db.transaction([sheetName], 'readwrite');
    const store = transaction.objectStore(sheetName);
    const keyPath = this.sheetKeys[sheetName] || 'id';
    
    return new Promise((resolve, reject) => {
      const entries = Object.entries(deltaData);
      let completed = 0;
      const total = entries.length;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      entries.forEach(([key, record]) => {
        const recordToStore = { ...record };
        // Always use the object key as the primary key if the keyPath field is missing
        if (!recordToStore[keyPath] || recordToStore[keyPath] === '' || recordToStore[keyPath] === null || recordToStore[keyPath] === undefined) {
          recordToStore[keyPath] = key;
        }
        const request = store.put(recordToStore);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async clearSheet(sheetName) {
    if (!this.db) return;
    const transaction = this.db.transaction([sheetName], 'readwrite');
    const store = transaction.objectStore(sheetName);
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(sheetName, key) {
    if (!this.db) return;
    const transaction = this.db.transaction([sheetName], 'readwrite');
    const store = transaction.objectStore(sheetName);
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Timestamp-guarded put — "Zombie Shield".
   * Only writes if incoming TIME_STAMP is strictly greater than existing.
   * Returns true if written, false if skipped.
   */
  async _checkAndPut(store, record, keyPath) {
    return new Promise((resolve, reject) => {
      const getReq = store.get(record[keyPath]);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing && Number(record.TIME_STAMP || 0) <= Number(existing.TIME_STAMP || 0)) {
          resolve(false); // skip — incoming is not newer
          return;
        }
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => {
        // If get fails, still attempt put
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
    });
  }

  /**
   * Atomic bulk merge across multiple stores in a single transaction.
   * @param {Object} deltaMap - { collectionName: { [key]: record, ... }, ... }
   * Each entry can also have a special __deletes array: [key1, key2, ...]
   * Uses timestamp idempotency to prevent "zombie" overwrites.
   */
  async bulkMerge(deltaMap) {
    if (!this.db || !deltaMap || typeof deltaMap !== 'object') return;
    const existingStores = Array.from(this.db.objectStoreNames);
    const storeNames = Object.keys(deltaMap).filter(name => existingStores.includes(name));
    if (!storeNames.length) return;

    const transaction = this.db.transaction(storeNames, 'readwrite');

    return new Promise((resolve, reject) => {
      let pending = 0;
      let errored = false;

      function _completeCheck() {
        if (pending <= 0 && !errored) resolve();
      }

      for (const [collection, data] of Object.entries(deltaMap)) {
        if (!storeNames.includes(collection)) continue;
        if (!data || typeof data !== 'object') continue;
        const store = transaction.objectStore(collection);
        const keyPath = this.sheetKeys[collection] || 'id';

        // Handle deletes — support __deletes array
        if (data.__deletes && Array.isArray(data.__deletes)) {
          for (const delKey of data.__deletes) {
            pending++;
            const req = store.delete(delKey);
            req.onsuccess = () => { pending--; _completeCheck(); };
            req.onerror = (e) => { if (!errored) { errored = true; reject(e.target.error); } };
          }
        }

        // Handle upserts — object entries
        for (const [key, record] of Object.entries(data)) {
          if (key === '__deletes') continue;
          if (!record || typeof record !== 'object') continue;
          const recordToStore = { ...record };
          if (!recordToStore[keyPath] || recordToStore[keyPath] === '' || recordToStore[keyPath] === null || recordToStore[keyPath] === undefined) {
            recordToStore[keyPath] = key;
          }
          pending++;
          this._checkAndPut(store, recordToStore, keyPath).then(written => {
            pending--;
            _completeCheck();
          }).catch(err => {
            if (!errored) { errored = true; reject(err); }
          });
        }
      }

      if (pending === 0) resolve();
    });
  }

  async clearAll() {
    const sheets = [
      'ORDERS', 'B2B', 'B2B2C', 'RATES', 'STAFF',
      'ATTENDANCE', 'BRANCHES', 'MODES', 'CARRIERS',
      'MULTIBOX', 'PRODUCTS', 'UPLOADS', 'CALC_HISTORY',
      'NOTIFICATIONS', 'HOLIDAYS', 'LEDGER', 'SHIPMENTS', 'HEADER', '_metadata'
    ];
    
    for (const sheetName of sheets) {
      try {
        await this.clearSheet(sheetName);
      } catch (error) {
        console.warn(`Failed to clear ${sheetName}:`, error);
      }
    }
  }

  async getLastSyncTime() {
    if (!this.db) {
      console.warn('[IndexedDB] Database not initialized for getLastSyncTime');
      return null;
    }
    try {
      return await this.getMetadata('lastSyncTime');
    } catch (error) {
      console.warn('[IndexedDB] Failed to get lastSyncTime:', error);
      return null;
    }
  }

  async setLastSyncTime(timestamp) {
    if (!this.db) {
      console.warn('[IndexedDB] Database not initialized for setLastSyncTime');
      return;
    }
    try {
      await this.setMetadata('lastSyncTime', timestamp);
    } catch (error) {
      console.warn('[IndexedDB] Failed to set lastSyncTime:', error);
    }
  }

  async getLastStamp(collections) {
    if (!this.db) return 0;
    let max = 0;
    await Promise.all(collections.map(name => new Promise(resolve => {
      try {
        const tx    = this.db.transaction([name], 'readonly');
        const index = tx.objectStore(name).index('TIME_STAMP');
        const req   = index.openCursor(null, 'prev');
        req.onsuccess = () => {
          if (req.result) {
            const ts = Number(req.result.value.TIME_STAMP);
            if (ts > max) max = ts;
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch (_) { resolve(); }
    })));
    return max;
  }

  async getLastEventStamp() {
    const ts = (await this.getMetadata('lastEventStamp')) || 0;
    console.log('[idb] getLastEventStamp:', ts);
    return ts;
  }

  async getByPbId(sheetName, pbId) {
    if (!this.db) return null;
    const keyPath = this.sheetKeys[sheetName] || 'id';
    // If keyPath is 'id', just do a direct get
    if (keyPath === 'id') {
      return new Promise(resolve => {
        try {
          const tx  = this.db.transaction([sheetName], 'readonly');
          const req = tx.objectStore(sheetName).get(pbId);
          req.onsuccess = () => { console.log('[idb] getByPbId:', sheetName, pbId, 'found:', !!req.result); resolve(req.result || null); };
          req.onerror  = () => resolve(null);
        } catch (_) { resolve(null); }
      });
    }
    // Use 'id' secondary index
    return new Promise(resolve => {
      try {
        const tx    = this.db.transaction([sheetName], 'readonly');
        const index = tx.objectStore(sheetName).index('id');
        const req   = index.get(pbId);
        req.onsuccess = () => { console.log('[idb] getByPbId:', sheetName, pbId, 'found:', !!req.result); resolve(req.result || null); };
        req.onerror  = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }
}

// Global database instance
window.appDB = new AppDatabase();

// IndexedDB Manager for search functionality
class IndexedDBManager {
  constructor(appDB) {
    this.appDB = appDB;
  }

  async getAllStoreNames() {
    if (!this.appDB || !this.appDB.db) {
      throw new Error('Database not initialized');
    }
    
    const storeNames = [];
    for (let i = 0; i < this.appDB.db.objectStoreNames.length; i++) {
      const storeName = this.appDB.db.objectStoreNames[i];
      if (storeName !== '_metadata') {
        storeNames.push(storeName);
      }
    }
    return storeNames;
  }

  async getAll(storeName) {
    if (!this.appDB || !this.appDB.db) {
      throw new Error('Database not initialized');
    }
    
    const transaction = this.appDB.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const records = request.result || [];
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName) {
    if (!this.appDB || !this.appDB.db) {
      throw new Error('Database not initialized');
    }
    
    const transaction = this.appDB.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Global IndexedDBManager instance
window.IndexedDBManager = null;

// Initialize database immediately and on DOM ready
(async function initializeDB() {
  try {
    await window.appDB.init();
    
    // Initialize IndexedDBManager
    window.IndexedDBManager = new IndexedDBManager(window.appDB);
    
    console.log('[IndexedDB] Database and Manager initialized successfully');
    window.dispatchEvent(new CustomEvent('indexedDBReady'));
  } catch (error) {
    console.error('[IndexedDB] Failed to initialize database:', error);
    window.appDB = null;
    window.IndexedDBManager = null;
  }
})();

// Also try on DOMContentLoaded as fallback
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.appDB || !window.appDB.db || !window.IndexedDBManager) {
    try {
      if (!window.appDB) window.appDB = new AppDatabase();
      if (!window.appDB.db) await window.appDB.init();
      if (!window.IndexedDBManager) window.IndexedDBManager = new IndexedDBManager(window.appDB);
      
      console.log('[IndexedDB] Database and Manager initialized on DOM ready');
      window.dispatchEvent(new CustomEvent('indexedDBReady'));
    } catch (error) {
      console.error('[IndexedDB] Fallback initialization failed:', error);
      window.appDB = null;
      window.IndexedDBManager = null;
    }
  }
});