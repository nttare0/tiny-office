# R20-code-mark: backticks are code, in every app

**Paul, 2026-10-13:** *"Shouldn't we parse backticks into monospace in the deck?"* Today the kernel reads a backtick span as plain words (`docs/kernel.md` §inline: "backtick spans read as plain words"; `parseInline` in `src/doc/tlo.ts` drops the backticks and keeps what was between them), so `npx tinylittleoffice link` on a slide is set in the same face as the sentence around it, and the backticks are gone when it is written back. Markdown's code span becomes a mark of the kernel, read, written, drawn, edited and exported like bold is.

## The design

- **The mark.** `Run` in `src/doc/model.ts` gains `c?: true` (code). `parseInline` reads a single-backtick span as one run with `c` and its words verbatim (no mark is read inside it, no escape but the span's end; a backtick with no closing backtick stays a backtick); `writeInline` writes a `c` run between backticks, and a literal backtick in plain words escaped as now. The round trip holds: `writeInline(parseInline(s)) === s` for canonical `s`, the corpus test over every template and example. A `c` run may also be bold, italic, a link: the marks compose as they do (`**`code`**` is bold code). The JSON schema (`packages/doc/schema/tlo.schema.json`) and `toJson`/`fromJson` carry `c`. `docs/kernel.md` §inline and `docs/tlo.md` say so.
- **The editor.** `<to-text>` (`src/kit/text/text-view.ts`) draws a `c` run as `<code>`, in Plex Mono (`--to-font-mono`, the rule beside the kit's other `code`), the size of the words around it; the clipboard reads `<code>` from pasted HTML as `c` and writes it. A command `text.code`, 'Code', with the key **Mod+E**, toggles it on the selection or for what is typed next, exactly as bold does (`src/kit/text/text-commands.ts`); it joins the bar and the selection bubble after Highlight, with the `code` icon, and `docs/editing.md`'s marks table (Mod+B/I/U, Mod+Shift+X, Mod+Shift+H, then Mod+E). The strings through `t()` in every language (`npm run i18n:extract`, each language's own word for code).
- **Drawn.** Every view that draws runs draws `c` in the monospace face: the deck's `line()` in `src/apps/deck/view.ts` sets `font-family` to the mono stack on a `c` tspan, and `spanWidth` measures it at 0.6em a character (Plex Mono's advance), so the fit and the measures are honest; the Word Processor, the Outliner, the Spreadsheet and Calculator, the Calendar, the Trip Planner wherever they draw runs (HTML: `<code>`; SVG: the face). `src/kit/draw/draw.ts` gains the mono width beside `textWidth`.
- **Exported.** Markdown and TLO by `write`; HTML as `<code>`; the deck's PowerPoint (`src/apps/deck/pptx.ts`) with the run's font set to a monospace face (`Courier New`, the face every PowerPoint has; say so in the report); the Word Processor's `.docx` with `w:rFonts` to the same; the text PDF (`src/kit/file/textpdf.ts`) in the mono face if the PDF embeds one, else in the sans with the report saying so (a finding, not a fix: embedding a face is its own task).
- **The guide.** `public/llms.txt`'s marks sentence, `docs/tlo.md`, the skill (`npm run skill`), and the deck page `public/llms/deck.txt` name backticks as code. The agent examples do not change unless a shape needs one.

## Proof

- `test/doc/*` (node): `parseInline('run `npx tlo` now')` gives three runs, the middle one `c`, and writes back to the same bytes; a backtick alone stays; `**`x`**` is bold code; the corpus round trip green.
- `test/browser/text.test.ts`: Mod+E on selected words marks them, `<code>` is drawn in the mono face (computed `font-family` contains Mono), Mod+E again unmarks; typed after a collapsed Mod+E the next words are code; the bubble and the bar show Code.
- `src/apps/deck/tests/view.unit.test.ts`: a slide whose bullet holds a code span draws a tspan in the mono face and measures it wider than the same words in the sans; `measureDeck` reflects it.
- An export test each for pptx and docx reading the face back from the zipped XML.
- `npm run lint` (the i18n check included), `npx vitest run`, `npm run build`.

## Not this

- No code blocks: a fence stays what it is (a document inside a document, or plain text). No syntax colouring. No double-backtick form.
