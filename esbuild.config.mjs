// esbuild.config.mjs
import { execSync } from "child_process";

let esbuild;
try {
    const esbuildModule = await import("esbuild");
    esbuild = esbuildModule.default ?? esbuildModule;
} catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
        console.error(
            "Es konnte kein 'esbuild'-Paket gefunden werden. Führe zuerst `npm install` im Plugin-Ordner aus, " +
                "damit die Build-Abhängigkeiten bereitstehen."
        );
        process.exit(1);
    }
    throw error;
}

// Generate preset data before building
console.log("Generating preset data...");
try {
    execSync("node scripts/generate-preset-data.mjs", { stdio: "inherit" });
} catch (err) {
    console.error("Failed to generate preset data:", err);
}

/**
 * Bundelt src/app/main.ts nach main.js im Plugin-Stamm.
 * Externe Module (von Obsidian/Electron bereitgestellt) werden nicht gebundelt.
 */
await esbuild.build({
    entryPoints: ["src/app/main.ts"],   // Plugin-Einstieg
    bundle: true,
    outfile: "main.js",                 // Gebündeltes Ziel direkt im Plugin-Ordner
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
