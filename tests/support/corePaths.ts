import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const coreTarget = fileURLToPath(
  new URL("../../src-tauri/target/", import.meta.url),
);
export const coreBinary = join(
  coreTarget,
  "debug/examples",
  `atlas_test_server${process.platform === "win32" ? ".exe" : ""}`,
);
