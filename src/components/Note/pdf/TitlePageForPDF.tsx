"use client";

interface PrintTitleProps {
    courseId: string;   // e.g., "01040166"
    courseName: string; // e.g., "אלגברה לינארית 1"
    pageTitle: string;   // e.g., "1 - שדות"
    type: string;       // e.g., "הרצאה", "תרגול", "סיכום"
    date?: string;       // Optional: "סמסטר א', 2025"
}

// Map types to professional Hebrew labels
const typeLabels: Record<string, string> = {
    "lecture": "רשימות הרצאה",
    "tutorial": "רשימות תרגול",
    "summary": "סיכום נושא",
    "hw": "פתרון שיעורי בית",
    "default": "חומר לימודי"
};

export default function PrintTitlePage({ courseId, courseName, pageTitle, type }: PrintTitleProps) {
    const professionalType = typeLabels[type.toLowerCase()] || typeLabels["default"];

    return (
        // 1. 'hidden print:flex' - Only visible on paper, uses Flexbox for centering
        // 2. 'h-[297mm]' - Matches standard A4 height to force a page break immediately after
        <div 
            className="hidden print:flex h-[250mm] w-full flex-col justify-between text-black bg-white p-20 print-title-page z-[200]" 
            dir="rtl"
            style={{ 
                // Force colors to print exactly, avoiding light/dark conflicts
                // @ts-ignore
                WebkitPrintColorAdjust: 'exact', 
                printColorAdjust: 'exact' 
            }}
        >
            {/* TOP SECTION: The Metadata */}
            <div className="flex justify-between items-start w-full border-b pb-6 border-gray-200">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-500">{courseId}</span>
                    <h2 className="text-xl font-semibold text-gray-800">{courseName}</h2>
                </div>
            </div>

            {/* MIDDLE SECTION: The Main Title (Centered) */}
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                {/* Decorative Line */}
                <div className="w-24 h-1 bg-accent2-main rounded-full mb-6" />
                
                <span className="text-lg font-medium tracking-wide text-gray-600 bg-gray-100 px-4 py-1 rounded-full">
                    {professionalType + " לקריאה בשבת"}
                </span>
                
                <h1 className="text-6xl font-extrabold leading-tight tracking-tight mt-2 mb-4">
                    {pageTitle.replace(/^\d+\s*-\s*/, '').trim()}
                </h1>
                
                {/* Visual Accent Box */}
                <div className="absolute inset-0 border-[30px] border-accent2-border/10 rounded-full opacity-5 pointer-events-none" />
            </div>

            {/* BOTTOM SECTION: The Signature/Footer */}
            <div className="w-full text-center border-t pt-8 border-gray-200">
                <p className="text-sm text-gray-400">הופק מתוך תקיית התואר של שקד</p>
                <p className="text-base font-semibold mt-1">uni-folder.vercel.app</p>
            </div>

            {/* FORCE PAGE BREAK after this container */}
            <div className="print:break-after-page" />
        </div>
    );
}