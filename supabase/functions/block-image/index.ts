import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageQuery, category } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    if (!imageQuery) throw new Error("imageQuery is required");

    const categoryHints: Record<string, string> = {
      accommodation: "professional hotel photography, interior or exterior, architectural, warm lighting, luxury hospitality style",
      meal: "professional food photography, restaurant ambiance, appetizing plating, warm tones",
      activity: "travel photography, vibrant colors, scenic, editorial quality",
      transport: "travel photography, transportation, clean composition",
      free: "scenic travel photography, atmospheric, wanderlust aesthetic",
    };

    const styleHint = categoryHints[category] || categoryHints.activity;

    const prompt = `Generate a beautiful, realistic travel photograph: ${imageQuery}. Style: ${styleHint}. The photo should look like it was taken by a professional travel photographer — natural lighting, sharp focus, vivid but not oversaturated colors. NO text, NO watermarks, NO borders.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini image API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart) {
      throw new Error("No image generated");
    }

    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("block-image error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
