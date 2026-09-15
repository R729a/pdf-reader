export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  content: string;
  chunkIndex: number;
  tokenCount?: number;
}

export interface PDFDocument {
  id: string;
  userId: string;
  filename: string;
  fileSize: number; // in bytes
  uploadDate: string;
  processingStatus: 'uploading' | 'processing' | 'ready' | 'error';
  pageCount: number;
  extractedText: string;
  chunks: DocumentChunk[];
  dataUrl?: string; // base64 / blob URL for local PDF viewing
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{
    pageNumber: number;
    snippet: string;
    score?: number;
  }>;
  audioDuration?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  documentId: string;
  documentTitle: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AudioLog {
  id: string;
  chatId: string;
  messageId: string;
  voiceName: string;
  playbackRate: number;
  playTimeSeconds: number;
  createdAt: string;
}

export interface TTSSettings {
  voiceName: string;
  pitch: number; // 0.5 to 1.5
  rate: number; // 0.5 to 2.5
  volume: number; // 0 to 1
  autoPlay: boolean;
}
