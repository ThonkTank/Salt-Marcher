// src/features/maps/config/terrain.ts

/**
 * Terrain Icon System
 *
 * Terrain representation using dual-layer icons (Terrain + Flora) instead of colored fills.
 *
 * Architecture:
 * - Terrain (Bodenbeschaffenheit): Physical ground type (plains, hills, mountains)
 * - Flora (Biom): Vegetation coverage (dense, medium, field, barren)
 * - Background: Optional colored hex fill (toggleable, for visual clarity)
 *
 * Icons:
 * - Emoji placeholders during development (🏞️🌲)
 * - SVG symbols for production (defined in icon-registry.ts)
 * - Rendering: SVG <use> elements for performance
 */

// ============================================================================
// Type Definitions (Re-exported from @domain for convenience grouping)
// ============================================================================

// Types come from the domain service but are re-exported here alongside
// terrain-specific constants (TERRAIN_ICONS, FLORA_ICONS) for convenient imports.
// Canonical source: @services/domain/terrain-types
import type { TerrainType, FloraType, MoistureLevel, IconDefinition } from "@domain";
export type { TerrainType, FloraType, MoistureLevel, IconDefinition };

// ============================================================================
// Icon Registries
// ============================================================================

export const TERRAIN_ICONS: Readonly<Record<TerrainType, IconDefinition>> = Object.freeze({
    plains: {
        emoji: "🏞️",
        svg: "terrain-plains",
        label: "Ebene"
    },
    hills: {
        emoji: "🏔️",
        svg: "terrain-hills",
        label: "Hügel"
    },
    mountains: {
        emoji: "⛰️",
        svg: "terrain-mountains",
        label: "Berge"
    }
});

export const FLORA_ICONS: Readonly<Record<FloraType, IconDefinition>> = Object.freeze({
    dense: {
        emoji: "🌲",
        svg: "flora-dense",
        label: "Dicht bewachsen"
    },
    medium: {
        emoji: "🌳",
        svg: "flora-medium",
        label: "Mittelmäßig bewachsen"
    },
    field: {
        emoji: "🌾",
        svg: "flora-field",
        label: "Feld"
    },
    barren: {
        emoji: "🏜️",
        svg: "flora-barren",
        label: "Karg"
    }
});

// ============================================================================
// Terrain Base Colors
// ============================================================================

/**
 * Base colors for terrain types (ground surface).
 * These provide the foundational hex fill color that flora modifies.
 *
 * Design (lighter colors for better symbol contrast):
 * - Plains: Light grass green (#a5d6a7)
 * - Hills: Light tan/beige (#c5b5a8)
 * - Mountains: Medium gray (#9e9e9e)
 */
export const TERRAIN_BASE_COLORS: Readonly<Record<TerrainType, string>> = Object.freeze({
    plains: "#a5d6a7",      // Light grass green
    hills: "#c5b5a8",       // Light tan/beige
    mountains: "#9e9e9e"    // Medium gray
});

/**
 * Flora colors for symbol tinting and terrain color modification.
 *
 * Design (lighter colors for better blending with terrain):
 * - Dense: Medium forest green (#66bb6a)
 * - Medium: Light green (#9ccc65)
 * - Field: Pale yellow-green (#c5e1a5)
 * - Barren: Light brown (#a1887f)
 */
export const FLORA_COLORS: Readonly<Record<FloraType, string>> = Object.freeze({
    dense: "#66bb6a",       // Medium forest green
    medium: "#9ccc65",      // Light green
    field: "#c5e1a5",       // Pale yellow-green
    barren: "#a1887f"       // Light brown
});

// ============================================================================
// Moisture Colors & Labels
// ============================================================================

/**
 * Colors for moisture levels (tan → blue gradient).
 * Designed for overlay visualization with varying opacity based on noise patterns.
 *
 * Design progression:
 * - Desert/Dry: Tan/brown tones (minimal water)
 * - Lush: Light cyan-green (well-watered vegetation)
 * - Marshy → Sea: Progressively deeper blue (increasing water presence)
 * - Flood plains: Bright blue (temporary high water)
 */
export const MOISTURE_COLORS: Readonly<Record<MoistureLevel, string>> = Object.freeze({
    desert: "#f4e4c1",      // Tan/sand
    dry: "#d4c5a9",         // Light brown
    lush: "#a8d5ba",        // Light cyan-green
    marshy: "#7fc8d1",      // Pale blue
    swampy: "#5ab3c4",      // Medium blue
    ponds: "#3d9db7",       // Darker blue
    lakes: "#2a7f9e",       // Deep blue
    large_lake: "#1a5f7a",  // Very deep blue
    sea: "#0d3d56",         // Navy blue
    flood_plains: "#6fb3d2" // Bright blue (seasonal)
});

/**
 * German UI labels for moisture levels.
 * Used in Cartographer UI (terrain brush, inspector) and creature habitat preferences.
 */
