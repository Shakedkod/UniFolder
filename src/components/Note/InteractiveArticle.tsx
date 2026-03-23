"use client";

import {memo, useEffect, useRef} from "react";
import {createRoot} from "react-dom/client";
import GraphRenderer from "@/components/NoteComponents/InGraphBlock";
import {GraphData} from "@/lib/inGraphTypes";

const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

// Added isCodeFile prop
function InteractiveArticle({html, isCodeFile = false}: { html: string, isCodeFile?: boolean })
{
    const articleRef = useRef<HTMLElement>(null);
    const graphRootsRef = useRef<ReturnType<typeof createRoot>[]>([]);

    useEffect(() =>
    {
        if (!articleRef.current) return;

        // ── Mount graph renderers ──────────────────────────────────────
        const placeholders = articleRef.current.querySelectorAll<HTMLElement>(".in-graph-placeholder");
        //console.log("Found graph placeholders:", placeholders);
        placeholders.forEach(el =>
        {
            if (el.dataset.mounted === "true") return;
            el.dataset.mounted = "true";

            const encoded = el.getAttribute("data-graph");
            if (!encoded) return;
            try
            {
                const data: GraphData = JSON.parse(decodeURIComponent(encoded));
                const root = createRoot(el);
                root.render(<GraphRenderer data={data}/>);
                graphRootsRef.current.push(root);
            } catch (e)
            {
                el.textContent = "Graph render error";
            }
        });

        // ────────────────────────────────────────────────────────────────────

        const preTags = articleRef.current.querySelectorAll("pre");

        preTags.forEach((pre) =>
        {
            // Prevent adding multiple buttons/wrappers if React re-renders
            if (pre.dataset.processed === "true") return;
            pre.dataset.processed = "true";

            // Determine where the copy button should be anchored
            let targetContainer: HTMLElement = pre;

            // --- THE LINE NUMBER INJECTOR (Only for dedicated code files) ---
            if (isCodeFile)
            {
                // 1. Create the outer flex wrapper
                const wrapper = document.createElement("div");
                wrapper.dir = "ltr";
                wrapper.className = "flex w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 shadow-sm bg-slate-50 dark:bg-slate-900 relative";

                // Insert wrapper before the pre, then move the pre inside it
                pre.parentNode?.insertBefore(wrapper, pre);

                // 2. Extract text to count lines
                const codeNode = pre.querySelector("code");
                const codeText = codeNode ? codeNode.innerText : pre.innerText;
                const lineCount = codeText.replace(/\n$/, "").split("\n").length;

                // 3. Create the numbers sidebar
                const numbersDiv = document.createElement("div");
                numbersDiv.className = "flex flex-col text-right px-3 py-6 bg-slate-100 dark:bg-slate-800/50 text-slate-400 select-none border-r border-slate-200 dark:border-slate-700 font-mono text-sm leading-[1.5]";

                let numHtml = "";
                for (let i = 1; i <= lineCount; i++)
                {
                    numHtml += `<span class="min-w-[1.5rem]">${i}</span>`;
                }
                numbersDiv.innerHTML = numHtml;

                // 4. Strip standard pre classes so it fits cleanly in the wrapper
                pre.classList.add("!m-0", "!border-none", "!shadow-none", "!rounded-none", "bg-transparent", "flex-1", "overflow-x-auto");

                // Assemble the new layout
                wrapper.appendChild(numbersDiv);
                wrapper.appendChild(pre);

                // Make the copy button attach to the new outer wrapper
                targetContainer = wrapper;
            } else
            {
                // Standard Markdown files just need the <pre> to act as an anchor
                pre.style.position = "relative";
            }

            // --- THE COPY BUTTON ---
            const btn = document.createElement("button");
            btn.className = "copy-btn absolute top-3 right-3 p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all border border-slate-300/50 dark:border-slate-600/50 shadow-sm z-10 backdrop-blur-sm";
            btn.innerHTML = copyIcon;
            btn.title = "העתק קוד";

            btn.addEventListener("click", async () =>
            {
                const codeNode = pre.querySelector("code");
                const codeText = codeNode ? codeNode.innerText : pre.innerText;

                await navigator.clipboard.writeText(codeText);

                btn.innerHTML = checkIcon;
                btn.classList.add("text-green-600", "dark:text-green-400", "border-green-500/50");

                setTimeout(() =>
                {
                    btn.innerHTML = copyIcon;
                    btn.classList.remove("text-green-600", "dark:text-green-400", "border-green-500/50");
                }, 2000);
            });

            targetContainer.appendChild(btn);
        });
    }, [html, isCodeFile]);

    return (
        <article
            ref={articleRef}
            className="academic-preview w-full no-scrollbar"
            dangerouslySetInnerHTML={{__html: html}}
        />
    );
}

export default memo(InteractiveArticle);