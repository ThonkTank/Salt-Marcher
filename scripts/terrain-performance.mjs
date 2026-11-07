// One driver and identical fixtures compare isolated, immutable Release artifacts.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const [mode, argument] = process.argv.slice(2);
if (
  !["capture", "run"].includes(mode) ||
  (mode === "capture" && !argument) ||
  process.argv.length > 4
)
  throw Error(
    "Usage: node scripts/terrain-performance.mjs capture <directory> | run [baseline-directory]",
  );
const run = (command, args, env = {}) =>
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
const output = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const node = readFileSync(".node-version", "utf8").trim();
const rust = readFileSync("rust-toolchain.toml", "utf8").match(
  /channel = "([^"]+)"/,
)[1];
if (process.versions.node !== node)
  throw Error(`Reference runs require Node ${node}; found ${process.version}`);
if (!output("rustc", ["--version"]).startsWith(`rustc ${rust} `))
  throw Error(`Reference runs require Rust ${rust}`);
const binary = resolve("src-tauri/target/release/examples/atlas_test_server");
const web = resolve("src-tauri/target/cleanup/atlas-simplify/performance-web");
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    });
}
function capture(directory) {
  if (existsSync(directory)) throw Error(`Refusing to overwrite ${directory}`);
  run("npm", ["run", "perf:build"], { ATLAS_PERF_WEB: web });
  mkdirSync(directory, { recursive: true });
  cpSync(binary, join(directory, "worker"));
  cpSync(web, join(directory, "web"), { recursive: true });
  const source = [
    ...files("src"),
    ...files("src-tauri/src"),
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "package-lock.json",
  ];
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(
      {
        node,
        rust,
        head: output("git", ["rev-parse", "HEAD"]),
        source: Object.fromEntries(source.map((path) => [path, hash(path)])),
        worker: hash(join(directory, "worker")),
        web: Object.fromEntries(
          files(join(directory, "web")).map((path) => [
            path.slice(join(directory, "web").length + 1),
            hash(path),
          ]),
        ),
      },
      null,
      2,
    ),
  );
}
function verify(directory) {
  const manifest = JSON.parse(
    readFileSync(join(directory, "manifest.json"), "utf8"),
  );
  if (
    manifest.node !== node ||
    manifest.rust !== rust ||
    manifest.worker !== hash(join(directory, "worker"))
  )
    throw Error("Baseline version or worker fingerprint mismatch");
  for (const [path, expected] of Object.entries(manifest.web))
    if (hash(join(directory, "web", path)) !== expected)
      throw Error(`Baseline changed: ${path}`);
}
if (mode === "capture") {
  capture(resolve(argument));
} else {
  const directory = resolve(
    "src-tauri/target/cleanup/atlas-simplify",
    `terrain-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  const baseline = argument && resolve(argument);
  if (baseline) verify(baseline);
  const candidate = join(directory, "candidate-artifacts");
  capture(candidate);
  const fixtures = join(directory, "fixtures");
  run(
    "cargo",
    [
      "test",
      "--release",
      "--locked",
      "--target-dir",
      "src-tauri/target",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--lib",
      "terrain_performance_fixtures",
      "--",
      "--ignored",
      "--nocapture",
    ],
    { ATLAS_TERRAIN_FIXTURES: fixtures },
  );
  writeFileSync(
    join(directory, "driver.json"),
    JSON.stringify(
      {
        spec: hash("tests/performance/terrain.spec.ts"),
        recipe: hash("tests/performance/terrain-cases.ts"),
        fixtures: Object.fromEntries(
          files(fixtures).map((path) => [path, hash(path)]),
        ),
        note: "Sequential runs; OS cache and thermal state uncontrolled. Repeat in reverse order for reference acceptance.",
      },
      null,
      2,
    ),
  );
  const variants = baseline
    ? [
        ["baseline", baseline],
        ["candidate", candidate],
      ]
    : [["candidate", candidate]];
  const reports = {};
  for (const [name, artifacts] of variants) {
    const results = join(directory, name);
    run("npm", ["run", "perf:measure", "--", "terrain.spec.ts"], {
      ATLAS_PERF_BINARY: join(artifacts, "worker"),
      ATLAS_PERF_WEB: join(artifacts, "web"),
      ATLAS_PERF_OUTPUT: results,
      ATLAS_TERRAIN_FIXTURES: fixtures,
    });
    reports[name] = files(results)
      .filter((path) => path.endsWith("terrain-timing.json"))
      .map((path) => JSON.parse(readFileSync(path, "utf8")));
    if (reports[name].length !== 9)
      throw Error(`Expected all nine cases for ${name}`);
  }
  const comparison = reports.candidate.map((current) => {
    const prior = reports.baseline?.find(
      (value) => value.scenario.name === current.scenario.name,
    );
    if (
      prior &&
      (prior.fixtureSha256 !== current.fixtureSha256 ||
        JSON.stringify(prior.scenario) !== JSON.stringify(current.scenario) ||
        JSON.stringify(prior.environment) !==
          JSON.stringify(current.environment))
    )
      throw Error(`Incomparable case: ${current.scenario.name}`);
    return {
      name: current.scenario.name,
      baseline: prior?.summary,
      candidate: current.summary,
      delta:
        prior &&
        Object.fromEntries(
          Object.entries(current.summary)
            .filter(([, value]) => typeof value === "number")
            .map(([key, value]) => [
              key,
              typeof prior.summary[key] === "number"
                ? value - prior.summary[key]
                : null,
            ]),
        ),
    };
  });
  writeFileSync(
    join(directory, "comparison.json"),
    JSON.stringify(comparison, null, 2),
  );
  console.log(`Evidence: ${directory}`);
}