export const MOISTURE_LABELS: Readonly<Record<MoistureLevel, string>> = Object.freeze({
    desert: "Wüste",
    dry: "Trocken",
    lush: "Saftig",
    marshy: "Sumpfig",
    swampy: "Versumpft",
    ponds: "Teiche",
    lakes: "Seen",
    large_lake: "Großer See",
    sea: "Meer",
    flood_plains: "Überschwemmungsgebiet"
});

/**
 * Numeric midpoint for each moisture level (for legacy compatibility).
 * Used when converting from continuous 0.0-1.0 scale or for internal calculations.
 */
export const MOISTURE_MIDPOINTS: Readonly<Record<MoistureLevel, number>> = Object.freeze({
    desert: 0.05,
    dry: 0.15,
    lush: 0.30,
    marshy: 0.50,
    swampy: 0.65,
    ponds: 0.725,
    lakes: 0.775,
    large_lake: 0.825,
    sea: 0.90,
    flood_plains: 0.975
});

// ============================================================================
// Background Colors (Optional Layer - Legacy)
// ============================================================================

/**
 * Optional colored background fills for hexes.
 * User-configurable, toggleable in UI.
 * Low opacity (0.1) to not interfere with icons.
 *
 * NOTE: This is legacy system for region-based coloring.
 * Terrain base colors (above) are now primary coloring mechanism.
 */
export const DEFAULT_BACKGROUND_COLORS = Object.freeze({
    "": "transparent",
    forest: "#2e7d32",      // Green
    ocean: "#0288d1",       // Blue
    desert: "#fdd835",      // Yellow
    mountain: "#6d4c41",    // Brown
    arctic: "#e1f5fe",      // Light blue
    volcanic: "#d32f2f"     // Red
}) as const;

export const BACKGROUND_COLORS: Record<string, string> = { ...DEFAULT_BACKGROUND_COLORS };

// ============================================================================
// Movement Speed Modifiers
// ============================================================================

/**
 * Movement speed modifiers based on terrain type.
 * Used by Session Runner travel system.
 * Value: 1.0 = normal speed, 0.5 = half speed, etc.
 */
export const TERRAIN_SPEED_MODIFIERS: Readonly<Record<TerrainType, number>> = Object.freeze({
    plains: 1.0,        // Full speed (baseline)
    hills: 0.5,         // 2x slower than plains
    mountains: 0.125    // 8x slower than plains
});

export const FLORA_SPEED_MODIFIERS: Readonly<Record<FloraType, number>> = Object.freeze({
    barren: 1.0,        // Full speed (baseline, no obstacles)
    field: 1.0,         // Full speed (light vegetation has no effect)
    medium: 0.5,        // 2x slower than barren
    dense: 0.25         // 4x slower than barren
});

/**
 * Calculate movement speed for a hex based on terrain and flora.
 * Uses the LOWEST modifier (slowest condition) between terrain and flora.
 *
 * Logic: Math.min(terrain_modifier, flora_modifier)
 * - Takes the most restrictive condition (mountains OR dense forest determines speed)
 * - Baseline: plains (1.0) + barren/field (1.0) = full speed
 * - Example: mountains (0.125) + dense (0.25) = 0.125 (mountains dominate)
 *
 * Note: Moisture is currently ignored (not used in speed calculation).
 */
export function getMovementSpeed(
    terrain?: TerrainType,
    flora?: FloraType,
    moisture?: MoistureLevel
): number {
    const terrainMod = terrain ? TERRAIN_SPEED_MODIFIERS[terrain] : 1.0;
    const floraMod = flora ? FLORA_SPEED_MODIFIERS[flora] : 1.0;

    // Use the lowest modifier (most restrictive condition)
    return Math.min(terrainMod, floraMod);
}

// ============================================================================
// Moisture Level Helpers
// ============================================================================

/**
 * Get moisture level from numeric value (0.0-1.0).
 * Used for converting legacy continuous moisture values or gradient brush input.
 *
 * Boundary logic: Each level owns its range [min, max).
 * Example: 0.40 → "marshy", 0.60 → "swampy"
 */
export function getMoistureLevel(value: number): MoistureLevel {
    if (value < 0.10) return "desert";
    if (value < 0.20) return "dry";
    if (value < 0.40) return "lush";
    if (value < 0.60) return "marshy";
    if (value < 0.70) return "swampy";
    if (value < 0.75) return "ponds";
    if (value < 0.80) return "lakes";
    if (value < 0.85) return "large_lake";
    if (value < 0.95) return "sea";
    return "flood_plains";
}

/**
 * Get numeric midpoint for moisture level (0.0-1.0).
 * Used for internal calculations or displaying approximate numeric values.
 */
export function getMoistureMidpoint(level: MoistureLevel): number {
    return MOISTURE_MIDPOINTS[level];
}

/**
 * Get color for moisture level.
 */
export function getMoistureColor(moisture?: MoistureLevel): string | undefined {
    return moisture ? MOISTURE_COLORS[moisture] : undefined;
}

/**
 * Get label for moisture level (German).
 */
export function getMoistureLabel(moisture?: MoistureLevel): string | undefined {
    return moisture ? MOISTURE_LABELS[moisture] : undefined;
}

/**
 * Get all moisture levels (for UI selectors).
 */
