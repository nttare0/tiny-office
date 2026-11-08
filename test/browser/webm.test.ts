// The WebM (kit/file/webm.ts): the Animator's sample and the Deck's film, encoded by the browser's own VideoEncoder and muxed
// by ours, play in a <video> at the stage's width for as long as their frames last; the frame a player draws is the
// frame that was drawn (the bitrate, chosen by comparing two); and a browser with no encoder has no WebM row.
import { test, expect, afterEach, vi } from 'vitest';
import { appOf } from '../../src/kit/core/apps.ts';
import { encodeDoc } from '../../src/kit/core/codec.ts';
import { pageSvg } from '../../src/kit/draw/draw.ts';
import { canvas } from '../../src/kit/draw/raster.ts';
import { webmOf, type WebmFrame } from '../../src/kit/file/webm.ts';
import { parse } from '../../src/doc/index.ts';
import { animFrames } from '../../src/apps/anim/view.ts';
import { animWebm } from '../../src/apps/anim/def.ts';
import { deckFrames } from '../../src/apps/deck/view.ts';
import { H, W } from '../../src/apps/draw/model.ts';
import { mount, openDrawerDoc, until } from './helpers.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, '', location.pathname);
});

/** The file in a <video>, its metadata read. */
async function play(bytes: Uint8Array): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const loaded = new Promise((done, failed) => {
    video.addEventListener('loadeddata', done, { once: true });
    video.addEventListener('error', () => failed(new Error(`does not play: ${video.error?.message}`)), { once: true });
  });
  video.src = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'video/webm' }));
  document.body.append(video);
  await loaded;
  return video;
}

/** The picture the player shows at `s` seconds, as RGBA. */
async function frameAt(video: HTMLVideoElement, s: number): Promise<Uint8ClampedArray> {
  const seeked = new Promise((done) => video.addEventListener('seeked', done, { once: true }));
  video.currentTime = s;
  await seeked;
  const c = document.createElement('canvas');
  [c.width, c.height] = [video.videoWidth, video.videoHeight];
  const g = c.getContext('2d')!;
  g.drawImage(video, 0, 0);
  return g.getImageData(0, 0, c.width, c.height).data;
}

/** How far two pictures are apart: the mean difference of a channel, 0 to 255. */
const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) if (i % 4 !== 3) sum += Math.abs(a[i] - b[i]);
  return sum / ((a.length / 4) * 3);
};

const sample = async (id: string) => (await appOf(id)!.templates())[0].doc;

test("the Animator's sample, saved as WebM, plays at the stage's size for as long as its frames", async () => {
  const doc = await sample('anim');
  const { pages, delayMs } = animFrames(parse(doc));
  const bytes = (await animWebm(doc))!;
  expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  const video = await play(bytes);
  expect([video.videoWidth, video.videoHeight]).toEqual([W, H]);
  expect(Math.abs(video.duration * 1000 - pages.length * delayMs)).toBeLessThanOrEqual(delayMs);
  video.remove();
}, 60_000);

test("the Deck's film, saved as WebM, plays 960 wide for as long as its frames", async () => {
  const deck = appOf('deck')!;
  const doc = await sample('deck');
  const pages = deckFrames(doc);
  const bytes = (await deck.exports!.find((f) => f.ext === 'webm')!.build(doc, { def: deck, title: '', link: location.href })) as Uint8Array;
  const video = await play(bytes);
  expect(video.videoWidth).toBe(960);
  expect(video.videoHeight).toBe(2 * Math.round((960 * pages[0].h) / pages[0].w / 2));
  // As long as its frames' holds together: each holds for its words (deckFrames), three seconds at the least.
  const held = pages.reduce((n, p) => n + p.ms, 0);
  expect(pages.every((p) => p.ms >= 3000)).toBe(true);
  expect(Math.abs(video.duration * 1000 - held)).toBeLessThanOrEqual(1500);
  // A player can seek: the last frame is there to be shown.
  expect((await frameAt(video, video.duration - 0.7)).length).toBe(video.videoWidth * video.videoHeight * 4);
  video.remove();
}, 120_000);

test('the bitrate: six Mbit/s is the default (crisp words on a slide, Paul, 2026-10-14: "too jpeggy" at one), its frame at least as close to the drawing as one Mbit/s gives', async () => {
  const doc = await sample('anim');
  const { pages, delayMs } = animFrames(parse(doc));
  const drawn: HTMLCanvasElement[] = [];
  for (const p of pages) drawn.push((await canvas(pageSvg(p), W, H))!);
  async function* frames(): AsyncIterable<WebmFrame> {
    for (const c of drawn) yield { canvas: c, ms: delayMs };
  }
  const at = Math.floor(pages.length / 2);
  const want = drawn[at].getContext('2d')!.getImageData(0, 0, W, H).data;
  const tried: Record<number, { bytes: number; off: number }> = {};
  for (const rate of [1_000_000, 6_000_000]) {
    const bytes = (await webmOf(frames(), W, H, rate))!;
    const video = await play(bytes);
    tried[rate] = { bytes: bytes.length, off: diff(await frameAt(video, (at * delayMs + delayMs / 2) / 1000), want) };
    video.remove();
  }
  console.log('webm bitrates', JSON.stringify(tried));
  // The kept rate (6 Mbit/s, kit/file/webm.ts BITRATE) is the default; its frame is within a hair of the drawing and no further from it than the lean rate's.
  expect((await animWebm(doc))!.length).toBe(tried[6_000_000].bytes);
  expect(tried[6_000_000].off).toBeLessThan(3);
  expect(tried[6_000_000].off).toBeLessThanOrEqual(tried[1_000_000].off + 0.5);
}, 120_000);

test('a browser with no video encoder has no WebM row in the Download table, and the GIF stays', async () => {
  vi.stubGlobal('VideoEncoder', undefined);
  const shell = await mount(`#/v1/anim/${encodeDoc(await sample('anim'))}`);
  await until(() => !!shell.querySelector('to-anim-editor'), 10_000);
  await openDrawerDoc(shell);
  shell.querySelector<HTMLButtonElement>('.to-drawer-download > button')!.click();
  const labels = () => [...shell.querySelectorAll<HTMLElement>('.to-drawer-download .to-menu-row')].map((r) => r.getAttribute('aria-label'));
  await until(() => labels().includes('Animated GIF'));
  // Asked, and answered no: still none.
  await new Promise((r) => setTimeout(r, 200));
  await shell.updateComplete;
  expect(labels()).toContain('Animated GIF');
  expect(labels().some((l) => /WebM/.test(l ?? ''))).toBe(false);
}, 30_000);
