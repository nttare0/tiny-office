/**
 * A language's file as a page fetches it (vite.config.ts, vite.api.config.ts): the .ftl without its comments. The
 * groups, the notes on what a message means, `# same` and `# en: <sha1>` are for translators and the checks
 * (scripts/i18n-extract.ts); Fluent reads none of them, so a build leaves them out, and a translation carries no bytes
 * of its bookkeeping. A comment is a line beginning "#": a pattern's lines go on indented, so none is touched.
 */
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** The file's text without its comment lines and the blank lines they leave. */
export const bare = (source: string): string =>
  source
    .split('\n')
    .filter((l) => !l.startsWith('#'))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim() + '\n';

export const ftlBare = (): Plugin => ({
  name: 'tinyoffice-ftl-bare',
  apply: 'build',
  enforce: 'pre',
  load(id) {
    const path = /^(.*\/src\/i18n\/[^/]+\.ftl)\?raw$/.exec(id.replaceAll('\\', '/'))?.[1];
    return path ? `export default ${JSON.stringify(bare(readFileSync(path, 'utf8')))};` : undefined;
  },
});
