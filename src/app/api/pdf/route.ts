import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import {
  compileToPdf,
  substituteAsset,
  placeholderForAsset,
  skippedLabel,
  type AssetReference,
} from '@/lib/mdtolatex';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'vault-images');

function findAssetFile(assetPath: string): { filePath: string; buffer: Buffer } | null {
  const baseName = path.basename(assetPath);
  const candidates = [
    path.join(PUBLIC_IMAGES_DIR, baseName),
    path.join(PUBLIC_IMAGES_DIR, decodeURIComponent(baseName)),
    path.join(PUBLIC_IMAGES_DIR, encodeURIComponent(baseName)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const buffer = fs.readFileSync(candidate);
        return { filePath: candidate, buffer };
      } catch {}
    }
  }

  // Also try case-insensitive / normalized lookup if needed
  try {
    const files = fs.readdirSync(PUBLIC_IMAGES_DIR);
    const lower = baseName.toLowerCase();
    const match = files.find((f) => f.toLowerCase() === lower);
    if (match) {
      const buffer = fs.readFileSync(path.join(PUBLIC_IMAGES_DIR, match));
      return { filePath: path.join(PUBLIC_IMAGES_DIR, match), buffer };
    }
  } catch {}

  return null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    let latex = '';
    let title = 'document';
    let assets: AssetReference[] = [];

    if (contentType.includes('application/json')) {
      const body = await request.json();
      latex = body.latex || '';
      title = body.title || 'document';
      assets = body.assets || [];
    } else if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const texPart = form.get('tex');
      if (texPart instanceof File) {
        latex = await texPart.text();
      } else if (typeof texPart === 'string') {
        latex = texPart;
      }
      const titlePart = form.get('title');
      if (typeof titlePart === 'string' && titlePart.trim()) {
        title = titlePart.trim();
      }
      const assetsPart = form.get('assets');
      if (typeof assetsPart === 'string') {
        try {
          assets = JSON.parse(assetsPart);
        } catch {}
      }
    } else {
      return Response.json({ error: 'Unsupported Content-Type' }, { status: 400 });
    }

    if (!latex || !latex.trim()) {
      return Response.json({ error: 'No LaTeX content provided' }, { status: 400 });
    }

    const files = new Map<string, Uint8Array | string>();
    let docLatex = latex;

    // Optimize Hebrew and monospace font lookups across Linux and Windows
    const safeFontSetup = `\\IfFontExistsTF{David CLM}{\\newfontfamily\\hebrewfont{David CLM}}{\\IfFontExistsTF{David}{\\newfontfamily\\hebrewfont{David}}{\\IfFontExistsTF{Arial}{\\newfontfamily\\hebrewfont{Arial}}{\\IfFontExistsTF{Liberation Serif}{\\newfontfamily\\hebrewfont{Liberation Serif}}{\\newfontfamily\\hebrewfont{FreeSerif}}}}}
\\IfFontExistsTF{Nachlieli CLM}{\\newfontfamily\\titlefont{Nachlieli CLM}}{\\IfFontExistsTF{Arial}{\\newfontfamily\\titlefont{Arial}}{\\IfFontExistsTF{Liberation Sans}{\\newfontfamily\\titlefont{Liberation Sans}}{\\newfontfamily\\titlefont{FreeSans}}}}
\\IfFontExistsTF{Courier New}{\\setmonofont{Courier New}}{\\IfFontExistsTF{Consolas}{\\setmonofont{Consolas}}{\\IfFontExistsTF{Liberation Mono}{\\setmonofont{Liberation Mono}}{\\setmonofont{FreeMono}}}}
\\IfFontExistsTF{Courier New}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Courier New}}{\\IfFontExistsTF{Consolas}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Consolas}}{\\IfFontExistsTF{Liberation Mono}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Liberation Mono}}{\\IfFontExistsTF{FreeMono}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{FreeMono}}{}}}}
\\IfFontExistsTF{Courier New}{\\newfontfamily\\englishfonttt{Courier New}}{\\IfFontExistsTF{Consolas}{\\newfontfamily\\englishfonttt{Consolas}}{\\IfFontExistsTF{Liberation Mono}{\\newfontfamily\\englishfonttt{Liberation Mono}}{}}}
\\IfFontExistsTF{Times New Roman}{\\newfontfamily\\englishfont{Times New Roman}}{\\IfFontExistsTF{Latin Modern Roman}{\\newfontfamily\\englishfont{Latin Modern Roman}}{\\IfFontExistsTF{Liberation Serif}{\\newfontfamily\\englishfont{Liberation Serif}}{\\newfontfamily\\englishfont{FreeSerif}}}}`;

    docLatex = docLatex.replace(/\\IfFontExistsTF\{[\s\S]*?\n\\IfFontExistsTF\{Times New Roman\}[\s\S]*?\n/, `${safeFontSetup}\n`);

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

    // Process all referenced assets
    for (const asset of assets) {
      if (asset.isUrl) continue;

      const found = findAssetFile(asset.path);
      if (!found) {
        // Missing figure -> placeholder box so XeLaTeX won't abort
        docLatex = placeholderForAsset(docLatex, asset, skippedLabel(asset, 'missing'));
        continue;
      }

      const ext = path.extname(found.filePath).toLowerCase();
      const baseName = path.basename(found.filePath);

      if (ext === '.svg') {
        try {
          // Convert SVG to PNG using sharp (300 DPI for crisp print quality)
          const pngBuffer = await sharp(found.buffer, { density: 300 }).png().toBuffer();
          const pngName = baseName.replace(/\.svg$/i, '.png');
          files.set(pngName, new Uint8Array(pngBuffer));
          docLatex = substituteAsset(docLatex, asset, { path: pngName, kind: 'image' });
        } catch (err) {
          console.warn(`Failed to render SVG ${baseName} to PNG:`, err);
          docLatex = placeholderForAsset(docLatex, asset, skippedLabel(asset, 'unreadable'));
        }
      } else {
        files.set(baseName, new Uint8Array(found.buffer));
      }
    }

    const texFileName = 'document.tex';
    files.set(texFileName, docLatex);

    // Compile using XeLaTeX via @mdtolatex/node
    const result = await compileToPdf(files, texFileName);

    const safeTitle =
      title
        .replace(/[^\u0590-\u05FFa-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'document';

    return new Response(result.pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.pdf`,
      },
    });
  } catch (error: any) {
    console.error('PDF compilation failed:', error);
    const details = Array.isArray(error?.errors) && error.errors.length > 0 ? error.errors.join('\n') : '';
    let message = error?.message || details || 'Failed to compile PDF with XeLaTeX.';
    if (message === 'xelatex produced no PDF' && details) {
      message = details;
    }
    return Response.json({ error: message }, { status: 422 });
  }
}
