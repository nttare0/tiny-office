// A language, chosen in the drawer: the shell draws again in it, and <html lang> follows.
import { test, expect } from 'vitest';
import { register, setLanguage } from '../../src/kit/core/i18n.ts';
import { mount, until } from './helpers.ts';

test('an in-memory Spanish file takes over the shell when chosen', async () => {
  register(
    'es',
    `common-tiny-little-office = Oficinita Diminuta
drawer-find-app-template-or-command = Buscar app, plantilla o comando
shell-menu = Menú
common-word-processor = Procesador de textos
home-templates-for-app = Plantillas de { $app }
drawer-language = Idioma
drawer-match-device = Como el dispositivo
`,
  );
  const shell = await mount('');
  shell.querySelector<HTMLButtonElement>('.to-burger')!.click();
  await until(() => shell.querySelector<HTMLDialogElement>('dialog.to-drawer')!.open);
  const select = [...shell.querySelectorAll<HTMLSelectElement>('.to-drawer select')].find((s) => [...s.options].some((o) => o.value === 'es'))!;
  const es = [...select.options].find((o) => o.value === 'es')!;
  expect(es.textContent).toBe('Español');
  select.value = 'es';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.documentElement.lang === 'es');
  expect(document.documentElement.dir).toBe('ltr');
  await until(() => shell.querySelector<HTMLInputElement>('.to-find')!.placeholder === 'Buscar app, plantilla o comando');
  expect(shell.querySelector('.to-burger')!.getAttribute('aria-label')).toBe('Menú');
  // The name itself is said in the language (Paul, 2026-10-10).
  await until(() => shell.querySelector('.to-header .to-brand')!.textContent!.trim() === 'Oficinita Diminuta');
  await until(() => document.title === 'Oficinita Diminuta');
  expect(shell.querySelector('.to-app-name')!.textContent).toBe('Procesador de textos');
  // A card has no button of its own: what it opens is said in the language too (kit/ui/home.ts to-start).
  shell.querySelector<HTMLElement>('.to-app-open')!.click();
  await until(() => !!shell.querySelector('to-start dialog[open]'));
  expect(shell.querySelector('to-start h2')!.textContent).toBe('¿Cómo quieres empezar?');
  expect(shell.querySelector('.to-start-blank')!.textContent).toBe('Página en blanco');
  expect(shell.querySelector('.to-start-templates')!.textContent).toBe('Usar una plantilla');
  (shell.querySelector('to-start dialog') as HTMLDialogElement).close();
  await setLanguage(null);
  await until(() => document.documentElement.lang === 'en');
  expect(shell.querySelector('.to-app-name')!.textContent).toBe('Word Processor');
});
