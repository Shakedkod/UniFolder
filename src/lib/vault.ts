import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';

export interface TreeItem {
    name: string;
    title: string;
    path: string;
    isDirectory: boolean;
    children?: TreeItem[];
}

const FOLDER_DICTIONARY: Record<string, string> = {
    'university': 'אוניברסיטה',
    'physics': 'פיזיקה',
    'math': 'מתמטיקה',
    'semester-a': "סמסטר א'",
    'bsc-cs': 'תואר ראשון במדעי המחשב',
    'hw': 'שיעורי בית',
    'tutorials': 'תרגול',
    'dorms': 'מעונות'
};

const VAULT_DIRECTORY = path.join(process.cwd(), 'public', 'vault');

export function isVaultDirectory(slug: string[]): boolean {
    const fullPath = path.join(VAULT_DIRECTORY, ...slug);
    try {
        return fs.statSync(fullPath).isDirectory();
    } catch {
        return false;
    }
}

function getFolderMap(): Record<string, string> {
    try {
        const mapPath = path.join(VAULT_DIRECTORY, 'folder-map.json');
        if (fs.existsSync(mapPath)) {
            const fileContents = fs.readFileSync(mapPath, 'utf8');
            return JSON.parse(fileContents);
        }
    } catch (error) {
        console.error("Failed to load folder-map.json:", error);
    }
    return {};
}

const FOLDER_MAP = getFolderMap();

export function getFriendlyName(slug: string): string {
    return FOLDER_MAP[slug] || slug;
}

export function getFolderContents(slug: string[]) {
    const fullPath = path.join(VAULT_DIRECTORY, ...slug);
    
    // Read the directory contents
    const items = fs.readdirSync(fullPath, { withFileTypes: true });

    return items
        // Filter out hidden files or obsidian system folders
        .filter(item => !item.name.startsWith('.') && item.name !== '_attachments')
        .map(item => {
            const isDir = item.isDirectory();
            const cleanName = item.name.replace('.md', '');

            let displayName = cleanName;

            if (isDir) {
                // 1. If it's a folder, use our JSON dictionary
                displayName = getFriendlyName(cleanName);
            } else if (item.name.endsWith('.md')) {
                // 2. If it's a file, peek inside its frontmatter for the real title!
                try {
                    const filePath = path.join(fullPath, item.name);
                    const fileContents = fs.readFileSync(filePath, 'utf8');
                    const { data } = matter(fileContents);
                    console.log(`Loaded frontmatter for ${item.name}:`, data);
                    
                    if (data.title) {
                        displayName = data.title;
                    }
                } catch (err) {
                    console.error(`Failed to read frontmatter for ${item.name}`, err);
                }
            }
            
            return {
                name: cleanName,
                displayName: displayName,
                isDirectory: isDir,
                // Build the URL path for the Next.js Link component
                href: `/${slug.join('/')}/${cleanName}`
            };
        })
        // Sort folders first, then files alphabetically
        .sort((a, b) => {
            // 1. Always keep folders at the top of the grid
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            
            // 2. Use "Natural Sorting" on the display name
            // 'numeric: true' forces JS to treat "11" as the number 11, not the string "1" + "1"
            return a.displayName.localeCompare(b.displayName, 'he', { numeric: true });
        });
}

function getAllFilesRecursively(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const absolutePath = path.join(dir, file);
        
        // Skip hidden folders like .obsidian or .git
        if (file.startsWith('.')) continue;

        if (fs.statSync(absolutePath).isDirectory()) {
            getAllFilesRecursively(absolutePath, fileList);
        } else if (absolutePath.endsWith('.md')) {
            fileList.push(absolutePath);
        }
    }
    return fileList;
}

export function getAllNoteSlugs() {
    // Ensure the directory exists before trying to read it
    if (!fs.existsSync(VAULT_DIRECTORY)) {
        return [];
    }

    const files = getAllFilesRecursively(VAULT_DIRECTORY);
    
    return files.map((file) => {
        // Remove the base vault path and the .md extension
        const relativePath = file.replace(VAULT_DIRECTORY, '').replace(/\.md$/, '');
        
        // Split by directory separator to create the slug array Next.js expects
        // Remove empty strings caused by leading slashes
        return relativePath.split(path.sep).filter(Boolean);
    });
}

