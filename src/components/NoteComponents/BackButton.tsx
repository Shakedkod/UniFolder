import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function BackButton({ url, name, bg }: { url: string; name: string; bg?: "light" | "dark" }) {
    return (
        <div className=" pb-4">
            <Link
                href={url}
                className={`inline-flex items-center gap-2 transition-colors text-sm font-medium ${bg === "light" ? "text-foreground-heading-2 hover:text-highlight" : "text-accent2-border hover:text-highlight"}`}
            >
                <ArrowRight size={16} />
                <span>חזור לתיקייה: {name}</span>
            </Link>
        </div>
    );
}