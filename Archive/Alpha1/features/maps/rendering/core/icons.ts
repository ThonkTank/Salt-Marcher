// src/features/maps/rendering/core/icons.ts
// Consolidated icon rendering system: noise, distribution, and SVG rendering
//
// Merged from:
// - flora-noise-modifier.ts - Simplex noise for terrain/flora color blending
// - symbol-distributor.ts - Symbol distribution across hex tiles
// - icon-renderer.ts - SVG icon rendering (SVG <use> and emoji fallback)

import { coordToKey } from "@geometry";
import { TERRAIN_ICONS, FLORA_ICONS, getTerrainBaseColor, getFloraColor, getMoistureColor } from "../../config/terrain";
import {
    getTerrainSymbolId,
    getFloraSymbolId,
    getMoistureSymbolId,
    hasTerrainSymbol,
    hasFloraSymbol,
    hasMoistureSymbol
} from "../icons/icon-registry";
import {
    getTerrainPositionConfig,
    getFloraPositionConfig,
    getMoisturePositionConfig,
    type RelativePosition
} from "../icons/symbol-position-config";
import type { TileData } from "../../data/tile-repository";
import type { AxialCoord } from "@geometry";
import type { TerrainType, FloraType } from "../../config/terrain";

// Type alias for backward compatibility
type HexCoord = AxialCoord;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Rendering mode for icons.
 */
export type IconRenderMode = "svg" | "emoji";

/**
 * Symbol instance for rendering
 */
export interface SymbolInstance {
    x: number;              // Absolute X position
    y: number;              // Absolute Y position
    size: number;           // Symbol size (diameter)
    type: "terrain" | "flora";
    id: string;             // Symbol ID (e.g., "terrain-hills", "flora-dense")
}

/**
 * Distribution configuration
 */
export interface DistributionConfig {
    jitterAmount: number;   // Jitter offset as % of hex size (default: 0.1 = ±10%)
    terrainBaseSize: number; // Base terrain symbol size as % of hex (default: 0.5)
    floraBaseSize: number;   // Base flora symbol size as % of hex (default: 0.25)
}

/**
 * Noise data for flora modification
 */
export interface NoiseData {
    value: number;          // Noise value [0, 1]
    strength: number;       // Flora modification strength [0, 1]
}

/**
 * Options for symbol distribution across a hex tile.
 * Consolidates positional parameters into a single options object.
 */
export interface SymbolDistributionOptions {
    /** Hex coordinate for seeded randomness */
    coord: HexCoord;
    /** Hex center position in pixels */
    hexCenter: { x: number; y: number };
    /** Hex size (radius) in pixels */
    hexSize: number;
    /** Terrain type (optional) */
    terrain?: TerrainType;
    /** Flora type (optional) */
    flora?: FloraType;
    /** Symbol variant indices (1-based) */
    variants?: {
        terrain?: number[];
        flora?: number[];
    };
    /** Distribution configuration overrides */
    config?: Partial<DistributionConfig>;
}

// ============================================================================
// Constants
// ============================================================================

// Icon rendering configuration
const TERRAIN_ICON_SCALE = 0.4;  // Terrain icon size as fraction of hex size
const FLORA_ICON_SCALE = 0.5;    // Flora icon size as fraction of hex size
const FLORA_OFFSET_Y = -8;       // Flora icon Y offset (pixels above terrain icon)

const EMOJI_FONT_SIZE_TERRAIN = 24;  // Terrain emoji font size (px)
const EMOJI_FONT_SIZE_FLORA = 32;    // Flora emoji font size (px)

// Distribution configuration
const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
    jitterAmount: 0.1,      // ±10% jitter
    terrainBaseSize: 0.5,   // 50% of hex size
    floraBaseSize: 0.25     // 25% of hex size
};

// Flora strength mapping based on density
const FLORA_STRENGTH_MAP: Record<FloraType, { min: number; max: number }> = {
    dense: { min: 0.8, max: 1.0 },      // 80-100% flora color
    medium: { min: 0.4, max: 0.6 },     // 40-60% flora color
    field: { min: 0.1, max: 0.3 },      // 10-30% flora color
    barren: { min: 0.0, max: 0.1 }      // 0-10% flora color
};

