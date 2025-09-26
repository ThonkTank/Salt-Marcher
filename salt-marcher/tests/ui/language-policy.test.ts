import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(__dirname, "..", "..", "src");

const TARGETS = [
    join(SRC_ROOT, "ui", "copy.ts"),
    join(SRC_ROOT, "ui", "UiOverview.txt"),
    join(SRC_ROOT, "ui", "map-header.ts"),
    join(SRC_ROOT, "ui", "map-manager.ts"),
    join(SRC_ROOT, "ui", "map-workflows.ts"),
    join(SRC_ROOT, "ui", "confirm-delete.ts"),
    join(SRC_ROOT, "ui", "modals.ts"),
    join(SRC_ROOT, "ui", "search-dropdown.ts"),
    join(SRC_ROOT, "app", "main.ts"),
    join(SRC_ROOT, "apps", "library", "view.ts"),
];

const FORBIDDEN_PATTERN = /[äöüÄÖÜß]/u;

function collectFiles(path: string): string[] {
    const stats = statSync(path);
    if (stats.isDirectory()) {
        return readdirSync(path)
            .flatMap((entry) => collectFiles(join(path, entry)))
            .filter((file) => file.endsWith(".ts") || file.endsWith(".txt"));
    }
    return [path];
}

describe("language policy", () => {
    it("contains no German characters in monitored UI sources", () => {
        const offenders: Array<{ file: string; match: string }> = [];
        for (const target of TARGETS) {
            for (const file of collectFiles(target)) {
                const content = readFileSync(file, "utf8");
                const match = content.match(FORBIDDEN_PATTERN);
                if (match) {
                    offenders.push({ file: relative(join(__dirname, "..", ".."), file), match: match[0] });
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
