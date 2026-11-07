import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import { isVaultDirectory, getFolderTitle, VAULT_DIRECTORY } from '@/lib/vault';
import FolderPage from '@/components/Note/FolderPage';
import NoteContent from '@/components/Note/NoteContent';

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> | { slug: string[] } }): Promise<Metadata> {
    const resolvedParams = await params;
    const currentSlug = resolvedParams.slug;
    const rawFilename = decodeURIComponent(currentSlug[currentSlug.length - 1]);
    const connectedCourseName = currentSlug.length > 2
        ? getFolderTitle(decodeURIComponent(currentSlug[2])).replace(/^\d+\s*-\s*/, '').trim()
        : undefined;

    // 1. Directory / Folder metadata
    if (isVaultDirectory(currentSlug)) {
        const folderTitle = getFolderTitle(rawFilename);
        const title = connectedCourseName ? `${folderTitle} — ${connectedCourseName}` : folderTitle;
        const description = `רשימת סיכומים, חומרי לימוד ותרגולים בתיקיית ${folderTitle}${connectedCourseName ? ` בקורס ${connectedCourseName}` : ''} לתואר במדעי המחשב בטכניון.`;
        return {
            title,
            description,
            openGraph: {
                title,
                description,
                type: "website",
                url: `/${currentSlug.map(encodeURIComponent).join('/')}`,
                images: [
                    {
                        url: "/og-image.png",
                        width: 1200,
                        height: 630,
                        alt: title,
                    }
                ],
            },
            twitter: {
                card: "summary_large_image",
                title,
                description,
                images: ["/og-image.png"],
            },
        };
    }

    // 2. Note metadata
    const jsonFilename = rawFilename + ".json";
    const filePath = path.join(VAULT_DIRECTORY, ...currentSlug.slice(0, -1), jsonFilename);

    let noteTitle = rawFilename;
    let description = `סיכום בנושא ${rawFilename}${connectedCourseName ? ` מתוך קורס ${connectedCourseName}` : ''} לתואר ראשון במדעי המחשב בטכניון.`;

    try {
        if (fs.existsSync(filePath)) {
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContents);
            if (data.title) {
                noteTitle = data.title;
            }
            if (data.type === 'code') {
                description = `קובץ קוד ${rawFilename}${connectedCourseName ? ` בקורס ${connectedCourseName}` : ''} לתואר במדעי המחשב בטכניון.`;
            } else if (data.type === 'pdf') {
                description = `קובץ סיכום PDF בנושא ${noteTitle}${connectedCourseName ? ` מתוך קורס ${connectedCourseName}` : ''} לתואר במדעי המחשב בטכניון.`;
            } else {
                description = `סיכום בנושא ${noteTitle}${connectedCourseName ? ` מתוך קורס ${connectedCourseName}` : ''} לתואר ראשון במדעי המחשב בטכניון. כולל נוסחאות, דוגמאות והסברים.`;
            }
        }
    } catch {}

    const fullTitle = connectedCourseName ? `${noteTitle} — ${connectedCourseName}` : noteTitle;

    return {
        title: fullTitle,
        description,
        openGraph: {
            title: fullTitle,
            description,
            type: "article",
            url: `/${currentSlug.map(encodeURIComponent).join('/')}`,
            images: [
                {
                    url: "/og-image.png",
                    width: 1200,
                    height: 630,
                    alt: fullTitle,
                }
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description,
            images: ["/og-image.png"],
        },
    };
}

export default async function NotePage({ params }: { params: { slug: string[] } }) {
    const resolvedParams = await params;
    const currentSlug = resolvedParams.slug;

    // ==========================================
    // SHARED LOGIC: Calculate Parent Directory
    // ==========================================
    // Remove the last item from the array to get the parent path
    const parentSlug = currentSlug.slice(0, -1);

    // If parentSlug is empty, it means we are at the root, so go to '/' instead of an empty path
    // Otherwise, join the remaining parts with a slash
    const parentUrl = parentSlug.length > 0 ? `/${parentSlug.join('/')}` : '/';

    // Get the name of the parent folder to display in the button (fallback to 'ראשי' / Main)
    const parentName = parentSlug.length > 0
        ? getFolderTitle(decodeURIComponent(parentSlug[parentSlug.length - 1]))
        : 'תיקייה ראשית';
    
    const connectedCourseName = currentSlug.length > 2 ? getFolderTitle(decodeURIComponent(currentSlug[2])).replace(/^\d+\s*-\s*/, '').trim() : undefined;

    // ==========================================
    // 1. THE FOLDER INTERCEPTOR
    // ==========================================
    if (isVaultDirectory(currentSlug)) {
        return <FolderPage currentSlug={currentSlug} parentUrl={parentUrl} parentName={parentName} />;
    }

    // ==========================================
    // 2. THE STANDARD NOTE/CODE RENDERER
    // ==========================================
    return <NoteContent currentSlug={currentSlug} parentUrl={parentUrl} parentName={parentName} courseName={connectedCourseName} />;
}