import { expect, test } from 'vitest';
import * as passwords from '../src/kit/share/passwords.ts';
import { generatePassword } from '../src/kit/share/passwords.ts';

/** The characters many passwords are drawn from: the alphabet, as the passwords show it. */
const drawn = new Set(Array.from({ length: 400 }, () => generatePassword().replace(/-/g, '')).join(''));

test('a generated password is four groups of five from the alphabet, and never the same twice', () => {
  const p = generatePassword();
  expect(p).toMatch(/^[^-]{5}-[^-]{5}-[^-]{5}-[^-]{5}$/);
  expect([...drawn].join('')).not.toMatch(/[lIoO01]/);
  const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
  expect(seen.size).toBe(50);
  expect(generatePassword(2, 8)).toMatch(/^[^-]{8}-[^-]{8}$/);
});

test('a generated password holds at least 100 bits: twenty characters from 56 (each of them comes up over many draws), about 116', () => {
  expect(drawn.size).toBe(56);
  expect(generatePassword().replace(/-/g, '').length * Math.log2(drawn.size)).toBeGreaterThan(100);
});

test('the app makes every password (Paul, 2026-10-11), so the module makes them and nothing else: no strength estimate', () => {
  expect(Object.keys(passwords).sort()).toEqual(['generatePassword']);
});
