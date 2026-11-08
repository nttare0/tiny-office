# R19-roundtrip: a lenient text and its canonical writing read as the same document

CI on main (2026-10-12, run 38288524206) failed `test/doc/properties.test.ts`, "property: a lenient text and its canonical writing read as the same document", on this text, found by the property's random search:

```
###### ^[ ]

# [\ ](https://x.y/)
```

`parse(write(parse(x)))` is not `parse(x)`: a sixth-level heading whose only words are a footnote holding one space, then a heading whose link's text is an escaped space. The kernel's rule (docs/tlo.md, "read leniently, write canonically") is that whatever is read, written and read again is the same document; this text breaks it somewhere in the footnote's or the link's writing of a lone space (`src/doc/` and `src/kit/text/`: the rich-text writer, `notesOf`/`markNotes` for the footnote, the link's text escaping). Paul's rule stands (2026-10-10): a typed space is never dropped by the link or paste.

## The work

- Find which of the two (the footnote of one space, the link text of one escaped space, or both) does not survive, and why: say it in the report with the three documents (parsed, written, reparsed) as JSON.
- Fix the writer or the reader so the round trip holds, in the one place that owns the rule (never a special case in the test). A lone space inside a footnote or a link's text is written so that it reads back as that space; if the format cannot carry it, the canonical writing says what it becomes and the reader reads the lenient form to the same.
- Add the text as a fixed example to the round-trip tests beside the property (the file that holds `parse(write(parse(x)))` examples), with the property's seed if the harness takes one, so it is checked every run and not only when the search happens on it.
- Then run the property test with a larger number of runs than its default (its harness's option; say which) three times, and report any other text it finds; fix those the same way if they are the same rule, else list them.

## Proof

- The fixed example and the property green; `npx vitest run test/doc/` whole; `npm run lint`; `npm run build`. The e2e smoke on the built site.

## Not this

- No change to what the format means; no loosening of the property; no skipping of the case.
