import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REPOSITORY = "ThonkTank/Salt-Marcher";
export const BRANCH = "work/atlas-p0-feasibility";
export const CHANNEL = "atlas-preview";
export const MANIFEST = "atlas-preview.json";
const DOWNLOAD = `https://github.com/${REPOSITORY}/releases/download/${CHANNEL}/`;
const PACKAGE = "saltmarcher-atlas-p0";
const SHA = /^[a-f0-9]{40}$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const REVISION = /^[1-9][0-9]*\.[1-9][0-9]*$/;

export function previewMetadata(version, revision) {
  if (revision === undefined) return undefined;
  assert.ok(
    typeof version === "string" && version.length < 50 && VERSION.test(version),
    "Invalid preview package version",
  );
  assert.ok(
    typeof revision === "string" &&
      revision.length < 50 &&
      REVISION.test(revision),
    "ATLAS_PREVIEW_BUILD must be the workflow run ID and attempt",
  );
  return { channel: CHANNEL, version, revision };
}

function compareNumericParts(left, right) {
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function assertBuildIdentity(build, commit, revision, version) {
  assert.ok(SHA.test(commit ?? ""), "Expected a full candidate SHA");
  assert.equal(build?.commit, commit, "Build belongs to another commit");
  assert.equal(build.dirty, false, "A dirty build cannot be released");
  assert.deepEqual(
    build.preview,
    previewMetadata(version, revision),
    "Build belongs to another preview revision",
  );
  assert.ok(build.preview, "A release must be built for the preview channel");
  assert.equal(
    build.sourceKind,
    "product-inputs-v1",
    "Missing product source identity",
  );
  assert.match(
    build.sourceSha256 ?? "",
    /^[a-f0-9]{64}$/,
    "Missing product source hash",
  );
}

export function assetName(kind, version, revision) {
  return `${PACKAGE}-${version}-${revision}.${kind === "rpm" ? "x86_64.rpm" : "linux-x64.zip"}`;
}

export function assertManifest(manifest) {
  assert.equal(manifest?.schema, 1, "Unsupported preview manifest");
  assert.equal(manifest.channel, CHANNEL, "Wrong preview channel");
  assert.ok(
    previewMetadata(manifest.version, manifest.revision),
    "Missing preview revision",
  );
  assert.ok(SHA.test(manifest.commit ?? ""), "Missing release commit");
  assert.ok(
    typeof manifest.publishedAt === "string" &&
      Number.isFinite(Date.parse(manifest.publishedAt)),
    "Missing release date",
  );
  for (const kind of ["rpm", "zip"]) {
    const asset = manifest[kind];
    const name = assetName(kind, manifest.version, manifest.revision);
    assert.equal(asset?.name, name, `Unexpected ${kind} filename`);
    assert.equal(asset.url, `${DOWNLOAD}${name}`, `Unexpected ${kind} URL`);
    assert.match(
      asset.sha256 ?? "",
      /^[a-f0-9]{64}$/,
      `Missing ${kind} digest`,
    );
    assert.ok(
      Number.isSafeInteger(asset.size) &&
        asset.size > 0 &&
        asset.size <= 512 * 1024 ** 2,
      `Invalid ${kind} size`,
    );
  }
  return manifest;
}

/** A stale, mismatched or older candidate must never advance the shared feed. */
export function assertPromotion(manifest, head, previous = null) {
  assertManifest(manifest);
  assert.equal(
    head,
    manifest.commit,
    "Candidate is no longer the current preview branch head",
  );
  if (!previous) return true;
  assertManifest(previous);
  assert.ok(
    compareNumericParts(manifest.version, previous.version) >= 0,
    "Preview package version would downgrade",
  );
  const order = compareNumericParts(manifest.revision, previous.revision);
  assert.ok(order >= 0, "Preview revision would downgrade");
  if (order === 0) {
    assert.deepEqual(
      manifest,
      previous,
      "An existing preview revision cannot be replaced by different content",
    );
    return false;
  }
  return true;
}

async function digestFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function asset(path, kind, version, revision) {
  const name = assetName(kind, version, revision);
  return {
    name,
    url: `${DOWNLOAD}${name}`,
    sha256: await digestFile(path),
    size: (await stat(path)).size,
  };
}

export async function assertArtifactFiles(directory, manifest) {
  assertManifest(manifest);
  for (const kind of ["rpm", "zip"]) {
    const item = manifest[kind];
    const path = join(directory, item.name);
    assert.equal(
      (await stat(path)).size,
      item.size,
      `${kind} artifact size changed`,
    );
    assert.equal(
      await digestFile(path),
      item.sha256,
      `${kind} artifact digest changed`,
    );
  }
}

async function filesBelow(directory, extension) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(path, extension)));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(path);
  }
  return files;
}

