// src/apps/terrain-editor/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import { loadTerrains, saveTerrains, watchTerrains, TERRAIN_FILE } from "./terrain-store";
import { setTerrains } from "../../core/terrain";

export const VIEW_TERRAIN_EDITOR = "salt-terrain-editor";

type TerrainV1 = Record<string, string>; // alt: name -> color
type TerrainV2 = Record<string, { color: string; speed: number }>;

function normalize(input: TerrainV1 | TerrainV2): TerrainV2 {
    // Falls bereits V2:
    const first = Object.values(input)[0] as any;
    if (first && typeof first === "object" && "color" in first) return input as TerrainV2;

    // V1 -> V2 (Speed=1)
    const out: TerrainV2 = {};
    for (const [k, v] of Object.entries(input as TerrainV1)) out[k] = { color: v, speed: 1 };
    if (!out[""]) out[""] = { color: "transparent", speed: 1 };
    return out;
}

export class TerrainEditorView extends ItemView {
    private state: TerrainV2 = {};
    private unwatch?: () => void;

    getViewType() { return VIEW_TERRAIN_EDITOR; }
    getDisplayText() { return "Terrain Editor"; }
    getIcon() { return "palette"; }

    async onOpen() {
        this.contentEl.addClass("sm-terrain-editor");
        this.state = normalize(await loadTerrains(this.app) as any);
        setTerrains(this.state);
        this.render();
        this.unwatch = watchTerrains(this.app, () => this.refreshFromDisk());
    }

    async onClose() { this.unwatch?.(); }

    private async refreshFromDisk() {
        this.state = normalize(await loadTerrains(this.app) as any);
        setTerrains(this.state);
        this.render();
    }

    private render() {
        const root = this.contentEl; root.empty();
        root.createEl("h2", { text: "Terrain Editor" });
        root.createEl("div", { text: `Quelle: ${TERRAIN_FILE}`, cls: "desc" });

        const list = root.createEl("div", { cls: "rows" });

        const addRow = (name: string, color: string, speed: number) => {
            const row = list.createDiv({ cls: "row" });

            const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } }) as HTMLInputElement;
            nameInp.value = name;

            const colorInp = row.createEl("input", { attr: { type: "color" } }) as HTMLInputElement;
            colorInp.value = /^#([0-9a-f]{6})$/i.test(color) ? color : "#999999";

            const speedInp = row.createEl("input", { attr: { type: "number", step: "0.1", min: "0" } }) as HTMLInputElement;
            speedInp.value = String(Number.isFinite(speed) ? speed : 1);

            const delBtn = row.createEl("button", { text: "🗑" });

            nameInp.oninput  = () => { this.renameKey(name, nameInp.value, colorInp.value, parseFloat(speedInp.value)); name = nameInp.value; };
            colorInp.oninput = () => this.upsert(nameInp.value, colorInp.value, parseFloat(speedInp.value));
            speedInp.oninput = () => this.upsert(nameInp.value, colorInp.value, parseFloat(speedInp.value));
            delBtn.onclick   = () => this.remove(nameInp.value);
        };

        // Erste Zeile: „leer“
        const empty = this.state[""] ?? { color: "transparent", speed: 1 };
        addRow("", empty.color, empty.speed);

        // Rest alphabetisch
        for (const [k, v] of Object.entries(this.state).filter(([k]) => k !== "").sort((a,b)=>a[0].localeCompare(b[0]))) {
            addRow(k, v.color, v.speed);
        }

        // Add-Bar
        const addBar = root.createDiv({ cls: "addbar" });
        const addName  = addBar.createEl("input", { attr: { type: "text",  placeholder: "Neues Terrain" } }) as HTMLInputElement;
        const addColor = addBar.createEl("input", { attr: { type: "color", value: "#00a86b" } }) as HTMLInputElement;
        const addSpeed = addBar.createEl("input", { attr: { type: "number", step: "0.1", min: "0", value: "1" } }) as HTMLInputElement;
        const addBtn   = addBar.createEl("button", { text: "➕ Hinzufügen" });
        addBtn.onclick = () => {
            if (!addName.value.trim()) return;
            this.upsert(addName.value.trim(), addColor.value, parseFloat(addSpeed.value) || 1);
            addName.value = "";
        };
    }

    private async commit() {
        await saveTerrains(this.app, this.state as any);
        setTerrains(this.state);
        (this.app.workspace as any).trigger?.("salt:terrains-updated");
    }

    private upsert(name: string, color: string, speed: number) {
        if (!Number.isFinite(speed)) speed = 1;
        if (name === "") this.state[""] = { color: "transparent", speed: 1 };
        else this.state[name] = { color, speed };
        this.render();
        void this.commit();
    }

    private renameKey(oldName: string, nextName: string, color: string, speed: number) {
        if (oldName === nextName) return;
        if (!nextName) nextName = "";
        delete this.state[oldName];
        this.state[nextName] = { color, speed: Number.isFinite(speed) ? speed : 1 };
        this.render();
        void this.commit();
    }

    private remove(name: string) {
        if (name === "") return;
        delete this.state[name];
        this.render();
        void this.commit();
    }
}
