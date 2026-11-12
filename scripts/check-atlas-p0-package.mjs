import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listPackage, extractFile } from "@electron/asar";
import { assertNativePackageBindings } from "./atlas-p0-native-package.mjs";

const require = createRequire(import.meta.url);
const config = require("../forge.atlas.config.cjs");
const directory = resolve(
  "out",
  `${config.packagerConfig.name}-${process.platform}-${process.arch}`,
);
const executable = join(directory, config.packagerConfig.executableName);
const asar = join(directory, "resources/app.asar");
const out = resolve("artifacts/atlas-rebuild/ci-package");
await mkdir(out, { recursive: true });

// Inspect the actual archive, not only the packaging configuration. Native .node
// entries may live next to the ASAR but remain listed in its directory index.
const files = listPackage(asar);
const rejected = files.filter((file) => config.packagerConfig.ignore(file));
const required = [
  "/package.json",
  "/desktop-dist/main.cjs",
  "/desktop-dist/preload.cjs",
  "/desktop-dist/store-process.cjs",
  "/desktop-dist/build.json",
  "/dist-editor/index.html",
  "/node_modules/better-sqlite3/package.json",
];
const missing = required.filter((file) => !files.includes(file));
const sqliteBinary = files.some((file) =>
  /\/better-sqlite3\/.*\.node$/.test(file),
);
const nativeBindings = files.filter((file) => file.endsWith(".node"));
const packagedBuild = JSON.parse(
  extractFile(asar, "desktop-dist/build.json").toString("utf8"),
);
const workspaceBuild = JSON.parse(
  await readFile("desktop-dist/build.json", "utf8"),
);
const tracked = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", "HEAD", "legacy"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
const leakedArchive = tracked.filter(
  (file) => !config.packagerConfig.ignore(`/${file}`),
);
const evidence = {
  executable,
  archive: asar,
  build: packagedBuild,
  entries: files.length,
  rejected,
  missing,
  sqliteBinary,
  nativeBindings,
  legacyFilesChecked: tracked.length,
  leakedArchive,
  files,
};
await writeFile(
  join(out, "package-content.json"),
  JSON.stringify(evidence, null, 2),
);
assert.deepEqual(
  rejected,
  [],
  "Package contains files outside its runtime boundary",
);
assert.deepEqual(missing, [], "Package is missing a runtime entrypoint");
assert.equal(sqliteBinary, true, "Package is missing its native SQLite binary");
// This command starts the packaged executable on the current machine, so its
// asserted target is the same platform/architecture used to select directory.
assertNativePackageBindings(files, process.platform, process.arch);
assert.deepEqual(
  leakedArchive,
  [],
  "The full checkout would leak archived files",
);
assert.equal(
  packagedBuild.sourceSha256,
  workspaceBuild.sourceSha256,
  "Packaged source differs from the checked build",
);
assert.equal(
  packagedBuild.lockSha256,
  workspaceBuild.lockSha256,
  "Packaged dependencies differ from the checked build",
);

const result = spawnSync(
  process.execPath,
  [
    "scripts/atlas-p0-smoke.mjs",
    "--executable",
    executable,
    "--only",
    "normal",
    "--out",
    join(out, "smoke"),
  ],
  { stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

// The shell must also work in the actual package. Keep the existing product
// smoke intact and require both checks before publishing a preview.
if (process.exitCode === 0) {
  const ui = spawnSync(
    process.execPath,
    [
      "scripts/atlas-editor-ui-smoke.mjs",
      "--executable",
      executable,
      "--out",
      join(out, "ui"),
    ],
    { stdio: "inherit", env: process.env },
  );
  if (ui.error) throw ui.error;
  process.exitCode = ui.status ?? 1;
}
