export default function RootLayout({ children }: Readonly<{children: React.ReactNode;}>) 
{
    return (
        <div dir="rtl">
            { children }
        </div>
    );
}