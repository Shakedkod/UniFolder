'use client';

import { useEffect, useCallback } from 'react';
import Script from 'next/script'; // <-- Use Next.js native script loader

declare global {
    interface Window {
        Desmos: any;
    }
}

export default function DesmosInitializer() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const originalWarn = console.warn;
        const originalLog = console.log;

        console.warn = (...args) => {
            // Surgical strike on Desmos noise
            if (typeof args[0] === 'string' && args[0].toLowerCase().includes('desmos')) return;
            originalWarn(...args);
        };

        console.log = (...args) => {
            if (typeof args[0] === 'string' && args[0].toLowerCase().includes('desmos')) return;
            originalLog(...args);
        };

        // Cleanup: Restore original loggers if the component unmounts
        return () => {
            console.warn = originalWarn;
            console.log = originalLog;
        };
    }, []);

    // Wrap the initialization logic in a useCallback so it can be safely used in useEffect
    const initDesmos = useCallback(() => {
        if (!window.Desmos) return;

        // Find all our placeholders that haven't been rendered yet
        const placeholders = document.querySelectorAll('.desmos-placeholder:not(.initialized)');

        placeholders.forEach((el) => {
            el.classList.add('initialized');
            const eqStr = decodeURIComponent(el.getAttribute('data-equations') || '');
            const configStr = decodeURIComponent(el.getAttribute('data-config') || '');

            // 1. Initialize the Graph
            const calc = window.Desmos.GraphingCalculator(el, {
                expressions: false,
                settingsMenu: false,
                zoomButtons: false,
                lockViewport: true,
                invertedColors: true
            });

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
    }, []);

    // Also run on mount in case the script was already loaded on a previous page
    useEffect(() => {
        initDesmos();
    }, [initDesmos]);

    return (
        // The Next.js Script component automatically handles CORS, caching, and execution safely!
        <Script
            src="/api/desmos-script"
            strategy="afterInteractive"
            onLoad={initDesmos}
        />
    );
}