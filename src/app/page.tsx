import { SearchBar, Footer } from "@/components/Home";
import {
    Folder,
    BookOpen,
    GraduationCap,
    FileCode,
    Sparkles,
    ArrowLeft,
    Download,
    ExternalLink,
    LineChart,
    FileText,
    CheckCircle2,
    Clock,
    Layers,
    Binary
} from "lucide-react";
import Link from "next/link";

interface CourseBadge {
    name: string;
    code: string;
    url?: string;
}

interface SemesterInfo {
    title: string;
    subtitle: string;
    url: string;
    courses: CourseBadge[];
    isActive?: boolean;
    isUpcoming?: boolean;
}

interface YearInfo {
    yearName: string;
    academicYear: string;
    hebrewYear: string;
    status: {
        text: string;
        type: 'completed' | 'current' | 'upcoming';
    };
    semesters: SemesterInfo[];
}

const YEARS_DATA: YearInfo[] = [
    {
        yearName: "שנה א'",
        academicYear: "2025-2026",
        hebrewYear: 'התשפ"ו',
        status: { text: "הושלמה", type: "completed" },
        semesters: [
            {
                title: "סמסטר חורף",
                subtitle: "סמסטר א'",
                url: "/2025/semester-a",
                courses: [
                    { name: "אינפי 1מ'", code: "01040031", url: "/2025/semester-a/01040031" },
                    { name: "אלגברה אמ'", code: "01040166", url: "/2025/semester-a/01040166" },
                    { name: "מבוא למדמ\"ח מ'", code: "02340114", url: "/2025/semester-a/02340114" },
                    { name: "קבוצות ואוטומטים", code: "02340129", url: "/2025/semester-a/02340129" },
                    { name: "פיזיקה 1מ'", code: "01140071", url: "/2025/semester-a/01140071" },
                ],
            },
            {
                title: "סמסטר אביב",
                subtitle: "סמסטר ב'",
                url: "/2025/semester-b",
                courses: [
                    { name: "אינפי 2מ'", code: "01040032", url: "/2025/semester-b/01040032" },
                    { name: "מערכות ספרתיות", code: "00440252", url: "/2025/semester-b/00440252" },
                    { name: "תכנות מערכות", code: "02340124", url: "/2025/semester-b/02340124" },
                    { name: "אלגוריתמים נומריים", code: "02340125", url: "/2025/semester-b/02340125" },
                    { name: "קומבינטוריקה", code: "02340141", url: "/2025/semester-b/02340141" },
                    { name: "פיזיקה 2", code: "01140052", url: "/2025/semester-b/01140052" },
                ],
            },
        ],
    },
    {
        yearName: "שנה ב'",
        academicYear: "2026-2027",
        hebrewYear: 'התשפ"ז',
        status: { text: "שנה נוכחית", type: "current" },
        semesters: [
            {
                title: "סמסטר חורף",
                subtitle: "סמסטר א'",
                url: "/2026/semester-a",
                isActive: true,
                courses: [
                    { name: "מבני נתונים 1", code: "02340218", url: "/2026/semester-a/02340218" },
                    { name: "לוגיקה למדמ\"ח", code: "02340292", url: "/2026/semester-a/02340292" },
                    { name: "הסתברות מ'", code: "00940412", url: "/2026/semester-a/00940412" },
                    { name: "אלגברה מודרנית ח'", code: "01040134", url: "/2026/semester-a/01040134" },
                    { name: "יסודות הכימיה", code: "01240120", url: "/2026/semester-a/01240120" },
                    { name: "מדע דת ופילוסופיה", code: "03250010", url: "/2026/semester-a/03250010" },
                ],
            },
            {
                title: "סמסטר אביב",
                subtitle: "סמסטר ב'",
                url: "/2026/semester-b",
                isUpcoming: true,
                courses: [],
            },
        ],
    },
    {
        yearName: "שנה ג'",
        academicYear: "2027-2028",
        hebrewYear: 'התשפ"ח',
        status: { text: "בהמשך", type: "upcoming" },
        semesters: [
            {
                title: "סמסטר חורף",
                subtitle: "סמסטר א'",
                url: "/2027/semester-a",
                isUpcoming: true,
                courses: [],
            },
            {
                title: "סמסטר אביב",
                subtitle: "סמסטר ב'",
                url: "/2027/semester-b",
                isUpcoming: true,
                courses: [],
            },
        ],
    },
];

