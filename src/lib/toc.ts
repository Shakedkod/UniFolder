import GithubSlugger from 'github-slugger';

export interface CalloutItem {
    id: string;
    title: string;
    type: string;
}

export type TocItem = {
    id: string;
    title: string;
    slug: string;
    level: number;
    callouts: CalloutItem[];
}

export type PdfTocItem = {
    title: string;
    dest: any[];
    items: PdfTocItem[];
}

export function extractTOC(markdownContent: string): TocItem[] {
    const slugger = new GithubSlugger();
    const toc: TocItem[] = [];

    // Match Markdown headers from # to ######
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = headerRegex.exec(markdownContent)) !== null) {
        const depth = match[1].length;
        let title = match[2].trim();

        // Skip the YAML frontmatter dividers if they get caught
        if (title === '---') continue;

        // Clean LaTeX just like we did in the sync script to ensure slugs match perfectly
        const cleanForSlug = title.replace(/\$/g, '');

        toc.push({
            level: depth,
            title, // Keeps the original text, including the $L$ for the UI!
            slug: slugger.slug(cleanForSlug),
            id: slugger.slug(cleanForSlug),
            callouts: [] // Placeholder for callouts, to be filled in later
        });
    }

    return toc;
}

export function flattenPdfToc(items: PdfTocItem[], level = 1): TocItem[] {
    return items.flatMap(item => {
        const pageNum = item.dest?.[0]?.num ?? 0;
        return [
            { title: item.title, slug: item.title, level, pageNum, id: item.title, callouts: [] },
            ...flattenPdfToc(item.items ?? [], level + 1)   
        ];
    });
}