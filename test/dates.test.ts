// A date in a language Intl lacks says its month and weekday in that language (Paul, 2026-10-15: "Why aren't we
// translating month names?"): Kreyòl and Yiddish from kit/core/dates.ts's names, laid out day, month, year; every other
// language is Intl's own.
import { test, expect } from 'vitest';
import { dateString, dateWords, NAMES } from '../src/kit/core/dates.ts';

const d = Date.UTC(2026, 0, 5); // a Monday
const utc = { timeZone: 'UTC' } as const;

test('Kreyòl: the month and the weekday in Kreyòl, the layout English’s day-month-year', () => {
  expect(dateString(d, { ...utc, day: 'numeric', month: 'long', year: 'numeric' }, 'ht')).toBe('5 janvye 2026');
  expect(dateString(d, { ...utc, weekday: 'long', day: 'numeric', month: 'long' }, 'ht')).toBe('lendi 5 janvye');
  expect(dateString(d, { ...utc, month: 'short', day: 'numeric' }, 'ht')).toBe('5 jan');
  expect(dateWords({ ...utc, weekday: 'narrow' }, 'ht').format(d)).toBe('l');
  expect(dateWords({ ...utc, weekday: 'short' }, 'ht').format(d)).toBe('len');
  expect(dateWords({ ...utc, month: 'long', year: 'numeric' }, 'ht').format(d)).toBe('janvye 2026');
  // A numeric month is left numeric.
  expect(dateString(d, { ...utc, day: 'numeric', month: 'numeric', year: 'numeric' }, 'ht')).toBe('05/01/2026');
});

test('Yiddish: the names in the Hasidic spelling, Saturday שבת', () => {
  expect(dateString(d, { ...utc, day: 'numeric', month: 'long', year: 'numeric' }, 'yi')).toBe('5 יאנואר 2026');
  expect(dateString(Date.UTC(2026, 0, 10), { ...utc, weekday: 'long' }, 'yi')).toBe('שבת');
  expect(NAMES.yi.month).toHaveLength(12);
  expect(NAMES.ht.weekday).toHaveLength(7);
});

test('a range: each end its own names', () => {
  // Intl's range separator carries thin spaces; the words are what matter.
  expect(
    dateWords({ ...utc, month: 'short', day: 'numeric', year: 'numeric' }, 'ht')
      .formatRange(d, Date.UTC(2026, 1, 7))
      .replace(/\s+/g, ' '),
  ).toBe('5 jan – 7 fev 2026');
});

test('a language without names of its own is Intl’s', () => {
  expect(dateString(d, { ...utc, day: 'numeric', month: 'long', year: 'numeric' }, 'fr')).toBe('5 janvier 2026');
  expect(dateString(d, { ...utc, day: 'numeric', month: 'long', year: 'numeric' }, 'en')).toBe('January 5, 2026');
});
