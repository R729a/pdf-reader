'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  return (
    <div className="markdown-content text-xs text-slate-200 leading-relaxed overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-sm sm:text-base font-bold text-white mt-3 mb-2 pb-1 border-b border-slate-700/60 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xs sm:text-sm font-bold text-indigo-300 mt-3 mb-1.5 first:mt-0 flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-slate-100 mt-2.5 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-slate-300 mt-2 mb-1 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-200">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-300">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2 space-y-1.5 text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1.5 text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children, className, ...props }: any) => {
            const isTaskList = className?.includes('task-list-item');
            return (
              <li
                className={`leading-relaxed text-slate-200 ${
                  isTaskList ? 'list-none -ml-4 flex items-start gap-2 my-1' : ''
                }`}
                {...props}
              >
                {children}
              </li>
            );
          },
          input: ({ type, checked, ...props }: any) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  disabled
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-indigo-500 accent-indigo-500 cursor-default shrink-0 inline-block align-middle"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500 bg-indigo-500/10 pl-3 py-1.5 my-2 text-slate-300 italic rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isMultiLine = String(children).includes('\n');

            if (!match && !isMultiLine) {
              return (
                <code
                  className="bg-slate-950/90 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-slate-800 font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="my-2.5 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-sm">
                {match && (
                  <div className="px-3 py-1 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {match[1]}
                  </div>
                )}
                <pre className="p-3 overflow-x-auto text-[11px] font-mono text-slate-200 leading-relaxed custom-scrollbar">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/80 shadow-sm custom-scrollbar">
              <table className="w-full text-left border-collapse text-[11px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-900 border-b border-slate-700 text-slate-200 font-semibold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 border-r border-slate-800 last:border-r-0 font-semibold text-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-slate-800/80 border-r last:border-r-0 text-slate-300">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-slate-700/60" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors font-medium"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
