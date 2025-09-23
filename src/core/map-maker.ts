// src/core/map-maker.ts
import { App, TFile } from "obsidian";
import { initTilesForNewMap } from "./hex-mapper/hex-notes";

export type HexBlockOptions = {
    folder?: string;        // Ziel-Ordner für Tiles
    folderPrefix?: string;  // Neuer Namens-Präfix (wird von hex-notes genutzt)
    prefix?: string;        // Legacy: zusätzlich in den Codeblock schreiben
    radius?: number;        // Render-Radius (px eines Hex-R)
};

/**
 * Erstellt eine neue Karten-.md mit hex3x3-Block
 * und legt direkt 3×3 leere Tile-Dateien an.
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

    // Sofort Start-Tiles anlegen → Renderer hat Bounds, Brush/Inspector laufen ohne Reload
    await initTilesForNewMap(app, file);

    return file;
}

/** Baut die Markdown-Datei mit erstem ```hex3x3 Block. */
export function buildHexMapMarkdown(name: string, opts: HexBlockOptions): string {
    const folder = (opts.folder ?? "Hexes").toString();
    // Neuer Schlüssel bevorzugt; fallback auf altes `prefix`
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
        `folderPrefix: ${folderPrefix}`, // neu: von hex-notes ausgewertet
        `prefix: ${folderPrefix}`,       // legacy: mitschreiben für ältere Parser
        `radius: ${radius}`,
        "```",
        "",
    ].join("\n");
}

/** Sichert Dateiname gegen verbotene Zeichen / Doppel-Spaces. */
export function sanitizeFileName(input: string): string {
    return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

/** Hängt „ (2)“, „ (3)“ usw. an, wenn es den Pfad schon gibt. */
export async function ensureUniquePath(app: App, basePath: string): Promise<string> {
    if (!app.vault.getAbstractFileByPath(basePath)) return basePath;

    const dot = basePath.lastIndexOf(".");
    const stem = dot === -1 ? basePath : basePath.slice(0, dot);
    const ext = dot === -1 ? "" : basePath.slice(dot);

    for (let i = 2; i < 9999; i++) {
        const candidate = `${stem} (${i})${ext}`;
        if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
    }

    // Fallback – extrem unwahrscheinlich
    return `${stem}-${Date.now()}${ext}`;
}
