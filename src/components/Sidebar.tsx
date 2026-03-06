"use client";

import { TocItem } from "@/lib/toc";
import { useEffect, useState, useRef, ReactNode } from "react";
// 1. Added new icons for the callout types and dropdowns!
import { ArrowRight, Menu, X, ChevronDown, ChevronLeft, BookOpen, Bookmark, Lightbulb, PenTool, FileText, GraduationCap } from "lucide-react";
import Link from "next/link";
import { SearchBar } from "./Home";
import BackButton from "./NoteComponents/BackButton";
import RenderMD from "./MarkdownRendererForInline";
import ThemeMenu from "./ThemeMenu";

interface NavigatorContent {
    title: string;
    toc: TocItem[];
    parent: {
        url: string;
        name: string;
    };
}

const levelStyles: Record<number, string> = {
    1: "text-[15px] font-bold text-foreground-heading-sidebar-1 mb-2 mt-4 first:mt-0 tracking-wide",
    2: "text-[14px] font-semibold text-foreground-heading-sidebar-2 mb-1.5",
    3: "text-[13px] font-medium text-foreground-heading-sidebar-3 mb-1",
    4: "text-[12px] font-medium text-foreground-heading-sidebar-4 border-r-2 pr-2",
    5: "text-[12px] font-normal text-foreground-heading-sidebar-5 border-r-2 pr-3",
    6: "text-[12px] font-normal text-foreground-heading-sidebar-6 border-r-2 pr-4"
};

// 2. Helper function to return the correct icon based on the Obsidian callout type
const getCalloutIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'definition':
        case 'axiom':
            return <BookOpen size={13} className="ml-2 opacity-70 shrink-0" />;
        case 'theorem':
        case 'lemma':
            return <GraduationCap size={13} className="ml-2 opacity-70 shrink-0" />;
        case 'corollary':
        case 'claim':
            return <Bookmark size={13} className="ml-2 opacity-70 shrink-0" />;
        case 'example':
            return <Lightbulb size={13} className="ml-2 opacity-70 shrink-0" />;
        case 'exercise':
        case 'hw':
            return <PenTool size={13} className="ml-2 opacity-70 shrink-0" />;
        default:
            return <FileText size={13} className="ml-2 opacity-70 shrink-0" />;
    }
};

function JustArrowBackButton({ url }: { url: string; }) {
    return (
        <Link
            href={url}
            className="p-2 text-sm font-medium text-accent2-border hover:text-highlight"
        >
            <ArrowRight size={24} />
        </Link>
    );
}

