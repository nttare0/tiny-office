// What is this?: the manual is a deck kept in the tree (src/kit/ui/manual.tlo), compiled into the drawer's row as its
// link, so every build carries it as it is (Paul, 2026-10-14: "put the tlo for the deck under version control and
// compile it as a link into that button").
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manualHash } from '../src/kit/ui/manual.ts';
import { parseHash } from '../src/kit/core/route.ts';
import { decodeDoc } from '../src/kit/core/codec.ts';
import { appOf } from '../src/kit/core/apps.ts';
import { appInHead } from '../src/kit/core/plain.ts';

test('the manual is the deck in src/kit/ui/manual.tlo, whole, opened in the Presentation Builder under its title', () => {
  const file = readFileSync(join(import.meta.dirname, '../src/kit/ui/manual.tlo'), 'utf8');
  const [app, text] = appInHead(file);
  expect(app).toBe('deck');
  const route = parseHash(manualHash());
  expect(route.app).toBe('deck');
  expect(route.view).toBe('');
  expect(decodeDoc(route.payload)).toBe(text);
  const def = appOf('deck')!;
  expect(def.title(text)).toBe('Introducing Tiny Little Office');
  // A slide for what it is, how it is made, each app, the languages: more than a dozen, and the closing code.
  expect(def.view(text, { still: true }).length).toBeGreaterThan(12);
  // Built once: the same link each time it is asked for.
  expect(manualHash()).toBe(manualHash());
});
