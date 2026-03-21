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

export default async function NoteContent({ currentSlug, parentUrl, parentName }: { currentSlug: string[]; parentUrl: string; parentName: string }) {
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

    if (type === "pdf")
    {
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

    return (
        <main className="flex flex-col xl:flex-row items-start w-full min-h-screen relative">
            <Sidebar content={{ title, toc, parent: { url: parentUrl, name: parentName } }} />

            <div className="flex-1 min-w-0 px-8 py-6 w-full" dir="rtl">
                <Suspense fallback={<Loading />}>
                    {type == "code" && (
                        <h1 className="text-3xl font-bold mb-6 text-foreground text-left" dir="ltr">
                            {rawFilename}
                        </h1>
                    )}
                    <InteractiveArticle html={html} isCodeFile={!!(type == "code")} />
                </Suspense>
            </div>

            <DesmosInitializer />
        </main>
    );
}