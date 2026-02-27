import { NextResponse } from 'next/server';

export async function GET() {
    // Keep the key private in your .env (NO NEXT_PUBLIC_ PREFIX!)
    const apiKey = process.env.DESMOS_API_KEY; 
    const url = `https://www.desmos.com/api/v1.8/calculator.js?apiKey=${apiKey}`;

    try {
        const response = await fetch(url);
        const scriptContent = await response.text();

        return new NextResponse(scriptContent, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache it for 1 hour
            },
        });
    } catch (error) {
        return new NextResponse('Failed to load script', { status: 500 });
    }
}