import { convert, type ConvertOptions, type Theme } from '@mdtolatex/core';

/**
 * POST /api/convert
 *
 * Body: `{ markdown, title?, author?, language?, theme?, toc?, vaultBaseUrl?, preamble? }`
 * Returns: `{ latex, warnings, head, assets }`, or `{ error }` with a 4xx/5xx status.
 *
 * `assets` lists the images the document includes, so a client can collect them
 * and build a zip that actually compiles.
 *
 * The converter is pure and synchronous, so this runs equally well on the Edge
 * runtime — switch `nodejs` below to `edge` if you prefer.
 */
export const runtime = 'nodejs';

const THEMES = new Set<Theme>(['regular', 'fancy-academic']);
const MAX_BYTES = 2_000_000;

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const markdown = body.markdown;

  if (typeof markdown !== 'string' || !markdown.trim()) {
    return json({ error: 'Field "markdown" is required and must be a non-empty string.' }, 400);
  }
  if (markdown.length > MAX_BYTES) {
    return json({ error: `Markdown exceeds the ${MAX_BYTES} character limit.` }, 413);
  }

  const options: ConvertOptions = {
    title: str(body.title) ?? 'Untitled',
    author: str(body.author) ?? '',
    language: str(body.language) ?? (hasHebrew(markdown) ? 'hebrew' : 'english'),
    theme: THEMES.has(body.theme as Theme) ? (body.theme as Theme) : 'regular',
    toc: body.toc === undefined ? true : Boolean(body.toc),
    vaultBaseUrl: str(body.vaultBaseUrl),
    preamble: str(body.preamble),
  };

  try {
    const { latex, warnings, head, assets } = convert(markdown, options);
    return json({ latex, warnings, head, assets });
  } catch (error) {
    console.error('conversion failed', error);
    return json({ error: error instanceof Error ? error.message : 'Conversion failed.' }, 500);
  }
}

/** Download the result directly: `GET /api/convert?...` is intentionally absent. */
export function GET(): Response {
  return json({ error: 'Use POST with a JSON body.' }, 405);
}

const hasHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
