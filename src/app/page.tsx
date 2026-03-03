import { Hero, SearchBar, Footer } from "@/components/Home";

export default async function Home() {

    return (
        <main className="w-full min-h-screen flex flex-col items-center justify-start gap-10 bg-accent-background text-foreground">
            <Hero />
            <SearchBar />
            <Footer />
        </main>
    );
}
