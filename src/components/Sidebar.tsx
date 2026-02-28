"use client";

import { TocItem, CalloutItem } from "@/lib/toc";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Link from "next/link";
import { ArrowRight } from "lucide-react";
// import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"; // Bring back if you use them

interface NavigatorContent {
    title: string;
    toc: TocItem[];
    parent: {
        url: string;
        name: string;
    };
}

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

    return (
        <div
            /* The long classes at the end hide the scrollbar natively across Chrome/Firefox/Safari */
            className="w-auto h-auto p-4 lg:p-10 flex flex-col justify-start items-start sticky top-0 max-h-screen overflow-y-auto no-scrollbar"
            dir="rtl"
        >
            {/* BACK BUTTON FOR FILES */}
            <div className=" pb-4">
                <Link
                    href={content.parent.url}
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors text-sm font-medium"
                >
                    <ArrowRight size={16} />
                    <span>חזור לתיקייה: {content.parent.name}</span>
                </Link>
            </div>
            <a href="#" className="w-full">
                <h1 className="hidden lg:flex flex-col text-3xl font-bold text-[#F0F0F3] mb-4">
                    {content.title}
                </h1>
            </a>
            <div className="w-full mb-6 border-b border-gray-800"></div>

            <div className="w-full">
                <ul className="flex flex-col space-y-2">
                    {content.toc?.map((item: TocItem) => {
                        const isSectionActive = activeHeadingId === item.id;

                        const levelStyles = {
                            1: "text-[15px] font-bold text-[#E9E9E9] mb-2 mt-4 first:mt-0 tracking-wide",
                            2: "text-[14px] font-semibold text-[#DDDDDD] mb-1.5",
                            3: "text-[13px] font-medium text-[#DADADA] mb-1",
                            4: "text-[12px] font-medium text-[#C9C9C9] border-r-2 border-[#B34A00]/30 pr-2",
                            5: "text-[12px] font-normal text-[#9E9E9E] border-r-2 border-[#9A3400]/30 pr-3",
                            6: "text-[12px] font-normal text-[#757575] border-r-2 border-[#801E00]/30 pr-4"
                        }[item.level as 1 | 2 | 3 | 4 | 5 | 6] || "text-sm";

                        return (
                            <li key={item.id} className="my-1 flex flex-col" style={{ paddingRight: `${(item.level - 1) * 1.25}rem` }}>
                                {/* 1. The Main Heading Link */}
                                <a
                                    href={`#${item.slug}`}
                                    className={`transition-all duration-200 block py-1 border-r-2 ${isSectionActive
                                        ? "text-orange-500 bg-orange-500/10 font-bold"
                                        : "border-transparent hover:text-white hover:border-gray-600 px-2"
                                        } ${levelStyles}`}
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
                                                    className={`text-sm transition-colors block truncate ${activeId === callout.id ? "text-orange-400 font-bold" : "text-gray-400 hover:text-gray-200"
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
    );
}