"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ZoomIn,
    ZoomOut,
    Maximize,
    Minimize,
    RotateCw,
    Download,
    Printer,
    Search,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    ChevronLeft,
    PanelLeft,
    Bookmark,
    LayoutGrid,
    X,
    Loader2,
    FileText,
    StretchHorizontal,
    ExternalLink,
    Layers,
} from 'lucide-react';
import { ThemeMenuCircleButton } from '@/components/ThemeMenu';

interface OutlineItem {
    title: string;
    dest: string | any[];
    items: OutlineItem[];
}

interface PdfViewerProps {
    pdfUrl: string;
    fileName: string;
    parent: { url: string; name: string };
}

export default function PdfViewer({ pdfUrl, fileName, parent }: PdfViewerProps) {
    const [viewMode, setViewMode] = useState<'viewer' | 'native'>('native');
    const [pdfjsLib, setPdfjsLib] = useState<any>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageInputValue, setPageInputValue] = useState<string>("1");
    const [scale, setScale] = useState<number>(1.2);
    const [rotation, setRotation] = useState<number>(0);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const [sidebarTab, setSidebarTab] = useState<'outline' | 'thumbnails'>('outline');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Read viewMode preference from localStorage (defaults to 'native' for 100% accurate Hebrew typography)
    useEffect(() => {
        try {
            const saved = localStorage.getItem('uni_pdf_view_mode_v3');
            if (saved === 'native' || saved === 'viewer') {
                setViewMode(saved);
            }
        } catch {}
    }, []);

    const toggleViewMode = () => {
        setViewMode((prev) => {
            const next = prev === 'viewer' ? 'native' : 'viewer';
            try {
                localStorage.setItem('uni_pdf_view_mode_v3', next);
            } catch {}
            return next;
        });
    };

    // Search state
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchMatches, setSearchMatches] = useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // 1. Load pdfjs-dist dynamically on client side
    useEffect(() => {
        let isMounted = true;

        async function initPdfJs() {
            try {
                const lib = await import('pdfjs-dist');
                if (!isMounted) return;

                // Point to our local public worker
                lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
                setPdfjsLib(lib);
            } catch (err: any) {
                console.error('[PdfViewer] Failed to load pdfjs-dist:', err);
                if (isMounted) setLoadError('Failed to initialize PDF engine');
            }
        }

        initPdfJs();
        return () => { isMounted = false; };
    }, []);

    // 2. Load the PDF document
    useEffect(() => {
        if (!pdfjsLib || !pdfUrl) return;

        let isMounted = true;
        setIsLoading(true);
        setLoadError(null);

        const loadingTask = pdfjsLib.getDocument({
            url: pdfUrl,
            cMapUrl: '/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/standard_fonts/',
            disableFontFace: false,
            useSystemFonts: true,
            enableXfa: false,
        });

        loadingTask.promise.then(async (doc: any) => {
            if (!isMounted) return;
            setPdfDoc(doc);
            setNumPages(doc.numPages);
            setCurrentPage(1);
            setPageInputValue("1");

            // Extract document outline (Table of Contents)
            try {
                const docOutline = await doc.getOutline();
                if (isMounted && docOutline && docOutline.length > 0) {
                    setOutline(docOutline);
                    // If document has outline, default sidebar tab to outline
                    setSidebarTab('outline');
                } else {
                    setSidebarTab('thumbnails');
                }
            } catch (outlineErr) {
                console.warn('[PdfViewer] Could not parse outline:', outlineErr);
            }

            setIsLoading(false);
        }).catch((err: any) => {
            console.error('[PdfViewer] Error loading document:', err);
            if (isMounted) {
                setLoadError(err.message || 'Error loading PDF file');
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
            loadingTask.destroy?.();
        };
    }, [pdfjsLib, pdfUrl]);

    // 3. Scroll to specific page
    const scrollToPage = useCallback((pageNum: number) => {
        if (pageNum < 1 || (numPages > 0 && pageNum > numPages)) return;
        setCurrentPage(pageNum);
        setPageInputValue(String(pageNum));

        if (viewMode === 'native') {
            const iframe = iframeRef.current;
            if (iframe) {
                iframe.src = `${pdfUrl}#page=${pageNum}&toolbar=0&navpanes=0&view=FitH`;
            }
        } else {
            const pageEl = pageRefs.current.get(pageNum);
            if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [numPages, viewMode, pdfUrl]);

    // 4. Resolve destination and jump (for outline TOC items)
    const handleOutlineClick = async (dest: string | any[]) => {
        if (!pdfDoc) return;
        try {
            let explicitDest = dest;
            if (typeof dest === 'string') {
                explicitDest = await pdfDoc.getDestination(dest);
            }
            if (Array.isArray(explicitDest) && explicitDest[0]) {
                const pageIndex = await pdfDoc.getPageIndex(explicitDest[0]);
                scrollToPage(pageIndex + 1);
            }
        } catch (err) {
            console.warn('[PdfViewer] Failed to navigate to destination:', err);
        }
    };

    // 5. Track current page while scrolling using IntersectionObserver
    useEffect(() => {
        const scrollEl = scrollContainerRef.current;
        if (!scrollEl || numPages === 0 || viewMode !== 'viewer') return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting);
                if (visible.length > 0) {
                    // Pick the page with the largest intersection ratio
                    visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                    const pageNum = Number(visible[0].target.getAttribute('data-page-number'));
                    if (pageNum) {
                        setCurrentPage(pageNum);
                        setPageInputValue(String(pageNum));
                    }
                }
            },
            {
                root: scrollEl,
                threshold: [0.1, 0.5, 0.9],
            }
        );

        pageRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [numPages, isLoading, viewMode]);

    // 6. Zoom controls
    const zoomIn = () => {
        const nextScale = Math.min(3.0, Number((scale + 0.2).toFixed(1)));
        setScale(nextScale);
        if (viewMode === 'native' && iframeRef.current) {
            iframeRef.current.src = `${pdfUrl}#page=${currentPage}&zoom=${Math.round(nextScale * 100)}&toolbar=0&navpanes=0`;
        }
    };

    const zoomOut = () => {
        const nextScale = Math.max(0.5, Number((scale - 0.2).toFixed(1)));
        setScale(nextScale);
        if (viewMode === 'native' && iframeRef.current) {
            iframeRef.current.src = `${pdfUrl}#page=${currentPage}&zoom=${Math.round(nextScale * 100)}&toolbar=0&navpanes=0`;
        }
    };

    const resetZoom = () => {
        setScale(1.0);
        if (viewMode === 'native' && iframeRef.current) {
            iframeRef.current.src = `${pdfUrl}#page=${currentPage}&zoom=100&toolbar=0&navpanes=0`;
        }
    };

    const fitToWidth = useCallback(() => {
        if (viewMode === 'native' && iframeRef.current) {
            iframeRef.current.src = `${pdfUrl}#page=${currentPage}&view=FitH&toolbar=0&navpanes=0`;
        } else if (scrollContainerRef.current && pdfDoc) {
            pdfDoc.getPage(1).then((page: any) => {
                const viewport = page.getViewport({ scale: 1 });
                const containerWidth = scrollContainerRef.current?.clientWidth || 800;
                const targetScale = (containerWidth - 64) / viewport.width;
                setScale(Math.max(0.5, Math.min(2.5, Number(targetScale.toFixed(2)))));
            });
        }
    }, [viewMode, pdfUrl, currentPage, pdfDoc]);

    const rotateClockwise = () => setRotation((r) => (r + 90) % 360);

    // 7. Fullscreen toggle
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    // 8. Search in document
    const handleSearch = async () => {
        if (!pdfDoc || !searchQuery.trim()) return;
        setIsSearching(true);
        const query = searchQuery.toLowerCase().trim();
        const matches: number[] = [];

        for (let i = 1; i <= numPages; i++) {
            try {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();
                if (text.includes(query)) {
                    matches.push(i);
                }
            } catch {}
        }

        setSearchMatches(matches);
        setCurrentMatchIndex(0);
        setIsSearching(false);

        if (matches.length > 0) {
            scrollToPage(matches[0]);
        }
    };

    const nextMatch = () => {
        if (searchMatches.length === 0) return;
        const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
        setCurrentMatchIndex(nextIdx);
        scrollToPage(searchMatches[nextIdx]);
    };

    const prevMatch = () => {
        if (searchMatches.length === 0) return;
        const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        setCurrentMatchIndex(prevIdx);
        scrollToPage(searchMatches[prevIdx]);
    };

    // 9. Download & Print
    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `${fileName.replace(/\.pdf$/i, '')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handlePrint = () => {
        // 1. If native iframe is present, invoke print on the PDF document directly
        const frame = iframeRef.current;
        if (frame?.contentWindow) {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
                return;
            } catch {}
        }

        // 2. Dedicated hidden print iframe to ensure ONLY the PDF is printed (never the webpage UI)
        let printFrame = document.getElementById('pdf-hidden-print-frame') as HTMLIFrameElement;
        if (!printFrame) {
            printFrame = document.createElement('iframe');
            printFrame.id = 'pdf-hidden-print-frame';
            printFrame.style.position = 'fixed';
            printFrame.style.top = '-10000px';
            printFrame.style.left = '-10000px';
            printFrame.style.width = '1px';
            printFrame.style.height = '1px';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);
        }

        printFrame.src = pdfUrl;
        printFrame.onload = () => {
            try {
                printFrame.contentWindow?.focus();
                printFrame.contentWindow?.print();
            } catch {
                window.open(pdfUrl, '_blank');
            }
        };
    };

    // 10. Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;

            if (e.key === 'ArrowRight' || e.key === 'PageUp') {
                e.preventDefault();
                scrollToPage(currentPage - 1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageDown') {
                e.preventDefault();
                scrollToPage(currentPage + 1);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                handlePrint();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setIsSearchOpen(true);
            } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                zoomIn();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                zoomOut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                resetZoom();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, scrollToPage]);

    // 11. Pinch-to-zoom on touchscreen & Trackpad pinch / Ctrl + Mouse Wheel
    const lastPinchDistRef = useRef<number | null>(null);
    const initialPinchScaleRef = useRef<number>(1.2);
    const updateIframeZoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Debounced iframe zoom update
        const applyIframeZoom = (targetScale: number) => {
            if (viewMode !== 'native' || !iframeRef.current) return;
            if (updateIframeZoomTimeoutRef.current) {
                clearTimeout(updateIframeZoomTimeoutRef.current);
            }
            updateIframeZoomTimeoutRef.current = setTimeout(() => {
                if (iframeRef.current) {
                    iframeRef.current.src = `${pdfUrl}#page=${currentPage}&zoom=${Math.round(targetScale * 100)}&toolbar=0&navpanes=0`;
                }
            }, 80);
        };

        // Trackpad pinch gesture & Ctrl + scroll wheel
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
                setScale((prev) => {
                    const next = Math.min(3.0, Math.max(0.5, Number((prev * zoomFactor).toFixed(2))));
                    applyIframeZoom(next);
                    return next;
                });
            }
        };

        // Touchscreen two-finger pinch
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                lastPinchDistRef.current = dist;
                initialPinchScaleRef.current = scale;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const factor = dist / lastPinchDistRef.current;
                const next = Math.min(3.0, Math.max(0.5, Number((initialPinchScaleRef.current * factor).toFixed(2))));
                setScale(next);
                applyIframeZoom(next);
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                lastPinchDistRef.current = null;
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            if (updateIframeZoomTimeoutRef.current) {
                clearTimeout(updateIframeZoomTimeoutRef.current);
            }
        };
    }, [scale, viewMode, currentPage, pdfUrl]);

    return (
        <div
            ref={containerRef}
            className="flex flex-col w-full h-screen bg-background text-foreground overflow-hidden select-none"
            dir="rtl"
        >
            {/* ======================================================== */}
            {/* TOP TOOLBAR                                              */}
            {/* ======================================================== */}
            <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-accent2-background/90 backdrop-blur-md border-b border-accent2-border shadow-xs z-30 shrink-0 gap-2">
                {/* Right cluster: Back link, Title, Sidebar Toggle */}
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href={parent.url}
                        className="p-1.5 rounded-lg text-accent2-foreground/80 hover:text-highlight hover:bg-white/10 transition-colors shrink-0"
                        title={`חזרה אל ${parent.name}`}
                    >
                        <ArrowRight size={20} />
                    </Link>

                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen((v) => !v)}
                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                            isSidebarOpen
                                ? 'bg-highlight/20 text-highlight'
                                : 'text-accent2-foreground/80 hover:text-foreground hover:bg-white/10'
                        }`}
                        title={isSidebarOpen ? "סגור סרגל צד" : "פתח תוכן עניינים ותמונות ממוזערות"}
                    >
                        <PanelLeft size={18} />
                    </button>

                    <h1 className="text-sm sm:text-base font-bold text-accent2-foreground truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                        {fileName}
                    </h1>
                </div>

                {/* Center cluster: Page Navigation & Zoom (Active in both modes) */}
                <div className="flex items-center gap-1 sm:gap-2">
                    {/* Page navigation */}
                    <div className="flex items-center gap-1 bg-background/50 border border-button-border-light rounded-lg px-2 py-1 text-xs">
                        <button
                            type="button"
                            onClick={() => scrollToPage(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="p-0.5 rounded text-accent2-foreground/70 hover:text-foreground disabled:opacity-30 disabled:hover:text-accent2-foreground/70"
                            title="עמוד קודם"
                        >
                            <ChevronUp size={15} />
                        </button>

                        <input
                            type="text"
                            value={pageInputValue}
                            onChange={(e) => setPageInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const pageNum = parseInt(pageInputValue, 10);
                                    if (!isNaN(pageNum)) scrollToPage(pageNum);
                                }
                            }}
                            className="w-8 text-center bg-transparent border-b border-transparent focus:border-highlight outline-none font-semibold text-foreground text-xs"
                        />
                        <span className="text-really-light-text font-mono">/ {numPages || '–'}</span>

                        <button
                            type="button"
                            onClick={() => scrollToPage(currentPage + 1)}
                            disabled={currentPage >= numPages}
                            className="p-0.5 rounded text-accent2-foreground/70 hover:text-foreground disabled:opacity-30 disabled:hover:text-accent2-foreground/70"
                            title="עמוד הבא"
                        >
                            <ChevronDown size={15} />
                        </button>
                    </div>

                    {/* Zoom cluster */}
                    <div className="hidden sm:flex items-center gap-1 bg-background/50 border border-button-border-light rounded-lg px-2 py-1 text-xs">
                        <button
                            type="button"
                            onClick={zoomOut}
                            className="p-1 rounded text-accent2-foreground/70 hover:text-foreground hover:bg-white/10"
                            title="הקטן (Zoom Out)"
                        >
                            <ZoomOut size={15} />
                        </button>

                        <button
                            type="button"
                            onClick={resetZoom}
                            className="text-xs font-mono font-medium text-accent2-foreground px-1 hover:text-highlight"
                            title="איפוס ל-100%"
                        >
                            {Math.round(scale * 100)}%
                        </button>

                        <button
                            type="button"
                            onClick={zoomIn}
                            className="p-1 rounded text-accent2-foreground/70 hover:text-foreground hover:bg-white/10"
                            title="הגדל (Zoom In)"
                        >
                            <ZoomIn size={15} />
                        </button>

                        <button
                            type="button"
                            onClick={fitToWidth}
                            className="p-1 rounded text-accent2-foreground/70 hover:text-foreground hover:bg-white/10 ml-1 border-r border-button-border-light pr-1"
                            title="התאם לרוחב העמוד"
                        >
                            <StretchHorizontal size={14} />
                        </button>
                    </div>
                </div>

                {/* Left cluster: View Mode Toggle, Search, Rotate, Print, Download, Fullscreen, Theme */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    

                    {viewMode === 'viewer' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen((v) => !v)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    isSearchOpen ? 'bg-highlight/20 text-highlight' : 'text-accent2-foreground/80 hover:text-foreground hover:bg-white/10'
                                }`}
                                title="חיפוש במסמך (Ctrl+F)"
                            >
                                <Search size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={rotateClockwise}
                                className="p-1.5 rounded-lg text-accent2-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors hidden md:block"
                                title="סובב עם כיוון השעון (90°)"
                            >
                                <RotateCw size={16} />
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="p-1.5 rounded-lg text-accent2-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors hidden md:block"
                        title="הדפסת המסמך"
                    >
                        <Printer size={16} />
                    </button>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="p-1.5 rounded-lg text-accent2-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors"
                        title="הורדת קובץ ה-PDF"
                    >
                        <Download size={16} />
                    </button>

                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-1.5 rounded-lg text-accent2-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors hidden sm:block"
                        title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
                    >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>

                    <div className="mr-1">
                        <ThemeMenuCircleButton />
                    </div>
                </div>
            </header>

            {/* Floating Search Bar */}
            {isSearchOpen && (
                <div className="absolute top-14 left-4 z-40 bg-accent2-background/95 border border-button-border rounded-xl shadow-xl p-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                        placeholder="חפש ב-PDF..."
                        className="bg-background text-foreground text-xs px-2.5 py-1.5 rounded-lg border border-button-border-light outline-none focus:border-highlight w-44"
                        autoFocus
                    />

                    <button
                        type="button"
                        onClick={handleSearch}
                        className="p-1.5 bg-hero-primary-main text-white rounded-lg hover:bg-hero-primary-hover text-xs"
                    >
                        {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    </button>

                    {searchMatches.length > 0 && (
                        <span className="text-[11px] text-gray-400 font-mono px-1">
                            {currentMatchIndex + 1}/{searchMatches.length}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={prevMatch}
                        disabled={searchMatches.length === 0}
                        className="p-1 text-gray-400 hover:text-foreground disabled:opacity-30"
                        title="תוצאה קודמת"
                    >
                        <ChevronUp size={14} />
                    </button>

                    <button
                        type="button"
                        onClick={nextMatch}
                        disabled={searchMatches.length === 0}
                        className="p-1 text-gray-400 hover:text-foreground disabled:opacity-30"
                        title="תוצאה הבאה"
                    >
                        <ChevronDown size={14} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsSearchOpen(false)}
                        className="p-1 text-gray-400 hover:text-foreground"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ======================================================== */}
            {/* MAIN CONTENT AREA                                        */}
            {/* ======================================================== */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Collapsible Sidebar (Outline & Thumbnails) */}
                {isSidebarOpen && (
                    <aside className="w-72 sm:w-80 bg-accent2-background/70 border-l border-accent2-border flex flex-col z-20 shrink-0 select-text overflow-hidden">
                        {/* Sidebar Tabs Header */}
                        <div className="flex border-b border-accent2-border text-xs font-semibold bg-background/40">
                            <button
                                type="button"
                                onClick={() => setSidebarTab('outline')}
                                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                                    sidebarTab === 'outline'
                                        ? 'border-highlight text-highlight bg-highlight/5'
                                        : 'border-transparent text-gray-400 hover:text-foreground'
                                }`}
                            >
                                <Bookmark size={14} />
                                <span>תוכן עניינים</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSidebarTab('thumbnails')}
                                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                                    sidebarTab === 'thumbnails'
                                        ? 'border-highlight text-highlight bg-highlight/5'
                                        : 'border-transparent text-gray-400 hover:text-foreground'
                                }`}
                            >
                                <LayoutGrid size={14} />
                                <span>תמונות ממוזערות</span>
                            </button>
                        </div>

                        {/* Sidebar Content */}
                        <div className="flex-1 overflow-y-auto p-3 text-xs">
                            {sidebarTab === 'outline' ? (
                                outline.length > 0 ? (
                                    <ul className="space-y-1">
                                        {outline.map((item, idx) => (
                                            <OutlineNode
                                                key={idx}
                                                item={item}
                                                onNavigate={handleOutlineClick}
                                            />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-6 text-center text-gray-400 flex flex-col items-center gap-2">
                                        <FileText size={24} className="opacity-40" />
                                        <span>אין תוכן עניינים זמין למסמך זה</span>
                                    </div>
                                )
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum) => (
                                        <button
                                            key={pNum}
                                            type="button"
                                            onClick={() => scrollToPage(pNum)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                                                currentPage === pNum
                                                    ? 'border-highlight bg-highlight/10 shadow-xs'
                                                    : 'border-button-border-light hover:border-gray-500 bg-background/50'
                                            }`}
                                        >
                                            <div className="w-full aspect-[1/1.414] bg-background border border-button-border-light rounded flex items-center justify-center text-[10px] text-gray-400 shadow-2xs">
                                                <span>עמוד {pNum}</span>
                                            </div>
                                            <span className="text-[11px] font-mono text-gray-400">{pNum}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>
                )}

                {/* Main View Area: Clean Native Browser View (with hidden browser toolbar) or Custom PDF.js */}
                {viewMode === 'native' ? (
                    <div className="flex-1 w-full h-full bg-background overflow-hidden relative">
                        <iframe
                            ref={iframeRef}
                            id="pdf-native-frame"
                            src={`${pdfUrl}#page=1&toolbar=0&navpanes=0&view=FitH`}
                            className="w-full h-full border-none"
                            title={fileName}
                        />
                    </div>
                ) : (
                    /* PDF Pages Scroll Area */
                    <div
                        ref={scrollContainerRef}
                        id="pdf-scroll-container"
                        className="flex-1 h-full overflow-y-auto overflow-x-auto p-4 sm:p-8 bg-black/10 dark:bg-black/40 flex flex-col items-center gap-6"
                    >
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
                                <Loader2 size={32} className="animate-spin text-highlight" />
                                <span className="text-sm font-medium">טוען מסמך PDF...</span>
                            </div>
                        )}

                        {loadError && (
                            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-center max-w-md my-auto">
                                <p className="font-bold mb-1">שגיאה בטעינת הקובץ</p>
                                <p className="text-xs mb-4">{loadError}</p>
                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold"
                                >
                                    נסה שוב
                                </button>
                            </div>
                        )}

                        {!isLoading && !loadError && pdfDoc && (
                            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                                <PdfPage
                                    key={`${pageNum}-${scale}-${rotation}`}
                                    pageNumber={pageNum}
                                    pdfDoc={pdfDoc}
                                    scale={scale}
                                    rotation={rotation}
                                    pdfjsLib={pdfjsLib}
                                    containerRef={(el) => {
                                        if (el) pageRefs.current.set(pageNum, el);
                                        else pageRefs.current.delete(pageNum);
                                    }}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ==========================================
// OUTLINE TREE NODE COMPONENT
// ==========================================
function OutlineNode({ item, onNavigate }: { item: OutlineItem; onNavigate: (dest: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = item.items && item.items.length > 0;

    return (
        <li className="flex flex-col">
            <div className="flex items-center justify-between gap-1 py-1 px-1.5 rounded-lg hover:bg-white/5 group">
                <button
                    type="button"
                    onClick={() => onNavigate(item.dest)}
                    className="flex-1 text-right truncate text-accent2-foreground/90 group-hover:text-highlight transition-colors"
                    title={item.title}
                >
                    {item.title}
                </button>

                {hasChildren && (
                    <button
                        type="button"
                        onClick={() => setIsOpen((v) => !v)}
                        className="p-1 rounded hover:bg-white/10 text-gray-400"
                    >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
                    </button>
                )}
            </div>

            {hasChildren && isOpen && (
                <ul className="pr-3 border-r border-button-border-light/40 space-y-1 mt-1">
                    {item.items.map((sub, idx) => (
                        <OutlineNode key={idx} item={sub} onNavigate={onNavigate} />
                    ))}
                </ul>
            )}
        </li>
    );
}

// ==========================================
// LAZY-RENDERED SINGLE PDF PAGE
// ==========================================
interface PdfPageProps {
    pageNumber: number;
    pdfDoc: any;
    scale: number;
    rotation: number;
    pdfjsLib: any;
    containerRef: (el: HTMLDivElement | null) => void;
}

function PdfPage({
    pageNumber,
    pdfDoc,
    scale,
    rotation,
    pdfjsLib,
    containerRef,
}: PdfPageProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);

    // Eagerly render first 4 pages
    const [isInView, setIsInView] = useState<boolean>(pageNumber <= 4);
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 850 });
    const [isRendered, setIsRendered] = useState<boolean>(false);
    const renderTaskRef = useRef<any>(null);

    // Initial viewport estimation to reserve aspect ratio immediately
    useEffect(() => {
        let isCancelled = false;
        pdfDoc.getPage(pageNumber).then((page: any) => {
            if (isCancelled) return;
            const vp = page.getViewport({ scale, rotation });
            setDimensions({ width: Math.floor(vp.width), height: Math.floor(vp.height) });
        });
        return () => { isCancelled = true; };
    }, [pdfDoc, pageNumber, scale, rotation]);

    // Lazy load observer using the scroll container as root
    useEffect(() => {
        const el = elementRef.current;
        if (!el) return;

        const scrollRoot = document.getElementById('pdf-scroll-container');
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                }
            },
            {
                root: scrollRoot,
                rootMargin: '600px 0px 600px 0px', // Preload 600px before entering viewport
            }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Render Canvas and Text Layer
    useEffect(() => {
        if (!isInView || !pdfDoc || !pdfjsLib) return;

        let isCancelled = false;
        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        if (!canvas) return;

        pdfDoc.getPage(pageNumber).then(async (page: any) => {
            if (isCancelled) return;

            const viewport = page.getViewport({ scale, rotation });
            const width = Math.floor(viewport.width);
            const height = Math.floor(viewport.height);
            setDimensions({ width, height });

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Handle Retina / HiDPI screens for crisp sharp formulas
            const pixelRatio = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * pixelRatio);
            canvas.height = Math.floor(viewport.height * pixelRatio);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            // Cancel any in-flight rendering task
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined;

            const renderTask = page.render({
                canvasContext: ctx,
                viewport,
                transform,
            });
            renderTaskRef.current = renderTask;

            try {
                await renderTask.promise;
                if (isCancelled) return;
                setIsRendered(true);

                // Render selectable text layer
                if (textLayer && pdfjsLib.renderTextLayer) {
                    textLayer.innerHTML = '';
                    textLayer.style.width = `${width}px`;
                    textLayer.style.height = `${height}px`;
                    textLayer.style.setProperty('--scale-factor', `${viewport.scale}`);

                    const textContent = await page.getTextContent();
                    if (isCancelled) return;

                    const textTask = pdfjsLib.renderTextLayer({
                        textContentSource: textContent,
                        container: textLayer,
                        viewport,
                    });
                    if (textTask?.promise) {
                        await textTask.promise;
                    }
                }
            } catch (err: any) {
                if (err?.name !== 'RenderingCancelledException') {
                    console.warn(`[PdfViewer] Render failed for page ${pageNumber}:`, err);
                }
            }
        });

        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [isInView, pdfDoc, pageNumber, scale, rotation, pdfjsLib]);

    return (
        <div
            ref={(node) => {
                elementRef.current = node;
                containerRef(node);
            }}
            data-page-number={pageNumber}
            id={`pdf-page-${pageNumber}`}
            className="shrink-0 relative bg-white shadow-xl rounded-sm border border-black/10 overflow-hidden my-2"
            style={{
                width: `${dimensions.width}px`,
                height: `${dimensions.height}px`,
                minWidth: `${dimensions.width}px`,
                minHeight: `${dimensions.height}px`,
            }}
        >
            {/* Canvas layer */}
            <canvas
                ref={canvasRef}
                className="block absolute top-0 left-0"
                style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                }}
            />

            {/* Selectable text layer */}
            <div
                ref={textLayerRef}
                className="textLayer absolute inset-0 select-text pointer-events-auto"
                style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                }}
            />

            {/* Placeholder / Skeleton while not loaded */}
            {!isRendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 text-xs">
                    <Loader2 size={24} className="animate-spin opacity-40" />
                </div>
            )}

            {/* Subtle Page number badge on hover */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10">
                עמוד {pageNumber}
            </div>
        </div>
    );
}
