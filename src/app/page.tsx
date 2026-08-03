import { SearchBar, Footer } from "@/components/Home";
import { Folder } from "lucide-react";
import Link from "next/link";

export default async function Home() {

    return (
        <main className="w-full min-h-screen flex flex-col items-center justify-start gap-10 bg-accent-background text-foreground">
            <SearchBar />
            <div className="bg-background w-full h-auto">
                <div className="bg-background w-full flex flex-col justify-baseline items-baseline px-5 py-2">
                <div className="w-full border-b-2 text-hero-primary-main border-accent-border flex flex-row justify-between items-baseline px-2">
                    <h1 className="text-5xl text-hero-primary-main font-bold">שנה א'</h1>
                    <h2 className="text-2xl text-hero-primary-main/50">התשפ"ו 2025-2026</h2>
                </div>
                <div className="w-full flex flex-row justify-baseline gap-10 items-center pt-3 pb-5 px-5">
                    <Link
                        href="/2025/semester-a"
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-hero-primary-main/10 border border-hero-primary-border hover:border-hero-primary-main transition-colors group"
                    >
                        <Folder className="text-highlight group-hover:text-highlight-icon" size={24} />
                        <div className="flex flex-col text-right">
                            <span className="text-hero-heading font-semibold group-hover:text-hero-primary-main">סמסטר חורף</span>
                            <span className="text-hero-muted text-sm">אינפי 1, אלגברה א, אוטומטים, מכניקה</span>
                        </div>
                    </Link>
                    <Link
                        href="/2025/semester-b"
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-hero-primary-main/10 border border-hero-primary-border hover:border-hero-primary-main transition-colors group"
                    >
                        <Folder className="text-highlight group-hover:text-highlight-icon" size={24} />
                        <div className="flex flex-col text-right">
                            <span className="text-hero-heading font-semibold group-hover:text-hero-primary-main">סמסטר אביב</span>
                            <span className="text-hero-muted text-sm">אינפי 2, תכנות מערכות, קומבי, חשמל</span>
                        </div>
                    </Link>
                </div>
            </div>
            <div className="bg-background w-full flex flex-col justify-baseline items-baseline px-5 py-2">
                <div className="w-full border-b-2 text-hero-primary-main border-accent-border flex flex-row justify-between items-baseline px-2">
                    <h1 className="text-5xl text-hero-primary-main font-bold">שנה ב'</h1>
                    <h2 className="text-2xl text-hero-primary-main/50">התשפ"ז 2026-2027</h2>
                </div>
                <div className="w-full flex flex-row justify-baseline gap-10 items-center pt-3 pb-5 px-5">
                    <Link
                        href="/2026/semester-a"
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-hero-primary-main/10 border border-hero-primary-border hover:border-hero-primary-main transition-colors group"
                    >
                        <Folder className="text-highlight group-hover:text-highlight-icon" size={24} />
                        <div className="flex flex-col text-right">
                            <span className="text-hero-heading font-semibold group-hover:text-hero-primary-main">סמסטר חורף</span>
                            <span className="text-hero-muted text-sm">מבני נתונים, הסתברות, לוגיקה, כימיה</span>
                        </div>
                    </Link>
                    <Link
                        href="/2026/semester-b"
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-hero-primary-main/10 border border-hero-primary-border hover:border-hero-primary-main transition-colors group"
                    >
                        <Folder className="text-highlight group-hover:text-highlight-icon" size={24} />
                        <div className="flex flex-col text-right">
                            <span className="text-hero-heading font-semibold group-hover:text-hero-primary-main">סמסטר אביב</span>
                            <span className="text-hero-muted text-sm">נגלה בהמשך...</span>
                            <div className="px-24"></div>
                        </div>
                    </Link>
                </div>
            </div>
            <div className="bg-background w-full flex flex-col justify-baseline items-baseline px-5 py-2">
                <div className="w-full border-b-2 text-hero-primary-main border-accent-border flex flex-row justify-between items-baseline px-2">
                    <h1 className="text-5xl text-hero-primary-main font-bold">שנה ג'</h1>
                    <h2 className="text-2xl text-hero-primary-main/50">התשפ"ח 2027-2028</h2>
                </div>
                <div className="w-full flex flex-row justify-baseline gap-10 items-center pt-3 pb-5 px-5">
                    <Link
                        href="/2027/semester-a"
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-hero-primary-main/10 border border-hero-primary-border hover:border-hero-primary-main transition-colors group"
                    >
                        <Folder className="text-highlight group-hover:text-highlight-icon" size={24} />
                        <div className="flex flex-col text-right">
                            <span className="text-hero-heading font-semibold group-hover:text-hero-primary-main">סמסטר חורף</span>
                            <span className="text-hero-muted text-sm">נגלה בהמשך...</span>
                            <div className="px-24"></div>
                        </div>
                    </Link>
                    <Link
                        href="/2027/semester-b"
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-hero-primary-main/10 border border-hero-primary-border hover:border-hero-primary-main transition-colors group"
                    >
                        <Folder className="text-highlight group-hover:text-highlight-icon" size={24} />
                        <div className="flex flex-col text-right">
                            <span className="text-hero-heading font-semibold group-hover:text-hero-primary-main">סמסטר אביב</span>
                            <span className="text-hero-muted text-sm">נגלה בהמשך...</span>
                            <div className="px-24"></div>
                        </div>
                    </Link>
                </div>
            </div>
            </div>
            <Footer />
        </main>
    );
}
