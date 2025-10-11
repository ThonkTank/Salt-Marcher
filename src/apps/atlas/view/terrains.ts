// src/apps/atlas/view/terrains.ts
// Bearbeitet Terrain-Konfigurationen mit Auto-Speichern.
import type { AtlasModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import {
    loadTerrains,
    saveTerrains,
    watchTerrains,
    ensureTerrainFile,
    stringifyTerrainBlock,
    TERRAIN_FILE,
} from "../../../core/terrain-store";
import {
    openCreateModal,
    type CreateSpec,
    type DataSchema,
} from "../../../ui/workmode/create";

interface TerrainConfig { color: string; speed: number; }

type TerrainMap = Record<string, TerrainConfig>;

interface TerrainFormValues { name: string; color: string; speed: number; }

interface TerrainPersistPayload extends TerrainFormValues {
    terrains: TerrainMap;
}

interface TerrainSchemaIssue {
    path?: Array<string | number>;
    message?: string;
}

class TerrainSchemaError extends Error {
    constructor(readonly issues: TerrainSchemaIssue[]) {
        super(issues[0]?.message ?? "Ungültige Werte");
        this.name = "TerrainSchemaError";
    }
}

const COLOR_FALLBACK = "#999999" as const;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function normalizeColor(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return HEX_COLOR_RE.test(trimmed) ? trimmed : null;
}

function ensureEmptyEntry(map: TerrainMap): TerrainMap {
    if (map[""]) return map;
    return { ...map, "": { color: "transparent", speed: 1 } };
}

function createTerrainSchema(base: TerrainMap): DataSchema<TerrainFormValues, TerrainPersistPayload> {
    const snapshot = ensureEmptyEntry({ ...base });
    const parse = (input: unknown): TerrainPersistPayload => {
        const issues: TerrainSchemaIssue[] = [];
        const source = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};

        const rawName = typeof source.name === "string" ? source.name : "";
        const name = rawName.trim();
        if (!name) {
            issues.push({ path: ["name"], message: "Name ist erforderlich" });
        } else if (snapshot[name]) {
            issues.push({ path: ["name"], message: "Terrain existiert bereits" });
        }

        const color = normalizeColor(source.color);
        if (!color) {
            issues.push({ path: ["color"], message: "Farbe muss im Format #RRGGBB vorliegen" });
        }

        const parsedSpeed = typeof source.speed === "number" ? source.speed : Number(source.speed);
        const speed = Number.isFinite(parsedSpeed) ? Number(parsedSpeed) : NaN;
        if (!Number.isFinite(speed) || speed < 0) {
            issues.push({ path: ["speed"], message: "Geschwindigkeit muss mindestens 0 sein" });
        }

        if (issues.length > 0) {
            throw new TerrainSchemaError(issues);
        }

        const terrains = ensureEmptyEntry({
            ...snapshot,
            [name]: { color: color!, speed },
        });

        return { name, color: color!, speed, terrains };
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

export class TerrainsRenderer extends BaseModeRenderer implements AtlasModeRenderer {
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
            colorInp.value = /^#([0-9a-f]{6})$/i.test(base.color) ? base.color : COLOR_FALLBACK;
            speedInp.value = String(Number.isFinite(base.speed) ? base.speed : 1);

            const updateFromInputs = () => {
                const nextKey = nameInp.value.trim();
                const color = colorInp.value || COLOR_FALLBACK;
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
                    color: colorInp.value || COLOR_FALLBACK,
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
        const preset = name.trim();
        const spec = this.createModalSpec(this.terrains);
        try {
            const result = await openCreateModal<TerrainFormValues, TerrainPersistPayload>(spec, {
                app: this.app,
                preset: preset || undefined,
            });
            if (!result) return;
            this.terrains = await loadTerrains(this.app);
            this.ensureEmptyKey();
            this.render();
        } catch (error) {
            console.error("Terrain creation failed", error);
        }
    }

    async destroy(): Promise<void> {
        await this.flushSave();
        await super.destroy();
    }

    private createModalSpec(existing: TerrainMap): CreateSpec<TerrainFormValues, TerrainPersistPayload> {
        const snapshot = ensureEmptyEntry({ ...existing });
        const schema = createTerrainSchema(snapshot);
        const validateName = (value: unknown): string | null => {
            const name = typeof value === "string" ? value.trim() : "";
            if (!name) return "Name ist erforderlich";
            if (snapshot[name]) return "Terrain existiert bereits";
            return null;
        };
        return {
            kind: "terrain",
            title: "Neues Terrain",
            schema,
            defaults: { color: COLOR_FALLBACK, speed: 1 },
            fields: [
                {
                    id: "name",
                    label: "Name",
                    type: "text",
                    required: true,
                    placeholder: "z. B. Wald",
                    validate: validateName,
                },
                {
                    id: "color",
                    label: "Farbe",
                    type: "color",
                    required: true,
                    default: COLOR_FALLBACK,
                },
                {
                    id: "speed",
                    label: "Geschwindigkeit",
                    type: "number-stepper",
                    required: true,
                    min: 0,
                    step: 0.1,
                    default: 1,
                },
            ],
            storage: {
                format: "codeblock",
                pathTemplate: TERRAIN_FILE,
                filenameFrom: "name",
                blockRenderer: {
                    language: "terrain",
                    serialize: (values) => {
                        const payload = values as TerrainPersistPayload;
                        return stringifyTerrainBlock(ensureEmptyEntry(payload.terrains ?? {}));
                    },
                },
                hooks: {
                    ensureDirectory: async (app) => { await ensureTerrainFile(app); },
                },
            },
        } satisfies CreateSpec<TerrainFormValues, TerrainPersistPayload>;
    }

    private ensureEmptyKey(): void {
        this.terrains = ensureEmptyEntry(this.terrains);
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
