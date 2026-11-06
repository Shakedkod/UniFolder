'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import MiniSearch from 'minisearch';
import RenderMD from './MarkdownRendererForInline';
import {
    Folder,
    GraduationCap,
    BookOpen,
    Bookmark,
    Lightbulb,
    Hash,
    Layers,
    FileText,
    Pencil,
    X,
    Search as SearchIcon,
    Loader2,
    ArrowLeft,
    Sparkles,
} from 'lucide-react';

export type SearchCategory =
    | 'all'
    | 'theorems'
    | 'definitions'
    | 'lemmas'
    | 'topics'
    | 'courses'
    | 'lectures'
    | 'tutorials';

interface SearchItem {
    id: string;
    title: string;
    type: string;
    typeHebrew: string;
    path: string;
    content?: string;
    courseName?: string;
    courseCode?: string;
    noteTitle?: string;
    sectionTitle?: string;
    keywords?: string;
}

const CATEGORY_TABS: { id: SearchCategory; label: string; icon?: any }[] = [
    { id: 'all', label: 'הכל' },
    { id: 'theorems', label: 'משפטים' },
    { id: 'definitions', label: 'הגדרות' },
    { id: 'lemmas', label: 'למות וטענות' },
    { id: 'topics', label: 'נושאים' },
    { id: 'courses', label: 'קורסים' },
    { id: 'lectures', label: 'הרצאות' },
    { id: 'tutorials', label: 'תרגולים' },
];

const POPULAR_SUGGESTIONS = [
    { label: 'משפט בולצאנו-ויירשטראס', query: 'בולצאנו ויירשטראס' },
    { label: 'הגדרת גבול', query: 'הגדרת גבול' },
    { label: 'משפט קנטור', query: 'קנטור' },
    { label: 'אינפי 1מ\'', query: 'אינפי 1' },
    { label: 'מבני נתונים 1', query: 'מבני נתונים' },
    { label: 'גרם שמידט', query: 'גרם שמידט' },
    { label: 'למת החילוץ', query: 'למת החילוץ' },
];

