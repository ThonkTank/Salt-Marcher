// src/workmodes/library/locations/serializer.ts
// Markdown serialization helpers for locations

import type { LocationData } from "./types";
import { OWNER_TYPE_LABELS } from "./constants";

export function locationToMarkdown(data: LocationData): string {
    const lines: string[] = [];

    lines.push(`# ${data.name}`);
    lines.push("");

    // Overview section
    lines.push("## Overview");
    lines.push(`- **Type:** ${data.type}`);

    if (data.parent) {
        lines.push(`- **Parent Location:** ${data.parent}`);
    }

    if (data.owner_type && data.owner_type !== "none") {
        const ownerLabel = OWNER_TYPE_LABELS[data.owner_type];
        const ownerName = data.owner_name?.trim() || "—";
        lines.push(`- **Owner:** ${ownerLabel} (${ownerName})`);
    }

    if (data.region) {
        lines.push(`- **Region:** ${data.region}`);
    }

    if (data.coordinates) {
        lines.push(`- **Coordinates:** ${data.coordinates}`);
    }

    // Description section
    if (data.description) {
        lines.push("");
        lines.push("## Description");
        lines.push(data.description);
    }

    // Notes section
    if (data.notes) {
        lines.push("");
        lines.push("## Notes");
        lines.push(data.notes);
    }

    return lines.join("\n");
}
