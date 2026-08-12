export const TIMEZONE_OPTIONS = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires) - ART (UTC-3)' },
  { value: 'America/Argentina/Cordoba', label: 'Argentina (Córdoba) - ART (UTC-3)' },
  { value: 'America/New_York', label: 'US East (New York) - EST/EDT' },
  { value: 'America/Chicago', label: 'US Central (Chicago) - CST/CDT' },
  { value: 'America/Denver', label: 'US Mountain (Denver) - MST/MDT' },
  { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles) - PST/PDT' },
  { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo) - BRT (UTC-3)' },
  { value: 'America/Santiago', label: 'Chile (Santiago) - CLT/CLST' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá) - COT (UTC-5)' },
  { value: 'America/Mexico_City', label: 'Mexico (Mexico City) - CST' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'Europe/London', label: 'United Kingdom (London) - GMT/BST' },
  { value: 'Europe/Madrid', label: 'Spain (Madrid) - CET/CEST' },
  { value: 'Europe/Paris', label: 'France (Paris) - CET/CEST' },
  { value: 'Europe/Berlin', label: 'Germany (Berlin) - CET/CEST' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo) - JST (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'China (Shanghai) - CST (UTC+8)' },
  { value: 'Asia/Dubai', label: 'UAE (Dubai) - GST (UTC+4)' },
  { value: 'Australia/Sydney', label: 'Australia (Sydney) - AEST/AEDT' },
];

/**
 * Adjusts raw date or ISO timestamp string from CSV/JSON import
 * and converts it into a YYYY-MM-DD date string reflecting the selected user timezone.
 */
export function adjustDateToTimezone(rawDateStr: string, timezone: string = 'America/Argentina/Buenos_Aires'): string {
  if (!rawDateStr) return new Date().toISOString().substring(0, 10);

  const clean = rawDateStr.trim();

  // If it's a plain calendar date YYYY-MM-DD without time or offset
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Handle format like YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) {
    return clean.replace(/\//g, '-');
  }

  try {
    // If string has space separating date and time (e.g. "2026-08-11 18:30:00")
    const isoString = clean.includes(' ') && !clean.includes('T') ? clean.replace(' ', 'T') : clean;
    const dateObj = new Date(isoString);

    if (isNaN(dateObj.getTime())) {
      const match = clean.match(/\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
      return new Date().toISOString().substring(0, 10);
    }

    // Format using Intl.DateTimeFormat in specified timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(dateObj); // Returns "YYYY-MM-DD"
  } catch (err) {
    console.warn('Error adjusting date to timezone:', err);
    const match = clean.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    return new Date().toISOString().substring(0, 10);
  }
}