// ==========================================
// Reusable Fading Scroll Container
// ==========================================
function FadingScrollContainer({ children, activeHeadingId }: { children: ReactNode, activeHeadingId: string }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(true);

    const checkScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        
        setCanScrollUp(scrollTop > 0);
        setCanScrollDown(Math.ceil(scrollTop + clientHeight) < scrollHeight - 2);
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    }, [children]);

    useEffect(() => {
        if (!activeHeadingId || !scrollRef.current) return;
        
        const container = scrollRef.current;
        const activeEl = container.querySelector(`[data-toc-id="${activeHeadingId}"]`) as HTMLElement;
        
        if (activeEl) {
            const containerHeight = container.clientHeight;
            const elementTop = activeEl.offsetTop;
            const elementHeight = activeEl.clientHeight;
            
            container.scrollTo({
                top: elementTop - (containerHeight / 2) + (elementHeight / 2),
                behavior: "smooth"
            });
        }
    }, [activeHeadingId]);

    return (
        <div className="relative flex-1 min-h-0 w-full flex flex-col mt-6">
            <div className={`absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-accent2-background to-transparent pointer-events-none z-10 transition-opacity duration-300 ${canScrollUp ? 'opacity-100' : 'opacity-0'}`} />
            <div ref={scrollRef} onScroll={checkScroll} className="flex-1 overflow-y-auto no-scrollbar w-full relative">
                {children}
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-accent2-background to-transparent pointer-events-none z-10 transition-opacity duration-300 ${canScrollDown ? 'opacity-100' : 'opacity-0'}`} />
        </div>
    );
}
// ==========================================

export default function Sidebar({ content }: { content: NavigatorContent }) {
    const [activeId, setActiveId] = useState<string>("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [manualToggleState, setManualToggleState] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const headingIds = content.toc?.map((item) => item.id) || [];

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { rootMargin: "-10% 0px -80% 0px" } 
        );

        headingIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [content.toc]);

    const activeHeadingId = content.toc?.find(
        (item) => item.id === activeId || item.callouts.some((c) => c.id === activeId)
    )?.id || activeId;

    // 4. AUTO-EXPAND MAGIC: If you scroll into a new section, automatically open its callouts!
    const toggleGroup = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        setManualToggleState((prev) => {
            // Determine if it looks open or closed right now
            const isCurrentlyExpanded = prev[id] !== undefined ? prev[id] : (activeHeadingId === id);
            
            return {
                ...prev,
                [id]: !isCurrentlyExpanded // Flip it and save the manual override
            };
        });
    };

    useEffect(() => {
        if (isMenuOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isMenuOpen]);

    const contentList = (
        <ul className="flex flex-col space-y-2 pb-8">
            {content.toc?.map((item: TocItem) => {
                const isSectionActive = activeHeadingId === item.id;
                const hasCallouts = item.callouts && item.callouts.length > 0;
                const isExpanded = manualToggleState[item.id] !== undefined 
                    ? manualToggleState[item.id] 
                    : isSectionActive;

                return (
                    <li 
                        key={item.id} 
                        data-toc-id={item.id} 
                        className="my-1 flex flex-col relative" 
                        style={{ paddingRight: `${(item.level - 1) * 1.25}rem` }}
                    >
                        {/* THE WRAPPER: Now a flex row to hold the title and the dropdown button */}
                        <div className={`transition-all duration-200 flex items-center justify-between border-r-2 ${
                            isSectionActive
                                ? "text-highlight bg-highlight/10 border-highlight font-bold"
                                : "border-transparent hover:text-accent2-foreground hover:bg-foreground/5"
                            } ${levelStyles[item.level] || "text-sm pr-2"}`}
                        >
                            <a
                                href={`#${item.id}`}
                                onClick={() => setIsMenuOpen(false)}
                                className="flex-1 py-1"
                            >
                                <RenderMD content={item.title} />
                            </a>

                            {/* THE TOGGLE BUTTON */}
                            {hasCallouts && (
                                <button
                                    onClick={(e) => toggleGroup(e, item.id)}
                                    className="p-1.5 ml-1 rounded-md opacity-50 hover:opacity-100 hover:bg-foreground/10 transition-all"
                                    aria-label="Toggle Subsections"
                                >
                                    {/* ChevronLeft is used for closed state because of RTL layout */}
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                                </button>
                            )}
                        </div>

                        {/* THE CALLOUTS (Conditionally rendered based on 'isExpanded' state) */}
                        {hasCallouts && isExpanded && (
                            <ul className="flex flex-col mt-1 pr-3 border-r border-accent2-border/30 mr-2 space-y-1 toc-callout-list">
                                {item.callouts.map((callout) => (
                                    <li key={callout.id} className="toc-callout-item" data-toc-id={callout.id}>
                                        <a
                                            href={`#${callout.id}`}
                                            onClick={() => setIsMenuOpen(false)}
                                            className={`transition-all duration-200 flex items-center py-1.5 pr-2 text-[11px] font-medium rounded-l-md ${
                                                activeId === callout.id
                                                    ? "text-highlight bg-highlight/10"
                                                    : "text-foreground-heading-sidebar-5 hover:text-accent2-foreground hover:bg-foreground/5"
                                            }`}
                                        >
                                            {/* Render the specific icon for this callout type */}
                                            {getCalloutIcon(callout.type)}
                                            <span className="flex-1"><RenderMD content={callout.title} /></span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ul>
    );

    return (<>
        {/* ---------------------- DESKTOP SIDEBAR ---------------------- */}
        <div
            className="hidden xl:flex min-w-sm max-w-[20rem] w-full h-screen p-4 lg:p-10 flex-col justify-between sticky top-0 bg-accent2-background border-l border-accent2-border shadow-lg"
            dir="rtl"
        >
            <div className="w-full shrink-0">
                <BackButton url={content.parent.url} name={content.parent.name} />
                <a href="#" className="w-full block mt-2">
                    <h1 className="hidden lg:flex flex-col text-3xl font-bold text-accent2-foreground mb-4">
                        {content.title}
                    </h1>
                </a>
                <SearchBar size={1} />
            </div>

            <FadingScrollContainer activeHeadingId={activeId}>
                {contentList}
            </FadingScrollContainer>

            <div className="w-full shrink-0 pt-6 mt-2 border-t border-accent2-border">
                <ThemeMenu />
            </div>
        </div>

        {/* ---------------------- TABLET TOPBAR ---------------------- */}
        <div className="hidden sm:flex xl:hidden w-full h-16 bg-accent2-background border-b border-accent2-border shadow-lg flex-row items-center justify-between px-4 sticky top-0 z-50" dir="rtl">
            <JustArrowBackButton url={content.parent.url} />
            <h1 className="text-lg font-bold text-accent2-foreground">
                {content.title}
            </h1>
            <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 text-accent2-foreground hover:bg-white/10 rounded-md transition-colors"
                aria-label="Open navigation menu"
            >
                <Menu size={24} />
            </button>
        </div>

        {/* ---------------------- MOBILE DRAWER MENU ---------------------- */}
        {isMenuOpen && (
            <div
                className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50 xl:hidden transition-opacity"
                onClick={() => setIsMenuOpen(false)}
            />
        )}

        <div
            className={`fixed top-0 right-0 h-full w-72 sm:w-80 bg-accent2-background shadow-2xl z-[60] transform transition-transform duration-300 xl:hidden flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
            dir="rtl"
        >
            <div className="p-6 flex flex-col h-full">
                <div className="shrink-0 mb-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-accent2-foreground">ניווט</h2>
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="hidden sm:flex p-2 text-button-border hover:text-button-hover-bg bg-background/5 hover:bg-background/10 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <div className="sm:hidden">
                            <JustArrowBackButton url={content.parent.url} />
                        </div>
                    </div>
                    <SearchBar size={1} />
                </div>

                <FadingScrollContainer activeHeadingId={activeId}>
                    {contentList}
                </FadingScrollContainer>
                
                <div className="w-full shrink-0 pt-4 mt-2 border-t border-foreground/10">
                    <ThemeMenu />
                </div>
            </div>
        </div>

        {/* ---------------------- PHONE FLOATING BUTTON ---------------------- */}
        <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="fixed bottom-6 right-6 z-[70] w-14 h-14 flex items-center justify-center bg-hero-primary-main hover:bg-hero-primary-hover text-accent2-foreground rounded-full shadow-[0_4px_14px_var(--shadow-color)] transition-all duration-300 sm:hidden"
            aria-label="Toggle Mobile Menu"
        >
            <div className={`transition-transform duration-300 flex items-center justify-center ${isMenuOpen ? 'rotate-90 scale-110' : 'rotate-0'}`}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </div>
        </button>
    </>);
}