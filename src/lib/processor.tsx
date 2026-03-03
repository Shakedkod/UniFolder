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
import rehypeHighlight from 'rehype-highlight';
import { getSlugToPathMap } from './vault';

// Move your IconMap here!
const IconMap: Record<string, string> = {
    'LiHeart': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'
};

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

const parseMathInTitle = (title: string) => {
    // This regex finds $math$ and wraps it in a span that KaTeX will definitely see
    return title.replace(/\$(.*?)\$/g, (_, math) => {
        return `<span class="inline-math">$${math}$</span>`;
    });
};

// The Advanced Callout Transformer Plugin
const rehypeObsidianCallouts = () => {
    return (tree: any, file: any) => {
        const counters: Record<string, number> = {};

        visit(tree, 'element', (node: any) => {
            if (node.tagName === 'blockquote') {
                const firstChild = node.children.find((c: any) => c.tagName === 'p');
                if (!firstChild) return;

                const firstTextNode = firstChild.children[0];
                if (firstTextNode && firstTextNode.type === 'text') {
                    const match = firstTextNode.value.match(/^\[!([^\]]+)\](.*)/);

                    if (match) {
                        const rawType = match[1];
                        const parts = rawType.split('|');
                        const calloutType = parts[0].toLowerCase();
                        const modifier = parts.length > 1 ? parts[1].trim() : null;

                        // (Keep your defaults, mathTypes, and numberStr logic here...)
                        const defaults: Record<string, string> = {
                            theorem: 'משפט', axiom: 'אקסיומה', definition: 'הגדרה',
                            claim: 'טענה', lemma: 'למה', corollary: 'מסקנה',
                            example: 'דוגמה', exercise: 'תרגיל', hypothesis: 'השערה',
                            remark: 'הערה', hw: 'שיעורי בית'
                        };
                        const mathTypes = ['theorem', 'axiom', 'definition', 'claim', 'lemma', 'corollary', 'example', 'exercise', 'hypothesis'];

                        let numberStr = "";
                        if (modifier === "*") numberStr = ""; 
                        else if (modifier) numberStr = ` ${modifier}`; 
                        else if (mathTypes.includes(calloutType)) {
                            counters[calloutType] = (counters[calloutType] || 0) + 1;
                            numberStr = ` ${counters[calloutType]}`;
                        }

                        // --- THE NEW FIX: Extracting Math Nodes into the Title ---
                        let titleNodes: any[] = [];

                        // 1. Remove the [!theorem] part from the first text node
                        firstTextNode.value = match[2].trimStart();

                        // 2. Loop through the paragraph's children until we hit a newline
                        let splitIndex = -1;
                        for (let i = 0; i < firstChild.children.length; i++) {
                            const child = firstChild.children[i];

                            if (child.type === 'text' && child.value.includes('\n')) {
                                const textParts = child.value.split('\n');
                                if (textParts[0]) {
                                    titleNodes.push({ type: 'text', value: textParts[0] });
                                }
                                // Keep the rest of the text for the body
                                child.value = textParts.slice(1).join('\n').trimStart();
                                splitIndex = i;
                                break;
                            } else if (child.tagName === 'br') {
                                splitIndex = i;
                                break;
                            } else {
                                titleNodes.push(child);
                            }
                        }

                        // 3. Remove the extracted title nodes from the body paragraph
                        if (splitIndex !== -1) {
                            if (firstChild.children[splitIndex].tagName === 'br') {
                                firstChild.children.splice(0, splitIndex + 1);
                            } else {
                                firstChild.children.splice(0, splitIndex);
                            }
                        } else {
                            firstChild.children = []; // Entire paragraph was the title
                        }

                        // Clean up leading empty text node in body if any
                        if (firstChild.children.length > 0 && firstChild.children[0].type === 'text' && !firstChild.children[0].value.trim()) {
                                firstChild.children.shift();
                        }

                        // 4. Build the Display Title Array
                        const typeName = defaults[calloutType] || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
                        let displayTitlePrefix = `${typeName}${numberStr}`;

                        let titleInnerChildren: any[] = [{ type: 'text', value: displayTitlePrefix }];

                        // Check if there's an actual user title
                        const hasUserTitle = titleNodes.length > 0 && !(titleNodes.length === 1 && titleNodes[0].type === 'text' && !titleNodes[0].value.trim());

                        if (hasUserTitle) {
                            titleInnerChildren.push({ type: 'text', value: ' (' });
                            titleInnerChildren.push(...titleNodes); // Inject the math nodes!
                            titleInnerChildren.push({ type: 'text', value: ')' });
                        }

                        // 5. Transform the HTML structure
                        node.tagName = 'div';
                        node.properties = { className: ['callout'], 'data-callout': calloutType };

                        const titleNode = {
                            type: 'element',
                            tagName: 'div',
                            properties: { className: ['callout-title'] },
                            children: [
                                {
                                    type: 'element',
                                    tagName: 'div',
                                    properties: { className: ['callout-title-inner'] },
                                    children: titleInnerChildren // Pass the structured nodes directly
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

    var processedContent = markdownContent
        .replace(/\u00a0/g, ' ')
        .replace(/^\|[ \t]*:?-+:?[ \t]*(?=\|)/gm, (match) => match.replace(/[ \t]/g, ''))
        .replace(/^([ \t]*(?:>[ \t]*)*)\$\$(.+?)\$\$[ \t]*$/gm, (match, prefix, equation) => `${prefix}$$\n${prefix}${equation.trim()}\n${prefix}$$`)
        .replace(/\\begin\{align\}([\s\S]*?)\\end\{align\}/g, '\\begin{align*}$1\\end{align*}')
        .replace(/(^|\n)(?![ \t]*>)([^\n]+)\r?\n([ \t]*>)/g, '$1$2\n\n$3')
        .replace(/^[ \t]+(>)/gm, '$1')
        .replace(/^>(\[!.*?\])/gm, '> $1')
        .replace(/^(>+)[ \t]+\$\$/gm, (match, arrows) => `${arrows} $$`) // Snaps over-indented $$ inside blockquotes back to the safe margin
        .replace(/^[ \t]+\$\$/gm, '$$') // Snaps over-indented $$ in regular lists back to the safe margin
        .replace(/(?:\n|\s)\^([a-zA-Z0-9]{5,})(?=\s|$)/g, '\n<a id="$1" class="obsidian-block-anchor"></a>\n')
        .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, filename, meta) => {
            let cleanFilename = filename.trim();
            if (cleanFilename.endsWith('.excalidraw')) cleanFilename += '.svg';

            let styles = "";
            let widthAttr = "";
            let heightAttr = "";

            if (meta) {
                // 1. Check for width x height (e.g., 400x200)
                const dimMatch = meta.match(/^(\d+)x(\d+)/);
                if (dimMatch) {
                    widthAttr = ` width="${dimMatch[1]}"`;
                    heightAttr = ` height="${dimMatch[2]}"`;
                    styles = `style="width: ${dimMatch[1]}px; height: ${dimMatch[2]}px; object-fit: contain;"`;
                } else {
                    // 2. Check for width only (e.g., 400)
                    const widthMatch = meta.match(/^(\d+)/);
                    if (widthMatch) {
                        widthAttr = ` width="${widthMatch[1]}"`;
                        styles = `style="width: ${widthMatch[1]}px; height: auto;"`;
                    }
                }
            }
            else
            {
                widthAttr = ` width="400"`;
                styles = 'style="width: 400px; height: auto;"';
            }

            const safeUrl = `/vault-images/${encodeURIComponent(cleanFilename)}`;

            // Using dangerouslySetInnerHTML requires standard img tags for string injection
            return `&#8203;<img src="${safeUrl}"${widthAttr}${heightAttr} ${styles} class="obsidian-image" alt="${cleanFilename}" loading="lazy" />`;
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
            const fullPath = (!baseFile) ? '' : (slugMap[baseFile] || `/${baseFile}`);
            const linkHtml = `<a href="${fullPath}${hash}">${title}</a>`;

            // 4. Save to memory and return the alphanumeric placeholder
            const placeholder = `OBSIDIANLINK${linkCounter++}X`;
            linkMap.set(placeholder, linkHtml);

            return placeholder;
        })
        .replace(/`?\\end\{proof\}`?/g, '<span class="halmos">∎</span>')
        .replace(/:([a-zA-Z0-9_-]+):/g, (match, iconName) => {
            const svgString = IconMap[iconName];

            if (svgString) {
                return `<span class="inline-flex items-center align-middle mx-1">${svgString}</span>`;
            }

            // Fallback for icons you haven't mapped yet
            return match;
        });

    try {
        const processor = unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkBreaks)
            .use(remarkGraphviz)
            .use(remarkDesmos)
            .use(remarkFrontmatter, ['yaml'])
            .use(remarkMath)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypeRaw)
            .use(rehypeHighlight)
            .use(rehypeObsidianCallouts)
            .use(rehypeSlug)
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
                    "\\cases": "\\begin{cases} #1 \\end{cases}",
                    "\\uptau": "\\tau",
                }
            })
            .use(extractTOCPlugin)
            .use(rehypeStringify, { allowDangerousHtml: true });

        const file = await processor.process(processedContent);
        let contentHtml = file.toString();

        for (const [placeholder, html] of linkMap.entries()) {
            contentHtml = contentHtml.split(placeholder).join(html);
        }

        return {
            contentHtml: contentHtml,
            toc: file.data.toc || []
        };
    } finally {
        console.warn = originalWarn;
    }
}