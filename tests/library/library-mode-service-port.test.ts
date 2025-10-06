// Testspezifikation für den LibraryModeServicePort-Contract und seine Composition-Pläne.
import { describe, expect, it } from "vitest";
import {
    LIBRARY_MODE_COMPOSITION,
    LIBRARY_MODE_DESCRIPTORS,
    LIBRARY_MODE_SERVICE_FEATURES,
    describeLibraryMode,
    listLibraryModeDescriptors,
    resolveLibraryModeKillSwitch,
} from "../../src/apps/library/core/library-mode-service-port";
import { LIBRARY_SOURCE_IDS, describeLibrarySource } from "../../src/apps/library/core/sources";

describe("library-mode-service-port", () => {
    it("stellt für jede Library-Quelle einen Descriptor bereit", () => {
        const descriptors = listLibraryModeDescriptors();
        expect(descriptors).toHaveLength(LIBRARY_SOURCE_IDS.length);

        for (const id of LIBRARY_SOURCE_IDS) {
            const descriptor = descriptors.find(entry => entry.id === id);
            expect(descriptor, `descriptor for ${id}`).toBeTruthy();
            expect(descriptor?.description).toContain(describeLibrarySource(id));
            expect(descriptor?.defaultCreateLabel.length ?? 0).toBeGreaterThan(0);
        }

        expect(() => describeLibraryMode("unknown" as any)).toThrow(/Unknown library mode/);
    });

    it("ordnet jedem Descriptor einen Composition-Plan zu", () => {
        const plans = LIBRARY_MODE_COMPOSITION;
        expect(Object.keys(plans)).toHaveLength(LIBRARY_SOURCE_IDS.length);

        for (const descriptor of LIBRARY_MODE_DESCRIPTORS) {
            const plan = plans[descriptor.id];
            expect(plan, `composition plan for ${descriptor.id}`).toBeTruthy();
            expect(plan.serializerTemplate.length).toBeGreaterThan(0);
            expect(plan.storagePortModule.startsWith("@core/library/storage/")).toBe(true);
        }
    });

    it("wertet Kill-Switch-Flags deterministisch aus", () => {
        const defaults = resolveLibraryModeKillSwitch();
        expect(defaults).toEqual({ useService: true, allowLegacyFallback: true });

        const disabled = resolveLibraryModeKillSwitch({
            flags: {
                [LIBRARY_MODE_SERVICE_FEATURES.rendererServiceFlag]: false,
                [LIBRARY_MODE_SERVICE_FEATURES.legacyFallbackFlag]: true,
            },
        });
        expect(disabled).toEqual({ useService: false, allowLegacyFallback: true });

        const overrides = resolveLibraryModeKillSwitch({
            flags: {
                [LIBRARY_MODE_SERVICE_FEATURES.rendererServiceFlag]: true,
                [LIBRARY_MODE_SERVICE_FEATURES.legacyFallbackFlag]: true,
            },
            overrides: { useService: false, allowLegacyFallback: false },
        });
        expect(overrides).toEqual({ useService: false, allowLegacyFallback: false });
    });
});
