// esbuild.config.mjs
import esbuild from "esbuild";

/**
 * Baut main.js in den Plugin-Root (nicht nach dist/).
 * Externe Module (von Obsidian/Electron bereitgestellt) werden nicht gebundelt.
 */
await esbuild.build({
    entryPoints: ["src/app/main.ts"],   // Plugin-Einstieg
    bundle: true,
    outfile: "main.js",                 // Obsidian erwartet main.js im Plugin-Root
    platform: "browser",                // Renderer-Kontext
    format: "cjs",                      // Obsidian-Plugins sind CommonJS
        target: "es2020",
        sourcemap: false,
        external: [
            "obsidian",
            "electron",
            "codemirror",
            "@codemirror/state",
            "@codemirror/view",
        ],

        // WICHTIG: explizit TS-Loader setzen, damit 'import type' unterstützt wird
        loader: {
            ".ts": "ts",
            ".tsx": "tsx",
            ".json": "json",
        },

        // Optional, aber hilfreich: .ts zuerst auflösen
        resolveExtensions: [".ts", ".tsx", ".js", ".mjs", ".json"],

        // Optional: falls du tsconfig-Pfade nutzt
        tsconfig: "tsconfig.json",

        logLevel: "info",
});
