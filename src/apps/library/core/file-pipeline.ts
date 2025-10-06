// src/apps/library/core/file-pipeline.ts
// Stellt eine generische Vault-Dateipipeline bereit, um Kategorien konsistent zu bedienen.
import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

export type VaultFilePipelineOptions<TData> = {
    /**
     * Wurzelverzeichnis innerhalb des Vaults, das die Kategorie-Dateien aufnimmt.
     * Beispiele: "SaltMarcher/Creatures" oder "SaltMarcher/Spells".
     */
    dir: string;
    /**
     * Fallback-Name, der genutzt wird, wenn die Daten keinen Namen liefern.
     * Wird ebenfalls als Platzhalter verwendet, wenn ein ungültiger Dateiname bereinigt werden muss.
     */
    defaultBaseName: string;
    /**
     * Liefert den bevorzugten Basisnamen für die zu erzeugende Datei.
     */
    getBaseName(data: TData): string | undefined;
    /**
     * Serialisiert die Daten in Markdown-Inhalt inkl. Frontmatter.
     */
    toContent(data: TData): string;
    /**
     * Optionaler Hook, um Dateinamen zusätzlich zu bereinigen.
     * Default nutzt `sanitizeVaultFileName`.
     */
    sanitizeName?: (name: string) => string;
    /**
     * Dateierweiterung ohne Punkt. Default: "md".
     */
    extension?: string;
};

export type VaultFilePipeline<TData> = {
    ensure(app: App): Promise<TFolder>;
    list(app: App): Promise<TFile[]>;
    watch(app: App, onChange: () => void): () => void;
    create(app: App, data: TData): Promise<TFile>;
};

export function sanitizeVaultFileName(name: string, fallback: string): string {
    const trimmed = (name ?? "").trim();
    const safeFallback = fallback && fallback.trim() ? fallback.trim() : "Entry";
    if (!trimmed) return safeFallback;
    return trimmed
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/^\.+$/, safeFallback)
        .slice(0, 120);
}

export function createVaultFilePipeline<TData>(options: VaultFilePipelineOptions<TData>): VaultFilePipeline<TData> {
    const normalizedDir = normalizePath(options.dir);
    const extension = (options.extension || "md").replace(/^\.+/, "");
    const sanitize = options.sanitizeName
        ? options.sanitizeName
        : (name: string) => sanitizeVaultFileName(name, options.defaultBaseName);

    async function ensure(app: App): Promise<TFolder> {
        let file = app.vault.getAbstractFileByPath(normalizedDir);
        if (file instanceof TFolder) return file;
        await app.vault.createFolder(normalizedDir).catch(() => {});
        file = app.vault.getAbstractFileByPath(normalizedDir);
        if (file instanceof TFolder) return file;
        throw new Error(`Could not create directory ${normalizedDir}`);
    }

    async function list(app: App): Promise<TFile[]> {
        const dir = await ensure(app);
        const out: TFile[] = [];
        const walk = (folder: TFolder) => {
            for (const child of folder.children) {
                if (child instanceof TFolder) walk(child);
                else if (child instanceof TFile && child.extension === extension) out.push(child);
            }
        };
        walk(dir);
        return out;
    }

    function watch(app: App, onChange: () => void): () => void {
        const base = `${normalizedDir}/`;
        const isRelevant = (file: TAbstractFile) => {
            if (!(file instanceof TFile || file instanceof TFolder)) return false;
            const path = file.path.endsWith("/") ? file.path : `${file.path}/`;
            return path.startsWith(base);
        };
        const handler = (file: TAbstractFile) => {
            if (isRelevant(file)) onChange?.();
        };
        app.vault.on("create", handler);
        app.vault.on("delete", handler);
        app.vault.on("rename", handler);
        app.vault.on("modify", handler);
        return () => {
            app.vault.off("create", handler);
            app.vault.off("delete", handler);
            app.vault.off("rename", handler);
            app.vault.off("modify", handler);
        };
    }

    async function create(app: App, data: TData): Promise<TFile> {
        const dir = await ensure(app);
        const baseName = sanitize(options.getBaseName(data) ?? options.defaultBaseName);
        let fileName = `${baseName}.${extension}`;
        let path = normalizePath(`${dir.path}/${fileName}`);
        let i = 2;
        while (app.vault.getAbstractFileByPath(path)) {
            fileName = `${baseName} (${i}).${extension}`;
            path = normalizePath(`${dir.path}/${fileName}`);
            i += 1;
        }
        const content = options.toContent(data);
        const file = await app.vault.create(path, content);
        return file as TFile;
    }

    return { ensure, list, watch, create };
}

