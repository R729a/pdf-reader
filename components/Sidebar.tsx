'use client';

import React, { useState } from 'react';
import { PDFDocument } from '@/types';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  BookOpen, 
  HardDrive,
  AlertTriangle
} from 'lucide-react';

interface SidebarProps {
  documents: PDFDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onOpenUploadModal: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  activeDocumentId,
  onSelectDocument,
  onDeleteDocument,
  onOpenUploadModal,
  isOpen,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [docToDelete, setDocToDelete] = useState<PDFDocument | null>(null);

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleConfirmDelete = () => {
    if (docToDelete) {
      onDeleteDocument(docToDelete.id);
      setDocToDelete(null);
    }
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
          <button
            id="sidebar-upload-btn"
            onClick={() => {
              onOpenUploadModal();
              onCloseMobile();
            }}
            className="btn-primary w-full py-2.5"
          >
            <Plus className="w-4 h-4" />
            <span>Upload PDF</span>
          </button>

          {/* Search documents */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Document Library List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="px-2 py-1 flex items-center justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5">
              <span>Your Documents</span>
              <span className="text-[11px] font-normal text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded-full">
                {filteredDocs.length}
              </span>
            </span>
            <BookOpen className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          </div>

          {filteredDocs.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium text-slate-400">No PDFs found</p>
              <p className="text-[11px] text-slate-500 mt-1">Upload a PDF file (up to 50MB) to begin AI chat.</p>
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isActive = doc.id === activeDocumentId;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDocument(doc.id);
                    onCloseMobile();
                  }}
                  className={`group relative flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
                    isActive
                      ? 'bg-indigo-600/15 border-indigo-500/40 text-slate-100 shadow-sm'
                      : 'bg-slate-950/30 border-transparent hover:bg-slate-800/60 hover:border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 
                        className="text-xs font-semibold line-clamp-2 break-words leading-snug"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{doc.pageCount} pages</span>
                        <span>•</span>
                        <span>{formatSize(doc.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delete document button (clean in-app confirmation) */}
                  <button
                    id={`delete-doc-${doc.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDocToDelete(doc);
                    }}
                    title="Delete Document"
                    className="btn-icon text-slate-400 hover:text-red-400 hover:bg-red-500/20 border-transparent ml-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info & Storage usage */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-slate-400 text-xs">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 text-slate-300">
              <HardDrive className="w-3 h-3 text-indigo-400" /> Storage Status
            </span>
            <span className="text-emerald-400 font-medium">Ready</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full w-[25%]" />
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Strict Privacy: All vector embeddings & PDF text are processed locally.
          </p>
        </div>
      </aside>

      {/* Modern In-App Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Delete Document</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Are you sure you want to delete <strong className="text-white font-semibold">"{docToDelete.filename}"</strong>? 
              Its extracted text and all chat history will be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                id="cancel-delete-btn"
                onClick={() => setDocToDelete(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                onClick={handleConfirmDelete}
                className="btn-danger"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
