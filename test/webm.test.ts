// The kit's WebM writer (src/kit/file/webm.ts muxWebm), under node: a file muxed from three fake chunks, walked by a tiny
// EBML reader of the test's own. The header says webm; one video track with its codec and size; the blocks at 0, 100
// and 250 ms; the Info's duration; Cues pointing at the clusters of the key frames, and a SeekHead pointing at the
// rest; and every element's declared size is its bytes, so nothing is written with an unknown size.
import { test, expect } from 'vitest';
import { muxWebm } from '../src/kit/file/webm.ts';

interface El {
  id: number;
  /** Where the element starts (its ID), where its data starts, and where it ends. */
  at: number;
  data: number;
  end: number;
  kids?: El[];
}

const MASTER = new Set([0x1a45dfa3, 0x18538067, 0x114d9b74, 0x4dbb, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0x1f43b675, 0x1c53bb6b, 0xbb, 0xb7]);

/** A variable-length number at `p`: its value (with the length marker kept for an ID) and its length. */
function vint(b: Uint8Array, p: number, keepMarker: boolean): [number, number] {
  let len = 1;
  while (len <= 8 && !(b[p] & (0x80 >> (len - 1)))) len++;
  if (len > 8) throw new Error(`bad vint at ${p}`);
  let v = keepMarker ? b[p] : b[p] & (0xff >> len);
  for (let i = 1; i < len; i++) v = v * 256 + b[p + i];
  // An all-ones size is "unknown": never written.
  if (!keepMarker && v === 2 ** (7 * len) - 1) throw new Error(`unknown size at ${p}`);
  return [v, len];
}

/** The elements from `p` to `end`, masters walked into; a child running past its parent throws. */
function walk(b: Uint8Array, p: number, end: number): El[] {
  const out: El[] = [];
  while (p < end) {
    const [id, idLen] = vint(b, p, true);
    const [size, sizeLen] = vint(b, p + idLen, false);
    const data = p + idLen + sizeLen;
    const el: El = { id, at: p, data, end: data + size };
    if (el.end > end) throw new Error(`element ${id.toString(16)} at ${p} runs past its parent`);
    if (MASTER.has(id)) el.kids = walk(b, data, el.end);
    out.push(el);
    p = el.end;
  }
  expect(p).toBe(end);
  return out;
}

const uint = (b: Uint8Array, e: El) => [...b.subarray(e.data, e.end)].reduce((n, x) => n * 256 + x, 0);
const str = (b: Uint8Array, e: El) => new TextDecoder().decode(b.subarray(e.data, e.end));
const kid = (e: El, id: number) => e.kids!.find((k) => k.id === id)!;
const kids = (e: El, id: number) => e.kids!.filter((k) => k.id === id);

test('a WebM of three chunks: the header, one track, the blocks at their times, the duration, and Cues at the key frames', () => {
  const chunk = (n: number, fill: number) => new Uint8Array(n).fill(fill);
  const file = muxWebm(
    { codec: 'V_VP9', w: 640, h: 400 },
    [
      { data: chunk(300, 1), ms: 0, key: true },
      { data: chunk(20, 2), ms: 100, key: false },
      { data: chunk(200, 3), ms: 250, key: true },
    ],
    400,
  );
  // Every element's declared size is its bytes: the walk ends exactly at the end of the file.
  const top = walk(file, 0, file.length);
  expect(top.map((e) => e.id)).toEqual([0x1a45dfa3, 0x18538067]);
  const [ebml, segment] = top;
  expect(str(file, kid(ebml, 0x4282))).toBe('webm');
  expect(uint(file, kid(ebml, 0x4286))).toBe(1);

  const info = kid(segment, 0x1549a966);
  expect(uint(file, kid(info, 0x2ad7b1))).toBe(1_000_000);
  const d = kid(info, 0x4489);
  expect(new DataView(file.buffer, file.byteOffset + d.data, d.end - d.data).getFloat64(0)).toBe(400);

  const tracks = kids(kid(segment, 0x1654ae6b), 0xae);
  expect(tracks).toHaveLength(1);
  expect(uint(file, kid(tracks[0], 0xd7))).toBe(1);
  expect(uint(file, kid(tracks[0], 0x83))).toBe(1);
  expect(str(file, kid(tracks[0], 0x86))).toBe('V_VP9');
  const video = kid(tracks[0], 0xe0);
  expect([uint(file, kid(video, 0xb0)), uint(file, kid(video, 0xba))]).toEqual([640, 400]);

  // The blocks: a cluster per key frame, each block's time its cluster's plus its own (signed 16 bits).
  const clusters = kids(segment, 0x1f43b675);
  expect(clusters).toHaveLength(2);
  const blocks = clusters.flatMap((c) =>
    kids(c, 0xa3).map((b) => {
      expect(file[b.data]).toBe(0x81);
      const rel = new DataView(file.buffer, file.byteOffset + b.data + 1, 2).getInt16(0);
      return { ms: uint(file, kid(c, 0xe7)) + rel, key: !!(file[b.data + 3] & 0x80), bytes: b.end - b.data - 4, first: file[b.data + 4] };
    }),
  );
  expect(blocks).toEqual([
    { ms: 0, key: true, bytes: 300, first: 1 },
    { ms: 100, key: false, bytes: 20, first: 2 },
    { ms: 250, key: true, bytes: 200, first: 3 },
  ]);

  // Cues: a point per key frame, at the cluster that holds it (positions from the Segment's data).
  const points = kids(kid(segment, 0x1c53bb6b), 0xbb);
  expect(points.map((p) => uint(file, kid(p, 0xb3)))).toEqual([0, 250]);
  expect(points.map((p) => segment.data + uint(file, kid(kid(p, 0xb7), 0xf1)))).toEqual(clusters.map((c) => c.at));
  expect(points.map((p) => uint(file, kid(kid(p, 0xb7), 0xf7)))).toEqual([1, 1]);

  // The SeekHead says where the Info, the Tracks and the Cues are, so a player finds the Cues at the end.
  const seeks = kids(kid(segment, 0x114d9b74), 0x4dbb).map((s) => [uint(file, kid(s, 0x53ab)), segment.data + uint(file, kid(s, 0x53ac))]);
  const at = (id: number) => kid(segment, id).at;
  expect(seeks).toEqual([
    [0x1549a966, at(0x1549a966)],
    [0x1654ae6b, at(0x1654ae6b)],
    [0x1c53bb6b, at(0x1c53bb6b)],
  ]);
});

test('a long run of frames between key frames starts a new cluster before a block time leaves 16 bits', () => {
  const chunks = Array.from({ length: 41 }, (_, i) => ({ data: new Uint8Array([i]), ms: i * 1000, key: i === 0 }));
  const file = muxWebm({ codec: 'V_VP8', w: 2, h: 2 }, chunks, 41_000);
  const segment = walk(file, 0, file.length)[1];
  const clusters = kids(segment, 0x1f43b675);
  expect(clusters.length).toBeGreaterThan(1);
  const times = clusters.flatMap((c) => kids(c, 0xa3).map((b) => uint(file, kid(c, 0xe7)) + new DataView(file.buffer, file.byteOffset + b.data + 1, 2).getInt16(0)));
  expect(times).toEqual(chunks.map((c) => c.ms));
  expect(str(file, kid(kids(kid(segment, 0x1654ae6b), 0xae)[0], 0x86))).toBe('V_VP8');
});
