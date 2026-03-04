'use client';

import { useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import { useTheme } from './ThemeProvider';

declare global {
    interface Window {
        Desmos: any;
    }
}

// 1. Updated to match the exact dark themes from your ThemeMenu
const darkThemes = ['dark', 'theme-night', 'theme-deep-ocean', 'orange'];

export default function DesmosInitializer() {
    const { activeTheme } = useTheme();
    const calculatorsRef = useRef<any[]>([]); 
    
    // 2. We derive the boolean directly from your active React context
    const isDark = darkThemes.includes(activeTheme || "light");

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

        const placeholders = document.querySelectorAll('.desmos-placeholder:not(.initialized)');

        placeholders.forEach((el) => {
            el.classList.add('initialized');
            const eqStr = decodeURIComponent(el.getAttribute('data-equations') || '');
            const configStr = decodeURIComponent(el.getAttribute('data-config') || '');

            // Initialize the Graph dynamically using the current theme state
            const calc = window.Desmos.GraphingCalculator(el, {
                expressions: false,
                settingsMenu: false,
                zoomButtons: false,
                lockViewport: true,
                invertedColors: isDark // Passes the initial true/false
            });

            calculatorsRef.current.push(calc);

            // Set Math Bounds
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

            // Parse and Inject Equations
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
    }, [isDark]);

    // Run on mount in case the script was already loaded
    useEffect(() => {
        initDesmos();
    }, [initDesmos]);

    // 3. THE MAGIC: React directly to your ThemeMenu changing!
    // Because your ThemeProvider automatically updates `activeTheme` when the 
    // OS changes (if set to System), we don't need a matchMedia listener here at all.
    useEffect(() => {
        calculatorsRef.current.forEach(calc => {
            if (calc && typeof calc.updateSettings === 'function') {
                calc.updateSettings({ invertedColors: isDark });
            }
        });
    }, [isDark]); // Re-runs instantly whenever the menu drops down and a user clicks a color

    return (
        <Script
            src="/api/desmos-script"
            strategy="afterInteractive"
            onLoad={initDesmos}
        />
    );
}