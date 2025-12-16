// src/features/maps/rendering/icons/icon-registry.ts

/**
 * SVG Symbol Registry
 *
 * Manages SVG <symbol> definitions for terrain and flora icons.
 * Uses performant SVG <symbol> + <use> pattern:
 * - Define each icon once in <defs> block
 * - Reuse via <use href="#symbol-id"> (minimal DOM nodes)
 * - Hardware-accelerated rendering
 *
 * Architecture:
 * - Icons defined as SVG path data (for future custom graphics)
 * - Currently using placeholder simple shapes
 * - Emoji fallback when SVG not available
 */

import type { TerrainType, FloraType, MoistureLevel } from "../../config/terrain";

// ============================================================================
// Type Definitions
// ============================================================================

export interface IconSymbolDefinition {
    id: string;           // Symbol ID (e.g., "terrain-plains")
    viewBox: string;      // SVG viewBox (e.g., "0 0 24 24")
    path: string;         // SVG path data
    variantCount?: number; // Number of variants available (default: 1)
}

// ============================================================================
// Symbol Registry
// ============================================================================

/**
 * Terrain icon symbols (outline-based, black 1px stroke).
 *
 * Design Philosophy:
 * - Minimalist line art style with clear visual distinction
 * - Primary: Black outlines (stroke="currentColor")
 * - Larger symbols (40-60% of hex size) for visibility
 * - Improved designs for better contrast and recognition
 *
 * Symbols:
 * - Plains: Gentle waves with grass blade silhouettes
 * - Hills: Multiple rounded hills with depth lines
 * - Mountains: Sharp asymmetric peaks with snow caps and rock edges
 */
const TERRAIN_SYMBOLS: Record<TerrainType, IconSymbolDefinition> = {
    plains: {
        id: "terrain-plains",
        viewBox: "0 0 24 24",
        // Gentle horizontal waves for flat, rolling terrain
        path: "M2 14 Q 6 12, 10 14 T 18 14 T 24 14 M2 17 Q 6 15, 10 17 T 18 17 T 24 17",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    },
    hills: {
        id: "terrain-hills",
        viewBox: "0 0 24 24",
        // Gentle rolling hills - open arcs (no base line)
        path: "M2 18 Q 5 12, 8 16 Q 11 14, 14 18 Q 18 12, 22 16 M6 16 Q 8 14, 10 16 M16 15 Q 18 13, 20 15",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    },
    mountains: {
        id: "terrain-mountains",
        viewBox: "0 0 24 24",
        // Sharp asymmetric peaks with snow caps - open silhouette (no base line)
        path: "M2 18 L 7 11 L 9 14 L 12 5 L 13 7 L 15 9 L 18 8 L 20 12 L 22 15 M11 7 L 13 7 M12 6 L 12 8",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    }
};

/**
 * Flora icon symbols (outline-based, black 1px stroke).
 *
 * Design Philosophy:
 * - Enhanced organic shapes for natural appearance
 * - Primary: Black outlines with fill for trees
 * - Smaller symbols (20-30% of hex size) distributed multiple times
 * - Improved detail and visual interest
 *
 * Symbols:
 * - Dense: Tree with organic crown and visible branch structure
 * - Medium: Refined tree with simpler crown
 * - Field: Varied grass blades at different heights
 * - Barren: Rocks with cracks and erosion detail
 */
