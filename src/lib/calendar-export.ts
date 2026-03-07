import { TripPlan, TimeBlock, ItineraryDay } from "@/types/itinerary";
import { Expense, Traveler, SettlementTransaction } from "@/types/expenses";
import { calculateSettlements, getCategoryTotals } from "@/lib/settlements";

function formatICSDate(dateStr: string, time: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(year, month - 1, day, hours, minutes);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeICS(text: string): string {
  return text.replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

function buildExpenseSummary(expenses: Expense[], travelers: Traveler[]): string {
  if (expenses.length === 0) return "";
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const { settlements } = calculateSettlements(expenses, travelers);
  const travelerMap = Object.fromEntries(travelers.map((t) => [t.id, t.name]));
  const lines = [`Trip expenses total: $${total.toFixed(2)}`];
  if (settlements.length > 0) {
    lines.push("Settlement needed:");
    for (const s of settlements) {
      lines.push(`  ${travelerMap[s.from] ?? "?"} → ${travelerMap[s.to] ?? "?"}: $${s.amount.toFixed(2)}`);
    }
  }
  return lines.join("\n");
}

export function generateICS(plan: TripPlan, expenses?: Expense[], travelers?: Traveler[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TripTab//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICS(plan.destination)} Trip`,
  ];

  const allBlocks: { day: ItineraryDay; block: TimeBlock }[] = [];
  for (const day of plan.itinerary) {
    for (const block of day.blocks) {
      allBlocks.push({ day, block });
    }
  }

  const expenseSummary = expenses && travelers ? buildExpenseSummary(expenses, travelers) : "";

  allBlocks.forEach(({ day, block }, i) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${block.id}@tripcraft`);
    lines.push(`DTSTART:${formatICSDate(day.date, block.startTime)}`);
    lines.push(`DTEND:${formatICSDate(day.date, block.endTime)}`);
    lines.push(`SUMMARY:${escapeICS(block.title)}`);
    if (block.location) lines.push(`LOCATION:${escapeICS(block.location)}`);

    // Append expense summary to the last event's description
    const isLast = i === allBlocks.length - 1;
    const desc = [block.notes || "", isLast ? expenseSummary : ""].filter(Boolean).join("\n\n");
    if (desc) lines.push(`DESCRIPTION:${escapeICS(desc)}`);

    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(plan: TripPlan, expenses?: Expense[], travelers?: Traveler[]): void {
  const ics = generateICS(plan, expenses, travelers);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plan.destination.replace(/\s+/g, "-").toLowerCase()}-trip.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate printable HTML expense summary for PDF export */
export function generateExpensePrintHTML(expenses: Expense[], travelers: Traveler[], plan: TripPlan): string {
  if (expenses.length === 0) return "";
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const catTotals = getCategoryTotals(expenses);
  const { balances, settlements } = calculateSettlements(expenses, travelers);
  const travelerMap = Object.fromEntries(travelers.map((t) => [t.id, t.name]));

  let html = `<div class="expense-print-summary" style="page-break-before:always;padding-top:2rem;">`;
  html += `<h2 style="font-size:1.25rem;font-weight:bold;margin-bottom:1rem;">Expense Summary</h2>`;
  html += `<p style="font-size:1.5rem;font-weight:bold;margin-bottom:0.5rem;">Total: $${total.toFixed(2)}</p>`;

  // Category breakdown
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:1rem;"><tbody>`;
  for (const [cat, amt] of Object.entries(catTotals)) {
    const estimated = (plan.budget.categories[cat] as number) || 0;
    html += `<tr><td style="padding:4px 8px;text-transform:capitalize;">${cat}</td>`;
    html += `<td style="padding:4px 8px;text-align:right;font-weight:600;">$${amt.toFixed(2)}</td>`;
    if (estimated > 0) {
      const color = amt > estimated ? "#dc2626" : "#16a34a";
      html += `<td style="padding:4px 8px;text-align:right;color:${color};">/ $${estimated.toFixed(2)} est.</td>`;
    } else {
      html += `<td></td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  // Balances
  html += `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">Balances</h3><ul style="margin-bottom:1rem;">`;
  for (const t of travelers) {
    const bal = balances[t.id] ?? 0;
    const label = Math.abs(bal) < 0.01 ? "settled" : bal > 0 ? `is owed $${bal.toFixed(2)}` : `owes $${Math.abs(bal).toFixed(2)}`;
    html += `<li>${t.name}: ${label}</li>`;
  }
  html += `</ul>`;

  // Settlements
  if (settlements.length > 0) {
    html += `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">Settlements</h3><ul>`;
    for (const s of settlements) {
      html += `<li>${travelerMap[s.from] ?? "?"} → ${travelerMap[s.to] ?? "?"}: $${s.amount.toFixed(2)}</li>`;
    }
    html += `</ul>`;
  }

  html += `</div>`;
  return html;
}
