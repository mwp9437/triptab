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
  const totalBudget = b.totalBudget ? `\nBudget cap: $${b.totalBudget} USD per person for the entire trip.` : "";
  const dest = intake.destination?.trim() || "a surprise destination (pick an exciting, well-suited destination based on the traveler preferences, dates, and budget)";
  return `Plan a trip to ${dest} from ${intake.startDate} to ${intake.endDate} for ${intake.travelerCount} ${intake.travelerType} travelers.

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

Rules:
- block category: "transport" | "activity" | "meal" | "free" | "accommodation"
- actionItem category: "flights" | "hotels" | "restaurants" | "tickets" | "packing"
- packingList category: "clothing" | "gear" | "toiletries" | "electronics" | "documents" | "misc"
- Unique IDs: "block-X-Y", "action-X", or "pack-X"
- Include realistic travel time between locations
- IMPORTANT: Day 1 MUST start with an arrival flight block (category "transport") and the last day MUST end with a departure flight block (category "transport"). Include realistic flight times and airline suggestions.
- Cost per person in USD
- 6-10 blocks per day including meals and free time
- IMPORTANT: Every day MUST include an accommodation block (category "accommodation") showing the hotel/lodging for that night
- Respect the budget tier preferences. If a per-person budget cap is given, keep all estimated costs per person under that cap.
- Be opinionated about recommendations — pick the best options, don't hedge
- Generate 15-30 packing items based on: destination climate/weather for the travel dates, planned activities (hiking gear, swimwear, formal wear etc.), location-specific needs (adapters, sunscreen, mosquito repellent etc.), and trip duration
- Each packing item should have a brief "reason" explaining why it's needed
- Generate 5-10 local tips covering: tipping customs, typical prices (beer, coffee, meal), greetings & how to say hello/thank you/goodbye with phonetic pronunciation, cultural etiquette (bowing, handshakes, cheek kisses), common scams to avoid, useful local phrases, transportation tips, and any unique local customs travelers should know
- Each local tip should have an appropriate emoji, a short title, and a detailed explanation
- Return ONLY JSON, no markdown`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
