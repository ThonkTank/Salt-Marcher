// src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts
import type { ToolModule } from "../tools-api";
import { attachBrushCircle } from "../brush-circle";
import { applyBrush } from "./brush";
import { TERRAIN_COLORS } from "../../../../../core/terrain";
import { coordsInRadius } from "./brush-math";

export function createBrushTool(): ToolModule {
    // Radius 0 = exakt die angeklickte Zelle
    let state: { radius: number; terrain: string; mode: "paint" | "erase" } = {
        radius: 1, // UI zeigt 1 = nur Mitte
        terrain: "Wald",
        mode: "paint",
    };
    const eff = () => Math.max(0, state.radius - 1);

    let circle: ReturnType<typeof attachBrushCircle> | null = null;

    return {
        id: "brush",
        label: "Brush",

        // Options-Panel (nur UI & State)
        mountPanel(root, ctx) {
            root.createEl("h3", { text: "Terrain-Brush" });

            // Radius
            const radiusRow = root.createDiv({ cls: "sm-row" });
            radiusRow.createEl("label", { text: "Radius:" });
            const radiusInput = radiusRow.createEl("input", {
                attr: { type: "range", min: "1", max: "6", step: "1" },
            }) as HTMLInputElement;
            radiusInput.value = String(state.radius);
            const radiusVal = radiusRow.createEl("span", { text: radiusInput.value });

            radiusInput.oninput = () => {
                state.radius = Number(radiusInput.value);      // UI-Wert
                radiusVal.textContent = radiusInput.value;
                circle?.updateRadius(eff());                   // Vorschau = Hex-Distanz
            };

            // Terrain
            const terrRow = root.createDiv({ cls: "sm-row" });
            terrRow.createEl("label", { text: "Terrain:" });
            const terrSelect = terrRow.createEl("select") as HTMLSelectElement;

            const editBtn = terrRow.createEl("button", { text: "Bearbeiten…" });
            editBtn.onclick = () => (ctx.app as any).commands?.executeCommandById?.("salt-marcher:open-terrain-editor");

            // Optionen aus der aktuellen Palette aufbauen
            const fillOptions = () => {
                terrSelect.empty();
                for (const t of Object.keys(TERRAIN_COLORS)) {
                    const opt = terrSelect.createEl("option", { text: t || "(leer)" }) as HTMLOptionElement;
                    opt.value = t;

                }
                // Falls das aktuelle Terrain entfernt wurde → auf leer zurückfallen
                if (TERRAIN_COLORS[state.terrain] === undefined) state.terrain = "";
                terrSelect.value = state.terrain;

            };
            fillOptions();

            terrSelect.onchange = () => { state.terrain = terrSelect.value; };
            // Live-Update aus dem Terrain-Editor
            const ref = (ctx.app.workspace as any).on?.("salt:terrains-updated", fillOptions);

            // Modus (Malen/Löschen)
            const modeRow = root.createDiv({ cls: "sm-row" });
            modeRow.createEl("label", { text: "Modus:" });
            const modeSelect = modeRow.createEl("select") as HTMLSelectElement;
            modeSelect.createEl("option", { text: "Malen", value: "paint" });
            modeSelect.createEl("option", { text: "Löschen", value: "erase" });
            modeSelect.value = state.mode;
            modeSelect.onchange = () => { state.mode = modeSelect.value as "paint" | "erase"; };

            return () => {
                if (ref) (ctx.app.workspace as any).offref?.(ref);
                root.empty();

            };

        },

        // Aktivierung/Deaktivierung → Kreis steuern
        onActivate(ctx) {
            const handles = ctx.getHandles();
            if (!handles) return;
            circle?.destroy();
            circle = attachBrushCircle(
                { svg: handles.svg, contentG: handles.contentG, overlay: handles.overlay },
                { initialRadius: eff(), hexRadiusPx: ctx.getOptions()?.radius ?? 42 }
            );
            circle.show();
        },
        onDeactivate() {
            circle?.destroy();
            circle = null;

        },
        onMapRendered(ctx) {
            const handles = ctx.getHandles();
            if (!handles) return;
            circle?.destroy();
            circle = attachBrushCircle(
                { svg: handles.svg, contentG: handles.contentG, overlay: handles.overlay },
                { initialRadius: eff(), hexRadiusPx: ctx.getOptions()?.radius ?? 42 }
            );
            circle.show();

        },

        // Hex-Klick: schreiben + live färben; neue Polys nur gezielt ergänzen
        async onHexClick(rc, ctx) {
            const file = ctx.getFile();
            const handles = ctx.getHandles();
            if (!file || !handles) return false;

            // Ziele im Radius – sauber dedupliziert (Sicherung gegen doppelte odd-r Berechnung etc.)
            const raw = coordsInRadius(rc, eff());
            const targets = [...new Map(raw.map(k => [`${k.r},${k.c}`, k])).values()];

            // Fehlende Polys zuerst anlegen (damit applyBrush sofort färbt)
            if (state.mode === "paint") {
                const missing = targets.filter(k => !handles.polyByCoord.has(`${k.r},${k.c}`));
                if (missing.length) (handles as any).ensurePolys?.(missing);

            }
            // Schreiben & live färben
            await applyBrush(
                ctx.app, file, rc,
                { radius: eff(), terrain: state.terrain, mode: state.mode }, // Distanz reinschreiben
                handles
            );

            return true; // handled → Note wird nicht geöffnet
        },
    };
}
