"use client";

import { useState } from "react";
import { Download, FileCode, Archive, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface CourseExportButtonProps {
    slug: string[];
    folderTitle: string;
    lectureCount: number;
}

export default function CourseExportButton({
    slug,
    folderTitle,
    lectureCount,
}: CourseExportButtonProps) {
    const [loadingFormat, setLoadingFormat] = useState<"latex" | "pdf" | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleExport = async (format: "latex" | "pdf") => {
        setLoadingFormat(format);
        setErrorMessage(null);

        try {
            const response = await fetch("/api/course-export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug,
                    format,
                    title: folderTitle,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server error (${response.status})`);
            }

            const contentType = response.headers.get("content-type") || "";
            const contentDisposition = response.headers.get("content-disposition") || "";

            // Extract filename from header if available
            let filename = `${folderTitle.replace(/\s+/g, "_")}_lectures`;
            const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
            if (filenameMatch) {
                filename = decodeURIComponent(filenameMatch[1].replace(/["']/g, ""));
            } else {
                const ext = format === "pdf" ? "pdf" : contentType.includes("zip") ? "zip" : "tex";
                filename = `${filename}.${ext}`;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error("[CourseExport] Failed to export:", error);
            setErrorMessage(error.message || "אירעה שגיאה בעת ייצוא החומרים.");
        } finally {
            setLoadingFormat(null);
        }
    };

    if (lectureCount === 0) return null;

    return (
        <div className="w-full bg-accent-background/40 border border-button-border-light rounded-2xl p-4 sm:p-5 mb-10 shadow-xs flex flex-col gap-3 transition-all" dir="rtl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left Description */}
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-hero-primary-main/10 text-hero-primary-main shrink-0 mt-0.5">
                        <Sparkles size={20} />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">
                                ייצוא כל ההרצאות כמסמך מאוחד
                            </h3>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-background border border-button-border-light text-really-light-text">
                                {lectureCount} הרצאות
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-5 shrink-0">
                    {/* LaTeX Export Button */}
                    <button
                        type="button"
                        onClick={() => handleExport("latex")}
                        disabled={loadingFormat !== null}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-background hover:bg-white/10 border border-button-border-light hover:border-hero-primary-main text-foreground text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-2xs hover:shadow-xs"
                        title="הורדת קובץ LaTeX או ארכיון ZIP עם כל התמונות"
                    >
                        {loadingFormat === "latex" ? (
                            <Loader2 size={15} className="animate-spin text-highlight" />
                        ) : (
                            <Archive size={15} className="text-highlight" />
                        )}
                        <span>
                            {loadingFormat === "latex" ? "מייצא LaTeX..." : "ייצוא LaTeX"}
                        </span>
                    </button>
                    <div className="w-5"></div>

                    {/* PDF Export Button */}
                    <button
                        type="button"
                        onClick={() => handleExport("pdf")}
                        disabled={loadingFormat !== null}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-hero-primary-main text-white hover:bg-hero-primary-hover border border-hero-primary-border text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs hover:shadow-md"
                        title="הידור PDF מלא עם XeLaTeX"
                    >
                        {loadingFormat === "pdf" ? (
                            <Loader2 size={15} className="animate-spin text-white" />
                        ) : (
                            <Download size={15} className="text-white" />
                        )}
                        <span>
                            {loadingFormat === "pdf" ? "מהדר PDF (XeLaTeX)..." : "הורדת כל הקורס כ-PDF"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Loading Indicator helper message */}
            {loadingFormat === "pdf" && (
                <div className="flex items-center gap-2 text-xs text-highlight bg-highlight/5 border border-highlight/20 px-3 py-2 rounded-lg mt-1 animate-pulse">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>מהדר את כל הרצאות הקורס עם מנוע XeLaTeX. תהליך זה עשוי להימשך כ-10–25 שניות...</span>
                </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-lg mt-1">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}
        </div>
    );
}