// Noise parameters for natural-looking patterns
const NOISE_SCALE = 0.05;        // Scale of noise pattern (smaller = larger features)
const NOISE_OCTAVES = 3;         // Number of noise layers for detail
const NOISE_PERSISTENCE = 0.5;   // Amplitude decay per octave

// Fixed black color for terrain and non-tree flora icons
const ICON_COLOR_BLACK = "#000000";

// ============================================================================
// Simplex Noise Implementation
// ============================================================================

/**
 * Simplified 2D Simplex/Perlin-style noise generator.
 * Based on improved noise algorithm by Ken Perlin (2002).
 *
 * Returns values in range [0, 1] for easier color blending.
 */
class SimplexNoise {
    private perm: number[];
    private grad3: number[][];

    constructor(seed: number = 0) {
        // Initialize permutation table
        this.perm = [];
        for (let i = 0; i < 256; i++) {
            this.perm[i] = i;
        }

        // Shuffle with seed
        const random = this.seededRandom(seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
        }

        // Duplicate for wrapping
        for (let i = 0; i < 256; i++) {
            this.perm[i + 256] = this.perm[i];
        }

        // Gradient vectors
        this.grad3 = [
            [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
            [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
            [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
        ];
    }

    /**
     * Simple seeded random generator.
     */
    private seededRandom(seed: number): () => number {
        let state = seed % 2147483647;
        if (state <= 0) state += 2147483646;
        return () => {
            state = (state * 16807) % 2147483647;
            return (state - 1) / 2147483646;
        };
    }

    /**
     * 2D Simplex noise.
     * Returns value in range [-1, 1].
     */
    noise2D(x: number, y: number): number {
        // Skew input space to determine which simplex cell we're in
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);

        const G2 = (3 - Math.sqrt(3)) / 6;
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        // Determine which simplex we're in
        let i1: number, j1: number;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        // Work out the hashed gradient indices
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.perm[ii + this.perm[jj]] % 12;
        const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
        const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

        // Calculate contribution from three corners
        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            n0 = t0 * t0 * this.dot2(this.grad3[gi0], x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            n1 = t1 * t1 * this.dot2(this.grad3[gi1], x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            n2 = t2 * t2 * this.dot2(this.grad3[gi2], x2, y2);
        }

        // Add contributions and scale to [-1, 1]
        return 70 * (n0 + n1 + n2);
    }

    private dot2(g: number[], x: number, y: number): number {
        return g[0] * x + g[1] * y;
    }

    /**
     * Octave noise (multiple layers for detail).
     * Returns value in range [0, 1].
     */
    octaveNoise2D(x: number, y: number, octaves: number, persistence: number): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        // Normalize to [0, 1]
        return (total / maxValue + 1) / 2;
    }
}

// Global noise generator (seed=0 for consistent patterns across sessions)
const noiseGenerator = new SimplexNoise(12345);

// ============================================================================
// Seeded Random Number Generator
// ============================================================================

/**
 * Simple Linear Congruential Generator for seeded randomness.
 * Ensures same hex coordinates always produce same distribution.
 */
class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed % 2147483647; // 2^31 - 1
        if (this.state <= 0) this.state += 2147483646;
    }

    /**
     * Returns random float in [0, 1)
     */
    next(): number {
        this.state = (this.state * 16807) % 2147483647;
        return (this.state - 1) / 2147483646;
    }

    /**
     * Returns random integer in [min, max]
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Returns random float in [min, max)
     */
    nextFloat(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }
}

/**
 * Create seed from hex coordinates (consistent across runs).
 */
