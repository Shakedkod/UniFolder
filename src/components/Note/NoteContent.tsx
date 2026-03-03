import { renderMarkdownContent } from "@/lib/processor";
import { extractTOC } from "@/lib/toc";
import { getNoteContent } from "@/lib/vault";
import matter from "gray-matter";
import { notFound } from "next/navigation";
import Sidebar from "../Sidebar";
import Loading from "@/components/Note/loading";
import { Suspense } from "react";
import DesmosInitializer from "../DesmosInitializer";
import InteractiveArticle from "./InteractiveArticle";

export default async function NoteContent({ currentSlug, parentUrl, parentName }: { currentSlug: string[]; parentUrl: string; parentName: string }) {
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
        markdownContent = `> [!remark|*] קובץ קוד\n> קובץ זה הוא קובץ קוד מסוג **${lang.toUpperCase()}**.\n\n\`\`\`${lang}\n${rawContent}\n\`\`\``;
    } else {
        // If it's standard Markdown, parse the frontmatter for a custom title
        const { data: frontmatter } = matter(rawContent);
        if (frontmatter.title) title = frontmatter.title;
    }

    // Process the content (either the original MD or our synthetic code MD)
    const { contentHtml } = await renderMarkdownContent(markdownContent);
    const toc = extractTOC(markdownContent);

    return (
        <main className={`flex flex-col xl:flex-row w-full h-full xl:grid xl:grid-cols-[auto_1fr] no-scrollbar`}>
            <div className="sticky top-0 z-50 w-full xl:w-auto">
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

                    <InteractiveArticle html={contentHtml} isCodeFile={!!isCodeFile} />
                </div>
            </Suspense>

            <DesmosInitializer />
        </main>
    );
}