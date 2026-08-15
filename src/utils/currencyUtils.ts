import { DisplayCurrency, Transaction, InflationPoint } from '../types';

export interface CurrencyMeta {
  code: string;
  name: string;
  nameEs: string;
  symbol: string;
  flag: string;
  decimals: number;
  locale: string;
  isPopular?: boolean;
}

export const WORLD_CURRENCIES: CurrencyMeta[] = [
  // Major & Popular Currencies
  { code: 'USD', name: 'US Dollar', nameEs: 'Dólar Estadounidense', symbol: '$', flag: '🇺🇸', decimals: 2, locale: 'en-US', isPopular: true },
  { code: 'ARS', name: 'Argentine Peso', nameEs: 'Peso Argentino', symbol: '$', flag: '🇦🇷', decimals: 0, locale: 'es-AR', isPopular: true },
  { code: 'EUR', name: 'Euro', nameEs: 'Euro', symbol: '€', flag: '🇪🇺', decimals: 2, locale: 'de-DE', isPopular: true },
  { code: 'BRL', name: 'Brazilian Real', nameEs: 'Real Brasileño', symbol: 'R$', flag: '🇧🇷', decimals: 2, locale: 'pt-BR', isPopular: true },
  { code: 'GBP', name: 'British Pound', nameEs: 'Libra Esterlina', symbol: '£', flag: '🇬🇧', decimals: 2, locale: 'en-GB', isPopular: true },
  { code: 'MXN', name: 'Mexican Peso', nameEs: 'Peso Mexicano', symbol: '$', flag: '🇲🇽', decimals: 2, locale: 'es-MX', isPopular: true },
  { code: 'CLP', name: 'Chilean Peso', nameEs: 'Peso Chileno', symbol: '$', flag: '🇨🇱', decimals: 0, locale: 'es-CL', isPopular: true },
  { code: 'COP', name: 'Colombian Peso', nameEs: 'Peso Colombiano', symbol: '$', flag: '🇨🇴', decimals: 0, locale: 'es-CO', isPopular: true },
  { code: 'PEN', name: 'Peruvian Sol', nameEs: 'Sol Peruano', symbol: 'S/', flag: '🇵🇪', decimals: 2, locale: 'es-PE', isPopular: true },
  { code: 'UYU', name: 'Uruguayan Peso', nameEs: 'Peso Uruguayo', symbol: '$U', flag: '🇺🇾', decimals: 2, locale: 'es-UY', isPopular: true },
  { code: 'CAD', name: 'Canadian Dollar', nameEs: 'Dólar Canadiense', symbol: 'CA$', flag: '🇨🇦', decimals: 2, locale: 'en-CA', isPopular: true },
  { code: 'JPY', name: 'Japanese Yen', nameEs: 'Yen Japonés', symbol: '¥', flag: '🇯🇵', decimals: 0, locale: 'ja-JP', isPopular: true },
  { code: 'CHF', name: 'Swiss Franc', nameEs: 'Franco Suizo', symbol: 'CHF', flag: '🇨🇭', decimals: 2, locale: 'de-CH', isPopular: true },
  { code: 'AUD', name: 'Australian Dollar', nameEs: 'Dólar Australiano', symbol: 'AU$', flag: '🇦🇺', decimals: 2, locale: 'en-AU', isPopular: true },
  { code: 'CNY', name: 'Chinese Yuan', nameEs: 'Yuan Chino', symbol: '¥', flag: '🇨🇳', decimals: 2, locale: 'zh-CN', isPopular: true },
  { code: 'INR', name: 'Indian Rupee', nameEs: 'Rupia India', symbol: '₹', flag: '🇮🇳', decimals: 2, locale: 'en-IN', isPopular: true },
  { code: 'USDT', name: 'Tether USD', nameEs: 'Tether Cripto', symbol: '₮', flag: '🪙', decimals: 2, locale: 'en-US', isPopular: true },
  
  // Latin America
  { code: 'BOB', name: 'Bolivian Boliviano', nameEs: 'Boliviano', symbol: 'Bs', flag: '🇧🇴', decimals: 2, locale: 'es-BO' },
  { code: 'PYG', name: 'Paraguayan Guarani', nameEs: 'Guaraní Paraguayo', symbol: '₲', flag: '🇵🇾', decimals: 0, locale: 'es-PY' },
  { code: 'CRC', name: 'Costa Rican Colón', nameEs: 'Colón Costarricense', symbol: '₡', flag: '🇨🇷', decimals: 2, locale: 'es-CR' },
  { code: 'DOP', name: 'Dominican Peso', nameEs: 'Peso Dominicano', symbol: 'RD$', flag: '🇩🇴', decimals: 2, locale: 'es-DO' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', nameEs: 'Quetzal Guatemalteco', symbol: 'Q', flag: '🇬🇹', decimals: 2, locale: 'es-GT' },
  { code: 'HNL', name: 'Honduran Lempira', nameEs: 'Lempira Hondureña', symbol: 'L', flag: '🇭🇳', decimals: 2, locale: 'es-HN' },
  { code: 'NIO', name: 'Nicaraguan Córdoba', nameEs: 'Córdoba Nicaragüense', symbol: 'C$', flag: '🇳🇮', decimals: 2, locale: 'es-NI' },
  { code: 'PAB', name: 'Panamanian Balboa', nameEs: 'Balboa Panameño', symbol: 'B/.', flag: '🇵🇦', decimals: 2, locale: 'es-PA' },

  // Europe & Global
  { code: 'NZD', name: 'New Zealand Dollar', nameEs: 'Dólar Neozelandés', symbol: 'NZ$', flag: '🇳🇿', decimals: 2, locale: 'en-NZ' },
  { code: 'SEK', name: 'Swedish Krona', nameEs: 'Corona Sueca', symbol: 'kr', flag: '🇸🇪', decimals: 2, locale: 'sv-SE' },
  { code: 'NOK', name: 'Norwegian Krone', nameEs: 'Corona Noruega', symbol: 'kr', flag: '🇳🇴', decimals: 2, locale: 'no-NO' },
  { code: 'DKK', name: 'Danish Krone', nameEs: 'Corona Danesa', symbol: 'kr', flag: '🇩🇰', decimals: 2, locale: 'da-DK' },
  { code: 'PLN', name: 'Polish Złoty', nameEs: 'Złoty Polaco', symbol: 'zł', flag: '🇵🇱', decimals: 2, locale: 'pl-PL' },
  { code: 'CZK', name: 'Czech Koruna', nameEs: 'Corona Checa', symbol: 'Kč', flag: '🇨🇿', decimals: 2, locale: 'cs-CZ' },
  { code: 'HUF', name: 'Hungarian Forint', nameEs: 'Forinto Húngaro', symbol: 'Ft', flag: '🇭🇺', decimals: 0, locale: 'hu-HU' },
  { code: 'TRY', name: 'Turkish Lira', nameEs: 'Lira Turca', symbol: '₺', flag: '🇹🇷', decimals: 2, locale: 'tr-TR' },
  { code: 'ILS', name: 'Israeli New Shekel', nameEs: 'Nuevo Shekel Israelí', symbol: '₪', flag: '🇮🇱', decimals: 2, locale: 'he-IL' },
  { code: 'AED', name: 'UAE Dirham', nameEs: 'Dírham de EAU', symbol: 'د.إ', flag: '🇦🇪', decimals: 2, locale: 'ar-AE' },
  { code: 'SAR', name: 'Saudi Riyal', nameEs: 'Riyal Saudí', symbol: '﷼', flag: '🇸🇦', decimals: 2, locale: 'ar-SA' },
  { code: 'SGD', name: 'Singapore Dollar', nameEs: 'Dólar de Singapur', symbol: 'S$', flag: '🇸🇬', decimals: 2, locale: 'en-SG' },
  { code: 'HKD', name: 'Hong Kong Dollar', nameEs: 'Dólar de Hong Kong', symbol: 'HK$', flag: '🇭🇰', decimals: 2, locale: 'zh-HK' },
  { code: 'KRW', name: 'South Korean Won', nameEs: 'Won Surcoreano', symbol: '₩', flag: '🇰🇷', decimals: 0, locale: 'ko-KR' },
  { code: 'THB', name: 'Thai Baht', nameEs: 'Baht Tailandés', symbol: '฿', flag: '🇹🇭', decimals: 2, locale: 'th-TH' },
  { code: 'MYR', name: 'Malaysian Ringgit', nameEs: 'Ringgit Malasio', symbol: 'RM', flag: '🇲🇾', decimals: 2, locale: 'ms-MY' },
  { code: 'IDR', name: 'Indonesian Rupiah', nameEs: 'Rupia Indonesia', symbol: 'Rp', flag: '🇮🇩', decimals: 0, locale: 'id-ID' },
  { code: 'PHP', name: 'Philippine Peso', nameEs: 'Peso Filipino', symbol: '₱', flag: '🇵🇭', decimals: 2, locale: 'en-PH' },
  { code: 'VND', name: 'Vietnamese Dong', nameEs: 'Dong Vietnamita', symbol: '₫', flag: '🇻🇳', decimals: 0, locale: 'vi-VN' },
  { code: 'ZAR', name: 'South African Rand', nameEs: 'Rand Sudafricano', symbol: 'R', flag: '🇿🇦', decimals: 2, locale: 'en-ZA' },
  { code: 'EGP', name: 'Egyptian Pound', nameEs: 'Libra Egipcia', symbol: 'E£', flag: '🇪🇬', decimals: 2, locale: 'ar-EG' },
  { code: 'NGN', name: 'Nigerian Naira', nameEs: 'Naira Nigeriana', symbol: '₦', flag: '🇳🇬', decimals: 2, locale: 'en-NG' },
];

export const CURRENCY_MAP: Record<string, CurrencyMeta> = WORLD_CURRENCIES.reduce((acc, curr) => {
  acc[curr.code] = curr;
  return acc;
}, {} as Record<string, CurrencyMeta>);

// Static fallback rates (base: USD = 1.0)
export const DEFAULT_GLOBAL_FX_RATES: Record<string, number> = {
  USD: 1.0,
  USDT: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  BRL: 5.60,
  ARS: 1496.0,
  MXN: 18.50,
  CLP: 945.0,
  COP: 3980.0,
  PEN: 3.75,
  UYU: 40.20,
  CAD: 1.36,
  JPY: 154.0,
  CHF: 0.88,
  AUD: 1.52,
  CNY: 7.25,
  INR: 83.50,
  NZD: 1.65,
  SEK: 10.45,
  NOK: 10.60,
  DKK: 6.87,
  PLN: 3.96,
  CZK: 23.10,
  HUF: 362.0,
  TRY: 32.80,
  ILS: 3.70,
  AED: 3.67,
  SAR: 3.75,
  SGD: 1.35,
  HKD: 7.82,
  KRW: 1375.0,
  THB: 36.50,
  MYR: 4.70,
  IDR: 16150.0,
  PHP: 57.50,
  VND: 25400.0,
  ZAR: 18.40,
  BOB: 6.91,
  PYG: 7550.0,
  CRC: 520.0,
  DOP: 59.0,
  GTQ: 7.78,
  HNL: 24.70,
  NIO: 36.80,
  PAB: 1.0,
  EGP: 47.80,
  NGN: 1480.0,
};

// Memory cache for active rates
let currentGlobalRates: Record<string, number> = { ...DEFAULT_GLOBAL_FX_RATES };
let lastRatesFetchTime = 0;
let activeFxProviderName = 'Open Exchange Rates (Global Multi-Currency Engine)';

/**
 * Initializes and fetches live global FX rates from backend or fallback APIs.
 */
export async function initializeGlobalFxRates(
  onUpdate?: (rates: Record<string, number>, mepRate?: number) => void
): Promise<Record<string, number>> {
  try {
    // 1. Try local cache first
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('finance_app_global_fx_rates');
        const cachedTime = localStorage.getItem('finance_app_fx_rates_timestamp');
        if (cached && cachedTime) {
          const age = Date.now() - parseInt(cachedTime, 10);
          if (age < 3600000) { // 1 hr fresh
            currentGlobalRates = { ...DEFAULT_GLOBAL_FX_RATES, ...JSON.parse(cached) };
            lastRatesFetchTime = parseInt(cachedTime, 10);
          }
        }
      } catch (e) {
        // ignore storage parse error
      }
    }

    // 2. Fetch from backend API endpoint
    let ratesFetched: Record<string, number> | null = null;
    let mepRate: number | undefined = undefined;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/fx-rates', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.globalRates && typeof data.globalRates === 'object') {
          ratesFetched = data.globalRates;
          if (data.rates && (data.rates.bolsa?.sell || data.rates.blue?.sell)) {
            mepRate = data.rates.bolsa?.sell || data.rates.blue?.sell;
          }
        }
      }
    } catch (e) {
      // Backend request failed, try client direct fallback
    }

    // 3. Client direct fallback if backend didn't return
    if (!ratesFetched) {
      try {
        const globalRes = await fetch('https://open.er-api.com/v6/latest/USD');
        if (globalRes.ok) {
          const globalData = await globalRes.json();
          if (globalData && globalData.rates) {
            ratesFetched = { ...globalData.rates, USDT: 1.0 };
            activeFxProviderName = 'Open Exchange Rates (Direct)';
          }
        }
      } catch (e) {
        // Secondary fallback
        try {
          const altRes = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
          if (altRes.ok) {
            const altData = await altRes.json();
            if (altData && altData.usd) {
              const uppercaseRates: Record<string, number> = { USD: 1.0, USDT: 1.0 };
              Object.keys(altData.usd).forEach(k => {
                uppercaseRates[k.toUpperCase()] = altData.usd[k];
              });
              ratesFetched = uppercaseRates;
              activeFxProviderName = 'Fawaz Ahmed Currency API (Direct)';
            }
          }
        } catch (err) {
          // fallback to defaults
        }
      }
    }

    // Also fetch Argentine MEP/Blue rate directly for ARS precision if needed
    if (!mepRate) {
      try {
        const dolarRes = await fetch('https://dolarapi.com/v1/dolares/bolsa');
        if (dolarRes.ok) {
          const mep = await dolarRes.json();
          if (mep && mep.venta) {
            mepRate = mep.venta;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (ratesFetched) {
      if (mepRate && mepRate > 0) {
        ratesFetched['ARS'] = mepRate;
      }
      currentGlobalRates = { ...DEFAULT_GLOBAL_FX_RATES, ...ratesFetched };
      lastRatesFetchTime = Date.now();

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('finance_app_global_fx_rates', JSON.stringify(currentGlobalRates));
          localStorage.setItem('finance_app_fx_rates_timestamp', String(lastRatesFetchTime));
        } catch (e) {}
      }

      if (onUpdate) {
        onUpdate(currentGlobalRates, mepRate);
      }
    }

    return currentGlobalRates;
  } catch (error) {
    console.warn('Using default global FX rates:', error);
    return currentGlobalRates;
  }
}

