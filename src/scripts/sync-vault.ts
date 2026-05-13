import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import { renderMarkdownContent } from '@/lib/processor';
import { VAULT_DIRECTORY } from '@/lib/vault';
import { PDFParse } from 'pdf-parse';
import { exit } from 'process';

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
        if (entry.name.startsWith('.') || entry.name === 'folder-map.json' || entry.name === 'link-map.json') continue;

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
    return text.replace(/!\[\[.*?\]\]/g, '').replace(/\[\[(.*?)\]\]/g, '$1')
        .replace(/>\s*\[!.*?\][+-]?/g, '').replace(/#\w+/g, '')
        .replace(/---[\s\S]*?---/g, '').replace(/\n/g, ' ').trim();
}

async function extractPdfText(filePath: string): Promise<{ text: string; toc: any[] }> {
    const parser = new PDFParse({ url: filePath });
    const data = await parser.getText();
    const tocData = await parser.getInfo();
    return { text: data.text, toc: tocData.outline || [] };
}

interface SearchIndexItem {
    title: string;
    path: string;
    content?: string;
    excerpt: string;
    priority: number;
}
function generateSearchIndex(vaultTree: VaultItem[]) {
    const index: SearchIndexItem[] = [];

    function traverse(items: VaultItem[]) {
        for (const item of items) {
            if (item.isDirectory) 
            {
                if (item.children) traverse(item.children);
            }
            else 
            {
                try {
                    const parsed = JSON.parse(fs.readFileSync(item.fullPath, 'utf8'));
                    const content = parsed.html || '';
                    index.push({ title: item.title, path: item.path, excerpt: "Note Overview", priority: 1 });
                    index.push({
                        title: item.title,
                        path: item.path,
                        content: cleanMarkdown(content.replace(/<[^>]*>?/gm, '')),
                        excerpt: cleanMarkdown(content.replace(/<[^>]*>?/gm, '').substring(0, 150) + "..."),
                        priority: 2
                    });
                } catch (e) { }
            }
        }
    }

    traverse(vaultTree);
    fs.writeFileSync('./public/search-index.json', JSON.stringify(index));
}

async function processVaultFile(rawContent: string, filename: string, title: string, extension: string, destPath: string) {
    const cleanExt = extension.startsWith('.') ? extension.substring(1) : extension;
    const codeExtensions: { [key: string]: string } = {
        'c': 'c', 'h': 'c', 'cpp': 'cpp', 'hpp': 'cpp', 'java': 'java', 'py': 'python',
        'js': 'javascript', 'ts': 'typescript', 'sh': 'bash', 'sql': 'sql', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml'
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

    const { contentHtml, toc } = await renderMarkdownContent(markdownContent);

    const compiledData = { title, type: isCodeFile ? "code" : "md", toc, html: contentHtml };
    fs.writeFileSync(path.join(destPath, filename + ".json"), JSON.stringify(compiledData));
}

async function processPDFFile(filePath: string, filename: string, title: string, destPath: string)
{
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

function passOneBuildStructure(srcDir: string, destDir: string, currentUrl = '') {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

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
            entry.name === 'link-map.json'
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
                if (data.pub_date && new Date(data.pub_date) <= new Date()) continue; // Skip future-dated notes
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

async function main() {
    console.log('🔒 Authenticating and cloning private vault...');
    if (!GITHUB_PAT) {
        console.error('❌ GITHUB_PAT is missing! Cannot clone private vault.');
        process.exit(1);
    }

    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    if (fs.existsSync(VAULT_DIRECTORY)) fs.rmSync(VAULT_DIRECTORY, { recursive: true, force: true });
    if (fs.existsSync(PUBLIC_IMAGES_DIR)) fs.rmSync(PUBLIC_IMAGES_DIR, { recursive: true, force: true });

    fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
    execSync(`git clone https://${GITHUB_PAT}@${VAULT_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });

    console.log('🔄 Syncing Images...');
    syncImages(TEMP_DIR);

    const SPECIFIC_FOLDER = path.join(TEMP_DIR, "01 - University", "02 - Technion", "תואר ראשון במדעי המחשב");

    if (fs.existsSync(SPECIFIC_FOLDER)) {
        console.log('🏗️ PASS 1: Building directory structure and copying raw files...');
        passOneBuildStructure(SPECIFIC_FOLDER, VAULT_DIRECTORY);

        // Save maps for the processor and sidebar!
        fs.writeFileSync(path.join(VAULT_DIRECTORY, 'folder-map.json'), JSON.stringify(autoFolderMap, null, 2));
        fs.writeFileSync(path.join(VAULT_DIRECTORY, 'link-map.json'), JSON.stringify(globalLinkMap, null, 2));

        console.log('⚙️ PASS 2: Compiling Markdown to JSON blobs...');
        await passTwoCompileFiles(VAULT_DIRECTORY);
    } else {
        console.error('❌ Could not find the specific target folder in the repository.');
    }

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log('🔍 Generating search index...');
    const vaultTree = getVaultTree(VAULT_DIRECTORY);
    generateSearchIndex(vaultTree);

    console.log('✨ Vault Sync Complete!');
    exit(0);
}

main();