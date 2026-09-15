import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, question, context, filename, chatHistory, actionType } = await req.json();

    const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';

    // Format recent conversation history for multi-turn conversational memory
    let conversationHistoryText = '';
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      const recentMessages = chatHistory.slice(-6);
      conversationHistoryText = '\n\nRecent Conversation History:\n' + 
        recentMessages
          .map((m: any) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
    }

    const fullPrompt = `${systemPrompt}${conversationHistoryText}\n\nCurrent Task/Question: ${question}\n\nAnswer:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama3', // Will work with llama3, llama3.2, llama2, mistral, etc.
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: actionType === 'qa' ? 0.2 : 0.1,
          top_p: 0.9,
        }
      }),
    });

    clearTimeout(timeoutId);

    if (!ollamaRes.ok) {
      return NextResponse.json({ error: 'Ollama endpoint returned non-200 status' }, { status: 502 });
    }

    const data = await ollamaRes.json();
    return NextResponse.json({ answer: data.response });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Local Ollama service unavailable', details: error.message },
      { status: 503 }
    );
  }
}