/**
 * Returns currently active global FX rates map.
 */
export function getActiveGlobalFxRates(): Record<string, number> {
  return currentGlobalRates;
}

/**
 * Returns metadata description of the FX provider.
 */
export function getFxProviderInfo() {
  return {
    provider: activeFxProviderName,
    lastUpdated: lastRatesFetchTime ? new Date(lastRatesFetchTime).toISOString() : new Date().toISOString(),
    currenciesCount: Object.keys(currentGlobalRates).length,
  };
}

/**
 * Returns currency symbol for a currency code.
 */
export function getCurrencySymbol(currency: string): string {
  const code = (currency || 'USD').toUpperCase().trim();
  if (CURRENCY_MAP[code]) {
    return CURRENCY_MAP[code].symbol;
  }
  return '$';
}

/**
 * Returns flag emoji for a currency code.
 */
export function getCurrencyFlag(currency: string): string {
  const code = (currency || 'USD').toUpperCase().trim();
  if (CURRENCY_MAP[code]) {
    return CURRENCY_MAP[code].flag;
  }
  return '🌐';
}

/**
 * Returns human readable name for a currency code.
 */
export function getCurrencyName(currency: string, lang: string = 'en'): string {
  const code = (currency || 'USD').toUpperCase().trim();
  const meta = CURRENCY_MAP[code];
  if (!meta) return code;
  return lang.startsWith('es') ? meta.nameEs : meta.name;
}

