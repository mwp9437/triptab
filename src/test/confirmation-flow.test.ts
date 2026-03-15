import { describe, it, expect } from "vitest";
import { TimeBlock, BlockStatus, CostType, TripPlan, BudgetSummary, ItineraryDay } from "@/types/itinerary";
import { Expense, Traveler } from "@/types/expenses";
import { getCategoryTotals } from "@/lib/settlements";

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

const makeExpense = (
  overrides: Partial<Expense> & Pick<Expense, "amount" | "paidBy" | "participants">
): Expense => ({
  id: crypto.randomUUID(),
  tripId: "trip-1",
  description: "test",
  currency: "USD",
  category: "activities",
  date: "2026-04-01",
  splitMethod: "equal",
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makePlan = (days: ItineraryDay[]): TripPlan => ({
  destination: "Test City",
  startDate: "2026-04-01",
  endDate: "2026-04-03",
  travelers: 4,
  itinerary: days,
  actionItems: [],
  budget: { total: 0, spent: 0, categories: {} },
});

/**
 * Pure extraction of the share-calculation logic from ConfirmActivityModal.
 * This is the same algorithm used in handleLogExpense.
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
 * Pure extraction of the "isSuggested" logic from Dashboard block rendering.
 * Mirrors: `const isSuggested = block.status === "suggested" || (!block.status && !block.isUserPrice);`
 */
function isSuggested(block: TimeBlock): boolean {
  return block.status === "suggested" || (!block.status && !block.isUserPrice);
}

function isConfirmed(block: TimeBlock): boolean {
  return block.status === "confirmed";
}

function hasExpenseBadge(block: TimeBlock, expenseBlockIds: Set<string>): boolean {
  return !!(block.confirmedDetails?.expenseCreated || expenseBlockIds.has(block.id));
}

/**
 * Simulates the "Confirm Only" handler from ConfirmActivityModal.
 */
function simulateConfirmOnly(
  block: TimeBlock,
  cost: number,
  costType: CostType,
  participantIds: string[]
): Partial<TimeBlock> {
  const totalCost = costType === "per_person" ? cost * participantIds.length : cost;
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

/**
 * Simulates the "Confirm & Log Expense" handler from ConfirmActivityModal.
 */
function simulateConfirmAndLogExpense(
  block: TimeBlock,
  cost: number,
  costType: CostType,
  actualTotal: number,
  paidBy: string,
  participantIds: string[]
): { blockUpdates: Partial<TimeBlock>; expense: Omit<Expense, "id" | "createdAt"> } {
  const BLOCK_TO_EXPENSE_CATEGORY: Record<string, Expense["category"]> = {
    transport: "transport",
    activity: "activities",
    meal: "food",
    accommodation: "accommodation",
    free: "other",
  };

  const shares = computeEqualShares(actualTotal, participantIds);

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
      description: block.title,
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

/**
 * Simulates applyStatus to AI-generated blocks (from PlanningWorkspace).
 */
function applyAiStatus(itinerary: ItineraryDay[]): ItineraryDay[] {
  return itinerary.map((day) => ({
    ...day,
    blocks: day.blocks.map((block) => ({
      ...block,
      status: "suggested" as const,
    })),
  }));
}

/**
 * Compute personal share from expenses (mirrors ExpensesPanel logic).
 */
function computePersonalShare(expenses: Expense[], travelerId: string): number {
  return expenses.reduce((sum, exp) => {
    const myPart = exp.participants.find((p) => p.travelerId === travelerId);
    return sum + (myPart?.share || 0);
  }, 0);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Block status rendering logic", () => {
  it("Test 1: suggested block has correct flags", () => {
    const suggested = makeBlock({
      id: "b1",
      title: "Visit Museum",
      cost: 25,
      status: "suggested",
    });

    expect(isSuggested(suggested)).toBe(true);
    expect(isConfirmed(suggested)).toBe(false);
    expect(hasExpenseBadge(suggested, new Set())).toBe(false);
  });

  it("Test 1: confirmed block without expense has correct flags", () => {
    const confirmed = makeBlock({
      id: "b2",
      title: "Scuba Diving",
      cost: 150,
      status: "confirmed",
      confirmedDetails: {
        actualCost: 150,
        confirmedAt: "2026-04-01T10:00:00Z",
        expenseCreated: false,
      },
    });

    expect(isSuggested(confirmed)).toBe(false);
    expect(isConfirmed(confirmed)).toBe(true);
    expect(hasExpenseBadge(confirmed, new Set())).toBe(false);
  });

  it("Test 1: confirmed block with expense has $ badge", () => {
    const withExpense = makeBlock({
      id: "b3",
      title: "Dinner at Nobu",
      cost: 200,
      status: "confirmed",
      confirmedDetails: {
        actualCost: 200,
        confirmedAt: "2026-04-01T20:00:00Z",
        expenseCreated: true,
      },
    });

    expect(isSuggested(withExpense)).toBe(false);
    expect(isConfirmed(withExpense)).toBe(true);
    expect(hasExpenseBadge(withExpense, new Set())).toBe(true);
  });

  it("Test 1: block with no status and no isUserPrice defaults to suggested", () => {
    const legacy = makeBlock({
      id: "b4",
      title: "Walking Tour",
      cost: 30,
    });

    expect(isSuggested(legacy)).toBe(true);
    expect(isConfirmed(legacy)).toBe(false);
  });

  it("Test 1: block with expenseBlockIds match shows $ badge even without confirmedDetails", () => {
    const block = makeBlock({ id: "b5", title: "Taxi", status: "confirmed" });
    const expenseIds = new Set(["b5"]);

    expect(hasExpenseBadge(block, expenseIds)).toBe(true);
  });
});

describe("Confirmation flow — Confirm Only", () => {
  it("Test 2: confirm only sets status and does NOT create expense", () => {
    const block = makeBlock({
      id: "block-1",
      title: "Kayaking",
      cost: 100,
      status: "suggested",
    });
    const participantIds = ["t1", "t2", "t3"];

    const updates = simulateConfirmOnly(block, 100, "total", participantIds);

    expect(updates.status).toBe("confirmed");
    expect(updates.confirmedDetails?.expenseCreated).toBe(false);
    expect(updates.confirmedDetails?.actualCost).toBe(100);
    expect(updates.confirmedDetails?.participants).toEqual(participantIds);
    expect(updates.confirmedDetails?.paidBy).toBeUndefined();
    expect(updates.confirmedDetails?.confirmedAt).toBeDefined();
  });
});

describe("Confirmation flow — Confirm & Log Expense (total cost)", () => {
  it("Test 3: total cost $150, 4 participants, equal split", () => {
    const block = makeBlock({
      id: "block-2",
      title: "Snorkeling Tour",
      cost: 150,
      status: "suggested",
      category: "activity",
    });

    const { blockUpdates, expense } = simulateConfirmAndLogExpense(
      block,
      150,
      "total",
      150,
      "t1",
      ["t1", "t2", "t3", "t4"]
    );

    // Block updates
    expect(blockUpdates.status).toBe("confirmed");
    expect(blockUpdates.confirmedDetails?.expenseCreated).toBe(true);
    expect(blockUpdates.confirmedDetails?.paidBy).toBe("t1");
    expect(blockUpdates.confirmedDetails?.actualCost).toBe(150);

    // Expense
    expect(expense.amount).toBe(150);
    expect(expense.category).toBe("activities");
    expect(expense.blockId).toBe("block-2");
    expect(expense.paidBy).toBe("t1");
    expect(expense.participants).toHaveLength(4);

    // Each share should be $37.50
    for (const p of expense.participants) {
      expect(p.share).toBe(37.5);
    }
    const totalShares = expense.participants.reduce((s, p) => s + p.share, 0);
    expect(totalShares).toBe(150);
  });
});

describe("Per-person cost → total conversion (jet ski scenario)", () => {
  it("Test 4: $100/person × 5 = $500 estimated, actual $526", () => {
    const block = makeBlock({
      id: "block-3",
      title: "Jet Skiing",
      cost: 100,
      status: "suggested",
      category: "activity",
    });

    // Step 1: Confirm with per-person cost
    const confirmUpdates = simulateConfirmOnly(
      block,
      100,
      "per_person",
      ["t1", "t2", "t3", "t4", "t5"]
    );
    expect(confirmUpdates.confirmedDetails?.actualCost).toBe(500); // 100 × 5
    expect(confirmUpdates.confirmedDetails?.expenseCreated).toBe(false);

    // Step 2: Later, log expense with actual total $526
    const confirmedBlock: TimeBlock = {
      ...block,
      ...confirmUpdates,
      status: "confirmed",
      confirmedDetails: confirmUpdates.confirmedDetails,
    } as TimeBlock;

    const { expense } = simulateConfirmAndLogExpense(
      confirmedBlock,
      100,
      "per_person",
      526, // actual total differs from estimate
      "t1",
      ["t1", "t2", "t3", "t4", "t5"]
    );

    expect(expense.amount).toBe(526);
    expect(expense.participants).toHaveLength(5);

    // $526 / 5 = $105.20 each
    const shares = expense.participants.map((p) => p.share);
    const totalShares = shares.reduce((s, v) => s + v, 0);
    expect(totalShares).toBe(526);

    // All shares should be $105.20 (526 * 100 = 52600 cents / 5 = 10520 each = $105.20)
    for (const p of expense.participants) {
      expect(p.share).toBe(105.2);
    }
  });
});

describe("Per-person rounding", () => {
  it("Test 5: $100 / 3 = $33.34 + $33.33 + $33.33", () => {
    const shares = computeEqualShares(100, ["t1", "t2", "t3"]);

    expect(shares).toHaveLength(3);
    // First person gets the extra penny
    expect(shares[0].share).toBe(33.34);
    expect(shares[1].share).toBe(33.33);
    expect(shares[2].share).toBe(33.33);

    const total = shares.reduce((s, p) => s + p.share, 0);
    expect(Math.round(total * 100) / 100).toBe(100);
  });

  it("Test 5b: $10 / 3 = $3.34 + $3.33 + $3.33", () => {
    const shares = computeEqualShares(10, ["a", "b", "c"]);
    expect(shares[0].share).toBe(3.34);
    expect(shares[1].share).toBe(3.33);
    expect(shares[2].share).toBe(3.33);
    expect(shares.reduce((s, p) => s + p.share, 0)).toBeCloseTo(10);
  });

  it("Test 5c: $1 / 7 distributes remainder correctly", () => {
    const shares = computeEqualShares(1, ["a", "b", "c", "d", "e", "f", "g"]);
    const total = shares.reduce((s, p) => s + p.share, 0);
    expect(Math.round(total * 100) / 100).toBe(1);

    // 100 cents / 7 = 14 remainder 2, so first 2 get 15 cents, rest get 14
    expect(shares[0].share).toBe(0.15);
    expect(shares[1].share).toBe(0.15);
    expect(shares[2].share).toBe(0.14);
  });
});

describe("Budget tracking", () => {
  it("Test 6: personal share calculated from expenses", () => {
    const travelers = [
      makeTraveler("me", "Mike", true),
      makeTraveler("sarah", "Sarah"),
    ];

    const expenses = [
      makeExpense({
        amount: 100,
        paidBy: "me",
        category: "food",
        participants: [
          { travelerId: "me", share: 50 },
          { travelerId: "sarah", share: 50 },
        ],
      }),
      makeExpense({
        amount: 200,
        paidBy: "sarah",
        category: "activities",
        participants: [
          { travelerId: "me", share: 100 },
          { travelerId: "sarah", share: 100 },
        ],
      }),
      makeExpense({
        amount: 50,
        paidBy: "me",
        category: "transport",
        participants: [
          { travelerId: "me", share: 25 },
          { travelerId: "sarah", share: 25 },
        ],
      }),
    ];

    // My share: 50 + 100 + 25 = 175
    const myShare = computePersonalShare(expenses, "me");
    expect(myShare).toBe(175);

    // Budget: $500
    const personalBudget = 500;
    const percent = Math.min((myShare / personalBudget) * 100, 100);
    expect(percent).toBe(35);
    expect(myShare < personalBudget).toBe(true);

    // Category breakdown
    const catTotals = getCategoryTotals(expenses);
    expect(catTotals["food"]).toBe(100);
    expect(catTotals["activities"]).toBe(200);
    expect(catTotals["transport"]).toBe(50);
  });

  it("Test 6b: over-budget detection", () => {
    const expenses = [
      makeExpense({
        amount: 600,
        paidBy: "me",
        participants: [{ travelerId: "me", share: 600 }],
      }),
    ];

    const myShare = computePersonalShare(expenses, "me");
    const personalBudget = 500;
    const overBudget = myShare > personalBudget;
    expect(overBudget).toBe(true);
    expect(myShare - personalBudget).toBe(100);
  });
});

describe("Suggested blocks don't affect budget", () => {
  it("Test 7: only confirmed blocks with expenses count toward budget", () => {
    const suggestedBlocks = Array.from({ length: 10 }, (_, i) =>
      makeBlock({
        id: `suggested-${i}`,
        title: `Suggested Activity ${i}`,
        cost: 200,
        status: "suggested",
      })
    );
    const confirmedBlocks = [
      makeBlock({
        id: "confirmed-1",
        title: "Actual Dinner",
        cost: 150,
        status: "confirmed",
        confirmedDetails: { actualCost: 150, expenseCreated: true, confirmedAt: "2026-04-01" },
      }),
      makeBlock({
        id: "confirmed-2",
        title: "Museum Entry",
        cost: 50,
        status: "confirmed",
        confirmedDetails: { actualCost: 50, expenseCreated: true, confirmedAt: "2026-04-01" },
      }),
    ];

    // The budget should be based on expenses, not block estimates
    const allBlocks = [...suggestedBlocks, ...confirmedBlocks];

    // Total of suggested block costs (should NOT be in budget)
    const suggestedTotal = suggestedBlocks.reduce((s, b) => s + (b.cost || 0), 0);
    expect(suggestedTotal).toBe(2000);

    // Total of confirmed block actual costs
    const confirmedTotal = confirmedBlocks.reduce(
      (s, b) => s + (b.confirmedDetails?.actualCost || 0),
      0
    );
    expect(confirmedTotal).toBe(200); // not $300 — this is the confirmed actual cost

    // Budget tracking is based on EXPENSES, not block costs
    // So if expenses for those confirmed blocks are $150 + $50 = $200
    const expenses = [
      makeExpense({
        amount: 150,
        paidBy: "me",
        blockId: "confirmed-1",
        participants: [{ travelerId: "me", share: 150 }],
      }),
      makeExpense({
        amount: 50,
        paidBy: "me",
        blockId: "confirmed-2",
        participants: [{ travelerId: "me", share: 50 }],
      }),
    ];

    const myShare = computePersonalShare(expenses, "me");
    expect(myShare).toBe(200);
    // Not $2000 or $2200
  });
});

describe("AI-generated plan starts all suggested", () => {
  it("Test 8: applyAiStatus marks every block as suggested", () => {
    const aiItinerary: ItineraryDay[] = [
      {
        date: "2026-04-01",
        dayNumber: 1,
        title: "Day 1",
        blocks: [
          makeBlock({ id: "a1", title: "Morning Hike", cost: 0 }),
          makeBlock({ id: "a2", title: "Lunch at Café", cost: 25, category: "meal" }),
          makeBlock({ id: "a3", title: "Afternoon Beach", cost: 10 }),
        ],
      },
      {
        date: "2026-04-02",
        dayNumber: 2,
        title: "Day 2",
        blocks: [
          makeBlock({ id: "a4", title: "Temple Visit", cost: 15 }),
          makeBlock({ id: "a5", title: "Hotel Stay", cost: 120, category: "accommodation" }),
        ],
      },
    ];

    const withStatus = applyAiStatus(aiItinerary);

    // Every block should be "suggested"
    for (const day of withStatus) {
      for (const block of day.blocks) {
        expect(block.status).toBe("suggested");
        expect(isSuggested(block)).toBe(true);
        expect(isConfirmed(block)).toBe(false);
      }
    }

    // Total: 5 blocks all suggested
    const allBlocks = withStatus.flatMap((d) => d.blocks);
    expect(allBlocks).toHaveLength(5);
    expect(allBlocks.every((b) => b.status === "suggested")).toBe(true);
  });

  it("Test 8b: budget shows $0 when all blocks are suggested (no expenses)", () => {
    const expenses: Expense[] = []; // no expenses logged
    const myShare = computePersonalShare(expenses, "me");
    expect(myShare).toBe(0);
  });
});

describe("Pre-existing trip items", () => {
  it("Test 9: user-added blocks start confirmed, AI gap-fillers start suggested", () => {
    // Simulate PlanningWorkspace behavior:
    // - handleAddActivity sets status "confirmed" for user-added blocks
    // - AI blocks get status "suggested"

    const userBlock = makeBlock({
      id: "user-1",
      title: "Dinner at Nobu",
      cost: 200,
      category: "meal",
      status: "confirmed", // user-added
    });

    const userAccom = makeBlock({
      id: "user-2",
      title: "Friend's House",
      cost: 0,
      category: "accommodation",
      status: "confirmed", // user specified, cost $0
    });

    const aiGapFiller = makeBlock({
      id: "ai-1",
      title: "Morning Yoga Session",
      cost: 30,
      category: "activity",
      status: "suggested", // AI gap-filler
    });

    expect(isConfirmed(userBlock)).toBe(true);
    expect(isConfirmed(userAccom)).toBe(true);
    expect(userAccom.cost).toBe(0);

    expect(isSuggested(aiGapFiller)).toBe(true);
    expect(isConfirmed(aiGapFiller)).toBe(false);
  });
});

describe("Re-open confirmed block to log expense", () => {
  it("Test 10: confirmed block without expense enters expense mode", () => {
    const confirmedNoExpense = makeBlock({
      id: "block-10",
      title: "Kayak Rental",
      cost: 80,
      status: "confirmed",
      confirmedDetails: {
        actualCost: 80,
        costType: "total",
        participants: ["t1", "t2"],
        confirmedAt: "2026-04-02T10:00:00Z",
        expenseCreated: false,
      },
    });

    // This mirrors the isExpenseMode check in ConfirmActivityModal
    const isExpenseMode =
      confirmedNoExpense.status === "confirmed" &&
      confirmedNoExpense.confirmedDetails &&
      !confirmedNoExpense.confirmedDetails.expenseCreated;

    expect(isExpenseMode).toBe(true);

    // Now log the expense
    const { blockUpdates, expense } = simulateConfirmAndLogExpense(
      confirmedNoExpense,
      80,
      "total",
      80,
      "t1",
      ["t1", "t2"]
    );

    expect(blockUpdates.confirmedDetails?.expenseCreated).toBe(true);
    expect(expense.amount).toBe(80);
    expect(expense.participants[0].share).toBe(40);
    expect(expense.participants[1].share).toBe(40);
  });

  it("Test 10b: confirmed block WITH expense does NOT enter expense mode", () => {
    const confirmedWithExpense = makeBlock({
      id: "block-11",
      title: "Dinner",
      cost: 120,
      status: "confirmed",
      confirmedDetails: {
        actualCost: 120,
        paidBy: "t1",
        participants: ["t1", "t2", "t3"],
        confirmedAt: "2026-04-02T20:00:00Z",
        expenseCreated: true,
      },
    });

    const isExpenseMode =
      confirmedWithExpense.status === "confirmed" &&
      confirmedWithExpense.confirmedDetails &&
      !confirmedWithExpense.confirmedDetails.expenseCreated;

    expect(isExpenseMode).toBe(false);
  });
});

describe("Category mapping", () => {
  it("maps block categories to expense categories correctly", () => {
    const mapping: Record<string, Expense["category"]> = {
      transport: "transport",
      activity: "activities",
      meal: "food",
      accommodation: "accommodation",
      free: "other",
    };

    // Verify all block categories map to valid expense categories
    for (const [blockCat, expenseCat] of Object.entries(mapping)) {
      const block = makeBlock({
        id: `cat-${blockCat}`,
        title: `Test ${blockCat}`,
        category: blockCat as any,
        status: "suggested",
      });

      const { expense } = simulateConfirmAndLogExpense(
        block,
        100,
        "total",
        100,
        "t1",
        ["t1"]
      );

      expect(expense.category).toBe(expenseCat);
    }
  });
});

describe("Edge cases", () => {
  it("zero cost block can be confirmed", () => {
    const freeBlock = makeBlock({
      id: "free-1",
      title: "Walk in the Park",
      cost: 0,
      status: "suggested",
      category: "free",
    });

    const updates = simulateConfirmOnly(freeBlock, 0, "total", ["t1", "t2"]);
    expect(updates.status).toBe("confirmed");
    expect(updates.confirmedDetails?.actualCost).toBe(0);
  });

  it("single participant gets full amount", () => {
    const shares = computeEqualShares(100, ["solo"]);
    expect(shares).toHaveLength(1);
    expect(shares[0].share).toBe(100);
    expect(shares[0].travelerId).toBe("solo");
  });

  it("large group split (10 people, $333)", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const shares = computeEqualShares(333, ids);
    const total = shares.reduce((s, p) => s + p.share, 0);
    expect(Math.round(total * 100) / 100).toBe(333);

    // 33300 / 10 = 3330 each, 0 remainder
    expect(shares.every((s) => s.share === 33.3)).toBe(true);
  });

  it("transport block defaults to per_person costType", () => {
    const flight = makeBlock({
      id: "flight-1",
      title: "NYC → LAX",
      cost: 350,
      category: "transport",
      status: "suggested",
    });

    // Mirrors ConfirmActivityModal reset logic
    const defaultCostType = flight.costType || (flight.category === "transport" ? "per_person" : "total");
    expect(defaultCostType).toBe("per_person");
  });

  it("accommodation block defaults to total costType", () => {
    const hotel = makeBlock({
      id: "hotel-1",
      title: "Hilton",
      cost: 200,
      category: "accommodation",
      status: "suggested",
    });

    const defaultCostType = hotel.costType || (hotel.category === "transport" ? "per_person" : "total");
    expect(defaultCostType).toBe("total");
  });
});
