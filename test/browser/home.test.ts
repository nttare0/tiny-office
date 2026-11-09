// The home page's cards: a grid of the apps, each a card of its icon and name and nothing else — no
// Templates button, no Blank, no action — and a shared saved-documents section below. A card opens a small question, "How would you
// like to start?": Blank page goes to the app's own page, Use a template to the app's template gallery. The foot that
// stood under the apps ("An Aboard Foundry project… · Beta version · GitHub · Email") is gone, and the version with it.
import { afterEach, expect, test } from 'vitest';
import { cdp, page } from 'vitest/browser';
import { setLanguage } from '../../src/kit/core/i18n.ts';
import { keepSize, SIZE_MAX } from '../../src/kit/ui/zoom.ts';
import { preloadTemplates, type ToTemplates } from '../../src/kit/ui/home.ts';
import { firstLines } from './firstline.ts';
import { mount, until } from './helpers.ts';
import { encodeDoc } from '../../src/kit/core/codec.ts';

afterEach(async () => {
  keepSize(1);
  await setLanguage(null);
  await page.viewport(1100, 800);
});

/** The home page's cards, in the registry's order. */
const cards = (shell: HTMLElement) => [...shell.querySelectorAll<HTMLElement>('to-home .to-app')];

test('the home page is a grid of cards: each its icon and its name and nothing else, and no foot under them', async () => {
  const shell = await mount('');
  await until(() => !!shell.querySelector('to-home .to-app'));
  const apps = (await import('../../src/kit/core/apps.ts')).apps();
  const all = cards(shell);
  expect(all.map((c) => c.querySelector('.to-app-name')!.textContent)).toEqual(apps.map((a) => a.name));
  for (const [i, card] of all.entries()) {
    // A card is one link: its icon and its name, nothing else — no Templates, no Blank, no button of any kind.
    expect(card.querySelectorAll('a')).toHaveLength(1);
    expect(card.querySelectorAll('button')).toHaveLength(0);
    expect(card.textContent!.trim()).toBe(apps[i].name);
    expect(card.querySelector('.to-app-open svg')).not.toBeNull();
  }
  // The grid: more than one card in a row on a desktop.
  const rows = new Set(all.map((c) => Math.round(c.getBoundingClientRect().top)));
  expect(rows.size).toBeLessThan(all.length);
  // Nothing of the old foot, and no version asked for: the page reads no /version.json.
  expect(shell.querySelector('to-home footer, .to-home-foot')).toBeNull();
  expect(shell.querySelector('.to-library h2')!.textContent).toBe('Saved documents');
});

