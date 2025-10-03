// salt-marcher/tests/core/hex-notes-legacy-conversion.test.ts
// Prüft die automatische Übernahme von Legacy-Hex-Tiles in das neue Schema.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import * as Obsidian from "obsidian";
import { listTilesForMap, loadTile } from "../../src/core/hex-mapper/hex-notes";

type FileEntry = {
    file: TFile;
    frontmatter: Record<string, any>;
    body: string;
};

function parseFrontmatter(raw: string): { frontmatter: Record<string, any>; body: string } {
    const match = raw.match(/^---\s*([\s\S]*?)\s*---\s*/);
    if (!match) {
        return { frontmatter: {}, body: raw };
    }

    const frontmatter: Record<string, any> = {};
    for (const line of match[1].split(/\r?\n/)) {
        if (!line.trim()) continue;
        const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
        if (!m) continue;
        let value: any = m[2].trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        } else if (value === "true" || value === "false") {
            value = value === "true";
        } else if (/^-?\d+$/.test(value)) {
            value = Number(value);
        }
        frontmatter[m[1]] = value;
    }

    const body = raw.slice(match[0].length);
    return { frontmatter, body };
}

function buildContent(entry: FileEntry): string {
    const keys = Object.keys(entry.frontmatter);
    const fm = keys.length
        ? `---\n${keys.map((key) => `${key}: ${JSON.stringify(entry.frontmatter[key])}`).join("\n")}\n---\n`
        : "";
    const body = entry.body.replace(/\s+$/, "");
    return (fm + body).trimEnd() + "\n";
}

class FakeMetadataCache {
    private cache = new Map<TFile, { frontmatter: Record<string, any> }>();

    set(file: TFile, frontmatter: Record<string, any>) {
        if (Object.keys(frontmatter).length === 0) {
            this.cache.delete(file);
            return;
        }
        this.cache.set(file, { frontmatter: { ...frontmatter } });
    }

    getFileCache(file: TFile) {
        return this.cache.get(file) ?? null;
    }
}

class FakeVault {
    private byPath = new Map<string, FileEntry>();
    private byFile = new Map<TFile, FileEntry>();

    constructor(private metadataCache: FakeMetadataCache) {}

    getFiles(): TFile[] {
        return Array.from(this.byPath.values()).map((entry) => entry.file);
    }

    getAbstractFileByPath(path: string) {
        return this.byPath.get(path)?.file ?? null;
    }

    async create(path: string, content: string) {
        const entry = this.parseEntry(content);
        entry.file.path = path;
        entry.file.basename = path.split("/").pop() ?? path;
        this.byPath.set(path, entry);
        this.byFile.set(entry.file, entry);
        this.metadataCache.set(entry.file, entry.frontmatter);
        return entry.file;
    }

    async read(file: TFile) {
        const entry = this.byFile.get(file);
        if (!entry) throw new Error(`Missing file: ${file.path}`);
        return buildContent(entry);
    }

    async createFolder(_path: string) {
        return { path: _path };
    }

    renameEntry(file: TFile, newPath: string) {
        const entry = this.byFile.get(file);
        if (!entry) throw new Error(`Missing entry for ${file.path}`);
        if (this.byPath.has(newPath) && this.byPath.get(newPath)?.file !== file) {
            throw new Error(`Target exists: ${newPath}`);
        }
        this.byPath.delete(file.path);
        file.path = newPath;
        file.basename = newPath.split("/").pop() ?? newPath;
        this.byPath.set(newPath, entry);
    }

    updateFrontmatter(file: TFile, frontmatter: Record<string, any>) {
        const entry = this.byFile.get(file);
        if (!entry) throw new Error(`Missing entry for ${file.path}`);
        entry.frontmatter = { ...frontmatter };
        this.metadataCache.set(file, entry.frontmatter);
    }

