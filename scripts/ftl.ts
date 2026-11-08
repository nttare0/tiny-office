/**
 * The .ftl files' shape, for the tooling (scripts/i18n-extract.ts, the tests) and never shipped: a file read into its
 * messages, a message written from its words, and the plural categories of a language. The app reads the files itself,
 * with @fluent/bundle (kit/core/i18n.ts); this reads them with @fluent/syntax, which keeps the comments the checks need
 * (the groups, `# same`, `# draft from`, `# en:`). No node imports: the browser tests use it too.
 *
 * The checks compare a message as its words on one line, its flat form: `{name}` a variable, `{n|one slide|# slides}`
 * a plural on $n with a form for each of the language's categories in CLDR's order (zero, one, two, few, many, other),
 * "#" standing for the number. A message in a file is Fluent:
 *
 *   download-downloaded-name = Downloaded { $name }
 *   example-n-slides = { $n ->
 *           [one] one slide
 *          *[other] { $n } slides
 *       }
 */
import { parse, serializeExpression, type Expression, type Message, type Pattern, type SelectExpression } from '@fluent/syntax';

/** The plural categories, in the order a flat plural gives its forms. */
export const ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** A language's plural categories in ORDER's order: en one, other; ru one, few, many, other; ja other; ar all six. */
export const pluralCategories = (code: string): string[] => {
  const cats: string[] = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  return ORDER.filter((c) => cats.includes(c));
};

/** Words as Fluent text: a brace is a placeable's, so one meant as a letter is quoted. */
const text = (s: string) => s.replace(/[{}]/g, (c) => `{ "${c}" }`);
/** Fluent drops the spaces round a pattern: spaces meant at either end, and a pattern of nothing, are quoted. */
const edges = (s: string) => (s === '' ? '{ "" }' : s.replace(/^ +| +$/g, (sp) => `{ "${sp}" }`));

/**
 * Flat words as a Fluent pattern, to follow "id = ": a variable `{ $name }`, a plural a select on the variable with a
 * variant for each of the language's categories, `*[other]` the default, "#" the number `{ $n }` (Intl.NumberFormat in
 * the language, as NUMBER writes it). A plural given fewer forms than the language has gives the rest its last.
 */
export function pattern(flat: string, code: string): string {
  let out = '';
  let last = 0;
  for (const m of flat.matchAll(/\{(\w+)(?:\|([^}]*))?\}/g)) {
    out += text(flat.slice(last, m.index));
    last = m.index + m[0].length;
    const [, name, forms] = m;
    if (forms === undefined) {
      out += `{ $${name} }`;
      continue;
    }
    const f = forms.split('|');
    const variants = pluralCategories(code).map((c, i) => `${c === 'other' ? '       *' : '        '}[${c}] ${edges(text(f[i] ?? f[f.length - 1]).replaceAll('#', `{ $${name} }`))}`);
    out += `{ $${name} ->\n${variants.join('\n')}\n    }`;
  }
  return edges(out + text(flat.slice(last)));
}

/** A message as lines of a file: its comment (`# ` a line, the English's hash among them), then `id = pattern`. */
export function message(id: string, flat: string, code: string, comment: string[] = []): string {
  return [...comment.map((c) => (c ? `# ${c}` : '#')), `${id} = ${pattern(flat, code)}`].join('\n');
}

const nameOf = (x: Expression): string | undefined =>
  x.type === 'VariableReference'
    ? x.id.name
    : x.type === 'FunctionReference' && x.id.name === 'NUMBER' && x.arguments.positional[0]?.type === 'VariableReference'
      ? x.arguments.positional[0].id.name
      : undefined;

