const SKIP = ['eforms', 'jotform', 'pdffiller', 'templateroller', 'formswift', 'template'];

// Search node
// finds documents based on specified sector - currently defaults to 1 month recency
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


// extracts pdfs from found web pages
import { extractText, getDocumentProxy } from 'unpdf';

export async function extractDocuments(
  results: { url: string; title: string; description?: string }[]
) {
  const docs = await Promise.all(
    results.map(async (r) => {
      try {
        // Download the PDF bytes
        const res = await fetch(r.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalMonitor/1.0)' },
        });
        if (!res.ok) throw new Error(`fetch ${res.status}`);

        const buf = new Uint8Array(await res.arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const { text, totalPages } = await extractText(pdf, { mergePages: true });

        return {
          title: r.title,
          url: r.url,
          content: text?.trim() || '',
          numPages: totalPages,
        };
      } catch (err) {
        console.error(`Failed to extract ${r.url}:`, err);
        return { title: r.title, url: r.url, content: '', numPages: 0 };
      }
    })
  );

  const usable = docs.filter((d) => d.content.length > 100);
  console.log(`Extracted ${usable.length}/${docs.length} PDFs with text`);
  return usable;
}

export function buildPrompt(
  documents: { title: string; url?: string; content: string }[]
): string {
  // Dynamic date — computed at runtime (was hardcoded in n8n)
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'UTC',
  });

  let prompt = `You are an intelligence analyst specializing in public-sector 
procurement for institutional asset management and investment consulting services.
TODAY'S DATE: ${today}.

Analyze each document below and identify any signal that an organization may 
soon issue an RFP for asset management, investment advisory, or investment 
consulting services. Look for: contract expirations, performance reviews, 
new CIO/treasurer hires, asset allocation studies, RFIs, budget line items 
for advisory services, or explicit intent to solicit proposals. Include 
low-confidence and indirect signals.

For each signal, return JSON: title, verbatim quote, category, confidence 
(High/Medium/Low), reasoning, and any mentioned timeframe. If a document 
has no signals, state "No signals" for that document specifically.
`;

  prompt += '=== DOCUMENTS ===\n\n';
  documents.forEach((doc, i) => {
    prompt += `--- DOCUMENT ${i + 1}: ${doc.title || 'Untitled'} ---\n`;
    prompt += `${(doc.content || '(no content)').slice(0, 5000)}\n\n`;
  });

  return prompt;
}

// TEMPORARY MOCK — returns the prompt + document titles instead of calling an LLM.
// Swap this for a real provider call when ready to spend tokens.
export async function analyze(prompt: string): Promise<string> {
  // Pull each document's title back out of the prompt for a quick sanity check
  const titles = [...prompt.matchAll(/--- DOCUMENT \d+: (.+?) ---/g)].map(
    (m) => m[1]
  );

  const mockResult = {
    mock: true,
    generated_at: new Date().toISOString(),
    document_count: titles.length,
    document_titles: titles,
    prompt_preview: prompt.slice(0, 500) + '...',
    prompt_length: prompt.length,
    // Placeholder shape matching what the real LLM will eventually return
    signals: titles.map((title) => ({
      title,
      signal: 'No signals (MOCK — LLM not called)',
    })),
  };

  // Return as a JSON string so parseResults handles it identically to a real response
  return JSON.stringify(mockResult, null, 2);
}

// parse llm response
export function parseResults(text: string) {
  // parse final result
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

