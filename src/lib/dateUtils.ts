export const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Parses any timestamp input (ISO string, UTC string, naive string, Date, number)
 * into a valid JavaScript Date object representing the exact point in time.
 * If the input is a naive string without timezone offset (e.g. '2026-07-31T17:55:00' or '2026-07-31 17:55:00'),
 * it is treated as Indian Standard Time (IST, +05:30).
 */
export function parseAnyTimestampToDate(timestamp?: string | Date | number | null): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? null : timestamp;
  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }

  let str = String(timestamp).trim();
  if (!str) return null;

  // Replace space between date and time with 'T' if format is 'YYYY-MM-DD HH:mm:ss'
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T');
  }

  // If string has no timezone offset (no 'Z', '+', or '-' in time portion),
  // append '+05:30' so JavaScript parses it as IST rather than local browser time (e.g. Kuwait).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
    str += '+05:30';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns current date/time as an IST ISO string with explicit +05:30 offset.
 * e.g. "2026-07-31T17:55:00.000+05:30"
 */
export function getISTISOString(date: Date | string | number = new Date()): string {
  const d = parseAnyTimestampToDate(date) || new Date();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const p: { [key: string]: string } = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });

  const ms = String(d.getMilliseconds()).padStart(3, '0');
  const hr = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hr}:${p.minute}:${p.second}.${ms}+05:30`;
}

/**
 * Returns today's date in IST as 'YYYY-MM-DD'
 */
export function getTodayISTDateString(): string {
  return formatISTDate(new Date());
}

/**
 * Returns current month in IST as 'YYYY-MM'
 */
export function getCurrentISTMonthString(): string {
  const dateStr = getTodayISTDateString();
  return dateStr.substring(0, 7);
}

/**
 * Converts any timestamp / Date to formatted IST time string (e.g. '05:55 PM' or '05:55:15 PM')
 */
export function formatISTTime(
  timestamp?: string | Date | number | null,
  includeSeconds = false
): string {
  const d = parseAnyTimestampToDate(timestamp);
  if (!d) return '--:--';

  return d.toLocaleTimeString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  });
}

/**
 * Converts any timestamp / Date to formatted IST 24-hr time string (e.g. '17:55')
 */
export function formatISTTime24(
  timestamp?: string | Date | number | null
): string {
  const d = parseAnyTimestampToDate(timestamp);
  if (!d) return '--:--';

  return d.toLocaleTimeString('en-GB', {
    timeZone: INDIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Converts any timestamp / Date to IST Date string 'YYYY-MM-DD'
 */
export function formatISTDate(timestamp?: string | Date | number | null): string {
  const d = parseAnyTimestampToDate(timestamp);
  if (!d) return '';

  return d.toLocaleDateString('en-CA', { timeZone: INDIA_TIMEZONE });
}

/**
 * Converts any timestamp / Date to formatted IST Date string for display (e.g. '31/07/2026')
 */
export function formatISTDateDisplay(timestamp?: string | Date | number | null): string {
  const d = parseAnyTimestampToDate(timestamp);
  if (!d) return '';

  return d.toLocaleDateString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Converts any timestamp / Date to readable IST Date & Time string (e.g. '31/07/2026, 05:55:15 PM IST')
 */
export function formatISTDateTime(timestamp?: string | Date | number | null): string {
  const d = parseAnyTimestampToDate(timestamp);
  if (!d) return '';

  return (
    d.toLocaleString('en-IN', {
      timeZone: INDIA_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

/**
 * For an IST date string 'YYYY-MM-DD', returns the ISO query boundary range
 */
export function getISTDateRangeISO(dateStr: string): { startISO: string; endISO: string } {
  if (!dateStr || !dateStr.includes('-')) {
    const today = getTodayISTDateString();
    return getISTDateRangeISO(today);
  }
  const [year, month, day] = dateStr.split('-').map(Number);

  // IST midnight in UTC is previous day 18:30:00 UTC
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;

  return {
    startISO: new Date(startUtcMs).toISOString(),
    endISO: new Date(endUtcMs).toISOString(),
  };
}

/**
 * For an IST month string 'YYYY-MM', returns the ISO query boundary range
 */
export function getISTMonthRangeISO(monthStr: string): { startISO: string; endISO: string } {
  if (!monthStr || !monthStr.includes('-')) {
    const currentMonth = getCurrentISTMonthString();
    return getISTMonthRangeISO(currentMonth);
  }
  const [year, month] = monthStr.split('-').map(Number);

  const startUtcMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000;
  const lastDay = new Date(year, month, 0).getDate();
  const endUtcMs = Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000;

  return {
    startISO: new Date(startUtcMs).toISOString(),
    endISO: new Date(endUtcMs).toISOString(),
  };
}
