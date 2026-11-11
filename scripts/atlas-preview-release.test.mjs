import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  CHANNEL,
  REPOSITORY,
  assetName,
  assertArtifactFiles,
  assertBuildIdentity,
  assertManifest,
  assertPromotion,
  previewMetadata,
} from "./atlas-preview-release.mjs";

const commit = "a".repeat(40);
const version = "0.3.1";
const revision = "42940000000.1";
const bytes = Buffer.from("A verified package fixture");
const hash = createHash("sha256").update(bytes).digest("hex");
function manifest(overrides = {}) {
  const value = {
    schema: 1,
    channel: CHANNEL,
    version,
    revision,
    commit,
    publishedAt: "2026-11-11T12:00:00.000Z",
    ...overrides,
  };
  for (const kind of ["rpm", "zip"]) {
    const name = assetName(kind, value.version, value.revision);
    value[kind] = {
      name,
      url: `https://github.com/${REPOSITORY}/releases/download/${CHANNEL}/${name}`,
      sha256: hash,
      size: bytes.length,
    };
  }
  return value;
}
const build = {
  commit,
  dirty: false,
  sourceKind: "product-inputs-v1",
  sourceSha256: "b".repeat(64),
  preview: previewMetadata(version, revision),
};

test("normal local builds remain unversioned; CI preview identity requires run and attempt", () => {
  assert.equal(previewMetadata(version, undefined), undefined);
  assert.deepEqual(previewMetadata(version, revision), {
    channel: CHANNEL,
    version,
    revision,
  });
  for (const invalid of [
    "",
    "1",
    "1.0",
    "0.1",
    "-1.1",
    "1.1;echo injected",
    "01.1",
  ])
    assert.throws(() => previewMetadata(version, invalid));
});

test("release identity rejects dirty, missing, different-commit and different-run builds", () => {
  assertBuildIdentity(build, commit, revision, version);
  for (const broken of [
    { ...build, dirty: true },
    { ...build, commit: "c".repeat(40) },
    { ...build, preview: undefined },
    { ...build, preview: previewMetadata(version, "42940000000.2") },
    { ...build, sourceSha256: "" },
  ])
    assert.throws(() => assertBuildIdentity(broken, commit, revision, version));
});

test("manifest pins the repository, channel, architecture, filenames and bounded digests", () => {
  assertManifest(manifest());
  for (const change of [
    (m) => {
      m.channel = "stable";
    },
    (m) => {
      delete m.revision;
    },
    (m) => {
      m.rpm.url = "https://example.com/update.rpm";
    },
    (m) => {
      m.rpm.name = "../update.rpm";
    },
    (m) => {
      m.zip.sha256 = "";
    },
    (m) => {
      m.rpm.size = 0;
    },
    (m) => {
      m.rpm.size = 1024 ** 3 + 1;
    },
    (m) => {
      m.commit = "main";
    },
  ]) {
    const invalid = manifest();
    change(invalid);
    assert.throws(() => assertManifest(invalid));
  }
});

test("central promotion gate rejects stale branch heads and numeric downgrades", () => {
  const current = manifest();
  assert.equal(assertPromotion(current, commit), true);
  assert.equal(assertPromotion(current, commit, current), false);
  assert.equal(
    assertPromotion(
      manifest({ revision: "42940000000.10" }),
      commit,
      manifest({ revision: "42940000000.9" }),
    ),
    true,
  );
  assert.throws(() => assertPromotion(current, "c".repeat(40)), /no longer/);
  assert.throws(
    () =>
      assertPromotion(current, commit, manifest({ revision: "42940000000.2" })),
    /downgrade/,
  );
  assert.throws(
    () =>
      assertPromotion(
        current,
        commit,
        manifest({ revision: "42939999999.1", version: "0.4.0" }),
      ),
    /downgrade/,
  );
  assert.throws(
    () =>
      assertPromotion(
        manifest({ commit: "d".repeat(40) }),
        "d".repeat(40),
        current,
      ),
    /different content/,
  );
});

test("publisher rejects changed asset bytes even when their size is unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-preview-assets-"));
  const value = manifest();
  try {
    for (const kind of ["rpm", "zip"])
      await writeFile(join(directory, value[kind].name), bytes);
    await assertArtifactFiles(directory, value);
    const broken = Buffer.from(bytes);
    broken[0] ^= 1;
    await writeFile(join(directory, value.rpm.name), broken);
    await assert.rejects(
      assertArtifactFiles(directory, value),
      /digest changed/,
    );
    await writeFile(join(directory, value.rpm.name), bytes);
    await assertArtifactFiles(directory, value);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("actual prepare command fails closed before producing a feed for a dirty build", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-preview-negative-"));
  const script = resolve("scripts/atlas-preview-release.mjs");
  try {
    await mkdir(join(directory, "desktop-dist"));
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ version }),
    );
    await writeFile(
      join(directory, "desktop-dist/build.json"),
      JSON.stringify({ ...build, dirty: true }),
    );
    const result = spawnSync(process.execPath, [script, "prepare"], {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_SHA: commit,
        ATLAS_PREVIEW_BUILD: revision,
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dirty build cannot be released/);
    await assert.rejects(
      readFile(join(directory, "out/preview-release/atlas-preview.json")),
      { code: "ENOENT" },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
