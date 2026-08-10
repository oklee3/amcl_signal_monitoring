import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function POST(request: Request) {
  // Only your workflow (with the secret) can write
  if (request.headers.get('x-api-key') !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobId, results } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const redis = await getRedis();
    // redis client stores strings → stringify, expire after 1 hour
    await redis.set(`job:${jobId}`, JSON.stringify(results), { EX: 3600 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Results write error:', err);
    return NextResponse.json({ error: 'Failed to store results' }, { status: 500 });
  }
}
