/**
 * Offline, through Save in browser (Paul, 2026-10-12: "Then offline is instant"): while it is on, the site's service
 * worker (src/sw.ts, dist/sw.js) keeps the pages, the app file and what the pages have fetched, so the site opens
 * with no network; turned off, the worker is unregistered and every cache it made is deleted, with the rest of what
 * the device held (kit/share/privacy.ts). Under Private nothing registers, and anything left from before is removed.
 * The worker keeps the site's files, never a document: the document is after the "#", which never reaches it.
 */
import { keeping } from '../core/store.ts';

/** The worker's caches are all named so (src/sw.ts). */
const PREFIX = 'tlo-';

/**
 * Where the worker is: at the site's root, beside the folder of the app file this code is in (assets/). Read from a
 * variable, so the bundler does not take the address for a file of the source to bundle.
 */
const here = import.meta.url;
const workerUrl = (): string => new URL('../sw.js', here).href;

/** The worker registered (on) or removed with its caches (off). Never throws: a browser without workers keeps nothing. */
export async function keepOffline(on: boolean): Promise<void> {
  const workers = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  try {
    if (on) {
      await workers?.register(workerUrl());
      return;
    }
    for (const r of (await workers?.getRegistrations()) ?? []) await r.unregister();
    if (typeof caches !== 'undefined') for (const k of await caches.keys()) if (k.startsWith(PREFIX)) await caches.delete(k);
  } catch {
    // No worker here (a private window that refuses one, an address with none): the site works as before, online.
  }
}

/** At load: registered under Saved, and nothing left under Private. */
export const offlineAtLoad = (): Promise<void> => keepOffline(keeping());
