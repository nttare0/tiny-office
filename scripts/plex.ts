/**
 * The site's type for the pictures drawn by script (scripts/make-cards.ts, scripts/icons.ts' og.png): every face of
 * src/styles/fonts.css with its file from public/fonts/ inline, so a page Chromium draws is in IBM Plex as the site
 * is (Paul, 2026-10-11: "we use Plex everywhere"), nothing is fetched, and nothing depends on the fonts of the
 * machine that runs it. `shoot` draws such pages to PNGs, waiting for the faces they use.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');

/** The @font-face rules of src/styles/fonts.css that name a file, each file as a data: URL (the device's stand-ins, local(), left out: a picture drawn here is in Plex alone). */
export function plexFaces(): string {
  const css = readFileSync(join(root, 'src/styles/fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/@font-face\s*\{[^}]*\}/g)]
    .filter((m) => m[0].includes("url('/fonts/"))
    .map((m) => m[0].replace(/url\('\/fonts\/([^']+)'\)/, (_, file: string) => `url('data:font/woff2;base64,${readFileSync(join(root, 'public/fonts', file)).toString('base64')}')`))
    .join('\n');
}

/**
 * Draw each page (1200 by 630) through Chromium, once its faces are in; nothing from the web but what `from` names
 * (origins let through: the map's tiles, scripts/sample-cards.ts), and the page waits for those. `prepare` changes
 * the page first (the cards' greeking: scripts/make-cards.ts); a file of '' draws nothing. The pages as drawn come back.
 */
export async function shoot(pages: [html: string, file: string][], prepare?: (tab: import('playwright').Page) => Promise<void>, from: string[] = []): Promise<string[]> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await tab.route('**/*', (r) =>
    r.request().url().startsWith('data:') ||
    from.some((o) =>
      r
        .request()
        .url()
        .startsWith(o + '/'),
    )
      ? r.continue()
      : r.abort(),
  );
  const drawn: string[] = [];
  try {
    for (const [html, file] of pages) {
      await tab.setContent(html, { waitUntil: 'load' });
      await tab.evaluate(() => document.fonts.ready.then(() => undefined));
      if (from.length) await tab.waitForLoadState('networkidle');
      if (prepare) await prepare(tab);
      if (file) await tab.screenshot({ path: file, type: 'png' });
      drawn.push(await tab.content());
    }
  } finally {
    await browser.close();
  }
  return drawn;
}
