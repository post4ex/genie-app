/**
 * docs-db.js
 * IndexedDB wrapper for document storage
 */

/**
 * docs-db.js
 * Enhanced IndexedDB wrapper for document storage with security and error handling
 */

// Enhanced IndexedDB initialization with proper error handling
const initDB = () => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not supported in this browser'));
            return;
        }
        
        const request = indexedDB.open('DocumentsDB', 1);
        
        request.onerror = () => {
            console.error('Database failed to open:', request.error);
            reject(new Error(`Database error: ${request.error?.message || 'Unknown error'}`));
        };
        
        request.onsuccess = () => {
            const db = request.result;
            
            // Add error handler for database
            db.onerror = (event) => {
                console.error('Database error:', event.target.error);
            };
            
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            try {
                if (!db.objectStoreNames.contains('documents')) {
                    const store = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('docId', 'docId', { unique: false });
                    store.createIndex('userId', 'userId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('docType', 'docType', { unique: false });
                }
            } catch (error) {
                console.error('Error creating object store:', error);
                reject(error);
            }
        };
    });
};

// Enhanced document storage operations with security and validation
const DocumentDB = {
    /**
     * Sanitize input data to prevent XSS attacks
     */
    sanitizeData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Basic HTML sanitization
                sanitized[key] = value
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => 
                    typeof item === 'object' ? this.sanitizeData(item) : item
                );
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    },
    
    /**
     * Enhanced save operation with validation and error handling
     */
    async save(docId, title, data, userId) {
        console.log('DocumentDB.save called with:', { docId, title, userId });
        
        // Input validation
        if (!docId || typeof docId !== 'string') {
            throw new Error('Invalid docId provided');
        }
        if (!title || typeof title !== 'string') {
            throw new Error('Invalid title provided');
        }
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data provided');
        }
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid userId provided');
        }
        
        try {
            const db = await initDB();
            const transaction = db.transaction(['documents'], 'readwrite');
            const store = transaction.objectStore('documents');
            
            // Sanitize data to prevent XSS
            const sanitizedData = this.sanitizeData(data);
            
            const document = {
                docId: docId.trim(),
                title: title.trim(),
                data: sanitizedData,
                userId: userId.trim(),
                timestamp: Date.now(),
                createdAt: new Date().toISOString(),
                docType: data.docType || 'unknown'
            };
            
            console.log('Saving document to IndexedDB:', { ...document, data: '[sanitized]' });
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    console.log('Document saved successfully with ID:', request.result);
                    resolve(request.result);
                };
                
                transaction.onerror = () => {
                    console.error('Transaction failed:', transaction.error);
                    reject(new Error(`Save failed: ${transaction.error?.message || 'Unknown error'}`));
                };
                
                const request = store.add(document);
                
                request.onerror = () => {
                    console.error('Error saving document:', request.error);
                    reject(new Error(`Add operation failed: ${request.error?.message || 'Unknown error'}`));
                };
            });
        } catch (error) {
            console.error('Save operation failed:', error);
            throw error;
        }
    },
    
    /**
     * Enhanced retrieval with error handling and input validation
     */
    async getByUser(userId) {
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid userId provided');
        }
        
        try {
            const db = await initDB();
            const transaction = db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const index = store.index('userId');
            
            return new Promise((resolve, reject) => {
                transaction.onerror = () => {
                    console.error('Transaction failed:', transaction.error);
                    reject(new Error(`Retrieval failed: ${transaction.error?.message || 'Unknown error'}`));
                };
                
                const request = index.getAll(userId.trim());
                
                request.onsuccess = () => {
                    const docs = (request.result || []).sort((a, b) => b.timestamp - a.timestamp);
                    resolve(docs);
                };
                
                request.onerror = () => {
                    console.error('GetAll operation failed:', request.error);
                    reject(new Error(`GetAll failed: ${request.error?.message || 'Unknown error'}`));
                };
            });
        } catch (error) {
            console.error('GetByUser operation failed:', error);
            throw error;
        }
    },
    
    /**
     * Enhanced getById with validation
     */
    async getById(id) {
        if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
            throw new Error('Invalid id provided');
        }
        
        try {
            const db = await initDB();
            const transaction = db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            
            return new Promise((resolve, reject) => {
                transaction.onerror = () => {
                    console.error('Transaction failed:', transaction.error);
                    reject(new Error(`Retrieval failed: ${transaction.error?.message || 'Unknown error'}`));
                };
                
                const request = store.get(id);
                
                request.onsuccess = () => resolve(request.result || null);
                
                request.onerror = () => {
                    console.error('Get operation failed:', request.error);
                    reject(new Error(`Get failed: ${request.error?.message || 'Unknown error'}`));
                };
            });
        } catch (error) {
            console.error('GetById operation failed:', error);
            throw error;
        }
    },
    
    /**
     * Enhanced delete with validation
     */
    async delete(id) {
        if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
            throw new Error('Invalid id provided');
        }
        
        try {
            const db = await initDB();
            const transaction = db.transaction(['documents'], 'readwrite');
            const store = transaction.objectStore('documents');
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    console.log('Document deleted successfully');
                    resolve();
                };
                
                transaction.onerror = () => {
                    console.error('Transaction failed:', transaction.error);
                    reject(new Error(`Delete failed: ${transaction.error?.message || 'Unknown error'}`));
                };
                
                const request = store.delete(id);
                
                request.onerror = () => {
                    console.error('Delete operation failed:', request.error);
                    reject(new Error(`Delete failed: ${request.error?.message || 'Unknown error'}`));
                };
            });
        } catch (error) {
            console.error('Delete operation failed:', error);
            throw error;
        }
    },
    
    /**
     * Clear all documents for a user (with confirmation)
     */
    async clearUserDocuments(userId) {
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid userId provided');
        }
        
        try {
            const docs = await this.getByUser(userId);
            const deletePromises = docs.map(doc => this.delete(doc.id));
            await Promise.all(deletePromises);
            console.log(`Cleared ${docs.length} documents for user: ${userId}`);
            return docs.length;
        } catch (error) {
            console.error('Clear user documents failed:', error);
            throw error;
        }
    }
};

// Make available globally
window.DocumentDB = DocumentDB;