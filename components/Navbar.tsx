'use client';

import React from 'react';
import { PDFDocument, User } from '@/types';
import { 
  FileText, 
  Sparkles, 
  Upload, 
  Cpu, 
  User as UserIcon, 
  LogOut,
  ChevronDown,
  Volume2,
  Menu,
  X
} from 'lucide-react';

interface NavbarProps {
  activeDocument: PDFDocument | null;
  documents: PDFDocument[];
  onSelectDocument: (docId: string) => void;
  onOpenUploadModal: () => void;
  user: User;
  onOpenAuthModal: () => void;
  onOpenApiKeyModal?: () => void;
  ollamaStatus?: boolean;
  aiConfigured?: boolean;
  aiModel?: string;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeDocument,
  documents,
  onSelectDocument,
  onOpenUploadModal,
  user,
  onOpenAuthModal,
  onOpenApiKeyModal,
  ollamaStatus = false,
  aiConfigured = false,
  aiModel = 'gemini-1.5-flash',
  onToggleMobileSidebar,
  isMobileSidebarOpen = false,
}) => {
  return (
    <header className="h-14 sm:h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between sticky top-0 z-40 text-slate-100 shrink-0">
      {/* Brand & Logo & Mobile Drawer Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Drawer Button */}
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            aria-label={isMobileSidebarOpen ? "Close documents drawer" : "Open documents drawer"}
            aria-expanded={isMobileSidebarOpen}
            className="md:hidden btn-icon w-10 h-10 text-slate-300 hover:text-white"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950/40 rounded-[10px] flex items-center justify-center">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-300" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-bold text-sm sm:text-lg tracking-tight text-white flex items-center gap-1">
              PDF Reader <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI</span>
            </h1>
            <span className="hidden xs:inline-block text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden lg:block">
            Interactive PDF Q&A & Dynamic TTS Voice Assistant
          </p>
        </div>
      </div>

      {/* Active Document Selector (Desktop) */}
      <div className="hidden md:flex items-center gap-2">
        {documents.length > 0 ? (
          <div className="relative group">
            <select
              value={activeDocument?.id || ''}
              onChange={(e) => onSelectDocument(e.target.value)}
              aria-label="Select active document"
              className="appearance-none bg-slate-800/90 border border-slate-700 hover:border-indigo-500/50 text-slate-200 text-xs font-medium rounded-lg pl-3 pr-8 py-2 max-w-[240px] truncate focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id} className="bg-slate-900 text-slate-200">
                  📄 {doc.filename} ({doc.pageCount} pgs)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : null}
      </div>

      {/* Right Controls: AI Engine Indicator & Auth */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Engine Status Badge / Setup Trigger */}
        <button
          type="button"
          onClick={onOpenApiKeyModal}
          id="ai-engine-badge-btn"
          aria-label={aiConfigured ? `Connected to Gemini (${aiModel})` : 'Configure Gemini API Key'}
          title={aiConfigured ? `Connected to Gemini (${aiModel}). Click to reconfigure.` : 'Click to configure Gemini API Key'}
          className={`btn-secondary text-xs px-2.5 sm:px-3.5 h-9 sm:h-9 ${
            aiConfigured 
              ? 'border-emerald-500/40 text-slate-200'
              : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-300'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 shrink-0 ${aiConfigured ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="truncate max-w-[120px] sm:max-w-none">
            <span className="hidden sm:inline">AI Engine: </span>
            <strong className={aiConfigured ? 'text-slate-100' : 'text-amber-200'}>
              {aiConfigured ? `Gemini` : 'Add Key'}
            </strong>
            <span className="hidden md:inline">{aiConfigured ? ` (${aiModel})` : ''}</span>
          </span>
        </button>

        {/* User Auth Profile */}
        <button
          type="button"
          onClick={onOpenAuthModal}
          aria-label={user.name ? `Profile: ${user.name}` : 'User Profile'}
          className="btn-secondary gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 shrink-0"
        >
          <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <span className="hidden sm:inline text-xs">{user.name || 'Account'}</span>
        </button>
      </div>
    </header>
  );
};
