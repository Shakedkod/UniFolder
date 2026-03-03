'use client';

import { useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';

declare global {
    interface Window {
        Desmos: any;
    }
}

export default function DesmosInitializer() {
    // Keep track of all active calculators so we can update them if the theme changes
    const calculatorsRef = useRef<any[]>([]);

    const checkIsDarkTheme = useCallback(() => {
        if (typeof window === 'undefined') return false;
        
        const bodyClass = document.body.className;
        
        // Add all your dark-variant theme classes here!
        const darkThemes = ['dark', 'theme-midnight', 'theme-dracula', 'theme-ocean'];
        
        // Returns true if the body has any of the dark themes
        return darkThemes.some(theme => bodyClass.includes(theme));
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const originalWarn = console.warn;
        const originalLog = console.log;

        console.warn = (...args) => {
            if (typeof args[0] === 'string' && args[0].toLowerCase().includes('desmos')) return;
            originalWarn(...args);
        };

        console.log = (...args) => {
            if (typeof args[0] === 'string' && args[0].toLowerCase().includes('desmos')) return;
            originalLog(...args);
        };

        return () => {
            console.warn = originalWarn;
            console.log = originalLog;
        };
    }, []);

    const initDesmos = useCallback(() => {
        if (!window.Desmos) return;

        // Check the current system/browser theme
        const isDarkTheme = checkIsDarkTheme();
        const placeholders = document.querySelectorAll('.desmos-placeholder:not(.initialized)');

        placeholders.forEach((el) => {
            el.classList.add('initialized');
            const eqStr = decodeURIComponent(el.getAttribute('data-equations') || '');
            const configStr = decodeURIComponent(el.getAttribute('data-config') || '');

            // 1. Initialize the Graph dynamically
            const calc = window.Desmos.GraphingCalculator(el, {
                expressions: false,
                settingsMenu: false,
                zoomButtons: false,
                lockViewport: true,
                invertedColors: isDarkTheme // Matches your current theme!
            });

            // Store the calculator instance so we can update it later
            calculatorsRef.current.push(calc);

            // 2. Set Math Bounds (left, right, bottom, top)
            let mathBounds: any = {};
            const leftMatch = configStr.match(/left=(-?[\d.]+)/);
            if (leftMatch) mathBounds.left = parseFloat(leftMatch[1]);
            const rightMatch = configStr.match(/right=(-?[\d.]+)/);
            if (rightMatch) mathBounds.right = parseFloat(rightMatch[1]);
            const bottomMatch = configStr.match(/bottom=(-?[\d.]+)/);
            if (bottomMatch) mathBounds.bottom = parseFloat(bottomMatch[1]);
            const topMatch = configStr.match(/top=(-?[\d.]+)/);
            if (topMatch) mathBounds.top = parseFloat(topMatch[1]);

            if (Object.keys(mathBounds).length > 0) {
                calc.setMathBounds(mathBounds);
            }

            // 3. Parse and Inject Equations
            const equations = eqStr.split('\n').map(e => e.trim()).filter(e => e);
            equations.forEach((eq, idx) => {
                let latex = eq;
                let color = window.Desmos.Colors.BLUE;
                let style = window.Desmos.Styles.SOLID;

                const parts = eq.split('|');
                if (parts.length > 1) {
                    latex = parts[0];
                    for (let i = 1; i < parts.length; i++) {
                        const p = parts[i].trim().toUpperCase();
                        if (p === 'DASHED') style = window.Desmos.Styles.DASHED;
                        else if (p === 'RED') color = window.Desmos.Colors.RED;
                        else if (p === 'BLUE') color = window.Desmos.Colors.BLUE;
                        else if (p === 'GREEN') color = window.Desmos.Colors.GREEN;
                        else if (p === 'ORANGE') color = window.Desmos.Colors.ORANGE;
                        else if (p === 'BLACK') color = window.Desmos.Colors.BLACK;
                        else {
                            latex += ` \\{${parts[i].trim()}\\}`;
                        }
                    }
                }
                calc.setExpression({ id: 'eq' + idx, latex: latex, color: color, lineStyle: style });
            });
        });
    }, [checkIsDarkTheme]);

    // Also run on mount in case the script was already loaded
    useEffect(() => {
        initDesmos();
    }, [initDesmos]);

    // --- NEW: Listen for theme changes in real-time ---
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleThemeChange = (e: MediaQueryListEvent) => {
            const isDarkNow = e.matches;
            // Instantly flip all active graphs to the new theme
            calculatorsRef.current.forEach(calc => {
                if (calc && typeof calc.updateSettings === 'function') {
                    calc.updateSettings({ invertedColors: isDarkNow });
                }
            });
        };

        mediaQuery.addEventListener('change', handleThemeChange);
        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, []);

    return (
        <Script
            src="/api/desmos-script"
            strategy="afterInteractive"
            onLoad={initDesmos}
        />
    );
}