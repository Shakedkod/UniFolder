/**
 * Shared LaTeX post-processing helpers for XeLaTeX compilation and ZIP bundles.
 */

export function prepareLatexForCompilation(latex: string): string {
  let docLatex = latex;

  // 1. Optimize Hebrew and monospace font fallbacks
  docLatex = docLatex
    .replace(
      /\\IfFontExistsTF\{Nachlieli CLM\}\{.*?\}\{\\newfontfamily\\titlefont\{Arial\}\}/g,
      '\\IfFontExistsTF{Arial}{\\newfontfamily\\titlefont{Arial}}{\\newfontfamily\\titlefont{Nachlieli CLM}}'
    )
    .replace(
      /\\IfFontExistsTF\{David CLM\}\{.*?\}\{\\newfontfamily\\hebrewfont\{Arial\}\}/g,
      '\\IfFontExistsTF{David}{\\newfontfamily\\hebrewfont{David}}{\\newfontfamily\\hebrewfont{David CLM}}'
    )
    .replace(
      /\\IfFontExistsTF\{David CLM\}\{.*?\}\{\\newfontfamily\{\\hebrewfonttt\}\[Script=Hebrew\]\{Arial\}\}/g,
      '\\IfFontExistsTF{Courier New}{\\setmonofont{Courier New}}{\\setmonofont{Consolas}}\n\\IfFontExistsTF{Courier New}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Courier New}}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Arial}}\n\\IfFontExistsTF{Courier New}{\\newfontfamily\\englishfonttt{Courier New}}{\\newfontfamily\\englishfonttt{Consolas}}'
    )
    .replace(
      /\\IfFontExistsTF\{Latin Modern Roman\}\{.*?\}\{\\newfontfamily\\englishfont\{Times New Roman\}\}/g,
      '\\IfFontExistsTF{Times New Roman}{\\newfontfamily\\englishfont{Times New Roman}}{\\newfontfamily\\englishfont{Latin Modern Roman}}'
    );

  // 2. Remove any invalid \provideenvironment commands that print text on page 1
  docLatex = docLatex.replace(/\\provideenvironment\{english\}\{\}\{\}/g, '');

  // 3. Normalize any unescaped C++ listings options
  docLatex = docLatex.replace(/\[language=\[ISO\]C\+\+\]/g, '[language=C++]');

  // 4. If an algorithm was wrapped in lstlisting, unwrap it to render as a native LaTeX algorithm
  docLatex = docLatex.replace(
    /(?:\\begin\{english\}\s*)?\\begin\{LTR\}\s*\\begin\{lstlisting\}(?:\[.*?\])?\s*(\\begin\{algorithm\}[\s\S]*?\\end\{algorithm\})\s*\\end\{lstlisting\}\s*\\end\{LTR\}(?:\s*\\end\{english\})?/g,
    (_match, alg) => {
      return `\\begin{english}\\begin{LTR}\n${alg}\n\\end{LTR}\\end{english}`;
    }
  );

  // 5. Ensure algorithm package definitions exist if an algorithm is used
  if (docLatex.includes('\\begin{algorithm}') && !docLatex.includes('\\usepackage{algorithm}')) {
    const algSetup = `
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\algnewcommand\\algorithmicinput{\\textbf{Input:}}
\\algnewcommand\\INPUT{\\item[\\algorithmicinput]}
\\algnewcommand\\algorithmicoutput{\\textbf{Output:}}
\\algnewcommand\\OUTPUT{\\item[\\algorithmicoutput]}
\\algnewcommand\\TO{\\textbf{to}}
\\algnewcommand\\AND{\\textbf{and}}
\\algnewcommand\\OR{\\textbf{or}}
\\algnewcommand\\NOT{\\textbf{not}}
\\providecommand{\\STATE}{\\State}
\\providecommand{\\FOR}{\\For}
\\providecommand{\\ENDFOR}{\\EndFor}
\\providecommand{\\WHILE}{\\While}
\\providecommand{\\ENDWHILE}{\\EndWhile}
\\providecommand{\\IF}{\\If}
\\providecommand{\\ELSE}{\\Else}
\\providecommand{\\ELSIF}{\\ElsIf}
\\providecommand{\\ENDIF}{\\EndIf}
\\providecommand{\\RETURN}{\\Return}
\\providecommand{\\FUNCTION}{\\Function}
\\providecommand{\\ENDFUNCTION}{\\EndFunction}
\\providecommand{\\PROCEDURE}{\\Procedure}
\\providecommand{\\ENDPROCEDURE}{\\EndProcedure}
\\providecommand{\\COMMENT}{\\Comment}
\\providecommand{\\CALL}{\\Call}
`;
    if (docLatex.includes('\\begin{document}')) {
      docLatex = docLatex.replace('\\begin{document}', `${algSetup}\\begin{document}`);
    }
  }

  // 6. Wrap display math in \adjustbox to prevent wide equations from overflowing
  if (!docLatex.includes('\\usepackage{adjustbox}')) {
    if (docLatex.includes('\\begin{document}')) {
      docLatex = docLatex.replace('\\begin{document}', '\\usepackage{adjustbox}\n\\begin{document}');
    }
  }

  const displayMathDef = `
\\makeatletter
\\let\\old@equation\\equation
\\let\\old@endequation\\endequation
\\renewenvironment{equation}{\\old@equation\\begin{adjustbox}{max width=\\linewidth}}{\\end{adjustbox}\\old@endequation}
\\let\\old@equation@star\\equation*
\\let\\old@endequation@star\\endequation*
\\renewenvironment{equation*}{\\old@equation@star\\begin{adjustbox}{max width=\\linewidth}}{\\end{adjustbox}\\old@endequation@star}
\\makeatother
`;

  if (!docLatex.includes('\\old@equation')) {
    if (docLatex.includes('\\usepackage{adjustbox}')) {
      docLatex = docLatex.replace('\\usepackage{adjustbox}', `\\usepackage{adjustbox}${displayMathDef}`);
    } else if (docLatex.includes('\\begin{document}')) {
      docLatex = docLatex.replace('\\begin{document}', `\\usepackage{adjustbox}${displayMathDef}\\begin{document}`);
    }
  }

  return docLatex;
}

/**
 * Shifts Markdown headings of level 1 to 5 down one level (# -> ##, ## -> ###, etc.).
 * Accurately ignores fenced code blocks.
 */
export function shiftMarkdownHeadings(markdown: string): string {
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let codeFence = '';

  const shifted = lines.map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fence = trimmed.slice(0, 3);
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeFence = fence;
      } else if (trimmed.startsWith(codeFence)) {
        inCodeBlock = false;
        codeFence = '';
      }
      return line;
    }

    if (inCodeBlock) return line;

    // Match ATX headings 1 through 5
    const match = line.match(/^(\s*)(#{1,5})(\s+.*)$/);
    if (match) {
      return `${match[1]}#${match[2]}${match[3]}`;
    }
    return line;
  });

  return shifted.join('\n');
}

/**
 * Strips leading YAML frontmatter (between --- and ---)
 */
export function stripFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('---')) {
    const endIndex = trimmed.indexOf('---', 3);
    if (endIndex !== -1) {
      return trimmed.slice(endIndex + 3).trim();
    }
  }
  return content;
}

/**
 * Cleans a lecture title by stripping leading numbers and hyphens (e.g., "1 - Topic" -> "Topic")
 */
export function cleanLectureTitle(title: string): string {
  return (title || '')
    .replace(/^(\d+|הרצאה\s*\d+)\s*[-–—.:]\s*/i, '')
    .trim() || title;
}
