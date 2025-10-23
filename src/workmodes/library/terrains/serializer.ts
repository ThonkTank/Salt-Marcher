// src/workmodes/library/entities/terrains/serializer.ts
// Markdown serialization for terrain entities

import type { TerrainData } from "./types";

export function terrainToMarkdown(data: TerrainData): string {
  const lines: string[] = [];

  lines.push(`# ${data.display_name || data.name || "(default)"}`);
  lines.push("");

  if (data.name) {
    lines.push(`**Color:** ${data.color}`);
    lines.push(`**Movement Speed:** ${Math.round(data.speed * 100)}%`);
    lines.push("");

    if (data.speed < 0.5) {
      lines.push("*Very difficult terrain - significantly slows movement*");
    } else if (data.speed < 0.8) {
      lines.push("*Difficult terrain - slows movement*");
    } else if (data.speed < 1.0) {
      lines.push("*Slightly difficult terrain - minor movement penalty*");
    } else {
      lines.push("*Normal terrain - no movement penalty*");
    }
  } else {
    lines.push("Default terrain (transparent background).");
    lines.push("Used for areas without specific terrain.");
  }

  return lines.join("\n");
}
