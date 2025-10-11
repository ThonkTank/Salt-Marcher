// salt-marcher/tests/library/creatures-create-modal.test.ts
// Verifiziert die Integration des öffentlichen Create-Modals für Creatures.
import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import * as createModule from "../../src/ui/workmode/create";
import { LIBRARY_VIEW_CONFIGS } from "../../src/apps/library/view/view-registry";
import * as creaturePresetModule from "../../src/apps/library/core/creature-presets";
import { CREATURE_CREATE_SPEC } from "../../src/apps/library/create/creature/create-spec";

describe("Library creatures create modal integration", () => {
    it("passes the app instance to openCreateModal", async () => {
        const app = { workspace: { openLinkText: vi.fn().mockResolvedValue(undefined) } } as unknown as App;
        const reloadEntries = vi.fn().mockResolvedValue(undefined);
        const context = {
            app,
            reloadEntries,
            getRenderer: () => LIBRARY_VIEW_CONFIGS.creatures,
            getFilterSelection: () => undefined,
        };

        const openSpy = vi.spyOn(createModule, "openCreateModal").mockResolvedValue({
            filePath: "SaltMarcher/Creatures/new-creature.md",
            values: {},
        });
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await LIBRARY_VIEW_CONFIGS.creatures.handleCreate(context, "Hydra");

        expect(openSpy).toHaveBeenCalledTimes(1);
        const options = openSpy.mock.calls[0]?.[1];
        expect(options?.app).toBe(app);
        expect(reloadEntries).toHaveBeenCalledTimes(1);
        expect(app.workspace.openLinkText).toHaveBeenCalledWith(
            "SaltMarcher/Creatures/new-creature.md",
            "SaltMarcher/Creatures/new-creature.md",
            true,
            { state: { mode: "source" } },
        );
        expect(errorSpy).not.toHaveBeenCalled();

        openSpy.mockRestore();
        errorSpy.mockRestore();
    });
});

describe("Library creatures edit modal integration", () => {
    it("opens the declarative modal with the existing file path", async () => {
        const app = { workspace: { openLinkText: vi.fn().mockResolvedValue(undefined) } } as unknown as App;
        const reloadEntries = vi.fn().mockResolvedValue(undefined);
        const context = {
            app,
            reloadEntries,
            getRenderer: () => LIBRARY_VIEW_CONFIGS.creatures,
            getFilterSelection: () => undefined,
        };
        const entry = {
            name: "Hydra",
            file: { path: "SaltMarcher/Creatures/Hydra.md" },
        } as any;

        const loadSpy = vi
            .spyOn(creaturePresetModule, "loadCreaturePreset")
            .mockResolvedValue({ name: "Hydra" });
        const openSpy = vi.spyOn(createModule, "openCreateModal").mockResolvedValue({
            filePath: "SaltMarcher/Creatures/Hydra.md",
            values: {},
        });

        const editAction = LIBRARY_VIEW_CONFIGS.creatures.actions.find((action) => action.id === "edit");
        expect(editAction).toBeDefined();
        await editAction!.execute(entry, context as any);

        expect(loadSpy).toHaveBeenCalledWith(app, entry.file);
        expect(openSpy).toHaveBeenCalledTimes(1);
        const [specArg, options] = openSpy.mock.calls[0] ?? [];
        expect(specArg).toBe(CREATURE_CREATE_SPEC);
        expect(options).toEqual(
            expect.objectContaining({
                app,
                preset: expect.objectContaining({ existingFilePath: "SaltMarcher/Creatures/Hydra.md" }),
            }),
        );
        expect(reloadEntries).toHaveBeenCalledTimes(1);
        expect(app.workspace.openLinkText).toHaveBeenCalledWith(
            "SaltMarcher/Creatures/Hydra.md",
            "SaltMarcher/Creatures/Hydra.md",
            true,
            { state: { mode: "source" } },
        );

        openSpy.mockRestore();
        loadSpy.mockRestore();
    });
});

