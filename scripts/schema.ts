/**
 * packages/doc/schema/tlo.schema.json, the JSON Schema (2020-12) of the kernel's document, written from its types in
 * src/doc/model.ts, so the schema cannot say a field the kernel does not have (Paul, 2026-10-11: "The JSON export is a
 * good idea"). TypeScript 7 is a native compiler with no JavaScript API to ask for the types, and a library that turns
 * types into a schema would be a dependency for one small file, so this reads model.ts itself: the few shapes the
 * model is written in, a type alias or an interface of string fields, string, number and boolean, a literal or a union
 * of them (an enum), an array, Record<string, T>, an object literal, a union of object literals (oneOf), and a name of
 * another of them ($defs). A shape it does not know stops it, by name. What reaches the document from Doc is
 * written; the helpers' types (TextBlock, TableBlock) are not. Each `/** … *\/` above a type or a field is its
 * description.
 *
 *   node scripts/schema.ts           write the schema
 *   node scripts/schema.ts --check   write nothing; fail if the schema is not what model.ts says (test/lints.test.ts)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './generated.ts';

type Schema = Record<string, unknown>;

/** model.ts as tokens: words, literals, punctuation, and each doc comment (kept, to describe what follows it). */
function tokens(src: string): string[] {
  const out: string[] = [];
  const re = /\/\*\*([\s\S]*?)\*\/|\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|=>|[{}()[\]<>|;:?,=&]|\S/g;
  for (const m of src.matchAll(re)) {
    if (m[1] !== undefined)
      out.push(
        '/**' +
          m[1]
            .replace(/^\s*\* ?/gm, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
      );
    else if (!m[0].startsWith('/*') && !m[0].startsWith('//')) out.push(m[0]);
  }
  return out;
}

/** Each exported type alias and interface: its name, its description, and its tokens. */
function declarations(src: string): Map<string, { doc: string; body: string[]; iface: boolean }> {
  const tk = tokens(src);
  const decls = new Map<string, { doc: string; body: string[]; iface: boolean }>();
  for (let i = 0; i < tk.length; i++) {
    if (tk[i] !== 'export' || (tk[i + 1] !== 'type' && tk[i + 1] !== 'interface')) continue;
    const doc = tk[i - 1]?.startsWith('/**') ? tk[i - 1].slice(3) : '';
    const iface = tk[i + 1] === 'interface';
    const name = tk[i + 2];
    let j = i + 3 + (iface ? 0 : 1);
    const start = j;
    let depth = 0;
    for (; j < tk.length; j++) {
      if ('{[(<'.includes(tk[j])) depth++;
      else if ('}])>'.includes(tk[j])) depth--;
      if ((iface && depth === 0 && tk[j] === '}') || (!iface && depth === 0 && tk[j] === ';')) break;
    }
    decls.set(name, { doc, body: tk.slice(start, iface ? j + 1 : j), iface });
    i = j;
  }
  return decls;
}

/** The JSON Schema of the kernel's document, as the file holds it. */
export function schemaOf(model: string): string {
  const decls = declarations(model);
  const defs: Record<string, Schema> = {};
  const wanted: string[] = [];
  const ref = (name: string): Schema => {
    if (!decls.has(name)) throw new Error(`scripts/schema.ts: model.ts has no type "${name}"`);
    if (!wanted.includes(name)) wanted.push(name);
    return { $ref: `#/$defs/${name}` };
  };

  /** A type from tokens, from `at`: the schema and the index after it. */
  function type(tk: string[], at: number): [Schema, number] {
    const parts: Schema[] = [];
    let i = at;
    if (tk[i] === '|') i++;
    for (;;) {
      let s: Schema;
      [s, i] = atom(tk, i);
      while (tk[i] === '[' && tk[i + 1] === ']') ((s = { type: 'array', items: s }), (i += 2));
      parts.push(s);
      if (tk[i] !== '|') break;
      i++;
    }
    if (parts.length === 1) return [parts[0], i];
    const consts = parts.map((p) => p.const);
    if (consts.every((c) => c !== undefined)) return [{ enum: consts }, i];
    return [{ oneOf: parts }, i];
  }

  function atom(tk: string[], i: number): [Schema, number] {
    const w = tk[i];
    if (w.startsWith("'")) return [{ const: w.slice(1, -1).replace(/\\(.)/g, '$1') }, i + 1];
    if (/^-?\d/.test(w)) return [{ const: Number(w) }, i + 1];
    if (w === 'true' || w === 'false') return [{ const: w === 'true' }, i + 1];
    if (w === 'string' || w === 'number' || w === 'boolean') return [{ type: w }, i + 1];
    if (w === '{') return object(tk, i);
    if (w === '(') {
      const [s, j] = type(tk, i + 1);
      return [s, j + 1];
    }
    if (w === 'Record' && tk[i + 1] === '<' && tk[i + 2] === 'string' && tk[i + 3] === ',') {
      const [s, j] = type(tk, i + 4);
      if (tk[j] !== '>') throw new Error(`scripts/schema.ts: a Record that does not close: ${tk.slice(i, j + 1).join(' ')}`);
      return [{ type: 'object', additionalProperties: s }, j + 1];
    }
    if (/^[A-Z]\w*$/.test(w) && tk[i + 1] !== '<') return [ref(w), i + 1];
    throw new Error(`scripts/schema.ts: a type it does not know, at "${tk.slice(i, i + 6).join(' ')}"`);
  }

  /** An object literal or an interface's body, from its "{": each field, its description, whether it may be left out. */
  function object(tk: string[], i: number): [Schema, number] {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    i++;
    while (tk[i] !== '}') {
      let doc = '';
      if (tk[i].startsWith('/**')) doc = tk[i++].slice(3);
      if (tk[i] === '}') break;
      const name = tk[i++];
      const optional = tk[i] === '?';
      if (optional) i++;
      if (tk[i++] !== ':') throw new Error(`scripts/schema.ts: a field it does not know, at "${name}"`);
      const [s, j] = type(tk, i);
      properties[name] = doc ? { description: doc, ...s } : s;
      if (!optional) required.push(name);
      i = j;
      if (tk[i] === ';' || tk[i] === ',') i++;
    }
    return [{ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false }, i + 1];
  }

  ref('Doc');
  for (let n = 0; n < wanted.length; n++) {
    const name = wanted[n];
    const { doc, body, iface } = decls.get(name)!;
    const [s] = iface ? object(body, 0) : type(body, 0);
    defs[name] = doc ? { description: doc, ...s } : s;
  }
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://raw.githubusercontent.com/aboard-io/tinylittleoffice/main/packages/doc/schema/tlo.schema.json',
    title: 'A Tiny Little Office document',
    description:
      'The kernel’s document (src/doc/model.ts) as JSON: what toJson gives and fromJson takes (src/api.ts; `tinyoffice json`). Written from the types by scripts/schema.ts (so a change is made there).',
    $ref: '#/$defs/Doc',
    $defs: Object.fromEntries(
      Object.keys(defs)
        .sort()
        .map((k) => [k, defs[k]]),
    ),
  };
  return JSON.stringify(schema, null, 2) + '\n';
}

const ROOT = resolve(import.meta.dirname, '..');
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  generate({ 'packages/doc/schema/tlo.schema.json': schemaOf(readFileSync(resolve(ROOT, 'src/doc/model.ts'), 'utf8')) }, 'npm run schema');
