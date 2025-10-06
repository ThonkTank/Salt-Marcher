// src/core/hex-mapper/hex-notes.ts
import { App, TFile, TFolder, normalizePath } from "obsidian";
import { TERRAIN_COLORS } from "../terrain";
import { parseOptions } from "../options";

export type TileCoord = { r: number; c: number };
export type TileData  = { terrain: string; region?: string; note?: string };

const TILE_TERRAIN_MAX_LENGTH = 64;
const TILE_REGION_MAX_LENGTH = 120;

export class TileValidationError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Invalid tile data: ${issues.join(", ")}`);
        this.name = "TileValidationError";
    }
}

export interface ValidateTileDataOptions {
    allowUnknownTerrain?: boolean;
}

export function validateTileData(
    data: TileData,
    options: ValidateTileDataOptions = {}
): TileData {
    const { allowUnknownTerrain = false } = options;
    const issues: string[] = [];

    const terrain = typeof data.terrain === "string" ? data.terrain.trim() : "";
    if (terrain.length > TILE_TERRAIN_MAX_LENGTH) {
        issues.push(`terrain exceeds ${TILE_TERRAIN_MAX_LENGTH} characters`);
    }
    if (!allowUnknownTerrain && terrain && !(terrain in TERRAIN_COLORS)) {
        issues.push(`unknown terrain "${terrain}"`);
    }

    const regionRaw = typeof data.region === "string" ? data.region : "";
    const region = regionRaw.trim();
    if (region.length > TILE_REGION_MAX_LENGTH) {
        issues.push(`region exceeds ${TILE_REGION_MAX_LENGTH} characters`);
    }

    const noteRaw = typeof data.note === "string" ? data.note : undefined;
    const note = noteRaw?.trim();

    if (issues.length) {
        throw new TileValidationError(issues);
    }

    return {
        terrain,
        region,
        note: note || undefined,
    };
}

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
function escapeRegex(src: string): string {
    return src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function coordFromFrontmatter(fmc: Record<string, any> | null): TileCoord | null {
    if (!fmc) return null;
    const r = Number((fmc as any).row);
    const c = Number((fmc as any).col);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { r, c };
}
function coordFromLegacyName(file: TFile, folderPrefix: string): TileCoord | null {
    const base = file.path.replace(/\\/g, "/").split("/").pop() ?? file.path;
    const prefix = folderPrefix.trim();
    if (!prefix) return null;
    const spaced = new RegExp(`^${escapeRegex(prefix)}\s+(-?\\d+),(-?\\d+)\\.md$`, "i");
    const dashed = new RegExp(`^${escapeRegex(prefix)}-r(-?\\d+)-c(-?\\d+)\\.md$`, "i");
    let match = base.match(spaced);
    if (match) return { r: Number(match[1]), c: Number(match[2]) };
    match = base.match(dashed);
    if (match) return { r: Number(match[1]), c: Number(match[2]) };
    return null;
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
    const validated = validateTileData(data, { allowUnknownTerrain: true });
    const terrain = validated.terrain ?? "";
    const region = (validated.region ?? "").trim();
    const mapName = mapNameFromPath(mapPath);
    const bodyNote = (validated.note ?? "Notizen hier …").trim();
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

async function ensureTileSchema(
    app: App,
    mapFile: TFile,
    file: TFile,
    coord: TileCoord,
    cached?: Record<string, any> | null
): Promise<Record<string, any>> {
    const mapPath = mapFile.path;
    const current = cached ?? (await fmFromFile(app, file)) ?? {};
    const needsType = current.type !== FM_TYPE;
    const needsMarker = (current as any).smHexTile !== true;
    const needsRow = Number((current as any).row) !== coord.r;
    const needsCol = Number((current as any).col) !== coord.c;
    const needsMap = (current as any).map_path !== mapPath;

    if (needsType || needsMarker || needsRow || needsCol || needsMap) {
        await app.fileManager.processFrontMatter(file, (f) => {
            f.type = FM_TYPE;
            (f as any).smHexTile = true;
            f.row = coord.r;
            f.col = coord.c;
            f.map_path = mapPath;
        });
        return (await fmFromFile(app, file)) ?? { type: FM_TYPE, row: coord.r, col: coord.c, map_path: mapPath };
    }

    return current;
}

async function adoptLegacyTile(
    app: App,
    mapFile: TFile,
    file: TFile,
    folderPath: string,
    folderPrefix: string,
    cached: Record<string, any> | null
): Promise<{ file: TFile; fmc: Record<string, any>; coord: TileCoord } | null> {
    if (cached && typeof (cached as any).map_path === "string") return null;

    let coord = coordFromFrontmatter(cached);
    if (!coord) {
        coord = coordFromLegacyName(file, folderPrefix);
    }
    if (!coord) return null;

    const raw = await app.vault.read(file);
    const mapName = mapNameFromPath(mapFile.path);
    const backlinkNeedle = `[[${mapName.toLowerCase()}|`;
    if (!raw.toLowerCase().includes(backlinkNeedle)) return null;

    const desiredPath = normalizePath(`${folderPath}/${fileNameForMap(mapFile, coord)}`);
    if (normalizePath(file.path) !== desiredPath) {
        const existing = app.vault.getAbstractFileByPath(desiredPath) as TFile | null;
        if (existing && existing !== file) {
            return null;
        }
        await app.fileManager.renameFile(file, desiredPath);
        const renamed = app.vault.getAbstractFileByPath(desiredPath);
        if (renamed && renamed instanceof TFile) {
            file = renamed;
        }
    }

    const ensured = await ensureTileSchema(app, mapFile, file, coord, cached);
    return { file, fmc: ensured, coord };
}
// ===== Öffentliche API =====

/** Alle Tiles für eine Map auflisten (scannt nur den Ziel-Ordner). */
export async function listTilesForMap(
    app: App,
    mapFile: TFile
): Promise<Array<{ coord: TileCoord; file: TFile; data: TileData }>> {
    const { folder, folderPrefix } = await readOptions(app, mapFile);
    const folderPath = normalizePath(folder);
    const folderPathLower = (folderPath.endsWith("/") ? folderPath : folderPath + "/").toLowerCase();

    const out: Array<{ coord: TileCoord; file: TFile; data: TileData }> = [];

    for (const file of app.vault.getFiles()) {
        let tileFile = file;
        const p = tileFile.path.toLowerCase();
        if (!p.startsWith(folderPathLower)) continue;
        if (!p.endsWith(".md")) continue;

        let fmc = fm(app, tileFile);
        if (!fmc || fmc.type !== FM_TYPE) {
            fmc = await fmFromFile(app, tileFile);
        }

        let coord = coordFromFrontmatter(fmc ?? null);
        const mapPath = mapFile.path;
        const hasTargetMap = !!(
            fmc &&
            fmc.type === FM_TYPE &&
            typeof (fmc as any).map_path === "string" &&
            (fmc as any).map_path === mapPath
        );

        if (!hasTargetMap) {
            if (fmc && typeof (fmc as any).map_path === "string" && (fmc as any).map_path !== mapPath) {
                continue;
            }
            const adoption = await adoptLegacyTile(app, mapFile, tileFile, folderPath, folderPrefix, fmc ?? null);
            if (!adoption) continue;
            tileFile = adoption.file;
            fmc = adoption.fmc;
            coord = adoption.coord;
        } else if (coord) {
            fmc = await ensureTileSchema(app, mapFile, tileFile, coord, fmc ?? null);
        }

        if (!coord) coord = coordFromFrontmatter(fmc ?? null);
        if (!coord) continue;

        out.push({
            coord,
            file: tileFile,
            data: ((): TileData => {
                const terrain = typeof fmc?.terrain === "string" ? fmc.terrain : "";
                const region = typeof (fmc as any)?.region === "string" ? (fmc as any).region : "";
                try {
                    const validated = validateTileData({ terrain, region }, { allowUnknownTerrain: true });
                    return { terrain: validated.terrain, region: validated.region ?? "" };
                } catch (error) {
                    console.warn("[salt-marcher] Ignoring invalid tile data", error);
                    return { terrain: terrain.trim(), region: region.trim() };
                }
            })(),
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
    fmc = await ensureTileSchema(app, mapFile, file, coord, fmc ?? null);
    if (!fmc || fmc.type !== FM_TYPE) return null;

    const raw = await app.vault.read(file);
    const body = raw.replace(/^---[\s\S]*?---\s*/m, "");
    const note = (body.split(/\n{2,}/).map(s => s.trim()).find(Boolean) ?? "").trim();

    const terrain = typeof fmc.terrain === "string" ? fmc.terrain : "";
    const region = typeof (fmc as any).region === "string" ? (fmc as any).region : "";
    try {
        const validated = validateTileData({ terrain, region, note }, { allowUnknownTerrain: true });
        return validated;
    } catch (error) {
        console.warn("[salt-marcher] Loaded tile contains invalid data", error);
        return { terrain: terrain.trim(), region: region.trim(), note: note || undefined };
    }
}

/** Tile speichern – legt Datei an oder aktualisiert Frontmatter/Body. */
export async function saveTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord,
    data: TileData
): Promise<TFile> {
    const sanitized = validateTileData(data);
    const mapPath = mapFile.path;
    const { folder, newPath, file } = await resolveTilePath(app, mapFile, coord);
    await ensureFolder(app, folder);

    if (!file) {
        const { folderPrefix } = await readOptions(app, mapFile);
        const md = buildMarkdown(coord, mapPath, folderPrefix, sanitized);
        return await app.vault.create(newPath, md);
    }

    // Frontmatter aktualisieren (nur setzen, wenn explizit übergeben)
    await app.fileManager.processFrontMatter(file, (f) => {
        f.type = FM_TYPE;
        (f as any).smHexTile = true;
        f.row = coord.r;
        f.col = coord.c;
        f.map_path = mapPath;
        if (sanitized.region !== undefined) (f as any).region = sanitized.region ?? "";
        if (sanitized.terrain !== undefined) f.terrain = sanitized.terrain ?? "";
        if (typeof f.terrain !== "string") f.terrain = "";
    });

        // Note (Body) optional aktualisieren – ersetzt nur, wenn data.note gesetzt ist
        if (sanitized.note !== undefined) {
            const raw = await app.vault.read(file);
            const hasFM = /^---[\s\S]*?---/m.test(raw);
            const fmPart = hasFM ? (raw.match(/^---[\s\S]*?---/m) || [""])[0] : "";
            const body = hasFM ? raw.slice(fmPart.length).trimStart() : raw;

            // Erhalte optionalen Backlink, ersetze restlichen Body durch neue Note
            const lines = body.split("\n");
            const keepBacklink = lines.find((l) => /\[\[.*\|\s*↩ Zur Karte\s*\]\]/.test(l));
            const newBody = [keepBacklink ?? "", sanitized.note.trim(), ""].filter(Boolean).join("\n");

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
