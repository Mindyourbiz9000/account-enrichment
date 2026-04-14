"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Verdict =
  | "🟩 strong fit"
  | "🟨 limited fit"
  | "🟥 poor fit"
  | "needs more discovery";

type RowStatus = "pending" | "running" | "done" | "error";

type Row = {
  id: number;
  hotelName: string;
  city: string;
  country: string;
  status: RowStatus;
  verdict?: Verdict | string;
  segment?: string;
  rationale?: string;
  error?: string;
};

// Minimal RFC-4180-ish CSV parser: handles quoted fields (incl. escaped "")
// and commas/newlines inside quotes. Returns an array of rows (string[][]).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Auto-detect which column in the CSV header most likely maps to our
// three required fields. Uses a scored keyword match so common alternates
// ("BuildingName", "Property Name", "Country Code") still find a home.
// The user can always override the guess via the dropdowns in the UI.
type Mapping = { name: number; city: number; country: number };

const NAME_KEYWORDS = [
  "hotel name",
  "hotel",
  "property name",
  "property",
  "building name",
  "buildingname",
  "account name",
  "account",
  "company name",
  "company",
  "name",
];
const CITY_KEYWORDS = ["city", "town", "locality", "municipality"];
const COUNTRY_KEYWORDS = ["country", "country name", "nation"];

function scoreHeader(header: string, keywords: string[]): number {
  const h = header.trim().toLowerCase().replace(/[_\-]+/g, " ");
  let best = 0;
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    // Earlier keywords outrank later ones so "hotel name" beats "name".
    const priority = keywords.length - i;
    if (h === kw) return priority * 10;
    if (h.includes(kw)) best = Math.max(best, priority * 4);
  }
  return best;
}

function autoDetectMapping(headers: string[]): Mapping {
  const pick = (keywords: string[], exclude: Set<number>): number => {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < headers.length; i++) {
      if (exclude.has(i)) continue;
      const s = scoreHeader(headers[i], keywords);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    return bestIdx;
  };
  // City is the most distinctive — pick it first so "BuildingName" doesn't
  // accidentally steal the city slot via a generic "name" match.
  const excluded = new Set<number>();
  const city = pick(CITY_KEYWORDS, excluded);
  if (city !== -1) excluded.add(city);
  const country = pick(COUNTRY_KEYWORDS, excluded);
  if (country !== -1) excluded.add(country);
  const name = pick(NAME_KEYWORDS, excluded);
  return { name, city, country };
}

const VERDICT_STYLE: Record<
  string,
  { dot: string; pill: string; rowBg: string }
> = {
  "🟩 strong fit": {
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rowBg: "bg-emerald-50/40",
  },
  "🟨 limited fit": {
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800 border-amber-200",
    rowBg: "bg-amber-50/40",
  },
  "🟥 poor fit": {
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-800 border-red-200",
    rowBg: "bg-red-50/40",
  },
  "needs more discovery": {
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-700 border-slate-200",
    rowBg: "bg-slate-50",
  },
};

// Run up to N qualification requests in parallel. Each row is POSTed to
// /api/qualify and updated on the provided setRows callback as it finishes.
async function runWithConcurrency(
  rows: Row[],
  concurrency: number,
  update: (id: number, patch: Partial<Row>) => void,
  signal: AbortSignal,
) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (!signal.aborted) {
      const idx = cursor++;
      if (idx >= rows.length) break;
      const row = rows[idx];
      update(row.id, { status: "running" });
      try {
        const res = await fetch("/api/qualify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hotelName: row.hotelName,
            city: row.city,
            country: row.country,
          }),
          signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          update(row.id, {
            status: "error",
            error: body.error ?? `HTTP ${res.status}`,
          });
          continue;
        }
        const data = await res.json();
        update(row.id, {
          status: "done",
          verdict: data.qualification?.verdict,
          segment: data.qualification?.segment,
          rationale: data.qualification?.rationale,
        });
      } catch (err) {
        if (signal.aborted) return;
        update(row.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  });
  await Promise.all(workers);
}

