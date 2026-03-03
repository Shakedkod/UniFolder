"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme, Theme, ThemePreference } from "./ThemeProvider";
import { Palette, Monitor, Check, ChevronUp, ChevronDown } from "lucide-react";

const THEMES: { id: Theme, name: string }[] = [
    { id: "light", name: "Light (Default)" },
    { id: "github-light", name: "GitHub Light" },
    { id: "warm-light", name: "Warm Light" },
    { id: "dark", name: "Dark" },
    { id: "night", name: "Night (Purple)" },
    { id: "deep-ocean", name: "Deep Ocean" },
];

export default function ThemeMenu() {
    const { preference, setPreference, systemLight, setSystemLight, systemDark, setSystemDark, activeTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [openDirection, setOpenDirection] = useState<'up' | 'down'>('up');
    
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close the menu if the user clicks anywhere outside of it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggleMenu = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // If the button is in the top 50% of the screen, open downwards
            if (rect.top < windowHeight / 2) {
                setOpenDirection('down');
            } else {
                setOpenDirection('up');
            }
        }
        setIsOpen(!isOpen);
    };

    // Helper component to render the beautiful dynamic color swatches
    const ThemeOption = ({ themeId, active, onClick, label }: { themeId: Theme, active: boolean, onClick: () => void, label: string }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
                active ? "bg-really-light-accent-bg border border-really-light-accent-border" : "border border-transparent hover:bg-really-light-accent-bg"
            }`}
        >
            <div className="flex items-center gap-3">
                {/* CHANGE: Switched border from hardcoded border-accent2-border to 
                    a generic opacity-based gray (border-foreground/20) for 
                    better visibility across different theme backgrounds.
                */}
                <div className={`w-5 h-5 rounded-full flex overflow-hidden border border-foreground/20 shadow-sm ${themeId}`}>
                    <div className="w-1/2 h-full bg-background" />
                    {/* CHANGE: Left is background, right is main foreground text color. 
                        Using bg-foreground instead of bg-highlight gives a much more
                        accurate representation of the overall theme feel.
                    */}
                    <div className="w-1/2 h-full bg-foreground" />
                </div>
                <span className={`text-sm ${active ? "text-highlight font-medium" : "text-really-light-text"}`}>{label}</span>
            </div>
            {active && <Check size={16} className="text-highlight" />}
        </button>
    );

    return (
        <div className="relative w-full" ref={menuRef} dir="rtl">
            
            {/* 1. THE TRIGGER BUTTON */}
            <button 
                ref={buttonRef}
                onClick={handleToggleMenu}
                // CHANGE: Increased z-index from 60 to 110 here to match the popup logic
                // we used to solve mobile drawer clipping issues.
                className={`flex items-center justify-between w-full p-3 rounded-xl border transition-all relative z-[110] ${
                    isOpen ? "bg-button-bg border-button-border-light text-foreground" : "bg-transparent border-transparent hover:bg-really-light-accent-bg text-really-light-text hover:text-foreground"
                }`}
            >
                <div className="flex items-center gap-3 font-medium">
                    <Palette size={18} className={isOpen ? "text-highlight" : ""} />
                    <span>ערכת נושא</span>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Live Preview on the Button */}
                    {/* CHANGE: Swatch representation updated to background/foreground */}
                    <div className={`w-4 h-4 rounded-full flex overflow-hidden border border-foreground/20 ${activeTheme || "light"}`}>
                        <div className="w-1/2 h-full bg-background" />
                        <div className="w-1/2 h-full bg-foreground" />
                    </div>
                    {/* Dynamic Chevron Arrow */}
                    {openDirection === 'down' ? (
                        <ChevronDown size={16} className={`transition-transform duration-300 text-really-light-text ${isOpen ? "rotate-180" : "rotate-0"}`} />
                    ) : (
                        <ChevronUp size={16} className={`transition-transform duration-300 text-really-light-text ${isOpen ? "rotate-180" : "rotate-0"}`} />
                    )}
                </div>
            </button>

            {/* CHANGE: Added a transparent "fixed inset-0" overlay backdrop with high z-index (z-[100]).
                This guarantees the click-outside-to-close logic works instantly, even if the menu 
                is rendered inside a complex, layered parent component (like a mobile drawer).
            */}
            {isOpen && (
                 <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
            )}

            {/* 2. THE SMART POSITIONED POPUP */}
            {isOpen && (
                <div 
                    className={`absolute right-0 w-full min-w-60 bg-background border border-accent2-border shadow-[0_10px_40px_var(--shadow-color)] rounded-xl p-3 z-[110] flex flex-col gap-3 animate-in fade-in duration-200 ${
                        openDirection === 'up' 
                            ? 'bottom-[calc(100%+0.5rem)] slide-in-from-bottom-2' 
                            : 'top-[calc(100%+0.5rem)] slide-in-from-top-2'
                    }`}>
                    
                    {/* Top Switch: System Auto vs Manual */}
                    <button 
                        onClick={() => setPreference(preference === "system" ? (activeTheme || "light") : "system")}
                        className="flex items-center justify-between p-3 rounded-xl bg-button-bg hover:bg-button-hover-bg transition-colors border border-button-border-light"
                    >
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Monitor size={16} className="text-really-light-text" />
                            <span>אוטומטי (לפי מערכת)</span>
                        </div>
                        {/* iOS-style toggle switch */}
                        <div className={`w-9 h-5 rounded-full flex items-center p-1 transition-colors ${preference === "system" ? "bg-highlight" : "bg-foreground-remark"}`}>
                            <div className={`w-3.5 h-3.5 rounded-full bg-background shadow-sm transition-transform duration-300 ${preference === "system" ? "-translate-x-3.5" : "translate-x-0"}`} />
                        </div>
                    </button>

                    <div className="w-full h-px bg-button-border-light" />

                    {/* Scrollable list of themes */}
                    <div className="max-h-[35vh] overflow-y-auto no-scrollbar flex flex-col gap-4 pr-1">
                        {preference === "system" ? (
                            <>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold text-foreground-remark mb-1 px-1 tracking-wider uppercase">עיצוב יום (Light)</span>
                                    {THEMES.map(t => (
                                        <ThemeOption key={`light-${t.id}`} themeId={t.id} active={systemLight === t.id} onClick={() => setSystemLight(t.id)} label={t.name} />
                                    ))}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold text-foreground-remark mb-1 px-1 tracking-wider uppercase">עיצוב לילה (Dark)</span>
                                    {THEMES.map(t => (
                                        <ThemeOption key={`dark-${t.id}`} themeId={t.id} active={systemDark === t.id} onClick={() => setSystemDark(t.id)} label={t.name} />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-foreground-remark mb-1 px-1 tracking-wider uppercase">בחר עיצוב</span>
                                {THEMES.map(t => (
                                    <ThemeOption key={`manual-${t.id}`} themeId={t.id} active={preference === t.id} onClick={() => setPreference(t.id)} label={t.name} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}