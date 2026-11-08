/**
 * The npm package `tinylittleoffice` (packages/doc): Node runs the command line's .ts as it is in a checkout, but
 * strips no types under node_modules, so the package carries two built files instead, with no dependencies.
 *
 *   --mode api   packages/doc/dist/api.js: src/api.ts and everything it imports (the kernel, the apps' definitions,
 *                the layouts the lint reads, the examples) in one file; the package's import, `import { link }
 *                from 'tinylittleoffice'`, the Node twin of the site's /api.js
 *   --mode cli   packages/doc/dist/tinyoffice.js: the command line (packages/doc/tinyoffice.ts), importing ./api.js,
 *                and beside it dist/skill/tinyoffice/, the agent skill's folder (SKILL.md and references/*.md) as
 *                `npm run skill` wrote it, which `tinyoffice skill` prints or installs (a package carries only what
 *                is in its own folder)
 *
 * `npm run build:cli` makes both; the deploy makes them before it publishes, and test/package.test.ts packs the
 * package and installs it. What only a browser loads (the editors and their styles) is in api.js too, never run.
 */
import { defineConfig } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = resolve(import.meta.dirname, 'src/api.ts');
const SKILL = resolve(import.meta.dirname, 'skill/tinyoffice');
/** The skill's files, by their paths in its folder: SKILL.md and references/*.md, never its template. */
const skillFiles = () => [
  'SKILL.md',
  ...readdirSync(resolve(SKILL, 'references'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => `references/${f}`),
];

export default defineConfig(({ mode }) => ({
  publicDir: false,
  logLevel: 'warn',
  plugins:
    mode === 'api'
      ? []
      : [
          {
            name: 'skill',
            generateBundle() {
              for (const f of skillFiles()) this.emitFile({ type: 'asset', fileName: `skill/tinyoffice/${f}`, source: readFileSync(resolve(SKILL, f), 'utf8') });
            },
          },
        ],
  build: {
    target: 'node24',
    outDir: resolve(import.meta.dirname, 'packages/doc/dist'),
    emptyOutDir: mode === 'api',
    copyPublicDir: false,
    minify: false,
    ssr: mode === 'api' ? API : resolve(import.meta.dirname, 'packages/doc/tinyoffice.ts'),
    rollupOptions: {
      experimental: { attachDebugInfo: 'none' },
      external: mode === 'api' ? [] : [API],
      output: { entryFileNames: mode === 'api' ? 'api.js' : 'tinyoffice.js', codeSplitting: false, paths: { [API]: './api.js' } },
    },
  },
  // The packages' production builds (Lit's, for one, warns of its development build on every run otherwise).
  ssr: { noExternal: true, target: 'node', resolve: { conditions: ['node', 'production', 'import', 'module', 'default'] } },
}));
