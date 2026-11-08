// The build in dist/ within its budgets and of its shape (budgets.json, scripts/budgets.ts): one app file, one stylesheet,
// a templates file per app and a file per language in assets/ and nothing else; the app file lazy only for those; the
// API one file under api/ with no editor in it; every page naming the app file and the stylesheet in its head. Runs on the
// build in dist/ when there is one (after `npm run build`, whose last step is the same check); with none it has nothing
// to weigh. Not part of `npm run lint`, which the build runs before it builds: a build from before would be weighed.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { measure, overBudget, readBudgets, shapeOf } from '../scripts/budgets.ts';

const dist = join(import.meta.dirname, '../dist');

test.skipIf(!existsSync(join(dist, 'assets')))('the build in dist/ is within its budgets', () => {
  expect(overBudget(measure(dist), readBudgets())).toStrictEqual([]);
});

test.skipIf(!existsSync(join(dist, 'assets')))('the build in dist/ is of the design’s shape: one app file, fetched once', () => {
  expect(shapeOf(dist)).toStrictEqual([]);
});
