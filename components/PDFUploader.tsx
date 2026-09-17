'use client';

import React, { useState, useRef } from 'react';
import { PDFService, MAX_FILE_SIZE_BYTES } from '@/services/pdf-service';
import { PDFStorage } from '@/lib/pdf-storage';
import { PDFDocument } from '@/types';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X, Sparkles } from 'lucide-react';

interface PDFUploaderProps {
  userId: string;
  onUploadSuccess: (document: PDFDocument) => void;
  onClose?: () => void;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  userId,
  onUploadSuccess,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrorMessage(null);

    // Validate file
    const validation = PDFService.validateFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file');
      return;
    }

    setIsProcessing(true);
    setProgressStatus('Extracting pages and text content...');

    try {
      const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      
      // Extract PDF content and generate semantic vector chunks
      setProgressStatus('Building vector embeddings for RAG...');
      const extracted = await PDFService.processPDF(file, docId);

      // Create blob and persistent storage for rendering in Raw PDF viewer
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const dataUrl = URL.createObjectURL(blob);

      // Persist binary into IndexedDB so it survives page reloads
      await PDFStorage.store(docId, blob);
      PDFStorage.setCachedUrl(docId, dataUrl);

      const newDoc: PDFDocument = {
        id: docId,
        userId,
        filename: extracted.filename,
        fileSize: extracted.fileSize,
        uploadDate: new Date().toISOString(),
        processingStatus: 'ready',
        pageCount: extracted.pageCount,
        extractedText: extracted.extractedText,
        chunks: extracted.chunks,
        dataUrl,
      };

      setProgressStatus('Complete!');
      onUploadSuccess(newDoc);
      if (onClose) onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to process PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-lg w-full relative max-h-[90dvh] overflow-y-auto">
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close upload modal"
          className="btn-icon w-8 h-8 absolute top-3 right-3 text-slate-400 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-3 mb-4 pr-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Upload PDF Document</h2>
          <p className="text-xs text-slate-400">Select a file to parse, summarize, and start AI voice chat</p>
        </div>
      </div>

      {/* Drag & Drop / Tap Target Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950/80'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf,.pdf"
          onChange={(e) => e.target.files && e.target.files[0] && handleFile(e.target.files[0])}
          className="hidden"
          aria-label="Upload PDF file"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-200">{progressStatus}</p>
            <p className="text-xs text-slate-400 mt-1">Extracting text & generating vector chunks...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <p className="text-sm font-medium text-slate-200">
              Drag & Drop your PDF file here, or <span className="text-indigo-400 font-semibold underline">browse</span>
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="btn-primary mt-3 text-xs py-2 px-4 sm:hidden min-h-[40px]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose PDF File</span>
            </button>
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-400 mt-3 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>PDF format only</span>
              <span>•</span>
              <span>Max size: 50MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
