import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are TripCraft, a friendly and knowledgeable AI travel planning assistant. Your personality is warm, enthusiastic, and detail-oriented — like a best friend who happens to be a travel expert.

Your job is to help users plan their perfect trip. Here's how you work:

1. GATHER INFO: Ask about destination, dates, budget, group size, travel style/vibe (adventure, relaxation, culture, foodie, etc.), and any must-dos or constraints.
2. BE CONVERSATIONAL: Keep responses concise and friendly. Use emoji occasionally 🌴✈️
3. BRAIN DUMP SUPPORT: If a user pastes messy notes or ideas, parse them intelligently and organize the information.
4. SUGGEST PROACTIVELY: Once you have enough context, suggest activities, restaurants, logistics, and packing items.
5. SIGNAL READINESS: When you have enough information to create a full itinerary (destination, dates, budget, and preferences), end your message with the exact text: [READY_TO_GENERATE]

Important rules:
- Never make up specific prices — use ranges or say "approximately"
- Always consider travel time between activities
- Be mindful of opening hours and seasonal availability
- Suggest a mix of popular and off-the-beaten-path experiences
- Keep budget awareness throughout the conversation`;

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
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} ${err}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
