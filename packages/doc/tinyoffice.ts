#!/usr/bin/env node
/**
 * tinyoffice: Tiny Little Office from the command line, for people and agents. Links from files, files from
 * links; over src/api.ts (the same module the site serves at /api.js), run by Node 24 as it is (no build).
 *
 *   tinyoffice apps                                   every app: id, name, what for
 *   tinyoffice templates <app>                        an app's templates: id and name
 *   tinyoffice template <app> <id>                    a template's document (TLO)
 *   tinyoffice link <app> [file]                      a link for a document (a file, or stdin)
 *   tinyoffice link <file.tlo>                        a link for a .tlo file (its app is in its head)
 *   tinyoffice link [app] --json <file.json>          a link for a document in JSON (its app, or the one in its head)
 *        --title T  --by B  --view pdf|show|embed|…  --display  --lang ht  --plain  --site URL
 *        --seal                                       under a password the app makes: the link, then
 *                                                     the password on a second line (send it another way)
 *   tinyoffice read <link>                            the document's TLO text (--json: app, view, title, by too,
 *                                                     and the document as JSON)
 *   tinyoffice json <link|file.tlo>                   the document as JSON: the kernel's own, to the schema in
 *                                                     schema/tlo.schema.json (also <app> <file>, or <app> and stdin)
 *   tinyoffice read --text <link|file.tlo>            what it says, as Markdown: what a screen reader reads
 *   tinyoffice file <link> [--as tlo|md|json|csv|…] [--out path|-]
 *                                                     the document as a file, named after its title (.tlo by default)
 *                                                     (--as webm: made in the browser; open the link, Download)
 *   tinyoffice diff <link> <link>                     what the second changed, block by block (exit 1 when they differ)
 *   tinyoffice lint <link|file.tlo> [--json]          what the eye would have seen, a line a finding:
 *                                                     app · slide or block · the finding · what to do (exit 1 on one)
 *   tinyoffice measure <link|file.tlo>                the sizes the layouts chose, page by page, and each table's
 *                                                     failing formulas, and whether the link fits in a short
 *                                                     link (short: {fits, over}), as JSON
 *        (read --text, lint and measure also take <app> <file>, or <app> and stdin)
 *   tinyoffice skill [--into <dir>] [--force]         the agent skill's SKILL.md on stdout; --into writes the skill's
 *                                                     folder, <dir>/tinyoffice/ (SKILL.md and references/), as Claude
 *                                                     Code reads a skills folder
 * The skill is the folder skill/tinyoffice/ (SKILL.md and references/*.md), written by `npm run skill` from its
 * template; the package carries it as dist/skill/tinyoffice/ (vite.cli.config.ts copies it there), and this reads
 * whichever sits beside it.
 * In the published package (npm: tinylittleoffice) it is dist/tinyoffice.js, this file bundled with all it
 * imports (vite.cli.config.ts), since Node strips no types under node_modules. What it says to `help` is USAGE.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps, compare, example, file, fromJson, fromTlo, lint, link, markdown, measure, PASSWORD_REFUSED, plain, read, shapes, templates, toJson, tryDraft } from '../../src/api.ts';
import { slug } from '../../src/kit/draw/draw.ts';

const USAGE = `tinyoffice (or tinylittleoffice, as npx runs it):

  tinyoffice apps                                   every app: id, name, what for
  tinyoffice templates <app>                        an app's templates: id and name
  tinyoffice template <app> <id>                    a template's document (TLO)
  tinyoffice link <app> [file]                      a link for a document (a file, or stdin)
  tinyoffice link <file.tlo>                        a link for a .tlo file (its app is in its head)
       --title T  --by B  --view pdf|show|embed|…  --display  --lang ht  --plain  --site URL
  tinyoffice read <link>                            the document's TLO text (--json: app, view, title, by too)
  tinyoffice read --text <link|file.tlo>            what it says, as Markdown: what a screen reader reads
  tinyoffice file <link> [--as tlo|md|csv|…] [--out path|-]
                                                    the document as a file, named after its title (.tlo by default)
                                                    (--as webm: made in the browser; open the link, Download)
  tinyoffice diff <link> <link>                     what the second changed, block by block (exit 1 when they differ)
  tinyoffice lint <link|file.tlo> [--json]          what the eye would have seen, a line a finding:
                                                    app · slide or block · the finding · what to do (exit 1 on one)
  tinyoffice measure <link|file.tlo>                the sizes the layouts chose, page by page, and each table's
                                                    failing formulas, and whether the link fits in a short
                                                    link (short: {fits, over}), as JSON
       (read --text, lint and measure also take <app> <file>, or <app> and stdin)

  tinyoffice shapes <app>                           the shapes an app reads, a line each: id, name, what for
  tinyoffice example <app> [shape] [--json]         the smallest document that shows a shape, its JSON (the
                                                    kernel's document), and what lint and measure say of it;
                                                    every shape of the app's without one
  tinyoffice try <app> <file|-> [--json]            a draft in one call: its lint, its measures and its JSON
                                                    (exit 1 when the lint finds something)
  tinyoffice skill [--into <dir>] [--force]         the agent skill's SKILL.md on stdout; --into <dir> writes the
                                                    skill's folder, <dir>/tinyoffice/ (SKILL.md and references/,
                                                    read as needed), refusing one already there unless --force.
                                                    For Claude Code:
                                                    npx tinylittleoffice skill --into ~/.claude/skills
`;

// Piped into `head`, the rest is not wanted: stop quietly.
process.stdout.on('error', (e: NodeJS.ErrnoException) => (e.code === 'EPIPE' ? process.exit(0) : die(e.message)));

const [cmd = '', ...rest] = process.argv.slice(2);
const flags: Record<string, string | true> = {};
const args: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) flags[a.slice(2)] = i + 1 < rest.length && !rest[i + 1].startsWith('--') && !['display', 'plain', 'json', 'text', 'seal', 'force'].includes(a.slice(2)) ? rest[++i] : true;
  else args.push(a);
}
const str = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);
const findingLine = (f: { app: string; at: string; words: string; fix: string }) => `${f.app} · ${f.at} · ${f.words} · ${f.fix}`;
const out = (s: string) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');
function die(message: string, code = 2): never {
  process.stderr.write(`tinyoffice: ${message}\n`);
  process.exit(code);
}
const words = (path?: string) => (path && path !== '-' ? (existsSync(path) ? readFileSync(path, 'utf8') : die(`no file ${path}`)) : readFileSync(0, 'utf8'));

/**
 * The skill's files, by their paths in its folder (SKILL.md, references/<name>.md): dist/skill/tinyoffice/ beside the
 * built command line in the package, else the repository's skill/tinyoffice/ beside this file's folder in a checkout
 * (its template left out). Never a copy of its own.
 */
