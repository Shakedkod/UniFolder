'use client';

import React, { Fragment } from 'react';
import * as prod from 'react/jsx-runtime';
import { unified } from 'unified';
import rehypeReact from 'rehype-react';
import CustomCodeBlock from './CustomCodeBlock';
import Image from 'next/image';

const production = { Fragment, jsx: prod.jsx, jsxs: prod.jsxs };

const processor = unified()
    .use(rehypeReact, {
        ...production,
        components: {
            pre: CustomCodeBlock,

            img: (props: any) => (
                <Image
                    src={props.src}
                    alt={props.alt || ''}
                    width={800}
                    height={500}
                    className="rounded-lg max-w-full h-auto"
                />
            ),

            h1: (props: any) => <h1 className="text-3xl font-bold my-4 text-purple-400" {...props} />,
            h2: (props: any) => <h2 className="text-2xl font-bold my-4 text-purple-300" {...props} />,
            h3: (props: any) => <h3 className="text-xl font-bold my-4 text-purple-200" {...props} />,
            h4: (props: any) => <h4 className="text-lg font-bold my-4 text-purple-100" {...props} />,
            h5: (props: any) => <h5 className="text-base font-bold my-4 text-purple-50" {...props} />,
            h6: (props: any) => <h6 className="text-sm font-bold my-4 text-purple-50" {...props} />
        },
    });

export default function MarkdownRenderer({ ast }: { ast: any }) 
{
    return processor.stringify(ast);
}