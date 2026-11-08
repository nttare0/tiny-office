/**
 * The document as JSON: the kernel's own Doc, nothing added or renamed, for a program or an agent that would rather
 * hand over structure than write TLO (Paul, 2026-10-11: "The JSON export is a good idea"). Its contract is
 * packages/doc/schema/tlo.schema.json, written from model.ts's types by scripts/schema.ts; this checks a document
 * against it with a validator of its own, as small as the schema is (objects, arrays, enums, strings, numbers,
 * booleans, a union told apart by its `k`), not a library.
 *
 * docJson writes a document with its keys in a stable order, the order the types name them (`k` first), and a head's
 * and attributes' keys in the document's own order, since that order is the text's; jsonDoc reads one back and throws
 * with the path of the first thing that does not fit ("blocks[2].runs[0].t is missing").
 */
import SCHEMA from '../../packages/doc/schema/tlo.schema.json' with { type: 'json' };
import type { Doc } from './model.ts';

interface Schema {
  $ref?: string;
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: false | Schema;
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  oneOf?: Schema[];
}

const ROOT = SCHEMA as unknown as Schema & { $defs: Record<string, Schema> };
const DEFS = ROOT.$defs;

const say = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : Array.isArray(v) ? 'a list' : v === null ? 'null' : typeof v === 'object' ? 'an object' : String(v));
const at = (path: string) => path || 'the document';
const kind = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/** The value as the schema has it (its keys in the schema's order, nothing undefined), or a throw naming the path where it does not fit. */
function fit(s: Schema, v: unknown, path: string): unknown {
  if (s.$ref) return fit(DEFS[s.$ref.replace('#/$defs/', '')], v, path);
  if (s.oneOf) {
    // A union of objects is told apart by the field every branch fixes (a block's `k`): the one that matches is checked whole.
    const key = Object.keys(s.oneOf[0].properties ?? {}).find((k) => s.oneOf!.every((b) => b.properties?.[k]?.const !== undefined));
    const o = (kind(v) === 'object' ? v : {}) as Record<string, unknown>;
    const match = key ? s.oneOf.filter((b) => o[key] === b.properties![key].const) : [];
    if (match.length === 1) return fit(match[0], v, path);
    if (kind(v) === 'object' && key) throw new Error(`${at(path)}.${key} is ${say(o[key])}, not one of ${s.oneOf.map((b) => say(b.properties![key].const)).join(', ')}`);
    throw new Error(`${at(path)} is ${say(v)}, not ${key ? 'an object' : 'one of what it may be'}`);
  }
  if (s.const !== undefined && v !== s.const) throw new Error(`${at(path)} is ${say(v)}, not ${say(s.const)}`);
  if (s.enum && !s.enum.includes(v)) throw new Error(`${at(path)} is ${say(v)}, not one of ${s.enum.map(say).join(', ')}`);
  if (s.type) {
    const k = kind(v);
    if (k !== s.type || (k === 'number' && !Number.isFinite(v))) throw new Error(`${at(path)} is ${say(v)}, not ${s.type === 'array' ? 'a list' : s.type === 'object' ? 'an object' : `a ${s.type}`}`);
  }
  if (Array.isArray(v)) return s.items ? v.map((x, i) => fit(s.items!, x, `${path}[${i}]`)) : v;
  if (kind(v) !== 'object') return v;
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const props = s.properties ?? {};
  for (const k of s.required ?? []) if (o[k] === undefined) throw new Error(`${path ? `${path}.` : ''}${k} is missing`);
  for (const [k, p] of Object.entries(props)) if (o[k] !== undefined) out[k] = fit(p, o[k], path ? `${path}.${k}` : k);
  for (const [k, x] of Object.entries(o)) {
    if (k in props || x === undefined) continue;
    if (!s.additionalProperties) throw new Error(`${path ? `${path}.` : ''}${k} is not a field ${path ? 'here' : 'of a document'}`);
    out[k] = fit(s.additionalProperties, x, path ? `${path}.${k}` : k);
  }
  return out;
}

/** A document as JSON: stable key order, two-space indent, a line's end at the end. */
export const docJson = (doc: Doc): string => JSON.stringify(fit(ROOT, doc, ''), null, 2) + '\n';

/** JSON as a document; throws when it is not JSON, or not a document, naming the path of the fault. */
export function jsonDoc(json: string): Doc {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch (e) {
    throw new Error(`Not JSON: ${(e as Error).message}`);
  }
  try {
    return fit(ROOT, v, '') as Doc;
  } catch (e) {
    throw new Error(`Not a Tiny Little Office document: ${(e as Error).message}`);
  }
}
