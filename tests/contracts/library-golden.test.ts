// salt-marcher/tests/contracts/library-golden.test.ts
// Validiert Golden-Files der Library-Serializer über deterministische Roundtrip-Vergleiche.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createLibraryHarness, type LibraryHarness } from "./library-harness";
import { spellPresetToMarkdown } from "../../src/apps/library/core/spell-presets";

const GOLDEN_ROOT = path.resolve(process.cwd(), "tests/golden/library");

type DomainKey = "creatures" | "items" | "equipment" | "spells";

type ManifestEntry = {
    fixtureId: string;
    name: string;
    storagePath: string;
    goldenFile: string;
    checksum: string;
};

type GoldenManifest = {
    schemaVersion: number;
    domain: DomainKey;
    generatedBy: string;
    generatedAt: string;
    owner: string;
    samples: ManifestEntry[];
};

const DOMAINS: DomainKey[] = ["creatures", "items", "equipment", "spells"];

function resolveManifestPath(domain: DomainKey): string {
    return path.join(GOLDEN_ROOT, domain, ".manifest.json");
}

async function loadManifest(domain: DomainKey): Promise<GoldenManifest> {
    const manifestPath = resolveManifestPath(domain);
    const raw = await readFile(manifestPath, "utf8");
    return JSON.parse(raw) as GoldenManifest;
}

describe("library serializer golden files", () => {
    let harness: LibraryHarness;

    beforeEach(async () => {
        harness = createLibraryHarness();
        await harness.reset();
    });

    for (const domain of DOMAINS) {
        describe(`${domain} golden set`, () => {
            let manifest: GoldenManifest;

            beforeAll(async () => {
                manifest = await loadManifest(domain);
            });

            it("stellt mindestens drei Golden-Beispiele bereit", () => {
                // Arrange
                if (!manifest) {
                    throw new Error(`Manifest ${domain} nicht geladen`);
                }
                const samples = manifest.samples;

                // Act
                const sampleCount = samples.length;

                // Assert
                expect(sampleCount).toBeGreaterThanOrEqual(3);
            });

            it("bewahrt alle Samples deterministisch", async () => {
                // Arrange
                if (!manifest) {
                    throw new Error(`Manifest ${domain} nicht geladen`);
                }
                const domainKey = domain === "spells" ? "spellPresets" : domain;
                const domainFixtures = harness.fixtures[domainKey].entries;

                // Act
                for (const sample of manifest.samples) {
                    const fixture = domainFixtures.find(entry => entry.fixtureId === sample.fixtureId);
                    if (!fixture) {
                        throw new Error(`Fixture ${sample.fixtureId} not found for domain ${domain}`);
                    }
                    const goldenPath = path.join(GOLDEN_ROOT, domain, sample.goldenFile);
                    const goldenContent = await readFile(goldenPath, "utf8");
                    const serialized = domain === "creatures"
                        ? harness.ports.serializer.creatureToMarkdown(fixture)
                        : domain === "items"
                        ? harness.ports.serializer.itemToMarkdown(fixture)
                        : domain === "equipment"
                        ? harness.ports.serializer.equipmentToMarkdown(fixture)
                        : spellPresetToMarkdown(fixture, { fixtureId: fixture.fixtureId });
                    const stored = await harness.ports.storage.read(sample.storagePath);

                    // Assert
                    expect(serialized).toBe(goldenContent);
                    expect(stored).toBe(goldenContent);
                }
            });
        });
    }
});
