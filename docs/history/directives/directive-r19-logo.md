# R19-logo: the wordmark on the apps' edge

**Paul, 2026-10-12:** *"On desktop, keep the logo aligned with the list of apps below."* Measured on main (884ed79) at 1440 wide: the header's wordmark (`.to-header .to-brand`, `src/kit/chrome.ts`) starts 20.8px from the window's edge, the gutter; the home page's column (`.to-main`, `src/styles/kit.css`) starts at 38.8px, the gutter plus half of what the window has over the measure (`--to-max-w`, 67.5rem); the apps' icons (`.to-app-open` svg) at 49.2px, the row's own 0.5em inset. So the wordmark hangs 28px left of the icons under it. Under 1100 wide the column's padding is the gutter and only the row's inset remains (10px); at 390 the same 10px.

## The design

- **One inset for the column, named once.** The main column's side padding, `max(var(--to-inset-l), (100% - var(--to-max-w)) / 2 + var(--to-gutter))`, becomes a custom property (`--to-col-inset-l` and `-r`, or one logical pair) set where `.to-main` sets it today, and the header on the home page reads the same property for its inline-start padding. One formula, two readers; no second copy of the arithmetic.
- **The row's inset, named once.** `.to-app-open`'s `padding: 0 0.5em` becomes a token (`--to-row-inset: calc(0.5 * var(--to-scale))`, in `src/styles/tokens.css` beside its kin) that the row's padding and the wordmark's inline-start margin both read, so the wordmark's first letter stands on the icon's edge, not on the row's hover box.
- **Only the home page's header.** The header holding the wordmark (the home page: `.to-header` whose child is `.to-brand`; a class on the header or `:has(> .to-brand)`, whichever the kit's chrome already distinguishes) takes the column's inset; a document's header keeps the gutter, since an editor's column (`.to-wide`) is at the gutter already and its title aligns with it today.
- **Every width, one rule.** Paul asked for desktop; the rule aligns at every width, since the row's inset is the same relationship at 390. At 390 the wordmark keeps its `min(…, 7vw)` size and the header stays one row high beside the menu button: measure it (the test below). If at 390 the wordmark and the menu button cannot share the row at that size, the rule stays and the wordmark's size rule shrinks it, as it does now for narrow screens; say so in the report with the numbers.
- **Right to left.** Inline-start, not left: in Arabic or Urdu the wordmark's right edge stands on the icons' right edge.

## Proof

- `test/browser/home.test.ts` (beside the kept documents' alignment test, which measures the same icon): at 1440, 1100, 900 and 390 wide, and at 1440 in Arabic, the wordmark's text edge (a Range over the text node of `.to-brand`, its `left`, or `right` under rtl) equals the first app row's icon's edge within a pixel; at 390 the header's height equals `--to-header-h` (one row). The test fails on main today at 1440 by 28px and at 390 by 10px: write it first and watch it fail.
- The chrome tests (`test/browser/chrome.test.ts`) still green; `npx vitest run`, `npm run build`.

## Not this

- No change to the wordmark's face, size or vertical placement (Paul, 2026-10-10: vertically centred on the header's bottom line). No change to a document page's header. No change to the rows.
