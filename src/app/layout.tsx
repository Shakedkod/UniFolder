import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Search from "@/components/Search";

import "./globals.css";
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

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

export default function RootLayout({ children }: Readonly<{children: React.ReactNode;}>) 
{
    return (
        <html lang= "en" >
            <body className={ `${geistSans.variable} ${geistMono.variable} antialiased` } dir="rtl">
                <Search />
                { children }
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
