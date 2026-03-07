import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Sidebar from "../Sidebar";
import Loading from "@/app/[...slug]/loading";
import { cache, Suspense } from "react";
import DesmosInitializer from "../DesmosInitializer";
import InteractiveArticle from "./InteractiveArticle";
import { VAULT_DIRECTORY } from "@/lib/vault";

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

    const { title, isCodeFile, toc, html } = compiledData;

    return (
        <main className="flex flex-col xl:flex-row items-start w-full min-h-screen relative">
            <Sidebar content={{ title, toc, parent: { url: parentUrl, name: parentName } }} />

            <div className="flex-1 min-w-0 px-8 py-6 w-full" dir="rtl">
                <Suspense fallback={<Loading />}>
                    {isCodeFile && (
                        <h1 className="text-3xl font-bold mb-6 text-foreground text-left" dir="ltr">
                            {rawFilename}
                        </h1>
                    )}
                    <InteractiveArticle html={html} isCodeFile={!!isCodeFile} />
                </Suspense>
            </div>

            <DesmosInitializer />
        </main>
    );
}