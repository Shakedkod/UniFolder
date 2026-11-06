"use client";

import { useState } from "react";
import { Download, FileText, BookOpen, X, Loader2, AlertCircle } from "lucide-react";

interface PdfDownloaderProps {
    title: string;
    courseId?: string;
    courseName?: string;
    latex?: string;
    assets?: { path: string; kind: string; isUrl: boolean }[];
    currentSlug?: string[];
}

export default function PdfDownloader({
    title,
    courseId,
    courseName,
    latex,
    assets = [],
}: PdfDownloaderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState<"latex" | "website" | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function handleDownloadLatexPdf() {
        if (!latex) {
            setErrorMessage("תוכן ה-LaTeX אינו זמין עבור מסמך זה.");
            return;
        }

        setLoading("latex");
        setErrorMessage(null);

        try {
            const response = await fetch("/api/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    latex,
                    title,
                    assets,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `שגיאת שרת (${response.status})`);
            }

            const blob = await response.blob();
            const safeTitle =
                title
                    .replace(/[^\u0590-\u05FFa-zA-Z0-9 _-]/g, "")
                    .trim()
                    .replace(/\s+/g, "_") || "document";

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${safeTitle}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setIsOpen(false);
        } catch (err: any) {
            console.error("PDF download failed:", err);
            setErrorMessage(err.message || "אירעה שגיאה בעת קומפילציית ה-PDF.");
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="relative w-full" dir="rtl">
            {/* Trigger button */}
            <button
                onClick={() => {
                    setErrorMessage(null);
                    setIsOpen((o) => !o);
                }}
                className={`flex items-center justify-between w-full p-3 rounded-xl border transition-all ${
                    isOpen
                        ? "bg-button-bg border-button-border-light text-foreground"
                        : "bg-transparent border-transparent hover:bg-really-light-accent-bg text-really-light-text hover:text-foreground"
                }`}
            >
                <div className="flex items-center gap-3 font-medium">
                    <Download size={18} className={isOpen ? "text-highlight" : ""} />
                    <span>הורדה כ-PDF</span>
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="absolute bottom-[calc(100%+0.5rem)] right-0 w-full min-w-72 bg-background border border-accent2-border shadow-xl rounded-xl p-3 z-[110] flex flex-col gap-2 animate-in fade-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-1 px-1">
                            <span className="text-xs font-bold text-foreground-remark uppercase tracking-wider">
                                בחר סגנון PDF
                            </span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-really-light-text hover:text-foreground"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Error notice if any */}
                        {errorMessage && (
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-right">
                                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                <span className="leading-tight">{errorMessage}</span>
                            </div>
                        )}

                        {/* Option 1 – Website style (Will do later) */}
                        <button
                            type="button"
                            disabled={true}
                            className="flex items-start gap-3 p-3 rounded-lg border border-transparent bg-foreground/5 opacity-60 cursor-not-allowed text-right"
                            title="אפשרות זו תהיה זמינה בקרוב"
                        >
                            <BookOpen size={20} className="text-really-light-text shrink-0 mt-0.5" />
                            <div className="flex flex-col flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground text-sm">
                                        1. סגנון אתר
                                    </span>
                                    <span className="text-[10px] bg-accent2-border/40 text-really-light-text px-1.5 py-0.5 rounded font-medium">
                                        בקרוב
                                    </span>
                                </div>
                                <span className="text-xs text-really-light-text leading-snug mt-0.5">
                                    עיצוב דיגיטלי מותאם למסך (יתווסף בהמשך)
                                </span>
                            </div>
                        </button>

                        {/* Option 2 – LaTeX style (Generated by XeLaTeX generator) */}
                        <button
                            type="button"
                            onClick={handleDownloadLatexPdf}
                            disabled={loading !== null || !latex}
                            className="flex items-start gap-3 p-3 rounded-lg border border-highlight/30 hover:border-highlight bg-highlight/5 hover:bg-highlight/10 transition-all text-right disabled:opacity-50"
                        >
                            {loading === "latex" ? (
                                <Loader2 size={20} className="text-highlight animate-spin shrink-0 mt-0.5" />
                            ) : (
                                <FileText size={20} className="text-highlight shrink-0 mt-0.5" />
                            )}
                            <div className="flex flex-col flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground text-sm">
                                        2. סגנון LaTeX
                                    </span>
                                    <span className="text-[10px] bg-highlight/20 text-highlight px-1.5 py-0.5 rounded font-medium">
                                        XeLaTeX
                                    </span>
                                </div>
                                <span className="text-xs text-really-light-text leading-snug mt-0.5">
                                    מסמך אקדמי מקצועי שנוצר ומקומפל ע&quot;י מנוע ה-LaTeX
                                </span>
                            </div>
                        </button>

                        {loading === "latex" && (
                            <p className="text-[11px] text-highlight text-center animate-pulse pt-1">
                                מקמפל את המסמך ב-XeLaTeX, אנא המתן...
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
