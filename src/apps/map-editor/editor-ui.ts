// src/apps/map-editor/editor-ui.ts
import { App, TFile, Notice, setIcon } from "obsidian";
import { type HexOptions } from "../../core/options";
import { type RenderHandles } from "../../core/hex-mapper/hex-render";
import {
    applyMapButtonStyle,
    promptCreateMap,
    promptMapSelection,
    renderHexMapFromFile,
} from "../../ui/map-workflows";
import type { ToolModule, ToolContext } from "./tools-api";
import { createBrushTool } from "./terrain-brush/brush-options";
import { createInspectorTool } from "./inspektor/inspektor-options";
// Falls vorhanden, echte Saves nutzen (wenn nicht vorhanden: temporär auskommentieren)
import { saveMap, saveMapAs } from "../../core/save";

type State = {
    file: TFile | null;
    opts: HexOptions | null;
    handles: RenderHandles | null;
    tool: ToolModule | null;
    cleanupPanel: (() => void) | null;
};

export function mountMapEditor(app: App, host: HTMLElement, init?: { mapPath?: string }) {
    host.empty();
    Object.assign(host.style, { display: "flex", flexDirection: "column", height: "100%", gap: ".5rem" });

    const state: State = { file: null, opts: null, handles: null, tool: null, cleanupPanel: null };

    /* ---------- Header ---------- */
    const header = host.createDiv({ cls: "map-editor-header" });
    Object.assign(header.style, { display: "flex", flexDirection: "column", gap: ".4rem" });

    // Row 1: Titel | Open | +
    const r1 = header.createDiv();
    Object.assign(r1.style, { display: "flex", alignItems: "center", gap: ".5rem" });
    r1.createEl("h2", { text: "Map Editor" }).style.marginRight = "auto";

    const btnOpen = r1.createEl("button", { text: "Open Map" });
    setIcon(btnOpen, "folder-open");
    applyMapButtonStyle(btnOpen);
    btnOpen.onclick = () => {
        void promptMapSelection(app, async (f) => { await setFile(f); });
    };

    const btnPlus = r1.createEl("button"); btnPlus.append(" ", "+");
    setIcon(btnPlus, "plus");
    applyMapButtonStyle(btnPlus);
    btnPlus.onclick = () => {
        promptCreateMap(app, async (file) => {
            await setFile(file);
        });
    };

    // Row 2: Dateiname | Dropdown: Speichern / Speichern als
    const r2 = header.createDiv();
    Object.assign(r2.style, { display: "flex", alignItems: "center", gap: ".5rem" });

    const nameBox = r2.createEl("div", { text: "—" });
    Object.assign(nameBox.style, { marginRight: "auto", opacity: ".85" });

    const saveSelect = r2.createEl("select");
    saveSelect.createEl("option", { text: "Speichern" }).value = "save";
    saveSelect.createEl("option", { text: "Speichern als" }).value = "saveAs";
    const saveBtn = r2.createEl("button", { text: "Los" });
    applyMapButtonStyle(saveBtn);
    saveBtn.onclick = async () => {
        if (!state.file) return new Notice("Keine Karte ausgewählt.");
        try {
            if (saveSelect.value === "save") await saveMap(app, state.file);
            else await saveMapAs(app, state.file);
            new Notice("Gespeichert.");
        } catch (e) {
            console.error(e);
            new Notice("Speichern fehlgeschlagen.");
        }
    };

    /* ---------- Body Split ---------- */
    const body = host.createDiv();
    Object.assign(body.style, { display: "flex", gap: ".5rem", minHeight: "300px", flex: "1 1 auto" });

    const mapPane = body.createDiv();
    Object.assign(mapPane.style, {
        flex: "1 1 auto",
        overflow: "hidden",
        border: "1px solid var(--background-modifier-border)",
                  borderRadius: "8px",
    });

    const optionsPane = body.createDiv();
    Object.assign(optionsPane.style, {
        flex: "0 0 auto",
        minWidth: "220px",
        maxWidth: "360px",
        width: "280px",
        border: "1px solid var(--background-modifier-border)",
                  borderRadius: "8px",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: ".5rem",
    });

    // Options Header: Dateiname + Tool-Select
    const optHeader = optionsPane.createDiv();
    Object.assign(optHeader.style, { display: "flex", alignItems: "center", gap: ".5rem" });
    const optName = optHeader.createEl("div", { text: "—" });
    Object.assign(optName.style, { marginRight: "auto", fontWeight: "600" });

    const toolSelect = optHeader.createEl("select");
    const optBody = optionsPane.createDiv();

    /* ---------- Tool-Registry (tool-agnostisch) ---------- */
    const tools: ToolModule[] = [createBrushTool(), createInspectorTool()];
    for (const t of tools) toolSelect.createEl("option", { text: t.label, value: t.id });
    toolSelect.onchange = () => switchTool(toolSelect.value);

    /* ---------- ToolContext inkl. refreshMap ---------- */
    const ctx: ToolContext = {
        app,
        getFile: () => state.file,
        getHandles: () => state.handles,
        getOpts: () => state.opts ?? { folder: "Hexes", prefix: "Hex", radius: 42 },
        setStatus: (_msg) => {},
        refreshMap: async () => {
            await renderMap();
            state.tool?.onMapRendered?.(ctx); // z. B. Brush-Kreis neu anhängen
        },
    };

    /* ---------- Core-Funktionen ---------- */
    async function switchTool(id: string) {
        if (state.tool?.onDeactivate) state.tool.onDeactivate(ctx);
        state.cleanupPanel?.();
        const next = tools.find(t => t.id === id) || tools[0];
        state.tool = next;
        toolSelect.value = next.id;

        optBody.empty();
        state.cleanupPanel = next.mountPanel(optBody, ctx);

        if (next.onActivate) next.onActivate(ctx);
        if (state.handles && next.onMapRendered) next.onMapRendered(ctx);
    }


    async function renderMap() {
        mapPane.empty();
        state.handles?.destroy();
        state.handles = null;

        if (!state.file) {
            mapPane.createEl("div", { text: "Keine Karte geöffnet." });
            return;
        }

        const result = await renderHexMapFromFile(app, mapPane, state.file);
        if (!result) return;

        state.opts = result.options;
        state.handles = result.handles;
        const hostDiv = result.host;

        // Hex-Klick zentral → ans aktive Tool weiterreichen
        hostDiv.addEventListener(
            "hex:click",
            (ev: Event) => {
                const e = ev as CustomEvent<{ r: number; c: number }>;
                e.preventDefault(); // Editor übernimmt Klicks immer selbst
                void state.tool?.onHexClick?.(e.detail, ctx); // async weiterarbeiten lassen
            },
            { passive: false }
        );

    }

    async function refreshAll() {
        nameBox.textContent = state.file ? state.file.basename : "—";
        optName.textContent = state.file ? state.file.basename : "—";
        await renderMap();                                   // neue Handles
        // aktives Tool (re)aktivieren → Kreis an neues overlay hängen
        if (!state.tool) await switchTool(tools[0].id); else await switchTool(state.tool.id);
        // defensiv: Tool über „Map ist gerendert“ informieren
        state.tool?.onMapRendered?.(ctx);
        }

    async function setFile(f?: TFile | null) {
        state.file = f ?? null;
        await refreshAll();
    }

    function setTool(id: string) {
        switchTool(id);
    }

    /* ---------- Initialen State laden ---------- */
    if (init?.mapPath) {
        const af = app.vault.getAbstractFileByPath(init.mapPath);
        if (af instanceof TFile) state.file = af;
    }
    void refreshAll();

    /* ---------- Public Controller ---------- */
    return {
        setFile,
        setTool,
    };
}
