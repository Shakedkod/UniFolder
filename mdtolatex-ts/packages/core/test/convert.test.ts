import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CALLOUT_ENVIRONMENTS,
  convert,
  desmosGraphToTikz,
  dotToTikz,
  intToGematria,
  mermaidToTikz,
  parseMarkdown,
  traditionalHebrewDate,
} from '../src/index.js';

const FIXED_DAY = new Date(2026, 8, 18); // 18 September 2026

test('headings map to the sectioning hierarchy', () => {
  const { latex } = convert('# Part\n\n## Section\n\n### Sub\n', { today: FIXED_DAY });
  assert.match(latex, /\\part\{Part\}/);
  assert.match(latex, /\\section\{Section\}/);
  assert.match(latex, /\\subsection\{Sub\}/);
});

test('front matter is stripped by default', () => {
  const markdown = '---\ntags: [algebra]\n---\n\n# Title\n';
  assert.doesNotMatch(convert(markdown, { today: FIXED_DAY }).latex, /tags/);
  assert.match(convert(markdown, { removeMetadata: false, today: FIXED_DAY }).latex, /tags/);
});

test('inline and block math become LaTeX math delimiters', () => {
  const { latex } = convert('Let $x^2$ hold.\n\n$$\na = b\n$$\n', { today: FIXED_DAY });
  assert.match(latex, /\\\(\{x\^2\}\\\)/);
  assert.match(latex, /\\\[\n\{a = b\}\n\\\]/);
});

test('align environments are rewritten to aligned', () => {
  const { latex } = convert('$$\n\\begin{align}x&=1\\end{align}\n$$\n', { today: FIXED_DAY });
  assert.match(latex, /\\begin\{aligned\}/);
  assert.doesNotMatch(latex, /\\begin\{align\}/);
});

test('callouts become theorem-like environments with labels', () => {
  const markdown = '> [!theorem] Pythagoras\n> The square of the hypotenuse.\n\n^pyth\n';
  const { latex } = convert(markdown, { today: FIXED_DAY });
  assert.match(latex, /\\begin\{theorem\}\[Pythagoras\]/);
  assert.match(latex, /\\label\{pyth\}/);
});

test('an unknown callout type degrades to a quote', () => {
  const { latex } = convert('> [!note] Heads up\n> Body.\n', { today: FIXED_DAY });
  assert.match(latex, /\\begin\{quote\}/);
});

test('a plain blockquote stays a quote', () => {
  const { latex } = convert('> Just a quote.\n', { today: FIXED_DAY });
  assert.match(latex, /\\begin\{quote\}\nJust a quote\./);
});

test('Hebrew proof blocks are wrapped in a proof environment', () => {
  const markdown = '**הוכחה:** ברור מאליו.\n`\\end{proof}`\n';
  const { latex } = convert(markdown, { language: 'hebrew', today: FIXED_DAY });
  assert.match(latex, /\\begin\{proof\}/);
  assert.match(latex, /\\end\{proof\}/);
});

test('wikilinks turn into vault hyperlinks and self references', () => {
  const { latex } = convert('See [[Linear Algebra|LA]] and [[#^abc]].\n', {
    vaultBaseUrl: 'https://example.com/',
    today: FIXED_DAY,
  });
  // `%` is escaped for LaTeX; hyperref turns `\%` back into `%` in the URL.
  assert.match(latex, /\\href\{https:\/\/example\.com\/Linear\\%20Algebra\}\{LA\}/);
  assert.match(latex, /\\hyperref\[abc\]/);
});

