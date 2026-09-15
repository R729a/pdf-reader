import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/config
 * Check configuration status
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(
    apiKey &&
    apiKey.trim().length > 0 &&
    apiKey !== 'your_gemini_api_key_here'
  );
  return NextResponse.json({
    configured: isConfigured,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  });
}

/**
 * POST /api/config
 * Update GEMINI_API_KEY in .env.local securely from the server
 */
export async function POST(req: NextRequest) {
  try {
    const { apiKey, model } = await req.json();

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key cannot be empty' },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 20) {
      return NextResponse.json(
        { error: 'Invalid API key format. A valid Gemini API key typically begins with "AIzaSy" and is at least 30 characters long.' },
        { status: 400 }
      );
    }

    const envPath = path.join(process.cwd(), '.env.local');

    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    if (/^GEMINI_API_KEY=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${trimmedKey}`);
    } else {
      envContent = `GEMINI_API_KEY=${trimmedKey}\n` + envContent;
    }

    if (model && typeof model === 'string' && model.trim().length > 0) {
      const trimmedModel = model.trim();
      if (/^GEMINI_MODEL=.*$/m.test(envContent)) {
        envContent = envContent.replace(/^GEMINI_MODEL=.*$/m, `GEMINI_MODEL=${trimmedModel}`);
      } else {
        envContent += `\nGEMINI_MODEL=${trimmedModel}\n`;
      }
      process.env.GEMINI_MODEL = trimmedModel;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');
    process.env.GEMINI_API_KEY = trimmedKey;

    return NextResponse.json({
      success: true,
      message: 'Gemini API key successfully saved to .env.local',
      configured: true,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
  } catch (error: any) {
    console.error('Error saving API key to .env.local:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to write to .env.local' },
      { status: 500 }
    );
  }
}
