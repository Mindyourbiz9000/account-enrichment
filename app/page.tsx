"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  done: { label: "DONE", className: "bg-mews-600 text-black" },
  warn: { label: "WARN", className: "bg-red-100 text-red-700" },
};

export default function Home() {
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"perplexity+r1" | null>(null);

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
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs, thinking]);

  // Whenever the user prints (⌘P, browser menu, or our button) force every
  // <details> open so no content is hidden. Restore prior state afterwards.
  useEffect(() => {
    let restoreFn: (() => void) | null = null;
    const onBeforePrint = () => {
      const els = Array.from(
        document.querySelectorAll<HTMLDetailsElement>("details"),
      );
      const prev = els.map((el) => el.open);
      els.forEach((el) => (el.open = true));
      restoreFn = () => els.forEach((el, i) => (el.open = prev[i]));
    };
    const onAfterPrint = () => {
      restoreFn?.();
      restoreFn = null;
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  // Tick a "waiting" timer while loading so the UI feels alive even when no
  // new log events are coming through yet.
  const [waitSeconds, setWaitSeconds] = useState(0);
  const lastActivityAt = useRef<number>(Date.now());
  useEffect(() => {
    if (!loading) {
      setWaitSeconds(0);
      return;
    }
    lastActivityAt.current = Date.now();
    const id = setInterval(() => {
      setWaitSeconds(
        Math.floor((Date.now() - lastActivityAt.current) / 1000),
      );
    }, 500);
    return () => clearInterval(id);
  }, [loading]);
  useEffect(() => {
    lastActivityAt.current = Date.now();
    setWaitSeconds(0);
  }, [logs.length, thinking]);

  // Abort any in-flight SSE request when the component unmounts.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleExportPdf = useCallback(() => {
    // Open every <details> in the dossier so the PDF captures every section
    // in full. Remember each element's original state and restore after the
    // print dialog closes.
    const detailsEls = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("details"),
    );
    const prevStates = detailsEls.map((el) => el.open);
    detailsEls.forEach((el) => {
      el.open = true;
    });

    const restore = () => {
      detailsEls.forEach((el, i) => {
        el.open = prevStates[i];
      });
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);

    // Give the browser a tick to lay out the newly-opened sections before
    // invoking the print dialog (some engines snapshot immediately).
    setTimeout(() => window.print(), 50);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProvider("perplexity+r1");
    setLoading(true);
    setLogs([]);
    setThinking("");
    setShowThinking(false);
    setDossier(null);
    setUsage(null);
    setElapsed(null);
    setError(null);
    setRawOutput(null);

    const endpoint = "/api/research-and-analyze";

    // Abort any previous in-flight request, then create a fresh controller.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelName, city, country }),
        signal: controller.signal,
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
      let parseErrors = 0;

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
            parseErrors = 0; // reset on any successful parse
          } catch {
            parseErrors++;
            if (parseErrors >= 3) {
              setError(
                "Stream error: received 3 consecutive malformed chunks — the response may be corrupted. Please try again.",
              );
              reader.cancel();
              return;
            }
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
      // Ignore AbortError — this is intentional cancellation (unmount / new submit).
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* ── Header ── */}
      <header className="mb-10 no-print flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-mews-600 flex items-center justify-center text-black font-bold text-lg">
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
        <Link
          href="/bulk"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition"
        >
          <svg
            className="h-4 w-4 text-mews-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h10"
            />
          </svg>
          Bulk qualify from CSV
        </Link>
      </header>

      {/* ── Top panel: form (left) + live log (right) ──
           Both panels are always rendered side-by-side. The log panel is
           absolutely positioned inside its grid cell on md+ so it does NOT
           contribute to the row's height — the row is sized purely by the
           form (3 inputs + button). The log then fills that height and
           scrolls internally as entries stream in, so the form panel stays
           exactly the same size from idle to done. */}
      <div className="no-print mb-8 grid md:grid-cols-2 gap-6 items-stretch">
        {/* Form */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 flex flex-col h-full">
          <form
            onSubmit={(e) => {
              if (loading) {
                e.preventDefault();
                return;
              }
              onSubmit(e);
            }}
            className="grid gap-4 flex-1"
          >
            <div>
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
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="mt-auto">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-mews-600 hover:bg-mews-700 disabled:bg-slate-400 text-black font-medium py-2.5 transition text-sm"
              >
                {loading ? "Researching…" : "Run Deep Search"}
              </button>
            </div>
          </form>
        </section>

        {/* Live log — always rendered so the layout doesn't shift when the
            user clicks "Run deep research". Shows an idle placeholder
            before any activity. The outer wrapper is the grid cell; the
            <section> is absolutely positioned on md+ so its intrinsic
            content height doesn't push the row taller — the row stays
            locked to the form's height and the log scrolls internally. */}
        <div className="relative min-h-[14rem] md:min-h-0">
          <section className="rounded-2xl bg-slate-900 text-slate-100 shadow-sm overflow-hidden flex flex-col md:absolute md:inset-0 h-full">
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

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 font-mono text-xs leading-relaxed">
              {!loading && logs.length === 0 && !thinking && (
                <div className="flex h-full items-center justify-center text-slate-500 italic">
                  Awaiting research — fill the form and click run.
                </div>
              )}
              {loading && logs.length === 0 && !thinking && (
                <div className="flex items-center gap-3 text-slate-300">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mews-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-mews-600" />
                  </span>
                  <span>
                    Connecting to Perplexity — first search can take 30–60s…
                  </span>
                </div>
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
              {loading && logs.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-slate-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mews-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-mews-600" />
                  </span>
                  <span>
                    Researching… {waitSeconds > 0 ? `(${waitSeconds}s idle)` : ""}
                  </span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 mb-6">
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

      {/* ── Dossier output ── */}
      {dossier && (
        <>
          {/* Export bar */}
          <div className="no-print flex items-center justify-between mb-4">
            <div className="text-sm text-slate-500">
              {elapsed && <span>Took {elapsed}</span>}
              {usage && elapsed && <span className="mx-2">·</span>}
              {usage && (
                <span>
                  {usage.input_tokens.toLocaleString()} in /{" "}
                  {usage.output_tokens.toLocaleString()} out tokens
                </span>
              )}
            </div>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition"
            >
              <svg
                className="h-4 w-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export PDF
            </button>
          </div>

          {/* Print-only header */}
          <div className="print-cover hidden print:block">
            <div className="eyebrow">Mews · Hotel Intelligence Dossier</div>
            <h1>{dossier.hotel?.name ?? hotelName}</h1>
            <div className="meta">
              {[dossier.hotel?.city, dossier.hotel?.country]
                .filter(Boolean)
                .join(", ")}
              {dossier.hotel?.segment ? ` · ${dossier.hotel.segment}` : ""}
              {dossier.hotel?.star_rating
                ? ` · ${dossier.hotel.star_rating}`
                : ""}
              {" · Generated "}
              {new Date().toLocaleDateString("en-GB", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          <HotelDossierView dossier={dossier} />
        </>
      )}
    </main>
  );
}
