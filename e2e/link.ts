import type { Page } from '@playwright/test';

/**
 * The page's address with the document as it is now: the shell's flush (kit/core/shell.ts flushLink), then the URL.
 * The shell writes the link only when typing stops for fifteen seconds, and at once whenever anything reads it, so a spec
 * reads it here (test/browser/helpers.ts `link`, in the page), never by waiting the pause out.
 */
export const link = (page: Page): Promise<string> =>
  page.evaluate(() => {
    document.querySelector<HTMLElement & { flushLink?: () => void }>('to-shell')?.flushLink?.();
    return location.href;
  });
