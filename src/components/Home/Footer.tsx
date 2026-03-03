import Link from 'next/link';
import { BookOpen, Github, AlertCircle, Code2 } from 'lucide-react';
import ThemeMenu from '../ThemeMenu';

export default function Footer() {
    return (
        <footer className="w-full bg-background border-t border-button-border-light pt-16 pb-8" dir="rtl">
            <div className="max-w-5xl mx-auto px-8">
                
                {/* Main Footer Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    
                    {/* Column 1: Brand & Disclaimer */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-footer-title font-bold text-xl">
                            <BookOpen size={24} />
                            <span>תיקיית הסיכומים</span>
                        </div>
                        <p className="text-really-light-text text-sm leading-relaxed">
                            מאגר סיכומים אישי לסטודנטים למדעי המחשב בטכניון ובשאר האוניברסיטאות הכולל אפשרות חיפוש מהיר בכל הקבצים.
                        </p>
                        
                        {/* Integrated Subtle Disclaimer */}
                        <div className="flex items-start gap-2 mt-2 bg-really-light-accent-bg border border-really-light-accent-border p-3 rounded-xl">
                            <AlertCircle className="text-accent-foreground shrink-0 mt-0.5" size={16} />
                            <p className="text-xs text-slate-600 leading-relaxed">
                                <strong>דיסקליימר:</strong> החומר אינו רשמי ועלול להכיל טעויות (במיוחד בשיעורי הבית). קחו בערבון מוגבל!
                            </p>
                        </div>
                    </div>

                    {/* Column 2: Quick Links */}
                    <div className="flex flex-col gap-4 md:pr-8">
                        <h3 className="font-semibold text-foreground-heading-1">ניווט מהיר</h3>
                        <ul className="flex flex-col gap-3 text-sm text-really-light-text">
                            <li>
                                <Link href="/2025" className="hover:text-highlight hover:-translate-x-1 transition-all flex w-fit">
                                    שנה א׳
                                </Link>
                            </li>
                            <li>
                                <Link href="/2026" className="hover:text-highlight hover:-translate-x-1 transition-all flex w-fit">
                                    שנה ב׳
                                </Link>
                            </li>
                            <li>
                                <Link href="/2027" className="hover:text-highlight hover:-translate-x-1 transition-all flex w-fit">
                                    שנה ג׳
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Column 3: Tech Stack & Socials */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-foreground-heading-1">מאחורי הקלעים</h3>
                        <p className="text-sm text-really-light-text leading-relaxed">
                            האתר נבנה באמצעות Next.js ו-Tailwind CSS, ומסונכרן אוטומטית מתוך כספת ה-Obsidian האישית שלי.
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                            <a 
                                href="https://github.com/ShakedKod" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-2.5 bg-button-bg border border-button-border-light text-button-foreground rounded-lg hover:bg-button-border-light hover:text-highlight hover:border-highlight-icon transition-all"
                                aria-label="GitHub Profile"
                            >
                                <Github size={18} />
                            </a>
                            <div className="p-2.5 bg-button-bg border border-button-border-light text-button-foreground rounded-lg cursor-default" title="Built with React & Next.js">
                                <Code2 size={18} />
                            </div>
                        </div>
                        <ThemeMenu />
                    </div>
                </div>

                {/* Bottom Copyright Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-hero-section-background text-sm text-really-light-text">
                    <p>© {new Date().getFullYear()} שקד קוד</p>
                </div>
            </div>
        </footer>
    );
}