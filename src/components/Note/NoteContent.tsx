import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Sidebar from "../Sidebar";
import Loading from "@/app/[...slug]/loading";
import { cache, Suspense } from "react";
import DesmosInitializer from "../DesmosInitializer";
import InteractiveArticle from "./InteractiveArticle";
import { LIVE_VAULT_URL, VAULT_DIRECTORY } from "@/lib/vault";
import PdfViewerWrap from "./pdf/PdfViewerWrap";

const getCompiledData = cache((filePath: string) => {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
});

/**
 * Detects if a path belongs to a Technion course based on the 8-digit ID
 */
export function getUrlType(slug: string[], courseName?: string) {
    const identifier = slug[2];

    // Regex check: is it exactly 8 digits?
    const isCourseId = /^\d{8}$/.test(identifier);

    if (isCourseId) {
        return {
            isCourse: true,
            courseId: identifier,
            courseName: courseName || "קורס לא מזוהה", // Fallback if courseName isn't provided
            // Logic to determine if it's a tutorial vs lecture based on path
            subType: slug.includes('tutorials') ? 'tutorial' : 'lecture'
        };
    }

    return {
        isCourse: false,
        category: identifier, // e.g., "hknh-lsmstr-b"
        courseName: "",
        subType: 'default'
    };
}

export default async function NoteContent({ currentSlug, parentUrl, parentName, courseName }: { currentSlug: string[]; parentUrl: string; parentName: string; courseName?: string }) {
    const rawFilename = decodeURIComponent(currentSlug[currentSlug.length - 1]);

    const jsonFilename = rawFilename + ".json";
    const filePath = path.join(VAULT_DIRECTORY, ...currentSlug.slice(0, -1), jsonFilename);

    let compiledData;
    try {
        compiledData = getCompiledData(filePath);
    } catch (e) {
        notFound();
    }

    const { title, type, toc, html } = compiledData;

    if (type === "pdf") {
        const pdfStaticUrl = path.join(LIVE_VAULT_URL, ...currentSlug.slice(0, -1), rawFilename + ".pdf").replace(/\\/g, '/');
        return (
            <main className="w-full h-screen">
                {/* Callout to make the user click the download button if they want to print, since printing from the PDF viewer can be buggy */}
                <div className="hidden print:block fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-400 text-yellow-800 p-4 z-50 print-warning" dir="rtl">
                    <p className="text-xl">הקובץ הזה הוא PDF - מומלץ להוריד אותו ע"י לחיצה על כפתור ההורדה בסרגל הכלים העליון כדי שהפורמט ישמר כראוי בעת ההדפסה.</p>
                </div>

                <div className="print:hidden">
                    <PdfViewerWrap
                        pdfUrl={pdfStaticUrl}
                        fileName={rawFilename}
                        parentUrl={parentUrl}
                        parentName={parentName}
                        title={title}
                    />
                </div>
            </main>
        );
    }

    const data = getUrlType(currentSlug, courseName);

    return (
        <>
            {/* --- CUSTOM PRINT HEADER (Stays exactly the same) --- */}
            <div className="hidden print:flex fixed top-0 left-0 right-0 h-[50px] items-center justify-between border-b border-gray-300 px-8 text-[10pt] bg-white z-50 print-header" dir="rtl">
                <span>{courseName}</span>
                <span>{title}</span>
            </div>

            {/* --- CUSTOM PRINT FOOTER (Stays exactly the same) --- */}
            <div className="hidden print:flex fixed bottom-0 left-0 right-0 h-[40px] items-center justify-center border-t border-gray-200 px-8 text-[9pt] text-gray-400 print-footer" dir="rtl">
                <p>הופק מתקיית התואר של שקד ק. ק. - כל הזכויות שמורות</p>
            </div>

            {/* --- MAIN CONTENT --- */}
            <main className="flex flex-col xl:flex-row items-start w-full min-h-screen relative print:block">
                <Sidebar content={{ title, toc, parent: { url: parentUrl, name: parentName }, isCourse: data.isCourse, course: { id: data.courseId ?? "", name: data.courseName }, type: data.subType }} />

                {/* THE INVISIBLE SPACER TABLE */}
                <table className="flex-1 w-full print:table print:table-fixed print:w-full border-collapse">

                    {/* 1. Invisible Top Bumper (matches header height + padding) */}
                    <thead className="hidden print:table-header-group">
                        <tr><th className="h-[70px] p-0 border-none"></th></tr>
                    </thead>

                    {/* 2. Your actual content */}
                    <tbody className="block print:table-row-group">
                        <tr className="block print:table-row">
                            <td className="block print:table-cell min-w-0 px-8 py-6 w-full print:p-0" dir="rtl">
                                <Suspense fallback={<Loading />}>
                                    {type == "code" && (
                                        <h1 className="text-3xl font-bold mb-6 text-foreground text-left" dir="ltr">
                                            {rawFilename}
                                        </h1>
                                    )}
                                    <InteractiveArticle html={html} isCodeFile={!!(type == "code")} />
                                </Suspense>
                            </td>
                        </tr>
                    </tbody>

                    {/* 3. Invisible Bottom Bumper (matches footer height + padding) */}
                    <tfoot className="hidden print:table-footer-group">
                        <tr><td className="h-[60px] p-0 border-none"></td></tr>
                    </tfoot>

                </table>

                <DesmosInitializer />
            </main>
        </>
    );
}