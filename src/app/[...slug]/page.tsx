import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getNoteContent, isVaultDirectory, getFolderContents, getFriendlyName } from '@/lib/vault';
import { renderMarkdownContent } from '@/lib/processor';
import matter from 'gray-matter';
import Sidebar from '@/components/Sidebar';
import DesmosInitializer from '@/components/DesmosInitializer';
import { extractTOC } from '@/lib/toc';
import { Folder, FileText, ArrowRight } from 'lucide-react'; // <-- Imported ArrowRight
import Loading from './loading';
import { Suspense } from 'react';
import BackButton from '@/components/NoteComponents/BackButton';
import ItemLink from '@/components/NoteComponents/ItemLink';

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
        ? getFriendlyName(decodeURIComponent(parentSlug[parentSlug.length - 1]))
        : 'תיקייה ראשית';

    // ==========================================
    // 1. THE FOLDER INTERCEPTOR
    // ==========================================
    if (isVaultDirectory(currentSlug)) {
        const items = getFolderContents(currentSlug);

        const rawFolderName = decodeURIComponent(currentSlug[currentSlug.length - 1]);
        const folderName = getFriendlyName(rawFolderName);

        // --- NEW: Group the items into 4 buckets ---
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(item => !item.isDirectory);

        // 1. Define the Regex patterns
        // Matches any common homework keyword
        const hwRegex = /(גליון|גיליון|וובוורק|שיעורי\s*בית|מטלה|hw|homework)/i;
        // Matches if the string starts with a number
        const numberedRegex = /^\d+/;

        // 2. Filter out the files into the 4 buckets
        const homeworkFiles = files.filter(item => hwRegex.test(item.displayName));
        const remainingFiles = files.filter(item => !hwRegex.test(item.displayName));
        const numberedFiles = remainingFiles.filter(item => numberedRegex.test(item.displayName));
        const unnumberedFiles = remainingFiles.filter(item => !numberedRegex.test(item.displayName));

        // Helper function so we don't repeat the grid code 3 times
        const renderGrid = (gridItems: typeof items) => (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {gridItems.map((item) => (
                    <ItemLink key={item.name} name={item.displayName} url={`/${[...currentSlug, item.name].map(encodeURIComponent).join('/')}`} isFolder={item.isDirectory} />
                ))}
            </div>
        );

        return (
            <main className="max-w-5xl mx-auto p-8" dir="rtl">
                {/* Back Button */}
                <BackButton url={parentUrl} name={parentName} bg="light" />

                {/* Main Header */}
                <h1 className="text-4xl font-bold mb-10 text-foreground-title flex items-center gap-3">
                    <Folder size={36} />
                    {folderName}
                </h1>

                {/* --- Render the Sections Dynamically --- */}
                {folders.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">תיקיות</h2>
                        {renderGrid(folders)}
                    </section>
                )}

                {numberedFiles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">רצף לימוד</h2>
                        {renderGrid(numberedFiles)}
                    </section>
                )}

                {homeworkFiles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">שיעורי בית ומטלות</h2>
                        {renderGrid(homeworkFiles)}
                    </section>
                )}

                {unnumberedFiles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">חומרים נוספים</h2>
                        {renderGrid(unnumberedFiles)}
                    </section>
                )}
            </main>
        );
    }

    // ==========================================
    // 2. THE STANDARD NOTE/CODE RENDERER
    // ==========================================
    
    // Get the exact filename from the URL slug
    const rawFilename = decodeURIComponent(currentSlug[currentSlug.length - 1]);
    
    // Extract the extension (e.g., 'c', 'py', 'java', 'md')
    const fileExtension = rawFilename.includes('.') ? rawFilename.split('.').pop()?.toLowerCase() : 'md';

    // Dictionary matching file extensions to Markdown language tags
    const codeExtensions: Record<string, string> = {
        'c': 'c',
        'h': 'c',
        'cpp': 'cpp',
        'hpp': 'cpp',
        'java': 'java',
        'py': 'python',
        'js': 'javascript',
        'ts': 'typescript',
        'sh': 'bash',
        'sql': 'sql',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml'
    };

    const isCodeFile = fileExtension && codeExtensions[fileExtension];

    // Fetch the raw text content of the file from your vault
    const rawContent = getNoteContent(currentSlug);

    if (!rawContent) {
        notFound();
    }

    let markdownContent = rawContent;
    let title = rawFilename;

    // If it's a code file, wrap the raw text in a markdown code block!
    if (isCodeFile) {
        const lang = codeExtensions[fileExtension];
        markdownContent = `> [!remark|*] קובץ קוד מקור\n> קובץ זה הוא קובץ קוד מסוג **${lang.toUpperCase()}**.\n\n\`\`\`${lang}\n${rawContent}\n\`\`\``;
    } else {
        // If it's standard Markdown, parse the frontmatter for a custom title
        const { data: frontmatter } = matter(rawContent);
        if (frontmatter.title) title = frontmatter.title;
    }

    // Process the content (either the original MD or our synthetic code MD)
    const { contentHtml } = await renderMarkdownContent(markdownContent);
    const toc = extractTOC(markdownContent);

    return (
        <main className={`flex flex-row w-full h-full lg:grid lg:grid-cols-[auto_1fr] no-scrollbar`}>
            <div className="lg:sticky">
                <Sidebar content={{ title, toc, parent: { url: parentUrl, name: parentName } }} />
            </div>

            <Suspense fallback={<Loading />}>
                <div className="flex flex-col w-full px-8 py-6" dir="rtl">
                    {/* Add the filename as a header for code files */}
                    {isCodeFile && (
                        <h1 className="text-3xl font-bold mb-6 text-foreground text-left" dir="ltr">
                            {rawFilename}
                        </h1>
                    )}
                    
                    <article
                        className="academic-preview w-full no-scrollbar"
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                </div>
            </Suspense>

            <DesmosInitializer />
        </main>
    );

}