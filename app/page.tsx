"use client";

import { useState } from "react";
import { HotelDossierView, HotelDossier } from "@/components/HotelDossier";

type ApiResponse = {
  dossier?: HotelDossier;
  usage?: { input_tokens: number; output_tokens: number };
  error?: string;
  raw?: string;
};

export default function Home() {
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelName, city, country }),
      });
      const data: ApiResponse = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muse-600 flex items-center justify-center text-white font-bold text-lg">
            M
          </div>
          <div>
            <h1 className="text-2xl font-bold text-muse-900">
              Muse Hotel Intelligence
            </h1>
            <p className="text-sm text-slate-600">
              Deep research dossier for any hotel — built for the Muse sales
              team.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 mb-8">
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Hotel name
            </label>
            <input
              required
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="e.g. Le Bristol Paris"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-muse-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              City
            </label>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-muse-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Country
            </label>
            <input
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="France"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-muse-500"
            />
          </div>
          <div className="md:col-span-1 md:col-start-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-muse-600 hover:bg-muse-700 disabled:bg-slate-400 text-white font-medium py-2.5 transition"
            >
              {loading ? "Researching…" : "Run deep research"}
            </button>
          </div>
        </form>
        {loading && (
          <p className="mt-4 text-sm text-slate-500">
            Claude is browsing the web, reading reviews, and compiling the
            dossier. This usually takes 60–180 seconds.
          </p>
        )}
      </section>

      {result?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 mb-6">
          <div className="font-semibold mb-1">Error</div>
          <div className="text-sm whitespace-pre-wrap">{result.error}</div>
          {result.raw && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Raw model output</summary>
              <pre className="mt-2 whitespace-pre-wrap">{result.raw}</pre>
            </details>
          )}
        </div>
      )}

      {result?.dossier && <HotelDossierView dossier={result.dossier} />}

      {result?.usage && (
        <div className="mt-6 text-xs text-slate-400">
          {result.usage.input_tokens} in / {result.usage.output_tokens} out
          tokens
        </div>
      )}
    </main>
  );
}
