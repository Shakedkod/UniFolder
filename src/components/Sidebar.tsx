"use client";

import { TocItem, CalloutItem } from "@/lib/toc";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SearchBar } from "./Home";
import BackButton from "./NoteComponents/BackButton";
// import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"; // Bring back if you use them

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

export default function Sidebar({ content }: { content: NavigatorContent }) {
    // Tracks the exact ID of whatever is currently on screen
    const [activeId, setActiveId] = useState<string>("");

    useEffect(() => {
        const headingIds = content.toc?.map((item) => item.id) || [];
        const calloutIds = content.toc?.flatMap(item => item.callouts.map(c => c.id)) || [];
        const allIds = [...headingIds, ...calloutIds];

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

        allIds.forEach((id) => {
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

    return (<>
        {/* ---------------------- DESKTOP SIDEBAR ---------------------- */}
        <div
            className="hidden xl:flex min-w-sm h-screen p-4 lg:p-10 flex-col justify-start items-start sticky top-0 max-h-screen overflow-y-auto no-scrollbar bg-accent2-background border-l border-accent2-border shadow-lg"
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
                <ul className="flex flex-col space-y-2">
                    {content.toc?.map((item: TocItem) => {
                        const isSectionActive = activeHeadingId === item.id;

                        return (
                            <li key={item.id} className="my-1 flex flex-col" style={{ paddingRight: `${(item.level - 1) * 1.25}rem` }}>
                                {/* 1. The Main Heading Link */}
                                <a
                                    href={`#${item.slug}`}
                                    className={`transition-all duration-200 block py-1 border-r-2 ${isSectionActive
                                        ? "text-orange-500 bg-orange-500/10 font-bold"
                                        : "border-transparent hover:text-accent2-foreground hover:border-gray-600 px-2"
                                        } ${levelStyles[item.level] || "text-sm"}`}
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            // Prevent ReactMarkdown from wrapping titles in <p> tags
                                            p: ({ node, ...props }) => <span {...props} />
                                        }}
                                    >
                                        {item.title}
                                    </ReactMarkdown>
                                </a>

                                {/* 2. The Collapsible Definitions List */}
                                {/* Only renders if this section is currently active on screen */}
                                {isSectionActive && item.callouts && item.callouts.length > 0 && (
                                    <ul className="flex flex-col mt-2 pr-4 space-y-2 border-r-2 border-gray-700 mr-2">
                                        {item.callouts.map((callout: CalloutItem) => (
                                            <li key={callout.id}>
                                                <a
                                                    href={`#${callout.id}`}
                                                    className={`text-sm transition-colors block truncate ${activeId === callout.id ? "text-orange-400 font-bold" : "text-foreground hover:text-accent2-foreground"
                                                        }`}
                                                    title={callout.title}
                                                >
                                                    {callout.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
                <div className="w-full h-[1px] bg-gray-500 my-4" />
            </div>
        </div>

        {/* ---------------------- TABLET TOPBAR ---------------------- */}
        <div className="hidden sm:flex xl:hidden w-full h-16 bg-[#000000] border-b border-gray-800/50 shadow-lg items-center justify-start px-4" dir="rtl">

        </div>
        {/* ---------------------- PHONE MENU ---------------------- */}
    </>);
}