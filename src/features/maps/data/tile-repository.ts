// src/features/maps/data/tile-repository.ts
import { App, TFile, TFolder, normalizePath } from "obsidian";
import { TERRAIN_COLORS } from "../domain/terrain";
import { parseOptions } from "../domain/options";
import { logger } from "../../../app/plugin-logger";
import { getFactionOverlayStore, type FactionOverlayAssignment } from "../state/faction-overlay-store";
import { createTileStore, createEmptyTileStoreState, type TileStore, type TileStoreState } from "../state/tile-store";
import type { Unsubscriber } from "../../../services/state";

export type TileCoord = { r: number; c: number };
export type TileData  = { terrain: string; region?: string; faction?: string; note?: string; locationMarker?: string };

const TILE_TERRAIN_MAX_LENGTH = 64;
const TILE_REGION_MAX_LENGTH = 120;
const TILE_FACTION_MAX_LENGTH = 120;
const TILE_LOCATION_MARKER_MAX_LENGTH = 200;

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

    const factionRaw = typeof data.faction === "string" ? data.faction : "";
    const faction = factionRaw.trim();
    if (faction.length > TILE_FACTION_MAX_LENGTH) {
        issues.push(`faction exceeds ${TILE_FACTION_MAX_LENGTH} characters`);
    }

    const locationMarkerRaw = typeof data.locationMarker === "string" ? data.locationMarker : "";
    const locationMarker = locationMarkerRaw.trim();
    if (locationMarker.length > TILE_LOCATION_MARKER_MAX_LENGTH) {
        issues.push(`locationMarker exceeds ${TILE_LOCATION_MARKER_MAX_LENGTH} characters`);
    }

    const noteRaw = typeof data.note === "string" ? data.note : undefined;
    const note = noteRaw?.trim();

    if (issues.length) {
        throw new TileValidationError(issues);
    }

    return {
        terrain,
        region,
        faction: faction || undefined,
        locationMarker: locationMarker || undefined,
        note: note || undefined,
    };
}

const FM_TYPE = "hex";

const tileStoreRegistry = new WeakMap<App, Map<string, TileStore>>();
const overlaySyncRegistry = new WeakMap<App, Map<string, () => void>>();

function ensureOverlaySync(app: App, mapFile: TFile, store: TileStore): void {
    let byApp = overlaySyncRegistry.get(app);
    if (!byApp) {
        byApp = new Map();
        overlaySyncRegistry.set(app, byApp);
    }

    const key = mapFile.path;
    if (byApp.has(key)) return;

    const overlayStore = getFactionOverlayStore(app, mapFile);

    const applyState = (state: TileStoreState) => {
        if (!state.loaded) {
            overlayStore.clear();
            return;
        }

        const assignments: FactionOverlayAssignment[] = [];
        for (const record of state.tiles.values()) {
            const factionId = (record.data.faction ?? "").trim();
            if (!factionId) continue;

            assignments.push({
                coord: record.coord,
                factionId,
                factionName: record.data.faction ?? undefined,
                sourceId: record.file?.path,
            });
        }

        overlayStore.setAssignments(assignments);
    };

    const unsubscribe: Unsubscriber = store.state.subscribe(applyState);
    applyState(store.state.get());

    const dispose = () => {
        unsubscribe();
        overlayStore.clear();
    };

    byApp.set(key, dispose);
}

function releaseOverlaySync(app: App, mapFile: TFile): void {
    const byApp = overlaySyncRegistry.get(app);
    if (!byApp) return;
    const dispose = byApp.get(mapFile.path);
    if (dispose) {
        dispose();
        byApp.delete(mapFile.path);
    }
}

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

