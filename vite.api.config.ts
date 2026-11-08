/**
 * The API for programs and agents (src/api.ts) as an ES module the site serves at /api.js: a build of its own,
 * after the site's (npm run build), so it shares nothing with the pages and changes nothing they load. Two files:
 * /api.js, everything an import of it runs before its first call (the kernel, the codec, the routes), and one
 * file under /api/, its lazy part (the apps' definitions, templates and views for apps(), templates() and the
 * exports, the lint and the examples), fetched the first time one of those is asked for.
 *
 * Never an editor, never the chrome: the API leaves out, as an external import it never makes, what only a page
 * uses (PAGE_ONLY): a definition reaches its editor and its commands by a lazy import (`editor()`, `commands()`), which
 * a program never calls. With the editors out, no stylesheet is made: theirs are the only ones the API could reach.
 */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { ftlBare } from './scripts/ftl-plugin.ts';

/**
 * What only a page uses: an app's editor and its commands, the chrome (kit/ui/, the icon picker among it), and the
 * languages other than English (a program reads English).
 */
const PAGE_ONLY = /\/src\/(apps\/[^/]+\/(editor|commands)\.ts|kit\/ui\/[^/]+\.ts|i18n\/(?!en\.)[^/]+\.ftl(\?raw)?)$/;

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [ftlBare()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: true,
    lib: { entry: resolve(import.meta.dirname, 'src/api.ts'), formats: ['es'], fileName: () => 'api.js' },
    rollupOptions: {
      // No "//#region <path>" notes, which name where the modules were on the building machine (a checkout elsewhere,
      // node_modules linked in): a build is the same bytes wherever it is made (scripts/reproducible.ts).
      experimental: { attachDebugInfo: 'none' },
      // The entry may carry exports its lazy part shares with it, rather than be a facade over a third file.
      preserveEntrySignatures: 'allow-extension',
      external: (id: string) => PAGE_ONLY.test(id.replaceAll('\\', '/')),
      // A lazy import of a module the entry holds anyway is not a split, and is meant: no warning for each.
      checks: { ineffectiveDynamicImport: false },
      output: {
        chunkFileNames: 'api/[name]-[hash].js',
        // A library build keeps its whitespace unless told: the whole file minified, as the site's are.
        minify: true,
        // What the entry runs at once is one group, its file; everything else is the other, the one file under api/.
        codeSplitting: {
          groups: [
            { name: 'api', tags: ['$initial'], priority: 2 },
            { name: 'parts', priority: 1 },
          ],
        },
      },
    },
  },
});
