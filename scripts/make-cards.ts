/**
 * The share cards: public/og/<app>.png, 1200 by 630, the picture a link to an app's page ("/sheet/"), or to a
 * document of it not shared with a preview, previews with. Each is the app's icon, name and line beside the first
 * page of its first template (the first that is more than a blank one), drawn by the app's own view() and composed
 * as the Share dialog composes a document's card (src/kit/draw/card.ts, the page in the box at the right), but
 * greeked (Paul, 2026-10-11: "generic per app with gray shapes indicating the app content"): every <text> of the page
 * becomes a rounded gray bar of its measured width, every fill and stroke one of two grays (white stays paper), a
 * picture a gray box. The icon and the app's name stay in ink, so the card says what kind of document it is without
 * a word of anyone's. The build names each app's card in that app's page (vite.config.ts); the home page's card is
 * the Office mark (og.png, from scripts/icons.ts).
 *
 * Chromium draws and measures it (through Playwright, which the tests already have): the words in IBM Plex, the
 * site's own faces carried in the page (scripts/plex.ts), so nothing is fetched. The cards are kept in public/; run
 * this again when an app's name, line or first template changes.
 *
 *   npm run cards
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { apps } from '../src/kit/core/apps.ts';
import type { AppDef, Page as DocPage } from '../src/kit/core/app.ts';
import { cardSvg, RIGHT } from '../src/kit/draw/card.ts';
import { FONT, INK, MUTED, PAPER, xml } from '../src/kit/draw/draw.ts';
import { markPaths } from '../src/kit/draw/mark.ts';
import { plexFaces, shoot } from './plex.ts';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const ACCENT = '#4f46e5';
/** The two grays a greeked page is drawn in: the light one for fills and pictures, the dark one for lines and words. */
const GRAYS = { light: '#e4e4e7', dark: '#a1a1aa' } as const;

/** An icon (Lucide's node) as an inline SVG. */
const iconSvg = (node: AppDef['icon'], size: number, colour: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${node
    .map(
      ([tag, a]) =>
        `<${tag} ${Object.entries(a)
          .map(([k, v]) => `${k}="${xml(String(v))}"`)
          .join(' ')}/>`,
    )
    .join('')}</svg>`;
const markSvg = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${markPaths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;

/** The page a card shows: the first template's first page that is more than a blank one. */
export async function pageOf(def: AppDef): Promise<DocPage> {
  const all = await def.templates();
  const tpl = all.find((t) => t.doc.length > 60) ?? all[0];
  return def.view(tpl ? tpl.doc : def.blank(), { still: true })[0];
}

/** The card as a page for Chromium to draw, before it is greeked: the composed card under the words at the left. */
export async function cardHtml(def: AppDef): Promise<string> {
  const page = await pageOf(def);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${plexFaces()}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:${PAPER};font-family:${FONT};color:${INK}}
.card{position:absolute;inset:0}
.bar{position:absolute;inset:0 0 auto 0;height:12px;background:${ACCENT}}
.words{position:absolute;left:80px;top:80px;bottom:60px;width:580px;display:flex;flex-direction:column;gap:18px}
h1{margin:0;font-size:64px;line-height:1.05;letter-spacing:-0.02em}
p{margin:0;font-size:28px;line-height:1.3;color:${MUTED};display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.brand{margin-top:auto;display:flex;align-items:center;gap:14px;font-size:30px;font-weight:600}
</style></head><body><div class="card">${cardSvg(page, RIGHT)}</div><div class="bar"></div>
<div class="words">${iconSvg(def.icon, 80, ACCENT)}<h1>${xml(def.name)}</h1><p>${xml(def.blurb)}</p><div class="brand">${markSvg(44)}<span>Tiny Little Office</span></div></div>
</body></html>`;
}

/**
 * Greek the card's page in place, in the browser (run by Playwright, so it names nothing outside itself): each <text>
 * with words a rounded bar of its measured box, a third of its height off each edge, and one without words gone;
 * each picture a box; each fill and stroke one of the two grays by how light it was, white kept as paper.
 */
function greek({ light, dark, paper }: { light: string; dark: string; paper: string }) {
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('svg.card-page')!;
  const lum = (c: string): number | null => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (a === 0) return null;
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  // The colours first, while every element is the page's own.
  for (const el of root.querySelectorAll<SVGElement>('*')) {
    const cs = getComputedStyle(el);
    for (const prop of ['fill', 'stroke'] as const) {
      const v = cs[prop];
      if (!v || v === 'none') continue;
      const l = v.startsWith('url(') ? 0.6 : lum(v);
      if (l === null) continue;
      const to = l >= 0.85 ? paper : l >= 0.35 ? light : dark;
      el.setAttribute(prop, to);
      el.style.setProperty(prop, to);
    }
  }
  for (const t of [...root.querySelectorAll('text')]) {
    if (!t.textContent?.trim()) {
      t.remove();
      continue;
    }
    const b = t.getBBox();
    const h = Math.max(1, b.height * 0.6);
    const bar = document.createElementNS(NS, 'rect');
    for (const [k, v] of Object.entries({ x: b.x, y: b.y + (b.height - h) / 2, width: Math.max(h, b.width), height: h, rx: h / 2, fill: dark })) bar.setAttribute(k, String(v));
    const tf = t.getAttribute('transform');
    if (tf) bar.setAttribute('transform', tf);
    bar.setAttribute('class', 'greek');
    t.replaceWith(bar);
  }
  for (const im of [...root.querySelectorAll('image, foreignObject')]) {
    const box = document.createElementNS(NS, 'rect');
    for (const k of ['x', 'y', 'width', 'height', 'transform']) if (im.getAttribute(k)) box.setAttribute(k, im.getAttribute(k)!);
    box.setAttribute('fill', light);
    box.setAttribute('class', 'greek-picture');
    im.replaceWith(box);
  }
}

/** The cards of `defs`, greeked and drawn to `out` (nothing written when it is ''); the pages as drawn come back. */
export async function drawCards(defs: AppDef[], out: string): Promise<string[]> {
  const pages = await Promise.all(defs.map(async (def): Promise<[string, string]> => [await cardHtml(def), out ? join(out, `${def.id}.png`) : '']));
  return shoot(pages, (tab: Page) => tab.evaluate(greek, { ...GRAYS, paper: PAPER }));
}

async function main() {
  const out = join(root, 'public', 'og');
  mkdirSync(out, { recursive: true });
  // Nothing from the web: a card is drawn from the template alone.
  await drawCards(apps(), out);
  console.log(
    `cards: ${apps()
      .map((a) => `og/${a.id}.png`)
      .join(', ')}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
