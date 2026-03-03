import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import GithubSlugger from 'github-slugger';

// CLOUD CONFIGURATION
const GITHUB_PAT = process.env.GITHUB_PAT;
const VAULT_REPO = 'github.com/ShakedKod/ShakedKodPrivate.git';

const TEMP_DIR = path.join(process.cwd(), 'temp_vault');
const DEST_VAULT = path.join(process.cwd(), 'public', 'vault');
const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'vault-images');

// THE DICTIONARY (Only for permanent structural folders!)
const DICTIONARY = {
    'תואר ראשון במדעי המחשב': 'bsc-cs',
    'סמסטר א': 'semester-a',
    'סמסטר א\'': 'semester-a',
    'סמסטר ב': 'semester-b',
    'סמסטר ב\'': 'semester-b',
    'שיעורי בית': 'hw',
    'תרגול': 'tutorials',
    'מעונות': 'dorms'
};

// ---  Hebrew to English Transliteration Fallback ---
const HEBREW_MAP = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch',
    'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n',
    'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'p', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k',
    'ר': 'r', 'ש': 'sh', 'ת': 't'
};

// The expanded list of academic and code extensions
const allowedExtensions = [
    '.md', '.c', '.h', '.cpp', '.hpp',
    '.java', '.py', '.js', '.ts',
    '.sh', '.sql', '.json', '.yaml', '.yml'
];

function transliterate(str)
{
    return str.split('').map(char => HEBREW_MAP[char] || char).join('');
}