function coordToSeed(coord: HexCoord): number {
    const key = coordToKey(coord);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// ============================================================================
// Noise Map Generation
// ============================================================================

/**
 * Generate noise data for a hex coordinate.
 *
 * @param coord - Hex coordinates
 * @param floraType - Flora type (determines strength range)
 * @returns Noise data with value and strength
 */
export function generateNoiseMap(coord: HexCoord, floraType?: FloraType): NoiseData {
    if (!floraType) {
        return { value: 0, strength: 0 };
    }

    // Use hex coordinates as noise input (scaled) - now using q,r Axial format
    const nx = coord.q * NOISE_SCALE;
    const ny = coord.r * NOISE_SCALE;

    // Generate octave noise
    const noiseValue = noiseGenerator.octaveNoise2D(nx, ny, NOISE_OCTAVES, NOISE_PERSISTENCE);

    // Calculate flora strength based on noise and flora density
    const strengthRange = FLORA_STRENGTH_MAP[floraType];
    const strength = strengthRange.min + noiseValue * (strengthRange.max - strengthRange.min);

    return {
        value: noiseValue,
        strength: Math.max(0, Math.min(1, strength))
    };
}

/**
 * Calculate flora modification strength from noise data.
 * This is the blend factor between terrain base color and flora color.
 *
 * @param noise - Noise data
 * @param floraType - Flora type
 * @returns Strength value [0, 1] where 0=pure terrain, 1=pure flora
 */
export function calculateFloraStrength(noise: NoiseData, floraType: FloraType): number {
    return noise.strength;
}

// ============================================================================
// Color Blending
// ============================================================================

/**
 * Parse hex color to RGB components.
 */
function parseColor(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return null;

    return {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16)
    };
}

/**
 * Convert RGB to hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Blend two colors based on strength factor.
 *
 * @param terrainColor - Base terrain color (hex string)
 * @param floraColor - Flora color to blend in (hex string)
 * @param strength - Blend strength [0, 1] where 0=pure terrain, 1=pure flora
 * @returns Blended color (hex string)
 */
export function blendColors(terrainColor: string, floraColor: string, strength: number): string {
    const terrain = parseColor(terrainColor);
    const flora = parseColor(floraColor);

    if (!terrain || !flora) {
        // Fallback to terrain color if parsing fails
        return terrainColor;
    }

    // Linear interpolation
    const r = terrain.r + (flora.r - terrain.r) * strength;
    const g = terrain.g + (flora.g - terrain.g) * strength;
    const b = terrain.b + (flora.b - terrain.b) * strength;

    return rgbToHex(r, g, b);
}

/**
 * Calculate final hex fill color with flora modification.
 *
 * @param coord - Hex coordinates
 * @param terrain - Terrain type
 * @param flora - Flora type (optional)
 * @returns Final hex fill color (hex string)
 */
export function calculateHexFillColor(
    coord: HexCoord,
    terrain?: TerrainType,
    flora?: FloraType
): string | undefined {
    const terrainColor = terrain ? getTerrainBaseColor(terrain) : undefined;
    if (!terrainColor) return undefined;

    // No flora: Return pure terrain color
    if (!flora) return terrainColor;

    const floraColor = getFloraColor(flora);
    if (!floraColor) return terrainColor;

    // Generate noise and blend colors
    const noise = generateNoiseMap(coord, flora);
    const strength = calculateFloraStrength(noise, flora);

    return blendColors(terrainColor, floraColor, strength);
}

// ============================================================================
// Symbol Distribution
// ============================================================================

/**
 * Apply jitter to a relative position.
 *
 * @param relPos - Relative position (-1 to 1)
 * @param jitterAmount - Jitter range (e.g., 0.1 for ±10%)
 * @param rng - Seeded random number generator
 * @returns Jittered position
 */
function applyJitter(relPos: number, jitterAmount: number, rng: SeededRandom): number {
    const jitter = rng.nextFloat(-jitterAmount, jitterAmount);
    return relPos + jitter;
}

/**
 * Distribute terrain and flora symbols across a hex tile using fixed positions.
 *
 * Algorithm:
 * 1. Load fixed position configurations for terrain/flora types
 * 2. Apply small random jitter (±5-10%) to each position
 * 3. Convert relative positions (-1 to 1) to absolute coordinates
 * 4. Scale symbols based on base size and position config
 * 5. Use variant indices from TileData to select symbol variations
 *
 * @param options - Symbol distribution options
 * @returns Array of symbol instances
 */
