import PDFParser from 'pdf2json';

/**
 * Extracts structured text from a PDF buffer using pdf2json,
 * grouping text items by page and spatial vertical coordinates (y)
 * then sorting by horizontal coordinate (x) to preserve column/table alignment.
 */
export async function extractTextWithPdf2Json(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parser = new (PDFParser as any)();

      parser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          if (!pdfData || !Array.isArray(pdfData.Pages)) {
            return resolve('');
          }

          const allLines: string[] = [];

          for (const page of pdfData.Pages) {
            const texts = page.Texts || [];
            if (!Array.isArray(texts) || texts.length === 0) continue;

            // Group text items by Y coordinate with a line-height threshold
            // In pdf2json, page coordinates are proportional numbers
            const rowMap = new Map<number, any[]>();

            for (const t of texts) {
              if (!t.R || !Array.isArray(t.R)) continue;
              // Quantize Y coordinate to snap horizontally adjacent tokens to the same row
              const yQuantized = Math.round(t.y * 3) / 3;
              if (!rowMap.has(yQuantized)) {
                rowMap.set(yQuantized, []);
              }
              rowMap.get(yQuantized)!.push(t);
            }

            // Sort rows top-to-bottom
            const sortedY = Array.from(rowMap.keys()).sort((a, b) => a - b);

            for (const y of sortedY) {
              const rowItems = rowMap.get(y)!.sort((a, b) => (a.x || 0) - (b.x || 0));
              const lineTokens: string[] = [];

              for (const item of rowItems) {
                if (!item.R) continue;
                for (const r of item.R) {
                  if (r.T) {
                    try {
                      lineTokens.push(decodeURIComponent(r.T));
                    } catch {
                      lineTokens.push(r.T);
                    }
                  }
                }
              }

              const lineStr = lineTokens.join('   ').trim();
              if (lineStr.length > 0) {
                allLines.push(lineStr);
              }
            }
          }

          resolve(allLines.join('\n'));
        } catch (processErr) {
          reject(processErr);
        }
      });

      parser.on('pdfParser_dataError', (errData: any) => {
        reject(errData?.parserError || errData || new Error('pdf2json parsing error'));
      });

      parser.parseBuffer(buffer);
    } catch (initErr) {
      reject(initErr);
    }
  });
}

/**
 * Extracts text using Mozilla's pdfjs-dist engine as fallback
 */
export async function extractTextWithPdfJs(buffer: Buffer | Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const loadingTask = pdfjs.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[] }>;

    if (!items || items.length === 0) continue;

    // Group items by Y coordinate (transform[5])
    const rowMap = new Map<number, Array<{ x: number; str: string }>>();

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4] || 0;

      let matchedKey: number | null = null;
      for (const existingY of rowMap.keys()) {
        if (Math.abs(existingY - y) <= 3) {
          matchedKey = existingY;
          break;
        }
      }

      const key = matchedKey ?? y;
      if (!rowMap.has(key)) rowMap.set(key, []);
      rowMap.get(key)!.push({ x, str: item.str });
    }

    // Higher Y is top of the page in PDF coordinate system
    const sortedY = Array.from(rowMap.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const rowItems = rowMap.get(y)!.sort((a, b) => a.x - b.x);
      const lineStr = rowItems.map(it => it.str.trim()).filter(Boolean).join('   ');
      if (lineStr.length > 0) {
        pageLines.push(lineStr);
      }
    }
  }

  return pageLines.join('\n');
}

/**
 * Primary multi-engine PDF parser:
 * 1. Attempts pdf2json (fast, structured table coordinates)
 * 2. Falls back to pdfjs-dist if pdf2json fails or yields sparse output
 */
export async function extractStructuredTextFromPdfBuffer(
  buffer: Buffer
): Promise<{ text: string; engine: 'pdf2json' | 'pdfjs-dist' }> {
  try {
    const text = await extractTextWithPdf2Json(buffer);
    if (text && text.trim().length > 30) {
      return { text: text.trim(), engine: 'pdf2json' };
    }
  } catch (pdf2jsonErr) {
    console.warn('pdf2json extraction failed, falling back to pdfjs-dist:', pdf2jsonErr);
  }

  try {
    const text = await extractTextWithPdfJs(buffer);
    if (text && text.trim().length > 0) {
      return { text: text.trim(), engine: 'pdfjs-dist' };
    }
  } catch (pdfjsErr) {
    console.warn('pdfjs-dist extraction failed:', pdfjsErr);
  }

  return { text: '', engine: 'pdf2json' };
}
