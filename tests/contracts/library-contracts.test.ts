// salt-marcher/tests/contracts/library-contracts.test.ts
// Prüft den Library-Vertragstest-Harness auf Port-Parität, Persistenz und Debounce-Verhalten.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLibraryHarness, type LibraryHarness } from "./library-harness";

let harness: LibraryHarness;

beforeEach(async () => {
    harness = createLibraryHarness();
    await harness.reset();
});

describe("library contract harness", () => {
    it("rendert deterministische Moduslisten für Legacy- und v2-Renderer", async () => {
        const v2Names = harness.ports.renderer.render("creatures").map(entry => entry.name);
        await harness.use({ renderer: "legacy" });
        const legacyNames = harness.ports.renderer.render("creatures").map(entry => entry.name);
        expect(legacyNames).toEqual(v2Names);
    });

    it("persistiert Creature-Imports über den Storage-Port", async () => {
        const [creatureFixture] = harness.fixtures.creatures.entries;
        const importFixture = { ...creatureFixture, name: `${creatureFixture.name} QA` };
        const path = await harness.ports.storage.writeCreature(importFixture);
        const contents = await harness.ports.storage.read(path);
        const expected = harness.ports.serializer.creatureToMarkdown(importFixture);
        expect(path).toContain("QA");
        expect(contents).toContain(importFixture.name);
        expect(contents).toContain("Multiattack");
        expect(contents).toBe(expected);
    });

    it("lädt Item-Presets deterministisch", async () => {
        const [, betaItem] = harness.fixtures.items.entries;
        const newPath = await harness.ports.storage.writeItem(betaItem);
        const stored = await harness.ports.storage.read(newPath);
        const expected = harness.ports.serializer.itemToMarkdown(betaItem);
        expect(stored).toContain(betaItem.name ?? "");
        expect(stored).toContain("nearest underwater ruin");
        expect(stored).toBe(expected);
    });

    it("übernimmt Terrain- und Regions-Fix­tures für Debounce-Save-Regressionen", async () => {
        const terrains = await harness.ports.storage.loadTerrains();
        const normalizedTerrains = Object.fromEntries(
            Object.entries(terrains).map(([key, value]) => [
                key,
                { color: value.color.replace(/^:\s*/, "").trim(), speed: value.speed },
            ])
        );
        expect(normalizedTerrains).toMatchObject(harness.fixtures.terrains.entries);
        const regions = await harness.ports.storage.loadRegions();
        expect(regions.map(r => r.name)).toEqual(harness.fixtures.regions.entries.map(r => r.name));
    });

    it("debounced Save-Events über den Event-Port", async () => {
        const handler = vi.fn();
        harness.ports.event.debounce("library:save", handler, 10);
        harness.ports.event.emit("library:save", { domain: "regions" });
        harness.ports.event.emit("library:save", { domain: "regions" });
        await harness.ports.event.flushDebounce();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
