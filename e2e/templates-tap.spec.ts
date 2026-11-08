/**
 * The templates list takes no press at the spot it opened under for the first moment (Paul, 2026-10-12: "Sometimes when
 * I click a template the link to an app underneath opens up"), on the built site: on the phone (WebKit, 390 by 844) a
 * double tap on a row's templates button, and on the desktop a double click, leave the list open and the home page where
 * it was, where Blank (or a template) lay under the second press and opened the app. The times are test/browser/home.test.ts's.
 */
import { test, expect } from '@playwright/test';

test('a second press where the templates button was chooses nothing', async ({ page }, info) => {
  await page.goto('/');
  const button = page.locator('.to-app[aria-label="Outliner"] .to-templates-btn');
  const box = (await button.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (info.project.name === 'phone') {
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  } else await page.mouse.dblclick(x, y);
  const dialog = page.locator('.to-app[aria-label="Outliner"] dialog.to-templates-dialog');
  await expect(dialog).toHaveJSProperty('open', true);
  // The second press landed on an option: the rule held it, not the press missing the list.
  expect(await page.evaluate(([px, py]) => !!document.elementFromPoint(px, py)?.closest('[role=option]'), [x, y])).toBe(true);
  expect(new URL(page.url()).hash).toBe('');
});
