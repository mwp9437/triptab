/**
 * Backend scenario tests — calls the deployed Supabase edge function
 * with 4 real intake payloads and validates the AI-generated itinerary.
 *
 * Usage:
 *   npx tsx e2e/test-backend-scenarios.ts
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
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

async function callGenerateItinerary(intake: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-itinerary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY!,
    },
    body: JSON.stringify({ intake }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
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
  const plan = await callGenerateItinerary(intake);
  const checks: Check[] = [];

  // No flight blocks
  const flights = allBlocks(plan).filter(
    (b: any) =>
      b.category === "transport" &&
      /flight|fly|airport|depart|arrive/i.test(b.title + " " + (b.notes || ""))
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
  const plan = await callGenerateItinerary(intake);
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

  // Flight cost realistic ($700-$1500 pp)
  const flightBlocks = transportBlocks.filter((b: any) => /flight/i.test(b.title + " " + (b.notes || "")));
  const flightCosts = flightBlocks.map((b: any) => b.cost || 0);
  const maxFlightCost = Math.max(...flightCosts, 0);
  checks.push(
    check(
      "Flight cost $700-$2000/person",
      maxFlightCost >= 700 && maxFlightCost <= 2000,
      flightCosts.map((c: number) => `$${c}`).join(", ")
    )
  );

  // Every day has accommodation
  const days = plan.itinerary || [];
  const daysWithAccom = days.filter((d: any) => d.blocks.some((b: any) => b.category === "accommodation"));
  checks.push(check("Every day has accommodation", daysWithAccom.length === days.length, `${daysWithAccom.length}/${days.length}`));

  // Hotels are in Tokyo
  const accom = blocksByCategory(plan, "accommodation");
  const inTokyo = accom.every((b: any) => /tokyo|shinjuku|shibuya|ginza|roppongi|asakusa|akihabara|ueno|ikebukuro/i.test(b.title + " " + (b.location || "")));
  checks.push(check("Hotels are in Tokyo", inTokyo, accom.map((b: any) => `${b.title} @ ${b.location}`).join("; ")));

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
  const plan = await callGenerateItinerary(intake);
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

  // Friday has Hattie B's near 7pm
  const friday = days.find((d: any) => d.date === "2026-05-15");
  const hattie = friday?.blocks.find((b: any) => /hattie/i.test(b.title));
  const hattieNear7 = hattie && /1[89]:|19:|20:|7/i.test(hattie.startTime);
  checks.push(
    check(
      "Friday has Hattie B's near 7pm",
      !!hattie,
      hattie ? `${hattie.title} @ ${hattie.startTime}` : "not found"
    )
  );

  // Saturday has bar crawl
  const saturday = days.find((d: any) => d.date === "2026-05-16");
  const barCrawl = saturday?.blocks.find((b: any) => /bar crawl|bar.hop|honky.tonk|broadway.*bar/i.test(b.title + " " + (b.notes || "")));
  checks.push(check("Saturday has bar crawl", !!barCrawl, barCrawl?.title || "not found"));

  // Sunday has golf / Gaylord Springs
  const sunday = days.find((d: any) => d.date === "2026-05-17");
  const golf = sunday?.blocks.find((b: any) => /golf|gaylord/i.test(b.title + " " + (b.location || "") + " " + (b.notes || "")));
  checks.push(check("Sunday has golf/Gaylord Springs", !!golf, golf?.title || "not found"));

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
  const plan = await callGenerateItinerary(intake);
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
  // Rough check: look for Paris stuff in early days, Barcelona in middle, Rome in late days
  const parisKeywords = /eiffel|louvre|notre.dame|montmartre|champs|sacr|seine|marais|versailles/i;
  const barcelonaKeywords = /sagrada|gaudi|rambla|gothic|barceloneta|park.guell|camp.nou|born/i;
  const romeKeywords = /colosseum|vatican|trevi|pantheon|trastevere|spanish.steps|forum|sistine/i;

  let geoOk = true;
  for (const day of days) {
    const dayBlocks = day.blocks.filter((b: any) => b.category === "activity" || b.category === "meal");
    for (const b of dayBlocks) {
      const text = b.title + " " + (b.location || "") + " " + (b.notes || "");
      // If a block has Paris keywords, it should be in the first ~4 days
      if (parisKeywords.test(text) && day.dayNumber > 6) geoOk = false;
      // If a block has Rome keywords, it should be in the last ~4 days
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
  console.log("🧪 TripTab Backend Scenario Tests");
  console.log("   Calling deployed edge function at:", SUPABASE_URL);
  console.log("   Each scenario takes 15-30 seconds...\n");

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
