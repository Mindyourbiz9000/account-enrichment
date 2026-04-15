// JSON schema used by Perplexity's structured output to produce consistent
// research dossiers the Mews sales team can consume.

export const HOTEL_RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    hotel: {
      type: "object",
      properties: {
        name: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
        website: { type: "string", description: "Official hotel website URL" },
        brand_or_group: {
          type: "string",
          description: "Parent chain / group / independent",
        },
        segment: {
          type: "string",
          description:
            "Luxury, Upper Upscale, Upscale, Upper Midscale, Midscale, Economy, Boutique, Lifestyle, etc.",
        },
        star_rating: { type: "string" },
        address: { type: "string" },
        phone: {
          type: "string",
          description:
            "Main reception / reservations phone number in a human-readable form with country code (e.g. '+32 4 222 00 00'). Pull it from the hotel's own contact page when possible; fall back to Google Business / Booking.com only if the official site doesn't publish it. Omit if you cannot verify it.",
        },
        hero_image_url: {
          type: "string",
          description:
            "Direct URL to a representative photo of the hotel exterior or signature space. Must be a stable, publicly reachable image URL (e.g. from the hotel's own website og:image, or a booking.com / expedia / hotel-brand CDN). Omit if you cannot verify one exists.",
        },
        tldr: {
          type: "string",
          description:
            "One or two crisp sentences capturing what this hotel is and why it matters — written like a Michelin-guide headline, not marketing fluff.",
        },
      },
      required: ["name", "city", "country"],
      additionalProperties: false,
    },
    property_profile: {
      type: "object",
      properties: {
        number_of_rooms: { type: "string" },
        room_types: { type: "array", items: { type: "string" } },
        price_range: {
          type: "string",
          description: "Typical nightly rate range, with currency",
        },
        estimated_adr: {
          type: "string",
          description:
            "Live rate observed from Booking.com / hotel booking engine for a standard double, midweek 3–4 weeks out (e.g. 'from €189/night midweek, from €249/night weekend, Booking.com, Apr 2026'). Only use a segment-based estimate if no OTA listing exists — label it 'est.' in that case.",
        },
        occupancy_notes: { type: "string" },
        local_market_context: {
          type: "string",
          description:
            "Brief characterisation of demand mix (leisure / corporate / MICE / transit), key seasonal peaks/troughs, and 1–2 nearby demand generators (e.g. 'Corporate-heavy; near Frankfurt Messe convention centre; strong Mon–Thu demand, leisure softer on weekends').",
        },
        year_opened_or_renovated: { type: "string" },
      },
      additionalProperties: false,
    },
    services: {
      type: "object",
      properties: {
        restaurants: { type: "array", items: { type: "string" } },
        bars: { type: "array", items: { type: "string" } },
        spa_and_wellness: { type: "array", items: { type: "string" } },
        events_and_mice: {
          type: "object",
          properties: {
            meeting_rooms: { type: "string" },
            largest_capacity: { type: "string" },
            ballroom: { type: "string" },
            notable_event_offerings: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
        other_amenities: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
    reputation: {
      type: "object",
      properties: {
        google_rating: { type: "string" },
        tripadvisor_rating: { type: "string" },
        booking_rating: { type: "string" },
        review_volume: { type: "string" },
        positive_themes: {
          type: "array",
          maxItems: 4,
          description:
            "Recurring positive themes — at most 4, only include a theme if you can back it with at least TWO verbatim quotes from separate reviews. Do not include one-off sentiments.",
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Short summary of the recurring theme.",
              },
              quotes: {
                type: "array",
                description:
                  "EXACTLY 2 verbatim, word-for-word guest quotes that back this theme. Pick the two punchiest. Never paraphrase. Trim each to ≤20 words while preserving original wording.",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "The verbatim review snippet.",
                    },
                    source: {
                      type: "string",
                      description:
                        "Platform name: 'TripAdvisor', 'Booking.com', 'Google', 'Expedia', etc.",
                    },
                    source_url: {
                      type: "string",
                      description:
                        "Direct URL to the specific review (not the hotel landing page). Omit if you only have the platform's hotel listing.",
                    },
                    date: {
                      type: "string",
                      description:
                        "Visible posted date of the review on the platform (e.g. 'Mar 2026', '2026-02', 'Feb 14, 2026'). REQUIRED — only include reviews from the last 12 months.",
                    },
                  },
                  required: ["text"],
                  additionalProperties: false,
                },
              },
            },
            required: ["text", "quotes"],
            additionalProperties: false,
          },
        },
        negative_themes: {
          type: "array",
          maxItems: 4,
          description:
            "Recurring complaints — at most 4, only include a theme if you can back it with at least TWO verbatim quotes from separate reviews. Do not include one-off sentiments.",
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Short summary of the recurring complaint.",
              },
              quotes: {
                type: "array",
                description:
                  "EXACTLY 2 verbatim, word-for-word guest quotes that back this complaint. Pick the two punchiest. Never paraphrase. Trim each to ≤20 words.",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    source: { type: "string" },
                    source_url: { type: "string" },
                    date: {
                      type: "string",
                      description:
                        "Visible posted date of the review (e.g. 'Mar 2026'). REQUIRED — only include reviews from the last 12 months.",
                    },
                  },
                  required: ["text"],
                  additionalProperties: false,
                },
              },
            },
            required: ["text", "quotes"],
            additionalProperties: false,
          },
        },
        recent_press: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              source_url: {
                type: "string",
                description: "URL of the press article or announcement.",
              },
            },
            required: ["text"],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    key_challenges: {
      type: "array",
      maxItems: 6,
      description:
        "Top operational or commercial challenges this hotel likely faces — at most 6, picked for their relevance to a Mews sales pitch. Mix evidence types: (a) REVIEW-BACKED challenges (≥2 verbatim guest quotes from separate reviews, emit the 2 quotes), (b) SEGMENT / TECH / SERVICES-GAP / PRESS-driven challenges (no quote required — emit `evidence_basis` instead). One-off review gripes do not belong here; structural challenges grounded in the segment playbook DO belong even without quotes.",
      items: {
        type: "object",
        properties: {
          challenge: {
            type: "string",
            description: "Short summary of the challenge.",
          },
          mews_angle: {
            type: "string",
            description:
              "How Mews could address this specifically — name the Mews product line.",
          },
          payment_related: {
            type: "boolean",
            description:
              "True if the challenge touches payments, billing, deposits, refunds, chargebacks, invoicing, reconciliation, tipping, POS charging, split folios, cash handling, card-on-file storage, currency conversion, or any other money-movement pain point. Err on the side of flagging true when payments are even partially implicated — this unlocks a highly differentiated Mews Payments pitch.",
          },
          evidence_type: {
            type: "string",
            enum: [
              "guest_reviews",
              "segment_profile",
              "tech_stack",
              "services_gap",
              "press_or_ownership",
            ],
            description:
              "Where the challenge comes from. 'guest_reviews' when ≥2 quotes exist. 'segment_profile' when driven by the playbook's segment-specific pains (aparthotel recurring billing, resort package mapping, MMP central governance, etc.). 'tech_stack' when driven by an observed PMS/POS/CM. 'services_gap' when an ICP-expected service is missing. 'press_or_ownership' when a recent news event implies the challenge.",
          },
          evidence_basis: {
            type: "string",
            description:
              "REQUIRED when evidence_type is not 'guest_reviews'. One concise sentence explaining why this is a real challenge for THIS hotel — reference the specific segment rule, tech system, services gap, or press event. Example: 'Aparthotel with 60-night average stay per Booking.com — recurring monthly billing & deposit lifecycle is a playbook-flagged pain.'",
          },
          quotes: {
            type: "array",
            description:
              "REQUIRED when evidence_type is 'guest_reviews'. Otherwise omit or leave empty. EXACTLY 2 verbatim, word-for-word guest quotes (or press snippets) that back this challenge. Pick the two punchiest. Never paraphrase. Trim each to ≤20 words.",
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "The verbatim review or press snippet.",
                },
                source: {
                  type: "string",
                  description:
                    "Platform or publication: 'TripAdvisor', 'Booking.com', 'Google', 'Skift', etc.",
                },
                source_url: {
                  type: "string",
                  description:
                    "Direct URL to the specific review or article (not the hotel landing page). Omit if not available.",
                },
                date: {
                  type: "string",
                  description:
                    "Visible posted date of the review or article (e.g. 'Mar 2026'). REQUIRED for guest reviews — only include reviews from the last 12 months.",
                },
              },
              required: ["text"],
              additionalProperties: false,
            },
          },
        },
        required: ["challenge"],
        additionalProperties: false,
      },
    },
    contacts: {
      type: "array",
      description:
        "Named individuals relevant for a Mews outreach (GM, DOSM, Revenue, F&B, Events, Spa, Digital/IT, Owner/Asset manager). Only include real, publicly sourced people.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          email: { type: "string" },
          email_confidence: {
            type: "string",
            enum: ["verified", "guessed"],
            description:
              "'verified' only if the exact email is printed on a public page (hotel website, press release, conference bio, LinkedIn). 'guessed' if you constructed it from a naming pattern (firstname.lastname@domain). Omit the email field entirely if your confidence is <95%.",
          },
          phone: { type: "string" },
          linkedin: { type: "string" },
          linkedin_confidence: {
            type: "string",
            enum: ["verified", "guessed"],
            description:
              "'verified' only if you found the exact LinkedIn URL for this exact person. 'guessed' if you constructed the URL from a name. Omit the linkedin field entirely if your confidence is <95%.",
          },
          tenure_confidence: {
            type: "string",
            enum: ["current", "stale_risk", "unverified", "conflicting_sources"],
            description:
              "'current' if two independent sources confirm this person is in role now. 'stale_risk' if the only evidence is >12 months old or from a single source. 'unverified' if only LinkedIn with no hotel-page confirmation. 'conflicting_sources' if two sources disagree.",
          },
          source_date: {
            type: "string",
            description:
              "Date of the most recent source confirming this person is in role (e.g. 'Mar 2026', '2025-Q4'). Helps reps gauge how fresh the contact data is.",
          },
          source: {
            type: "string",
            description: "Where this contact was found",
          },
        },
        required: ["role"],
        additionalProperties: false,
      },
    },
    tech_stack_signals: {
      type: "array",
      description:
        "Observed or likely PMS / CRS / booking engine / loyalty / marketing tech, with evidence where possible",
      items: {
        type: "object",
        properties: {
          system: { type: "string" },
          category: { type: "string" },
          evidence: { type: "string" },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
            description:
              "'high' if seen in a booking-engine footer, integration directory, or brand tech page. 'medium' if from a job posting ≤24 months old, a guest review naming the system, or a directory listing ≤18 months old. 'low' if inferred from segment/brand/market with no direct evidence — tag explicitly as 'inferred'.",
          },
          evidence_url: {
            type: "string",
            description:
              "URL of the page where this system was observed (job posting, integration directory, hotel booking engine footer). Omit if no direct URL is available.",
          },
        },
        required: ["system"],
        additionalProperties: false,
      },
    },
    mews_qualification: {
      type: "object",
      description:
        "Mews internal segment qualification. Maps the hotel against the playbook's green-signal / red-flag matrix and gives the salesperson a verdict + the single fastest disqualifying question to ask on the call.",
      properties: {
        segment: {
          type: "string",
          description:
            "Which playbook segment best fits: 'Boutique & lifestyle', 'Aparthotel / serviced apartments / long-stay', 'Hostels & budget', 'Resorts & leisure', 'Chain / multi-property (MMP)', or 'General'.",
        },
        verdict: {
          type: "string",
          enum: [
            "🟩 strong fit",
            "🟨 limited fit",
            "🟥 poor fit",
            "needs more discovery",
          ],
          description:
            "Overall fit verdict per Mews ICP and the segment cheat-sheet.",
        },
        verdict_rationale: {
          type: "string",
          description:
            "1–2 sentences explaining the verdict in plain English (room count, segment, market, key pivotal signals).",
        },
        fit_signals: {
          type: "array",
          description:
            "Green signals from the segment cheat-sheet that this property exhibits.",
          items: {
            type: "object",
            properties: {
              signal: {
                type: "string",
                description:
                  "The green-signal phrase from the playbook (quote it verbatim where possible).",
              },
              evidence: {
                type: "string",
                description:
                  "Short observed proof from the research (e.g. 'F&B-heavy: 2 restaurants + lounge bar').",
              },
            },
            required: ["signal"],
            additionalProperties: false,
          },
        },
        red_flags: {
          type: "array",
          description:
            "Red flags / DQ triggers from the segment cheat-sheet OR the cross-segment hard-stop list.",
          items: {
            type: "object",
            properties: {
              flag: {
                type: "string",
                description:
                  "The red-flag phrase from the playbook (quote it verbatim where possible).",
              },
              evidence: {
                type: "string",
                description:
                  "Short observed proof or risk indicator from the research.",
              },
              severity: {
                type: "string",
                enum: ["blocker", "watch"],
                description:
                  "'blocker' if on the cross-segment hard-stop list or the segment's deal-breaker; otherwise 'watch'.",
              },
            },
            required: ["flag"],
            additionalProperties: false,
          },
        },
        fastest_dq_check: {
          type: "string",
          description:
            "The single most useful disqualifying question for this segment. Use the cheat-sheet's 'Fastest check' / 'Fastest DQ' / 'First question' verbatim where applicable.",
        },
      },
      additionalProperties: false,
    },
    mews_positioning: {
      type: "object",
      description:
        "Tailored talking points the Mews sales team can open with",
      properties: {
        opening_hook: { type: "string" },
        top_three_value_props: {
          type: "array",
          items: { type: "string" },
        },
        discovery_questions: { type: "array", items: { type: "string" } },
        recommended_next_step: { type: "string" },
      },
      additionalProperties: false,
    },
    sources: {
      type: "array",
      description: "URLs used during research",
      items: { type: "string" },
    },
  },
  required: ["hotel"],
  additionalProperties: false,
} as const;
