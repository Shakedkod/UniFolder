'use client';

import { Search as SearchIcon, Command } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SearchBar()
{
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        // Detect if the platform is Mac or iOS
        const platform = window.navigator?.platform?.toLowerCase() || '';
        setIsMac(platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad'));
    }, []);

    const handleOpenSearch = () => {
        // Dispatches the Ctrl+K event manually to trigger your existing listener
        const event = new KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
            bubbles: true,
            metaKey: true // Supports Mac users
        });
        window.dispatchEvent(event);
    };

    return (
        <div 
            dir="rtl"
            onClick={handleOpenSearch} 
            className="group relative w-full max-w-2xl mx-auto cursor-pointer"
        >
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-500 group-hover:text-orange-400 transition-colors" />
            </div>
            
            <div className="w-full bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-white/10 text-gray-400 py-4 pr-12 pl-4 rounded-2xl transition-all flex items-center justify-between shadow-2xl">
                <span className="text-lg font-light">חיפוש בתיקיה...</span>
                
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs font-mono opacity-60 transition-opacity group-hover:opacity-100">
                    {isMac ? (
                        <>
                            <Command size={12} />
                            <span>K</span>
                        </>
                    ) : (
                        <span className="text-[10px] tracking-tighter">Ctrl K</span>
                    )}
                </div>
            </div>
        </div>
    );
}