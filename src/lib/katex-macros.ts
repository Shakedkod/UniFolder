import fs from 'fs';
import path from 'path';
import { VAULT_DIRECTORY } from './vault';

export const DEFAULT_BASE_MACROS: Record<string, string> = {
    '\\oldint': '\\intop',
    '\\oldiint': '\\mathop{∬}',
    '\\oldiiint': '\\mathop{∭}',
    '\\oldoint': '\\mathop{∮}',
    '\\smallrightleftharpoons': '⇌',
    '\\spacedpmod': '\\allowbreak\\mkern 18mu({\\rm mod}\\,\\,#1)',
};

/**
 * Parses \newcommand, \renewcommand, and \let definitions from a LaTeX .sty string.
 *
 * Handles:
 *   \newcommand{\foo}{body}
 *   \newcommand{\foo}[2]{body with #1 and #2}
 *   \renewcommand{\foo}{body}
 *   \let\oldint\int
 *
 * KaTeX macro bodies use the same #1 #2 argument syntax as LaTeX, so
 * the bodies can be passed through verbatim.
 *
 * Returns a KaTeX-compatible macros object: { "\\foo": "body", ... }
 */
export function parseStyMacros(styContent: string): Record<string, string> {
    const macros: Record<string, string> = { ...DEFAULT_BASE_MACROS };

    // Strip % comments (but not \% escaped percent)
    const stripped = styContent
        .split('\n')
        .map(line => line.replace(/(?<!\\)%.*$/, ''))
        .join('\n');

    // Parse \let\newname\oldname
    const letRe = /\\let\s*\\([a-zA-Z]+)\s*=?\s*\\([a-zA-Z]+)/g;
    let mLet: RegExpExecArray | null;
    while ((mLet = letRe.exec(stripped)) !== null) {
        const alias = mLet[1].trim();
        const target = mLet[2].trim();

        // Safe primitive/symbol mappings for targets that are typically redefined with \limits
        // or formatting to prevent recursive expansion loops in KaTeX
        if (target === 'int') {
            macros[`\\${alias}`] = '\\intop';
        } else if (target === 'iint') {
            macros[`\\${alias}`] = '\\mathop{∬}';
        } else if (target === 'iiint') {
            macros[`\\${alias}`] = '\\mathop{∭}';
        } else if (target === 'oint') {
            macros[`\\${alias}`] = '\\mathop{∮}';
        } else if (target === 'rightleftharpoons') {
            macros[`\\${alias}`] = '⇌';
        } else if (target === 'pmod') {
            macros[`\\${alias}`] = '\\allowbreak\\mkern 18mu({\\rm mod}\\,\\,#1)';
        } else {
            macros[`\\${alias}`] = `\\${target}`;
        }
    }

    // Matches:
    //   \newcommand{\name}[N]{body}   — N-argument macro
    //   \newcommand{\name}{body}      — 0-argument macro
    //
    // The body regex allows arbitrary nesting up to 3 levels deep,
    // which covers virtually every real-world preamble.
    const re =
        /\\(?:new|renew)command\s*\*?\s*\{\\([^}]+)\}\s*(?:\[(\d+)\])?\s*\{((?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)\}/g;

    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
        const name  = m[1].trim();
        // const _nargs = m[2] ? parseInt(m[2]) : 0;  // KaTeX infers this from #N usage
        const body  = m[3];
        macros[`\\${name}`] = body;
    }

    return macros;
}

const MACROS_CACHE_PATH = path.join(VAULT_DIRECTORY, 'preamble-macros.json');

let _cachedMacros: Record<string, string> | null = null;

/**
 * Loads the KaTeX macros derived from the vault's preamble.sty.
 *
 * The sync script is expected to write `public/vault/preamble-macros.json`.
 * If that file is missing we return DEFAULT_BASE_MACROS so the site still builds.
 */
export function loadPreambleMacros(): Record<string, string> {
    if (_cachedMacros !== null) return _cachedMacros;

    try {
        if (fs.existsSync(MACROS_CACHE_PATH)) {
            const fileMacros = JSON.parse(fs.readFileSync(MACROS_CACHE_PATH, 'utf8'));
            _cachedMacros = {
                ...DEFAULT_BASE_MACROS,
                ...fileMacros,
            };
            console.log(
                `[katex-macros] Loaded ${Object.keys(_cachedMacros!).length} macros from preamble-macros.json`
            );
            return _cachedMacros!;
        }
    } catch (err) {
        console.warn('[katex-macros] Failed to load preamble-macros.json:', err);
    }

    _cachedMacros = { ...DEFAULT_BASE_MACROS };
    return _cachedMacros;
}
