// app/api/wod-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

type AnnouncementEvent = {
  atSeconds: number;
  text: string;
};

type RequestBody = {
  wodDescription: string;
  announcementStyle?: 'hype' | 'calm' | 'serious' | 'drill';
  language?: 'en' | 'el' | 'en+el';
  options?: {
    includeCountdownStart?: boolean;
    includeMidCues?: boolean;
    includeOneMinute?: boolean;
    includeFinalCountdown?: boolean;
  };
};

type WodPlan = {
  totalDurationSeconds: number;
  announcements: AnnouncementEvent[];
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// -------------------------------
// Detect overloaded response
// -------------------------------
function isModelOverloaded(err: any) {
  // we explicitly accept `any` here so JSON.stringify / toLowerCase are OK
  const msg = JSON.stringify(err)?.toLowerCase() ?? '';
  return (
    msg.includes('"code":503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('retry') ||
    msg.includes('busy')
  );
}

// -------------------------------
// Core call wrapper to try a model
// -------------------------------
async function callGeminiModel(
  modelName: string,
  prompt: string
) {
  if (!ai) throw new Error('Gemini client not initialized');

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });

  const raw = response.text || '{}';
  const parsed = JSON.parse(raw);

  if (
    typeof parsed.totalDurationSeconds !== 'number' ||
    !Array.isArray(parsed.announcements)
  ) {
    throw new Error('Invalid JSON format from model');
  }

  parsed.totalDurationSeconds = Math.max(
    180,
    Math.min(90 * 60, Math.round(parsed.totalDurationSeconds))
  );

  parsed.announcements = parsed.announcements
    .filter((a: any) => typeof a.atSeconds === 'number' && typeof a.text === 'string')
    .map((a: any) => ({
      atSeconds: Math.max(
        0,
        Math.min(parsed.totalDurationSeconds, Math.round(a.atSeconds))
      ),
      text: a.text.trim(),
    }))
    .sort((a: any, b: any) => a.atSeconds - b.atSeconds);

  return parsed as WodPlan;
}

// -------------------------------
// API handler
// -------------------------------
export async function POST(req: NextRequest) {
  if (!ai || !GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not set on server' },
      { status: 500 }
    );
  }

  const body: RequestBody = await req.json();
  const {
    wodDescription,
    announcementStyle = 'hype',
    language = 'en',
    options = {},
  } = body;

  if (!wodDescription) {
    return NextResponse.json({ error: 'Missing wodDescription' }, { status: 400 });
  }

  const {
    includeCountdownStart = true,
    includeMidCues = true,
    includeOneMinute = true,
    includeFinalCountdown = true,
  } = options;

  const prompt = `
You are a CrossFit-style WOD floor coach and DJ voice.

Task 1: Infer the TOTAL DURATION (time cap) of the workout from the description.
Task 2: Generate announcement events across that timeline.

Output ONLY valid JSON:
{
  "totalDurationSeconds": number,
  "announcements": [
    { "atSeconds": number, "text": string },
    ...
  ]
}

WOD:
${wodDescription}

STYLE: ${announcementStyle}
LANGUAGE: ${language}
OPTIONS:
- includeCountdownStart: ${includeCountdownStart}
- includeMidCues: ${includeMidCues}
- includeOneMinute: ${includeOneMinute}
- includeFinalCountdown: ${includeFinalCountdown}
`;

  // -------------------------------
  // Try main model first
  // -------------------------------
  try {
    const plan = await callGeminiModel('gemini-2.5-flash', prompt);
    return NextResponse.json(plan);
  } catch (err: any) { // 👈 explicitly `any` here
    if (!isModelOverloaded(err)) {
      console.error('Gemini 2.5 error (not overload):', err);
      return NextResponse.json(
        { error: err?.message || 'Internal error using gemini-2.5-flash' },
        { status: 500 }
      );
    }

    console.warn('⚠️ gemini-2.5-flash overloaded → falling back to gemini-2.0-flash');
  }

  // -------------------------------
  // Fallback to gemini-2.0-flash
  // -------------------------------
  try {
    const plan = await callGeminiModel('gemini-2.0-flash', prompt);
    return NextResponse.json(plan);
  } catch (err: any) { // 👈 explicitly `any` here too
    console.error('Gemini fallback model also failed:', err);

    return NextResponse.json(
      {
        error:
          err?.message ||
          'All Gemini models are currently overloaded/unavailable. Please try again soon.',
      },
      { status: 503 }
    );
  }
}
