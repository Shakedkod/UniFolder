import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Search from "@/components/Search";

import "./globals.css";
import 'katex/dist/katex.min.css';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? (process.env.NEXT_PUBLIC_SITE_URL.startsWith('http') ? process.env.NEXT_PUBLIC_SITE_URL : `https://${process.env.NEXT_PUBLIC_SITE_URL}`)
    : (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://uni-folder.vercel.app'));

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: "תיקיית הסיכומים לתואר במדעי המחשב",
        template: "%s | תיקיית הסיכומים",
    },
    description: "מאגר סיכומים, תרגולים וחומרי לימוד אינטראקטיביים לתואר ראשון במדעי המחשב בטכניון. כולל נוסחאות LaTeX, גרפים של Desmos, דיאגרמות, סיכומי PDF וקוד.",
    applicationName: "תיקיית הסיכומים",
    authors: [{ name: "ShakedKod", url: "https://github.com/ShakedKod" }],
    creator: "ShakedKod",
    publisher: "תיקיית הסיכומים",
    keywords: [
        "מדעי המחשב",
        "טכניון",
        "סיכומים",
        "אינפי",
        "אלגברה",
        "מערכות ספרתיות",
        "תכנות מערכות",
        "קבוצות ואוטומטים",
        "Technion",
        "Computer Science",
        "BSc CS",
        "Uni-Folder"
    ],
    icons: {
        icon: [
            { url: "/favicon.ico" },
            { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
            { url: "/favicon.svg", type: "image/svg+xml" },
        ],
        apple: [
            { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
    },
    manifest: "/site.webmanifest",
    openGraph: {
        type: "website",
        locale: "he_IL",
        url: "/",
        siteName: "תיקיית הסיכומים לתואר במדעי המחשב",
        title: "תיקיית הסיכומים לתואר במדעי המחשב | הטכניון",
        description: "מאגר סיכומים, תרגולים וחומרי לימוד אינטראקטיביים לתואר ראשון במדעי המחשב בטכניון. כולל נוסחאות LaTeX, גרפים של Desmos, דיאגרמות, סיכומי PDF וקוד.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "תיקיית הסיכומים לתואר במדעי המחשב | הטכניון",
                type: "image/png",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "תיקיית הסיכומים לתואר במדעי המחשב | הטכניון",
        description: "מאגר סיכומים, תרגולים וחומרי לימוד אינטראקטיביים לתואר ראשון במדעי המחשב בטכניון.",
        images: ["/og-image.png"],
    },
    alternates: {
        canonical: "/",
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="he" className="light" suppressContentEditableWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            try {
                                // Change 'theme' to whatever key your ThemeProvider uses to save in localStorage!
                                const savedTheme = localStorage.getItem('theme'); 

                                if (savedTheme) {
                                    document.documentElement.classList.add(savedTheme);
                                } else {
                                    // Fallback to OS preference if they've never picked a theme
                                    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                    document.documentElement.classList.add(isDark ? 'dark' : 'light');
                                }
                            } catch (e) {}
                        `,
                    }}
                />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} dir="rtl">
                <ThemeProvider>
                    <Search />
                    {children}
                    <Analytics />
                    <SpeedInsights />
                </ThemeProvider>
            </body>
        </html>
    );
}
