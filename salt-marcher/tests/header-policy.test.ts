// salt-marcher/tests/header-policy.test.ts
// Validiert AGENTS-Abdeckung und Kopfkommentare für Skripte im Plugin.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const PLUGIN_ROOT = join(__dirname, "..");
const IGNORED_DIRECTORY_NAMES = new Set(["node_modules", ".git"]);
const HEADER_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs"]);

function collectDirectories(root: string): string[] {
    const stack = [root];
    const directories: string[] = [];

    while (stack.length > 0) {
        const current = stack.pop()!;
        directories.push(current);

        for (const entry of readdirSync(current, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }

            if (IGNORED_DIRECTORY_NAMES.has(entry.name) || entry.name.startsWith(".")) {
                continue;
            }

            const child = join(current, entry.name);
            stack.push(child);
        }
    }

    return directories;
}

function collectHeaderCandidates(root: string): string[] {
    const stack = [root];
    const files: string[] = [];

    while (stack.length > 0) {
        const current = stack.pop()!;

        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const absolute = join(current, entry.name);

            if (entry.isDirectory()) {
                if (IGNORED_DIRECTORY_NAMES.has(entry.name) || entry.name.startsWith(".")) {
                    continue;
                }
                stack.push(absolute);
                continue;
            }

            if (entry.name.endsWith(".d.ts")) {
                continue;
            }

            const extension = entry.name.slice(entry.name.lastIndexOf("."));
            if (!HEADER_EXTENSIONS.has(extension)) {
                continue;
            }

            files.push(absolute);
        }
    }

    return files;
}

describe("governance policies", () => {
    it("ensures every directory contains an AGENTS guide", () => {
        // Arrange
        const directories = collectDirectories(PLUGIN_ROOT);

        // Act
        const missing = directories
            .filter((dir) => !existsSync(join(dir, "AGENTS.md")))
            .map((dir) => relative(PLUGIN_ROOT, dir).replace(/\\/g, "/"));

        // Assert
        expect(missing).toEqual([]);
    });

    it("enforces header comments for source and test files", () => {
        // Arrange
        const candidates = collectHeaderCandidates(PLUGIN_ROOT);

        // Act
        const offenders = candidates
            .map((file) => {
                const content = readFileSync(file, "utf8");
                const [rawFirstLine = ""] = content.split(/\r?\n/, 1);
                const firstLine = rawFirstLine.replace(/^\uFEFF/, "").trim();

                if (!firstLine.startsWith("//")) {
                    return relative(PLUGIN_ROOT, file).replace(/\\/g, "/");
                }

                return null;
            })
            .filter((entry): entry is string => entry !== null);

        // Assert
        expect(offenders).toEqual([]);
    });
});
