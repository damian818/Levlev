/**
 * Offline Mutation Queue for Supabase synchronization.
 * Intercepts write and delete operations when offline or when network errors occur,
 * persists mutations in localStorage, and automatically flushes them in order upon reconnection.
 */

export type QueuedMutationType = 
  | 'SAVE_ALL'
  | 'DELETE_TRANSACTION'
  | 'SAVE_ATTACHMENTS'
  | 'DELETE_ATTACHMENT'
  | 'DELETE_CATEGORY'
  | 'DELETE_ACCOUNT';

export interface QueuedMutation {
  id: string;
  type: QueuedMutationType;
  payload: any;
  timestamp: number;
  retryCount: number;
}

const SYNC_QUEUE_KEY = 'levlev_supabase_sync_queue';
const listeners = new Set<(pendingCount: number, isOnline: boolean) => void>();

function notifyListeners(): void {
  const count = getQueueLength();
  const online = isNetworkOnline();
  listeners.forEach(cb => {
    try {
      cb(count, online);
    } catch {}
  });
}

export function isNetworkOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export function getSyncQueue(): QueuedMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse sync queue from storage:', err);
    return [];
  }
}

export function getQueueLength(): number {
  return getSyncQueue().length;
}

function saveSyncQueue(queue: QueuedMutation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Failed to save sync queue to storage:', err);
  }
  notifyListeners();
}

/**
 * Enqueue a mutation for later processing.
 * Coalesces SAVE_ALL operations to avoid replaying outdated snapshots.
 */
export function enqueueMutation(type: QueuedMutationType, payload: any): void {
  const currentQueue = getSyncQueue();
  const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  let updatedQueue = [...currentQueue];

  if (type === 'SAVE_ALL') {
    // If a full data save is already queued, replace it with the newer snapshot
    updatedQueue = updatedQueue.filter(m => m.type !== 'SAVE_ALL');
    updatedQueue.push({
      id: mutationId,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    });
  } else if (type === 'DELETE_TRANSACTION') {
    // Merge delete IDs if possible
    const newIds = Array.isArray(payload) ? payload : [payload];
    const existingDeleteIdx = updatedQueue.findIndex(m => m.type === 'DELETE_TRANSACTION');
    if (existingDeleteIdx >= 0) {
      const existing = updatedQueue[existingDeleteIdx];
      const mergedIds = Array.from(new Set([...(Array.isArray(existing.payload) ? existing.payload : [existing.payload]), ...newIds]));
      updatedQueue[existingDeleteIdx] = {
        ...existing,
        payload: mergedIds,
        timestamp: Date.now(),
      };
    } else {
      updatedQueue.push({
        id: mutationId,
        type,
        payload: newIds,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
  } else {
    updatedQueue.push({
      id: mutationId,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  saveSyncQueue(updatedQueue);
  console.log(`[SyncQueue] Enqueued mutation ${type} (queue size: ${updatedQueue.length})`);
}

export function removeMutation(id: string): void {
  const currentQueue = getSyncQueue();
  const filtered = currentQueue.filter(m => m.id !== id);
  saveSyncQueue(filtered);
}

export function clearSyncQueue(): void {
  saveSyncQueue([]);
}

let isFlushing = false;

/**
 * Flushes all queued mutations sequentially using the supplied executor.
 */
export async function flushSyncQueue(
  executor: (mutation: QueuedMutation) => Promise<boolean>
): Promise<{ processed: number; failed: number }> {
  if (isFlushing) {
    return { processed: 0, failed: 0 };
  }
  if (!isNetworkOnline()) {
    console.log('[SyncQueue] Skipping flush - device is offline.');
    return { processed: 0, failed: 0 };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0 };
  }

  isFlushing = true;
  console.log(`[SyncQueue] Starting flush of ${queue.length} pending mutations...`);

  let processed = 0;
  let failed = 0;

  try {
    for (const mutation of queue) {
      if (!isNetworkOnline()) {
        console.log('[SyncQueue] Device went offline during flush, pausing.');
        break;
      }

      try {
        const success = await executor(mutation);
        if (success) {
          removeMutation(mutation.id);
          processed++;
          console.log(`[SyncQueue] Successfully processed mutation ${mutation.type} (${mutation.id})`);
        } else {
          // Increment retry count
          const current = getSyncQueue();
          const target = current.find(m => m.id === mutation.id);
          if (target) {
            target.retryCount = (target.retryCount || 0) + 1;
            // Drop after 10 failed retries to avoid permanent poison pill
            if (target.retryCount > 10) {
              console.warn(`[SyncQueue] Dropping mutation ${mutation.type} after 10 failed retries.`);
              removeMutation(mutation.id);
            } else {
              saveSyncQueue(current);
            }
          }
          failed++;
        }
      } catch (mutationErr) {
        console.error(`[SyncQueue] Error processing mutation ${mutation.type}:`, mutationErr);
        failed++;
        break;
      }
    }
  } finally {
    isFlushing = false;
    notifyListeners();
  }

  console.log(`[SyncQueue] Flush complete: ${processed} processed, ${failed} remaining/failed.`);
  return { processed, failed };
}

/**
 * Set up automated listeners for 'online' event and periodic reconnect checks.
 */
export function initSyncQueueAutoFlush(
  executor: (mutation: QueuedMutation) => Promise<boolean>
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('[SyncQueue] Network online event detected. Flushing sync queue...');
    notifyListeners();
    flushSyncQueue(executor);
  };

  const handleOffline = () => {
    console.log('[SyncQueue] Network offline event detected.');
    notifyListeners();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic safety check every 30 seconds
  const intervalId = setInterval(() => {
    if (isNetworkOnline() && getQueueLength() > 0 && !isFlushing) {
      flushSyncQueue(executor);
    }
  }, 30000);

  // Initial flush if queue has items and online
  if (isNetworkOnline() && getQueueLength() > 0) {
    setTimeout(() => {
      flushSyncQueue(executor);
    }, 2000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(intervalId);
  };
}

/**
 * Subscribe to sync queue state changes (for UI status banners/chips).
 */
export function subscribeToSyncQueue(
  callback: (pendingCount: number, isOnline: boolean) => void
): () => void {
  listeners.add(callback);
  callback(getQueueLength(), isNetworkOnline());
  return () => {
    listeners.delete(callback);
  };
}