export default function BulkPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // Raw CSV state so the user can re-pick columns after upload.
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRowsRaw, setDataRowsRaw] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({
    name: -1,
    city: -1,
    country: -1,
  });
  const abortRef = useRef<AbortController | null>(null);

  const updateRow = useCallback((id: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // Rebuild the row list from the raw CSV whenever the mapping changes.
  // This resets any in-flight results — the hotel/city/country values have
  // effectively changed, so stale verdicts would be misleading.
  const applyMapping = useCallback(
    (next: Mapping, raw: string[][]) => {
      const built: Row[] = [];
      for (let i = 0; i < raw.length; i++) {
        const cols = raw[i];
        const hotelName =
          next.name >= 0 ? (cols[next.name] ?? "").trim() : "";
        const city = next.city >= 0 ? (cols[next.city] ?? "").trim() : "";
        const country =
          next.country >= 0 ? (cols[next.country] ?? "").trim() : "";
        if (!hotelName || !city || !country) continue;
        built.push({
          id: i + 1,
          hotelName,
          city,
          country,
          status: "pending",
        });
      }
      setRows(built);
    },
    [],
  );

  const onFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setRows([]);
      setHeaders([]);
      setDataRowsRaw([]);
      setMapping({ name: -1, city: -1, country: -1 });
      setFileName(file.name);
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setParseError("CSV must have a header row and at least one data row.");
        return;
      }
      const hdr = parsed[0].map((h) => h.trim());
      const raw = parsed.slice(1);
      setHeaders(hdr);
      setDataRowsRaw(raw);
      const guess = autoDetectMapping(hdr);
      setMapping(guess);
      applyMapping(guess, raw);
    },
    [applyMapping],
  );

  const onChangeMapping = useCallback(
    (field: keyof Mapping, value: number) => {
      setMapping((prev) => {
        const next = { ...prev, [field]: value };
        applyMapping(next, dataRowsRaw);
        return next;
      });
    },
    [applyMapping, dataRowsRaw],
  );

  const mappingComplete =
    mapping.name >= 0 && mapping.city >= 0 && mapping.country >= 0;

  const onRun = useCallback(async () => {
    if (rows.length === 0 || running || !mappingComplete) return;
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Reset any previous runs
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        status: "pending",
        verdict: undefined,
        segment: undefined,
        rationale: undefined,
        error: undefined,
      })),
    );
    try {
      // Re-read the current row list after reset via functional update.
      const snapshot = rows.map((r) => ({ ...r, status: "pending" as const }));
      await runWithConcurrency(snapshot, 3, updateRow, ctrl.signal);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [rows, running, mappingComplete, updateRow]);

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onDownloadResults = useCallback(() => {
    const header = ["Hotel", "City", "Country", "Verdict", "Segment", "Rationale"];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.hotelName,
          r.city,
          r.country,
          r.verdict ?? (r.error ? `ERROR: ${r.error}` : ""),
          r.segment ?? "",
          r.rationale ?? "",
        ]
          .map((v) => esc(String(v)))
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mews-bulk-qualification-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const summary = useMemo(() => {
    const s = { green: 0, amber: 0, red: 0, unknown: 0, error: 0, pending: 0 };
    for (const r of rows) {
      if (r.status === "error") s.error++;
      else if (r.status !== "done") s.pending++;
      else if (r.verdict === "🟩 strong fit") s.green++;
      else if (r.verdict === "🟨 limited fit") s.amber++;
      else if (r.verdict === "🟥 poor fit") s.red++;
      else s.unknown++;
    }
    return s;
  }, [rows]);

  const doneCount = rows.filter((r) => r.status === "done" || r.status === "error")
    .length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-mews-600 flex items-center justify-center text-black font-bold text-lg">
            M
          </div>
          <div>
            <h1 className="text-2xl font-bold text-mews-900">
              Bulk qualification
            </h1>
            <p className="text-sm text-slate-600">
              Upload a CSV of hotels and rate each one green / amber / red
              against Mews ICP.
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="text-sm text-mews-700 underline decoration-dotted hover:text-mews-900"
        >
          ← Back to single research
        </Link>
      </header>

      {/* Upload panel */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-mews-600 hover:bg-mews-700 text-black font-medium px-4 py-2 text-sm transition">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0-12l-4 4m4-4l4 4"
              />
            </svg>
            {fileName ? "Replace CSV" : "Upload CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {fileName && (
            <span className="text-sm text-slate-600">
              <span className="font-medium">{fileName}</span>
              {rows.length > 0 && (
                <span className="text-slate-500">
                  {" "}
                  · {rows.length} hotel{rows.length === 1 ? "" : "s"}
                </span>
              )}
            </span>
          )}
          <div className="flex-1" />
          {rows.length > 0 && !running && (
            <button
              onClick={onRun}
              disabled={!mappingComplete}
              className="rounded-lg bg-mews-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium px-4 py-2 text-sm transition"
            >
              {doneCount > 0 ? "Re-run qualification" : "Run qualification"}
            </button>
          )}
          {running && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-700 font-medium px-4 py-2 text-sm transition"
            >
              Cancel
            </button>
          )}
          {doneCount > 0 && !running && (
            <button
              onClick={onDownloadResults}
              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 text-sm transition"
            >
              Download results CSV
            </button>
          )}
        </div>

        {parseError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {parseError}
          </div>
        )}

        {/* Column mapping — shown as soon as a CSV is parsed. We pre-fill
            best-guess values but any column can be reassigned. */}
        {headers.length > 0 && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Column mapping
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {mappingComplete
                    ? `Mapped — ${rows.length} valid row${rows.length === 1 ? "" : "s"} ready to qualify.`
                    : "Pick which CSV column holds the hotel name, city, and country."}
                </div>
              </div>
              {mappingComplete && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  mapping complete
                </span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {(
                [
                  {
                    key: "name" as const,
                    label: "Hotel name",
                    hint: "e.g. BuildingName, Property, Hotel",
                  },
                  {
                    key: "city" as const,
                    label: "City",
                    hint: "e.g. City, Town, Locality",
                  },
                  {
                    key: "country" as const,
                    label: "Country",
                    hint: "e.g. Country, Country Name",
                  },
                ]
              ).map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {f.label}
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <select
                    value={mapping[f.key]}
                    onChange={(e) =>
                      onChangeMapping(f.key, Number(e.target.value))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mews-500 ${
                      mapping[f.key] === -1
                        ? "border-red-300 bg-red-50/40 text-slate-700"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    <option value={-1}>— Select a column —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(unnamed column ${i + 1})`}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {f.hint}
                  </div>
                </div>
              ))}
            </div>

            {/* Preview — show the first 3 data rows with the mapping
                applied so the user can sanity-check before running. */}
            {mappingComplete && rows.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 font-semibold border-b border-slate-200">
                  Preview (first {Math.min(3, rows.length)} of {rows.length})
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-white text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Hotel</th>
                      <th className="px-3 py-1.5 font-medium">City</th>
                      <th className="px-3 py-1.5 font-medium">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-800">
                          {r.hotelName}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {r.city}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {r.country}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {mappingComplete &&
              rows.length === 0 &&
              dataRowsRaw.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Mapping is set but no rows have values in all three columns.
                  Double-check the picked columns or the CSV contents.
                </div>
              )}
          </div>
        )}

        {headers.length === 0 && (
          <div className="mt-4 text-xs text-slate-500">
            Upload any CSV with a header row. After upload you can map any
            column to <em>hotel name</em>, <em>city</em>, and{" "}
            <em>country</em> — headers like{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              BuildingName
            </code>{" "}
            or{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">Property</code>{" "}
            are auto-detected.
          </div>
        )}
      </section>

      {/* Progress + summary */}
      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="text-slate-600">
            <span className="font-semibold text-slate-900">{doneCount}</span>
            <span className="text-slate-500"> / {rows.length} processed</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {summary.green} green
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {summary.amber} amber
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {summary.red} red
            </span>
            {summary.unknown > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {summary.unknown} needs discovery
              </span>
            )}
            {summary.error > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700">
                {summary.error} error{summary.error === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {running && (
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mews-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-mews-600" />
              </span>
              Running — up to 3 in parallel
            </span>
          )}
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Hotel</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Verdict</th>
                  <th className="px-4 py-3 font-medium">Segment</th>
                  <th className="px-4 py-3 font-medium">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const style =
                    r.verdict && VERDICT_STYLE[r.verdict as string]
                      ? VERDICT_STYLE[r.verdict as string]
                      : null;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 align-top ${
                        style?.rowBg ?? ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.hotelName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.city}</td>
                      <td className="px-4 py-3 text-slate-700">{r.country}</td>
                      <td className="px-4 py-3">
                        {r.status === "pending" && (
                          <span className="text-slate-400 italic">queued</span>
                        )}
                        {r.status === "running" && (
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mews-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-mews-600" />
                            </span>
                            researching…
                          </span>
                        )}
                        {r.status === "done" && r.verdict && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              style?.pill ??
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                style?.dot ?? "bg-slate-400"
                              }`}
                            />
                            {r.verdict}
                          </span>
                        )}
                        {r.status === "error" && (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-2 py-0.5 text-xs font-semibold text-red-700"
                            title={r.error}
                          >
                            error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.segment ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.status === "error" ? (
                          <span className="text-red-700 text-xs">
                            {r.error}
                          </span>
                        ) : (
                          r.rationale ?? (
                            <span className="text-slate-400">—</span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rows.length === 0 && !parseError && (
        <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center">
          <div className="text-slate-500">
            Upload a CSV to get started. Each row is qualified against Mews ICP
            and tagged 🟩 / 🟨 / 🟥.
          </div>
        </section>
      )}
    </main>
  );
}
