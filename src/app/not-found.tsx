"use client";

import Link from "next/link";
import { Home, FileQuestion, ArrowRight } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background text-foreground p-8" dir="rtl">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                
                {/* Glowing Icon Graphic */}
                <div className="flex justify-center">
                    <div className="relative">
                        {/* Glow effect using your highlight color */}
                        <div className="absolute -inset-4 bg-highlight/20 rounded-full blur-xl animate-pulse" />
                        <FileQuestion size={80} className="text-highlight relative z-10" />
                    </div>
                </div>

                {/* Main Error Text */}
                <div className="space-y-3">
                    <h1 className="text-7xl font-bold text-foreground-title drop-shadow-sm font-mono tracking-tight">404</h1>
                    <h2 className="text-2xl font-semibold text-foreground">Segmentation Fault</h2>
                    <p className="text-foreground-remark leading-relaxed text-sm sm:text-base">
                        נראה שהמצביע שניסית לגשת אליו מחזיר <code>NULL</code>.
                        <br />
                        הדף שחיפשת לא נמצא בתיקייה, או שאולי עבר לכתובת זיכרון אחרת.
                    </p>
                </div>

                {/* Decorative Terminal/Code Block */}
                <div className="bg-accent2-background border border-accent2-border rounded-lg p-4 text-left font-mono text-xs sm:text-sm shadow-inner overflow-hidden" dir="ltr">
                    <div className="flex gap-1.5 mb-3 border-b border-accent2-border/50 pb-2">
                        {/* Terminal dots now adapt perfectly to your current theme's palette */}
                        <div className="w-2.5 h-2.5 rounded-full bg-accent-foreground/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-highlight/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-foreground-remark/80" />
                    </div>
                    {/* Error text using your theme's accent color instead of hardcoded red */}
                    <p className="text-accent-foreground mb-1">Error: Directory or file not found.</p>
                    <p className="text-accent2-foreground flex items-center gap-2">
                        <span className="text-highlight">~</span> 
                        {/* Terminal $ using the remark text color */}
                        <span className="text-foreground-remark">$</span> 
                        <span className="typing-animation overflow-hidden whitespace-nowrap border-r-2 border-highlight pr-1">cd /home/uni-folder</span>
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Link 
                        href="/"
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-highlight hover:bg-highlight-icon text-white rounded-xl transition-all shadow-sm hover:shadow-md font-medium"
                    >
                        <Home size={18} />
                        <span>חזור לדף הבית</span>
                    </Link>
                    
                    <button 
                        onClick={() => window.history.back()}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-button-bg hover:bg-button-hover-bg text-button-foreground border border-button-border-light rounded-xl transition-all shadow-sm group font-medium"
                    >
                        {/* Arrow using your really-light-text variable instead of gray-500 */}
                        <ArrowRight size={18} className="text-really-light-text group-hover:-translate-x-1 transition-transform" />
                        <span>חזור אחורה</span>
                    </button>
                </div>
                
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .typing-animation {
                    animation: blink-caret .75s step-end infinite;
                }
                @keyframes blink-caret {
                    from, to { border-color: transparent }
                    50% { border-color: var(--highlight); }
                }
            `}} />
        </div>
    );
}