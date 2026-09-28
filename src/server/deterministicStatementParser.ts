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

function parseAmount(amtStr: string): number {
  if (!amtStr) return 0;
  let s = amtStr.replace(/[^0-9.,]/g, '').trim();
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s) || 0;
}

function normalizeDate(rawDate: string, defaultYear: number): string {
  const parts = rawDate.split(/[/-]/);
  if (parts.length === 2) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    return `${defaultYear}-${month}-${day}`;
  }
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    if (year.length === 2) year = `20${year}`;
    // If format is YYYY-MM-DD
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return new Date().toISOString().substring(0, 10);
}

function cleanMerchantTitle(desc: string): string {
  let clean = desc
    .replace(/^(\d{4,8}\s+)+/, '') // remove leading reference numbers
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

function matchCategory(desc: string, categories: string[]): string {
  const text = desc.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    'Food': ['coto', 'dia', 'carrefour', 'disco', 'jumbo', 'vea', 'supermercado', 'restaurante', 'pizzeria', 'burger', 'mcdonalds', 'starbucks', 'cafe', 'bar', 'rotiseria', 'panaderia', 'rappi', 'pedidosya', 'delivery'],
    'Transportation': ['ypf', 'shell', 'axion', 'combustible', 'nafta', 'uber', 'cabify', 'didi', 'peaje', 'autopista', 'estacionamiento', 'subte', 'tren', 'colectivo', 'taxi'],
    'Healthcare': ['farmacity', 'farmacia', 'medic', 'osde', 'swiss medical', 'galeno', 'hospital', 'clinica', 'odontolog', 'optica', 'laboratorio'],
    'Entertainment': ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'youtube', 'cine', 'cinemark', 'teatro', 'steam', 'playstation', 'ticketek', 'allaccess'],
    'Shopping': ['mercadolibre', 'fravega', 'musimundo', 'garbarino', 'falabella', 'zara', 'nike', 'adidas', 'ropa', 'calzado', 'indumentaria'],
    'Services': ['fibertel', 'telecom', 'claro', 'movistar', 'personal', 'edenor', 'edesur', 'metrogas', 'aysa', 'abl', 'arba', 'afip', 'seguro', 'comision', 'mantenimiento'],
    'Housing': ['alquiler', 'expensas', 'consorcio', 'inmobiliaria', 'ferreteria', 'easy', 'sodimac'],
  };

  for (const [catName, kws] of Object.entries(keywordMap)) {
    if (kws.some(k => text.includes(k))) {
      // Find closest existing user category
      const match = categories.find(c => c.toLowerCase().includes(catName.toLowerCase()) || catName.toLowerCase().includes(c.toLowerCase()));
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

  if (textLower.includes('santander')) issuer += ' Santander';
  else if (textLower.includes('bbva')) issuer += ' BBVA';
  else if (textLower.includes('galicia')) issuer += ' Galicia';
  else if (textLower.includes('macro')) issuer += ' Macro';

  // Last 4 digits
  const last4Match = text.match(/(?:tarjeta|card|cuenta|nro\.?)\s*(?:[xX*•-]+\s*)+(\d{4})/i) || text.match(/\b\d{4}[ -]\d{4}[ -]\d{4}[ -](\d{4})\b/);
  if (last4Match) {
    cardLast4 = last4Match[1];
  }

  // Dates: Cierre & Vencimiento
  const cierreMatch = text.match(/(?:cierre|fecha de cierre|cierre actual)\s*[:.]?\s*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i);
  if (cierreMatch) {
    closeDate = normalizeDate(cierreMatch[1], defaultYear);
    periodEnd = closeDate;
  }

  const vtoMatch = text.match(/(?:vencimiento|vto|fecha de vto|vto\. actual)\s*[:.]?\s*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i);
  if (vtoMatch) {
    dueDate = normalizeDate(vtoMatch[1], defaultYear);
  }

  // Period start
  const periodMatch = text.match(/(?:periodo|desde)\s*[:.]?\s*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s*(?:al|hasta|-)\s*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i);
  if (periodMatch) {
    periodStart = normalizeDate(periodMatch[1], defaultYear);
    if (!periodEnd) periodEnd = normalizeDate(periodMatch[2], defaultYear);
  }

  // Total balance
  const totalMatch = text.match(/(?:total a pagar|saldo actual|total del mes|total financiado|total pesos)\s*[:.]?\s*[\$US]*\s*([\d.,]+)/i);
  if (totalMatch) {
    statementTotal = parseAmount(totalMatch[1]);
  }

  const items: ParsedItem[] = [];
  const payments: { date: string; description: string; amount: number; currency: string }[] = [];

  // Match typical transaction lines
  // Example: 20/08/2026 COTO SUC 14 01/01 $ 48.620,00
  // Or: 20/08 COTO SUC 14 48620.00
  const txLineRegex = /(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.*?)(?:c(?:uota)?\.?\s*(\d{1,2})\s*[/]\s*(\d{1,2})|(\d{1,2})\s*[/]\s*(\d{1,2}))?\s+([\$US\s]*[\d.,]+)\s*$/i;

  for (const line of lines) {
    // Skip obvious header or footer lines
    if (line.match(/^(fecha|date|comprobante|detalle|resumen|total a pagar|saldo anterior|página|page)/i)) continue;

    const match = line.match(txLineRegex);
    if (match) {
      const dateRaw = match[1];
      let desc = match[2].trim();
      const instCurr = match[3] || match[5];
      const instTot = match[4] || match[6];
      const amtRaw = match[7];

      const amt = parseAmount(amtRaw);
      if (amt <= 0) continue;

      const txDate = normalizeDate(dateRaw, defaultYear);
      const isPayment = desc.toLowerCase().includes('pago') || desc.toLowerCase().includes('payment') || desc.toLowerCase().includes('credito a su favor');

      let itemCurrency = 'ARS';
      if (line.toLowerCase().includes('usd') || line.toLowerCase().includes('u$s') || line.toLowerCase().includes('us$')) {
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

  // Deduplicate items if identical date, cleanTitle and amount appear multiple times consecutively due to formatting repeats
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