test('a target with no heading or block ref gets no trailing fragment', () => {
  // A bare `#` is written into the .toc file, where LaTeX reads it as a macro
  // parameter and aborts — so it must never be emitted.
  const { latex } = convert('# See [[Notes]]\n', { today: FIXED_DAY });
  assert.doesNotMatch(latex, /Notes#/);
});

test('headings and block refs become URL fragments', () => {
  const { latex } = convert('[[Notes#Limits]] and [[Notes#Limits^b12]]\n', {
    vaultBaseUrl: 'https://example.com',
    today: FIXED_DAY,
  });
  assert.match(latex, /\\href\{https:\/\/example\.com\/Notes\\#Limits\}/);
  assert.match(latex, /\\href\{https:\/\/example\.com\/Notes\\#\^b12\}/);
});

test('resolveWikiLink rewrites short links to vault-root-relative paths', () => {
  const calls: string[] = [];
  const { latex } = convert('See [[Integrals]] and ![[sketch.excalidraw]].\n', {
    vaultBaseUrl: 'https://example.com/',
    today: FIXED_DAY,
    resolveWikiLink: (request) => {
      calls.push(`${request.kind}:${request.target}`);
      if (request.kind === 'embed') return { href: 'assets/sketch.excalidraw.svg' };
      return { href: '2 - Calculus/Integrals', text: 'Integrals' };
    },
  });
  assert.deepEqual(calls, ['link:Integrals', 'embed:sketch.excalidraw']);
  assert.match(latex, /\\href\{https:\/\/example\.com\/2\\%20-\\%20Calculus\/Integrals\}\{Integrals\}/);
  assert.match(latex, /\\includesvg\[width=0\.8\\textwidth\]\{assets\/sketch\.excalidraw\.svg\}/);
});

test('a resolver may return an absolute URL, a label or plain text', () => {
  const options = { today: FIXED_DAY };
  const absolute = convert('[[Notes]]\n', {
    ...options,
    resolveWikiLink: () => ({ href: 'https://elsewhere.test/notes' }),
  }).latex;
  assert.match(absolute, /\\href\{https:\/\/elsewhere\.test\/notes\}/);

  const labelled = convert('[[Notes]]\n', {
    ...options,
    resolveWikiLink: () => ({ label: 'sec:notes', text: 'the notes' }),
  }).latex;
  assert.match(labelled, /\\hyperref\[sec:notes\]\{the notes\}/);

  const plain = convert('[[Missing Note]]\n', {
    ...options,
    resolveWikiLink: () => ({ plain: true }),
  }).latex;
  assert.doesNotMatch(plain, /\\href|\\hyperref/);
  assert.match(plain, /Missing Note/);
});

test('a throwing resolver is reported as a warning, not an exception', () => {
  const { latex, warnings } = convert('[[Notes]]\n', {
    today: FIXED_DAY,
    resolveWikiLink: () => {
      throw new Error('cache miss');
    },
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /cache miss/);
  assert.match(latex, /\\href\{[^}]*Notes\}/);
});

test('embeds render as SVG figures and enable the graphics preamble', () => {
  const { latex, head } = convert('![[diagram]]\n', { today: FIXED_DAY });
  assert.match(latex, /\\includesvg\[width=0\.8\\textwidth\]\{diagram\.svg\}/);
  assert.equal(head.images, true);
});

test('tables render as bordered tabulars with the declared alignment', () => {
  const markdown = '| a | b |\n|:-:|--:|\n| 1 | 2 |\n';
  const { latex } = convert(markdown, { today: FIXED_DAY });
  assert.match(latex, /\\begin\{tabular\}\{\|c\|r\|\}/);
  assert.match(latex, /1 & 2 \\\\/);
});

test('lists render as itemize and enumerate, including nesting', () => {
  const markdown = '- one\n- two\n\n1. first\n2. second\n';
  const { latex } = convert(markdown, { today: FIXED_DAY });
  assert.match(latex, /\\begin\{itemize\}\n\\item one/);
  assert.match(latex, /\\begin\{enumerate\}\n\\item first/);
});

test('nested lists survive inside a list item', () => {
  const { latex } = convert('- outer\n    - inner\n', { today: FIXED_DAY });
  assert.match(latex, /\\begin\{itemize\}[\s\S]*\\begin\{itemize\}[\s\S]*inner/);
});

test('code blocks enable listings and keep their language', () => {
  const { latex, head } = convert('```python\nprint(1)\n```\n', { today: FIXED_DAY });
  assert.equal(head.code, true);
  assert.match(latex, /\\begin\{lstlisting\}\[language=python\]/);
  assert.match(latex, /\\usepackage\{listings\}/);
});

test('mermaid fences become TikZ pictures', () => {
  const markdown = '```mermaid\nflowchart LR\nA[Start] --> B{Choice}\nB -->|yes| C((Done))\n```\n';
  const { latex, head } = convert(markdown, { today: FIXED_DAY });
  assert.equal(head.tikz, true);
  assert.match(latex, /\\begin\{tikzpicture\}/);
  assert.match(latex, /\\node\[draw, diamond, aspect=2\] \(B\)/);
});

test('an unparseable diagram falls back to a plain listing', () => {
  const { latex } = convert('```mermaid\n%% nothing here\n```\n', { today: FIXED_DAY });
  assert.match(latex, /\\begin\{lstlisting\}/);
});

test('dot graphs honour labels, shapes and rankdir', () => {
  const tikz = dotToTikz('digraph G {\n  rankdir=LR;\n  a [shape=circle, label="A"];\n  a -> b [label="e"];\n}');
  assert.match(tikz, /\\node\[draw, circle\] \(a\)/);
  assert.match(tikz, /node\[midway, fill=white, font=\\scriptsize\] \{e\}/);
});

test('desmos fences become a pgfplots axis and request pgfplots', () => {
  const { head } = convert('```desmos-graph\nwidth=200; height=200;\nbottom=-1; top=2\n---\nf(x)=2x |x<0\n```\n', {
    today: FIXED_DAY,
  });
  assert.ok(head.packages.includes('pgfplots'));

  const tikz = desmosGraphToTikz('bottom=-1; top=2\n---\nf(x)=2x |x<0');
  assert.match(tikz, /\\begin\{axis\}/);
  assert.match(tikz, /\\addplot\[domain=-5:0\] \{2\*x\};/);
});

test('mermaid skip-edges are bent so labels clear intermediate nodes', () => {
  const tikz = mermaidToTikz('graph TB\nA-->B\nB-->C\nA-->|skip|C');
  assert.match(tikz, /to\[out=-60, in=60\]/);
});

test('the Hebrew document uses the Hebrew preamble and a dual date', () => {
  const { latex } = convert('# כותרת\n', { language: 'hebrew', today: FIXED_DAY });
  assert.match(latex, /\\setdefaultlanguage\{hebrew\}/);
  assert.match(latex, /\\newtheorem\{theorem\}\{משפט\}/);
  assert.match(latex, /\\date\{ספטמבר 18, 2026 \(/);
});

test('gematria numerals use the customary substitutions', () => {
  assert.equal(intToGematria(1), 'א׳');
  assert.equal(intToGematria(15), 'ט״ו');
  assert.equal(intToGematria(16), 'ט״ז');
  assert.equal(intToGematria(786), 'תשפ״ו');
});

test('the Hebrew date for 18 September 2026 is 7 Tishrei 5787', () => {
  assert.equal(traditionalHebrewDate(FIXED_DAY), 'ז׳ בתשרי ה׳תשפ״ז');
});

test('the table of contents is opt-out', () => {
  assert.match(convert('# a\n', { today: FIXED_DAY }).latex, /\\tableofcontents/);
  assert.doesNotMatch(convert('# a\n', { toc: false, today: FIXED_DAY }).latex, /\\tableofcontents/);
});

test('a custom preamble is injected verbatim', () => {
  const { latex } = convert('# a\n', { preamble: '\\newcommand{\\Z}{\\mathbb{Z}}', today: FIXED_DAY });
  assert.match(latex, /% ---------- Custom Preamble ----------\n\\newcommand\{\\Z\}/);
});

test('the AST keeps the mistune-compatible token shape', () => {
  const ast = parseMarkdown('## Title\n');
  assert.deepEqual(ast[0], {
    type: 'heading',
    attrs: { level: 2 },
    children: [{ type: 'text', raw: 'Title' }],
  });
});

test('the document is well-formed top to bottom', () => {
  const { latex } = convert('# a\n', { today: FIXED_DAY });
  assert.match(latex, /^% =+\n% === Created by MDtoLatex/);
  assert.ok(latex.trimEnd().endsWith('\\end{document}'));
});

test('the fancy-academic theme replaces the regular preamble', () => {
  const markdown = '> [!theorem] T\n> body\n';
  const regular = convert(markdown, { today: FIXED_DAY }).latex;
  const fancy = convert(markdown, { theme: 'fancy-academic', today: FIXED_DAY }).latex;

  assert.match(regular, /Regular Theme/);
  assert.doesNotMatch(regular, /tcolorbox/);

  assert.match(fancy, /Fancy Academic Theme/);
  assert.doesNotMatch(fancy, /Regular Theme/);
  // The boxes only restyle amsthm, so the body is identical in both themes.
  assert.match(fancy, /\\usepackage\[most\]\{tcolorbox\}/);
  assert.match(fancy, /\\tcolorboxenvironment\{theorem\}/);
  assert.match(fancy, /\\begin\{theorem\}\[T\]/);
});

test('the fancy-academic theme mirrors its rules for Hebrew', () => {
  const { latex } = convert('> [!theorem] משפט\n> גוף\n', {
    theme: 'fancy-academic',
    language: 'hebrew',
    today: FIXED_DAY,
  });
  assert.match(latex, /Fancy Academic Theme/);
  assert.match(latex, /\\newtheorem\{theorem\}\{משפט\}/);
  // tcolorbox collapses under bidi (boxes lose their frames and pile up at the
  // page edge), so the Hebrew theme frames with mdframed instead and puts the
  // accent rule on the right-hand (leading) edge.
  assert.match(latex, /\\mdfdefinestyle\{fabox\}/);
  assert.match(latex, /rightline=true/);
  assert.doesNotMatch(latex, /tcolorboxenvironment/);
});

test('every callout type maps to an environment the themes declare', () => {
  for (const theme of ['regular', 'fancy-academic'] as const) {
    const markdown = CALLOUT_ENVIRONMENTS.map((type) => `> [!${type}] title\n> body\n`).join('\n');
    const { latex } = convert(markdown, { theme, today: FIXED_DAY });
    for (const type of CALLOUT_ENVIRONMENTS) {
      assert.match(latex, new RegExp(`\\\\begin\\{${type}\\}`), `${type} missing in ${theme}`);
      const declared =
        type === 'proof'
          ? new RegExp(`renewenvironment\\{proof\\}`)
          : new RegExp(`newtheorem\\*?\\{${type}\\}`);
      assert.match(latex, declared, `${type} not declared by ${theme}`);
    }
  }
});

test('a proof callout drops the explicit end marker', () => {
  const { latex } = convert('> [!proof]\n> body\n> `\\end{proof}`\n', { today: FIXED_DAY });
  assert.match(latex, /\\begin\{proof\}\nbody\n\\end\{proof\}/);
  assert.doesNotMatch(latex, /textbackslash\{\}end/);
});

test('a callout title may contain a wikilink', () => {
  const { latex } = convert('> [!remark] see [[Notes#^474cbb|the theorem]]\n> body\n', {
    vaultBaseUrl: 'https://example.com/',
    today: FIXED_DAY,
  });
  // An unrendered wikilink's brackets would terminate the optional argument, and
  // brackets that survive rendering have to be brace-protected.
  assert.match(
    latex,
    /\\begin\{remark\}\[see \\href\{https:\/\/example\.com\/Notes\\#\^474cbb\}\{the theorem\}\]/,
  );
});

test('characters that would abort the LaTeX run are escaped in text and metadata', () => {
  const { latex } = convert('# Work & Energy\n\n50% of a_b costs #5 ~ish\n', {
    title: 'sample_en & co',
    today: FIXED_DAY,
  });
  assert.match(latex, /\\title\{sample\\_en \\& co\}/);
  assert.match(latex, /\\part\{Work \\& Energy\}/);
  assert.match(latex, /50\\% of a\\_b costs \\#5 \\textasciitilde\{\}ish/);
});

test('deliberate LaTeX in a note still passes through', () => {
  const { latex } = convert('\\newpage\n\nsee \\textbf{this}\n', { today: FIXED_DAY });
  assert.match(latex, /\\newpage/);
  assert.match(latex, /\\textbf\{this\}/);
});
