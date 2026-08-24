const SKIP = ['eforms', 'jotform', 'pdffiller', 'templateroller', 'formswift', 'template'];

// Search node
export async function findDocuments(sector: string) {
  const queries = buildQueries(sector);
  const perQuery = await Promise.all(queries.map((v) => searchYouCom(v)));

  const seen = new Set<string>();

  const items = perQuery
    .flat()                             
    .filter((x) => x && x.url)
    .map((x) => ({ ...x, url: x.url.replace(/^http:\/\//, 'https://') }))
    // drop template/form sites
    .filter((x) => {
      const url = x.url.toLowerCase();
      const text = `${x.title ?? ''} ${x.description ?? x.snippet ?? ''}`.toLowerCase();
      return !SKIP.some((s) => url.includes(s) || text.includes(s));
    })
    // de-duplicate by url
    .filter((x) => {
      if (seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    })
    .map((x) => ({
      url: x.url,
      title: x.title ?? '',
      description: x.description ?? x.snippet ?? '',
    }));

  console.log('URLS TO PROCESS:', items.length);
  return items;
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
  const url = `https://ydc-index.io/v1/search?query=${encodeURIComponent(v.query)}&count=5`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-Key': process.env.YDC_API_KEY! },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`You.com search failed ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // Web results (news ignored)
  return (data.results?.web ?? []).map((r: any) => ({
    title: r.title ?? 'Untitled',
    url: r.url,
    content: r.contents ?? '',
    description: r.description ?? (r.snippets ?? []).join(' ') ?? '',
    query: v.query,
  }));
}

