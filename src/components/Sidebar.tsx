"use client";

import { useEffect, useState } from "react";
// import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"; // Bring back if you use them

interface CalloutItem {
    id: string;
    title: string;
    type: string;
}

interface TOCItem {
    id: string;
    title: string;
    level: number;
    callouts: CalloutItem[];
}

interface NavigatorContent {
    title: string;
    toc: TOCItem[];
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
            className="w-auto h-auto p-4 lg:p-10 flex flex-col justify-start items-start sticky top-0 max-h-screen overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            dir="rtl"
        >
            <a href="/toc">
                <h1 className="hidden lg:flex flex-col text-3xl font-bold text-[#F0F0F3] mb-4">
                    {content.title}
                </h1>
            </a>
            <div className="w-full mb-4"></div>

            <div className="w-full">
                <ul className="flex flex-col space-y-2">
                    {content.toc?.map((item: TOCItem) => {
                        const isSectionActive = activeHeadingId === item.id;

                        return (
                            <li key={item.id} className="my-1 flex flex-col">
                                {/* 1. The Main Heading Link */}
                                <a
                                    href={`#${item.id}`}
                                    className={`transition-colors font-medium ${isSectionActive ? "text-blue-400" : "text-gray-300 hover:text-white"
                                        }`}
                                >
                                    {item.title}
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