// src/plugins/layout-editor/layout-library.ts
import { App, TFile, TFolder, normalizePath } from "obsidian";
import { LayoutBlueprint, LayoutElement, SavedLayout } from "./types";

const LAYOUT_FOLDER = "LayoutEditor/Layouts";

async function ensureLayoutFolder(app: App): Promise<void> {
    const folderPath = normalizePath(LAYOUT_FOLDER);
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (folder) return;
    await app.vault.createFolder(folderPath).catch(() => {});
}

function createFileName(id: string): string {
    return `${id}.json`;
}

function sanitizeName(name: string): string {
    return name.trim() || "Unbenanntes Layout";
}

function createId(): string {
    const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (globalCrypto?.randomUUID) {
        return globalCrypto.randomUUID();
    }
    return `layout-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export async function saveLayoutToLibrary(app: App, payload: LayoutBlueprint & { name: string; id?: string }): Promise<SavedLayout> {
    await ensureLayoutFolder(app);
    const id = payload.id ?? createId();
    const fileName = createFileName(id);
    const path = normalizePath(`${LAYOUT_FOLDER}/${fileName}`);
    const existing = app.vault.getAbstractFileByPath(path);
    const now = new Date().toISOString();
    const entry: SavedLayout = {
        id,
        name: sanitizeName(payload.name),
        canvasWidth: payload.canvasWidth,
        canvasHeight: payload.canvasHeight,
        elements: payload.elements,
        createdAt: existing instanceof TFile ? (await readLayoutMeta(app, existing))?.createdAt ?? now : now,
        updatedAt: now,
    };
    const body = JSON.stringify(entry, null, 2);
    if (existing instanceof TFile) {
        await app.vault.modify(existing, body);
    } else {
        await app.vault.create(path, body);
    }
    return entry;
}

async function readLayoutMeta(app: App, file: TFile): Promise<SavedLayout | null> {
    try {
        const raw = await app.vault.read(file);
        const parsed = JSON.parse(raw) as Partial<SavedLayout>;
        if (!parsed || typeof parsed !== "object") return null;
        if (!Array.isArray(parsed.elements) || typeof parsed.canvasWidth !== "number" || typeof parsed.canvasHeight !== "number") {
            return null;
        }
        const fallbackCreated = new Date(file.stat.ctime || Date.now()).toISOString();
        const fallbackUpdated = new Date(file.stat.mtime || Date.now()).toISOString();
        return {
            id: parsed.id ?? file.basename,
            name: typeof parsed.name === "string" ? parsed.name : file.basename,
            canvasWidth: parsed.canvasWidth,
            canvasHeight: parsed.canvasHeight,
            elements: (parsed.elements ?? []) as LayoutElement[],
            createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : fallbackCreated,
            updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallbackUpdated,
        };
    } catch (error) {
        console.error("Failed to read layout file", error);
        return null;
    }
}

export async function listSavedLayouts(app: App): Promise<SavedLayout[]> {
    await ensureLayoutFolder(app);
    const folder = app.vault.getAbstractFileByPath(normalizePath(LAYOUT_FOLDER));
    if (!(folder instanceof TFolder)) {
        return [];
    }
    const files = folder.children.filter((child): child is TFile => child instanceof TFile && child.extension === "json");
    const out: SavedLayout[] = [];
    for (const file of files) {
        const meta = await readLayoutMeta(app, file);
        if (meta) out.push(meta);
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return out;
}

export async function loadSavedLayout(app: App, id: string): Promise<SavedLayout | null> {
    await ensureLayoutFolder(app);
    const path = normalizePath(`${LAYOUT_FOLDER}/${createFileName(id)}`);
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    return await readLayoutMeta(app, file);
}
