// src/workmodes/library/core/metadata-extractor.ts
// Extracts searchable metadata from CreateSpec field definitions for all 13 entity types

import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";
import type { CreatureEntryMeta } from "../storage/data-sources";
import type { SpellEntryMeta } from "../storage/data-sources";
import type { ItemEntryMeta } from "../storage/data-sources";
import type { EquipmentEntryMeta } from "../storage/data-sources";
import type { TerrainEntryMeta } from "../storage/data-sources";
import type { RegionEntryMeta } from "../storage/data-sources";
import type { FactionEntryMeta } from "../storage/data-sources";
import type { CalendarEntryMeta } from "../storage/data-sources";
import type { LocationEntryMeta } from "../storage/data-sources";
import type { PlaylistEntryMeta } from "../storage/data-sources";
import type { EncounterTableEntryMeta } from "../storage/data-sources";
import type { CharacterEntryMeta } from "../storage/data-sources";

/**
 * Generic metadata extraction from entity data and CreateSpec fields
 * Converts field definitions to searchable/filterable metadata for library
 */
export class MetadataExtractor {
  /**
   * Extract creature metadata for indexing and filtering
   */
  static extractCreatureMetadata(data: Record<string, unknown>): CreatureEntryMeta {
    return {
      type: extractString(data.type),
      cr: extractString(data.cr),
    };
  }

  /**
   * Extract spell metadata for indexing and filtering
   */
  static extractSpellMetadata(data: Record<string, unknown>): SpellEntryMeta {
    return {
      school: extractString(data.school),
      level: extractNumber(data.level),
      casting_time: extractString(data.casting_time),
      duration: extractString(data.duration),
      concentration: extractBoolean(data.concentration),
      ritual: extractBoolean(data.ritual),
      description: extractString(data.description),
    };
  }

  /**
   * Extract item metadata for indexing and filtering
   */
  static extractItemMetadata(data: Record<string, unknown>): ItemEntryMeta {
    return {
      category: extractString(data.category),
      rarity: extractString(data.rarity),
    };
  }

  /**
   * Extract equipment metadata for indexing and filtering
   */
  static extractEquipmentMetadata(data: Record<string, unknown>): EquipmentEntryMeta {
    // Try multiple possible fields for role/category
    const role = extractString(data.role)
      ?? extractString(data.weapon_category)
      ?? extractString(data.armor_category)
      ?? extractString(data.tool_category)
      ?? extractString(data.gear_category);

    return {
      type: extractString(data.type),
      role,
    };
  }

  /**
   * Extract terrain metadata for indexing and filtering
   */
  static extractTerrainMetadata(data: Record<string, unknown>): TerrainEntryMeta {
    return {
      color: extractString(data.color) ?? "transparent",
      speed: extractNumber(data.speed) ?? 1.0,
    };
  }

  /**
   * Extract region metadata for indexing and filtering
   */
  static extractRegionMetadata(data: Record<string, unknown>): RegionEntryMeta {
    return {
      terrain: extractString(data.terrain) ?? "",
      encounterOdds: extractNumber(data.encounter_odds),
    };
  }

  /**
   * Extract faction metadata for indexing and filtering
   */
  static extractFactionMetadata(data: Record<string, unknown>): FactionEntryMeta {
    const members = Array.isArray(data.members) ? data.members : [];
    const influenceTags = extractTokenValues(data.influence_tags);

    return {
      influence: influenceTags[0],
      headquarters: extractString(data.headquarters),
      memberCount: members.length,
    };
  }

  /**
   * Extract calendar metadata for indexing and filtering
   */
  static extractCalendarMetadata(data: Record<string, unknown>): CalendarEntryMeta {
    const months = Array.isArray(data.months) ? data.months : [];

    return {
      id: extractString(data.id) ?? "",
      daysPerWeek: extractNumber(data.daysPerWeek) ?? 7,
      monthCount: months.length,
    };
  }

