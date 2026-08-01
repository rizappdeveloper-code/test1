export const INDIA_TIMEZONE = 'Asia/Kolkata';

export interface WallClockComponents {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Converts live device time (new Date()) or Date object to Indian Standard Time (IST, UTC+5:30) wall-clock ISO string.
 * e.g. If device local time in Kuwait is 15:30 (12:30 UTC), IST is 18:00 (12:30 UTC + 5:30).
 * Returns: "2026-07-31T18:00:00.000"
 */
export function getISTNowISOString(date: Date | string | number = new Date()): string {
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'number') {
    d = new Date(date);
  } else {
    const str = String(date).trim();
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(str)) {
      return str.replace(' ', 'T');
    }
    d = new Date(str);
    if (isNaN(d.getTime())) d = new Date();
  }

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
  let hr = p.hour;
  if (hr === '24') hr = '00';
  return `${p.year}-${p.month}-${p.day}T${hr}:${p.minute}:${p.second}.${ms}+05:30`;
}

export function getISTISOString(date: Date | string | number = new Date()): string {
  return getISTNowISOString(date);
}

/**
 * Safely parses any timestamp string, Date, or number into Epoch milliseconds.
 * Handles ISO strings with or without timezone offsets seamlessly.
 */
export function parseTimestampToMs(timestamp?: string | Date | number | null): number {
  if (!timestamp) return 0;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'number') return timestamp;
  const str = String(timestamp).trim();
  if (!str) return 0;

  // If ISO string without timezone offset (e.g. 2026-08-01T12:00:00.000), append +05:30 (IST)
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    const formattedStr = str.replace(' ', 'T');
    const parsed = new Date(formattedStr + '+05:30').getTime();
    if (!isNaN(parsed)) return parsed;
  }

  const standard = new Date(str).getTime();
  return isNaN(standard) ? 0 : standard;
}

/**
 * Extracts wall-clock date and time components (year, month, day, hours, minutes, seconds)
 * directly from string timestamps without timezone shifting so manually entered times (e.g. 03:00 PM) remain unchanged.
 * For live Date objects, converts to Asia/Kolkata wall-clock time.
 */
export function getWallClockComponents(timestamp?: string | Date | number | null): WallClockComponents | null {
  if (!timestamp) return null;

  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: INDIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(timestamp);

    const p: { [key: string]: string } = {};
    parts.forEach(({ type, value }) => {
      p[type] = value;
    });

    const hr = p.hour === '24' ? 0 : parseInt(p.hour, 10);
    return {
      year: parseInt(p.year, 10),
      month: parseInt(p.month, 10),
      day: parseInt(p.day, 10),
      hours: hr,
      minutes: parseInt(p.minute, 10),
      seconds: parseInt(p.second, 10),
    };
  }

  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return getWallClockComponents(d);
  }

  const str = String(timestamp).trim();
  if (!str) return null;

  // Match ISO / datetime strings like '2026-07-31T15:30:00', '2026-07-31 15:30:00', etc.
  // Extract numbers directly so manually entered timestamps remain exact without offset conversion.
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
      hours: isoMatch[4] !== undefined ? parseInt(isoMatch[4], 10) : 0,
      minutes: isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : 0,
      seconds: isoMatch[6] !== undefined ? parseInt(isoMatch[6], 10) : 0,
    };
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return getWallClockComponents(d);
  }

  return null;
}

/**
 * Returns today's date in IST as 'YYYY-MM-DD'
 */
export function getTodayISTDateString(): string {
  const comp = getWallClockComponents(new Date());
  if (!comp) return '';
  const y = String(comp.year).padStart(4, '0');
  const m = String(comp.month).padStart(2, '0');
  const d = String(comp.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns current month in IST as 'YYYY-MM'
 */
export function getCurrentISTMonthString(): string {
  const dateStr = getTodayISTDateString();
  return dateStr.substring(0, 7);
}

/**
 * Converts any timestamp / Date to formatted 12-hour time string (e.g. '03:30 PM' or '03:30:15 PM').
 * Preserves exact entered wall-clock hours for manually created logs.
 */
export function formatISTTime(
  timestamp?: string | Date | number | null,
  includeSeconds = false
): string {
  const comp = getWallClockComponents(timestamp);
  if (!comp) return '--:--';

  let h = comp.hours;
  const m = String(comp.minutes).padStart(2, '0');
  const s = String(comp.seconds).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const hStr = String(h).padStart(2, '0');

  if (includeSeconds) {
    return `${hStr}:${m}:${s} ${ampm}`;
  }
  return `${hStr}:${m} ${ampm}`;
}

/**
 * Converts any timestamp / Date to formatted 24-hr time string (e.g. '15:30')
 */
export function formatISTTime24(
  timestamp?: string | Date | number | null
): string {
  const comp = getWallClockComponents(timestamp);
  if (!comp) return '--:--';

  const h = String(comp.hours).padStart(2, '0');
  const m = String(comp.minutes).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Converts any timestamp / Date to Date string 'YYYY-MM-DD'
 */
export function formatISTDate(timestamp?: string | Date | number | null): string {
  const comp = getWallClockComponents(timestamp);
  if (!comp) return '';

  const y = String(comp.year).padStart(4, '0');
  const m = String(comp.month).padStart(2, '0');
  const d = String(comp.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts any timestamp / Date to formatted Date string for display (e.g. '31/07/2026')
 */
export function formatISTDateDisplay(timestamp?: string | Date | number | null): string {
  const comp = getWallClockComponents(timestamp);
  if (!comp) return '';

  const d = String(comp.day).padStart(2, '0');
  const m = String(comp.month).padStart(2, '0');
  const y = String(comp.year).padStart(4, '0');
  return `${d}/${m}/${y}`;
}

/**
 * Converts any timestamp / Date to readable Date & Time string (e.g. '31/07/2026, 03:30:15 PM')
 */
export function formatISTDateTime(timestamp?: string | Date | number | null): string {
  const comp = getWallClockComponents(timestamp);
  if (!comp) return '';

  const dateStr = formatISTDateDisplay(timestamp);
  const timeStr = formatISTTime(timestamp, true);
  return `${dateStr}, ${timeStr}`;
}

/**
 * For a date string 'YYYY-MM-DD', returns query boundary range
 */
export function getISTDateRangeISO(dateStr: string): { startISO: string; endISO: string } {
  if (!dateStr) {
    const today = getTodayISTDateString();
    return getISTDateRangeISO(today);
  }
  return {
    startISO: `${dateStr}T00:00:00`,
    endISO: `${dateStr}T23:59:59.999`,
  };
}

/**
 * For a month string 'YYYY-MM', returns query boundary range
 */
export function getISTMonthRangeISO(monthStr: string): { startISO: string; endISO: string } {
  if (!monthStr) {
    const currentMonth = getCurrentISTMonthString();
    return getISTMonthRangeISO(monthStr);
  }
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  return {
    startISO: `${monthStr}-01T00:00:00`,
    endISO: `${monthStr}-${lastDayStr}T23:59:59.999`,
  };
}
