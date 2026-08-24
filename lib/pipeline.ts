// Search node
export async function findDocuments(sector: string) {
  const queries = buildQueries(sector);
  const perQuery = await Promise.all(queries.map((v) => searchYouCom(v)));

  // De-duplicate by url
  const seen = new Set<string>();
  return perQuery.flat().filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// extraction loop
export async function extractDocuments(searchResults: any[]) {
  // iterate through pages, extract from documents
}

// Prompt-builder
export function buildPrompt(documents: any[]) {
  // collect results, build prompt for llm
}

// LLM node 
export async function analyze(prompt: string) {
  // generate llm response
}

// parse llm response
export function parseResults(text: string) {
  let raw = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try { return JSON.parse(raw); }
  catch { return { raw: text }; }
}

// -----------------------------
// Helper functions for pipeline
// -----------------------------

interface QueryVariant {
  query: string;
  recency_from: string;
  recency_label: string;
  sector: string;
  generated_at: string;
}

// Query builder
export function buildQueries(sector: string): QueryVariant[] {
  const now = new Date();                        
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const recencyFrom = oneMonthAgo.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const VARIANTS = [
    `${sector} board meeting minutes capital budget filetype:pdf`,
    `${sector} board meeting agenda packet ${now.getFullYear()} filetype:pdf`,
    `${sector} board minutes approved capital plan filetype:pdf`,
    `${sector} authority board meeting resolution filetype:pdf`,
    `${sector} committee meeting minutes budget approval filetype:pdf`,
  ];

  return VARIANTS.map((q) => ({
    query: q,
    recency_from: recencyFrom,
    recency_label: 'Past 1 month',
    sector,
    generated_at: today,
  }));
}

// access you.com api
async function searchYouCom(v: QueryVariant) {
  const res = await fetch(
    `https://api.ydc-index.io/search?query=${encodeURIComponent(v.query)}`,
    { method: 'GET', headers: { 'X-API-Key': process.env.YOU_API_KEY! } }
  );
  if (!res.ok) throw new Error(`You.com search failed: ${res.status}`);
  const data = await res.json();

  return (data.hits ?? []).map((r: any) => ({
    title: r.title ?? 'Untitled',
    url: r.url,
    snippet: (r.snippets ?? []).join(' ') || r.description || '',
    query: v.query,
  }));
}