// --- UPGRADED: Smart Slug Generator ---
function getSlugName(name)
{
    // 1. Check Dictionary first (Highest priority for structural folders)
    if (DICTIONARY[name]) return DICTIONARY[name];

    // 2. Extract Prefix Numbers & Codes (e.g., "01040031 - אינפי 1מ" -> "01040031")
    // Also matches "02 - Technion" -> "02"
    const prefixMatch = name.match(/^([\d\-]+)\s*-/);
    if (prefixMatch) return prefixMatch[1];

    // 3. Extract Academic Years (e.g., "2025-2026 שנה א" -> "2025-2026")
    const yearMatch = name.match(/^(\d{4}-\d{4})/);
    if (yearMatch) return yearMatch[1];

    // 4. Extract Suffix Numbers (e.g., "גליון 12" -> "12")
    const suffixMatch = name.match(/\s+(\d+)$/);
    if (suffixMatch) return suffixMatch[1];

    // 5. Fallback: Transliterate to ASCII (e.g., "משפט" -> "mshpt")
    const safeAscii = transliterate(name);

    // Lowercase and replace spaces/special chars with dashes for safe URLs
    return safeAscii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const FOLDER_DICTIONARY = {
    'semester-a': "סמסטר א'",
    'semester-b': "סמסטר ב'",
    'bsc-cs': 'תואר ראשון במדעי המחשב',
    'hw': 'שיעורי בית',
    'tutorials': 'תרגול',
};

var dynamicFolderMap = {};

function getVaultTree(dir = VAULT_DIRECTORY, currentPath = '')
{
    if (!fs.existsSync(dir)) return [];

    // --- NEW: Load the auto-generated folder map ---
    if (Object.keys(dynamicFolderMap).length === 0)
    {
        try
        {
            const mapPath = path.join(VAULT_DIRECTORY, 'folder-map.json');
            if (fs.existsSync(mapPath))
            {
                dynamicFolderMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            } else
            {
                dynamicFolderMap = {};
            }
        } catch
        {
            dynamicFolderMap = {};
        }
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const tree = [];

    for (const entry of entries)
    {
        if (entry.name.startsWith('.')) continue;

        // --- NEW: Hide the system mapping file from the TOC ---
        if (entry.name === 'folder-map.json') continue;

        const fullPath = path.join(dir, entry.name);
        const slug = entry.name.replace(/\.md$/, '');
        const itemPath = `${currentPath}/${slug}`;

        if (entry.isDirectory())
        {
            const children = getVaultTree(fullPath, itemPath);

            if (children.length > 0)
            {
                tree.push({
                    name: entry.name,
                    // --- NEW: Check the dynamic map before falling back to the raw name ---
                    title: FOLDER_DICTIONARY[entry.name] || dynamicFolderMap[entry.name] || entry.name.replace(/-/g, ' '),
                    path: itemPath,
                    isDirectory: true,
                    fullPath: fullPath,
                    children: children
                });
            }
        } else if (allowedExtensions.includes(path.extname(entry.name).toLowerCase()))
        {
            const content = fs.readFileSync(fullPath, 'utf8');

            if (path.extname(entry.name).toLowerCase() === '.md')
            {
                const { data } = matter(content);

                tree.push({
                    name: slug,
                    title: data.title || slug,
                    path: itemPath,
                    fullPath: fullPath,
                    isDirectory: false
                });
            }
            else
            {
                tree.push({
                    name: slug,
                    title: slug.replace(/-/g, ' '),
                    path: itemPath,
                    fullPath: fullPath,
                    isDirectory: false
                });
            }
        }
    }

    // Sort the tree
    return tree.sort((a, b) =>
    {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;

        const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');

        if (numA !== numB) return numA - numB;
        return a.title.localeCompare(b.title, 'he');
    });
}

function cleanMarkdown(text)
{
    return text
        .replace(/!\[\[.*?\]\]/g, '')         // Remove image embeds
        .replace(/\[\[(.*?)\]\]/g, '$1')      // Simplify internal links
        .replace(/>\s*\[!.*?\][+-]?/g, '')    // Remove callout headers
        .replace(/#\w+/g, '')                 // Remove hashtags
        .replace(/---[\s\S]*?---/g, '')       // Remove YAML frontmatter
        .replace(/\n/g, ' ')                  // Flatten to single line
        .trim();
}

function generateSearchIndex(vaultTree)
{
    const index = [];

    function traverse(items)
    {
        for (const item of items)
        {
            if (item.isDirectory)
            {
                traverse(item.children);
            } else
            {
                const content = fs.readFileSync(item.fullPath, 'utf8');

                index.push({
                    title: item.title,
                    path: item.path,
                    excerpt: "Note Overview",
                    priority: 1 // We'll use this for sorting later
                });

                if (path.extname(item.fullPath).toLowerCase() === '.md')
                {
                    const sections = content.split(/(?=^#{1,6} )/gm);
                    const slugger = new GithubSlugger();

                    sections.forEach((section, i) =>
                    {
                        const lines = section.trim().split('\n');
                        const header = lines[0].replace(/^#+ /, '').trim();
                        if (!header || header === '---') return;
                        const cleanHeaderForSlug = header.replace(/\$/g, '');

                        // Grab ALL the text in this section, not just the first 3 lines
                        const fullBodyText = lines.slice(1).join(' ').trim();

                        index.push({
                            title: `${item.title} > ${header}`,
                            path: `${item.path}#${slugger.slug(cleanHeaderForSlug)}`,
                            content: cleanMarkdown(fullBodyText), // The search engine will read this
                            excerpt: cleanMarkdown(fullBodyText.substring(0, 150) + "..."), // Fallback for the UI
                            priority: 2
                        });
                    });
                }
                else
                {
                    index.push({
                        title: item.title,
                        path: item.path,
                        content: content,
                        excerpt: content.substring(0, 150) + "...",
                        priority: 1
                    });
                }
            }
        }
    }

    traverse(vaultTree);
    fs.writeFileSync('./public/search-index.json', JSON.stringify(index));
}

const autoFolderMap = {};

function syncVault(srcDir, destDir)
{
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries)
    {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const srcPath = path.join(srcDir, entry.name);
        const ext = path.extname(entry.name).toLocaleLowerCase();
        const originalName = path.basename(entry.name, ext);
        const englishName = getSlugName(originalName);
        const destPath = path.join(destDir, englishName + ext);

        if (entry.isDirectory())
        {
            autoFolderMap[englishName] = originalName;
            syncVault(srcPath, destPath);
        } else if (ext === '.md')
        {
            let content = fs.readFileSync(srcPath, 'utf8');

            content = content.replace(/<h1[^>]*>[\s\S]*?<div[^>]*class="page-break"[^>]*>.*?<\/div>\s*/i, '');
            content = content.replace(/<div[^>]*class="private"[^>]*>.*?<\/div>\s*/gi, '');

            // Inject Hebrew Title
            if (!content.startsWith('---'))
            {
                // If no frontmatter exists, create it
                content = `---\ntitle: "${originalName}"\n---\n\n${content}`;
            } else if (!content.includes('title:'))
            {
                // If frontmatter exists, inject the title on the second line
                // The \r? ensures it works on both Windows and Mac/Linux line endings
                content = content.replace(/^---\r?\n/, `---\ntitle: "${originalName}"\n`);
            }

            fs.writeFileSync(destPath, content, 'utf8');
        }
        else if (allowedExtensions.includes(ext))
        {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function syncImages(srcDir)
{
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries)
    {
        // Skip hidden folders
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.parentPath.includes("School") || entry.parentPath.includes("Self") || entry.parentPath.includes("Projects")) continue;

        const srcPath = path.join(srcDir, entry.name);

        if (entry.isDirectory())
        {
            syncImages(srcPath); // Recursively search all folders
        } else
        {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext))
            {
                const imageDestPath = path.join(PUBLIC_IMAGES_DIR, entry.name);
                fs.copyFileSync(srcPath, imageDestPath);
                console.log(`🖼️ Copied image: ${entry.name}`);
            }
        }
    }
}

// 4. THE CLOUD EXECUTION
async function main()
{
    console.log('🔒 Authenticating and cloning private vault...');
    if (!GITHUB_PAT)
    {
        console.error('❌ GITHUB_PAT is missing! Cannot clone private vault.');
        process.exit(1);
    }

    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    if (fs.existsSync(DEST_VAULT)) fs.rmSync(DEST_VAULT, { recursive: true, force: true });
    if (fs.existsSync(PUBLIC_IMAGES_DIR)) fs.rmSync(PUBLIC_IMAGES_DIR, { recursive: true, force: true });

    fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

    execSync(`git clone https://${GITHUB_PAT}@${VAULT_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });

    console.log('🔄 Translating and syncing files...');

    syncImages(TEMP_DIR);

    const SPECIFIC_FOLDER = path.join(TEMP_DIR, "01 - University", "02 - Technion", "תואר ראשון במדעי המחשב");

    if (fs.existsSync(SPECIFIC_FOLDER))
    {
        syncVault(SPECIFIC_FOLDER, DEST_VAULT);
    } else
    {
        console.error('❌ Could not find the folder "תואר ראשון במדעי המחשב" in the repository.');
    }

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    // Save the folder memory map to the vault!
    fs.writeFileSync(
        path.join(DEST_VAULT, 'folder-map.json'),
        JSON.stringify(autoFolderMap, null, 2)
    );

    // Generate search index after syncing
    console.log('🔍 Generating search index...')
    const vaultTree = getVaultTree(DEST_VAULT);
    generateSearchIndex(vaultTree);

    console.log('✨ Vault Sync Complete!');
}

main();