function skillFiles(): Record<string, string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = [join(here, 'skill', 'tinyoffice'), join(here, '..', '..', 'skill', 'tinyoffice')].find((p) => existsSync(join(p, 'SKILL.md')));
  if (!dir) die('the skill is not here: in a checkout, npm run skill writes it');
  const refs = existsSync(join(dir, 'references'))
    ? readdirSync(join(dir, 'references'))
        .filter((f) => f.endsWith('.md'))
        .sort()
    : [];
  return Object.fromEntries(['SKILL.md', ...refs.map((f) => `references/${f}`)].map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
}

/** A document from a link, a .tlo file, or an app and a file (or stdin). */
function documentOf(): { app: string; text: string } {
  const [a, b] = args;
  if (!a) die('which link or file?');
  if (args.length === 1 && existsSync(a)) {
    const tlo = fromTlo(words(a));
    return tlo.app ? tlo : die(`${a} names no app in its head (app: deck); say which: tinyoffice ${cmd} <app> ${a}`);
  }
  if (/^https?:|#/.test(a)) return read(a);
  return { app: a, text: words(b) };
}

async function main() {
  switch (cmd) {
    case 'apps':
      for (const a of await apps()) out(`${a.id.padEnd(9)} ${a.name.padEnd(22)} ${a.blurb}`);
      return;
    case 'templates':
      for (const t of await templates(args[0] ?? die('which app?'))) out(`${t.id.padEnd(20)} ${t.name}`);
      return;
    case 'template': {
      const t = (await templates(args[0] ?? die('which app?'))).find((x) => x.id === args[1]);
      return out(t ? t.text : die(`no template "${args[1]}"; tinyoffice templates ${args[0]} lists them`));
    }
    case 'link': {
      if (flags.password !== undefined) die(PASSWORD_REFUSED);
      // --json: the document is JSON (its app given, or in its head). One argument that is a file: a .tlo, its app in
      // its head. Else the app, then the file (or stdin).
      const one = args.length === 1 && existsSync(args[0]) ? args[0] : null;
      const tlo = flags.json ? fromTlo(fromJson(words(one ?? args[1]))) : one ? fromTlo(words(one)) : null;
      const given = one ? undefined : args[0];
      const app = given || tlo?.app || die(one ? `${one} names no app in its head (app: sheet); say which: tinyoffice link <app> ${one}` : 'which app?');
      const text = tlo ? tlo.text : words(args[1]);
      const view = str('view');
      const site = str('site');
      if (flags.plain) return out(flags.seal ? die('a plain link cannot be sealed; leave out --plain') : plain(app, text, { title: str('title'), by: str('by'), view, site }));
      const opts = { title: str('title'), by: str('by'), view: view === 'show' ? '' : view, show: view === 'show', display: !!flags.display, lang: str('lang'), site };
      if (!flags.seal) return out(link(app, text, opts));
      const sealed = await link(app, text, { ...opts, seal: true });
      return out(`${sealed.url}\n${sealed.password}`);
    }
    case 'read': {
      if (flags.text) {
        const { app, text } = documentOf();
        return out(await markdown(app, text));
      }
      const r = read(args[0] ?? die('which link?'));
      return out(flags.json ? JSON.stringify({ ...r, json: JSON.parse(r.json) }, null, 2) : r.text);
    }
    case 'json':
      return out(toJson(documentOf().text));
    case 'file': {
      const r = read(args[0] ?? die('which link?'));
      const ext = str('as') ?? 'tlo';
      const data = await file(r.app, r.text, ext, { link: args[0] });
      const to = str('out') ?? `${slug(r.title) || r.app}.${ext}`;
      if (to === '-') return void process.stdout.write(data);
      writeFileSync(to, data);
      return out(to);
    }
    case 'diff': {
      const c = compare(args[0] ?? die('which links?'), args[1] ?? die('and the second?'));
      for (const ch of c.changes)
        out(
          ch.line
            .split('\n')
            .map((l, i) => `${i ? ' ' : ch.kind} ${l}`)
            .join('\n'),
        );
      if (!c.same) process.exitCode = 1;
      return;
    }
    case 'lint': {
      const { app, text } = documentOf();
      const found = await lint(app, text);
      if (flags.json) out(JSON.stringify({ findings: found }, null, 2));
      else for (const f of found) out(findingLine(f));
      if (found.length) process.exitCode = 1;
      return;
    }
    case 'measure': {
      const { app, text } = documentOf();
      return out(JSON.stringify(await measure(app, text), null, 2));
    }
    case 'shapes':
      for (const sh of await shapes(args[0] ?? die('which app? tinyoffice apps lists them'))) out(`${sh.id.padEnd(10)} ${sh.name}, ${sh.for}`);
      return;
    case 'example': {
      const all = await example(args[0] ?? die('which app? tinyoffice apps lists them'), args[1]);
      if (flags.json) return out(JSON.stringify(all, null, 2));
      for (const x of all) {
        const fence = x.text.includes('```') ? '````' : '```';
        out(
          [
            `## ${x.id}: ${x.name}`,
            x.for,
            `${fence}\n${x.text}${fence}`,
            `As a link: ${x.link}`,
            `The JSON:\n\n${JSON.stringify(x.json, null, 2)}`,
            `The lint: ${x.lint.length ? '\n' + x.lint.map(findingLine).join('\n') : 'clean'}`,
            `The measures:\n\n${JSON.stringify(x.measure, null, 2)}\n`,
          ].join('\n\n'),
        );
      }
      return;
    }
    case 'try': {
      const app = args[0] ?? die('which app? tinyoffice apps lists them');
      const t = await tryDraft(app, words(args[1] ?? die('which file? (- for stdin)')));
      if (flags.json) out(JSON.stringify(t, null, 2));
      else
        out(
          [
            `The lint: ${t.lint.length ? '\n' + t.lint.map(findingLine).join('\n') : 'clean'}`,
            `The measures:\n\n${JSON.stringify(t.measure, null, 2)}`,
            `The JSON:\n\n${JSON.stringify(t.json, null, 2)}`,
          ].join('\n\n'),
        );
      if (t.lint.length) process.exitCode = 1;
      return;
    }
    case 'skill': {
      const files = skillFiles();
      const into = str('into');
      if (flags.into === true) die("--into which folder? (for Claude Code, ~/.claude/skills or a project's .claude/skills)");
      if (!into) return void process.stdout.write(files['SKILL.md']);
      const folder = join(into, 'tinyoffice');
      if (existsSync(join(folder, 'SKILL.md')) && !flags.force) die(`${folder} is there already; --force replaces it`, 1);
      // Replaced whole: a reference of an earlier version that this one does not carry would be read as current.
      if (existsSync(join(folder, 'references'))) for (const f of readdirSync(join(folder, 'references'))) if (f.endsWith('.md') && !files[`references/${f}`]) rmSync(join(folder, 'references', f));
      for (const [f, text] of Object.entries(files)) {
        mkdirSync(dirname(join(folder, f)), { recursive: true });
        writeFileSync(join(folder, f), text);
      }
      return out(
        Object.keys(files)
          .map((f) => join(folder, f))
          .join('\n'),
      );
    }
    case '':
    case 'help':
    case '--help':
      return out(USAGE);
    default:
      die(`no command "${cmd}"\n\n${USAGE}`);
  }
}

main().catch((err: unknown) => die(err instanceof Error ? err.message : String(err), 2));
