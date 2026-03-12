"use client";

import dynamic from 'next/dynamic';
import { useTheme } from '../../ThemeProvider';
import PdfSidebar from './PdfSidebar';
import { useRef, useState } from 'react';

const DynamicPdf = dynamic(() => import('./PdfViewer'), {
    ssr: false
});

export default function PdfViewerWrap({ pdfUrl, fileName, parentUrl, parentName, title }: {
    pdfUrl: string;
    fileName: string;
    parentUrl: string;
    parentName: string;
    title: string;
}) {
    const { activeTheme } = useTheme();
    const darkThemes = ['dark', 'night', 'deep-ocean'];

    return (
        <DynamicPdf
            pdfUrl={pdfUrl}
            fileName={title}
            isDark={darkThemes.includes(activeTheme || '') ? 'dark' : 'light'}
            parent={{ url: parentUrl, name: parentName }}
        />
    );
}