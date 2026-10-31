# Multi-Device Deletion & Tombstone Synchronization

Resolve the issue where deleting a transaction on one device causes it to reappear when opening the app from another computer, mobile device, or instance.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user during the clarification phase:

- **Reconciliation Model**: Cloud authority with tombstone synchronization. The cloud database is the authoritative source of truth, and local caches are reconciled against cloud state and deletion tombstones.
- **Tombstone Strategy**: Cloud tombstones stored in `user_settings` in Supabase. When any device deletes a transaction, its ID is recorded in the user's cloud settings and filtered out immediately on all instances.

---

## 1. Overview & Core Concept

When an entry was deleted on Device A:
1. The row was removed from the Supabase `transactions` table, and the ID was temporarily recorded in Device A's `localStorage` (`finance_app_deleted_tx_ids`), then quickly cleared.
2. Device B (phone or laptop) still held the deleted entry in its own local browser storage (`localStorage`) from its previous session.
3. Upon opening Device B, `syncFromSupabase()` fetched active transactions from Supabase.
4. Because the deleted entry was absent from the remote list and Device B had no record in its local `deletedIds`, Device B's reconciliation logic incorrectly assumed the cached entry was a "new offline creation" (`pendingLocal`) that had not yet reached the server.
5. Device B merged the deleted entry back into active state, and its auto-save timer re-uploaded the transaction to Supabase, resurrecting the deleted expense across all devices.

This plan addresses the root cause by maintaining persistent, cloud-synchronized deletion tombstones and correcting local cache reconciliation.

---

## 2. User Experience & Synchronization Flow

- **Immediate Multi-Device Deletion**: When an expense or transfer is deleted on one device, it is permanently deleted in Supabase and registered in the user's cloud tombstone registry.
- **Zero Resurrection**: Opening the app on any secondary device, mobile browser, or new tab will fetch the cloud tombstones, discard any stale cached copies of deleted items from local storage, and never re-upload deleted entries.
- **Offline Resilience**: Transactions legitimately created offline on a device remain preserved via the explicit offline mutation queue (`syncQueue`), rather than relying on ambiguous heuristic diffing against old cached snapshots.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Cloud-Synchronized Tombstones in `user_settings`**
  - *Chosen Approach*: Persist a bounded array of deleted transaction IDs (`deletedTxIds`, up to 1,000 recent IDs) in Supabase `user_settings.settings.deletedTxIds`.
  - *Why*: `user_settings` is already fetched and updated during every sync pass. Storing tombstones in cloud settings ensures every connected device and browser instance is immediately aware of deletions without requiring schema migrations.
  - *Alternatives Considered*: Hard database deletes without tombstones (fails because secondary devices cannot distinguish between a deleted entry and a locally created unsynced entry).

- **Decision 2: Strict Reconciliation in `syncFromSupabase`**
  - *Chosen Approach*: When syncing from Supabase, discard cached local transactions that are missing from `remoteTxs` unless they are currently tracked as pending creations in the offline `syncQueue`.
  - *Why*: Eliminates the flawed assumption that any stale entry in `localStorage` is an unsaved new transaction. Legitimate offline creations are already tracked by `syncQueue`.
  - *Alternatives Considered*: Relying on transaction timestamps (brittle due to clock skew between devices and backdated entries).

- **Decision 3: Complete ID Matrix in `deleteTransactionFromSupabase`**
  - *Chosen Approach*: Query and delete all ID permutations (`id`, `${userId}_${id}`, and stripped clean ID) in Supabase, and retain the ID in the tombstone list.
  - *Why*: Resolves discrepancies where IDs are formatted with or without the user UUID prefix between initial creation and sync hydration.

---

## 4. Technical Architecture & Data Strategy

### Synchronization & Deletion Lifecycle

```
[ Device A: User clicks Delete ]
         │
         ├──> 1. Remove from local state & localStorage
         ├──> 2. Add ID to local & cloud tombstones (`deletedTxIds`)
         └──> 3. Delete row in Supabase `transactions` table
                        │
                        ▼
            [ Supabase Cloud Database ]
            - `transactions`: row deleted
            - `user_settings`: `deletedTxIds` updated
                        │
[ Device B: Opens app / Focuses tab ]
         │
         ├──> 1. Fetch remote transactions & `user_settings` (including `deletedTxIds`)
         ├──> 2. Purge any local cached entries matching `deletedTxIds`
         ├──> 3. Reconcile: Remote transactions + verified offline drafts only
         └──> 4. Save clean state to Device B's `localStorage` (NO resurrection upsert)
```

### Component & Service Changes

1. **`src/services/supabaseSync.ts`**:
   - In `fetchUserDataFromSupabase`: Retrieve `userSettings.deletedTxIds` from Supabase and merge with local tombstones.
   - In `deleteTransactionFromSupabase`: Ensure `addDeletedTxIds` writes to both `localStorage` and prepares the ID for cloud persistence; remove the premature `removeDeletedTxIds()` call that was discarding tombstones.
   - In `saveAllUserDataToSupabase`: Include `deletedTxIds` in the payload sent to `user_settings`.
   - Add helper `getSyncedDeletedTxIds()` to provide unified access to combined cloud and local tombstones.

2. **`src/App.tsx`**:
   - In `syncFromSupabase`:
     - Load cloud tombstones from `data.settings.deletedTxIds` and apply them to both local storage and active filtering.
     - Revise `pendingLocal` calculation: only retain local transactions that were created in the active session and are tracked in `syncQueue` or have a verified un-synced status, rather than blindly keeping any stale cached item from `localStorage`.
   - In `handleDeleteTransaction`:
     - Keep tombstone record active so subsequent auto-save passes do not re-insert the item.
     - Call `deleteTransactionFromSupabase` and ensure cloud settings receive the updated tombstone set.
