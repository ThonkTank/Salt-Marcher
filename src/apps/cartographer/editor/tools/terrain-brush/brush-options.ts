// src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts
// Baut das Options-Panel des Terrain-Brush und bietet Interaktions-Hooks für den Editor.
import type { App, TFile } from "obsidian";
import { attachBrushCircle } from "../brush-circle";
import { applyBrush, coordsInRadius } from "./brush-core";
import type { BrushOptions } from "./brush-core";
import type { RenderHandles } from "../../../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../../../core/options";
import { loadRegions } from "../../../../../core/regions-store";
import { enhanceSelectToSearch } from "../../../../../ui/search-dropdown";
import {
    buildForm,
    type FormButtonHandle,
    type FormHintHandle,
    type FormSelectHandle,
    type FormSliderHandle,
} from "../../../../../ui/form-builder";
import type { HexCoord } from "../../../controller";

const MANAGE_REGIONS_COMMAND_ID = "salt-marcher:open-library";

export type BrushPanelContext = {
    app: App;
    getFile(): TFile | null;
    getHandles(): RenderHandles | null;
    getOptions(): HexOptions | null;
    getAbortSignal(): AbortSignal | null;
    setStatus(message: string): void;
};

export type BrushPanelControls = {
    activate(): void;
    deactivate(): void;
    onMapRendered(): void;
    handleHexClick(coord: HexCoord): Promise<boolean>;
    setDisabled(disabled: boolean): void;
    destroy(): void;
};

type BrushState = Required<Pick<BrushOptions, "terrain">> & {
    radius: number;
    region: string;
    mode: "paint" | "erase";
};

const TOOL_LABEL = "Brush";

