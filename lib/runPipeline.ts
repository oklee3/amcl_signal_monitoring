// orchestrator: activate workflow on webhook trigger, poll for response

import {
  findDocuments, extractDocuments, buildPrompt, analyze, parseResults,
} from './pipeline';
import { getRedis } from './redis';

export async function runPipeline(jobId: string, sector: string) {
  const redis = await getRedis();
  try {
    const searchResults = await findDocuments(sector);   // stage 1
    const documents = await extractDocuments(searchResults); // stage 2
    const prompt = buildPrompt(documents);               // stage 3
    const text = await analyze(prompt);                  // stage 4
    const results = parseResults(text);                  // stage 5

    // frontend polls this key
    await redis.set(`job:${jobId}`, JSON.stringify(results), { EX: 3600 });
  } catch (err) {
    await redis.set(`job:${jobId}`,
      JSON.stringify({ error: String(err) }), { EX: 3600 });
  }
}