function command(file, args, { allowNotFound = false } = {}) {
  const result = spawnSync(file, args, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 ** 2,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (
      allowNotFound &&
      result.status === 1 &&
      /\(HTTP 404\)/.test(result.stderr)
    )
      return null;
    throw new Error(
      `${file} ${args[0]} failed: ${result.stderr.trim() || result.status}`,
    );
  }
  return result.stdout.trim();
}

async function prepare(directory) {
  const version = JSON.parse(await readFile("package.json", "utf8")).version;
  const revision = process.env.ATLAS_PREVIEW_BUILD;
  const build = JSON.parse(await readFile("desktop-dist/build.json", "utf8"));
  assertBuildIdentity(build, process.env.GITHUB_SHA, revision, version);
  assert.equal(
    command("git", ["rev-parse", "HEAD"]),
    build.commit,
    "Checkout changed after building",
  );
  assert.equal(
    command("git", ["status", "--porcelain", "--untracked-files=normal"]),
    "",
    "Checkout changed after building",
  );
  const { extractFile } = await import("@electron/asar");
  const packaged = JSON.parse(
    extractFile(
      resolve("out/Atlas P0-linux-x64/resources/app.asar"),
      "desktop-dist/build.json",
    ).toString("utf8"),
  );
  assert.deepEqual(
    packaged,
    build,
    "The packaged app is not the checked preview build",
  );
  const rpms = await filesBelow("out/make/rpm", ".rpm");
  const zips = await filesBelow("out/make/zip", ".zip");
  assert.equal(rpms.length, 1, "Expected exactly one freshly built RPM");
  assert.equal(zips.length, 1, "Expected exactly one freshly built ZIP");
  const identity = command("rpm", [
    "-qp",
    "--queryformat",
    "%{NAME}\n%{VERSION}\n%{RELEASE}\n%{ARCH}",
    rpms[0],
  ]);
  assert.equal(
    identity,
    `${PACKAGE}\n${version}\n${revision}\nx86_64`,
    "The RPM version/architecture does not match the update feed",
  );
  const manifest = assertManifest({
    schema: 1,
    channel: CHANNEL,
    version,
    revision,
    commit: build.commit,
    publishedAt: build.builtAt,
    rpm: await asset(rpms[0], "rpm", version, revision),
    zip: await asset(zips[0], "zip", version, revision),
  });
  await mkdir(directory, { recursive: true });
  await copyFile(rpms[0], join(directory, manifest.rpm.name));
  await copyFile(zips[0], join(directory, manifest.zip.name));
  await writeFile(
    join(directory, MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    `Prepared ${CHANNEL} ${version}-${revision} from ${build.commit}`,
  );
}

async function publish(directory) {
  const manifest = assertManifest(
    JSON.parse(await readFile(join(directory, MANIFEST), "utf8")),
  );
  assert.equal(
    manifest.commit,
    process.env.GITHUB_SHA,
    "Publication job belongs to another commit",
  );
  assert.equal(
    manifest.revision,
    process.env.ATLAS_PREVIEW_BUILD,
    "Publication job belongs to another run",
  );
  assert.equal(
    process.env.GITHUB_REPOSITORY,
    REPOSITORY,
    "The preview channel belongs to another repository",
  );
  assert.equal(
    process.env.GITHUB_REF,
    `refs/heads/${BRANCH}`,
    "Only the explicit preview branch may publish",
  );
  await assertArtifactFiles(directory, manifest);
  const gh = (args, options) => command("gh", args, options);
  const api = (path, options) => {
    const response = gh(["api", `repos/${REPOSITORY}/${path}`], options);
    return response === null ? null : JSON.parse(response);
  };
  const currentHead = () => api(`git/ref/heads/${BRANCH}`).object.sha;
  const release = api(`releases/tags/${CHANNEL}`, { allowNotFound: true });
  if (release) {
    assert.equal(release.tag_name, CHANNEL);
    assert.ok(
      release.prerelease || release.draft,
      "Refusing to change a stable release into the preview channel",
    );
  }
  const existing = release?.assets.some((item) => item.name === MANIFEST);
  assert.ok(
    !release || release.draft || existing,
    "Published preview has no valid manifest; refusing an unverified replacement",
  );
  const previous = existing
    ? assertManifest(
        JSON.parse(
          gh([
            "release",
            "download",
            CHANNEL,
            "--repo",
            REPOSITORY,
            "--pattern",
            MANIFEST,
            "--output",
            "-",
          ]),
        ),
      )
    : null;
  if (!assertPromotion(manifest, currentHead(), previous) && !release?.draft) {
    console.log("This exact preview is already published.");
    return;
  }
  const notesPath = join(directory, "release-notes.md");
  await writeFile(
    notesPath,
    [
      "## Atlas-Vorschau für Draft-PR #1469",
      "",
      `Aktueller Teststand: **${manifest.version}-${manifest.revision}**, Commit [${manifest.commit.slice(0, 7)}](https://github.com/${REPOSITORY}/commit/${manifest.commit}).`,
      "",
      `**[Fedora-Installer herunterladen (.rpm)](${manifest.rpm.url})** · [Portable Linux-Ausgabe (.zip)](${manifest.zip.url})`,
      "",
      "**Fedora/Linux x86_64:** Über den Installer-Link oben das aktuelle RPM herunterladen und installieren. Danach in der App nach Vorschau-Updates suchen. ZIP enthält denselben portablen Teststand; In-App-Installation benötigt die RPM-Installation.",
      "",
      "Dieses Prerelease wird nach erfolgreichen Paket- und Updateprüfungen des Vorschauzweigs erneuert. Die Binärdateien tragen eindeutige Buildnummern; der Updatekanal wird zuletzt umgestellt. Frühere Dateien bleiben für laufende Downloads erhalten.",
      "",
      "Geprüft: TypeScript, Update-/Release-Prüfungen, RPM-Metadaten, tatsächlicher ASAR-Inhalt und Start-/Dateirundlauf der gepackten Anwendung. Das ist keine vollständige native Leistungsabnahme; die offenen Höhen-/GPU-Befunde des Drafts bleiben bestehen. Das experimentelle Projektformat kann sich ändern; ältere Versuchsdateien werden gegebenenfalls abgewiesen.",
      "",
      `[Draft-PR #1469](https://github.com/${REPOSITORY}/pull/1469) · [Prüflauf](https://github.com/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`,
      "",
    ].join("\n"),
  );
  if (!release) {
    gh([
      "release",
      "create",
      CHANNEL,
      "--repo",
      REPOSITORY,
      "--target",
      manifest.commit,
      "--draft",
      "--prerelease",
      "--latest=false",
      "--title",
      "Atlas-Vorschau · Draft #1469",
      "--notes-file",
      notesPath,
    ]);
  }
  gh([
    "release",
    "upload",
    CHANNEL,
    join(directory, manifest.rpm.name),
    join(directory, manifest.zip.name),
    "--repo",
    REPOSITORY,
    "--clobber",
  ]);
  // Uploads may take minutes. Do not promote a build superseded meanwhile.
  assertPromotion(manifest, currentHead(), previous);
  const tag = api(`git/ref/tags/${CHANNEL}`, { allowNotFound: true });
  if (tag) {
    gh([
      "api",
      "--method",
      "PATCH",
      `repos/${REPOSITORY}/git/refs/tags/${CHANNEL}`,
      "-f",
      `sha=${manifest.commit}`,
      "-F",
      "force=true",
    ]);
  } else {
    gh([
      "api",
      "--method",
      "POST",
      `repos/${REPOSITORY}/git/refs`,
      "-f",
      `ref=refs/tags/${CHANNEL}`,
      "-f",
      `sha=${manifest.commit}`,
    ]);
  }
  gh([
    "release",
    "upload",
    CHANNEL,
    join(directory, MANIFEST),
    "--repo",
    REPOSITORY,
    "--clobber",
  ]);
  gh([
    "release",
    "edit",
    CHANNEL,
    "--repo",
    REPOSITORY,
    "--draft=false",
    "--prerelease",
    "--latest=false",
    "--title",
    "Atlas-Vorschau · Draft #1469",
    "--notes-file",
    notesPath,
  ]);
  const published = api(`releases/tags/${CHANNEL}`);
  assert.equal(published.draft, false);
  assert.equal(published.prerelease, true);
  assert.deepEqual(
    JSON.parse(
      gh([
        "release",
        "download",
        CHANNEL,
        "--repo",
        REPOSITORY,
        "--pattern",
        MANIFEST,
        "--output",
        "-",
      ]),
    ),
    manifest,
    "Published update feed differs from the tested artifact",
  );
  console.log(
    `Published https://github.com/${REPOSITORY}/releases/tag/${CHANNEL}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [operation, directory = "out/preview-release"] = process.argv.slice(2);
  if (operation === "prepare") await prepare(directory);
  else if (operation === "publish") await publish(directory);
  else
    throw new Error(
      `Usage: node ${basename(process.argv[1])} prepare|publish [directory]`,
    );
}
