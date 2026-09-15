import { NextRequest, NextResponse } from 'next/server';
import { AI_CONFIG } from '@/lib/ai-config';

interface ChatRequestBody {
  question: string;
  systemPrompt?: string;
  context?: string;
  filename?: string;
  chatHistory?: Array<{
    id?: string;
    sender: 'user' | 'assistant';
    content: string;
  }>;
}

// In-memory rate-limiting / deduplication guard: tracks recent request timestamps
const recentRequests = new Map<string, number>();

function cleanRecentRequests() {
  const now = Date.now();
  for (const [key, timestamp] of recentRequests.entries()) {
    if (now - timestamp > 60000) {
      recentRequests.delete(key);
    }
  }
}

/**
 * GET /api/chat
 * Health check to verify Gemini AI status and model configuration without exposing secrets
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(
    apiKey &&
    apiKey.trim().length > 0 &&
    apiKey !== 'your_gemini_api_key_here'
  );

  return NextResponse.json({
    status: 'ok',
    configured: isConfigured,
    model: AI_CONFIG.model,
    provider: 'Google Gemini',
  });
}

/**
 * POST /api/chat
 * Secure server-side endpoint for Google Gemini API interaction
 */
export async function POST(req: NextRequest) {
  try {
    cleanRecentRequests();

    // 1. Validate request body
    let body: ChatRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const { question, systemPrompt, context, filename, chatHistory } = body;

    // Validate input message
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'A non-empty question string is required.' },
        { status: 400 }
      );
    }

    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length > 4000) {
      return NextResponse.json(
        { error: 'Message exceeds maximum allowed length of 4000 characters.' },
        { status: 400 }
      );
    }

    // 2. Duplicate submission protection
    const requestFingerprint = `${trimmedQuestion.slice(0, 100)}_${filename || ''}`;
    const lastRequestTime = recentRequests.get(requestFingerprint);
    const now = Date.now();

    if (lastRequestTime && now - lastRequestTime < 1500) {
      return NextResponse.json(
        { error: 'Duplicate request detected. Please wait a moment before resending.' },
        { status: 429 }
      );
    }
    recentRequests.set(requestFingerprint, now);

    // 3. Verify Server-Side API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0 || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        {
          error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in your .env.local file.',
          code: 'API_KEY_MISSING',
        },
        { status: 401 }
      );
    }

    // 4. Formulate System Instructions and Content for Gemini
    const defaultSystem = `You are PDF Reader AI, an intelligent, helpful, and concise conversational assistant.
You specialize in analyzing and discussing documents accurately and factually.
When answering, prioritize grounding your response directly in the provided document context.
Format your responses using clear Markdown formatting (bullet points, bold text, headers, and code blocks where helpful).
Cite page references clearly (e.g. [Page X]) when referencing specific facts.`;

    const effectiveSystemPrompt = systemPrompt
      ? `${defaultSystem}\n\n${systemPrompt}`
      : defaultSystem;

    // Build multi-turn conversation contents adhering to Gemini's role alternation ('user' | 'model')
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      // Include the last 6 messages for conversational context
      const recent = chatHistory.slice(-6);
      for (const msg of recent) {
        if (!msg.content || msg.content.trim().length === 0) continue;
        const role = msg.sender === 'user' ? 'user' : 'model';

        // Avoid consecutive identical roles by appending if necessary
        const lastTurn = contents[contents.length - 1];
        if (lastTurn && lastTurn.role === role) {
          lastTurn.parts[0].text += `\n${msg.content.trim()}`;
        } else {
          contents.push({
            role,
            parts: [{ text: msg.content.trim() }],
          });
        }
      }
    }

    // Prepare user prompt with document context
    let promptWithContext = trimmedQuestion;
    if (context && context.trim().length > 0) {
      promptWithContext = `Document Context for "${filename || 'Document'}":\n"""\n${context.trim()}\n"""\n\nUser Question:\n${trimmedQuestion}`;
    }

    // Ensure the final entry in contents is the user's current question
    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === 'user') {
      lastTurn.parts[0].text += `\n\n${promptWithContext}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: promptWithContext }],
      });
    }

    // 5. Send Request to Google Gemini REST API with Abort Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeoutMs);

    const targetUrl = `${AI_CONFIG.geminiBaseUrl}/${AI_CONFIG.model}:generateContent?key=${apiKey.trim()}`;

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: effectiveSystemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: AI_CONFIG.temperature,
        topP: AI_CONFIG.topP,
        maxOutputTokens: AI_CONFIG.maxOutputTokens,
      },
    };

    let geminiRes: Response;
    try {
      geminiRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiPayload),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Gemini API request timed out after 30 seconds. Please try again.' },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to establish connection to Gemini AI API.' },
        { status: 503 }
      );
    }

    clearTimeout(timeoutId);

    // 6. Handle HTTP Status Errors
    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Raw text error
      }

      const errorMessage = errorData.error?.message || 'Gemini API call unsuccessful';

      if (geminiRes.status === 429) {
        return NextResponse.json(
          {
            error: 'Google Gemini rate limit or quota exceeded. Please wait a few moments before sending another message.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
          { status: 429 }
        );
      }

      if (geminiRes.status === 400 || geminiRes.status === 403) {
        if (errorMessage.toLowerCase().includes('api key') || geminiRes.status === 403) {
          return NextResponse.json(
            {
              error: 'Invalid or restricted Gemini API Key. Please verify your GEMINI_API_KEY in .env.local.',
              code: 'INVALID_API_KEY',
            },
            { status: 403 }
          );
        }
      }

      return NextResponse.json(
        {
          error: `AI Service Error (${geminiRes.status}): ${errorMessage.slice(0, 200)}`,
        },
        { status: geminiRes.status }
      );
    }

    // 7. Parse Response
    const data = await geminiRes.json();
    const candidate = data.candidates?.[0];
    const answerText = candidate?.content?.parts?.[0]?.text;

    if (!answerText || answerText.trim().length === 0) {
      if (candidate?.finishReason === 'SAFETY') {
        return NextResponse.json({
          answer: 'The response was flagged by safety filters. Please rephrase your query.',
          model: AI_CONFIG.model,
        });
      }
      return NextResponse.json({
        answer: 'The AI model returned an empty response. Please try rephrasing your question.',
        model: AI_CONFIG.model,
      });
    }

    return NextResponse.json({
      answer: answerText.trim(),
      model: AI_CONFIG.model,
      provider: 'Google Gemini',
    });

  } catch (error: any) {
    console.error('Unexpected error in /api/chat:', error?.message || error);
    return NextResponse.json(
      { error: 'An unexpected internal server error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
