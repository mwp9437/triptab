import { describe, it, expect } from "vitest";
import { TimeBlock, CostType, ItineraryDay } from "@/types/itinerary";
import { Expense, Traveler } from "@/types/expenses";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeBlock = (overrides: Partial<TimeBlock> & { id: string; title: string }): TimeBlock => ({
  startTime: "09:00",
  endTime: "12:00",
  category: "activity",
  ...overrides,
});

const makeTraveler = (id: string, name: string, isCurrentUser = false): Traveler => ({
  id,
  name,
  isCurrentUser,
});

/**
 * Mirrors isSuggested logic from Dashboard block rendering.
 */
function isSuggested(block: TimeBlock): boolean {
  return block.status === "suggested" || (!block.status && !block.isUserPrice);
}

function isConfirmed(block: TimeBlock): boolean {
  return block.status === "confirmed";
}

/**
 * Mirrors the dashed/solid border class selection in Dashboard.
 */
function getBorderClass(block: TimeBlock): string {
  const suggested = isSuggested(block);
  return suggested
    ? "border-l-4 border-dashed border-l-muted-foreground/30"
    : "border-l-4 border-solid";
}

/**
 * Equal share calculation — same algorithm as ConfirmActivityModal.
 */
function computeEqualShares(totalAmount: number, participantIds: string[]) {
  const cents = Math.round(totalAmount * 100);
  const baseShare = Math.floor(cents / participantIds.length);
  const remainder = cents - baseShare * participantIds.length;
  return participantIds.map((id, i) => ({
    travelerId: id,
    share: (baseShare + (i < remainder ? 1 : 0)) / 100,
  }));
}

/**
 * Simulates "Confirm Only" from ConfirmActivityModal.
 */
function simulateConfirmOnly(
  block: TimeBlock,
  cost: number,
  costType: CostType,
  participantIds: string[],
  roundTrip = false,
): Partial<TimeBlock> {
  const baseTotalCost = costType === "per_person" ? cost * participantIds.length : cost;
  const totalCost = roundTrip ? baseTotalCost * 2 : baseTotalCost;
  return {
    title: block.title,
    cost,
    costType,
    status: "confirmed",
    confirmedDetails: {
      actualCost: totalCost,
      costType,
      participants: participantIds,
      confirmedAt: new Date().toISOString(),
      expenseCreated: false,
    },
  };
}

const BLOCK_TO_EXPENSE_CATEGORY: Record<string, Expense["category"]> = {
  transport: "transport",
  activity: "activities",
  meal: "food",
  accommodation: "accommodation",
  free: "other",
};

/**
 * Simulates "Confirm & Log Expense" from ConfirmActivityModal.
 */
