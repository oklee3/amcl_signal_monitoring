'use client';

import { useState, useRef, useEffect } from 'react';

const POLL_INTERVAL_MS = 8000; // ← change polling rate

export default function Home() {
  const [sector, setSector] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<any>(null);

  // Clean up polling if the component unmounts [[7]]
  useEffect(() => () => clearInterval(pollRef.current), []);

  async function runWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      // 1. Trigger the pipeline — /api/signals responds instantly with a jobId
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

      // 2. Poll the status endpoint until results are ready [[1]][[7]]
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/status/${jobId}`);
          if (!s.ok) return;
          const status = await s.json();

          // Route returns { status: 'done'|'processing'|'error', results?, error? }
          if (status.status === 'done' || status.done) {
            clearInterval(pollRef.current);
            setResponse(status.results ?? status);
            setLoading(false);
          } else if (status.status === 'error') {
            clearInterval(pollRef.current);
            setError(status.error || 'Pipeline failed');
            setLoading(false);
          }
          // else 'processing' → keep polling
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
        Array.isArray(doc.signals) // ← only map real arrays
          ? doc.signals.map((s: any) => ({ ...s, document: doc.document }))
          : [] // skip "No signals" docs
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

