import { Expense, Traveler, SettlementTransaction } from "@/types/expenses";

export function calculateSettlements(
  expenses: Expense[],
  travelers: Traveler[]
): { balances: Record<string, number>; settlements: SettlementTransaction[] } {
  const balances: Record<string, number> = {};

  // Initialize all travelers to 0
  for (const t of travelers) {
    balances[t.id] = 0;
  }

  for (const exp of expenses) {
    // Payer's balance increases by total amount (they fronted it)
    balances[exp.paidBy] = (balances[exp.paidBy] ?? 0) + exp.amount;

    // Each participant's balance decreases by their share (they owe it)
    for (const p of exp.participants) {
      balances[p.travelerId] = (balances[p.travelerId] ?? 0) - p.share;
    }
  }

  // Round balances to avoid floating point drift
  for (const id in balances) {
    balances[id] = Math.round(balances[id] * 100) / 100;
  }

  // Greedy min-transfers settlement
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance < -0.005) debtors.push({ id, amount: -balance }); // owes money
    else if (balance > 0.005) creditors.push({ id, amount: balance }); // owed money
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: SettlementTransaction[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
    if (transfer > 0.005) {
      settlements.push({
        from: debtors[di].id,
        to: creditors[ci].id,
        amount: Math.round(transfer * 100) / 100,
      });
    }
    debtors[di].amount -= transfer;
    creditors[ci].amount -= transfer;
    if (debtors[di].amount < 0.01) di++;
    if (creditors[ci].amount < 0.01) ci++;
  }

  return { balances, settlements };
}

export function getCategoryTotals(expenses: Expense[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const exp of expenses) {
    totals[exp.category] = (totals[exp.category] ?? 0) + exp.amount;
  }
  return totals;
}
