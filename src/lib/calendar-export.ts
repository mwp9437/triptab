import { TripPlan, TimeBlock, ItineraryDay } from "@/types/itinerary";

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

export function generateICS(plan: TripPlan): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TripCraft//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICS(plan.destination)} Trip`,
  ];

  for (const day of plan.itinerary) {
    for (const block of day.blocks) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${block.id}@tripcraft`);
      lines.push(`DTSTART:${formatICSDate(day.date, block.startTime)}`);
      lines.push(`DTEND:${formatICSDate(day.date, block.endTime)}`);
      lines.push(`SUMMARY:${escapeICS(block.title)}`);
      if (block.location) lines.push(`LOCATION:${escapeICS(block.location)}`);
      if (block.notes) lines.push(`DESCRIPTION:${escapeICS(block.notes)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(plan: TripPlan): void {
  const ics = generateICS(plan);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plan.destination.replace(/\s+/g, "-").toLowerCase()}-trip.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
