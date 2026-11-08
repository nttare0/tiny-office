# R18-caret-middle: the caret stays in the middle while you type

**Paul, 2026-10-12:** *"We want to put enough padding at the end of a document we are editing that the cursor stays roughly in the middle of the screen unless we scroll."* Today the caret is kept merely visible (`src/kit/scroll.ts` `revealCaret`: brought inside what can be seen, with an 8px margin), so typing at the end of a document happens at the bottom edge of the screen, or just above a phone's keyboard, with no room below. A typewriter keeps the line you are on at the middle; so does this.

## The design

- **Room below the last line.** While a document is being edited (`<to-chrome>` `editing`, the apps whose document is a column of words: the Word Processor, the Outliner, the Presentation Builder's slide text, the Spreadsheet's and Calculator's rows, the Calendar's and Trip Planner's lists; not the spatial canvases, which fill their box, and not a Display Link), the column `.to-main` has a bottom padding of half of what can be seen of it: `padding-bottom: calc(var(--to-seen-h) / 2)`, where `--to-seen-h` is the height of the visible window above a phone's keyboard, set on `<to-chrome>` by `kit/chrome.ts` from `visualViewport` (it already tracks it for gliding) and from `innerHeight` elsewhere. So the last line can sit at the middle with blank below it, and no further: the padding is the room, not a scroll.
- **Typing keeps the caret at the middle.** After an edit (`src/kit/text.ts` where it calls `revealCaret` after input, and the rows' and fields' equivalents), the caret is revealed with `{ middle: true }`: if its rect is below the middle of what can be seen of the column, the column scrolls so the caret's line sits at the middle; if it is above the middle it is only kept visible, as now. One rule in `revealCaret(box, opts)`, `reveal` gaining `block: 'middle'` beside its 'nearest'. Moving the caret without editing (a click, the arrow keys, Find) keeps it visible as now and never recenters: the person's own scroll is never undone, which is the "unless we scroll".
- **A phone.** The middle is the middle of what is seen above the keyboard; r18-outline-caret's rule for the keyboard is the one this builds on (this task runs after it merged). Gliding (the column moving for the keyboard) still defers the reveal until it settles.
- **Not a scroll on open.** Opening a document does not move it: the caret's first reveal is the existing one. The padding is there from the start, so the document's end can be scrolled up to the middle by hand.

## Proof

- `test/scroll.test.ts`: `reveal` with `block: 'middle'` moves a target below the middle to the middle and leaves one above the middle where it is when visible.
- `test/browser/text.test.ts` (or a new `caret-middle.test.ts`): a Word Processor document typed to the end in a 390 by 600 column: after each Enter and a line of words, the caret's rect center is within one line of the column's visible middle; after the person scrolls the column up by 200px and presses the right arrow, no scroll happens; typing then brings the caret back to the middle only if it was below it. The column's `padding-bottom` equals half its visible height in an edited text and 0 in a Drawing and a Display Link. With the keyboard model of `test/browser/helpers.ts` (the visual viewport at 508px), the middle is of 508 minus the bar.
- The e2e keyboard spec and the Outliner caret test from r18-outline-caret still green.

## Not this

- No change to scrolling on open, to Find, or to the spatial apps. No smooth scrolling added where there is none.
