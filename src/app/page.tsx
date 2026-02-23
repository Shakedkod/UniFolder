export default async function Home() {

    return (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <h1 className="text-2xl font-bold mb-4">Markdown Test Renderer</h1>

            <div className="markdown-preview-view" dir="rtl" suppressHydrationWarning>
            </div>
        </main>
    );
}
