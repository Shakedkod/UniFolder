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

    const { title, type, toc, html, latex, assets } = compiledData;

    if (type === "pdf") {
        const pdfStaticUrl = path.join(LIVE_VAULT_URL, ...currentSlug.slice(0, -1), rawFilename + ".pdf").replace(/\\/g, '/');
        return (
            <main className="w-full h-screen">
                <PdfViewerWrap
                    pdfUrl={pdfStaticUrl}
                    fileName={rawFilename}
                    parentUrl={parentUrl}
                    parentName={parentName}
                    title={title}
                />
            </main>
        );
    }

    const data = getUrlType(currentSlug, courseName);

    return (
        <div className="flex flex-col xl:flex-row items-start w-full min-h-screen relative">
            <Sidebar content={{
                title,
                toc,
                parent: { url: parentUrl, name: parentName },
                course: { id: data.courseId ?? "", name: data.courseName },
                isCourse: data.isCourse,
                type: data.subType,
                latex: latex as string | undefined,
                assets: assets as { path: string; kind: string; isUrl: boolean }[] | undefined
            }} />

            <main className="flex-1 min-w-0 px-8 py-6 w-full" dir="rtl">
                <Suspense fallback={<Loading />}>
                    {type == "code" && (
                        <h1 className="text-3xl font-bold mb-6 text-foreground text-left" dir="ltr">
                            {rawFilename}
                        </h1>
                    )}
                    <InteractiveArticle title={title} html={html} isCodeFile={!!(type == "code")} />
                </Suspense>
            </main>

            <DesmosInitializer />
        </div>
    );
}