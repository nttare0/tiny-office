// The YAML reader the workflow tests parse .github with (test/repository.test.ts, test/deploy.test.ts).
/**
 * The YAML a workflow, an issue form and dependabot.yml are written in: block mappings and sequences by indentation
 * (two spaces), plain, quoted and `|` block scalars, flow sequences of scalars, and a comment after a plain scalar
 * (`uses: actions/checkout@<hash> # v5.1.0`). Anything else throws, so a file
 * that parses here is YAML GitHub reads the same way.
 */
export function yaml(text: string): unknown {
  const lines = text.split('\n');
  let i = 0;
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const skip = () => {
    while (i < lines.length && (!lines[i].trim() || lines[i].trimStart().startsWith('#'))) i++;
  };
  const scalar = (s: string): unknown => {
    s = s.trim();
    if (!/^['"]/.test(s)) s = s.replace(/\s+#.*$/, '');
    if (/^'.*'$/.test(s)) return s.slice(1, -1).replaceAll("''", "'");
    if (/^".*"$/.test(s)) return JSON.parse(s);
    if (/^\[.*\]$/.test(s)) return s.slice(1, -1).trim() ? s.slice(1, -1).split(',').map(scalar) : [];
    if (/^[[{"'&*!%@`]/.test(s) || /\s#/.test(s) || /:\s/.test(s)) throw new Error(`line ${i}: a scalar this reader does not take: ${s}`);
    return s === 'true' ? true : s === 'false' ? false : /^-?\d+$/.test(s) ? Number(s) : s;
  };
  const block = (at: number): string => {
    const out: string[] = [];
    while (i < lines.length && (!lines[i].trim() || indentOf(lines[i]) > at)) out.push(lines[i++]);
    while (out.length && !out.at(-1)!.trim()) out.pop();
    const cut = Math.min(...out.filter((l) => l.trim()).map(indentOf));
    return out.map((l) => l.slice(cut)).join('\n') + '\n';
  };
  const node = (at: number): unknown => {
    skip();
    if (i >= lines.length) return null;
    const first = lines[i];
    if (first.includes('\t')) throw new Error(`line ${i + 1}: a tab`);
    if (indentOf(first) !== at) throw new Error(`line ${i + 1}: indented ${indentOf(first)}, not ${at}`);
    if (first.trimStart().startsWith('- ') || first.trim() === '-') {
      const list: unknown[] = [];
      while ((skip(), i < lines.length) && indentOf(lines[i]) === at && lines[i].trimStart().startsWith('-')) {
        const rest = lines[i].trimStart().slice(1).trimStart();
        if (/^[\w.-]+:(\s|$)/.test(rest)) {
          lines[i] = ' '.repeat(at + 2) + rest;
          list.push(node(at + 2));
        } else {
          i++;
          list.push(scalar(rest));
        }
      }
      return list;
    }
    const map: Record<string, unknown> = {};
    while ((skip(), i < lines.length) && indentOf(lines[i]) === at) {
      const m = /^([\w.-]+|'[^']*'):(?:\s+(.*))?$/.exec(lines[i].trim());
      if (!m) throw new Error(`line ${i + 1}: not a key: ${lines[i].trim()}`);
      const key = m[1].replace(/^'|'$/g, '');
      if (key in map) throw new Error(`line ${i + 1}: ${key} twice`);
      i++;
      if (m[2] === '|') map[key] = block(at);
      else if (m[2] !== undefined) map[key] = scalar(m[2]);
      else {
        skip();
        map[key] = i < lines.length && indentOf(lines[i]) > at ? node(indentOf(lines[i])) : null;
      }
    }
    return map;
  };
  const doc = node(0);
  skip();
  if (i < lines.length) throw new Error(`line ${i + 1}: left over: ${lines[i]}`);
  return doc;
}
