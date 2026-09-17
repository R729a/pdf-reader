'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, PDFDocument } from '@/types';
import { CitationBadge } from './CitationBadge';
import { MarkdownMessage } from './MarkdownMessage';
import { TTSService, TTSState } from '@/services/tts-service';
import { QuickActionType } from '@/services/chat-service';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Sparkles, 
  Loader2, 
  BookOpen, 
  RefreshCw,
  HelpCircle,
  Clock,
  Trash2,
  Download,
  Search,
  X,
  FileDown,
  MessageSquare,
  AlertTriangle,
  FileText,
  CheckSquare,
  Key
} from 'lucide-react';

interface ChatWindowProps {
  document: PDFDocument | null;
  messages: ChatMessage[];
  onSendMessage: (question: string) => Promise<void>;
  onExecuteQuickAction?: (actionType: QuickActionType, label: string) => Promise<void>;
  isLoading: boolean;
  onPageCitationClick?: (pageNumber: number, snippet: string) => void;
  onClearChat?: () => void;
  errorMessage?: string | null;
  onRetryLastMessage?: () => void;
  onOpenApiKeyModal?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  document,
  messages,
  onSendMessage,
  onExecuteQuickAction,
  isLoading,
  onPageCitationClick,
  onClearChat,
  errorMessage,
  onRetryLastMessage,
  onOpenApiKeyModal,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState<string>('');
  const [ttsState, setTtsState] = useState<TTSState>(TTSService.getState());
  const [activeQuickAction, setActiveQuickAction] = useState<QuickActionType | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribe = TTSService.subscribe(state => setTtsState(state));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setActiveQuickAction(null);
    }
  }, [isLoading]);

  // Adjust textarea height dynamically up to 150px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 42), 150)}px`;
    }
  }, [inputQuery]);

  // Smart auto-scroll: only scrolls to bottom if user hasn't scrolled up to read past history
  useEffect(() => {
    if (shouldAutoScroll && !messageSearchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, messageSearchQuery, shouldAutoScroll]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    setShouldAutoScroll(isNearBottom);
  };

  const handleSendMessage = async () => {
    if (!inputQuery.trim() || isLoading || !document) return;

    const query = inputQuery.trim();
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '42px';
    }
    setShouldAutoScroll(true);
    await onSendMessage(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends message, Shift + Enter creates newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (messages.length === 0) return;
    const conversation = messages
      .map(m => `[${m.sender === 'user' ? 'YOU' : 'AI ASSISTANT'} - ${new Date(m.timestamp).toLocaleTimeString()}]:\n${m.content}`)
      .join('\n\n---\n\n');
    
    navigator.clipboard.writeText(conversation);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportChat = () => {
    if (!document || messages.length === 0) return;

    let markdownContent = `# Chat History: ${document.filename}\n`;
    markdownContent += `Exported on: ${new Date().toLocaleString()}\n`;
    markdownContent += `Document: ${document.filename} (${document.pageCount} pages)\n\n---\n\n`;

    messages.forEach((m) => {
      const role = m.sender === 'user' ? '🧑 User' : '🤖 PDF AI Assistant';
      const time = new Date(m.timestamp).toLocaleTimeString();
      markdownContent += `### ${role} (${time})\n\n${m.content}\n\n`;
      if (m.citations && m.citations.length > 0) {
        markdownContent += `**Citations:**\n`;
        m.citations.forEach((c) => {
          markdownContent += `- Page ${c.pageNumber}: "${c.snippet}"\n`;
        });
        markdownContent += '\n';
      }
      markdownContent += `---\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `chat_history_${document.filename.replace(/\.pdf$/i, '')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTTSPlay = (
    messageId: string, 
    text: string, 
    citations?: Array<{ pageNumber: number; snippet: string }>
  ) => {
    if (ttsState.currentMessageId === messageId && ttsState.status === 'playing') {
      TTSService.pause();
    } else if (ttsState.currentMessageId === messageId && ttsState.status === 'paused') {
      TTSService.resume();
    } else {
      TTSService.speak(messageId, text, undefined, 'PDF Assistant Statement');
    }
  };


  const quickActions: Array<{
    id: string;
    type: QuickActionType;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'quick-action-summary',
      type: 'executive_summary',
      label: 'Executive Summary',
      description: 'Overview, key highlights and core takeaways.',
      icon: <FileText className="w-3.5 h-3.5 text-indigo-400" />,
    },
    {
      id: 'quick-action-findings',
      type: 'key_findings',
      label: 'Key Findings',
      description: 'Critical facts, conclusions, and data points.',
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: 'quick-action-qa',
      type: 'generate_qa',
      label: 'Generate Q&A',
      description: '5–8 insightful questions and answers.',
      icon: <HelpCircle className="w-3.5 h-3.5 text-sky-400" />,
    },
    {
      id: 'quick-action-actions',
      type: 'action_items',
      label: 'Action Items',
      description: 'Tasks, recommendations, and next steps.',
      icon: <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />,
    },
  ];

  const handleExecuteAction = async (type: QuickActionType, label: string) => {
    if (isLoading || !document) return;
    setActiveQuickAction(type);
    if (onExecuteQuickAction) {
      await onExecuteQuickAction(type, label);
    } else {
      await onSendMessage(`Please generate ${label} for this document.`);
    }
  };



  // Filter messages if search is active
  const displayedMessages = messageSearchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(messageSearchQuery.toLowerCase()))
    : messages;

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 overflow-hidden relative">
      {/* Header */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/95 px-3 sm:px-4 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider truncate">PDF Chat Assistant</h2>
        </div>

        {/* Header Action Tools */}
        {document && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Search messages toggle */}
            <button
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setMessageSearchQuery('');
              }}
              className={`btn-icon ${
                isSearchOpen ? '!bg-indigo-600/30 !text-indigo-300 !border-indigo-500/40' : ''
              }`}
              title="Search in conversation"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Copy entire conversation */}
            <button
              onClick={handleCopyAll}
              disabled={messages.length === 0}
              className="btn-icon"
              title="Copy entire conversation"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Export chat as Markdown */}
            <button
              id="export-chat-btn"
              onClick={handleExportChat}
              disabled={messages.length === 0}
              className="btn-icon hover:!text-indigo-300"
              title="Export chat history as Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Clear Chat History Button */}
            {onClearChat && (
              <button
                id="clear-chat-btn"
                onClick={() => setIsClearModalOpen(true)}
                disabled={messages.length === 0}
                className="btn-icon hover:!bg-red-500/20 hover:!text-red-400"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Optional Search Bar */}
      {isSearchOpen && (
        <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search within this chat..."
            value={messageSearchQuery}
            onChange={(e) => setMessageSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          {messageSearchQuery && (
            <button
              onClick={() => setMessageSearchQuery('')}
              className="p-1 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Quick Actions Bar (Pinned directly above the chat) */}
      {document && (
        <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> AI Quick Actions
            </span>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">
              Grounded in {document.filename}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {quickActions.map((action) => {
              const isActive = activeQuickAction === action.type;
              const isActionDisabled = isLoading || !document;
              return (
                <button
                  key={action.type}
                  id={action.id}
                  onClick={() => handleExecuteAction(action.type, action.label)}
                  disabled={isActionDisabled}
                  title={`Generate ${action.label} based strictly on "${document.filename}"`}
                  className={`btn-secondary text-[11px] px-2 py-1.5 ${
                    isActive
                      ? '!bg-indigo-600/30 !text-indigo-200 !border-indigo-500/60 ring-1 ring-indigo-500/40'
                      : ''
                  }`}
                >
                  {isActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                  ) : (
                    <span className="shrink-0">{action.icon}</span>
                  )}
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {/* Error State Banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            {onRetryLastMessage && (
              <button
                onClick={onRetryLastMessage}
                disabled={isLoading}
                className="btn-danger text-[11px] px-2.5 py-1"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!document ? (
          <div className="py-16 text-center text-slate-500">
            <HelpCircle className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="text-sm font-medium text-slate-400">No Document Selected</p>
            <p className="text-xs mt-1">Please select or upload a PDF to start asking questions.</p>
          </div>
        ) : displayedMessages.length === 0 && messageSearchQuery ? (
          <div className="py-12 text-center text-slate-500">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="text-xs font-semibold text-slate-400">No matches found</p>
            <p className="text-[11px] text-slate-500 mt-1">No messages match "{messageSearchQuery}".</p>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">Ask Anything About Your PDF</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
              AI answers are generated strictly using your document's text content with exact page citations.
            </p>

            {/* Quick Action feature cards in empty state */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto text-left">
              {quickActions.map((action) => (
                <button
                  key={`card-${action.type}`}
                  onClick={() => handleExecuteAction(action.type, action.label)}
                  disabled={isLoading || !document}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 text-left transition-all group disabled:opacity-40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded-lg bg-slate-900 border border-slate-700 group-hover:bg-indigo-600/20 group-hover:border-indigo-500/30 text-slate-300 group-hover:text-indigo-400 transition-colors">
                      {action.icon}
                    </div>
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                      {action.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {action.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          displayedMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSpeakingThisMsg = ttsState.currentMessageId === msg.id && ttsState.status === 'playing';
            const isPausedThisMsg = ttsState.currentMessageId === msg.id && ttsState.status === 'paused';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs leading-relaxed group ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`max-w-[92%] sm:max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-400">
                      {isUser ? 'You' : 'Gemini AI Assistant'}
                    </span>
                    <span>•</span>
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-3 sm:p-3.5 rounded-2xl shadow-sm relative break-words [overflow-wrap:anywhere] ${
                      isUser
                        ? 'bg-slate-800/80 text-slate-200 border border-slate-700/70 rounded-tr-none whitespace-pre-wrap leading-relaxed'
                        : `bg-slate-800/90 text-slate-200 border rounded-tl-none ${
                            isSpeakingThisMsg
                              ? 'border-indigo-500/60 ring-1 ring-indigo-500/30'
                              : isPausedThisMsg
                              ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                              : 'border-slate-700/80'
                          }`
                    }`}
                  >
                    {!isUser && (isSpeakingThisMsg || isPausedThisMsg) && (
                      <div className={`mb-2.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center justify-between border ${
                        isSpeakingThisMsg
                          ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 animate-pulse'
                          : 'bg-amber-950/50 text-amber-300 border-amber-500/40'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>{isSpeakingThisMsg ? 'Speaking aloud...' : 'Voice paused'}</span>
                        </div>
                        <span className="font-mono text-[9px] opacity-80">
                          Word {ttsState.currentWordIndex + 1} / {ttsState.totalWords}
                        </span>
                      </div>
                    )}

                    {isUser ? (
                      msg.content
                    ) : (
                      <>
                        <MarkdownMessage content={msg.content} />
                        {msg.content.includes('Gemini API Setup Notice') && onOpenApiKeyModal && (
                          <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-indigo-300 font-medium">Ready to unlock live Gemini?</span>
                            <button
                              onClick={onOpenApiKeyModal}
                              className="btn-primary text-[11px]"
                            >
                              <Key className="w-3 h-3" />
                              <span>Set API Key</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Citations (if any) */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">Citations:</span>
                        {msg.citations.map((c, idx) => (
                          <CitationBadge
                            key={idx}
                            pageNumber={c.pageNumber}
                            snippet={c.snippet}
                            onClickPage={(pageNum) => onPageCitationClick && onPageCitationClick(pageNum, c.snippet)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message Action Tools */}
                  {!isUser && (
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <button
                        onClick={() => handleTTSPlay(msg.id, msg.content, msg.citations)}
                        className={`btn-secondary text-[10px] px-2 py-0.5 ${
                          isSpeakingThisMsg
                            ? '!bg-indigo-600/30 !text-indigo-300 !border-indigo-500/40'
                            : isPausedThisMsg
                            ? '!bg-amber-500/20 !text-amber-300 !border-amber-500/30'
                            : ''
                        }`}
                        title={isSpeakingThisMsg ? 'Pause voice' : isPausedThisMsg ? 'Resume voice' : 'Read aloud'}
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>{isSpeakingThisMsg ? 'Pause' : isPausedThisMsg ? 'Resume' : 'Read Aloud'}</span>
                      </button>

                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="btn-ghost !p-1"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* ChatGPT-Style Thinking Indicator */}
        {isLoading && (
          <div className="flex gap-3 text-xs leading-relaxed justify-start items-start animate-in fade-in duration-200">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md ring-2 ring-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-800/90 border border-slate-700/80 text-slate-300 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-slate-400 text-xs font-medium">
                Gemini is analyzing document context & generating response...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ChatGPT-Style Multiline Chat Input Field */}
      <div className="p-2.5 sm:p-4 border-t border-slate-800 bg-slate-900/98 shrink-0 safe-bottom">
        <div className="relative bg-slate-950 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 rounded-2xl shadow-inner transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              document
                ? 'Ask Gemini a question about this document...'
                : 'Select a document first to ask questions...'
            }
            aria-label="Ask Gemini a question about this document"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!document || isLoading}
            maxLength={4000}
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 pl-3.5 pr-14 sm:pr-20 py-2.5 sm:py-3 resize-none focus:outline-none custom-scrollbar leading-relaxed disabled:opacity-50"
            style={{ minHeight: '40px', maxHeight: '140px' }}
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            {inputQuery.length > 0 && (
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                {inputQuery.length}/4000
              </span>
            )}
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputQuery.trim() || isLoading || !document}
              className="btn-primary !p-0 w-9 h-9 sm:w-8 sm:h-8 !rounded-xl shadow-md shadow-indigo-600/20"
              title="Send message"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-500">
          <span className="hidden sm:inline">
            Press <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">Enter</kbd> to send, <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">Shift + Enter</kbd> for newline
          </span>
          <span className="flex items-center gap-1 ml-auto text-indigo-400 font-medium">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Powered by Google Gemini
          </span>
        </div>
      </div>

      {/* Modern In-App Clear Chat Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Clear Chat History</h3>
                <p className="text-xs text-slate-400">Reset conversation for this PDF</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Are you sure you want to clear all chat messages for <strong className="text-white font-semibold">"{document?.filename}"</strong>? 
              This conversation history will be wiped.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                id="confirm-clear-chat-btn"
                onClick={() => {
                  if (onClearChat) onClearChat();
                  setIsClearModalOpen(false);
                }}
                className="btn-danger"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
