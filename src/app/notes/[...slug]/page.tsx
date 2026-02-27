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

export default async function NotePage({ params }: { params: { slug: string[] } }) {
    const resolvedParams = await params;
    const currentSlug = resolvedParams.slug;

    // ==========================================
    // SHARED LOGIC: Calculate Parent Directory
    // ==========================================
    // Remove the last item from the array to get the parent path
    const parentSlug = currentSlug.slice(0, -1);

    // If parentSlug is empty, it means we are at the root, so go to '/notes'
    // Otherwise, join the remaining parts with a slash
    const parentUrl = parentSlug.length > 0 ? `/notes/${parentSlug.join('/')}` : '/';

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
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 p-4 rounded-xl border border-gray-800 bg-[#171717] hover:border-orange-500 hover:bg-white/5 transition-all group"
                    >
                        {item.isDirectory ? (
                            <Folder className="text-blue-400 shrink-0 group-hover:text-blue-300" size={24} />
                        ) : (
                            <FileText className="text-gray-400 shrink-0 group-hover:text-orange-400" size={24} />
                        )}
                        <span className="font-medium text-gray-200 truncate">
                            {item.displayName}
                        </span>
                    </Link>
                ))}
            </div>
        );

        return (
            <main className="max-w-5xl mx-auto p-8" dir="rtl">
                {/* Back Button */}
                <Link
                    href={parentUrl}
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-400 mb-6 transition-colors text-sm font-medium"
                >
                    <ArrowRight size={16} />
                    <span>חזור ל-{parentName}</span>
                </Link>

                {/* Main Header */}
                <h1 className="text-4xl font-bold mb-10 text-orange-400 flex items-center gap-3">
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
                        <h2 className="text-lg font-semibold text-cyan-500 mb-4 border-b border-gray-800 pb-2">שיעורי בית ומטלות</h2>
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
    // 2. THE STANDARD NOTE RENDERER
    // ==========================================
    const markdownContent = getNoteContent(currentSlug);

    if (!markdownContent) {
        notFound();
    }

    const { contentHtml } = await renderMarkdownContent(markdownContent);
    const { data: frontmatter } = matter(markdownContent);
    const title = frontmatter.title || decodeURIComponent(currentSlug[currentSlug.length - 1]);
    const toc = extractTOC(markdownContent);

    return (
        <main className={`flex flex-row w-full h-full lg:grid lg:grid-cols-[auto_1fr]`}>
            <div className="lg:sticky">
                <Sidebar content={{ title, toc }} />
            </div>

            <Suspense fallback={<Loading />}>
                <div className="flex flex-col w-full px-8 py-6" dir="rtl">
                    {/* BACK BUTTON FOR FILES */}
                    <div className="mb-6 border-b border-gray-800 pb-4">
                        <Link
                            href={parentUrl}
                            className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors text-sm font-medium"
                        >
                            <ArrowRight size={16} />
                            <span>חזור לתיקייה: {parentName}</span>
                        </Link>
                    </div>

                    <article
                        className="academic-preview w-full"
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                </div>
            </Suspense>

            <DesmosInitializer />
        </main>
    );
}