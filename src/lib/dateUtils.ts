export const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's date in IST as 'YYYY-MM-DD'
 */
export function getTodayISTDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: INDIA_TIMEZONE });
}

/**
 * Returns current month in IST as 'YYYY-MM'
 */
export function getCurrentISTMonthString(): string {
  const dateStr = getTodayISTDateString();
  return dateStr.substring(0, 7);
}

/**
 * Converts any timestamp / Date to formatted IST time string (e.g. '09:30 AM' or '09:30:15 AM')
 */
export function formatISTTime(
  timestamp?: string | Date | number | null,
  includeSeconds = false
): string {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '--:--';

  return d.toLocaleTimeString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  });
}

/**
 * Converts any timestamp / Date to formatted IST 24-hr time string (e.g. '09:30')
 */
export function formatISTTime24(
  timestamp?: string | Date | number | null
): string {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '--:--';

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
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-CA', { timeZone: INDIA_TIMEZONE });
}

/**
 * Converts any timestamp / Date to formatted IST Date string for display (e.g. '31/07/2026')
 */
export function formatISTDateDisplay(timestamp?: string | Date | number | null): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Converts any timestamp / Date to readable IST Date & Time string (e.g. '31/07/2026, 09:30 AM IST')
 */
export function formatISTDateTime(timestamp?: string | Date | number | null): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';

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
 * For an IST date string 'YYYY-MM-DD', returns the UTC ISO range start and end
 */
export function getISTDateRangeISO(dateStr: string): { startISO: string; endISO: string } {
  if (!dateStr || !dateStr.includes('-')) {
    const today = getTodayISTDateString();
    return getISTDateRangeISO(today);
  }
  const [year, month, day] = dateStr.split('-').map(Number);

  // IST midnight = UTC previous day 18:30:00
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;

  return {
    startISO: new Date(startUtcMs).toISOString(),
    endISO: new Date(endUtcMs).toISOString(),
  };
}

/**
 * For an IST month string 'YYYY-MM', returns the UTC ISO range start and end
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
