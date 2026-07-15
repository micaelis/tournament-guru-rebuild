import { customAlphabet } from "nanoid";

/**
 * URL-token generator — unguessable, URL-safe. Length 32 lands
 * ~190 bits of entropy, well above brute-force reach; longer than the
 * spec's 32 char but the spec was tied to a Bubble limit that isn't
 * a real one here. Used for the `?promo=` landing token.
 */
export const generatePromoToken = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
  32,
);

/**
 * Pretty display code — 8 characters, letters + numbers only, spec
 * verbatim. Characters that look like each other (0/O, 1/I/L) are
 * kept in the set intentionally: the pretty code is shown to the user
 * as text (not typed) via a chip, so legibility isn't an issue. If a
 * "share this code verbally" flow lands later, swap the alphabet
 * here.
 */
export const generatePrettyCode = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8,
);
