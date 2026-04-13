// JSON schema used by Claude's structured output to produce consistent
// research dossiers the Muse sales team can consume.

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
        positive_themes: { type: "array", items: { type: "string" } },
        negative_themes: {
          type: "array",
          items: { type: "string" },
          description: "Recurring complaints / pain points in reviews",
        },
        recent_press: { type: "array", items: { type: "string" } },
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
          muse_angle: {
            type: "string",
            description: "How Muse could address this specifically",
          },
        },
        required: ["challenge"],
        additionalProperties: false,
      },
    },
    contacts: {
      type: "array",
      description:
        "Named individuals relevant for a Muse outreach (GM, DOSM, Revenue, F&B, Events, Spa, Digital/IT, Owner/Asset manager). Only include real, publicly sourced people.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          linkedin: { type: "string" },
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
    muse_positioning: {
      type: "object",
      description:
        "Tailored talking points the Muse sales team can open with",
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
