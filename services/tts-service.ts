import { TTSSettings } from '@/types';
import { PDFService } from '@/services/pdf-service';

export type TTSStatus = 'idle' | 'playing' | 'paused';

export interface SpokenWord {
  id: string;
  word: string;
  globalWordIndex: number;
  pageNumber: number;
  paragraphIndex: number;
  chunkIndex: number;
  wordInChunkIndex: number;
  charStartInDoc: number;
  charEndInDoc: number;
  charStartInChunk: number;
  charEndInChunk: number;
}

export interface SpeechMark {
  wordIndexInUtterance: number;
  globalWordIndex: number;
  word: string;
  charStart: number;
  charEnd: number;
  startTimeMs: number;
  endTimeMs: number;
  pageNumber: number;
}

export interface ChunkItem {
  chunkIndex: number;
  pageNumber: number;
  paragraphIndex: number;
  text: string;
  words: SpokenWord[];
  startWordIndex: number;
  endWordIndex: number;
  charStartInDoc: number;
  charEndInDoc: number;
}

export interface ParagraphItem {
  paragraphIndex: number;
  pageNumber: number;
  chunks: ChunkItem[];
  startWordIndex: number;
  endWordIndex: number;
}

export interface PageItem {
  pageNumber: number;
  paragraphs: ParagraphItem[];
  allWords: SpokenWord[];
  startWordIndex: number;
  endWordIndex: number;
}

export interface ProcessedDocument {
  documentId: string;
  title: string;
  rawText: string;
  pages: PageItem[];
  chunks: ChunkItem[];
  allWords: SpokenWord[];
  totalWords: number;
  totalChars: number;
  totalDuration: number; // in seconds estimated at 1.0x rate
}

export interface TTSState {
  status: TTSStatus;
  currentMessageId: string | null;
  title?: string;
  currentPage: number;
  currentParagraph: number;
  currentChunk: number;
  currentWordIndex: number;
  currentPdfWordIndex: number | null;
  currentPdfPage: number | null;
  isReadingDocument: boolean;
  isReadingMessage: boolean;
  characterIndex: number;
  totalWords: number;
  progressPercent: number;
  currentTime: number; // in seconds
  totalDuration: number; // in seconds
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  rate: number;
  pitch: number;
  volume: number;
  isPlaying: boolean;
  isPaused: boolean;
}

type EventListener = (state: TTSState) => void;