// Normalize Hebrew for MiniSearch
const normalizeHebrew = (term: string) => {
    return term
        .toLowerCase()
        .replace(/[\u0591-\u05C7]/g, '') // strip nikud
        .replace(/["'״׳]/g, '') // normalize quotes (מדמ"ח == מדמח, 1מ' == 1מ)
        .replace(/[-_]/g, ' ')
        .trim();
};

export default function Search() {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
    const [results, setResults] = useState<SearchItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isIndexReady, setIsIndexReady] = useState(false);

    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const miniSearchRef = useRef<MiniSearch<SearchItem> | null>(null);
    const itemsMapRef = useRef<Map<string, SearchItem>>(new Map());

    // 1. Initialize or load the search index
    const loadIndex = async () => {
        if (miniSearchRef.current) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/search-data');
            const data: SearchItem[] = await res.json();

            const ms = new MiniSearch<SearchItem>({
                fields: ['title', 'content', 'courseName', 'courseCode', 'noteTitle', 'sectionTitle', 'typeHebrew', 'keywords'],
                storeFields: ['id', 'title', 'type', 'typeHebrew', 'path', 'content', 'courseName', 'courseCode', 'noteTitle', 'sectionTitle'],
                searchOptions: {
                    prefix: true,
                    fuzzy: (term) => (term.length > 3 ? 0.2 : false),
                    boost: {
                        title: 7,
                        typeHebrew: 5,
                        courseName: 4,
                        sectionTitle: 3,
                        keywords: 2,
                        content: 1,
                    },
                },
                processTerm: normalizeHebrew,
            });

            const map = new Map<string, SearchItem>();
            for (const item of data) {
                map.set(item.id, item);
            }
            itemsMapRef.current = map;

            ms.addAll(data);
            miniSearchRef.current = ms;
            setIsIndexReady(true);
        } catch (err) {
            console.error('Failed to initialize search engine:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Open / close handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Preload index when modal opens and auto-focus
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            loadIndex();
            setTimeout(() => {
                inputRef.current?.focus();
            }, 60);
        } else {
            document.body.style.overflow = 'unset';
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // 3. Perform search whenever query or category changes
    useEffect(() => {
        if (!miniSearchRef.current) return;

        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            setSelectedIndex(0);
            return;
        }

        // Try exact AND search first so multi-word queries match accurately
        let rawResults = miniSearchRef.current.search(trimmed, { combineWith: 'AND' });
        if (rawResults.length === 0) {
            rawResults = miniSearchRef.current.search(trimmed, { combineWith: 'OR' });
        }

        const map = itemsMapRef.current;

        const fullItems: SearchItem[] = [];
        for (const r of rawResults) {
            const item = map.get(r.id);
            if (!item) continue;

            // Category filtering
            if (activeCategory === 'theorems' && item.type !== 'theorem') continue;
            if (activeCategory === 'definitions' && item.type !== 'definition') continue;
            if (activeCategory === 'lemmas' && !['lemma', 'claim', 'corollary', 'axiom'].includes(item.type)) continue;
            if (activeCategory === 'topics' && item.type !== 'topic') continue;
            if (activeCategory === 'courses' && item.type !== 'course') continue;
            if (activeCategory === 'lectures' && item.type !== 'lecture') continue;
            if (activeCategory === 'tutorials' && !['tutorial', 'homework'].includes(item.type)) continue;

            fullItems.push(item);
            if (fullItems.length >= 80) break; // Limit for optimal UI performance
        }

        setResults(fullItems);
        setSelectedIndex(0);
    }, [query, activeCategory, isIndexReady]);

    // 4. Keyboard navigation (Arrow Up, Arrow Down, Enter)
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < results.length) {
                navigateToResult(results[selectedIndex]);
            }
        }
    };

    const navigateToResult = (item: SearchItem) => {
        router.push(item.path);
        setIsOpen(false);
    };

    // Auto-scroll list when navigating with arrows
    useEffect(() => {
        if (isOpen) {
            const el = document.getElementById(`search-res-${selectedIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, isOpen]);

    if (!isOpen) return null;

    // Helper for rendering badges
    const renderTypeBadge = (type: string, hebrew: string) => {
        switch (type) {
            case 'theorem':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        <GraduationCap size={12} />
                        <span>משפט</span>
                    </span>
                );
            case 'definition':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                        <BookOpen size={12} />
                        <span>הגדרה</span>
                    </span>
                );
            case 'lemma':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Bookmark size={12} />
                        <span>למה</span>
                    </span>
                );
            case 'claim':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Lightbulb size={12} />
                        <span>טענה</span>
                    </span>
                );
            case 'corollary':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-500/15 text-teal-400 border border-teal-500/30">
                        <Bookmark size={12} />
                        <span>מסקנה</span>
                    </span>
                );
            case 'topic':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <Hash size={12} />
                        <span>נושא</span>
                    </span>
                );
            case 'course':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-600/15 text-blue-400 border border-blue-600/30">
                        <Layers size={12} />
                        <span>קורס</span>
                    </span>
                );
            case 'homework':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
                        <Pencil size={12} />
                        <span>שיעורי בית</span>
                    </span>
                );
            case 'tutorial':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        <GraduationCap size={12} />
                        <span>תרגול</span>
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                        <FileText size={12} />
                        <span>{hebrew || 'סיכום'}</span>
                    </span>
                );
        }
    };

    return (
        <div
            className="fixed inset-0 bg-background/70 backdrop-blur-md z-100 flex items-start justify-center pt-8 sm:pt-[10vh] px-3 sm:px-4 animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
        >
            <div
                className="bg-button-bg border border-button-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input Bar */}
                <div className="flex items-center px-4 py-3.5 border-b border-button-border-light relative gap-3" dir="rtl">
                    <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />

                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent text-foreground placeholder-gray-500 outline-none text-base sm:text-lg font-medium pr-1"
                        placeholder="חיפוש משפטים, הגדרות, למות, נושאים וקורסים..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                    />

                    {/* Loading spinner */}
                    {isLoading && (
                        <Loader2 className="w-4 h-4 text-highlight animate-spin shrink-0" />
                    )}

                    {/* Clear Button */}
                    {query.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                inputRef.current?.focus();
                            }}
                            className="p-1 rounded-full text-gray-400 hover:text-foreground hover:bg-white/10 transition-colors"
                            aria-label="נקה חיפוש"
                        >
                            <X size={16} />
                        </button>
                    )}

                    {/* Result Count Badge */}
                    {query.trim().length > 0 && (
                        <span className="text-xs font-medium text-gray-400 bg-background/50 px-2 py-1 rounded-md border border-button-border-light whitespace-nowrap">
                            {results.length} תוצאות
                        </span>
                    )}

                    <kbd className="hidden sm:inline-flex items-center gap-1 bg-button-border text-foreground text-[10px] font-mono px-2 py-1 rounded border border-button-border-light">
                        ESC
                    </kbd>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-button-border-light bg-accent-background/30 overflow-x-auto no-scrollbar" dir="rtl">
                    {CATEGORY_TABS.map((tab) => {
                        const isActive = activeCategory === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveCategory(tab.id)}
                                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${isActive
                                    ? 'bg-hero-primary-main/20 text-hero-primary-main border border-hero-primary-main/40 font-semibold'
                                    : 'text-gray-400 hover:text-foreground hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Results Container */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-button-border-light/30" dir="rtl">
                    {/* Empty Query State: Show Suggestions */}
                    {!query.trim() && (
                        <div className="p-6 flex flex-col gap-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 rounded-full bg-highlight/10 text-highlight mb-1">
                                    <Sparkles size={24} />
                                </div>
                                <h3 className="text-base font-bold text-foreground">חיפוש חכם בכל תיקיית הסיכומים</h3>
                                <p className="text-xs text-really-light-text max-w-md">
                                    ניתן לחפש שמות משפטים, הגדרות מתמטיות, למות, טענות, ראשי פרקים, מספרי קורסים ומילות מפתח.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-2 text-right">
                                <span className="text-xs font-semibold text-gray-400">נושאים ומשפטים מבוקשים:</span>
                                <div className="flex flex-wrap gap-2">
                                    {POPULAR_SUGGESTIONS.map((item) => (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => {
                                                setQuery(item.query);
                                                inputRef.current?.focus();
                                            }}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-background hover:bg-hero-primary-main/15 border border-button-border-light hover:border-hero-primary-main text-foreground/90 transition-all shadow-2xs"
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No Results Found */}
                    {query.trim().length > 0 && results.length === 0 && (
                        <div className="py-12 px-6 text-center text-gray-400 flex flex-col items-center gap-2">
                            <span className="text-lg">לא נמצאו תוצאות עבור "{query}"</span>
                            <span className="text-xs text-gray-500">נסו לחפש חלק מהמילה, מונח אחר או לבחור בקטגוריה "הכל".</span>
                        </div>
                    )}

                    {/* Results List */}
                    {results.map((item, index) => {
                        const isActive = index === selectedIndex;
                        const isCourse = item.type === 'course';

                        return (
                            <div
                                id={`search-res-${index}`}
                                key={item.id}
                                onClick={() => navigateToResult(item)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5 border-r-4 ${isActive
                                    ? 'bg-white/5 border-highlight shadow-xs'
                                    : 'hover:bg-white/3 border-transparent'
                                    }`}
                            >
                                {/* Header: Badge, Title, Breadcrumb */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {renderTypeBadge(item.type, item.typeHebrew)}

                                        <div className="text-foreground font-semibold text-sm sm:text-base truncate">
                                            <RenderMD content={item.title.replace(/\$\$/g, '$')} />
                                        </div>
                                    </div>

                                    {/* Course & Note Context */}
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0 font-normal">
                                        {item.courseName && (
                                            <span className="flex items-center gap-1 text-[11px] bg-background/80 px-2 py-0.5 rounded border border-button-border-light">
                                                <Folder size={11} className="text-highlight" />
                                                <span className="truncate max-w-[130px]">{item.courseName}</span>
                                            </span>
                                        )}
                                        <ArrowLeft size={12} className="text-gray-500" />
                                    </div>
                                </div>

                                {/* Breadcrumb Subtitle for Callouts / Topics */}
                                {(item.noteTitle || item.sectionTitle) && !isCourse && (
                                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pr-1">
                                        {item.noteTitle && <span>{item.noteTitle}</span>}
                                        {item.noteTitle && item.sectionTitle && <span>›</span>}
                                        {item.sectionTitle && <span className="text-gray-300 font-medium">{item.sectionTitle}</span>}
                                    </div>
                                )}

                                {/* Excerpt / Content Statement */}
                                {item.content && (
                                    <div className="text-xs text-gray-400 line-clamp-2 leading-relaxed pr-1 font-normal opacity-90">
                                        <RenderMD content={item.content.replace(/\$\$/g, '$')} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Bar */}
                <div className="px-4 py-2 border-t border-button-border-light bg-accent-background/40 flex items-center justify-between text-[11px] text-gray-400" dir="rtl">
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-background border border-button-border-light text-[10px] font-mono">↑</kbd>
                            <kbd className="px-1.5 py-0.5 rounded bg-background border border-button-border-light text-[10px] font-mono">↓</kbd>
                            ניווט
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-background border border-button-border-light text-[10px] font-mono">Enter</kbd>
                            פתיחה
                        </span>
                    </div>

                    <span>חיפוש מהיר בכספת הלימודים</span>
                </div>
            </div>
        </div>
    );
}
