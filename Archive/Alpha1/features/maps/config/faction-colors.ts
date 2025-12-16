// src/features/maps/config/faction-colors.ts
// Shared color palette utilities for faction overlays on the map.

export const DEFAULT_FACTION_COLORS = [
    "#2E86AB",
    "#F6AA1C",
    "#C7443E",
    "#6A994E",
    "#4A4E69",
    "#EF8354",
    "#16697A",
    "#6C5B7B",
    "#3DCCC7",
    "#D9BF77",
    "#B8336A",
    "#1B998B",
    "#FF6F59",
    "#355070",
    "#70C1B3",
    "#F25F5C",
] as const;

const FALLBACK_COLOR = "#9E9E9E";

/**
 * Deterministically maps a faction identifier to a color from the palette.
 * Falls back to `FALLBACK_COLOR` if the palette is empty.
 */
export function getFactionColor(
    factionId: string,
    palette: readonly string[] = DEFAULT_FACTION_COLORS
): string {
    const basePalette = palette.length > 0 ? palette : DEFAULT_FACTION_COLORS;
    if (basePalette.length === 0) return FALLBACK_COLOR;

    const key = factionId.trim();
    if (!key) return basePalette[0];

    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    const index = hash % basePalette.length;
    return basePalette[index] ?? basePalette[0] ?? FALLBACK_COLOR;
}
