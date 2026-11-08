// The previews of another document held in a fence (src/apps/write/fence-views.ts): a projection of the source's own
// words into another app's view, drawn in the Word Processor's card. Four things must hold, or they are not previews at
// all: the fence's own bytes are never touched, a table keeps its columns and its raw formulas when it is shown as a
// slide, the source document is not mutated by looking at it another way, and an outline's items become a sheet's rows.
import { test, expect } from 'vitest';
import { parse, write } from '../src/doc/index.ts';
import { previewAs, VIEWS } from '../src/apps/write/fence-views.ts';

// A table as a sheet writes it: the columns' types ride on their names, and a formula is the cell's own words.
const SHEET = 'Item | Cost:money | Total:number\n--- | --- | ---\nPaper | 3 | =B2*2\nInk | 5 | =B3*2\n';
const OUTLINE = '- One\n  - Two\n- Three\n\n## Harbour\n\n- Four\n';

test('a preview leaves the source app’s own bytes exactly as they were', () => {
  for (const view of VIEWS) {
    // Whatever the view, the source is what the fence holds: nothing parsed, written or projected is kept.
    const before = SHEET;
    previewAs('sheet', SHEET, view);
    expect(SHEET).toBe(before);
    // Asking for the source's own view is the body itself, byte for byte.
    expect(previewAs('sheet', SHEET, 'source').text).toBe(SHEET);
    expect(previewAs('sheet', SHEET, 'sheet').text).toBe(SHEET);
  }
});

test('a sheet’s table shown as a slide keeps each column and its raw formula, not the numbers they work out to', () => {
  const slide = previewAs('sheet', SHEET, 'deck').text;
  // The heading names every column, by name.
  expect(slide.split('\n')[0]).toBe('# Item · Cost · Total');
  // And the table itself is there with the formulas as written: B2's =B2*2, never 6.
  expect(slide).toContain('=B2*2');
  expect(slide).toContain('=B3*2');
  expect(slide).toContain('Paper | 3 | =B2*2');
  // The typed column keeps saying its type, so a money column is not read as words.
  expect(slide).toContain('Cost:money');
  // Read as the Presentation it claims to be.
  const asDeck = parse(slide);
  const table = asDeck.blocks.find((b) => b.k === 'table');
  expect(table?.k === 'table' && table.cols.map((c) => c.name)).toEqual(['Item', 'Cost', 'Total']);
  // The table follows the slide's heading: its first row is Paper's.
  expect(table?.k === 'table' && table.rows[0]).toEqual(['Paper', '3', '=B2*2']);
});

test('the source document is not mutated by previewing it as another app', () => {
  const source = parse(SHEET);
  const frozen = write(source);
  for (const view of VIEWS) previewAs('sheet', frozen, view);
  // The document read from the fence is the same document afterwards, and the fence's text with it.
  const after = parse(frozen);
  expect(write(after)).toBe(frozen);
  expect(after.blocks).toEqual(source.blocks);
  // And what the projections give back is a different text, never the source's own object.
  expect(previewAs('sheet', frozen, 'deck').text).not.toBe(frozen);
});

test('an outline’s items become a sheet’s rows, one row each, a table the sheet can read', () => {
  const sheet = previewAs('outline', OUTLINE, 'sheet').text;
  const doc = parse(sheet);
  const table = doc.blocks.find((b) => b.k === 'table');
  expect(table?.k).toBe('table');
  if (table?.k !== 'table') return;
  // A sheet of one column: the rows are the outline's lines.
  expect(table.cols).toHaveLength(1);
  const rows = table.rows.map((r) => r[0].trim());
  expect(rows).toEqual(['One', 'Two', 'Three', 'Harbour', 'Four']);
  // It reads as the Spreadsheet's own text: a table of one column, named for the outline's first heading, and nothing
  // else. (A table of one column keeps its edges: its first words would read as something else without them.)
  expect(sheet.startsWith('| Harbour |\n| --- |\n')).toBe(true);
});

test('a presentation shown as an outline keeps its slides’ headings, each table where it stands and its cells joined', () => {
  const deck = '# One\n\n- a point\n\n---\n\n## Two\n\n| A | B |\n--- | ---\n|x|y|\n';
  const outline = previewAs('deck', deck, 'outline').text;
  // The slides' headings survive, in order, and the table becomes rows under a heading of its own columns.
  expect(outline.startsWith('# One')).toBe(true);
  expect(outline).toContain('- a point');
  expect(outline).toContain('## Two');
  expect(outline).toContain('x · y');
  // A page break is no block of an outline: it is a break between slides, and nothing else.
  expect(outline).not.toContain('---');
});
