import { PDFDocument, ChatSession, User, AudioLog, TTSSettings } from '@/types';
import { PDFService } from '@/services/pdf-service';

const STORAGE_KEYS = {
  DOCUMENTS: 'pdf_reader_ai_documents',
  SESSIONS: 'pdf_reader_ai_sessions',
  ACTIVE_DOC_ID: 'pdf_reader_ai_active_doc',
  ACTIVE_SESSION_ID: 'pdf_reader_ai_active_session',
  USER: 'pdf_reader_ai_user',
  AUDIO_LOGS: 'pdf_reader_ai_audio_logs',
  TTS_SETTINGS: 'pdf_reader_ai_tts_settings',
};

const DEFAULT_USER: User = {
  id: 'usr_demo_101',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
};

const DEFAULT_TTS_SETTINGS: TTSSettings = {
  voiceName: '',
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
  autoPlay: false,
};

export const StorageService = {
  // User Management
  getUser(): User {
    if (typeof window === 'undefined') return DEFAULT_USER;
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : DEFAULT_USER;
  },

  setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  // Documents Management
  getDocuments(): PDFDocument[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (!data) return [];
    try {
      const docs: PDFDocument[] = JSON.parse(data);
      let modified = false;
      for (const doc of docs) {
        if (doc.extractedText && /[\u0900-\u097F]/.test(doc.extractedText)) {
          const repaired = PDFService.normalizeDevanagari(doc.extractedText);
          if (repaired !== doc.extractedText) {
            doc.extractedText = repaired;
            modified = true;
          }
        }
      }
      if (modified) {
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
      }
      return docs;
    } catch {
      return [];
    }
  },

  saveDocument(doc: PDFDocument): void {
    if (typeof window === 'undefined') return;
    const docs = this.getDocuments();
    const existingIdx = docs.findIndex(d => d.id === doc.id);
    if (existingIdx >= 0) {
      docs[existingIdx] = doc;
    } else {
      docs.unshift(doc);
    }
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  },

  deleteDocument(docId: string): void {
    if (typeof window === 'undefined') return;
    const docs = this.getDocuments().filter(d => d.id !== docId);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    
    // Also remove related sessions
    const sessions = this.getSessions().filter(s => s.documentId !== docId);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    if (this.getActiveDocumentId() === docId) {
      this.setActiveDocumentId(docs[0]?.id || '');
    }
  },

  getActiveDocumentId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC_ID);
  },

  setActiveDocumentId(docId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, docId);
  },

  // Chat Sessions Management
  getSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  getSessionByDocument(docId: string): ChatSession | undefined {
    const sessions = this.getSessions();
    return sessions.find(s => s.documentId === docId);
  },

  saveSession(session: ChatSession): void {
    if (typeof window === 'undefined') return;
    const sessions = this.getSessions();
    const existingIdx = sessions.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      sessions[existingIdx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  // Audio Logs
  saveAudioLog(log: Omit<AudioLog, 'id' | 'createdAt'>): void {
    if (typeof window === 'undefined') return;
    const data = localStorage.getItem(STORAGE_KEYS.AUDIO_LOGS);
    const logs: AudioLog[] = data ? JSON.parse(data) : [];
    const newLog: AudioLog = {
      ...log,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.AUDIO_LOGS, JSON.stringify(logs.slice(0, 100)));
  },

  getAudioLogs(): AudioLog[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.AUDIO_LOGS);
    return data ? JSON.parse(data) : [];
  },

  // TTS Settings
  getTTSSettings(): TTSSettings {
    if (typeof window === 'undefined') return DEFAULT_TTS_SETTINGS;
    const data = localStorage.getItem(STORAGE_KEYS.TTS_SETTINGS);
    return data ? { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(data) } : DEFAULT_TTS_SETTINGS;
  },

  saveTTSSettings(settings: TTSSettings): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.TTS_SETTINGS, JSON.stringify(settings));
  }
};
