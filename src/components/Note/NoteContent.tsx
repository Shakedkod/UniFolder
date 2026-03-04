import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Sidebar from "../Sidebar";
import Loading from "@/components/Note/loading";
import { Suspense } from "react";
import DesmosInitializer from "../DesmosInitializer";
import InteractiveArticle from "./InteractiveArticle";
import { VAULT_DIRECTORY } from "@/lib/vault";

export default async function NoteContent({ currentSlug, parentUrl, parentName }: { currentSlug: string[]; parentUrl: string; parentName: string }) {
    const rawFilename = decodeURIComponent(currentSlug[currentSlug.length - 1]);
    const jsonFilename = rawFilename + ".json";
    const filePath = path.join(VAULT_DIRECTORY, ...currentSlug.slice(0, -1), jsonFilename);
    
    let compiledData;
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        compiledData = JSON.parse(fileContents);
    } catch (e) {
        notFound();
    }

    const { title, isCodeFile, toc, html } = compiledData;

    return (
        <main className={`flex flex-col xl:flex-row w-full h-full xl:grid xl:grid-cols-[auto_1fr] no-scrollbar`}>
            <div className="sticky top-0 z-50 w-full xl:w-auto">
                <Sidebar content={{ title, toc, parent: { url: parentUrl, name: parentName } }} />
            </div>

            <Suspense fallback={<Loading />}>
                <div className="flex flex-col w-full px-8 py-6" dir="rtl">
                    {/* Add the filename as a header for code files */}
                    {isCodeFile && (
                        <h1 className="text-3xl font-bold mb-6 text-foreground text-left" dir="ltr">
                            {rawFilename}
                        </h1>
                    )}

                    <InteractiveArticle html={html} isCodeFile={!!isCodeFile} />
                </div>
            </Suspense>

            <DesmosInitializer />
        </main>
    );
}