    private parseEntry(content: string): FileEntry {
        const { frontmatter, body } = parseFrontmatter(content);
        const file = new TFile();
        file.path = "";
        file.basename = "";
        return { file, frontmatter, body };
    }
}

class FakeFileManager {
    constructor(private vault: FakeVault, private metadataCache: FakeMetadataCache) {}

    async renameFile(file: TFile, newPath: string) {
        this.vault.renameEntry(file, newPath);
    }

    async processFrontMatter(file: TFile, updater: (data: Record<string, any>) => void) {
        const cache = this.metadataCache.getFileCache(file);
        const working = { ...(cache?.frontmatter ?? {}) };
        updater(working);
        for (const key of Object.keys(working)) {
            if (working[key] === undefined) delete working[key];
        }
        this.vault.updateFrontmatter(file, working);
    }
}

class FakeApp implements App {
    vault: FakeVault;
    fileManager: FakeFileManager;
    metadataCache: FakeMetadataCache;
    workspace: any;

    constructor() {
        this.metadataCache = new FakeMetadataCache();
        this.vault = new FakeVault(this.metadataCache);
        this.fileManager = new FakeFileManager(this.vault, this.metadataCache);
        this.workspace = {};
    }
}

describe("hex-notes legacy conversion", () => {
    let app: FakeApp;
    let mapFile: TFile;

    beforeEach(async () => {
        app = new FakeApp();
        vi.spyOn(Obsidian, "normalizePath").mockImplementation((value: string) => value);

        const mapContent = [
            "---",
            "smMap: true",
            "---",
            "# Demo Map",
            "",
            "```hex3x3",
            "folder: Hexes/Demo",
            "prefix: Hex",
            "```",
            "",
        ].join("\n");
        mapFile = await app.vault.create("SaltMarcher/Maps/Demo Map.md", mapContent);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("benennt Legacy-Tiles um und setzt map_path beim Auflisten", async () => {
        // Arrange
        const legacyTile = [
            "---",
            "type: hex",
            "row: 0",
            "col: 1",
            "terrain: forest",
            "region: Coast",
            "---",
            "[[Demo Map|↩ Zur Karte]]",
            "Alte Notiz",
        ].join("\n");
        await app.vault.create("Hexes/Demo/Hex 0,1.md", legacyTile);

        // Act
        const tiles = await listTilesForMap(app as unknown as App, mapFile);

        // Assert
        expect(tiles).toHaveLength(1);
        const tile = tiles[0];
        expect(tile.coord).toEqual({ r: 0, c: 1 });
        expect(tile.file.path).toBe("Hexes/Demo/Demo Map-0,1.md");
        expect(tile.data).toEqual({ terrain: "forest", region: "Coast" });

        const meta = app.metadataCache.getFileCache(tile.file)?.frontmatter ?? {};
        expect(meta).toMatchObject({
            type: "hex",
            smHexTile: true,
            map_path: "SaltMarcher/Maps/Demo Map.md",
            row: 0,
            col: 1,
        });
        expect(app.vault.getAbstractFileByPath("Hexes/Demo/Hex 0,1.md")).toBeNull();
    });

    it("aktualisiert map_path beim Laden einzelner Tiles", async () => {
        // Arrange
        const legacyTile = [
            "---",
            "type: hex",
            "row: 0",
            "col: 2",
            "terrain: hills",
            "---",
            "[[Demo Map|↩ Zur Karte]]",
            "",
            "Notiz",
        ].join("\n");
        await app.vault.create("Hexes/Demo/Demo Map-0,2.md", legacyTile);

        // Act
        const data = await loadTile(app as unknown as App, mapFile, { r: 0, c: 2 });

        // Assert
        expect(data).toMatchObject({ terrain: "hills", region: "" });
        const file = app.vault.getAbstractFileByPath("Hexes/Demo/Demo Map-0,2.md") as TFile;
        const meta = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        expect(meta.map_path).toBe("SaltMarcher/Maps/Demo Map.md");
    });
});
