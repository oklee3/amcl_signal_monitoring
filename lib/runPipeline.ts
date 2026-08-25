// orchestrator: activate workflow on webhook trigger, poll for response

import {
  findDocuments, extractDocuments, buildPrompt, analyze, parseResults,
} from './pipeline';
import { getRedis } from './redis';

export async function runPipeline(jobId: string, sector: string) {
  const redis = await getRedis();
  try {
    const urls = await findDocuments(sector);
    console.log('1. findDocuments:', typeof urls, Array.isArray(urls) ? urls.length : urls);

    const documents = await extractDocuments(urls);
    console.log('2. extractDocuments:', typeof documents, documents?.length);

    const prompt = buildPrompt(documents);
    console.log('3. buildPrompt:', typeof prompt, prompt?.length);

    const text = await analyze(prompt);
    console.log('4. analyze:', typeof text, text?.slice?.(0, 80));

    const results = parseResults(text);
    console.log('5. parseResults:', typeof results); 

    // frontend polls this key 
    await redis.set(`job:${jobId}`, JSON.stringify(results), { EX: 3600 });
  } catch (err) {
    await redis.set(`job:${jobId}`,
      JSON.stringify({ error: String(err) }), { EX: 3600 });
  }
}
