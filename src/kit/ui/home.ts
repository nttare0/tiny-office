/**
 * <to-home>: the apps, as a grid of cards, in the registry's order: each its icon and name and nothing else — no
 * template button, no Blank, no action of any kind on the card (2026-11-08: "no visible Templates, Blank, or other
 * action buttons inside the homepage cards"). A card tapped opens a small dialog, "How would you like to start?":
 * Blank page opens the app's own page, Use a template hands over to the app's template gallery, the same dialog the
 * app's row had (`<to-templates>`, drawn bare here so it has no button of its own), which reuses the app's own
 * templates and their previews. A modified click (a new tab, a window) is a link followed as ever: only a plain click
 * asks. The gallery is not opened before the choice, and neither is anything fetched for it.
 *
 * Under a card, the documents of that app kept on this device (kit/share/library.ts), newest first, each preview on
 * the edge of the app's icon (kit.css .to-drive). Each document shows its first page small at its left
 * (<to-preview>, drawn as it scrolls into sight: "When you list documents under apps, show them with
 * previews"). An app's templates are a file of their own, asked for when its list opens (Blank shown at once, the
 * rest added as they arrive, no spinner) or ahead of the tap, as a pointer comes over its row (`loadTemplates`);
 * offline, a file the service worker never kept is not there, and the list says so under Blank.
 * <to-templates> is the drawer's too: there a row's button (`via`) hands over to the drawer's one dialog
 * (`bare`, drawn outside the drawer's own), the drawer closing first (one modal at a time: kit/ui/drawer.ts).
 *
 * The foot that stood below the apps ("An Aboard Foundry project. Made with respect in New York City. · Beta version ·
 * GitHub · Email", Paul 2026-10-12) is gone, and the build's version with it (2026-11-08: "Remove the entire visible footer
 * line … including its appended build-version display"). The home page therefore asks for no /version.json: About, in the
 * drawer, still reads it (kit/ui/drawer.ts), which is where the build and the repository are said. About, the license and
 * the templates' translations are untouched by this.
 *
 * Above the apps, while Save in browser is on and something is kept, a search box over the library (kit/share/search.ts):
 * under Private there is nothing to search, so nothing says so (Paul, 2026-10-12). Every word of it
 * somewhere in a document's title or text, the best first, each found document with its title and the
 * lines that hold the words, the words marked. Each document's link is decoded once, when first searched.
 */
