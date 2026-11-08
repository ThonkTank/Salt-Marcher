import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const run = (command, args, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, ["scripts/build-atlas-p0.mjs"]);
run(
  require("electron"),
  [
    "--test",
    "desktop/project-store.test.mjs",
    "scripts/atlas-p0-scaling.test.mjs",
  ],
  {
    ELECTRON_RUN_AS_NODE: "1",
  },
);
