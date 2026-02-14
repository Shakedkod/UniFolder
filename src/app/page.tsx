import { getMarkdownAST } from '../lib/processor';
import path from "path";
import { promises as fs } from "fs";
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default async function Home() {
    const filePath = path.join(process.cwd(), 'public', 'test.md');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const ast = await getMarkdownAST(fileContent);

    return (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <h1 className="text-2xl font-bold mb-4">Markdown Test Renderer</h1>

            <div className="markdown-preview-view" dir="rtl" suppressHydrationWarning>
                <MarkdownRenderer ast={ast} />
            </div>
        </main>
    );
}
