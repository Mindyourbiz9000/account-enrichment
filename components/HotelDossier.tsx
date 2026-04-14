import React, { useState } from "react";

/** Phone number with a clickable "tel:" link and a copy-to-clipboard
 *  button. Shows a brief "Copied!" confirmation on success. Hidden in
 *  print (the PDF doesn't need an interactive copy button). */
function CopyablePhone({
  phone,
  className = "",
  linkClassName = "text-mews-700 underline decoration-dotted",
}: {
  phone: string;
  className?: string;
  linkClassName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can fail on insecure contexts — silently ignore
    }
  };
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <a href={`tel:${phone.replace(/\s+/g, "")}`} className={linkClassName}>
        {phone}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy phone number"}
        title={copied ? "Copied!" : "Copy"}
        className="no-print inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-mews-700 hover:bg-slate-100 transition"
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-emerald-600"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
}

/** A verbatim guest quote with optional attribution. */
export type GuestQuote = {
  text: string;
  source?: string;
  source_url?: string;
  date?: string;
};

/** A theme/complaint that the model only surfaces when ≥2 quotes back it. */
export type QuotedTheme = {
  text: string;
  quotes?: GuestQuote[];
};

/** Render an expandable list of verbatim guest quotes that back a theme or
 *  challenge. The salesperson sees the summary first, then can drill into
 *  the actual reviews to confirm it's a recurring pattern. */
