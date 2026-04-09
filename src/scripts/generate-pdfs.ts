import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { VAULT_DIRECTORY } from "@/lib/vault";

const BASE_URL = "http://localhost:3000"; // run against local dev server
const OUT_DIR = path.join(process.cwd(), "public", "generated-pdfs");

async function getAllNoteSlugs(): Promise<string[][]> {
    // Walk your vault directory and collect all .json note files
    const slugs: string[][] = [];

    function walk(dir: string, parts: string[]) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name), [...parts, entry.name]);
            } else if (entry.name.endsWith(".json")) {
                const data = JSON.parse(fs.readFileSync(path.join(dir, entry.name), "utf8"));
                if (data.type !== "pdf") { // skip already-pdf notes
                    slugs.push([...parts, entry.name.replace(".json", "")]);
                }
            }
        }
    }

    walk(VAULT_DIRECTORY, []);
    return slugs;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const browser = await puppeteer.launch({ headless: true });
    const slugs = await getAllNoteSlugs();

    for (const slug of slugs) {
        const url = `${BASE_URL}/${slug.map(encodeURIComponent).join("/")}`;
        const outPath = path.join(OUT_DIR, ...slug.slice(0, -1), slug.at(-1)! + ".pdf");

        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

            // Wait for MathJax/KaTeX to finish rendering if you use it
            await page.evaluate(() => document.fonts.ready);

            await page.pdf({
                path: outPath,
                format: "A4",
                printBackground: true,
                displayHeaderFooter: false, // you handle this in CSS
                margin: { top: "55px", bottom: "50px", left: "10mm", right: "10mm" },
                tagged: true, // embeds real accessible text
            });

            await page.close();
            console.log(`✓ ${slug.join("/")}`);
        } catch (e) {
            console.error(`✗ ${slug.join("/")}:`, e);
        }
    }

    await browser.close();
}

main();