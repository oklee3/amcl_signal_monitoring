import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const redis = await getRedis();
  const raw = await redis.get(`job:${jobId}`);

  if (!raw) {
    return NextResponse.json({ done: false });   // still running
  }

  // stored as a string → parse back into an object/array
  return NextResponse.json({ done: true, results: JSON.parse(raw) });
}

