import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import { renderMarkdownContent } from '@/lib/processor';
import { VAULT_DIRECTORY } from '@/lib/vault';
import { PDFParse } from 'pdf-parse';
import { exit } from 'process';
import { parseStyMacros } from '@/lib/katex-macros';
import { convert } from '@/lib/mdtolatex';

// CLOUD CONFIGURATION
const GITHUB_PAT = process.env.GITHUB_PAT;
const VAULT_REPO = process.env.VAULT_REPO;

const TEMP_DIR = path.join(process.cwd(), 'temp_vault');
const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'vault-images');

// THE DICTIONARY (Only for permanent structural folders!)
const DICTIONARY: { [key: string]: string } = {
    'תואר ראשון במדעי המחשב': 'bsc-cs',
    'סמסטר א': 'semester-a',
    'סמסטר א\'': 'semester-a',
    'סמסטר ב': 'semester-b',
    'סמסטר ב\'': 'semester-b',
    'שיעורי בית': 'hw',
    'תרגול': 'tutorials',
    'מעונות': 'dorms'
};

const HEBREW_MAP: { [key: string]: string } = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch',
    'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n',
    'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'p', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k',
    'ר': 'r', 'ש': 'sh', 'ת': 't'
};

const allowedExtensions: string[] = [
    '.md', ".pdf",
    '.c', '.h', '.cpp', '.hpp',
    '.java', '.py', '.js', '.ts',
    '.sh', '.sql', '.json', '.yaml', '.yml'
];

interface VaultItem {
    name: string;
    title: string;
    path: string;
    isDirectory: boolean;
    fullPath: string;
    children?: VaultItem[];
}

function transliterate(str: string): string {
    return str.split('').map(char => HEBREW_MAP[char] || char).join('');
}

function getSlugName(name: string): string {
    if (DICTIONARY[name]) return DICTIONARY[name];
    const prefixMatch = name.match(/^([\d\-]+)\s*-/);
    if (prefixMatch) return prefixMatch[1];
    const yearMatch = name.match(/^(\d{4}-\d{4})/);
    if (yearMatch) return yearMatch[1];
    const suffixMatch = name.match(/\s+(\d+)$/);
    if (suffixMatch) return suffixMatch[1];
    const safeAscii = transliterate(name);
    return safeAscii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const FOLDER_DICTIONARY: { [key: string]: string } = {
    'semester-a': "סמסטר א'",
    'semester-b': "סמסטר ב'",
    'bsc-cs': 'תואר ראשון במדעי המחשב',
    'hw': 'שיעורי בית',
    'tutorials': 'תרגול',
};

var dynamicFolderMap: { [key: string]: string } = {};

function getVaultTree(dir: string = VAULT_DIRECTORY, currentPath: string = ''): VaultItem[] {
    if (!fs.existsSync(dir)) return [];

    if (Object.keys(dynamicFolderMap).length === 0) {
        try {
            const mapPath = path.join(VAULT_DIRECTORY, 'folder-map.json');
            if (fs.existsSync(mapPath)) dynamicFolderMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        } catch { dynamicFolderMap = {}; }
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const tree = [];

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'folder-map.json' || entry.name === 'link-map.json' ||
            entry.name === 'preamble-macros.json') continue;

        const fullPath = path.join(dir, entry.name);
        const slug = entry.name.replace(/\.json$/, '').replace(/\.md$/, '');
        const itemPath = `${currentPath}/${slug}`;

        if (entry.isDirectory()) {
            const children = getVaultTree(fullPath, itemPath);
            if (children.length > 0) {
                tree.push({
                    name: entry.name,
                    title: FOLDER_DICTIONARY[entry.name] || dynamicFolderMap[entry.name] || entry.name.replace(/-/g, ' '),
                    path: itemPath,
                    isDirectory: true,
                    fullPath: fullPath,
                    children: children
                });
            }
        } else if (entry.name.endsWith('.json') || allowedExtensions.includes(path.extname(entry.name).toLowerCase())) {
            let title = slug.replace(/-/g, ' ');
            if (entry.name.endsWith('.json')) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    if (parsed.title) title = parsed.title;
                } catch (e) { }
            }
            tree.push({
                name: slug,
                title: title,
                path: itemPath,
                fullPath: fullPath,
                isDirectory: false
            });
        }
    }

    return tree.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');
        if (numA !== numB) return numA - numB;
        return a.title.localeCompare(b.title, 'he');
    });
}

