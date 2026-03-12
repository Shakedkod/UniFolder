import { FileText, FileCode, Folder } from "lucide-react";
import { FaRegFilePdf } from "react-icons/fa";
import Link from "next/link";

export default function ItemLink({ name, url, type, size }: { name: string; url: string; type: string; size?: number }) {
    return (
        <Link
            key={url}
            href={url}
            className="flex items-center gap-3 p-4 rounded-xl border border-button-border bg-button-bg hover:border-highlight hover:bg-button-hover-bg/5 transition-all group"
        >
            {(type === "folder") ? (
                <Folder className="text-accent-foreground shrink-0 group-hover:text-accent-foreground-hover" size={size || 24} />
            ) : (type === "pdf") ? (
                <FaRegFilePdf className="text-accent2-background shrink-0 group-hover:text-highlight" size={size || 24} />
            ) : (type === "code") ? (
                <FileCode className="text-accent2-background shrink-0 group-hover:text-highlight" size={size || 24} />
            ) : (
                <FileText className="text-accent2-background shrink-0 group-hover:text-highlight" size={size || 24} />
            )}
            <span className={`${size ? `text-${size}px` : 'text-base'} text-button-foreground truncate`}>
                {name}
            </span>
        </Link>
    );
}