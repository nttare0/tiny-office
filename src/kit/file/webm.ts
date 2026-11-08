/**
 * A WebM video from frames: the frames the GIF is made of (the Animator's, the Deck's film), each a canvas held for
 * its length, encoded by the browser's own WebCodecs VideoEncoder (VP9 where it can, else VP8) and muxed here, by
 * hand, the way gif.ts writes GIF89a. Browsers have no muxer: MediaRecorder on canvas.captureStream() does write
 * WebM, but records in real time with the clock's jitter (a ten-second animation takes ten seconds and frames land
 * late) and Safari's records MP4; WebCodecs gives exact frame times and finishes as fast as the encoder runs.
 *
 * The file is Matroska as WebM has it: the EBML header, then a Segment of a SeekHead, Info (milliseconds, the
 * duration), Tracks (one video track), Clusters of SimpleBlocks (a cluster from each key frame) and Cues at the key
 * frames. Every size is written once its length is known (the parts are built first, then the bytes), never the
 * "unknown size" a live recorder writes, so it plays and seeks in every browser and in VLC. No audio. muxWebm touches
 * no DOM (test/webm.test.ts reads its files under node); webmOf and webmReady need a browser's encoder.
 */

/** A frame to encode: a canvas, drawn, and how long it stays. */
export interface WebmFrame {
  canvas: CanvasImageSource;
  ms: number;
}

/** An encoded frame: its bytes, its start, and whether it stands alone. */
export interface WebmChunk {
  data: Uint8Array;
  ms: number;
  key: boolean;
}

/** The one track: the codec as Matroska names it, and the size. */
export interface WebmTrack {
  codec: 'V_VP9' | 'V_VP8';
  w: number;
  h: number;
}

/* ---------- the muxer ---------- */

type Part = Uint8Array | number[];

const join = (parts: Part[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** A size as EBML writes it: the fewest bytes, the length in the leading bits; all ones (an unknown size) never. */
function vint(n: number): number[] {
  let len = 1;
  while (n >= 2 ** (7 * len) - 1) len++;
  const out: number[] = [];
  for (let i = len - 1; i >= 0; i--) out.push(Math.floor(n / 2 ** (8 * i)) & 255);
  out[0] |= 0x80 >> (len - 1);
  return out;
}

/** An unsigned number, big-endian, in `width` bytes or the fewest that hold it. */
function uintBytes(n: number, width = 0): number[] {
  const out: number[] = [];
  for (; n > 0 || out.length < Math.max(1, width); n = Math.floor(n / 256)) out.unshift(n % 256);
  return out;
}

/** An element ID's bytes (its length marker is part of it). */
const idBytes = (id: number) => uintBytes(id);

/** An element: its ID, its size, its data. */
const el = (id: number, ...data: Part[]): Uint8Array => {
  const body = join(data);
  return join([idBytes(id), vint(body.length), body]);
};
const uint = (id: number, n: number, width = 0) => el(id, uintBytes(n, width));
const text = (id: number, s: string) => el(id, new TextEncoder().encode(s));
const float = (id: number, n: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n);
  return el(id, b);
};

const ID = {
  EBML: 0x1a45dfa3,
  Segment: 0x18538067,
  SeekHead: 0x114d9b74,
  Seek: 0x4dbb,
  Info: 0x1549a966,
  Tracks: 0x1654ae6b,
  Cluster: 0x1f43b675,
  Cues: 0x1c53bb6b,
};

/** The longest a block may be from its cluster's start: its time there is a signed 16-bit count of milliseconds. */
const CLUSTER_MS = 32_000;

/** The file: the chunks in order (the first a key frame), the whole length in milliseconds. */
export function muxWebm(track: WebmTrack, chunks: WebmChunk[], durationMs: number): Uint8Array {
  const header = el(ID.EBML, uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), text(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2));
  const info = el(ID.Info, uint(0x2ad7b1, 1_000_000), float(0x4489, durationMs), text(0x4d80, 'Tiny Little Office'), text(0x5741, 'Tiny Little Office'));
  const tracks = el(ID.Tracks, el(0xae, uint(0xd7, 1), uint(0x73c5, 1), uint(0x83, 1), uint(0x9c, 0), text(0x86, track.codec), el(0xe0, uint(0xb0, track.w), uint(0xba, track.h))));

  // A cluster from each key frame, or before a block's time would leave 16 bits; a cue at each key frame's.
  const groups: WebmChunk[][] = [];
  for (const c of chunks) {
    const last = groups.at(-1);
    if (!last || c.key || c.ms - last[0].ms > CLUSTER_MS) groups.push([c]);
    else last.push(c);
  }
  const clusters = groups.map((g) => el(ID.Cluster, uint(0xe7, g[0].ms), ...g.map((c) => el(0xa3, [0x81, ((c.ms - g[0].ms) >> 8) & 255, (c.ms - g[0].ms) & 255, c.key ? 0x80 : 0], c.data))));

  // The SeekHead's positions are four bytes each, so its length is the same before and after they are known.
  const seekHead = (at: number[]) => el(ID.SeekHead, ...[ID.Info, ID.Tracks, ID.Cues].map((id, i) => el(ID.Seek, el(0x53ab, idBytes(id)), uint(0x53ac, at[i], 4))));
  const head = seekHead([0, 0, 0]).length;
  let at = head + info.length + tracks.length;
  const points: Uint8Array[] = [];
  clusters.forEach((c, i) => {
    if (groups[i][0].key) points.push(el(0xbb, uint(0xb3, groups[i][0].ms), el(0xb7, uint(0xf7, 1), uint(0xf1, at))));
    at += c.length;
  });
  const cues = el(ID.Cues, ...points);
  const segment = el(ID.Segment, seekHead([head, head + info.length, at]), info, tracks, ...clusters, cues);
  return join([header, segment]);
}

