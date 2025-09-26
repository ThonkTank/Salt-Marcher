import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import type { ModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import { ensureRegionsFile, loadRegions, saveRegions, watchRegions, REGIONS_FILE, type Region } from "../../../core/regions-store";
import { loadTerrains, watchTerrains } from "../../../core/terrain-store";

const SAVE_DEBOUNCE_MS = 500;

export class RegionsRenderer extends BaseModeRenderer implements ModeRenderer {
    readonly mode = "regions" as const;
    private regions: Region[] = [];
    private terrainNames: string[] = [];
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private dirty = false;

    async init(): Promise<void> {
        await ensureRegionsFile(this.app);
        [this.regions, this.terrainNames] = await Promise.all([
            loadRegions(this.app),
            this.loadTerrainNames(),
        ]);

        const stopRegions = watchRegions(this.app, async () => {
            if (this.isDisposed()) return;
            this.regions = await loadRegions(this.app);
            this.render();
        });
        const stopTerrains = watchTerrains(this.app, async () => {
            if (this.isDisposed()) return;
            this.terrainNames = await this.loadTerrainNames();
            this.render();
        });
        this.registerCleanup(stopRegions);
        this.registerCleanup(stopTerrains);
    }

    render(): void {
        if (this.isDisposed()) return;
        const list = this.container;
        list.empty();
        const q = this.query;

        const entries = this.regions
            .map((region, index) => ({ region, index, score: scoreName((region.name || "").toLowerCase(), q) }))
            .filter(item => (item.region.name || "").trim())
            .filter(item => q ? item.score > -Infinity : true)
            .sort((a, b) => b.score - a.score || (a.region.name || "").localeCompare(b.region.name || ""));

        for (const entry of entries) {
            const region = entry.region;
            const row = list.createDiv({ cls: "sm-cc-item" });

            const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } }) as HTMLInputElement;
            nameInp.value = region.name || "";
            nameInp.addEventListener("input", () => {
                region.name = nameInp.value;
                this.scheduleSave();
            });

            const terrSel = row.createEl("select") as HTMLSelectElement;
            enhanceSelectToSearch(terrSel, "Search options…");
            this.populateTerrainOptions(terrSel, region.terrain || "");
            terrSel.addEventListener("change", () => {
                region.terrain = terrSel.value;
                this.scheduleSave();
            });

            const encInp = row.createEl("input", { attr: { type: "number", min: "1", step: "1", placeholder: "Encounter 1/n" } }) as HTMLInputElement;
            encInp.value = region.encounterOdds && region.encounterOdds > 0 ? String(region.encounterOdds) : "";
            encInp.addEventListener("input", () => {
                const val = parseInt(encInp.value, 10);
                region.encounterOdds = Number.isFinite(val) && val > 0 ? val : undefined;
                this.scheduleSave();
            });

            const delBtn = row.createEl("button", { text: "🗑" });
            delBtn.onclick = () => {
                this.removeRegion(entry.index);
            };
        }

        if (!entries.length) {
            list.createDiv({ cls: "sm-cc-item" }).setText("No regions available.");
        }
    }

    async handleCreate(name: string): Promise<void> {
        const trimmed = name.trim();
        if (!trimmed) return;
        const exists = this.regions.some(r => (r.name || "").toLowerCase() === trimmed.toLowerCase());
        if (exists) return;
        this.regions.push({ name: trimmed, terrain: "" });
        this.render();
        this.scheduleSave();
    }

    async destroy(): Promise<void> {
        await this.flushSave();
        await super.destroy();
    }

    private populateTerrainOptions(select: HTMLSelectElement, selected: string): void {
        select.empty();
        const options = Array.from(new Set(["", ...this.terrainNames]));
        for (const name of options) {
            const option = select.createEl("option", { text: name || "(empty)", value: name });
            option.selected = name === selected;
        }
    }

    private async loadTerrainNames(): Promise<string[]> {
        const terrains = await loadTerrains(this.app);
        return Object.keys(terrains || {});
    }

    private removeRegion(index: number): void {
        if (!this.regions[index]) return;
        this.regions.splice(index, 1);
        this.render();
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
        await saveRegions(this.app, this.regions);
        this.regions = await loadRegions(this.app);
        if (!this.isDisposed()) this.render();
    }
}

export function describeRegionsSource(): string {
    return `Source: ${REGIONS_FILE}`;
}
