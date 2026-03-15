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

  // Multi-city support
  const destinations = intake.destinations?.length ? intake.destinations : [intake.destination?.trim()].filter(Boolean);
  const dest = destinations.length > 1
    ? destinations.join(" → ")
    : destinations[0] || "a surprise destination (pick an exciting, well-suited destination based on the traveler preferences, dates, and budget)";

  // Pre-existing details (from "already planned" flow)
  // Map day names to actual dates so the AI can place activities on the correct day
  let preExisting = "";
  if (intake.preExistingDetails) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const start = new Date(intake.startDate + "T00:00:00");
    const end = new Date(intake.endDate + "T00:00:00");
    const dateMap: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().split("T")[0];
      dateMap.push(`${dayNames[d.getDay()]} = ${iso}`);
    }
    preExisting = `\n\nIMPORTANT — The traveler already has these plans/bookings. INCORPORATE them into the itinerary and build around them:\n${intake.preExistingDetails}\n\nDate reference: ${dateMap.join(", ")}.`;
  }

  // Transportation info
  const transportLine = intake.needsFlights && intake.homeCity?.trim()
    ? `Departing from: ${intake.homeCity.trim()}. Flight preferences: departure ${intake.flightPreferences?.departureTime || "no preference"}, return ${intake.flightPreferences?.returnTime || "no preference"}, max connections: ${intake.flightPreferences?.maxConnections ?? "any"}, preferred airline: ${intake.flightPreferences?.preferredAirline || "none"}.`
    : 'Transportation to destination: not specified by user — do NOT include flights.';
  const carLine = intake.needsCarRental ? '\nUser needs a rental car — include a car rental action item.' : '';

  return `Plan a trip to ${dest} from ${intake.startDate} to ${intake.endDate} for ${intake.travelerCount} ${intake.travelerType || "couple"} travelers.
${transportLine}${carLine}

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
${intake.childAges?.length ? `Children ages: ${intake.childAges.join(", ")}` : ""}${preExisting}

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

TRANSPORTATION RULES:
- ONLY include flight blocks if the user prompt explicitly says "Departing from: [city]" with a real city name. If it says "do NOT include flights", then there must be ZERO flight blocks and ZERO flight costs in the entire response.
- When flights are excluded: no flight blocks, no airport transfers, no flight action items, budget.categories.flights MUST be 0.
- If the pre-existing details mention driving, a rental car, or no flights needed, exclude all flight blocks.
- For inter-city transport on multi-city trips, always include transport blocks between cities regardless of flight preferences.

FLIGHT BLOCK RULES (when flights ARE included):
- These are illustrative/estimated flights — you do not have real flight data. Use realistic estimates.
- Each flight block (category "transport") MUST have a realistic per-person cost: domestic US $150-$400, US-Europe $500-$1200, US-Asia $800-$1800, intra-Europe $50-$200.
- Put the full per-person flight cost on the FLIGHT block itself (the one with "Flight" or "Depart" in the title), NOT on airport transfer or check-in blocks. Airport transfers should have their own small cost ($15-$60).
- For overnight/red-eye flights, the accommodation block on that day should be title: "Overnight flight", category: "accommodation", cost: 0. Do NOT show a hotel on a day the traveler spends sleeping on a plane.

ACCOMMODATION RULES:
- Every day MUST include exactly one accommodation block (category "accommodation"), including travel days.
- CRITICAL — The accommodation title must reflect the user's ACTUAL lodging:
  - If the user said "staying at my friend's house in Alpine Meadows" → title: "Friend's house in Alpine Meadows", cost: 0. Do NOT use any hotel.
  - If the user said "Airbnb on Broadway" → title: "Airbnb on Broadway", cost: 0. Do NOT use any hotel.
  - If the user said "camping at Yosemite" → title: "Camping at Yosemite", cost: 0. Do NOT use any hotel.
  - If the user named a specific hotel (e.g., "Hilton Downtown") → title: "Hilton Downtown", cost: realistic rate.
  - If the user did NOT mention lodging at all → suggest an appropriate hotel based on destination and budget tier.
- NEVER replace user-specified lodging with a hotel. If the user said where they're staying, use EXACTLY that.
- Use ONE accommodation per city stay. Show it on every day the user is in that city with the same title.
- When the user moves to a new city in a multi-city trip, change the accommodation to a DIFFERENT hotel/lodging in the new city. Each city MUST have a unique accommodation name.
- Set the title to just the lodging name. The app adds "Check in:" / "Check out:" prefixes automatically — do NOT include those words in the title.
- Do NOT include "Check-in" or "Check-out" in the accommodation block title.

ACTIVITY THEMING:
- If the user said they want to do a specific activity heavily (e.g., "I want to ski as much as possible"), treat that as the THEME. At least 70% of activity blocks should relate to that theme.
- "I want to ski" means it's a SKI TRIP — don't fill the day with museums and shopping. Suggest different mountains, terrain types, ski lessons, backcountry tours, après-ski bars.
- Build other activities (meals, evening plans) around the theme, not in competition with it.

PRE-EXISTING DETAILS:
- If the user mentioned pre-planned activities, treat those as CONFIRMED and build around them. Do not replace or contradict them.
- If critical information is missing (no dates, no destination), return: {"needsMoreInfo": true, "questions": ["What dates are you traveling?", "Where are you going?"]}

COST REALISM RULES:
- If the user provided a home city AND flights are being included, use it for realistic flight routing and cost estimates. If no home city was provided or flights were excluded, skip all flight cost estimates.
- For ALL cost estimates, base them on realistic market rates for the destination:
  - Hotels: use typical nightly rates for the destination and budget tier
  - Meals: use typical restaurant prices for the destination city (Tokyo ≠ Bali ≠ Paris)
  - Activities: use typical admission/tour prices for the specific destination
  - Transport: use typical taxi/transit costs for the destination city
- When uncertain about a specific price, estimate conservatively (slightly high) and round to nearest $5 or $10.

ACTIVITY GRANULARITY:
- Do NOT suggest individual transportation between activities (no "Uber to restaurant", "Walk to park", "Taxi to hotel"). Users know how to get around.
- Each block should be a meaningful activity, meal, or experience — not logistics.
- Target 4-6 meaningful blocks per day (excluding accommodation), not 8-10 granular ones.
- For transit between cities, one transport block is enough (e.g., "Train to Barcelona") — don't add "Uber to station" + "Train" + "Uber from station" as 3 separate blocks.
- Free time is fine — leave gaps between blocks rather than filling every hour.

Rules:
- block category: "transport" | "activity" | "meal" | "free" | "accommodation"
- actionItem category: "flights" | "hotels" | "restaurants" | "tickets" | "packing"
- packingList category: "clothing" | "gear" | "toiletries" | "electronics" | "documents" | "misc"
- Unique IDs: "block-X-Y", "action-X", or "pack-X"
- Include realistic travel time between locations
- Cost per person in USD
- 6-10 blocks per day including meals and free time
- Each day should have exactly ONE accommodation block (see ACCOMMODATION RULES above for title and cost logic).
- Respect the budget tier preferences. If a per-person budget cap is given, target approximately 85% of that cap for your planned costs.
- Be opinionated about recommendations — pick the best options, don't hedge
- Generate 15-30 packing items based on: destination climate/weather for the travel dates, planned activities, location-specific needs, and trip duration. Each packing item should have a brief "reason".
- Generate 5-10 local tips covering: tipping customs, typical prices, greetings with phonetic pronunciation, cultural etiquette, common scams, useful local phrases, transportation tips. Each local tip should have an emoji, short title, and detailed explanation.

MULTI-CITY TRIPS:
- If the destination contains "→" (e.g., "Tokyo → Kyoto → Osaka"), it is a multi-city trip.
- Split the trip duration logically across cities based on the number of cities and total days.
- Include transport blocks between cities (bullet train, flight, bus, etc.) with realistic travel times and costs.
- CRITICAL: Each city MUST have a DIFFERENT hotel. E.g., Paris → "Hotel Le Marais Paris", Barcelona → "Hotel Arts Barcelona", Rome → "Hotel de Russie Rome". Never reuse the same hotel name across cities.
- Keep all activities on a given day in the same city — no visiting Tokyo attractions on a Kyoto day.
- The "destination" field in the response should list the primary city or use "Multi-city: City1, City2, City3".

PRE-EXISTING BOOKINGS:
- When the user has pre-existing plans/bookings, integrate them into the itinerary as REAL BLOCKS on the CORRECT DAY.
- If the user says "dinner at Hattie B's Friday at 7pm", there MUST be a block on Friday with title containing "Hattie B's" and startTime "19:00".
- If the user says "bar crawl Saturday night", there MUST be a block on Saturday with "bar crawl" in the title.
- If the user says "golf at Gaylord Springs Sunday morning", there MUST be a block on Sunday with "Gaylord Springs" or "golf" in the title.
- Build the rest of the itinerary AROUND those bookings — fill in the gaps with complementary activities.
- Treat named lodging as CONFIRMED — use their exact accommodation, don't substitute with a hotel.
- Treat named activities as CONFIRMED — schedule them at the specified time and build around them.
- Fill remaining slots with suggestions that COMPLEMENT what they've planned.
- If they said "I want to do X as much as possible", that's the THEME of the trip — most suggestions should align with X.

QUALITY ASSURANCE — FINAL REVIEW:
Before returning the JSON, mentally review the COMPLETE itinerary for these logical issues:
- FLIGHTS: If the prompt says "do NOT include flights", search the entire JSON for any block with "flight" or "airport" in the title — if found, DELETE IT. Also ensure budget.categories.flights is 0.
- ACCOMMODATION: If user specified their own lodging (friend's house, Airbnb, camping), search every accommodation block title — if ANY contains "hotel", "inn", "resort", "motel", replace it with the user's stated lodging. For multi-city trips, verify each city has a DIFFERENT hotel name.
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