export function distributeSymbols(options: SymbolDistributionOptions): SymbolInstance[] {
    const {
        coord,
        hexCenter,
        hexSize,
        terrain,
        flora,
        variants,
        config = {}
    } = options;

    const cfg = { ...DEFAULT_DISTRIBUTION_CONFIG, ...config };
    const rng = new SeededRandom(coordToSeed(coord));
    const symbols: SymbolInstance[] = [];

    // If no terrain or flora, return empty
    if (!terrain && !flora) {
        return symbols;
    }

    // Place terrain symbols at fixed positions with jitter
    if (terrain) {
        const terrainConfig = getTerrainPositionConfig(terrain);
        for (let i = 0; i < terrainConfig.positions.length; i++) {
            const relPos = terrainConfig.positions[i];
            // Get variant index from array (1-based), fallback to 1 if not provided
            const variantIndex = variants?.terrain?.[i] ?? 1;
            // Generate symbol ID with variant suffix (e.g., "terrain-mountains-v2")
            const symbolId = getTerrainSymbolId(terrain, variantIndex);

            const symbol = convertRelativeToAbsolute(
                relPos,
                hexCenter.x,
                hexCenter.y,
                hexSize,
                cfg.terrainBaseSize,
                cfg.jitterAmount,
                "terrain",
                symbolId,
                rng
            );
            symbols.push(symbol);
        }
    }

    // Place flora symbols at fixed positions with jitter
    if (flora) {
        const floraConfig = getFloraPositionConfig(flora);
        for (let i = 0; i < floraConfig.positions.length; i++) {
            const relPos = floraConfig.positions[i];
            // Get variant index from array (1-based), fallback to 1 if not provided
            const variantIndex = variants?.flora?.[i] ?? 1;
            // Generate symbol ID with variant suffix (e.g., "flora-dense-v3")
            const symbolId = getFloraSymbolId(flora, variantIndex);

            const symbol = convertRelativeToAbsolute(
                relPos,
                hexCenter.x,
                hexCenter.y,
                hexSize,
                cfg.floraBaseSize,
                cfg.jitterAmount,
                "flora",
                symbolId,
                rng
            );
            symbols.push(symbol);
        }
    }

    return symbols;
}

/**
 * Convert relative position to absolute coordinates with jitter.
 *
 * @param relPos - Relative position (-1 to 1 from hex center)
 * @param hexCenterX - Hex center X position
 * @param hexCenterY - Hex center Y position
 * @param hexSize - Hex size (radius)
 * @param baseSize - Base symbol size as fraction of hex (e.g., 0.5)
 * @param jitterAmount - Jitter range as fraction of hex (e.g., 0.1 for ±10%)
 * @param type - Symbol type ("terrain" or "flora")
 * @param id - Symbol ID
 * @param rng - Seeded random number generator
 * @returns Symbol instance with absolute coordinates
 */
function convertRelativeToAbsolute(
    relPos: RelativePosition,
    hexCenterX: number,
    hexCenterY: number,
    hexSize: number,
    baseSize: number,
    jitterAmount: number,
    type: "terrain" | "flora",
    id: string,
    rng: SeededRandom
): SymbolInstance {
    // Apply jitter to relative position
    const jitteredX = applyJitter(relPos.x, jitterAmount, rng);
    const jitteredY = applyJitter(relPos.y, jitterAmount, rng);

    // Convert to absolute coordinates
    // Relative positions are in range [-1, 1], scale by hex size
    const x = hexCenterX + jitteredX * hexSize;
    const y = hexCenterY + jitteredY * hexSize;

    // Calculate final size (base size × position config size factor)
    const size = hexSize * baseSize * relPos.size;

    return { x, y, size, type, id };
}

// ============================================================================
// Adaptive Contrast
// ============================================================================

/**
 * Calculate relative luminance of a hex color.
 * Uses standard formula: 0.299*R + 0.587*G + 0.114*B
 *
 * @param hexColor - Hex color string (e.g., "#a5d6a7")
 * @returns Luminance value from 0 (dark) to 1 (light)
 */
