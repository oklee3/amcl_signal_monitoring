import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET() {
  const redis = await getRedis();
  await redis.set('ping', 'pong', { EX: 30 });
  const val = await redis.get('ping');
  return NextResponse.json({ val });
}
