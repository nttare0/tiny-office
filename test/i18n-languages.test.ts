// Every language's file, against en.ftl: the checks that make a translation safe to merge, and every message drawn
// in it with representative numbers. Two pseudo-languages made from en.ftl (test/pseudo.ts) stand in too, so the
// checks themselves are tested.
import { test, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t, register, setLanguage, languages, languageName, missed } from '../src/kit/core/i18n.ts';
import { checkLanguage, englishHash, gaps, languageFiles, likeness, nearest, placeholders, rehash, tokens, withForms } from '../scripts/i18n-extract.ts';
import { flatMessages, pluralCategories } from '../scripts/ftl.ts';
import { ftlOf, pseudo, pseudoFtl } from './pseudo.ts';

const root = join(import.meta.dirname, '..');
const enSource = readFileSync(join(root, 'src/i18n/en.ftl'), 'utf8');
const en = flatMessages(enSource, 'en');
const files = languageFiles(root).filter(([code]) => code !== 'en');
afterAll(() => setLanguage(null));

/** Every message drawn in the language in use: each placeable as its name, a number (a plural, or { $n }) as 0, 1, 2, 5 and 21. */
function drawAll(code: string, strings: Record<string, string>) {
  for (const [id, key] of Object.entries(en)) {
    const names = [...new Set(placeholders(key))];
    // A language may count a variable the English does not (Arabic's "of { $max } characters", Polish's bytes): its own plurals count too.
    const counted = new Set([...key.matchAll(/\{(\w+)\|/g), ...(strings[id] ?? '').matchAll(/\{(\w+)\|/g)].map((m) => m[1]).concat(names.filter((n) => n === 'n')));
    for (const n of [0, 1, 2, 5, 21]) {
      const vars = Object.fromEntries(names.map((name) => [name, counted.has(name) ? n : name]));
      let out = '';
      expect(() => (out = t(id, vars)), `${code}: ${id}`).not.toThrow();
      expect(out, `${code}: ${id}`).not.toMatch(/\{\$?\w+(\|[^}]*)?\}/);
      if (strings[id]) expect(out.length, `${code}: ${id}`).toBeGreaterThan(0);
      for (const name of names) if (!counted.has(name)) expect(out, `${code}: ${id}`).toContain(name);
    }
  }
}

test('the plural categories a language has: fr three, ja one, ar six, pl four', () => {
  expect(['en', 'fr', 'ja', 'ar', 'pl', 'de'].map((c) => pluralCategories(c).length)).toEqual([2, 3, 1, 6, 4, 2]);
  expect(pluralCategories('ru')).toEqual(['one', 'few', 'many', 'other']);
});

test('the check: missing ids fail, extra ids warn, placeables once, a variant for each plural category, no sort-me group', () => {
  const base = {
    'shell-menu': 'Menu',
    'common-share': 'Share',
    'home-n-more': '{n} more',
    'example-n-slides': '{n|one slide|# slides}',
    'x-dot': '·',
    'draw-pixel-art-n-by-n': 'Pixel art, {n} by {n}',
  };
  const good = `# same
shell-menu = Menu
common-share = Partager
home-n-more = { $n } de plus
example-n-slides = { $n ->
        [one] { $n } diapositive
        [many] { $n } de diapositives
       *[other] { $n } diapositives
    }
x-dot = ·
draw-pixel-art-n-by-n = Pixel art, { $n } sur { $n }
`;
  expect(checkLanguage('fr', base, rehash(good, base))).toEqual({ errors: [], warnings: [] });
  const bad = checkLanguage(
    'fr',
    base,
    `## New — sort me into a section

shell-menu = Menu
gone = Parti
home-n-more = { $n } de plus { $n }
example-n-slides = { $n ->
        [one] une diapositive
       *[other] des diapositives
    }
x-dot = ·
draw-pixel-art-n-by-n = Pixel art, { $n } sur { $x }
broken = { $n
`,
  );
  expect(bad.errors.join('\n')).toContain('1 missing (English would show):\n    common-share');
  expect(bad.errors.some((e) => e.startsWith('Fluent cannot read this:\n    broken'))).toBe(true);
  expect(bad.errors.some((e) => e.startsWith('{ $n } 2 times in home-n-more'))).toBe(true);
  expect(bad.errors).toContain('{ $n -> } in example-n-slides has [one], [other], where fr has [one], [many], [other]');
  expect(bad.errors.some((e) => e.startsWith('{ $n -> } in example-n-slides says the number in none of its variants'))).toBe(true);
  expect(bad.errors).toContain('{ $n } 1 times in draw-pixel-art-n-by-n: Pixel art, {n} by {n} → Pixel art, {n} sur {x}');
  expect(bad.errors).toContain('{ $x } is not in the English of draw-pixel-art-n-by-n: Pixel art, {n} by {n} → Pixel art, {n} sur {x}');
  expect(bad.errors.some((e) => e.includes('sort me'))).toBe(true);
  expect(bad.warnings.join('\n')).toContain('1 not in en.ftl (remove them):\n    gone');
  // A default other than *[other], and an id given twice.
  const twice = checkLanguage(
    'de',
    { 'example-n-slides': '{n|one slide|# slides}' },
    'example-n-slides = { $n ->\n       *[one] eine Folie\n        [other] { $n } Folien\n    }\nexample-n-slides = Folien\n',
  );
  expect(twice.errors).toEqual(expect.arrayContaining(['example-n-slides is given twice', '{ $n -> } in example-n-slides: the default is *[one], not *[other]']));
  // A message left in English fails, unless its comment says it is meant ("# same") or it has no letters of its own.
  const english = ftlOf({ ...base, 'example-n-slides': '{n|eine Folie|# Folien}' }, 'de');
  expect(checkLanguage('de', base, rehash(english, base)).errors).toEqual([
    '4 the same as the English, not decided (translate it, or give it the comment "# same" where the English is the word):\n    shell-menu\n    common-share\n    home-n-more\n    draw-pixel-art-n-by-n',
  ]);
  const decided = english.replace(/^(shell-menu|common-share|home-n-more|draw-pixel-art-n-by-n) =/gm, '# same\n$1 =');
  expect(checkLanguage('de', base, rehash(decided, base)).errors).toEqual([]);
  // A mark on a message translated since is stale; a draft the memory offered and nobody read fails.
  const stale = decided
    .replace('common-share = Share', 'common-share = Teilen')
    .replace('home-n-more = { $n } more', 'home-n-more = { $n } mehr')
    .replace('Pixel art, { $n } by { $n }', 'Pixelkunst, { $n } mal { $n }');
  expect(checkLanguage('de', base, rehash(stale, base)).errors).toEqual([
    '3 marked "# same" but translated (take the mark off):\n    common-share: Share → Teilen\n    home-n-more: {n} more → {n} mehr\n    draw-pixel-art-n-by-n: Pixel art, {n} by {n} → Pixelkunst, {n} mal {n}',
  ]);
  const draft = checkLanguage('de', { 'shell-menu': 'Menu' }, rehash('# draft from shell-menus\nshell-menu = Menü\n', { 'shell-menu': 'Menu' }));
  expect(draft.errors).toEqual(['1 "# draft from" left in (read each, make it right for its id, take the comment off):\n    shell-menu: draft from shell-menus']);
  const slides = { 'example-n-slides': '{n|one slide|# slides}' };
  expect(checkLanguage('ja', slides, rehash('example-n-slides = { $n ->\n       *[other] { $n } 枚\n    }\n', slides)).errors).toEqual([]);
  // A number's own variant beside the categories is Fluent's, and allowed.
  expect(
    checkLanguage('en', { 'example-n-slides': '{n|one slide|# slides}' }, 'example-n-slides = { $n ->\n        [0] no slides\n        [one] one slide\n       *[other] { $n } slides\n    }\n').errors,
  ).toEqual([]);
  expect(checkLanguage('pt_BR', {}, '').errors).toEqual(['"pt_BR" is not a BCP 47 tag']);
  expect(checkLanguage('pt-BR', {}, '').errors).toEqual(['"pt-BR" is not a lowercase BCP 47 tag']);
  expect(gaps(base, rehash(good, base), 'fr')).toEqual([]);
  expect(gaps(base, rehash(good.replace('common-share = Partager\n', ''), base), 'fr')).toEqual([`# en: ${englishHash('Share')}\ncommon-share = Share`]);
});

test('the translation memory: a message whose English changed by a few words under a new id is offered its old translation as a draft, marked', () => {
  // Alike by the words that carry the meaning; the little words and a placeholder's forms aside.
  expect(tokens('Copy the {n|link|# links} to {name}')).toEqual(['copy', 'n', 'name']);
  expect(tokens('Share the links')).toEqual(['share', 'link']);
  expect(likeness('Copy the link', 'Copy this link')).toBe(1);
  expect(likeness('Download everything', 'Download everything (.zip)')).toBe(0.8);
  expect(likeness('Make a short link', 'Make a short link, kept for a year')).toBe(0.75);
  expect(likeness('Add a column', 'Add a row')).toBe(0.5);
  expect(likeness('Undo', 'Redo')).toBe(0);
  expect(likeness('·', 'Share')).toBe(0);
  expect(nearest('Copy this link', ['Copy link', 'Copy the display link', 'Paste'])).toBe('Copy link');
  expect(nearest('Add a row', ['Add a column'])).toBeUndefined();
  expect(nearest('Share the link', ['Share the links', 'Share a link'])).toBe('Share the links');
  // gaps: the draft under the new id, the old id named; a message with nothing alike in English.
  const now = { 'share-copy-this-link': 'Copy this link', 'bar-undo': 'Undo' };
  const before = { 'share-copy-link': 'Copy the link', 'bar-redo': 'Redo' };
  const fr = 'share-copy-link = Copier le lien\nbar-redo = Rétablir\n';
  const h = (k: keyof typeof now) => `# en: ${englishHash(now[k])}`;
  expect(gaps(now, fr, 'fr', before)).toEqual([`${h('share-copy-this-link')}\n# draft from share-copy-link\nshare-copy-this-link = Copier le lien`, `${h('bar-undo')}\nbar-undo = Undo`]);
  // An old id whose English the memory does not know offers nothing.
  expect(gaps(now, fr, 'fr', {})).toEqual([`${h('share-copy-this-link')}\nshare-copy-this-link = Copy this link`, `${h('bar-undo')}\nbar-undo = Undo`]);
  // The draft, pasted in, is what i18n:check stops on.
  expect(checkLanguage('fr', now, `${gaps(now, fr, 'fr', before)[0]}\nbar-undo = Annuler\n`).errors.some((e) => e.includes('# draft from'))).toBe(true);
});

test('a translation whose English changed since it was translated fails, and i18n:gaps offers it again, its old English named', () => {
  const was = { 'shell-go-without': 'Go without' };
  const now = { 'shell-go-without': 'Leave without saving' };
  const fr = rehash('shell-go-without = Partir sans\n', was);
  expect(fr).toBe(`# en: ${englishHash('Go without')}\nshell-go-without = Partir sans\n`);
  expect(checkLanguage('fr', was, fr).errors).toEqual([]);
  expect(checkLanguage('fr', now, fr).errors).toEqual([
    '1 whose English has changed since they were translated (translate each again: npm run i18n:gaps -- fr):\n    shell-go-without: Leave without saving',
  ]);
  expect(gaps(now, fr, 'fr', was)).toEqual([
    `# en: ${englishHash('Leave without saving')}\n# draft from shell-go-without: its English was "Go without", now "Leave without saving"\nshell-go-without = Partir sans`,
  ]);
  expect(gaps(now, fr, 'fr', {})).toEqual([`# en: ${englishHash('Leave without saving')}\n# draft from shell-go-without: its English is now "Leave without saving"\nshell-go-without = Partir sans`]);
  // Translated again and rehashed, it passes; a message with no "# en:" at all fails.
  expect(checkLanguage('fr', now, rehash('shell-go-without = Partir sans enregistrer\n', now)).errors).toEqual([]);
  expect(checkLanguage('fr', now, 'shell-go-without = Partir sans enregistrer\n').errors[0]).toMatch(/^1 with no "# en:" line/);
});

test('en.ftl passes its own check: its plurals have English’s two categories and the number', () => {
  expect(checkLanguage('en', en, enSource).errors).toEqual([]);
});

for (const code of ['en-xa', 'ar-xb']) {
  test(`the pseudo-language ${code} passes the check and draws every message`, async () => {
    const source = rehash(pseudoFtl(code, en), en);
    expect(checkLanguage(code, en, source).errors).toEqual([]);
    register(code, source);
    expect(languages()).toContain(code);
    await setLanguage(code);
    missed.clear();
    drawAll(code, pseudo(code, en));
    expect([...missed]).toEqual([]);
    expect(t('example-n-slides', { n: 21 })).toMatch(/^21 /);
  });
}

test('in development, an id the language in use lacks is recorded, so a test can count English showing through', async () => {
  register('xx-fallback', 'shell-menu = Mmm\n');
  await setLanguage('xx-fallback');
  missed.clear();
  expect(t('shell-menu')).toBe('Mmm');
  expect(t('common-share')).toBe('Share…');
  expect([...missed]).toEqual(['common-share']);
  await setLanguage(null);
  missed.clear();
  t('common-share');
  expect(missed.size).toBe(0);
});

// Names a language file must be called by in the menu: each in itself.
const NAMES: Record<string, string> = {
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  'pt-br': 'Português (Brasil)',
  it: 'Italiano',
  nl: 'Nederlands',
  ja: '日本語',
  'zh-hans': '简体中文',
  ar: 'العربية',
  // The second nine, New York's (2026-10-11): Haitian Creole has no name in itself in Intl yet, and is given one.
  ru: 'Русский',
  uk: 'Українська',
  pl: 'Polski',
  bn: 'বাংলা',
  hi: 'हिन्दी',
  ur: 'اردو',
  ht: 'Kreyòl ayisyen',
  ko: '한국어',
  'zh-hant': '繁體中文',
  // Two more of the city's (2026-10-12), both in the Hebrew script and right to left; the menu's root collation places
  // them after Cyrillic and before Arabic, Yiddish (י) before Hebrew (ע).
  he: 'עברית',
  yi: 'ייִדיש',
};

test('each language named in itself, not in English, and the menu ordered by those names: Latin, Cyrillic, Hebrew, Arabic, Indic, Hangul, Han', () => {
  for (const [code, name] of Object.entries(NAMES)) expect(languageName(code), code).toBe(name);
  for (const code of Object.keys(NAMES)) if (!languages().includes(code)) register(code, '');
  expect(languages().filter((c) => c in NAMES || c === 'en')).toEqual('en de es fr it ht nl pl pt-br ru uk yi he ur ar hi bn ko ja zh-hans zh-hant'.split(' '));
});

test('the plural forms of the second nine and the two after: ru, uk, pl four (21 is one in ru and uk, many in pl), he three (2 is two), bn, hi, ur, ht, yi two, ko and Chinese one', async () => {
  const FILES = { 'x-n-files': '{n|one file|# files}' };
  const cases: [string, string, Record<number, string>][] = [
    ['ru', '{n|# файл|# файла|# файлов|# файла}', { 1: '1 файл', 2: '2 файла', 5: '5 файлов', 21: '21 файл' }],
    ['uk', '{n|# файл|# файли|# файлів|# файлу}', { 1: '1 файл', 2: '2 файли', 5: '5 файлів', 21: '21 файл' }],
    ['pl', '{n|# plik|# pliki|# plików|# pliku}', { 1: '1 plik', 2: '2 pliki', 5: '5 plików', 21: '21 plików' }],
    // Bengali writes its own digits; Hindi and Urdu, by default, Western ones.
    ['bn', '{n|#টি ফাইল|#টি ফাইল}', { 1: '১টি ফাইল', 2: '২টি ফাইল', 5: '৫টি ফাইল', 21: '২১টি ফাইল' }],
    ['hi', '{n|# फ़ाइल|# फ़ाइलें}', { 1: '1 फ़ाइल', 2: '2 फ़ाइलें', 5: '5 फ़ाइलें', 21: '21 फ़ाइलें' }],
    ['ur', '{n|# فائل|# فائلیں}', { 1: '1 فائل', 2: '2 فائلیں', 5: '5 فائلیں', 21: '21 فائلیں' }],
    ['ht', '{n|# fichye|# fichye yo}', { 1: '1 fichye', 2: '2 fichye yo', 5: '5 fichye yo', 21: '21 fichye yo' }],
    // Hebrew says one and two in words (קובץ אחד, שני קבצים), as its files do; Yiddish one and other.
    ['he', '{n|קובץ אחד|שני קבצים|# קבצים}', { 1: 'קובץ אחד', 2: 'שני קבצים', 5: '5 קבצים', 21: '21 קבצים' }],
    ['yi', '{n|# פייל|# פיילס}', { 1: '1 פייל', 2: '2 פיילס', 5: '5 פיילס', 21: '21 פיילס' }],
    ['ko', '{n|파일 #개}', { 1: '파일 1개', 2: '파일 2개', 5: '파일 5개', 21: '파일 21개' }],
    ['zh-hant', '{n|# 個檔案}', { 1: '1 個檔案', 2: '2 個檔案', 5: '5 個檔案', 21: '21 個檔案' }],
  ];
  for (const [code, forms, want] of cases) {
    const source = rehash(ftlOf({ 'x-n-files': forms }, code), FILES);
    expect(checkLanguage(code, FILES, source).errors, code).toEqual([]);
    register(code, source);
    await setLanguage(code);
    for (const [n, out] of Object.entries(want)) expect(t('x-n-files', { n: Number(n) }), `${code} ${n}`).toBe(out);
  }
  await setLanguage(null);
});

test('i18n:gaps writes a variant for each plural category a language has, and the English so written is still the English to the check', () => {
  const base = { 'x-n-files': '{n|one file|# files}', 'shell-menu': 'Menu' };
  expect(withForms('ru', '{n|one file|# files} left')).toBe('{n|one file|# files|# files|# files} left');
  expect(withForms('zh-hant', '{n|one file|# files}')).toBe('{n|# files}');
  const h = (k: keyof typeof base) => `# en: ${englishHash(base[k])}\n`;
  expect(gaps(base, '', 'pl')).toEqual([
    `${h('x-n-files')}x-n-files = { $n ->\n        [one] one file\n        [few] { $n } files\n        [many] { $n } files\n       *[other] { $n } files\n    }`,
    `${h('shell-menu')}shell-menu = Menu`,
  ]);
  expect(gaps(base, '', 'ko')).toEqual([`${h('x-n-files')}x-n-files = { $n ->\n       *[other] { $n } files\n    }`, `${h('shell-menu')}shell-menu = Menu`]);
  const left = { 'x-n-files': '{n|one file|# files} left', 'shell-menu': '' };
  expect(checkLanguage('pl', left, gaps(left, '', 'pl').join('\n')).errors.join('\n')).toContain('1 the same as the English');
});

for (const [code, path] of files) {
  test(`${code}.ftl: safe to merge, listed, named in itself, every message drawn`, async () => {
    const source = readFileSync(path, 'utf8');
    expect(checkLanguage(code, en, source).errors).toEqual([]);
    expect(languages()).toContain(code);
    expect(languageName(code)).not.toBe(code);
    expect(languageName(code)).not.toBe(new Intl.DisplayNames(['en'], { type: 'language' }).of(code));
    if (NAMES[code]) expect(languageName(code)).toBe(NAMES[code]);
    register(code, source);
    await setLanguage(code);
    drawAll(code, flatMessages(source, code));
  });
}
