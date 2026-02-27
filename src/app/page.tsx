import { TopBar, Hero, SearchBar, Folders, Footer } from "@/components/Home";

export default async function Home() {

    return (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <TopBar />
            <Hero />
            <SearchBar />
            <Folders />
            <Footer />
        </main>
    );
}