export function calculateBackgroundLuminance(hexColor: string): number {
    // Remove # prefix if present
    const hex = hexColor.replace("#", "");

    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Relative luminance formula
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Apply drop shadow to icon element based on background luminance.
 * Always applies shadow/glow for consistent visibility across all backgrounds.
 * Dark backgrounds get white glow, light backgrounds get dark shadow.
 *
 * @param useElement - SVG <use> element to apply shadow to
 * @param bgLuminance - Background luminance (0-1)
 */
function applyDropShadow(useElement: SVGUseElement, bgLuminance: number): void {
    if (bgLuminance < 0.5) {
        // Dark background: white glow for visibility
        useElement.style.filter = "drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))";
    } else {
        // Light background: dark shadow for depth
        useElement.style.filter = "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3))";
    }
}

// ============================================================================
// SVG Icon Rendering
// ============================================================================

/**
 * Render terrain icon using SVG <use> element.
 *
 * @param container - Parent SVG group to append icon to
 * @param terrain - Terrain type
 * @param hexCenterX - Hex center X coordinate
 * @param hexCenterY - Hex center Y coordinate
 * @param hexSize - Hex size (edge to center distance)
 * @returns Created <use> element (or null if no symbol)
 */
export function renderTerrainIconSVG(
    container: SVGElement,
    terrain: TerrainType,
    hexCenterX: number,
    hexCenterY: number,
    hexSize: number
): SVGUseElement | null {
    if (!hasTerrainSymbol(terrain)) {
        return null;
    }

    const symbolId = getTerrainSymbolId(terrain);
    const iconSize = hexSize * TERRAIN_ICON_SCALE;

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${symbolId}`);
    use.setAttribute("x", String(hexCenterX - iconSize / 2));
    use.setAttribute("y", String(hexCenterY - iconSize / 2));
    use.setAttribute("width", String(iconSize));
    use.setAttribute("height", String(iconSize));
    use.setAttribute("class", "terrain-icon");
    use.style.pointerEvents = "none"; // Don't interfere with hex click events

    // Color: Dark brown/gray for terrain (neutral)
    use.style.color = "#5d4037";
    use.style.opacity = "1.0";

    container.appendChild(use);
    return use;
}

/**
 * Render flora icon using SVG <use> element.
 *
 * @param container - Parent SVG group to append icon to
 * @param flora - Flora type
 * @param hexCenterX - Hex center X coordinate
 * @param hexCenterY - Hex center Y coordinate
 * @param hexSize - Hex size (edge to center distance)
 * @returns Created <use> element (or null if no symbol)
 */
export function renderFloraIconSVG(
    container: SVGElement,
    flora: FloraType,
    hexCenterX: number,
    hexCenterY: number,
    hexSize: number
): SVGUseElement | null {
    if (!hasFloraSymbol(flora)) {
        return null;
    }

    const symbolId = getFloraSymbolId(flora);
    const iconSize = hexSize * FLORA_ICON_SCALE;

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${symbolId}`);
    use.setAttribute("x", String(hexCenterX - iconSize / 2));
    use.setAttribute("y", String(hexCenterY - iconSize / 2 + FLORA_OFFSET_Y));
    use.setAttribute("width", String(iconSize));
    use.setAttribute("height", String(iconSize));
    use.setAttribute("class", "flora-icon");
    use.style.pointerEvents = "none";

    // Color: Green shades for flora
    const floraColors: Record<FloraType, string> = {
        dense: "#2e7d32",    // Dark green (heavy forest)
        medium: "#66bb6a",   // Medium green
        field: "#aed581",    // Light green (crops)
        barren: "#8d6e63"    // Brown (minimal vegetation)
    };
    use.style.color = floraColors[flora];
    use.style.opacity = "1.0";

    container.appendChild(use);
    return use;
}

// ============================================================================
// Emoji Fallback Rendering
// ============================================================================

/**
 * Render terrain icon using emoji <text> element (fallback).
 *
 * @param container - Parent SVG group to append icon to
 * @param terrain - Terrain type
 * @param hexCenterX - Hex center X coordinate
 * @param hexCenterY - Hex center Y coordinate
 * @returns Created <text> element
 */
export function renderTerrainIconEmoji(
    container: SVGElement,
    terrain: TerrainType,
    hexCenterX: number,
    hexCenterY: number
): SVGTextElement {
    const emoji = TERRAIN_ICONS[terrain].emoji;

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(hexCenterX));
    text.setAttribute("y", String(hexCenterY));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("class", "terrain-icon-emoji");
    text.style.fontSize = `${EMOJI_FONT_SIZE_TERRAIN}px`;
    text.style.pointerEvents = "none";
    text.style.userSelect = "none";
    text.textContent = emoji;

    container.appendChild(text);
    return text;
}

/**
 * Render flora icon using emoji <text> element (fallback).
 *
 * @param container - Parent SVG group to append icon to
 * @param flora - Flora type
 * @param hexCenterX - Hex center X coordinate
 * @param hexCenterY - Hex center Y coordinate
 * @returns Created <text> element
 */
