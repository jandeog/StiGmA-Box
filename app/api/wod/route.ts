// app/api/wod/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// helper: κρατάμε ημερομηνία στο 00:00:00 UTC για συνέπεια
function todayUtcMidnight(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

// GET /api/wod -> λίστα
export async function GET() {
  try {
    const rows = await prisma.wod.findMany({
      orderBy: { date: 'desc' },
      take: 10,
    });
    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// POST /api/wod -> εισαγωγή sample
export async function POST() {
  try {
    const row = await prisma.wod.create({
      data: {
        id: crypto.randomUUID(),
        date: todayUtcMidnight(),
        title: 'Sample WOD',
        description: 'Test insert from Vercel',
        scoring: 'for_time',
        timeCap: '12:00',
        strengthTitle: 'Back Squat',
        strengthDescription: '3x5 @70%',
        strengthScoreHint: 'kg x reps',
        strengthRecordScore: false,
      },
    });
    return NextResponse.json({ ok: true, data: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
