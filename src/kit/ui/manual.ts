/**
 * The manual: "What is this?", the drawer's first row, opens a deck that introduces Tiny Little Office and shows
 * each app (Paul, 2026-10-14: "a short intro and manual to the system", "The deck is manual"). The deck is manual.tlo
 * beside this file, under version control and compiled into the app as its link, so every build carries the manual
 * as it is in the tree ("put the tlo for the deck under version control and compile it as a link into that button.
 * That way we can always update the docs with each build"). The link is built once, the first time it is asked for.
 */
import raw from './manual.tlo?raw';
import { encodeDoc } from '../core/codec.ts';
import { appInHead } from '../core/plain.ts';
import { routeHash } from '../core/route.ts';

let hash = '';

/** The fragment that opens the manual: the deck's route with the deck as its payload. */
export function manualHash(): string {
  if (!hash) {
    const [app, text] = appInHead(raw);
    hash = routeHash(app || 'deck', encodeDoc(text));
  }
  return hash;
}
