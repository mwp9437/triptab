import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUDGET_LABELS: Record<number, Record<string, string>> = {
  1: { accommodation: "Hostel/budget", meals: "Street food/casual", activities: "Free/cheap", transportation: "Public transit" },
  2: { accommodation: "Mid-range", meals: "Sit-down casual", activities: "Moderate", transportation: "Rideshare" },
  3: { accommodation: "Boutique/4-star", meals: "Upscale", activities: "Premium", transportation: "Private car" },
  4: { accommodation: "Luxury/5-star", meals: "Fine dining", activities: "VIP/private", transportation: "Luxury/charter" },
};

function buildPromptFromIntake(intake: any): string {
  const b = intake.budget || {};
  const totalBudget = b.totalBudget ? `\nBudget cap: $${b.totalBudget} USD per person for the entire trip. Target ~85% of this cap ($${Math.round(b.totalBudget * 0.85)}) to leave a buffer for spontaneous spending.` : "";
  const dest = intake.destination?.trim() || "a surprise destination (pick an exciting, well-suited destination based on the traveler preferences, dates, and budget)";
  const homeCity = intake.homeCity?.trim() || "not specified — use a major hub near the destination";
  return `Plan a trip to ${dest} from ${intake.startDate} to ${intake.endDate} for ${intake.travelerCount} ${intake.travelerType} travelers.
Departing from: ${homeCity}

Budget preferences:
- Accommodation: ${BUDGET_LABELS[b.accommodation]?.accommodation || "mid-range"}
- Meals: ${BUDGET_LABELS[b.meals]?.meals || "casual"}
- Activities: ${BUDGET_LABELS[b.activities]?.activities || "moderate"}
- Transportation: ${BUDGET_LABELS[b.transportation]?.transportation || "rideshare"}${totalBudget}

Trip vibes: ${(intake.vibes || []).join(", ") || "general sightseeing"}
Dietary: ${(intake.dietary || []).join(", ") || "no restrictions"}
Mobility: ${intake.mobility || "no limitations"}
${intake.mustDos ? `Must-do: ${intake.mustDos}` : ""}
${intake.avoids ? `Avoid: ${intake.avoids}` : ""}
${intake.childAges?.length ? `Children ages: ${intake.childAges.join(", ")}` : ""}

Generate the complete trip plan.`;
}

