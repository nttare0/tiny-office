/**
 * The service worker: Tiny Little Office kept on the device, so it opens offline. Registered only while Save in
 * browser is on, and removed with its caches when it is turned off (kit/share/offline.ts); a private visit has none.
 *
 *   - Installed, it keeps this build's files: the pages, the app file, the stylesheet, the manifest
 *     and the icons, and the Latin faces (scripts/sw-manifest.ts writes the list and the cache's name into dist/sw.js).
 *   - A file with a hash in its name (the app file, a templates file, a language) and a face of the type are kept the
 *     first time the page asks for one and served from the cache after: a hash never changes meaning.
 *   - A page, and anything else of the site's, is asked of the network first, so an online visit is never stale; the
 *     kept copy answers when the network does not. Only a page of the list is kept, at its address without a query:
 *     a shared link's "/c/<id>" page carries a card's words, and nothing of a document is ever kept here (the document is after
 *     the "#", which never reaches the worker).
 *   - A new build is a new sw.js (its list and its cache's name change), which the browser installs on the next online
 *     visit; activated, it deletes the caches of the builds before it.
 *
 * Plain script, no imports: built as an entry of its own (vite.config.ts) and registered as a classic worker.
 */

interface Waiting extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface Fetching extends Waiting {
  request: Request;
  respondWith(r: Promise<Response>): void;
}
interface WorkerScope {
  addEventListener(type: 'install' | 'activate', listener: (e: Waiting) => void): void;
  addEventListener(type: 'fetch', listener: (e: Fetching) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  registration: { scope: string };
  location: { origin: string };
}
const scope = self as unknown as WorkerScope;

/** This build's cache and the files kept at install, relative to the site's root: filled in by scripts/sw-manifest.ts. */
const BUILD: { cache: string; files: string[] } = JSON.parse('{"cache":"tlo-dev","files":[]}');
/** Every cache this worker makes is named so; the kit deletes them all when Save in browser is turned off. */
const PREFIX = 'tlo-';

const root = scope.registration.scope;
/** The pages of the list, by their address. */
const pages = new Set(BUILD.files.filter((f) => f === '' || f.endsWith('/')).map((f) => new URL(f, root).href));
/** A file whose name says what it is for good: hashed (the build's own), or a face of the type. */
const lasting = (url: URL) => /-[\w-]{8}\.(?:js|css)$/.test(url.pathname) || /\/fonts\/[^/]+\.woff2$/.test(url.pathname);

scope.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(BUILD.cache)
      .then((cache) => cache.addAll(BUILD.files.map((f) => new URL(f, root).href)))
      .then(() => scope.skipWaiting()),
  );
});

scope.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== BUILD.cache).map((k) => caches.delete(k))))
      .then(() => scope.clients.claim()),
  );
});

/** From the cache, else from the network and kept. */
async function cacheFirst(request: Request): Promise<Response> {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await (await caches.open(BUILD.cache)).put(request, response.clone());
  return response;
}

/** From the network (a page of the list kept afresh, by its address alone), else the kept copy. */
async function networkFirst(request: Request, url: URL): Promise<Response> {
  const page = url.origin + url.pathname;
  try {
    const response = await fetch(request);
    if (response.ok && !url.search && pages.has(page)) await (await caches.open(BUILD.cache)).put(page, response.clone());
    return response;
  } catch (err) {
    const kept = await caches.match(pages.has(page) ? page : request);
    if (kept) return kept;
    throw err;
  }
}

scope.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.location.origin) return;
  e.respondWith(lasting(url) ? cacheFirst(request) : networkFirst(request, url));
});
