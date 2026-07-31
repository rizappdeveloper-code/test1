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
 * Extracts wall-clock date and time components (year, month, day, hours, minutes, seconds)
 * directly from any string or Date object without shifting hours for timezone offsets.
 */
export function getWallClockComponents(timestamp?: string | Date | number | null): WallClockComponents | null {
  if (!timestamp) return null;

  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) return null;
    return {
      year: timestamp.getFullYear(),
      month: timestamp.getMonth() + 1,
      day: timestamp.getDate(),
      hours: timestamp.getHours(),
      minutes: timestamp.getMinutes(),
      seconds: timestamp.getSeconds(),
    };
  }

  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hours: d.getHours(),
      minutes: d.getMinutes(),
      seconds: d.getSeconds(),
    };
  }

  const str = String(timestamp).trim();
  if (!str) return null;

  // Match ISO / datetime strings like '2026-07-31T15:30:00', '2026-07-31 15:30:00', '2026-07-31T15:30:00.000Z', etc.
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

  // Fallback to JS Date object
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hours: d.getHours(),
      minutes: d.getMinutes(),
      seconds: d.getSeconds(),
    };
  }

  return null;
}

/**
 * Returns current local date/time as a clean ISO string without offset shifting:
 * e.g. "2026-07-31T15:30:00"
 */
export function getISTISOString(date: Date | string | number = new Date()): string {
  const comp = getWallClockComponents(date);
  if (!comp) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day}T${hr}:${min}:${sec}`;
  }
  const y = String(comp.year).padStart(4, '0');
  const m = String(comp.month).padStart(2, '0');
  const day = String(comp.day).padStart(2, '0');
  const hr = String(comp.hours).padStart(2, '0');
  const min = String(comp.minutes).padStart(2, '0');
  const sec = String(comp.seconds).padStart(2, '0');
  return `${y}-${m}-${day}T${hr}:${min}:${sec}`;
}

/**
 * Returns today's date as 'YYYY-MM-DD'
 */
export function getTodayISTDateString(): string {
  return formatISTDate(new Date());
}

/**
 * Returns current month as 'YYYY-MM'
 */
export function getCurrentISTMonthString(): string {
  const dateStr = getTodayISTDateString();
  return dateStr.substring(0, 7);
}

/**
 * Converts any timestamp / Date to formatted 12-hour time string (e.g. '03:30 PM' or '03:30:15 PM')
 * Preserves exact entered wall-clock hours without shifting for timezone offsets.
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
    return getISTMonthRangeISO(currentMonth);
  }
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  return {
    startISO: `${monthStr}-01T00:00:00`,
    endISO: `${monthStr}-${lastDayStr}T23:59:59.999`,
  };
}
