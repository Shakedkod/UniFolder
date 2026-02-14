import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm'; // Tables, strikethrough, etc.
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import rehypeSlug from 'rehype-slug'; // Add IDs to headings

// -----------------------------------------------------------------------------
// 1. The Privacy Filter
// -----------------------------------------------------------------------------
const rehypeRemovePrivate = () => {
    return (tree: any) => {
        visit(tree, 'element', (node, index, parent) => {
            if (node.properties && node.properties.className && node.properties.className.includes('private')) 
            {
                parent.children.splice(index, 1);
                return index;
            }
        });
    };
};

// -----------------------------------------------------------------------------
// 2. The Processor Logic
// -----------------------------------------------------------------------------
export async function processMarkdown(markdownContent: string) {
    const file = await unified()
        .use(remarkParse)
        .use(remarkGfm) // GitHub Flavored Markdown (essential for Obsidian parity)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRemovePrivate)
        .use(rehypeSlug)
        .process(markdownContent);
    return file.toString();
}