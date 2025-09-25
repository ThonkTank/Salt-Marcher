// src/core/regions-store.ts
import { App, TFile, normalizePath } from "obsidian";

export const REGIONS_FILE = "SaltMarcher/Regions.md";
const BLOCK_RE = /```regions\s*([\s\S]*?)```/i;

export type Region = { name: string; terrain: string; encounterOdds?: number };

export async function ensureRegionsFile(app: App): Promise<TFile> {
    const p = normalizePath(REGIONS_FILE);
    const existing = app.vault.getAbstractFileByPath(p);
    if (existing instanceof TFile) return existing;
    await app.vault.createFolder(p.split("/").slice(0, -1).join("/")).catch(() => {});
    const body = [
        "---",
        'smList: true',
        "---",
        "# Regions",
        "",
        "```regions",
        "# Name: Terrain",
        "# Beispiel:",
        "# Saltmarsh: Küste",
        "```",
        "",
    ].join("\n");
    return await app.vault.create(p, body);
}

export function parseRegionsBlock(md: string): Region[] {
    const m = md.match(BLOCK_RE); if (!m) return [];
    const out: Region[] = [];
    for (const raw of m[1].split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        // Syntax: Name: Terrain[, encounter: 1/6]
        const mm = line.match(/^("?)(.*?)\1\s*:\s*(.*)$/);
        if (!mm) continue;
        const name = (mm[2] || "").trim();
        const rest = (mm[3] || "").trim();
        let terrain = rest;
        let encounterOdds: number | undefined = undefined;
        const em = rest.match(/,\s*encounter\s*:\s*([^,]+)\s*$/i);
        if (em) {
            terrain = rest.slice(0, em.index).trim();
            const spec = em[1].trim();
            const frac = spec.match(/^1\s*\/\s*(\d+)$/);
            if (frac) encounterOdds = parseInt(frac[1], 10) || undefined;
            else {
                const n = parseInt(spec, 10);
                if (Number.isFinite(n) && n > 0) encounterOdds = n;
            }
        }
        out.push({ name, terrain, encounterOdds });
    }
    return out;
}

export function stringifyRegionsBlock(list: Region[]): string {
    const lines = list.map(r => {
        const base = `${r.name}: ${r.terrain || ""}`;
        const n = r.encounterOdds;
        return n && n > 0 ? `${base}, encounter: 1/${n}` : base;
    });
    return ["```regions", ...lines, "```"].join("\n");
}

export async function loadRegions(app: App): Promise<Region[]> {
    const f = await ensureRegionsFile(app);
    const md = await app.vault.read(f);
    return parseRegionsBlock(md);
}

export async function saveRegions(app: App, list: Region[]): Promise<void> {
    const f = await ensureRegionsFile(app);
    const md = await app.vault.read(f);
    const block = stringifyRegionsBlock(list);
    const replaced = md.match(BLOCK_RE) ? md.replace(BLOCK_RE, block) : md + "\n\n" + block + "\n";
    await app.vault.modify(f, replaced);
}

export function watchRegions(app: App, onChange: () => void): () => void {
    const handler = async (file: TFile) => {
        if (file.path !== REGIONS_FILE) return;
        (app.workspace as any).trigger?.("salt:regions-updated");
        onChange?.();
    };
    app.vault.on("modify", handler);
    app.vault.on("delete", handler);
    return () => {
        app.vault.off("modify", handler);
        app.vault.off("delete", handler);
    };
}