const FLORA_SYMBOLS: Record<FloraType, IconSymbolDefinition> = {
    dense: {
        id: "flora-dense",
        viewBox: "0 0 24 24",
        // Dense forest cluster: 7 trunks with large, layered canopy covering most of viewBox
        // Trunks: 7 vertical lines at varied heights for natural appearance
        // Canopy: Large merged crown (x:2-22, y:2-17) with internal detail curves for depth
        path: "M6 14 L 6 20 M8 15 L 8 20 M10 14 L 10 20 M12 15 L 12 20 M14 14 L 14 20 M16 15 L 16 20 M18 14 L 18 20 M12 2 C 5 2, 2 4, 2 8 C 2 11, 3 12, 4 14 C 3 15, 3 16, 4 17 C 6 18, 9 18, 12 18 C 15 18, 18 18, 20 17 C 21 16, 21 15, 20 14 C 21 12, 22 11, 22 8 C 22 4, 19 2, 12 2 Z M7 8 C 8 7, 9 7, 10 8 M14 8 C 15 7, 16 7, 17 8 M10 11 C 11 10, 13 10, 14 11",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    },
    medium: {
        id: "flora-medium",
        viewBox: "0 0 24 24",
        // Tree with understory: main tree + bushes at base
        path: "M11 13 L 11 20 L 13 20 L 13 13 M12 5 C 9 5, 7 7, 7 9 C 7 11, 8 12, 9 13 C 10 13, 11 13, 12 13 C 13 13, 14 13, 15 13 C 16 12, 17 11, 17 9 C 17 7, 15 5, 12 5 Z M6 17 C 6 16, 6 15, 7 15 C 8 15, 8 16, 8 17 C 8 18, 7 18, 6 17 Z M16 17 C 16 16, 16 15, 17 15 C 18 15, 18 16, 18 17 C 18 18, 17 18, 16 17 Z M10 18 C 10 17, 10 16, 11 16 C 12 16, 12 17, 12 18 C 12 19, 11 19, 10 18 Z",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    },
    field: {
        id: "flora-field",
        viewBox: "0 0 24 24",
        // Grass tuft with varied heights and densities
        path: "M8 20 Q 8 18, 6 14 M10 20 Q 10 16, 9 11 M12 20 Q 12 14, 12 9 M14 20 Q 14 16, 15 11 M16 20 Q 16 18, 18 14",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    },
    barren: {
        id: "flora-barren",
        viewBox: "0 0 24 24",
        // Rock with cracks and erosion details
        path: "M12 7 L 17 11 L 16 18 L 8 18 L 7 11 Z M10 13 L 12 15 M14 13 L 12 15 M12 11 L 12 13",
        variantCount: 1  // Phase 1: Single variant (ready for expansion to 4-6)
    }
};

/**
 * Moisture icon symbols (filled shapes with blue tones).
 *
 * Design Philosophy:
 * - Simple, recognizable water representations
 * - Size/complexity increases with moisture level
 * - Primary: Blue fill (currentColor set to MOISTURE_COLORS)
 * - Small to medium symbols (15-35% of hex size) distributed multiple times
 *
 * Symbol Progression (desert → sea):
 * - Desert: Cracked earth pattern
 * - Dry: Single small water droplet
 * - Lush: Multiple small droplets
 * - Marshy: Puddle with grass reeds
 * - Swampy: Larger irregular puddle
 * - Ponds: Small circular pond
 * - Lakes: Medium oval lake
 * - Large Lake: Large oval lake
 * - Sea: Wave pattern
 * - Flood Plains: Wavy water with debris
 */
