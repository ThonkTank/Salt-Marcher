import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, linkSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const source = resolve("tools/adr-prototypes/p01/native-helper.c");
const buildRoot = mkdtempSync(join(tmpdir(), "p01-native-build-"));
const helper = join(buildRoot, "native-helper");
const compiled = spawnSync("gcc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", source, "-o", helper],
  { encoding: "utf8" });
assert.equal(compiled.status, 0, compiled.stderr);

function hex(value) {
  return Buffer.from(value).toString("hex");
}

function run(root, commands) {
  return spawnSync(helper, [root, "test-process-token-1234567890"], {
    input: commands.join("\n") + "\nQUIT\n", encoding: "utf8",
  });
}

test.after(() => rmSync(buildRoot, { recursive: true, force: true }));

test("native helper performs root-fd create, update, delete and exact reads", () => {
  const root = mkdtempSync(join(tmpdir(), "p01-native-cas-"));
  try {
    const result = run(root, [
      `READ ${hex("map.dungeon")}`,
      `CAS ${hex("map.dungeon")} - ${hex("old")}`,
      `CAS ${hex("map.dungeon")} ${hex("old")} ${hex("new")}`,
      `READ ${hex("map.dungeon")}`,
      `CAS ${hex("map.dungeon")} ${hex("new")} -`,
      `READ ${hex("map.dungeon")}`,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /OK READ -[\s\S]*OK CAS[\s\S]*OK CAS[\s\S]*OK READ 6e6577[\s\S]*OK CAS[\s\S]*OK READ -/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("native helper rejects traversal, symlinks, hardlinks and stale compare values", () => {
  const root = mkdtempSync(join(tmpdir(), "p01-native-denied-"));
  try {
    writeFileSync(join(root, "real"), "old");
    symlinkSync("real", join(root, "link"));
    linkSync(join(root, "real"), join(root, "hard"));
    const result = run(root, [
      `READ ${hex("../escape")}`,
      `READ ${hex("link")}`,
      `READ ${hex("hard")}`,
      `CAS ${hex("real")} ${hex("wrong")} ${hex("new")}`,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/ERR /g) ?? []).length, 4);
    assert.equal(readFileSync(join(root, "real"), "utf8"), "old");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("native helper fault checkpoints leave a complete old or new target", () => {
  for (const [phase, expected] of [["after-temp-sync", "old"], ["after-publish", "new"]]) {
    const root = mkdtempSync(join(tmpdir(), `p01-native-${phase}-`));
    try {
      writeFileSync(join(root, "map.dungeon"), "old");
      const result = spawnSync(helper, [root, "test-process-token-1234567890"], { input:
        `FAULT ${phase}\nCAS ${hex("map.dungeon")} ${hex("old")} ${hex("new")}\n`, encoding: "utf8" });
      assert.equal(result.status, 90);
      assert.match(result.stdout, new RegExp(`CHECKPOINT ${phase}`));
      assert.equal(readFileSync(join(root, "map.dungeon"), "utf8"), expected);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
