/**
 * A date in the page's language, where the browser has the language's names and where it has not. Intl writes a date
 * in every language the kit has but two: Chromium has no Haitian Creole and no Yiddish (WebKit has Yiddish, in YIVO's
 * spelling), and in those a date came out in English (Paul, 2026-10-15: "Why aren't we translating month names?").
 * For a language Intl lacks, the date is laid out by English (day, month, year, as en-GB writes it) and its month's
 * and weekday's names are the language's own, from NAMES: Kreyòl's in the official orthography, Yiddish's in the
 * Hasidic spelling the rest of its file uses (docs/translation.md). Everything else is Intl's.
 */
import { language } from './i18n.ts';

interface Names {
  month: string[];
  monthShort: string[];
  weekday: string[];
  weekdayShort: string[];
}

/** The languages Intl may lack: their months and weekdays (Sunday first, as Intl counts them). */
export const NAMES: Record<string, Names> = {
  ht: {
    month: ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'],
    monthShort: ['jan', 'fev', 'mas', 'avr', 'me', 'jen', 'jiy', 'out', 'sep', 'okt', 'nov', 'des'],
    weekday: ['dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi', 'samdi'],
    weekdayShort: ['dim', 'len', 'mad', 'mèk', 'jed', 'van', 'sam'],
  },
  yi: {
    month: ['יאנואר', 'פעברואר', 'מערץ', 'אפריל', 'מיי', 'יוני', 'יולי', 'אויגוסט', 'סעפטעמבער', 'אקטאבער', 'נאוועמבער', 'דעצעמבער'],
    monthShort: ['יאנ', 'פעב', 'מערץ', 'אפר', 'מיי', 'יוני', 'יולי', 'אויג', 'סעפ', 'אקט', 'נאוו', 'דעצ'],
    weekday: ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שבת'],
    weekdayShort: ['זונ', 'מאנ', 'דינ', 'מיט', 'דאנ', 'פרי', 'שבת'],
  },
};

/** The layout a lacking language borrows: day, month, year, no period after the day. */
const BASE = 'en-GB';

export interface DateWords {
  format(d: Date | number): string;
  formatToParts(d: Date | number): Intl.DateTimeFormatPart[];
  formatRange(a: Date | number, b: Date | number): string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A formatter for the language, as `new Intl.DateTimeFormat(lang, opts)` is for a language without names of its own;
 * with them, Intl's English layout with the language's own names for the month and the weekday, in the length asked.
 */
export function dateWords(opts: Intl.DateTimeFormatOptions, lang: string = language()): DateWords {
  const names = NAMES[lang];
  // A language with names of its own takes them wherever it runs, so a date is spelled one way in every browser (WebKit's Yiddish is YIVO's).
  if (!names) return new Intl.DateTimeFormat(lang || undefined, opts);
  const base = new Intl.DateTimeFormat(BASE, opts);
  /** The month and the weekday of a moment, in the formatter's zone, as indexes (January 0, Sunday 0). */
  const indexes = (d: Date | number): { m: number; wd: number } => {
    const parts = new Intl.DateTimeFormat(BASE, { ...opts, month: 'numeric', weekday: 'short' }).formatToParts(new Date(d));
    const m = Number(parts.find((p) => p.type === 'month')?.value ?? 1) - 1;
    const wd = WEEKDAYS.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Sun');
    return { m, wd };
  };
  const named = (p: Intl.DateTimeFormatPart, { m, wd }: { m: number; wd: number }): Intl.DateTimeFormatPart => {
    if (p.type === 'month' && typeof opts.month === 'string' && opts.month !== 'numeric' && opts.month !== '2-digit')
      return { ...p, value: opts.month === 'long' ? names.month[m] : names.monthShort[m] };
    if (p.type === 'weekday' && wd >= 0) return { ...p, value: opts.weekday === 'long' ? names.weekday[wd] : opts.weekday === 'narrow' ? [...names.weekday[wd]][0] : names.weekdayShort[wd] };
    return p;
  };
  const partsOf = (d: Date | number): Intl.DateTimeFormatPart[] => {
    const at = indexes(d);
    return base.formatToParts(new Date(d)).map((p) => named(p, at));
  };
  return {
    formatToParts: partsOf,
    format: (d) =>
      partsOf(d)
        .map((p) => p.value)
        .join(''),
    // A range's parts say which end each belongs to; the shared ones are the start's.
    formatRange: (a, b) => {
      const [from, to] = [indexes(a), indexes(b)];
      return base
        .formatRangeToParts(new Date(a), new Date(b))
        .map((p) => named(p, p.source === 'endRange' ? to : from).value)
        .join('');
    },
  };
}

/** `toLocaleDateString(lang, opts)` with the lacking languages' names: the same words, from the same formatter. */
export const dateString = (d: Date | number, opts: Intl.DateTimeFormatOptions, lang: string = language()): string => dateWords(opts, lang).format(d);