function cleanMarkdown(text: string): string {
    return text
        .replace(/(?<!=)==(?!=)(?:[🔴🟠🟡🟢🔵🟣]\s*)?(.*?)(?<!=)==(?!=)/gu, '$1')
        .replace(/!\[\[.*?\]\]/g, '')
        .replace(/\[\[(.*?)\]\]/g, '$1')
        .replace(/>\s*\[!.*?\][+-]?/g, '')
        .replace(/#\w+/g, '')
        .replace(/---[\s\S]*?---/g, '')
        .replace(/\n/g, ' ')
        .trim();
}

async function extractPdfText(filePath: string): Promise<{ text: string; toc: any[] }> {
    const parser = new PDFParse({ url: filePath });
    const data = await parser.getText();
    const tocData = await parser.getInfo();
    return { text: data.text, toc: tocData.outline || [] };
}

let cachedPreamble: string | undefined = undefined;

const COURSE_SHORT_NAMES: Record<string, string> = {
    '01040031': "אינפי 1מ'",
    '01040166': "אלגברה אמ'",
    '02340114': 'מבוא למדמ"ח מ\'',
    '02340129': "קבוצות ואוטומטים",
    '01140071': "פיזיקה 1מ'",
    '01040032': "אינפי 2מ'",
    '00440252': "מערכות ספרתיות",
    '02340124': "תכנות מערכות",
    '02340125': "אלגוריתמים נומריים",
    '02340141': "קומבינטוריקה",
    '01140052': "פיזיקה 2",
    '02340218': "מבני נתונים 1",
    '02340292': 'לוגיקה למדמ"ח',
    '00940412': "הסתברות מ'",
    '01040134': "אלגברה מודרנית ח'",
    '01240120': "יסודות הכימיה",
    '03250010': "מדע דת ופילוסופיה",
};

const CALLOUT_TYPE_MAP: Record<string, { type: string; hebrew: string }> = {
    theorem: { type: 'theorem', hebrew: 'משפט' },
    definition: { type: 'definition', hebrew: 'הגדרה' },
    lemma: { type: 'lemma', hebrew: 'למה' },
    claim: { type: 'claim', hebrew: 'טענה' },
    corollary: { type: 'corollary', hebrew: 'מסקנה' },
    example: { type: 'example', hebrew: 'דוגמה' },
    axiom: { type: 'axiom', hebrew: 'אקסיומה' },
    exercise: { type: 'exercise', hebrew: 'תרגיל' },
    hw: { type: 'homework', hebrew: 'שיעורי בית' },
};

function getCourseInfoFromPath(rawPath: string): { code: string; name: string } {
    const parts = decodeURIComponent(rawPath).split('/').filter(Boolean);
    for (const part of parts) {
        if (/^\d{8}$/.test(part)) {
            const shortName = COURSE_SHORT_NAMES[part];
            const fullName = dynamicFolderMap[part] ? dynamicFolderMap[part].replace(/^\d{8}\s*-\s*/, '') : '';
            return {
                code: part,
                name: shortName || fullName || part
            };
        }
    }

    // Fallback: check if any part exists in dynamicFolderMap or DICTIONARY
    for (let i = parts.length - 2; i >= 0; i--) {
        const p = parts[i];
        if (['semester-a', 'semester-b', 'hw', 'tutorials', 'notes'].includes(p)) continue;
        if (dynamicFolderMap[p]) {
            return { code: '', name: dynamicFolderMap[p].replace(/^\d{8}\s*-\s*/, '') };
        }
    }

    return { code: '', name: '' };
}

interface SearchIndexItem {
    id: string;
    title: string;
    type: string;
    typeHebrew: string;
    path: string;
    content?: string;
    courseName?: string;
    courseCode?: string;
    noteTitle?: string;
    sectionTitle?: string;
    keywords?: string;
}

function generateSearchIndex(vaultTree: VaultItem[]) {
    const index: SearchIndexItem[] = [];
    let itemId = 0;

    // 1. Index Courses
    for (const [code, shortName] of Object.entries(COURSE_SHORT_NAMES)) {
        const fullName = dynamicFolderMap[code] ? dynamicFolderMap[code].replace(/^\d{8}\s*-\s*/, '') : shortName;
        index.push({
            id: String(++itemId),
            title: shortName,
            type: 'course',
            typeHebrew: 'קורס',
            path: `/course/${code}`,
            content: `קורס בטכניון: ${code} - ${fullName}`,
            courseName: shortName,
            courseCode: code,
            keywords: `${code} ${shortName} ${fullName} קורס`
        });
    }

    // 2. Index Notes, Headings (Topics), and Academic Callouts (Theorems, Definitions, Lemmas, Claims)
    function traverse(items: VaultItem[]) {
        for (const item of items) {
            if (item.isDirectory) {
                if (item.children) traverse(item.children);
            }
            else {
                if (!item.fullPath.endsWith('.json')) continue;
                try {
                    const parsed = JSON.parse(fs.readFileSync(item.fullPath, 'utf8'));
                    const noteTitle = (parsed.title || item.title || '').trim();
                    const courseInfo = getCourseInfoFromPath(item.path);

                    const pLower = item.path.toLowerCase();
                    const isHomework = pLower.includes('shyavry-byt') || pLower.includes('hw') || noteTitle.includes('שיעורי בית');
                    const isTutorial = pLower.includes('tutorials') || pLower.includes('trgvl') || noteTitle.includes('תרגול');
                    const isLecture = !isHomework && !isTutorial && (pLower.includes('lectures') || /^\d+/.test(noteTitle));

                    const noteType = isHomework ? 'homework' : isTutorial ? 'tutorial' : isLecture ? 'lecture' : 'note';
                    const noteTypeHebrew = isHomework ? 'שיעורי בית' : isTutorial ? 'תרגול' : isLecture ? 'הרצאה' : 'סיכום';

                    const rawBody = (parsed.rawMarkdown || parsed.html || '').replace(/<[^>]*>?/gm, '');
                    const cleanExcerpt = cleanMarkdown(rawBody).slice(0, 300);

                    // A. Add Note Entry
                    index.push({
                        id: String(++itemId),
                        title: noteTitle,
                        type: noteType,
                        typeHebrew: noteTypeHebrew,
                        path: item.path,
                        content: cleanExcerpt,
                        courseName: courseInfo.name,
                        courseCode: courseInfo.code,
                        keywords: `${noteTitle} ${courseInfo.name} ${courseInfo.code} ${noteTypeHebrew}`
                    });

                    // B. Add Headings (Topics) & Callouts (Theorems, Definitions, Lemmas, etc.)
                    if (Array.isArray(parsed.toc)) {
                        for (const heading of parsed.toc) {
                            const headingId = heading.id || '';
                            if (heading.title && heading.title !== 'כללי') {
                                index.push({
                                    id: String(++itemId),
                                    title: heading.title,
                                    type: 'topic',
                                    typeHebrew: 'נושא',
                                    path: headingId ? `${item.path}#${headingId}` : item.path,
                                    courseName: courseInfo.name,
                                    courseCode: courseInfo.code,
                                    noteTitle: noteTitle,
                                    keywords: `${heading.title} ${noteTitle} ${courseInfo.name}`
                                });
                            }

                            if (Array.isArray(heading.callouts)) {
                                for (const callout of heading.callouts) {
                                    const mapped = CALLOUT_TYPE_MAP[callout.type] || { type: 'topic', hebrew: 'נושא' };
                                    const calloutTitle = (callout.title || '').trim();
                                    const calloutContent = (callout.content || '').trim();
                                    const calloutId = callout.id || headingId || '';

                                    index.push({
                                        id: String(++itemId),
                                        title: calloutTitle,
                                        type: mapped.type,
                                        typeHebrew: mapped.hebrew,
                                        path: calloutId ? `${item.path}#${calloutId}` : item.path,
                                        content: calloutContent,
                                        courseName: courseInfo.name,
                                        courseCode: courseInfo.code,
                                        noteTitle: noteTitle,
                                        sectionTitle: heading.title,
                                        keywords: `${mapped.hebrew} ${calloutTitle} ${heading.title} ${noteTitle} ${courseInfo.name} ${courseInfo.code}`
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error indexing item:', item.path, e);
                }
            }
        }
    }

    traverse(vaultTree);
    fs.writeFileSync('./public/search-index.json', JSON.stringify(index));
    console.log(`✅ Indexed ${index.length} search items (Theorems, Definitions, Lemmas, Topics, Notes, Courses).`);
}

async function processVaultFile(rawContent: string, filename: string, title: string, extension: string, destPath: string) {
    const cleanExt = extension.startsWith('.') ? extension.substring(1) : extension;
    const codeExtensions: { [key: string]: string } = {
        'c': 'c', 'h': 'c', 'cpp': 'cpp', 'hpp': 'cpp', 'java': 'java', 'py': 'python',
        'js': 'javascript', 'ts': 'typescript', 'sh': 'bash', 'sql': 'sql', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml',
        "sv": "systemverilog", "v": "verilog", "vhdl": "vhdl", "asm": "assembly", "hex": "assembly", "inc": "assembly", "s": "assembly", "bat": "batch", "cmd": "batch"
    };

    const isCodeFile = !!codeExtensions[cleanExt];
    let markdownContent = rawContent;

    if (isCodeFile) {
        const lang = codeExtensions[cleanExt];
        markdownContent = `> [!remark|*] קובץ קוד\n> קובץ זה הוא קובץ קוד מסוג **${lang.toUpperCase()}**.\n\n\`\`\`${lang}\n${rawContent}\n\`\`\``;
    } else {
        const { data } = matter(rawContent);
        if (data.title) title = data.title;
    }

    const { contentHtml, toc } = await renderMarkdownContent(
        markdownContent
    );

    let latex = '';
    let assets: any[] = [];
    if (!isCodeFile) {
        try {
            const hasHebrew = /[\u0590-\u05FF]/.test(markdownContent);
            const res = convert(markdownContent, {
                title,
                language: hasHebrew ? 'hebrew' : 'english',
                preamble: cachedPreamble,
                theme: 'regular'
            });
            latex = res.latex;
            assets = res.assets;
        } catch (err) {
            console.error(`Failed to convert ${filename} to LaTeX:`, err);
        }
    }

    const compiledData: Record<string, unknown> = {
        title,
        type: isCodeFile ? "code" : "md",
        toc,
        html: contentHtml,
        latex,
        assets,
        rawMarkdown: markdownContent
    };
    fs.writeFileSync(path.join(destPath, filename + ".json"), JSON.stringify(compiledData));
}

async function processPDFFile(filePath: string, filename: string, title: string, destPath: string) {
    const { text, toc } = await extractPdfText(filePath);
    const jsonData = {
        title,
        type: "pdf",
        toc: toc,
        text: text
    };
    fs.writeFileSync(path.join(destPath, filename + ".json"), JSON.stringify(jsonData));
}

const autoFolderMap: { [key: string]: string } = {};

// --- NEW THE FIX: Master Maps to preserve Hebrew data! ---
const globalLinkMap: Record<string, string> = {};
const globalTitleMap: Record<string, string> = {};

const IGNORED_DIRS = new Set([
    'node_modules',
    'cmake-build-debug',
    'cmake-build-release',
    'CMakeFiles',
    'build',
    'bin',
    'obj',
    '.vs',
    '.idea',
    '.vscode',
    '__pycache__',
    'target',
    'dist'
]);

function passOneBuildStructure(srcDir: string, destDir: string, currentUrl = '') {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;

        const srcPath = path.join(srcDir, entry.name);
        const ext = path.extname(entry.name).toLocaleLowerCase();
        const originalName = path.basename(entry.name, ext);
        const englishName = getSlugName(originalName);
        const destPath = path.join(destDir, englishName + (entry.isDirectory() ? '' : ext));

        const itemUrl = currentUrl ? `${currentUrl}/${englishName}` : `/${englishName}`;

        // Memorize the exact links and titles before the file gets renamed!
        globalLinkMap[originalName] = itemUrl;
        globalLinkMap[englishName] = itemUrl;
        globalTitleMap[destPath] = originalName;

        if (entry.isDirectory()) {
            autoFolderMap[englishName] = originalName;
            passOneBuildStructure(srcPath, destPath, itemUrl);
        } else if (allowedExtensions.includes(ext)) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function passTwoCompileFiles(destDir: string) {
    const entries = fs.readdirSync(destDir, { withFileTypes: true });

    for (const entry of entries) {
        if (
            entry.name.startsWith('.') ||
            entry.name === 'folder-map.json' ||
            entry.name === 'link-map.json' ||
            entry.name === 'preamble-macros.json'
        ) continue;
        const fullPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            await passTwoCompileFiles(fullPath);
        } else if (entry.name.endsWith('.pdf')) {
            const englishName = path.basename(entry.name, '.pdf');
            const originalName = globalTitleMap[fullPath] || englishName;
            await processPDFFile(fullPath, englishName, originalName, destDir);
        } else if (allowedExtensions.includes(path.extname(entry.name).toLowerCase())) {
            const ext = path.extname(entry.name).toLocaleLowerCase();
            const englishName = path.basename(entry.name, ext);

            // Restore the Hebrew title from our Master Map!
            let originalName = globalTitleMap[fullPath] || englishName;
            const content = fs.readFileSync(fullPath, 'utf8');

            if (ext === '.md') {
                const { data } = matter(content);
                if (data.title) originalName = data.title;
                if (data.pub_date && new Date(data.pub_date) >= new Date()) {
                    fs.unlinkSync(fullPath);
                    continue; // Skip future-dated notes
                }
            }

            let cleanContent = content;
            if (ext === '.md') {
                cleanContent = cleanContent.replace(/<h1[^>]*>[\s\S]*?<div[^>]*class="page-break"[^>]*>.*?<\/div>\s*/i, '');
                cleanContent = cleanContent.replace(/<div[^>]*class="private"[^>]*>.*?<\/div>\s*/gi, '');
            }

            await processVaultFile(cleanContent, englishName + (ext === '.md' ? '' : ext), originalName, ext, destDir);
            fs.unlinkSync(fullPath);
        }
    }
}

function syncImages(srcDir: string) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.parentPath.includes("School") || entry.parentPath.includes("Self") || entry.parentPath.includes("Projects")) continue;
        const srcPath = path.join(srcDir, entry.name);

        if (entry.isDirectory()) {
            syncImages(srcPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) {
                fs.copyFileSync(srcPath, path.join(PUBLIC_IMAGES_DIR, entry.name));
            }
        }
    }
}

function extractAndSavePreambleMacros(vaultSrcDir: string) {
    // The vault's meta folder slug after transliteration is "99" (or similar).
    // We walk the whole temp directory looking for any file named "preamble.sty".
    function findFile(dir: string, filename: string): string | null {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = findFile(full, filename);
                if (found) return found;
            } else if (entry.name === filename) {
                return full;
            }
        }
        return null;
    }

    const styPath = findFile(vaultSrcDir, 'preamble.sty');
    if (!styPath) {
        console.log('ℹ️  preamble.sty not found — skipping custom macro extraction.');
        return;
    }

    console.log(`📐 Parsing LaTeX macros from ${styPath} ...`);
    const { parseStyMacros } = require('@/lib/katex-macros');
    const content = fs.readFileSync(styPath, 'utf8');
    cachedPreamble = content;
    const macros = parseStyMacros(content);

    const destPath = path.join(VAULT_DIRECTORY, 'preamble-macros.json');
    fs.writeFileSync(destPath, JSON.stringify(macros, null, 2));
    fs.writeFileSync(path.join(VAULT_DIRECTORY, 'preamble.sty'), content);
    console.log(`✅ Saved ${Object.keys(macros).length} macros → preamble-macros.json and preamble.sty`);
}

async function main() {
    const defaultVaultPath = process.env.USERPROFILE
        ? path.join(process.env.USERPROFILE, 'Documents', 'Vault')
        : path.join(process.cwd(), 'vault');
    const localVault = process.env.LOCAL_VAULT_PATH || defaultVaultPath;
    let vaultSrcDir = TEMP_DIR;
    let isLocal = false;

    if (!GITHUB_PAT) {
        if (fs.existsSync(localVault)) {
            console.log(`📂 GITHUB_PAT is not set — using local vault at: ${localVault}`);
            vaultSrcDir = localVault;
            isLocal = true;
        } else {
            console.error('❌ GITHUB_PAT is missing and local vault not found at:', localVault);
            process.exit(1);
        }
    } else {
        console.log('🔒 Authenticating and cloning private vault...');
        if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
        execSync(`git clone https://${GITHUB_PAT}@${VAULT_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });
    }

    if (fs.existsSync(VAULT_DIRECTORY)) fs.rmSync(VAULT_DIRECTORY, { recursive: true, force: true });
    if (fs.existsSync(PUBLIC_IMAGES_DIR)) fs.rmSync(PUBLIC_IMAGES_DIR, { recursive: true, force: true });

    fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

    console.log('🔄 Syncing Images...');
    syncImages(vaultSrcDir);

    const SPECIFIC_FOLDER = path.join(vaultSrcDir, "01 - University", "02 - Technion", "תואר ראשון במדעי המחשב");

    if (fs.existsSync(SPECIFIC_FOLDER)) {
        console.log('🏗️ PASS 1: Building directory structure and copying raw files...');
        passOneBuildStructure(SPECIFIC_FOLDER, VAULT_DIRECTORY);

        // Extract and save preamble macros if available
        extractAndSavePreambleMacros(vaultSrcDir);

        // Save maps for the processor and sidebar!
        fs.writeFileSync(path.join(VAULT_DIRECTORY, 'folder-map.json'), JSON.stringify(autoFolderMap, null, 2));
        fs.writeFileSync(path.join(VAULT_DIRECTORY, 'link-map.json'), JSON.stringify(globalLinkMap, null, 2));

        console.log('⚙️ PASS 2: Compiling Markdown to JSON blobs...');
        await passTwoCompileFiles(VAULT_DIRECTORY);
    } else {
        console.error('❌ Could not find the specific target folder in the repository:', SPECIFIC_FOLDER);
    }

    if (!isLocal && fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    console.log('🔍 Generating search index...');
    const vaultTree = getVaultTree(VAULT_DIRECTORY);
    generateSearchIndex(vaultTree);

    console.log('✨ Vault Sync Complete!');
    exit(0);
}

main();