import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are TripTab, a travel concierge. Given a selected activity/hotel/restaurant/transport from an itinerary, return alternatives of the SAME type in the same area.

CRITICAL ACCURACY RULES:
- ONLY suggest places you are CERTAIN exist at the correct location. NEVER invent or fabricate place names.
- Verify each suggestion exists in the CORRECT CITY. Many brands/names exist in multiple cities — confirm the specific property/location.
- For hotels: prefer well-known chains or widely documented local properties. Include the city in the name (e.g., "Hilton Sapporo" not just "Hilton").
- For restaurants: prefer well-known establishments, food markets, or describe by cuisine type + neighborhood if unsure of specific names.
- For attractions: only use real, verifiable landmarks. When unsure, describe by type + area.
- It is ALWAYS better to say "highly-rated sushi restaurant in Tanukikoji" than to invent "Sapporo Sushi Palace".

Return ONLY valid JSON matching this schema:
{
  "details": {
    "description": "2-3 sentence description of the selected place",
    "highlights": ["highlight 1", "highlight 2", "highlight 3"],
    "tip": "One insider tip (optional)"
  },
  "alternatives": [
    {
      "id": "alt-1",
      "title": "Place Name",
      "description": "One sentence description",
      "location": "Address or area",
      "cost": 45,
      "priceTier": "$$",
      "imageQuery": "search query for a representative photo of this place",
      "rating": 4.5,
      "category": "accommodation"
    }
  ]
}

Rules:
- Return 4-6 alternatives
- Same category as the original (hotel→hotels, restaurant→restaurants, activity→activities)
- Include a mix of price points — some cheaper, some comparable, maybe one upgrade
- imageQuery should be specific enough to find a real photo (e.g. "Park Hyatt Tokyo exterior" not just "hotel")
- priceTier: "$", "$$", "$$$", "$$$$"
- rating: 1-5 scale, realistic
- cost: per person per unit (per night for hotels, per meal for restaurants, per session for activities)
- Be opinionated — mention what makes each option distinct
- Return ONLY JSON, no markdown fences`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { block, tripContext } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Selected item from itinerary:
- Title: ${block.title}
- Category: ${block.category}
- Location: ${block.location || "not specified"}
- Time: ${block.startTime} - ${block.endTime}
- Cost: $${block.cost || "unknown"}
- Notes: ${block.notes || "none"}

Trip context: ${tripContext}

Provide detailed info about this place and suggest 4-6 alternatives of the same type nearby.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("block-alternatives error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
