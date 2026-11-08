/**
 * Where the Trip Planner's map opens for each country (src/apps/trip/home.ts): src/apps/trip/countries.ts, every
 * ISO 3166-1 code (and Kosovo's XK, which browsers say) to a center and a zoom that shows the country whole on a
 * phone's map, 390 by 500.
 *
 * The countries' shapes are Natural Earth's admin-0 map units at 1:10m (public domain: naturalearthdata.com), read from
 * the pinned release below; the United States Minor Outlying Islands, which the map units fold into the United States,
 * from Natural Earth's admin-0 countries. A country's box is the box of its largest pieces of land, the biggest first
 * until they hold 95% of its area, so Spain is the peninsula and not the Canaries, and an archipelago is all of its
 * islands; a box that is shorter the other way round the world (Russia, Fiji, Kiribati) is taken that way. The boxes
 * are written to scripts/country-boxes.json (test/trip-home.test.ts holds the table to them) and the table is made
 * from them:
 *
 *   node scripts/countries.ts                     fetch Natural Earth, write the boxes and the table
 *   node scripts/countries.ts <map_units> <countries>    the same, from GeoJSON files already here
 *   node scripts/countries.ts --check             the table from the committed boxes, held against the committed table
 *
 * The build never runs it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './generated.ts';

const RELEASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
export const SOURCES = { units: `${RELEASE}/ne_10m_admin_0_map_units.geojson`, countries: `${RELEASE}/ne_10m_admin_0_countries.geojson` };
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const BOXES = 'scripts/country-boxes.json';
const TABLE = 'src/apps/trip/countries.ts';

/** The map a country is fitted to: a phone's, under the bar. */
export const FIT = { width: 390, height: 500 };
/** Never closer than a city (the editor's CITY): a city-state is shown with what is round it. */
const CLOSEST = 12;
/** Web Mercator's edge: a box past it (Antarctica) is cut there. */
const EDGE = 85;

/** [west, south, east, north] in degrees; east is less than west where the box crosses the 180th meridian. */
export type Box = [number, number, number, number];
type Ring = [number, number][];
type Feature = { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };

