/**
 * What a table's column holds, chosen from its menu: the one list of the types in the person's language (the
 * Spreadsheet's column menu and the Word Processor's table both offer it), the words an Option column offers
 * (a <datalist> of those its cells already hold), and the currency a money column names, asked for when Money
 * is picked (and picked again): one field, Currency, offering the common symbols and codes, and OK at its right.
 * Empty is none: the column's money is in the document's currency (its head's `currency:`), else "$". A person
 * types a symbol or a code, never the column head's syntax; the code writes `money(£)` or `money(GBP)`.
 */
import { html } from 'lit';
import { currencyOf, type ColType, type Column } from '../../doc/index.ts';
import type { ToDialog } from '../ui/dialog.ts';
import { t } from '../core/i18n.ts';
import type { MenuItem } from '../ui/menu.ts';
import '../ui/dialog.ts';

/** What a column may hold, in the person's language. */
export const COLUMN_KINDS: { id: ColType; name: () => string; hint: () => string }[] = [
  { id: 'text', name: () => t('common-text'), hint: () => t('sheet-shown-as-typed') },
  { id: 'number', name: () => t('sheet-number'), hint: () => '1,234.5' },
  { id: 'money', name: () => t('sheet-money'), hint: () => '$1,234.50' },
  { id: 'percent', name: () => t('sheet-percent'), hint: () => '12.5%' },
  { id: 'date', name: () => t('common-date'), hint: () => '2027-03-01' },
  { id: 'url', name: () => t('common-link'), hint: () => t('sheet-opens-when-clicked') },
  { id: 'check', name: () => t('sheet-checkbox'), hint: () => '☑ ☐' },
  { id: 'option', name: () => t('editor-option'), hint: () => t('editor-one-of-words-column-holds') },
  { id: 'rich', name: () => t('sheet-rich-text'), hint: () => t('editor-bold-italic-and-links') },
  { id: 'name', name: () => t('common-name'), hint: () => t('sheet-names-cell-to-its-right') },
];

/**
 * A column menu's types, under `group`, the one it holds checked. `set` is given the type picked; Money asks its
 * currency first (what the column names already in the field) and is given it ('' for the document's); closed
 * without OK, money in the currency it had.
 */
export function kindItems(col: Column | undefined, group: string, set: (type: ColType, currency?: string) => void): MenuItem[] {
  return COLUMN_KINDS.map((k) => ({
    group,
    label: k.name(),
    hint: k.hint(),
    checked: (col?.type ?? 'text') === k.id,
    does: () => {
      if (k.id !== 'money') return set(k.id);
      const had = col?.type === 'money' ? (col.currency ?? '') : '';
      void askCurrency(had).then((got) => set('money', got ?? had));
    },
  }));
}

/** The words an Option column offers: those its cells already hold, each once, in the order they first come (a formula's are its own). */
export const choicesOf = (rows: string[][], c: number): string[] => [...new Set(rows.map((row) => (row[c] ?? '').trim()).filter((x) => x && !x.startsWith('=')))];

/** The currencies offered as the field is typed in. */
const CURRENCIES = ['$', '£', '€', '¥', '₹', 'USD', 'EUR', 'GBP', 'JPY', 'INR', 'CNY', 'BRL', 'CAD', 'AUD', 'CHF'];

let n = 0;

/** The currency a money column names: resolves it ('' for none), or null when closed without OK. */
function askCurrency(now = ''): Promise<string | null> {
  return new Promise((done) => {
    const dialog = document.createElement('to-dialog') as ToDialog;
    const list = `to-currencies-${++n}`;
    dialog.heading = t('sheet-money');
    dialog.className = 'to-ask-dialog to-currency-dialog';
    let value = now;
    let answer: string | null = null;
    const ok = () => !value.trim() || currencyOf(value) !== null;
    const draw = () =>
      (dialog.body = html`<form
        class="to-ask to-currency"
        novalidate
        @submit=${(e: Event) => {
          e.preventDefault();
          if (!ok()) return;
          answer = value.trim() ? currencyOf(value)! : '';
          dialog.close();
        }}
      >
        <label class="to-currency-label" for=${`${list}-field`}>${t('looks-currency')}</label>
        <div class="to-ask-row">
          <input id=${`${list}-field`} class="to-ask-url to-currency-field" type="text" list=${list} .value=${value} placeholder="$" aria-invalid=${ok() ? 'false' : 'true'} autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" @input=${(e: Event) => ((value = (e.target as HTMLInputElement).value), draw())} />
          <button type="submit" class="to-btn primary to-ask-ok" ?disabled=${!ok()}>${t('common-ok')}</button>
        </div>
        <datalist id=${list}>${CURRENCIES.map((c) => html`<option value=${c}></option>`)}</datalist>
        ${ok() ? html`<p class="to-hint">${t('sheet-symbol-like-or-code-like')}</p>` : html`<p class="to-hint" role="alert">${t('sheet-symbol-of-up-to-three')}</p>`}
      </form>`);
    draw();
    dialog.addEventListener('to-close', () => {
      dialog.remove();
      done(answer);
    });
    document.body.append(dialog);
    void dialog.show().then(() => dialog.querySelector<HTMLInputElement>('.to-currency-field')?.focus());
  });
}
