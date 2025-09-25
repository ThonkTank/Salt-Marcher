// plugins/layout-editor/esbuild.config.mjs
import esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    outfile: "main.js",
    platform: "browser",
    format: "cjs",
    target: "es2020",
    sourcemap: false,
    external: [
        "obsidian",
        "electron",
        "codemirror",
        "@codemirror/state",
        "@codemirror/view",
    ],
    loader: {
        ".ts": "ts",
        ".tsx": "tsx",
        ".json": "json",
    },
    resolveExtensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
    tsconfig: "tsconfig.json",
    logLevel: "info",
});
