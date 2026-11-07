import path from 'path';
import fs from 'fs';
import {
  buildBundle,
  missingBox,
  skippedLabel,
  type AssetReference,
} from '@/lib/mdtolatex';

export const runtime = 'nodejs';

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'vault-images');

function findAssetBuffer(assetPath: string): Uint8Array | null {
  const baseName = path.basename(assetPath);
  const candidates = [
    path.join(PUBLIC_IMAGES_DIR, baseName),
    path.join(PUBLIC_IMAGES_DIR, decodeURIComponent(baseName)),
    path.join(PUBLIC_IMAGES_DIR, encodeURIComponent(baseName)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return new Uint8Array(fs.readFileSync(candidate));
      } catch {}
    }
  }

  try {
    const files = fs.readdirSync(PUBLIC_IMAGES_DIR);
    const lower = baseName.toLowerCase();
    const match = files.find((f) => f.toLowerCase() === lower);
    if (match) {
      return new Uint8Array(fs.readFileSync(path.join(PUBLIC_IMAGES_DIR, match)));
    }
  } catch {}

  return null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const latex: string = body.latex || '';
    const title: string = body.title || 'document';
    const assets: AssetReference[] = body.assets || [];

    if (!latex || !latex.trim()) {
      return Response.json({ error: 'No LaTeX content provided' }, { status: 400 });
    }

    let docLatex = latex;

    // Optimize Hebrew and monospace font lookups
    docLatex = docLatex
      .replace(/\\IfFontExistsTF\{Nachlieli CLM\}\{.*?\}\{\\newfontfamily\\titlefont\{Arial\}\}/g, '\\IfFontExistsTF{Arial}{\\newfontfamily\\titlefont{Arial}}{\\newfontfamily\\titlefont{Nachlieli CLM}}')
      .replace(/\\IfFontExistsTF\{David CLM\}\{.*?\}\{\\newfontfamily\\hebrewfont\{Arial\}\}/g, '\\IfFontExistsTF{David}{\\newfontfamily\\hebrewfont{David}}{\\newfontfamily\\hebrewfont{David CLM}}')
      .replace(/\\IfFontExistsTF\{David CLM\}\{.*?\}\{\\newfontfamily\{\\hebrewfonttt\}\[Script=Hebrew\]\{Arial\}\}/g, '\\IfFontExistsTF{Courier New}{\\setmonofont{Courier New}}{\\setmonofont{Consolas}}\n\\IfFontExistsTF{Courier New}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Courier New}}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Arial}}\n\\IfFontExistsTF{Courier New}{\\newfontfamily\\englishfonttt{Courier New}}{\\newfontfamily\\englishfonttt{Consolas}}')
      .replace(/\\IfFontExistsTF\{Latin Modern Roman\}\{.*?\}\{\\newfontfamily\\englishfont\{Times New Roman\}\}/g, '\\IfFontExistsTF{Times New Roman}{\\newfontfamily\\englishfont{Times New Roman}}{\\newfontfamily\\englishfont{Latin Modern Roman}}');

    // Remove any invalid \provideenvironment commands that print text on page 1
    docLatex = docLatex.replace(/\\provideenvironment\{english\}\{\}\{\}/g, '');

    // Normalize any unescaped C++ listings options
    docLatex = docLatex.replace(/\[language=\[ISO\]C\+\+\]/g, '[language=C++]');

    // If an algorithm was wrapped in lstlisting, unwrap it to render as a native LaTeX algorithm
    docLatex = docLatex.replace(/(?:\\begin\{english\}\s*)?\\begin\{LTR\}\s*\\begin\{lstlisting\}(?:\[.*?\])?\s*(\\begin\{algorithm\}[\s\S]*?\\end\{algorithm\})\s*\\end\{lstlisting\}\s*\\end\{LTR\}(?:\s*\\end\{english\})?/g, (_match, alg) => {
      return `\\begin{english}\\begin{LTR}\n${alg}\n\\end{LTR}\\end{english}`;
    });

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
      docLatex = docLatex.replace('\\begin{document}', `${algSetup}\\begin{document}`);
    }

    // Wrap any standalone LTR listings in an english environment to prevent RTL glyph mirroring (reversed parens, brackets, tofu minus)
    docLatex = docLatex.replace(/(?<!\\begin\{english\}\s*)\\begin\{LTR\}\s*\\begin\{lstlisting\}(\[language=.*?\])?/g, (_match, lang) => {
      let opt = lang || '';
      if (opt.includes('cpp') || opt.includes('c++')) {
        opt = '[language=C++]';
      }
      return `\\begin{english}\\begin{LTR}\\begin{lstlisting}${opt}`;
    });
    docLatex = docLatex.replace(/\\end\{lstlisting\}\s*\\end\{LTR\}(?!\s*\\end\{english\})/g, '\\end{lstlisting}\\end{LTR}\\end{english}');

    // Ensure display math auto-fits within page margins and stays centered
    if (!docLatex.includes('\\emergencystretch')) {
      docLatex = docLatex.replace('\\begin{document}', '\\emergencystretch=3em\n\\binoppenalty=9999\n\\relpenalty=9999\n\\begin{document}');
    }

    // Ensure all images are height-capped so tall/portrait figures never take the whole page
    docLatex = docLatex.replace(/\\(includegraphics|includesvg)\[width=([^,\s\]]+)\]/g, '\\$1[width=$2,height=0.4\\textheight,keepaspectratio]');

    if (!docLatex.includes('\\renewenvironment{displaymath}')) {
      const displayMathDef = `
% Auto-fit and center display math so wide formulas never overflow the page margins
\\makeatletter
\\renewenvironment{displaymath}{%
  \\begin{center}%
  \\begin{adjustbox}{max width=\\linewidth}%
  $\\displaystyle
}{%
  $%
  \\end{adjustbox}%
  \\end{center}%
}
\\renewcommand{\\[}{\\begin{displaymath}}
\\renewcommand{\\]}{\\end{displaymath}}
\\makeatother
`;
      if (docLatex.includes('\\usepackage{adjustbox}')) {
        docLatex = docLatex.replace('\\usepackage{adjustbox}', `\\usepackage{adjustbox}${displayMathDef}`);
      } else if (docLatex.includes('\\begin{document}')) {
        docLatex = docLatex.replace('\\begin{document}', `\\usepackage{adjustbox}${displayMathDef}\\begin{document}`);
      }
    }

    const safeTitle =
      title
        .replace(/[^\u0590-\u05FFa-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'document';

    const localAssets = assets.filter((a) => !a.isUrl);

    // If there are no local assets, return plain .tex
    if (localAssets.length === 0) {
      return new Response(docLatex, {
        headers: {
          'Content-Type': 'text/x-tex; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.tex"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.tex`,
        },
      });
    }

    // Bundle .tex and all assets into a zip archive
    const bundle = await buildBundle({
      latex: docLatex,
      assets: localAssets,
      texName: `${safeTitle}.tex`,
      readAsset: (assetPath) => findAssetBuffer(assetPath),
      onSkipped: (asset, reason) => missingBox(asset, skippedLabel(asset, reason)),
    });

    return new Response(bundle.zip as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.zip"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.zip`,
      },
    });
  } catch (error: any) {
    console.error('LaTeX export failed:', error);
    return Response.json(
      { error: error?.message || 'Failed to export LaTeX bundle.' },
      { status: 500 }
    );
  }
}
