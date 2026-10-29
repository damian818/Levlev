# Implementation Plan - Stability & State Persistence Fixes

Resolve three critical state persistence and navigation stability issues across currency transfers, system display currency, and credit card period management.

---

## Root Cause Analysis & Solution Design

### 1. Multi-Currency Transfer Value & Rate Persistence
* **Problem**: When loading or submitting a cross-currency transfer, the custom amount or custom exchange rate entered by the user gets overwritten by live rate fetches or is omitted during save/edit initialization.
* **Fix**:
  - In `TransactionModal.tsx`:
    - Track explicit user edits on either the destination amount (`toAmount`) or the exchange rate (`exchangeRate`).
    - If the user changes `toAmount`, automatically compute and lock `exchangeRate = toAmount / fromAmount`.
    - If the user changes `exchangeRate`, automatically compute and lock `toAmount = fromAmount * exchangeRate`.
    - When editing an existing transfer (`editingTransaction`), preserve the existing `toAmount` and `exchangeRate` directly, setting `isCustomRate = true` so external rate fetch hooks never overwrite the stored values.
    - Ensure `toAmount` and `exchangeRate` are strictly passed into `onSubmit` and persisted across all transaction records.

### 2. System Display Currency Persistence (USD to ARS)
* **Problem**: Changing the system display currency does not persist reliably across views, re-renders, or page refreshes.
* **Fix**:
  - In `App.tsx` and `types.ts`:
    - Verify that `displayCurrency` is strictly stored and read from `localStorage` under `flowfinance_display_currency`.
    - Sync `displayCurrency` with the user profile/settings in Firestore (when authenticated) so it survives across sessions and devices.
    - Prevent `useEffect` triggers from resetting `displayCurrency` back to default when loading account balances or initial profiles.
    - Ensure the header currency toggle directly commits the change without side effects resetting it.

### 3. Credit Card Period Navigation Retention
* **Problem**: Navigating credit card statement periods always snaps back to the newest statement period.
* **Fix**:
  - In `CreditCardDetailModal.tsx`:
    - Replace index-based tracking with `selectedCloseDate: string | null`.
    - Eliminate the aggressive `useEffect` dependency on `statements` which triggers `setSelectedStatementIdx(currentIdx)` on every data update or transaction change.
    - Only initialize `selectedCloseDate` on modal open (or when `initialCloseDate` is provided).
    - Maintain the user's active `selectedCloseDate` across transaction additions, closing rule tweaks, manual status toggles, and payment recordings.

---

## User Review Required
> **Clarification confirmed with user**:
> - Save the amount or rate manually entered by the user and calculate the other variable.
> - Update only the global reporting display currency when changing system currency.
> - Maintain the selected credit card period during active session and across transaction edits.

---

## Proposed Changes

### `src/components/TransactionModal.tsx`
- Refactor cross-currency transfer state:
  - Add explicit calculation helper: changing `toAmount` updates `exchangeRate`; changing `exchangeRate` updates `toAmount`.
  - When editing a transfer, initialize `toAmount` and `exchangeRate` from `editingTransaction` and set `isCustomRate = true`.
  - Disable live-rate auto-overwrite when `isCustomRate` or editing an existing transfer with custom rate.
  - Ensure payload passed to `onSubmit` includes `toAmount`, `exchangeRate`, and `currency`.

### `src/App.tsx`
- Audit `displayCurrency` state and persistence:
  - Ensure `displayCurrency` state initializes synchronously from `localStorage.getItem('flowfinance_display_currency') || 'USD'`.
  - Save to `localStorage` immediately on change, and save to Firestore user settings document.
  - Fix any unintended reset logic during accounts/transactions fetch.

### `src/components/CreditCardDetailModal.tsx`
- Fix period navigation persistence:
  - Maintain `selectedCloseDate: string | null` state instead of volatile array index.
  - Only reset or set default `selectedCloseDate` when `isOpen` turns true for a newly opened modal or card switch.
  - When statements update (due to adding a transaction or payment), find and maintain the matching statement with `selectedCloseDate`.

---

## Verification Plan

### Automated Verification
- Run `compile_applet` to ensure zero TypeScript errors or interface mismatches.
- Run `lint_applet` to verify syntax and import integrity.

### Functional Verification
1. **Multi-Currency Transfer**:
   - Open transfer form: select Source account in USD ($100), Target account in ARS.
   - Enter custom rate (e.g., 1200 ARS/USD) -> verify target amount updates to 120,000 ARS.
   - Or enter custom target amount (130,000 ARS) -> verify custom rate computes to 1300 ARS/USD.
   - Save transfer -> edit transaction -> verify 130,000 ARS and rate 1300 remain intact without being overridden by live rates.
2. **System Currency Toggle**:
   - Change currency from USD to ARS via the header/settings currency selector.
   - Verify all totals and summaries update to ARS.
   - Refresh the page and confirm ARS remains the active reporting currency.
3. **Credit Card Period Navigation**:
   - Open Credit Card Detail modal.
   - Navigate to an older closed statement period (e.g. 2 or 3 periods ago).
   - Record a payment, adjust close date, or edit an expense.
   - Verify the view stays locked on the selected older period instead of bouncing back to the current period.
