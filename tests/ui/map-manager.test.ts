// salt-marcher/tests/ui/map-manager.test.ts
// Prüft den Map-Manager auf Dateiaktionen, Notizen und Fehlerpfade.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { createMapManager, MAP_MANAGER_COPY } from "../../src/ui/map-manager";
import type { deleteMapAndTiles as DeleteMapAndTiles } from "../../src/core/map-delete";

const notices: string[] = [];

vi.mock("obsidian", async () => {
    const actual = await vi.importActual<typeof import("obsidian")>("obsidian");

    class Notice extends actual.Notice {
        constructor(message?: string) {
            super(message);
            if (message) notices.push(message);
        }
    }

    return {
        ...actual,
        Notice,
    };
});

const confirmModals: { onConfirm: () => Promise<void> }[] = [];

vi.mock("../../src/ui/confirm-delete", () => ({
    ConfirmDeleteModal: class {
        onConfirm: () => Promise<void>;
        constructor(_app: App, _target: TFile, onConfirm: () => Promise<void>) {
            this.onConfirm = onConfirm;
            confirmModals.push({ onConfirm });
        }
        open() {
            // Actual modal is interactive; tests trigger the confirmation explicitly.
        }
    },
}));

const deleteMapAndTiles = vi.fn<Parameters<DeleteMapAndTiles>, ReturnType<DeleteMapAndTiles>>();

vi.mock("../../src/core/map-delete", () => ({
    deleteMapAndTiles: (...args: Parameters<typeof deleteMapAndTiles>) => deleteMapAndTiles(...args),
}));

const appStub = { workspace: {} } as unknown as App;

const createFile = (path: string): TFile => ({ path, basename: path.split("/").pop() ?? path }) as TFile;

describe("createMapManager", () => {
    beforeEach(() => {
        notices.length = 0;
        confirmModals.length = 0;
        deleteMapAndTiles.mockReset();
    });

    it("uses the default notice when no map is selected", () => {
        const manager = createMapManager(appStub);

        manager.deleteCurrent();

        expect(notices).toContain(MAP_MANAGER_COPY.notices.missingSelection);
    });

    it("shows the failure notice when deletion fails", async () => {
        const file = createFile("maps/example.map");
        const manager = createMapManager(appStub, { initialFile: file });
        deleteMapAndTiles.mockRejectedValueOnce(new Error("boom"));

        manager.deleteCurrent();
        expect(confirmModals).toHaveLength(1);

        const modal = confirmModals[0];
        await modal.onConfirm().catch(() => undefined);

        expect(notices).toContain(MAP_MANAGER_COPY.notices.deleteFailed);
    });
});
