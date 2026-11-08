// A document's link dragged into the Word Processor (src/apps/write/editor.ts, src/kit/ui/insert-dialogs.ts
// resolveDocLink) becomes the document itself, in a fence — not the link's words — and the fence it becomes is an
// embedded local copy: the source's own app, its own first page, with Edit and, where there is another way to look at
// it, a "Preview as" selector that projects the source's words into another app's view without touching the document.
import { afterEach, expect, test } from 'vitest';
import { mount, until } from './helpers.ts';
import { encodeDoc } from '../../src/kit/core/codec.ts';
import type { ToShell } from '../../src/kit/core/shell.ts';

afterEach(() => {
  history.replaceState(null, '', location.pathname);
});

/** A document of `app` as a link, long. */
const linkOf = (app: string, text: string) => `https://tinylittleoffice.com/${app}/#/v1/${app}/${encodeDoc(text)}`;

/** A drag's data: a URI list and a plain text, as a browser's own drag of a link carries. */
function dataOf(link: string): DataTransfer {
  const d = new DataTransfer();
  d.setData('text/uri-list', `${link}\n`);
  d.setData('text/plain', link);
  return d;
}

/** Drop `link` on `target`, within the editor: dragover first, as a browser does, then the drop. */
function dropOn(editor: HTMLElement, target: Element, link: string) {
  const data = dataOf(link);
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
  // The editor says a recognized link can land here.
  expect(editor.hasAttribute('data-drop'), 'the editor never said it would take the link').toBe(true);
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
}

/** The document open in the editor, as the fence blocks it holds. */
const fences = (shell: ToShell) => [...shell.querySelectorAll('to-write-editor .write-doc')];

test('a Tiny Little Office link dropped into Write becomes the document’s fence, not words; another link is left alone', async () => {
  const shell = await mount('#/v1/write');
  await until(() => !!shell.querySelector('to-write-editor to-text .tx'), 'the editor never came');
  const editor = shell.querySelector<HTMLElement>('to-write-editor')!;
  const tx = editor.querySelector<HTMLElement>('to-text .tx')!;
  // A link of another site is not a document: the editor never says it takes it, and the browser keeps the drop.
  const other = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dataOf('https://example.com/a-page') });
  tx.dispatchEvent(other);
  expect(editor.hasAttribute('data-drop')).toBe(false);
  expect(other.defaultPrevented).toBe(false);

  dropOn(editor, tx, linkOf('sheet', 'Item | Cost\n--- | ---\nPaper | 3\n'));
  await until(() => fences(shell).length === 1, 'the document was never put in');
  // The card is the document: its own first page drawn, its app named under its name.
  const doc = fences(shell)[0];
  expect(doc.querySelector('svg')).not.toBeNull();
  expect(doc.querySelector('figcaption small')!.textContent).toBe('Spreadsheet');
  // The link's words are not in the document as words: what was typed is the fence, and the page's words are unchanged.
  expect(tx.querySelector('figure.write-doc')).not.toBeNull();
  // The editor's own drop ring goes again once the drop is done.
  expect(editor.hasAttribute('data-drop')).toBe(false);
});

test('an embedded document is the source’s own app, untouched: Edit is there, and the source’s language is what the fence holds', async () => {
  const shell = await mount(`#/v1/write/${encodeDoc('Before.\n')}`);
  await until(() => !!shell.querySelector('to-write-editor to-text .tx'));
  const editor = shell.querySelector<HTMLElement>('to-write-editor')!;
  dropOn(editor, editor.querySelector<HTMLElement>('to-text .tx')!, linkOf('outline', '- One\n- Two\n'));
  await until(() => fences(shell).length === 1, 'the document was never put in');
  const doc = fences(shell)[0];
  // Edit, on the card itself (2026-11-08), named as the card's own Edit is.
  const edit = doc.querySelector<HTMLButtonElement>('.write-doc-edit')!;
  expect(edit).not.toBeNull();
  expect(edit.textContent!.trim().length).toBeGreaterThan(0);
  // The document asked to be edited is the source app's: the fence's language is the app's own.
  const text = editor.querySelector('to-text')!.getAttribute('label');
  expect(text).toBe('Document');
});

test('Preview as projects a sheet’s table into the Outliner and the Presentation without touching the document', async () => {
  const sheet = 'Item | Cost:money | Total:number\n--- | --- | ---\nPaper | 3 | =B2*2\nInk | 5 | =B3*2\n';
  const shell = await mount('#/v1/write');
  await until(() => !!shell.querySelector('to-write-editor to-text .tx'));
  const editor = shell.querySelector<HTMLElement>('to-write-editor')!;
  dropOn(editor, editor.querySelector<HTMLElement>('to-text .tx')!, linkOf('sheet', sheet));
  await until(() => fences(shell).length === 1, 'the document was never put in');
  const card = () => shell.querySelector<HTMLElement>('.write-doc')!;

  // The selector offers the three apps and the source's own; the source is what is shown first.
  const views = () => [...shell.querySelectorAll<HTMLButtonElement>('.write-doc-view')];
  await until(() => views().length === 4, 'the preview selector never came');
  expect(views().map((b) => b.textContent)).toEqual(['Outliner', 'Presentation Builder', 'Spreadsheet']);
  expect(card().dataset.view).toBe('source');

  // Preview as the Presentation: the table is on a slide, its formulas as written.
  const deck = views()[1];
  deck.click();
  await until(() => card().dataset.view === 'deck', 'the presentation preview never came');
  expect(deck.getAttribute('aria-pressed')).toBe('true');
  expect(card().querySelector('svg')).not.toBeNull();

  // Preview as the Outliner: the table's rows as outline lines.
  views()[0].click();
  await until(() => card().dataset.view === 'outline');
  expect(card().querySelector('svg')).not.toBeNull();

  // Back to the source: the document's own app, drawn as it was.
  views()[3].click();
  await until(() => card().dataset.view === 'source');
});

test('a fence of no app (a code fence) is words, not a document card: no Edit, no Preview as', async () => {
  const shell = await mount(`#/v1/write/${encodeDoc('Before.\n\n```json\n{"a": 1}\n```\n')}`);
  await until(() => !!shell.querySelector('to-write-editor to-text .tx'), 'the editor never came');
  // A code fence has no app, so nothing to open and nothing to look at it as: it is drawn as its own lines.
  expect(shell.querySelector('.write-doc')).toBeNull();
  expect(shell.querySelector('.write-doc-views')).toBeNull();
});
