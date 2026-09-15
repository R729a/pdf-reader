import { DocumentChunk } from '@/types';

export interface SearchResult {
  chunk: DocumentChunk;
  score: number; // 0 to 1 similarity score
}

export const VectorService = {
  /**
   * Tokenize text into normalized word stems / terms
   */
  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  },

  /**
   * Compute Term Frequency (TF) for a document chunk
   */
  computeTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    const total = tokens.length;
    if (total === 0) return tf;

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1 / total);
    }
    return tf;
  },

  /**
   * Calculate Cosine Similarity & TF-IDF match score between Query and Document Chunks
   */
  search(query: string, chunks: DocumentChunk[], topK: number = 4): SearchResult[] {
    if (!chunks || chunks.length === 0 || !query.trim()) {
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const queryTF = this.computeTF(queryTokens);

    // Calculate Inverse Document Frequency (IDF) across all chunks
    const N = chunks.length;
    const docFrequency = new Map<string, number>();

    const chunkTokenList = chunks.map(chunk => {
      const tokens = this.tokenize(chunk.content);
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(t => {
        docFrequency.set(t, (docFrequency.get(t) || 0) + 1);
      });
      return { chunk, tokens };
    });

    const results: SearchResult[] = [];

    for (const item of chunkTokenList) {
      const chunkTF = this.computeTF(item.tokens);
      let dotProduct = 0;
      let queryMagnitude = 0;
      let chunkMagnitude = 0;

      // Calculate score based on overlapping terms weighted by IDF
      queryTF.forEach((qWeight, term) => {
        const df = docFrequency.get(term) || 0;
        const idf = Math.log((N + 1) / (df + 1)) + 1;
        const queryTermWeight = qWeight * idf;

        queryMagnitude += queryTermWeight * queryTermWeight;

        if (chunkTF.has(term)) {
          const chunkTermWeight = (chunkTF.get(term) || 0) * idf;
          dotProduct += queryTermWeight * chunkTermWeight;
        }
      });

      chunkTF.forEach((cWeight, term) => {
        const df = docFrequency.get(term) || 0;
        const idf = Math.log((N + 1) / (df + 1)) + 1;
        const chunkTermWeight = cWeight * idf;
        chunkMagnitude += chunkTermWeight * chunkTermWeight;
      });

      const normQ = Math.sqrt(queryMagnitude);
      const normC = Math.sqrt(chunkMagnitude);
      const score = normQ && normC ? dotProduct / (normQ * normC) : 0;

      // Also add exact phrase boost
      let finalScore = score;
      const lowerChunk = item.chunk.content.toLowerCase();
      const lowerQuery = query.toLowerCase();

      if (lowerChunk.includes(lowerQuery)) {
        finalScore += 0.4;
      }

      results.push({
        chunk: item.chunk,
        score: Math.min(1.0, finalScore),
      });
    }

    // Sort by score descending and return top K matches
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(r => r.score > 0.05);
  }
};