export function getMoistureLevels(): MoistureLevel[] {
    return [
        "desert",
        "dry",
        "lush",
        "marshy",
        "swampy",
        "ponds",
        "lakes",
        "large_lake",
        "sea",
        "flood_plains"
    ];
}

// ============================================================================
// Validation
// ============================================================================

const COLOR_NAME_MAX_LENGTH = 64;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_VAR_RE = /^var\(--[a-z0-9_-]+\)$/i;
const CSS_FUNCTION_RE = /^(?:rgb|rgba|hsl|hsla)\(/i;

function normalizeColor(input: unknown): string {
    if (typeof input !== "string") return "";

    let color = input.trim();
    if (!color) return "";

    // Remove quotes
    if (
        (color.startsWith("\"") && color.endsWith("\"")) ||
        (color.startsWith("'") && color.endsWith("'"))
    ) {
        color = color.slice(1, -1).trim();
    }

    // Remove leading colons/spaces
    color = color.replace(/^[\s:]+/, "");

    return color.trim();
}

export class BackgroundColorValidationError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Invalid background color schema: ${issues.join(", ")}`);
        this.name = "BackgroundColorValidationError";
    }
}

/**
 * Validate and normalize background color palette.
 * Used when user customizes background colors.
 */
export function validateBackgroundColors(
    next: Record<string, string>
): Record<string, string> {
    const validated: Record<string, string> = {};
    const issues: string[] = [];

    for (const [rawName, rawColor] of Object.entries(next ?? {})) {
        const name = (rawName ?? "").trim();
        const color = normalizeColor(rawColor);

        if (!name && rawName !== "") {
            issues.push(`Color name must not be empty (received: "${rawName}")`);
            continue;
        }
        if (name.length > COLOR_NAME_MAX_LENGTH) {
            issues.push(`Color name "${name}" exceeds ${COLOR_NAME_MAX_LENGTH} characters`);
            continue;
        }
        if (/[:\n\r]/.test(name)) {
            issues.push(`Color name "${name}" must not contain colons or line breaks`);
            continue;
        }

        if (!color) {
            issues.push(`Color "${name}" requires a value`);
            continue;
        }
        if (
            color !== "transparent" &&
            !HEX_COLOR_RE.test(color) &&
            !CSS_VAR_RE.test(color) &&
            !CSS_FUNCTION_RE.test(color)
        ) {
            issues.push(`Color "${name}" uses unsupported value "${color}"`);
            continue;
        }

        validated[name] = color;
    }

    // Ensure empty color exists
    if (!("" in validated)) {
        validated[""] = "transparent";
    }

    if (issues.length) {
        throw new BackgroundColorValidationError(issues);
    }

    return validated;
}

/**
 * Update background color palette (user-configurable).
 * Replaces all background colors with new palette.
 */
export function setBackgroundColorPalette(next: Record<string, string>) {
    const validated = validateBackgroundColors(next ?? {});

    // Clear old colors
    for (const key of Object.keys(BACKGROUND_COLORS)) {
        if (!(key in validated)) delete BACKGROUND_COLORS[key];
    }

    // Apply new colors
    Object.assign(BACKGROUND_COLORS, validated);
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTerrainType(value: unknown): value is TerrainType {
    return typeof value === "string" && value in TERRAIN_ICONS;
}

export function isFloraType(value: unknown): value is FloraType {
    return typeof value === "string" && value in FLORA_ICONS;
}

export function isMoistureLevel(value: unknown): value is MoistureLevel {
    return typeof value === "string" && value in MOISTURE_COLORS;
}

// ============================================================================
// Icon Helpers
// ============================================================================

/**
 * Get icon definition for terrain type.
 * Returns undefined if terrain is not set.
 */
export function getTerrainIcon(terrain?: TerrainType): IconDefinition | undefined {
    return terrain ? TERRAIN_ICONS[terrain] : undefined;
}

/**
 * Get icon definition for flora type.
 * Returns undefined if flora is not set.
 */
export function getFloraIcon(flora?: FloraType): IconDefinition | undefined {
    return flora ? FLORA_ICONS[flora] : undefined;
}

/**
 * Get all terrain types (for UI selectors).
 */
export function getTerrainTypes(): TerrainType[] {
    return Object.keys(TERRAIN_ICONS) as TerrainType[];
}

/**
 * Get all flora types (for UI selectors).
 */
export function getFloraTypes(): FloraType[] {
    return Object.keys(FLORA_ICONS) as FloraType[];
}

/**
 * Get all background color names (for UI selectors).
 */
export function getBackgroundColorNames(): string[] {
    return Object.keys(BACKGROUND_COLORS).filter(name => name !== "");
}

/**
 * Get base color for terrain type.
 */
export function getTerrainBaseColor(terrain?: TerrainType): string | undefined {
    return terrain ? TERRAIN_BASE_COLORS[terrain] : undefined;
}

/**
 * Get color for flora type.
 */
export function getFloraColor(flora?: FloraType): string | undefined {
    return flora ? FLORA_COLORS[flora] : undefined;
}

