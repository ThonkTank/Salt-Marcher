// src/apps/map-editor/inspektor/inspektor-options.ts
import type { ToolModule } from "../tools-api";
import { loadTile, saveTile } from "../../../core/hex-mapper/hex-notes";
import { TERRAIN_COLORS } from "../../../core/terrain";

export function createInspectorTool(): ToolModule {
    let sel: { r: number; c: number } | null = null;
    let ui: { terr?: HTMLSelectElement; note?: HTMLTextAreaElement } = {};
    let saveTimer: number | null = null;

    function scheduleSave(ctx: any) {
        if (!sel) return;
        const file = ctx.getFile();
        if (!file) return;
        const handles = ctx.getHandles();
        if (saveTimer) window.clearTimeout(saveTimer);

        // debounce saves to reduce churn
        saveTimer = window.setTimeout(async () => {
            const terrain = ui.terr?.value ?? "";
            const note = ui.note?.value ?? "";
            await saveTile(ctx.app, file, sel!, { terrain, note });

            // Renderer live updaten
            const color = TERRAIN_COLORS[terrain] ?? "transparent";
            handles?.setFill(sel!, color);
        }, 250);
    }

    async function loadSelection(ctx: any) {
        if (!sel) return;
        const file = ctx.getFile();
        if (!file) return;
        const data = await loadTile(ctx.app, file, sel!);
        if (ui.terr) ui.terr.value = data?.terrain ?? "";
        if (ui.note) ui.note.value = data?.note ?? "";
    }

    return {
        id: "inspektor",
        label: "Inspektor",

        mountPanel(root, ctx) {
            root.createEl("h3", { text: "Inspektor" });

            // Terrain
            const terrRow = root.createDiv({ cls: "sm-row" });
            terrRow.createEl("label", { text: "Terrain:" });
            ui.terr = terrRow.createEl("select") as HTMLSelectElement;
            for (const t of Object.keys(TERRAIN_COLORS)) {
                const opt = ui.terr.createEl("option", { text: t || "(leer)" }) as HTMLOptionElement;
                opt.value = t;
            }
            ui.terr.disabled = true;
            ui.terr.onchange = () => scheduleSave(ctx);

            // Note
            const noteRow = root.createDiv({ cls: "sm-row" });
            noteRow.createEl("label", { text: "Notiz:" });
            ui.note = noteRow.createEl("textarea", { attr: { rows: "6" } }) as HTMLTextAreaElement;
            ui.note.disabled = true;
            ui.note.oninput = () => scheduleSave(ctx);

            // Cleanup
            return () => {
                root.empty();
                ui = {};
                sel = null;
                if (saveTimer) window.clearTimeout(saveTimer);
            };
        },

        onActivate() { /* nichts nötig */ },
        onDeactivate() { /* nichts nötig */ },
        onMapRendered() { /* wartet auf Klick */ },

        async onHexClick(rc, ctx) {
            sel = rc;

            // Eingaben freischalten & Daten laden
            if (ui.terr) ui.terr.disabled = false;
            if (ui.note) ui.note.disabled = false;

            await loadSelection(ctx);
            return true; // handled → hex-render öffnet keine Note
        },
    };
}
