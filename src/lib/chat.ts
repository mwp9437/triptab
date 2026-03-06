import { TripIntake } from "@/types/intake";
import { TripPlan, TimeBlock } from "@/types/itinerary";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function streamChat(
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: () => void
) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Chat error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {
          // skip invalid JSON
        }
      }
    }
  }
  onDone();
}

export async function generateFromIntake(intake: TripIntake): Promise<TripPlan> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-itinerary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ intake }),
  });

  if (!response.ok) {
    throw new Error(`Generate error: ${response.status}`);
  }

  return response.json();
}

export async function suggestActivities(
  messages: { role: string; content: string }[],
  request: string
): Promise<{ suggestions: any[]; followUp: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/suggest-activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ messages, request }),
  });

  if (!response.ok) {
    throw new Error(`Suggest error: ${response.status}`);
  }

  return response.json();
}

export async function modifyItinerary(
  plan: any,
  request: string,
  chatHistory?: { role: string; content: string }[]
): Promise<{ plan: any; message: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/modify-itinerary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ plan, request, chatHistory }),
  });

  if (!response.ok) {
    throw new Error(`Modify error: ${response.status}`);
  }

  return response.json();
}

export function createMessageId(): string {
  return crypto.randomUUID();
}
