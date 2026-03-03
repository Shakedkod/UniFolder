import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export default function RenderMD({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                // 1. Flatten text blocks
                p: ({ node, ...props }) => <span {...props} />,
                blockquote: ({ node, ...props }) => (
                    <span className="border-r-2 border-highlight/50 pr-2 mr-1 text-gray-400 italic" {...props} />
                ),

                // 2. Flatten lists into a single line separated by commas
                ul: ({ node, ...props }) => <span className="space-x-1" {...props} />,
                ol: ({ node, ...props }) => <span className="space-x-1" {...props} />,
                li: ({ node, ...props }) => <span className="after:content-[',_'] last:after:content-['']" {...props} />,

                // 3. Flatten headers so they don't get massive
                h1: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,
                h2: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,
                h3: ({ node, ...props }) => <span className="font-bold text-gray-300" {...props} />,

                // 4. Style code blocks so they look like inline badges instead of massive dark boxes
                code: ({ node, className, children, ...props }) => {
                    return (
                        <code className="bg-gray-800 text-orange-200 px-1.5 py-0.5 rounded text-xs mx-0.5" {...props}>
                            {children}
                        </code>
                    );
                },
                pre: ({ node, children, ...props }) => (
                    <span className="inline-block" {...props}>
                        {children}
                    </span>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}