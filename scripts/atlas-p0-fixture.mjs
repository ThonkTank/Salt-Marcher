import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Launch with ELECTRON_RUN_AS_NODE=1 and the installed Electron executable, so
// better-sqlite3 uses the same native ABI as the real utility process.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const { ProjectStore } = require(join(root, "desktop-dist/project-store.cjs"));
const { createCoastFixture, prepareHeightSampler } = require(
  join(root, "desktop-dist/model.cjs"),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const points = [
  [-400, 0],
  [320, 0],
  [420, 0],
  [-800, 0],
];

async function inspect(file, origin = [0, 0]) {
  const work = join(dirname(file), "inspection-work");
  const store = new ProjectStore(work);
  try {
    const project = await store.openProject(file);
    const read = store.readRegion({
      sessionId: project.sessionId,
      bounds: [
        origin[0] - 2000,
        origin[1] - 1600,
        origin[0] + 2000,
        origin[1] + 1600,
      ],
    });
    const sample = prepareHeightSampler(read.tiles);
    const fine = read.tiles
      .filter((tile) => tile.level === 0)
      .sort((a, b) => a.key.localeCompare(b.key));
    const fineHash = createHash("sha256");
    for (const tile of fine) {
      fineHash.update(tile.key);
      fineHash.update(
        Buffer.from(
          tile.values.buffer,
          tile.values.byteOffset,
          tile.values.byteLength,
        ),
      );
    }
    return {
      file,
      sequence: project.sequence,
      sourceTiles: project.sourceTiles,
      localTiles: read.tiles.length,
      fineTiles: fine.length,
      fineSha256: fineHash.digest("hex"),
      points: points.map(([x, y]) => [origin[0] + x, origin[1] + y]),
      samples: points.map(([x, y]) => sample(origin[0] + x, origin[1] + y)),
      sha256: sha256(await readFile(file)),
    };
  } finally {
    store.close();
  }
}

const [command, argument, ...extra] = process.argv.slice(2);
if (command === "create" && argument) {
  const directory = resolve(argument);
  await mkdir(directory, { recursive: true });
  const origins = [
    [0, 0],
    [80_000, 0],
    [-90_000_000, 90_000_000],
    [90_000_000, -90_000_000],
  ];
  const files = {};
  for (const name of ["empty", "coast"]) {
    const store = new ProjectStore(join(directory, `work-${name}`));
    try {
      const project = store.status();
      if (name === "coast") {
        const tiles = origins.flatMap((origin) =>
          createCoastFixture({ origin }),
        );
        store.commit({
          sessionId: project.sessionId,
          sequence: 1,
          transactionId: randomUUID(),
          patches: tiles.map((after) => ({ key: after.key, after })),
        });
      }
      const status = store.status();
      const file = join(directory, `${name}.saltatlas`);
      await store.saveProject(
        { sessionId: status.sessionId, sequence: status.sequence },
        file,
      );
      files[name] = file;
    } finally {
      store.close();
    }
  }
  const report = {
    schemaVersion: 1,
    origins,
    files,
    coast: await inspect(files.coast),
    empty: await inspect(files.empty),
    expected: {
      points,
      before: [0, 6.31005859375, 41, -20],
      afterCoarseDab: [
        735125 / 9216,
        6.31005859375 + 99175 / 1152,
        41 + 184052525 / 2359296,
        -20 + 338225 / 9216,
      ],
      brush: { center: [0, 0], radius: 1280, level: 5, amount: 100 },
      derivation:
        "Coastal plane 20 + .05*x; independent positive-cubic interpolation of level-0 trench and quartic level-5 brush controls. No render sampler produced these expected values.",
    },
  };
  await writeFile(
    join(directory, "fixture.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} else if (command === "inspect" && argument) {
  const origin = extra.length === 2 ? extra.map(Number) : [0, 0];
  console.log(JSON.stringify(await inspect(resolve(argument), origin)));
} else {
  console.error(
    "Usage: Electron-as-Node atlas-p0-fixture.mjs create <directory> | inspect <file> [originX originY]",
  );
  process.exitCode = 2;
}
