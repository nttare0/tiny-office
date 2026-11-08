/**
 * The one voice: anything says something with toast('Link copied'), and the page's <to-toast> (kit/ui/toast.ts)
 * shows the words and says them. An event on the window, so what speaks needs no element: a format's builder in
 * kit/file/exports.ts speaks through it in the page, and the API (src/api.ts), which has no page, carries no chrome.
 */
export const TOAST = 'to-toast';
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST, { detail: message }));
}
