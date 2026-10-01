/**
 * IndexedDB storage engine for transaction attachment data URLs.
 * Bypasses 5MB LocalStorage quota to prevent attachment data loss.
 */

const DB_NAME = 'LevLev_Attachments_DB';
const DB_VERSION = 1;
const STORE_NAME = 'attachment_blobs';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists an attachment's dataUrl in IndexedDB.
 */
export async function persistAttachmentDataUrl(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieves an attachment's dataUrl from IndexedDB.
 */
export async function retrieveAttachmentDataUrl(id: string): Promise<string | null> {
  if (!id) return null;
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.dataUrl) {
          resolve(req.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Deletes an attachment's dataUrl from IndexedDB.
 */
export async function deleteAttachmentDataUrl(id: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