function cleanWordToken(w: string): string {
  if (!w) return '';
  return w.toLowerCase().replace(/[*#_`[\]().,;:"'!?]/g, '').trim();
}

/**
 * Maps spoken chat message words to their corresponding word index in the PDF document.
 * Matches phrases, priority citations, and contiguous word sequences so PDF highlighting
 * moves seamlessly across the document text when an assistant statement is read aloud.
 */
function mapMessageWordsToPdf(
  messageWords: SpokenWord[],
  pdfDoc: ProcessedDocument | null,
  citations?: Array<{ pageNumber: number; snippet: string }>
): number[] {
  const result: (number | null)[] = new Array(messageWords.length).fill(null);
  if (!pdfDoc || !pdfDoc.allWords || pdfDoc.allWords.length === 0) {
    return new Array(messageWords.length).fill(0);
  }

  const pdfWords = pdfDoc.allWords;
  const priorityPage = citations && citations.length > 0 ? citations[0].pageNumber : undefined;

  // Build inverted index of cleaned PDF tokens
  const tokenToPdfMap = new Map<string, Array<{ index: number; page: number }>>();
  for (let i = 0; i < pdfWords.length; i++) {
    const token = cleanWordToken(pdfWords[i].word);
    if (token.length > 1) {
      if (!tokenToPdfMap.has(token)) {
        tokenToPdfMap.set(token, []);
      }
      tokenToPdfMap.get(token)!.push({ index: i, page: pdfWords[i].pageNumber });
    }
  }

  let lastMatchedPdfIdx: number | null = null;
  if (priorityPage !== undefined) {
    const pageFirstWord = pdfWords.find(w => w.pageNumber === priorityPage);
    if (pageFirstWord) {
      lastMatchedPdfIdx = pageFirstWord.globalWordIndex;
    }
  }

  // Pass 1: Phrase & 2-gram matching with priority-page weighting
  for (let i = 0; i < messageWords.length; i++) {
    const t0 = cleanWordToken(messageWords[i].word);
    if (t0.length < 2) continue;

    const candidates = tokenToPdfMap.get(t0);
    if (!candidates || candidates.length === 0) continue;

    const nextMsgWord = i + 1 < messageWords.length ? cleanWordToken(messageWords[i + 1].word) : '';

    let bestCandidate: number | null = null;
    let bestScore = -1;

    for (const cand of candidates) {
      let score = 0;
      if (priorityPage !== undefined && cand.page === priorityPage) {
        score += 10;
      }
      if (nextMsgWord && cand.index + 1 < pdfWords.length) {
        const nextPdfToken = cleanWordToken(pdfWords[cand.index + 1].word);
        if (nextPdfToken === nextMsgWord) {
          score += 50;
        }
      }
      if (lastMatchedPdfIdx !== null) {
        const dist = cand.index - lastMatchedPdfIdx;
        if (dist >= 0 && dist <= 3) {
          score += 30 - dist * 5;
        } else if (dist > 3 && dist <= 20) {
          score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = cand.index;
      }
    }

    if (bestCandidate !== null && bestScore > 0) {
      result[i] = bestCandidate;
      lastMatchedPdfIdx = bestCandidate;
    }
  }

  // Pass 2: Fill contiguous gaps
  for (let i = 1; i < messageWords.length - 1; i++) {
    if (result[i] === null && result[i - 1] !== null && result[i + 1] !== null) {
      const prevIdx = result[i - 1]!;
      const nextIdx = result[i + 1]!;
      if (nextIdx === prevIdx + 2) {
        result[i] = prevIdx + 1;
      }
    }
  }

  // Pass 3: Carry forward for smooth, unbroken tracking across connecting words
  let fallbackStart = lastMatchedPdfIdx !== null ? lastMatchedPdfIdx : (pdfWords[0]?.globalWordIndex ?? 0);
  let currentActive = result.find(idx => idx !== null) ?? fallbackStart;

  const finalMap: number[] = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null) {
      currentActive = result[i]!;
    }
    finalMap.push(currentActive);
  }

  return finalMap;
}

/**
 * Deterministically finds the word inside wordsToSpeak whose character boundaries
 * cover charIndexInUtterance (fired by SpeechSynthesis onboundary).
 */
function findWordInSlice(wordsToSpeak: SpokenWord[], charIndexInUtterance: number): SpokenWord {
  let runningOffset = 0;
  for (let i = 0; i < wordsToSpeak.length; i++) {
    const word = wordsToSpeak[i];
    const wordLen = word.word.length;
    const wordEnd = runningOffset + wordLen;
    const nextStart = wordEnd + 1; // 1 for space delimiter
    if (charIndexInUtterance <= wordEnd || i === wordsToSpeak.length - 1) {
      return word;
    }
    runningOffset = nextStart;
  }
  return wordsToSpeak[0];
}

class TTSServiceManager {
  private synth: SpeechSynthesis | null = null;
  private doc: ProcessedDocument | null = null;
  private activePdfDoc: ProcessedDocument | null = null;
  private chatWordToPdfWordMap: number[] = [];
  private isReadingDocument: boolean = true;
  private isReadingMessage: boolean = false;
  private currentChunkIdx: number = 0;
  private currentWordInChunkIdx: number = 0;
  private playTimeout: any = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private syncInterval: any = null;

  private state: TTSState = {
    status: 'idle',
    currentMessageId: null,
    title: '',
    currentPage: 1,
    currentParagraph: 0,
    currentChunk: 0,
    currentWordIndex: 0,
    currentPdfWordIndex: null,
    currentPdfPage: null,
    isReadingDocument: true,
    isReadingMessage: false,
    characterIndex: 0,
    totalWords: 0,
    progressPercent: 0,
    currentTime: 0,
    totalDuration: 0,
    availableVoices: [],
    selectedVoiceName: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isPlaying: false,
    isPaused: false,
  };

  private listeners: Set<EventListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    this.state.availableVoices = voices;

    if (!this.state.selectedVoiceName && voices.length > 0) {
      const defaultVoice =
        voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];

      this.state.selectedVoiceName = defaultVoice ? defaultVoice.name : '';
    }
    this.notify();
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn({ ...this.state }));
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return this.state.availableVoices;
  }

  public getState(): TTSState {
    return { ...this.state };
  }

  public getProcessedDocument(): ProcessedDocument | null {
    return this.doc;
  }

  /**
   * Preprocesses full document text into small sentence-based chunks of 100-250 characters.
   * Maintains exact global character and word indexing across all chunks.
   */
  public processDocument(documentId: string, title: string, rawText: string): ProcessedDocument {
    // Normalize Indic/Devanagari text so words, matras, and conjuncts are connected
    const normalizedText = PDFService.normalizeDevanagari(rawText || '');

    if (this.doc && this.doc.documentId === documentId && this.doc.rawText === normalizedText) {
      return this.doc;
    }

    const pages: PageItem[] = [];
    const chunks: ChunkItem[] = [];
    const allWords: SpokenWord[] = [];

    // Parse pages by delimiter "--- Page X ---"
    const pageDelimiterRegex = /--- Page (\d+) ---\n?/g;
    const pageMatches: { pageNumber: number; startIndex: number; endIndex: number }[] = [];
    let match;

    while ((match = pageDelimiterRegex.exec(normalizedText)) !== null) {
      pageMatches.push({
        pageNumber: parseInt(match[1]),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    let rawPages: { pageNumber: number; text: string }[] = [];
    if (pageMatches.length > 0) {
      for (let i = 0; i < pageMatches.length; i++) {
        const pMatch = pageMatches[i];
        const nextStart = i + 1 < pageMatches.length ? pageMatches[i + 1].startIndex : normalizedText.length;
        const pageText = normalizedText.substring(pMatch.endIndex, nextStart).trim();
        rawPages.push({ pageNumber: pMatch.pageNumber, text: pageText });
      }
    } else {
      rawPages.push({ pageNumber: 1, text: normalizedText.trim() });
    }

    let globalWordIdx = 0;
    let globalChunkIdx = 0;
    let charOffsetCounter = 0;

    for (const rawPage of rawPages) {
      const pageWordsStart = globalWordIdx;
      const paragraphs: ParagraphItem[] = [];

      // Split page content into paragraphs
      const rawParas = rawPage.text.split(/\n\n+/).filter(p => p.trim().length > 0);

      for (let paraIdx = 0; paraIdx < rawParas.length; paraIdx++) {
        const paraText = rawParas[paraIdx].replace(/[*#_`[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!paraText) continue;

        const paraWordsStart = globalWordIdx;
        const paraChunks: ChunkItem[] = [];

        // Split paragraph into natural sentences
        const sentRegex = /[^.!?\n]+[.!?\n]*/g;
        let sentMatch;

        while ((sentMatch = sentRegex.exec(paraText)) !== null) {
          const rawSent = sentMatch[0].trim();
          if (!rawSent) continue;

          // Break sentences into chunks of 100-250 characters
          const rawWords = rawSent.split(/\s+/).filter(Boolean);
          const chunkWordGroups: string[][] = [];

          let currentGroup: string[] = [];
          let currentGroupCharLength = 0;

          for (const w of rawWords) {
            const nextLength = currentGroupCharLength + (currentGroup.length > 0 ? 1 : 0) + w.length;
            if (currentGroup.length > 0 && nextLength > 200) {
              chunkWordGroups.push(currentGroup);
              currentGroup = [w];
              currentGroupCharLength = w.length;
            } else {
              currentGroup.push(w);
              currentGroupCharLength = nextLength;
            }
          }
          if (currentGroup.length > 0) {
            chunkWordGroups.push(currentGroup);
          }

          for (const chunkWords of chunkWordGroups) {
            const chunkWordsStart = globalWordIdx;
            const chunkWordsList: SpokenWord[] = [];
            const chunkText = chunkWords.join(' ');
            const chunkCharStart = charOffsetCounter;

            let runningInChunk = 0;
            for (let wIdx = 0; wIdx < chunkWords.length; wIdx++) {
              const wordStr = chunkWords[wIdx];
              const wordStartInChunk = runningInChunk;
              const wordEndInChunk = runningInChunk + wordStr.length;

              const wordObj: SpokenWord = {
                id: `w_${globalWordIdx}`,
                word: wordStr,
                globalWordIndex: globalWordIdx,
                pageNumber: rawPage.pageNumber,
                paragraphIndex: paraIdx,
                chunkIndex: globalChunkIdx,
                wordInChunkIndex: wIdx,
                charStartInDoc: chunkCharStart + wordStartInChunk,
                charEndInDoc: chunkCharStart + wordEndInChunk,
                charStartInChunk: wordStartInChunk,
                charEndInChunk: wordEndInChunk,
              };

              chunkWordsList.push(wordObj);
              allWords.push(wordObj);
              globalWordIdx++;
              runningInChunk = wordEndInChunk + 1; // account for space
            }

            charOffsetCounter += chunkText.length + 1;

            const chunkItem: ChunkItem = {
              chunkIndex: globalChunkIdx,
              pageNumber: rawPage.pageNumber,
              paragraphIndex: paraIdx,
              text: chunkText,
              words: chunkWordsList,
              startWordIndex: chunkWordsStart,
              endWordIndex: globalWordIdx - 1,
              charStartInDoc: chunkCharStart,
              charEndInDoc: charOffsetCounter,
            };

            chunks.push(chunkItem);
            paraChunks.push(chunkItem);
            globalChunkIdx++;
          }
        }

        if (paraChunks.length > 0) {
          paragraphs.push({
            paragraphIndex: paraIdx,
            pageNumber: rawPage.pageNumber,
            chunks: paraChunks,
            startWordIndex: paraWordsStart,
            endWordIndex: globalWordIdx - 1,
          });
        }
      }

      pages.push({
        pageNumber: rawPage.pageNumber,
        paragraphs,
        allWords: allWords.slice(pageWordsStart, globalWordIdx),
        startWordIndex: pageWordsStart,
        endWordIndex: globalWordIdx - 1,
      });
    }

    const totalWords = allWords.length;
    const totalDuration = Math.round(totalWords / 2.5);

    this.doc = {
      documentId,
      title,
      rawText,
      pages,
      chunks,
      allWords,
      totalWords,
      totalChars: charOffsetCounter,
      totalDuration,
    };

    return this.doc;
  }

  /**
   * Pre-loads document upon upload/selection so controls are enabled immediately with 0 latency.
   */
  public loadDocumentText(documentId: string, title: string, text: string): ProcessedDocument {
    const doc = this.processDocument(documentId, title, text);
    this.activePdfDoc = doc;
    this.doc = doc;
    this.isReadingDocument = true;
    this.isReadingMessage = false;

    if (this.state.status === 'idle') {
      this.state.currentMessageId = documentId;
      this.state.title = title;
      this.state.currentPage = doc.pages[0]?.pageNumber || 1;
      this.state.currentParagraph = 0;
      this.state.currentChunk = 0;
      this.state.currentWordIndex = 0;
      this.state.currentPdfWordIndex = 0;
      this.state.currentPdfPage = doc.pages[0]?.pageNumber || 1;
      this.state.isReadingDocument = true;
      this.state.isReadingMessage = false;
      this.state.characterIndex = 0;
      this.state.totalWords = doc.totalWords;
      this.state.totalDuration = doc.totalDuration;
      this.state.progressPercent = 0;
      this.state.currentTime = 0;
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.notify();
    }

    return doc;
  }

  /**
   * Starts reading entire document aloud from word 0.
   */
  public speakEntireDocument(documentId: string, title: string, text: string): void {
    const doc = this.processDocument(documentId, title, text);
    this.activePdfDoc = doc;
    this.doc = doc;
    this.isReadingDocument = true;
    this.isReadingMessage = false;

    this.state.isReadingDocument = true;
    this.state.isReadingMessage = false;
    this.state.currentMessageId = documentId;
    this.state.title = title;
    this.state.currentPdfWordIndex = 0;
    this.state.currentPdfPage = doc.pages[0]?.pageNumber || 1;
    this.speakFromWord(0);
  }

  /**
   * Speak single text message (e.g. AI Assistant response).
   * Synchronizes spoken words with PDF document highlighting so the PDF text moves in real-time.
   */
  public speak(
    messageId: string,
    text: string,
    settings?: Partial<TTSSettings>,
    title?: string,
    citations?: Array<{ pageNumber: number; snippet: string }>,
    pdfDoc?: ProcessedDocument | null
  ): void {
    if (settings?.voiceName) this.state.selectedVoiceName = settings.voiceName;
    if (settings?.rate) this.state.rate = settings.rate;
    if (settings?.pitch) this.state.pitch = settings.pitch;

    if (pdfDoc) {
      this.activePdfDoc = pdfDoc;
    }

    // Process chat message as active utterance
    this.doc = this.processDocument(messageId, title || 'AI Response', text);
    this.isReadingDocument = false;
    this.isReadingMessage = true;

    this.state.isReadingDocument = false;
    this.state.isReadingMessage = true;
    this.state.currentMessageId = messageId;
    this.state.title = title || 'AI Response';

    // Map message words to active PDF document words
    if (this.activePdfDoc && this.activePdfDoc.allWords.length > 0) {
      this.chatWordToPdfWordMap = mapMessageWordsToPdf(this.doc.allWords, this.activePdfDoc, citations);
      const initialPdfIdx = this.chatWordToPdfWordMap[0] ?? (this.activePdfDoc.allWords[0]?.globalWordIndex ?? 0);
      this.state.currentPdfWordIndex = initialPdfIdx;
      const initialWord = this.activePdfDoc.allWords[initialPdfIdx];
      this.state.currentPdfPage = initialWord ? initialWord.pageNumber : (citations?.[0]?.pageNumber || 1);
    } else {
      this.chatWordToPdfWordMap = [];
      this.state.currentPdfWordIndex = null;
      this.state.currentPdfPage = null;
    }

    this.speakFromWord(0);
  }

  /**
   * Plays audio starting from an exact global word index.
   */
  public speakFromWord(globalWordIndex: number): void {
    if (!this.synth) {
      alert('Text-to-Speech is not supported in this browser environment.');
      return;
    }

    if (!this.doc || this.doc.totalWords === 0) return;

    const clampedWordIdx = Math.max(0, Math.min(this.doc.totalWords - 1, globalWordIndex));
    const targetWord = this.doc.allWords[clampedWordIdx];
    if (!targetWord) return;

    this.currentChunkIdx = targetWord.chunkIndex;
    this.currentWordInChunkIdx = targetWord.wordInChunkIndex;

    this.updateWordProgress(clampedWordIdx, targetWord.charStartInDoc);

    this.state.status = 'playing';
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.notify();

    this.playChunk(this.currentChunkIdx, this.currentWordInChunkIdx);
  }

  /**
   * Plays a 100-250 character utterance chunk.
   * Bound boundary events directly drive the highlighted word.
   */
  private playChunk(chunkIdx: number, wordInChunkIdx: number): void {
    if (!this.synth || !this.doc || chunkIdx >= this.doc.chunks.length) {
      this.stop();
      return;
    }

    if (this.playTimeout) {
      clearTimeout(this.playTimeout);
      this.playTimeout = null;
    }

    this.currentChunkIdx = chunkIdx;
    this.currentWordInChunkIdx = wordInChunkIdx;

    const chunk = this.doc.chunks[chunkIdx];
    if (wordInChunkIdx >= chunk.words.length) {
      this.playChunk(chunkIdx + 1, 0);
      return;
    }

    const wordsToSpeak = chunk.words.slice(wordInChunkIdx);
    const textToSpeak = wordsToSpeak.map(w => w.word).join(' ');

    const currentGlobalWord = chunk.startWordIndex + wordInChunkIdx;
    this.updateWordProgress(currentGlobalWord, wordsToSpeak[0]?.charStartInDoc || chunk.charStartInDoc);

    // Pre-calculate high precision speech marks with exact character bounds in utterance text
    let runningCharOffset = 0;
    const msPerChar = 60 / Math.max(0.2, this.state.rate);
    const speechMarks: SpeechMark[] = wordsToSpeak.map((w, idx) => {
      const start = runningCharOffset;
      const end = start + w.word.length;
      runningCharOffset = end + 1; // accounts for joining space
      return {
        wordIndexInUtterance: idx,
        globalWordIndex: w.globalWordIndex,
        word: w.word,
        charStart: start,
        charEnd: end,
        startTimeMs: Math.round(start * msPerChar),
        endTimeMs: Math.round(end * msPerChar),
        pageNumber: w.pageNumber,
      };
    });

    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance.onboundary = null;
      this.activeUtterance = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.synth.paused) {
      this.synth.resume();
    }
    this.synth.cancel();

    // 40ms yield ensures OS audio hardware releases previous buffers cleanly
    this.playTimeout = setTimeout(() => {
      if (!this.synth || this.state.status !== 'playing' || this.currentChunkIdx !== chunkIdx) {
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      this.activeUtterance = utterance;
      if (typeof window !== 'undefined') {
        (window as any).__ttsActiveUtterance = utterance;
      }

      utterance.rate = this.state.rate;
      utterance.pitch = this.state.pitch;
      utterance.volume = this.state.volume;

      const voice = this.state.availableVoices.find(v => v.name === this.state.selectedVoiceName);
      if (voice) utterance.voice = voice;

      let utteranceStartTime = 0;
      let lastBoundaryFiredAt = 0;

      utterance.onstart = () => {
        utteranceStartTime = performance.now();
        lastBoundaryFiredAt = utteranceStartTime;
      };

      /**
       * Primary Real-Time Word Boundary Handler:
       * Triggered immediately as each word boundary is reached during audio speech.
       * Uses speech mark token offsets to map directly to the active PDF word.
       */
      utterance.onboundary = (event) => {
        if (this.state.status !== 'playing' || this.currentChunkIdx !== chunkIdx) return;
        lastBoundaryFiredAt = performance.now();

        const charIndex = typeof event.charIndex === 'number' ? event.charIndex : 0;
        
        // Find matching speech mark
        let mark = speechMarks.find(m => charIndex >= m.charStart && charIndex <= m.charEnd);
        if (!mark) {
          for (let i = 0; i < speechMarks.length; i++) {
            if (charIndex <= speechMarks[i].charEnd || i === speechMarks.length - 1) {
              mark = speechMarks[i];
              break;
            }
          }
        }

        if (mark) {
          const spokenWord = wordsToSpeak[mark.wordIndexInUtterance];
          if (spokenWord) {
            this.currentWordInChunkIdx = spokenWord.wordInChunkIndex;
            this.updateWordProgress(spokenWord.globalWordIndex, spokenWord.charStartInDoc);
          }
        }
      };

      // Fallback timestamp monitor: ensures continuity if a browser engine drops onboundary events
      this.syncInterval = setInterval(() => {
        if (this.state.status !== 'playing' || this.currentChunkIdx !== chunkIdx) {
          if (this.syncInterval) clearInterval(this.syncInterval);
          this.syncInterval = null;
          return;
        }

        // If no boundary event received for >350ms, interpolate via speech mark timestamps
        if (utteranceStartTime > 0 && performance.now() - lastBoundaryFiredAt > 350) {
          const elapsedSec = ((performance.now() - utteranceStartTime) / 1000) * this.state.rate;
          const elapsedMs = elapsedSec * 1000;
          const mark = speechMarks.find(m => elapsedMs >= m.startTimeMs && elapsedMs < m.endTimeMs);
          if (mark) {
            const spokenWord = wordsToSpeak[mark.wordIndexInUtterance];
            if (spokenWord && spokenWord.globalWordIndex > this.state.currentWordIndex) {
              this.currentWordInChunkIdx = spokenWord.wordInChunkIndex;
              this.updateWordProgress(spokenWord.globalWordIndex, spokenWord.charStartInDoc);
            }
          }
        }
      }, 50);

      utterance.onend = () => {
        if (this.syncInterval) {
          clearInterval(this.syncInterval);
          this.syncInterval = null;
        }
        if (this.state.status !== 'playing' || this.currentChunkIdx !== chunkIdx) return;
        this.playTimeout = setTimeout(() => {
          if (this.state.status === 'playing' && this.currentChunkIdx === chunkIdx) {
            this.playChunk(chunkIdx + 1, 0);
          }
        }, 30);
      };

      utterance.onerror = (e) => {
        if (this.syncInterval) {
          clearInterval(this.syncInterval);
          this.syncInterval = null;
        }
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        console.warn('TTS utterance error:', e);
        if (this.state.status === 'playing' && this.currentChunkIdx === chunkIdx) {
          this.playTimeout = setTimeout(() => {
            if (this.state.status === 'playing' && this.currentChunkIdx === chunkIdx) {
              this.playChunk(chunkIdx + 1, 0);
            }
          }, 30);
        }
      };

      this.synth.speak(utterance);
      if (this.synth.paused) {
        this.synth.resume();
      }
    }, 40);
  }

  /**
   * Updates state metadata from real boundary events and notifies UI listeners.
   */
  private updateWordProgress(globalWordIdx: number, charIndexInDoc: number): void {
    if (!this.doc || globalWordIdx >= this.doc.allWords.length) return;

    const word = this.doc.allWords[globalWordIdx];
    this.state.currentWordIndex = globalWordIdx;
    this.state.currentPage = word.pageNumber;
    this.state.currentParagraph = word.paragraphIndex;
    this.state.currentChunk = word.chunkIndex;
    this.state.characterIndex = charIndexInDoc;

    // Synchronously track matching PDF word and page
    if (this.isReadingMessage && this.activePdfDoc && this.chatWordToPdfWordMap.length > globalWordIdx) {
      const mappedPdfIdx = this.chatWordToPdfWordMap[globalWordIdx];
      if (mappedPdfIdx !== null && mappedPdfIdx !== undefined) {
        this.state.currentPdfWordIndex = mappedPdfIdx;
        const pdfWord = this.activePdfDoc.allWords[mappedPdfIdx];
        if (pdfWord) {
          this.state.currentPdfPage = pdfWord.pageNumber;
        }
      }
    } else if (this.isReadingDocument) {
      this.state.currentPdfWordIndex = globalWordIdx;
      this.state.currentPdfPage = word.pageNumber;
    }

    if (this.doc.totalWords > 0) {
      this.state.progressPercent = Math.min(100, Math.round(((globalWordIdx + 1) / this.doc.totalWords) * 1000) / 10);
      this.state.currentTime = Math.round((globalWordIdx / this.doc.totalWords) * this.doc.totalDuration);
      this.state.totalDuration = this.doc.totalDuration;
      this.state.totalWords = this.doc.totalWords;
    }

    this.notify();
  }

  /**
   * Pause:
   * Freezes the highlighted word at the exact boundary event position.
   * NO timers or estimation heuristics.
   */
  public pause(): void {
    if (this.state.status === 'playing') {
      if (this.playTimeout) {
        clearTimeout(this.playTimeout);
        this.playTimeout = null;
      }
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      this.state.status = 'paused';
      this.state.isPlaying = false;
      this.state.isPaused = true;

      if (this.synth) {
        this.synth.pause();
      }

      this.notify();
    }
  }

  /**
   * Resume:
   * Resumes seamlessly from the exact word where paused.
   */
  public resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'playing';
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.notify();

      if (this.synth && this.synth.paused && this.synth.speaking) {
        this.synth.resume();
        setTimeout(() => {
          if (this.state.status === 'playing' && (!this.synth?.speaking || this.synth?.paused)) {
            this.speakFromWord(this.state.currentWordIndex);
          }
        }, 120);
      } else {
        this.speakFromWord(this.state.currentWordIndex);
      }
    } else if (this.doc && this.doc.totalWords > 0) {
      this.speakFromWord(this.state.currentWordIndex || 0);
    }
  }

  public stop(): void {
    if (this.playTimeout) {
      clearTimeout(this.playTimeout);
      this.playTimeout = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance.onboundary = null;
      this.activeUtterance = null;
    }

    this.state.status = 'idle';
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentWordIndex = 0;
    this.state.characterIndex = 0;
    this.state.progressPercent = 0;
    this.state.currentTime = 0;

    if (this.synth) {
      if (this.synth.paused) this.synth.resume();
      this.synth.cancel();
    }

    this.notify();
  }

  public seekForward(seconds: number = 5): void {
    if (!this.doc || this.doc.totalWords === 0) return;
    const timeBasedWords = Math.round(seconds * 2.5 * this.state.rate);
    const wordsToAdvance = Math.max(1, timeBasedWords);
    const targetWord = Math.min(this.doc.totalWords - 1, this.state.currentWordIndex + wordsToAdvance);
    this.seekToWord(targetWord);
  }

  public seekBackward(seconds: number = 5): void {
    if (!this.doc || this.doc.totalWords === 0) return;
    const timeBasedWords = Math.round(seconds * 2.5 * this.state.rate);
    const wordsToRewind = Math.max(1, timeBasedWords);
    const targetWord = Math.max(0, this.state.currentWordIndex - wordsToRewind);
    this.seekToWord(targetWord);
  }

  public seekToPercent(percent: number): void {
    if (!this.doc || this.doc.totalWords === 0) return;
    const clamped = Math.max(0, Math.min(100, percent));
    let targetWord = Math.min(
      this.doc.totalWords - 1,
      Math.floor((clamped / 100) * this.doc.totalWords)
    );

    // Guaranteed directional progression: prevents floor round-down trap
    if (clamped > this.state.progressPercent && targetWord <= this.state.currentWordIndex && this.state.currentWordIndex < this.doc.totalWords - 1) {
      targetWord = this.state.currentWordIndex + 1;
    } else if (clamped < this.state.progressPercent && targetWord >= this.state.currentWordIndex && this.state.currentWordIndex > 0) {
      targetWord = this.state.currentWordIndex - 1;
    }

    this.seekToWord(targetWord);
  }

  public seekToWord(targetWordIndex: number): void {
    if (!this.doc || this.doc.totalWords === 0) return;
    const clampedWord = Math.max(0, Math.min(this.doc.totalWords - 1, targetWordIndex));
    const wasPlaying = this.state.status === 'playing';
    const word = this.doc.allWords[clampedWord];

    this.updateWordProgress(clampedWord, word ? word.charStartInDoc : 0);

    if (wasPlaying) {
      this.speakFromWord(clampedWord);
    } else {
      this.state.status = 'paused';
      this.state.isPaused = true;
      this.state.isPlaying = false;
      if (this.synth) {
        if (this.synth.paused) this.synth.resume();
        this.synth.cancel();
      }
      this.notify();
    }
  }

  public setRate(newRate: number): void {
    this.state.rate = newRate;
    this.notify();

    if (this.state.status === 'playing') {
      const savedWord = this.state.currentWordIndex;
      if (this.synth) {
        if (this.synth.paused) this.synth.resume();
        this.synth.cancel();
      }
      if (this.playTimeout) clearTimeout(this.playTimeout);
      this.playTimeout = setTimeout(() => {
        if (this.state.status === 'playing') {
          this.speakFromWord(savedWord);
        }
      }, 50);
    }
  }

  public setVoice(voiceName: string): void {
    this.state.selectedVoiceName = voiceName;
    this.notify();

    if (this.state.status === 'playing') {
      const savedWord = this.state.currentWordIndex;
      if (this.synth) {
        if (this.synth.paused) this.synth.resume();
        this.synth.cancel();
      }
      if (this.playTimeout) clearTimeout(this.playTimeout);
      this.playTimeout = setTimeout(() => {
        if (this.state.status === 'playing') {
          this.speakFromWord(savedWord);
        }
      }, 50);
    }
  }

  public setPitch(pitch: number): void {
    this.state.pitch = pitch;
    this.notify();
  }
}

export const TTSService = new TTSServiceManager();
