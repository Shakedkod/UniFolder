'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import RenderMD from './MarkdownRendererForInline';
import { Folder, GraduationCap, Group, Pencil, FileText } from 'lucide-react';

const getResultIcon = (res: any) => {
    if (res.isLecture) {
        return (<GraduationCap className="w-4 h-4 text-highlight" />);
    }
    if (res.isTutorial) {
        // Users/Group for Tutorials
        return (<Group className="w-4 h-4 text-highlight" />);
    }
    if (res.isHomework) {
        // Pencil for Homework
        return (<Pencil className="w-4 h-4 text-green-400" />);
    }
    return (<FileText className="w-4 h-4 text-gray-400" />);
};

export default function Search() {
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
            // Detect Ctrl+K or Cmd+K (for Mac users)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault(); // STOP the browser's default "search" behavior
                setIsOpen((prev) => !prev);
            }

            // Bonus: Escape to close
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    const handleSearch = async (val: string) => {
        setQuery(val);
        setResults([]);
        setTotalResults(0);
        const query = val.toLowerCase().trim();

        if (query.length < 2) return;

        try {
            // 1. Fetch from the enriched API route instead of the static file
            const res = await fetch('/api/search-data');
            const data = await res.json();

            const scoredResults = data.map((item: any) => {
                let score = 0;
                const title = item.title.toLowerCase();
                const queryLower = query.toLowerCase();
                const rawContent = item.content || item.excerpt || "";
                const bodyContent = rawContent.toLowerCase();

                // 1. TITLE SCORING
                let titleScore = 0;
                if (title === queryLower) {
                    titleScore = 100000;
                } else if (title.includes(queryLower)) {
                    titleScore = 50000;

                    // DEPTH PENALTY:
                    // If the title contains '>', it's a section. 
                    // We subtract a small amount so "File" > "File > Section"
                    const depth = (title.match(/>/g) || []).length;
                    titleScore -= (depth * 1000);
                }

                // 2. CONTENT SCORING (Crucial for showing results where query is not in the filename)
                // We give a base score if the content matches, ensuring it passes the filter
                let contentScore = 0;
                if (bodyContent.includes(queryLower)) {
                    contentScore += 40; // Base score for content match

                    // Bonus score based on how many times it appears
                    const occurrences = (bodyContent.match(new RegExp(queryLower, 'g')) || []).length;
                    contentScore += Math.min(occurrences * 2, 20);

                    // Snippet generation logic remains the same
                    const matchIndex = bodyContent.indexOf(queryLower);
                    const start = Math.max(0, matchIndex - 40);
                    const end = Math.min(rawContent.length, matchIndex + queryLower.length + 40);

                    let snippet = rawContent.substring(start, end);
                    const dollarCount = (snippet.match(/\$/g) || []).length;

                    if (dollarCount % 2 !== 0) {
                        // Find the remaining part of the math block in the original content
                        const remainingContent = rawContent.substring(end);
                        const nextClosingDollar = remainingContent.indexOf('$');

                        if (nextClosingDollar !== -1) {
                            // Extend the snippet just enough to close the math block
                            snippet += remainingContent.substring(0, nextClosingDollar + 1);
                        } else {
                            // If no closing dollar is found, strip the opening dollar to avoid broken render
                            snippet = snippet.replace(/\$(?=[^$]*$)/, '');
                        }
                    }

                    item.displayExcerpt = (start > 0 ? "..." : "") + snippet.replace(/\n/g, ' ') + "...";
                }
                else {
                    item.displayExcerpt = (item.excerpt || "").slice(0, 100);
                }

                let categoryMultiplier = item.isLecture ? 10 : item.isTutorial ? 5 : 1;
                let finalContentScore = contentScore * categoryMultiplier;
                score = titleScore + finalContentScore;

                // 3. CATEGORY DETECTION (Using the API-provided flags)
                const path = (item.path || "").toLowerCase();
                const isHomework = item.isHomework || path.includes('שיעורי בית');
                const isTutorial = item.isTutorial || path.includes('תרגול') || path.includes("tutorials");
                const isLecture = item.isLecture || (/^\d+/.test(item.title) && !isHomework && !isTutorial);

                return { ...item, score, isLecture, isTutorial, isHomework, isTitleMatch: titleScore > 0 };
            }).filter((item: any) => item.score > 0) // Now content matches have a score of 20+
                .sort((a: any, b: any) => {
                    // 1. Group by Category
                    const getWeight = (item: any) => item.isLecture ? 1 : item.isTutorial ? 2 : 3;
                    const weightA = getWeight(a);
                    const weightB = getWeight(b);
                    if (weightA !== weightB) return weightA - weightB;

                    // 2. Within that category, put Title Matches first
                    if (a.isTitleMatch !== b.isTitleMatch) {
                        return a.isTitleMatch ? -1 : 1;
                    }

                    // 3. Within those groups, sort by raw score
                    return b.score - a.score;
                });

            setTotalResults(scoredResults.length);
            setResults(scoredResults);
            setSelectedIndex(0);
        } catch (err) {
            console.error("Failed to fetch search data:", err);
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
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-100 flex items-start justify-center pt-[15vh]"
            onClick={() => setIsOpen(false)}
        >
            {/* The modal container: stopPropagation prevents clicks inside from closing it */}
            <div
                className="bg-button-bg border border-button-border-light/60 w-full max-w-2xl print:max-w-none rounded-xl shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input Header */}
                <div className="flex items-center px-4 border-b border-button-border/60" dir="rtl">
                    <svg className="w-5 h-5 text-gray-400 ml-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        className="w-full bg-transparent text-foreground placeholder-gray-500 py-4 outline-none text-lg"
                        placeholder="חפשו!"
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

                    <kbd className="hidden sm:inline-block bg-button-border text-foreground text-xs px-2 py-1 rounded border border-button-border-light font-mono">
                        ESC
                    </kbd>
                </div>

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

                        const isActive = index === selectedIndex;

                        return (
                            <div className="flex flex-col gap-1">
                                {/* Optional: Render a Category Header if it's the first item of its type */}
                                {(index === 0 ||
                                    (res.isLecture !== results[index - 1]?.isLecture) ||
                                    (res.isTutorial !== results[index - 1]?.isTutorial)) && (
                                        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 pt-4 pb-1" dir="rtl">
                                            {res.isLecture ? "הרצאות" : res.isTutorial ? "תרגולים" : "מטלות וחומר נוסף"}
                                        </div>
                                    )}

                                <div
                                    id={`search-result-${index}`}
                                    key={`search-result-${res.path}-with-${res.displayExcerpt}`}
                                    onClick={() => { router.push(res.path); setIsOpen(false); }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors group flex flex-col gap-1 border-r-4 ${isActive
                                        ? 'bg-background/10 border-highlight-icon'
                                        : 'hover:bg-white/5 border-transparent'
                                        }`}
                                >
                                    <div className="text-foreground-heading-2 font-medium flex items-center gap-2">
                                        {/* Dynamic Icon */}
                                        <div className={isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}>
                                            {getResultIcon(res)}
                                        </div>

                                        <RenderMD content={viewTitle.replace(/\$\$/g, '$')} />

                                        {/* THE FOLDER IDENTIFIER */}
                                        <span className="text-[10px] text-gray-500 font-normal flex items-center gap-1 opacity-70">
                                            <Folder size={10} />
                                            {/* Decodes URL-encoded Hebrew folder names */}
                                            {res.courseName}
                                        </span>
                                    </div>

                                    <div className="text-gray-400 text-sm leading-relaxed pr-6 line-clamp-2">
                                        <RenderMD content={viewDisplayExcerpt.replace(/\$\$/g, '$')} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}