import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolvePath = (relative: string) =>
    fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: [],
    },
    resolve: {
        alias: {
            obsidian: resolvePath("./tests/mocks/obsidian.ts"),
        },
    },
});
