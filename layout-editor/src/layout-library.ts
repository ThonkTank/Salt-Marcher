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

function parseDimension(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value.trim());
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function normalizeStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const filtered = value.filter((item): item is string => typeof item === "string");
    return filtered.length ? filtered : [];
}

function normalizeLayoutConfig(value: unknown): LayoutElement["layout"] | undefined {
    if (!value || typeof value !== "object") return undefined;
    const layout = value as Partial<LayoutElement["layout"]> & Record<string, unknown>;
    const gap = parseDimension(layout.gap);
    const padding = parseDimension(layout.padding);
    const align = layout.align;
    if (gap === null || padding === null) return undefined;
    if (align !== "start" && align !== "center" && align !== "end" && align !== "stretch") {
        return undefined;
    }
    return { gap, padding, align };
}

function normalizeElements(value: unknown): LayoutElement[] | null {
    const source: unknown[] | null = Array.isArray(value)
        ? value
        : value && typeof value === "object"
          ? Object.values(value as Record<string, unknown>)
          : null;
    if (!source) return null;

    const elements: LayoutElement[] = [];
    for (const entry of source) {
        if (!entry || typeof entry !== "object") continue;
        const raw = entry as Record<string, unknown>;
        const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : null;
        const type = typeof raw.type === "string" && raw.type.trim() ? raw.type : null;
        const x = parseDimension(raw.x);
        const y = parseDimension(raw.y);
        const width = parseDimension(raw.width);
        const height = parseDimension(raw.height);
        const label = typeof raw.label === "string" ? raw.label : "";
        if (!id || !type || x === null || y === null || width === null || height === null) continue;
        const element: LayoutElement = {
            id,
            type,
            x,
            y,
            width,
            height,
            label,
            description: typeof raw.description === "string" ? raw.description : undefined,
            placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
            defaultValue: typeof raw.defaultValue === "string" ? raw.defaultValue : undefined,
            options: normalizeStringArray(raw.options),
            attributes: normalizeStringArray(raw.attributes) ?? [],
            parentId: typeof raw.parentId === "string" ? raw.parentId : undefined,
            layout: normalizeLayoutConfig(raw.layout),
            children: normalizeStringArray(raw.children),
        };
        elements.push(element);
    }
    return elements;
}

async function readLayoutMeta(app: App, file: TFile): Promise<SavedLayout | null> {
    try {
        const raw = await app.vault.read(file);
        const parsed = JSON.parse(raw) as Partial<SavedLayout> & Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return null;
        const canvasWidth = parseDimension(parsed.canvasWidth);
        const canvasHeight = parseDimension(parsed.canvasHeight);
        const elements = normalizeElements(parsed.elements);
        if (canvasWidth === null || canvasHeight === null || !elements) {
            return null;
        }
        const fallbackCreated = new Date(file.stat.ctime || Date.now()).toISOString();
        const fallbackUpdated = new Date(file.stat.mtime || Date.now()).toISOString();
        const fileId = file.basename;
        const resolvedName = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : fileId;
        return {
            id: fileId,
            name: resolvedName,
            canvasWidth,
            canvasHeight,
            elements,
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