const MOISTURE_SYMBOLS: Record<MoistureLevel, IconSymbolDefinition> = {
    desert: {
        id: "moisture-desert",
        viewBox: "0 0 24 24",
        // Cracked dry earth pattern
        path: "M6 8 L 10 12 M14 8 L 10 12 M10 12 L 12 16 M10 12 L 8 16 M14 16 L 18 12 M18 12 L 22 16",
        variantCount: 1
    },
    dry: {
        id: "moisture-dry",
        viewBox: "0 0 24 24",
        // Single small water droplet
        path: "M12 6 C 12 6, 9 10, 9 13 C 9 15.2, 10.3 17, 12 17 C 13.7 17, 15 15.2, 15 13 C 15 10, 12 6, 12 6 Z",
        variantCount: 1
    },
    lush: {
        id: "moisture-lush",
        viewBox: "0 0 24 24",
        // Two small water droplets
        path: "M9 7 C 9 7, 7 10, 7 12 C 7 13.7, 7.9 15, 9 15 C 10.1 15, 11 13.7, 11 12 C 11 10, 9 7, 9 7 Z M15 9 C 15 9, 13 12, 13 14 C 13 15.7, 13.9 17, 15 17 C 16.1 17, 17 15.7, 17 14 C 17 12, 15 9, 15 9 Z",
        variantCount: 1
    },
    marshy: {
        id: "moisture-marshy",
        viewBox: "0 0 24 24",
        // Puddle with reed/grass strokes
        path: "M6 14 C 6 12, 8 11, 12 11 C 16 11, 18 12, 18 14 C 18 16, 16 17, 12 17 C 8 17, 6 16, 6 14 Z M10 11 L 10 8 M14 11 L 14 7",
        variantCount: 1
    },
    swampy: {
        id: "moisture-swampy",
        viewBox: "0 0 24 24",
        // Larger irregular puddle
        path: "M5 13 C 5 11, 6 10, 8 10 C 9 10, 10 10, 11 9 C 12 8, 13 8, 14 9 C 15 10, 16 10, 17 10 C 19 10, 20 11, 20 13 C 20 15, 19 16, 17 16 C 16 16, 15 16, 14 17 C 13 18, 12 18, 11 17 C 10 16, 9 16, 8 16 C 6 16, 5 15, 5 13 Z",
        variantCount: 1
    },
    ponds: {
        id: "moisture-ponds",
        viewBox: "0 0 24 24",
        // Small circular pond
        path: "M12 7 C 8.7 7, 6 9.2, 6 12 C 6 14.8, 8.7 17, 12 17 C 15.3 17, 18 14.8, 18 12 C 18 9.2, 15.3 7, 12 7 Z",
        variantCount: 1
    },
    lakes: {
        id: "moisture-lakes",
        viewBox: "0 0 24 24",
        // Medium oval lake
        path: "M12 6 C 7.6 6, 4 8.7, 4 12 C 4 15.3, 7.6 18, 12 18 C 16.4 18, 20 15.3, 20 12 C 20 8.7, 16.4 6, 12 6 Z",
        variantCount: 1
    },
    large_lake: {
        id: "moisture-large-lake",
        viewBox: "0 0 24 24",
        // Large oval lake with depth line
        path: "M12 5 C 6.5 5, 2 8.1, 2 12 C 2 15.9, 6.5 19, 12 19 C 17.5 19, 22 15.9, 22 12 C 22 8.1, 17.5 5, 12 5 Z M6 12 C 6 10, 8.7 8.5, 12 8.5 C 15.3 8.5, 18 10, 18 12",
        variantCount: 1
    },
    sea: {
        id: "moisture-sea",
        viewBox: "0 0 24 24",
        // Wave pattern
        path: "M2 10 Q 5 8, 8 10 T 14 10 T 20 10 T 24 10 M2 14 Q 5 12, 8 14 T 14 14 T 20 14 T 24 14 M2 18 Q 5 16, 8 18 T 14 18 T 20 18 T 24 18",
        variantCount: 1
    },
    flood_plains: {
        id: "moisture-flood-plains",
        viewBox: "0 0 24 24",
        // Wavy water with debris lines
        path: "M2 12 Q 6 10, 10 12 T 18 12 T 24 12 M4 8 L 7 11 M12 9 L 15 12 M19 7 L 22 10 M3 16 L 6 13 M14 15 L 17 12 M20 17 L 23 14",
        variantCount: 1
    }
};

// ============================================================================
// Symbol Registration
// ============================================================================

/**
 * Check if SVG <defs> block already exists in container.
 */
function hasDefsBlock(container: SVGElement): boolean {
    return !!container.querySelector("defs#salt-marcher-icon-defs");
}

/**
 * Create <defs> block with all terrain and flora symbols.
 */
