// src/core/terrain.ts
export const DEFAULT_TERRAIN_COLORS = Object.freeze({
    "": "transparent",
    Wald: "#2e7d32",
    Meer: "#0288d1",
    Berg: "#6d4c41",
}) as const;

export const DEFAULT_TERRAIN_SPEEDS = Object.freeze({
    "": 1,      // leeres Terrain = neutral
    Wald: 0.6,
    Meer: 0.5,
    Berg: 0.4,
}) as const;

export const TERRAIN_COLORS: Record<string, string> = { ...DEFAULT_TERRAIN_COLORS };
export const TERRAIN_SPEEDS: Record<string, number> = { ...DEFAULT_TERRAIN_SPEEDS };

/** Back-compat: nur Farben setzen. Speed wird passend aufgefüllt (Default=1, Defaults bevorzugt). */
export function setTerrainPalette(next: Record<string, string>) {
    const mergedColors = { ...DEFAULT_TERRAIN_COLORS, ...next, "": "transparent" };

    // Farben aktualisieren (Keys entfernen, die fehlen)
    for (const k of Object.keys(TERRAIN_COLORS)) if (!(k in mergedColors)) delete TERRAIN_COLORS[k];
    Object.assign(TERRAIN_COLORS, mergedColors);

    // Speeds synchron zu Farben halten
    const nextSpeeds: Record<string, number> = {};
    for (const k of Object.keys(TERRAIN_COLORS)) {
        nextSpeeds[k] = k in DEFAULT_TERRAIN_SPEEDS ? DEFAULT_TERRAIN_SPEEDS[k as keyof typeof DEFAULT_TERRAIN_SPEEDS] : 1;
    }
    for (const k of Object.keys(TERRAIN_SPEEDS)) if (!(k in nextSpeeds)) delete TERRAIN_SPEEDS[k];
    Object.assign(TERRAIN_SPEEDS, nextSpeeds);
}

/** Neu: Farben + Speed gemeinsam setzen. */
export function setTerrains(next: Record<string, { color: string; speed?: number }>) {
    const colors: Record<string, string> = {};
    const speeds: Record<string, number> = {};

    for (const [name, val] of Object.entries(next)) {
        const n = (name ?? "").trim();
        const color = (val?.color ?? "").trim() || "transparent";
        const sp = Number.isFinite(val?.speed) ? (val!.speed as number) : 1;
        colors[n] = color;
        speeds[n] = sp;
    }

    // Defaults einmischen + leeres Terrain garantieren
    const mergedColors = { ...DEFAULT_TERRAIN_COLORS, ...colors, "": "transparent" };
    const mergedSpeeds = { ...DEFAULT_TERRAIN_SPEEDS, ...speeds, "": 1 };

    // Anwenden (in-place, damit Importe live bleiben)
    for (const k of Object.keys(TERRAIN_COLORS)) if (!(k in mergedColors)) delete TERRAIN_COLORS[k];
    Object.assign(TERRAIN_COLORS, mergedColors);

    for (const k of Object.keys(TERRAIN_SPEEDS)) if (!(k in mergedSpeeds)) delete TERRAIN_SPEEDS[k];
    Object.assign(TERRAIN_SPEEDS, mergedSpeeds);
}
