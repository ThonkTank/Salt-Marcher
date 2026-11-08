import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rebuild } from "@electron/rebuild";

const root = new URL("../", import.meta.url);
process.chdir(fileURLToPath(root));
const require = createRequire(import.meta.url);
const electronPath = require("electron");
const probeSqlite = () =>
  spawnSync(
    electronPath,
    [
      "-e",
      "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('SELECT 1').get(); db.close();",
    ],
    {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
let sqliteProbe = probeSqlite();
if (sqliteProbe.error || sqliteProbe.status !== 0) {
  console.log("[atlas-p0] Preparing SQLite for the pinned Electron ABI");
  await rebuild({
    buildPath: process.cwd(),
    electronVersion: require("electron/package.json").version,
    onlyModules: ["better-sqlite3"],
    force: true,
  });
  sqliteProbe = probeSqlite();
  if (sqliteProbe.error || sqliteProbe.status !== 0)
    throw new Error(
      `SQLite cannot run in Electron: ${sqliteProbe.error ?? sqliteProbe.stderr}`,
    );
}
const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, [
  "node_modules/typescript/bin/tsc",
  "-p",
  "tsconfig.editor.json",
]);
run(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "build",
  "--config",
  "vite.editor.config.ts",
]);
await build({
  entryPoints: {
    main: "desktop/main.ts",
    preload: "desktop/preload.ts",
    "store-process": "desktop/store-process.ts",
    "project-store": "desktop/project-store.ts",
    model: "src/editor/model/index.ts",
  },
  outdir: "desktop-dist",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  target: "node24",
  format: "cjs",
  bundle: true,
  external: ["electron", "better-sqlite3"],
  sourcemap: true,
});
await mkdir("desktop-dist", { recursive: true });
const commit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const status = spawnSync(
  "git",
  ["status", "--porcelain", "--untracked-files=normal"],
  { encoding: "utf8" },
);
async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
const sources = [
  ...(await sourceFiles("src/editor")),
  ...(await sourceFiles("desktop")),
  ...(await readdir("scripts"))
    .filter((file) => /atlas-p0/.test(file))
    .map((file) => `scripts/${file}`),
  "vite.editor.config.ts",
  "tsconfig.editor.json",
  "forge.atlas.config.cjs",
  "package.json",
  "package-lock.json",
].sort();
const sourceHash = createHash("sha256");
for (const path of sources)
  sourceHash
    .update(path)
    .update("\0")
    .update(await readFile(path))
    .update("\0");
await writeFile(
  "desktop-dist/build.json",
  JSON.stringify(
    {
      commit: commit.stdout.trim(),
      dirty: Boolean(status.stdout),
      sourceSha256: sourceHash.digest("hex"),
      lockSha256: createHash("sha256")
        .update(readFileSync("package-lock.json"))
        .digest("hex"),
      builtAt: new Date().toISOString(),
      node: process.version,
    },
    null,
    2,
  ),
);
