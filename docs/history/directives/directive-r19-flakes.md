# R19-flakes: a test that passes alone passes under load

On 2026-10-12, with two builders running on the two-core box, `npm run deploy`'s full browser suite failed three runs in a row on different files, each green when rerun alone. A suite that fails only under load is not trusted and gets rerun until it passes, which is no suite at all. Each of these is made deterministic: the test waits for the thing it measures, or the thing it measures stops depending on time.

## The five, as seen

1. `test/browser/complete.test.ts`, ":ca opens the list under the caret": expected the first suggestion to be `car`, got `can`. Find why the order moves: if two icons score the same and the sort is not stable across the load order of the library (`src/kit/icons-search.ts`), make the tie-break explicit (alphabetical, or by the library's own order) and test the tie; if the list was read before the library's chunk settled, wait for it. The directive's standing rule: a finding is a failing test, so first write the test that shows the order moving (a sort over equal scores with shuffled input), then fix the sort.
2. `src/apps/anim/tests/editor.test.ts`, four tests (the rocket drag, K keeps a key, length/speed/repeat, the filmstrip menu): under load an assertion read a length of 0 where 24 frames were expected. Find the wait that is a timeout rather than a condition (`until` on the frames drawn, the filmstrip's rows, the field's value) and make each a condition. No `setTimeout` waits in these tests.
3. `test/browser/label-widths.test.ts`, "ru: every command's words fit their slot": "Эффекты" measured 88px against 82.7 allowed. Under load the Cyrillic face had not loaded when the width was read, so the fallback measured. `await document.fonts.ready` and, for the face the slot's script needs, `document.fonts.load(…)` before any measurement in this file (test/browser/fonts.ts may already have the helper); a test that the measured font-family of the measured element is Plex, failing otherwise with the family it found.
4. `e2e/a11y.spec.ts`, "axe finds nothing in any app, at phone size, light and dark" (phone): `expect(html).toHaveAttribute('data-theme', 'light')` saw no attribute. Find how the spec sets the theme and wait for the attribute to be written by the theme code (the kit's `theme()` applies it at load from the store; the spec may be reading before the module runs), using Playwright's own waiting on the attribute with its timeout, not a fixed sleep.
5. `test/browser/templates-lazy.test.ts`, `templatesOf(write)` expectation under the full suite: **done on main, 2026-10-12** (a load that set out before a forgetting no longer lands in the cache after it; `forgetTemplates()` in `src/kit/home.ts`, and the test resets with it). Check it holds under load with the others; nothing else to do unless it fails.

## The rule going forward

`test/lints.test.ts` gains a lint: no `setTimeout` or `tick(<n>)` with a number over 50ms as a wait in `test/browser/**`, `src/**/tests/**` or `e2e/**` (an allowlist in the test with a reason each for the few that model a real delay, such as the keyboard arriving late). Waits are conditions: `until(() => …)` with a clear sentence when it never comes.

## Proof

- Each of the five, run alone and then run with `npx vitest run` whole while `npm run build` runs in parallel in another shell (load), passes three times out of three; the report says so with the commands.
- The lint in place and green; the allowlist named.

## Not this

- No longer timeouts as the fix, no retries wrapped around a test, no skipping. If a test cannot be made deterministic its behaviour is wrong and that is the finding to report.
