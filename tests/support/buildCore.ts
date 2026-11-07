import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { coreTarget } from "./corePaths";

/** Shared by Vitest's transport contract and Playwright's global setup. */
export default function buildCore() {
  execFileSync(
    "cargo",
    [
      "build",
      "--locked",
      "--target-dir",
      coreTarget,
      "--manifest-path",
      fileURLToPath(new URL("../../src-tauri/Cargo.toml", import.meta.url)),
      "--example",
      "atlas_test_server",
    ],
    { stdio: "inherit" },
  );
}