function getTileStore(app: App, mapFile: TFile): TileStore {
    let storesByApp = tileStoreRegistry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        tileStoreRegistry.set(app, storesByApp);
    }

    const key = mapFile.path;
    let store = storesByApp.get(key);
    if (!store) {
        store = createTileStore({
            storageKey: normalizePath(`tiles://${mapFile.path}`),
            name: `map-tiles:${normalizePath(mapFile.path)}`,
            listTilesFromDisk: () => listTilesForMapFromDisk(app, mapFile),
            saveTileToDisk: (coord, data) => saveTileToDisk(app, mapFile, coord, data),
            deleteTileFromDisk: (coord) => deleteTileFromDisk(app, mapFile, coord),
            loadTileFromDisk: (coord) => loadTileFromDisk(app, mapFile, coord),
        });
        storesByApp.set(key, store);
    }
    ensureOverlaySync(app, mapFile, store);
    return store;
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
    const faction = (validated.faction ?? "").trim();
    const locationMarker = (validated.locationMarker ?? "").trim();
    const mapName = mapNameFromPath(mapPath);
    const bodyNote = (validated.note ?? "Notizen hier …").trim();
    return [
        "---",
        `type: ${FM_TYPE}`,
        `smHexTile: true`,
        `region: "${region}"`,
        `faction: "${faction}"`,
        `locationMarker: "${locationMarker}"`,
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
async function listTilesForMapFromDisk(
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
                    logger.warn("[salt-marcher] Ignoring invalid tile data", error);
                    return { terrain: terrain.trim(), region: region.trim() };
                }
            })(),
        });
    }

    return out;
}


/** Tile laden – gibt null zurück, wenn die Datei nicht existiert oder invalid ist. */
async function loadTileFromDisk(
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
    const faction = typeof (fmc as any).faction === "string" ? (fmc as any).faction : "";
    const locationMarker = typeof (fmc as any).locationMarker === "string" ? (fmc as any).locationMarker : "";
    try {
        const validated = validateTileData({ terrain, region, faction, locationMarker, note }, { allowUnknownTerrain: true });
        return validated;
    } catch (error) {
        logger.warn("[salt-marcher] Loaded tile contains invalid data", error);
        return { terrain: terrain.trim(), region: region.trim(), faction: faction.trim() || undefined, locationMarker: locationMarker.trim() || undefined, note: note || undefined };
    }
}

/** Tile speichern – legt Datei an oder aktualisiert Frontmatter/Body. */
async function saveTileToDisk(
    app: App,
    mapFile: TFile,
    coord: TileCoord,
    data: TileData
): Promise<{ file: TFile; data: TileData }> {
    const sanitized = validateTileData(data);
    const mapPath = mapFile.path;
    const { folder, newPath, file } = await resolveTilePath(app, mapFile, coord);
    await ensureFolder(app, folder);

    if (!file) {
        const { folderPrefix } = await readOptions(app, mapFile);
        const md = buildMarkdown(coord, mapPath, folderPrefix, sanitized);
        const created = await app.vault.create(newPath, md);
        return { file: created, data: sanitized };
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
        if ("faction" in data) {
            if (sanitized.faction) {
                (f as any).faction = sanitized.faction;
            } else {
                delete (f as any).faction;
            }
        }
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

    return { file, data: sanitized };
}

/** Tile löschen (falls vorhanden). */
async function deleteTileFromDisk(
    app: App,
    mapFile: TFile,
    coord: TileCoord
): Promise<void> {
    const { file } = await resolveTilePath(app, mapFile, coord);
    if (!file) return;
    await app.vault.delete(file);
}

export async function initTilesForNewMap(app: App, mapFile: TFile): Promise<void> {
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            await saveTile(app, mapFile, { r, c }, { terrain: "" });
        }
    }
    const store = getTileStore(app, mapFile);
    await store.refresh();
}

export async function listTilesForMap(
    app: App,
    mapFile: TFile
): Promise<Array<{ coord: TileCoord; file: TFile; data: TileData }>> {
    const store = getTileStore(app, mapFile);
    return await store.listTiles();
}

export async function loadTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord
): Promise<TileData | null> {
    const store = getTileStore(app, mapFile);
    return await store.loadTile(coord);
}

export async function saveTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord,
    data: TileData
): Promise<TFile> {
    const store = getTileStore(app, mapFile);
    return await store.saveTile(coord, data);
}

export async function deleteTile(
    app: App,
    mapFile: TFile,
    coord: TileCoord
): Promise<void> {
    const store = getTileStore(app, mapFile);
    await store.deleteTile(coord);
}

export function resetTileStore(app: App, mapFile: TFile): void {
    const storesByApp = tileStoreRegistry.get(app);
    const store = storesByApp?.get(mapFile.path);
    if (store) {
        releaseOverlaySync(app, mapFile);
        store.state.set(createEmptyTileStoreState());
        storesByApp?.delete(mapFile.path);
    }
}
