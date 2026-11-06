import { getFolderContents, getFolderTitle, getFriendlyName } from "@/lib/vault";
import ItemLink from "../NoteComponents/ItemLink";
import BackButton from "../NoteComponents/BackButton";
import { Folder } from "lucide-react";
import SetPageTitle from "../SetPageTitle";
import CourseExportButton from "./CourseExportButton";

export default async function FolderPage({ currentSlug, parentUrl, parentName }: { currentSlug: string[]; parentUrl: string; parentName: string }) {
    const items = getFolderContents(currentSlug);

    const rawFolderName = decodeURIComponent(currentSlug[currentSlug.length - 1]);
    const folderName = getFolderTitle(decodeURIComponent(rawFolderName));

    // --- NEW: Group the items into 4 buckets ---
    const folders = items.filter(item => item.isDirectory);
    const files = items.filter(item => !item.isDirectory);

    // 1. Define the Regex patterns
    // Matches any common homework keyword
    const hwRegex = /(גליון|גיליון|וובוורק|שיעורי\s*בית|מטלה|hw|homework|שאלון)/i;
    // Matches if the string starts with a number
    const numberedRegex = /^\d+/;

    // 2. Filter out the files into the 4 buckets
    const homeworkFiles = files.filter(item => hwRegex.test(item.displayName));
    const remainingFiles = files.filter(item => !hwRegex.test(item.displayName));
    const numberedFiles = remainingFiles.filter(item => numberedRegex.test(item.displayName));
    const unnumberedFiles = remainingFiles.filter(item => !numberedRegex.test(item.displayName));

    // Helper function so we don't repeat the grid code 3 times
    const renderGrid = (gridItems: typeof items) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {gridItems.map((item) => {
                return (
                    <ItemLink key={item.name} name={item.displayName} type={item.type} url={`/${[...currentSlug, item.name].map(encodeURIComponent).join('/')}`} />
                );
            })}
        </div>
    );

    return (
        <SetPageTitle title={folderName}>
            <main className="max-w-5xl print:max-w-none mx-auto p-8" dir="rtl">
                {/* Back Button */}
                <BackButton url={parentUrl} name={parentName} bg="light" />

                {/* Main Header */}
                <h1 className="text-4xl font-bold mb-6 text-foreground-title flex items-center gap-3">
                    <Folder size={36} />
                    {folderName}
                </h1>

                {/* Course Lectures Export Button (ZIP / LaTeX / PDF) */}
                {numberedFiles.length > 0 && (
                    <CourseExportButton
                        slug={currentSlug}
                        folderTitle={folderName}
                        lectureCount={numberedFiles.length}
                    />
                )}

                {/* --- Render the Sections Dynamically --- */}
                {folders.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">תיקיות</h2>
                        {renderGrid(folders)}
                    </section>
                )}

                {numberedFiles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">רצף לימוד</h2>
                        {renderGrid(numberedFiles)}
                    </section>
                )}

                {homeworkFiles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">שיעורי בית ומטלות</h2>
                        {renderGrid(homeworkFiles)}
                    </section>
                )}

                {unnumberedFiles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-500 mb-4 border-b border-gray-800 pb-2">חומרים נוספים</h2>
                        {renderGrid(unnumberedFiles)}
                    </section>
                )}
            </main>
        </SetPageTitle>
    );
}