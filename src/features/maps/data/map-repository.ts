// src/features/maps/data/map-repository.ts
// Consolidated map CRUD operations
import { App, TFile } from "obsidian";
import { initTilesForNewMap, listTilesForMap } from "./tile-repository";

export type HexBlockOptions = {
    folder?: string;        // Target folder for tiles
    folderPrefix?: string;  // Prefix for tile names
    prefix?: string;        // Legacy: also written to codeblock
    radius?: number;        // Render radius (px of a hex)
};

// ===== Create =====

/**
 * Creates a new map .md file with hex3x3 block
 * and immediately creates 3×3 empty tile files.
 */
export async function createHexMapFile(
    app: App,
    rawName: string,
    opts: HexBlockOptions = { folder: "Hexes", folderPrefix: "Hex", radius: 42 }
): Promise<TFile> {
    const name = sanitizeFileName(rawName) || "Neue Hex Map";
    const content = buildHexMapMarkdown(name, opts);
    const mapsFolder = "SaltMarcher/Maps";
    await app.vault.createFolder(mapsFolder).catch(() => {});
    const path = await ensureUniquePath(app, `${mapsFolder}/${name}.md`);
    const file = await app.vault.create(path, content);

    // Immediately create initial tiles → renderer has bounds, brush/inspector work without reload
    await initTilesForNewMap(app, file);

    return file;
}

/** Builds the markdown file with first ```hex3x3 block. */
export function buildHexMapMarkdown(name: string, opts: HexBlockOptions): string {
    const folder = (opts.folder ?? "Hexes").toString();
    // Prefer new key; fallback to old `prefix`
    const folderPrefix = (opts.folderPrefix ?? opts.prefix ?? "Hex").toString();
    const radius = typeof opts.radius === "number" ? opts.radius : 42;

    return [
        "---",
        'smMap: true',
        "---",
        `# ${name}`,
        "",
        "```hex3x3",
        `folder: ${folder}`,
        `folderPrefix: ${folderPrefix}`, // new: evaluated by tile-repository
        `prefix: ${folderPrefix}`,       // legacy: kept for older parsers
        `radius: ${radius}`,
        "```",
        "",
    ].join("\n");
}

/** Sanitizes filename against forbidden characters / double spaces. */
export function sanitizeFileName(input: string): string {
    return input
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .slice(0, 120);
}

/** Appends " (2)", " (3)", etc. if the path already exists. */
export async function ensureUniquePath(app: App, basePath: string): Promise<string> {
    if (!app.vault.getAbstractFileByPath(basePath)) return basePath;

    const dot = basePath.lastIndexOf(".");
    const stem = dot === -1 ? basePath : basePath.slice(0, dot);
    const ext = dot === -1 ? "" : basePath.slice(dot);

    for (let i = 2; i < 9999; i++) {
        const candidate = `${stem} (${i})${ext}`;
        if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
    }

    // Fallback – extremely unlikely
    return `${stem}-${Date.now()}${ext}`;
}

// ===== Read =====

/** Returns the newest file from the list (by mtime). */
export function pickLatest(files: TFile[]): TFile | null {
    if (!files.length) return null;
    return [...files].sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0))[0];
}

/**
 * Returns all markdown files that contain at least one ```hex3x3 codeblock.
 * Sorted by last modification (newest first).
 */
export async function getAllMapFiles(app: App): Promise<TFile[]> {
    const mdFiles = app.vault.getMarkdownFiles();
    const results: TFile[] = [];
    const rx = /```[\t ]*hex3x3\b[\s\S]*?```/i;

    for (const f of mdFiles) {
        const content = await app.vault.cachedRead(f);
        if (rx.test(content)) results.push(f);
    }

    // Newest first
    return results.sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0));
}

/**
 * Returns the **first** hex3x3 block content (without ``` markers).
 * Return value is the options text expected by `parseOptions(...)`.
 */
export async function getFirstHexBlock(app: App, file: TFile): Promise<string | null> {
    const content = await app.vault.cachedRead(file);
    const m = content.match(/```[\t ]*hex3x3\b\s*\n([\s\S]*?)\n```/i);
    return m ? m[1].trim() : null;
}

// ===== Delete =====

export async function deleteMapAndTiles(app: App, mapFile: TFile): Promise<void> {
    // 1) Find and delete tiles
    const tiles = await listTilesForMap(app, mapFile);
    for (const t of tiles) {
        try {
            await app.vault.delete(t.file);
        } catch (e) {
            console.warn("Delete tile failed:", t.file.path, e);
        }
    }

    // 2) Delete map
    try {
        await app.vault.delete(mapFile);
    } catch (e) {
        console.warn("Delete map failed:", mapFile.path, e);
    }
}
