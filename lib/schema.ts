// JSON schema used by Claude's structured output to produce consistent
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
            "Estimated Average Daily Rate if public; otherwise stated as unknown with reasoning",
        },
        occupancy_notes: { type: "string" },
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
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              source_url: {
                type: "string",
                description:
                  "Direct URL to a public source that backs this theme — the TripAdvisor / Booking / Google review page, a press article, or the hotel page itself. Omit only if no such URL can be cited.",
              },
            },
            required: ["text"],
            additionalProperties: false,
          },
        },
        negative_themes: {
          type: "array",
          description: "Recurring complaints / pain points in reviews",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              source_url: {
                type: "string",
                description:
                  "Direct URL to a review / article quoting this complaint (TripAdvisor review, Booking review, news piece). Omit only if no such URL can be cited.",
              },
            },
            required: ["text"],
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
      description:
        "Top operational or commercial challenges this hotel likely faces, inferred from reviews, segment and market signals",
      items: {
        type: "object",
        properties: {
          challenge: { type: "string" },
          evidence: { type: "string" },
          evidence_url: {
            type: "string",
            description:
              "Direct URL to the review / article / page that evidences this challenge (e.g. the specific TripAdvisor review, Booking complaint, or news piece). Include whenever the evidence quotes or paraphrases a customer comment or published source.",
          },
          mews_angle: {
            type: "string",
            description: "How Mews could address this specifically",
          },
          payment_related: {
            type: "boolean",
            description:
              "True if the challenge touches payments, billing, deposits, refunds, chargebacks, invoicing, reconciliation, tipping, POS charging, split folios, cash handling, card-on-file storage, currency conversion, or any other money-movement pain point. Err on the side of flagging true when payments are even partially implicated — this unlocks a highly differentiated Mews Payments pitch.",
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
        },
        required: ["system"],
        additionalProperties: false,
      },
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
