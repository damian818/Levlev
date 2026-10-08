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

  // Match typical transaction lines:
  // Examples:
  // 02/08/2026 554123 SUPERMERCADO COTO 01/03 $ 45.120,50
  // 02/08 COTO SUC 14 01/03 45.120,50
  // 02-AGO-26 COTO SUC 14 45.120,50
  // 15/08 MERCADOLIBRE CUOTA 02/06 $ 35.000,00
  // 18/08 SU PAGO EN PESOS - $ 150.000,00
  const txLineRegex = /^(\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?|\d{1,2}[/\-.][a-zA-Z]{3}(?:[/\-.]\d{2,4})?)\s+(.*?)(?:(?:c(?:uota)?\.?|\(cuota\)?)\s*(\d{1,2})\s*[/deDE\s]+\s*(\d{1,2})|(\d{1,2})\s*[/]\s*(\d{1,2})|\((\d{1,2})\/(\d{1,2})\))?\s+([-\(\$US\s]*[\d.,]+[\s\-\)]*)$/i;

  for (const line of lines) {
    // Skip obvious header or footer lines
    if (line.match(/^(fecha|date|comprobante|detalle|resumen|total a pagar|saldo anterior|página|page|banco|tarjeta|titular|periodo|cierre|vencimiento)/i)) {
      continue;
    }

    const match = line.match(txLineRegex);
    if (match) {
      const dateRaw = match[1];
      let desc = match[2].trim();
      const instCurr = match[3] || match[5] || match[7];
      const instTot = match[4] || match[6] || match[8];
      const amtRaw = match[9];

      let amt = Math.abs(parseAmount(amtRaw));
      if (amt <= 0) continue;

      const txDate = normalizeDate(dateRaw, defaultYear);
      const isPayment =
        desc.toLowerCase().includes('pago') ||
        desc.toLowerCase().includes('payment') ||
        desc.toLowerCase().includes('credito a su favor') ||
        desc.toLowerCase().includes('su abono') ||
        amtRaw.includes('-') ||
        line.toLowerCase().includes('su pago');

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
          description: desc,
          amount: amt,
          currency: itemCurrency,
        });
      } else {
        const cleanTitle = cleanMerchantTitle(desc);
        const category = matchCategory(desc, categories);

        items.push({
          date: txDate,
          rawDescription: desc,
          cleanTitle,
          amount: amt,
          currency: itemCurrency,
          category,
          installmentCurrent: instCurr ? parseInt(instCurr, 10) : null,
          installmentTotal: instTot ? parseInt(instTot, 10) : null,
          cardholder: null,
        });
      }
    }
  }

  // Deduplicate items
  const dedupedItems: ParsedItem[] = [];
  const seenKey = new Set<string>();

  for (const it of items) {
    const key = `${it.date}_${it.cleanTitle}_${it.amount}_${it.installmentCurrent || 0}`;
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
