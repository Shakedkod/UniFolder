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
    title: "Uni Folder",
    description: "Displays my uni folder and notes for the public to see.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en" className="light" suppressContentEditableWarning>
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
