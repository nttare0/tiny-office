import { expect, test } from 'vitest';
import { chartPage } from '../src/kit/draw/chart.ts';

/** The bold labels of a Sankey (each bar's name), by column: their baselines in the order drawn. */
function labels(svg: string): Map<string, number[]> {
  const by = new Map<string, number[]>();
  for (const m of svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" font-size="12" font-weight="600"/g)) by.set(m[1], [...(by.get(m[1]) ?? []), +m[2]]);
  return by;
}

test('a column of thin bars keeps its labels apart: two lines each, none over another, none past the foot', () => {
  // One pay, one rent that takes most of it, and eight slivers: their bars stand a few pixels apart.
  const flows = [{ from: 'Pay', to: 'Rent', value: 4000 }, ...['Water', 'Gas', 'Phone', 'Bus', 'Lunch', 'Coffee', 'Paper', 'Stamps'].map((to) => ({ from: 'Pay', to, value: 20 }))];
  const p = chartPage({ labels: [], series: [], flows }, 'sankey', '', 720, 440);
  const by = labels(p.svg);
  expect(by.size).toBe(2);
  for (const ys of by.values()) {
    const sorted = [...ys].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(30);
    for (const y of sorted) expect(y + 15).toBeLessThanOrEqual(440);
  }
  // Every sink is named, and the sliver's amount still stands under its name.
  for (const to of ['Water', 'Stamps']) expect(p.svg).toContain(`>${to}</text>`);
  expect(p.alt).toContain('Pay → Stamps 20');
});

test('a column with room keeps each label beside its own bar', () => {
  const p = chartPage(
    {
      labels: [],
      series: [],
      flows: [
        { from: 'A', to: 'B', value: 1 },
        { from: 'A', to: 'C', value: 1 },
      ],
    },
    'sankey',
    'Two',
    720,
    440,
  );
  const [bars, names] = [[...p.svg.matchAll(/<rect x="(\d+)" y="([\d.]+)" width="14"/g)], labels(p.svg)];
  expect(bars.length).toBe(3);
  // The right column's two labels sit at their bars' tops (a tall bar's label is 60 down from its top, its name's baseline one more).
  const right = [...names.entries()].sort((a, b) => +a[0] - +b[0])[1][1];
  const tops = bars
    .filter((b) => b[1] !== '0')
    .map((b) => +b[2])
    .sort((a, b) => a - b);
  expect(right.sort((a, b) => a - b).map((y, i) => y - tops[i])).toEqual([61, 61]);
});
