import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 1. CLOUD CONFIGURATION
const GITHUB_PAT = process.env.GITHUB_PAT; 
const VAULT_REPO = 'github.com/ShakedKod/ShakedKodPrivate.git';

const TEMP_DIR = path.join(process.cwd(), 'temp_vault');
const DEST_VAULT = path.join(process.cwd(), 'vault');

// 2. THE DICTIONARY (Only for permanent structural folders!)
const DICTIONARY = {
    'תואר ראשון במדעי המחשב': 'bsc-cs',
    'סמסטר א': 'semester-a',
    'סמסטר א\'': 'semester-a', // Matches the apostrophe
    'שיעורי בית': 'hw',
    'תרגול': 'tutorials',
    'מעונות': 'dorms'
};

// --- NEW: Hebrew to English Transliteration Fallback ---
const HEBREW_MAP = {
    'א':'a', 'ב':'b', 'ג':'g', 'ד':'d', 'ה':'h', 'ו':'v', 'ז':'z', 'ח':'ch',
    'ט':'t', 'י':'y', 'כ':'k', 'ך':'k', 'ל':'l', 'מ':'m', 'ם':'m', 'נ':'n',
    'ן':'n', 'ס':'s', 'ע':'a', 'פ':'p', 'ף':'p', 'צ':'tz', 'ץ':'tz', 'ק':'k',
    'ר':'r', 'ש':'sh', 'ת':'t'
};

function transliterate(str) {
    return str.split('').map(char => HEBREW_MAP[char] || char).join('');
}

// --- UPGRADED: Smart Slug Generator ---
function getSlugName(name) {
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

// Helper: Translate a full path for Wikilinks
function translatePath(filePath) {
    const parts = filePath.split(/[/\\]/);
    const translatedParts = parts.map(part => {
        const ext = path.extname(part);
        const name = path.basename(part, ext);
        const safeSlug = getSlugName(name); // <-- Hooked up here!
        return safeSlug + ext;
    });
    return translatedParts.join('/');
}

const autoFolderMap = {};

function syncVault(srcDir, destDir) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const srcPath = path.join(srcDir, entry.name);
        const ext = path.extname(entry.name);
        const originalName = path.basename(entry.name, ext);
        const englishName = getSlugName(originalName);
        const destPath = path.join(destDir, englishName + ext);

        if (entry.isDirectory()) {
            autoFolderMap[englishName] = originalName;
            syncVault(srcPath, destPath);
        } else if (ext === '.md') {
            let content = fs.readFileSync(srcPath, 'utf8');

            // Fix Wikilinks
            content = content.replace(/\[\[(.*?)\]\]/g, (match, linkContent) => {
                const parts = linkContent.split('|');
                const linkPath = parts[0];
                const displayTitle = parts[1] || linkPath.split(/[/\\]/).pop();
                const translatedLink = translatePath(linkPath);
                return `[[${translatedLink}|${displayTitle}]]`;
            });

            content = content.replace(/<h1[^>]*>[\s\S]*?<div[^>]*class="page-break"[^>]*>.*?<\/div>\s*/i, '');

            // Inject Hebrew Title
            if (!content.startsWith('---')) {
                // If no frontmatter exists, create it
                content = `---\ntitle: "${originalName}"\n---\n\n${content}`;
            } else if (!content.includes('title:')) {
                // If frontmatter exists, inject the title on the second line
                // The \r? ensures it works on both Windows and Mac/Linux line endings
                content = content.replace(/^---\r?\n/, `---\ntitle: "${originalName}"\n`);
            }

            fs.writeFileSync(destPath, content, 'utf8');
        }
    }
}

// 4. THE CLOUD EXECUTION
console.log('🔒 Authenticating and cloning private vault...');
if (!GITHUB_PAT) {
    console.error('❌ GITHUB_PAT is missing! Cannot clone private vault.');
    process.exit(1);
}

if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
if (fs.existsSync(DEST_VAULT)) fs.rmSync(DEST_VAULT, { recursive: true, force: true });

execSync(`git clone https://${GITHUB_PAT}@${VAULT_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });

console.log('🔄 Translating and syncing files...');

const SPECIFIC_FOLDER = path.join(TEMP_DIR, "01 - University", "02 - Technion", "תואר ראשון במדעי המחשב");

if (fs.existsSync(SPECIFIC_FOLDER)) {
    syncVault(SPECIFIC_FOLDER, DEST_VAULT);
} else {
    console.error('❌ Could not find the folder "תואר ראשון במדעי המחשב" in the repository.');
}

fs.rmSync(TEMP_DIR, { recursive: true, force: true });

// Save the folder memory map to the vault!
fs.writeFileSync(
    path.join(DEST_VAULT, 'folder-map.json'), 
    JSON.stringify(autoFolderMap, null, 2)
);

console.log('✨ Vault Sync Complete!');