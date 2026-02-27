'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function RenderMD({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                // 1. Flatten text blocks
                p: ({ node, ...props }) => <span {...props} />,
                blockquote: ({ node, ...props }) => (
                    <span className="border-r-2 border-orange-500/50 pr-2 mr-1 text-gray-400 italic" {...props} />
                ),

                // 2. Flatten lists into a single line separated by commas
                ul: ({ node, ...props }) => <span className="space-x-1" {...props} />,
                ol: ({ node, ...props }) => <span className="space-x-1" {...props} />,
                li: ({ node, ...props }) => <span className="after:content-[',_'] last:after:content-['']" {...props} />,

                // 3. Flatten headers so they don't get massive
                h1: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,
                h2: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,
                h3: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,

                // 4. Style code blocks so they look like inline badges instead of massive dark boxes
                code: ({ node, className, children, ...props }) => {
                    // Check if it's an inline `code` or a block ```code```
                    const isInline = !className?.includes('language-');
                    return (
                        <code className="bg-gray-800 text-orange-200 px-1.5 py-0.5 rounded text-xs mx-0.5" {...props}>
                            {children}
                        </code>
                    );
                },
                pre: ({ node, children, ...props }) => (
                    <span className="inline-block" {...props}>
                        {children}
                    </span>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // Toggle with Ctrl+K and close with Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSearch = async (val: string) => {
        setQuery(val);
        setResults([]);
        setTotalResults(0);
        const query = val.toLowerCase().trim();

        if (query.length < 2) return;

        try {
            const res = await fetch('/search-index.json');
            const data = await res.json();

            const scoredResults = data
                .map((item: any) => {
                    let score = 0;
                    const title = item.title.toLowerCase();
                    const rawContent = item.content || item.excerpt || "";
                    const bodyContent = rawContent.toLowerCase();

                    if (title === query) score += 100;
                    else if (title.startsWith(query)) score += 50;
                    else if (title.includes(query)) score += 30;

                    if (bodyContent.includes(query)) {
                        score += 10;
                        const matchIndex = bodyContent.indexOf(query);
                        const start = Math.max(0, matchIndex - 40);
                        const end = Math.min(rawContent.length, matchIndex + query.length + 40);
                        item.displayExcerpt = (start > 0 ? "..." : "") +
                            rawContent.substring(start, end).replace(/\n/g, ' ') +
                            (end < rawContent.length ? "..." : "");
                    } else {
                        item.displayExcerpt = item.excerpt.replace(/\n/g, ' ');
                    }

                    if (item.priority === 1 && !title.includes(query)) {
                        score -= 20;
                    }

                    return { ...item, score };
                })
                .filter((item: any) => item.score > 0)
                .sort((a: any, b: any) => b.score - a.score);

            setTotalResults(scoredResults.length);
            setResults(scoredResults);
            setSelectedIndex(0);
        } catch (err) {
            console.error("Failed to fetch or parse search index:", err);
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault(); // Stop the cursor from jumping to the end of the text
            setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); // Stop the cursor from jumping to the start
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < results.length) {
                router.push(results[selectedIndex].path);
                setIsOpen(false);
            }
        }
    };

    // Auto-scroll the list when navigating with arrows
    useEffect(() => {
        if (isOpen) {
            const el = document.getElementById(`search-result-${selectedIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, isOpen]);

    if (!isOpen) return null;

    return (
        // The overlay backdrop: clicking it closes the modal
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
            onClick={() => setIsOpen(false)}
        >
            {/* The modal container: stopPropagation prevents clicks inside from closing it */}
            <div
                className="bg-[#171717] border border-gray-700/60 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input Header */}
                <div className="flex items-center px-4 border-b border-gray-800/60" dir="rtl">
                    <svg className="w-5 h-5 text-gray-400 ml-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        className="w-full bg-transparent text-gray-100 placeholder-gray-500 py-4 outline-none text-lg"
                        placeholder="חיפוש בסיכומים (אינפי, אלגברה, מדמ״ח...)"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                    />

                    {/* The Counter */}
                    {query.length >= 2 && (
                        <span className="text-sm text-gray-500 whitespace-nowrap ml-3">
                            {`${totalResults} תוצאות`}
                        </span>
                    )}

                    <kbd className="hidden sm:inline-block bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded border border-gray-700 font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Results List */}
                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1" dir="rtl">
                    {results.length === 0 && query.length >= 2 && (
                        <div className="p-8 text-center text-gray-500">
                            לא נמצאו תוצאות עבור "{query}"
                        </div>
                    )}

                    {results.map((res, index) => {
                        // Pass the index ^^^

                        const imageRegex = /!\[([^\]]*)\]/g;
                        const calloutRegex = />\s*\[!\w+\]\s*(.*)/g;
                        const iconRegex = /:[a-zA-Z0-9_-]+:/g;
                        const viewTitle = res.title
                            .replace(imageRegex, '')
                            .replace(calloutRegex, '$1')
                            .replace(iconRegex, '')
                            .trim() || res.title;
                        const viewDisplayExcerpt = res.displayExcerpt
                            .replace(imageRegex, '')
                            .replace(calloutRegex, '$1')
                            .replace(iconRegex, '')
                            .trim() || res.displayExcerpt;

                        const isActive = index === selectedIndex; // <-- Check if this is the highlighted item

                        return (
                            <div
                                id={`search-result-${index}`} // <-- Added ID for auto-scrolling
                                key={`search-result-${res.path}-with-${res.displayExcerpt}`}
                                onClick={() => { router.push(res.path); setIsOpen(false); }}
                                onMouseEnter={() => setSelectedIndex(index)} // <-- Syncs mouse hover with keyboard
                                className={`p-3 rounded-lg cursor-pointer transition-colors group flex flex-col gap-1 border-r-4 ${isActive
                                        ? 'bg-white/10 border-orange-400'
                                        : 'hover:bg-white/5 border-transparent'
                                    }`}
                            >
                                <div className="text-orange-400 font-medium flex items-center gap-2">
                                    <svg className={`w-4 h-4 transition-colors shrink-0 ${isActive ? 'text-orange-400' : 'text-gray-600 group-hover:text-orange-400/50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                    >
                                        {viewTitle}
                                    </ReactMarkdown>
                                </div>

                                <div className="text-gray-400 text-sm leading-relaxed pr-6 line-clamp-2">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ node, ...props }) => <span {...props} />,
                                            blockquote: ({ node, ...props }) => <span className="text-gray-400 italic" {...props} />,
                                            ul: ({ node, ...props }) => <span className="space-x-1" {...props} />,
                                            ol: ({ node, ...props }) => <span className="space-x-1" {...props} />,
                                            li: ({ node, ...props }) => <span className="after:content-[',_'] last:after:content-['']" {...props} />,
                                            h1: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,
                                        }}
                                    >
                                        {/* Flatten display math to inline so it doesn't break layout */}
                                        {viewDisplayExcerpt.replace(/\$\$/g, '$')}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}