const SYSTEM_PROMPT = `You are a travel itinerary generator. Create a detailed trip plan as JSON.

CRITICAL ACCURACY RULES — FOLLOW THESE STRICTLY:
- ONLY recommend hotels, restaurants, attractions, and venues that you are CERTAIN exist at the specified destination.
- NEVER invent, fabricate, or guess names of hotels, restaurants, or attractions. If you are unsure whether a specific place exists in a city, use a well-known chain hotel or a generic description like "boutique hotel in [neighborhood]" instead of making up a name.
- ALWAYS verify in your knowledge that a business is located in the CORRECT CITY. Many hotel/restaurant brands exist in multiple cities — ensure the specific property you name actually exists in the destination city (e.g., "The Blend Inn" is in Osaka, NOT Sapporo).
- For hotels: prefer internationally known chains (e.g., JR Tower Hotel Nikko, Hilton, Marriott, APA Hotel) or well-documented local hotels you are confident about. Include the specific property name with the city (e.g., "JR Tower Hotel Nikko Sapporo").
- For restaurants: prefer well-known establishments, food streets, markets, or cuisine types rather than inventing specific restaurant names. It's better to say "ramen shop in Ramen Alley (Ramen Yokocho)" than to invent "Sapporo Ramen House".
- For attractions: only use real, verifiable landmarks, parks, museums, temples, and neighborhoods.
- When in doubt about a specific name, describe by type + neighborhood instead (e.g., "highly-rated izakaya in Susukino" rather than inventing a name).

Return ONLY valid JSON matching this schema:
{
  "destination": "City, Country",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "travelers": 2,
  "itinerary": [
    {
      "date": "YYYY-MM-DD",
      "dayNumber": 1,
      "title": "Arrival & Exploring Downtown",
      "blocks": [
        {
          "id": "block-1-1",
          "startTime": "09:00",
          "endTime": "10:30",
          "title": "Activity Name",
          "location": "Address or area",
          "cost": 25,
          "category": "activity",
          "notes": "Brief tip or detail"
        }
      ]
    }
  ],
  "actionItems": [
    {
      "id": "action-1",
      "category": "flights",
      "text": "Book round-trip flights",
      "completed": false,
      "cost": 500
    }
  ],
  "budget": {
    "total": 3000,
    "spent": 0,
    "categories": {
      "flights": 500,
      "accommodation": 800,
      "food": 400,
      "activities": 300,
      "transport": 200
    }
  },
  "packingList": [
    {
      "id": "pack-1",
      "category": "clothing",
      "text": "Light rain jacket",
      "checked": false,
      "reason": "Rainy season in destination"
    }
  ],
  "localTips": [
    {
      "id": "tip-1",
      "emoji": "💰",
      "title": "Tipping",
      "detail": "Tipping is not customary; it can be considered rude."
    },
    {
      "id": "tip-2",
      "emoji": "🍺",
      "title": "Beer price",
      "detail": "A draft beer at a bar costs about ¥500 (~$3.50)."
    },
    {
      "id": "tip-3",
      "emoji": "🙏",
      "title": "Saying thank you",
      "detail": "Say 'Arigatou gozaimasu' (ah-ree-gah-TOH go-zai-MAHS) for formal thanks."
    }
  ]
}

FLIGHT & COST REALISM RULES:
- The user's home city is provided. Use it for realistic flight routing and cost estimates.
- Estimate flight costs based on the ACTUAL route (e.g., New York to Tokyo is ~$800-1200 economy, not $300). Consider:
  - Distance and typical market rates for the route
  - Economy vs business based on budget tier ($ and $$ = economy, $$$ = premium economy, $$$$ = business)
  - Seasonal pricing (peak summer/holidays = higher)
  - Whether direct flights exist on this route or if connections are needed
- For ALL cost estimates throughout the itinerary, base them on realistic market rates for the destination:
  - Hotels: use typical nightly rates for the destination and budget tier
  - Meals: use typical restaurant prices for the destination city (Tokyo ≠ Bali ≠ Paris)
  - Activities: use typical admission/tour prices for the specific destination
  - Transport: use typical taxi/transit costs for the destination city
- When uncertain about a specific price, estimate conservatively (slightly high) and round to nearest $5 or $10.
- NEVER just make up a round number. A flight from NYC to Tokyo should not be "$150" or "$500" — it should reflect actual market rates (~$900-1200 economy round-trip).

Rules:
- block category: "transport" | "activity" | "meal" | "free" | "accommodation"
- actionItem category: "flights" | "hotels" | "restaurants" | "tickets" | "packing"
- packingList category: "clothing" | "gear" | "toiletries" | "electronics" | "documents" | "misc"
- Unique IDs: "block-X-Y", "action-X", or "pack-X"
- Include realistic travel time between locations
- IMPORTANT: Day 1 MUST start with an arrival flight block (category "transport") and the last day MUST end with a departure flight block (category "transport"). Include realistic flight times and airline suggestions. Use the home city for departure/return flights.
- Cost per person in USD
- 6-10 blocks per day including meals and free time
- IMPORTANT: Every day MUST include an accommodation block (category "accommodation") showing the hotel/lodging for that night
- IMPORTANT: Each day should have exactly ONE accommodation block (category "accommodation"). Do NOT create separate blocks for check-in and the hotel stay. Use a single block with the hotel name as the title, check-in time as startTime, and check-out time (or 23:59 for non-checkout days) as endTime. For check-in days, set the title to just the hotel name (e.g., "Moose Hotel and Suites") — the app will add the "Check in:" / "Check out:" prefix automatically based on the day's position in the stay. Never create blocks with titles starting with "Check-in", "Check in", "Accommodation:", or similar prefixes — just use the hotel name.
- Respect the budget tier preferences. If a per-person budget cap is given, target approximately 85% of that cap for your planned costs — this leaves a ~15% buffer for spontaneous spending, tips, price variations, and upgrades. For example, if the cap is $3,000, plan for roughly $2,500–$2,600 in total estimated costs. Do NOT plan right up to the limit. The budget summary 'total' field should reflect your planned amount, not the cap.
- Be opinionated about recommendations — pick the best options, don't hedge
- Generate 15-30 packing items based on: destination climate/weather for the travel dates, planned activities (hiking gear, swimwear, formal wear etc.), location-specific needs (adapters, sunscreen, mosquito repellent etc.), and trip duration
- Each packing item should have a brief "reason" explaining why it's needed
- Generate 5-10 local tips covering: tipping customs, typical prices (beer, coffee, meal), greetings & how to say hello/thank you/goodbye with phonetic pronunciation, cultural etiquette (bowing, handshakes, cheek kisses), common scams to avoid, useful local phrases, transportation tips, and any unique local customs travelers should know
- Each local tip should have an appropriate emoji, a short title, and a detailed explanation

QUALITY ASSURANCE — FINAL REVIEW:
Before returning the JSON, mentally review the COMPLETE itinerary for these logical issues:
- FLIGHTS: Do departure/arrival flights reference the correct home city? Are connection times realistic (minimum 2 hours for international, 1 hour domestic)? Are flight durations plausible for the distance?
- HOTELS: Is every hotel actually located in the city being visited that day? If the itinerary moves between cities, does the hotel change?
- GEOGRAPHY: Are all activities on a given day in the same city/area? No breakfast in Tokyo and lunch in Osaka on the same day unless there's a transit block between them.
- TIMING: Do activity times make sense? No museum visits at 6am. No dinner at 3pm. Enough transit time between locations.
- CONTINUITY: Does the trip flow logically day-to-day? No teleporting between distant cities without transport blocks.
- COST COHERENCE: Do the individual block costs sum to roughly match the budget category totals? Is the total in the right ballpark for the destination and duration?
If any issue is found, fix it before returning the JSON.

- Return ONLY JSON, no markdown`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    let userPrompt: string;

    if (body.intake) {
      userPrompt = buildPromptFromIntake(body.intake);
    } else if (body.messages) {
      // Legacy: build from conversation history
      const msgs = body.messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
      userPrompt = `Based on this conversation, generate the trip plan:\n${msgs}`;
    } else {
      throw new Error("Either 'intake' or 'messages' must be provided");
    }

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: fullMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const tripPlan = JSON.parse(jsonStr);

    return new Response(JSON.stringify(tripPlan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-itinerary error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
