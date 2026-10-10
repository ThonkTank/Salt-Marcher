import { readFile } from "node:fs/promises";
import { reconciliationFor } from "../contracts/p02-v1/contract.mjs";
import { createBackup, execute, guardedRetry, reconcile, snapshot } from "./store.mjs";

const [mode, root, input, faultPoint = ""] = process.argv.slice(2);
if (!mode || !root || !input) throw new Error("usage: worker.mjs execute|reconcile|snapshot|backup ROOT INPUT [FAULT]");

if (mode === "execute") {
  const request = JSON.parse(await readFile(input, "utf8"));
  process.stdout.write(`${JSON.stringify(await execute(root, request, faultPoint || null))}\n`);
} else if (mode === "reconcile") {
  const request = JSON.parse(await readFile(input, "utf8"));
  process.stdout.write(`${JSON.stringify(await reconcile(root, reconciliationFor(request)))}\n`);
} else if (mode === "guarded-retry") {
  const request = JSON.parse(await readFile(input, "utf8"));
  process.stdout.write(`${JSON.stringify(await guardedRetry(root, request))}\n`);
} else if (mode === "snapshot") {
  process.stdout.write(`${JSON.stringify(snapshot(root))}\n`);
} else if (mode === "backup") {
  process.stdout.write(`${JSON.stringify(await createBackup(root, input, faultPoint || null))}\n`);
} else throw new Error(`unsupported worker mode: ${mode}`);
