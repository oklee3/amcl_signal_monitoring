import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Fail loudly if env vars are missing (instead of sending an empty header)
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (!url || !secret) {
    console.error('Missing env vars — URL:', !!url, 'SECRET:', !!secret);
    return NextResponse.json(
      { error: 'Server misconfigured: missing webhook env vars' },
      { status: 500 }
    );
  }

  try {
    const { sector } = await request.json();

    if (!sector || !sector.trim()) {
      return NextResponse.json(
        { error: 'Priority Sector is required' },
        { status: 400 }
      );
    }

    // Trigger n8n — it responds INSTANTLY with { jobId }, not the full results
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secret,
      },
      body: JSON.stringify({ 'Priority Sector': sector }),
    });

    // Read as text first so a non-JSON response can't crash the route
    const text = await res.text();

    if (!res.ok) {
      console.error('n8n error', res.status, text.slice(0, 300));
      return NextResponse.json(
        { error: `Workflow returned ${res.status}` },
        { status: 502 }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    // Passes { jobId } (or a synchronous payload) straight to the frontend
    return NextResponse.json(data);
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json(
      { error: 'Failed to reach workflow' },
      { status: 500 }
    );
  }
}
