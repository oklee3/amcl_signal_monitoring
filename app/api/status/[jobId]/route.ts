import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }   // ← Promise now
) {
  const { jobId } = await params;                        // ← await it

  const results = await kv.get(`job:${jobId}`);

  if (!results) {
    return NextResponse.json({ done: false });
  }

  return NextResponse.json({ done: true, results });
}

