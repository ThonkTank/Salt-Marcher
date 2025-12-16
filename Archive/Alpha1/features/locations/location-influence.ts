// src/features/locations/location-influence.ts
// Phase 9.1: Location influence area calculation for map integration
//
// Locations can project influence areas on the map based on their type, owner, and size.
// These areas affect encounter chances, faction presence, and visual map overlays.

import type { LocationData, LocationType } from "@services/domain";

/**
 * Hex coordinate in cube coordinate system
 */
export interface HexCoordinate {
  q: number;
  r: number;
  s: number;
}

/**
 * Influence area shape for a location
 */
export interface InfluenceArea {
  /** Center hex coordinate */
  center: HexCoordinate;
  /** Radius in hexes */
  radius: number;
  /** Influence strength (0-100) at center */
  strength: number;
  /** How strength decays per hex from center (0-1) */
  decay: number;
  /** Owner faction name (if applicable) */
  faction?: string;
  /** Owner NPC name (if applicable) */
  npc?: string;
  /** Location type affecting influence style */
  type: LocationType;
}

/**
 * Configuration for influence calculation
 */
export interface InfluenceConfig {
  /** Base radius for location type */
  baseRadius: number;
  /** Base strength (0-100) */
  baseStrength: number;
  /** Decay rate per hex (0-1) */
  decay: number;
}

/**
 * Default influence configurations by location type
 */
const INFLUENCE_CONFIGS: Record<LocationType, InfluenceConfig> = {
  Stadt: { baseRadius: 8, baseStrength: 90, decay: 0.15 },
  Dorf: { baseRadius: 5, baseStrength: 70, decay: 0.20 },
  Weiler: { baseRadius: 3, baseStrength: 50, decay: 0.25 },
  Gebäude: { baseRadius: 1, baseStrength: 40, decay: 0.30 },
  Dungeon: { baseRadius: 4, baseStrength: 80, decay: 0.20 },
  Camp: { baseRadius: 3, baseStrength: 60, decay: 0.25 },
  Landmark: { baseRadius: 6, baseStrength: 60, decay: 0.18 },
  Ruine: { baseRadius: 4, baseStrength: 50, decay: 0.22 },
  Festung: { baseRadius: 7, baseStrength: 85, decay: 0.17 },
};

/**
 * Parse coordinate string to HexCoordinate
 * Supports formats: "12,34" (odd-r) or "q:12,r:34" (axial)
 */
export function parseCoordinates(coords: string | undefined): HexCoordinate | null {
  if (!coords) return null;

  const trimmed = coords.trim();

  // Try axial format: "q:12,r:34"
  const axialMatch = trimmed.match(/q:\s*(-?\d+)\s*,\s*r:\s*(-?\d+)/i);
  if (axialMatch) {
    const q = parseInt(axialMatch[1], 10);
    const r = parseInt(axialMatch[2], 10);
    return { q, r, s: -q - r };
  }

  // Try odd-r format: "12,34" or "col:12,row:34"
  const oddrMatch = trimmed.match(/(?:col:\s*)?(-?\d+)\s*,\s*(?:row:\s*)?(-?\d+)/i);
  if (oddrMatch) {
    const col = parseInt(oddrMatch[1], 10);
    const row = parseInt(oddrMatch[2], 10);
    return oddrToAxial(col, row);
  }

  return null;
}

/**
 * Convert odd-r coordinates to axial (cube) coordinates
 */
function oddrToAxial(col: number, row: number): HexCoordinate {
  const q = col - (row - (row & 1)) / 2;
  const r = row;
  const s = -q - r;
  return { q, r, s };
}

/**
 * Calculate influence area for a location
 */
export function calculateInfluenceArea(location: LocationData): InfluenceArea | null {
  const coords = parseCoordinates(location.coordinates);
  if (!coords) return null;

  const config = INFLUENCE_CONFIGS[location.type];

  return {
    center: coords,
    radius: config.baseRadius,
    strength: config.baseStrength,
    decay: config.decay,
    faction: location.owner_type === "faction" ? location.owner_name : undefined,
    npc: location.owner_type === "npc" ? location.owner_name : undefined,
    type: location.type,
  };
}

