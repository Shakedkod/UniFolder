import { redirect } from "next/navigation";

const COURSE_SHORT_NAME_TO_URL: { [key: string]: string } = {
    "infi1": "/2025/semester-a/01040031",
    "infi2": "/2025/semester-b/01040032",
    "physics1": "/2025/semester-a/01140071",
    "physics2": "/2025/semester-b/01140052",
    "algebra": "/2025/semester-a/01040166",
    "matka": "/2025/semester-a/02340129",
    "mtm": "/2025/semester-b/02340124",
    "combinatorics": "/2025/semester-b/02340141",
    "combi": "/2025/semester-b/02340141",
    "semester-a": "/2025/semester-a",
    "semester-b": "/2025/semester-b",
    "semester-c": "/2026/semester-a",
    "semester-d": "/2026/semester-b",
    "semester-e": "/2027/semester-a",
    "semester-f": "/2027/semester-b",
    "semA": "/2025/semester-a",
    "semB": "/2025/semester-b",
    "semC": "/2026/semester-a",
    "semD": "/2026/semester-b",
    "semE": "/2027/semester-a",
    "semF": "/2027/semester-b",
    "semester1": "/2025/semester-a",
    "semester2": "/2025/semester-b",
    "semester3": "/2026/semester-a",
    "semester4": "/2026/semester-b",
    "semester5": "/2027/semester-a",
    "semester6": "/2027/semester-b"
}

export default async function RedirectPage({ params }: { params: { courseShortName: string[] } })
{
    const resolvedParams = await params;
    const courseShortName = resolvedParams.courseShortName[0];

    // Redirect to the course's main page
    if (COURSE_SHORT_NAME_TO_URL[courseShortName])
    {
        redirect(COURSE_SHORT_NAME_TO_URL[courseShortName]);
    }
}