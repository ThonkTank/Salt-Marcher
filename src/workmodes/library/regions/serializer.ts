// src/workmodes/library/entities/regions/serializer.ts
// Markdown serialization for region entities

import type { RegionData } from "./types";

export function regionToMarkdown(data: RegionData): string {
  const lines: string[] = [];

  lines.push(`# ${data.name}`);
  lines.push("");

  if (data.terrain) {
    lines.push(`**Terrain:** ${data.terrain}`);
  }

  if (data.encounter_odds && data.encounter_odds > 0) {
    lines.push(`**Encounter Rate:** 1/${data.encounter_odds}`);

    // Add descriptive text based on odds
    if (data.encounter_odds <= 2) {
      lines.push("*Very dangerous - encounters are very frequent*");
    } else if (data.encounter_odds <= 4) {
      lines.push("*Dangerous - encounters are frequent*");
    } else if (data.encounter_odds <= 8) {
      lines.push("*Moderate danger - occasional encounters*");
    } else if (data.encounter_odds <= 12) {
      lines.push("*Relatively safe - encounters are rare*");
    } else {
      lines.push("*Very safe - encounters are very rare*");
    }
  } else {
    lines.push("**Encounter Rate:** None");
    lines.push("*Safe zone - no random encounters*");
  }

  if (data.description) {
    lines.push("");
    lines.push("## Description");
    lines.push(data.description);
  }

  return lines.join("\n");
}
