'use client';

import React, { useState, useEffect } from 'react';
import { StorageService } from '@/lib/storage';
import { PDFStorage } from '@/lib/pdf-storage';
import { PDFService } from '@/services/pdf-service';
import { ChatService, QuickActionType } from '@/services/chat-service';
import { PDFDocument, ChatSession, ChatMessage, User } from '@/types';

import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { PDFViewer } from '@/components/PDFViewer';
import { ChatWindow } from '@/components/ChatWindow';
import { PDFUploader } from '@/components/PDFUploader';
import { AuthModal } from '@/components/AuthModal';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { AudioControls } from '@/components/AudioControls';
import { TTSService } from '@/services/tts-service';

import { Menu, X, FileText, Sparkles, SlidersHorizontal } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<User>(StorageService.getUser());
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);

  // Split layout ratios and citation highlights
  const [targetPage, setTargetPage] = useState<number>(1);
  const [highlightText, setHighlightText] = useState<string>('');

  // Modals & Mobile sidebar state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [showFloatingPlayer, setShowFloatingPlayer] = useState<boolean>(false);
  const [ollamaStatus, setOllamaStatus] = useState<boolean>(false);
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);
  const [aiModel, setAiModel] = useState<string>('gemini-1.5-flash');
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  // Load persistent state on mount
  useEffect(() => {
    const loadedDocs = StorageService.getDocuments();
    const currentUser = StorageService.getUser();
    setUser(currentUser);

    if (loadedDocs.length === 0) {
      // Pre-populate with sample document for immediate interactive demo
      const sample = PDFService.getSampleDocument(currentUser.id);
      StorageService.saveDocument(sample);
      setDocuments([sample]);
      setActiveDocId(sample.id);
      StorageService.setActiveDocumentId(sample.id);
    } else {
      setDocuments(loadedDocs);
      const lastActiveId = StorageService.getActiveDocumentId() || loadedDocs[0].id;
      setActiveDocId(lastActiveId);
    }

    // Check Gemini AI API status
    fetch('/api/chat')
      .then(res => res.json())
      .then(data => {
        setAiConfigured(data.configured);
        if (data.model) setAiModel(data.model);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  // Load chat session whenever active document changes
  useEffect(() => {
    if (!activeDocId) return;

    const existingSession = StorageService.getSessionByDocument(activeDocId);
    if (existingSession) {
      setMessages(existingSession.messages);
    } else {
      // Start fresh chat session for this document
      const activeDoc = documents.find(d => d.id === activeDocId);
      const initialMessage: ChatMessage = {
        id: 'msg_welcome_' + Date.now(),
        chatId: 'session_' + activeDocId,
        sender: 'assistant',
        content: `Hello! I have indexed **"${activeDoc?.filename || 'your document'}"** (${activeDoc?.pageCount || 0} pages). Ask me any question, request a chapter breakdown, or click 'Read Aloud' to hear the voice narration!`,
        timestamp: new Date().toISOString(),
      };
      setMessages([initialMessage]);

      const newSession: ChatSession = {
        id: 'session_' + activeDocId,
        userId: user.id,
        documentId: activeDocId,
        documentTitle: activeDoc?.filename || 'Document',
        messages: [initialMessage],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveSession(newSession);
    }
  }, [activeDocId, documents, user.id]);

  const activeDoc = documents.find(d => d.id === activeDocId) || null;

  // Automatically enable PDF narration controls whenever a document is selected or loaded
  useEffect(() => {
    if (activeDoc && activeDoc.extractedText) {
      TTSService.loadDocumentText(`doc_${activeDoc.id}`, activeDoc.filename, activeDoc.extractedText);
    }
  }, [activeDoc]);

  const handleSelectDocument = (docId: string) => {
    setActiveDocId(docId);
    StorageService.setActiveDocumentId(docId);
  };

  const handleDeleteDocument = (docId: string) => {
    StorageService.deleteDocument(docId);
    PDFStorage.delete(docId);
    const updatedDocs = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocs);
    if (activeDocId === docId) {
      const nextId = updatedDocs[0]?.id || null;
      setActiveDocId(nextId);
      if (nextId) {
        StorageService.setActiveDocumentId(nextId);
      } else {
        StorageService.setActiveDocumentId('');
        setMessages([]);
      }
    }
    // Stop TTS if it was playing the deleted document
    if (TTSService.getState().currentMessageId === `doc_${docId}`) {
      TTSService.stop();
    }
  };

  const handleClearChat = () => {
    if (!activeDocId) return;
    const initialMessage: ChatMessage = {
      id: 'msg_welcome_' + Date.now(),
      chatId: 'session_' + activeDocId,
      sender: 'assistant',
      content: `Chat history cleared. I'm ready to answer any questions about **"${activeDoc?.filename || 'your document'}"**!`,
      timestamp: new Date().toISOString(),
    };
    setMessages([initialMessage]);

    const updatedSession: ChatSession = {
      id: 'session_' + activeDocId,
      userId: user.id,
      documentId: activeDocId,
      documentTitle: activeDoc?.filename || 'Document',
      messages: [initialMessage],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveSession(updatedSession);
  };

  const handleUploadSuccess = (newDoc: PDFDocument) => {
    StorageService.saveDocument(newDoc);
    setDocuments(prev => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    StorageService.setActiveDocumentId(newDoc.id);
    // Immediately pre-load new PDF text into the TTS engine
    TTSService.loadDocumentText(`doc_${newDoc.id}`, newDoc.filename, newDoc.extractedText);
  };

  const handleSendMessage = async (questionText: string) => {
    if (!activeDoc) return;

    setChatError(null);
    setLastQuestion(questionText);

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      chatId: 'session_' + activeDoc.id,
      sender: 'user',
      content: questionText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoadingChat(true);

    try {
      const qaResponse = await ChatService.askQuestion(questionText, activeDoc, updatedMessages);

      if (qaResponse.error) {
        setChatError(qaResponse.error);
      }

      const assistantMsg: ChatMessage = {
        id: 'msg_assistant_' + Date.now(),
        chatId: 'session_' + activeDoc.id,
        sender: 'assistant',
        content: qaResponse.answer,
        timestamp: new Date().toISOString(),
        citations: qaResponse.citations,
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Save to persistence
      const session: ChatSession = {
        id: 'session_' + activeDoc.id,
        userId: user.id,
        documentId: activeDoc.id,
        documentTitle: activeDoc.filename,
        messages: finalMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveSession(session);
    } catch (err: any) {
      console.error('QA Error:', err);
      setChatError('Failed to generate answer. Please check your connection or API key.');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleRetryLastMessage = () => {
    if (lastQuestion && !isLoadingChat) {
      handleSendMessage(lastQuestion);
    }
  };

  const handleExecuteQuickAction = async (actionType: QuickActionType, label: string) => {
    if (!activeDoc || isLoadingChat) return;

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      chatId: 'session_' + activeDoc.id,
      sender: 'user',
      content: `⚡ Quick Action: ${label}`,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoadingChat(true);

    try {
      const qaResponse = await ChatService.executeQuickAction(actionType, activeDoc, updatedMessages);

      const assistantMsg: ChatMessage = {
        id: 'msg_assistant_' + Date.now(),
        chatId: 'session_' + activeDoc.id,
        sender: 'assistant',
        content: qaResponse.answer,
        timestamp: new Date().toISOString(),
        citations: qaResponse.citations,
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Save to persistence
      const session: ChatSession = {
        id: 'session_' + activeDoc.id,
        userId: user.id,
        documentId: activeDoc.id,
        documentTitle: activeDoc.filename,
        messages: finalMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveSession(session);
    } catch (err) {
      console.error('Quick Action Error:', err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const [mobileTab, setMobileTab] = useState<'viewer' | 'chat'>('viewer');

  const handlePageCitationClick = (pageNumber: number, snippet: string) => {
    setTargetPage(pageNumber);
    setHighlightText(snippet);
    // On mobile screens, automatically switch to Document Viewer to view citation
    setMobileTab('viewer');
  };

  return (
    <div className="h-[100dvh] w-full max-w-[100vw] flex flex-col bg-slate-950 overflow-hidden text-slate-100">
      {/* Navbar Header */}
      <Navbar
        activeDocument={activeDoc}
        documents={documents}
        onSelectDocument={(id) => {
          handleSelectDocument(id);
          setIsMobileSidebarOpen(false);
        }}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        user={user}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        ollamaStatus={ollamaStatus}
        aiConfigured={aiConfigured}
        aiModel={aiModel}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* Mobile-Only Navigation Segmented Switcher */}
      <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-3 py-1.5 flex items-center gap-2 shrink-0 z-20">
        <button
          type="button"
          onClick={() => setMobileTab('viewer')}
          aria-label="View PDF Document"
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            mobileTab === 'viewer'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="truncate">Document {activeDoc ? `(${activeDoc.pageCount}p)` : ''}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          aria-label="View AI Assistant Chat"
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all relative ${
            mobileTab === 'chat'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
          <span>AI Assistant</span>
          {messages.length > 1 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      {/* Main Workspace Area (Sidebar Drawer + Workspace) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Component */}
        <Sidebar
          documents={documents}
          activeDocumentId={activeDocId}
          onSelectDocument={handleSelectDocument}
          onDeleteDocument={handleDeleteDocument}
          onOpenUploadModal={() => setIsUploadOpen(true)}
          isOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Side-by-Side Split Workspace View (Desktop) / Fullscreen Tabs (Mobile) */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left Panel: PDF Interactive Document Viewer */}
          <section className={`flex-1 h-full min-w-0 overflow-hidden ${mobileTab === 'viewer' ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
            <PDFViewer
              document={activeDoc}
              targetPage={targetPage}
              highlightText={highlightText}
              onToggleFloatingPlayer={() => setShowFloatingPlayer(prev => !prev)}
              isFloatingPlayerOpen={showFloatingPlayer}
            />
          </section>

          {/* Right Panel: AI Chat Assistant */}
          <section className={`w-full md:w-[460px] lg:w-[520px] xl:w-[580px] h-full shrink-0 min-w-0 overflow-hidden ${mobileTab === 'chat' ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
            <ChatWindow
              document={activeDoc}
              messages={messages}
              onSendMessage={handleSendMessage}
              onExecuteQuickAction={handleExecuteQuickAction}
              isLoading={isLoadingChat}
              onPageCitationClick={handlePageCitationClick}
              onClearChat={handleClearChat}
              errorMessage={chatError}
              onRetryLastMessage={lastQuestion ? handleRetryLastMessage : undefined}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            />
          </section>
        </main>
      </div>

      {/* Floating Draggable Audiobook Player (Toggled via "Pop Out" in viewer toolbar) */}
      {showFloatingPlayer && (
        <AudioControls
          onDock={() => setShowFloatingPlayer(false)}
          onClose={() => setShowFloatingPlayer(false)}
        />
      )}

      {/* Upload PDF Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <PDFUploader
            userId={user.id}
            onUploadSuccess={handleUploadSuccess}
            onClose={() => setIsUploadOpen(false)}
          />
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        user={user}
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onUserUpdate={(u) => setUser(u)}
      />

      {/* Gemini API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={(model) => {
          setAiConfigured(true);
          setAiModel(model);
        }}
        currentModel={aiModel}
        isConfigured={aiConfigured}
      />
    </div>
  );
}