function SupportingQuotes({
  quotes,
  label = "Supporting reviews",
  accent = "text-slate-500",
}: {
  quotes?: GuestQuote[];
  label?: string;
  accent?: string;
}) {
  const valid = (quotes ?? []).filter((q) => q && q.text);
  if (valid.length === 0) return null;
  return (
    <details className="mt-1.5 group/quotes">
      <summary
        className={`cursor-pointer select-none text-[11px] uppercase tracking-wide ${accent} hover:text-slate-700 list-none [&::-webkit-details-marker]:hidden`}
      >
        <span className="inline-flex items-center gap-1">
          <svg
            className="h-3 w-3 transition-transform group-open/quotes:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {label} ({valid.length})
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {valid.map((q, i) => (
          <li
            key={i}
            className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-700 leading-snug"
          >
            <span className="text-slate-400">“</span>
            <span className="italic">{q.text}</span>
            <span className="text-slate-400">”</span>
            {(q.source || q.source_url || q.date) && (
              <span className="block mt-0.5 text-[10.5px] text-slate-500">
                —{" "}
                {q.source_url ? (
                  <a
                    href={q.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted underline-offset-2 hover:text-mews-700"
                  >
                    {q.source ?? "source"}
                  </a>
                ) : (
                  q.source
                )}
                {q.date && (
                  <span className="text-slate-400">
                    {q.source || q.source_url ? ", " : ""}
                    {q.date}
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export type HotelDossier = {
  hotel?: {
    name?: string;
    city?: string;
    country?: string;
    website?: string;
    brand_or_group?: string;
    segment?: string;
    star_rating?: string;
    address?: string;
    phone?: string;
    hero_image_url?: string;
    tldr?: string;
  };
  property_profile?: {
    number_of_rooms?: string;
    room_types?: string[];
    price_range?: string;
    estimated_adr?: string;
    occupancy_notes?: string;
    year_opened_or_renovated?: string;
  };
  services?: {
    restaurants?: string[];
    bars?: string[];
    spa_and_wellness?: string[];
    events_and_mice?: {
      meeting_rooms?: string;
      largest_capacity?: string;
      ballroom?: string;
      notable_event_offerings?: string[];
    };
    other_amenities?: string[];
  };
  reputation?: {
    google_rating?: string;
    tripadvisor_rating?: string;
    booking_rating?: string;
    review_volume?: string;
    positive_themes?: Array<QuotedTheme | string>;
    negative_themes?: Array<QuotedTheme | string>;
    recent_press?: Array<{ text: string; source_url?: string } | string>;
  };
  key_challenges?: Array<{
    challenge: string;
    /** @deprecated kept for legacy dossiers; new ones use `quotes` */
    evidence?: string;
    /** @deprecated kept for legacy dossiers; new ones use `quotes` */
    evidence_url?: string;
    mews_angle?: string;
    payment_related?: boolean;
    quotes?: GuestQuote[];
    evidence_type?:
      | "guest_reviews"
      | "segment_profile"
      | "tech_stack"
      | "services_gap"
      | "press_or_ownership";
    evidence_basis?: string;
  }>;
  contacts?: Array<{
    name?: string;
    role: string;
    email?: string;
    email_confidence?: "verified" | "guessed";
    phone?: string;
    linkedin?: string;
    linkedin_confidence?: "verified" | "guessed";
    source?: string;
  }>;
  tech_stack_signals?: Array<{
    system: string;
    category?: string;
    evidence?: string;
  }>;
  mews_positioning?: {
    opening_hook?: string;
    top_three_value_props?: string[];
    discovery_questions?: string[];
    recommended_next_step?: string;
  };
  mews_qualification?: {
    segment?: string;
    verdict?:
      | "🟩 strong fit"
      | "🟨 limited fit"
      | "🟥 poor fit"
      | "needs more discovery"
      | string;
    verdict_rationale?: string;
    fit_signals?: Array<{ signal: string; evidence?: string }>;
    red_flags?: Array<{
      flag: string;
      evidence?: string;
      severity?: "blocker" | "watch" | string;
    }>;
    fastest_dq_check?: string;
  };
  sources?: string[];
};

function Section({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group avoid-break rounded-2xl bg-white border border-slate-200 shadow-sm mb-5 overflow-hidden"
    >
      <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-slate-50 transition-colors">
        <div>
          <h2 className="text-lg font-semibold text-mews-900">{title}</h2>
          {subtitle && (
            <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        <svg
          className="h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-6 pb-6 pt-1">{children}</div>
    </details>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-4 py-1.5 text-sm border-b border-slate-100 last:border-0">
      <div className="text-slate-500">{label}</div>
      <div className="col-span-2 text-slate-800">{value}</div>
    </div>
  );
}

function List({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="list-disc list-inside space-y-1 text-sm text-slate-800">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Normalise a positive/negative-theme entry from the legacy string shape
 *  or the new {text, quotes[]} shape. */
function normalizeTheme(
  item: QuotedTheme | string | undefined | null,
): QuotedTheme | null {
  if (!item) return null;
  if (typeof item === "string") return { text: item };
  if (!item.text) return null;
  return item;
}

/** Render a recent-press entry. We keep the inline link here because the
 *  source URL IS the article — no quotes to fold under. */
function PressList({
  items,
}: {
  items?: Array<{ text: string; source_url?: string } | string>;
}) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="list-disc list-inside space-y-1 text-sm text-slate-800">
      {items.map((raw, i) => {
        const item =
          typeof raw === "string" ? { text: raw } : raw && raw.text ? raw : null;
        if (!item) return null;
        return (
          <li key={i}>
            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted decoration-slate-400 underline-offset-2 hover:text-mews-700"
              >
                {item.text}
              </a>
            ) : (
              item.text
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Human-readable labels for non-review challenge evidence types. The dossier
// emits an enum (`segment_profile`, `tech_stack`, `services_gap`,
// `press_or_ownership`, `guest_reviews`); the UI renders a short title next
// to the evidence_basis text so the salesperson sees at a glance why the
// challenge is listed.
const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  guest_reviews: "From guest reviews",
  segment_profile: "Segment-driven",
  tech_stack: "Tech-stack signal",
  services_gap: "Services gap",
  press_or_ownership: "Press / ownership",
};

// Keyword fallback — Claude should set payment_related=true itself, but if it
// forgets we still catch the obvious cases so payments always get highlighted.
const PAYMENT_KEYWORDS =
  /\b(payment|payments|billing|invoice|invoicing|charged?|chargeback|refund|deposit|prepayment|pre-?auth|card(\s|-)?on(\s|-)?file|credit\s?card|pci|folio|reconcil|pos\b|tip(ping)?|currency|fx|foreign\s?exchange|paid\s?twice|declined)\b/i;

function mentionsPayments(text?: string): boolean {
  return !!text && PAYMENT_KEYWORDS.test(text);
}

function MewsPaymentsBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mews-600 text-black text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
        />
      </svg>
      Mews Payments fit
    </span>
  );
}

// Pull the first rating-shaped token out of the text so we can show a big
// score + a small qualifier instead of one long line.
function extractScore(text?: string): { score: string | null; rest: string } {
  if (!text) return { score: null, rest: "" };
  const rx =
    /(\d+(?:\.\d+)?\s*(?:\+|)\s*(?:\/|out of)\s*(?:5|10)|\b\d(?:\.\d)?\/5\b|Travelers'?\s*Choice)/i;
  const m = text.match(rx);
  if (!m) return { score: null, rest: text.trim() };
  const score = m[0].trim();
  const idx = m.index ?? 0;
  const rest = (text.slice(0, idx) + text.slice(idx + m[0].length))
    .replace(/^\s*[,;:\-–—()]+\s*|\s*[,;:\-–—()]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { score, rest };
}

function ReviewCard({
  source,
  text,
  accent,
}: {
  source: string;
  text?: string;
  accent: string; // tailwind text colour class
}) {
  const { score, rest } = extractScore(text);
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 min-h-[110px] avoid-break">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
        {source}
      </div>
      {score ? (
        <>
          <div className={`text-xl font-bold leading-tight ${accent}`}>
            {score}
          </div>
          {rest && (
            <div className="text-xs text-slate-600 mt-1 leading-snug line-clamp-4">
              {rest}
            </div>
          )}
        </>
      ) : (
        <div className={`text-sm font-medium leading-snug ${accent}`}>
          {text || "Not publicly disclosed"}
        </div>
      )}
    </div>
  );
}

// Compact square tile used in the hero strip. Long verbose values like
// "4.0 out of 5 (11 traveler reviews; ranked #1 of 3 specialty lodging)"
// get split into a big score + a one-line subtitle so the tile stays
// small and uniform across all sources.
function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string;
  accent?: string;
}) {
  if (!value) return null;
  const { score, rest } = extractScore(value);
  // Headline = the score if we found one, otherwise a trimmed first clause
  // of the value. Subtitle = whatever's left, capped to one line.
  const headline = score ?? value.split(/[—–\-(;]/)[0].trim();
  const subtitle = score
    ? rest
    : value.length > headline.length
      ? value.slice(headline.length).replace(/^[\s—–\-(;:,]+/, "").trim()
      : "";
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2 min-h-[64px]">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span
        className={`text-sm font-semibold leading-tight truncate ${accent ?? "text-slate-900"}`}
        title={value}
      >
        {headline}
      </span>
      {subtitle && (
        <span
          className="text-[10px] text-slate-500 leading-tight truncate"
          title={subtitle}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function HeroCard({ dossier }: { dossier: HotelDossier }) {
  const h = dossier.hotel ?? {};
  const p = dossier.property_profile ?? {};
  const r = dossier.reputation ?? {};
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = h.hero_image_url && !imgFailed;

  const subtitle = [h.city, h.country].filter(Boolean).join(", ");
  const metaLine = [h.star_rating, h.segment, h.brand_or_group]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="hero-card avoid-break rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-6 bg-white">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Image / gradient */}
        <div className="gradient-fallback relative h-56 md:h-auto md:min-h-[240px] bg-gradient-to-br from-mews-100 via-mews-500 to-mews-700">
          {showImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={h.hero_image_url}
              alt={h.name ?? "Hotel"}
              onError={() => setImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {!showImg && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-6xl font-bold tracking-tight">
              {(h.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="hero-content p-6 md:p-7 flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-mews-900 leading-tight">
              {h.name ?? "Unknown hotel"}
            </h1>
            {subtitle && (
              <div className="text-sm text-slate-600 mt-1">{subtitle}</div>
            )}
            {metaLine && (
              <div className="text-xs text-slate-500 mt-1">{metaLine}</div>
            )}
          </div>

          {h.tldr && (
            <p className="tldr text-sm text-slate-700 leading-relaxed border-l-2 border-mews-600 pl-3">
              {h.tldr}
            </p>
          )}

          {/* Compact stat grid — 3 small square-ish tiles per row so the
              hero strip stays short. Long values truncate inside each tile. */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <StatPill
              label="Google"
              value={r.google_rating}
              accent="text-emerald-700"
            />
            <StatPill
              label="TripAdvisor"
              value={r.tripadvisor_rating}
              accent="text-emerald-700"
            />
            <StatPill
              label="Booking.com"
              value={r.booking_rating}
              accent="text-blue-700"
            />
            <StatPill
              label="Reviews"
              value={r.review_volume}
              accent="text-slate-700"
            />
            <StatPill
              label="ADR"
              value={p.estimated_adr}
              accent="text-mews-700"
            />
            <StatPill
              label="Rooms"
              value={p.number_of_rooms}
              accent="text-slate-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            {h.website && (
              <a
                href={h.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-mews-700 underline decoration-dotted break-all"
              >
                {h.website}
              </a>
            )}
            {h.phone && (
              <CopyablePhone
                phone={h.phone}
                className="text-xs"
                linkClassName="text-mews-700 underline decoration-dotted"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mews segment qualification — the primary deliverable of every dossier.
 *  Renders verdict + rationale, fit signals (green) + red flags (red blockers
 *  / amber watch-items), and the single fastest disqualifying question to
 *  ask on the call. */
function QualificationSection({
  q,
}: {
  q: NonNullable<HotelDossier["mews_qualification"]>;
}) {
  return (
    <Section
      title="Mews qualification"
      subtitle={
        q.segment ? `Playbook segment: ${q.segment}` : "Segment fit & red flags"
      }
      defaultOpen
    >
      {q.verdict && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-base font-semibold text-slate-900">
            {q.verdict}
          </div>
          {q.verdict_rationale && (
            <div className="flex-1 text-sm text-slate-700 leading-snug">
              {q.verdict_rationale}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {q.fit_signals?.length ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-emerald-700 mb-2 font-semibold">
              Fit signals
            </div>
            <ul className="space-y-2">
              {q.fit_signals.map((s, i) => (
                <li
                  key={i}
                  className="rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm"
                >
                  <div className="flex items-start gap-2 text-emerald-900">
                    <span className="text-emerald-600 mt-0.5">✓</span>
                    <span className="flex-1 font-medium">{s.signal}</span>
                  </div>
                  {s.evidence && (
                    <div className="mt-1 ml-5 text-[12.5px] text-slate-600">
                      {s.evidence}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-sm text-slate-400 italic">
            No clear fit signals surfaced.
          </div>
        )}

        {q.red_flags?.length ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-red-700 mb-2 font-semibold">
              Red flags
            </div>
            <ul className="space-y-2">
              {q.red_flags.map((r, i) => {
                const isBlocker = r.severity === "blocker";
                return (
                  <li
                    key={i}
                    className={
                      isBlocker
                        ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm"
                        : "rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm"
                    }
                  >
                    <div
                      className={
                        isBlocker
                          ? "flex items-start gap-2 text-red-900"
                          : "flex items-start gap-2 text-amber-900"
                      }
                    >
                      <span
                        className={
                          isBlocker
                            ? "text-red-600 mt-0.5"
                            : "text-amber-600 mt-0.5"
                        }
                      >
                        {isBlocker ? "✕" : "!"}
                      </span>
                      <span className="flex-1 font-medium">{r.flag}</span>
                      {r.severity && (
                        <span
                          className={
                            isBlocker
                              ? "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-200 text-red-800"
                              : "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-200 text-amber-800"
                          }
                        >
                          {r.severity}
                        </span>
                      )}
                    </div>
                    {r.evidence && (
                      <div className="mt-1 ml-5 text-[12.5px] text-slate-600">
                        {r.evidence}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="text-sm text-slate-400 italic">
            No red flags surfaced.
          </div>
        )}
      </div>

      {q.fastest_dq_check && (
        <div className="mt-5 rounded-lg border border-mews-100 bg-mews-50 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-mews-700 font-semibold mb-1">
            Fastest DQ question to ask
          </div>
          <div className="text-sm text-mews-900 leading-relaxed">
            “{q.fastest_dq_check}”
          </div>
        </div>
      )}
    </Section>
  );
}

/** Amber "AI-generated, validate before quoting" notice. Sits directly
 *  under the hero card so it's the first thing a salesperson reads
 *  before the qualification + positioning content below. Hidden in
 *  print — the salesperson reading the PDF already knows. */
function AiDisclaimerBanner() {
  return (
    <div
      role="note"
      aria-label="AI-generated content disclaimer"
      className="no-print mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
    >
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="min-w-0 text-sm leading-relaxed">
        <div className="font-semibold text-amber-900">
          AI-generated — validate with the prospect before quoting
        </div>
        <div className="mt-0.5 text-amber-800">
          This dossier is generated via AI search and is meant to{" "}
          <span className="font-medium">help and guide</span> your
          conversation — not to be the source of truth. Always confirm key
          facts directly with the prospect.
        </div>
      </div>
    </div>
  );
}

export function HotelDossierView({ dossier }: { dossier: HotelDossier }) {
  const h = dossier.hotel ?? {};
  const p = dossier.property_profile ?? {};
  const s = dossier.services ?? {};
  const r = dossier.reputation ?? {};

  return (
    <div>
      <HeroCard dossier={dossier} />
      <AiDisclaimerBanner />
      {/* ── Mews positioning — what to lead with on the call ── */}
      {dossier.mews_positioning && (
        <Section
          title="Mews positioning"
          subtitle="What to lead with on the first call"
          defaultOpen
        >
          {dossier.mews_positioning.opening_hook && (
            <div className="rounded-xl bg-mews-50 border border-mews-100 p-4 mb-5">
              <div className="text-[10px] uppercase tracking-wide text-mews-700 font-semibold mb-1">
                Opening hook
              </div>
              <div className="text-base text-mews-900 leading-relaxed font-medium">
                “{dossier.mews_positioning.opening_hook}”
              </div>
            </div>
          )}
          {dossier.mews_positioning.top_three_value_props?.length ? (
            <div className="mb-5">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                Top value props
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {dossier.mews_positioning.top_three_value_props.map(
                  (vp, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800"
                    >
                      <div className="h-6 w-6 rounded-full bg-mews-600 text-black text-xs font-bold flex items-center justify-center mb-2">
                        {i + 1}
                      </div>
                      {vp}
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : null}
          {dossier.mews_positioning.discovery_questions?.length ? (
            <div className="mb-5">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                Discovery questions
              </div>
              <ul className="space-y-2 text-sm text-slate-800">
                {dossier.mews_positioning.discovery_questions.map((q, i) => (
                  <li
                    key={i}
                    className="flex gap-3 border-l-2 border-slate-200 pl-3"
                  >
                    <span className="text-mews-700 font-semibold shrink-0">
                      Q{i + 1}.
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {dossier.mews_positioning.recommended_next_step && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
                Recommended next step
              </div>
              <div className="text-sm text-emerald-900 leading-relaxed">
                {dossier.mews_positioning.recommended_next_step}
              </div>
            </div>
          )}
        </Section>
      )}
      {/* ── Mews qualification — playbook fit + red flags ── */}
      {dossier.mews_qualification &&
        (dossier.mews_qualification.segment ||
          dossier.mews_qualification.verdict ||
          dossier.mews_qualification.fit_signals?.length ||
          dossier.mews_qualification.red_flags?.length) && (
          <QualificationSection q={dossier.mews_qualification} />
        )}

      {/* ── Key challenges ── */}
      {dossier.key_challenges?.length ? (
        <Section
          title="Key challenges"
          subtitle={`${dossier.key_challenges.length} pain points to probe`}
          defaultOpen
        >
          <div className="space-y-3">
            {dossier.key_challenges.map((c, i) => {
              const isPayment =
                c.payment_related === true ||
                mentionsPayments(c.challenge) ||
                mentionsPayments(c.evidence) ||
                mentionsPayments(c.evidence_basis) ||
                mentionsPayments(c.mews_angle) ||
                (c.quotes ?? []).some((q) => mentionsPayments(q.text));
              const headerClass = isPayment
                ? "bg-mews-50 border-b border-mews-100 text-mews-900"
                : "bg-amber-50 border-b border-amber-100 text-amber-900";
              const bulletClass = isPayment
                ? "text-mews-700"
                : "text-amber-600";
              const cardBorder = isPayment
                ? "border-mews-300 ring-1 ring-mews-100"
                : "border-slate-200";
              return (
                <div
                  key={i}
                  className={`rounded-lg border overflow-hidden ${cardBorder}`}
                >
                  <div
                    className={`px-4 py-2.5 font-semibold text-sm flex items-start gap-2 ${headerClass}`}
                  >
                    <span className={`shrink-0 ${bulletClass}`}>#{i + 1}</span>
                    <span className="flex-1">{c.challenge}</span>
                    {isPayment && <MewsPaymentsBadge />}
                  </div>
                  <div className="p-4 space-y-2 bg-white">
                    {/* Legacy dossiers (pre-quotes schema) carried a free-form
                        "evidence" string; render it if present so old dossiers
                        still display something. New dossiers populate `quotes`
                        or `evidence_basis` and skip this. */}
                    {!c.quotes?.length &&
                      !c.evidence_basis &&
                      c.evidence && (
                        <div className="text-sm text-slate-700">
                          <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wide block mb-0.5">
                            Evidence
                          </span>
                          {c.evidence}
                        </div>
                      )}
                    {c.quotes && c.quotes.length > 0 && (
                      <div>
                        <SupportingQuotes
                          quotes={c.quotes}
                          accent={
                            isPayment ? "text-mews-700" : "text-amber-700"
                          }
                        />
                      </div>
                    )}
                    {/* Non-review-backed challenges (segment/tech/services/press)
                        surface their reasoning via evidence_basis + a type
                        label so the salesperson can see WHY this is a real
                        challenge even without a guest quote. */}
                    {c.evidence_basis && (
                      <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-2">
                        <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wide block mb-0.5">
                          {c.evidence_type
                            ? EVIDENCE_TYPE_LABEL[c.evidence_type] ?? "Basis"
                            : "Basis"}
                        </span>
                        {c.evidence_basis}
                      </div>
                    )}
                    {c.mews_angle && (
                      <div
                        className={`text-sm rounded p-2 ${
                          isPayment
                            ? "text-mews-900 bg-mews-50 border border-mews-100"
                            : "text-mews-900 bg-mews-50"
                        }`}
                      >
                        <span className="font-semibold text-mews-700 text-[10px] uppercase tracking-wide block mb-0.5">
                          {isPayment ? "Mews Payments angle" : "Mews angle"}
                        </span>
                        {c.mews_angle}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* ── Contacts ── */}
      {dossier.contacts?.length ? (
        <Section title="Contacts">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">LinkedIn</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {dossier.contacts.map((c, i) => {
                  const emailGuessed = c.email_confidence === "guessed";
                  const linkedinGuessed = c.linkedin_confidence === "guessed";
                  return (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-4">{c.name ?? "Unknown"}</td>
                      <td className="py-2 pr-4">{c.role}</td>
                      <td className="py-2 pr-4">
                        {c.email ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {emailGuessed && (
                              <span className="inline-block rounded bg-amber-100 text-amber-800 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
                                guessed
                              </span>
                            )}
                            <a
                              href={`mailto:${c.email}`}
                              className={
                                emailGuessed
                                  ? "text-amber-800 underline decoration-dotted"
                                  : "text-mews-600 underline"
                              }
                            >
                              {c.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">unknown</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {c.linkedin ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {linkedinGuessed && (
                              <span className="inline-block rounded bg-amber-100 text-amber-800 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
                                guessed
                              </span>
                            )}
                            <a
                              href={c.linkedin}
                              target="_blank"
                              rel="noreferrer"
                              className={
                                linkedinGuessed
                                  ? "text-amber-800 underline decoration-dotted"
                                  : "text-mews-600 underline"
                              }
                            >
                              profile
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">unknown</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">
                        {c.source ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {/* ── Hotel overview ── */}
      <Section title="Hotel">
        <Row label="Name" value={h.name} />
        <Row
          label="Location"
          value={[h.city, h.country].filter(Boolean).join(", ")}
        />
        <Row label="Address" value={h.address} />
        <Row
          label="Phone"
          value={
            h.phone ? (
              <CopyablePhone phone={h.phone} linkClassName="text-mews-600 underline" />
            ) : undefined
          }
        />
        <Row
          label="Website"
          value={
            h.website ? (
              <a
                href={h.website}
                target="_blank"
                rel="noreferrer"
                className="text-mews-600 underline"
              >
                {h.website}
              </a>
            ) : undefined
          }
        />
        <Row label="Brand / group" value={h.brand_or_group} />
        <Row label="Segment" value={h.segment} />
        <Row label="Star rating" value={h.star_rating} />
      </Section>

      {/* ── Property profile ── */}
      <Section title="Property profile">
        <Row label="Rooms" value={p.number_of_rooms} />
        <Row label="Room types" value={p.room_types?.join(", ")} />
        <Row label="Price range" value={p.price_range} />
        <Row label="Estimated ADR" value={p.estimated_adr} />
        <Row label="Occupancy" value={p.occupancy_notes} />
        <Row label="Opened / renovated" value={p.year_opened_or_renovated} />
      </Section>

      {/* ── Reputation ── */}
      <Section title="Reputation">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <ReviewCard
            source="Google"
            text={r.google_rating}
            accent="text-emerald-700"
          />
          <ReviewCard
            source="TripAdvisor"
            text={r.tripadvisor_rating}
            accent="text-emerald-700"
          />
          <ReviewCard
            source="Booking.com"
            text={r.booking_rating}
            accent="text-blue-700"
          />
        </div>
        {r.review_volume && (
          <div className="text-xs text-slate-500 mb-2">
            <span className="font-semibold text-slate-400 uppercase tracking-wide">
              Volume:
            </span>{" "}
            {r.review_volume}
          </div>
        )}
        {r.positive_themes?.length ? (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-emerald-600 mb-1">
              Recurring praise
            </div>
            <ul className="space-y-2 text-sm">
              {r.positive_themes.map((raw, i) => {
                const item = normalizeTheme(raw);
                if (!item) return null;
                return (
                  <li
                    key={i}
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2"
                  >
                    <div className="flex items-start gap-2 text-slate-800">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span className="flex-1">{item.text}</span>
                    </div>
                    <SupportingQuotes
                      quotes={item.quotes}
                      accent="text-emerald-700"
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {r.negative_themes?.length ? (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-red-600 mb-1">
              Recurring complaints
            </div>
            <ul className="space-y-2 text-sm">
              {r.negative_themes.map((raw, i) => {
                const item = normalizeTheme(raw);
                if (!item) return null;
                const isPayment = mentionsPayments(item.text);
                return (
                  <li
                    key={i}
                    className={
                      isPayment
                        ? "rounded-md bg-mews-50 border border-mews-100 px-3 py-2"
                        : "rounded-md border border-red-100 bg-red-50/40 px-3 py-2"
                    }
                  >
                    <div
                      className={`flex items-start gap-2 ${isPayment ? "text-mews-900" : "text-slate-800"}`}
                    >
                      <span
                        className={
                          isPayment
                            ? "text-mews-700 mt-0.5"
                            : "text-red-500 mt-0.5"
                        }
                      >
                        •
                      </span>
                      <span className="flex-1">{item.text}</span>
                      {isPayment && <MewsPaymentsBadge />}
                    </div>
                    <SupportingQuotes
                      quotes={item.quotes}
                      accent={isPayment ? "text-mews-700" : "text-red-700"}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {r.recent_press?.length ? (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Recent press
            </div>
            <PressList items={r.recent_press} />
          </div>
        ) : null}
      </Section>

      {/* ── Services & amenities ── */}
      <Section title="Services & amenities">
        {s.restaurants?.length ? (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Restaurants
            </div>
            <List items={s.restaurants} />
          </div>
        ) : null}
        {s.bars?.length ? (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Bars
            </div>
            <List items={s.bars} />
          </div>
        ) : null}
        {s.spa_and_wellness?.length ? (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Spa & wellness
            </div>
            <List items={s.spa_and_wellness} />
          </div>
        ) : null}
        {s.events_and_mice && (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Events / MICE
            </div>
            <Row
              label="Meeting rooms"
              value={s.events_and_mice.meeting_rooms}
            />
            <Row
              label="Largest capacity"
              value={s.events_and_mice.largest_capacity}
            />
            <Row label="Ballroom" value={s.events_and_mice.ballroom} />
            {s.events_and_mice.notable_event_offerings?.length ? (
              <div className="mt-2">
                <List items={s.events_and_mice.notable_event_offerings} />
              </div>
            ) : null}
          </div>
        )}
        {s.other_amenities?.length ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Other amenities
            </div>
            <List items={s.other_amenities} />
          </div>
        ) : null}
      </Section>

      {/* ── Tech stack signals ── */}
      {dossier.tech_stack_signals?.length ? (
        <Section title="Tech stack signals">
          <ul className="space-y-2 text-sm">
            {dossier.tech_stack_signals.map((t, i) => (
              <li key={i}>
                <span className="font-medium">{t.system}</span>
                {t.category ? (
                  <span className="text-slate-500"> · {t.category}</span>
                ) : null}
                {t.evidence ? (
                  <div className="text-slate-600">{t.evidence}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── Sources ── */}
      {dossier.sources?.length ? (
        <Section title="Sources">
          <ul className="space-y-1 text-sm">
            {dossier.sources.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-mews-600 underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
