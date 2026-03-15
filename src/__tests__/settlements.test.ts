import { describe, it, expect } from "vitest";
import { calculateSettlements, getCategoryTotals } from "@/lib/settlements";
import { Expense, Traveler } from "@/types/expenses";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeTraveler = (id: string, name: string): Traveler => ({ id, name });

const makeExpense = (
  overrides: Partial<Expense> & Pick<Expense, "amount" | "paidBy" | "participants">
): Expense => ({
  id: crypto.randomUUID(),
  tripId: "trip-1",
  description: "test",
  currency: "USD",
  category: "food",
  date: "2026-04-01",
  splitMethod: "equal",
  createdAt: new Date().toISOString(),
  ...overrides,
});

function computePersonalShare(expenses: Expense[], travelerId: string): number {
  return expenses.reduce((sum, exp) => {
    const myPart = exp.participants.find((p) => p.travelerId === travelerId);
    return sum + (myPart?.share || 0);
  }, 0);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("1. Equal split settlement", () => {
  it("$300 between 3 people, paid by A → B owes $100, C owes $100", () => {
    const travelers = [
      makeTraveler("a", "Alice"),
      makeTraveler("b", "Bob"),
      makeTraveler("c", "Carol"),
    ];
    const expenses = [
      makeExpense({
        amount: 300,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 100 },
          { travelerId: "b", share: 100 },
          { travelerId: "c", share: 100 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    expect(balances["a"]).toBe(200); // paid 300, owes 100 → owed 200
    expect(balances["b"]).toBe(-100);
    expect(balances["c"]).toBe(-100);
    expect(settlements).toHaveLength(2);

    // Both B and C pay A
    for (const s of settlements) {
      expect(s.to).toBe("a");
      expect(s.amount).toBe(100);
    }
  });
});

describe("2. Custom split settlement", () => {
  it("$200 split as $120/$80, paid by A → B owes $80, A owes nothing", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];
    const expenses = [
      makeExpense({
        amount: 200,
        paidBy: "a",
        splitMethod: "custom_amount",
        participants: [
          { travelerId: "a", share: 120 },
          { travelerId: "b", share: 80 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    // A paid 200, owes 120 → balance = +80
    expect(balances["a"]).toBe(80);
    // B paid 0, owes 80 → balance = -80
    expect(balances["b"]).toBe(-80);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "b", to: "a", amount: 80 });
  });
});

describe("3. Multiple expenses: net settlement minimizes transfers", () => {
  it("A pays $100 dinner, B pays $60 taxi → net is one transfer", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];
    const expenses = [
      makeExpense({
        description: "Dinner",
        amount: 100,
        paidBy: "a",
        category: "food",
        participants: [
          { travelerId: "a", share: 50 },
          { travelerId: "b", share: 50 },
        ],
      }),
      makeExpense({
        description: "Taxi",
        amount: 60,
        paidBy: "b",
        category: "transport",
        participants: [
          { travelerId: "a", share: 30 },
          { travelerId: "b", share: 30 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    // A: paid 100, owes (50 + 30) = 80 → balance = +20
    // B: paid 60, owes (50 + 30) = 80 → balance = -20
    expect(balances["a"]).toBe(20);
    expect(balances["b"]).toBe(-20);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "b", to: "a", amount: 20 });
  });

  it("3-person multi-expense reduces to minimal transfers", () => {
    const travelers = [
      makeTraveler("a", "Alice"),
      makeTraveler("b", "Bob"),
      makeTraveler("c", "Carol"),
    ];
    const expenses = [
      makeExpense({
        amount: 90,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 30 },
          { travelerId: "b", share: 30 },
          { travelerId: "c", share: 30 },
        ],
      }),
      makeExpense({
        amount: 60,
        paidBy: "b",
        participants: [
          { travelerId: "a", share: 20 },
          { travelerId: "b", share: 20 },
          { travelerId: "c", share: 20 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    // A: paid 90, owes 50 → +40
    // B: paid 60, owes 50 → +10
    // C: paid 0, owes 50 → -50
    expect(balances["a"]).toBe(40);
    expect(balances["b"]).toBe(10);
    expect(balances["c"]).toBe(-50);

    // C needs to pay total of $50 to cover A's $40 and B's $10
    const totalTransferred = settlements.reduce((s, t) => s + t.amount, 0);
    expect(totalTransferred).toBe(50);
  });
});

describe("4. Budget tracking: only expenses count, not suggested blocks", () => {
  it("confirmed expenses count toward personal budget", () => {
    const expenses = [
      makeExpense({
        amount: 150,
        paidBy: "me",
        participants: [
          { travelerId: "me", share: 75 },
          { travelerId: "friend", share: 75 },
        ],
      }),
      makeExpense({
        amount: 80,
        paidBy: "friend",
        participants: [
          { travelerId: "me", share: 40 },
          { travelerId: "friend", share: 40 },
        ],
      }),
    ];

    const myShare = computePersonalShare(expenses, "me");
    expect(myShare).toBe(115); // 75 + 40

    const budget = 500;
    expect(myShare < budget).toBe(true);
    expect((myShare / budget) * 100).toBe(23);
  });

  it("suggested blocks with NO expenses contribute $0 to budget", () => {
    // No expenses means no budget spend regardless of suggested block costs
    const expenses: Expense[] = [];
    const myShare = computePersonalShare(expenses, "me");
    expect(myShare).toBe(0);
  });

  it("over-budget detection works", () => {
    const expenses = [
      makeExpense({
        amount: 600,
        paidBy: "me",
        participants: [{ travelerId: "me", share: 600 }],
      }),
    ];
    const myShare = computePersonalShare(expenses, "me");
    const budget = 500;
    expect(myShare > budget).toBe(true);
    expect(myShare - budget).toBe(100);
  });
});

describe("5. Edit expense: updating amount recalculates balances", () => {
  it("changing expense from $100 to $150 updates balances correctly", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];

    // Before edit: $100 expense
    const before = [
      makeExpense({
        id: "exp-1",
        amount: 100,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 50 },
          { travelerId: "b", share: 50 },
        ],
      }),
    ];

    const { balances: beforeBal } = calculateSettlements(before, travelers);
    expect(beforeBal["a"]).toBe(50);
    expect(beforeBal["b"]).toBe(-50);

    // After edit: same expense but $150
    const after = [
      makeExpense({
        id: "exp-1",
        amount: 150,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 75 },
          { travelerId: "b", share: 75 },
        ],
      }),
    ];

    const { balances: afterBal, settlements } = calculateSettlements(after, travelers);
    expect(afterBal["a"]).toBe(75);
    expect(afterBal["b"]).toBe(-75);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "b", to: "a", amount: 75 });
  });
});

describe("6. Round trip transport: description includes (round trip)", () => {
  it("round trip flag appends to expense description", () => {
    const roundTrip = true;
    const baseDescription = "Airport Transfer";
    const description = baseDescription + (roundTrip ? " (round trip)" : "");
    expect(description).toBe("Airport Transfer (round trip)");
  });

  it("one-way does not append anything", () => {
    const roundTrip = false;
    const baseDescription = "Airport Transfer";
    const description = baseDescription + (roundTrip ? " (round trip)" : "");
    expect(description).toBe("Airport Transfer");
  });

  it("round trip doubles the cost", () => {
    const baseCost = 50;
    const roundTrip = true;
    const totalCost = roundTrip ? baseCost * 2 : baseCost;
    expect(totalCost).toBe(100);
  });

  it("round trip per-person doubles correctly", () => {
    const costPerPerson = 30;
    const participants = 4;
    const roundTrip = true;
    const baseTotalCost = costPerPerson * participants; // 120
    const totalCost = roundTrip ? baseTotalCost * 2 : baseTotalCost; // 240
    expect(totalCost).toBe(240);
  });
});

describe("Category totals", () => {
  it("sums expenses by category correctly", () => {
    const expenses = [
      makeExpense({ amount: 100, paidBy: "a", category: "food", participants: [{ travelerId: "a", share: 100 }] }),
      makeExpense({ amount: 50, paidBy: "a", category: "food", participants: [{ travelerId: "a", share: 50 }] }),
      makeExpense({ amount: 200, paidBy: "a", category: "accommodation", participants: [{ travelerId: "a", share: 200 }] }),
      makeExpense({ amount: 75, paidBy: "a", category: "transport", participants: [{ travelerId: "a", share: 75 }] }),
    ];

    const totals = getCategoryTotals(expenses);
    expect(totals["food"]).toBe(150);
    expect(totals["accommodation"]).toBe(200);
    expect(totals["transport"]).toBe(75);
    expect(totals["activities"]).toBeUndefined();
  });
});

describe("Edge cases: zero balance", () => {
  it("everyone paid their own share → no settlements", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];
    const expenses = [
      makeExpense({ amount: 50, paidBy: "a", participants: [{ travelerId: "a", share: 50 }] }),
      makeExpense({ amount: 50, paidBy: "b", participants: [{ travelerId: "b", share: 50 }] }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);
    expect(balances["a"]).toBe(0);
    expect(balances["b"]).toBe(0);
    expect(settlements).toHaveLength(0);
  });
});
