# Translation

Tiny Little Office speaks twenty-one languages: English, Arabic, Bengali, Chinese (Simplified and Traditional),
Dutch, French, German, Haitian Creole, Hebrew, Hindi, Italian, Japanese, Korean, Polish, Portuguese (Brazil),
Russian, Spanish, Ukrainian, Urdu and Yiddish. Arabic, Hebrew, Urdu and Yiddish run right to left. The aim is not a translated English site but one
that reads as if it were written in each: its words, its numbers and dates, its direction and its type. The first
plan for this, before it was built, is [history/translation-plan.md](history/translation-plan.md).

## Strings

- Every string a person sees goes through `t('id')` (`src/kit/core/i18n.ts`), read from [Fluent](https://projectfluent.org)
  files by `@fluent/bundle` (Paul, 2026-10-15: "Use Fluent"). A message has a stable id, kebab-case: where it is used (an
  app, a part of the kit, or `common-` where several use it) and its first words (`shell-copy-link-and-go`,
  `sheet-row-above`, `common-delete`). A change of wording keeps the id, and a new meaning is a new id. `src/i18n/en.ftl` is the source of every message, in groups
  (`## the Spreadsheet`), edited by hand, with a comment above any message whose meaning is not plain ("a verb on a
  button", "a noun"). A command's words in a command file (`label: 'bar-bold'`) are ids too, put through `t()` when
  drawn.
- A placeable is `{ $name }`. A plural is a select on its number, with a variant for each of the language's plural
  categories and `*[other]` the default; `{ $n }` writes the number as the language does:

  ```ftl
  example-n-slides = { $n ->
          [one] one slide
         *[other] { $n } slides
      }
  ```

  Arabic has six categories (zero, one, two, few, many, other), Russian, Ukrainian and Polish four, Hebrew three,
  Chinese, Japanese and Korean one; a variant for an exact number (`[0]`) may stand beside them.
- A language is one file, `src/i18n/<code>.ftl`, the same ids and groups as en.ftl, loaded only when it is used.
  English is a language like the others, and ships in the app file. A message a language lacks is said in English.
  A file's head (`###`) says, in that language, the voice it keeps: the form of address (French `vous`, Spanish `tú`,
  Russian `вы`, Hindi `आप`, Urdu `آپ`, Yiddish `איר`, Hebrew addressing nobody as a man or a woman), its quotation
  marks and spacing, and how buttons are worded.
- Three comment lines above a message are the checks' marks, never shipped (a build strips every comment from a
  language's file: `scripts/ftl-plugin.ts`):
  - `# en: <sha1>`: on every message of a language but English, the SHA-1 of the English (en.ftl's message, on one
    line as `scripts/ftl.ts` reads it) it was translated from. A change of English keeps the id, so this is what says a
    translation is behind: `npm run i18n:check` names every message whose English has changed since, and
    `npm run i18n:gaps -- <code>` offers each again. Once a message is translated again,
    `node scripts/i18n-extract.ts --rehash <code> <id>…` records the English it now follows.
  - `# same`: the message stays as its English (a name, a loanword: "Apps", "CSV"), a decision per language and per
    message; a message the same as its English without it fails the check, and so does one marked and translated.
  - `# draft from <id>`: words nobody has read yet, which the check fails while the mark is in: an old translation
    the memory offered for a new id (`<id>` the old one), a translation whose English changed (`<id>` its own, with
    the English it followed and the English now), or, in en.ftl, an id the code asked for whose English is not
    written (`# draft from the code`). Read it, make it right, take the line off.
- A message added to en.ftl is translated into all twenty other files in the same change, and so is one whose English
  changes. `npm run i18n:extract` lands an id the code uses and en.ftl lacks at the end of en.ftl, under a
  `## New — sort me into a section` group, marked `# draft from the code` until its English is written and it is
  placed. `npm run i18n:gaps -- <code>` prints, ready to paste with their `# en:` lines, every message a language
  lacks, in English, with a variant for each of that language's plural categories, offering an old translation as a
  draft where an id was replaced by a new one whose English is alike; and then every message whose English changed.
  `npm run i18n:check` fails on an id the code uses that en.ftl lacks, a file Fluent cannot read, a placeable that
  does not match, a plural without the language's categories, a draft or a sort-me group left in, a message the same
  as its English and not marked `# same`, a translation without `# en:` or behind its English, or a language missing
  a message; it warns of an id nothing uses.
- The English is American (Paul, 2026-10-11): color, center, organize, favorite, gray, license, ZIP code, cell
  phone, and the Letter paper that is the default. `test/american.test.ts` holds en.ftl and every template to a
  list of British spellings and words (`test/british.ts`); the README and the docs are held to the same list.
- Templates and their sample content are English, written in each app's `templates.ts`, set in New York where
  they are set anywhere, and not under `t()`.

## Checks

- **The glossary** (`test/i18n-glossary.test.ts`, `test/glossary.ts`): each product term (the app names, Share,
  Save in browser, link, short link, Display Link, template, slide…) is said one way in each language. A term
  with two words for it, or a short label that says it another way, fails, naming the term and the ids. Words
  are matched by stem in Latin and Cyrillic, Hindi and Bengali (counted in letters as a reader sees them), by the
  first syllable block or two in Korean (a particle comes off), by a pair of characters in Chinese and Japanese,
  and by root in Arabic; Urdu by root or by stem; Hebrew and Yiddish by stem, which a prefix (ה, ל, ב) does
  not hide.
- **The room each label has** (`test/browser/label-widths.test.ts`): every command's words, in every language,
  measured in the font they are drawn in against the room their place gives them (a bar button, a menu row at
  390 pixels, a dialog's button). A label that does not fit is shortened in that language.
- **Every language drawn** (`test/browser/i18n-switch.test.ts`, `test/browser/languages.test.ts`): each opens,
  takes its direction, keeps the bar to one row, and lays the menu out at a phone's width.
- **Widths for the drawn pages** (`test/browser/metrics.test.ts`): `kit/draw/draw.ts`'s `textWidth`, which wraps
  words on the SVG pages, has a width per script (Latin, Cyrillic, Arabic, Devanagari, Bengali, Hangul, Han and
  kana; Hebrew's letters take the Latin width, which Plex Sans Hebrew meets), held within a tenth of the browser's own.

## Translating in bulk

Nobody holds twenty-one files in their head (Paul, 2026-10-15). The loop is three commands, and the files are
never read by hand:

1. `npm run i18n:work -- fr de` (every language, with no code) prints a worklist as JSON: for each language, the
   register its file's head says it is written in, its translator's notes from this page, its word for each
   product term, and the messages to do, each with its English, en.ftl's comment on it, its group, the old
   translation and the old English where the English moved, and the plural forms the language has. That is the
   whole context a translator, or an agent, needs.
2. The translations are written as JSON, `{ "fr": { "<id>": "<words>" } }`, the words in the one-line form the
   worklist shows the English in (`{n|une diapositive|# diapositives}` for a plural); `{ "text": "…", "same": true }`
   where the words stay as the English on purpose.
3. `npm run i18n:apply -- work.json` writes them into the files in place, each with its `# en:` hash and no draft
   mark, a new message where en.ftl's order puts it. A file that would fail the check is not written, and the
   errors are named. `npm run i18n:check` then confirms the tree.

## Choosing a language

The browser's language chooses the nearest one: each code is matched as itself (`ru-RU` finds `ru`), and a
Chinese tag finds its script through `Intl.Locale(…).maximize()` (`zh-TW`, `zh-HK`, `zh-MO` and `zh-Hant-*` are
Traditional; `zh-CN`, `zh-SG`, `zh-Hans-*` and `zh` alone are Simplified). The menu's Language list names each
language in itself (Русский, Kreyòl ayisyen, 繁體中文), English first and then by script, so a reader finds
theirs among their own.

A language chosen in the menu goes into the link, as `?lang=ht` after the document (`#/?lang=ht` on the home
page), so every link the page makes from then on opens in it: the editing link, the Display Link, a deck's show
link, the QR code. Choosing the browser's language takes it out. Nothing is written to the device for the
language, Save in browser on or off (Paul, 2026-10-11: "Why are we writing language at all instead of encoding the
parameter in the link?"). The API's `link(app, text, { lang })` and the command line's `--lang` make a link that
opens in a language.

`Intl` does the rest: `PluralRules` chooses the plural form, `NumberFormat` writes numbers, `DateTimeFormat`
and `RelativeTimeFormat` write dates, `DisplayNames` names the languages, and `Locale` says the direction, which
goes on the page's root as `dir` with `lang`.

## Type

The type is IBM Plex, served by the site (`public/fonts/`, `src/styles/fonts.css`): Plex Sans for Latin, Greek
and Cyrillic, Plex Sans Arabic for Arabic, Plex Sans Hebrew for Hebrew and Yiddish (its points among them) and Plex
Sans Devanagari for Hindi, each face loaded only when a page's words need it. IBM makes no Hebrew Serif or Mono, so
the Serif and Typewriter looks set Hebrew and Yiddish in the device's own type, as they do Arabic. Bengali, Korean, Japanese and Chinese are drawn in the device's own type. Urdu is set in Nastaliq,
the device's own (Noto Nastaliq Urdu on iPhone and Android, Urdu Typesetting on Windows), with Naskh after it,
since Urdu's readers read Nastaliq and Naskh reads to them as a foreign typesetting; Nastaliq is taller, so Urdu's
lines are given more leading.

## For a translator

Each language is written for the people who use it, in the words they use on their phones, not for a textbook.
Most of the second nine (Russian, Ukrainian, Polish, Bengali, Hindi, Urdu, Haitian Creole, Korean and Traditional
Chinese) are New York City's designated citywide languages, written for those communities in the city; Hebrew and
Yiddish (2026-10-12) are two more of the city's own.

- **Russian:** `вы`; the infinitive on buttons and menus (Копировать, Поделиться). Long: check the bar and the
  menus at 390 pixels.
- **Ukrainian:** its own translation from the English, never an adaptation of the Russian file: its own words
  (посилання), the 2019 orthography, `ви`.
- **Polish:** four plural forms, *many* for 5 to 21 and 25 to 31 alike; the infinitive or the imperative on
  buttons as Polish office suites do (Kopiuj, Udostępnij), consistently.
- **Bengali:** standard Bangla as the city's Bangladeshi community writes it; Bengali digits in counts, as Intl
  writes them.
- **Hindi:** the everyday Hindi of the interfaces people use (लिंक, फ़ाइल, टेम्पलेट where those are the words),
  not a Sanskritized register; `आप`; Western digits.
- **Urdu:** right to left; `آپ`; Western digits; set in Nastaliq (above).
- **Haitian Creole:** the official orthography of 1979 (Kreyòl, *-syon*, *k*, `ou`, `yo`), no French spellings.
  Intl has no Kreyòl, so the kit writes a date's month and weekday itself (`kit/core/dates.ts`: janvye, fevriye…,
  dimanch, lendi…), laid out day, month, year.
- **Korean:** `합니다`-style polite forms on buttons and messages; a counter where Korean uses one (파일 3개).
- **Hebrew:** the Hebrew of the city's Israeli and Hebrew-speaking New Yorkers, as Israeli software writes it: a
  button is a verbal noun (הורדה, שיתוף, העתקת קישור) or an infinitive (לשכוח), a sentence asks with "יש ל…" or
  "אפשר ל…", and nobody is addressed as a man or a woman. Three plural forms: one, two (יומיים) and other.
- **Yiddish:** the Yiddish of the Hasidic communities of Williamsburg, Borough Park, Crown Heights and Kiryas Joel,
  in their spelling rather than YIVO's: no vowel points (א, יי, פ where YIVO writes אַ, ײַ, פֿ), נישט, the
  Hebrew-origin words as always written, and the English loanwords of computing (לינק, פאסווארד, דאונלאודן). Buttons
  are infinitives; sentences say `איר`, as the community's papers address a stranger. Chromium's Intl has no Yiddish
  of its own: it names the language in English (the kit names it ייִדיש itself), and the kit writes a date's month
  and weekday itself, in the community's spelling (`kit/core/dates.ts`: יאנואר, פעברואר…, זונטאג, מאנטאג…, שבת);
  in every browser (WebKit's own Yiddish would spell them YIVO's way). The plural rules (one, other) are the same in both.
- **Traditional Chinese:** its own translation for the Hong Kong and Taiwan usage of the city's communities,
  never a character conversion of the Simplified file (檔案, 連結, 範本, 投影片, 試算表), with full-width
  punctuation and 「」 for quotes.
