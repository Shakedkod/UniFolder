"use client";

import { useState } from "react";
import { FileCode, Archive, Loader2 } from "lucide-react";

interface LatexDownloadButtonProps {
    latex: string;
    title: string;
    assets?: { path: string; kind: string; isUrl: boolean }[];
}

export default function LatexDownloadButton({
    latex,
    title,
    assets = [],
}: LatexDownloadButtonProps) {
    const [loading, setLoading] = useState(false);

    const localAssets = (assets || []).filter((a) => !a.isUrl);
    const hasAssets = localAssets.length > 0;

    async function handleClick() {
        setLoading(true);
        try {
            const safeTitle =
                title
                    .replace(/[^\u0590-\u05FFa-zA-Z0-9 _-]/g, "")
                    .trim()
                    .replace(/\s+/g, "_") || "document";

            // If there are no images, we can download the .tex file directly in the browser
            if (!hasAssets) {
                const blob = new Blob([latex], { type: "text/x-tex;charset=utf-8" });
                downloadBlob(blob, `${safeTitle}.tex`);
                return;
            }

            // If there are assets, call the export endpoint to package the .tex with all images into a .zip
            const response = await fetch("/api/latex", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latex, title, assets: localAssets }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const contentType = response.headers.get("content-type") || "";
            const blob = await response.blob();
            const extension = contentType.includes("zip") ? "zip" : "tex";
            downloadBlob(blob, `${safeTitle}.${extension}`);
        } catch (error: any) {
            console.error("Failed to export LaTeX:", error);
            alert(`שגיאה בהורדת LaTeX: ${error.message || error}`);
        } finally {
            setLoading(false);
        }
    }

    function downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading || !latex}
            className="flex items-center justify-between w-full p-3 rounded-xl border transition-all disabled:opacity-60 bg-transparent border-transparent hover:bg-really-light-accent-bg text-really-light-text hover:text-foreground text-right"
            title={
                hasAssets
                    ? "הורדת ארכיון ZIP המכיל את קובץ ה-LaTeX ואת התמונות המקושרות"
                    : "הורדה כקובץ LaTeX (.tex)"
            }
        >
            <div className="flex items-center gap-3 font-medium">
                {loading ? (
                    <Loader2 size={18} className="text-highlight animate-spin shrink-0" />
                ) : hasAssets ? (
                    <Archive size={18} className="text-highlight shrink-0" />
                ) : (
                    <FileCode size={18} className="shrink-0" />
                )}
                <span>{hasAssets ? "ייצוא LaTeX (.zip)" : "ייצוא LaTeX (.tex)"}</span>
            </div>
            {hasAssets && (
                <span className="text-[10px] bg-accent2-border/30 text-really-light-text px-1.5 py-0.5 rounded">
                    {localAssets.length} תמונות
                </span>
            )}
        </button>
    );
}
