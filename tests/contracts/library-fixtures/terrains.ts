// salt-marcher/tests/contracts/library-fixtures/terrains.ts
// Enthält deterministische Terrain-Listen inklusive Ownership-Metadaten.
export interface TerrainFixtureSet {
    owner: "Maps" | "QA";
    entries: Record<string, { color: string; speed: number }>;
}

export const terrainFixtures: TerrainFixtureSet = Object.freeze({
    owner: "Maps" as const,
    entries: Object.freeze({
        "": { color: "transparent", speed: 1 },
        Marshland: { color: "#558b2f", speed: 0.6 },
        "Shattered Coast": { color: "#0277bd", speed: 0.5 },
        "Sunken City": { color: "#4527a0", speed: 0.4 },
    }),
});
