import Link from 'next/link';
import { getVaultTree, TreeItem } from '@/lib/vault';

// Recursive component to render the folders and files
function TOCNode({ item }: { item: TreeItem }) {
    if (item.isDirectory) {
        return (
            <details 
                className="group ml-0 mr-4 mt-2 mb-2" 
                open // Default to folders being open. Remove this if you want them closed!
            >
                <summary className="cursor-pointer font-bold text-lg text-blue-400 hover:text-blue-300 list-none flex items-center gap-2 select-none">
                    {/* Triangle arrow that rotates when open */}
                    <span className="text-sm transition-transform duration-200 group-open:-rotate-90">
                        ◀
                    </span>
                    {item.title}
                </summary>
                
                <ul className="pr-4 border-r-2 border-gray-700/50 mt-2 space-y-1">
                    {item.children?.map((child) => (
                        <li key={child.path}>
                            <TOCNode item={child} />
                        </li>
                    ))}
                </ul>
            </details>
        );
    }

    // If it's a file, render a link
    return (
        <div className="py-1 mr-6 flex items-center before:content-['•'] before:text-gray-600 before:ml-2">
            <Link 
                href={item.path}
                className="text-gray-300 hover:text-orange-400 transition-colors"
            >
                {item.title}
            </Link>
        </div>
    );
}

// The main page component
export default function TableOfContentsPage() {
    // Generate the tree on the server
    const vaultTree = getVaultTree();

    return (
        <main className="max-w-4xl mx-auto p-8" dir="rtl">
            <header className="mb-8 border-b border-gray-700 pb-4">
                <h1 className="text-4xl font-bold text-gray-100">תוכן עניינים</h1>
                <p className="text-gray-400 mt-2">
                    המחברת המלאה - בחר נושא כדי להתחיל לקרוא
                </p>
            </header>

            <article className="bg-[#1e1e1e] p-6 rounded-lg border border-gray-700/50 shadow-lg">
                {vaultTree.length === 0 ? (
                    <p className="text-gray-400">לא נמצאו קבצים. ודא שהרצת את סקריפט הסנכרון.</p>
                ) : (
                    <ul className="space-y-4">
                        {vaultTree.map((node) => (
                            <li key={node.path}>
                                <TOCNode item={node} />
                            </li>
                        ))}
                    </ul>
                )}
            </article>
        </main>
    );
}