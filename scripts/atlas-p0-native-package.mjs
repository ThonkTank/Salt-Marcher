import assert from "node:assert/strict";

export function assertNativePackageBindings(files, platform, arch) {
  // Check the actual ASAR directory independently of Forge's filtering hook.
  // P0 ships better-sqlite3's target prebuild; unexpected build/test extensions
  // and binaries for other platforms must not silently enter the installer.
  const nativeBindings = files.filter((file) => file.endsWith(".node"));
  assert.deepEqual(
    nativeBindings,
    [`/node_modules/better-sqlite3/prebuilds/${platform}-${arch}.node`],
    "Package must contain only its target's native SQLite binding",
  );
  return nativeBindings;
}
