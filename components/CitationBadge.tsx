import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

interface CitationBadgeProps {
  pageNumber: number;
  snippet?: string;
  onClickPage?: (page: number) => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  pageNumber,
  snippet,
  onClickPage,
}) => {
  return (
    <button
      onClick={() => onClickPage && onClickPage(pageNumber)}
      title={snippet ? `Page ${pageNumber}: "${snippet}"` : `Jump to Page ${pageNumber}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all duration-150 group cursor-pointer my-1 mr-1.5"
    >
      <BookOpen className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
      <span>Page {pageNumber}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
    </button>
  );
};
