/**
 * Motion: a drawing that moves. The document is Draw's table of shapes, the length and speed in the head,
 * and a table of keys (model.ts); the drawing at any moment, the self-playing SVG and the GIF's frames are
 * view.ts; the editor editor.ts. Draw hands a drawing over as it is ("Animate this drawing").
 */
import { Clapperboard } from 'lucide';
import { apply, parse, write } from '../../doc/index.ts';
import { defineApp, isStill, type Doc } from '../../kit/core/app.ts';
import { pageSvg, utf8 } from '../../kit/draw/draw.ts';
import { encodeGif, type GifFrame } from '../../kit/file/gif.ts';
import { t } from '../../kit/core/i18n.ts';
import { canvas, drawn, pixels } from '../../kit/draw/raster.ts';
import { webmOf, webmReady, type WebmFrame } from '../../kit/file/webm.ts';
import { drawingText, H, W } from '../draw/model.ts';
import { frameOrder, gifLoop, readAnim } from './model.ts';
import { altOf, animFrames, animPage, animToSvg, frameSvg } from './view.ts';

export const titleOf = (doc: Doc): string => parse(doc).head.title ?? '';
export const retitle = (doc: Doc, title: string): Doc => write(apply(parse(doc), { op: 'head', key: 'title', value: title.replace(/\n/g, ' ').trim() || undefined }));

/** The animated GIF: every frame of a round drawn in the browser, each held 1/fps of a second, repeating as the motion says. */
async function animGif(doc: Doc): Promise<Uint8Array> {
  const { pages, delayMs, loop } = animFrames(parse(doc));
  const frames: GifFrame[] = [];
  for (const p of pages) {
    const px = await pixels(pageSvg(p), W, H);
    if (px) frames.push({ data: px, delayMs });
  }
  return encodeGif(W, H, frames, { loop: gifLoop(loop) });
}

/** The video: the GIF's frames, each drawn on a canvas at the stage's size and held 1/fps of a second; one round of the motion. */
export async function animWebm(doc: Doc): Promise<Uint8Array | null> {
  const { pages, delayMs } = animFrames(parse(doc));
  async function* frames(): AsyncIterable<WebmFrame> {
    for (const p of pages) {
      const c = await canvas(pageSvg(p), W, H);
      if (c) yield { canvas: c, ms: delayMs };
    }
  }
  return webmOf(frames(), W, H);
}

export default defineApp({
  id: 'anim',
  get name() {
    return t('common-animator');
  },
  get noun() {
    return t('anim-animation');
  },
  get group() {
    return t('common-design');
  },
  icon: Clapperboard,
  get blurb() {
    return t('anim-anything-from-drawing-tool-moving');
  },
  blank: () => '',
  templates: () => import('./templates.ts').then((m) => m.templates()),
  editor: () => import('./editor.ts'),
  title: titleOf,
  retitle,
  // Where nothing can move, one frame: a thumbnail the first moment (something is on the stage then), print, a
  // PDF or a PNG the resting one (where a once-through ends). Anywhere else the motion plays, on its own or placed
  // in another document (`small`), repeating as its loop says.
  // Its alt and each layer's label, as a drawing's.
  text: (doc) => drawingText(readAnim(parse(doc)).draw),
  view: (doc, opts) => {
    const anim = readAnim(parse(doc));
    if (!isStill(opts)) return [animPage(anim)];
    // A film asks for a frame of its own; else the first for a thumbnail, the resting one for a print.
    const frame = opts?.frame !== undefined ? Math.max(0, Math.min(anim.frames - 1, Math.floor(opts.frame))) : opts?.thumb ? 0 : Math.max(0, anim.frames - 1);
    return [{ w: W, h: H, svg: frameSvg(anim, frame), alt: altOf(anim) }];
  },
  // One round of the motion, frame by frame, for a film of a slide that holds it (deck/view.ts deckFrames).
  motion: (doc) => {
    const anim = readAnim(parse(doc));
    return { frames: frameOrder(anim.frames, anim.loop), delayMs: Math.round(1000 / anim.fps) };
  },
  exports: [
    { ext: 'gif', label: () => t('anim-animated-gif'), mime: 'image/gif', shows: 'own', build: (doc) => animGif(doc) },
    { ext: 'webm', label: () => t('anim-video-webm'), mime: 'video/webm', shows: 'own', available: () => webmReady(W, H), build: async (doc) => drawn(await animWebm(doc)) },
    { ext: 'svg', label: () => t('anim-animated-svg'), mime: 'image/svg+xml', shows: 'own', build: (doc) => utf8(animToSvg(parse(doc))) },
  ],
  commands: () => import('./commands.ts'),
});
