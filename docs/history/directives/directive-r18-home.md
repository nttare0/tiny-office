# R18-home: the home page's documents, and three things the menu loses

**Paul, 2026-10-12**, on the live v1, verbatim:

> Get rid of "search your documents" if there are no documents or we are in private mode. Get rid of open a file and compare and zip download. The preview documents are supposed to be aligned with the app names and icons. They're indented very much to the right.

## The design

- **The search over the documents** (`src/kit/home.ts`, the `to-search` box above the apps) is there only when Save in browser is on and at least one document is kept (`keeping() && library().length`). Under Private there is nothing to search, so nothing says so. (The earlier bug that stashed the list in memory under Private is fixed on main: v1.0.2 and v1.0.3; this makes the rule explicit and tested.)
- **The kept documents under an app align with the app.** The rows (`.to-drive`, `.to-drive-open`, `.to-drive-more` in `src/styles/kit.css`) carry a left inset of 2.375em and the row its own 0.5em, so a preview sits far right of the icon above it. The preview's left edge sits on the app icon's left edge, and the document's words start where the app's name starts (the icon's width plus the row's gap: measure both from the app row, in a test, at 390 and 1100 wide and right-to-left). The "more" button aligns with the previews. Nothing else about the rows changes.
- **Open a file…, Compare… and Download everything go** from the menu (`src/kit/drawer.ts`: the `to-drawer-files` section, `compareHref`, the `.to-open-input`; the zip of every kept document in `src/kit/privacy.ts` `everything()` and its button wherever it is drawn). Opening a file by drag and drop or by paste stays if it exists apart from the button; `kit/open.ts` stays only if something still reaches it (the sweep in round nineteen takes what nothing uses; say in the report what is left). `<to-compare>` and `kit/compare.ts` and `kit/diff.ts` stay for the API's `compare` and the CLI's `diff`; the drawer's link to them goes. The strings and their translations go with the buttons; `npm run i18n:extract`.

## Proof

- `test/browser/home.test.ts`: no search box under Private with documents in memory; none when Saved with none kept; the box once one is kept. The alignment test at 390, 1100 and in Arabic: the preview's edge equals the icon's edge within a pixel, the words' edge equals the name's edge.
- `test/browser/drawer.test.ts`: no Open, Compare or Download everything button; the tests that used them are rewritten or removed with a sentence saying why.
- `npx vitest run`, `npm run build`.

## Not this

- No change to the drawer's order or words beyond these three buttons (that is r18-drawer). No change to what Saved keeps.
