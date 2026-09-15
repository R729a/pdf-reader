/**
 * IndexedDB storage for persistent PDF binary files
 * Supports files up to hundreds of megabytes without localStorage limits.
 */

const DB_NAME = 'pdf_reader_binary_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_blobs';

// In-memory active blob URL cache
const activeUrlCache = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const PDFStorage = {
  /**
   * Store PDF binary blob in IndexedDB
   */
  async store(docId: string, blob: Blob): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(blob, docId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to persist PDF to IndexedDB:', err);
    }
  },

  /**
   * Retrieve PDF binary blob from IndexedDB
   */
  async get(docId: string): Promise<Blob | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(docId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to retrieve PDF from IndexedDB:', err);
      return null;
    }
  },

  /**
   * Delete PDF binary blob from IndexedDB
   */
  async delete(docId: string): Promise<void> {
    try {
      const db = await openDB();
      // Revoke any cached URL
      const cached = activeUrlCache.get(docId);
      if (cached) {
        URL.revokeObjectURL(cached);
        activeUrlCache.delete(docId);
      }

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(docId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to delete PDF from IndexedDB:', err);
    }
  },

  /**
   * Get or create a live, working Blob URL for a document.
   * If blob is in IndexedDB, creates and caches an active URL.
   */
  async getActiveUrl(docId: string): Promise<string | null> {
    if (activeUrlCache.has(docId)) {
      return activeUrlCache.get(docId)!;
    }

    const blob = await this.get(docId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      activeUrlCache.set(docId, url);
      return url;
    }

    return null;
  },

  /**
   * Cache a live blob URL directly (e.g. immediately after upload)
   */
  setCachedUrl(docId: string, url: string): void {
    activeUrlCache.set(docId, url);
  },

  /**
   * Synthesize a clean, valid standard PDF Blob from text pages.
   * Universal format supported natively by all PDF viewers.
   */
  generatePdfFromPages(filename: string, pages: Array<{ pageNumber: number; text: string }>): Blob {
    // PDF coordinates: 612 x 792 (US Letter, 72 dpi)
    const objects: string[] = [];
    const fontObjNum = 3;
    const kidsObjNums: number[] = [];
    let currentObjNum = 4;

    // Sanitize string for PDF literal string
    const escapePdf = (str: string) => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E]/g, ' ');
    };

    // Split text into wrapped lines (max ~75 chars per line)
    const wrapText = (text: string, maxLen = 78): string[] => {
      const rawLines = text.split('\n');
      const lines: string[] = [];
      for (const rawLine of rawLines) {
        if (!rawLine.trim()) {
          lines.push('');
          continue;
        }
        const words = rawLine.split(' ');
        let cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length <= maxLen) {
            cur = (cur + ' ' + w).trim();
          } else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
      }
      return lines;
    };

    // Prepare pages
    interface PageSpec {
      pageObjNum: number;
      contentObjNum: number;
      streamText: string;
    }

    const pageSpecs: PageSpec[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageObjNum = currentObjNum++;
      const contentObjNum = currentObjNum++;
      kidsObjNums.push(pageObjNum);

      const lines = wrapText(page.text);
      const streamParts: string[] = [];

      // Page Header
      streamParts.push('BT');
      streamParts.push('/F1 16 Tf');
      streamParts.push('50 740 Td');
      streamParts.push(`(${escapePdf(filename.replace(/\.pdf$/i, ''))}) Tj`);
      streamParts.push('ET');

      // Subtitle / Page number
      streamParts.push('BT');
      streamParts.push('/F1 10 Tf');
      streamParts.push('50 722 Td');
      streamParts.push(`(Page ${page.pageNumber} of ${pages.length} - PDF Reader AI) Tj`);
      streamParts.push('ET');

      // Separator line
      streamParts.push('0.2 w');
      streamParts.push('50 710 m 562 710 l S');

      // Body text
      streamParts.push('BT');
      streamParts.push('/F1 10 Tf');
      streamParts.push('14 TL'); // line leading
      streamParts.push('50 690 Td');

      let linesRendered = 0;
      for (const line of lines) {
        if (linesRendered > 44) break; // page height limit
        streamParts.push(`(${escapePdf(line)}) '`);
        linesRendered++;
      }
      streamParts.push('ET');

      // Page footer
      streamParts.push('0.2 w');
      streamParts.push('50 50 m 562 50 l S');
      streamParts.push('BT');
      streamParts.push('/F1 9 Tf');
      streamParts.push('260 38 Td');
      streamParts.push(`(- Page ${page.pageNumber} -) Tj`);
      streamParts.push('ET');

      const streamText = streamParts.join('\n');
      pageSpecs.push({ pageObjNum, contentObjNum, streamText });
    }

    // Build PDF objects
    // Obj 1: Catalog
    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    // Obj 2: Pages tree
    const kidsStr = kidsObjNums.map(n => `${n} 0 R`).join(' ');
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsStr} ] /Count ${kidsObjNums.length} >>\nendobj\n`);

    // Obj 3: Font
    objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

    // Page objects & Content objects
    for (const spec of pageSpecs) {
      objects.push(
        `${spec.pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${spec.contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`
      );
      const byteLength = new TextEncoder().encode(spec.streamText).length;
      objects.push(
        `${spec.contentObjNum} 0 obj\n<< /Length ${byteLength} >>\nstream\n${spec.streamText}\nendstream\nendobj\n`
      );
    }

    // Assemble file with cross-reference table (xref)
    let pdfData = `%PDF-1.4\n%âãÏÓ\n`;
    const offsets: number[] = [0]; // obj 0 offset

    for (let i = 0; i < objects.length; i++) {
      offsets.push(pdfData.length);
      pdfData += objects[i];
    }

    const startXref = pdfData.length;
    pdfData += `xref\n0 ${offsets.length}\n`;
    pdfData += `0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      const offsetStr = offsets[i].toString().padStart(10, '0');
      pdfData += `${offsetStr} 00000 n \n`;
    }

    pdfData += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\n`;
    pdfData += `startxref\n${startXref}\n%%EOF\n`;

    return new Blob([pdfData], { type: 'application/pdf' });
  }
};