/**
 * Calculate influence strength at a specific hex
 * @param area - Influence area
 * @param hex - Target hex coordinate
 * @returns Influence strength (0-100) at this hex
 */
export function getInfluenceStrengthAt(area: InfluenceArea, hex: HexCoordinate): number {
  const distance = hexDistance(area.center, hex);

  // Outside radius = no influence
  if (distance > area.radius) return 0;

  // Linear decay from center
  const distanceFactor = 1 - (distance / area.radius);
  const decayedStrength = area.strength * Math.pow(distanceFactor, 1 / (1 - area.decay));

  return Math.max(0, Math.min(100, decayedStrength));
}

/**
 * Calculate distance between two hex coordinates (cube distance)
 */
function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * Get all hexes within influence area using proper hexagonal iteration.
 *
 * Uses the Red Blob Games axial coordinate algorithm to generate a proper
 * hexagonal region, avoiding the rectangular bounding box approach.
 *
 * @param area - Influence area
 * @returns Array of hex coordinates with their influence strength
 */
export function getInfluencedHexes(area: InfluenceArea): Array<{ hex: HexCoordinate; strength: number }> {
  const hexes: Array<{ hex: HexCoordinate; strength: number }> = [];
  const radius = area.radius;
  const centerQ = area.center.q;
  const centerR = area.center.r;

  // Red Blob Games hexagonal iteration algorithm (axial coordinates):
  // For each q from -N to +N, r ranges from max(-N, -q-N) to min(+N, -q+N)
  // This produces a proper hexagonal region, not a rectangle
  for (let dq = -radius; dq <= radius; dq++) {
    const r1 = Math.max(-radius, -dq - radius);
    const r2 = Math.min(radius, -dq + radius);
    for (let dr = r1; dr <= r2; dr++) {
      const q = centerQ + dq;
      const r = centerR + dr;
      const s = -q - r;
      const hex: HexCoordinate = { q, r, s };

      const strength = getInfluenceStrengthAt(area, hex);
      if (strength > 0) {
        hexes.push({ hex, strength });
      }
    }
  }

  return hexes;
}

/**
 * Merge multiple overlapping influence areas
 * When areas overlap, strongest influence wins
 */
export function mergeInfluenceAreas(areas: InfluenceArea[]): Map<string, { strength: number; sources: InfluenceArea[] }> {
  const hexInfluence = new Map<string, { strength: number; sources: InfluenceArea[] }>();

  for (const area of areas) {
    const influenced = getInfluencedHexes(area);

    for (const { hex, strength } of influenced) {
      const key = `${hex.q},${hex.r},${hex.s}`;
      const existing = hexInfluence.get(key);

      if (!existing || strength > existing.strength) {
        // New hex or stronger influence
        hexInfluence.set(key, {
          strength,
          sources: existing ? [...existing.sources, area] : [area],
        });
      } else if (existing) {
        // Same or weaker, but track as source
        existing.sources.push(area);
      }
    }
  }

  return hexInfluence;
}

/**
 * Get locations that influence a specific hex
 * @param hex - Target hex coordinate
 * @param locations - All locations to check
 * @returns Array of locations that influence this hex, sorted by strength (strongest first)
 */
export function getInfluencingLocations(
  hex: HexCoordinate,
  locations: LocationData[]
): Array<{ location: LocationData; strength: number }> {
  const influences: Array<{ location: LocationData; strength: number }> = [];

  for (const location of locations) {
    const area = calculateInfluenceArea(location);
    if (!area) continue;

    const strength = getInfluenceStrengthAt(area, hex);
    if (strength > 0) {
      influences.push({ location, strength });
    }
  }

  // Sort by strength descending
  return influences.sort((a, b) => b.strength - a.strength);
}