const POPULAR_QUICK_LINKS = [
    { title: "אינפי 1מ'", href: "/2025/semester-a/01040031" },
    { title: "אינפי 2מ'", href: "/2025/semester-b/01040032" },
    { title: "מבני נתונים 1", href: "/2026/semester-a/02340218" },
    { title: "אלגוריתמים נומריים", href: "/2025/semester-b/02340125" },
    { title: "קומבינטוריקה", href: "/2025/semester-b/02340141" },
    { title: "מערכות ספרתיות", href: "/2025/semester-b/00440252" },
    { title: "לוגיקה", href: "/2026/semester-a/02340292" },
    { title: "הסתברות", href: "/2026/semester-a/00940412" },
];

export default async function Home() {
    return (
        <main className="w-full min-h-screen flex flex-col items-center justify-start bg-background text-foreground" dir="rtl">
            {/* ======================================================== */}
            {/* HERO & SEARCH SECTION                                    */}
            {/* ======================================================== */}
            <section className="relative w-full overflow-hidden bg-hero-background pt-16 pb-12 sm:pt-24 sm:pb-20 border-b border-button-border-light">
                {/* Subtle Radial Grid Pattern */}
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--hero-grid-pattern)_1px,transparent_1px)] bg-size-[24px_24px] opacity-35"></div>

                <div className="max-w-5xl mx-auto px-6 sm:px-8 text-center flex flex-col items-center relative z-10">
                    {/* Status Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-hero-background text-hero-primary-hover text-sm font-semibold mb-6 border border-hero-primary-border shadow-xs">
                        <Sparkles size={16} className="text-highlight animate-pulse" />
                        <span>מאגר הסיכומים והרשימות • מדעי המחשב בטכניון</span>
                    </div>

                    {/* Main Headline */}
                    <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-hero-heading tracking-tight mb-5 leading-tight">
                        תיקיית הסיכומים <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-l from-hero-primary-main via-highlight to-hero-accent-main">
                            לתואר במדעי המחשב
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-base sm:text-lg md:text-xl text-hero-body mb-8 max-w-2xl mx-auto leading-relaxed">
                        מאגר סיכומים אישי ומקיף: הרצאות, תרגולים, מטלות בית, הוכחות וקוד.
                        מסונכרן אוטומטית מכספת ה-Obsidian עם אפשרות חיפוש מהיר והורדת קבצי LaTeX ו-PDF.
                    </p>

                    {/* Search Bar Container */}
                    <div className="w-full max-w-2xl mx-auto mb-6">
                        <SearchBar size={2} />
                    </div>

                    {/* Quick Course Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl pt-2">
                        <span className="text-xs text-really-light-text font-medium ml-2">גישה מהירה:</span>
                        {POPULAR_QUICK_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-xs px-3 py-1.5 rounded-full bg-background/80 hover:bg-hero-primary-main/10 border border-hero-border-subtle hover:border-hero-primary-main text-foreground transition-all duration-150 shadow-2xs hover:shadow-xs"
                            >
                                {link.title}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ======================================================== */}
            {/* YEARS & SEMESTERS SECTION                                */}
            {/* ======================================================== */}
            <section className="w-full max-w-5xl mx-auto px-6 sm:px-8 py-16 flex flex-col gap-14">
                <div className="flex flex-col gap-2 border-b border-button-border-light pb-4">
                    <div className="flex items-center gap-3 text-hero-heading">
                        <GraduationCap className="text-highlight" size={32} />
                        <h2 className="text-3xl font-bold">שנות הלימוד</h2>
                    </div>
                </div>

                <div className="flex flex-col gap-12">
                    {YEARS_DATA.map((year) => (
                        <div
                            key={year.yearName}
                            className="flex flex-col bg-background border border-button-border-light rounded-2xl p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200"
                        >
                            {/* Year Header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-button-border-light pb-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                                        {year.yearName}
                                    </h3>
                                    <span className="text-sm sm:text-base text-really-light-text font-normal">
                                        ({year.hebrewYear} • {year.academicYear})
                                    </span>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                                    style={{
                                        borderColor:
                                            year.status.type === 'completed'
                                                ? 'rgba(34, 197, 94, 0.3)'
                                                : year.status.type === 'current'
                                                    ? 'rgba(59, 130, 246, 0.4)'
                                                    : 'rgba(156, 163, 175, 0.3)',
                                        backgroundColor:
                                            year.status.type === 'completed'
                                                ? 'rgba(34, 197, 94, 0.08)'
                                                : year.status.type === 'current'
                                                    ? 'rgba(59, 130, 246, 0.08)'
                                                    : 'rgba(156, 163, 175, 0.08)',
                                        color:
                                            year.status.type === 'completed'
                                                ? '#16a34a'
                                                : year.status.type === 'current'
                                                    ? '#2563eb'
                                                    : '#6b7280',
                                    }}
                                >
                                    {year.status.type === 'completed' && <CheckCircle2 size={14} />}
                                    {year.status.type === 'current' && <Clock size={14} className="animate-spin" />}
                                    <span>{year.status.text}</span>
                                </div>
                            </div>

                            {/* Semesters Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {year.semesters.map((sem) => (
                                    <div
                                        key={sem.title}
                                        className="flex flex-col justify-between bg-accent-background/40 hover:bg-hero-primary-main/5 border border-button-border-light hover:border-hero-primary-main rounded-xl p-5 sm:p-6 transition-all duration-200 group"
                                    >
                                        <div className="flex flex-col gap-4">
                                            {/* Semester Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-lg bg-background border border-button-border-light text-highlight group-hover:text-highlight-icon group-hover:border-hero-primary-main transition-colors">
                                                        <Folder size={22} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <h4 className="text-lg font-bold text-foreground group-hover:text-hero-primary-main transition-colors">
                                                            {sem.title}
                                                        </h4>
                                                        <span className="text-xs text-really-light-text font-medium">
                                                            {sem.subtitle}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Link
                                                    href={sem.url}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-highlight group-hover:text-highlight-icon group-hover:translate-x-[-2px] transition-all pt-1"
                                                >
                                                    <span>כניסה לתיקייה</span>
                                                    <ArrowLeft size={14} />
                                                </Link>
                                            </div>

                                            {/* Course Chips */}
                                            {sem.courses.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {sem.courses.map((course) => (
                                                        <Link
                                                            key={course.code}
                                                            href={course.url || sem.url}
                                                            className="text-xs px-2.5 py-1 rounded-md bg-background border border-button-border-light hover:border-highlight text-foreground/90 hover:text-highlight transition-colors flex items-center gap-1.5"
                                                        >
                                                            <span className="font-medium">{course.name}</span>
                                                            <span className="text-[10px] text-really-light-text font-mono">
                                                                {course.code}
                                                            </span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-6 text-center text-really-light-text text-sm">
                                                    {sem.isUpcoming ? "הקורסים יתווספו עם תחילת הסמסטר" : "אין עדיין קורסים זמינים"}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer Link */}
                                        <div className="pt-4 mt-4 border-t border-button-border-light/60 flex items-center justify-between text-xs text-really-light-text">
                                            <span>
                                                {sem.courses.length > 0 ? `${sem.courses.length} קורסים זמינים` : "בבנייה"}
                                            </span>
                                            <Link
                                                href={sem.url}
                                                className="text-foreground hover:text-highlight font-medium transition-colors"
                                            >
                                                צפייה בכל החומרים ←
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ======================================================== */}
            {/* EXTRA FILES & RESOURCES SECTION                         */}
            {/* ======================================================== */}
            <section className="w-full bg-accent-background/30 border-y border-button-border-light py-16">
                <div className="max-w-5xl mx-auto px-6 sm:px-8 flex flex-col gap-10">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-hero-heading">
                            <Layers className="text-highlight" size={30} />
                            <h2 className="text-3xl font-bold">קבצים נוספים וחומרי עזר</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <p className="">יהיו בקרוב</p>
                    </div>
                </div>
            </section>

            {/* ======================================================== */}
            {/* FOOTER                                                   */}
            {/* ======================================================== */}
            <Footer />
        </main>
    );
}
