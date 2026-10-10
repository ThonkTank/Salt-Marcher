import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../src/features/live-session/", import.meta.url);

test("live-session core has no host, persistence or player-display surface", async () => {
  const files = (await readdir(ROOT)).filter((file) => file.endsWith(".ts"));
  assert.deepEqual(files.sort(), ["contracts.ts", "ids.ts", "index.ts", "projections.ts"]);
  const sources = await Promise.all(
    files.map(async (file) => [file, await readFile(new URL(file, ROOT), "utf8")]),
  );
  for (const [file, source] of sources) {
    assert.doesNotMatch(
      source,
      /from\s+["'](?:obsidian|electron|node:|.*(?:persistence|repository|main|ui))["']/,
      `${file} imports a forbidden host or persistence boundary`,
    );
    assert.doesNotMatch(
      source,
      /\b(?:PlayerProjection|PassiveDisplay|SecondWindow|MapRepository|VaultStore)\b/,
      `${file} exposes a forbidden consumer or host type`,
    );
  }
});
