"use client";

import { BookOpen, Folder, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Hero() {
    const [isOpen, setIsOpen] = useState(false);

    // Allow closing the modal with the Escape key for a native app feel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Prevent background scrolling when the modal is open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    return (
        <section className="relative w-full overflow-hidden bg-hero-background pt-20 pb-16 sm:pt-32 sm:pb-24" dir="rtl">
            {/* Subtle Graph-Paper Background Pattern */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--hero-grid-pattern)_1px,transparent_1px)] bg-size-[24px_24px] opacity-40"></div>

            <div className="max-w-5xl mx-auto px-8 text-center flex flex-col items-center relative z-10">

                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-hero-background text-hero-primary-hover text-sm font-semibold mb-8 border border-hero-primary-border shadow-sm">
                    <Sparkles size={16} />
                    <span>מתעדכן שוטף</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-5xl md:text-7xl font-extrabold text-hero-heading tracking-tight mb-6 leading-tight">
                    תיקיית הרשימות והסיכומים <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-linear-to-l from-hero-primary-main to-hero-accent-main">
                        לתואר במדעי המחשב
                    </span>
                </h1>

                {/* Subheadline */}
                <p className="text-lg md:text-xl text-hero-body mb-10 max-w-2xl mx-auto leading-relaxed">
                    מאגר סיכומים, הוכחות, תרגילים וקוד.
                    <br />
                    הכל מסודר ומוכן כדי לעשות קצת סדר בבלאגן של התואר.
                </p>

                {/* Single Action Button scrolling to your section */}
                <button
                    onClick={() => setIsOpen(true)}
                    className="inline-flex items-center justify-center gap-2 bg-hero-primary-main hover:bg-hero-primary-hover text-background px-8 py-4 rounded-xl font-medium transition-all shadow-md hover:shadow-lg group"
                >
                    <BookOpen size={20} className="group-hover:-translate-y-0.5 transition-transform" />
                    <span>בחר שנת לימוד</span>
                </button>
            </div>

            {/* --- The Modal Overlay Box --- */}
            {isOpen && (
                <div
                    // This creates the dark, blurred backdrop over the whole screen
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)} // Clicking the backdrop closes it
                    dir="rtl"
                >
                    {/* The actual centered box */}
                    <div
                        // stopPropagation prevents clicks inside the box from closing it
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-semibold text-slate-800 text-lg">בחר תיקייה לניווט</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Options */}
                        <div className="p-3 flex flex-col gap-2">
                            <Link
                                href="/2025"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group"
                            >
                                <Folder className="text-orange-400 group-hover:text-orange-500" size={24} />
                                <div className="flex flex-col text-right">
                                    <span className="text-slate-800 font-semibold group-hover:text-slate-900">שנה א'</span>
                                    <span className="text-slate-500 text-sm">קורסי בסיס, אינפי, אלגברה ופיזיקה</span>
                                </div>
                            </Link>

                            <Link
                                href="/2026"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group"
                            >
                                <Folder className="text-orange-400 group-hover:text-orange-500" size={24} />
                                <div className="flex flex-col text-right">
                                    <span className="text-slate-800 font-semibold group-hover:text-slate-900">שנה ב'</span>
                                    <span className="text-slate-500 text-sm">ב-2027{/*TODO: In the next year, add this*/}</span>
                                </div>
                            </Link>

                            <Link
                                href="/2027"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group"
                            >
                                <Folder className="text-orange-400 group-hover:text-orange-500" size={24} />
                                <div className="flex flex-col text-right">
                                    <span className="text-slate-800 font-semibold group-hover:text-slate-900">שנה ג'</span>
                                    <span className="text-slate-500 text-sm">ב-2028{/*TODO: In the next next year, add this*/}</span>
                                </div>
                            </Link>
                            {/* --- The Modal Disclaimer --- */}
                            <div className="bg-slate-50 border-t border-slate-100 p-4 mt-2">
                                <p className="text-xs text-slate-500 leading-relaxed text-right flex items-start gap-2">
                                    <span className="mt-0.5">⚠️</span>
                                    <span>
                                        <strong>שימו לב:</strong> הסיכומים והפתרונות (במיוחד במטלות ושיעורי הבית) נכתבו על ידי סטודנט במהלך התואר ועלולים להכיל טעויות חישוב או הבנה. 
                                        <br />
                                        קחו הכל בערבון מוגבל!
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* This gradient fades from the hero into the gray background of your search section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-hero-section-background to-transparent"></div>
        </section>
    );
}