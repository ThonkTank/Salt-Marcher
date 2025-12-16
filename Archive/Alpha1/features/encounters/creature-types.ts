// src/features/encounters/domain/creature-types.ts
// Unified creature type definitions for the entire encounter system

import type { StatblockData } from "@services/domain";
import type { TerrainType, FloraType, MoistureLevel } from "@domain";

/**
 * UNIFIED Creature Type - Single source of truth for all creature data
 *
 * This type flows through the entire encounter system without data loss.
 * Habitat preferences are preserved throughout all transformations.
 *
 * **Core Fields:**
 * - name: Creature's display name
 * - file: Path to creature markdown file in vault
 * - cr: Challenge Rating (0-30)
 * - hp: Hit points (max) as string (e.g., "10d6+5")
 * - ac: Armor Class as string (e.g., "14")
 * - type: Creature type (e.g., "Beast", "Dragon", "Humanoid")
 *
 * **Habitat Fields (Optional):**
 * - terrainPreference: Preferred terrain types (plains, hills, mountains)
 * - floraPreference: Preferred flora density (dense, medium, field, barren)
 * - moisturePreference: Preferred moisture level (desert to sea)
 * - habitatScore: Calculated score (0-100) based on tile match
 *
 * **Reference Fields:**
 * - data: Full creature statblock from markdown frontmatter
 *
 * **Data Flow:**
 * 1. **Loading:** Vault markdown → Creature (via creature-service)
 * 2. **Filtering:** Creature → Creature with habitatScore (via habitat-service)
 * 3. **Combat:** Creature → CombatCreature (adds initiative, tempHp, defeated)
 *
 * @since Phase 2 Refactoring - Unified from 5+ separate types
 */
export interface Creature {
    // Core identification
    name: string;
    file: string;

    // Combat statistics
    cr: number;
    hp: string;
    ac: string;
    type: string;

    // Habitat preferences (optional, never lost during transformations)
    terrainPreference?: TerrainType[];
    floraPreference?: FloraType[];
    moisturePreference?: MoistureLevel;

    // Calculated fields (added during processing)
    habitatScore?: number;  // 0-100, added by habitat-service

    // Full statblock for detailed information
    data: StatblockData;
}

/**
 * Combat-ready creature with runtime state
 * Extends base Creature with combat-specific fields
 */
export interface CombatCreature extends Creature {
    initiative: number;
    tempHp: number;
    currentHp: number;
    maxHp: number;
    defeated: boolean;
}

/**
 * Backend storage type configuration
 * Note: SQLite backend removed - now markdown-only
 */
export type CreatureRepositoryBackendType = "markdown";
