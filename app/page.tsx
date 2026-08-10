'use client';

import { useState, useRef, useEffect } from 'react';

const POLL_INTERVAL_MS = 8000; // ← change polling rate

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
        // No jobId? Treat it as a synchronous response (fallback).
        setResponse(data);
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

  // Normalize the response into an array we can render
  const signals = Array.isArray(response)
    ? response
    : response?.signals || null;

  return (
    <main className="max-w-6xl mx-auto p-8">
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

      {/* Loading indicator while polling */}
      {loading && (
        <p className="text-gray-600 mb-4">
          <span className="animate-pulse">●</span> Analyzing "{sector}" — this
          may take a few minutes…
        </p>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Structured table if we got signal objects */}
      {signals && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Source</th>
              <th className="p-2">Category</th>
              <th className="p-2">Confidence</th>
              <th className="p-2">Quote</th>
              <th className="p-2">Timeframe</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s: any, i: number) => (
              <tr key={i} className="border-b align-top">
                <td className="p-2">
                  {s.source_url ? (
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 underline">
                      {s.title || 'Source'}
                    </a>
                  ) : (s.title || '—')}
                </td>
                <td className="p-2">{s.category || '—'}</td>
                <td className="p-2">{s.confidence || '—'}</td>
                <td className="p-2 max-w-md">{s.quote || '—'}</td>
                <td className="p-2">{s.timeframe || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Raw fallback: show the exact response for anything else */}
      {response && !signals && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </main>
  );
}
