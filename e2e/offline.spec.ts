/**
 * Offline through Save in browser (src/sw.ts, kit/share/offline.ts; Paul, 2026-10-12: "Then offline is instant"): a
 * visit under Saved registers the site's worker, whose cache holds the pages, the app file and the stylesheet; an
 * app's templates fetched online join it. Offline, the site opens again from the cache, those templates are there,
 * and an app's templates never fetched are not, which the list says in a sentence rather than showing nothing.
 * Chromium, where Playwright's offline reaches the worker's own fetches too.
 */
import { test, expect, type Page } from '@playwright/test';

/** The paths the worker's cache holds. */
const cached = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const out: string[] = [];
    for (const name of (await caches.keys()).filter((k) => k.startsWith('tlo-'))) for (const r of await (await caches.open(name)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });

/** An app's templates opened from its row on the home page: the dialog. */
async function templatesOf(page: Page, app: string) {
  await page.getByRole('button', { name: `Templates for ${app}` }).click();
  const dialog = page.getByRole('dialog', { name: `Templates for ${app}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('kept under Saved, the site opens offline with the templates fetched before; one never fetched is said to be missing', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'offline reaches the worker in Chromium');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tinyoffice.keep', '1'));
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(() => cached(page))
    .toEqual(expect.arrayContaining(['/', '/write/', '/sheet/', expect.stringMatching(/^\/assets\/app-[\w-]{8}\.js$/), expect.stringMatching(/^\/assets\/app-[\w-]{8}\.css$/)]));
  // The page under the worker, then Write's templates fetched: they join the cache.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const write = await templatesOf(page, 'Word Processor');
  await expect(write.getByRole('option', { name: /Cover letter/ })).toBeVisible();
  await expect.poll(() => cached(page)).toContainEqual(expect.stringMatching(/^\/assets\/templates-write-[\w-]{8}\.js$/));
  await page.keyboard.press('Escape');

  await context.setOffline(true);
  await page.goto('/');
  await expect(page.locator('.to-app-name').first()).toHaveText('Word Processor');
  await expect((await templatesOf(page, 'Word Processor')).getByRole('option', { name: /Cover letter/ })).toBeVisible();
  await page.keyboard.press('Escape');
  const sheet = await templatesOf(page, 'Spreadsheet');
  await expect(sheet.getByRole('status')).toHaveText('The templates are not saved in this browser yet. Connect to the internet to see them.');
  expect(await sheet.getByRole('option').count()).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  // An app's page opens offline too, and its editor takes words.
  await page.goto('/write/');
  const area = page.locator('to-write-editor to-text .tx');
  await expect(area).toBeVisible();
  await area.click();
  await page.keyboard.type('Written offline.');
  await expect(area.locator('p')).toHaveText('Written offline.');
  expect(errors).toEqual([]);
});