export function getNoteContent(slugArray: string[]) {
    const filePath = path.join(VAULT_DIRECTORY, ...slugArray);
    
    // 1. Try reading the exact file first (e.g., "hw1.c" or "script.py")
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return fs.readFileSync(filePath, 'utf8');
    }

    // 2. If no exact match, try adding .md (for Obsidian links that drop the extension)
    const mdPath = `${filePath}.md`;
    if (fs.existsSync(mdPath)) {
        return fs.readFileSync(mdPath, 'utf8');
    }

    return null;
}

let dynamicFolderMap: Record<string, string> = {};

export function getVaultTree(dir = VAULT_DIRECTORY, currentPath = '/'): TreeItem[] {
    if (!fs.existsSync(dir)) return [];

    // --- NEW: Load the auto-generated folder map ---
    if (Object.keys(dynamicFolderMap).length === 0) {
        try {
            const mapPath = path.join(VAULT_DIRECTORY, 'folder-map.json');
            if (fs.existsSync(mapPath)) {
                dynamicFolderMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            } else {
                dynamicFolderMap = {};
            }
        } catch {
            dynamicFolderMap = {};
        }
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const tree: TreeItem[] = [];

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        // --- NEW: Hide the system mapping file from the TOC ---
        if (entry.name === 'folder-map.json') continue; 

        const fullPath = path.join(dir, entry.name);
        const slug = entry.name.replace(/\.md$/, '');
        const itemPath = `${currentPath}/${slug}`;

        if (entry.isDirectory()) {
            const children = getVaultTree(fullPath, itemPath);
            
            if (children.length > 0) {
                tree.push({
                    name: entry.name,
                    // --- NEW: Check the dynamic map before falling back to the raw name ---
                    title: FOLDER_DICTIONARY[entry.name] || dynamicFolderMap[entry.name] || entry.name.replace(/-/g, ' '),
                    path: itemPath,
                    isDirectory: true,
                    children: children
                });
            }
        } else if (entry.name.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const { data } = matter(content);
            
            tree.push({
                name: slug,
                title: data.title || slug,
                path: itemPath,
                isDirectory: false
            });
        }
    }

    // Sort the tree
    return tree.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        
        const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');
        
        if (numA !== numB) return numA - numB;
        return a.title.localeCompare(b.title, 'he');
    });
}

export function getSlugToPathMap(): Record<string, string> {
    const tree = getVaultTree();
    const map: Record<string, string> = {};

    function traverse(items: TreeItem[]) {
        for (const item of items) {
            if (item.isDirectory && item.children) {
                traverse(item.children);
            } else if (!item.isDirectory) {
                // PRIMARY: Map the full, unique Hebrew title
                map[item.title] = item.path;
                
                // FALLBACK: Also map the English slug just in case
                // We use an IF statement so we don't accidentally overwrite an earlier file
                if (!map[item.name]) {
                    map[item.name] = item.path;
                }
            }
        }
    }

    traverse(tree);
    return map;
}

export function getCourseContext(rawPath: string) {
    // 1. Decode the whole path first to handle Hebrew
    const decodedPath = decodeURIComponent(rawPath);
    const allTheParts = decodedPath.split('/').filter(Boolean);
    // cut the last item which is the file name, we only want the folders for context
    const parts = allTheParts.slice(0, -1);
    
    // 2. Define generic folders to skip
    const genericFolders = ['שיעורי בית', 'תרגול', 'notes', 'vault', 'tutorials'];

    // 3. Find the course folder (hunt from file upwards)
    const contextFolder = [...parts].reverse().find(p => {
        return !genericFolders.includes(p) && !p.endsWith('.md');
    });

    if (!contextFolder) return "";

    // 4. Translate and clean (Removes Technion code like 01040031)
    let name = getFriendlyName(contextFolder);
    return name.replace(/^\d{8}\s*-\s*/, '');
}