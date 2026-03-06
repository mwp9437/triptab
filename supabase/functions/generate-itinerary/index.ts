import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a travel itinerary generator. Based on the conversation, create a detailed trip plan as JSON.

Return ONLY valid JSON matching this exact schema:
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
          "id": "unique-id",
          "startTime": "09:00",
          "endTime": "10:30",
          "title": "Activity Name",
          "location": "Address or area",
          "cost": 25,
          "category": "activity",
          "notes": "Optional tips"
        }
      ]
    }
  ],
  "actionItems": [
    {
      "id": "unique-id",
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
  }
}

Rules:
- category for blocks must be one of: "transport", "activity", "meal", "free", "accommodation"
- category for actionItems must be one of: "flights", "hotels", "restaurants", "tickets", "packing"
- Generate unique IDs for each block and action item using format "block-X-Y" or "action-X"
- Include realistic time estimates with travel time between locations
- Cost should be per person in USD
- Create a balanced day with 6-10 blocks including meals and free time
- Return ONLY the JSON, no markdown or explanation`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
      {
        role: "user",
        content: "Now generate the complete trip plan JSON based on our conversation. Return ONLY the JSON.",
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: fullMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response (handle possible markdown wrapping)
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
