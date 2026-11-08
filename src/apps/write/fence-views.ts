/**
 * How another document held in a fence can be *previewed* as another app, in the Word Processor's card
 * (src/apps/write/editor.ts): an Outliner's outline as a Spreadsheet's rows, a Spreadsheet's table as a Presentation's
 * slide, a Presentation's blocks as an outline, words as one column of a sheet.
 *
 * These are pure projections — the fence's own language and body are never touched (nothing here writes to them), and
 * the app they name is the one that stays authoritative. That is the whole point: switching the preview must not mutate
 * the document, must not reach the network, and must not pretend to be a second editor. Choosing a view is temporary: it
 * is not serialized into the link, into the saved document, or into anything that leaves this card.
 *
 * Each projection is parsed from the source's own text (a fence's body is the source app's document, verbatim), built as
 * blocks of the target app, and written by the kernel's own writer, so what a preview shows is the source's own words —
 * raw formulas and typed columns included — in the canonical text of the app it is shown as.
 */
import { parse, plainText, write, type Block, type Doc } from '../../doc/index.ts';

/** The three apps a fence can be previewed as. */
export const VIEWS = ['outline', 'sheet', 'deck'] as const;
export type ViewId = (typeof VIEWS)[number];
/** A view that is chosen: one of the three, or the source's own app (its body, untouched). */
export type FenceView = ViewId | 'source';

/** Why a projection is not the whole of the source ('' when it is). */
export type Note = '' | 'simplified' | 'formulas' | 'unread';

/** What a preview is drawn from: the projected document, as the target app's text, and what to say about it. */
export interface Projection {
  /** The projected document, as the target app's text (never the fence's own text). */
  text: string;
  note: Note;
}

/** A block's own words, as one line: its runs as text, a table's column names, a fence's first line. */
function lineOf(b: Block): string {
  switch (b.k) {
    case 'h':
    case 'p':
    case 'li':
    case 'quote':
      return plainText(b.runs).replace(/\s+/g, ' ').trim();
    case 'table':
      return b.cols
        .map((c) => c.name)
        .join(' · ')
        .trim();
    case 'fence':
      return (
        b.body
          .split('\n')
          .find((l) => l.trim())
          ?.trim() ?? ''
      );
    default:
      return '';
  }
}

/** The depth of a block in an outline: an item's depth, a heading's level. */
function depthOf(b: Block): number {
  if (b.k === 'li') return b.depth ?? 0;
  if (b.k === 'h') return Math.max(0, (b.level ?? 1) - 1);
  return 0;
}

/** Whether a block is part of an outline's shape at all: headings, items and their words. */
const inOutline = (b: Block) => b.k === 'h' || b.k === 'li' || b.k === 'p' || b.k === 'quote';

/**
 * A fence's document previewed as another app. `source` is the app the fence names; `body` its text as it stands.
 *
 * Never throws for words it cannot read: what it cannot project, it leaves to the source app and says so, and a body it
 * cannot parse is the source's own text unchanged. Nothing here writes to a document, fetches anything or serializes.
 */
export function previewAs(source: string, body: string, view: FenceView): Projection {
  if (view === 'source' || view === source) return { text: body, note: '' };
  let doc: Doc;
  try {
    doc = parse(body);
  } catch {
    return { text: body, note: 'unread' };
  }
  // What a projection cannot carry: a table read as an outline loses nothing, but an outline read as a sheet keeps its
  // words and not its marks, and a fence of another app is a line of words at best.
  const table = doc.blocks.find((b) => b.k === 'table') as Extract<Block, { k: 'table' }> | undefined;
  const other = doc.blocks.filter((b) => b.k !== 'h' && !inOutline(b)).length;

  if (view === 'outline') {
    // A table in the source becomes outline rows where it stands (its cells joined by the middle dot), under the
    // heading it stands below, so a deck of slides keeps its slides' headings and a sheet with words over its table
    // keeps the words.
    const blocks = doc.blocks.filter((b) => b.k !== 'hr');
    const lines = blocks.flatMap((b): Block[] => {
      if (b.k === 'h') return [{ k: 'h', level: Math.min(6, depthOf(b) + 1) as 1 | 2 | 3 | 4 | 5 | 6, runs: [{ t: lineOf(b) }] }];
      if (b.k === 'table') {
        const cells = (r: string[]) =>
          r
            .map((c) => c.trim())
            .filter(Boolean)
            .join(' · ');
        return [
          { k: 'h', level: 2, runs: [{ t: b.cols.map((c) => c.name).join(' · ') || 'Table' }] },
          ...b.rows.filter((r) => r.some((c) => c.trim())).map((r): Block => ({ k: 'li', depth: 0, runs: [{ t: cells(r) }] })),
        ];
      }
      const words = lineOf(b);
      if (!inOutline(b) || !words) return [];
      return [{ k: 'li', depth: depthOf(b), runs: [{ t: words }] }];
    });
    const formulas = table?.rows.flat().some((c) => c.startsWith('=')) ?? false;
    return { text: write({ head: {}, blocks: lines }), note: formulas ? 'formulas' : other ? 'simplified' : '' };
  }

  if (view === 'sheet') {
    // A table is a sheet already: its own text, whole, with its formulas and its typed columns.
    if (table) return { text: write({ head: {}, blocks: [table] }), note: '' };
    const rows = doc.blocks.flatMap((b): string[][] => {
      const words = lineOf(b);
      return words ? [['  '.repeat(depthOf(b)) + words]] : [];
    });
    const name = doc.blocks.find((b): b is Extract<Block, { k: 'h' }> => b.k === 'h');
    const cols = [{ name: name ? lineOf(name) : 'Line', type: 'text' as const }];
    return { text: write({ head: {}, blocks: [{ k: 'table', cols, rows }] }), note: other ? 'simplified' : '' };
  }

  // The Presentation: a table becomes a slide that keeps every cell as it stands, formulas and all.
  if (table) {
    const title: Block = { k: 'h', level: 1, runs: [{ t: table.cols.map((c) => c.name).join(' · ') || 'Table' }] };
    return { text: write({ head: {}, blocks: [title, table] }), note: '' };
  }
  const blocks = doc.blocks.filter((b) => b.k !== 'hr');
  return { text: write({ head: {}, blocks: blocks.length ? blocks : [{ k: 'p', runs: [] }] }), note: other ? 'simplified' : '' };
}
