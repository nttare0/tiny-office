// The deck's code under node: a backtick span on a slide drawn in the monospace face and measured at its advance, so
// the fit is honest, and carried to PowerPoint in a monospace face.
import { strFromU8, unzipSync } from 'fflate';
import { expect, test } from 'vitest';
import { parseInline } from '../../../doc/index.ts';
import { MONO, monoWidth, textWidth } from '../../../kit/draw/draw.ts';
import deck from '../def.ts';
import { measureDeck } from '../lint.ts';
import { deckToPptx } from '../pptx.ts';
import { line, spansOf, wrap } from '../view.ts';

const ctx = { def: deck, title: 'Test', link: 'https://tinylittleoffice.com/#/v1/deck/rAbc' };

test('a code span on a slide is a tspan in the monospace face, measured wider than the same words in the sans', () => {
  const spans = spansOf(parseInline('run `npx tinylittleoffice link` now'));
  expect(spans).toStrictEqual([{ t: 'run ' }, { t: 'npx tinylittleoffice link', c: true }, { t: ' now' }]);
  const svg = line(0, 20, spans, { px: 20 });
  expect(svg).toContain(`<tspan font-family="${MONO.replace(/"/g, '&quot;')}">npx tinylittleoffice link</tspan>`);
  expect(svg).toContain('>run <tspan');
  // Plex Mono's advance, 0.6em a character, is wider than the sans's estimate: words that fit one line in the sans wrap as code.
  const words = 'npx tinylittleoffice link';
  expect(monoWidth(words, 20)).toBeGreaterThan(textWidth(words, 20));
  const max = textWidth(words, 20) + 1;
  expect(wrap([{ t: words }], max, 20)).toHaveLength(1);
  expect(wrap([{ t: words, c: true }], max, 20).length).toBeGreaterThan(1);
});

test('measureDeck reflects code: a bullet of code is set smaller or on more lines than the same words in the sans', () => {
  const said = 'run the command that turns a document into a link and prints it for you to paste anywhere at all';
  const plain = measureDeck(`## Commands\n\n- ${said}\n- ${said}\n- ${said}\n`)[0].body;
  const code = measureDeck(`## Commands\n\n- \`${said}\`\n- \`${said}\`\n- \`${said}\`\n`)[0].body;
  expect(code.px < plain.px || code.lines > plain.lines).toBe(true);
});

test('PowerPoint: a code run is set in Courier New, the monospace every PowerPoint has', () => {
  const files = unzipSync(deckToPptx('## Install\n\n- run `npx tlo` now\n', ctx));
  const slide = strFromU8(files['ppt/slides/slide1.xml']);
  expect(slide).toMatch(/<a:rPr [^>]*><a:latin typeface="Courier New"\/><\/a:rPr><a:t>npx tlo<\/a:t>/);
  expect(slide).not.toMatch(/<a:latin typeface="Courier New"\/><\/a:rPr><a:t>run /);
});
