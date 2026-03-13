/**
 * Backend scenario tests — calls Gemini API directly with the same
 * system prompt and buildPromptFromIntake logic as the edge function.
 * No deployment needed — tests prompt quality against live Gemini.
 *
 * Usage:
 *   npx tsx e2e/test-backend-scenarios.ts
 *
 * Requires GEMINI_API_KEY in .env
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

// ── Replicate edge function logic locally ────────────────────────────────────

// Read the SYSTEM_PROMPT and buildPromptFromIntake directly from the edge function source
// to ensure we're testing the exact same prompt.

const edgeFnSource = readFileSync(
  resolve(__dirname, "../supabase/functions/generate-itinerary/index.ts"),
  "utf-8"
);

// Extract SYSTEM_PROMPT (between backtick after "const SYSTEM_PROMPT = `" and the closing backtick+";")
const systemPromptMatch = edgeFnSource.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!systemPromptMatch) {
  console.error("Could not extract SYSTEM_PROMPT from edge function source");
  process.exit(1);
}
const SYSTEM_PROMPT = systemPromptMatch[1];

// Replicate BUDGET_LABELS and buildPromptFromIntake
const BUDGET_LABELS: Record<number, Record<string, string>> = {
  1: { accommodation: "Hostel/budget", meals: "Street food/casual", activities: "Free/cheap", transportation: "Public transit" },
  2: { accommodation: "Mid-range", meals: "Sit-down casual", activities: "Moderate", transportation: "Rideshare" },
  3: { accommodation: "Boutique/4-star", meals: "Upscale", activities: "Premium", transportation: "Private car" },
  4: { accommodation: "Luxury/5-star", meals: "Fine dining", activities: "VIP/private", transportation: "Luxury/charter" },
};

function buildPromptFromIntake(intake: any): string {
  const b = intake.budget || {};
  const totalBudget = b.totalBudget ? `\nBudget cap: $${b.totalBudget} USD per person for the entire trip. Target ~85% of this cap ($${Math.round(b.totalBudget * 0.85)}) to leave a buffer for spontaneous spending.` : "";

  const destinations = intake.destinations?.length ? intake.destinations : [intake.destination?.trim()].filter(Boolean);
  const dest = destinations.length > 1
    ? destinations.join(" → ")
    : destinations[0] || "a surprise destination (pick an exciting, well-suited destination based on the traveler preferences, dates, and budget)";

  const preExisting = intake.preExistingDetails
    ? `\n\nIMPORTANT — The traveler already has these plans/bookings. INCORPORATE them into the itinerary and build around them:\n${intake.preExistingDetails}`
    : "";

  const transportLine = intake.needsFlights && intake.homeCity?.trim()
    ? `Departing from: ${intake.homeCity.trim()}. Flight preferences: departure ${intake.flightPreferences?.departureTime || "no preference"}, return ${intake.flightPreferences?.returnTime || "no preference"}, max connections: ${intake.flightPreferences?.maxConnections ?? "any"}, preferred airline: ${intake.flightPreferences?.preferredAirline || "none"}.`
    : 'Transportation to destination: not specified by user — do NOT include flights.';
  const carLine = intake.needsCarRental ? '\nUser needs a rental car — include a car rental action item.' : '';

  return `Plan a trip to ${dest} from ${intake.startDate} to ${intake.endDate} for ${intake.travelerCount} ${intake.travelerType || "couple"} travelers.
${transportLine}${carLine}

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
${intake.childAges?.length ? `Children ages: ${intake.childAges.join(", ")}` : ""}${preExisting}

Generate the complete trip plan.`;
}

// ── Call Gemini directly ─────────────────────────────────────────────────────

async function callGeminiDirect(intake: any): Promise<any> {
  const userPrompt = buildPromptFromIntake(intake);

  console.log("   📝 User prompt preview (first 200 chars):", userPrompt.slice(0, 200).replace(/\n/g, " ") + "...");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  return JSON.parse(jsonStr);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Check {
  label: string;
  pass: boolean;
  detail?: string;
}

function check(label: string, pass: boolean, detail?: string): Check {
  return { label, pass, detail };
}

function allBlocks(plan: any) {
  return (plan.itinerary || []).flatMap((d: any) => d.blocks || []);
}

function blocksByCategory(plan: any, cat: string) {
  return allBlocks(plan).filter((b: any) => b.category === cat);
}

function printResults(name: string, checks: Check[]) {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"═".repeat(60)}`);
  for (const c of checks) {
    const icon = c.pass ? "✅" : "❌";
    console.log(`  ${icon} ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(`\n  Result: ${passed} passed, ${failed} failed`);
  return failed;
}

// ── Scenario 1: Ski trip, staying with friends, no flights ───────────────────

async function scenario1() {
  const intake = {
    destination: "Lake Tahoe, California",
    startDate: "2026-03-20",
    endDate: "2026-03-24",
    travelerCount: 4,
    travelerType: "friends",
    needsFlights: false,
    preExistingDetails:
      "Staying at my friend's house in Alpine Meadows. I want to ski as much as possible.",
    budget: { accommodation: 1, meals: 2, activities: 3, transportation: 1 },
    vibes: ["Adventure"],
    dietary: [],
    mobility: "none",
    mustDos: "Ski as much as possible",
    avoids: "",
    homeCity: "",
    initialIdea: "Lake Tahoe ski trip",
    childAges: [],
  };

  console.log("\n⏳ Generating Scenario 1 (Ski trip, no flights)...");
  const plan = await callGeminiDirect(intake);
  const checks: Check[] = [];

  // No flight blocks (tighter regex — "arrive" alone is too broad, catches "Arrive in Lake Tahoe")
  const flights = allBlocks(plan).filter(
    (b: any) =>
      b.category === "transport" &&
      /\bflight\b|fly\b|airport|depart.*flight|arrive.*flight/i.test(b.title + " " + (b.notes || ""))
  );
  checks.push(check("No flight blocks", flights.length === 0, `Found ${flights.length} flight blocks`));

  // Every day has accommodation
  const days = plan.itinerary || [];
  const daysWithAccom = days.filter((d: any) =>
    d.blocks.some((b: any) => b.category === "accommodation")
  );
  checks.push(
    check("Every day has accommodation", daysWithAccom.length === days.length, `${daysWithAccom.length}/${days.length} days`)
  );

  // Accommodation matches user input
  const accomBlocks = blocksByCategory(plan, "accommodation");
  const matchesUserInput = accomBlocks.every(
    (b: any) => /friend|alpine meadows/i.test(b.title)
  );
  checks.push(
    check(
      "Accommodation matches user input (friend/Alpine Meadows)",
      matchesUserInput,
      accomBlocks.map((b: any) => b.title).join(", ")
    )
  );

  // Accommodation cost is 0
  const accomCostZero = accomBlocks.every(
    (b: any) => b.cost === 0 || b.cost === null || b.cost === undefined
  );
  checks.push(check("Accommodation cost is $0", accomCostZero, accomBlocks.map((b: any) => `$${b.cost}`).join(", ")));

  // Accommodation is NOT a hotel chain
  const hotelKeywords = /hyatt|marriott|hilton|resort|inn|lodge|hotel|ritz|sheraton|westin/i;
  const notHotel = accomBlocks.every((b: any) => !hotelKeywords.test(b.title));
  checks.push(check("Accommodation is NOT a hotel", notHotel, accomBlocks.map((b: any) => b.title).join(", ")));

  // At least 70% ski-related activities
  const activities = blocksByCategory(plan, "activity");
  const skiRelated = activities.filter((b: any) =>
    /ski|snow|slope|mountain|lift|après|apres|powder|terrain|run|board|snowboard|gondola|chairlift/i.test(
      b.title + " " + (b.notes || "")
    )
  );
  const skiPct = activities.length > 0 ? skiRelated.length / activities.length : 0;
  checks.push(
    check(
      "≥70% activities are ski-related",
      skiPct >= 0.7,
      `${skiRelated.length}/${activities.length} (${Math.round(skiPct * 100)}%)`
    )
  );

  // No random departure city flights in budget
  const budgetCats = plan.budget?.categories || {};
  const noFlightBudget = !budgetCats.flights || budgetCats.flights === 0;
  checks.push(check("Budget does NOT include flight costs", noFlightBudget, `flights budget: $${budgetCats.flights || 0}`));

  return printResults("SCENARIO 1: Ski trip, friends' house, no flights", checks);
}

// ── Scenario 2: International trip with flights from NYC ─────────────────────

async function scenario2() {
  const intake = {
    destination: "Tokyo, Japan",
    startDate: "2026-04-01",
    endDate: "2026-04-10",
    travelerCount: 2,
    travelerType: "couple",
    homeCity: "New York, USA",
    needsFlights: true,
    flightPreferences: { departureTime: "evening", maxConnections: 1 },
    budget: { accommodation: 3, meals: 3, activities: 2, transportation: 2 },
    vibes: ["Cultural", "Foodie"],
    dietary: [],
    mobility: "none",
    mustDos: "",
    avoids: "",
    initialIdea: "Tokyo trip",
    childAges: [],
  };

  console.log("\n⏳ Generating Scenario 2 (Tokyo from NYC with flights)...");
  const plan = await callGeminiDirect(intake);
  const checks: Check[] = [];

  const allB = allBlocks(plan);
  const transportBlocks = allB.filter((b: any) => b.category === "transport");

  // Day 1 has flight from NYC area
  const day1 = plan.itinerary?.[0];
  const day1Flights = (day1?.blocks || []).filter(
    (b: any) => b.category === "transport" && /flight|jfk|ewr|lga|new york|nyc/i.test(b.title + " " + (b.location || "") + " " + (b.notes || ""))
  );
  checks.push(check("Day 1 has flight from NYC area", day1Flights.length > 0, day1Flights.map((b: any) => b.title).join("; ") || "none"));

  // Last day has return flight
  const lastDay = plan.itinerary?.[plan.itinerary.length - 1];
  const returnFlights = (lastDay?.blocks || []).filter(
    (b: any) => b.category === "transport" && /flight|nrt|hnd|narita|haneda|new york|jfk|ewr/i.test(b.title + " " + (b.location || "") + " " + (b.notes || ""))
  );
  checks.push(check("Last day has return flight", returnFlights.length > 0, returnFlights.map((b: any) => b.title).join("; ") || "none"));

  // Flight cost realistic ($700-$2000 per one-way leg per person)
  const flightBlocks = transportBlocks.filter((b: any) => /flight|depart/i.test(b.title + " " + (b.notes || "")));
  const flightCosts = flightBlocks.map((b: any) => b.cost || 0).filter((c: number) => c > 0);
  const maxFlightCost = Math.max(...flightCosts, 0);
  // Also accept if budget.categories.flights / (travelers * 2 legs) is in range
  const budgetFlightCost = plan.budget?.categories?.flights || 0;
  const travelers = plan.travelers || 2;
  const perPersonOneLeg = budgetFlightCost > 0 ? budgetFlightCost / (travelers * 2) : 0;
  const effectiveFlightCost = Math.max(maxFlightCost, perPersonOneLeg);
  checks.push(
    check(
      "Flight cost $700-$2000/person/leg",
      effectiveFlightCost >= 700 && effectiveFlightCost <= 2000,
      `block max: $${maxFlightCost}, budget per-person-leg: $${Math.round(perPersonOneLeg)}`
    )
  );

  // Every day has accommodation
  const days = plan.itinerary || [];
  const daysWithAccom = days.filter((d: any) => d.blocks.some((b: any) => b.category === "accommodation"));
  checks.push(check("Every day has accommodation", daysWithAccom.length === days.length, `${daysWithAccom.length}/${days.length}`));

  // Hotels are in Tokyo (overnight flight days are OK with "overnight flight" / "in-flight" titles)
  const accom = blocksByCategory(plan, "accommodation");
  const overnightFlightRegex = /overnight|in.flight|no accommodation/i;
  const tokyoRegex = /tokyo|shinjuku|shibuya|ginza|roppongi|asakusa|akihabara|ueno|ikebukuro/i;
  const inTokyo = accom.every((b: any) => overnightFlightRegex.test(b.title) || tokyoRegex.test(b.title + " " + (b.location || "")));
  checks.push(check("Hotels are in Tokyo (or overnight flight)", inTokyo, accom.map((b: any) => `${b.title} @ ${b.location}`).join("; ")));

  // Cultural + food activities
  const activityBlocks = blocksByCategory(plan, "activity");
  const mealBlocks = blocksByCategory(plan, "meal");
  const cultural = activityBlocks.filter((b: any) => /temple|shrine|museum|garden|palace|cultural|traditional|kabuki|sumo/i.test(b.title + " " + (b.notes || "")));
  const foodie = mealBlocks.length + activityBlocks.filter((b: any) => /food|ramen|sushi|cook|tsukiji|market|izakaya/i.test(b.title + " " + (b.notes || ""))).length;
  checks.push(check("Has cultural activities", cultural.length >= 2, `Found ${cultural.length}`));
  checks.push(check("Has food-related activities", foodie >= 2, `Found ${foodie}`));

  // Packing list
  checks.push(check("Packing list has 10+ items", (plan.packingList || []).length >= 10, `${(plan.packingList || []).length} items`));

  // Local tips
  checks.push(check("Local tips has 3+ tips", (plan.localTips || []).length >= 3, `${(plan.localTips || []).length} tips`));

  return printResults("SCENARIO 2: Tokyo from NYC with flights", checks);
}

// ── Scenario 3: Bachelor party, everything pre-planned ───────────────────────

async function scenario3() {
  const intake = {
    destination: "Nashville, Tennessee",
    startDate: "2026-05-15",
    endDate: "2026-05-18",
    travelerCount: 8,
    travelerType: "friends",
    needsFlights: false,
    preExistingDetails:
      "Staying at an Airbnb on Broadway. Bar crawl Saturday night. Golf at Gaylord Springs Sunday morning. Dinner reservation at Hattie B's Friday at 7pm.",
    budget: { accommodation: 2, meals: 3, activities: 3, transportation: 2 },
    vibes: ["Nightlife", "Adventure"],
    dietary: [],
    mobility: "none",
    mustDos: "",
    avoids: "",
    homeCity: "",
    initialIdea: "Nashville bachelor party",
    childAges: [],
  };

  console.log("\n⏳ Generating Scenario 3 (Nashville bachelor party)...");
  const plan = await callGeminiDirect(intake);
  const checks: Check[] = [];

  // No flights
  const flights = allBlocks(plan).filter(
    (b: any) => b.category === "transport" && /flight|fly|airport/i.test(b.title + " " + (b.notes || ""))
  );
  checks.push(check("No flight blocks", flights.length === 0, `Found ${flights.length}`));

  // Every day has accommodation
  const days = plan.itinerary || [];
  const daysWithAccom = days.filter((d: any) => d.blocks.some((b: any) => b.category === "accommodation"));
  checks.push(check("Every day has accommodation", daysWithAccom.length === days.length, `${daysWithAccom.length}/${days.length}`));

  // Accommodation matches Airbnb/Broadway
  const accom = blocksByCategory(plan, "accommodation");
  const matchesAirbnb = accom.every((b: any) => /airbnb|broadway/i.test(b.title));
  checks.push(check("Accommodation mentions Airbnb/Broadway", matchesAirbnb, accom.map((b: any) => b.title).join(", ")));

  // Accommodation cost is 0 (user's Airbnb, not AI suggestion)
  const accomFree = accom.every((b: any) => b.cost === 0 || b.cost === null || b.cost === undefined);
  checks.push(check("Accommodation cost is $0", accomFree, accom.map((b: any) => `$${b.cost}`).join(", ")));

  // Friday (2026-05-15) has Hattie B's near 7pm
  const friday = days.find((d: any) => d.date === "2026-05-15");
  const hattieOnFriday = friday?.blocks.find((b: any) => /hattie/i.test(b.title));
  const hattieAnywhere = allBlocks(plan).find((b: any) => /hattie/i.test(b.title));
  const hattieBlock = hattieOnFriday || hattieAnywhere;
  checks.push(
    check(
      "Has Hattie B's (ideally Friday)",
      !!hattieBlock,
      hattieBlock ? `${hattieBlock.title} @ ${hattieBlock.startTime}${hattieOnFriday ? " (on Friday)" : " (wrong day)"}` : "not found anywhere"
    )
  );

  // Saturday (2026-05-16) has bar crawl
  const saturday = days.find((d: any) => d.date === "2026-05-16");
  const barCrawlOnSat = saturday?.blocks.find((b: any) => /bar crawl|bar.hop|honky.tonk|broadway.*bar|crawl/i.test(b.title + " " + (b.notes || "")));
  const barCrawlAnywhere = allBlocks(plan).find((b: any) => /bar crawl|bar.hop|honky.tonk|broadway.*bar|crawl/i.test(b.title + " " + (b.notes || "")));
  const barCrawlBlock = barCrawlOnSat || barCrawlAnywhere;
  checks.push(check("Has bar crawl (ideally Saturday)", !!barCrawlBlock, barCrawlBlock?.title || "not found anywhere"));

  // Sunday (2026-05-17) has golf / Gaylord Springs
  const sunday = days.find((d: any) => d.date === "2026-05-17");
  const golfOnSun = sunday?.blocks.find((b: any) => /golf|gaylord/i.test(b.title + " " + (b.location || "") + " " + (b.notes || "")));
  const golfAnywhere = allBlocks(plan).find((b: any) => /golf|gaylord/i.test(b.title + " " + (b.location || "") + " " + (b.notes || "")));
  const golfBlock = golfOnSun || golfAnywhere;
  checks.push(check("Has golf/Gaylord Springs (ideally Sunday)", !!golfBlock, golfBlock?.title || "not found anywhere"));

  // Nashville-appropriate activities (not museums in other cities)
  const allActs = blocksByCategory(plan, "activity").concat(blocksByCategory(plan, "meal"));
  const nashvilleThemed = allActs.filter((b: any) =>
    /nashville|broadway|honky|music|country|hot chicken|bbq|pedal|bar|brunch|whiskey|live music|grand ole/i.test(
      b.title + " " + (b.notes || "") + " " + (b.location || "")
    )
  );
  checks.push(
    check("Nashville-appropriate activities", nashvilleThemed.length >= 3, `${nashvilleThemed.length} Nashville-themed activities found`)
  );

  return printResults("SCENARIO 3: Nashville bachelor party, pre-planned", checks);
}

// ── Scenario 4: Multi-city Europe with flights ───────────────────────────────

async function scenario4() {
  const intake = {
    destination: "Paris, France",
    destinations: ["Paris, France", "Barcelona, Spain", "Rome, Italy"],
    startDate: "2026-06-01",
    endDate: "2026-06-12",
    travelerCount: 2,
    travelerType: "couple",
    homeCity: "Chicago, USA",
    needsFlights: true,
    budget: { accommodation: 3, meals: 3, activities: 2, transportation: 2 },
    vibes: ["Cultural", "Foodie", "Romance"],
    dietary: [],
    mobility: "none",
    mustDos: "",
    avoids: "",
    initialIdea: "Europe multi-city trip",
    childAges: [],
  };

  console.log("\n⏳ Generating Scenario 4 (Multi-city Europe from Chicago)...");
  const plan = await callGeminiDirect(intake);
  const checks: Check[] = [];

  const allB = allBlocks(plan);

  // Arrival flight from Chicago
  const day1 = plan.itinerary?.[0];
  const arrivalFlight = (day1?.blocks || []).find(
    (b: any) => b.category === "transport" && /flight|chicago|ord|mdw|paris|cdg|ory/i.test(b.title + " " + (b.location || "") + " " + (b.notes || ""))
  );
  checks.push(check("Arrival flight from Chicago to Paris", !!arrivalFlight, arrivalFlight?.title || "not found"));

  // Departure flight from Rome to Chicago
  const lastDay = plan.itinerary?.[plan.itinerary.length - 1];
  const departureFlight = (lastDay?.blocks || []).find(
    (b: any) => b.category === "transport" && /flight|rome|fco|chicago|ord/i.test(b.title + " " + (b.location || "") + " " + (b.notes || ""))
  );
  checks.push(check("Departure flight from Rome to Chicago", !!departureFlight, departureFlight?.title || "not found"));

  // Inter-city transport blocks
  const interCity = allB.filter(
    (b: any) => b.category === "transport" && /paris.*barcelona|barcelona.*rome|train|tgv|vueling|easyjet|ryanair/i.test(b.title + " " + (b.notes || ""))
  );
  checks.push(check("Has inter-city transport (Paris→BCN, BCN→Rome)", interCity.length >= 2, `Found ${interCity.length} inter-city blocks`));

  // Every day has accommodation
  const days = plan.itinerary || [];
  const daysWithAccom = days.filter((d: any) => d.blocks.some((b: any) => b.category === "accommodation"));
  checks.push(check("Every day has accommodation", daysWithAccom.length === days.length, `${daysWithAccom.length}/${days.length}`));

  // Hotel changes when city changes
  const accom = blocksByCategory(plan, "accommodation");
  const uniqueHotels = new Set(accom.map((b: any) => b.title.toLowerCase()));
  checks.push(check("Hotel changes across cities (≥3 unique)", uniqueHotels.size >= 3, `${uniqueHotels.size} unique: ${[...uniqueHotels].join(", ")}`));

  // Activities in correct cities (no Eiffel Tower on a Barcelona day)
  const parisKeywords = /eiffel|louvre|notre.dame|montmartre|champs|sacr|seine|marais|versailles/i;
  const barcelonaKeywords = /sagrada|gaudi|rambla|gothic|barceloneta|park.guell|camp.nou|born/i;
  const romeKeywords = /colosseum|vatican|trevi|pantheon|trastevere|spanish.steps|forum|sistine/i;

  let geoOk = true;
  for (const day of days) {
    const dayBlocks = day.blocks.filter((b: any) => b.category === "activity" || b.category === "meal");
    for (const b of dayBlocks) {
      const text = b.title + " " + (b.location || "") + " " + (b.notes || "");
      if (parisKeywords.test(text) && day.dayNumber > 6) geoOk = false;
      if (romeKeywords.test(text) && day.dayNumber < 7) geoOk = false;
    }
  }
  checks.push(check("Activities in correct city segments", geoOk));

  // Days split roughly across 3 cities
  checks.push(check("Trip is 10+ days (multi-city)", days.length >= 10, `${days.length} days`));

  // Packing list and local tips
  checks.push(check("Has packing list", (plan.packingList || []).length >= 5, `${(plan.packingList || []).length} items`));
  checks.push(check("Has local tips", (plan.localTips || []).length >= 3, `${(plan.localTips || []).length} tips`));

  return printResults("SCENARIO 4: Multi-city Europe from Chicago", checks);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪 TripTab Prompt Scenario Tests (Direct Gemini API)");
  console.log("   Using SYSTEM_PROMPT from: supabase/functions/generate-itinerary/index.ts");
  console.log("   Model: gemini-2.5-flash");
  console.log("   Each scenario takes 15-60 seconds...\n");

  let totalFailed = 0;
  try { totalFailed += await scenario1(); } catch (e: any) { console.error("Scenario 1 ERROR:", e.message); totalFailed++; }
  try { totalFailed += await scenario2(); } catch (e: any) { console.error("Scenario 2 ERROR:", e.message); totalFailed++; }
  try { totalFailed += await scenario3(); } catch (e: any) { console.error("Scenario 3 ERROR:", e.message); totalFailed++; }
  try { totalFailed += await scenario4(); } catch (e: any) { console.error("Scenario 4 ERROR:", e.message); totalFailed++; }

  console.log(`\n${"═".repeat(60)}`);
  if (totalFailed === 0) {
    console.log("  🎉 ALL SCENARIOS PASSED");
  } else {
    console.log(`  ⚠️  ${totalFailed} total check(s) failed`);
  }
  console.log(`${"═".repeat(60)}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
