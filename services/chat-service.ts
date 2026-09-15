import { PDFDocument, ChatMessage, DocumentChunk } from '@/types';
import { VectorService } from './vector-service';

export type QuickActionType = 'executive_summary' | 'key_findings' | 'generate_qa' | 'action_items';

export interface QAResponse {
  answer: string;
  citations: Array<{ pageNumber: number; snippet: string; score?: number }>;
  usedAI: boolean;
  usedOllama?: boolean;
  provider?: string;
  error?: string;
  errorCode?: string;
}

export const ChatService = {
  /**
   * Primary question answering function with conversational memory
   */
  async askQuestion(
    question: string,
    document: PDFDocument,
    chatHistory: ChatMessage[] = []
  ): Promise<QAResponse> {
    if (!document || !document.chunks || document.chunks.length === 0) {
      return {
        answer: 'No document content available to answer your question. Please ensure a valid PDF is loaded.',
        citations: [],
        usedAI: false,
      };
    }

    // Step 1: Retrieve relevant document chunks (top 4 matches)
    const searchResults = VectorService.search(question, document.chunks, 4);

    // If query didn't match specific terms, use top chunks as fallback
    const chunksToUse = searchResults.length > 0
      ? searchResults
      : document.chunks.slice(0, 4).map(chunk => ({ chunk, score: 0.5 }));

    // Prepare citations
    const citations = chunksToUse.map(r => ({
      pageNumber: r.chunk.pageNumber,
      snippet: r.chunk.content.length > 180 ? r.chunk.content.substring(0, 180) + '...' : r.chunk.content,
      score: r.score,
    }));

    // Step 2: Build context text
    const contextText = chunksToUse
      .map(r => `[Page ${r.chunk.pageNumber}]\n${r.chunk.content}`)
      .join('\n\n');

    const systemPrompt = `You are PDF Reader AI, an expert conversational assistant.
You have already read and indexed the user's uploaded document "${document.filename}".
CRITICAL RULE: Answer the user's question directly, clearly, and STRICTLY using the provided document context below.
Do not require the user to say "read this PDF" or "in this document". Assume all questions relate to "${document.filename}".
If the provided context does not contain enough detail to answer, state: "The uploaded document does not contain this specific information."
Cite relevant page numbers when referencing facts (e.g. [Page X]).

Document Context:
${contextText}`;

    // Step 3: Call Google Gemini /api/chat route
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          question,
          context: contextText,
          filename: document.filename,
          chatHistory: chatHistory.slice(-6),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.answer && data.answer.trim().length > 0) {
        return {
          answer: data.answer.trim(),
          citations,
          usedAI: true,
          provider: data.provider || 'Google Gemini',
        };
      }

      if (data.code === 'API_KEY_MISSING') {
        const fallbackAnswer = this.generateGroundedAnswer(question, chunksToUse, document.filename);
        return {
          answer: `> 💡 **Gemini API Setup Notice**: Set \`GEMINI_API_KEY\` in your \`.env.local\` file to unlock full generative AI power.\n\n${fallbackAnswer}`,
          citations,
          usedAI: false,
          errorCode: 'API_KEY_MISSING',
        };
      }

      if (response.status === 429) {
        return {
          answer: `⚠️ **Rate Limit Reached**: ${data.error || 'Gemini API quota exceeded. Please wait a few seconds before trying again.'}`,
          citations,
          usedAI: false,
          error: data.error,
          errorCode: 'RATE_LIMIT',
        };
      }

      if (data.error) {
        console.warn('Gemini chat API error:', data.error);
      }
    } catch (e) {
      console.log('Gemini chat endpoint offline, using intelligent RAG synthesizer fallback.');
    }

    // Step 4: Fallback Grounded Synthesizer
    const fallbackAnswer = this.generateGroundedAnswer(question, chunksToUse, document.filename);

    return {
      answer: fallbackAnswer,
      citations,
      usedAI: false,
    };
  },

  /**
   * Execute dedicated AI Quick Actions:
   * 1. Executive Summary
   * 2. Key Findings
   * 3. Generate Q&A
   * 4. Action Items
   */
  async executeQuickAction(
    actionType: QuickActionType,
    document: PDFDocument,
    chatHistory: ChatMessage[] = []
  ): Promise<QAResponse> {
    if (!document || !document.chunks || document.chunks.length === 0) {
      return {
        answer: 'No document content available. Please select or upload a valid PDF.',
        citations: [],
        usedAI: false,
      };
    }

    // Document-wide tasks cover all chunks of the document
    const allChunks = document.chunks;
    const contextText = allChunks
      .slice(0, 10) // Cover up to 10 key chunks across all pages
      .map(c => `[Page ${c.pageNumber}]\n${c.content}`)
      .join('\n\n');

    // Build page citations
    const pages = Array.from(new Set(allChunks.map(c => c.pageNumber))).sort((a, b) => a - b);
    const citations = pages.map(pageNum => {
      const chunk = allChunks.find(c => c.pageNumber === pageNum);
      const text = chunk ? chunk.content.trim() : '';
      return {
        pageNumber: pageNum,
        snippet: text.length > 180 ? text.substring(0, 180) + '...' : text,
      };
    });

    let systemPrompt = '';
    let userPrompt = '';

    switch (actionType) {
      case 'executive_summary':
        systemPrompt = `You are PDF Reader AI. You have thoroughly read and indexed "${document.filename}".
Provide a concise, comprehensive Executive Summary based ONLY on the provided document context.
Format your response with:
- **Executive Overview**: High-level purpose and core subject.
- **Key Highlights & Scope**: Central themes or sections.
- **Conclusions & Takeaway**: Overall impact or primary conclusion.
Strictly ground every detail in the text. Cite page numbers where appropriate.

Document Context:
${contextText}`;
        userPrompt = `Please generate an Executive Summary for "${document.filename}".`;
        break;

      case 'key_findings':
        systemPrompt = `You are PDF Reader AI. Analyze "${document.filename}" and extract the most critical findings, data metrics, core facts, and insights.
Format your response as clean, structured bullet points:
- Use bold lead-in titles for each finding (e.g. **Finding Title**: detailed explanation with [Page X] citation).
- Include all key numbers, benchmarks, percentages, or milestones mentioned in the document.
- Base everything strictly on the document text.

Document Context:
${contextText}`;
        userPrompt = `What are the key findings, conclusions, and core insights in "${document.filename}"?`;
        break;

      case 'generate_qa':
        systemPrompt = `You are PDF Reader AI. Analyze "${document.filename}" and generate 5 to 8 useful, relevant Questions & Answers grounded strictly in the document content.
Format each pair clearly as:
**Q1: [Specific, insightful question about the PDF]**
**A1: [Accurate, grounded answer with page citation, e.g. (Page X)]**

Ensure the questions cover the core concepts and different pages of the document.

Document Context:
${contextText}`;
        userPrompt = `Generate 5 to 8 relevant Questions & Answers based on "${document.filename}".`;
        break;

      case 'action_items':
        systemPrompt = `You are PDF Reader AI. Analyze "${document.filename}" and identify all action items, recommendations, decisions, tasks, or next steps mentioned in the text.
Format your response as a structured checklist or numbered list with page citations.
IMPORTANT RULE: If the document does NOT contain explicit action items, recommendations, or next steps, explicitly state:
"No explicit action items, recommendations, or next steps are outlined in **${document.filename}**."

Document Context:
${contextText}`;
        userPrompt = `What are the action items, recommendations, or next steps in "${document.filename}"?`;
        break;
    }

    // Call Google Gemini /api/chat route
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          question: userPrompt,
          context: contextText,
          filename: document.filename,
          chatHistory: chatHistory.slice(-4),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.answer && data.answer.trim().length > 0) {
        return {
          answer: data.answer.trim(),
          citations,
          usedAI: true,
          provider: data.provider || 'Google Gemini',
        };
      }

      if (data.code === 'API_KEY_MISSING') {
        const fallbackAnswer = this.synthesizeQuickActionFallback(actionType, document, allChunks);
        return {
          answer: `> 💡 **Gemini API Setup Notice**: Set \`GEMINI_API_KEY\` in your \`.env.local\` file to unlock full generative AI power.\n\n${fallbackAnswer}`,
          citations,
          usedAI: false,
          errorCode: 'API_KEY_MISSING',
        };
      }

      if (response.status === 429) {
        return {
          answer: `⚠️ **Rate Limit Reached**: ${data.error || 'Gemini API quota exceeded. Please wait a few seconds before trying again.'}`,
          citations,
          usedAI: false,
          error: data.error,
          errorCode: 'RATE_LIMIT',
        };
      }
    } catch (e) {
      console.log(`Gemini offline for ${actionType}, using intelligent grounded fallback.`);
    }

    // Fallback Grounded Synthesizer for Quick Actions
    const fallbackAnswer = this.synthesizeQuickActionFallback(actionType, document, allChunks);

    return {
      answer: fallbackAnswer,
      citations,
      usedAI: false,
    };
  },

  /**
   * High quality fallback synthesis for Quick Actions directly from document chunks
   */
  synthesizeQuickActionFallback(
    actionType: QuickActionType,
    document: PDFDocument,
    chunks: DocumentChunk[]
  ): string {
    const pagesList = Array.from(new Set(chunks.map(c => c.pageNumber))).sort((a, b) => a - b).join(', ');
    const fullText = chunks.map(c => c.content).join('\n\n');

    switch (actionType) {
      case 'executive_summary': {
        const paragraphs = fullText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        const overview = paragraphs[0] || `Overview of ${document.filename}.`;
        const details = paragraphs.slice(1, 4).join('\n\n');

        return `### 📝 Executive Summary: ${document.filename}\n\n` +
          `**Document Overview:**\n${overview}\n\n` +
          `**Core Highlights:**\n${details}\n\n` +
          `**Key Takeaway:**\nThis document synthesizes findings across ${document.pageCount} page(s) (Page ${pagesList}). All findings are processed locally with vector citations.`;
      }

      case 'key_findings': {
        const lines = fullText
          .split(/\n+/)
          .map(l => l.trim())
          .filter(l => l.length > 25 && !l.startsWith('---'));

        // Pick distinct key sentences across pages
        const selected = lines.slice(0, 5);

        let result = `### 🎯 Key Findings & Insights: ${document.filename}\n\n`;
        selected.forEach((line, idx) => {
          const chunk = chunks.find(c => c.content.includes(line));
          const pageRef = chunk ? ` *(Page ${chunk.pageNumber})*` : '';
          result += `${idx + 1}. **Finding ${idx + 1}**: ${line}${pageRef}\n\n`;
        });

        return result.trim();
      }

      case 'generate_qa': {
        const paragraphs = fullText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 40 && !p.startsWith('---'));
        
        let result = `### ❓ Generated Questions & Answers: ${document.filename}\n\n`;
        const qaPairs = [
          {
            q: `What is the primary objective or subject discussed in "${document.filename}"?`,
            a: paragraphs[0] ? `${paragraphs[0]} (Page 1)` : `The document discusses ${document.filename}.`,
          },
          {
            q: `What are the core technical or functional principles detailed in this document?`,
            a: paragraphs[1] ? `${paragraphs[1]} (Page ${chunks[1]?.pageNumber || 1})` : `Outlined in the main document sections.`,
          },
          {
            q: `How does this document address performance, accuracy, or methodology?`,
            a: paragraphs[2] ? `${paragraphs[2]} (Page ${chunks[2]?.pageNumber || 1})` : `Described in the methodology and results sections.`,
          },
          {
            q: `What are the primary conclusions reached in ${document.filename}?`,
            a: paragraphs[paragraphs.length - 1] || `The document provides comprehensive review and verified conclusions across all ${document.pageCount} pages.`,
          },
          {
            q: `Where can verified citations and references be located in this document?`,
            a: `Verified content is distributed across page(s) ${pagesList}, indexed with dense vector embeddings.`,
          }
        ];

        qaPairs.forEach((pair, idx) => {
          result += `**Q${idx + 1}: ${pair.q}**\n**A${idx + 1}:** ${pair.a}\n\n`;
        });

        return result.trim();
      }

      case 'action_items': {
        // Look for action verbs / keywords
        const actionKeywords = /\b(will|must|should|recommend|action|next steps|implement|audit|register|complete|prepare|schedule|deploy|ensure)\b/i;
        const sentences = fullText
          .split(/[.!?\n]+/)
          .map(s => s.trim())
          .filter(s => s.length > 20 && actionKeywords.test(s));

        if (sentences.length > 0) {
          let result = `### 📌 Identified Action Items & Recommendations: ${document.filename}\n\n`;
          sentences.slice(0, 5).forEach((sent, idx) => {
            const chunk = chunks.find(c => c.content.includes(sent));
            const pageRef = chunk ? ` *(Page ${chunk.pageNumber})*` : '';
            result += `- [ ] **Action ${idx + 1}**: ${sent}${pageRef}\n`;
          });
          return result;
        } else {
          return `### 📌 Action Items: ${document.filename}\n\nNo explicit action items, recommendations, or next steps are outlined in **${document.filename}**. The document is primarily informative/academic in nature.`;
        }
      }
    }
  },

  /**
   * Grounded RAG answer synthesis directly from chunk text
   */
  generateGroundedAnswer(
    question: string,
    searchResults: Array<{ chunk: DocumentChunk; score: number }>,
    filename: string
  ): string {
    const pagesList = Array.from(new Set(searchResults.map(r => r.chunk.pageNumber))).sort((a, b) => a - b).join(', ');
    const topChunk = searchResults[0].chunk.content.trim();

    return `Based on **${filename}** (Page ${pagesList}):\n\n${topChunk}\n\n*This answer was retrieved directly from page(s) ${pagesList} of your uploaded document using vector similarity search.*`;
  }
};
