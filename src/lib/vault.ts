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

const VAULT_DIRECTORY = path.join(process.cwd(), 'vault');

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
    // Reconstruct the file path
    const relativePath = `${slugArray.join('/')}.md`;
    const fullPath = path.join(VAULT_DIRECTORY, relativePath);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    return fs.readFileSync(fullPath, 'utf8');
}

let dynamicFolderMap: Record<string, string> = {};

export function getVaultTree(dir = VAULT_DIRECTORY, currentPath = '/notes'): TreeItem[] {
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