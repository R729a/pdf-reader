'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PDFDocument } from '@/types';
import { TTSService, TTSState, ProcessedDocument } from '@/services/tts-service';
import { PDFStorage } from '@/lib/pdf-storage';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  RotateCw,
  Search, 
  FileText, 
  Play,
  Pause,
  Volume2,
  Headphones,
  Square,
  Sliders,
  Gauge,
  ChevronDown,
  Radio,
  X,
  ExternalLink
} from 'lucide-react';

interface PDFViewerProps {
  document: PDFDocument | null;
  targetPage?: number;
  highlightText?: string;
  onToggleFloatingPlayer?: () => void;
  isFloatingPlayerOpen?: boolean;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const PDFViewer: React.FC<PDFViewerProps> = ({
  document: docProp,
  targetPage = 1,
  highlightText,
  onToggleFloatingPlayer,
  isFloatingPlayerOpen = false,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'interactive' | 'iframe'>('interactive');
  const [ttsState, setTtsState] = useState<TTSState>(TTSService.getState());
  const [showAudioStudio, setShowAudioStudio] = useState<boolean>(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [isLoadingPdfBinary, setIsLoadingPdfBinary] = useState<boolean>(false);
  const [manualHighlightWordIndex, setManualHighlightWordIndex] = useState<number | null>(null);
  const [manualHighlightRange, setManualHighlightRange] = useState<{ start: number; end: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = TTSService.subscribe((state) => setTtsState(state));
    return () => unsubscribe();
  }, []);

  // Resolve persistent binary URL for Raw PDF mode
  useEffect(() => {
    let isCancelled = false;
    if (!docProp) {
      setActivePdfUrl(null);
      return;
    }

    const resolveUrl = async () => {
      setIsLoadingPdfBinary(true);
      try {
        // 1. Try to get active cached URL or retrieve from IndexedDB
        let url = await PDFStorage.getActiveUrl(docProp.id);

        // 2. If not found in storage, check if docProp.dataUrl is valid
        if (!url && docProp.dataUrl && !docProp.dataUrl.startsWith('blob:')) {
          url = docProp.dataUrl;
        }

        // 3. Fallback: synthesize valid standard PDF for demo/text document
        if (!url && docProp.extractedText) {
          const rawPages = docProp.extractedText.split(/--- Page \d+ ---/i).filter(p => p.trim());
          const pages = rawPages.length > 0 
            ? rawPages.map((text, idx) => ({ pageNumber: idx + 1, text: text.trim() }))
            : [{ pageNumber: 1, text: docProp.extractedText }];
          
          const blob = PDFStorage.generatePdfFromPages(docProp.filename, pages);
          await PDFStorage.store(docProp.id, blob);
          url = URL.createObjectURL(blob);
          PDFStorage.setCachedUrl(docProp.id, url);
        }

        if (!isCancelled && url) {
          setActivePdfUrl(url);
        }
      } catch (err) {
        console.warn('Error resolving PDF binary for Raw view:', err);
      } finally {
        if (!isCancelled) setIsLoadingPdfBinary(false);
      }
    };

    resolveUrl();
    return () => {
      isCancelled = true;
    };
  }, [docProp]);

  // Pre-process document into structured words and pages
  const processedDoc: ProcessedDocument | null = useMemo(() => {
    if (!docProp) return null;
    return TTSService.processDocument(`doc_${docProp.id}`, docProp.filename, docProp.extractedText);
  }, [docProp]);

  // Sync target page from props
  useEffect(() => {
    if (targetPage && targetPage > 0 && docProp && targetPage <= docProp.pageCount) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, docProp]);

  // Get current page structured data
  const currentPageData = processedDoc?.pages.find(p => p.pageNumber === currentPage);

  // User interaction: clicking a citation in chat passes highlightText and targetPage
  useEffect(() => {
    if (!highlightText || !currentPageData) return;
    const pageWords = currentPageData.paragraphs.flatMap(p => p.chunks.flatMap(c => c.words));
    if (pageWords.length === 0) return;

    const cleanTokens = highlightText
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (cleanTokens.length === 0) return;

    for (let i = 0; i <= pageWords.length - Math.min(cleanTokens.length, 2); i++) {
      let matches = 0;
      for (let j = 0; j < Math.min(cleanTokens.length, 5); j++) {
        if (i + j < pageWords.length) {
          const wTok = pageWords[i + j].word.toLowerCase().replace(/[^\w\s\u0900-\u097F]/gi, '').trim();
          if (wTok && cleanTokens[j] && (wTok.includes(cleanTokens[j]) || cleanTokens[j].includes(wTok))) {
            matches++;
          }
        }
      }
      if (matches >= 2 || (cleanTokens.length === 1 && matches >= 1)) {
        setManualHighlightRange({
          start: pageWords[i].globalWordIndex,
          end: pageWords[Math.min(pageWords.length - 1, i + cleanTokens.length - 1)].globalWordIndex,
        });
        setManualHighlightWordIndex(null);
        return;
      }
    }
  }, [highlightText, currentPageData]);

  // Multi-page PDF automatic page turning during audio narration
  useEffect(() => {
    if (
      (ttsState.status === 'playing' || ttsState.status === 'paused') &&
      ttsState.currentPdfPage &&
      ttsState.currentPdfPage !== currentPage &&
      docProp &&
      ttsState.currentPdfPage <= docProp.pageCount
    ) {
      setCurrentPage(ttsState.currentPdfPage);
    }
  }, [ttsState.currentPdfPage, ttsState.status, currentPage, docProp]);

  // Auto-scroll to ensure currently spoken word is kept visible in the viewport
  useEffect(() => {
    if (
      (ttsState.status === 'playing' || ttsState.status === 'paused') &&
      ttsState.currentPdfWordIndex !== null &&
      ttsState.currentPdfWordIndex !== undefined
    ) {
      const el = document.getElementById(`word-${ttsState.currentPdfWordIndex}`);
      if (el) {
        const container = canvasRef.current;
        if (container) {
          const cRect = container.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();

          // Smoothly scroll only when word touches or exceeds visible boundary
          const isAbove = eRect.top < cRect.top + 70;
          const isBelow = eRect.bottom > cRect.bottom - 70;

          if (isAbove || isBelow) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    }
  }, [ttsState.currentPdfWordIndex, ttsState.status]);

  if (!docProp) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-400 border-r border-slate-800">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <FileText className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-sm font-semibold text-slate-300">No PDF selected</p>
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
          Select an uploaded PDF from the sidebar or upload a document to view side-by-side.
        </p>
      </div>
    );
  }

  const isPlayingThisDoc = ttsState.currentMessageId === `doc_${docProp.id}` && ttsState.status === 'playing';
  const isPausedThisDoc = ttsState.currentMessageId === `doc_${docProp.id}` && ttsState.status === 'paused';

  const handleReadEntirePDF = () => {
    if (isPlayingThisDoc) {
      TTSService.pause();
    } else if (isPausedThisDoc) {
      TTSService.resume();
    } else {
      TTSService.speakEntireDocument(`doc_${docProp.id}`, docProp.filename, docProp.extractedText);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < docProp.pageCount) setCurrentPage(currentPage + 1);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoom(100);

  // User interaction: manual text selection with mouse cursor
  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !currentPageData) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return;

    const pageWords = currentPageData.paragraphs.flatMap(p => p.chunks.flatMap(c => c.words));
    if (pageWords.length === 0) return;

    const selTokens = selectedText
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (selTokens.length === 0) return;

    for (let i = 0; i <= pageWords.length - selTokens.length; i++) {
      let match = true;
      for (let j = 0; j < selTokens.length; j++) {
        const wTok = pageWords[i + j].word.toLowerCase().replace(/[^\w\s\u0900-\u097F]/gi, '').trim();
        if (!wTok.includes(selTokens[j]) && !selTokens[j].includes(wTok)) {
          match = false;
          break;
        }
      }
      if (match) {
        setManualHighlightRange({
          start: pageWords[i].globalWordIndex,
          end: pageWords[i + selTokens.length - 1].globalWordIndex,
        });
        setManualHighlightWordIndex(null);
        return;
      }
    }
  };

  // User interaction: clicking a word toggles manual highlight marker OR seeks TTS audio directly to word
  const handleWordClick = (globalWordIndex: number) => {
    // If TTS is playing or paused, clicking seeks and continues playback seamlessly
    if (ttsState.status === 'playing' || ttsState.status === 'paused') {
      TTSService.seekToWord(globalWordIndex);
      return;
    }

    if (manualHighlightWordIndex === globalWordIndex) {
      setManualHighlightWordIndex(null);
    } else {
      setManualHighlightWordIndex(globalWordIndex);
      setManualHighlightRange(null);
    }
  };

  // Check whether a word should display the fixed yellow highlight marker
  const isWordHighlighted = (globalWordIndex: number, wordText: string): boolean => {
    if (manualHighlightWordIndex === globalWordIndex) return true;
    if (manualHighlightRange && globalWordIndex >= manualHighlightRange.start && globalWordIndex <= manualHighlightRange.end) {
      return true;
    }
    if (searchQuery.trim().length > 1 && wordText.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
      return true;
    }
    return false;
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 border-r border-slate-800 overflow-hidden select-text">
      {/* Top Toolbar */}
      <div className="border-b border-slate-800 bg-slate-900/95 px-2 sm:px-3 py-1.5 sm:h-12 flex flex-wrap sm:flex-nowrap items-center justify-between text-xs gap-1.5 sm:gap-2 shrink-0">
        {/* Page Navigation */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="btn-icon w-8 h-8"
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 px-2 h-8 font-mono text-xs text-slate-300 bg-slate-950 rounded-lg border border-slate-800">
            <span className="hidden xs:inline text-slate-400">Page</span>
            <input
              type="number"
              min={1}
              max={docProp.pageCount}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= docProp.pageCount) setCurrentPage(val);
              }}
              className="w-7 sm:w-8 text-center bg-transparent focus:outline-none font-semibold text-indigo-400"
              aria-label="Current page number"
            />
            <span className="text-slate-500">/ {docProp.pageCount}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= docProp.pageCount}
            className="btn-icon w-8 h-8"
            title="Next Page"
            aria-label="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search within document (Desktop) */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 h-8 max-w-[170px]">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Find text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
            aria-label="Find text in document"
          />
        </div>

        {/* Zoom, Mode & TTS Options */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Mobile search toggle button */}
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            className={`btn-icon w-8 h-8 md:hidden ${isMobileSearchOpen ? '!bg-indigo-600/30 !text-indigo-300 !border-indigo-500/40' : ''}`}
            title="Search text"
            aria-label="Search text in document"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Segmented View Mode Toggle: Interactive vs Raw PDF */}
          <div 
            className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs h-8"
            role="group"
            aria-label="Document View Mode"
          >
            <button
              id="view-mode-interactive-btn"
              onClick={() => setViewMode('interactive')}
              className={`h-7 px-2 sm:px-3 rounded-lg font-medium text-[11px] sm:text-xs transition-all flex items-center ${
                viewMode === 'interactive'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Interactive View: word-by-word TTS highlighting"
            >
              Interactive
            </button>
            <button
              id="view-mode-raw-btn"
              onClick={() => setViewMode('iframe')}
              className={`h-7 px-2 sm:px-3 rounded-lg font-medium text-[11px] sm:text-xs transition-all flex items-center ${
                viewMode === 'iframe'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Raw PDF View"
            >
              Raw PDF
            </button>
            {viewMode === 'iframe' && activePdfUrl && (
              <a
                href={activePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 ml-0.5 transition-colors"
                title="Open PDF in new tab"
                aria-label="Open PDF in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleZoomOut}
              className="btn-icon w-8 h-8"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="h-8 px-1.5 sm:px-2 rounded-lg text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors flex items-center"
              title="Reset Zoom"
              aria-label="Reset Zoom to 100%"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="btn-icon w-8 h-8"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TTS Narration Studio Quick Trigger */}
          <button
            id="top-narration-studio-btn"
            onClick={() => setShowAudioStudio(!showAudioStudio)}
            className={`btn-secondary text-xs h-8 px-2 sm:px-3 hidden sm:flex items-center gap-1.5 ${
              showAudioStudio ? '!bg-indigo-600/30 !text-indigo-300 !border-indigo-500/50' : ''
            }`}
            title="Toggle Audiobook Narration Studio"
            aria-expanded={showAudioStudio}
            aria-label="Toggle Audiobook Narration Studio"
          >
            <Headphones className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="hidden md:inline">TTS Narration</span>
          </button>
        </div>
      </div>

      {/* Mobile Expandable Search Bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 h-8">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Find text in document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(false);
              setSearchQuery('');
            }}
            className="btn-ghost text-xs px-2 h-8"
          >
            Close
          </button>
        </div>
      )}

      {/* Main Document Content Canvas / Viewer */}
      <div 
        ref={canvasRef}
        tabIndex={0}
        role="region"
        aria-label="Document content viewer"
        className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 md:p-6 bg-slate-950 custom-scrollbar focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
      >
        {viewMode === 'iframe' ? (
          <div className="w-full h-full min-h-[550px] flex flex-col relative rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
            {activePdfUrl ? (
              <iframe
                src={`${activePdfUrl}#page=${currentPage}&toolbar=1`}
                className="w-full h-full flex-1 rounded-xl bg-white border-0"
                title={docProp.filename}
              />
            ) : isLoadingPdfBinary ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-8">
                <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-slate-300">Loading Raw PDF...</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-8">
                <p className="text-sm font-semibold text-slate-300">Generating Raw PDF view...</p>
                <button
                  onClick={() => setViewMode('interactive')}
                  className="btn-primary text-xs"
                >
                  Return to Interactive View
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-full w-fit mx-auto flex flex-col items-center min-h-full">
            <div
              id="document-page-card"
              style={{
                zoom: `${zoom}%`,
              }}
              className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-8 shadow-2xl relative flex flex-col justify-between min-h-[380px] sm:min-h-[520px] transition-[zoom] duration-150"
            >
              <div className="flex-1 min-h-0">
                {/* Page Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4 text-slate-400 text-xs font-mono">
                  <span className="truncate max-w-[240px] text-slate-300 font-semibold">{docProp.filename}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-semibold shrink-0">
                    Page {currentPage} of {docProp.pageCount}
                  </span>
                </div>

                {/* Rendered Document Page Text with Exact Word Spans */}
                <div 
                  className="text-slate-300 text-sm leading-relaxed font-sans space-y-4 break-words select-text"
                  onMouseUp={handleTextMouseUp}
                >
                  {currentPageData && currentPageData.paragraphs.length > 0 ? (
                    currentPageData.paragraphs.map((para, pIdx) => (
                      <p key={pIdx} className="leading-7 break-words">
                        {para.chunks.map((chunk) => (
                          <React.Fragment key={chunk.chunkIndex}>
                            {chunk.words.map((word) => {
                              const isCurrentSpokenWord =
                                (ttsState.status === 'playing' || ttsState.status === 'paused') &&
                                ttsState.currentPdfWordIndex === word.globalWordIndex;
                              const isManualOrSearch = isWordHighlighted(word.globalWordIndex, word.word);

                              return (
                                <span
                                  key={word.id}
                                  id={`word-${word.globalWordIndex}`}
                                  onClick={() => handleWordClick(word.globalWordIndex)}
                                  className={`cursor-pointer rounded transition-all duration-75 select-text ${
                                    isCurrentSpokenWord
                                      ? 'bg-yellow-400 text-slate-950 font-extrabold px-1.5 py-0.5 shadow-md ring-2 ring-yellow-400/90 scale-105 inline-block mx-0.5 z-10'
                                      : isManualOrSearch
                                      ? 'bg-amber-500/30 text-amber-200 border-b-2 border-amber-400 px-1 py-0.5 rounded'
                                      : 'text-slate-200 hover:bg-slate-800/80 px-0.5'
                                  }`}
                                  title={
                                    isCurrentSpokenWord
                                      ? `Currently spoken word: "${word.word}"`
                                      : ttsState.status === 'playing' || ttsState.status === 'paused'
                                      ? `Click to seek audio to "${word.word}"`
                                      : isManualOrSearch
                                      ? `Highlighted marker on "${word.word}"`
                                      : `Click to highlight or read "${word.word}"`
                                  }
                                >
                                  {word.word}{' '}
                                </span>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">No printable text content on page {currentPage}.</p>
                  )}
                </div>
              </div>

              {/* Document Page Footer */}
              <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-center text-xs">
                <span className="text-[11px] text-slate-500 font-mono">
                  --- End of Page {currentPage} of {docProp.pageCount} ---
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Docked Audiobook Narration Studio Tray */}
      {showAudioStudio && (
        <div 
          className="border-t border-slate-800 bg-slate-900/98 backdrop-blur-xl px-4 py-3 animate-in slide-in-from-bottom-2 duration-150 shrink-0 shadow-2xl"
          role="region"
          aria-label="Audiobook Narration Studio"
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                ttsState.status === 'playing' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                <Radio className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>Audiobook Narration Studio</span>
                {ttsState.status === 'playing' && (
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Speaking
                  </span>
                )}
                {ttsState.status === 'paused' && (
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Paused
                  </span>
                )}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAudioStudio(false)}
                className="btn-icon w-7 h-7 min-w-[28px] min-h-[28px]"
                title="Close Narration Studio"
                aria-label="Close Narration Studio"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* 1. Voice Selector */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <label htmlFor="tts-voice-select" className="flex items-center gap-1.5 cursor-pointer">
                  <Volume2 className="w-3 h-3 text-indigo-400" />
                  <span>Voice Profile</span>
                </label>
              </div>
              <div className="relative">
                <select
                  id="tts-voice-select"
                  value={ttsState.selectedVoiceName}
                  onChange={(e) => TTSService.setVoice(e.target.value)}
                  className="w-full h-8 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 pr-8 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                  aria-label="Select Narration Voice"
                >
                  {ttsState.availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 2. Speed Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <label htmlFor="tts-speed-slider" className="flex items-center gap-1.5 cursor-pointer">
                  <Gauge className="w-3 h-3 text-indigo-400" />
                  <span>Speed Rate</span>
                </label>
                <span className="font-mono font-bold text-indigo-300 text-[11px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {ttsState.rate.toFixed(2)}x
                </span>
              </div>
              <div className="h-8 flex items-center">
                <input
                  id="tts-speed-slider"
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={ttsState.rate}
                  onChange={(e) => TTSService.setRate(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                  aria-label="Speech Speed Rate"
                  aria-valuemin={0.5}
                  aria-valuemax={2.5}
                  aria-valuenow={ttsState.rate}
                  aria-valuetext={`${ttsState.rate.toFixed(2)}x speed`}
                />
              </div>
            </div>

            {/* 3. Pitch Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <label htmlFor="tts-pitch-slider" className="flex items-center gap-1.5 cursor-pointer">
                  <Sliders className="w-3 h-3 text-indigo-400" />
                  <span>Voice Pitch</span>
                </label>
                <span className="font-mono text-slate-200 text-[11px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {ttsState.pitch.toFixed(1)}
                </span>
              </div>
              <div className="h-8 flex items-center">
                <input
                  id="tts-pitch-slider"
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={ttsState.pitch}
                  onChange={(e) => TTSService.setPitch(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                  aria-label="Speech Voice Pitch"
                  aria-valuemin={0.5}
                  aria-valuemax={1.5}
                  aria-valuenow={ttsState.pitch}
                  aria-valuetext={`Pitch ${ttsState.pitch.toFixed(1)}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Sticky Bottom Bar: Media Player Audiobook Bar */}
      <div className="min-h-[58px] sm:h-16 border-t border-slate-800 bg-slate-900/98 px-2.5 sm:px-4 py-1.5 sm:py-0 flex items-center justify-between gap-2 sm:gap-4 shrink-0 shadow-lg safe-bottom">
        {/* Document & Playback Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[110px] xs:max-w-[150px] sm:max-w-[240px]">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isPlayingThisDoc
                ? 'bg-indigo-600 text-white animate-pulse-glow'
                : 'bg-slate-800 text-indigo-400'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-200 block text-xs truncate" title={docProp.filename}>
              {docProp.filename}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="text-indigo-400 font-mono">P.{currentPage}/{docProp.pageCount}</span>
              <span className="hidden xs:inline">•</span>
              <span className="hidden xs:inline font-mono">{processedDoc ? `${processedDoc.totalWords}w` : '0w'}</span>
            </div>
          </div>
        </div>

        {/* Center: Media Player Controls with Scrubbable Progress Bar */}
        <div className="flex-1 max-w-xl flex flex-col items-center gap-0.5 sm:gap-1 min-w-0">
          {/* Controls: [◀ 10s] [Play/Pause] [Stop] [10s ▶] */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => TTSService.seekBackward(10)}
              disabled={ttsState.totalWords === 0}
              className="btn-icon w-8 h-8 sm:w-8 sm:h-8"
              title="Rewind 10 seconds (Left Arrow)"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              id="read-entire-pdf-btn"
              onClick={handleReadEntirePDF}
              className={`btn-primary px-3 sm:px-4 py-1.5 min-h-[34px] sm:min-h-[34px] text-xs ${
                isPlayingThisDoc ? '!bg-amber-600 hover:!bg-amber-500' : ''
              }`}
              title="Extract all text from this PDF and read aloud"
              aria-label={isPlayingThisDoc ? "Pause speech" : isPausedThisDoc ? "Resume speech" : "Read entire PDF"}
            >
              {isPlayingThisDoc ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : isPausedThisDoc ? (
                <>
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Read Entire PDF</span>
                  <span className="xs:hidden">Read</span>
                </>
              )}
            </button>

            <button
              onClick={() => TTSService.seekForward(10)}
              disabled={ttsState.totalWords === 0}
              className="btn-icon w-8 h-8 sm:w-8 sm:h-8"
              title="Forward 10 seconds (Right Arrow)"
              aria-label="Forward 10 seconds"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {ttsState.status !== 'idle' && (
              <button
                onClick={() => TTSService.stop()}
                className="btn-icon w-8 h-8 sm:w-8 sm:h-8"
                title="Stop playback"
                aria-label="Stop playback"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Progress Slider */}
          <div className="w-full flex items-center gap-1.5 sm:gap-2 text-[10px] font-mono text-slate-400">
            <span className="w-8 sm:w-9 text-right text-indigo-300 font-mono text-[9px] sm:text-[10px]">{formatTime(ttsState.currentTime)}</span>
            <label htmlFor="audio-timeline-slider" className="sr-only">
              Seek audio timeline
            </label>
            <input
              id="audio-timeline-slider"
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={ttsState.progressPercent}
              onChange={(e) => TTSService.seekToPercent(parseFloat(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  TTSService.seekForward(e.shiftKey ? 15 : 5);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  TTSService.seekBackward(e.shiftKey ? 15 : 5);
                }
              }}
              disabled={ttsState.totalWords === 0}
              aria-label="Seek audio timeline"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ttsState.progressPercent)}
              aria-valuetext={`${Math.round(ttsState.progressPercent)}% played`}
              className="flex-1 h-5 sm:h-6 py-1 bg-transparent appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              title="Seek audio position"
            />
            <span className="w-8 sm:w-9 text-slate-400 font-mono text-[9px] sm:text-[10px]">-{formatTime(Math.max(0, ttsState.totalDuration - ttsState.currentTime))}</span>
          </div>
        </div>

        {/* Right: Speed Toggle, Voice & Studio, Progress Badge */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
              const nextIndex = (rates.indexOf(ttsState.rate) + 1) % rates.length;
              TTSService.setRate(rates[nextIndex === -1 ? 1 : nextIndex]);
            }}
            className="btn-secondary text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-1 h-8"
            title="Cycle playback speed (0.75x, 1x, 1.25x, 1.5x, 2x)"
            aria-label={`Playback speed: ${ttsState.rate.toFixed(2)}x`}
          >
            {ttsState.rate.toFixed(2)}x
          </button>

          <button
            id="audio-studio-toggle-btn"
            onClick={() => setShowAudioStudio(!showAudioStudio)}
            className={`btn-secondary text-xs px-2 sm:px-2.5 py-1 h-8 ${
              showAudioStudio ? '!bg-indigo-600/30 !text-indigo-300 !border-indigo-500/50' : ''
            }`}
            title="Open Audiobook Narration Studio (Voice, Speed, Pitch)"
            aria-label="Audiobook Voice Settings"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden lg:inline">Voice</span>
          </button>

          {onToggleFloatingPlayer && (
            <button
              id="pop-out-player-btn"
              onClick={onToggleFloatingPlayer}
              className={`btn-secondary text-xs px-2 py-1 h-8 hidden sm:flex ${
                isFloatingPlayerOpen ? '!bg-indigo-600/30 !text-indigo-300 !border-indigo-500/50' : ''
              }`}
              title={isFloatingPlayerOpen ? "Floating player is open (click to dock)" : "Pop out floating audiobook player widget"}
              aria-label="Pop out floating player"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline">{isFloatingPlayerOpen ? 'Docked' : 'Pop Out'}</span>
            </button>
          )}

          <span className="hidden sm:inline-block text-[10px] sm:text-[11px] font-mono font-bold bg-slate-800 text-emerald-400 px-2 py-1 rounded-full border border-slate-700">
            {Math.round(ttsState.progressPercent)}%
          </span>
        </div>
      </div>
    </div>
  );
};
