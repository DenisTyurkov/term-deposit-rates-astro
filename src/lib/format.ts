/**
 * Formatting helpers — ports of the Rails view helpers used in the templates:
 * number_to_percentage, number_with_delimiter, and the strftime date formats.
 *
 * Dates are formatted in NZ time (Pacific/Auckland) to match the live site.
 */

const TZ = "Pacific/Auckland";

/** number_to_percentage(x, precision: 2) → "3.85%" */
export function pct(x: number): string {
  return `${x.toFixed(2)}%`;
}

/** number_with_delimiter(n) → "1,000" (thousands separators) */
export function delimited(n: number): string {
  return n.toLocaleString("en-US");
}

interface DateParts {
  year: string;
  month: string; // long, e.g. "June"
  shortMonth: string; // "Jun"
  day: string; // 2-digit, "13"
  hour: string; // 2-digit 12h, "12"
  minute: string; // 2-digit
  dayPeriod: string; // "AM"/"PM"
}

function getParts(iso: string): DateParts {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  const shortMonth = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" }).format(d);
  return {
    year: map.year,
    month: map.month,
    shortMonth,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    dayPeriod: map.dayPeriod,
  };
}

/** strftime "%b %y" → "Jun 26" */
export function monthYearShort(iso: string): string {
  const p = getParts(iso);
  return `${p.shortMonth} ${p.year.slice(2)}`;
}

/** strftime "%B %d, %Y at %I:%M %p" → "June 13, 2026 at 12:38 PM" */
export function longDateTime(iso: string): string {
  const p = getParts(iso);
  return `${p.month} ${p.day}, ${p.year} at ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** strftime "%d %b %Y, %I:%M %p" → "13 Jun 2026, 12:38 PM" */
export function dayMonthYearTime(iso: string): string {
  const p = getParts(iso);
  return `${p.day} ${p.shortMonth} ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** strftime "%B %Y" → "June 2026" */
export function monthYear(iso: string): string {
  const p = getParts(iso);
  return `${p.month} ${p.year}`;
}

/** strftime "%d %B %Y" → "13 June 2026" */
export function dayMonthYear(iso: string): string {
  const p = getParts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

/** ISO date (YYYY-MM-DD) in NZ time, for sitemap lastmod etc. */
export function isoDate(iso: string): string {
  const p = getParts(iso);
  const months: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
  };
  return `${p.year}-${months[p.month]}-${p.day}`;
}
