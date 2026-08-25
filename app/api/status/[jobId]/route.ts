import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const redis = await getRedis();
  const raw = await redis.get(`job:${jobId}`);

  if (!raw) {
    // Key not written yet → pipeline still running
    return NextResponse.json({ status: 'processing' });
  }

  const data = JSON.parse(raw);
  if (data.error) {
    return NextResponse.json({ status: 'error', error: data.error });
  }
  return NextResponse.json({ status: 'done', results: data });
}