import { LitElement, html, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { AppDef, Template } from '../core/app.ts';
import { apps } from '../core/apps.ts';
import { decodeDoc, encodeDoc, isSealed } from '../core/codec.ts';
import { linesOf, search, type Seg } from '../share/search.ts';
import { icon, UI } from '../draw/icons.ts';
import { onLanguage, t } from '../core/i18n.ts';
import { hoverFocus, menuKey, OpeningPress, openedByPointer } from './menu.ts';
import { CROPPED, pageSvg } from '../draw/draw.ts';
import './preview.ts';
import { startEditing } from './chrome.ts';
import { go, parseHash, routeHash } from '../core/route.ts';
import { ago, forget, library, type Kept } from '../share/library.ts';
import { keeping, onPrivacy } from '../share/privacy.ts';
import { focusBack } from './dialog.ts';

/** Where to write: About's "email us" (kit/ui/drawer.ts). The home page's own foot is gone, but About still writes to it. */
export const MAIL = 'mailto:hello+tlo@aboard.com';

/** The documents shown under an app before "n more". */
const SHOWN = 5;

let n = 0;

/** Each app's templates once they have arrived, by its id: what the lists draw while they ask again. */
const arrived = new Map<string, Template[]>();
/** The apps whose templates a pointer has already asked for. */
const asking = new Map<string, Promise<Template[]>>();
// Their names are read in the language of the moment: a language chosen, they are asked for again.
let era = 0;
onLanguage(() => forgetTemplates());
/** The apps whose templates' file could not be fetched (offline, and never kept by the service worker). */
const unreached = new Set<string>();
/** An app's templates if they have arrived, else undefined. */
export const templatesOf = (app: AppDef): Template[] | undefined => arrived.get(app.id);
/** Whether an app's templates were asked for and could not be fetched: the list says so, and the next asking tries again. */
const templatesUnreached = (app: AppDef): boolean => unreached.has(app.id);
/** An app's templates, asked for: its file is fetched the first time (a pointer over its row asks ahead of the tap), and the names are read again in the language of the moment. Not fetched, none. */
async function loadTemplates(app: AppDef): Promise<Template[]> {
  const at = era;
  let list: Template[];
  try {
    list = await app.templates();
  } catch {
    asking.delete(app.id);
    if (at === era) unreached.add(app.id);
    return [];
  }
  unreached.delete(app.id);
  // A load that set out before a forgetting (a language chosen, a test's reset) does not land in the cache after it.
  if (at === era) arrived.set(app.id, list);
  return list;
}
/** Everything forgotten, and what is still on its way told not to land (a language chosen; the tests, between two that must not share). */
export function forgetTemplates(): void {
  era++;
  arrived.clear();
  asking.clear();
  unreached.clear();
}
/** Intent: a pointer over an app's row fetches its templates' file ahead of the tap, once, so its list is full as it opens (and the drawer's Find, once something is typed, asks for every app's). */
export function preloadTemplates(app: AppDef): Promise<Template[]> {
  let asked = asking.get(app.id);
  if (!asked) asking.set(app.id, (asked = loadTemplates(app)));
  return asked;
}

/** The link that opens an app with a template's document; Blank is the app's own page. */
export const templateHash = (app: AppDef, tpl: Template | null) => (tpl ? routeHash(app.id, encodeDoc(tpl.doc)) : routeHash(app.id));

export class ToTemplates extends LitElement {
  static properties = { app: { attribute: false }, via: { attribute: false }, bare: { type: Boolean }, chosen: { state: true }, drawn: { state: true }, list: { state: true } };
  declare app: AppDef;
  /** The button opens the templates through this instead of a dialog of its own (a drawer's row: kit/ui/drawer.ts). */
  declare via: ((app: AppDef) => void) | null;
  /** The dialog alone, no button: the one a drawer's rows hand over to. */
  declare bare: boolean;
  /** What had the focus as the dialog opened, for a bare one: it has it again when it closes. */
  private from: HTMLElement | null = null;
  /** The template's id, '' for Blank (or, with no Blank in the list, the first template). */
  declare chosen: string;
  /** The thumbnails are drawn once the list first opens: a home page of many apps costs nothing until then. */
  declare drawn: boolean;
  /** The app's templates once they have arrived (Blank is shown before). */
  declare list: Template[] | undefined;
  readonly uid = `to-templates-${++n}`;

  private off = () => {};
  /** The press that opened the list, which an option under it does not take for the first moment (menu.ts). */
  private press = new OpeningPress();
  /** Whether an option was chosen as it closed: a choice opens a document, which wants the focus for itself. */
  private picked = false;

  constructor() {
    super();
    this.chosen = '';
    this.drawn = false;
    this.via = null;
    this.bare = false;
  }
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    this.off = onLanguage(() => (this.drawn ? this.load() : this.requestUpdate()));
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.off();
  }
  /** Its button (none when `bare`). */
  get button(): HTMLButtonElement {
    return this.querySelector<HTMLButtonElement>(':scope > button')!;
  }
  get dialog(): HTMLDialogElement {
    return this.querySelector<HTMLDialogElement>(':scope > dialog')!;
  }
  get listbox(): HTMLElement {
    return this.querySelector<HTMLElement>(':scope > dialog [role=listbox]')!;
  }
  private options(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[role=option]')];
  }
  /** The app's templates asked for, and drawn when they arrive. */
  private load() {
    const app = this.app;
    this.list = templatesOf(app);
    void loadTemplates(app).then((list) => {
      if (this.app === app) this.list = list;
      this.requestUpdate();
    });
  }
  /** The list, over the whole screen (Paul, 2026-10-10: "a large modal that takes over the screen, don't cut them off based on where the invoking icon is"). */
  show() {
    const pointer = openedByPointer();
    this.drawn = true;
    this.load();
    const at = document.activeElement;
    this.from = at instanceof HTMLElement && at !== document.body ? at : null;
    void this.updateComplete.then(() => {
      if (this.dialog.open) return;
      this.dialog.showModal();
      this.press.open();
      if (!this.bare) this.button.setAttribute('aria-expanded', 'true');
      // Opened by a key, the chosen template has the focus; by a pointer (or before a list with no Blank has arrived), the list itself, and the first arrow goes in.
      if (pointer) this.listbox.focus({ preventScroll: true });
      else (this.options().find((o) => o.getAttribute('aria-selected') === 'true') ?? this.options()[0] ?? this.listbox).focus({ preventScroll: true });
    });
  }
  hide() {
    if (this.dialog.open) this.dialog.close();
  }
  private onClose = () => {
    const picked = this.picked;
    this.picked = false;
    if (!this.bare) this.button.setAttribute('aria-expanded', 'false');
    if (!picked && (document.activeElement === document.body || this.contains(document.activeElement))) void (this.bare ? focusBack(this.from) : this.button.focus());
    // A bare one is the home page's gallery (the card's question hands over to it): the card that asked hears that it
    // went, unless a document was chosen — that has the focus, and the page it opens is its own.
    if (this.bare && !picked) this.dispatchEvent(new CustomEvent('to-templates-handover', { bubbles: true, composed: true }));
  };
  /** A click in the dialog, before its option has it: the opening press again is nothing; on the backdrop, the list closes. */
  private onClick = { capture: true, handleEvent: (e: MouseEvent) => !this.press.stops(e) && e.target === this.dialog && this.hide() };
  /** The keys every menu here keeps (menu.ts). */
  private onKey = (e: KeyboardEvent) => menuKey(e, this.listbox, this.options(), () => this.hide());
  /** The id of the option shown chosen: '' is Blank, or the first template where the list has no Blank. */
  private get current(): string {
    return this.chosen || (this.app.blankInTemplates ? (this.list?.[0]?.id ?? '') : '');
  }
  private choose(tpl: Template | null) {
    this.chosen = tpl?.id ?? '';
    this.picked = true;
    this.hide();
    startEditing();
    go(templateHash(this.app, tpl));
  }
  private option(tpl: Template | null) {
    const id = tpl?.id ?? '';
    const name = tpl?.name ?? t('home-blank');
    const page = this.drawn ? this.app.view(tpl?.doc ?? this.app.blank(), { small: true, thumb: true })[0] : null;
    return html`<div role="option" class="to-option" tabindex="-1" aria-selected=${String(this.current === id)} @pointermove=${hoverFocus} @click=${() => this.choose(tpl)}>
      <span class="to-thumb" aria-hidden="true">${page ? unsafeSVG(pageSvg(page, CROPPED)) : nothing}</span>
      <span class="to-option-words"><span>${name}</span>${tpl?.blurb ? html`<small>${tpl.blurb}</small>` : nothing}</span>
    </div>`;
  }
  render() {
    const chosen = this.list?.find((x) => x.id === this.chosen);
    // The button is the small arrow alone, no icon and no words (Paul, 2026-10-09: "don't use the word Blank over and over"; 2026-10-10: "just the small arrow to the right"); its name says what it holds.
    const button = html`<button type="button" class="to-btn to-tool to-templates-btn" aria-haspopup="dialog" aria-expanded="false" aria-label=${chosen ? t('home-templates-for-app-name', { app: this.app.name, name: chosen.name }) : t('home-templates-for-app', { app: this.app.name })} title=${t('common-templates')} @click=${() => (this.via ? this.via(this.app) : this.show())}>
        ${icon(UI.down, 18, 'to-caret')}
      </button>`;
    if (this.via) return button;
    return html`${this.bare ? nothing : button}
      <dialog
        class="to-dialog to-templates-dialog"
        aria-label=${t('home-templates-for-app', { app: this.app.name })}
        @close=${this.onClose}
        @pointerdown=${this.press.down}
        @click=${this.onClick}
      >
        <div class="to-dialog-inner">
          <header class="to-dialog-head to-listbox-head"><h2 id=${this.uid}>${t('home-app-templates', { app: this.app.name })}</h2><button type="button" class="to-btn to-tool to-listbox-close" aria-label=${t('common-close')} title=${t('common-close')} @click=${() => this.hide()}>${icon(UI.close, 18)}</button></header>
          <div class="to-listbox" role="listbox" tabindex="-1" aria-label=${t('common-templates')} @keydown=${this.onKey}>
            ${this.drawn ? html`${this.app.blankInTemplates ? nothing : this.option(null)}${(this.list ?? []).map((tpl) => this.option(tpl))}` : nothing}
          </div>
          ${this.drawn && templatesUnreached(this.app) ? html`<p class="to-hint" role="status">${t('home-templates-are-not-saved-in')}</p>` : nothing}
        </div>
      </dialog>`;
  }
}
customElements.define('to-templates', ToTemplates);

