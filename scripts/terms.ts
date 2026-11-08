/**
 * The product's terms: each is said one way in a language (test/i18n-glossary.test.ts holds that), and the worklist a
 * translator or an agent works from (scripts/i18n-extract.ts --work) says each term's word in the language first, so
 * a new message uses it. A term's `words` gives the word where no message says the term alone; `not` the senses of its
 * English that are something else.
 */
import type { Term } from '../test/glossary.ts';

/** The product's terms, and the senses of their English words that are something else. */
export const TERMS: Term[] = [
  { term: 'document' },
  { term: 'link', not: [/quick links/i] },
  { term: 'short link' },
  { term: 'Display Link' },
  { term: 'template' },
  // A rate card, a birthday card, a title card, a flash card and a place card are things in a template, not the card that stands for a document in another.
  { term: 'card', not: [/rate card|birthday card|title card|flash card|place card/i] },
  // "Slide" alone is a transition (the deck's "Slide in"); "Slides" alone is the Presentation Builder's short name.
  { term: 'slide', not: ['Slide', 'Slides'] },
  { term: 'sheet' },
  { term: 'cell' },
  { term: 'row' },
  // A page's columns (a layout of two columns, a left and a right column) are not a table's.
  { term: 'column', not: [/two.columns?|left column|right column|one column/i] },
  { term: 'page' },
  { term: 'bar' },
  { term: 'Share' },
  { term: 'Download' },
  { term: 'Undo' },
  { term: 'Redo' },
  { term: 'Keep' },
  { term: 'Kept' },
  // Paul's four words (2026-10-15): delete, not "take away" or "forget"; save, not "keep"; select, not "choose" or
  // "in hand"; outdent, not "bring out".
  { term: 'Delete' },
  { term: 'select' },
  { term: 'outdent' },
  {
    term: 'save',
    words: {
      ar: 'حفظ',
      bn: 'সংরক্ষণ',
      de: 'speichern',
      es: 'guardar',
      fr: 'enregistrer',
      // The root's two letters: שמירה, לשמור, נשמר.
      he: 'שמ',
      hi: 'सेव',
      ht: 'anrejistre',
      it: 'salva',
      ja: '保存',
      ko: '저장',
      // opslaan, opgeslagen, op te slaan.
      nl: 'sla',
      pl: 'zapis',
      'pt-br': 'salvar',
      ru: 'сохран',
      uk: 'збер',
      ur: 'محفوظ',
      yi: 'היט',
      'zh-hans': '保存',
      'zh-hant': '儲存',
    },
  },
  { term: 'Save in browser' },
  { term: 'password' },
  // The Calculator's keys are keys of a keyboard; an animation's key is a keyframe.
  { term: 'key', not: ['Keys', /arrow keys/i] },
  // "Present" is to show a deck; "a present" is a gift.
  { term: 'Present', not: [/a present\b/i] },
  { term: 'Insert' },
  { term: 'Look' },
  // "Paper" alone is a colour of the looks; "Paper: {paper}" is the size of the paper.
  { term: 'paper', not: ['Paper'] },
  { term: 'Print' },
  // A copy of a document: the noun, where Copy alone is the verb.
  { term: 'Copy', not: [/copy of/i] },
  { term: 'Paste' },
  // The page's theme (light, dark); "the theme" of a document's colours is its look.
  { term: 'Theme', not: [/theme's color|as the theme is/i] },
  { term: 'footnote' },
  // An org chart and a seating chart are diagrams of their own; "to chart" is to draw.
  { term: 'chart', not: [/org chart|seating chart|nothing to chart/i] },
];
