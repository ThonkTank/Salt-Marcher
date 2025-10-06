// Testspezifikation für den LibraryStoragePort-Contract, Fehlerklassifikation und Legacy-Mapping.
import { describe, expect, it } from "vitest";
import { LIBRARY_SOURCE_IDS } from "../../src/apps/library/core/sources";
import {
    LEGACY_LIBRARY_STORAGE_MAPPING,
    describeLegacyStorageGaps,
    describeLibraryStorageDomain,
    ensureLegacyStorageCoverage,
    listLibraryStorageDomains,
    createLibraryStorageError,
} from "../../src/apps/library/core/library-storage-port";

describe("library-storage-port", () => {
    it("liefert Descriptoren für alle Library-Quellen und das Preset-Cluster", () => {
        const descriptors = listLibraryStorageDomains();
        const ids = descriptors.map(entry => entry.id);
        for (const id of [...LIBRARY_SOURCE_IDS, "presets"] as const) {
            expect(ids).toContain(id);
            const descriptor = describeLibraryStorageDomain(id);
            expect(descriptor.id).toBe(id);
            expect(descriptor.description.length).toBeGreaterThan(0);
        }
        expect(() => describeLibraryStorageDomain("unknown" as any)).toThrow(/Unknown library storage domain/);
    });

    it("stellt ein Mapping für alle Legacy-Adapter bereit", () => {
        ensureLegacyStorageCoverage();
        for (const [domain, entries] of Object.entries(LEGACY_LIBRARY_STORAGE_MAPPING)) {
            expect(entries.length, `${domain} mapping length`).toBeGreaterThan(0);
            for (const entry of entries) {
                expect(entry.module.length).toBeGreaterThan(0);
                expect(entry.responsibilities.length).toBeGreaterThan(0);
            }
        }
    });

    it("meldet offene Responsibilities ausschließlich für das Preset-Cluster", () => {
        const gaps = describeLegacyStorageGaps();
        const presetGap = gaps.find(gap => gap.domain === "presets");
        expect(presetGap?.missing).toEqual(["list", "watch", "create"]);
        const otherGaps = gaps.filter(gap => gap.domain !== "presets");
        expect(otherGaps).toHaveLength(0);
    });

    it("erzeugt strukturierte Storage-Fehler mit Fallback-Nachricht", () => {
        const error = createLibraryStorageError({
            domain: "creatures",
            operation: "read-domain",
            kind: "io",
            ref: { domain: "creatures", path: "SaltMarcher/Creatures/alpha.md" },
        });
        expect(error.message).toContain("read-domain failed");
        expect(error.domain).toBe("creatures");
        expect(Object.isFrozen(error)).toBe(true);
    });
});

