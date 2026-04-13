import React from "react";

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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 mb-5">
      <h2 className="text-lg font-semibold text-mews-900 mb-4">{title}</h2>
      {children}
    </section>
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

export function HotelDossierView({ dossier }: { dossier: HotelDossier }) {
  const h = dossier.hotel ?? {};
  const p = dossier.property_profile ?? {};
  const s = dossier.services ?? {};
  const r = dossier.reputation ?? {};

  return (
    <div>
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

      <Section title="Property profile">
        <Row label="Rooms" value={p.number_of_rooms} />
        <Row label="Room types" value={p.room_types?.join(", ")} />
        <Row label="Price range" value={p.price_range} />
        <Row label="Estimated ADR" value={p.estimated_adr} />
        <Row label="Occupancy" value={p.occupancy_notes} />
        <Row label="Opened / renovated" value={p.year_opened_or_renovated} />
      </Section>

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
            <List items={r.negative_themes} />
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

      {dossier.key_challenges?.length ? (
        <Section title="Key challenges">
          <div className="space-y-4">
            {dossier.key_challenges.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-4 bg-slate-50"
              >
                <div className="font-medium text-slate-900">{c.challenge}</div>
                {c.evidence && (
                  <div className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">Evidence: </span>
                    {c.evidence}
                  </div>
                )}
                {c.mews_angle && (
                  <div className="mt-1 text-sm text-mews-700">
                    <span className="font-medium">Mews angle: </span>
                    {c.mews_angle}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

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

      {dossier.mews_positioning && (
        <Section title="Mews positioning">
          {dossier.mews_positioning.opening_hook && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Opening hook
              </div>
              <div className="text-sm text-slate-800">
                {dossier.mews_positioning.opening_hook}
              </div>
            </div>
          )}
          {dossier.mews_positioning.top_three_value_props?.length ? (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Top value props
              </div>
              <List items={dossier.mews_positioning.top_three_value_props} />
            </div>
          ) : null}
          {dossier.mews_positioning.discovery_questions?.length ? (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Discovery questions
              </div>
              <List items={dossier.mews_positioning.discovery_questions} />
            </div>
          ) : null}
          {dossier.mews_positioning.recommended_next_step && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Recommended next step
              </div>
              <div className="text-sm text-slate-800">
                {dossier.mews_positioning.recommended_next_step}
              </div>
            </div>
          )}
        </Section>
      )}

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
