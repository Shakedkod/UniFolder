"use client";

import React, { useState } from "react";

export default function CustomCodeBlock(props: any) {
    // rehype passes children. Usually <pre> contains a <code> element.
    // We need to drill down to get the raw text if we want to copy it.

    // This is a simplified extraction. 
    // In reality, props.children might be the <code> element.
    const codeElement = React.Children.toArray(props.children)[0] as React.ReactElement;
    const codeText = codeElement?.props?.children || "";

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e]">
            {/* The Header / Copy Button */}
            <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] text-xs text-gray-400">
                <span>Code</span>
                <button
                    onClick={handleCopy}
                    className="hover:text-white transition-colors"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>

            {/* The Code Content */}
            <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed" dir="ltr">
                {props.children}
            </div>
        </div>
    );
}