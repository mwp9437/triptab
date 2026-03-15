import { describe, it, expect } from "vitest";
import { TripIntake, BUDGET_LABELS, BudgetTier } from "@/types/intake";

// ── Reproduce buildPromptFromIntake locally ──────────────────────────────────
// This mirrors supabase/functions/generate-itinerary/index.ts exactly
// so we can test prompt construction without calling the edge function.

const EDGE_BUDGET_LABELS: Record<number, Record<string, string>> = {
  1: { accommodation: "Hostel/budget", meals: "Street food/casual", activities: "Free/cheap", transportation: "Public transit" },
  2: { accommodation: "Mid-range", meals: "Sit-down casual", activities: "Moderate", transportation: "Rideshare" },
  3: { accommodation: "Boutique/4-star", meals: "Upscale", activities: "Premium", transportation: "Private car" },
  4: { accommodation: "Luxury/5-star", meals: "Fine dining", activities: "VIP/private", transportation: "Luxury/charter" },
};

function buildPromptFromIntake(intake: TripIntake): string {
  const b = intake.budget || {};
  const totalBudget = b.totalBudget
    ? `\nBudget cap: $${b.totalBudget} USD per person for the entire trip. Target ~85% of this cap ($${Math.round(b.totalBudget * 0.85)}) to leave a buffer for spontaneous spending.`
    : "";

  const destinations = intake.destinations?.length ? intake.destinations : [intake.destination?.trim()].filter(Boolean);
  const dest = destinations.length > 1
    ? destinations.join(" → ")
    : destinations[0] || "a surprise destination (pick an exciting, well-suited destination based on the traveler preferences, dates, and budget)";

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

  const transportLine = intake.needsFlights && intake.homeCity?.trim()
    ? `Departing from: ${intake.homeCity.trim()}. Flight preferences: departure ${intake.flightPreferences?.departureTime || "no preference"}, return ${intake.flightPreferences?.returnTime || "no preference"}, max connections: ${intake.flightPreferences?.maxConnections ?? "any"}, preferred airline: ${intake.flightPreferences?.preferredAirline || "none"}.`
    : "Transportation to destination: not specified by user — do NOT include flights.";
  const carLine = intake.needsCarRental ? "\nUser needs a rental car — include a car rental action item." : "";

  return `Plan a trip to ${dest} from ${intake.startDate} to ${intake.endDate} for ${intake.travelerCount} ${intake.travelerType || "couple"} travelers.
${transportLine}${carLine}

Budget preferences:
- Accommodation: ${EDGE_BUDGET_LABELS[b.accommodation]?.accommodation || "mid-range"}
- Meals: ${EDGE_BUDGET_LABELS[b.meals]?.meals || "casual"}
- Activities: ${EDGE_BUDGET_LABELS[b.activities]?.activities || "moderate"}
- Transportation: ${EDGE_BUDGET_LABELS[b.transportation]?.transportation || "rideshare"}${totalBudget}

Trip vibes: ${(intake.vibes || []).join(", ") || "general sightseeing"}
Dietary: ${(intake.dietary || []).join(", ") || "no restrictions"}
Mobility: ${intake.mobility || "no limitations"}
${intake.mustDos ? `Must-do: ${intake.mustDos}` : ""}
${intake.avoids ? `Avoid: ${intake.avoids}` : ""}
${intake.childAges?.length ? `Children ages: ${intake.childAges.join(", ")}` : ""}${preExisting}

Generate the complete trip plan.`;
}

