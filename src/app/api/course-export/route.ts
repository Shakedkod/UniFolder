import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { compileToPdf } from '@mdtolatex/node';
import {
  convert,
  buildBundle,
  substituteAsset,
  placeholderForAsset,
  skippedLabel,
  missingBox,
  type AssetReference,
} from '@mdtolatex/core';
import {
  prepareLatexForCompilation,
  shiftMarkdownHeadings,
  stripFrontmatter,
  cleanLectureTitle,
} from '@/lib/latex-helper';
import { VAULT_DIRECTORY, getFolderTitle } from '@/lib/vault';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow sufficient time for multi-lecture XeLaTeX compilation

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
    const body = await request.json();
    const slug: string[] = body.slug || [];
    const format: 'latex' | 'pdf' = body.format === 'pdf' ? 'pdf' : 'latex';
    const customTitle: string = body.title || '';

    if (!slug || slug.length === 0) {
      return Response.json({ error: 'Missing course slug' }, { status: 400 });
    }

    const targetDir = path.join(VAULT_DIRECTORY, ...slug);
    if (!fs.existsSync(targetDir)) {
      console.warn(`[CourseExport] Target directory does not exist: ${targetDir}`);
      return Response.json({ error: 'Course folder not found' }, { status: 404 });
    }

    // Determine course title
    const rawFolderName = slug[slug.length - 1];
    const resolvedTitle = customTitle || getFolderTitle(rawFolderName) || rawFolderName;

    console.log(`[CourseExport] Gathering lectures for "${resolvedTitle}" (${slug.join('/')})...`);

    // Read all JSON files in the directory
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const jsonFiles = entries.filter((e) => !e.isDirectory() && e.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return Response.json({ error: 'No note files found in this folder' }, { status: 400 });
    }

    const hwRegex = /(גליון|גיליון|וובוורק|שיעורי\s*בית|מטלה|hw|homework|שאלון)/i;
    const numberedRegex = /^\d+/;

    interface LectureFileItem {
      fileName: string;
      title: string;
      rawMarkdown: string;
      orderNum: number;
    }

    const candidateLectures: LectureFileItem[] = [];

    for (const file of jsonFiles) {
      try {
        const fullFilePath = path.join(targetDir, file.name);
        const data = JSON.parse(fs.readFileSync(fullFilePath, 'utf8'));

        if (data.type === 'pdf') continue; // Skip raw external PDF files

        const fileTitle = (data.title || file.name.replace(/\.json$/, '')).trim();

        // Skip homework assignments
        if (hwRegex.test(fileTitle)) continue;

        const numMatch = fileTitle.match(/^\d+/) || file.name.match(/^\d+/);
        const orderNum = numMatch ? parseInt(numMatch[0], 10) : 9999;

        const rawMarkdown = data.rawMarkdown || '';
        candidateLectures.push({
          fileName: file.name,
          title: fileTitle,
          rawMarkdown,
          orderNum,
        });
      } catch (err) {
        console.warn(`[CourseExport] Failed to parse file ${file.name}:`, err);
      }
    }

    if (candidateLectures.length === 0) {
      return Response.json({ error: 'No lecture files found to export' }, { status: 400 });
    }

    // Sort files: numbered files first by number, then alphabetically
    candidateLectures.sort((a, b) => {
      if (a.orderNum !== b.orderNum) return a.orderNum - b.orderNum;
      return a.title.localeCompare(b.title, 'he');
    });

    console.log(`[CourseExport] Found ${candidateLectures.length} lecture files to compile.`);

    // Build the combined Markdown document
    const lectureSections: string[] = [];

    for (const lecture of candidateLectures) {
      const cleanTitle = cleanLectureTitle(lecture.title);
      const contentWithoutFrontmatter = stripFrontmatter(lecture.rawMarkdown);
      const shiftedContent = shiftMarkdownHeadings(contentWithoutFrontmatter);

      // Prepend the lecture title as the level 1 heading (becomes \section in LaTeX)
      const sectionBlock = `# ${cleanTitle}\n\n${shiftedContent}`;
      lectureSections.push(sectionBlock);
    }

    // Combine lectures with page breaks between them
    const combinedMarkdown = lectureSections.join('\n\n\\newpage\n\n');

    // Read LaTeX preamble if available
    let preamble: string | undefined;
    const preamblePath = path.join(process.cwd(), 'public', 'vault', 'preamble.sty');
    if (fs.existsSync(preamblePath)) {
      try {
        preamble = fs.readFileSync(preamblePath, 'utf8');
      } catch {}
    }

    const hasHebrew = /[\u0590-\u05FF]/.test(combinedMarkdown);

    // Convert combined Markdown into unified LaTeX document
    const converted = convert(combinedMarkdown, {
      title: resolvedTitle,
      language: hasHebrew ? 'hebrew' : 'english',
      preamble,
      theme: 'regular',
      toc: true, // Enable automatic Table of Contents for multi-lecture bundle
    });

    let docLatex = prepareLatexForCompilation(converted.latex);
    const assets = converted.assets || [];

    const safeFilename =
      resolvedTitle
        .replace(/[^\u0590-\u05FFa-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'course_lectures';

    console.log(`[CourseExport] Converted LaTeX successfully (${docLatex.length} chars, ${assets.length} assets).`);

    // ==========================================
    // 1. LATEX / ZIP EXPORT
    // ==========================================
    if (format === 'latex') {
      const localAssets = assets.filter((a) => !a.isUrl);

      // If no assets, send plain .tex file
      if (localAssets.length === 0) {
        return new Response(docLatex, {
          headers: {
            'Content-Type': 'text/x-tex; charset=utf-8',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}.tex"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.tex`,
          },
        });
      }

      // If assets exist, bundle into a .zip archive
      const bundle = await buildBundle({
        latex: docLatex,
        assets: localAssets,
        texName: `${safeFilename}.tex`,
        readAsset: (assetPath) => {
          const res = findAssetFile(assetPath);
          return res ? new Uint8Array(res.buffer) : null;
        },
        onSkipped: (asset, reason) => missingBox(asset, skippedLabel(asset, reason)),
      });

      return new Response(bundle.zip as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}.zip"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.zip`,
        },
      });
    }

    // ==========================================
    // 2. PDF EXPORT (XeLaTeX)
    // ==========================================
    console.log(`[CourseExport] Starting XeLaTeX PDF compilation for "${resolvedTitle}"...`);

    const files = new Map<string, Uint8Array | string>();

    // Process image assets
    for (const asset of assets) {
      if (asset.isUrl) continue;
      const found = findAssetFile(asset.path);
      if (!found) {
        console.warn(`[CourseExport] Asset not found: ${asset.path}`);
        docLatex = placeholderForAsset(docLatex, asset, skippedLabel(asset, 'missing'));
        continue;
      }

      const ext = path.extname(found.filePath).toLowerCase();
      const baseName = path.basename(found.filePath);

      if (ext === '.svg') {
        try {
          const pngBuffer = await sharp(found.buffer, { density: 300 }).png().toBuffer();
          const pngName = baseName.replace(/\.svg$/i, '.png');
          files.set(pngName, new Uint8Array(pngBuffer));
          docLatex = substituteAsset(docLatex, asset, { path: pngName, kind: 'image' });
        } catch (err) {
          console.warn(`[CourseExport] Failed to render SVG ${baseName} to PNG:`, err);
          docLatex = placeholderForAsset(docLatex, asset, skippedLabel(asset, 'unreadable'));
        }
      } else {
        files.set(baseName, new Uint8Array(found.buffer));
      }
    }

    const texFileName = 'document.tex';
    files.set(texFileName, docLatex);

    const pdfResult = await compileToPdf(files, texFileName);

    console.log(`[CourseExport] XeLaTeX compilation finished successfully! PDF size: ${pdfResult.pdf.length} bytes.`);

    return new Response(pdfResult.pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}.pdf"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.pdf`,
      },
    });
  } catch (error: any) {
    console.error('[CourseExport] Export failed:', error);
    const message =
      error?.message ||
      (Array.isArray(error?.errors) && error.errors.length > 0
        ? error.errors.join('\n')
        : 'Failed to export course lectures.');
    return Response.json({ error: message }, { status: 500 });
  }
}
