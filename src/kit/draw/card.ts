/**
 * The picture a link previews with, 1200 by 630: a page on a neutral ground, at the largest size that fits its box,
 * with a hairline and a soft shadow. One shape for both: the Share dialog draws a document's first page across the
 * whole card (kit/share/card.ts, when a person shares with a network with the preview on), and scripts/make-cards.ts
 * draws an app's generic card with the page, greeked, in the box at the right and the app's name beside it. No DOM:
 * the script reads it under node.
 */
import type { Page } from '../core/app.ts';
import { FONT, LINE, PAPER, SHADE, r } from './draw.ts';

export const CARD_W = 1200;
export const CARD_H = 630;
/** The ground the page sits on. */
export const GROUND = SHADE;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A document's card: the page alone, across the card. */
export const WHOLE: Box = { x: 48, y: 36, w: 1104, h: 558 };
/** An app's card: the page at the right, the words at the left (scripts/make-cards.ts). */
export const RIGHT: Box = { x: 696, y: 64, w: 440, h: 502 };

/** The page's place in the box: as large as fits, its shape kept, in the middle. */
export function fit(p: Page, box: Box): Box {
  const k = Math.min(box.w / p.w, box.h / p.h);
  const w = p.w * k;
  const h = p.h * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** The card as SVG markup: the ground, and the page in `box`. */
export function cardSvg(p: Page, box: Box = WHOLE): string {
  const at = fit(p, box);
  const frame = `x="${r(at.x)}" y="${r(at.y)}" width="${r(at.w)}" height="${r(at.h)}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" font-family="${FONT}">` +
    `<defs><filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#18181b" flood-opacity="0.16"/></filter></defs>` +
    `<rect width="${CARD_W}" height="${CARD_H}" fill="${GROUND}"/>` +
    `<rect ${frame} rx="4" fill="${PAPER}" stroke="${LINE}" stroke-width="1" filter="url(#card-shadow)"/>` +
    `<svg class="card-page" ${frame} viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="xMidYMid meet"><rect width="${p.w}" height="${p.h}" fill="${PAPER}"/>${p.svg}</svg>` +
    `</svg>`
  );
}
