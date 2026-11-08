import type { Page } from '@playwright/test';

/**
 * The page at rest, for a spec about to measure it: the fonts in, every transition and animation that ends ended, and
 * two frames drawn after them (test/browser/helpers.ts `settled`, in the page). A condition, where a fixed pause hoped
 * for one: under load a pause is too short, and at rest it is time wasted.
 */
export const settled = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await document.fonts.ready;
    for (let i = 0; i < 50; i++) {
      const moving = document.getAnimations().filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity));
      if (!moving.length) break;
      await Promise.all(moving.map((a) => a.finished.catch(() => undefined)));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
