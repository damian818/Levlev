export interface ParsedItem {
  date: string;
  rawDescription: string;
  cleanTitle: string;
  amount: number;
  currency: string;
  category: string;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  cardholder: string | null;
}

export interface ParsedStatement {
  issuer: string;
  cardLast4: string | null;
  periodStart: string;
  periodEnd: string;
  closeDate: string;
  dueDate: string | null;
  currency: string;
  statementTotal: number;
  items: ParsedItem[];
  payments: {
    date: string;
    description: string;
    amount: number;
    currency: string;
  }[];
}

const SPANISH_ENGLISH_MONTH_MAP: Record<string, string> = {
  ene: '01', jan: '01',
  feb: '02',
  mar: '03',
  abr: '04', apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08', aug: '08',
  sep: '09', set: '09',
  oct: '10',
  nov: '11',
  dic: '12', dec: '12',
};

export function parseAmount(amtStr: string): number {
  if (!amtStr) return 0;
  // Remove currency marks, parentheses, spaces
  let s = amtStr.replace(/[^\d.,-]/g, '').trim();
  // Handle trailing minus (e.g. "45.120,50-")
  if (s.endsWith('-')) {
    s = '-' + s.slice(0, -1);
  }
  const isNegative = s.startsWith('-');
  if (isNegative) s = s.substring(1);

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Argentine format: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const val = parseFloat(s) || 0;
  return isNegative ? -val : val;
}

export function normalizeDate(rawDate: string, defaultYear: number): string {
  if (!rawDate) return new Date().toISOString().substring(0, 10);
  const clean = rawDate.trim().replace(/[.]/g, '/').replace(/-/g, '/');
  const parts = clean.split(/[\/\s]+/).filter(Boolean);

  if (parts.length === 2) {
    let day = parts[0];
    let month = parts[1].toLowerCase();
    if (SPANISH_ENGLISH_MONTH_MAP[month]) {
      month = SPANISH_ENGLISH_MONTH_MAP[month];
    } else {
      month = month.padStart(2, '0');
    }
    return `${defaultYear}-${month}-${day.padStart(2, '0')}`;
  }

  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1].toLowerCase();
    let year = parts[2];

    // Check if ISO format YYYY/MM/DD
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }

    if (SPANISH_ENGLISH_MONTH_MAP[month]) {
      month = SPANISH_ENGLISH_MONTH_MAP[month];
    } else {
      month = month.padStart(2, '0');
    }

    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  return new Date().toISOString().substring(0, 10);
}

export function cleanMerchantTitle(desc: string): string {
  let clean = desc
    // Strip leading authorization, ticket or voucher numbers (e.g. "554123 COTO")
    .replace(/^(\d{4,10}\s+)+/, '')
    .replace(/^([A-Z]\d{4,8}\s+)+/, '')
    .replace(/(OP\s*\d+|SUC\s*\d+|SUCURSAL\s*\d+)/gi, '')
    .replace(/\b(SA|SRL|LTDA|INC|LLC|CORP|S\.A\.|S\.R\.L\.)\b/gi, '')
    .replace(/^(MP\*|MERPAG\*|PAYPAL\*|STRIPE\*|PAGOS360\*)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize nicely
  if (clean.length > 2) {
    clean = clean
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return clean || desc;
}

export function matchCategory(desc: string, categories: string[]): string {
  const text = desc.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    'Food': ['coto', 'dia', 'carrefour', 'disco', 'jumbo', 'vea', 'supermercado', 'super', 'almacen', 'restaurante', 'pizzeria', 'burger', 'mcdonalds', 'mostaza', 'starbucks', 'cafe', 'bar', 'rotiseria', 'panaderia', 'rappi', 'pedidosya', 'delivery'],
    'Transportation': ['ypf', 'shell', 'axion', 'combustible', 'nafta', 'estacion', 'uber', 'cabify', 'didi', 'peaje', 'autopista', 'ausa', 'estacionamiento', 'subte', 'tren', 'colectivo', 'taxi', 'aerolineas', 'flybondi', 'jetsmart'],
    'Healthcare': ['farmacity', 'farmacia', 'medic', 'osde', 'swiss medical', 'galeno', 'hospital', 'clinica', 'odontolog', 'optica', 'laboratorio', 'doctored'],
    'Entertainment': ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'youtube', 'cine', 'cinemark', 'hoyts', 'teatro', 'steam', 'playstation', 'ticketek', 'allaccess', 'passline'],
    'Shopping': ['mercadolibre', 'fravega', 'musimundo', 'garbarino', 'falabella', 'zara', 'nike', 'adidas', 'ropa', 'calzado', 'indumentaria', 'libreria', 'sport'],
    'Services': ['fibertel', 'telecom', 'claro', 'movistar', 'personal', 'edenor', 'edesur', 'metrogas', 'naturgy', 'aysa', 'abl', 'arba', 'afip', 'seguro', 'comision', 'mantenimiento', 'iva', 'impuesto', 'percepcion', 'db.rg', 'ingresos brutos'],
    'Housing': ['alquiler', 'expensas', 'consorcio', 'inmobiliaria', 'ferreteria', 'easy', 'sodimac'],
    'Utilities': ['luz', 'gas', 'agua', 'internet', 'cable', 'telefono'],
  };

  for (const [catName, kws] of Object.entries(keywordMap)) {
    if (kws.some(k => text.includes(k))) {
      // Find closest existing user category
      const match = categories.find(c =>
        c.toLowerCase().includes(catName.toLowerCase()) || catName.toLowerCase().includes(c.toLowerCase())
      );
      if (match) return match;
      return catName;
    }
  }

  return categories[0] || 'General';
}

