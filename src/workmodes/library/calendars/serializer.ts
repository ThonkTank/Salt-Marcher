// src/workmodes/library/calendars/serializer.ts
// Markdown serialization for calendar entities

import type { CalendarData } from "./types";

export function calendarToMarkdown(data: CalendarData): string {
  const lines: string[] = [];

  lines.push(`# ${data.name}`);
  lines.push("");

  if (data.description) {
    lines.push(data.description);
    lines.push("");
  }

  // Months table
  lines.push("## Months");
  lines.push("");
  lines.push("| Month | Days |");
  lines.push("|-------|------|");
  for (const month of data.months) {
    lines.push(`| ${month.name} | ${month.length} |`);
  }
  lines.push("");

  // Time structure
  lines.push("## Time Structure");
  lines.push("");
  lines.push(`- **Week**: ${data.daysPerWeek} days`);
  if (data.hoursPerDay) {
    lines.push(`- **Day**: ${data.hoursPerDay} hours`);
  }
  if (data.minutesPerHour) {
    lines.push(`- **Hour**: ${data.minutesPerHour} minutes`);
  }
  if (data.secondsPerMinute) {
    lines.push(`- **Minute**: ${data.secondsPerMinute} seconds`);
  }
  lines.push("");

  // Epoch
  lines.push("## Epoch");
  lines.push("");
  const epochMonth = data.months.find(m => m.id === data.epoch.monthId);
  const epochMonthName = epochMonth ? epochMonth.name : data.epoch.monthId;
  lines.push(`The epoch (reference point) for this calendar is set to **${epochMonthName} ${data.epoch.day}, ${data.epoch.year}**.`);

  return lines.join("\n");
}
