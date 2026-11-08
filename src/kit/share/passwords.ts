/**
 * Every password, made here (Paul, 2026-10-11: "Only you can generate passwords for users. That keeps them
 * secure"): the Password dialog shows one and the API's seal returns one; nobody types a password to set it.
 * Twenty characters from an alphabet of 56 (letters and digits with the look-alikes l, I, 1, o, O and 0 left
 * out) chosen with crypto.getRandomValues by rejection, so every character is equally likely: about 116 bits,
 * which is why the key is one HKDF pass (kit/share/crypt.ts) and nothing measures a password's strength. Written in
 * four groups of five with dashes so it can be read aloud and typed on a phone; the dashes are part of it.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** `n` random characters of the alphabet, each chosen uniformly. */
function draw(n: number): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  const buf = new Uint8Array(n * 2);
  while (out.length < n) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) out.push(ALPHABET[b % ALPHABET.length]);
      if (out.length === n) break;
    }
  }
  return out.join('');
}

/** A new password: four groups of five, "k7Rwm-Xq9Pz-…". */
export function generatePassword(groups = 4, each = 5): string {
  return Array.from({ length: groups }, () => draw(each)).join('-');
}
