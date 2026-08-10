import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  // Protect the endpoint so only your workflow can write results
  const key = request.headers.get('x-api-key');
  if (key !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobId, results } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Store results under the same key the status endpoint reads, expire in 1 hour
    await kv.set(`job:${jobId}`, results, { ex: 3600 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Results write error:', err);
    return NextResponse.json({ error: 'Failed to store results' }, { status: 500 });
  }
}
