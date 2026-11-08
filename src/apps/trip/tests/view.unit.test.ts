// The drawn map on OpenStreetMap's tiles (Paul, 2026-10-12: "The map shows the locations but not the map itself"): the
// zoom that fits the places, the tiles that cover the box and no more, the credit, every pin over a tile; the plain
// ground with the Map switch off and on a thumbnail. Under node: the markup is read, never looked at.
import { afterEach, expect, test } from 'vitest';
import { parse } from '../../../doc/index.ts';
import def from '../def.ts';
import { readTrip } from '../model.ts';
import { FIT, mapOn, mapSvg, MIN_ZOOM, ONE_ZOOM, setMapOn } from '../view.ts';

const BROOKLYN = 'Place | Lat:number | Lon:number\n--- | --- | ---\nProspect Park | 40.6602 | -73.969\nBrooklyn Bridge Park | 40.7003 | -73.9967\nConey Island | 40.5749 | -73.9859\n';
const ONE = 'Place | Lat:number | Lon:number\n--- | --- | ---\nHere | 53.3446 | -6.2764\n';
const [W, H] = [320, 180];

afterEach(() => setMapOn(true));

/** The tiles in a map's markup: their zoom, column and row, and where each lies in the box. */
const tilesOf = (svg: string) =>
  [...svg.matchAll(/<image href="https:\/\/tile\.openstreetmap\.org\/(\d+)\/(\d+)\/(\d+)\.png" x="([\d.-]+)" y="([\d.-]+)" width="256" height="256"\/>/g)].map((m) => ({
    z: +m[1],
    tx: +m[2],
    ty: +m[3],
    x: +m[4],
    y: +m[5],
  }));
const pinsOf = (svg: string) => [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)"/g)].map((m) => [+m[1], +m[2]]);
/** Web Mercator, in world widths, as the map draws it. */
const wx = (lon: number) => (lon + 180) / 360;
const wy = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

test('three places in Brooklyn: the greatest zoom at which they fit, the tiles that cover the box and no more, the credit, every pin over a tile', () => {
  const v = readTrip(parse(BROOKLYN));
  const svg = mapSvg(v, W, H, Infinity, true);
  const tiles = tilesOf(svg);
  expect(tiles.length).toBe((svg.match(/<image /g) ?? []).length);
  const z = tiles[0].z;
  expect(tiles.every((t) => t.z === z)).toBe(true);
  // The greatest zoom at which the places' extent fits the box with its margin.
  const dx = Math.max(...v.stops.map((s) => wx(s.lon))) - Math.min(...v.stops.map((s) => wx(s.lon)));
  const dy = Math.max(...v.stops.map((s) => wy(s.lat))) - Math.min(...v.stops.map((s) => wy(s.lat)));
  const fits = (z: number) => dx * 256 * 2 ** z <= W * FIT && dy * 256 * 2 ** z <= H * FIT;
  expect(fits(z)).toBe(true);
  expect(fits(z + 1)).toBe(false);
  expect(z).toBe(10);
  // Every tile touches the box, and together they cover it: a grid of whole columns and rows, no more.
  for (const t of tiles) {
    expect(t.x < W && t.x + 256 > 0 && t.y < H && t.y + 256 > 0, `${t.tx},${t.ty}`).toBe(true);
    expect(t.x).toBeCloseTo(tiles[0].x + (t.tx - tiles[0].tx) * 256, 1);
    expect(t.y).toBeCloseTo(tiles[0].y + (t.ty - tiles[0].ty) * 256, 1);
  }
  const xs = [...new Set(tiles.map((t) => t.tx))];
  const ys = [...new Set(tiles.map((t) => t.ty))];
  expect(tiles).toHaveLength(xs.length * ys.length);
  expect(Math.min(...tiles.map((t) => t.x))).toBeLessThanOrEqual(0);
  expect(Math.min(...tiles.map((t) => t.y))).toBeLessThanOrEqual(0);
  expect(Math.max(...tiles.map((t) => t.x + 256))).toBeGreaterThanOrEqual(W);
  expect(Math.max(...tiles.map((t) => t.y + 256))).toBeGreaterThanOrEqual(H);
  // Each tile is the square of the world it is drawn as: Coney Island lies in the tile its column and row say.
  const coney = v.stops[2];
  const at = tiles.find((t) => t.tx === Math.floor(wx(coney.lon) * 2 ** z) && t.ty === Math.floor(wy(coney.lat) * 2 ** z))!;
  const [cx, cy] = pinsOf(svg)[2];
  expect(cx - at.x).toBeCloseTo((wx(coney.lon) * 2 ** z - at.tx) * 256, 0);
  expect(cy - at.y).toBeCloseTo((wy(coney.lat) * 2 ** z - at.ty) * 256, 0);
  // Every pin over a tile, inside the box.
  const pins = pinsOf(svg);
  expect(pins).toHaveLength(3);
  for (const [x, y] of pins) {
    expect(x > 0 && x < W && y > 0 && y < H).toBe(true);
    expect(tiles.some((t) => x >= t.x && x < t.x + 256 && y >= t.y && y < t.y + 256)).toBe(true);
  }
  // The tiles under the pins, clipped to the box; the credit over them, a link to OpenStreetMap's copyright page.
  expect(svg.indexOf('<image ')).toBeLessThan(svg.indexOf('<circle'));
  expect(svg).toContain(`<svg width="${W}" height="${H}"><image `);
  expect(svg).toMatch(/<a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>.*© OpenStreetMap<\/text><\/a>$/);
});

test('stops across the world are drawn at the continents’ zoom, never on one tile of the globe', () => {
  const WORLD = 'Place | Lat:number | Lon:number\n--- | --- | ---\nSydney | -33.8688 | 151.2093\nReykjavík | 64.1466 | -21.9426\nSantiago | -33.4489 | -70.6693\n';
  const svg = mapSvg(readTrip(parse(WORLD)), W, H, Infinity, true);
  expect(MIN_ZOOM).toBe(2);
  expect(new Set(tilesOf(svg).map((t) => t.z))).toEqual(new Set([MIN_ZOOM]));
  expect(pinsOf(svg)).toHaveLength(3);
});

test('one place alone is centred at a neighbourhood’s zoom', () => {
  const svg = mapSvg(readTrip(parse(ONE)), W, H, Infinity, true);
  expect(new Set(tilesOf(svg).map((t) => t.z))).toEqual(new Set([ONE_ZOOM]));
  expect(pinsOf(svg)).toEqual([[W / 2, H / 2]]);
});

test('the Map switch off, or a thumbnail: the plain ground, no tiles and no credit; on, a slide’s or a page’s map has them', () => {
  const shows = (opts?: Parameters<typeof def.view>[1]) => def.view(BROOKLYN, opts)[0].svg;
  expect(mapOn()).toBe(true);
  expect(shows()).toContain('<image href="https://tile.openstreetmap.org/');
  expect(shows({ small: true, still: true })).toContain('© OpenStreetMap');
  // A thumbnail (the home page's templates) tells OpenStreetMap nothing.
  expect(shows({ small: true, thumb: true })).not.toMatch(/<image|OpenStreetMap/);
  setMapOn(false);
  for (const svg of [shows(), shows({ small: true }), mapSvg(readTrip(parse(BROOKLYN)), W, H)]) expect(svg).not.toMatch(/<image|https?:|OpenStreetMap/);
});
