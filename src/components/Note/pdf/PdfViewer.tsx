"use client";

import { useEffect, useState } from 'react';
import '@react-pdf-viewer/core/lib/styles/index.css';
import { RenderPageProps, TextDirection } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    Maximize,
    RotateCw,
    Download as DownloadIcon,
    Search as SearchIcon,
    ArrowRight
} from 'lucide-react';
import Link from "next/link";
import { ThemeMenuCircleButton } from '@/components/ThemeMenu';

const btnStyle: React.CSSProperties = { cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', color: 'white' };

export default function PdfViewer({ pdfUrl, isDark, fileName, parent }: { pdfUrl: string; isDark: string; fileName: string; parent: { url: string; name: string; } }) {
    const [Component, setComponent] = useState<any>(null);

    const defaultLayoutPluginInstance = defaultLayoutPlugin({
        renderToolbar: (Toolbar: any) => (
            <Toolbar>
                {(slots: any) => {
                    const {
                        CurrentPageInput, EnterFullScreen,
                        NumberOfPages, Rotate, ShowSearchPopover, Zoom,
                        ZoomIn, ZoomOut,
                    } = slots;

                    return (
                        <div className="flex w-full top-0 bg-accent2-background border-b border-accent2-border shadow-lg flex-col items-center justify-start px-4 pt-1">
                            <div className="flex w-full bg-accent2-background flex-row items-center justify-between px-4">
                                <Link href={parent.url} className="p-2 text-accent2-border hover:text-highlight">
                                    <ArrowRight size={24} />
                                </Link>
                                <h1 className="text-lg font-bold text-accent2-foreground truncate mx-4">{fileName}</h1>
                                <ThemeMenuCircleButton />
                            </div>
                            <div className="flex flex-row items-center justify-center pt-2">
                                <CurrentPageInput>
                                    {(props: any) => (
                                        <button
                                            style={btnStyle}
                                            onClick={props.onClick}
                                        >
                                            {props.currentPage}
                                        </button>
                                    )}
                                </CurrentPageInput>
                                <span style={{ padding: '0 4px', color: 'white' }}>/</span>
                                {NumberOfPages()}
                                <div style={{ width: "10px" }}></div>
                                <EnterFullScreen>
                                    {(props: any) => (
                                        <button
                                            style={btnStyle}
                                            onClick={props.onClick}
                                        >
                                            <Maximize size={18} />
                                        </button>
                                    )}
                                </EnterFullScreen>
                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isDark ? '#333' : '#eee', borderRadius: '4px', margin: '0px 10px' }}>
                                    <ZoomOut>
                                        {(props: any) => (
                                            <button
                                                style={btnStyle}
                                                onClick={props.onClick}
                                            >
                                                <ZoomOutIcon size={18} />
                                            </button>
                                        )}
                                    </ZoomOut>
                                    <Zoom />
                                    <ZoomIn>
                                        {(props: any) => (
                                            <button
                                                style={btnStyle}
                                                onClick={props.onClick}
                                            >
                                                <ZoomInIcon size={18} />
                                            </button>
                                        )}
                                    </ZoomIn>
                                </div>
                                <ShowSearchPopover>
                                    {(props: any) => (
                                        <button
                                            style={btnStyle}
                                            onClick={props.onClick}
                                        >
                                            <SearchIcon size={18} />
                                        </button>
                                    )}
                                </ShowSearchPopover>
                                <Rotate>
                                    {(props: any) => (
                                        <button
                                            style={btnStyle}
                                            onClick={props.onClick}
                                        >
                                            <RotateCw size={18} />
                                        </button>
                                    )}
                                </Rotate>
                                <div
                                    onClick={async () => {
                                        const response = await fetch(pdfUrl);
                                        const blob = await response.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = fileName || 'document.pdf';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    style={{ cursor: 'pointer', padding: '0 8px', fontSize: '18px' }}
                                    title="Download"
                                >
                                    <DownloadIcon size={18} />
                                </div>
                            </div>
                        </div>
                    );
                }}
            </Toolbar>
        ),

    });

    useEffect(() => {
        // We import the libraries ONLY inside useEffect (browser-only)
        Promise.all([
            import('@react-pdf-viewer/core'),
            import('@react-pdf-viewer/core/lib/styles/index.css' as any)
        ]).then(([core]) => {
            setComponent({
                Viewer: core.Viewer,
                Worker: core.Worker
            });
        });
    }, []);

    if (!Component) return <div className="p-10 text-center">טוען סביבת עבודה...</div>;

    const { Viewer, Worker } = Component;
    console.log('Rendering PDF Viewer with URL:', pdfUrl);

    return (
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <div style={{ height: '100vh', width: '100%' }}>
                <Viewer
                    fileUrl={pdfUrl}
                    theme={{
                        theme: isDark ? "dark" : "light",
                        direction: TextDirection.RightToLeft,
                    }}
                    plugins={[defaultLayoutPluginInstance]}
                />
            </div>
        </Worker>
    );
}