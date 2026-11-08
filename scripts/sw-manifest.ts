/**
 * The service worker's list (src/sw.ts, built to dist/sw.js): the files it keeps when it is installed, and its
 * cache's name, written into dist/sw.js by the build (vite.config.ts, after the pages are written). The name is a hash
 * of the listed files' bytes, so a deploy that changes any of them is a new sw.js, which the browser installs on the
 * next online visit and which then deletes the old cache. The list:
 *
 *   - the pages: the home page and each app's ("", "write/", …), as the worker asks for them by address;
 *   - the app file and the stylesheet (dist/assets/app-<hash>.js and .css) (the theme script is in each page);
 *   - the manifest and the icons it and the pages name;
 *   - the Latin faces: Plex Sans and Serif, regular and semibold, and Plex Mono.
 *
 * Not the templates, the other languages or the other faces: the worker keeps each the first time a page asks for
 * it. Nothing in the list depends on the clock or the machine, so two builds are the same bytes (scripts/reproducible.ts).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** What the worker's source holds until the build fills it: the value of BUILD in src/sw.ts, as written there. */
export const UNFILLED = '{"cache":"tlo-dev","files":[]}';

/** The faces kept at install. */
const LATIN_FACES = ['IBMPlexSans-Regular', 'IBMPlexSans-SemiBold', 'IBMPlexSerif-Regular', 'IBMPlexSerif-SemiBold', 'IBMPlexMono-Regular'].map((f) => `fonts/${f}.woff2`);

/** The files kept at install, relative to the site's root: the pages first, in the order the build wrote them. */
function workerFiles(dist: string, appIds: string[]): string[] {
  const assets = readdirSync(join(dist, 'assets'))
    .filter((f) => /^app-[\w-]{8}\.(?:js|css)$/.test(f))
    .sort()
    .map((f) => `assets/${f}`);
  const icons = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
  return ['', ...appIds.map((id) => `${id}/`), ...assets, 'manifest.webmanifest', ...icons, ...LATIN_FACES];
}

/** The cache's name for these files: "tlo-" and the first twelve hex digits of a hash of their names and bytes. */
function cacheName(dist: string, files: string[]): string {
  const h = createHash('sha256');
  for (const f of files) h.update(`${f}\n`).update(readFileSync(join(dist, f === '' || f.endsWith('/') ? `${f}index.html` : f)));
  return `tlo-${h.digest('hex').slice(0, 12)}`;
}

/** The worker's code with its list filled in; it throws when the code has no unfilled list (src/sw.ts changed shape). */
export function fill(code: string, build: { cache: string; files: string[] }): string {
  const at = code.search(/(['"`])\{"cache":"tlo-dev","files":\[\]\}\1/);
  if (at < 0) throw new Error('sw.js: the list to fill (BUILD in src/sw.ts) is not there');
  return code.slice(0, at) + JSON.stringify(JSON.stringify(build)) + code.slice(at + UNFILLED.length + 2);
}

/** dist/sw.js filled in for this build: its list and its cache's name. */
export function writeWorker(dist: string, appIds: string[]): { cache: string; files: string[] } {
  const files = workerFiles(dist, appIds);
  const build = { cache: cacheName(dist, files), files };
  const path = join(dist, 'sw.js');
  writeFileSync(path, fill(readFileSync(path, 'utf8'), build));
  return build;
}