export function mountBrushPanel(root: HTMLElement, ctx: BrushPanelContext): BrushPanelControls {
    const state: BrushState = {
        radius: 1,
        region: "",
        terrain: "",
        mode: "paint",
    };

    const effectiveRadius = () => Math.max(0, state.radius - 1);

    let disposed = false;
    let fillSeq = 0;
    let circle: ReturnType<typeof attachBrushCircle> | null = null;

    let panelDisabled = false;
    let manageCommandAvailable = false;

    let radiusControl: FormSliderHandle | null = null;
    let regionControl: FormSelectHandle | null = null;
    let modeControl: FormSelectHandle | null = null;
    let manageButton: FormButtonHandle | null = null;
    let inlineHint: FormHintHandle | null = null;
    let manageHint: FormHintHandle | null = null;

    const setPanelDisabled = (disabled: boolean) => {
        panelDisabled = disabled;
        if (disabled) {
            root.classList.add("is-disabled");
        } else {
            root.classList.remove("is-disabled");
        }
        radiusControl?.setDisabled(disabled);
        regionControl?.setDisabled(disabled);
        modeControl?.setDisabled(disabled);
        manageButton?.setDisabled(disabled || !manageCommandAvailable);
    };

    const updateStatus = (message: string) => {
        try {
            ctx.setStatus(message);
        } catch (err) {
            console.error("[terrain-brush] failed to set status", err);
        }
    };

    type HintTone = "info" | "loading" | "error" | "warning";

    const form = buildForm(root, {
        sections: [
            { kind: "header", text: "Region Brush" },
            { kind: "hint", id: "inline", cls: "sm-inline-hint", hidden: true },
            {
                kind: "row",
                label: "Radius:",
                controls: [
                    {
                        kind: "slider",
                        id: "radius",
                        min: 1,
                        max: 6,
                        step: 1,
                        value: state.radius,
                        valueFormatter: (value) => String(value),
                        onInput: ({ value }) => {
                            state.radius = value;
                            circle?.updateRadius(effectiveRadius());
                        },
                    },
                ],
            },
            {
                kind: "row",
                label: "Region:",
                controls: [
                    {
                        kind: "select",
                        id: "region",
                        options: [],
                        enhance: (select) => enhanceSelectToSearch(select, "Search dropdown…"),
                        onChange: ({ element }) => {
                            state.region = element.value;
                            const opt = element.selectedOptions[0] as HTMLOptionElement | undefined;
                            state.terrain = opt?.dataset?.terrain ?? "";
                        },
                    },
                    {
                        kind: "button",
                        id: "manage",
                        label: "Manage…",
                    },
                ],
            },
            { kind: "hint", id: "manageHint", cls: "sm-inline-hint", hidden: true },
            {
                kind: "row",
                label: "Mode:",
                controls: [
                    {
                        kind: "select",
                        id: "mode",
                        value: state.mode,
                        options: [
                            { label: "Paint", value: "paint" },
                            { label: "Erase", value: "erase" },
                        ],
                        enhance: (select) => enhanceSelectToSearch(select, "Search dropdown…"),
                        onChange: ({ element }) => {
                            state.mode = element.value as "paint" | "erase";
                        },
                    },
                ],
            },
        ],
    });

    radiusControl = form.getControl("radius") as FormSliderHandle;
    regionControl = form.getControl("region") as FormSelectHandle;
    modeControl = form.getControl("mode") as FormSelectHandle;
    manageButton = form.getControl("manage") as FormButtonHandle;
    inlineHint = form.getHint("inline");
    manageHint = form.getHint("manageHint");

    const applyInlineHint = (details: { text: string; tone: HintTone } | null) => {
        inlineHint?.set(details ? { text: details.text, tone: details.tone } : null);
    };
    const applyManageHint = (details: { text: string; tone: HintTone } | null) => {
        manageHint?.set(details ? { text: details.text, tone: details.tone } : null);
    };

    const handleManageClick = () => {
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

    const refreshManageCommandAvailability = () => {
        const commandsApi = (ctx.app as any).commands;
        manageCommandAvailable = Boolean(
            commandsApi?.executeCommandById && commandsApi?.commands?.[MANAGE_REGIONS_COMMAND_ID]
        );
        manageButton?.setDisabled(panelDisabled || !manageCommandAvailable);
        if (manageButton) {
            manageButton.element.classList.toggle("is-missing-command", !manageCommandAvailable);
        }
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

    if (manageButton) {
        manageButton.element.addEventListener("click", handleManageClick);
    }

    refreshManageCommandAvailability();

    const fillOptions = async (reason: "initial" | "refresh") => {
        const seq = ++fillSeq;
        setPanelDisabled(true);
        applyInlineHint({
            text: reason === "initial" ? "Loading regions…" : "Refreshing regions…",
            tone: "loading",
        });
        updateStatus(reason === "initial" ? "Loading regions…" : "Refreshing regions…");

        let regions: Awaited<ReturnType<typeof loadRegions>> = [];
        try {
            regions = await loadRegions(ctx.app);
        } catch (err) {
            console.error("[terrain-brush] failed to load regions", err);
            if (seq === fillSeq && !disposed && !ctx.getAbortSignal()?.aborted) {
                regionControl?.setOptions([]);
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

        regionControl?.setOptions([
            { label: "(none)", value: "" },
            ...regions.map((r) => ({
                label: r.name || "(unnamed)",
                value: r.name ?? "",
                data: r.terrain ? { terrain: r.terrain } : undefined,
            })),
        ]);

        const regionSelect = regionControl?.element;
        if (!regionSelect) return;

        let matchedTerrain = state.terrain;
        let matchedRegion = state.region;
        let preservedSelection = false;

        for (const opt of Array.from(regionSelect.options)) {
            if (!opt.value) continue;
            if (opt.value === state.region) {
                matchedRegion = opt.value;
                matchedTerrain = opt.dataset.terrain ?? "";
                preservedSelection = true;
                break;
            }
        }

        if (state.region && !preservedSelection) {
            state.region = "";
            state.terrain = "";
            regionControl.setValue("");
            applyInlineHint({
                text: "The previously selected region is no longer available and was cleared.",
                tone: "warning",
            });
            updateStatus("Region selection cleared because the entry is missing.");
        } else {
            state.region = matchedRegion;
            state.terrain = matchedTerrain;
            regionControl.setValue(matchedRegion);
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

    const ensureCircle = (handles: RenderHandles | null, options: HexOptions | null) => {
        if (!handles) return;
        circle?.destroy();
        circle = attachBrushCircle(
            { svg: handles.svg, contentG: handles.contentG, overlay: handles.overlay },
            { initialRadius: effectiveRadius(), hexRadiusPx: options?.radius ?? 42 }
        );
        circle.show();
    };

    const dispose = () => {
        disposed = true;
        fillSeq += 1;
        unsubscribe.forEach((off) => {
            try {
                off();
            } catch (err) {
                console.error("[terrain-brush] failed to unsubscribe", err);
            }
        });
        unsubscribe.length = 0;
        if (manageButton) {
            manageButton.element.removeEventListener("click", handleManageClick);
        }
        form.destroy();
        circle?.destroy();
        circle = null;
        while (root.firstChild) {
            root.removeChild(root.firstChild);
        }
    };

    const handleHexClick = async (rc: HexCoord): Promise<boolean> => {
        const file = ctx.getFile();
        const handles = ctx.getHandles();
        if (!file || !handles) return false;

        const raw = coordsInRadius(rc, effectiveRadius());
        const targets = [...new Map(raw.map((k) => [`${k.r},${k.c}`, k])).values()];

        if (state.mode === "paint") {
            const missing = targets.filter((k) => !handles.polyByCoord.has(`${k.r},${k.c}`));
            if (missing.length) handles.ensurePolys(missing);
        }

        await applyBrush(
            ctx.app,
            file,
            rc,
            {
                radius: effectiveRadius(),
                terrain: state.terrain,
                region: state.region,
                mode: state.mode,
            },
            handles,
            {
                tool: {
                    getAbortSignal: () => ctx.getAbortSignal(),
                    setStatus: (message) => ctx.setStatus(message),
                },
                toolName: TOOL_LABEL,
            }
        );

        return true;
    };

    return {
        activate() {
            ensureCircle(ctx.getHandles(), ctx.getOptions());
        },
        deactivate() {
            circle?.destroy();
            circle = null;
        },
        onMapRendered() {
            ensureCircle(ctx.getHandles(), ctx.getOptions());
        },
        async handleHexClick(coord) {
            return handleHexClick(coord);
        },
        setDisabled(disabled) {
            setPanelDisabled(disabled);
            if (disabled) {
                circle?.destroy();
                circle = null;
            } else {
                ensureCircle(ctx.getHandles(), ctx.getOptions());
            }
        },
        destroy() {
            dispose();
        },
    } satisfies BrushPanelControls;
}
