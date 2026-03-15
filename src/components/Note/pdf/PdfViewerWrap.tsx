"use client";

import dynamic from 'next/dynamic';

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

    return (
        <DynamicPdf
            pdfUrl={pdfUrl}
            fileName={title}
            parent={{ url: parentUrl, name: parentName }}
        />
    );
}