test('the home and saved library fit narrow phones, tablets and desktops', async () => {
  const { keep, forgetAll } = await import('../../src/kit/share/library.ts');
  const { setKeeping } = await import('../../src/kit/core/store.ts');
  setKeeping(true);
  forgetAll();
  try {
    keep({ id: 'responsive', app: 'deck', title: 'A very long saved document title for a small screen', hash: `#/v1/deck/${encodeDoc('Hello')}`, at: Date.now() });
    for (const width of [240, 320, 390, 768, 1440]) {
      await page.viewport(width, width <= 390 ? 640 : 800);
      const shell = await mount('');
      await until(() => !!shell.querySelector('.to-drive li'));
      const main = shell.querySelector<HTMLElement>('.to-main')!;
      const panel = shell.querySelector<HTMLElement>('.to-library')!;
      expect(main.scrollWidth, `${width}px main`).toBeLessThanOrEqual(main.clientWidth + 1);
      expect(panel.scrollWidth, `${width}px library`).toBeLessThanOrEqual(panel.clientWidth + 1);
      const all = cards(shell);
      for (const card of all) {
        const box = card.querySelector('.to-app-open')!.getBoundingClientRect();
        expect(box.width, `${width}px card`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${width}px card`).toBeGreaterThanOrEqual(44);
      }
      const first = all[0].getBoundingClientRect();
      const second = all[1].getBoundingClientRect();
      if (width === 240) expect(second.top).toBeGreaterThan(first.top);
      if (width === 320 || width === 390) expect(second.top).toBeCloseTo(first.top, 0);
      expect(panel.getBoundingClientRect().top).toBeGreaterThan(shell.querySelector('.to-apps')!.getBoundingClientRect().bottom);
      const search = panel.querySelector<HTMLInputElement>('.to-search')!;
      search.value = 'saved';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await until(() => !!panel.querySelector('.to-found-docs a'));
      expect(panel.scrollWidth, `${width}px search`).toBeLessThanOrEqual(panel.clientWidth + 1);
    }
  } finally {
    forgetAll();
    setKeeping(false);
  }
});

test('a card tapped asks how to start; Blank page opens the app’s own page, editing at once', async () => {
  const shell = await mount('');
  await until(() => !!shell.querySelector('to-home .to-app'));
  const card = cards(shell)[0].querySelector<HTMLElement>('.to-app-open')!;
  card.click();
  await until(() => !!shell.querySelector('to-start dialog[open]'), 'the question never opened');
  const dialog = shell.querySelector<HTMLDialogElement>('to-start dialog[open]')!;
  expect(dialog.querySelector('h2')!.textContent).toBe('How would you like to start?');
  expect(dialog.textContent).toContain('Start fresh with a blank page, or choose a ready-made template.');
  const blank = dialog.querySelector<HTMLButtonElement>('.to-start-blank')!;
  expect(blank.textContent).toBe('Blank page');
  expect(dialog.querySelector('.to-start-templates')!.textContent).toBe('Use a template');
  // Blank: the app's own page, at once, and the question gone.
  blank.click();
  await until(() => location.hash === '#/v1/write');
  await until(() => !dialog.open);
});

test('Use a template hands over to the app’s template gallery: the question closes, the gallery opens, and closing it gives the focus back to the card', async () => {
  const shell = await mount('');
  await until(() => !!shell.querySelector('to-home .to-app'));
  const card = cards(shell)[0].querySelector<HTMLElement>('.to-app-open')!;
  card.focus();
  card.click();
  await until(() => !!shell.querySelector('to-start dialog[open]'), 'the question never opened');
  const question = shell.querySelector<HTMLDialogElement>('to-start dialog[open]')!;
  question.querySelector<HTMLButtonElement>('.to-start-templates')!.click();
  await until(() => !!shell.querySelector('to-home dialog.to-templates-dialog[open]'), 'the gallery never opened');
  const gallery = shell.querySelector<HTMLDialogElement>('to-home dialog.to-templates-dialog[open]')!;
  expect(question.open, 'the question is still open').toBe(false);
  // The gallery is the app's own, with its Blank first and its templates.
  await until(() => gallery.querySelectorAll('[role=option]').length > 1);
  expect(gallery.querySelector('[role=option] .to-option-words span')!.textContent).toBe('Blank');
  expect(gallery.querySelector('.to-listbox-close')).not.toBeNull();
  // Closed, the card that asked has the focus again.
  gallery.querySelector<HTMLElement>('.to-listbox-close')!.click();
  await until(() => !gallery.open);
  await until(() => document.activeElement === card, 'the focus never came back to the card');
});

test('a card is a link: a press with a key, or a middle press, follows it without asking anything', async () => {
  const shell = await mount('');
  await until(() => !!shell.querySelector('to-home .to-app'));
  const card = cards(shell)[0].querySelector<HTMLAnchorElement>('.to-app-open')!;
  expect(card.getAttribute('href')).toBe('#/v1/write');
  // A modified click is not prevented: the link is the browser's to follow.
  const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  card.dispatchEvent(modified);
  expect(modified.defaultPrevented).toBe(false);
  expect(shell.querySelector('to-start dialog[open]'), 'a modified click asked').toBeNull();
  const middle = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 });
  card.dispatchEvent(middle);
  expect(middle.defaultPrevented).toBe(false);
  expect(shell.querySelector('to-start dialog[open]')).toBeNull();
});

// The templates dialog (Paul, 2026-10-11: "Align the previews to the far left"): each preview is its row's first column,
// flush with the dialog's content edge (the heading's), and at the top of its row beside the template's name, however
// long the blurb under the name; the Blank row's highlight is the same row, so its preview lines up with the others.
async function openTemplates(shell: HTMLElement, app: string) {
  await until(() => !!shell.querySelector('.to-app'));
  // The gallery the cards hand over to (home.ts): bare, the app given to it.
  const tpl = shell.querySelector<ToTemplates>('to-home to-templates')!;
  tpl.app = (await import('../../src/kit/core/apps.ts')).apps().find((a) => a.name === app)!;
  tpl.show();
  // Blank is drawn at once, its preview with it; the templates come with their file. Waiting on the first preview alone
  // measured Blank by itself when the file was slow (main, 2026-10-12: "no blurb taller than its preview: 0/94"), so
  // the wait is for the templates themselves, every one with its preview.
  await until(() => {
    const options = tpl.querySelectorAll('dialog[open] [role=option]');
    return options.length > 1 && [...options].every((o) => !!o.querySelector('svg'));
  });
  // Measured in the site's own type: the self-hosted faces are loaded before a height is read.
  await document.fonts.ready;
  return tpl;
}
/** Each preview against the heading's edge (the left, or the right in a right-to-left language) and its name's top. */
function previews(tpl: ToTemplates) {
  const rtl = getComputedStyle(tpl.dialog).direction === 'rtl';
  const h = tpl.dialog.querySelector('h2')!.getBoundingClientRect();
  return [...tpl.dialog.querySelectorAll<HTMLElement>('[role=option]')].map((o) => {
    const thumb = o.querySelector('.to-thumb')!.getBoundingClientRect();
    const name = o.querySelector('.to-option-words > span')!.getBoundingClientRect();
    const blurb = o.querySelector('small')?.getBoundingClientRect().height ?? 0;
    return { edge: rtl ? h.right - thumb.right : thumb.left - h.left, top: thumb.top - name.top, long: blurb > thumb.height, blurb, thumb: thumb.height };
  });
}

for (const [w, h] of [
  [390, 844],
  [1100, 800],
] as const)
  test(`at ${w}px each template's preview sits at the dialog's content edge and at the top of its row, beside its name`, async () => {
    await page.viewport(w, h);
    const tpl = await openTemplates(await mount(''), 'Word Processor');
    try {
      const rows = previews(tpl);
      // A blurb taller than the preview is there to be beside (Cover letter's five lines on a phone).
      if (w === 390)
        expect(
          rows.some((r) => r.long),
          `no blurb taller than its preview: ${rows.map((r) => `${Math.round(r.blurb)}/${Math.round(r.thumb)}`).join(' ')}`,
        ).toBe(true);
      // One column on a phone: every preview at the edge; two on a wide screen: the first column's.
      const edges = rows.map((r) => Math.round(r.edge));
      if (w === 390) expect(edges.every((e) => Math.abs(e) < 1)).toBe(true);
      else expect(Math.abs(Math.min(...edges))).toBeLessThan(1);
      for (const r of rows) expect(Math.abs(r.top)).toBeLessThan(2);
    } finally {
      tpl.hide();
    }
  });

test('right to left, the previews sit at the far right, at the top of their rows', async () => {
  await page.viewport(390, 844);
  const shell = await mount('');
  await setLanguage('ar');
  await until(() => document.documentElement.dir === 'rtl');
  const name = (await import('../../src/kit/core/apps.ts')).apps().find((a) => a.id === 'write')!.name;
  const tpl = await openTemplates(shell, name);
  try {
    for (const r of previews(tpl)) {
      expect(Math.abs(r.edge)).toBeLessThan(1);
      expect(Math.abs(r.top)).toBeLessThan(2);
    }
  } finally {
    tpl.hide();
  }
});

// The home page's cards (Paul, 2026-10-11: "Align the icons in the main menu to the top so they stay there when we zoom"):
// at 200% an app's name wraps between its words, and its icon stays beside the first line.
test('at the largest size on a phone, a card whose name wraps keeps its icon beside the first line', async () => {
  await page.viewport(390, 844);
  keepSize(SIZE_MAX);
  const shell = await mount('');
  await until(() => !!shell.querySelector('.to-app-open'));
  const rows = firstLines(shell.querySelector('.to-apps')!);
  expect(rows.filter((r) => r.wraps && r.beside).length).toBeGreaterThan(0);
  expect(rows.filter((r) => !r.beside && !r.under)).toEqual([]);
});

// The search over the documents (Paul, 2026-10-12: "Get rid of 'search your documents' if there are no documents or we
// are in private mode"): there only when Save in browser is on and something is kept.
test('no search box under Private, a library in memory or not; none when Saved with nothing kept; the box once one is kept', async () => {
  const { keep, forgetAll } = await import('../../src/kit/share/library.ts');
  const { setKeeping, store } = await import('../../src/kit/core/store.ts');
  const doc = { id: 'a', app: 'write', title: 'Plans', hash: `#/v1/write/${encodeDoc('---\ntitle: Plans\n---\nGo.\n')}`, at: Date.now() };
  try {
    // Private, a list written to the visit's memory as an old build did.
    setKeeping(false);
    store.set('tinyoffice.library', JSON.stringify([doc]));
    let shell = await mount('');
    await until(() => !!shell.querySelector('.to-app'));
    expect(shell.querySelector('.to-search')).toBeNull();
    expect(shell.querySelector('.to-drive')).toBeNull();
    // Saved, nothing kept.
    setKeeping(true);
    forgetAll();
    shell = await mount('');
    await until(() => !!shell.querySelector('.to-app'));
    expect(shell.querySelector('.to-search')).toBeNull();
    // Saved, one kept.
    keep(doc);
    shell = await mount('');
    await until(() => !!shell.querySelector('.to-search'));
    expect(shell.querySelector<HTMLInputElement>('.to-search')!.placeholder).toBe('Search your documents');
  } finally {
    forgetAll();
    setKeeping(false);
  }
});

test('saved documents from different apps appear together below the cards, newest first', async () => {
  const { keep, forgetAll } = await import('../../src/kit/share/library.ts');
  const { setKeeping } = await import('../../src/kit/core/store.ts');
  setKeeping(true);
  forgetAll();
  try {
    keep({ id: 'one', app: 'write', title: 'Notes', hash: `#/v1/write/${encodeDoc('Notes')}`, at: Date.now() - 1000 });
    keep({ id: 'two', app: 'sheet', title: 'Budget', hash: `#/v1/sheet/${encodeDoc('Budget')}`, at: Date.now() });
    const shell = await mount('');
    await until(() => shell.querySelectorAll('.to-drive li').length === 2);
    const grid = shell.querySelector('.to-apps')!.getBoundingClientRect();
    const panel = shell.querySelector('.to-library')!.getBoundingClientRect();
    expect(panel.top).toBeGreaterThan(grid.bottom);
    expect([...shell.querySelectorAll('.to-drive-words > span')].map((el) => el.textContent)).toEqual(['Budget', 'Notes']);
    expect(shell.querySelector('.to-drive-words small')!.textContent).toContain('Spreadsheet');
    expect(shell.querySelectorAll('.to-app .to-drive')).toHaveLength(0);
    expect(shell.querySelectorAll('.to-drive to-preview')).toHaveLength(2);
  } finally {
    forgetAll();
    setKeeping(false);
  }
});

// The wordmark stands on the apps' edge (Paul, 2026-10-12: "On desktop, keep the logo aligned with the list of apps
// below"): its first letter on the first app's icon's edge at every width, the header's start the column's start and the
// wordmark's margin the row's inset; at 390 the header is still one row, the wordmark beside the menu button.
for (const [w, h, lang] of [
  [1440, 900, null],
  [1100, 800, null],
  [900, 800, null],
  [390, 844, null],
  [1440, 900, 'ar'],
] as const)
  test(`at ${w}px${lang ? `, in ${lang}` : ''}, the wordmark's first letter stands on the first app's icon's edge, the header one row`, async () => {
    await page.viewport(w, h);
    const shell = await mount('');
    if (lang) {
      await setLanguage(lang);
      await until(() => document.documentElement.lang === lang);
    }
    await until(() => !!shell.querySelector('.to-app-open > .to-icon') && !!shell.querySelector('.to-header > .to-brand'));
    await document.fonts.ready;
    const brand = shell.querySelector<HTMLElement>('.to-header > .to-brand')!;
    const rtl = getComputedStyle(brand).direction === 'rtl';
    const text = document.createTreeWalker(brand, NodeFilter.SHOW_TEXT, (n) => (n.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)).nextNode()!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const words = range.getBoundingClientRect();
    const ico = shell.querySelector('.to-app-open > .to-icon')!.getBoundingClientRect();
    const off = rtl ? ico.right - words.right : words.left - ico.left;
    expect(Math.abs(off), `the wordmark ${off}px off the icon's edge`).toBeLessThan(1);
    // One row: the header its token's height, the words inside it and clear of the menu button.
    const header = shell.querySelector<HTMLElement>('.to-header')!;
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;display:block;height:var(--to-header-h)';
    header.append(probe);
    const rowH = probe.getBoundingClientRect().height;
    probe.remove();
    const hr = header.getBoundingClientRect();
    const burger = shell.querySelector('.to-burger')!.getBoundingClientRect();
    expect(Math.abs(hr.height - rowH), `header ${hr.height}px, a row ${rowH}px`).toBeLessThan(1);
    expect(words.top).toBeGreaterThanOrEqual(hr.top);
    expect(words.bottom).toBeLessThanOrEqual(hr.bottom);
    expect(rtl ? burger.right - words.left : words.right - burger.left, 'the wordmark runs under the menu button').toBeLessThanOrEqual(0);
  });

// A press at the spot the templates list opened under is not a choice for the first moment (Paul, 2026-10-12: "Sometimes
// when I click a template the link to an app underneath opens up"): the list's first rows land where the button was, and
// a double tap, a slow tap or a finger that pressed again chose Blank and opened the app. Real presses, through the
// browser's own input (touch emulated, as a phone's), at points in this frame mapped to the page's.
function onPage(x: number, y: number): { x: number; y: number } {
  const f = window.frameElement?.getBoundingClientRect();
  const s = f ? f.width / innerWidth : 1;
  return { x: (f?.left ?? 0) + x * s, y: (f?.top ?? 0) + y * s };
}
async function tap(x: number, y: number) {
  const p = onPage(x, y);
  await cdp().send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await cdp().send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function click(x: number, y: number, clickCount = 1) {
  const p = onPage(x, y);
  await cdp().send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount });
  await cdp().send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount });
}
/** The middle of an element, in this frame. */
const middle = (el: Element): [number, number] => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
};
/** A home page with the Outliner's card, and what to read after a press: the question, the gallery, where the page went. */
async function underPress(w: number, h: number) {
  await page.viewport(w, h);
  const shell = await mount('');
  await until(() => !!shell.querySelector('.to-app'));
  const card = shell.querySelector<HTMLElement>('.to-app[aria-label="Outliner"] .to-app-open')!;
  // The templates are in before the press, so the gallery does not grow under the finger while the test reads it.
  await preloadTemplates((await import('../../src/kit/core/apps.ts')).apps().find((a) => a.id === 'outline')!);
  return {
    shell,
    card,
    question: () => !!shell.querySelector('to-start dialog[open]'),
    gallery: () => !!shell.querySelector('to-home dialog.to-templates-dialog[open]'),
    hash: () => location.hash,
  };
}
const touch = (on: boolean) => cdp().send('Emulation.setTouchEmulationEnabled', on ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });

