// src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts
import type { ToolModule } from "../tools-api";
import { attachBrushCircle } from "../brush-circle";
import { applyBrush } from "./brush";
import { TERRAIN_COLORS } from "../../../../../core/terrain";
import { loadRegions } from "../../../../../core/regions-store";
import { enhanceSelectToSearch } from "../../../../../ui/search-dropdown";
import { coordsInRadius } from "./brush-math";

export function createBrushTool(): ToolModule {
    // Radius 0 = exakt die angeklickte Zelle
    let state: { radius: number; region: string; terrain: string; mode: "paint" | "erase" } = {
        radius: 1, // UI zeigt 1 = nur Mitte
        region: "",
        terrain: "",
        mode: "paint",
    };
    const eff = () => Math.max(0, state.radius - 1);

    let circle: ReturnType<typeof attachBrushCircle> | null = null;

    return {
        id: "brush",
        label: "Brush",

        // Options-Panel (nur UI & State)
        mountPanel(root, ctx) {
            let disposed = false;
            let fillSeq = 0;

            root.createEl("h3", { text: "Region Brush" });

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

            // Region
            const regionRow = root.createDiv({ cls: "sm-row" });
            regionRow.createEl("label", { text: "Region:" });
            const regionSelect = regionRow.createEl("select") as HTMLSelectElement;
            enhanceSelectToSearch(regionSelect, 'Search dropdown…');

            const editRegionsBtn = regionRow.createEl("button", { text: "Manage…" });
            editRegionsBtn.onclick = () => (ctx.app as any).commands?.executeCommandById?.("salt-marcher:open-library");

            // Regionen laden und Dropdown füllen; Terrain ableiten
            const fillOptions = async () => {
                const seq = ++fillSeq;
                let regions: Awaited<ReturnType<typeof loadRegions>>;
                try {
                    regions = await loadRegions(ctx.app);
                } catch (err) {
                    console.error("[terrain-brush] failed to load regions", err);
                    if (seq === fillSeq) {
                        regionSelect.empty();
                        state.region = "";
                        state.terrain = "";
                    }
                    return;
                }

                if (disposed || ctx.getAbortSignal()?.aborted || seq !== fillSeq) {
                    return;
                }

                regionSelect.empty();
                regionSelect.createEl("option", { text: "(none)", value: "" });

                let matchedTerrain = state.terrain;
                let matchedRegion = state.region;

                for (const r of regions) {
                    const value = r.name ?? "";
                    const label = r.name || "(unnamed)";
                    const opt = regionSelect.createEl("option", { text: label, value });
                    if (r.terrain) opt.dataset.terrain = r.terrain;
                    if (value === state.region && value) {
                        opt.selected = true;
                        matchedRegion = value;
                        matchedTerrain = opt.dataset.terrain ?? "";
                    }
                }

                if (!matchedRegion && state.region) {
                    // previously selected region disappeared → reset state
                    state.region = "";
                    state.terrain = "";
                    regionSelect.value = "";
                } else {
                    state.region = matchedRegion;
                    state.terrain = matchedTerrain;
                    regionSelect.value = matchedRegion;
                }
            };
            void fillOptions();

            regionSelect.onchange = () => {
                state.region = regionSelect.value;
                const opt = regionSelect.selectedOptions[0] as HTMLOptionElement | undefined;
                state.terrain = opt?.dataset?.terrain ?? "";
            };
            // Live-Updates
            const workspace = ctx.app.workspace as any;
            const unsubscribe: Array<() => void> = [];
            const subscribe = (event: string) => {
                const handler = () => {
                    if (!disposed) void fillOptions();
                };
                const token = workspace?.on?.(event, handler);
                if (typeof workspace?.offref === "function" && token) {
                    unsubscribe.push(() => workspace.offref(token));
                } else if (typeof token === "function") {
                    unsubscribe.push(() => token());
                }
            };
            subscribe("salt:terrains-updated");
            subscribe("salt:regions-updated");

            // Modus (Malen/Löschen)
            const modeRow = root.createDiv({ cls: "sm-row" });
            modeRow.createEl("label", { text: "Mode:" });
            const modeSelect = modeRow.createEl("select") as HTMLSelectElement;
            modeSelect.createEl("option", { text: "Paint", value: "paint" });
            modeSelect.createEl("option", { text: "Erase", value: "erase" });
            modeSelect.value = state.mode;
            modeSelect.onchange = () => { state.mode = modeSelect.value as "paint" | "erase"; };
            enhanceSelectToSearch(modeSelect, 'Search dropdown…');

            return () => {
                disposed = true;
                fillSeq += 1;
                unsubscribe.forEach((off) => {
                    try {
                        off();
                    } catch (err) {
                        console.error("[terrain-brush] failed to unsubscribe", err);
                    }
                });
                radiusInput.oninput = null;
                regionSelect.onchange = null;
                modeSelect.onchange = null;
                editRegionsBtn.onclick = null;
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
                if (missing.length) handles.ensurePolys(missing);

            }
            // Schreiben & live färben
            await applyBrush(
                ctx.app, file, rc,
                { radius: eff(), terrain: state.terrain, region: state.region, mode: state.mode }, // Distanz reinschreiben
                handles
            );

            return true; // handled → Note wird nicht geöffnet
        },
    };
}
