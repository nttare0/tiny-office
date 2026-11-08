/**
 * The Animator on a phone (WebKit, 390 by 844, a finger): Paul, 2026-10-11, "the interface is all over the place with
 * lots of white space". The stage first, the filmstrip right under it and the scrubber under that, all on the first
 * screen without scrolling; no word cut anywhere; Draw and Move one control in the row above the bar, the mode's hint
 * in full beside it; the length, the speed and the repeat behind Settings in the bar. Run on its own:
 *
 *   PW_PORT=4317 npx playwright test e2e/anim-phone.spec.ts --project phone --workers=1
 */
import { test, expect, type Page } from '@playwright/test';
import { encodeDoc } from '../src/kit/core/codec.ts';
import { settled } from './settled.ts';

const SHAPES = 'Kind | X | Y | W | H | Style | Label\n--- | --- | --- | --- | --- | --- | ---\nt | 4 | 20 | 20 | 4 | 04 | Lift off\ni | 8 | 36 | 8 | 8 | 0b | rocket\n';
const LIFT = '---\ntitle: Lift off\nframes: 24\nfps: 8\n---\n' + SHAPES + '\nShape | Keys\n--- | ---\n0 | 0,0,0,0,1,0; 23,0,-80,0,1,0,i\n1 | 0,0,0,0,1,0; 23,200,-200,80,1,-30,d\n';

const value = (page: Page) => page.evaluate(() => (document.querySelector('to-anim-editor') as HTMLElement & { value: string }).value);
/** Every element with words of its own in the editor and its bar whose words are wider (or taller) than its box. */
const cut = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('to-anim-editor *')]
      .filter((el) => el.offsetWidth > 0 && !el.closest('svg') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => `${el.className || el.tagName}: ${el.textContent!.trim()}`),
  );

test('the Animator on a phone: stage, filmstrip and scrubber on the first screen; nothing cut; Draw/Move in the row above the bar; the settings behind one button', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/#/v1/anim/${encodeDoc(LIFT)}`);
  const stage = page.locator('svg.anim-stage');
  await expect(stage).toBeVisible();
  // A finger on the stage: the bar comes with the focus.
  await stage.tap({ position: { x: 4, y: 4 } });
  const bar = page.locator('to-anim-editor to-bar');
  await expect(bar).toBeVisible();
  await settled(page);

  // The stage, the filmstrip and the scrubber, in that order, on the first screen, above the mode's row and the bar.
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
  const [s, strip, scrub, row, b] = [await box('.anim-wrap'), await box('.anim-strip'), await box('.anim-scrub'), await box('.anim-row'), await box('to-anim-editor to-bar')];
  expect(await page.evaluate(() => document.querySelector('.to-main')!.scrollTop)).toBe(0);
  expect(strip.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
  expect(strip.y - (s.y + s.height)).toBeLessThan(16);
  expect(scrub.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
  expect(scrub.y + scrub.height).toBeLessThanOrEqual(row.y + 1);
  expect(row.y + row.height).toBeLessThanOrEqual(b.y + 1);
  // The stage is the column's width less the gutter: no gray frame round it.
  expect(s.width).toBeGreaterThan(390 - 40);
  expect(await page.locator('.anim-wrap').evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  // Every frame is in the strip with its number; the one in hand is marked.
  await expect(page.locator('.anim-strip .anim-frame')).toHaveCount(24);
  await expect(page.locator('.anim-strip .anim-frame[aria-pressed=true]')).toHaveCount(1);
  // The time is at the scrubber's end: where it is of the whole length.
  await expect(page.locator('.anim-scrub .anim-clock')).toHaveText('0.0 s of 3.0 s');

  // No words cut: not by their box; and the bar's whole row on the screen, none of it under the pinned Undo (on a phone
  // the effects, which act on a chosen shape, are beside its sliders: the shape's own row covers the bar while one is chosen).
  expect(await cut(page)).toEqual([]);
  const pin = await box('to-anim-editor to-bar .to-pin');
  for (const b of await page.locator('to-anim-editor to-bar > :not(.to-pin)').all()) {
    const r = (await b.boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(pin.x);
  }
  await expect(page.locator('.anim-row .anim-hint')).toHaveText('Tap a shape, then drag it to where it goes.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/anim-phone.png` });

  // A shape chosen: its row of actions covers the bar, the mode's row stays above it, and the effects are beside its sliders.
  await stage.locator('g.hit[data-idx="1"] > rect').tap();
  await expect(page.locator('to-context.anim-context .to-context')).toBeVisible();
  await expect(page.locator('.anim-row .anim-hint')).toHaveText('Drag it to where it goes at 0.0 s.');
  await settled(page);
  const ctx = (await page.locator('to-context.anim-context .to-context').boundingBox())!;
  const row2 = (await page.locator('.anim-row').boundingBox())!;
  expect(row2.y + row2.height).toBeLessThanOrEqual(ctx.y + 1);
  await expect(page.locator('.anim-props .anim-fx > button')).toBeVisible();
  expect(await cut(page)).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/anim-phone-chosen.png` });
  await stage.tap({ position: { x: 4, y: 4 } });
  await expect(page.locator('to-context.anim-context .to-context')).toBeHidden();

  // Draw and Move: one control in the row; Draw is Draw's editor, and the row stays for the way back.
  const draw = page.locator('.anim-row .anim-modes button', { hasText: 'Draw' });
  const move = page.locator('.anim-row .anim-modes button', { hasText: 'Move' });
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  await draw.tap();
  await expect(page.locator('to-anim-editor to-draw-editor')).toBeVisible();
  await expect(draw).toHaveAttribute('aria-pressed', 'true');
  expect(await cut(page)).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/anim-phone-draw.png` });
  await move.tap();
  await expect(stage).toBeVisible();
  await expect(move).toHaveAttribute('aria-pressed', 'true');

  // The settings: one button in the bar, a small sheet with the three fields and the length under them.
  await stage.tap({ position: { x: 4, y: 4 } });
  await page.locator('to-anim-editor to-bar button[aria-label="Settings"]').tap();
  const sheet = page.locator('dialog.to-dialog[open]');
  await expect(sheet).toBeVisible();
  const fps = sheet.getByRole('spinbutton', { name: 'Frames per second' });
  await expect(fps).toHaveValue('8');
  await fps.fill('12');
  await page.keyboard.press('Enter');
  await expect(sheet.locator('.anim-secs')).toHaveText('2.0 s');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/anim-phone-settings.png` });
  await expect.poll(() => value(page)).toMatch(/^---\ntitle: Lift off\nframes: 24\nfps: 12\n---\n/);
  const sb = (await sheet.boundingBox())!;
  expect(sb.x).toBeGreaterThanOrEqual(0);
  expect(sb.x + sb.width).toBeLessThanOrEqual(390);
  await sheet.getByRole('button', { name: 'Close' }).tap();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.anim-scrub .anim-clock')).toHaveText('0.0 s of 2.0 s');

  expect(errors).toEqual([]);
});
