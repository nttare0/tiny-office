// The document as JSON (src/doc/json.ts, src/api.ts toJson and fromJson): the kernel's own document, in and out,
// held to the schema generated from its types (scripts/schema.ts, packages/doc/schema/tlo.schema.json).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { fromJson, parse, toJson, write } from '../../src/api.ts';
import { apps } from '../../src/kit/core/apps.ts';
import { schemaOf } from '../../scripts/schema.ts';

const ROOT = join(import.meta.dirname, '../..');

test('every template of every app goes out as JSON and back as the same text, byte for byte', async () => {
  let n = 0;
  for (const app of apps())
    for (const tpl of await app.templates()) {
      const json = toJson(tpl.doc);
      expect(JSON.parse(json), `${app.id}/${tpl.id}`).toStrictEqual(JSON.parse(JSON.stringify(parse(tpl.doc))));
      expect(fromJson(json), `${app.id}/${tpl.id}`).toBe(write(parse(tpl.doc)));
      n++;
    }
  expect(n).toBeGreaterThan(40);
});

test('spaces are never lost: a space at a line’s end, a line break, an empty paragraph', () => {
  for (const text of ['Ends with a space\\ \n', 'One\nTwo\n', 'Above\n\n<br>\n\nBelow\n', '- [ ] Milk \\ \n  - [x] Eggs\n', 'A | B:money(€)\n--- | ---\n\\ x | =A1\n'])
    expect(fromJson(toJson(text))).toBe(write(parse(text)));
});

test('code goes out as a run with c and comes back as backticks', () => {
  const text = 'Run **`npx tlo`** now\n';
  expect(JSON.parse(toJson(text)).blocks[0].runs).toStrictEqual([{ t: 'Run ' }, { t: 'npx tlo', b: true, c: true }, { t: ' now' }]);
  expect(fromJson(toJson(text))).toBe(text);
});

test('the JSON is stable: keys in the order the types name them, the head’s and attributes’ in the document’s, two-space indent', () => {
  const json = toJson('---\ntitle: T\nby: B\n---\n# Hi {#top .big z=1 a=2}\n\n- [x] **Done**\n');
  expect(json).toBe(
    JSON.stringify(
      {
        head: { title: 'T', by: 'B' },
        blocks: [
          { k: 'h', level: 1, runs: [{ t: 'Hi' }], a: { id: 'top', cls: ['big'], kv: { z: '1', a: '2' } } },
          { k: 'li', depth: 0, done: true, runs: [{ t: 'Done', b: true }] },
        ],
      },
      null,
      2,
    ) + '\n',
  );
  expect(toJson(fromJson(json))).toBe(json);
});

test('a document that does not fit the schema throws, naming where', () => {
  const bad = (doc: unknown) => () => fromJson(JSON.stringify(doc));
  expect(bad({ head: {} })).toThrow(/\bblocks\b.*missing|missing.*\bblocks\b/);
  expect(bad({ head: {}, blocks: [{ k: 'p' }] })).toThrow(/blocks\[0\]\.runs/);
  expect(bad({ head: {}, blocks: [{ k: 'p', runs: [{ b: true }] }] })).toThrow(/blocks\[0\]\.runs\[0\]\.t/);
  expect(bad({ head: {}, blocks: [{ k: 'h', level: 7, runs: [] }] })).toThrow(/blocks\[0\]\.level/);
  expect(bad({ head: {}, blocks: [{ k: 'shape', runs: [] }] })).toThrow(/blocks\[0\]\.k/);
  expect(bad({ head: { title: 3 }, blocks: [] })).toThrow(/head\.title/);
  expect(bad({ head: {}, blocks: [{ k: 'hr', colour: 'red' }] })).toThrow(/blocks\[0\]\.colour/);
  expect(bad({ head: {}, blocks: [{ k: 'table', cols: [{ name: 'A', type: 'colour' }], rows: [] }] })).toThrow(/blocks\[0\]\.cols\[0\]\.type/);
  expect(() => fromJson('{ not json')).toThrow(/JSON/);
  expect(() => fromJson('[]')).toThrow();
});

test('the schema is generated from the kernel’s types, and what is checked in is what the script writes', () => {
  const committed = readFileSync(join(ROOT, 'packages/doc/schema/tlo.schema.json'), 'utf8');
  expect(committed).toBe(schemaOf(readFileSync(join(ROOT, 'src/doc/model.ts'), 'utf8')));
  const schema = JSON.parse(committed);
  expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(Object.keys(schema.$defs).sort()).toStrictEqual(['Attrs', 'Block', 'ColType', 'Column', 'Dir', 'Doc', 'Head', 'Run']);
  expect(schema.$defs.Block.oneOf.map((b: { properties: { k: { const: string } } }) => b.properties.k.const)).toStrictEqual(['h', 'p', 'li', 'quote', 'hr', 'table', 'fence', 'edge']);
});

test('the generator reads what the types say: a new field in the model is a new property in the schema', () => {
  const model = readFileSync(join(ROOT, 'src/doc/model.ts'), 'utf8').replace('  fn?: string;\n', '  fn?: string;\n  /** Its colour. */\n  c?: string;\n');
  const schema = JSON.parse(schemaOf(model));
  expect(schema.$defs.Run.properties.c).toStrictEqual({ description: 'Its colour.', type: 'string' });
  expect(schema.$defs.Run.required).toStrictEqual(['t']);
});