/**
 * <to-start>: the question a card asks — "How would you like to start?" Blank page, or Use a template. It is a small
 * native <dialog>, drawn once per home page and given the app it is asking for; Blank page opens that app's own page,
 * Use a template closes the question and opens the app's template gallery, the one `<to-templates>` draws bare
 * (`bare`: no button of its own, drawn outside this dialog so only one modal is open at a time). The gallery's own
 * close puts the focus back on the card (the `to-templates-handover` event), which had it.
 */
class ToStart extends LitElement {
  static properties = { app: { attribute: false } };
  /** The app the question is asked for. */
  declare app: AppDef | null;
  /** The card that asked: it has the focus again when nothing was chosen. */
  private from: HTMLElement | null = null;
  constructor() {
    super();
    this.app = null;
  }
  createRenderRoot() {
    return this;
  }
  get dialog(): HTMLDialogElement {
    return this.querySelector<HTMLDialogElement>(':scope > dialog')!;
  }
  /** The question, asked for `app`: the card that asked has the focus again when it closes. */
  show(app: AppDef, from: HTMLElement | null) {
    this.app = app;
    this.from = from;
    void this.updateComplete.then(() => {
      if (!this.dialog.open) this.dialog.showModal();
      // A dialog opened from a click has the focus on its first control: Blank page, the plain choice first.
      this.querySelector<HTMLElement>('.to-start-blank')?.focus({ preventScroll: true });
    });
  }
  hide() {
    if (this.dialog.open) this.dialog.close();
  }
  private onClose = () => {
    const at = document.activeElement;
    if (!at || at === document.body || this.contains(at)) focusBack(this.from);
  };
  /** Blank page: the app's own page, as the card's link was, editing at once. */
  private blank() {
    const app = this.app;
    if (!app) return;
    this.hide();
    startEditing();
    go(routeHash(app.id));
  }
  /** Use a template: the question closes, the app's template gallery opens over the page and reads the focus back here when it goes. */
  private templates() {
    const app = this.app;
    const from = this.from;
    this.hide();
    if (!app) return;
    void this.updateComplete.then(() => {
      const gallery = document.querySelector<ToTemplates>('to-home to-templates[bare]');
      if (!gallery) return;
      gallery.app = app;
      gallery.addEventListener('to-templates-handover', () => focusBack(from), { once: true });
      gallery.show();
    });
  }
  render() {
    return html`<dialog class="to-dialog to-start-dialog" aria-label=${this.app ? t('home-start-noun', { noun: this.app.noun }) : nothing} @close=${this.onClose} @click=${(e: MouseEvent) => e.target === this.dialog && this.hide()}>
      <div class="to-dialog-inner">
        <header class="to-dialog-head"><h2>${t('home-how-would-you-like-to-start')}</h2><button type="button" class="to-btn to-tool" aria-label=${t('common-close')} title=${t('common-close')} @click=${() => this.hide()}>${icon(UI.close, 18)}</button></header>
        <div class="to-dialog-body to-start-body">
          <p class="to-start-words">${t('home-start-fresh-with-a-blank')}</p>
          <div class="to-start-choices">
            <button type="button" class="to-btn primary to-start-blank" @click=${() => this.blank()}>${t('home-blank-page')}</button>
            <button type="button" class="to-btn to-start-templates" @click=${() => this.templates()}>${t('home-use-a-template')}</button>
          </div>
        </div>
      </div>
    </dialog>`;
  }
}
customElements.define('to-start', ToStart);

