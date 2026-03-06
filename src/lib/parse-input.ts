import { TripIntake, DEFAULT_INTAKE, BudgetTier } from "@/types/intake";

export function parseInitialInput(text: string): Partial<TripIntake> {
  const result: Partial<TripIntake> = { initialIdea: text };

  // Extract dates (formats: 3/16-3/22, March 16-22, 2025-03-16)
  const dateRangeMatch = text.match(
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*[-–to]+\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );
  if (dateRangeMatch) {
    const parseShortDate = (d: string) => {
      const parts = d.split("/");
      const month = parts[0].padStart(2, "0");
      const day = parts[1].padStart(2, "0");
      const year = parts[2] || new Date().getFullYear().toString();
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${month}-${day}`;
    };
    result.startDate = parseShortDate(dateRangeMatch[1]);
    result.endDate = parseShortDate(dateRangeMatch[2]);
  }

  // Extract traveler count
  const countMatch = text.match(/(\d+)\s*(?:people|person|travelers|travellers|pax)/i);
  if (countMatch) {
    result.travelerCount = parseInt(countMatch[1]);
  }

  // Extract traveler type
  if (/\b(?:solo|alone|by myself)\b/i.test(text)) {
    result.travelerType = "solo";
    result.travelerCount = 1;
  } else if (/\b(?:couple|partner|honeymoon|romantic|for 2)\b/i.test(text)) {
    result.travelerType = "couple";
    result.travelerCount = 2;
  } else if (/\b(?:family|kids|children)\b/i.test(text)) {
    result.travelerType = "family";
  } else if (/\b(?:friends|group|crew|squad)\b/i.test(text)) {
    result.travelerType = "friends";
  }

  // Extract budget hints
  if (/\b(?:budget|cheap|backpack|hostel)\b/i.test(text)) {
    result.budget = { accommodation: 1, meals: 1, activities: 1, transportation: 1 };
  } else if (/\b(?:mid-?range|moderate|reasonable)\b/i.test(text)) {
    result.budget = { accommodation: 2, meals: 2, activities: 2, transportation: 2 };
  } else if (/\b(?:luxury|splurge|high-end|5.?star)\b/i.test(text)) {
    result.budget = { accommodation: 4, meals: 4, activities: 4, transportation: 4 };
  }

  // Extract destination — use everything that isn't date/count/budget info
  // Simple approach: strip matched patterns and use remaining text
  let dest = text
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*[-–to]+\s*\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi, "")
    .replace(/\d+\s*(?:people|person|travelers|pax)/gi, "")
    .replace(/\b(?:budget|cheap|mid-?range|luxury|splurge|high-end)\b/gi, "")
    .replace(/\b(?:solo|couple|family|friends|for 2)\b/gi, "")
    .replace(/\b(?:trip|vacation|getaway|holiday|travel)\b/gi, "")
    .replace(/\b(?:plan|planning|want|looking|going)\b/gi, "")
    .replace(/\b(?:to|in|at|for|with|a|an|the|my|our)\b/gi, "")
    .replace(/[🏖️🏔️🍕🎌✈️🌴]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (dest.length > 2) {
    result.destination = dest.charAt(0).toUpperCase() + dest.slice(1);
  }

  // Extract vibes
  const vibes: string[] = [];
  if (/\b(?:beach|relax|spa|chill)\b/i.test(text)) vibes.push("Relaxation");
  if (/\b(?:adventure|hike|trek|climb|ski|surf)\b/i.test(text)) vibes.push("Adventure");
  if (/\b(?:culture|museum|temple|history|heritage)\b/i.test(text)) vibes.push("Cultural");
  if (/\b(?:food|foodie|eat|cuisine|restaurant|culinary)\b/i.test(text)) vibes.push("Foodie");
  if (/\b(?:nightlife|party|club|bar)\b/i.test(text)) vibes.push("Nightlife");
  if (/\b(?:romantic|romance|honeymoon)\b/i.test(text)) vibes.push("Romance");
  if (vibes.length > 0) result.vibes = vibes;

  return result;
}

export function createEmptyIntake(): TripIntake {
  return { ...DEFAULT_INTAKE };
}
