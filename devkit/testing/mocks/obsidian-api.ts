// devkit/testing/mocks/obsidian-api.ts
// Central Obsidian API mocks for testing
import { vi } from "vitest";
import type { App, TFile, Vault } from "obsidian";

/**
 * Mock TFile class for testing
 */
class MockTFile {
    path: string = "";
    basename: string = "";
    extension: string = "";
    name: string = "";
    stat: { ctime: number; mtime: number; size: number } = { ctime: 0, mtime: 0, size: 0 };
    vault: any = null;
}

/**
 * Creates a mock TFile with the given path and optional basename
 */
export function createMockTFile(path: string, basename?: string): TFile {
    const file = new MockTFile() as unknown as TFile;
    file.path = path;
    file.basename = basename ?? path.split("/").pop()?.replace(/\.\w+$/, "") ?? path;
    file.extension = path.split(".").pop() ?? "";
    file.name = path.split("/").pop() ?? path;
    return file;
}

/**
 * Creates a mock Vault with common operations
 */
export function createMockVault(initialFiles: Record<string, string> = {}): Vault {
    const files = new Map<string, { file: TFile; data: string }>();

    // Initialize with provided files
    for (const [path, data] of Object.entries(initialFiles)) {
        const file = createMockTFile(path);
        files.set(path, { file, data });
    }

    const vault = {
        getAbstractFileByPath: vi.fn((path: string) => {
            return files.get(path)?.file ?? null;
        }),

        read: vi.fn(async (file: TFile) => {
            const entry = files.get(file.path);
            if (!entry) throw new Error(`File not found: ${file.path}`);
            return entry.data;
        }),

        create: vi.fn(async (path: string, data: string) => {
            const file = createMockTFile(path);
            files.set(path, { file, data });
            return file;
        }),

        modify: vi.fn(async (file: TFile, data: string) => {
            const entry = files.get(file.path);
            if (!entry) throw new Error(`File not found: ${file.path}`);
            entry.data = data;
        }),

        delete: vi.fn(async (file: TFile) => {
            files.delete(file.path);
        }),

        exists: vi.fn(async (path: string) => {
            return files.has(path);
        }),

        createFolder: vi.fn(async (path: string) => {
            // Mark as created by adding to a set
            return { path };
        }),

        getFiles: vi.fn(() => {
            return Array.from(files.values()).map(entry => entry.file);
        }),

        getAbstractFileByPathEnsureExists: vi.fn((path: string) => {
            let entry = files.get(path);
            if (!entry) {
                const file = createMockTFile(path);
                files.set(path, { file, data: "" });
                entry = files.get(path)!;
            }
            return entry.file;
        }),

        adapter: {
            exists: vi.fn(async (path: string) => files.has(path)),
            read: vi.fn(async (path: string) => {
                const entry = files.get(path);
                if (!entry) throw new Error(`File not found: ${path}`);
                return entry.data;
            }),
            write: vi.fn(async (path: string, data: string) => {
                const file = createMockTFile(path);
                files.set(path, { file, data });
            }),
            mkdir: vi.fn(async (path: string) => {
                // Just return success - folders aren't tracked separately
                return;
            }),
        },

        on: vi.fn(),
        off: vi.fn(),
        offref: vi.fn(),
    } as unknown as Vault;

    return vault;
}

/**
 * Creates a mock App with vault and workspace
 */
export function createMockApp(options: {
    vault?: Vault;
    initialFiles?: Record<string, string>;
} = {}): App {
    const vault = options.vault ?? createMockVault(options.initialFiles);

    return {
        vault,
        workspace: {
            on: vi.fn(),
            off: vi.fn(),
            offref: vi.fn(),
            trigger: vi.fn(),
            getLeaf: vi.fn(),
            registerView: vi.fn(),
            getLeavesOfType: vi.fn(() => []),
            getActiveFile: vi.fn(() => null),
            revealLeaf: vi.fn(),
            registerObsidianProtocolHandler: vi.fn(),
        },
    } as unknown as App;
}

/**
 * Helper to add a file to an existing mock vault
 */
export function addFileToVault(vault: Vault, path: string, content: string): TFile {
    const file = createMockTFile(path);
    (vault as any).getAbstractFileByPath.mockImplementation((p: string) => {
        if (p === path) return file;
        return (vault as any).getAbstractFileByPath.getMockImplementation()?.(p) ?? null;
    });
    (vault as any).read.mockImplementation(async (f: TFile) => {
        if (f.path === path) return content;
        return (vault as any).read.getMockImplementation()?.(f);
    });
    return file;
}
