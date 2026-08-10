import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } }
) {
  const results = await kv.get(`job:${params.jobId}`);

  if (!results) {
    // Not written yet → workflow still running
    return NextResponse.json({ done: false });
  }

  // Results exist → workflow finished
  return NextResponse.json({ done: true, results });
}
