// Generate or verify TypeScript transport contracts from the actual Rust DTOs.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { format, resolveConfig } from "prettier";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = join(root, "src/atlas/generated");
const mode = process.argv[2];
if (process.argv.length !== 3 || !["generate", "check"].includes(mode)) {
  console.error("Usage: node scripts/contracts.mjs <generate|check>");
  process.exit(1);
}

function files(directory, prefix = "", result = new Map()) {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) files(path, relative, result);
    else if (entry.isFile()) result.set(relative, readFileSync(path));
  }
  return result;
}

const temporaryRoot = join(root, "src-tauri/target/cleanup");
mkdirSync(temporaryRoot, { recursive: true });
const temporary = mkdtempSync(join(temporaryRoot, "contracts-"));
try {
  execFileSync(
    "cargo",
    [
      "test",
      "--locked",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--lib",
      "atlas::transport_contract_tests::export_transport_contracts",
      "--",
      "--ignored",
      "--exact",
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ATLAS_CONTRACT_OUT: temporary },
    },
  );
  // Cargo also succeeds when the filter matches zero tests.
  if (!existsSync(join(temporary, "Commands.ts"))) {
    throw Error("Rust exporter did not produce Commands.ts");
  }
  const config = await resolveConfig(destination);
  const expected = new Map();
  for (const [relative, content] of files(temporary)) {
    expected.set(
      relative,
      Buffer.from(
        await format(content.toString(), {
          ...config,
          filepath: join(destination, relative),
        }),
      ),
    );
  }
  const actual = files(destination);
  if (mode === "check") {
    const changes = [...new Set([...expected.keys(), ...actual.keys()])]
      .sort()
      .filter(
        (path) =>
          !expected.has(path) ||
          !actual.has(path) ||
          !expected.get(path).equals(actual.get(path)),
      )
      .map(
        (path) =>
          `${!actual.has(path) ? "missing" : !expected.has(path) ? "unexpected" : "changed"}: ${path}`,
      );
    if (changes.length) {
      console.error(
        `Transport contracts are stale:\n${changes.join("\n")}\nRun npm run contracts:generate and review the generated changes.`,
      );
      process.exitCode = 1;
    } else
      console.log(`Transport contracts match Rust (${expected.size} files).`);
  } else {
    for (const [relative, content] of expected) {
      const path = join(destination, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    // Only this dedicated generated directory may lose stale files.
    for (const relative of actual.keys()) {
      if (!expected.has(relative)) rmSync(join(destination, relative));
    }
    console.log(`Generated ${expected.size} transport contract files.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
