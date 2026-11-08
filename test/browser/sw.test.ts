// Offline through Save in browser (kit/share/offline.ts): under Private nothing registers a service worker, at load or
// when any other switch is turned; turned on (the drawer's switch, as a person turns it) or on at load, the site's
// worker registers, at the site's root; turned off, every registration goes and every cache the worker made is deleted,
// and no one else's. The browser's worker API is faked, so a registration is counted rather than made (the worker
// itself, on the built site, is e2e/offline.spec.ts's); the caches are the browser's own. Runs alone (vitest.config.ts):
// it turns Saved on and off.
import { test, expect, afterEach, vi } from 'vitest';
import { mount, until } from './helpers.ts';
import { keeping, setKeeping } from '../../src/kit/core/store.ts';
import { offlineAtLoad } from '../../src/kit/share/offline.ts';

const real = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
afterEach(async () => {
  if (real) Object.defineProperty(navigator, 'serviceWorker', real);
  else delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  vi.restoreAllMocks();
  setKeeping(false);
  for (const k of await caches.keys()) await caches.delete(k);
});

/** A fake worker API: what registered, and each registration's unregister. */
function fakeWorkers() {
  const registrations: { scriptURL: string; unregister: () => Promise<boolean> }[] = [];
  const register = vi.fn(async (url: string | URL) => {
    const r = { scriptURL: String(url), unregister: vi.fn(async () => (registrations.splice(registrations.indexOf(r), 1), true)) };
    registrations.push(r);
    return r;
  });
  Object.defineProperty(navigator, 'serviceWorker', { value: { register, ready: new Promise(() => {}), controller: null, getRegistrations: async () => [...registrations] }, configurable: true });
  return { register, registrations };
}

/** The drawer's switches, opened as a person opens them: Save in browser first. */
async function switches(): Promise<HTMLInputElement[]> {
  const shell = await mount('#/v1/outline');
  shell.querySelector<HTMLButtonElement>('.to-burger')!.click();
  await until(() => shell.querySelector<HTMLDialogElement>('dialog.to-drawer')!.open);
  return [...shell.querySelectorAll<HTMLInputElement>('.to-drawer input[role=switch]')];
}
const turn = (box: HTMLInputElement) => {
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};

test('under Private nothing registers: not at load, and not when every other switch is turned', async () => {
  const { register } = fakeWorkers();
  await offlineAtLoad();
  const [saved, ...others] = await switches();
  expect(saved.checked).toBe(false);
  for (const box of others) turn(box);
  await offlineAtLoad();
  expect(register).not.toHaveBeenCalled();
  expect(await navigator.serviceWorker.getRegistrations()).toEqual([]);
});

test('Save in browser turned on registers the worker at the site’s root; on at load, it registers again', async () => {
  const { register } = fakeWorkers();
  const [saved] = await switches();
  turn(saved);
  await until(() => register.mock.calls.length === 1, 'the worker never registered');
  expect(keeping()).toBe(true);
  expect(String(register.mock.calls[0][0])).toMatch(/\/sw\.js$/);
  await offlineAtLoad();
  expect(register).toHaveBeenCalledTimes(2);
});

test('Save in browser turned off: no registration and none of the worker’s caches remain; another cache of the origin stays', async () => {
  const { registrations } = fakeWorkers();
  setKeeping(true);
  await offlineAtLoad();
  expect(registrations.length).toBe(1);
  await (await caches.open('tlo-0123456789ab')).put('/kept', new Response('kept'));
  await (await caches.open('someone-else')).put('/theirs', new Response('theirs'));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const [saved] = await switches();
  expect(saved.checked).toBe(true);
  turn(saved);
  await until(() => registrations.length === 0, 'the worker was never unregistered');
  await expect.poll(() => caches.keys()).toEqual(['someone-else']);
  expect(keeping()).toBe(false);
});
