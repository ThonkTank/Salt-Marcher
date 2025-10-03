// salt-marcher/tests/todo-governance.test.ts
// Stellt sicher, dass die zentrale TODO.md mit allen AGENTS-Aufgaben synchron bleibt.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("todo governance", () => {
    it("fails when TODO.md is out of sync", () => {
        // Arrange
        const scriptPath = join(__dirname, "..", "tools", "sync-todos.mjs");

        // Act
        const result = spawnSync("node", [scriptPath, "--check"], {
            cwd: join(__dirname, ".."),
            encoding: "utf8",
        });

        // Assert
        if (result.status !== 0) {
            const stdout = result.stdout ?? "";
            const stderr = result.stderr ?? "";
            throw new Error(`sync-todos.mjs --check failed.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
        }

        expect(result.status).toBe(0);
    });
});