export function renderFloraIconEmoji(
    container: SVGElement,
    flora: FloraType,
    hexCenterX: number,
    hexCenterY: number
): SVGTextElement {
    const emoji = FLORA_ICONS[flora].emoji;

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(hexCenterX));
    text.setAttribute("y", String(hexCenterY + FLORA_OFFSET_Y));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("class", "flora-icon-emoji");
    text.style.fontSize = `${EMOJI_FONT_SIZE_FLORA}px`;
    text.style.pointerEvents = "none";
    text.style.userSelect = "none";
    text.textContent = emoji;

    container.appendChild(text);
    return text;
}

// ============================================================================
// Combined Icon Rendering
// ============================================================================

/**
 * Render terrain icon (auto-selects SVG or emoji based on mode).
 *
 * @param container - Parent SVG group
 * @param terrain - Terrain type
 * @param hexCenterX - Hex center X
 * @param hexCenterY - Hex center Y
 * @param hexSize - Hex size (only used for SVG mode)
 * @param mode - Rendering mode ("svg" or "emoji")
 * @returns Created element (or null if no icon)
 */
export function renderTerrainIcon(
    container: SVGElement,
    terrain: TerrainType,
    hexCenterX: number,
    hexCenterY: number,
    hexSize: number,
    mode: IconRenderMode = "emoji"
): SVGElement | null {
    if (mode === "svg") {
        return renderTerrainIconSVG(container, terrain, hexCenterX, hexCenterY, hexSize);
    } else {
        return renderTerrainIconEmoji(container, terrain, hexCenterX, hexCenterY);
    }
}

/**
 * Render flora icon (auto-selects SVG or emoji based on mode).
 *
 * @param container - Parent SVG group
 * @param flora - Flora type
 * @param hexCenterX - Hex center X
 * @param hexCenterY - Hex center Y
 * @param hexSize - Hex size (only used for SVG mode)
 * @param mode - Rendering mode ("svg" or "emoji")
 * @returns Created element (or null if no icon)
 */
export function renderFloraIcon(
    container: SVGElement,
    flora: FloraType,
    hexCenterX: number,
    hexCenterY: number,
    hexSize: number,
    mode: IconRenderMode = "emoji"
): SVGElement | null {
    if (mode === "svg") {
        return renderFloraIconSVG(container, flora, hexCenterX, hexCenterY, hexSize);
    } else {
        return renderFloraIconEmoji(container, flora, hexCenterX, hexCenterY);
    }
}

// ============================================================================
// Multi-Symbol Rendering (New System)
// ============================================================================

/**
 * Render distributed symbols for a hex tile.
 * This is the new primary rendering method that distributes 8-12 symbols
 * across the hex with fixed positions and random jitter.
 *
 * @param coord - Hex coordinates (for seeding distribution)
 * @param terrainContainer - Container for terrain symbols
 * @param floraContainer - Container for flora symbols
 * @param moistureContainer - Container for moisture symbols
 * @param hexCenterX - Hex center X position
 * @param hexCenterY - Hex center Y position
 * @param hexSize - Hex size (radius)
 * @param tileData - Tile data containing terrain, flora, and variant indices
 * @returns Array of created SVG elements
 */
