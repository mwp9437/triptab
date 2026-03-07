import { describe, it, expect } from "vitest";
import { calculateSettlements } from "@/lib/settlements";
import { Expense, Traveler } from "@/types/expenses";

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

describe("calculateSettlements", () => {
  it("2-person equal split", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];
    const expenses = [
      makeExpense({
        amount: 100,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 50 },
          { travelerId: "b", share: 50 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    expect(balances["a"]).toBe(50);
    expect(balances["b"]).toBe(-50);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "b", to: "a", amount: 50 });
  });

  it("3-person unequal split", () => {
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
          { travelerId: "b", share: 40 },
          { travelerId: "c", share: 20 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    expect(balances["a"]).toBe(60); // paid 90, owes 30
    expect(balances["b"]).toBe(-40);
    expect(balances["c"]).toBe(-20);
    expect(settlements).toHaveLength(2);

    const totalTransferred = settlements.reduce((s, t) => s + t.amount, 0);
    expect(totalTransferred).toBe(60);
  });

  it("all expenses paid by one person", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];
    const expenses = [
      makeExpense({
        amount: 100,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 50 },
          { travelerId: "b", share: 50 },
        ],
      }),
      makeExpense({
        amount: 60,
        paidBy: "a",
        participants: [
          { travelerId: "a", share: 30 },
          { travelerId: "b", share: 30 },
        ],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    expect(balances["a"]).toBe(80); // paid 160, owes 80
    expect(balances["b"]).toBe(-80);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "b", to: "a", amount: 80 });
  });

  it("zero-balance case — everyone paid their share", () => {
    const travelers = [makeTraveler("a", "Alice"), makeTraveler("b", "Bob")];
    const expenses = [
      makeExpense({
        amount: 50,
        paidBy: "a",
        participants: [{ travelerId: "a", share: 50 }],
      }),
      makeExpense({
        amount: 50,
        paidBy: "b",
        participants: [{ travelerId: "b", share: 50 }],
      }),
    ];

    const { balances, settlements } = calculateSettlements(expenses, travelers);

    expect(balances["a"]).toBe(0);
    expect(balances["b"]).toBe(0);
    expect(settlements).toHaveLength(0);
  });
});
