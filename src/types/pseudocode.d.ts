declare module 'pseudocode' {
    export function renderToString(input: string, options?: {
        indentSize?: string;
        commentDelimiter?: string;
        lineNumber?: boolean;
        lineNumberPunc?: string;
        noEnd?: boolean;
        captionCount?: number;
        mathEngine?: string;
        mathRenderer?: (s: string) => string;
    }): string;
}