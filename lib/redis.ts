import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export async function getRedis() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (e) => console.error('Redis error', e));
  }
  if (!client.isOpen) {          // ← reconnect if the socket dropped
    await client.connect();
  }
  return client;
}
