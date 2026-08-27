// orchestrator: runs the pipeline in the background, writes progress + results to Redis

import {
  findDocuments, extractDocuments, buildPrompt, analyze, parseResults,
} from './pipeline';
import { getRedis } from './redis';

export async function runPipeline(jobId: string, sector: string) {
  const redis = await getRedis();
  const key = `job:${jobId}`;
  const log: string[] = [];

  // Helper: append a timestamped message and write current progress to Redis
  const step = async (message: string) => {
    const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
    log.push(`[${ts}] ${message}`);
    await redis.set(key, JSON.stringify({ status: 'processing', log }), { EX: 3600 });
  };

  try {
    await step(`Searching for "${sector}" documents…`);
    const urls = await findDocuments(sector);
    console.log('1. findDocuments:', typeof urls, Array.isArray(urls) ? urls.length : urls);

    await step(`Found ${urls.length} documents. Extracting text…`);
    const documents = await extractDocuments(urls);
    console.log('2. extractDocuments:', typeof documents, documents?.length);

    await step(`Extracted ${documents.length} PDFs. Building analysis prompt…`);
    const prompt = buildPrompt(documents);
    console.log('3. buildPrompt:', typeof prompt, prompt?.length);

    await step('Analyzing documents for RFP signals…');
    const text = await analyze(prompt);
    console.log('4. analyze:', typeof text, text?.slice?.(0, 80));

    const results = parseResults(text);
    console.log('5. parseResults:', typeof results);

    // Final write: status 'done', include the full log AND the results
    await step('Done.');
    await redis.set(
      key,
      JSON.stringify({ status: 'done', log, results }),
      { EX: 3600 }
    );
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    await redis.set(
      key,
      JSON.stringify({ status: 'error', log, error: String(err) }),
      { EX: 3600 }
    );
  }
}
