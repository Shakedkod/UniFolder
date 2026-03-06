import { isVaultDirectory, getFolderTitle } from '@/lib/vault';
import FolderPage from '@/components/Note/FolderPage';
import NoteContent from '@/components/Note/NoteContent';

export default async function NotePage({ params }: { params: { slug: string[] } }) {
    const resolvedParams = await params;
    const currentSlug = resolvedParams.slug;

    // ==========================================
    // SHARED LOGIC: Calculate Parent Directory
    // ==========================================
    // Remove the last item from the array to get the parent path
    const parentSlug = currentSlug.slice(0, -1);

    // If parentSlug is empty, it means we are at the root, so go to '/' instead of an empty path
    // Otherwise, join the remaining parts with a slash
    const parentUrl = parentSlug.length > 0 ? `/${parentSlug.join('/')}` : '/';

    // Get the name of the parent folder to display in the button (fallback to 'ראשי' / Main)
    const parentName = parentSlug.length > 0
        ? getFolderTitle(decodeURIComponent(parentSlug[parentSlug.length - 1]))
        : 'תיקייה ראשית';

    // ==========================================
    // 1. THE FOLDER INTERCEPTOR
    // ==========================================
    if (isVaultDirectory(currentSlug)) {
        return <FolderPage currentSlug={currentSlug} parentUrl={parentUrl} parentName={parentName} />;
    }

    // ==========================================
    // 2. THE STANDARD NOTE/CODE RENDERER
    // ==========================================
    return <NoteContent currentSlug={currentSlug} parentUrl={parentUrl} parentName={parentName} />;
}