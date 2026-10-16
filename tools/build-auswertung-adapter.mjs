#!/usr/bin/env node
// Build the report adapter from a disposable copy. The installed plugin is read-only input.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const vault = option("--vault");
const source = option("--source");
const output = option("--out");
if (!vault || !source || !output)
  throw new Error("Benutzung: --vault <Vault> --source <Auswertungs-Plugin> --out <Datei außerhalb des Vaults>");

const vaultRoot = fs.realpathSync(vault);
const sourceRoot = fs.realpathSync(source);
const destination = path.resolve(output);
const outputParent = fs.realpathSync(path.dirname(destination));
if (destination === vaultRoot || outputParent === vaultRoot || outputParent.startsWith(vaultRoot + path.sep))
  throw new Error("Der Build darf nicht in den produktiven Vault schreiben.");
if (!fs.existsSync(path.join(sourceRoot, "build.js")))
  throw new Error("Build-Skript der Auswertung fehlt.");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "dungeon-auswertung-build-"));
try {
  const plugin = path.join(scratch, "plugin");
  fs.cpSync(sourceRoot, plugin, { recursive: true, dereference: true });
  fs.copyFileSync(new URL("./dungeon-auswertung/ui.js", import.meta.url), path.join(plugin, "ui.js"));
  const result = spawnSync(process.execPath, [path.join(plugin, "build.js"), destination], {
    cwd: plugin, encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Build der Auswertung fehlgeschlagen.");
  if (!fs.statSync(destination).size) throw new Error("Leerer Auswertungs-Build.");
  console.log(destination);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
