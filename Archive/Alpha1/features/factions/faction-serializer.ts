// src/features/factions/faction-serializer.ts
// Markdown serialization helpers for factions
// Simplified after plan system removal

import type { FactionData, FactionMember, FactionResources, FactionRelationship } from "@services/domain";

function formatTagList(values?: Array<{ value: string }> | null): string {
  if (!values || values.length === 0) return "—";
  const items = values
    .map((entry) => (typeof entry === "object" && entry ? entry.value : undefined))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return items.length > 0 ? items.join(", ") : "—";
}

function formatResources(resources?: FactionResources): string {
  if (!resources || Object.keys(resources).length === 0) return "—";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(resources)) {
    if (value !== undefined) {
      lines.push(`- **${key}**: ${value}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "—";
}

function formatRelationship(rel: FactionRelationship): string {
  const parts: string[] = [];
  parts.push(`**${rel.faction_name}**`);

  const value = rel.value >= 0 ? `+${rel.value}` : `${rel.value}`;
  parts.push(`(${value})`);

  if (rel.type) {
    parts.push(`[${rel.type}]`);
  }

  if (rel.notes) {
    parts.push(`— ${rel.notes}`);
  }

  return parts.join(" ");
}

function formatPosition(member: FactionMember): string | null {
  if (!member.position || member.position.type === "unassigned") return null;

  const pos = member.position;
  switch (pos.type) {
    case "hex":
      if (pos.coords) {
        return `Hex (${pos.coords.q}, ${pos.coords.r}, ${pos.coords.s})`;
      }
      return "Hex";
    case "poi":
      return pos.location_name || "POI";
    case "expedition":
      return pos.route ? `Expedition: ${pos.route}` : "Expedition";
    default:
      return null;
  }
}

function formatJob(member: FactionMember): string | null {
  if (!member.job || !member.job.type) return null;

  const parts: string[] = [member.job.type];
  if (member.job.building) {
    parts.push(`at ${member.job.building}`);
  }
  if (member.job.progress !== undefined) {
    parts.push(`(${member.job.progress}%)`);
  }
  return parts.join(" ");
}

function formatMember(member: FactionMember): string {
  const parts: string[] = [];
  const name = member.name?.trim();
  if (name) {
    parts.push(`**${name}**`);
  }

  const details: string[] = [];

  // Quantity for unit types
  if (!member.is_named && member.quantity && member.quantity > 1) {
    details.push(`×${member.quantity}`);
  }

  // Statblock reference
  if (member.statblock_ref) {
    details.push(`[${member.statblock_ref}]`);
  }

  if (member.role) {
    details.push(member.role);
  }
  if (member.status) {
    details.push(member.status);
  }

  if (details.length > 0) {
    parts.push(`(${details.join(" · ")})`);
  }

  // Position
  const position = formatPosition(member);
  if (position) {
    parts.push(`📍 ${position}`);
  }

  // Job
  const job = formatJob(member);
  if (job) {
    parts.push(`💼 ${job}`);
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

  // Resources (new structured format)
  if (data.resources && Object.keys(data.resources).length > 0) {
    lines.push("");
    lines.push("## Resources");
    lines.push(formatResources(data.resources));
  } else if (data.assets) {
    // Legacy assets field
    lines.push("");
    lines.push("## Assets & Resources");
    lines.push(data.assets);
  }

  // Relationships (new structured format)
  if (data.faction_relationships && data.faction_relationships.length > 0) {
    lines.push("");
    lines.push("## Faction Relationships");
    lines.push("");
    for (const rel of data.faction_relationships) {
      if (!rel || !rel.faction_name) continue;
      lines.push(`- ${formatRelationship(rel)}`);
    }
  } else if (data.relationships) {
    // Legacy relationships field
    lines.push("");
    lines.push("## Relationships");
    lines.push(data.relationships);
  }

  if (data.members && data.members.length > 0) {
    lines.push("");
    lines.push("## Members & Units");
    lines.push("");
    for (const member of data.members) {
      if (!member || !member.name) continue;
      lines.push(`- ${formatMember(member)}`);
    }
  }

  return lines.join("\n");
}