function createDefsBlock(): SVGDefsElement {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.id = "salt-marcher-icon-defs";

    // Add terrain symbols (pure line art - no fill, black stroke)
    for (const symbol of Object.values(TERRAIN_SYMBOLS)) {
        const symbolEl = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
        symbolEl.id = symbol.id;
        symbolEl.setAttribute("viewBox", symbol.viewBox);

        if (symbol.path) {
            const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathEl.setAttribute("d", symbol.path);
            pathEl.setAttribute("fill", "none");            // No fill - pure line art
            pathEl.setAttribute("stroke", "currentColor");  // Black outline via color property
            pathEl.setAttribute("stroke-width", "1");

            symbolEl.appendChild(pathEl);
        }
        defs.appendChild(symbolEl);
    }

    // Add flora symbols (trees = filled, others = line art)
    for (const [floraType, symbol] of Object.entries(FLORA_SYMBOLS)) {
        const symbolEl = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
        symbolEl.id = symbol.id;
        symbolEl.setAttribute("viewBox", symbol.viewBox);

        if (symbol.path) {
            const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathEl.setAttribute("d", symbol.path);

            // Trees (dense/medium) get green fill + black outline
            // Grass/rocks (field/barren) get pure line art
            const isTrees = floraType === "dense" || floraType === "medium";

            if (isTrees) {
                pathEl.setAttribute("fill", "currentColor");    // Green fill for trees
                pathEl.setAttribute("stroke", "#000000");       // Black outline
                pathEl.setAttribute("stroke-width", "1");
            } else {
                pathEl.setAttribute("fill", "none");            // No fill - pure line art
                pathEl.setAttribute("stroke", "currentColor");  // Black outline via color property
                pathEl.setAttribute("stroke-width", "1");
            }

            symbolEl.appendChild(pathEl);
        }
        defs.appendChild(symbolEl);
    }

    // Add moisture symbols (water = filled/stroked based on type)
    for (const [moistureType, symbol] of Object.entries(MOISTURE_SYMBOLS)) {
        const symbolEl = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
        symbolEl.id = symbol.id;
        symbolEl.setAttribute("viewBox", symbol.viewBox);

        if (symbol.path) {
            const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathEl.setAttribute("d", symbol.path);

            // Desert = line art only (cracks), water levels = filled shapes
            const isDesert = moistureType === "desert";
            const isSea = moistureType === "sea" || moistureType === "flood_plains";

            if (isDesert) {
                pathEl.setAttribute("fill", "none");             // No fill - cracked earth
                pathEl.setAttribute("stroke", "currentColor");   // Color via moisture color
                pathEl.setAttribute("stroke-width", "1");
            } else if (isSea) {
                pathEl.setAttribute("fill", "none");             // No fill - wave pattern
                pathEl.setAttribute("stroke", "currentColor");   // Color via moisture color
                pathEl.setAttribute("stroke-width", "1.5");      // Thicker lines for waves
            } else {
                pathEl.setAttribute("fill", "currentColor");     // Blue fill for water bodies
                pathEl.setAttribute("stroke", "none");           // No outline
            }

            symbolEl.appendChild(pathEl);
        }
        defs.appendChild(symbolEl);
    }

    return defs;
}

/**
 * Inject SVG symbols into map container.
 *
 * Call once when map scene is initialized.
 * Safe to call multiple times (idempotent).
 */
export function injectIconSymbols(svgContainer: SVGElement): void {
    if (hasDefsBlock(svgContainer)) {
        return; // Already injected
    }

    const defs = createDefsBlock();
    svgContainer.insertBefore(defs, svgContainer.firstChild);
}

/**
 * Remove SVG symbols from map container.
 *
 * Call when map is disposed/cleaned up.
 */
export function removeIconSymbols(svgContainer: SVGElement): void {
    const defs = svgContainer.querySelector("defs#salt-marcher-icon-defs");
    if (defs) {
        defs.remove();
    }
}

// ============================================================================
// Symbol Lookup
// ============================================================================

/**
 * Get number of available variants for a terrain type.
 *
 * @param terrain - Terrain type
 * @returns Number of variants (default: 1)
 */
export function getTerrainVariantCount(terrain: TerrainType): number {
    return TERRAIN_SYMBOLS[terrain].variantCount ?? 1;
}

/**
 * Get number of available variants for a flora type.
 *
 * @param flora - Flora type
 * @returns Number of variants (default: 1)
 */
export function getFloraVariantCount(flora: FloraType): number {
    return FLORA_SYMBOLS[flora].variantCount ?? 1;
}

/**
 * Get random variant index for a terrain type (1 to variantCount).
 *
 * @param terrain - Terrain type
 * @returns Random variant index (1-based)
 */
export function getRandomTerrainVariant(terrain: TerrainType): number {
    const count = getTerrainVariantCount(terrain);
    return Math.floor(Math.random() * count) + 1;
}

