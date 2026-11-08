/**
 * Trip: a route on a map, stops in order, each with a note; or places as dots. The document is a table of
 * places (model.ts), the editor is editor.ts (a Leaflet map, imported lazily, with OpenStreetMap's
 * pictures while it is on view), the drawing (on the same pictures, by the same Map switch) and the files view.ts.
 */
import { MapPinned } from 'lucide';
import { apply, parse, textOf, write, type TextNode } from '../../doc/index.ts';
import { defineApp, type Doc } from '../../kit/core/app.ts';
import { utf8 } from '../../kit/draw/draw.ts';
import { t } from '../../kit/core/i18n.ts';
import { mapOn, tripPage, tripToGeoJson, tripToGpx } from './view.ts';
import { tripToCal } from './convert.ts';
import { readTrip } from './model.ts';

/** The document's own title ('' for none: a GPX or GeoJSON file falls back to the route's ends). */
export const titleOf = (doc: Doc): string => parse(doc).head.title ?? '';
export const retitle = (doc: Doc, title: string): Doc => write(apply(parse(doc), { op: 'head', key: 'title', value: title.replace(/\n/g, ' ').trim() || undefined }));

/** A trip as text: its stops in order, each its name and its note (where the times are written); loose words as they are. */
function tripText(doc: Doc): TextNode[] {
  const k = parse(doc);
  const v = readTrip(k);
  if (v.at < 0) return textOf(k);
  return v.stops.length ? [{ k: 'list', ord: true, items: v.stops.map((s) => ({ runs: [{ t: s.name || '·', b: true as const }, ...(s.note.trim() ? [{ t: `: ${s.note.trim()}` }] : [])] })) }] : [];
}

export default defineApp({
  id: 'trip',
  get name() {
    return t('common-trip-planner');
  },
  get noun() {
    return t('trip-trip');
  },
  get group() {
    return t('common-plan');
  },
  icon: MapPinned,
  get blurb() {
    return t('trip-route-on-map-stops-in');
  },
  blank: () => '',
  templates: () => import('./templates.ts').then((m) => m.templates()),
  editor: () => import('./editor.ts'),
  title: titleOf,
  retitle,
  // On OpenStreetMap's tiles while the Map switch is on, except a thumbnail: a visitor who has not opened a trip tells OpenStreetMap nothing.
  view: (doc, opts) => [tripPage(parse(doc), opts?.small, opts?.upTo, !opts?.thumb && mapOn())],
  text: tripText,
  // Presented on a slide, a stop a step: the map stays fitted to them all, the route drawn as far as it has come.
  steps: (doc) => readTrip(parse(doc)).stops.length,
  exports: [
    { ext: 'gpx', label: () => t('trip-gpx-route'), mime: 'application/gpx+xml', shows: null, build: (doc) => utf8(tripToGpx(parse(doc))) },
    { ext: 'geojson', label: () => t('trip-geojson'), mime: 'application/geo+json', shows: null, build: (doc) => utf8(tripToGeoJson(parse(doc))) },
  ],
  commands: () => import('./commands.ts'),
  handoffs: [{ to: 'cal', label: () => t('trip-put-stops-on-calendar-day'), convert: (doc) => tripToCal(doc) }],
});