/** A kept document's lines, by its link: decoded once a visit. */
const linesCache = new Map<string, string[]>();
function keptLines(k: Kept): string[] {
  let lines = linesCache.get(k.hash);
  if (!lines) {
    const text = decodeDoc(parseHash(k.hash).payload) ?? '';
    try {
      lines = text ? linesOf(text) : [];
    } catch {
      lines = [];
    }
    linesCache.set(k.hash, lines);
  }
  return lines;
}
/** Stretches of words, the found ones marked. */
const segs = (s: Seg[]) => s.map((x) => (x.hit ? html`<mark>${x.t}</mark>` : x.t));

export class ToHome extends LitElement {
  static properties = { unfolded: { state: true }, query: { state: true } };
  /** What the search box holds. */
  declare query: string;
  /** The apps whose whole list of documents is shown, past the first five. */
  declare unfolded: Set<string>;
  private offs: (() => void)[] = [];
  private redraw = () => this.requestUpdate();
  private onVisible = () => document.visibilityState === 'visible' && this.redraw();

  constructor() {
    super();
    this.unfolded = new Set();
    this.query = '';
  }
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('pageshow', this.redraw);
    document.addEventListener('visibilitychange', this.onVisible);
    this.offs = [onLanguage(this.redraw), onPrivacy(this.redraw), () => window.removeEventListener('pageshow', this.redraw), () => document.removeEventListener('visibilitychange', this.onVisible)];
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    for (const off of this.offs) off();
  }
  private forget(k: Kept) {
    forget(k.id);
    this.redraw();
  }
  /** An app's kept documents, newest first: five, then "n more". Nothing kept, nothing shown. */
  private drive(app: AppDef, kept: Kept[]) {
    if (!kept.length) return nothing;
    const all = this.unfolded.has(app.id);
    const shown = all ? kept : kept.slice(0, SHOWN);
    const lang = document.documentElement.lang;
    return html`<ul class="to-drive" aria-label=${t('home-app-documents', { app: app.name })}>
        ${shown.map((k) => {
          const title = k.title || (isSealed(parseHash(k.hash).payload) ? t('common-locked-document') : t('common-untitled'));
          return html`<li>
            <a class="to-drive-open" href=${k.hash}><to-preview hash=${k.hash}></to-preview><span class="to-drive-words"><span>${title}</span><small>${ago(k.at, lang)}</small></span></a>
            <button type="button" class="to-btn to-tool" aria-label=${t('home-forget-title', { title })} title=${t('common-forget')} @click=${() => this.forget(k)}>${icon(UI.close, 16)}</button>
          </li>`;
        })}
      </ul>
      ${kept.length > SHOWN && !all ? html`<button type="button" class="to-btn to-drive-more" @click=${() => (this.unfolded = new Set([...this.unfolded, app.id]))}>${t('home-n-more', { n: kept.length - SHOWN })}</button>` : nothing}`;
  }
  /** The kept documents the search finds, the best first: the title and up to two lines, the words marked. */
  private renderFound(kept: Kept[]) {
    const names = new Map(apps().map((a) => [a.id, a]));
    const docs = kept.filter((k) => names.has(k.app)).map((k) => ({ id: k.id, title: k.title || t('common-untitled'), app: names.get(k.app)!.name, folder: '', lines: keptLines(k), at: k.at }));
    const found = search(docs, this.query);
    const byId = new Map(kept.map((k) => [k.id, k]));
    if (!found.length) return html`<p class="to-hint" role="status">${t('home-no-document-here-has-those')}</p>`;
    return html`<p class="sr-only" role="status">${t('home-n-documents-found', { n: found.length })}</p>
      <ul class="to-found-docs" aria-label=${t('home-documents-found')}>
        ${found.map((f) => {
          const k = byId.get(f.id)!;
          const a = names.get(k.app)!;
          return html`<li><a href=${k.hash}><b>${segs(f.title)}</b> <small>${a.name} · ${ago(k.at, document.documentElement.lang)}</small>${f.context.map((c) => html`<small>${segs(c)}</small>`)}</a></li>`;
        })}
      </ul>`;
  }
  /**
   * A card's link, tapped: the question it asks. A tap meant for a link itself — a key with it (a new tab, a window), or
   * another button — is a link followed as ever, with nothing asked.
   */
  private ask = (e: MouseEvent, app: AppDef) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    this.querySelector<ToStart>('to-start')!.show(app, e.currentTarget as HTMLElement | null);
  };
  render() {
    const kept = library();
    const want = this.query.trim();
    return html`<div class="to-home">
      <h1 class="sr-only">${t('common-tiny-little-office')}</h1>
      ${
        keeping() && kept.length
          ? html`<input class="to-search" type="search" placeholder=${t('home-search-your-documents')} aria-label=${t('home-search-your-documents')} autocomplete="off" .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), this.querySelector<HTMLElement>('.to-found-docs a')?.click())} />`
          : nothing
      }
      ${want ? this.renderFound(kept) : nothing}
      <div class="to-apps" ?hidden=${!!want}>
        ${apps().map(
          (a) => html`<section class="to-app" aria-label=${a.name}>
            <a class="to-app-open" href=${routeHash(a.id)} @click=${(e: MouseEvent) => this.ask(e, a)}>${icon(a.icon, 20)}<span class="to-app-name">${a.name}</span></a>
            ${this.drive(
              a,
              kept.filter((k) => k.app === a.id),
            )}
          </section>`,
        )}
      </div>
      <to-start></to-start>
      <to-templates bare></to-templates>
    </div>`;
  }
}
customElements.define('to-home', ToHome);
