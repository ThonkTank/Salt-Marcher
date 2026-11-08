// Renderer dependencies are bundled by Vite; the desktop bundle only externalizes
// Electron itself and SQLite. Keep one explicit package boundary, independent of
// whether the source checkout happens to be sparse or complete.
const { readdir, rm } = require("node:fs/promises");
const { join } = require("node:path");
const runtimeModules = new Set(["better-sqlite3", "node-addon-api"]);
const executableName = "saltmarcher-atlas-p0";
const desktopFiles = new Set([
  "main.cjs",
  "preload.cjs",
  "store-process.cjs",
  "build.json",
]);

module.exports = {
  packagerConfig: {
    name: "Atlas P0",
    executableName,
    asar: { unpack: "**/*.node" },
    // The allowlist below owns dependency selection. Packager's generic pruner
    // would otherwise retain all shared V7 production modules before ignore().
    prune: false,
    ignore(file) {
      const parts = file.replaceAll("\\", "/").replace(/^\/+/, "").split("/");
      if (!parts[0]) return false;
      if (parts[0] === "package.json" && parts.length === 1) return false;
      if (parts[0] === "desktop-dist")
        return (
          parts.length > 1 &&
          !(parts.length === 2 && desktopFiles.has(parts[1]))
        );
      if (parts[0] === "dist-editor") return file.endsWith(".map");
      if (parts[0] === "node_modules")
        return parts.length > 1 && !runtimeModules.has(parts[1]);
      return true;
    },
  },
  hooks: {
    async packageAfterCopy(
      _config,
      buildPath,
      _electronVersion,
      platform,
      arch,
    ) {
      const prebuilds = join(
        buildPath,
        "node_modules/better-sqlite3/prebuilds",
      );
      // Forge supplies the actual package target, including cross-packaging.
      // Official Electron Linux binaries use glibc; linuxmusl is not this RPM's
      // target. Keep the loader's target prebuild, not the build host's choice.
      const selected = `${platform}-${arch}.node`;
      for (const file of await readdir(prebuilds)) {
        if (file.endsWith(".node") && file !== selected)
          await rm(join(prebuilds, file));
      }
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          name: executableName,
          bin: executableName,
          productName: "Atlas P0",
          description: "Atlas terrain feasibility study",
          homepage: "https://github.com/ThonkTank/Salt-Marcher",
          license: "UNLICENSED",
        },
      },
    },
    { name: "@electron-forge/maker-zip", platforms: ["linux"] },
  ],
};