  /**
   * Extract location metadata for indexing and filtering
   */
  static extractLocationMetadata(data: Record<string, unknown>): LocationEntryMeta {
    const locationType = extractString(data.type) ?? "Unknown";
    const ownerType = extractString(data.owner_type) ?? "none";
    const ownerName = extractString(data.owner_name) ?? "";
    const owner = ownerType !== "none" && ownerName ? `${ownerType}: ${ownerName}` : undefined;

    let gridSize: string | undefined = undefined;
    if (locationType === "Dungeon") {
      const gridWidth = extractNumber(data.grid_width);
      const gridHeight = extractNumber(data.grid_height);
      if (gridWidth && gridHeight) {
        gridSize = `${gridWidth}×${gridHeight}`;
      }
    }

    return {
      type: locationType,
      owner,
      parent: extractString(data.parent),
      grid_size: gridSize,
    };
  }

  /**
   * Extract playlist metadata for indexing and filtering
   */
  static extractPlaylistMetadata(data: Record<string, unknown>): PlaylistEntryMeta {
    const type = extractString(data.type) ?? "ambience";
    const tracks = Array.isArray(data.tracks) ? data.tracks : [];

    return {
      type: type === "music" ? "music" : "ambience",
      track_count: tracks.length,
      terrain_tags: extractTokenValues(data.terrain_tags),
      weather_tags: extractTokenValues(data.weather_tags),
      time_of_day_tags: extractTokenValues(data.time_of_day_tags),
      faction_tags: extractTokenValues(data.faction_tags),
      situation_tags: extractTokenValues(data.situation_tags),
    };
  }

  /**
   * Extract encounter table metadata for indexing and filtering
   */
  static extractEncounterTableMetadata(data: Record<string, unknown>): EncounterTableEntryMeta {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const crRange = data.crRange && typeof data.crRange === "object"
      ? {
          min: extractNumber((data.crRange as any).min),
          max: extractNumber((data.crRange as any).max),
        }
      : undefined;

    return {
      entry_count: entries.length,
      terrain_tags: extractTokenValues(data.terrain_tags),
      weather_tags: extractTokenValues(data.weather_tags),
      time_of_day_tags: extractTokenValues(data.time_of_day_tags),
      faction_tags: extractTokenValues(data.faction_tags),
      situation_tags: extractTokenValues(data.situation_tags),
      crRange,
    };
  }

  /**
   * Extract character metadata for indexing and filtering
   */
  static extractCharacterMetadata(data: Record<string, unknown>): CharacterEntryMeta {
    return {
      level: extractNumber(data.level) ?? 1,
      characterClass: extractString(data.characterClass) ?? "Unknown",
      maxHp: extractNumber(data.maxHp) ?? 0,
      ac: extractNumber(data.ac) ?? 10,
    };
  }

  /**
   * Build searchable text from field definitions for full-text search
   */
  static buildSearchableText(data: Record<string, unknown>, fields: AnyFieldSpec[]): string {
    const parts: string[] = [];

    // Always include name
    if (typeof data.name === "string") {
      parts.push(data.name);
    }

    // Walk through fields and collect all string/text values
    for (const field of fields) {
      const value = data[field.id];
      if (value === null || value === undefined) continue;

      // Handle different field types
      if (typeof value === "string") {
        parts.push(value);
      } else if (typeof value === "number") {
        parts.push(String(value));
      } else if (Array.isArray(value)) {
        // Extract strings from arrays (tokens, multiselect, etc)
        for (const item of value) {
          if (typeof item === "string") {
            parts.push(item);
          } else if (item && typeof item === "object") {
            const text = (item as any).value ?? (item as any).label ?? String(item);
            if (typeof text === "string") {
              parts.push(text);
            }
          }
        }
      } else if (typeof value === "object") {
        // Handle composite objects (abilities, etc)
        const strVal = Object.values(value)
          .map(v => typeof v === "string" ? v : String(v))
          .filter(v => v && v !== "undefined")
          .join(" ");
        if (strVal) parts.push(strVal);
      }
    }

    return parts.filter(p => p && p.trim()).join(" ");
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR TYPE CONVERSION
// ============================================================================

function extractString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function extractNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return undefined;
}

function extractBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return undefined;
}

function extractTokenValues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      result.push(entry.trim());
    } else if (entry && typeof entry === "object") {
      const value = (entry as Record<string, unknown>).value;
      if (typeof value === "string" && value.trim()) {
        result.push(value.trim());
      }
    }
  }
  return result;
}
