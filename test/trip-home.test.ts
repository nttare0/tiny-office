// Where an empty trip's map opens (src/apps/trip/home.ts): the country of the site's language, the browser's own
// region overriding it, New York City where the country is not known; and the table of every country's center and
// zoom (src/apps/trip/countries.ts, written by scripts/countries.ts) held to the boxes it was made from.
import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { COUNTRIES } from '../src/apps/trip/countries.ts';
import { CITY, HOMES, homeCountry, homeView, NYC } from '../src/apps/trip/home.ts';
import { centerOf, FIT, spanOf, type Box } from '../scripts/countries.ts';

/** ISO 3166-1's officially assigned codes: all 249. */
const ISO = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN ' +
  'CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM ' +
  'HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ' +
  'ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI ' +
  'VN VU WF WS YE YT ZA ZM ZW'
).split(' ');
const BOXES = JSON.parse(readFileSync(new URL('../scripts/country-boxes.json', import.meta.url), 'utf8')) as Record<string, Box>;
const at = (code: string) => ({ lat: COUNTRIES[code][0], lon: COUNTRIES[code][1], zoom: COUNTRIES[code][2] });

test('every language with no region opens on its home', () => {
  const homes: Record<string, string> = {
    ar: 'EG',
    bn: 'BD',
    de: 'DE',
    es: 'MX',
    fr: 'FR',
    he: 'IL',
    hi: 'IN',
    ht: 'HT',
    it: 'IT',
    ja: 'JP',
    ko: 'KR',
    nl: 'NL',
    pl: 'PL',
    'pt-br': 'BR',
    ru: 'RU',
    uk: 'UA',
    ur: 'PK',
    yi: 'US',
    'zh-hans': 'CN',
    'zh-hant': 'TW',
  };
  expect(HOMES).toEqual(homes);
  // Every language of the site but English has a home.
  const files = Object.keys(import.meta.glob('../src/i18n/*.ftl')).map((f) => f.replace(/^.*\/([^/]+)\.ftl$/, '$1'));
  expect(files.filter((c) => c !== 'en').sort()).toEqual(Object.keys(homes).sort());
  for (const [language, code] of Object.entries(homes)) {
    expect(homeCountry(language, []), language).toBe(code);
    // The browser's language with no region, or another language's region, changes nothing.
    expect(homeCountry(language, [language.split('-')[0], 'en-GB']), language).toBe(code);
    // The United States is New York City (Yiddish's home), as for English.
    expect(homeView(language, ['en-AU']), language).toEqual(code === 'US' ? NYC : at(code));
  }
});

test("the browser's region overrides the language's home", () => {
  expect(homeView('es', ['es-AR'])).toEqual(at('AR'));
  expect(homeView('fr', ['fr-CA', 'fr-FR'])).toEqual(at('CA'));
  expect(homeView('en', ['en-GB'])).toEqual(at('GB'));
  expect(homeView('de', ['en-US', 'de-AT'])).toEqual(at('AT'));
  expect(homeView('pt-br', ['pt-PT'])).toEqual(at('PT'));
  expect(homeView('zh-hant', ['zh-HK'])).toEqual(at('HK'));
  // The first of the browser's tags in the site's language is the one that counts: with no region, the home.
  expect(homeView('es', ['es', 'es-AR'])).toEqual(at('MX'));
  // A Traditional Chinese site is not a zh-CN browser's; a region that is not a country (Latin America) is the home.
  expect(homeCountry('zh-hant', ['zh-CN'])).toBe('TW');
  expect(homeCountry('es', ['es-419'])).toBe('MX');
  expect(homeCountry('en', ['en-IE'])).toBe('IE');
});

test('English with no region, a region of the United States, and a language not known open on New York City at a city’s zoom', () => {
  expect(NYC).toEqual({ lat: 40.7128, lon: -74.006, zoom: CITY });
  expect(CITY).toBe(12);
  expect(homeView('en', [])).toEqual(NYC);
  expect(homeView('en', ['en'])).toEqual(NYC);
  expect(homeView('en', ['en-US'])).toEqual(NYC);
  expect(homeView('es', ['es-US'])).toEqual(NYC);
  expect(homeView('xx', ['xx-YY'])).toEqual(NYC);
  expect(homeView('not a tag!', ['also not'])).toEqual(NYC);
  expect(homeView('en', ['en-ZZ'])).toEqual(NYC);
});

test('the table has every ISO 3166-1 code, codes only, and every home is in it', () => {
  for (const code of ISO) expect(COUNTRIES[code], code).toBeDefined();
  expect(Object.keys(COUNTRIES).filter((c) => !ISO.includes(c))).toEqual(['XK']);
  for (const code of Object.values(HOMES)) expect(COUNTRIES[code], code).toBeDefined();
  const source = readFileSync(new URL('../src/apps/trip/countries.ts', import.meta.url), 'utf8');
  // No names: nothing to translate.
  expect(source.replace(/\/\*\*[\s\S]*?\*\//, '')).not.toMatch(/'[^']*'/);
  expect(source.length).toBeLessThan(8192);
});

/** Web Mercator: a latitude's y on a world 1 wide. */
const y = (lat: number) => {
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2;
};

test('each zoom shows its country’s box inside a phone’s map, 390 by 500, at that zoom, and the next zoom in would not (but a city-state’s, held at a city)', () => {
  expect(FIT).toEqual({ width: 390, height: 500 });
  expect(Object.keys(BOXES).sort()).toEqual(Object.keys(COUNTRIES).sort());
  for (const [code, [lat, lon, zoom]] of Object.entries(COUNTRIES)) {
    const b = BOXES[code];
    const world = (z: number) => 256 * 2 ** z;
    const wide = (z: number) => (spanOf(b) / 360) * world(z);
    const tall = (z: number) => (y(b[1]) - y(b[3])) * world(z);
    expect(wide(zoom), code).toBeLessThanOrEqual(390);
    expect(tall(zoom), code).toBeLessThanOrEqual(500);
    if (zoom < CITY && zoom > 0) expect(wide(zoom + 1) > 390 || tall(zoom + 1) > 500, code).toBe(true);
    // The center is the box's, to a hundredth of a degree, and inside it (as near as a hundredth: the Vatican is smaller).
    const [cy, cx] = centerOf(b);
    expect(Math.abs(lat - cy), code).toBeLessThanOrEqual(0.006);
    expect(Math.abs(lon - cx), code).toBeLessThanOrEqual(0.006);
    expect(lat >= b[1] - 0.006 && lat <= b[3] + 0.006, code).toBe(true);
    const across = (((lon - b[0]) % 360) + 360) % 360;
    expect(across <= spanOf(b) + 0.006 || across >= 360 - 0.006, code).toBe(true);
  }
  // Across the 180th meridian the short way round: Fiji is a few degrees wide, not the world.
  expect(spanOf(BOXES.FJ)).toBeLessThan(10);
  expect(COUNTRIES.FJ[2]).toBeGreaterThanOrEqual(5);
  expect(spanOf(BOXES.RU)).toBeLessThan(180);
});
