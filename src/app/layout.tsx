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

export const metadata: Metadata = {
    title: "תיקיית הסיכומים לתואר במדעי המחשב",
    description: "מאגר סיכומים ורשימות של תואר במדעי המחשב שאני כעת לומד בטכניון.",
    icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en" className="light" suppressContentEditableWarning>
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