/**
 * Get random variant index for a flora type (1 to variantCount).
 *
 * @param flora - Flora type
 * @returns Random variant index (1-based)
 */
export function getRandomFloraVariant(flora: FloraType): number {
    const count = getFloraVariantCount(flora);
    return Math.floor(Math.random() * count) + 1;
}

/**
 * Get terrain symbol ID for use in <use> element.
 *
 * @param terrain - Terrain type
 * @param variant - Variant index (1-based, optional). If omitted, returns base ID.
 * @returns Symbol ID (e.g., "terrain-plains" or "terrain-plains-v2")
 */
export function getTerrainSymbolId(terrain: TerrainType, variant?: number): string {
    const baseId = TERRAIN_SYMBOLS[terrain].id;
    if (variant && variant > 1) {
        return `${baseId}-v${variant}`;
    }
    return baseId;
}

/**
 * Get flora symbol ID for use in <use> element.
 *
 * @param flora - Flora type
 * @param variant - Variant index (1-based, optional). If omitted, returns base ID.
 * @returns Symbol ID (e.g., "flora-dense" or "flora-dense-v3")
 */
export function getFloraSymbolId(flora: FloraType, variant?: number): string {
    const baseId = FLORA_SYMBOLS[flora].id;
    if (variant && variant > 1) {
        return `${baseId}-v${variant}`;
    }
    return baseId;
}

/**
 * Check if terrain symbol exists.
 */
export function hasTerrainSymbol(terrain: TerrainType): boolean {
    return terrain in TERRAIN_SYMBOLS;
}

/**
 * Check if flora symbol exists.
 */
export function hasFloraSymbol(flora: FloraType): boolean {
    return flora in FLORA_SYMBOLS;
}

/**
 * Get number of available variants for a moisture level.
 *
 * @param moisture - Moisture level
 * @returns Number of variants (default: 1)
 */
export function getMoistureVariantCount(moisture: MoistureLevel): number {
    return MOISTURE_SYMBOLS[moisture].variantCount ?? 1;
}

/**
 * Get random variant index for a moisture level (1 to variantCount).
 *
 * @param moisture - Moisture level
 * @returns Random variant index (1-based)
 */
export function getRandomMoistureVariant(moisture: MoistureLevel): number {
    const count = getMoistureVariantCount(moisture);
    return Math.floor(Math.random() * count) + 1;
}

/**
 * Get moisture symbol ID for use in <use> element.
 *
 * @param moisture - Moisture level
 * @param variant - Variant index (1-based, optional). If omitted, returns base ID.
 * @returns Symbol ID (e.g., "moisture-lush" or "moisture-lush-v2")
 */
export function getMoistureSymbolId(moisture: MoistureLevel, variant?: number): string {
    const baseId = MOISTURE_SYMBOLS[moisture].id;
    if (variant && variant > 1) {
        return `${baseId}-v${variant}`;
    }
    return baseId;
}

/**
 * Check if moisture symbol exists.
 */
export function hasMoistureSymbol(moisture: MoistureLevel): boolean {
    return moisture in MOISTURE_SYMBOLS;
}

// ============================================================================
// Custom Symbol Registration (Future Extension)
// ============================================================================

/**
 * Register custom terrain symbol (for user-provided SVG graphics).
 *
 * @param terrain - Terrain type to override
 * @param symbol - SVG symbol definition
 */
export function registerCustomTerrainSymbol(terrain: TerrainType, symbol: IconSymbolDefinition): void {
    TERRAIN_SYMBOLS[terrain] = symbol;
    // TODO: Update existing <defs> block in DOM if already injected
}

/**
 * Register custom flora symbol (for user-provided SVG graphics).
 *
 * @param flora - Flora type to override
 * @param symbol - SVG symbol definition
 */
export function registerCustomFloraSymbol(flora: FloraType, symbol: IconSymbolDefinition): void {
    FLORA_SYMBOLS[flora] = symbol;
    // TODO: Update existing <defs> block in DOM if already injected
}

/**
 * Reset all symbols to defaults (remove custom overrides).
 */
export function resetSymbolsToDefaults(): void {
    // Simply remove and re-inject defs block
    // Caller must manually call injectIconSymbols() on relevant SVG containers
}