export function renderDistributedSymbols(
    coord: HexCoord,
    terrainContainer: SVGElement,
    floraContainer: SVGElement,
    moistureContainer: SVGElement,
    hexCenterX: number,
    hexCenterY: number,
    hexSize: number,
    tileData: TileData
): SVGElement[] {
    const elements: SVGElement[] = [];

    const { terrain, flora, moisture, terrainVariants, floraVariants } = tileData;

    // Calculate background color and luminance for adaptive contrast
    const bgColor = calculateHexFillColor(coord, terrain, flora);
    const bgLuminance = bgColor ? calculateBackgroundLuminance(bgColor) : 0.5;

    // Get distributed symbol instances (with variant support)
    const symbols = distributeSymbols({
        coord,
        hexCenter: { x: hexCenterX, y: hexCenterY },
        hexSize,
        terrain,
        flora,
        variants: { terrain: terrainVariants, flora: floraVariants }
    });

    // Sort by Y-coordinate (painter's algorithm): lower Y values render first (behind),
    // higher Y values render last (on top). This ensures visually lower symbols appear in front.
    const sortedSymbols = symbols.slice().sort((a, b) => a.y - b.y);

    // Render each symbol
    for (const symbol of sortedSymbols) {
        const container = symbol.type === "terrain" ? terrainContainer : floraContainer;

        // Determine color: trees (dense/medium) stay green, all others use fixed black
        const isTrees = symbol.type === "flora" && (flora === "dense" || flora === "medium");
        const color = isTrees
            ? getFloraColor(flora)      // Green for trees
            : ICON_COLOR_BLACK;         // Fixed black for terrain and non-tree flora

        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", `#${symbol.id}`);
        use.setAttribute("x", String(symbol.x - symbol.size / 2));
        use.setAttribute("y", String(symbol.y - symbol.size / 2));
        use.setAttribute("width", String(symbol.size));
        use.setAttribute("height", String(symbol.size));
        use.setAttribute("class", `${symbol.type}-icon distributed`);
        use.style.pointerEvents = "none";
        use.style.color = color;
        use.style.opacity = "1.0";

        // Apply drop shadow for consistent visibility
        applyDropShadow(use, bgLuminance);

        container.appendChild(use);
        elements.push(use);
    }

    // Render moisture icons (separate from terrain/flora distribution)
    if (moisture && hasMoistureSymbol(moisture)) {
        const moistureConfig = getMoisturePositionConfig(moisture);
        const moistureColor = getMoistureColor(moisture) || "#3d9db7"; // Default blue
        const symbolId = getMoistureSymbolId(moisture);

        for (const pos of moistureConfig.positions) {
            // Convert relative position (-1 to 1) to absolute position
            const jitter = 0.05; // 5% random jitter for natural variation
            const jitterX = (Math.random() - 0.5) * jitter * hexSize * 2;
            const jitterY = (Math.random() - 0.5) * jitter * hexSize * 2;

            const x = hexCenterX + (pos.x * hexSize) + jitterX;
            const y = hexCenterY + (pos.y * hexSize) + jitterY;
            const size = hexSize * pos.size * 0.8; // Scale to hex size

            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
            use.setAttribute("href", `#${symbolId}`);
            use.setAttribute("x", String(x - size / 2));
            use.setAttribute("y", String(y - size / 2));
            use.setAttribute("width", String(size));
            use.setAttribute("height", String(size));
            use.setAttribute("class", "moisture-icon distributed");
            use.style.pointerEvents = "none";
            use.style.color = moistureColor; // Use MOISTURE_COLORS
            use.style.opacity = "0.7"; // Semi-transparent for subtle effect

            if (pos.rotation !== undefined) {
                use.setAttribute("transform", `rotate(${pos.rotation} ${x} ${y})`);
            }

            moistureContainer.appendChild(use);
            elements.push(use);
        }
    }

    return elements;
}

/**
 * Calculate and apply hex fill color with flora noise modification.
 *
 * @param polygon - Hex polygon element to apply color to
 * @param coord - Hex coordinates
 * @param terrain - Terrain type (optional)
 * @param flora - Flora type (optional)
 */
export function applyHexFillColor(
    polygon: SVGPolygonElement,
    coord: HexCoord,
    terrain?: TerrainType,
    flora?: FloraType
): void {
    const fillColor = calculateHexFillColor(coord, terrain, flora);
    if (fillColor) {
        polygon.dataset.terrainFill = fillColor;
        // Note: updateVisual() in scene.ts will apply this color with appropriate opacity
    } else {
        polygon.dataset.terrainFill = "transparent";
    }
}

// ============================================================================
// Icon Removal
// ============================================================================

/**
 * Remove all terrain icons from container.
 */
export function clearTerrainIcons(container: SVGElement): void {
    const icons = container.querySelectorAll(".terrain-icon, .terrain-icon-emoji");
    icons.forEach(icon => icon.remove());
}

/**
 * Remove all flora icons from container.
 */
export function clearFloraIcons(container: SVGElement): void {
    const icons = container.querySelectorAll(".flora-icon, .flora-icon-emoji");
    icons.forEach(icon => icon.remove());
}

/**
 * Remove all terrain and flora icons from container.
 */
export function clearAllIcons(container: SVGElement): void {
    clearTerrainIcons(container);
    clearFloraIcons(container);
}
