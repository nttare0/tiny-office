/**
 * Calendar: labelled spans of time on a month, a year or a schedule. The document is a list of dated items
 * (model.ts); the same items drawn as a Gantt chart when the head says `view: gantt`. The editor is
 * editor.ts, the drawing and the files view.ts.
 */
import { CalendarDays } from 'lucide';
import { apply, parse, write, type Doc as Kernel, type TextNode } from '../../doc/index.ts';
import { defineApp, type Doc } from '../../kit/core/app.ts';
import { csvSeparator } from '../../kit/file/csv.ts';
import { utf8 } from '../../kit/draw/draw.ts';
import { t } from '../../kit/core/i18n.ts';
import { dateWords } from '../../kit/core/dates.ts';
import { calPages, calToCsv, calToIcs } from './view.ts';
import { readCal, repeatText, spanDays, spanEndMs, spanStartMs } from './model.ts';
import { clockString, utcToParts } from './tz.ts';

const DAY_MS = 86_400_000;

/**
 * A calendar as text: each day an event starts on, in order, a heading (the date in the reader's language), and
 * under it the day's events: a timed one with its times in the calendar's zone, one of several days with the days
 * it spans, and how either repeats.
 */
function calText(doc: Kernel): TextNode[] {
  const v = readCal(doc);
  const zone = v.zone || 'UTC';
  const date = dateWords({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const clock = (ms: number) => clockString(utcToParts(ms, zone));
  const out: TextNode[] = [];
  let last: number | null = null;
  for (const i of [...v.items].sort((a, b) => spanStartMs(a) - spanStartMs(b) || a.at - b.at)) {
    const [from, to] = spanDays(i, zone);
    if (from !== last) out.push({ k: 'h', level: 2, runs: [{ t: date.format(from * DAY_MS) }] }, { k: 'list', ord: false, items: [] });
    last = from;
    const when = i.kind === 't' ? (i.dur ? `${clock(spanStartMs(i))}–${clock(spanEndMs(i))} ` : `${clock(spanStartMs(i))} `) : '';
    const more = [...(to > from ? [date.formatRange(from * DAY_MS, to * DAY_MS)] : []), ...(i.repeat ? [repeatText(i.repeat)] : [])];
    (out[out.length - 1] as Extract<TextNode, { k: 'list' }>).items.push({ runs: [{ t: `${when}${i.words}${more.length ? ` (${more.join(', ')})` : ''}` }] });
  }
  return out;
}

export const titleOf = (doc: Doc): string => parse(doc).head.title ?? '';
export const retitle = (doc: Doc, title: string): Doc => write(apply(parse(doc), { op: 'head', key: 'title', value: title.replace(/\n/g, ' ').trim() || undefined }));

export default defineApp({
  id: 'cal',
  get name() {
    return t('common-calendar');
  },
  get noun() {
    return t('cal-calendar');
  },
  get group() {
    return t('common-plan');
  },
  icon: CalendarDays,
  get blurb() {
    return t('cal-days-and-times-on-month');
  },
  // Nothing yet: the editor opens on this month.
  blank: () => '',
  templates: () => import('./templates.ts').then((m) => m.templates()),
  editor: () => import('./editor.ts'),
  commands: () => import('./commands.ts'),
  title: titleOf,
  retitle,
  view: (doc, opts) => calPages(parse(doc), !!opts?.small),
  text: (doc) => calText(parse(doc)),
  exports: [
    { ext: 'ics', label: () => t('cal-icalendar-ics'), mime: 'text/calendar;charset=utf-8', shows: null, build: (doc) => utf8(calToIcs(parse(doc), Date.now())) },
    { ext: 'csv', label: () => t('common-csv'), mime: 'text/csv;charset=utf-8', shows: 'text', build: (doc) => utf8('﻿' + calToCsv(parse(doc), csvSeparator())) },
  ],
});
