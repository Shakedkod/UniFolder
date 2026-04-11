"use client";

import { useEffect } from "react";

export default function SetPageTitle({ title, children }: { title: string; children: React.ReactNode; }) {
    useEffect(() => {
        document.title = `תיקיית הסיכומים לתואר במדעי המחשב | ${title}`;
    }, [title]);

    return (children);
}