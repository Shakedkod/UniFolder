import path from 'path';
import fs from 'fs';

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