# R19-post-busy: a network's button shows it is working

**Paul, 2026-10-12:** *"Make it look like the button is working."* In the share dialog (`src/kit/ui/share-dialog.ts`, "Post the link"), pressing Bluesky, Mastodon, X or LinkedIn with the preview switch on draws the document's first page as a card, uploads it, and only then opens the link guard (`networkLink`, then `openLink`): on a slow connection that is seconds of nothing, with the button looking untouched. Email needs no card and opens at once. The dialog already shows one piece of work in flight: Make a short link is disabled and says 'Making…' while `busy` is set (`shortDo`). The same idea, for the network buttons.

## The design

- **The pressed button says what it is doing.** From the press until the guard opens (or the toast says the link goes without a preview), the pressed button's words become 'Making the preview…' (one new string, through `t()`, in `src/i18n/en.ts` and the eighteen other languages in each one's own voice, by `npm run i18n:extract` and translation; the ellipsis is the one character, as in 'Making…'), and the button carries `aria-busy="true"`. Its look while busy is the disabled look (`src/styles/kit.css`: the `.to-btn:disabled` rule gains `.to-btn[aria-busy='true']`, one rule, not a second), but the button is not `disabled`: it keeps the focus, so when the guard closes (Cancel) the focus comes back to it as the dialog stack returns focus today. When the work ends the words and the attribute return to what they were.
- **One piece of work at a time.** While a network's card is in flight, a press on any post button (the busy one or another) does nothing: the handler returns. The others do not change their look. Email, and every button with the switch off or for a document with a password (no card is made), behave as now: the guard opens at once and no words change.
- **The state.** A `posting: Service | null` reactive state on the dialog, set in `post` around `networkLink` and cleared in a `finally`, read by `renderPost` for the words and the attribute and by `post` for the ignore. `busy` stays what it is (the short link's). Say in the report why two states rather than one, or make it one if the dialog reads better that way and the Make button and the post buttons never contend.

## Proof

- `test/browser/share.test.ts`, beside the card tests (which stub the card's upload): with the upload held open by the stub, pressing Bluesky makes its words 'Making the preview…' with `aria-busy="true"` while X's words are unchanged; a second press on X during that opens no second guard and starts no second upload (the stub counts calls); when the stub releases, the guard opens for bsky.app, the button's words are 'Bluesky' again with no `aria-busy`; pressing Cancel in the guard returns the focus to the Bluesky button. With the switch off, pressing Bluesky never shows the words (the guard opens with no change to the button). When the upload fails, the toast 'Shared without a preview: …' shows, the button's words return, and the guard opens with the plain link. Email never changes its words.
- `test/browser/agents.test.ts`'s share tests, `e2e/cards.spec.ts` and the i18n check (`npm run i18n:check`) green; `npx vitest run`, `npm run lint`, `npm run build`.

## Not this

- No spinner, no progress bar, no new element: the words and the existing disabled look are the sign. No change to what the card is, how it is uploaded or the guard. No change to Make a short link.
