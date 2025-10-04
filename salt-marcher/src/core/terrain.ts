// src/core/terrain.ts
export const DEFAULT_TERRAIN_COLORS = Object.freeze({
    "": "transparent",
    Wald: "#2e7d32",
    Meer: "#0288d1",
    Berg: "#6d4c41",
}) as const;

export const DEFAULT_TERRAIN_SPEEDS = Object.freeze({
    "": 1, // leeres Terrain = neutral
    Wald: 0.6,
    Meer: 0.5,
    Berg: 0.4,
}) as const;

export const TERRAIN_COLORS: Record<string, string> = { ...DEFAULT_TERRAIN_COLORS };
export const TERRAIN_SPEEDS: Record<string, number> = { ...DEFAULT_TERRAIN_SPEEDS };

const TERRAIN_NAME_MAX_LENGTH = 64;
const REGION_SPEED_MIN = 0;
const REGION_SPEED_MAX = 10;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_VAR_RE = /^var\(--[a-z0-9_-]+\)$/i;
const CSS_FUNCTION_RE = /^(?:rgb|rgba|hsl|hsla)\(/i;

function normalizeTerrainColor(input: unknown): string {
    if (typeof input !== "string") return "";

    let color = input.trim();
    if (!color) return "";

    if (
        (color.startsWith("\"") && color.endsWith("\"")) ||
        (color.startsWith("'") && color.endsWith("'"))
    ) {
        color = color.slice(1, -1).trim();
    }

    color = color.replace(/^[\s:]+/, "");

    return color.trim();
}

export class TerrainValidationError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Invalid terrain schema: ${issues.join(", ")}`);
        this.name = "TerrainValidationError";
    }
}

export function validateTerrainSchema(
    next: Record<string, { color: string; speed?: number }>
): Record<string, { color: string; speed: number }> {
    const validated: Record<string, { color: string; speed: number }> = {};
    const issues: string[] = [];

    for (const [rawName, rawValue] of Object.entries(next ?? {})) {
        const name = (rawName ?? "").trim();
        const color = normalizeTerrainColor(rawValue?.color);

        if (!name && rawName !== "") {
            issues.push(`Terrain name must not be empty (received: "${rawName}")`);
            continue;
        }
        if (name.length > TERRAIN_NAME_MAX_LENGTH) {
            issues.push(`Terrain name "${name}" exceeds ${TERRAIN_NAME_MAX_LENGTH} characters`);
            continue;
        }
        if (/[:\n\r]/.test(name)) {
            issues.push(`Terrain name "${name}" must not contain colons or line breaks`);
            continue;
        }

        if (!color) {
            issues.push(`Terrain "${name}" requires a color value`);
            continue;
        }
        if (
            color !== "transparent" &&
            !HEX_COLOR_RE.test(color) &&
            !CSS_VAR_RE.test(color) &&
            !CSS_FUNCTION_RE.test(color)
        ) {
            issues.push(`Terrain "${name}" uses unsupported color "${color}"`);
            continue;
        }

        let numericSpeed: number;
        if (rawValue?.speed === undefined) {
            numericSpeed = 1;
        } else {
            numericSpeed = Number(rawValue.speed);
        }

        if (!Number.isFinite(numericSpeed)) {
            issues.push(`Terrain "${name}" speed must be a finite number`);
            continue;
        }
        if (numericSpeed < REGION_SPEED_MIN || numericSpeed > REGION_SPEED_MAX) {
            issues.push(
                `Terrain "${name}" speed ${numericSpeed} must be between ${REGION_SPEED_MIN} and ${REGION_SPEED_MAX}`
            );
            continue;
        }

        validated[name] = { color, speed: numericSpeed };
    }

    if (!("" in validated)) {
        validated[""] = { color: "transparent", speed: 1 };
    }

    if (issues.length) {
        throw new TerrainValidationError(issues);
    }

    return validated;
}

function applyTerrainSchema(map: Record<string, { color: string; speed: number }>) {
    const mergedColors = { ...DEFAULT_TERRAIN_COLORS, ...Object.fromEntries(
        Object.entries(map).map(([name, value]) => [name, value.color])
    ) };
    const mergedSpeeds = { ...DEFAULT_TERRAIN_SPEEDS, ...Object.fromEntries(
        Object.entries(map).map(([name, value]) => [name, value.speed])
    ) };

    mergedColors[""] = map[""]?.color ?? "transparent";
    mergedSpeeds[""] = map[""]?.speed ?? 1;

    for (const key of Object.keys(TERRAIN_COLORS)) {
        if (!(key in mergedColors)) delete TERRAIN_COLORS[key];
    }
    Object.assign(TERRAIN_COLORS, mergedColors);

    for (const key of Object.keys(TERRAIN_SPEEDS)) {
        if (!(key in mergedSpeeds)) delete TERRAIN_SPEEDS[key];
    }
    Object.assign(TERRAIN_SPEEDS, mergedSpeeds);
}

/** Back-compat: nur Farben setzen. Speed wird passend aufgefüllt (Default=1, Defaults bevorzugt). */
export function setTerrainPalette(next: Record<string, string>) {
    const palette: Record<string, { color: string; speed: number }> = {};
    for (const [name, color] of Object.entries(next ?? {})) {
        const speed = name in DEFAULT_TERRAIN_SPEEDS
            ? DEFAULT_TERRAIN_SPEEDS[name as keyof typeof DEFAULT_TERRAIN_SPEEDS]
            : 1;
        palette[name] = { color, speed };
    }

    const validated = validateTerrainSchema(palette);
    applyTerrainSchema(validated);
}

/** Neu: Farben + Speed gemeinsam setzen. */
export function setTerrains(next: Record<string, { color: string; speed?: number }>) {
    const validated = validateTerrainSchema(next ?? {});
    applyTerrainSchema(validated);
}
