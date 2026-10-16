// Rebuild the diagnostic against an explicit source tree; fixtures/H01 evidence remain read-only.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const sourceRoot = resolve(process.argv[2] ?? root);
const output = resolve(process.argv[3] ?? "D01-result.json");
const dataRoot = resolve(process.argv[4] ?? root);
mkdirSync(dirname(output), { recursive: true });
const bundle = output + ".cjs";
const contents = readFileSync(resolve(here, "probe.ts"), "utf8")
  .replaceAll("../../../src/", sourceRoot + "/src/");
await build({ stdin: { contents, loader: "ts", resolveDir: sourceRoot, sourcefile: sourceRoot + "/D01-probe.ts" },
  bundle: true, platform: "node", format: "cjs", target: "node22", outfile: bundle });
const result = execFileSync(process.execPath, [bundle, dataRoot], { encoding: "utf8" });
JSON.parse(result); writeFileSync(output, result); console.log(JSON.parse(result).state);
