// src/workmodes/library/locations/serializer.ts
// Markdown serialization helpers for locations

import type { LocationData, DungeonRoom, DungeonDoor, DungeonFeature, DungeonToken } from "./types";
import { OWNER_TYPE_LABELS } from "./constants";
import { getFeatureTypePrefix, getFeatureTypeLabel, isDungeonLocation, isBuildingLocation } from "./types";
import { BUILDING_TEMPLATES } from "../../../features/locations/building-production";

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

    // Dungeon-specific: Grid configuration
    if (isDungeonLocation(data)) {
        lines.push(`- **Grid Size:** ${data.grid_width}×${data.grid_height}`);
        if (data.cell_size && data.cell_size !== 40) {
            lines.push(`- **Cell Size:** ${data.cell_size}px`);
        }
    }

    // Description section
    if (data.description) {
        lines.push("");
        lines.push("## Description");
        lines.push(data.description);
    }

    // Building-specific: Production Status section
    if (isBuildingLocation(data)) {
        lines.push("");
        lines.push("## Building Production");
        const production = data.building_production;
        const template = BUILDING_TEMPLATES[production.buildingType];

        if (template) {
            lines.push(`- **Building Type:** ${template.name}`);
            lines.push(`- **Category:** ${template.category}`);
            lines.push(`- **Condition:** ${production.condition}%`);
            lines.push(`- **Maintenance Overdue:** ${production.maintenanceOverdue} days`);
            lines.push(`- **Workers:** ${production.currentWorkers}/${template.maxWorkers}`);

            if (production.activeJobs.length > 0) {
                lines.push("");
                lines.push("**Active Jobs:**");
                for (const job of production.activeJobs) {
                    lines.push(`- ${job.workerName}: ${job.jobType} (${job.progress}%)`);
                }
            }

            const hasProduction = Object.values(production.periodProduction).some(v => v && v > 0);
            if (hasProduction) {
                lines.push("");
                lines.push("**Period Production:**");
                if (production.periodProduction.gold) lines.push(`- Gold: ${production.periodProduction.gold}`);
                if (production.periodProduction.food) lines.push(`- Food: ${production.periodProduction.food}`);
                if (production.periodProduction.equipment) lines.push(`- Equipment: ${production.periodProduction.equipment}`);
                if (production.periodProduction.magic) lines.push(`- Magic: ${production.periodProduction.magic}`);
                if (production.periodProduction.influence) lines.push(`- Influence: ${production.periodProduction.influence}`);
            }
        }
    }

    // Dungeon-specific: Rooms section
    if (isDungeonLocation(data) && data.rooms && data.rooms.length > 0) {
        lines.push("");
        lines.push("## Rooms");
        lines.push("");
        for (const room of data.rooms) {
            serializeRoom(room, lines);
        }
    }

    // Dungeon-specific: Tokens section
    if (isDungeonLocation(data) && data.tokens && data.tokens.length > 0) {
        lines.push("");
        lines.push("## Tokens");
        lines.push("");
        for (const token of data.tokens) {
            serializeToken(token, lines);
        }
    }

    // Notes section
    if (data.notes) {
        lines.push("");
        lines.push("## Notes");
        lines.push(data.notes);
    }

    return lines.join("\n");
}

function serializeRoom(room: DungeonRoom, lines: string[]): void {
    // Room header
    lines.push(`### Room ${room.id}: ${room.name}`);
    lines.push("");

    // Bounds
    const { x, y, width, height } = room.grid_bounds;
    lines.push(`**Bounds:** (${x},${y}) → (${x + width},${y + height})`);
    lines.push("");

    // Description
    if (room.description) {
        lines.push("**Description:**");
        lines.push(room.description);
        lines.push("");
    }

    // Doors
    if (room.doors && room.doors.length > 0) {
        lines.push("**Doors:**");
        for (const door of room.doors) {
            serializeDoor(door, lines);
        }
        lines.push("");
    }

    // Features
    if (room.features && room.features.length > 0) {
        lines.push("**Features:**");
        for (const feature of room.features) {
            serializeFeature(feature, lines);
        }
        lines.push("");
    }
}

function serializeDoor(door: DungeonDoor, lines: string[]): void {
    let line = `- **${door.id}** (${door.position.x},${door.position.y})`;

    if (door.locked) {
        line += " 🔒";
    }

    if (door.leads_to) {
        line += ` → ${door.leads_to}`;
    }

    if (door.description) {
        line += `: ${door.description}`;
    }

    lines.push(line);
}

function serializeFeature(feature: DungeonFeature, lines: string[]): void {
    const prefix = getFeatureTypePrefix(feature.type);
    const label = getFeatureTypeLabel(feature.type);
    const line = `- **${prefix}${feature.id}** (${label}, ${feature.position.x},${feature.position.y}): ${feature.description}`;
    lines.push(line);
}

function serializeToken(token: DungeonToken, lines: string[]): void {
    let line = `- **${token.label}** (${token.type}, ${token.position.x},${token.position.y})`;

    if (token.color) {
        line += ` [${token.color}]`;
    }

    if (token.size && token.size !== 1.0) {
        line += ` size=${token.size}`;
    }

    lines.push(line);
}