/* ---------- the encoder ---------- */

/** Bits a second: flat drawings need few (test/browser/webm.test.ts compared two). */
/** Bits a second: generous for 960 wide, since a slide is mostly still and its words must stay crisp (Paul, 2026-10-14: "make the webm exporter less compressed, it's too jpeggy"; it was one million). */
const BITRATE = 6_000_000;
/** A key frame at the start and one every two seconds after, so a player can seek. */
const KEY_MS = 2000;

const config = (codec: string, w: number, h: number, bitrate = BITRATE): VideoEncoderConfig => ({ codec, width: w, height: h, bitrate, latencyMode: 'quality' });

/** The codec this browser encodes at this size, VP9 before VP8, or null (no WebCodecs, or only H.264). */
async function codecOf(w: number, h: number): Promise<{ codec: string; id: WebmTrack['codec'] } | null> {
  if (typeof VideoEncoder === 'undefined' || !VideoEncoder) return null;
  for (const [codec, id] of [
    ['vp09.00.10.08', 'V_VP9'],
    ['vp8', 'V_VP8'],
  ] as const) {
    try {
      if ((await VideoEncoder.isConfigSupported(config(codec, w, h))).supported) return { codec, id };
    } catch {
      // Not this one.
    }
  }
  return null;
}

/** Whether this browser can make a WebM at this size: a format's `available` (kit/core/app.ts Export). */
export const webmReady = async (w: number, h: number): Promise<boolean> => !!(await codecOf(w, h));

/** Said where no encoder is (the API and the CLI, under node). */
export const WEBM_IN_BROWSER = 'WebM is made in the browser: open the link and save it from Download.';

/** The frames, encoded and muxed: a WebM of w by h, or null where the browser cannot make one. (`bitrate` is the test's, to compare.) */
export async function webmOf(frames: AsyncIterable<WebmFrame>, w: number, h: number, bitrate = BITRATE): Promise<Uint8Array | null> {
  if (typeof VideoEncoder === 'undefined' || !VideoEncoder) throw new Error(WEBM_IN_BROWSER);
  const codec = await codecOf(w, h);
  if (!codec) return null;
  const chunks: WebmChunk[] = [];
  let failed = false;
  const encoder = new VideoEncoder({
    output: (c) => {
      const data = new Uint8Array(c.byteLength);
      c.copyTo(data);
      chunks.push({ data, ms: Math.round(c.timestamp / 1000), key: c.type === 'key' });
    },
    error: () => (failed = true),
  });
  encoder.configure(config(codec.codec, w, h, bitrate));
  let at = 0;
  let key = -Infinity;
  try {
    for await (const f of frames) {
      const frame = new VideoFrame(f.canvas, { timestamp: at * 1000, duration: f.ms * 1000 });
      const keyFrame = at - key >= KEY_MS;
      if (keyFrame) key = at;
      encoder.encode(frame, { keyFrame });
      frame.close();
      at += f.ms;
    }
    await encoder.flush();
  } catch {
    failed = true;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
  return failed || !chunks.length ? null : muxWebm({ codec: codec.id, w, h }, chunks, at);
}
