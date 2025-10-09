// salt-marcher/tests/apps/almanac/almanac-controller.protocol.test.ts
// Verifiziert, dass der Controller seinen URL-Listener beim Schließen deregistriert.
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => await import("../../mocks/obsidian"));

import type { EventRef } from "obsidian";
import { App } from "obsidian";
import { AlmanacController } from "../../../src/apps/almanac/mode/almanac-controller";

describe("AlmanacController Protocol Handler", () => {
    it("entfernt den registrierten URL-Listener bei onClose", async () => {
        const app = new App();
        const offref = vi.fn();
        const eventRef: EventRef = { off: vi.fn() };
        const on = vi.fn(() => eventRef);
        Object.assign(app.workspace as unknown as { on: typeof on; offref: typeof offref }, {
            on,
            offref,
        });

        const controller = new AlmanacController(app);

        expect(on).toHaveBeenCalledTimes(1);

        await controller.onClose();

        expect(offref).toHaveBeenCalledWith(eventRef);
        const internal = controller as unknown as { protocolRef: EventRef | null };
        expect(internal.protocolRef).toBeNull();
    });
});
