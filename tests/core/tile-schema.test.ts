// salt-marcher/tests/core/tile-schema.test.ts
import { afterEach, describe, expect, it } from "vitest";

import { validateTileData, TileValidationError } from "../../src/core/hex-mapper/hex-notes";
import { setTerrains } from "../../src/core/terrain";

describe("tile schema validation", () => {
    afterEach(() => {
        setTerrains({});
    });

    it("trims values and returns sanitized data", () => {
        const sanitized = validateTileData({ terrain: " Wald ", region: "  Küste  ", note: "  info  " });
        expect(sanitized).toEqual({ terrain: "Wald", region: "Küste", note: "info" });
    });

    it("rejects unknown terrains by default", () => {
        expect(() => validateTileData({ terrain: "Sumpf" })).toThrowError(TileValidationError);
    });

    it("accepts unknown terrains when explicitly allowed", () => {
        const sanitized = validateTileData({ terrain: "Sumpf" }, { allowUnknownTerrain: true });
        expect(sanitized.terrain).toBe("Sumpf");
    });

    it("honours updated terrain registries", () => {
        setTerrains({
            Wald: { color: "#2e7d32", speed: 0.6 },
            Sumpf: { color: "#335544", speed: 0.4 },
        });

        expect(() => validateTileData({ terrain: "Sumpf" })).not.toThrow();
    });
});