export function parseStatementTextDeterministically(
  text: string,
  categories: string[] = [],
  accounts: string[] = [],
  cardHint: string = ''
): ParsedStatement {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let issuer = cardHint || 'Credit Card';
  let cardLast4: string | null = null;
  let closeDate = '';
  let periodStart = '';
  let periodEnd = '';
  let dueDate: string | null = null;
  let statementTotal = 0;
  let currency = 'ARS';

  // Extract metadata
  const textLower = text.toLowerCase();
  if (textLower.includes('visa')) issuer = 'Visa';
  else if (textLower.includes('mastercard') || textLower.includes('master')) issuer = 'Mastercard';
  else if (textLower.includes('american express') || textLower.includes('amex')) issuer = 'American Express';

  if (textLower.includes('santander')) issuer = issuer === 'Credit Card' ? 'Santander' : `${issuer} Santander`;
  else if (textLower.includes('bbva')) issuer = issuer === 'Credit Card' ? 'BBVA' : `${issuer} BBVA`;
  else if (textLower.includes('galicia')) issuer = issuer === 'Credit Card' ? 'Galicia' : `${issuer} Galicia`;
  else if (textLower.includes('macro')) issuer = issuer === 'Credit Card' ? 'Macro' : `${issuer} Macro`;
  else if (textLower.includes('nacion')) issuer = issuer === 'Credit Card' ? 'Nacion' : `${issuer} Nacion`;

  // Last 4 digits (e.g. "Tarjeta: XXXX-XXXX-XXXX-4589", "Nro: *4589", "Terminada en 4589")
  const last4Match =
    text.match(/(?:tarjeta|card|cuenta|nro\.?|terminada en)\s*[:.]?\s*(?:[xX*•-]+\s*)*(\d{4})/i) ||
    text.match(/\b\d{4}[ -]\d{4}[ -]\d{4}[ -](\d{4})\b/) ||
    text.match(/(?:[xX*•]{4}[ -]?){3}(\d{4})/);
  if (last4Match) {
    cardLast4 = last4Match[1];
  }

  // Dates: Cierre & Vencimiento
  const cierreMatch = text.match(/(?:cierre|fecha de cierre|cierre actual)\s*[:.]?\s*(\d{1,2}[/\-. ](?:[a-zA-Z]{3,4}|\d{1,2})[/\-. ]?(?:\d{2,4})?)/i);
  if (cierreMatch) {
    closeDate = normalizeDate(cierreMatch[1], defaultYear);
    periodEnd = closeDate;
  }

  const vtoMatch = text.match(/(?:vencimiento|vto|fecha de vto|vto\. actual)\s*[:.]?\s*(\d{1,2}[/\-. ](?:[a-zA-Z]{3,4}|\d{1,2})[/\-. ]?(?:\d{2,4})?)/i);
  if (vtoMatch) {
    dueDate = normalizeDate(vtoMatch[1], defaultYear);
  }

  // Period start
  const periodMatch = text.match(/(?:periodo|desde)\s*[:.]?\s*(\d{1,2}[/\-. ](?:[a-zA-Z]{3,4}|\d{1,2})[/\-. ]?(?:\d{2,4})?)\s*(?:al|hasta|-)\s*(\d{1,2}[/\-. ](?:[a-zA-Z]{3,4}|\d{1,2})[/\-. ]?(?:\d{2,4})?)/i);
  if (periodMatch) {
    periodStart = normalizeDate(periodMatch[1], defaultYear);
    if (!periodEnd) periodEnd = normalizeDate(periodMatch[2], defaultYear);
  }

  // Total balance
  const totalMatch = text.match(/(?:total a pagar|saldo actual|total del mes|total financiado|total pesos|saldo al cierre|saldo pesos)\s*[:.]?\s*[\$US\s]*\s*([\d.,]+)/i);
  if (totalMatch) {
    statementTotal = Math.abs(parseAmount(totalMatch[1]));
  }

  const items: ParsedItem[] = [];
  const payments: { date: string; description: string; amount: number; currency: string }[] = [];

  // Match statement transaction lines with flexible column formats:
  // e.g.:
  // 02/03/26 001245 SUPERMERCADO COTO 01/01 45.200,50 0,00
  // 05/03/26 003412 FARMACITY 44 01/03 12.300,00 0,00
  // 12/03/26 009871 NETFLIX.COM 0,00 15,99
  // 15/03/26 MERCADOLIBRE *COMPRA 02/06 38.450,00
  // 20/03/26 000000 SU PAGO EN PESOS -95.950,50 0,00
  // 18/03/2026 FARMACITY 44 $ 12.500,00
  for (const line of lines) {
    // Skip obvious header, divider or summary lines
    if (line.match(/^(fecha|date|comprobante|detalle|resumen|total a pagar|total del mes|saldo anterior|página|page|banco|tarjeta|titular|periodo|cierre|vencimiento|---|===|\*\*\*|___)/i)) {
      continue;
    }

    // Match lines starting with a date: DD/MM/YY, DD/MM/YYYY, DD-MMM-YY, etc.
    const dateMatch = line.match(/^(\d{1,2}[/\-.](?:\d{1,2}|[a-zA-Z]{3,4})(?:[/\-.]\d{2,4})?)\s+(.*)$/);
    if (!dateMatch) {
      continue;
    }

    const dateRaw = dateMatch[1];
    let rest = dateMatch[2].trim();

    // Extract trailing amounts (one or two, for Pesos and USD columns)
    const amounts: string[] = [];
    while (true) {
      const amtMatch = rest.match(/([+\-]?(?:\$|U\$S|USD|US\$)?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|-?\b\d+,\d{2}\b|-?\b\d+\.\d{2}\b)(?:\s*[-+])?\s*$/i);
      if (!amtMatch) break;
      amounts.unshift(amtMatch[1].trim());
      rest = rest.slice(0, amtMatch.index).trim();
      if (amounts.length >= 2) break; // Maximum 2 trailing columns (Pesos, USD)
    }

    if (amounts.length === 0) continue;

    // Check for installment pattern at the end of remaining text:
    // e.g. "01/03", "C.01/03", "(01/03)", "01 de 03", "1/3", "CUOTA 02/06"
    let instCurr: number | null = null;
    let instTot: number | null = null;
    const instMatch = rest.match(/(?:c(?:uota)?\.?|\(cuota\)?|\bcuota\b)?\s*(\d{1,2})\s*[/deDE\s]+\s*(\d{1,2})\s*$/i);
    if (instMatch) {
      instCurr = parseInt(instMatch[1], 10);
      instTot = parseInt(instMatch[2], 10);
      rest = rest.slice(0, instMatch.index).trim();
    }

    // Strip leading voucher / ticket / coupon / operation number if present:
    // e.g. "001245 SUPERMERCADO COTO", "OP 123445 FARMACIA"
    rest = rest.replace(/^(\d{4,10}\s+)+/, '').trim();
    rest = rest.replace(/^(OP\s*\d+|CUPON\s*\d+|COMP\s*\d+)\s+/i, '').trim();

    if (!rest || rest.length < 2) continue;

    const txDate = normalizeDate(dateRaw, defaultYear);
    const isPayment =
      rest.toLowerCase().includes('pago') ||
      rest.toLowerCase().includes('payment') ||
      rest.toLowerCase().includes('credito a su favor') ||
      rest.toLowerCase().includes('su abono') ||
      line.toLowerCase().includes('su pago') ||
      amounts.some(a => a.includes('-') || a.endsWith('-'));

    if (amounts.length === 2) {
      // Dual column: Pesos and USD
      const amtArs = parseAmount(amounts[0]);
      const amtUsd = parseAmount(amounts[1]);

      if (isPayment) {
        if (amtArs !== 0) {
          payments.push({
            date: txDate,
            description: cleanMerchantTitle(rest),
            amount: Math.abs(amtArs),
            currency: 'ARS',
          });
        }
        if (amtUsd !== 0) {
          payments.push({
            date: txDate,
            description: cleanMerchantTitle(rest),
            amount: Math.abs(amtUsd),
            currency: 'USD',
          });
        }
      } else {
        if (amtArs > 0) {
          items.push({
            date: txDate,
            rawDescription: rest,
            cleanTitle: cleanMerchantTitle(rest),
            amount: amtArs,
            currency: 'ARS',
            category: matchCategory(rest, categories),
            installmentCurrent: instCurr,
            installmentTotal: instTot,
            cardholder: null,
          });
        }
        if (amtUsd > 0) {
          items.push({
            date: txDate,
            rawDescription: rest,
            cleanTitle: cleanMerchantTitle(rest),
            amount: amtUsd,
            currency: 'USD',
            category: matchCategory(rest, categories),
            installmentCurrent: instCurr,
            installmentTotal: instTot,
            cardholder: null,
          });
        }
      }
    } else {
      // Single amount column
      const amt = Math.abs(parseAmount(amounts[0]));
      if (amt <= 0) continue;

      let itemCurrency = 'ARS';
      if (
        line.toLowerCase().includes('usd') ||
        line.toLowerCase().includes('u$s') ||
        line.toLowerCase().includes('us$')
      ) {
        itemCurrency = 'USD';
      }

      if (isPayment) {
        payments.push({
          date: txDate,
          description: cleanMerchantTitle(rest),
          amount: amt,
          currency: itemCurrency,
        });
      } else {
        items.push({
          date: txDate,
          rawDescription: rest,
          cleanTitle: cleanMerchantTitle(rest),
          amount: amt,
          currency: itemCurrency,
          category: matchCategory(rest, categories),
          installmentCurrent: instCurr,
          installmentTotal: instTot,
          cardholder: null,
        });
      }
    }
  }

  // Deduplicate items
  const dedupedItems: ParsedItem[] = [];
  const seenKey = new Set<string>();

  for (const it of items) {
    const key = `${it.date}_${it.cleanTitle}_${it.amount}_${it.currency}_${it.installmentCurrent || 0}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      dedupedItems.push(it);
    }
  }

  // If periodStart or periodEnd still empty, infer from items
  if (!periodEnd && dedupedItems.length > 0) {
    const dates = dedupedItems.map(i => i.date).sort();
    periodStart = periodStart || dates[0];
    periodEnd = dates[dates.length - 1];
    closeDate = closeDate || periodEnd;
  }

  if (statementTotal === 0 && dedupedItems.length > 0) {
    statementTotal = dedupedItems.reduce((acc, curr) => acc + curr.amount, 0);
  }

  return {
    issuer,
    cardLast4,
    periodStart: periodStart || new Date().toISOString().substring(0, 10),
    periodEnd: periodEnd || new Date().toISOString().substring(0, 10),
    closeDate: closeDate || periodEnd || new Date().toISOString().substring(0, 10),
    dueDate,
    currency,
    statementTotal,
    items: dedupedItems,
    payments,
  };
}
