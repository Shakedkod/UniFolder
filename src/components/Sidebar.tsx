"use client";

import { TocItem } from "@/lib/toc";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
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

export default function Sidebar({ content }: { content: NavigatorContent }) {
    const [activeId, setActiveId] = useState<string>("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            // Triggers when the element hits the top 20% of the screen
            { rootMargin: "-10% 0px -80% 0px" }
        );

        headingIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [content.toc]);

    // Determine which main heading is active
    // (If the user is reading a theorem, the active heading is the theorem's parent)
    const activeHeadingId = content.toc?.find(
        (item) => item.id === activeId || item.callouts.some((c) => c.id === activeId)
    )?.id || activeId;

    const contentList = (
        <ul className="flex flex-col space-y-2">
            {content.toc?.map((item: TocItem) => {
                const isSectionActive = activeHeadingId === item.id;

                return (
                    <li key={item.id} className="my-1 flex flex-col" style={{ paddingRight: `${(item.level - 1) * 1.25}rem` }}>
                        <a
                            href={`#${item.slug}`}
                            className={`transition-all duration-200 block py-1 border-r-2 ${isSectionActive
                                ? "text-orange-500 bg-orange-500/10 font-bold"
                                : "border-transparent hover:text-accent2-foreground hover:border-gray-600 px-2"
                                } ${levelStyles[item.level] || "text-sm"}`}
                        >
                            <RenderMD content={item.title} />
                        </a>
                    </li>
                );
            })}
        </ul>
    );

    useEffect(() => {
        if (isMenuOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isMenuOpen]);

    return (<>
        {/* ---------------------- DESKTOP SIDEBAR ---------------------- */}
        <div
            className="hidden xl:flex min-w-sm max-w-md h-screen p-4 lg:p-10 flex-col justify-start items-start sticky top-0 max-h-screen overflow-y-auto no-scrollbar bg-accent2-background border-l border-accent2-border shadow-lg"
            dir="rtl"
        >
            {/* BACK BUTTON FOR FILES */}
            <BackButton url={content.parent.url} name={content.parent.name} />

            {/* NOTE TITLE */}
            <a href="#" className="w-full">
                <h1 className="hidden lg:flex flex-col text-3xl font-bold text-accent2-foreground mb-4">
                    {content.title}
                </h1>
            </a>
            <SearchBar size={1} />

            <div className="w-full mt-5">
                {contentList}
            </div>

            {/* Theme Selector */}
            <div className="w-full mt-auto pt-6 border-t border-accent2-border">
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

        {/* MENU FOR TABLETS AND PHONES */}
        {/* Backdrop */}
        {isMenuOpen && (
            <div
                className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50 xl:hidden transition-opacity"
                onClick={() => setIsMenuOpen(false)}
            />
        )}

        {/* The Drawer Panel */}
        <div
            className={`fixed top-0 right-0 h-full w-72 sm:w-80 bg-accent2-background shadow-2xl z-60 transform transition-transform duration-300 xl:hidden overflow-y-auto no-scrollbar ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            dir="rtl"
        >
            <div className="p-6 flex flex-col h-full">
                {/* Drawer Header */}
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

                <div className="w-full mt-6 pb-20">
                    {contentList}
                </div>
                <div className="w-full h-px bg-foreground/10" />
                <ThemeMenu />
            </div>
        </div>

        {/* ---------------------- PHONE MENU ---------------------- */}
        <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="fixed bottom-6 right-6 z-70 w-14 h-14 flex items-center justify-center bg-hero-primary-main hover:bg-hero-primary-hover text-accent2-foreground rounded-full shadow-[0_4px_14px_var(--shadow-color)] transition-all duration-300 sm:hidden"
            aria-label="Toggle Mobile Menu"
        >
            {/* Smooth icon transition rotation */}
            <div className={`transition-transform duration-300 flex items-center justify-center ${isMenuOpen ? 'rotate-90 scale-110' : 'rotate-0'}`}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </div>
        </button>
    </>);
}