/** A latitude as Web Mercator's y, 0 at the top of the world and 1 at the bottom. */
const mercY = (lat: number) => {
  const r = (Math.max(-EDGE, Math.min(EDGE, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
/** How wide a box is in degrees of longitude, the short way it was taken. */
export const spanOf = (b: Box) => (b[2] >= b[0] ? b[2] - b[0] : b[2] + 360 - b[0]);
/** The closest whole zoom at which the box fits a map `FIT` big (a tile 256 pixels; the world 256·2^z wide). */
function zoomFor(b: Box): number {
  const wide = Math.max(spanOf(b) / 360, 1e-9);
  const tall = Math.max(mercY(b[1]) - mercY(b[3]), 1e-9);
  const z = Math.floor(Math.min(Math.log2(FIT.width / (256 * wide)), Math.log2(FIT.height / (256 * tall))));
  return Math.max(0, Math.min(CLOSEST, z));
}
/** The box's middle: halfway across, and halfway down the map (not in degrees, which would sit too near the equator). */
export function centerOf(b: Box): [number, number] {
  const y = (mercY(b[1]) + mercY(b[3])) / 2;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  let lon = b[0] + spanOf(b) / 2;
  if (lon > 180) lon -= 360;
  return [lat, lon];
}
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** The rings that bound a geometry's pieces of land (the outer ring of each polygon). */
function pieces(g: Feature['geometry']): Ring[] {
  if (g.type === 'Polygon') return [(g.coordinates as Ring[])[0]];
  if (g.type === 'MultiPolygon') return (g.coordinates as Ring[][]).map((p) => p[0]);
  return [];
}
/** A ring's area, near enough to rank pieces of land by: degrees squared, each row of longitude shrunk by its latitude. */
function areaOf(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    a += (x1 * Math.cos((y1 * Math.PI) / 180) + x2 * Math.cos((y2 * Math.PI) / 180)) * 0.5 * (y2 - y1);
  }
  return Math.abs(a);
}
/**
 * The narrowest span of longitude that holds every one of the spans ([west, east], east less than west across the 180th
 * meridian): the spans merged where they overlap, and the widest gap left between them round the world is outside it.
 */
function around(spans: [number, number][]): [number, number] {
  const arcs = spans.map(([w, e]) => [w, w + spanOf([w, 0, e, 0])]).sort((x, y) => x[0] - y[0]);
  const merged: number[][] = [];
  for (const [w, e] of arcs) {
    const last = merged.at(-1);
    if (last && w <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([w, e]);
  }
  // The gap from the last arc round to the first, then each gap between two.
  let gap = merged[0][0] + 360 - merged.at(-1)![1];
  let [west, east] = [merged[0][0], merged.at(-1)![1]];
  for (let i = 1; i < merged.length; i++) if (merged[i][0] - merged[i - 1][1] > gap) [gap, west, east] = [merged[i][0] - merged[i - 1][1], merged[i][0], merged[i - 1][1]];
  if (gap <= 0) return [-180, 180];
  const wrap = (x: number) => (x > 180 ? x - 360 : x);
  return [wrap(west), wrap(east)];
}
/** A country's box, from its pieces of land: the largest until they hold 95% of its area. */
function boxOf(rings: Ring[]): Box {
  const sized = rings.map((r) => ({ r, a: areaOf(r) })).sort((x, y) => y.a - x.a);
  const total = sized.reduce((n, x) => n + x.a, 0);
  const kept: Ring[] = [];
  let held = 0;
  for (const x of sized) {
    kept.push(x.r);
    held += x.a;
    if (held >= total * 0.95) break;
  }
  // Natural Earth cuts a piece of land at the 180th meridian, so each one's own span is its least and greatest longitude.
  const [w, e] = around(kept.map((r) => [Math.min(...r.map((p) => p[0])), Math.max(...r.map((p) => p[0]))]));
  const ys = kept.flat().map((p) => p[1]);
  return [round(w, 3), round(Math.min(...ys), 3), round(e, 3), round(Math.max(...ys), 3)];
}

/** Every country's box, by its code, from Natural Earth's map units (and, for UM alone, its countries). */
export function boxes(units: { features: Feature[] }, countries: { features: Feature[] }): Record<string, Box> {
  const rings = new Map<string, Ring[]>();
  // A code a browser can say: ISO 3166-1's, and Kosovo's (Natural Earth has codes of its own for places that have none).
  const named = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
  const add = (code: string, f: Feature) => /^[A-Z]{2}$/.test(code) && named.of(code) && rings.set(code, [...(rings.get(code) ?? []), ...pieces(f.geometry)]);
  for (const f of units.features) add(f.properties.ISO_A2_EH, f);
  for (const f of countries.features) if (f.properties.ISO_A2_EH === 'UM') add('UM', f);
  return Object.fromEntries([...rings.keys()].sort().map((code) => [code, boxOf(rings.get(code)!)]));
}

/** The table's source: a country's code to its center (to a hundredth of a degree) and its zoom. */
export function table(all: Record<string, Box>): string {
  const rows = Object.entries(all).map(([code, b]) => {
    const [lat, lon] = centerOf(b);
    return `  ${code}: [${round(lat, 2)}, ${round(lon, 2)}, ${zoomFor(b)}],`;
  });
  return `/**
 * Where the Trip Planner's map opens on each country: its ISO 3166-1 code to [latitude, longitude, zoom], the zoom the
 * closest at which the whole country fits a phone's map (390 by 500). Written by scripts/countries.ts from Natural
 * Earth's admin-0 boxes (public domain; scripts/country-boxes.json); never edited by hand. Codes only: no names.
 */
export const COUNTRIES: Record<string, readonly [number, number, number]> = {
${rows.join('\n')}
};
`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--check')) {
    const all = JSON.parse(readFileSync(resolve(ROOT, BOXES), 'utf8')) as Record<string, Box>;
    return generate({ [TABLE]: table(all) }, 'node scripts/countries.ts', argv, ROOT);
  }
  const get = async (file: string | undefined, url: string) => JSON.parse(file ? readFileSync(file, 'utf8') : await (await fetch(url)).text());
  const all = boxes(await get(argv[0], SOURCES.units), await get(argv[1], SOURCES.countries));
  writeFileSync(
    resolve(ROOT, BOXES),
    `{\n${Object.entries(all)
      .map(([code, b]) => `  "${code}": ${JSON.stringify(b)}`)
      .join(',\n')}\n}\n`,
  );
  writeFileSync(resolve(ROOT, TABLE), table(all));
  console.log(`countries: ${Object.keys(all).length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
