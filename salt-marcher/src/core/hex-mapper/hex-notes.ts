// src/core/hex-mapper/hex-notes.ts
import { App, TFile, TFolder, normalizePath } from "obsidian";
import { parseOptions } from "../options";

export type TileCoord = { r: number; c: number };
export type TileData  = { terrain: string; region?: string; note?: string };

const FM_TYPE = "hex";

// ===== Pfad-/Namens-Helfer =====
function mapNameFromPath(mapPath: string): string {
    const base = mapPath.replace(/\\/g, "/").split("/").pop() || "Map";
    return base.replace(/\.md$/i, "");
}
function safeBaseName(name: string): string {
    return name.trim().replace(/[\\\/:*?"<>|]/g, "_").replace(/\s+/g, " ");
}
function fileNameForMap(mapFile: TFile, coord: TileCoord): string {
    const base = safeBaseName(mapNameFromPath(mapFile.path));
    return `${base}-${coord.r},${coord.c}.md`;
}
function legacyFilenames(folderPrefix: string, coord: TileCoord): string[] {
    return [
        `${folderPrefix} ${coord.r},${coord.c}.md`,   // z.B. "Hex 1,2.md"
        `${folderPrefix}-r${coord.r}-c${coord.c}.md`, // z.B. "Hex-r1-c2.md"
    ];
}

async function readOptions(app: App, mapFile: TFile): Promise<{ folder: string; folderPrefix: string }> {
    const raw = await app.vault.read(mapFile);
    const opts = parseOptions(raw);
    const folder = (opts.folder ?? "Hexes").toString().trim();
    const folderPrefix = (opts.folderPrefix ?? "Hex").toString().trim();
    return { folder, folderPrefix };
}

async function ensureFolder(app: App, folderPath: string): Promise<TFolder> {
    const path = normalizePath(folderPath);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing && existing instanceof TFolder) return existing;
    if (existing) throw new Error(`Pfad existiert, ist aber kein Ordner: ${path}`);
    await app.vault.createFolder(path);
    const created = app.vault.getAbstractFileByPath(path);
    if (!(created && created instanceof TFolder)) throw new Error(`Ordner konnte nicht erstellt werden: ${path}`);
    return created;
}

function fm(app: App, file: TFile) {
    return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
}

function matchesThisMap(app: App, file: TFile, mapPath: string): boolean {
    const f = fm(app, file);
    return !!f && f.type === FM_TYPE && typeof f.map_path === "string" && f.map_path === mapPath;
}

function buildMarkdown(coord: TileCoord, mapPath: string, folderPrefix: string, data: TileData): string {
    const terrain = data.terrain ?? "";
    const region = (data.region ?? "").trim();
    const mapName = mapNameFromPath(mapPath);
    const bodyNote = (data.note ?? "Notizen hier …").trim();
    return [
        "---",
        `type: ${FM_TYPE}`,
        `smHexTile: true`,
        `region: "${region}"`,
        `row: ${coord.r}`,
        `col: ${coord.c}`,
        `map_path: "${mapPath}"`,
        `terrain: "${terrain}"`,
        "---",
        `[[${mapName}|↩ Zur Karte]]`,
        `# ${folderPrefix} r${coord.r} c${coord.c}`,
        "",
        bodyNote,
        "",
    ].join("\n");
}

async function resolveTilePath(
    app: App,
    mapFile: TFile,
    coord: TileCoord
): Promise<{ folder: string; newPath: string; file: TFile | null }> {
    const { folder, folderPrefix } = await readOptions(app, mapFile);
    const folderPath = normalizePath(folder);

    const newName = fileNameForMap(mapFile, coord);
    const newPath = `${folderPath}/${newName}`;

    // Legacy-Pfade prüfen (altes Prefix-Schema)
    const legacy = legacyFilenames(folderPrefix, coord).map(n => `${folderPath}/${n}`);

    // Falls es bereits die neue Datei gibt → use it
    let file = app.vault.getAbstractFileByPath(newPath) as TFile | null;

    // Migration: existiert eine Legacy-Datei und die neue NICHT? → umbenennen
    if (!file) {
        for (const oldPath of legacy) {
            const oldFile = app.vault.getAbstractFileByPath(oldPath) as TFile | null;
            if (oldFile) {
                await app.fileManager.renameFile(oldFile, newPath);
                break;
            }
        }
        file = app.vault.getAbstractFileByPath(newPath) as TFile | null;
    }

    return { folder: folderPath, newPath, file };
}

/* =======================
 *   Frontmatter-Fallbacks
 *   ======================= */

// Simple YAML-like Parser nur für unsere flachen Keys
function parseFrontmatterBlock(src: string): Record<string, any> | null {
    const m = src.match(/^---\s*([\s\S]*?)\s*---/m);
    if (!m) return null;
    const obj: Record<string, any> = {};
    for (const line of m[1].split(/\r?\n/)) {
        const mm = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*)\s*$/);
        if (!mm) continue;
        let val = mm[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (/^-?\d+$/.test(val)) obj[mm[1]] = Number(val);
        else obj[mm[1]] = val;
    }
    return obj;
}