function expression(x: Expression, code: string, counted?: string): string {
  switch (x.type) {
    case 'StringLiteral':
      return x.parse().value;
    case 'NumberLiteral':
      return x.value;
    case 'Placeable':
      return expression(x.expression, code, counted);
    case 'SelectExpression': {
      const name = nameOf(x.selector) ?? serializeExpression(x.selector);
      const by = new Map(x.variants.map((v) => [v.key.type === 'Identifier' ? v.key.name : v.key.value, flatOf(v.value, code, name)]));
      const fallback = flatOf(x.variants.find((v) => v.default)!.value, code, name);
      return `{${name}|${pluralCategories(code)
        .map((c) => by.get(c) ?? fallback)
        .join('|')}}`;
    }
    default: {
      const name = nameOf(x);
      if (name !== undefined) return name === counted ? '#' : `{${name}}`;
      return `{${serializeExpression(x)}}`;
    }
  }
}

/** A pattern's flat form; inside a plural on `counted`, that variable is "#". */
function flatOf(p: Pattern | null, code: string, counted?: string): string {
  if (!p) return '';
  return p.elements.map((e) => (e.type === 'TextElement' ? e.value : expression(e.expression, code, counted))).join('');
}

/** The plurals in a pattern: each select's variable and its variants' keys, the default's last. */
export function selects(p: Pattern | null): { name: string; keys: string[]; other: string }[] {
  const out: { name: string; keys: string[]; other: string }[] = [];
  const walk = (q: Pattern) => {
    for (const e of q.elements) {
      if (e.type !== 'Placeable') continue;
      let x: Expression = e.expression;
      while (x.type === 'Placeable') x = x.expression;
      if (x.type !== 'SelectExpression') continue;
      const s = x as SelectExpression;
      const key = (v: SelectExpression['variants'][number]) => (v.key.type === 'Identifier' ? v.key.name : v.key.value);
      out.push({ name: nameOf(s.selector) ?? serializeExpression(s.selector), keys: s.variants.map(key), other: key(s.variants.find((v) => v.default)!) });
      for (const v of s.variants) walk(v.value);
    }
  };
  if (p) walk(p);
  return out;
}

/** A message of a file, as the checks read it. */
export interface Entry {
  id: string;
  /** Its words, flat. */
  flat: string;
  /** Its comment's lines, `same` and a draft's mark among them. */
  comment: string[];
  /** The group it is under (`## the Spreadsheet`). */
  group: string;
  /** A translator decided it stays as the English: its comment has a line `same` (a name, a loanword). */
  same: boolean;
  /** The translation memory offered it and nobody has read it yet: its comment's `draft from <id>`. */
  draft?: string;
  /** The English it was translated from, as a hash: its comment's `en: <sha1>` (scripts/i18n-extract.ts `englishHash`). */
  en?: string;
  message: Message;
}

/** A .ftl file read: its messages in order, its groups, the head's lines, and what Fluent could not read. */
export function readFtl(source: string, code: string): { entries: Entry[]; groups: string[]; head: string[]; junk: string[] } {
  const res = parse(source, { withSpans: false });
  const entries: Entry[] = [];
  const groups: string[] = [];
  const head: string[] = [];
  const junk: string[] = [];
  let group = '';
  for (const e of res.body) {
    if (e.type === 'GroupComment') groups.push((group = e.content));
    else if (e.type === 'ResourceComment') head.push(e.content);
    else if (e.type === 'Junk') junk.push(e.content.trim());
    else if (e.type === 'Message') {
      const comment = e.comment ? e.comment.content.split('\n') : [];
      const draft = comment.find((l) => l.startsWith('draft from'));
      const en = comment
        .find((l) => l.startsWith('en: '))
        ?.slice(4)
        .trim();
      entries.push({ id: e.id.name, flat: flatOf(e.value, code), comment, group, same: comment.includes('same'), draft, en, message: e });
    }
  }
  return { entries, groups, head, junk };
}

/** A file's messages as id → flat words. */
export const flatMessages = (source: string, code: string): Record<string, string> => Object.fromEntries(readFtl(source, code).entries.map((e) => [e.id, e.flat]));
