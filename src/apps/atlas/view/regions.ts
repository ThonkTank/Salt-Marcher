// src/apps/atlas/view/regions.ts
// Verwalten von Regionenlisten samt Persistenz.
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import type { AtlasModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import {
    ensureRegionsFile,
    loadRegions,
    saveRegions,
    watchRegions,
    type Region,
} from "../../../core/regions-store";
import { loadTerrains, watchTerrains } from "../../../core/terrain-store";
import { CreateRegionModal } from "../create";

const SAVE_DEBOUNCE_MS = 500;

export class RegionsRenderer extends BaseModeRenderer implements AtlasModeRenderer {
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
        await this.flushSave();
        if (this.isDisposed()) return;

        const modal = new CreateRegionModal(this.app, name, {
            existingNames: this.regions.map((region) => region.name || ""),
            terrainOptions: this.terrainNames,
            pipeline: {
                serialize: (draft) => ({
                    name: draft.name.trim(),
                    terrain: draft.terrain.trim(),
                    encounterOdds: this.normalizeEncounterOdds(draft.encounterOdds),
                }),
                persist: async (payload) => {
                    const current = await loadRegions(this.app);
                    const normalizedName = payload.name;
                    if (!normalizedName) {
                        throw new Error("Name is required.");
                    }
                    const duplicate = current.some(
                        (region) => (region.name || "").toLowerCase() === normalizedName.toLowerCase()
                    );
                    if (duplicate) {
                        throw new Error(`Region \"${normalizedName}\" already exists.`);
                    }
                    const next: Region[] = [
                        ...current,
                        {
                            name: normalizedName,
                            terrain: payload.terrain,
                            encounterOdds: payload.encounterOdds ?? undefined,
                        },
                    ];
                    next.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                    await saveRegions(this.app, next);
                    return next;
                },
                onComplete: async (next) => {
                    this.regions = next;
                    if (!this.isDisposed()) {
                        this.render();
                    }
                },
            },
        });

        modal.open();
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

    private normalizeEncounterOdds(value: number | undefined): number | undefined {
        if (!Number.isFinite(value)) return undefined;
        const parsed = Math.round(Number(value));
        return parsed > 0 ? parsed : undefined;
    }
}
