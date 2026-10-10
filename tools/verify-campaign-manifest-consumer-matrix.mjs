import { build } from "esbuild";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
const contractPath = "tests/campaign-manifest-consumer-matrix.contract.json";
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const row of contract.frozenFiles) {
  if (sha(readFileSync(row.path)) !== row.sha256)
    throw Error(`Frozen consumer contract changed: ${row.path}`);
}
const args = process.argv.slice(2),
  outputIndex = args.indexOf("--output");
if (outputIndex < 0 || !args[outputIndex + 1])
  throw Error("Use --output /absolute/QA/report.json outside this checkout");
const output = resolve(args[outputIndex + 1]);
if (output.startsWith(process.cwd() + "/"))
  throw Error("Evidence must remain outside the checkout");
mkdirSync(dirname(output), { recursive: true });
const head = () =>
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const status = () =>
  execFileSync("git", ["status", "--porcelain=v1", "-z"], { encoding: "utf8" });
const startHead = head(),
  startStatus = status();
if (startStatus && !args.includes("--allow-dirty"))
  throw Error(
    "Candidate must be clean; --allow-dirty is diagnosis only, never REVIEW_READY",
  );
const temp = mkdtempSync(resolve(tmpdir(), "campaign-consumer-matrix-"));
let run;
try {
  await build({
    entryPoints: [contract.entry],
    outfile: resolve(temp, "matrix.cjs"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "es2022",
    logLevel: "silent",
  });
  run = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      "--test-reporter=tap",
      resolve(temp, "matrix.cjs"),
    ],
    { encoding: "utf8", timeout: 90000, maxBuffer: 4 * 1024 * 1024 },
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
const log = (run.stdout ?? "") + (run.stderr ?? "");
writeFileSync(output + ".log", log);
const rows = [...log.matchAll(/^(ok|not ok) \d+ - (M\d+[^\r\n]*)$/gm)].map(
  (m) => ({ id: m[2], passed: m[1] === "ok" }),
);
const finishHead = head(),
  finishStatus = status();
const sourceFiles = execFileSync(
  "git",
  ["ls-files", "-z", "src", "tests", "tools"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const sourceHashes = sourceFiles.map((path) => ({
  path,
  sha256: sha(readFileSync(path)),
}));
const report = {
  matrixId: contract.id,
  contractSha256: sha(readFileSync(contractPath)),
  candidateSha: startHead,
  finishedSha: finishHead,
  dirty: startStatus !== "" || finishStatus !== "",
  unchangedCheckout: startHead === finishHead && startStatus === finishStatus,
  exitCode: run.status,
  error: run.error?.message ?? null,
  cases: rows,
  expectedCaseCount: contract.caseCount,
  allGreen:
    run.status === 0 &&
    rows.length === contract.caseCount &&
    rows.every((r) => r.passed),
  sourceHashes,
  fixtureVersion: contract.fixtureVersion,
  limits: contract.limits,
};
report.reviewReady =
  report.allGreen && !report.dirty && report.unchangedCheckout;
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(log);
process.stdout.write(
  JSON.stringify({
    candidateSha: report.candidateSha,
    allGreen: report.allGreen,
    reviewReady: report.reviewReady,
    report: output,
  }) + "\n",
);
process.exitCode = report.allGreen ? 0 : 1;
