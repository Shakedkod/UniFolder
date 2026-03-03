export default function Loading() {
    return (
        <div className="w-full px-8 py-10 animate-pulse" dir="rtl">
            {/* Skeleton Title */}
            <div className="h-10 w-2/3 bg-gray-800 rounded-lg mb-8"></div>
            
            {/* Skeleton Paragraphs */}
            <div className="space-y-4">
                <div className="h-4 w-full bg-gray-800 rounded"></div>
                <div className="h-4 w-full bg-gray-800 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-800 rounded"></div>
            </div>
            
            {/* Skeleton Table (since you have many tables) */}
            <div className="mt-10 border border-gray-800 rounded-lg p-4">
                <div className="h-8 w-full bg-gray-800 rounded mb-2"></div>
                <div className="h-6 w-full bg-gray-900 rounded mb-2"></div>
                <div className="h-6 w-full bg-gray-900 rounded"></div>
            </div>
        </div>
    );
}