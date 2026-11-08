/**
 * Calculator: a tape. Every line worked out as it is typed, a line "a = 12" keeping its answer by name for
 * the lines after, units and conversions and a little algebra beside the plain sums; or curves y = f(x)
 * drawn. The document is the tape (model.ts), the editor is editor.ts (the mathjs engine, math.ts, a lazy import
 * in the app file), the drawing and the text view.ts.
 */
import { Calculator } from 'lucide';
import { apply, parse, write } from '../../doc/index.ts';
import { defineApp, type Doc } from '../../kit/core/app.ts';
import { t } from '../../kit/core/i18n.ts';
import { calcPage, tapeText } from './view.ts';

export const titleOf = (doc: Doc): string => parse(doc).head.title ?? '';
export const retitle = (doc: Doc, title: string): Doc => write(apply(parse(doc), { op: 'head', key: 'title', value: title.replace(/\n/g, ' ').trim() || undefined }));

export default defineApp({
  id: 'calc',
  get name() {
    return t('common-calculator');
  },
  get noun() {
    return t('calc-calculation');
  },
  get group() {
    return t('common-numbers');
  },
  icon: Calculator,
  get blurb() {
    return t('calc-calculator-that-shows-its-work');
  },
  blank: () => '',
  templates: () => import('./templates.ts').then((m) => m.templates()),
  editor: () => import('./editor.ts'),
  commands: () => import('./commands.ts'),
  title: titleOf,
  retitle,
  view: (doc, opts) => [calcPage(parse(doc), opts?.small)],
  exports: [{ ext: 'txt', label: () => t('calc-tape-text'), mime: 'text/plain;charset=utf-8', shows: 'text', build: (doc) => tapeText(parse(doc)) }],
});
