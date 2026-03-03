"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// 1. Define the available themes and preferences
export type Theme = "light" | "github-light" | "warm-light" | "night" | "deep-ocean" | "dark";
export type ThemePreference = "system" | Theme;

interface ThemeContextType {
    preference: ThemePreference;
    setPreference: (pref: ThemePreference) => void;
    systemLight: Theme;
    setSystemLight: (theme: Theme) => void;
    systemDark: Theme;
    setSystemDark: (theme: Theme) => void;
    activeTheme: Theme | null; // The actual theme applied to the HTML tag
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [preference, setPreference] = useState<ThemePreference>("system");
    const [systemLight, setSystemLight] = useState<Theme>("light");
    const [systemDark, setSystemDark] = useState<Theme>("dark");
    const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
    const [mounted, setMounted] = useState(false);

    // 2. Load all preferences from localStorage on mount
    useEffect(() => {
        const savedPref = localStorage.getItem("theme-pref") as ThemePreference;
        const savedLight = localStorage.getItem("theme-sys-light") as Theme;
        const savedDark = localStorage.getItem("theme-sys-dark") as Theme;

        if (savedPref) setPreference(savedPref);
        if (savedLight) setSystemLight(savedLight);
        if (savedDark) setSystemDark(savedDark);
        
        setMounted(true);
    }, []);

    // 3. Resolve and apply the theme whenever preferences change
    useEffect(() => {
        if (!mounted) return;

        const resolveTheme = (): Theme => {
            if (preference !== "system") return preference;
            // If "system" is chosen, check the browser's media query
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            return isDark ? systemDark : systemLight;
        };

        const resolved = resolveTheme();
        setActiveTheme(resolved);

        // Apply to the <html> tag
        const root = document.documentElement;
        const allThemes = ["light", "github-light", "warm-light", "night", "deep-ocean", "dark"];
        root.classList.remove(...allThemes);
        root.classList.add(resolved);

        // Save to localStorage
        localStorage.setItem("theme-pref", preference);
        localStorage.setItem("theme-sys-light", systemLight);
        localStorage.setItem("theme-sys-dark", systemDark);

    }, [preference, systemLight, systemDark, mounted]);

    // 4. Live listener for when the OS changes from day to night
    useEffect(() => {
        if (preference !== "system" || !mounted) return;
        
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
            const resolved = e.matches ? systemDark : systemLight;
            setActiveTheme(resolved);
            
            const root = document.documentElement;
            const allThemes = ["light", "github-light", "warm-light", "night", "deep-ocean", "dark"];
            root.classList.remove(...allThemes);
            root.classList.add(resolved);
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [preference, systemLight, systemDark, mounted]);

    if (!mounted) return <>{children}</>;

    return (
        <ThemeContext.Provider value={{ preference, setPreference, systemLight, setSystemLight, systemDark, setSystemDark, activeTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
    return context;
}