test('390×844 with a finger: a tap on a card asks how to start; a tap that lands on Blank page chooses it and nothing double-fires', async () => {
  await touch(true);
  try {
    const { card, question, hash } = await underPress(390, 844);
    const [x, y] = middle(card);
    await tap(x, y);
    await until(question, 'the question never opened');
    expect(hash(), 'a tap on the card went straight to the app').toBe('');
    // The question's own buttons are where they say they are, both within the dialog.
    const dialog = document.querySelector<HTMLDialogElement>('to-start dialog[open]')!;
    const blank = dialog.querySelector<HTMLElement>('.to-start-blank')!;
    const templates = dialog.querySelector<HTMLElement>('.to-start-templates')!;
    const box = dialog.getBoundingClientRect();
    for (const b of [blank, templates]) {
      const r = b.getBoundingClientRect();
      expect(r.left).toBeGreaterThanOrEqual(box.left - 0.5);
      expect(r.right).toBeLessThanOrEqual(box.right + 0.5);
      expect(r.height).toBeGreaterThanOrEqual(44 * 0.9);
    }
    // A tap on Blank page: the app's own page, editing.
    await tap(...middle(blank));
    await until(() => !question(), 'Blank page never closed the question');
    await until(() => hash().startsWith('#/v1/outline'), 'Blank page never opened the app');
  } finally {
    await touch(false);
    document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
  }
});

test('1100 wide with a mouse: Use a template closes the question and opens the app’s gallery, with its Blank first', async () => {
  const { shell, card, question, gallery } = await underPress(1100, 800);
  try {
    const [x, y] = middle(card);
    await click(x, y, 1);
    await until(question, 'the question never opened');
    const use = shell.querySelector<HTMLElement>('to-start dialog[open] .to-start-templates')!;
    await click(...middle(use));
    await until(gallery, 'the gallery never opened');
    expect(question(), 'the question is still open under the gallery').toBe(false);
    const list = shell.querySelector<HTMLElement>('to-home dialog.to-templates-dialog[open] .to-listbox')!;
    await until(() => !!list.querySelector('[role=option] svg'));
    expect(list.querySelector('[role=option] .to-option-words span')!.textContent).toBe('Blank');
    // A template chosen opens the app with that document, and the gallery closes.
    list.querySelectorAll<HTMLElement>('[role=option]')[1].click();
    await until(() => location.hash.startsWith('#/v1/outline/'), 'a template never opened the app');
  } finally {
    document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
  }
});
