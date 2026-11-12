import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readlink, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { createPackageWithOptions, listPackage } from "@electron/asar";
import { assertNativePackageBindings } from "./atlas-p0-native-package.mjs";

const require = createRequire(import.meta.url);
// Resolve the installer's actual dependency, including a non-hoisted npm layout.
const rpmRequire = createRequire(require.resolve("@electron-forge/maker-rpm"));
const redhatRequire = createRequire(
  rpmRequire.resolve("electron-installer-redhat"),
);
const installerCommon = redhatRequire("electron-installer-common");
const config = require("../forge.atlas.config.cjs");
const maker = config.makers.find(
  (entry) => entry.name === "@electron-forge/maker-rpm",
);
const directory = resolve(
  "out",
  `${config.packagerConfig.name}-${process.platform}-${process.arch}`,
);

test("RPM installer finds the packaged executable when package.json names the shared app", async () => {
  const staging = await mkdtemp(join(tmpdir(), "atlas-p0-rpm-binary-"));
  try {
    // Exercise the real metadata, option merge and binary-symlink methods used
    // by the RPM installer. This narrow regression needs an existing package,
    // but neither substitutes for nor simulates rpmbuild.
    const metadata = await installerCommon.readMetadata({
      src: directory,
      logger() {},
    });
    const prepare = (options) => {
      const installer = new installerCommon.ElectronInstaller({
        ...maker.config,
        options,
        src: directory,
      });
      installer.defaults = installerCommon.getDefaultsFromPackageJSON(metadata);
      installer.generateOptions();
      installer.stagingDir = staging;
      return installer;
    };
    const { bin: _bin, ...withoutBinary } = maker.config.options;
    const original = prepare(withoutBinary);
    assert.equal(original.options.bin, metadata.name);
    await assert.rejects(original.createBinarySymlink(), (error) => {
      assert.ok(error.message.includes(join(directory, metadata.name)));
      assert.match(error.message, /could not find the Electron app binary/);
      return true;
    });

    const configured = prepare(maker.config.options);
    await configured.createBinarySymlink();
    assert.equal(
      await readlink(
        join(staging, configured.baseAppDir, "bin", configured.appIdentifier),
      ),
      join(
        "../lib",
        configured.appIdentifier,
        config.packagerConfig.executableName,
      ),
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
});

test("RPM content rejects foreign SQLite prebuilds and follows the explicit Forge target", async () => {
  const staging = await mkdtemp(join(tmpdir(), "atlas-p0-rpm-prebuilds-"));
  try {
    const application = join(staging, "app");
    const prebuilds = join(
      application,
      "node_modules/better-sqlite3/prebuilds",
    );
    await mkdir(prebuilds, { recursive: true });
    const sqlite = dirname(require.resolve("better-sqlite3/package.json"));
    for (const binary of [
      "linux-arm64.node",
      "linux-x64.node",
      "linuxmusl-arm64.node",
    ]) {
      await copyFile(
        join(sqlite, "prebuilds", binary),
        join(prebuilds, binary),
      );
    }
    const rejected = join(staging, "foreign.asar");
    await createPackageWithOptions(application, rejected, {
      unpack: "**/*.node",
    });
    assert.throws(
      () =>
        assertNativePackageBindings(listPackage(rejected), "linux", "arm64"),
      /only its target's native SQLite binding/,
    );

    // This deliberately selects arm64 even on the x64 CI host. No executable
    // is launched here; the check exercises the actual hook and ASAR contents.
    await config.hooks.packageAfterCopy(
      config,
      application,
      require("electron/package.json").version,
      "linux",
      "arm64",
    );
    const accepted = join(staging, "target.asar");
    await createPackageWithOptions(application, accepted, {
      unpack: "**/*.node",
    });
    assertNativePackageBindings(listPackage(accepted), "linux", "arm64");
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
});
