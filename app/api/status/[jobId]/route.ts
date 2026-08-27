import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const redis = await getRedis();
  const raw = await redis.get(`job:${jobId}`);

  // Key not written yet → job just started, still processing
  if (!raw) {
    return NextResponse.json({ status: 'processing', log: [] });
  }

  // runPipeline already stored { status, log, results? } or { status, log, error? }
  return NextResponse.json(JSON.parse(raw));
}



