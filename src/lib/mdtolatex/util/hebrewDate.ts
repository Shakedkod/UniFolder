/**
 * Hebrew calendar conversion and gematria numerals.
 *
 * This replaces the Python `pyluach` + `hebrew_numbers` dependencies with a
 * self-contained implementation, so the package stays dependency-light and runs
 * unchanged in the browser, in Next.js and inside Obsidian.
 *
 * Month numbers follow the same biblical numbering `pyluach` uses: 1 = Nisan,
 * 7 = Tishrei, 12/13 = Adar (Adar I / Adar II in a leap year).
 */

const HEBREW_EPOCH_OFFSET = 1373428;

const GREGORIAN_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const HEBREW_MONTH_NAMES = [
  'ניסן',
  'אייר',
  'סיוון',
  'תמוז',
  'אב',
  'אלול',
  'תשרי',
  'חשוון',
  'כסלו',
  'טבת',
  'שבט',
  'אדר',
  'אדר ב',
];

/** Gregorian month names in Hebrew, for the civil part of a Hebrew date line. */
export const GREGORIAN_MONTH_NAMES_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export interface HebrewDate {
  year: number;
  /** 1 = Nisan … 7 = Tishrei … 12/13 = Adar. */
  month: number;
  day: number;
}

function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Days from the (proleptic) Gregorian epoch: 1 January 1 CE is day 1. */
export function absoluteFromGregorian(year: number, month: number, day: number): number {
  let total = day;
  for (let index = 0; index < month - 1; index += 1) {
    total += GREGORIAN_MONTH_DAYS[index];
    if (index === 1 && isGregorianLeapYear(year)) total += 1;
  }
  const priorYears = year - 1;
  return (
    total +
    365 * priorYears +
    Math.floor(priorYears / 4) -
    Math.floor(priorYears / 100) +
    Math.floor(priorYears / 400)
  );
}

export function isHebrewLeapYear(year: number): boolean {
  return ((year * 7 + 1) % 19) < 7;
}

function lastMonthOfHebrewYear(year: number): number {
  return isHebrewLeapYear(year) ? 13 : 12;
}

/** Days elapsed from the Hebrew epoch to Tishrei 1 of `year`, before postponement. */
function hebrewElapsedDays(year: number): number {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  let day = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  if (((3 * (day + 1)) % 7) < 3) day += 1;
  return day;
}

/** The `lo ADU rosh` style postponement of Rosh Hashanah, in days. */
function newYearDelay(year: number): number {
  const previous = hebrewElapsedDays(year - 1);
  const current = hebrewElapsedDays(year);
  const next = hebrewElapsedDays(year + 1);
  if (next - current === 356) return 2;
  if (current - previous === 382) return 1;
  return 0;
}

function calendarElapsedDays(year: number): number {
  return hebrewElapsedDays(year) + newYearDelay(year);
}

function daysInHebrewYear(year: number): number {
  return calendarElapsedDays(year + 1) - calendarElapsedDays(year);
}

function hasLongCheshvan(year: number): boolean {
  return daysInHebrewYear(year) % 10 === 5;
}

function hasShortKislev(year: number): boolean {
  return daysInHebrewYear(year) % 10 === 3;
}

export function lastDayOfHebrewMonth(month: number, year: number): number {
  if (
    month === 2 ||
    month === 4 ||
    month === 6 ||
    month === 10 ||
    month === 13 ||
    (month === 12 && !isHebrewLeapYear(year)) ||
    (month === 8 && !hasLongCheshvan(year)) ||
    (month === 9 && hasShortKislev(year))
  ) {
    return 29;
  }
  return 30;
}

export function absoluteFromHebrew({ year, month, day }: HebrewDate): number {
  let total = day + calendarElapsedDays(year) - HEBREW_EPOCH_OFFSET;

  if (month < 7) {
    // Nisan..Elul come after Tishrei within the same Hebrew year.
    for (let m = 7; m <= lastMonthOfHebrewYear(year); m += 1) {
      total += lastDayOfHebrewMonth(m, year);
    }
    for (let m = 1; m < month; m += 1) total += lastDayOfHebrewMonth(m, year);
  } else {
    for (let m = 7; m < month; m += 1) total += lastDayOfHebrewMonth(m, year);
  }

  return total;
}

/** Converts a JS `Date` (local time) to its Hebrew calendar date. */
export function hebrewFromDate(date: Date): HebrewDate {
  const absolute = absoluteFromGregorian(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );

  let year = Math.floor((absolute + HEBREW_EPOCH_OFFSET) / 366);
  while (absoluteFromHebrew({ year: year + 1, month: 7, day: 1 }) <= absolute) year += 1;

  let month = absolute < absoluteFromHebrew({ year, month: 1, day: 1 }) ? 7 : 1;
  while (
    absolute >
    absoluteFromHebrew({ year, month, day: lastDayOfHebrewMonth(month, year) })
  ) {
    month += 1;
  }

  const day = absolute - absoluteFromHebrew({ year, month, day: 1 }) + 1;
  return { year, month, day };
}

/** The Hebrew name of a Hebrew month, distinguishing Adar I/II in leap years. */
export function hebrewMonthName({ year, month }: HebrewDate): string {
  if (month === 12 && isHebrewLeapYear(year)) return 'אדר א';
  return HEBREW_MONTH_NAMES[month - 1] ?? '';
}

const GEMATRIA_UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const GEMATRIA_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const GEMATRIA_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/**
 * Renders a number as Hebrew numerals, with the customary gershayim and the
 * ט"ו / ט"ז substitutions that avoid spelling divine names.
 */
export function intToGematria(value: number, gershayim = true): string {
  if (value <= 0) return String(value);

  let remaining = value;
  let letters = '';

  while (remaining >= 400) {
    letters += 'ת';
    remaining -= 400;
  }
  if (remaining >= 100) {
    letters += GEMATRIA_HUNDREDS[Math.floor(remaining / 100)];
    remaining %= 100;
  }
  if (remaining === 15 || remaining === 16) {
    letters += remaining === 15 ? 'טו' : 'טז';
    remaining = 0;
  } else {
    letters += GEMATRIA_TENS[Math.floor(remaining / 10)];
    remaining %= 10;
    letters += GEMATRIA_UNITS[remaining];
  }

  if (!gershayim) return letters;
  if (letters.length === 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/** e.g. `ג׳ בתשרי ה׳תשפ״ו` — the traditional spelled-out Hebrew date. */
export function traditionalHebrewDate(date: Date): string {
  const hebrew = hebrewFromDate(date);
  const day = intToGematria(hebrew.day);
  const month = hebrewMonthName(hebrew);
  const year = intToGematria(hebrew.year - 5000);
  return `${day} ב${month} ה׳${year}`;
}

/** e.g. `ספטמבר 18, 2026` — the civil date written in Hebrew. */
export function civilHebrewDate(date: Date): string {
  return `${GREGORIAN_MONTH_NAMES_HE[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** e.g. `September 18, 2026` — matches the Python `%B %d, %Y` output. */
export function englishDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  return `${EN_MONTHS[date.getMonth()]} ${day}, ${date.getFullYear()}`;
}
