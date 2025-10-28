// src/workmodes/library/entities/factions/serializer.ts
// Markdown serialization helpers for factions

import type { FactionData, FactionMember } from "./types";

function formatTagList(values?: Array<{ value: string }> | null): string {
  if (!values || values.length === 0) return "—";
  const items = values
    .map((entry) => (typeof entry === "object" && entry ? entry.value : undefined))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return items.length > 0 ? items.join(", ") : "—";
}

function formatMember(member: FactionMember): string {
  const parts: string[] = [];
  const name = member.name?.trim();
  if (name) {
    parts.push(`**${name}**`);
  }

  const details: string[] = [];
  if (member.role) {
    details.push(member.role);
  }
  if (member.status) {
    details.push(member.status);
  }
  if (member.is_named !== undefined) {
    details.push(member.is_named ? "Named" : "Anonymous");
  }

  if (details.length > 0) {
    parts.push(`(${details.join(" · ")})`);
  }

  if (member.notes) {
    parts.push(`— ${member.notes}`);
  }

  return parts.join(" ");
}

export function factionToMarkdown(data: FactionData): string {
  const lines: string[] = [];

  lines.push(`# ${data.name}`);
  lines.push("");

  if (data.motto) {
    lines.push(`> ${data.motto}`);
    lines.push("");
  }

  lines.push("## Overview");
  lines.push(`- **Headquarters:** ${data.headquarters?.trim() || "—"}`);
  lines.push(`- **Territory:** ${data.territory?.trim() || "—"}`);
  lines.push(`- **Influence:** ${formatTagList(data.influence_tags)}`);
  lines.push(`- **Culture:** ${formatTagList(data.culture_tags)}`);
  lines.push(`- **Goals:** ${formatTagList(data.goal_tags)}`);

  if (data.summary) {
    lines.push("");
    lines.push("## Summary");
    lines.push(data.summary);
  }

  if (data.assets) {
    lines.push("");
    lines.push("## Assets & Resources");
    lines.push(data.assets);
  }

  if (data.relationships) {
    lines.push("");
    lines.push("## Relationships");
    lines.push(data.relationships);
  }

  if (data.members && data.members.length > 0) {
    lines.push("");
    lines.push("## Notable Members");
    lines.push("");
    for (const member of data.members) {
      if (!member || !member.name) continue;
      lines.push(`- ${formatMember(member)}`);
    }
  }

  return lines.join("\n");
}
