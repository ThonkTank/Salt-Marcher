// salt-marcher/tests/contracts/library-contracts.test.ts
// Prüft den Library-Vertragstest-Harness auf Port-Parität, Persistenz und Debounce-Verhalten.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { ItemsRenderer } from "../../src/apps/library/view/items";
import { EquipmentRenderer } from "../../src/apps/library/view/equipment";
import { loadCreaturePreset } from "../../src/apps/library/core/creature-presets";
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

    it("parst Fixture-Frontmatter über Import-Helfer ohne Fehler", async () => {
        // Arrange
        const [creaturePath] = await harness.ports.storage.list("creatures");
        const [itemPath] = await harness.ports.storage.list("items");
        const [equipmentPath] = await harness.ports.storage.list("equipment");
        const creatureFile = harness.app.vault.getAbstractFileByPath(creaturePath ?? "");
        const itemFile = harness.app.vault.getAbstractFileByPath(itemPath ?? "");
        const equipmentFile = harness.app.vault.getAbstractFileByPath(equipmentPath ?? "");
        if (!(creatureFile instanceof TFile) || !(itemFile instanceof TFile) || !(equipmentFile instanceof TFile)) {
            throw new Error("Expected seeded fixture files to exist");
        }
        const itemsRenderer = new ItemsRenderer(harness.app as any, document.createElement("div"));
        const equipmentRenderer = new EquipmentRenderer(harness.app as any, document.createElement("div"));

        // Act
        const creaturePreset = await loadCreaturePreset(harness.app as any, creatureFile);
        const itemData = await (itemsRenderer as any).parseItemFromFile(itemFile);
        const equipmentData = await (equipmentRenderer as any).parseEquipmentFromFile(equipmentFile);

        // Assert
        expect(creaturePreset.entries?.length ?? 0).toBeGreaterThan(0);
        expect(creaturePreset.entries?.some(entry => entry.name?.includes("Tail Spike"))).toBe(true);
        expect(creaturePreset.saves?.[0]?.ability).toBe("str");
        expect(Array.isArray(itemData.properties)).toBe(true);
        expect(itemData.description).toContain("sea-silver thread");
        expect(Array.isArray(equipmentData.properties)).toBe(true);
        expect(equipmentData.description).toContain("stormglass");
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
