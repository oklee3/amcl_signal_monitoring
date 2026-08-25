import { after, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/runPipeline';

export async function POST(request: Request) {
  try {
    const { sector } = await request.json();
    if (!sector?.trim()) {
      return NextResponse.json({ error: 'Priority Sector is required' }, { status: 400 });
    }
    const jobId = crypto.randomUUID();
    after(() => runPipeline(jobId, sector.trim()));
    return NextResponse.json({ jobId });
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Failed to start workflow' }, { status: 500 });
  }
}
