import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkBreaks from 'remark-breaks';
import { visit } from 'unist-util-visit';
import { instance } from '@viz-js/viz';
import { getSlugToPathMap } from './vault';

// The TOC Extractor
const extractTOCPlugin = () => (tree: any, file: any) => {
    file.data.toc = [];
    let currentHeading: any = null;

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

const remarkGraphviz = () => async (tree: any) => {
    const nodes: any[] = [];

    visit(tree, 'code', (node: any) => {
        if (node.lang === 'dot' || node.lang === 'graphviz') {
            nodes.push(node);
        }
    });

    if (nodes.length === 0) return;
    const viz = await instance();

    for (const node of nodes) {
        try {
            const svg = viz.renderString(node.value, { format: "svg" });

            node.type = 'html';
            node.value = `<div class="graphviz-container">${svg}</div>`;

        } catch (error: any) {
            console.error('Graphviz rendering error:', error.message);
            node.type = 'html';
            node.value = `<div style="color: #ef4444; border: 1px solid #ef4444; padding: 1rem; border-radius: 0.5rem; text-align: left;" dir="ltr">
                <strong>Graphviz Error:</strong><br/>${error.message}
            </div>`;
        }
    }
};

// The Advanced Callout Transformer Plugin
const rehypeObsidianCallouts = () => {
    return (tree: any, file: any) => {
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

const remarkDesmos = () => (tree: any) => {
    visit(tree, 'code', (node: any) => {
        if (node.lang === 'desmos-graph') {
            const parts = node.value.split('---');
            let configStr = '';
            let eqStr = '';

            if (parts.length >= 2) {
                configStr = parts[0].trim();
                eqStr = parts[1].trim();
            } else {
                eqStr = parts[0].trim();
            }

            // Default to 400x400 if width/height aren't specified
            let width = 400;
            let height = 400;
            const widthMatch = configStr.match(/width=(\d+)/);
            if (widthMatch) width = parseInt(widthMatch[1]);
            const heightMatch = configStr.match(/height=(\d+)/);
            if (heightMatch) height = parseInt(heightMatch[1]);

            // Safely encode the math so we can pass it to the client side
            const safeEq = encodeURIComponent(eqStr);
            const safeConfig = encodeURIComponent(configStr);

            // Inject a hidden placeholder div that the client script will find
            node.type = 'html';
            node.value = `<div class="desmos-placeholder" data-width="${width}" data-height="${height}" data-equations="${safeEq}" data-config="${safeConfig}" style="width: 100%; max-width: ${width}px; height: ${height}px; margin: 2.5rem auto; border-radius: 8px; overflow: hidden; border: 1px solid #4b5563;"></div>`;
        }
    });
};

export async function renderMarkdownContent(markdownContent: string) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('No character metrics')) return;
        originalWarn(...args);
    };

    var chapterPrefix = "";
    const titleMatch = markdownContent.match(/^title:\s*"(\d+)[^"]*"/m);
    if (titleMatch) {
        chapterPrefix = parseInt(titleMatch[1], 10) + '.';
    }

    const slugMap = getSlugToPathMap();
    const linkMap = new Map<string, string>();
    let linkCounter = 0;

    const titleMap = new Map<string, string>();
    let titleCounter = 0;

    var processedContent = markdownContent
        .replace(/\$\$(.+?)\$\$/g, (match, equation) => `\n$$\n${equation.trim()}\n$$\n`)
        .replace(/\\begin\{align\}([\s\S]*?)\\end\{align\}/g, '\\begin{align*}$1\\end{align*}')
        .replace(/(^|\n)(?![ \t]*>)([^\n]+)\r?\n([ \t]*>)/g, '$1$2\n\n$3')
        .replace(/^[ \t]+(>)/gm, '$1')
        .replace(/^>(\[!.*?\])/gm, '> $1')
        .replace(/^(>+)[ \t]+\$\$/gm, (match, arrows) => `${arrows} $$`) // Snaps over-indented $$ inside blockquotes back to the safe margin
        .replace(/^[ \t]+\$\$/gm, '$$') // Snaps over-indented $$ in regular lists back to the safe margin
        .replace(/(?:\n|\s)\^([a-zA-Z0-9]{5,})(?=\s|$)/g, '\n<a id="$1" class="obsidian-block-anchor"></a>\n')
        .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, filename, meta) => {
            let cleanFilename = filename.trim();
            
            // Route Excalidraw files to their auto-exported SVGs
            if (cleanFilename.endsWith('.excalidraw')) {
                cleanFilename += '.svg'; 
            }
    
            // Parse Obsidian's size metadata (e.g., "|400")
            let widthAttr = '';
            if (meta) {
                const widthMatch = meta.match(/^(\d+)/); 
                if (widthMatch) {
                    widthAttr = ` width="${widthMatch[1]}"`;
                }
            }
            
            const safeUrl = `/vault-images/${encodeURIComponent(cleanFilename)}`;
            
            // THE FIX: We added &#8203; (a Zero-Width Space) at the very beginning!
            // This stops Next.js from mistaking the line for a raw HTML block,
            // preventing it from swallowing the math equations on the lines below it.
            return `&#8203;<img src="${safeUrl}"${widthAttr} class="obsidian-image" alt="${cleanFilename}" loading="lazy" />`;
        })
        .replace(/(?<!\!)\[\[(.*?)\]\]/g, (match, linkContent) => {
            // 1. Extract the title and target
            const parts = linkContent.split('|');
            let target = parts[0];
            const title = parts[1] || target.split(/[/\\]/).pop();

            // 2. Separate the file name from the #hash
            let baseFile = target;
            let hash = '';
            const hashIndex = target.indexOf('#');
            if (hashIndex !== -1) {
                baseFile = target.substring(0, hashIndex);
                hash = target.substring(hashIndex).replace('#^', '#');
            }

            baseFile = baseFile.split(/[/\\]/).pop() || '';

            // 3. Build the HTML link
            const fullPath = (!baseFile) ? '' : (slugMap[baseFile] || `/notes/${baseFile}`);
            const linkHtml = `<a href="${fullPath}${hash}">${title}</a>`;

            // 4. Save to memory and return the alphanumeric placeholder
            const placeholder = `OBSIDIANLINK${linkCounter++}X`;
            linkMap.set(placeholder, linkHtml);

            return placeholder;
        })
        .replace(/`?\\end\{proof\}`?/g, '<span class="halmos">∎</span>');

    try {
        const processor = unified()
            .use(remarkParse)
            .use(remarkBreaks)
            .use(remarkGraphviz)
            .use(remarkDesmos)
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
                    "\\overunderset": "\\overset{#1}{\\underset{#2}{#3}}",
                    "\\cancel": "\\htmlClass{math-cancel}{#1}",
                    "\\bcancel": "\\htmlClass{math-bcancel}{#1}",
                    "\\xcancel": "\\htmlClass{math-xcancel}{#1}",
                    "\\cases": "\\begin{cases} #1 \\end{cases}"
                }
            })
            .use(rehypeSlug)
            .use(extractTOCPlugin)
            .use(rehypeStringify, { allowDangerousHtml: true });

        const file = await processor.process(processedContent);
        let contentHtml = file.toString();

        for (const [placeholder, html] of linkMap.entries()) {
            contentHtml = contentHtml.split(placeholder).join(html);
        }

        for (const [placeholder, realTitle] of titleMap.entries()) {
            // This regex brillianty hunts down our placeholder AND whatever annoying 
            // default text (like "הגדרה 1 ()") Next.js tried to wrap around it inside the HTML tag!
            // Example: >הגדרה 1 (CALLOUTTITLE0X)< becomes >הגדרה 10.1 (העתקה ליניארית)<
            const regex = new RegExp(`>[^<]*?${placeholder}[^<]*?<`, 'g');
            contentHtml = contentHtml.replace(regex, `>${realTitle}<`);
        }

        return {
            contentHtml: contentHtml,
            toc: file.data.toc || []
        };
    } finally {
        console.warn = originalWarn;
    }
}