import { notFound } from 'next/navigation';
import { getAllNoteSlugs, getNoteContent } from '@/lib/vault'; // Adjust path if not using @
import { renderMarkdownContent } from '@/lib/processor';
import matter from 'gray-matter';
import Sidebar from '@/components/Sidebar';

export async function generateStaticParams() {
    const slugs = getAllNoteSlugs();

    return slugs.map((slug) => ({
        slug: slug,
    }));
}

export default async function NotePage({ params }: { params: { slug: string[] } }) {
    const resolvedParams = await params;
    const markdownContent = getNoteContent(resolvedParams.slug);

    if (!markdownContent) {
        notFound();
    }

    const { contentHtml, toc } = await renderMarkdownContent(markdownContent);
    const { data: frontmatter, content: pureMarkdown } = matter(markdownContent);
    const title = frontmatter.title || decodeURIComponent(resolvedParams.slug[resolvedParams.slug.length - 1]);

    return (
        <main className={`flex flex-row w-full h-full lg:grid lg:grid-cols-[auto_1fr]`}>
            <div className="lg:sticky">
                <Sidebar content={{ title, toc }} />
            </div>
            <article
                className="academic-preview"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
        </main>
    );
}