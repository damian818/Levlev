import { ViewTab } from '../types';

export interface TabCustomizationItem {
  id: ViewTab;
  order: number;
  isHidden?: boolean;
}

export const DEFAULT_TAB_ORDER: TabCustomizationItem[] = [
  { id: 'overview', order: 0, isHidden: false },
  { id: 'reports', order: 1, isHidden: false },
  { id: 'transactions', order: 2, isHidden: false },
  { id: 'accounts', order: 3, isHidden: false },
  { id: 'budgets', order: 4, isHidden: false },
  { id: 'recurring', order: 5, isHidden: false },
  { id: 'debt-payoff', order: 6, isHidden: false },
  { id: 'inflation', order: 7, isHidden: false },
  { id: 'ai-advisor', order: 8, isHidden: false },
  { id: 'settings', order: 9, isHidden: false },
];

const STORAGE_KEY = 'finance_app_tab_customization';
const LEGACY_STORAGE_KEY = 'levlev_tab_customization';

/**
 * Returns merged tab customization items ensuring all available ViewTabs are present.
 */
export function getSavedTabCustomization(): TabCustomizationItem[] {
  if (typeof window === 'undefined') return [...DEFAULT_TAB_ORDER];

  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed: TabCustomizationItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return mergeTabOrder(parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading tab customization from localStorage:', e);
  }

  return [...DEFAULT_TAB_ORDER];
}

/**
 * Merges a saved tab customization list with all known default tabs.
 * Any newly added tab in the app that is not in the saved list is appended in its default position.
 */
export function mergeTabOrder(saved?: TabCustomizationItem[]): TabCustomizationItem[] {
  if (!saved || !Array.isArray(saved) || saved.length === 0) {
    return [...DEFAULT_TAB_ORDER];
  }

  const existingIds = new Set(saved.map(t => t.id));
  const result: TabCustomizationItem[] = [];

  // Add all valid saved tabs
  saved.forEach((item, index) => {
    // Only accept recognized tab IDs
    if (DEFAULT_TAB_ORDER.some(def => def.id === item.id)) {
      result.push({
        id: item.id,
        order: typeof item.order === 'number' ? item.order : index,
        isHidden: !!item.isHidden && item.id !== 'settings', // Settings can never be permanently hidden to prevent lockout
      });
    }
  });

  // Append any missing tabs from DEFAULT_TAB_ORDER
  DEFAULT_TAB_ORDER.forEach((def) => {
    if (!existingIds.has(def.id)) {
      result.push({
        id: def.id,
        order: result.length,
        isHidden: def.isHidden || false,
      });
    }
  });

  // Sort by order index
  result.sort((a, b) => a.order - b.order);

  // Normalize order numbers from 0 to N-1
  return result.map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

/**
 * Saves tab customization to localStorage.
 */
export function saveTabCustomizationToStorage(tabs: TabCustomizationItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(tabs);
    localStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent('finance_app_tab_settings_updated', { detail: tabs }));
  } catch (e) {
    console.error('Error saving tab customization to localStorage:', e);
  }
}
