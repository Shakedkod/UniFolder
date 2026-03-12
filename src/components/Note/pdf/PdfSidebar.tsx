"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PdfSidebarProps {
    title: string;
    parent: { url: string; name: string };
}

export default function PdfSidebar({ title, parent }: PdfSidebarProps) {
    return (
        <div className="flex w-full h-16 bg-accent2-background border-b border-accent2-border shadow-lg flex-row items-center justify-between px-4 sticky top-0 z-50" dir="rtl">
            <Link href={parent.url} className="p-2 text-accent2-border hover:text-highlight">
                <ArrowRight size={24} />
            </Link>
            <h1 className="text-lg font-bold text-accent2-foreground truncate mx-4">{title}</h1>
            
        </div>
    );
}