'use client';

import { useState, useRef, useEffect } from 'react';

const POLL_INTERVAL_MS = 8000; // ← change polling rate

const MOCK_MODE = true; // use preset results for testing
const MOCK_RESULTS = [
    {
    "document": "DOCUMENT 1: Untitled (Long Beach Transit FY2027 Budget Book)",
    "signals": [
      {
        "title": "Financial policies / budget materials for FY2027",
        "verbatim_quote": "Financial Policies ................................................................................................................... 39",
        "category": "Budget / Financial review",
        "confidence": "Low",
        "reasoning": "A published FY2027 budget book with a dedicated \"Financial Policies\" section and capital/operating budget summaries signals active financial planning. Agencies often review investment management and advisory arrangements when setting budgets and policies, which can precede RFPs for investment or consulting services—but the document contains no explicit procurement language.",
        "timeframe": "FY 2027 (document date)"
      }
    ]
  },
  {
    "document": "DOCUMENT 2: Untitled (Dallas Area Rapid Transit - Special Board meeting agenda / CEO employment agreement)",
    "signals": [
      {
        "title": "New CEO appointment / employment agreement",
        "verbatim_quote": "The position of DART President & Chief Executive Officer is currently vacant, and the Board worked with an executive recruiting firm to solicit applications for the vacant position. Board members conducted interviews with qualified candidates.",
        "category": "New executive hire",
        "confidence": "Medium",
        "reasoning": "A new President & CEO will be appointed imminently (Board action item July 21, 2026). New chief executives frequently commission organizational and financial reviews, reassess external advisors, and may restart procurement processes for major service providers (including investment advisors/consultants). This is an indirect but actionable signal that contract reviews or RFPs could follow in the months after the hire.",
        "timeframe": "Immediate / near-term (Board meeting July 21, 2026; selection authorized July 14, 2026)"
      },
      {
        "title": "Reference to long-range financial plan in CEO funding language",
        "verbatim_quote": "funding for this position is within current budget and FY 2026 20-Year Financial Plan allocations.",
        "category": "Financial plan / strategic planning",
        "confidence": "Low",
        "reasoning": "Reference to a 20-year financial plan suggests active long-term financial planning at DART. Long-range financial planning sometimes triggers external advisory needs (asset-liability analysis, investment policy review, strategic asset allocation), but the mention here is incidental and not an explicit procurement intent.",
        "timeframe": "FY 2026 / ongoing"
      }
    ]
  },
  {
    "document": "DOCUMENT 3: Untitled (San Mateo County Transportation Authority Board agenda Aug 6, 2026)",
    "signals": [
      {
        "title": "Quarterly investment report item on board agenda",
        "verbatim_quote": "12.a. Accept Quarterly Investment Report Motion",
        "category": "Investment oversight / report",
        "confidence": "Low",
        "reasoning": "An explicit quarterly investment report item indicates active oversight of invested funds. While routine, regular investment reporting can precede deeper reviews or RFPs for investment management/advisory services if performance or policy issues arise. This is an indirect signal (routine governance item) rather than evidence of an imminent RFP.",
        "timeframe": "August 6, 2026 (board meeting date)"
      }
    ]
  },
  {
    "document": "DOCUMENT 4: Untitled (Oklahoma Transportation Commission agenda Aug 3, 2026)",
    "signals": "No signals"
  },
]

export default function Home() {
  const [sector, setSector] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<any>(null);

  // Clean up polling if the component unmounts
  useEffect(() => () => clearInterval(pollRef.current), []);

  async function runWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);

    // MOCK MODE — skip the workflow, return sample data instantly
    if (MOCK_MODE) {
      setTimeout(() => {
        setResponse(MOCK_RESULTS);
        setLoading(false);
      }, 500);
      return;
    }

    try {
      // 1. Trigger the workflow — n8n responds instantly with a jobId
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const { jobId } = data;
      if (!jobId) {
        setResponse(data); // synchronous fallback
        setLoading(false);
        return;
      }

      // 2. Poll the status endpoint until the results are ready
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/status/${jobId}`);
          if (!s.ok) return;
          const status = await s.json();
          if (status.done) {
            clearInterval(pollRef.current);
            setResponse(status.results);
            setLoading(false);
          }
        } catch (err: any) {
          console.error('poll tick failed (retrying):', err);
        }
      }, POLL_INTERVAL_MS);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  // Handle results that may arrive as a JSON string OR already-parsed
  let parsed = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = null;
    }
  }
  // In case results are wrapped (e.g. { results: [...] } or { text: [...] })
  const dataArray = Array.isArray(parsed)
    ? parsed
    : parsed?.results ?? parsed?.text ?? null;

  // Flatten [{ document, signals: [...] }] into a flat array of rows
  const signals = Array.isArray(dataArray)
    ? dataArray.flatMap((doc: any) =>
      Array.isArray(doc.signals)                        // ← only map real arrays
        ? doc.signals.map((s: any) => ({ ...s, document: doc.document }))
        : []                                            // skip "No signals" docs
      )
    : null;

  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">RFP Signals</h1>
      <p className="text-gray-600 mb-6">
        Enter a priority sector to search for early RFP indicators.
      </p>

      <form onSubmit={runWorkflow} className="flex gap-2 mb-6">
        <input
          type="text"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="e.g. Transportation Authority"
          className="flex-1 border rounded px-3 py-2"
          required
        />
        <button
          type="submit"
          disabled={loading || !sector.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </form>

      {loading && (
        <p className="text-gray-600 mb-4">
          <span className="animate-pulse">●</span> Analyzing “{sector}” — this
          may take a few minutes…
        </p>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Structured table if we got signals */}
      {signals && signals.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Document</th>
              <th className="p-2">Title</th>
              <th className="p-2">Category</th>
              <th className="p-2">Confidence</th>
              <th className="p-2">Quote</th>
              <th className="p-2">Reasoning</th>
              <th className="p-2">Timeframe</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s: any, i: number) => (
              <tr key={i} className="border-b align-top">
                <td className="p-2 max-w-xs">{s.document || '—'}</td>
                <td className="p-2">{s.title || '—'}</td>
                <td className="p-2">{s.category || '—'}</td>
                <td className="p-2">
                  <span
                    className={
                      s.confidence === 'High'
                        ? 'text-green-700 font-semibold'
                        : s.confidence === 'Medium'
                        ? 'text-yellow-700 font-semibold'
                        : 'text-gray-500'
                    }
                  >
                    {s.confidence || '—'}
                  </span>
                </td>
                <td className="p-2 max-w-md italic text-gray-700">
                  {s.verbatim_quote || '—'}
                </td>
                <td className="p-2 max-w-lg text-gray-600">
                  {s.reasoning || '—'}
                </td>
                <td className="p-2">{s.timeframe || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Empty state: results came back but no signals */}
      {signals && signals.length === 0 && (
        <p className="text-gray-600">No signals found for “{sector}”.</p>
      )}

      {/* Raw fallback: show whatever we got if it's not the expected shape */}
      {response && signals === null && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
          {typeof response === 'string'
            ? response
            : JSON.stringify(response, null, 2)}
        </pre>
      )}
    </main>
  );
}
