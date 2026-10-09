/**
 * PDF Text Extractor
 * Extracts plain text from PDF documents both in Node.js (via zlib)
 * and in modern browsers (via DecompressionStream), with token decoding
 * for Tj, TJ, Td, ET and literal / hexadecimal string escapes.
 */

function decodePdfLiteralString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  let result = '';
  for (let i = 0; i < clean.length; i += 2) {
    const byteHex = clean.slice(i, i + 2);
    if (byteHex.length === 2) {
      result += String.fromCharCode(parseInt(byteHex, 16));
    }
  }
  return result;
}

/**
 * Decompresses a raw byte stream using Web DecompressionStream
 */
async function decompressStreamBytes(rawBytes: Uint8Array): Promise<string> {
  // 1. Try Web DecompressionStream (supported in modern browsers)
  if (typeof DecompressionStream !== 'undefined') {
    // Try standard zlib wrapper first ('deflate')
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(rawBytes as any);
      writer.close();
      const resp = new Response(ds.readable);
      const decompressedBuf = await resp.arrayBuffer();
      const u8 = new Uint8Array(decompressedBuf);
      let s = '';
      for (let i = 0; i < u8.length; i++) {
        s += String.fromCharCode(u8[i]);
      }
      return s;
    } catch {
      // Try raw deflate ('deflate-raw')
      try {
        const dsRaw = new DecompressionStream('deflate-raw');
        const writerRaw = dsRaw.writable.getWriter();
        writerRaw.write(rawBytes as any);
        writerRaw.close();
        const respRaw = new Response(dsRaw.readable);
        const decompressedBufRaw = await respRaw.arrayBuffer();
        const u8Raw = new Uint8Array(decompressedBufRaw);
        let s = '';
        for (let i = 0; i < u8Raw.length; i++) {
          s += String.fromCharCode(u8Raw[i]);
        }
        return s;
      } catch {
        // Fall back to raw string
      }
    }
  }

  // Fallback: convert bytes directly to latin1 string
  let str = '';
  for (let i = 0; i < rawBytes.length; i++) {
    str += String.fromCharCode(rawBytes[i]);
  }
  return str;
}

/**
 * Extracts plain text lines from a decompressed PDF content stream
 */
function extractLinesFromStreamText(streamStr: string): string[] {
  const extractedLines: string[] = [];
  let currentLine = '';

  const tokens = streamStr.match(/BT|ET|Td|TD|T\*|Tm|'|"|\((?:\\.|[^\\)])*\)\s*T[j*']|\[(?:[^\\[\\]]|\\.)*\]\s*TJ|<[0-9a-fA-F\s]+>\s*T[j*']|<[0-9a-fA-F\s]+>\s*TJ/g) || [];

  for (const token of tokens) {
    if (token === 'BT' || token === 'ET' || token === 'T*' || token === 'Td' || token === 'TD' || token === 'Tm') {
      if (currentLine.trim()) {
        extractedLines.push(currentLine.trim());
      }
      currentLine = '';
    } else if (token.endsWith('Tj') || token.endsWith('T*') || token.endsWith("'") || token.endsWith('"')) {
      const strMatch = token.match(/^\(((?:\\.|[^\\)])*)\)/);
      if (strMatch) {
        currentLine += decodePdfLiteralString(strMatch[1]) + ' ';
      } else {
        const hexMatch = token.match(/^<([0-9a-fA-F\s]+)>/);
        if (hexMatch) {
          currentLine += decodePdfHexString(hexMatch[1]) + ' ';
        }
      }
    } else if (token.endsWith('TJ')) {
      const inner = token.replace(/^\s*\[/, '').replace(/\]\s*TJ\s*$/, '');
      const items = inner.match(/\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]+>|[-+]?\d*\.?\d+/g) || [];
      for (const item of items) {
        if (item.startsWith('(')) {
          currentLine += decodePdfLiteralString(item.slice(1, -1));
        } else if (item.startsWith('<')) {
          currentLine += decodePdfHexString(item.slice(1, -1));
        } else {
          const spacing = parseFloat(item);
          if (spacing < -100) {
            currentLine += ' ';
          }
        }
      }
      currentLine += ' ';
    }
  }

  if (currentLine.trim()) {
    extractedLines.push(currentLine.trim());
  }

  return extractedLines;
}

/**
 * Searches for needle bytes inside a haystack Uint8Array
 */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, startPos = 0): number {
  if (needle.length === 0) return 0;
  for (let i = startPos; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

const STREAM_BYTES = new Uint8Array([115, 116, 114, 101, 97, 109]); // "stream"
const ENDSTREAM_BYTES = new Uint8Array([101, 110, 100, 115, 116, 114, 101, 97, 109]); // "endstream"

/**
 * Parses a PDF buffer (Uint8Array or Buffer) and extracts all text lines
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

  // 1. If running in a browser environment, use the local backend's high-precision PDF engine
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      // Convert bytes to base64 safely
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);

      const resp = await fetch('/api/extract-pdf-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 }),
      });

      if (resp.ok) {
        const json = await resp.json();
        if (json && typeof json.text === 'string' && json.text.trim().length > 0) {
          return json.text.trim();
        }
      }
    } catch (apiErr) {
      console.warn('API PDF extraction call failed, falling back to local decompression:', apiErr);
    }
  }

  // 2. Fallback byte stream extractor
  const allLines: string[] = [];

  let pos = 0;
  while (pos < bytes.length) {
    const streamIdx = indexOfBytes(bytes, STREAM_BYTES, pos);
    if (streamIdx === -1) break;

    let start = streamIdx + 6;
    while (start < bytes.length && (bytes[start] === 0x0d || bytes[start] === 0x0a || bytes[start] === 0x20)) {
      start++;
    }

    const endIdx = indexOfBytes(bytes, ENDSTREAM_BYTES, start);
    if (endIdx === -1) break;

    let end = endIdx;
    while (end > start && (bytes[end - 1] === 0x0d || bytes[end - 1] === 0x0a || bytes[end - 1] === 0x20)) {
      end--;
    }

    const rawStream = bytes.subarray(start, end);
    pos = endIdx + 9;

    if (rawStream.length > 0) {
      try {
        const streamText = await decompressStreamBytes(rawStream);
        const lines = extractLinesFromStreamText(streamText);
        allLines.push(...lines);
      } catch (err) {
        console.warn('Error extracting stream in PDF:', err);
      }
    }
  }

  // If stream extraction produced very few lines, also attempt searching uncompressed literal strings
  if (allLines.length < 5) {
    let fullPdfStr = '';
    for (let i = 0; i < bytes.length; i++) {
      fullPdfStr += String.fromCharCode(bytes[i]);
    }
    const fallbackLines = extractLinesFromStreamText(fullPdfStr);
    if (fallbackLines.length > allLines.length) {
      return fallbackLines.join('\n');
    }
  }

  return allLines.join('\n');
}
