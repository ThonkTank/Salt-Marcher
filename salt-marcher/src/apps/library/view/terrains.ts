import type { ModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import { loadTerrains, saveTerrains, watchTerrains, ensureTerrainFile, TERRAIN_FILE } from "../../../core/terrain-store";

interface TerrainConfig { color: string; speed: number; }

type TerrainMap = Record<string, TerrainConfig>;

const SAVE_DEBOUNCE_MS = 500;

export class TerrainsRenderer extends BaseModeRenderer implements ModeRenderer {
    readonly mode = "terrains" as const;
    private terrains: TerrainMap = {};
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private dirty = false;

    async init(): Promise<void> {
        await ensureTerrainFile(this.app);
        this.terrains = await loadTerrains(this.app);
        this.ensureEmptyKey();
        const stop = watchTerrains(this.app, async () => {
            if (this.isDisposed()) return;
            this.terrains = await loadTerrains(this.app);
            this.ensureEmptyKey();
            this.render();
        });
        this.registerCleanup(stop);
    }

    render(): void {
        if (this.isDisposed()) return;
        const list = this.container;
        list.empty();
        const q = this.query;

        const names = Object.keys(this.terrains);
        const order = ["", ...names.filter(n => n !== "")];
        const entries = order
            .map(name => ({
                name,
                displayName: name || "",
                score: scoreName(name.toLowerCase(), q),
            }))
            .filter(x => x.name === "" || (q ? x.score > -Infinity : true))
            .sort((a, b) => a.name === "" ? -1 : b.name === "" ? 1 : (b.score - a.score || a.name.localeCompare(b.name)));

        for (const entry of entries) {
            let currentKey = entry.name;
            const row = list.createDiv({ cls: "sm-cc-item" });
            const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } }) as HTMLInputElement;
            nameInp.value = currentKey;
            const colorInp = row.createEl("input", { attr: { type: "color" } }) as HTMLInputElement;
            const speedInp = row.createEl("input", { attr: { type: "number", step: "0.1", min: "0" } }) as HTMLInputElement;
            const delBtn = row.createEl("button", { text: "🗑" });

            const base = this.terrains[currentKey] ?? { color: "transparent", speed: 1 };
            colorInp.value = /^#([0-9a-f]{6})$/i.test(base.color) ? base.color : "#999999";
            speedInp.value = String(Number.isFinite(base.speed) ? base.speed : 1);

            const updateFromInputs = () => {
                const nextKey = nameInp.value.trim();
                const color = colorInp.value || "#999999";
                const speed = parseFloat(speedInp.value);
                const normalizedNext = nextKey || "";
                const normalizedCurrent = currentKey || "";
                this.writeTerrain(currentKey, nextKey, {
                    color,
                    speed: Number.isFinite(speed) ? speed : 1,
                });
                currentKey = normalizedNext;
                if (normalizedNext !== normalizedCurrent) {
                    this.render();
                }
            };

            nameInp.addEventListener("change", updateFromInputs);
            nameInp.addEventListener("blur", updateFromInputs);
            nameInp.addEventListener("keydown", (evt) => {
                if (evt.key === "Enter") {
                    evt.preventDefault();
                    updateFromInputs();
                }
            });
            colorInp.addEventListener("input", () => {
                const speed = parseFloat(speedInp.value);
                const nextKey = nameInp.value.trim();
                this.writeTerrain(currentKey, nextKey, {
                    color: colorInp.value || "#999999",
                    speed: Number.isFinite(speed) ? speed : 1,
                });
                currentKey = nextKey || "";
            });
            speedInp.addEventListener("change", updateFromInputs);
            speedInp.addEventListener("blur", updateFromInputs);

            delBtn.onclick = () => {
                this.deleteTerrain(currentKey);
                this.render();
            };
        }

        if (!entries.length) {
            list.createDiv({ cls: "sm-cc-item" }).setText("No terrains available.");
        }
    }

    async handleCreate(name: string): Promise<void> {
        const key = name.trim();
        if (!key) return;
        if (!this.terrains[key]) {
            this.terrains[key] = { color: "#888888", speed: 1 };
            this.ensureEmptyKey();
            this.render();
            this.scheduleSave();
        }
    }

    async destroy(): Promise<void> {
        await this.flushSave();
        await super.destroy();
    }

    private ensureEmptyKey(): void {
        if (!this.terrains[""]) {
            this.terrains[""] = { color: "transparent", speed: 1 };
        }
    }

    private writeTerrain(oldKey: string, newKey: string, payload: TerrainConfig): void {
        const next: TerrainMap = { ...this.terrains };
        const normalizedOld = oldKey || "";
        const normalizedNew = newKey || "";
        delete next[normalizedOld];
        next[normalizedNew] = payload;
        this.terrains = next;
        this.ensureEmptyKey();
        this.scheduleSave();
    }

    private deleteTerrain(key: string): void {
        const normalized = key || "";
        if (normalized === "") return;
        const next: TerrainMap = { ...this.terrains };
        delete next[normalized];
        this.terrains = next;
        this.ensureEmptyKey();
        this.scheduleSave();
    }

    private scheduleSave(): void {
        if (this.isDisposed()) return;
        this.dirty = true;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => { void this.flushSave(); }, SAVE_DEBOUNCE_MS);
    }

    private async flushSave(): Promise<void> {
        if (!this.dirty) {
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
            }
            return;
        }
        this.dirty = false;
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await saveTerrains(this.app, this.terrains);
        this.terrains = await loadTerrains(this.app);
        this.ensureEmptyKey();
        if (!this.isDisposed()) this.render();
    }
}

export function describeTerrainsSource(): string {
    return `Source: ${TERRAIN_FILE}`;
}
