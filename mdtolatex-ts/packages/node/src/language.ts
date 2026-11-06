/** Picking a polyglossia language from the text itself. */
const HEBREW_RE = /[\u0590-\u05FF]/;

/**
 * Guesses the document language, as the Python wizard's `auto` did.
 *
 * Only Hebrew is detected, because that is the one that changes the preamble:
 * it needs an RTL setup, and getting it wrong renders the whole document
 * backwards rather than merely hyphenating oddly.
 */
export function detectLanguage(markdown: string): string {
  return HEBREW_RE.test(markdown) ? 'hebrew' : 'english';
}
