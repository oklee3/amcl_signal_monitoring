import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { sector } = await request.json();

    if (!sector || !sector.trim()) {
      return NextResponse.json(
        { error: 'Priority Sector is required' },
        { status: 400 }
      );
    }

    const res = await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.N8N_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({ 'Priority Sector': sector }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Workflow returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach workflow' },
      { status: 500 }
    );
  }
}
