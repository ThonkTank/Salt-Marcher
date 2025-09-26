// src/core/terrain-store.ts
import { App, EventRef, TAbstractFile, TFile, normalizePath } from "obsidian";
import { setTerrains } from "./terrain";

export const TERRAIN_FILE = "SaltMarcher/Terrains.md";
const BLOCK_RE = /```terrain\s*([\s\S]*?)```/i;

// Datei sicherstellen (mit Defaults inkl. speed)
export async function ensureTerrainFile(app: App): Promise<TFile> {
    const p = normalizePath(TERRAIN_FILE);
    const existing = app.vault.getAbstractFileByPath(p);
    if (existing instanceof TFile) return existing;
    await app.vault.createFolder(p.split("/").slice(0, -1).join("/")).catch(() => {});
    const body = [
        "---",
        'smList: true',
        "---",
        "# Terrains",
        "",
        "```terrain",
        ': transparent, speed: 1',
        "Wald: #2e7d32, speed: 0.6",
        "Meer: #0288d1, speed: 0.5",
        "Berg: #6d4c41, speed: 0.4",
        "```",
        "",
    ].join("\n");
    return await app.vault.create(p, body);
}

/** Parser akzeptiert:
 *  Name: #aabbcc
 *  Name: #aabbcc, speed: 0.8
 *  : transparent, speed: 1
 */
export function parseTerrainBlock(md: string): Record<string, { color: string; speed: number }> {
    const m = md.match(BLOCK_RE); if (!m) return {};
    const out: Record<string, { color: string; speed: number }> = {};
    for (const raw of m[1].split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        // Name: color [, speed: num]
        const mm = line.match(/^("?)(.*?)(\1)\s*:\s*([^,]+?)(?:\s*,\s*speed\s*:\s*([-+]?\d*\.?\d+))?\s*$/i);
        if (!mm) continue;
        const name = mm[2].trim();
        const color = mm[4].trim();
        const speed = mm[5] !== undefined ? parseFloat(mm[5]) : 1;
        out[name] = { color, speed: Number.isFinite(speed) ? speed : 1 };
    }
    if (!out[""]) out[""] = { color: "transparent", speed: 1 };
    return out;
}

// Konsistente Ausgabe: leeres Terrain zuerst, Rest alphabetisch
export function stringifyTerrainBlock(map: Record<string, { color: string; speed: number }>): string {
    const entries = Object.entries(map);
    entries.sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
    const lines = entries.map(([k, v]) => `${k || ":"}: ${v.color}, speed: ${v.speed}`);
    return ["```terrain", ...lines, "```"].join("\n");
}

export async function loadTerrains(app: App): Promise<Record<string, { color: string; speed: number }>> {
    const f = await ensureTerrainFile(app);
    const md = await app.vault.read(f);
    return parseTerrainBlock(md);
}

export async function saveTerrains(app: App, next: Record<string, { color: string; speed: number }>) {
    const f = await ensureTerrainFile(app);
    const md = await app.vault.read(f);
    const block = stringifyTerrainBlock(next);
    const replaced = md.match(BLOCK_RE) ? md.replace(BLOCK_RE, block) : md + "\n\n" + block + "\n";
    await app.vault.modify(f, replaced);
}

export interface TerrainWatcherOptions {
    onChange?: () => void | Promise<void>;
    onError?: (error: unknown, meta: { reason: "modify" | "delete" }) => void;
}

function resolveWatcherOptions(
    maybeCallback: TerrainWatcherOptions | (() => void | Promise<void>) | undefined
): TerrainWatcherOptions {
    if (typeof maybeCallback === "function") {
        return { onChange: maybeCallback };
    }
    return maybeCallback ?? {};
}

export function watchTerrains(
    app: App,
    onChangeOrOptions?: (() => void | Promise<void>) | TerrainWatcherOptions
): () => void {
    const options = resolveWatcherOptions(onChangeOrOptions);

    const handleError = (error: unknown, reason: "modify" | "delete") => {
        if (options.onError) {
            try {
                options.onError(error, { reason });
            } catch (loggingError) {
                console.error("[salt-marcher] Terrain watcher error handler threw", loggingError);
            }
        } else {
            console.error(`[salt-marcher] Terrain watcher failed after ${reason} event`, error);
        }
    };

    const update = async (reason: "modify" | "delete") => {
        try {
            if (reason === "delete") {
                await ensureTerrainFile(app);
            }
            const map = await loadTerrains(app);
            setTerrains(map); // Farben + Speed global setzen
            (app.workspace as any).trigger?.("salt:terrains-updated");
            await options.onChange?.();
        } catch (error) {
            handleError(error, reason);
        }
    };

    const maybeUpdate = (reason: "modify" | "delete", file: TAbstractFile) => {
        if (!(file instanceof TFile) || file.path !== TERRAIN_FILE) return;
        void update(reason);
    };

    const refs: EventRef[] = (["modify", "delete"] as const).map((event) =>
        app.vault.on(event, (file) => maybeUpdate(event, file))
    );
    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        for (const ref of refs) {
            app.vault.offref(ref);
        }
    };
}
