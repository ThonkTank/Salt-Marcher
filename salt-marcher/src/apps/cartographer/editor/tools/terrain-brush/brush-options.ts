// src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts
import type { ToolModule } from "../tools-api";
import { attachBrushCircle } from "../brush-circle";
import { applyBrush } from "./brush";
import { TERRAIN_COLORS } from "../../../../../core/terrain";
import { loadRegions } from "../../../../../core/regions-store";
import { enhanceSelectToSearch } from "../../../../../ui/search-dropdown";
import { coordsInRadius } from "./brush-math";

const TOOL_ID = "brush";
const TOOL_LABEL = "Brush";

const MANAGE_REGIONS_COMMAND_ID = "salt-marcher:open-library";

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
        id: TOOL_ID,
        label: TOOL_LABEL,

        // Options-Panel (nur UI & State)
        mountPanel(root, ctx) {
            let disposed = false;
            let fillSeq = 0;

            let radiusInput!: HTMLInputElement;
            let regionSelect!: HTMLSelectElement;
            let editRegionsBtn!: HTMLButtonElement;
            let modeSelect!: HTMLSelectElement;
            let panelDisabled = false;
            let manageCommandAvailable = false;

            const setPanelDisabled = (disabled: boolean) => {
                panelDisabled = disabled;
                root.toggleClass("is-disabled", disabled);
                radiusInput.disabled = disabled;
                regionSelect.disabled = disabled;
                modeSelect.disabled = disabled;
                editRegionsBtn.disabled = disabled || !manageCommandAvailable;
            };

            const updateStatus = (message: string) => {
                try {
                    ctx.setStatus(message);
                } catch (err) {
                    console.error("[terrain-brush] failed to set status", err);
                }
            };

            root.createEl("h3", { text: "Region Brush" });

            type HintTone = "info" | "loading" | "error" | "warning";
            const inlineHint = root.createEl("p", { cls: "sm-inline-hint" });
            inlineHint.style.display = "none";
            const applyInlineHint = (details: { text: string; tone: HintTone } | null) => {
                if (!details || !details.text) {
                    inlineHint.style.display = "none";
                    inlineHint.empty();
                    inlineHint.removeAttribute("data-tone");
                    return;
                }
                inlineHint.style.display = "";
                inlineHint.setText(details.text);
                inlineHint.setAttr("data-tone", details.tone);
            };

            // Radius
            const radiusRow = root.createDiv({ cls: "sm-row" });
            radiusRow.createEl("label", { text: "Radius:" });
            radiusInput = radiusRow.createEl("input", {
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
            regionSelect = regionRow.createEl("select") as HTMLSelectElement;
            enhanceSelectToSearch(regionSelect, 'Search dropdown…');

            editRegionsBtn = regionRow.createEl("button", { text: "Manage…" });
            const manageHint = root.createEl("p", { cls: "sm-inline-hint" });
            manageHint.style.display = "none";
            const applyManageHint = (details: { text: string; tone: HintTone } | null) => {
                if (!details || !details.text) {
                    manageHint.style.display = "none";
                    manageHint.empty();
                    manageHint.removeAttribute("data-tone");
                    return;
                }
                manageHint.style.display = "";
                manageHint.setText(details.text);
                manageHint.setAttr("data-tone", details.tone);
            };

            const refreshManageCommandAvailability = () => {
                const commandsApi = (ctx.app as any).commands;
                manageCommandAvailable = Boolean(
                    commandsApi?.executeCommandById && commandsApi?.commands?.[MANAGE_REGIONS_COMMAND_ID]
                );
                editRegionsBtn.disabled = panelDisabled || !manageCommandAvailable;
                editRegionsBtn.toggleClass("is-missing-command", !manageCommandAvailable);
                if (!manageCommandAvailable) {
                    applyManageHint({
                        text: "The “Open Library” command is unavailable. Open the Library view from the ribbon (book icon) and add Region entries under Library → Regions, then refresh this list.",
                        tone: "warning",
                    });
                } else {
                    applyManageHint(null);
                }
            };

            const handleManageError = (err?: unknown) => {
                if (err) {
                    console.error("[terrain-brush] failed to open Library command", err);
                }
                applyManageHint({
                    text: "Opening the Library command failed. Use the ribbon icon to open the Library manually and add Region entries under Library → Regions before refreshing.",
                    tone: "error",
                });
                updateStatus("Failed to open the Library command. Check the console for details.");
            };

            editRegionsBtn.onclick = () => {
                if (!manageCommandAvailable) {
                    updateStatus("The Library command is unavailable. Follow the manual steps below to add regions.");
                    return;
                }

                try {
                    const result = (ctx.app as any).commands?.executeCommandById?.(MANAGE_REGIONS_COMMAND_ID);
                    if (result instanceof Promise) {
                        result.catch((err: unknown) => handleManageError(err));
                        updateStatus("Opening the Library to manage regions…");
                    } else if (result === false) {
                        handleManageError();
                    } else {
                        updateStatus("Opening the Library to manage regions…");
                    }
                } catch (err) {
                    handleManageError(err);
                }
            };

            refreshManageCommandAvailability();

            // Modus (Malen/Löschen)
            const modeRow = root.createDiv({ cls: "sm-row" });
            modeRow.createEl("label", { text: "Mode:" });
            modeSelect = modeRow.createEl("select") as HTMLSelectElement;
            modeSelect.createEl("option", { text: "Paint", value: "paint" });
            modeSelect.createEl("option", { text: "Erase", value: "erase" });
            modeSelect.value = state.mode;
            modeSelect.onchange = () => { state.mode = modeSelect.value as "paint" | "erase"; };
            enhanceSelectToSearch(modeSelect, 'Search dropdown…');

            // Regionen laden und Dropdown füllen; Terrain ableiten
            const fillOptions = async (reason: "initial" | "refresh") => {
                const seq = ++fillSeq;
                setPanelDisabled(true);
                applyInlineHint({
                    text: reason === "initial" ? "Loading regions…" : "Refreshing regions…",
                    tone: "loading",
                });
                updateStatus(reason === "initial" ? "Loading regions…" : "Refreshing regions…");

                let regions: Awaited<ReturnType<typeof loadRegions>>;
                try {
                    regions = await loadRegions(ctx.app);
                } catch (err) {
                    console.error("[terrain-brush] failed to load regions", err);
                    if (seq === fillSeq && !disposed && !ctx.getAbortSignal()?.aborted) {
                        regionSelect.empty();
                        state.region = "";
                        state.terrain = "";
                        applyInlineHint({
                            text: "Regions could not be loaded. Please retry once your vault is synced.",
                            tone: "error",
                        });
                        updateStatus("Failed to load regions. Check the console for details.");
                    }
                    return;
                } finally {
                    if (seq === fillSeq && !disposed && !ctx.getAbortSignal()?.aborted) {
                        setPanelDisabled(false);
                        refreshManageCommandAvailability();
                    }
                }

                if (disposed || ctx.getAbortSignal()?.aborted || seq !== fillSeq) {
                    return;
                }

                regionSelect.empty();
                regionSelect.createEl("option", { text: "(none)", value: "" });

                let matchedTerrain = state.terrain;
                let matchedRegion = state.region;
                let preservedSelection = false;

                for (const r of regions) {
                    const value = r.name ?? "";
                    const label = r.name || "(unnamed)";
                    const opt = regionSelect.createEl("option", { text: label, value });
                    if (r.terrain) opt.dataset.terrain = r.terrain;
                    if (value === state.region && value) {
                        opt.selected = true;
                        matchedRegion = value;
                        matchedTerrain = opt.dataset.terrain ?? "";
                        preservedSelection = true;
                    }
                }

                if (state.region && !preservedSelection) {
                    state.region = "";
                    state.terrain = "";
                    regionSelect.value = "";
                    applyInlineHint({
                        text: "The previously selected region is no longer available and was cleared.",
                        tone: "warning",
                    });
                    updateStatus("Region selection cleared because the entry is missing.");
                } else {
                    state.region = matchedRegion;
                    state.terrain = matchedTerrain;
                    regionSelect.value = matchedRegion;
                    if (regions.length === 0) {
                        applyInlineHint({
                            text: "No regions found. Open the Library (Manage… button or ribbon icon) and add Region entries before painting.",
                            tone: "info",
                        });
                        updateStatus("No regions available yet.");
                    } else {
                        applyInlineHint(null);
                        updateStatus("Regions loaded.");
                    }
                }
            };

            void fillOptions("initial");

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
                    if (!disposed) void fillOptions("refresh");
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
                ctx.app,
                file,
                rc,
                { radius: eff(), terrain: state.terrain, region: state.region, mode: state.mode }, // Distanz reinschreiben
                handles,
                { tool: ctx, toolName: TOOL_LABEL }
            );

            return true; // handled → Note wird nicht geöffnet
        },
    };
}
