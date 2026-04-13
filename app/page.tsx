"use client";

import { useEffect, useRef, useState } from "react";
import { HotelDossierView, HotelDossier } from "@/components/HotelDossier";

type LogEntry = {
  type: "log";
  level: "start" | "think" | "search" | "result" | "compose" | "done" | "warn";
  message: string;
  t?: string;
  results?: { title?: string; url?: string }[];
};

type StreamEvent =
  | LogEntry
  | { type: "thinking"; text: string }
  | {
      type: "dossier";
      dossier: HotelDossier;
      usage?: { input_tokens: number; output_tokens: number };
      elapsed?: string;
    }
  | { type: "error"; error: string; raw?: string };

const LEVEL_META: Record<
  LogEntry["level"],
  { label: string; className: string }
> = {
  start: { label: "START", className: "bg-mews-100 text-mews-700" },
  think: { label: "THINK", className: "bg-amber-100 text-amber-700" },
  search: { label: "SEARCH", className: "bg-blue-100 text-blue-700" },
  result: { label: "RESULT", className: "bg-emerald-100 text-emerald-700" },
  compose: { label: "WRITE", className: "bg-slate-200 text-slate-700" },
  done: { label: "DONE", className: "bg-mews-600 text-white" },
  warn: { label: "WARN", className: "bg-red-100 text-red-700" },
};

export default function Home() {
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [thinking, setThinking] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [dossier, setDossier] = useState<HotelDossier | null>(null);
  const [usage, setUsage] = useState<
    { input_tokens: number; output_tokens: number } | null
  >(null);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs, thinking]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLogs([]);
    setThinking("");
    setShowThinking(false);
    setDossier(null);
    setUsage(null);
    setElapsed(null);
    setError(null);
    setRawOutput(null);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelName, city, country }),
      });

      if (
        !res.ok &&
        res.headers.get("content-type")?.includes("application/json")
      ) {
        const body = await res.json();
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      if (!res.body) {
        setError("No response body");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(payload) as StreamEvent;
          } catch {
            continue;
          }
          if (evt.type === "log") {
            setLogs((prev) => [...prev, evt]);
          } else if (evt.type === "thinking") {
            setThinking((prev) => prev + evt.text);
          } else if (evt.type === "dossier") {
            setDossier(evt.dossier);
            setUsage(evt.usage ?? null);
            setElapsed(evt.elapsed ?? null);
          } else if (evt.type === "error") {
            setError(evt.error);
            setRawOutput(evt.raw ?? null);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const showLogPanel = loading || logs.length > 0 || thinking.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-mews-600 flex items-center justify-center text-white font-bold text-lg">
            M
          </div>
          <div>
            <h1 className="text-2xl font-bold text-mews-900">
              Mews Hotel Intelligence
            </h1>
            <p className="text-sm text-slate-600">
              Deep research dossier for any hotel — built for the Mews sales
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mews-500"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mews-500"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mews-500"
            />
          </div>
          <div className="md:col-span-1 md:col-start-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-mews-600 hover:bg-mews-700 disabled:bg-slate-400 text-white font-medium py-2.5 transition"
            >
              {loading ? "Researching…" : "Run deep research"}
            </button>
          </div>
        </form>
      </section>

      {showLogPanel && (
        <section className="rounded-2xl bg-slate-900 text-slate-100 shadow-sm mb-8 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Live research log
              </span>
              {loading && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  streaming
                </span>
              )}
            </div>
            {thinking && (
              <button
                type="button"
                onClick={() => setShowThinking((v) => !v)}
                className="text-xs text-slate-300 hover:text-white underline decoration-dotted"
              >
                {showThinking ? "Hide" : "Show"} thinking (
                {thinking.length.toLocaleString()} chars)
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto px-5 py-4 font-mono text-xs leading-relaxed">
            {logs.length === 0 && !thinking && (
              <div className="text-slate-500">Waiting for the first event…</div>
            )}
            {logs.map((log, i) => {
              const meta = LEVEL_META[log.level];
              return (
                <div key={i} className="mb-2">
                  <div className="flex gap-2 items-start">
                    {log.t && (
                      <span className="text-slate-500 shrink-0 tabular-nums">
                        {log.t.padStart(6)}
                      </span>
                    )}
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-slate-100 break-words">
                      {log.message}
                    </span>
                  </div>
                  {log.results && log.results.length > 0 && (
                    <ul className="ml-[5.5rem] mt-1 space-y-0.5 text-slate-400">
                      {log.results.map((r, j) => (
                        <li key={j} className="truncate">
                          → {r.title || r.url}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {showThinking && thinking && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="text-[10px] uppercase tracking-wide text-amber-300 mb-1">
                  thinking stream
                </div>
                <pre className="whitespace-pre-wrap text-slate-300 text-xs">
                  {thinking}
                </pre>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 mb-6">
          <div className="font-semibold mb-1">Error</div>
          <div className="text-sm whitespace-pre-wrap">{error}</div>
          {rawOutput && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Raw model output</summary>
              <pre className="mt-2 whitespace-pre-wrap">{rawOutput}</pre>
            </details>
          )}
        </div>
      )}

      {dossier && <HotelDossierView dossier={dossier} />}

      {(usage || elapsed) && (
        <div className="mt-6 text-xs text-slate-400 flex gap-4">
          {elapsed && <span>Took {elapsed}</span>}
          {usage && (
            <span>
              {usage.input_tokens.toLocaleString()} in /{" "}
              {usage.output_tokens.toLocaleString()} out tokens
            </span>
          )}
        </div>
      )}
    </main>
  );
}
