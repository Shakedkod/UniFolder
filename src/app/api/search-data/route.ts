import { getCourseContext } from '../../../lib/vault';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const file = "/search-index.json"; // appears in the public folder
    const res = fs.readFileSync(path.join(process.cwd(), 'public', file), 'utf8');
    const data = JSON.parse(res);

    // Enrich the data with course context
    const enrichedData = data.map((item: any) => {
        const courseContext = getCourseContext(item.path);
        return { ...item, courseName: courseContext };
    });

    return NextResponse.json(enrichedData);
}