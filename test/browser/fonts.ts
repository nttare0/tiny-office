/**
 * The type each language's words are measured in by the measuring tests (label-widths, metrics): IBM Plex, the site's
 * own (src/styles/fonts.css, public/fonts/; Paul, 2026-10-11: "Use IBM Plex to measure. We use Plex everywhere!"). English
 * and every language in the Latin or Cyrillic script are measured in the slot's own font, whose stack begins with IBM
 * Plex Sans; Arabic, Hebrew and Yiddish, and Hindi in Plex Sans Arabic, Plex Sans Hebrew and Plex Sans Devanagari, which the site serves behind their
 * unicode-range. The scripts Plex is not shipped for are measured in the Noto of the script, as Android and ChromeOS
 * draw them and as the box has them (fonts-noto-core, fonts-noto-cjk, fonts-noto-extra), so a width is a width and never
 * a run of fallback boxes, nor whatever the box's fontconfig reaches for first (FreeSans for Bengali, WenQuanYi for
 * Korean). Urdu in Nastaliq, as iOS draws it.
 *
 * Importing this loads the stylesheet and waits for every Plex face (`plex`), so a test measures in Plex and never in
 * the fallback the page shows while a face is on its way (font-display: swap).
 */
import '../../src/styles.css';
import { languageName } from '../../src/kit/core/i18n.ts';

/** The family a CSS font asks for first ("600 13.6px 'IBM Plex Sans', system-ui" → IBM Plex Sans). */
export const firstFamily = (font: string): string =>
  font
    .replace(/^.*?\d[\d.]*px(?:\s*\/\s*[^\s,]+)?\s+/, '')
    .split(',')[0]
    .trim()
    .replace(/["']/g, '');

/** A frame, for a wait that asks again: no timer. */
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * The faces a font draws `sample` in, loaded. A load asked of a set the stylesheet's faces have not joined yet finds
 * none and resolves at once, and the words would be measured in the fallback (it did, under load: "Эффекты" at 88px in
 * place of Plex's 82): so the stylesheet's faces are waited for first, and a family of ours that loads no face fails,
 * naming it.
 */
export async function loadFont(font: string, sample: string): Promise<void> {
  const family = firstFamily(font);
  const ours = (f: FontFace) => f.family.replace(/["']/g, '') === family;
  for (let i = 0; family.startsWith('IBM Plex') && ![...document.fonts].some(ours); i++) {
    if (i > 600) throw new Error(`the stylesheet's ${family} faces never joined the document's fonts`);
    await frame();
  }
  const faces = await document.fonts.load(font, sample);
  if (family.startsWith('IBM Plex') && !faces.length) throw new Error(`no face of ${family} loaded for "${font}" and "${sample}"`);
}

/** Every IBM Plex face the stylesheet declares, loaded (and the Cyrillic the Latin faces carry, which Russian and Ukrainian are measured in). */
export const plex: Promise<unknown> = Promise.all(
  [
    "400 16px 'IBM Plex Sans'",
    "italic 400 16px 'IBM Plex Sans'",
    "600 16px 'IBM Plex Sans'",
    "italic 600 16px 'IBM Plex Sans'",
    "400 16px 'IBM Plex Serif'",
    "italic 400 16px 'IBM Plex Serif'",
    "600 16px 'IBM Plex Serif'",
    "italic 600 16px 'IBM Plex Serif'",
    "400 16px 'IBM Plex Mono'",
    "600 16px 'IBM Plex Mono'",
  ]
    .map((font) => loadFont(font, 'Aa Жж'))
    .concat(
      ['400', '600'].flatMap((w) => [loadFont(`${w} 16px 'IBM Plex Sans Arabic'`, 'ع'), loadFont(`${w} 16px 'IBM Plex Sans Hebrew'`, 'א'), loadFont(`${w} 16px 'IBM Plex Sans Devanagari'`, 'क')]),
    ),
).then(() => document.fonts.ready);
await plex;

/** The family of each script that is not Latin or Cyrillic. */
export const FAMILY: Record<string, string> = {
  ja: 'Noto Sans CJK JP',
  'zh-hans': 'Noto Sans CJK SC',
  'zh-hant': 'Noto Sans CJK TC',
  ko: 'Noto Sans CJK KR',
  ar: 'IBM Plex Sans Arabic',
  he: 'IBM Plex Sans Hebrew',
  yi: 'IBM Plex Sans Hebrew',
  ur: 'Noto Nastaliq Urdu',
  hi: 'IBM Plex Sans Devanagari',
  bn: 'Noto Sans Bengali',
};

/** A CSS font (a computed `font`, or "600 14px system-ui, …") with the language's family put first. */
export const fontIn = (lang: string, font: string): string => {
  const family = FAMILY[lang] ?? FAMILY[lang.split('-')[0]];
  return !family ? font : font.replace(/(\d[\d.]*px(?:\s*\/\s*[^\s,]+)?\s+)/, `$1'${family}', `);
};

/** Whether the box has a family: words in it measure otherwise than in the monospace it would fall back to. */
export function installed(family: string, sample: string): boolean {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = '16px monospace';
  const fallback = ctx.measureText(sample).width;
  ctx.font = `16px '${family}', monospace`;
  return ctx.measureText(sample).width !== fallback;
}

/** Every family the measuring tests use, with words to try it on (a language's name in itself, in its script). */
export const FAMILIES: [string, string][] = Object.entries(FAMILY).map(([lang, family]): [string, string] => [family, languageName(lang)]);
