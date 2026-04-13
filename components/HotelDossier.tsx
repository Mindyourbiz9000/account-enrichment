import React, { useState } from "react";

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
    positive_themes?: string[];
    negative_themes?: string[];
    recent_press?: string[];
  };
  key_challenges?: Array<{
    challenge: string;
    evidence?: string;
    mews_angle?: string;
    payment_related?: boolean;
  }>;
  contacts?: Array<{
    name?: string;
    role: string;
    email?: string;
    phone?: string;
    linkedin?: string;
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
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2 min-w-[96px]">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className={`text-sm font-semibold ${accent ?? "text-slate-900"}`}>
        {value}
      </span>
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
    <div className="avoid-break rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-6 bg-white">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Image / gradient */}
        <div className="relative h-56 md:h-auto md:min-h-[240px] bg-gradient-to-br from-mews-100 via-mews-500 to-mews-700">
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
        <div className="p-6 md:p-7 flex flex-col gap-3">
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
            <p className="text-sm text-slate-700 leading-relaxed border-l-2 border-mews-600 pl-3">
              {h.tldr}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-1">
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

          {h.website && (
            <a
              href={h.website}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-mews-700 underline decoration-dotted mt-1 self-start break-all"
            >
              {h.website}
            </a>
          )}
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
      {/* ── Mews positioning — top priority for sales team ── */}
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
                mentionsPayments(c.mews_angle);
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
                    {c.evidence && (
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wide block mb-0.5">
                          Evidence
                        </span>
                        {c.evidence}
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
                {dossier.contacts.map((c, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{c.name ?? "—"}</td>
                    <td className="py-2 pr-4">{c.role}</td>
                    <td className="py-2 pr-4">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-mews-600 underline"
                        >
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {c.linkedin ? (
                        <a
                          href={c.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="text-mews-600 underline"
                        >
                          profile
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      {c.source ?? "—"}
                    </td>
                  </tr>
                ))}
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
        <Row label="Google" value={r.google_rating} />
        <Row label="TripAdvisor" value={r.tripadvisor_rating} />
        <Row label="Booking.com" value={r.booking_rating} />
        <Row label="Review volume" value={r.review_volume} />
        {r.positive_themes?.length ? (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-emerald-600 mb-1">
              What guests love
            </div>
            <List items={r.positive_themes} />
          </div>
        ) : null}
        {r.negative_themes?.length ? (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-red-600 mb-1">
              Recurring complaints
            </div>
            <ul className="space-y-1.5 text-sm">
              {r.negative_themes.map((theme, i) => {
                const isPayment = mentionsPayments(theme);
                return (
                  <li
                    key={i}
                    className={
                      isPayment
                        ? "flex items-start gap-2 rounded-md bg-mews-50 border border-mews-100 px-2.5 py-1.5"
                        : "flex items-start gap-2 text-slate-800"
                    }
                  >
                    <span
                      className={
                        isPayment ? "text-mews-700 mt-0.5" : "text-slate-400"
                      }
                    >
                      •
                    </span>
                    <span className="flex-1">{theme}</span>
                    {isPayment && <MewsPaymentsBadge />}
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
            <List items={r.recent_press} />
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