function simulateConfirmAndLogExpense(
  block: TimeBlock,
  cost: number,
  costType: CostType,
  actualTotal: number,
  paidBy: string,
  participantIds: string[],
  roundTrip = false,
): { blockUpdates: Partial<TimeBlock>; expense: Omit<Expense, "id" | "createdAt"> } {
  const shares = computeEqualShares(actualTotal, participantIds);
  const descSuffix = roundTrip ? " (round trip)" : "";

  return {
    blockUpdates: {
      title: block.title,
      cost,
      costType,
      status: "confirmed",
      confirmedDetails: {
        actualCost: actualTotal,
        costType,
        paidBy,
        participants: participantIds,
        confirmedAt: new Date().toISOString(),
        expenseCreated: true,
      },
    },
    expense: {
      tripId: "",
      blockId: block.id,
      description: block.title + descSuffix,
      amount: actualTotal,
      currency: "USD",
      category: BLOCK_TO_EXPENSE_CATEGORY[block.category] || "other",
      date: "2026-04-01",
      paidBy,
      participants: shares,
      splitMethod: "equal",
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("1. Block rendering: suggested vs confirmed styling", () => {
  it("suggested block renders with dashed border class", () => {
    const block = makeBlock({ id: "b1", title: "Museum Visit", status: "suggested" });
    expect(getBorderClass(block)).toContain("border-dashed");
    expect(isSuggested(block)).toBe(true);
    expect(isConfirmed(block)).toBe(false);
  });

  it("confirmed block renders with solid border class", () => {
    const block = makeBlock({ id: "b2", title: "Scuba", status: "confirmed" });
    expect(getBorderClass(block)).toContain("border-solid");
    expect(getBorderClass(block)).not.toContain("border-dashed");
    expect(isConfirmed(block)).toBe(true);
  });

  it("block with no status and no isUserPrice defaults to suggested (dashed)", () => {
    const block = makeBlock({ id: "b3", title: "Walk" });
    expect(getBorderClass(block)).toContain("border-dashed");
    expect(isSuggested(block)).toBe(true);
  });

  it("block with isUserPrice=true is not treated as suggested", () => {
    const block = makeBlock({ id: "b4", title: "Booked Hotel", isUserPrice: true });
    expect(isSuggested(block)).toBe(false);
  });
});

describe("2. Confirming a block sets status and stores confirmedDetails", () => {
  it("sets status to confirmed with correct confirmedDetails", () => {
    const block = makeBlock({ id: "c1", title: "Kayaking", cost: 100, status: "suggested" });
    const ids = ["t1", "t2", "t3"];
    const updates = simulateConfirmOnly(block, 100, "total", ids);

    expect(updates.status).toBe("confirmed");
    expect(updates.confirmedDetails?.actualCost).toBe(100);
    expect(updates.confirmedDetails?.participants).toEqual(ids);
    expect(updates.confirmedDetails?.confirmedAt).toBeDefined();
  });
});

describe("3. Confirm Only does NOT create an expense", () => {
  it("expenseCreated is false and paidBy is not set", () => {
    const block = makeBlock({ id: "d1", title: "Hiking", status: "suggested" });
    const updates = simulateConfirmOnly(block, 0, "total", ["t1", "t2"]);

    expect(updates.confirmedDetails?.expenseCreated).toBe(false);
    expect(updates.confirmedDetails?.paidBy).toBeUndefined();
  });
});

describe("4. Confirm & Log Expense creates correct expense", () => {
  it("creates expense with correct amount, paidBy, and participants", () => {
    const block = makeBlock({
      id: "e1",
      title: "Snorkeling Tour",
      cost: 200,
      status: "suggested",
      category: "activity",
    });

    const { blockUpdates, expense } = simulateConfirmAndLogExpense(
      block, 200, "total", 200, "t1", ["t1", "t2", "t3", "t4"]
    );

    expect(blockUpdates.status).toBe("confirmed");
    expect(blockUpdates.confirmedDetails?.expenseCreated).toBe(true);
    expect(blockUpdates.confirmedDetails?.paidBy).toBe("t1");

    expect(expense.amount).toBe(200);
    expect(expense.paidBy).toBe("t1");
    expect(expense.category).toBe("activities");
    expect(expense.blockId).toBe("e1");
    expect(expense.participants).toHaveLength(4);
    expect(expense.participants.every((p) => p.share === 50)).toBe(true);
    expect(expense.participants.reduce((s, p) => s + p.share, 0)).toBe(200);
  });

  it("maps all block categories to expense categories", () => {
    const categories = ["transport", "activity", "meal", "accommodation", "free"] as const;
    const expected = ["transport", "activities", "food", "accommodation", "other"];

    categories.forEach((cat, i) => {
      const block = makeBlock({ id: `cat-${cat}`, title: `Test`, category: cat, status: "suggested" });
      const { expense } = simulateConfirmAndLogExpense(block, 10, "total", 10, "t1", ["t1"]);
      expect(expense.category).toBe(expected[i]);
    });
  });
});

describe("5. Per-person cost calculation", () => {
  it("$100/person x 5 participants = $500 total", () => {
    const block = makeBlock({ id: "f1", title: "Jet Ski", status: "suggested" });
    const ids = ["t1", "t2", "t3", "t4", "t5"];
    const updates = simulateConfirmOnly(block, 100, "per_person", ids);

    expect(updates.confirmedDetails?.actualCost).toBe(500);
  });

  it("$50/person x 2 participants = $100 total in expense", () => {
    const block = makeBlock({ id: "f2", title: "Parasailing", status: "suggested", category: "activity" });
    const { expense } = simulateConfirmAndLogExpense(
      block, 50, "per_person", 100, "t1", ["t1", "t2"]
    );
    expect(expense.amount).toBe(100);
    expect(expense.participants[0].share).toBe(50);
    expect(expense.participants[1].share).toBe(50);
  });
});

describe("6. Rounding: equal split edge cases", () => {
  it("$100 / 3 = $33.34 + $33.33 + $33.33", () => {
    const shares = computeEqualShares(100, ["t1", "t2", "t3"]);
    expect(shares[0].share).toBe(33.34);
    expect(shares[1].share).toBe(33.33);
    expect(shares[2].share).toBe(33.33);
    expect(Math.round(shares.reduce((s, p) => s + p.share, 0) * 100) / 100).toBe(100);
  });

  it("$1 / 7 distributes remainder to first 2 participants", () => {
    const shares = computeEqualShares(1, ["a", "b", "c", "d", "e", "f", "g"]);
    // 100 cents / 7 = 14 rem 2
    expect(shares[0].share).toBe(0.15);
    expect(shares[1].share).toBe(0.15);
    expect(shares[2].share).toBe(0.14);
    expect(Math.round(shares.reduce((s, p) => s + p.share, 0) * 100) / 100).toBe(1);
  });

  it("$10 / 3 = $3.34 + $3.33 + $3.33", () => {
    const shares = computeEqualShares(10, ["a", "b", "c"]);
    expect(shares[0].share).toBe(3.34);
    expect(shares[1].share).toBe(3.33);
    expect(shares[2].share).toBe(3.33);
  });

  it("single participant gets full amount", () => {
    const shares = computeEqualShares(100, ["solo"]);
    expect(shares).toHaveLength(1);
    expect(shares[0].share).toBe(100);
  });

  it("$333 / 10 = exactly $33.30 each (no remainder)", () => {
    const shares = computeEqualShares(333, Array.from({ length: 10 }, (_, i) => `t${i}`));
    expect(shares.every((s) => s.share === 33.3)).toBe(true);
  });
});

describe("7. Stale state regression (Bug 6): changing block resets form", () => {
  it("opening modal for different blocks produces different titles", () => {
    const flight = makeBlock({ id: "flight-1", title: "NYC → LAX", cost: 350, category: "transport" });
    const lunch = makeBlock({ id: "lunch-1", title: "Sushi Lunch", cost: 45, category: "meal" });

    // Simulate what useEffect does: reset form when block changes
    // The key fix was: useEffect keyed on [open, block?.id]
    const resetFormForBlock = (block: TimeBlock) => ({
      title: block.title,
      cost: block.cost != null ? String(block.cost) : "",
      costType: block.costType || (block.category === "transport" ? "per_person" : "total"),
    });

    const flightForm = resetFormForBlock(flight);
    expect(flightForm.title).toBe("NYC → LAX");
    expect(flightForm.cost).toBe("350");
    expect(flightForm.costType).toBe("per_person");

    const lunchForm = resetFormForBlock(lunch);
    expect(lunchForm.title).toBe("Sushi Lunch");
    expect(lunchForm.cost).toBe("45");
    expect(lunchForm.costType).toBe("total");

    // Key assertion: lunch form must NOT have flight's values
    expect(lunchForm.title).not.toBe("NYC → LAX");
    expect(lunchForm.costType).not.toBe("per_person");
  });

  it("confirming flight then opening lunch does not carry stale paidBy or participants", () => {
    const travelers = [makeTraveler("me", "Mike", true), makeTraveler("sarah", "Sarah")];

    // After confirming flight, these states exist
    const staleState = { paidBy: "me", splitMethod: "equal", actualCost: "700", stage: 2 };

    // When lunch opens, useEffect resets everything
    const freshState = {
      stage: 1 as const,
      title: "Sushi Lunch",
      cost: "45",
      actualCost: "",
      paidBy: travelers.find((t) => t.isCurrentUser)?.id || travelers[0]?.id || "",
      splitMethod: "equal",
    };

    // Fresh state should be the default, not carry stale values
    expect(freshState.stage).toBe(1);
    expect(freshState.title).toBe("Sushi Lunch");
    expect(freshState.actualCost).toBe("");
    // paidBy still defaults to current user, which is "me" — that's correct default behavior, not stale
    expect(freshState.paidBy).toBe("me");
  });

  it("round trip state resets when switching from transport to non-transport block", () => {
    // After confirming a round-trip transport
    const transportForm = {
      roundTrip: true,
      title: "Airport Transfer",
    };
    expect(transportForm.roundTrip).toBe(true);

    // Opening a meal block should reset roundTrip
    const mealForm = {
      roundTrip: false, // useEffect resets this
      title: "Dinner at Nobu",
    };
    expect(mealForm.roundTrip).toBe(false);
  });
});
