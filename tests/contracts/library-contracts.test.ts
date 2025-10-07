// salt-marcher/tests/contracts/library-contracts.test.ts
// Prüft den Library-Vertragstest-Harness auf Port-Parität, Persistenz und Debounce-Verhalten.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { loadCreaturePreset } from "../../src/apps/library/core/creature-presets";
import { findSpellPresets, getSpellLevels, loadSpellPreset } from "../../src/apps/library/core/spell-presets";
import { loadItemFile } from "../../src/apps/library/core/item-files";
import { loadEquipmentFile } from "../../src/apps/library/core/equipment-files";
import {
    createLibraryHarness,
    type LibraryAdapterKind,
    type LibraryHarness,
    type LibraryPortId,
} from "./library-harness";

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
        const [spellPresetPath] = await harness.ports.storage.list("spell-presets");
        const creatureFile = harness.app.vault.getAbstractFileByPath(creaturePath ?? "");
        const itemFile = harness.app.vault.getAbstractFileByPath(itemPath ?? "");
        const equipmentFile = harness.app.vault.getAbstractFileByPath(equipmentPath ?? "");
        const spellPresetFile = harness.app.vault.getAbstractFileByPath(spellPresetPath ?? "");
        if (
            !(creatureFile instanceof TFile) ||
            !(itemFile instanceof TFile) ||
            !(equipmentFile instanceof TFile) ||
            !(spellPresetFile instanceof TFile)
        ) {
            throw new Error("Expected seeded fixture files to exist");
        }
        // Act
        const creaturePreset = await loadCreaturePreset(harness.app as any, creatureFile);
        const itemData = await loadItemFile(harness.app as any, itemFile);
        const equipmentData = await loadEquipmentFile(harness.app as any, equipmentFile);
        const spellPreset = await loadSpellPreset(harness.app as any, spellPresetFile);
        const spellSearch = await findSpellPresets(harness.app as any, "Ember", { limit: 5 });
        const spellLevels = await getSpellLevels(harness.app as any);

        // Assert
        expect(creaturePreset.entries?.length ?? 0).toBeGreaterThan(0);
        expect(creaturePreset.entries?.some(entry => entry.name?.includes("Tail Spike"))).toBe(true);
        expect(creaturePreset.saves?.[0]?.ability).toBe("str");
        expect(Array.isArray(itemData.properties)).toBe(true);
        expect(itemData.description).toContain("sea-silver thread");
        expect(Array.isArray(equipmentData.properties)).toBe(true);
        expect(equipmentData.description).toContain("stormglass");
        expect(spellPreset.level).toBe(2);
        expect(spellPreset.classes).toEqual(["Wizard", "Artificer"]);
        expect(spellPreset.description).toContain("emberlight");
        expect(spellSearch.map(entry => entry.data.name)).toContain("Ember Ward");
        expect(spellLevels).toEqual(expect.arrayContaining([0, 2]));
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

    it("meldet Telemetrie für aktive Ports", async () => {
        const activated: Array<{ port: LibraryPortId; kind: LibraryAdapterKind }> = [];
        const onAdapterActivated = vi.fn((info: { port: LibraryPortId; kind: LibraryAdapterKind }) => {
            activated.push(info);
        });
        const onEvent = vi.fn();
        harness = createLibraryHarness({ telemetry: { onAdapterActivated, onEvent } });
        await harness.reset();

        // Default (v2) adapters should report usage when invoked.
        harness.ports.renderer.render("items");
        harness.ports.serializer.creatureToMarkdown(harness.fixtures.creatures.entries[0]);
        harness.ports.event.emit("library:save", { domain: "items" });
        await harness.ports.event.flushDebounce();

        // Switch to legacy adapters and ensure telemetry fires again.
        await harness.use({ renderer: "legacy", serializer: "legacy", storage: "legacy", event: "legacy" });
        harness.ports.renderer.render("creatures");
        harness.ports.serializer.itemToMarkdown(harness.fixtures.items.entries[0]);
        harness.ports.event.emit("library:save", { domain: "creatures" });
        await harness.ports.event.flushDebounce();

        expect(onEvent).toHaveBeenCalledWith({ event: "library:save", payload: { domain: "items" } });
        expect(onEvent).toHaveBeenCalledWith({ event: "library:save", payload: { domain: "creatures" } });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "storage", kind: "v2" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "serializer", kind: "v2" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "event", kind: "v2" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "renderer", kind: "v2" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "storage", kind: "legacy" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "serializer", kind: "legacy" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "event", kind: "legacy" });
        expect(onAdapterActivated).toHaveBeenCalledWith({ port: "renderer", kind: "legacy" });
        expect(activated.filter(info => info.port === "storage").length).toBe(2);
    });
});
