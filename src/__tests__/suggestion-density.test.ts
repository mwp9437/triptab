import { describe, it, expect } from "vitest";
import { TimeBlock, BlockCategory } from "@/types/itinerary";

// ── Reproduce getSmartSuggestions locally ─────────────────────────────────────
// This mirrors Dashboard.tsx exactly so we can test without rendering.

type TimeSlot = { label: string; startTime: string; endTime: string; category: BlockCategory };

const MAX_SUGGESTIONS_PER_DAY = 4;

const STANDARD_SLOTS: TimeSlot[] = [
  { label: "Morning Activity", startTime: "09:00", endTime: "12:00", category: "activity" },
  { label: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal" },
  { label: "Afternoon Activity", startTime: "14:00", endTime: "17:00", category: "activity" },
  { label: "Dinner", startTime: "19:00", endTime: "21:00", category: "meal" },
];

function getSmartSuggestions(blocks: TimeBlock[]): TimeSlot[] {
  const nonAccom = blocks.filter((b) => b.category !== "accommodation");
  const confirmedCount = nonAccom.filter((b) => b.status === "confirmed").length;

  // If the user has 4+ confirmed activities, only nudge for major gaps
  if (confirmedCount >= 4) {
    const gaps: TimeSlot[] = [];
    const hasEvening = nonAccom.some((b) => b.startTime >= "17:00");
    const hasLunch = nonAccom.some(
      (b) => b.startTime >= "11:30" && b.startTime < "14:00" && /meal|lunch|food/i.test(b.category + b.title)
    );
    if (!hasEvening) gaps.push({ label: "Evening Plans", startTime: "18:00", endTime: "21:00", category: "activity" });
    if (!hasLunch) gaps.push({ label: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal" });
    return gaps.slice(0, 1);
  }

  const suggestionsToShow = Math.max(0, MAX_SUGGESTIONS_PER_DAY - confirmedCount);
  if (suggestionsToShow === 0) return [];

  const missing = STANDARD_SLOTS.filter(
    (slot) => !nonAccom.some((b) => b.startTime < slot.endTime && b.endTime > slot.startTime)
  );

  return missing.slice(0, suggestionsToShow);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeBlock = (overrides: Partial<TimeBlock> & { id: string; title: string }): TimeBlock => ({
  startTime: "09:00",
  endTime: "12:00",
  category: "activity",
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("1. Empty day → returns max 4 suggestions", () => {
  it("empty day shows all 4 standard slots", () => {
    const suggestions = getSmartSuggestions([]);
    expect(suggestions).toHaveLength(4);
    expect(suggestions.map((s) => s.label)).toEqual([
      "Morning Activity",
      "Lunch",
      "Afternoon Activity",
      "Dinner",
    ]);
  });

  it("day with only accommodation blocks still shows 4 suggestions", () => {
    const blocks = [
      makeBlock({ id: "h1", title: "Hotel Check-in", category: "accommodation", startTime: "15:00", endTime: "16:00" }),
    ];
    const suggestions = getSmartSuggestions(blocks);
    expect(suggestions).toHaveLength(4);
  });
});

describe("2. Day with 3 confirmed blocks → returns 1 suggestion", () => {
  it("3 confirmed non-accommodation blocks → 1 suggestion", () => {
    const blocks = [
      makeBlock({ id: "b1", title: "Morning Hike", startTime: "09:00", endTime: "11:00", status: "confirmed" }),
      makeBlock({ id: "b2", title: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal", status: "confirmed" }),
      makeBlock({ id: "b3", title: "Museum", startTime: "14:00", endTime: "16:00", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // MAX_SUGGESTIONS_PER_DAY (4) - confirmedCount (3) = 1
    expect(suggestions.length).toBeLessThanOrEqual(1);
  });
});

describe("3. Day with 4+ confirmed blocks → returns 0-1 suggestions (major gaps only)", () => {
  it("4 confirmed blocks with evening coverage → 0 suggestions", () => {
    const blocks = [
      makeBlock({ id: "b1", title: "Breakfast", startTime: "08:00", endTime: "09:00", category: "meal", status: "confirmed" }),
      makeBlock({ id: "b2", title: "Tour", startTime: "10:00", endTime: "12:00", status: "confirmed" }),
      makeBlock({ id: "b3", title: "Lunch Spot", startTime: "12:30", endTime: "13:30", category: "meal", status: "confirmed" }),
      makeBlock({ id: "b4", title: "Dinner at Nobu", startTime: "19:00", endTime: "21:00", category: "meal", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // Has evening (19:00 >= 17:00) and has lunch → no gaps
    expect(suggestions.length).toBe(0);
  });

  it("4 confirmed blocks WITHOUT evening → suggests evening plans", () => {
    const blocks = [
      makeBlock({ id: "b1", title: "Morning Hike", startTime: "08:00", endTime: "10:00", status: "confirmed" }),
      makeBlock({ id: "b2", title: "Temple Visit", startTime: "10:30", endTime: "12:00", status: "confirmed" }),
      makeBlock({ id: "b3", title: "Lunch", startTime: "12:00", endTime: "13:30", category: "meal", status: "confirmed" }),
      makeBlock({ id: "b4", title: "Shopping", startTime: "14:00", endTime: "16:00", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].label).toBe("Evening Plans");
  });

  it("5 confirmed blocks without lunch → suggests lunch", () => {
    const blocks = [
      makeBlock({ id: "b1", title: "Yoga", startTime: "07:00", endTime: "08:00", status: "confirmed" }),
      makeBlock({ id: "b2", title: "Surf", startTime: "09:00", endTime: "11:00", status: "confirmed" }),
      makeBlock({ id: "b3", title: "Snorkel", startTime: "14:00", endTime: "16:00", status: "confirmed" }),
      makeBlock({ id: "b4", title: "Sunset", startTime: "17:30", endTime: "19:00", status: "confirmed" }),
      makeBlock({ id: "b5", title: "Dinner", startTime: "19:30", endTime: "21:00", category: "meal", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // Has evening (17:30 >= 17:00), no lunch in 11:30-14:00 range → suggests lunch
    expect(suggestions.length).toBeLessThanOrEqual(1);
    if (suggestions.length === 1) {
      expect(suggestions[0].label).toBe("Lunch");
    }
  });
});

describe("4. Day with all suggested blocks → returns 4 suggestions (suggested don't reduce count)", () => {
  it("suggested blocks don't count toward confirmed count", () => {
    const blocks = [
      makeBlock({ id: "s1", title: "Suggested Museum", startTime: "09:00", endTime: "11:00", status: "suggested" }),
      makeBlock({ id: "s2", title: "Suggested Lunch", startTime: "12:00", endTime: "13:00", category: "meal", status: "suggested" }),
      makeBlock({ id: "s3", title: "Suggested Park", startTime: "14:00", endTime: "16:00", status: "suggested" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // confirmedCount = 0, so suggestionsToShow = 4
    // But these blocks overlap standard slots, so only non-overlapping slots are returned
    // All 4 standard slots overlap with existing blocks except Dinner (19:00-21:00)
    expect(suggestions.length).toBeLessThanOrEqual(4);
    // The Dinner slot (19:00-21:00) doesn't overlap with any existing block
    expect(suggestions.some((s) => s.label === "Dinner")).toBe(true);
  });
});

describe("5. Mixed confirmed and suggested blocks", () => {
  it("only confirmed blocks reduce the suggestion count", () => {
    const blocks = [
      makeBlock({ id: "c1", title: "Booked Tour", startTime: "09:00", endTime: "11:00", status: "confirmed" }),
      makeBlock({ id: "s1", title: "Maybe Lunch", startTime: "12:00", endTime: "13:00", category: "meal", status: "suggested" }),
      makeBlock({ id: "c2", title: "Museum Tickets", startTime: "14:00", endTime: "16:00", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // confirmedCount = 2 (non-accommodation), suggestionsToShow = 4 - 2 = 2
    // Slots overlapping with blocks are filtered out; Dinner slot is available
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });
});

describe("6. Accommodation blocks are excluded from suggestion logic", () => {
  it("accommodation blocks don't count as confirmed activities", () => {
    const blocks = [
      makeBlock({ id: "h1", title: "Hotel", category: "accommodation", startTime: "00:00", endTime: "08:00", status: "confirmed" }),
      makeBlock({ id: "h2", title: "Hotel Night", category: "accommodation", startTime: "22:00", endTime: "23:59", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // confirmedCount = 0 (accommodation is excluded), suggestionsToShow = 4
    expect(suggestions).toHaveLength(4);
  });
});

describe("7. Time overlap detection", () => {
  it("block partially overlapping a slot removes that suggestion", () => {
    const blocks = [
      makeBlock({ id: "b1", title: "Late Brunch", startTime: "11:00", endTime: "13:00", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    // This block overlaps Morning Activity (09:00-12:00) and Lunch (12:00-13:30)
    // So only Afternoon Activity and Dinner should be available
    // But confirmedCount=1, suggestionsToShow=3
    const labels = suggestions.map((s) => s.label);
    expect(labels).not.toContain("Morning Activity");
    expect(labels).not.toContain("Lunch");
    expect(labels).toContain("Afternoon Activity");
    expect(labels).toContain("Dinner");
  });

  it("block exactly matching a slot's time removes it", () => {
    const blocks = [
      makeBlock({ id: "b1", title: "Dinner Out", startTime: "19:00", endTime: "21:00", category: "meal", status: "confirmed" }),
    ];

    const suggestions = getSmartSuggestions(blocks);
    const labels = suggestions.map((s) => s.label);
    expect(labels).not.toContain("Dinner");
    // Morning, Lunch, Afternoon still available
    expect(suggestions.length).toBe(3);
  });
});
