/**
 * Library Domain Types
 *
 * Shared library type definitions used across workmodes and features.
 * These types define the structure of library entities and data sources.
 *
 * Note: This file contains ONLY types. Runtime implementations (data sources,
 * caching, loaders) remain in the library workmode.
 *
 * @module services/domain/library-types
 */

import type { BaseEntry, DataSource } from "@features/data-manager";

/**
 * Library entity types that support filtering and browsing
 */
export type FilterableLibraryMode =
  | "creatures"
  | "spells"
  | "items"
  | "equipment"
  | "terrains"
  | "regions"
  | "factions"
  | "calendars"
  | "locations"
  | "playlists"
  | "encounter-tables"
  | "characters";

/**
 * Entity-specific metadata interfaces
 */
export interface CreatureEntryMeta {
  readonly type?: string;
  readonly cr?: string;
}

export interface SpellEntryMeta {
  readonly school?: string;
  readonly level?: number;
  readonly casting_time?: string;
  readonly duration?: string;
  readonly concentration?: boolean;
  readonly ritual?: boolean;
  readonly description?: string;
}

export interface ItemEntryMeta {
  readonly category?: string;
  readonly rarity?: string;
}

export interface EquipmentEntryMeta {
  readonly type?: string;
  readonly role?: string;
}

export interface TerrainEntryMeta {
  readonly color: string;
  readonly speed: number;
}

export interface RegionEntryMeta {
  readonly terrain: string;
  readonly encounterOdds?: number;
}

export interface FactionEntryMeta {
  readonly influence?: string;
  readonly headquarters?: string;
  readonly memberCount: number;
}

export interface CalendarEntryMeta {
  readonly id: string;
  readonly daysPerWeek: number;
  readonly monthCount?: number;
}

export interface LocationEntryMeta {
  readonly type: string;
  readonly owner?: string;
  readonly parent?: string;
  readonly grid_size?: string; // For dungeons: "30×20"
}

export interface PlaylistEntryMeta {
  readonly type: "ambience" | "music";
  readonly track_count: number;
  readonly terrain_tags?: string[];
  readonly weather_tags?: string[];
  readonly time_of_day_tags?: string[];
  readonly faction_tags?: string[];
  readonly situation_tags?: string[];
}

export interface EncounterTableEntryMeta {
  readonly entry_count: number;
  readonly terrain_tags?: string[];
  readonly weather_tags?: string[];
  readonly time_of_day_tags?: string[];
  readonly faction_tags?: string[];
  readonly situation_tags?: string[];
  readonly crRange?: {
    min?: number;
    max?: number;
  };
}

export interface CharacterEntryMeta {
  readonly level: number;
  readonly characterClass: string;
  readonly maxHp: number;
  readonly ac: number;
}

/**
 * Maps library modes to their metadata types
 */
export interface LibraryEntryMetaMap {
  creatures: CreatureEntryMeta;
  spells: SpellEntryMeta;
  items: ItemEntryMeta;
  equipment: EquipmentEntryMeta;
  terrains: TerrainEntryMeta;
  regions: RegionEntryMeta;
  factions: FactionEntryMeta;
  calendars: CalendarEntryMeta;
  locations: LocationEntryMeta;
  playlists: PlaylistEntryMeta;
  "encounter-tables": EncounterTableEntryMeta;
  characters: CharacterEntryMeta;
}

/**
 * Library entry type - combines base entry with mode-specific metadata
 */
export type LibraryEntry<M extends FilterableLibraryMode> = BaseEntry & LibraryEntryMetaMap[M];

/**
 * Maps library modes to their data source types
 */
export type LibraryDataSourceMap = {
  [M in FilterableLibraryMode]: DataSource<M, LibraryEntry<M>>;
};
