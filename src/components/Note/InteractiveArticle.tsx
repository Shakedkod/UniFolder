"use client";

import { memo, useEffect, useRef } from "react";
import { renderInGraphPlaceholders } from "@/components/NoteComponents/InGraphBlock";

const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function InteractiveArticle({ html, isCodeFile = false }: { html: string; isCodeFile?: boolean }) {
    const articleRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!articleRef.current) return;

        // ── 1. Render in-graph placeholders ──────────────────────────────────
        renderInGraphPlaceholders(articleRef.current);

        // ── 2. Annotate graph wrappers with their type badge ─────────────────
        articleRef.current.querySelectorAll<HTMLDivElement>(".in-graph-static-wrapper").forEach(wrapper => {
            const svg = wrapper.querySelector("svg");
            // Detect circuit (has gate elements) vs automaton
            const hasGates = wrapper.querySelector(".in-graph-gate");
            wrapper.dataset.graphType = hasGates ? "Circuit" : "Automaton";
        });

        // ── 3. Code block copy buttons ───────────────────────────────────────
        const preTags = articleRef.current.querySelectorAll("pre");
        preTags.forEach(pre => {
            if (pre.dataset.processed === "true") return;
            pre.dataset.processed = "true";

            let targetContainer: HTMLElement = pre;

            if (isCodeFile) {
                const wrapper = document.createElement("div");
                wrapper.dir = "ltr";
                wrapper.className = "flex w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 shadow-sm bg-slate-50 dark:bg-slate-900 relative";
                pre.parentNode?.insertBefore(wrapper, pre);

                const codeNode = pre.querySelector("code");
                const codeText = codeNode ? codeNode.innerText : pre.innerText;
                const lineCount = codeText.replace(/\n$/, "").split("\n").length;

                const numbersDiv = document.createElement("div");
                numbersDiv.className = "flex flex-col text-right px-3 py-6 bg-slate-100 dark:bg-slate-800/50 text-slate-400 select-none border-r border-slate-200 dark:border-slate-700 font-mono text-sm leading-[1.5]";
                let numHtml = "";
                for (let i = 1; i <= lineCount; i++) numHtml += `<span class="min-w-[1.5rem]">${i}</span>`;
                numbersDiv.innerHTML = numHtml;

                pre.classList.add("!m-0", "!border-none", "!shadow-none", "!rounded-none", "bg-transparent", "flex-1", "overflow-x-auto");
                wrapper.appendChild(numbersDiv);
                wrapper.appendChild(pre);
                targetContainer = wrapper;
            } else {
                pre.style.position = "relative";
            }

            const btn = document.createElement("button");
            btn.className = "copy-btn absolute top-3 right-3 p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all border border-slate-300/50 dark:border-slate-600/50 shadow-sm z-10 backdrop-blur-sm";
            btn.innerHTML = copyIcon;
            btn.title = "העתק קוד";
            btn.addEventListener("click", async () => {
                const codeNode = pre.querySelector("code");
                const codeText = codeNode ? codeNode.innerText : pre.innerText;
                await navigator.clipboard.writeText(codeText);
                btn.innerHTML = checkIcon;
                btn.classList.add("text-green-600", "dark:text-green-400", "border-green-500/50");
                setTimeout(() => {
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
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export default memo(InteractiveArticle);