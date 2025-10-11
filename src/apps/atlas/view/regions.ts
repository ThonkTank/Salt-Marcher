// src/apps/atlas/view/regions.ts
// Verwalten von Regionenlisten samt Persistenz.
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import type { AtlasModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import {
    ensureRegionsFile,
    loadRegions,
    saveRegions,
    stringifyRegionsBlock,
    watchRegions,
    REGIONS_FILE,
    type Region,
} from "../../../core/regions-store";
import { loadTerrains, watchTerrains } from "../../../core/terrain-store";
import {
    openCreateModal,
    type CreateSpec,
    type DataSchema,
} from "../../../ui/workmode/create";

interface RegionFormValues {
    name: string;
    terrain: string;
    encounterOdds?: number;
}

interface RegionPersistPayload extends RegionFormValues {
    regions: Region[];
}

interface RegionSchemaIssue {
    path?: Array<string | number>;
    message?: string;
}

class RegionSchemaError extends Error {
    constructor(readonly issues: RegionSchemaIssue[]) {
        super(issues[0]?.message ?? "Ungültige Werte");
        this.name = "RegionSchemaError";
    }
}

function createRegionSchema(base: Region[]): DataSchema<RegionFormValues, RegionPersistPayload> {
    const snapshot: Region[] = base.map(region => ({
        name: (region.name || "").trim(),
        terrain: (region.terrain || "").trim(),
        encounterOdds: region.encounterOdds && region.encounterOdds > 0 ? region.encounterOdds : undefined,
    }));

    const parse = (input: unknown): RegionPersistPayload => {
        const issues: RegionSchemaIssue[] = [];
        const source = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};

        const rawName = typeof source.name === "string" ? source.name : "";
        const name = rawName.trim();
        if (!name) {
            issues.push({ path: ["name"], message: "Name ist erforderlich" });
        } else if (snapshot.some(region => (region.name || "").toLowerCase() === name.toLowerCase())) {
            issues.push({ path: ["name"], message: "Region existiert bereits" });
        }

        const rawTerrain = typeof source.terrain === "string" ? source.terrain : "";
        const terrain = rawTerrain.trim();

        const rawEncounter = source.encounterOdds;
        let encounterOdds: number | undefined;
        if (rawEncounter !== undefined && rawEncounter !== null && `${rawEncounter}`.trim() !== "") {
            const parsed = typeof rawEncounter === "number" ? rawEncounter : Number(rawEncounter);
            if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
                issues.push({ path: ["encounterOdds"], message: "Begegnungschance muss eine ganze Zahl größer 0 sein" });
            } else {
                encounterOdds = parsed;
            }
        }

        if (issues.length > 0) {
            throw new RegionSchemaError(issues);
        }

        const regions: Region[] = [
            ...snapshot,
            { name, terrain, encounterOdds },
        ];

        return { name, terrain, encounterOdds, regions };
    };

    return {
        parse,
        safeParse: (value) => {
            try {
                const parsed = parse(value);
                return { success: true, data: parsed };
            } catch (error) {
                return { success: false, error };
            }
        },
    };
}

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
        const preset = name.trim();
        const spec = this.createModalSpec(this.regions, this.terrainNames);
        try {
            const result = await openCreateModal<RegionFormValues, RegionPersistPayload>(spec, {
                app: this.app,
                preset: preset || undefined,
            });
            if (!result) return;
            this.regions = await loadRegions(this.app);
            this.render();
        } catch (error) {
            console.error("Region creation failed", error);
        }
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

    private createModalSpec(existing: Region[], terrainNames: string[]): CreateSpec<RegionFormValues, RegionPersistPayload> {
        const schema = createRegionSchema(existing);
        const normalizedExisting = existing.map(region => (region.name || "").toLowerCase());
        const validateName = (value: unknown): string | null => {
            const name = typeof value === "string" ? value.trim() : "";
            if (!name) return "Name ist erforderlich";
            if (normalizedExisting.includes(name.toLowerCase())) {
                return "Region existiert bereits";
            }
            return null;
        };
        const uniqueTerrains = Array.from(new Set(terrainNames.filter(name => !!name && !!name.trim())));
        const options = ["", ...uniqueTerrains]
            .map(name => ({
                value: name,
                label: name || "(kein Terrain)",
            }));
        if (!options.find(option => option.value === "")) {
            options.unshift({ value: "", label: "(kein Terrain)" });
        } else {
            options[0] = { value: "", label: "(kein Terrain)" };
        }

        return {
            kind: "region",
            title: "Neue Region",
            schema,
            defaults: ({ presetName }) => ({
                name: presetName ?? "",
                terrain: "",
            }),
            fields: [
                {
                    id: "name",
                    label: "Name",
                    type: "text",
                    required: true,
                    placeholder: "z. B. Saltmarsh",
                    validate: validateName,
                },
                {
                    id: "terrain",
                    label: "Terrain",
                    type: "select",
                    options,
                    default: "",
                },
                {
                    id: "encounterOdds",
                    label: "Encounter 1/n",
                    type: "number-stepper",
                    min: 1,
                    step: 1,
                    help: "Optional: Chance auf Begegnungen als Nenner für 1/n.",
                },
            ],
            storage: {
                format: "codeblock",
                pathTemplate: REGIONS_FILE,
                filenameFrom: "name",
                blockRenderer: {
                    language: "regions",
                    serialize: (values) => {
                        const payload = values as RegionPersistPayload;
                        return stringifyRegionsBlock(payload.regions ?? []);
                    },
                },
                hooks: {
                    ensureDirectory: async (app) => { await ensureRegionsFile(app); },
                },
            },
        } satisfies CreateSpec<RegionFormValues, RegionPersistPayload>;
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
