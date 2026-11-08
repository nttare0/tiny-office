// A trip's map drawn anywhere is on OpenStreetMap's tiles (Paul, 2026-10-12: "The map shows the locations but not the
// map itself"): a slide that holds a trip shows them under its places, and the plain ground with the Map switch off; a
// preview card of a trip has them written in before it is drawn to pixels, and still comes when they do not.
import { afterEach, expect, test, vi } from 'vitest';
import '../../src/styles.css';
import '../../src/apps/deck/editor.ts';
import type { ToDeckEditor } from '../../src/apps/deck/editor.ts';
import trip from '../../src/apps/trip/def.ts';
import { setMapOn } from '../../src/apps/trip/view.ts';
import { cardFor } from '../../src/kit/share/card.ts';
import { until } from './helpers.ts';

const HERE = 'Place | Lat:number | Lon:number\n--- | --- | ---\nGrand Army Plaza | 40.6741 | -73.9708\n';
const TILE = /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

afterEach(() => {
  vi.unstubAllGlobals();
  setMapOn(true);
});

async function deck(value: string): Promise<ToDeckEditor> {
  document.body.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'to-main';
  document.body.append(main);
  const el = document.createElement('to-deck-editor') as ToDeckEditor;
  el.value = value;
  main.append(el);
  await el.updateComplete;
  await until(() => !!el.querySelector('figure.deck-sub svg circle'));
  return el;
}
const tilesOn = (el: HTMLElement) => [...el.querySelectorAll('figure.deck-sub svg image')].map((i) => i.getAttribute('href') ?? '');

test('a slide that holds a trip draws its map on the tiles, with the credit; with the Map switch off, the plain ground', async () => {
  const slide = `## The walk\n\n\`\`\`trip\n${HERE}\`\`\`\n`;
  const on = tilesOn(await deck(slide));
  // A box's handful (the tile's load may fail here: only the address is the test's).
  expect(on.length).toBeGreaterThan(0);
  expect(on.length).toBeLessThanOrEqual(12);
  for (const h of on) expect(h).toMatch(TILE);
  expect(document.querySelector('figure.deck-sub svg a')?.textContent).toBe('© OpenStreetMap');
  setMapOn(false);
  const off = await deck(slide);
  expect(tilesOn(off)).toEqual([]);
  expect(off.querySelector('figure.deck-sub svg')!.innerHTML).not.toContain('OpenStreetMap');
});
/** A 1 by 1 PNG of pure red: the tile the stub answers. */
async function redPixel(): Promise<Blob> {
  const c = new OffscreenCanvas(1, 1);
  const g = c.getContext('2d')!;
  g.fillStyle = '#ff0000';
  g.fillRect(0, 0, 1, 1);
  return c.convertToBlob({ type: 'image/png' });
}
/** The tiles and the site's /card, stubbed: each tile asked for, and the card posted (as its pixels). */
function stub(tile: Blob | null) {
  const asked: string[] = [];
  const posted: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (TILE.test(u)) {
      asked.push(u);
      expect(init).toMatchObject({ mode: 'cors', referrerPolicy: 'strict-origin' });
      if (!tile) throw new TypeError('Failed to fetch');
      return new Response(tile, { headers: { 'content-type': 'image/png', 'access-control-allow-origin': '*' } });
    }
    if (!u.endsWith('/card')) throw new Error(`unexpected fetch ${u}`);
    posted.push(JSON.parse(String(init?.body)).png);
    return new Response(JSON.stringify({ id: `c${posted.length}` }), { status: 201, headers: { 'content-type': 'application/json' } });
  });
  return { asked, posted };
}
/** How many of a PNG's pixels are the stub's red. */
async function reds(base64: string): Promise<number> {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: 'image/png' }));
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext('2d')!;
  g.drawImage(bitmap, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] > 240 && px[i + 1] < 16 && px[i + 2] < 16) n++;
  return n;
}

test('a card of a trip: the tiles fetched and written in, so the picture is not blank where they are; a tile that never comes leaves the ground, and the card still comes', async () => {
  const { asked, posted } = stub(await redPixel());
  expect(await cardFor('/card', 'https://example.test/#a', trip, HERE, 'The walk')).toBe('c1');
  expect(asked.length).toBeGreaterThan(0);
  expect(asked.length).toBeLessThanOrEqual(12);
  // The map's box, on the tiles: a great part of the card is the tile's red.
  expect(await reds(posted[0])).toBeGreaterThan(50_000);
  vi.unstubAllGlobals();
  const failing = stub(null);
  expect(await cardFor('/card', 'https://example.test/#b', trip, HERE, 'The walk')).toBe('c1');
  expect(failing.asked.length).toBe(asked.length);
  expect(await reds(failing.posted[0])).toBe(0);
});
