import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify'; // <-- Bring this back!
import { visit } from 'unist-util-visit';

// The TOC Extractor stays the same
const extractTOCPlugin = () => (tree: any, file: any) => {
    file.data.toc = [];
    let currentHeading: any = null; // Keeps track of the active section

    visit(tree, 'element', (node: any) => {
        // A. Detect Headings
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
            const id = node.properties?.id;
            let title = '';
            visit(node, 'text', (textNode: any) => { title += textNode.value; });

            if (id && title) {
                currentHeading = {
                    level: parseInt(node.tagName.charAt(1), 10),
                    id,
                    title: title.trim(),
                    callouts: [] // Array to hold theorems/definitions for this section
                };
                file.data.toc.push(currentHeading);
            }
        }
        // B. Detect Callouts (Safely checks the data-callout attribute)
        else if (node.tagName === 'details' && node.properties?.['data-callout']) {
            if (currentHeading) {
                const calloutType = node.properties['data-callout'];

                let title = '';
                const summary = node.children.find((c: any) => c.tagName === 'summary');
                if (summary) {
                    visit(summary, 'text', (textNode: any) => { title += textNode.value; });
                    const id = summary.properties?.id;

                    if (id && title) {
                        currentHeading.callouts.push({
                            id,
                            title: title.trim(),
                            type: calloutType
                        });
                    }
                }
            }
        }
    });
};

// 1. The Advanced Callout Transformer Plugin
const rehypeObsidianCallouts = () => {
    // The transformer function receives 'tree' (the AST) and 'file' (the current file state)
    return (tree: any, file: any) => {
        // We create the counters object INSIDE the transformer so it resets to 0 
        // every time a new page/note is rendered.
        const counters: Record<string, number> = {};

        visit(tree, 'element', (node: any) => {
            if (node.tagName === 'blockquote') {
                const firstChild = node.children.find((c: any) => c.tagName === 'p');
                if (!firstChild) return;

                const textNode = firstChild.children[0];
                if (textNode && textNode.type === 'text') {
                    // Regex to capture the type, the optional modifier (|num or |*), and the title
                    const match = textNode.value.match(/^\[!([^\]]+)\](.*)/);

                    if (match) {
                        const rawType = match[1];
                        const parts = rawType.split('|');
                        const calloutType = parts[0].toLowerCase();
                        const modifier = parts.length > 1 ? parts[1].trim() : null; // gets '*' or '3.1.2'

                        let userTitle = match[2].trim();

                        // Hebrew dictionary for standard Math Booster types
                        const defaults: Record<string, string> = {
                            theorem: 'משפט', axiom: 'אקסיומה', definition: 'הגדרה',
                            claim: 'טענה', lemma: 'למה', corollary: 'מסקנה',
                            example: 'דוגמה', exercise: 'תרגיל', hypothesis: 'השערה',
                            remark: 'הערה', hw: 'שיעורי בית'
                        };

                        // Define which types trigger auto-numbering
                        const mathTypes = [
                            'theorem', 'axiom', 'definition', 'claim', 'lemma',
                            'corollary', 'example', 'exercise', 'hypothesis'
                        ];

                        // 1. Logic for Numbering
                        let numberStr = "";
                        if (modifier === "*") {
                            numberStr = ""; // Hide number
                        } else if (modifier) {
                            numberStr = ` ${modifier}`; // Use explicit number (e.g. 3.1.2)
                        } else if (mathTypes.includes(calloutType)) {
                            // Auto-increment if empty and is a math type
                            counters[calloutType] = (counters[calloutType] || 0) + 1;
                            numberStr = ` ${counters[calloutType]}`;
                        }

                        // 2. Logic for the Display Title
                        const typeName = defaults[calloutType] || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);

                        // Replicate Math Booster formatting: "Type Number (Title)"
                        let displayTitle = `${typeName}${numberStr}`;
                        if (userTitle) {
                            displayTitle += ` (${userTitle})`;
                        }

                        // Remove the syntax line from the actual content
                        textNode.value = textNode.value.replace(/^\[!([^\]]+)\][^\n]*/, '').trimStart();

                        // 3. Transform the HTML structure
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
                                    children: [{ type: 'text', value: displayTitle }]
                                }
                            ]
                        };

                        const contentNode = {
                            type: 'element',
                            tagName: 'div',
                            properties: { className: ['callout-content'] },
                            children: [...node.children]
                        };

                        node.children = [titleNode, contentNode];
                    }
                }
            }
        });
    };
};

export async function renderMarkdownContent(markdownContent: string) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('No character metrics')) return;
        originalWarn(...args);
    };

    try {
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
                strict: "ignore",
                macros: {
                    "\\R": "\\htmlStyle{direction: rtl; unicode-bidi: isolate; display: inline-block;}{\\text{#1}}",
                    "\\underbracket": "\\mathop{\\htmlClass{sq-bracket}{#1\\rule[-0.4em]{0pt}{0pt}}}\\limits",
                    "\\overbracket": "\\mathop{\\htmlClass{sq-overbracket}{\\rule{0pt}{1.3em}#1}}\\limits",
                    "\\cancel": "{\\color{red}{#1}}"
                }
            })
            .use(rehypeSlug)
            .use(extractTOCPlugin)
            .use(rehypeStringify); // <-- Output to String, NOT React

        const file = await processor.process(markdownContent);

        return {
            contentHtml: file.toString(), // Passes a single string
            toc: file.data.toc || []
        };
    } finally {
        console.warn = originalWarn;
    }
}