async function fmFromFile(app: App, file: TFile): Promise<Record<string, any> | null> {
    const raw = await app.vault.read(file);
    return parseFrontmatterBlock(raw);
}
// ===== Öffentliche API =====

/** Alle Tiles für eine Map auflisten (scannt nur den Ziel-Ordner). */
export async function listTilesForMap(
    app: App,
    mapFile: TFile
): Promise<Array<{ coord: TileCoord; file: TFile; data: TileData }>> {
    const { folder } = await readOptions(app, mapFile);
    const folderPath = normalizePath(folder);
    const folderPrefix = (folderPath.endsWith("/") ? folderPath : folderPath + "/").toLowerCase();

    const out: Array<{ coord: TileCoord; file: TFile; data: TileData }> = [];

    // Scan über alle Dateien im Vault; filtere Pfad-Prefix + .md
    for (const child of app.vault.getFiles()) {
        const p = child.path.toLowerCase();
        if (!p.startsWith(folderPrefix)) continue;
        if (!p.endsWith(".md")) continue;

        // 1) metadataCache
        let fmc = fm(app, child);
        // 2) Fallback: direkt aus Datei lesen, wenn Cache fehlt/leer
        if (!fmc || fmc.type !== FM_TYPE) {
            fmc = await fmFromFile(app, child);
        }
        if (!fmc || fmc.type !== FM_TYPE) continue;
        if (typeof fmc.map_path !== "string" || fmc.map_path !== mapFile.path) continue;

        const r = Number(fmc.row), c = Number(fmc.col);
        if (!Number.isInteger(r) || !Number.isInteger(c)) continue;

        out.push({
            coord: { r, c },
            file: child,
            data: { terrain: (typeof fmc.terrain === "string" ? fmc.terrain : "") ?? "" },
        });
    }

    return out;
}


/** Tile laden – gibt null zurück, wenn die Datei nicht existiert oder invalid ist. */
export async function loadTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord
): Promise<TileData | null> {
    const { file } = await resolveTilePath(app, mapFile, coord);
    if (!file) return null;

    // erst Cache, dann Fallback (sofortige Sichtbarkeit neuer Dateien)
    let fmc = fm(app, file);
    if (!fmc || fmc.type !== FM_TYPE) {
        fmc = await fmFromFile(app, file);
    }
    if (!fmc || fmc.type !== FM_TYPE) return null;

    const raw = await app.vault.read(file);
    const body = raw.replace(/^---[\s\S]*?---\s*/m, "");
    const note = (body.split(/\n{2,}/).map(s => s.trim()).find(Boolean) ?? "").trim();

    return {
        terrain: (typeof fmc.terrain === "string" ? fmc.terrain : "") ?? "",
        region: (typeof (fmc as any).region === "string" ? (fmc as any).region : "") ?? "",
        note: note || undefined,
    };
}

/** Tile speichern – legt Datei an oder aktualisiert Frontmatter/Body. */
export async function saveTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord,
    data: TileData
): Promise<TFile> {
    const mapPath = mapFile.path;
    const { folder, newPath, file } = await resolveTilePath(app, mapFile, coord);
    await ensureFolder(app, folder);

    if (!file) {
        const { folderPrefix } = await readOptions(app, mapFile);
        const md = buildMarkdown(coord, mapPath, folderPrefix, data);
        return await app.vault.create(newPath, md);
    }

    // Frontmatter aktualisieren (nur setzen, wenn explizit übergeben)
    await app.fileManager.processFrontMatter(file, (f) => {
        f.type = FM_TYPE;
        (f as any).smHexTile = true;
        f.row = coord.r;
        f.col = coord.c;
        f.map_path = mapPath;
        if (data.region !== undefined) (f as any).region = data.region ?? "";
        if (data.terrain !== undefined) f.terrain = data.terrain ?? "";
        if (typeof f.terrain !== "string") f.terrain = "";
    });

        // Note (Body) optional aktualisieren – ersetzt nur, wenn data.note gesetzt ist
        if (data.note !== undefined) {
            const raw = await app.vault.read(file);
            const hasFM = /^---[\s\S]*?---/m.test(raw);
            const fmPart = hasFM ? (raw.match(/^---[\s\S]*?---/m) || [""])[0] : "";
            const body = hasFM ? raw.slice(fmPart.length).trimStart() : raw;

            // Erhalte optionalen Backlink, ersetze restlichen Body durch neue Note
            const lines = body.split("\n");
            const keepBacklink = lines.find((l) => /\[\[.*\|\s*↩ Zur Karte\s*\]\]/.test(l));
            const newBody = [keepBacklink ?? "", data.note.trim(), ""].filter(Boolean).join("\n");

            await app.vault.modify(file, `${fmPart}\n${newBody}`.trim() + "\n");
        }

        return file;
}

/** Tile löschen (falls vorhanden). */
export async function deleteTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord
): Promise<void> {
    const { file } = await resolveTilePath(app, mapFile, coord);
    if (!file) return;
    await app.vault.delete(file);
}

// core/hex-mapper/hex-notes.ts
export async function initTilesForNewMap(app: App, mapFile: TFile): Promise<void> {
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            await saveTile(app, mapFile, { r, c }, { terrain: "" });
        }
    }
}
