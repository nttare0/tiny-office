/**
 * A pseudo-language made from en.ftl, for testing a translation before one exists: every letter accented and
 * every word a third longer (as German and French run), each plural given the forms the language has. en-xa
 * runs left to right; ar-xb, with Arabic's six plural forms, right to left. Not shipped: tests register it, as a
 * Fluent file (pseudoFtl). (No node imports here: the browser tests use it too.)
 */
import { message } from '../scripts/ftl.ts';

type Strings = Record<string, string>;

const FROM = 'abcdeghiklnorstuyzABCDEGHIKLNORSTUYZ';
const TO = 'àƀçđéĝĥîķļñöŕšţûýžÀƁÇĐÉĜĤÎĶĻÑÖŔŠŢÛÝŽ';
// Each word accented and a third longer, as a longer language's words are (a padded string's tail would be one
// unbreakable word no language writes).
const accent = (s: string) => s.replace(/[\p{L}\p{N}'’-]+/gu, (w) => [...w].map((c) => (FROM.includes(c) ? TO[FROM.indexOf(c)] : c)).join('') + 'ʰ'.repeat(Math.ceil(w.length / 3)));

/** One string: its words accented and lengthened, outside its placeholders. */
export function pseudoString(code: string, s: string): string {
  const cats: string[] = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  const order = ['zero', 'one', 'two', 'few', 'many', 'other'].filter((c) => cats.includes(c));
  return s
    .split(/(\{[^}]*\})/)
    .map((part) => {
      const m = /^\{(\w+)\|([^}]*)\}$/.exec(part);
      if (m) {
        const [one, other] = [m[2].split('|')[0], m[2].split('|').at(-1)!];
        const picked = order.map((c) => accent(c === 'one' ? one : other));
        return `{${m[1]}|${picked.join('|')}}`;
      }
      return part.startsWith('{') ? part : accent(part);
    })
    .join('');
}

/** Every message, flat (scripts/ftl.ts), id → its pseudo-words. */
export const pseudo = (code: string, en: Strings): Strings => Object.fromEntries(Object.entries(en).map(([k, v]) => [k, pseudoString(code, v)]));
/** Messages given as id → flat words (scripts/ftl.ts), written as a Fluent file: a pseudo-language, a test's dictionary. */
export const ftlOf = (messages: Strings, code: string): string =>
  Object.entries(messages)
    .map(([id, flat]) => message(id, flat, code))
    .join('\n') + '\n';
/** The pseudo-language as a Fluent file, to register. */
export const pseudoFtl = (code: string, en: Strings): string => ftlOf(pseudo(code, en), code);
