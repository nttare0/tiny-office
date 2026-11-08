/**
 * Deck: slides, and the printed things that are slides with another page (zine, booklet, brochure, comic,
 * poster, name badges), chosen by the head's "format:". The document is TLO, a slide between rules
 * (model.ts); the drawing, the layout, the folds and the player page are view.ts; PowerPoint is pptx.ts;
 * the editor editor.ts. Exports: .pptx, the deck as a web page that plays itself, a picture of every slide,
 * a film of the deck (a GIF, and a WebM where the browser can make one), and the kit's print (the sheets, for a fold) and text.
 */
import { Presentation } from 'lucide';
import { defineApp, isStill } from '../../kit/core/app.ts';
import { pageSvg } from '../../kit/draw/draw.ts';
import { encodeGif, type GifFrame } from '../../kit/file/gif.ts';
import { t } from '../../kit/core/i18n.ts';
import { canvas, drawn, pixels, raster } from '../../kit/draw/raster.ts';
import { webmOf, webmReady, type WebmFrame } from '../../kit/file/webm.ts';
import { zip } from '../../kit/file/zip.ts';
import { retitle, titleOf } from './model.ts';
import { buildPptx } from './pptx.ts';
import { deckFrames, deckPages, deckToHtml } from './view.ts';

/** The film's width; its height is the slides' shape (an even number for the video, as its encoder wants). */
const FILM_W = 960;

/** The film of the deck as a video: the GIF's frames, each drawn on a canvas and held as long. */
async function deckWebm(doc: string): Promise<Uint8Array | null> {
  const pages = deckFrames(doc);
  const h = 2 * Math.round((FILM_W * pages[0].h) / pages[0].w / 2);
  async function* frames(): AsyncIterable<WebmFrame> {
    for (const p of pages) {
      const c = await canvas(pageSvg(p), FILM_W, h);
      if (c) yield { canvas: c, ms: p.ms };
    }
  }
  return webmOf(frames(), FILM_W, h);
}

export default defineApp({
  id: 'deck',
  get name() {
    return t('common-presentation-builder');
  },
  get noun() {
    return t('deck-presentation-lowercase');
  },
  get group() {
    return t('deck-slides');
  },
  icon: Presentation,
  get blurb() {
    return t('deck-slides-titles-bullets-two-columns');
  },
  blank: () => '',
  templates: () => import('./templates.ts').then((m) => m.templates()),
  editor: () => import('./editor.ts'),
  title: titleOf,
  retitle,
  view: (doc, opts) => deckPages(doc, opts?.small, isStill(opts), !!opts?.thumb),
  exports: [
    { ext: 'pptx', label: () => t('deck-powerpoint-pptx'), mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', shows: null, build: (doc, ctx) => buildPptx(doc, ctx) },
    // In place of the kit's pictures of the pages: a page that plays the deck, a slide at a time, with its transition.
    {
      ext: 'html',
      label: () => t('common-web-page-html'),
      mime: 'text/html',
      shows: 'own',
      build: (doc, ctx) => deckToHtml(doc, ctx.title || titleOf(doc) || t('common-untitled-noun', { noun: t('deck-presentation-lowercase') }), ctx.link),
    },
    {
      ext: 'zip',
      label: () => t('deck-picture-of-every-slide-zip'),
      mime: 'application/zip',
      shows: null,
      build: async (doc) => {
        const files: Record<string, Uint8Array> = {};
        const pages = deckPages(doc, false, true);
        for (const [i, p] of pages.entries()) {
          const png = await raster(pageSvg(p), p.w, p.h, 2);
          if (png) files[`slide-${String(i + 1).padStart(2, '0')}.png`] = png;
        }
        return zip(files);
      },
    },
    {
      ext: 'gif',
      label: () => t('deck-animation-of-deck-gif'),
      mime: 'image/gif',
      shows: 'own',
      build: async (doc) => {
        const frames: GifFrame[] = [];
        const pages = deckFrames(doc);
        const w = FILM_W;
        const h = Math.round((w * pages[0].h) / pages[0].w);
        for (const p of pages) {
          const px = await pixels(pageSvg(p), w, h);
          if (px) frames.push({ data: px, delayMs: p.ms });
        }
        return encodeGif(w, h, frames);
      },
    },
    {
      ext: 'webm',
      label: () => t('deck-film-of-deck-webm'),
      mime: 'video/webm',
      shows: 'own',
      available: () => webmReady(FILM_W, 540),
      build: async (doc) => drawn(await deckWebm(doc)),
    },
  ],
  commands: () => import('./commands.ts'),
});
