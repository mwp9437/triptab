import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a travel concierge suggesting specific activities. Be opinionated — recommend what's genuinely best, not just popular. Consider proximity, pacing, budget, and group fit. Keep follow-up messages to one sentence.

CRITICAL ACCURACY RULES:
- ONLY suggest real places that you are CERTAIN exist at the correct destination. NEVER fabricate or guess names.
- Verify each suggestion is in the CORRECT CITY. A restaurant or hotel that exists in Tokyo does NOT exist in Kyoto unless you're certain.
- When unsure of a specific place name, describe by type + neighborhood (e.g., "traditional kaiseki restaurant near Gion") rather than inventing a name.
- For hotels, prefer well-known chains or widely documented local properties.
- It is always better to be vague and correct than specific and wrong.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, request } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(messages || []),
      { role: "user", content: request },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_activities",
          description: "Return 3-5 activity suggestions matching the user's request.",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    category: { type: "string", enum: ["transport", "activity", "meal", "free", "accommodation"] },
                    description: { type: "string", description: "One sentence describing what makes this option stand out" },
                    rating: { type: "number" },
                    priceTier: { type: "number", enum: [1, 2, 3, 4] },
                    estimatedCost: { type: "number", description: "Cost per person in USD" },
                    startTime: { type: "string", description: "HH:MM format" },
                    endTime: { type: "string", description: "HH:MM format" },
                    location: { type: "string" },
                    distance: { type: "string", description: "Distance from hotel or other day activities" },
                  },
                  required: ["id", "title", "category", "description", "priceTier", "estimatedCost", "startTime", "endTime", "location"],
                  additionalProperties: false,
                },
              },
              followUp: { type: "string", description: "One-sentence proactive follow-up question or suggestion" },
            },
            required: ["suggestions", "followUp"],
            additionalProperties: false,
          },
        },
      },
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
        tools,
        tool_choice: { type: "function", function: { name: "suggest_activities" } },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ suggestions: [], followUp: "I couldn't find specific options. Could you be more specific?" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("suggest-activities error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
