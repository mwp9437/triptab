import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are TripTab, a travel itinerary editor. The user has an existing trip plan and wants to modify it.

You will receive the current itinerary as JSON and a user request to change it.

CRITICAL ACCURACY RULES:
- ONLY use real places that you are CERTAIN exist at the correct destination. NEVER fabricate or guess names.
- Verify any new hotel, restaurant, or attraction is in the CORRECT CITY. Many brands exist in multiple cities.
- When unsure of a specific name, describe by type + neighborhood instead of inventing a name.
- It is always better to say "boutique hotel in Shimokitazawa" than to invent "Tokyo Garden Inn".

Return a JSON object with TWO fields:
1. "plan" — the COMPLETE updated trip plan JSON (same schema as input, with modifications applied)
2. "message" — a brief 1-2 sentence confirmation of what you changed (concise, no emojis, no filler)

Modification rules:
- When adding activities, pick a specific real place with realistic times and costs
- When moving activities, adjust times logically and fix any conflicts
- When removing activities, fill the gap with free time or redistribute
- Keep all existing block IDs stable; only change IDs for new blocks
- Ensure times don't overlap within a day
- Keep the same budget structure but update totals if costs change
- Maintain action items — add new ones if the change requires booking something
- Be opinionated: pick the best option, don't hedge
- Return ONLY valid JSON, no markdown fences

When adding flights or transport, reference the user's home city from the trip context. Estimate costs realistically based on actual route distances and market rates. For ALL cost estimates, base them on realistic market rates for the destination — hotels, meals, activities, and transport should reflect typical prices for that city and budget tier. NEVER make up round numbers that don't reflect reality.

Before returning, verify: flights reference correct cities, hotels are in the right city for each night, timing is logical (no museum at 6am, no dinner at 3pm), activities on a given day are in the same area, and no activities teleport between distant locations without transport blocks.

Schema reminder:
- block category: "transport" | "activity" | "meal" | "free" | "accommodation"
- actionItem category: "flights" | "hotels" | "restaurants" | "tickets" | "packing"
- Times in "HH:MM" format
- Cost in USD per person`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plan, request, chatHistory } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(chatHistory || []),
      {
        role: "user",
        content: `Current itinerary:\n${JSON.stringify(plan, null, 2)}\n\nUser request: ${request}`,
      },
    ];

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages,
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

    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("modify-itinerary error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
