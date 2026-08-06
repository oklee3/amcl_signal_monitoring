import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.N8N_WEBHOOK_SECRET!, // matches n8n Header Auth
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Workflow returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach workflow' },
      { status: 500 }
    );
  }
}