const baseIntake: TripIntake = {
  initialIdea: "Beach vacation",
  homeCity: "New York",
  destination: "Cancun",
  startDate: "2026-04-01",
  endDate: "2026-04-05",
  travelerType: "couple",
  travelerCount: 2,
  childAges: [],
  budget: { accommodation: 2, meals: 2, activities: 2, transportation: 2 },
  vibes: ["Relaxation"],
  dietary: [],
  mobility: "none",
  mustDos: "",
  avoids: "",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("1. Pre-existing details in prompt", () => {
  it("includes pre-existing text and date reference when preExistingDetails is set", () => {
    const intake: TripIntake = {
      ...baseIntake,
      preExistingDetails: "We already booked a hotel at the Ritz for the first 2 nights. Dinner at Nobu on Wednesday.",
    };

    const prompt = buildPromptFromIntake(intake);

    expect(prompt).toContain("IMPORTANT — The traveler already has these plans/bookings");
    expect(prompt).toContain("Ritz for the first 2 nights");
    expect(prompt).toContain("Dinner at Nobu on Wednesday");
    expect(prompt).toContain("Date reference:");
    // Wed Apr 1 2026 is actually a Wednesday
    expect(prompt).toContain("Wednesday = 2026-04-01");
  });

  it("omits pre-existing section when preExistingDetails is not set", () => {
    const prompt = buildPromptFromIntake(baseIntake);
    expect(prompt).not.toContain("IMPORTANT — The traveler already has these plans");
    expect(prompt).not.toContain("Date reference:");
  });
});

describe("2. needsFlights=false → prompt says do NOT include flights", () => {
  it("explicitly says do NOT include flights when needsFlights is false", () => {
    const intake: TripIntake = { ...baseIntake, needsFlights: false };
    const prompt = buildPromptFromIntake(intake);

    expect(prompt).toContain("do NOT include flights");
    expect(prompt).not.toContain("Departing from:");
  });

  it("also says do NOT include flights when needsFlights is undefined", () => {
    const intake: TripIntake = { ...baseIntake };
    delete (intake as any).needsFlights;
    const prompt = buildPromptFromIntake(intake);

    expect(prompt).toContain("do NOT include flights");
  });
});

describe("3. needsFlights=true with homeCity → includes departure and flight prefs", () => {
  it("includes departure city and flight preferences", () => {
    const intake: TripIntake = {
      ...baseIntake,
      needsFlights: true,
      homeCity: "Chicago",
      flightPreferences: {
        departureTime: "morning",
        returnTime: "evening",
        maxConnections: 1,
        preferredAirline: "United",
      },
    };

    const prompt = buildPromptFromIntake(intake);

    expect(prompt).toContain("Departing from: Chicago");
    expect(prompt).toContain("departure morning");
    expect(prompt).toContain("return evening");
    expect(prompt).toContain("max connections: 1");
    expect(prompt).toContain("preferred airline: United");
    expect(prompt).not.toContain("do NOT include flights");
  });

  it("uses defaults when flight preferences are partial", () => {
    const intake: TripIntake = {
      ...baseIntake,
      needsFlights: true,
      homeCity: "Denver",
    };

    const prompt = buildPromptFromIntake(intake);

    expect(prompt).toContain("Departing from: Denver");
    expect(prompt).toContain("departure no preference");
    expect(prompt).toContain("return no preference");
    expect(prompt).toContain("max connections: any");
    expect(prompt).toContain("preferred airline: none");
  });

  it("needsFlights=true but empty homeCity falls back to no flights", () => {
    const intake: TripIntake = { ...baseIntake, needsFlights: true, homeCity: "" };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("do NOT include flights");
  });
});

describe("4. Multi-city destinations → joined with arrow", () => {
  it("joins multiple destinations with →", () => {
    const intake: TripIntake = {
      ...baseIntake,
      destinations: ["Tokyo", "Kyoto", "Osaka"],
    };

    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Plan a trip to Tokyo → Kyoto → Osaka");
  });

  it("single destination in array uses it directly", () => {
    const intake: TripIntake = { ...baseIntake, destinations: ["Barcelona"] };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Plan a trip to Barcelona");
    expect(prompt).not.toContain("→");
  });

  it("empty destinations array falls back to destination field", () => {
    const intake: TripIntake = { ...baseIntake, destinations: [], destination: "Paris" };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Plan a trip to Paris");
  });

  it("no destination at all uses surprise fallback", () => {
    const intake: TripIntake = { ...baseIntake, destination: "", destinations: [] };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("a surprise destination");
  });
});

describe("5. Simplified budget tiers map correctly to prompt text", () => {
  it("tier 1 ($) maps to budget labels", () => {
    const intake: TripIntake = {
      ...baseIntake,
      budget: { accommodation: 1, meals: 1, activities: 1, transportation: 1 },
    };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Hostel/budget");
    expect(prompt).toContain("Street food/casual");
    expect(prompt).toContain("Free/cheap");
    expect(prompt).toContain("Public transit");
  });

  it("tier 4 ($$$$) maps to luxury labels", () => {
    const intake: TripIntake = {
      ...baseIntake,
      budget: { accommodation: 4, meals: 4, activities: 4, transportation: 4 },
    };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Luxury/5-star");
    expect(prompt).toContain("Fine dining");
    expect(prompt).toContain("VIP/private");
    expect(prompt).toContain("Luxury/charter");
  });

  it("mixed tiers work correctly", () => {
    const intake: TripIntake = {
      ...baseIntake,
      budget: { accommodation: 3, meals: 1, activities: 2, transportation: 4 },
    };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Boutique/4-star");
    expect(prompt).toContain("Street food/casual");
    expect(prompt).toContain("Moderate");
    expect(prompt).toContain("Luxury/charter");
  });

  it("totalBudget cap included when provided", () => {
    const intake: TripIntake = {
      ...baseIntake,
      budget: { accommodation: 2, meals: 2, activities: 2, transportation: 2, totalBudget: 3000 },
    };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("Budget cap: $3000 USD per person");
    expect(prompt).toContain("Target ~85% of this cap ($2550)");
  });

  it("no totalBudget cap → no budget cap line", () => {
    const prompt = buildPromptFromIntake(baseIntake);
    expect(prompt).not.toContain("Budget cap:");
  });
});

describe("Car rental in prompt", () => {
  it("includes car rental action item when needsCarRental is true", () => {
    const intake: TripIntake = { ...baseIntake, needsCarRental: true };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).toContain("User needs a rental car");
    expect(prompt).toContain("car rental action item");
  });

  it("omits car rental when needsCarRental is false", () => {
    const intake: TripIntake = { ...baseIntake, needsCarRental: false };
    const prompt = buildPromptFromIntake(intake);
    expect(prompt).not.toContain("rental car");
  });
});

describe("BUDGET_LABELS constant consistency", () => {
  it("frontend BUDGET_LABELS matches edge function labels for all tiers", () => {
    // Verify the frontend constant matches what the edge function uses
    for (const tier of [1, 2, 3, 4] as BudgetTier[]) {
      expect(BUDGET_LABELS[tier].accommodation).toBe(EDGE_BUDGET_LABELS[tier].accommodation);
      expect(BUDGET_LABELS[tier].meals).toBe(EDGE_BUDGET_LABELS[tier].meals);
      expect(BUDGET_LABELS[tier].activities).toBe(EDGE_BUDGET_LABELS[tier].activities);
      expect(BUDGET_LABELS[tier].transportation).toBe(EDGE_BUDGET_LABELS[tier].transportation);
    }
  });
});
