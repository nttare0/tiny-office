# R19-template-tap: the templates list does not take the tap that opened it

**Paul, 2026-10-12:** *"Sometimes when I click a template the link to an app underneath opens up."* Reproduced on main at 390 by 844 in WebKit with touch, and at 1100 in Chromium with a mouse: a press on a row's templates button (`.to-templates-btn`, `<to-templates>` in `src/kit/ui/home.ts`) opens the modal `<dialog>` of templates, and the list's first rows land exactly under the finger, where the button was: on the phone the first option, Blank ("An empty outline"), on the desktop a template. A second press at the same spot, at any gap tried (120, 250, 400 and 700 ms), chooses that option: on the phone the app opens blank, which is what Paul sees as the app's link opening. A double tap, a slow tap that the browser delivers after the list has opened, or a finger that presses again because the list seemed slow, all do it.

## The design

- **A press at the spot the list opened under is not a choice, for the first moment.** `<to-templates>` remembers where and when the press that opened it was (the button's `pointerdown` or `click` coordinates and `performance.now()`), and an option takes a press (`pointerdown` through `click`) only if the press is more than 24px (a finger's width) from that spot, or more than 500 ms after the open. Nearer and sooner, the press does nothing: the list stays open, nothing is chosen, nothing closes. A press that began before the list opened (a `pointerdown` the button got and a `pointerup` that lands in the list, as a slow tap on iOS can) is the same case and is caught by the same rule. One rule in `choose`'s path, not a timer that runs on its own and not a change to the dialog's placement.
- **Keys are untouched.** Enter and Space on a focused option choose it at once, as now; the rule is for pointers.
- **The same for the other lists that open under a pointer**, if any: the Insert dialogs, the size menu, a `<to-menu>` opened from a bar button whose items land under the pointer. Check `src/kit/ui/menu.ts` (`hoverFocus`, `menuKey`) and the Insert dialogs for the same shape (a press opens, an item under the same spot chooses) and, where it exists, apply the one rule from one place (a helper in `menu.ts` the templates list and the menus share), or say in the report that no other list lands an item under the opening press.

## Proof

- `test/browser/home.test.ts` or `shell.test.ts`, beside the templates tests: under touch emulation (the file's `cdp()` `Emulation.setTouchEmulationEnabled`, as `test/browser/trip.test.ts` does) at 390 by 844, a tap on a row's templates button and a second tap at the same point 120 ms, 300 ms and 700 ms later: after each, the list is still open, the hash unchanged (no app opened), and no option chosen; a tap 120 ms after opening on an option 40px away chooses it; a second tap at the same spot 600 ms later chooses the option there (the rule has lapsed). With a mouse at 1100 wide, a double click on the button leaves the list open with nothing chosen. Write the first case first and watch it open the app.
- The existing templates tests (`test/browser/home.test.ts`, `shell.test.ts`, `handover.test.ts`, `templates-lazy.test.ts`, `leave.test.ts`) green; `e2e/smoke.spec.ts` and the walks (`test/browser/walks*.test.ts` if present) green; `npx vitest run`, `npm run lint`.

## Not this

- No change to where the dialog opens or how it is drawn, no delay before it opens, no change to keyboard choice. No general click debounce across the kit.
