import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm'; // Tables, strikethrough, etc.
import remarkRehype from 'remark-rehype';
import { visit } from 'unist-util-visit';
import rehypeSlug from 'rehype-slug'; // Add IDs to headings
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';

const rehypeRemovePrivate = () => {
    return (tree: any) => {
        visit(tree, 'element', (node, index, parent) => {
            if (node.properties && node.properties.className && node.properties.className.includes('private')) {
                parent.children.splice(index, 1);
                return index;
            }
        });
    };
};

const rehypeObsidianCallouts = () => {
    return (tree: any) => {
        visit(tree, 'element', (node: any, index, parent: any) => {
            if (node.tagName === 'blockquote') {
                const firstChild = node.children[0];
                // Check if the first child is a paragraph with text
                if (firstChild && firstChild.tagName === 'p' && firstChild.children.length > 0) {
                    const textNode = firstChild.children[0];

                    if (textNode.type === 'text') {
                        const match = textNode.value.match(/^\[!(\w+)(?:\|(.*))?\]/);

                        if (match) {
                            const calloutType = match[1].toLowerCase();
                            const calloutTitle = match[2] || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
                            textNode.value = textNode.value.replace(/^\[!(\w+)(?:\|(.*))?\]\s*/, '');

                            node.tagName = 'div';
                            node.properties = {
                                className: ['callout'],
                                'data-callout': calloutType
                            };

                            const titleNode = {
                                type: 'element',
                                tagName: 'div',
                                properties: { className: ['callout-title'] },
                                children: [
                                    {
                                        type: 'element',
                                        tagName: 'div',
                                        properties: { className: ['callout-title-inner'] },
                                        children: [{ type: 'text', value: calloutTitle }]
                                    }
                                ]
                            };

                            const contentNode = {
                                type: 'element',
                                tagName: 'div',
                                properties: { className: ['callout-content'] },
                                children: node.children
                            };

                            node.children = [titleNode, contentNode];
                        }
                    }
                }
            }
        });
    };
};

// -----------------------------------------------------------------------------
// The Processor Logic
// -----------------------------------------------------------------------------
export async function getMarkdownAST(markdownContent: string) {
    const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkMath)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeObsidianCallouts)
        .use(rehypeKatex, {
            trust: true,
            strict: false,
            macros: {
                "\\R": "\\htmlStyle{direction: rtl; unicode-bidi: isolate; display: inline-block;}{\\text{#1}}",
                "\\underbracket": "\\underbrace{#1}",
                "\\overbracket": "\\overbrace{#1}",
                "\\cancel": "\\htmlStyle{text-decoration: line-through; text-decoration-color: red;}{#1}",
            }
        })
        .use(rehypeRemovePrivate)
        .use(rehypeSlug);

    const mdast = processor.parse(markdownContent);
    const hast = await processor.run(mdast);
    return structuredClone(hast);
}