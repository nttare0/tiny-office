/**
 * The profile pictures and the banner for the social networks (Paul, 2026-10-13: "make me a few nice social media
 * avatars based on the favicon for different social media services", and "a dense diagram in dark colors for the
 * background profile pic on bluesky"), drawn from the Office mark (src/kit/draw/mark.ts) through sharp, as the
 * site's icons are (scripts/icons.ts), into brand/. No words in any of them, so they are the same in every language.
 *
 * An avatar is the mark in the middle of a square, with room round it for the circle most networks cut it to, in
 * three colourways: the accent on paper (the app icon's), paper on the accent, and a light mark on the dark ink.
 * Each network gets the side it asks for. The banner is Bluesky's 3 by 1: a dense network diagram in the dark
 * colours, sheets joined by links, the one idea drawn many times, with its lower left kept quieter where the
 * profile picture sits over it.
 *
 *   npm run brand
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markPaths } from '../src/kit/draw/mark.ts';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const out = join(root, 'brand');

const INK = '#18181b';
const INK_DARK = '#e4e4e7';
const ACCENT = '#4f46e5';
const PAPER = '#ffffff';

/** The mark's strokes, `side` pixels square at (x, y), in `colour`, at `width` (Lucide's 2 of 24). */
const marked = (colour: string, side: number, x = 0, y = 0, width = 2, opacity = 1) =>
  `<svg x="${x}" y="${y}" width="${side}" height="${side}" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${markPaths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;

/** The side each network shows a profile picture at, or asks for. */
const NETWORKS: Record<string, number> = { bluesky: 1000, mastodon: 400, x: 400, linkedin: 400, github: 500, instagram: 1000, threads: 1000, youtube: 800, facebook: 720 };

/** The three colourways: the ground, the mark. */
const WAYS: Record<string, [ground: string, mark: string]> = { paper: [PAPER, ACCENT], accent: [ACCENT, PAPER], ink: [INK, INK_DARK] };

/** An avatar: the mark in the middle at seven tenths of the side, which keeps its corners well inside the circle a network cuts. */
const avatar = (side: number, ground: string, colour: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}"><rect width="${side}" height="${side}" fill="${ground}"/>${marked(colour, side * 0.7, side * 0.15, side * 0.15)}</svg>`;

/** A small, seeded random, so the banner is the same picture each run (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BANNER_W = 3000;
const BANNER_H = 1000;
/** Where Bluesky lays the profile picture over the banner: the lower left corner, about a third of the height across. */
const QUIET = { x: 0, y: BANNER_H * 0.45, w: BANNER_W * 0.17, h: BANNER_H * 0.55 };

/** The banner: sheets on a jittered grid, each joined to its nearest few and now and then to one far off, in the dark palette. */
function banner(): string {
  const rnd = seeded(20261013);
  const cols = 26;
  const rows = 9;
  const cw = BANNER_W / cols;
  const ch = BANNER_H / rows;
  type Node = { x: number; y: number; s: number; c: string; o: number; w: number };
  const nodes: Node[] = [];
  const inks = ['#a1a1aa', '#818cf8', '#6366f1', '#e4e4e7', '#71717a', '#a5b4fc'];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cw + (rnd() - 0.5) * cw * 0.9;
      const y = (r + 0.5) * ch + (rnd() - 0.5) * ch * 0.9;
      const quiet = x > QUIET.x && x < QUIET.x + QUIET.w && y > QUIET.y && y < QUIET.y + QUIET.h;
      if (quiet && rnd() < 0.7) continue;
      const big = rnd() < 0.12;
      const s = big ? 54 + rnd() * 30 : 22 + rnd() * 24;
      const c2 = big ? (rnd() < 0.5 ? '#818cf8' : INK_DARK) : inks[Math.floor(rnd() * inks.length)];
      nodes.push({ x, y, s, c: c2, o: big ? 0.95 : 0.45 + rnd() * 0.45, w: big ? 1.75 : 2 });
    }
  // The links: each sheet to its two or three nearest, and one in twelve to a far one; each pair once.
  const pairs = new Set<string>();
  const links: [Node, Node, boolean][] = [];
  const join = (a: number, b: number, far: boolean) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || pairs.has(k)) return;
    pairs.add(k);
    links.push([nodes[a], nodes[b], far]);
  };
  nodes.forEach((n, i) => {
    const near = nodes
      .map((m, j) => [j, (m.x - n.x) ** 2 + (m.y - n.y) ** 2] as const)
      .filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1])
      .slice(0, rnd() < 0.5 ? 2 : 3);
    for (const [j] of near) join(i, j, false);
    if (rnd() < 1 / 12) join(i, Math.floor(rnd() * nodes.length), true);
  });
  const d = (n: Node) => `${(n.x + n.s / 2).toFixed(1)},${(n.y + n.s / 2).toFixed(1)}`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_W}" height="${BANNER_H}" viewBox="0 0 ${BANNER_W} ${BANNER_H}">`;
  svg += `<defs><radialGradient id="g" cx="0.62" cy="0.5" r="0.75"><stop offset="0" stop-color="#1c1c26"/><stop offset="1" stop-color="#0c0c11"/></radialGradient></defs>`;
  svg += `<rect width="${BANNER_W}" height="${BANNER_H}" fill="url(#g)"/>`;
  // The links under the sheets: thin indigo lines, the far ones dashed and fainter.
  svg += `<g stroke="${ACCENT}" stroke-width="2" fill="none">`;
  for (const [a, b, far] of links) svg += `<path d="M${d(a)}L${d(b)}" stroke-opacity="${far ? 0.22 : 0.4}"${far ? ' stroke-dasharray="10 12"' : ''}/>`;
  svg += `</g>`;
  // A dot where each link meets its sheet.
  svg += `<g fill="${ACCENT}" fill-opacity="0.8">`;
  for (const [a, b] of links)
    svg += `<circle cx="${(a.x + a.s / 2).toFixed(1)}" cy="${(a.y + a.s / 2).toFixed(1)}" r="3"/><circle cx="${(b.x + b.s / 2).toFixed(1)}" cy="${(b.y + b.s / 2).toFixed(1)}" r="3"/>`;
  svg += `</g>`;
  // The sheets, each on a disc of the ground so the lines stop at its edge.
  for (const n of nodes) {
    svg += `<circle cx="${(n.x + n.s / 2).toFixed(1)}" cy="${(n.y + n.s / 2).toFixed(1)}" r="${(n.s * 0.62).toFixed(1)}" fill="#111117"/>`;
    svg += marked(n.c, n.s, n.x, n.y, n.w, n.o);
  }
  return svg + `</svg>`;
}

async function main() {
  // sharp arrives with the toolchain (wrangler's); the pictures are kept in brand/, so this runs only by hand.
  const { default: sharp } = (await import('sharp' as string)) as { default: (b: Buffer) => { png(): { toFile(f: string): Promise<unknown> } } };
  mkdirSync(out, { recursive: true });
  const png = (svg: string, file: string) => sharp(Buffer.from(svg)).png().toFile(join(out, file));
  for (const [network, side] of Object.entries(NETWORKS)) for (const [way, [ground, colour]] of Object.entries(WAYS)) await png(avatar(side, ground, colour), `avatar-${network}-${way}-${side}.png`);
  await png(banner(), 'banner-bluesky-3000x1000.png');
  console.log(`${Object.keys(NETWORKS).length * Object.keys(WAYS).length} avatars and the banner in brand/`);
}

await main();
