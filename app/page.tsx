'use client';

import { useState, useRef, useEffect } from 'react';

const POLL_INTERVAL_MS = 8000;

export default function Home() {
  const [sector, setSector] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const pollRef = useRef<any>(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function runWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);
    setLog([]);

    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const { jobId } = data;
      if (!jobId) {
        setResponse(data);
        setLoading(false);
        return;
      }

      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/status/${jobId}`);
          if (!s.ok) return;
          const status = await s.json();

          if (status.log) setLog(status.log);

          if (status.status === 'done' || status.done) {
            clearInterval(pollRef.current);
            setResponse(status.results ?? status);
            setLoading(false);
          } else if (status.status === 'error') {
            clearInterval(pollRef.current);
            setError(status.error || 'Pipeline failed');
            if (status.log) setLog(status.log);
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

  let parsed = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = null;
    }
  }
  const dataArray = Array.isArray(parsed)
    ? parsed
    : parsed?.results ?? parsed?.text ?? null;

  const signals = Array.isArray(dataArray)
    ? dataArray.flatMap((doc: any) =>
        Array.isArray(doc.signals)
          ? doc.signals.map((s: any) => ({ ...s, document: doc.document }))
          : []
      )
    : null;

  const confidenceStyle = (c: string) =>
    c === 'High'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : c === 'Medium'
      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
      : 'bg-slate-50 text-slate-600 ring-slate-500/20';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            RFP Signals
          </h1>
          <p className="mt-2 text-slate-500">
            AMCL - RFP signal monitoring tool
          </p>
        </header>

        {/* Search card */}
        <form
          onSubmit={runWorkflow}
          className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mb-8"
        >
          <label
            htmlFor="sector"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Priority sector
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="sector"
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g. Transportation Authority"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
            <button
              type="submit"
              disabled={loading || !sector.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Analyzing…' : 'Run Analysis'}
            </button>
          </div>
        </form>

        {/* Loading + live progress */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 mb-8">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
              </span>
              <p className="text-slate-600">
                Analyzing <span className="font-medium text-slate-900">“{sector}”</span> — this may take a few minutes.
              </p>
            </div>
            {log.length > 0 && (
              <ol className="mt-4 space-y-1.5 border-l-2 border-slate-100 pl-4">
                {log.map((line, i) => (
                  <li
                    key={i}
                    className={`text-sm ${
                      i === log.length - 1
                        ? 'text-slate-800 font-medium'
                        : 'text-slate-400'
                    }`}
                  >
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 ring-1 ring-red-200 rounded-2xl p-5 mb-8">
            <p className="text-red-700 font-medium">Something went wrong</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            {log.length > 0 && (
              <ol className="mt-3 space-y-1 border-l-2 border-red-100 pl-4">
                {log.map((line, i) => (
                  <li key={i} className="text-sm text-red-500/80">
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Results as cards */}
        {signals && signals.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {signals.length} signal{signals.length === 1 ? '' : 's'} found
              </h2>
            </div>
            {signals.map((s: any, i: number) => (
              <article
                key={i}
                className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 hover:ring-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {s.title || 'Untitled signal'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {s.document || '—'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${confidenceStyle(
                      s.confidence
                    )}`}
                  >
                    {s.confidence || 'Low'} confidence
                  </span>
                </div>

                {s.verbatim_quote && (
                  <blockquote className="mt-4 border-l-2 border-slate-200 pl-4 text-slate-600 italic">
                    “{s.verbatim_quote}”
                  </blockquote>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-slate-400 font-medium">Category</dt>
                    <dd className="text-slate-700 mt-0.5">{s.category || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-medium">Timeframe</dt>
                    <dd className="text-slate-700 mt-0.5">{s.timeframe || '—'}</dd>
                  </div>
                </div>

                {s.reasoning && (
                  <div className="mt-4 text-sm">
                    <dt className="text-slate-400 font-medium">Why it matters</dt>
                    <dd className="text-slate-600 mt-0.5 leading-relaxed">
                      {s.reasoning}
                    </dd>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {/* Empty state */}
        {signals && signals.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-10 text-center">
            <p className="text-slate-500">
              No signals found for{' '}
              <span className="font-medium text-slate-700">“{sector}”</span>.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Try a different sector or check back later.
            </p>
          </div>
        )}

        {/* Raw fallback (dev only) */}
        {response && signals === null && (
          <pre className="bg-slate-900 text-slate-100 p-5 rounded-2xl overflow-auto text-xs">
            {typeof response === 'string'
              ? response
              : JSON.stringify(response, null, 2)}
          </pre>
        )}
      </main>
    </div>
  );
}
