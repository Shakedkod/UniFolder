export default function SearchBar()
{
    return (
        <div className="w-full px-8 py-10 animate-pulse" dir="rtl">
            {/* Skeleton Search Bar */}
            <div className="h-10 w-full bg-gray-800 rounded-lg mb-6"></div>
            {/* Skeleton Search Results */}
            <div className="space-y-4">
                <div className="h-4 w-full bg-gray-800 rounded"></div>
                <div className="h-4 w-full bg-gray-800 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-800 rounded"></div>
            </div>
        </div>
    );
}