/**
 * Performs accurate cross-rate conversion between any two currencies.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: DisplayCurrency,
  usdArsRate: number = 1496,
  dateStr?: string,
  transactions?: Transaction[],
  historyOverride?: InflationPoint[],
  customRates?: Record<string, number>
): number {
  if (amount === 0 || isNaN(amount)) return 0;

  const fromCode = (fromCurrency || 'USD').toUpperCase().trim();
  const toCode = (toCurrency || 'USD').toUpperCase().trim();

  if (fromCode === toCode) return amount;

  const rates = customRates || currentGlobalRates;

  // 1. Direct USD <-> ARS with historical tracking if applicable
  const isFromArs = fromCode === 'ARS';
  const isToArs = toCode === 'ARS';
  const isFromUsd = fromCode === 'USD' || fromCode === 'USDT';
  const isToUsd = toCode === 'USD' || toCode === 'USDT';

  // Use historical rate for USD/ARS if date provided
  let effectiveUsdArsRate = usdArsRate;
  if (historyOverride && dateStr) {
    const monthKey = dateStr.substring(0, 7);
    const pt = historyOverride.find(p => p.month === monthKey);
    if (pt && pt.usdArsRate > 0) {
      effectiveUsdArsRate = pt.usdArsRate;
    }
  }

  // Convert `fromCode` to USD
  let amountInUSD = amount;
  if (isFromUsd) {
    amountInUSD = amount;
  } else if (isFromArs) {
    amountInUSD = effectiveUsdArsRate > 0 ? amount / effectiveUsdArsRate : 0;
  } else if (rates[fromCode] && rates[fromCode] > 0) {
    amountInUSD = amount / rates[fromCode];
  }

  // Convert USD to `toCode`
  if (isToUsd) {
    return amountInUSD;
  } else if (isToArs) {
    return amountInUSD * effectiveUsdArsRate;
  } else if (rates[toCode] && rates[toCode] > 0) {
    return amountInUSD * rates[toCode];
  }

  return amountInUSD;
}

/**
 * Generic standalone cross currency conversion with custom base.
 */
export function convertArbitraryPair(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number> = currentGlobalRates
): { result: number; rate: number } {
  if (amount === 0 || isNaN(amount)) return { result: 0, rate: 1 };
  const from = fromCode.toUpperCase().trim();
  const to = toCode.toUpperCase().trim();

  if (from === to) return { result: amount, rate: 1 };

  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;

  // Cross rate = toRate / fromRate
  const crossRate = toRate / fromRate;
  return {
    result: amount * crossRate,
    rate: crossRate
  };
}
