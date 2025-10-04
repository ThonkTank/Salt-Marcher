// salt-marcher/tests/core/terrain-schema.test.ts
import { afterEach, describe, expect, it } from "vitest";

import {
    TERRAIN_COLORS,
    TERRAIN_SPEEDS,
    TerrainValidationError,
    setTerrainPalette,
    setTerrains,
    validateTerrainSchema,
} from "../../src/core/terrain";

describe("terrain schema validation", () => {
    afterEach(() => {
        setTerrains({});
    });

    it("applies defaults and merges validated entries", () => {
        const schema = validateTerrainSchema({
            Wald: { color: "#00aa00", speed: 0.75 },
            Steppe: { color: "#ffaa00", speed: 0.9 },
        });

        expect(schema).toMatchObject({
            "": { color: "transparent", speed: 1 },
            Wald: { color: "#00aa00", speed: 0.75 },
            Steppe: { color: "#ffaa00", speed: 0.9 },
        });

        setTerrains(schema);

        expect(TERRAIN_COLORS.Steppe).toBe("#ffaa00");
        expect(TERRAIN_SPEEDS.Steppe).toBe(0.9);
        expect(TERRAIN_COLORS.Wald).toBe("#00aa00");
    });

    it("rejects invalid colors and speeds", () => {
        expect(() =>
            validateTerrainSchema({
                Moor: { color: "pinkish", speed: Number.NaN },
            })
        ).toThrowError(TerrainValidationError);

        expect(() =>
            validateTerrainSchema({
                Moor: { color: "#112233", speed: -1 },
            })
        ).toThrowError(TerrainValidationError);
    });

    it("keeps palettes aligned with validated schema", () => {
        setTerrainPalette({
            "": "transparent",
            Hochebene: "#333333",
        });

        expect(TERRAIN_COLORS.Hochebene).toBe("#333333");
        expect(TERRAIN_SPEEDS.Hochebene).toBe(1);
    });

    it("normalises stray punctuation in stored color values", () => {
        const schema = validateTerrainSchema({
            Moor: { color: ": : : transparent", speed: 0.8 },
            Steppe: { color: "'#123456'", speed: 0.9 },
        });

        expect(schema.Moor.color).toBe("transparent");
        expect(schema.Steppe.color).toBe("#123456");
    });
});
