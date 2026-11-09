import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const self = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const [mode, argument] = process.argv.slice(2);
// Independent oracle for the documented display-only boundary policy. Exact
// source queries below retain their original 1e-7-foot comparison tolerance.
const DISPLAY_BOUNDARY_EPSILON_FT = 1e-6;

function dependencies() {
  if (!process.versions.electron)
    throw new Error("Fixture/reference reads require the pinned Electron ABI.");
  return {
    ...require(join(root, "desktop-dist/model.cjs")),
    ...require(join(root, "desktop-dist/project-store.cjs")),
  };
}

function sourceDigest(tiles) {
  const hash = createHash("sha256");
  for (const tile of [...tiles].sort((a, b) => a.key.localeCompare(b.key))) {
    hash.update(tile.key);
    hash.update(
      Buffer.from(
        tile.values.buffer,
        tile.values.byteOffset,
        tile.values.byteLength,
      ),
    );
  }
  return hash.digest("hex");
}

async function createFixtures(directory) {
  const { ProjectStore, heightTilesFromControls, heightSpacing, WORLD_LIMIT } =
    dependencies();
  await mkdir(directory, { recursive: true });
  const field = (level, bounds, value) => {
    const step = heightSpacing(level),
      controls = [];
    for (
      let y = Math.floor(bounds[1] / step) - 2;
      y <= Math.ceil(bounds[3] / step) + 2;
      y++
    )
      for (
        let x = Math.floor(bounds[0] / step) - 2;
        x <= Math.ceil(bounds[2] / step) + 2;
        x++
      )
        if (
          Math.abs(x * step) <= WORLD_LIMIT &&
          Math.abs(y * step) <= WORLD_LIMIT
        )
          controls.push([x, y, value(x * step, y * step)]);
    return heightTilesFromControls(level, controls);
  };
  const offsets = [
    0,
    -0.5 * DISPLAY_BOUNDARY_EPSILON_FT,
    0.5 * DISPLAY_BOUNDARY_EPSILON_FT,
    -0.9 * DISPLAY_BOUNDARY_EPSILON_FT,
    0.9 * DISPLAY_BOUNDARY_EPSILON_FT,
    -2 * DISPLAY_BOUNDARY_EPSILON_FT,
    2 * DISPLAY_BOUNDARY_EPSILON_FT,
    -1e-4,
    1e-4,
  ];
  const thresholds = [
    ...offsets,
    ...offsets.map((value) => 12 + value),
    200,
    600,
  ];
  const thresholdPoints = thresholds.map((_value, index) => [
    -1600 + (index % 5) * 800,
    -900 + Math.floor(index / 5) * 600,
  ]);
  const fixtures = [
    {
      id: "thresholds-negative-seams",
      center: [0, 0],
      points: [
        ...thresholdPoints,
        ...[-1284, -1280, -1276, -4, 0, 4].map((x) => [x, -900]),
      ],
      thresholdHeights: thresholds,
      tiles: field(2, [-2200, -1500, 2200, 1500], (x, y) => {
        const column = Math.max(0, Math.min(4, Math.floor((x + 2000) / 800)));
        const row = Math.max(0, Math.min(3, Math.floor((y + 1200) / 600)));
        return 100 + thresholds[row * 5 + column];
      }),
      regional: false,
      fallback: false,
    },
    {
      id: "all-22-levels",
      center: [0, 0],
      points: [
        [-320, 0],
        [0, 0],
        [320, 0],
      ],
      tiles: Array.from({ length: 22 }, (_, level) =>
        field(level, [-640, -320, 640, 320], () => 4 + level / 5),
      ).flat(),
      regional: true,
      fallback: false,
    },
    {
      id: "ordinary-22-level-cancellation",
      center: [0, 0],
      points: [
        [-320, 0],
        [0, 0],
        [320, 0],
      ],
      tiles: Array.from({ length: 22 }, (_, level) =>
        field(level, [-640, -320, 640, 320], () =>
          level === 0 ? 900100 : level % 2 ? -900000 : 900000,
        ),
      ).flat(),
      regional: true,
      fallback: false,
    },
    {
      id: "clipped-world-corner",
      center: [-WORLD_LIMIT + 640, WORLD_LIMIT - 640],
      points: [
        [-WORLD_LIMIT + 2, WORLD_LIMIT - 2],
        [-WORLD_LIMIT + 318, WORLD_LIMIT - 318],
        [-WORLD_LIMIT + 322, WORLD_LIMIT - 322],
        [-WORLD_LIMIT - 2, WORLD_LIMIT + 2],
      ],
      tiles: field(
        2,
        [-WORLD_LIMIT, WORLD_LIMIT - 1800, -WORLD_LIMIT + 1800, WORLD_LIMIT],
        () => 240,
      ),
      regional: false,
      fallback: false,
    },
    {
      id: "extreme-finite-cancellation",
      center: [0, 0],
      points: [
        [-258, 2],
        [-2, 2],
        [2, 2],
        [258, 2],
      ],
      tiles: [
        ...field(4, [-640, -640, 640, 640], () => 1e300),
        ...field(5, [-640, -640, 640, 640], () => -1e300),
      ],
      regional: false,
      fallback: true,
    },
  ];
  const manifest = [];
  for (const { tiles, ...fixture } of fixtures) {
    const store = new ProjectStore(join(directory, `work-${fixture.id}`));
    try {
      const initial = store.status();
      store.commit({
        sessionId: initial.sessionId,
        sequence: 1,
        transactionId: randomUUID(),
        patches: tiles.map((after) => ({ key: after.key, after })),
      });
      const status = store.status();
      const file = join(directory, `${fixture.id}.saltatlas`);
      await store.saveProject(
        { sessionId: status.sessionId, sequence: status.sequence },
        file,
      );
      manifest.push({
        ...fixture,
        file,
        sourceTiles: tiles.length,
        sourceBounds: [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT],
        sourceLevels: [...new Set(tiles.map((tile) => tile.level))],
        sourceSha256: sourceDigest(tiles),
        fileSha256: sha256(await readFile(file)),
      });
    } finally {
      store.close();
    }
  }
  return manifest;
}

function colour(height) {
  if (Math.abs(height) <= DISPLAY_BOUNDARY_EPSILON_FT) height = 0;
  else if (Math.abs(height - 12) <= DISPLAY_BOUNDARY_EPSILON_FT) height = 12;
  if (height < 0) {
    const depth = Math.min(1, -height / 300);
    return [
      Math.round(94 - 53 * depth),
      Math.round(147 - 57 * depth),
      Math.round(166 - 44 * depth),
      255,
    ];
  }
  if (height < 12) return [201, 192, 144, 255];
  const shade = Math.min(1, height / 600);
  return [
    Math.round(132 + 60 * shade),
    Math.round(151 + 34 * shade),
    Math.round(103 + 64 * shade),
    255,
  ];
}

/** Existing CPU reconstruction and real stored fine overviews form the reference. */
async function references(requestFile) {
  const { file, power, points, pixelWorlds } = JSON.parse(
    await readFile(requestFile, "utf8"),
  );
  const {
    ProjectStore,
    prepareHeightSampler,
    prepareHeightGrid,
    heightFromScaledSum,
    WORLD_LIMIT,
  } = dependencies();
  const store = new ProjectStore(join(dirname(requestFile), "reference-work"));
  try {
    const project = await store.openProject(file);
    const inside = ([x, y]) =>
      Math.abs(x) <= WORLD_LIMIT && Math.abs(y) <= WORLD_LIMIT;
    const region = (point) => [
      Math.max(-WORLD_LIMIT, point[0] - 1),
      Math.max(-WORLD_LIMIT, point[1] - 1),
      Math.min(WORLD_LIMIT, point[0] + 1),
      Math.min(WORLD_LIMIT, point[1] + 1),
    ];
    const numeric = points.map((point) => {
      if (!inside(point)) return null;
      const read = store.readRegion({
        sessionId: project.sessionId,
        minLevel: 0,
        bounds: region(point),
      });
      return prepareHeightSampler(read.tiles)(...point);
    });
    const pixelReferences = pixelWorlds.map((point) => {
      const spacing = 2 ** power;
      const grid = point.map((value) => Math.floor(value / spacing));
      const centre = grid.map((value) => (value + 0.5) * spacing);
      if (!inside(centre))
        return { centre, height: null, rgba: [41, 78, 99, 255], outside: true };
      const tile = grid.map((value) => Math.floor(value / 128));
      const pixel = grid.map((value, index) => value - tile[index] * 128);
      const span = spacing * 128;
      const bounds = [
        tile[0] * span,
        tile[1] * span,
        (tile[0] + 1) * span,
        (tile[1] + 1) * span,
      ];
      const read = store.readPresentation({
        sessionId: project.sessionId,
        power,
        bounds: region(centre),
      });
      const coarse = prepareHeightGrid(read.tiles)(bounds, 128, [
        pixel[0],
        pixel[1],
        pixel[0] + 1,
        pixel[1] + 1,
      ])[0];
      const overview = read.overviews.find(
        (value) =>
          value.key === `height-overview:${power}:${tile[0]}:${tile[1]}`,
      );
      const fine = overview?.values[pixel[1] * 128 + pixel[0]] ?? 0;
      const height = heightFromScaledSum(coarse + fine);
      return {
        centre,
        height,
        rgba: colour(height),
        fineOverview: Boolean(overview),
        sourceLevels: [...new Set(read.tiles.map((value) => value.level))],
      };
    });
    return { numeric, pixels: pixelReferences };
  } finally {
    store.close();
  }
}

function child(...args) {
  const result = spawnSync(require("electron"), [self, ...args], {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 2 * 1024 ** 2,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `GPU reference child failed: ${result.error ?? result.stderr ?? result.status}`,
    );
  return JSON.parse(result.stdout);
}

async function run(directory) {
  const { launchAtlasDesktop } = await import("./atlas-p0-desktop.mjs");
  const { button, exact, capture, navigateTo, stateSnapshot } =
    await import("./atlas-p0-interactions.mjs");
  async function sourceIdentity(session, fixture, sessionId) {
    const read = await session.page.evaluate(
      async ({ sessionId, bounds }) => {
        const result = await window.atlasDesktop.readRegion({
          sessionId,
          minLevel: 0,
          bounds,
        });
        return {
          sessionId: result.sessionId,
          sequence: result.sequence,
          tiles: result.tiles.map(({ key, values }) => ({
            key,
            values: Array.from(values),
          })),
        };
      },
      { sessionId, bounds: fixture.sourceBounds },
    );
    return {
      sessionId: read.sessionId,
      sequence: read.sequence,
      sourceTiles: read.tiles.length,
      sha256: sourceDigest(
        read.tiles.map(({ key, values }) => ({
          key,
          values: new Float64Array(values),
        })),
      ),
    };
  }
  await mkdir(directory, { recursive: true });
  const fixtures = child("--create", join(directory, "fixtures"));
  const report = {
    scope:
      "Actual editor GPU terrain pixels versus existing CPU field/overview reconstruction; no native presentation timing claim",
    build: JSON.parse(
      await readFile(join(root, "desktop-dist/build.json"), "utf8"),
    ),
    displayBoundaryEpsilonFt: DISPLAY_BOUNDARY_EPSILON_FT,
    fixtures,
    cases: [],
    passed: false,
  };
  for (const fixture of fixtures) {
    const sessionDirectory = join(directory, fixture.id);
    await mkdir(sessionDirectory, { recursive: true });
    const desktop = await launchAtlasDesktop({
      project: fixture.file,
      diagnostics: true,
      env: { ATLAS_P0_DIALOG_UNSAVED: "discard" },
    });
    const session = {
      ...desktop,
      directory: sessionDirectory,
      instance: { id: fixture.id },
    };
    const result = { id: fixture.id, views: [], passed: false };
    report.cases.push(result);
    try {
      await session.page.waitForFunction(
        () => typeof window.atlasObserve === "function",
      );
      await exact(session.page);
      await session.page.getByLabel("Raster anzeigen").uncheck();
      if (fixture.center.some((value) => value !== 0)) {
        await navigateTo(session.page, fixture.center);
        await exact(session.page);
      }
      const initial = await stateSnapshot(session.page);
      for (const view of fixture.regional
        ? ["Nahansicht", "Regionsansicht", "Nahansicht"]
        : ["Nahansicht"]) {
        await button(session.page, view);
        await exact(session.page);
        const state = await stateSnapshot(session.page, fixture.points);
        const image = await capture(
          session,
          `view-${result.views.length + 1}`,
          fixture.points,
        );
        const power = state.renderer.presentationPower;
        if (!Number.isInteger(power))
          throw new Error("Missing actual presentation power");
        const pixelWorlds = image.screenPoints.map(({ x, y }) => [
          state.camera.x +
            (x + 0.5 - image.size.width / 2) / state.camera.scale,
          state.camera.y +
            (y + 0.5 - image.size.height / 2) / state.camera.scale,
        ]);
        const requestFile = join(
          sessionDirectory,
          `reference-${result.views.length + 1}.json`,
        );
        await writeFile(
          requestFile,
          JSON.stringify({
            file: fixture.file,
            power,
            points: fixture.points,
            pixelWorlds,
          }),
        );
        const reference = child("--reference", requestFile);
        const pixelsPassed = image.pixels.every(
          (pixel, index) =>
            pixel &&
            pixel.every(
              (value, channel) =>
                Math.abs(value - reference.pixels[index].rgba[channel]) <= 1,
            ),
        );
        const authorsPassed = state.samples.every((value, index) =>
          value === null
            ? view === "Regionsansicht" || reference.numeric[index] === null
            : Number.isFinite(value) &&
              Math.abs(value - reference.numeric[index]) <= 1e-7,
        );
        const fallbackPassed = fixture.fallback
          ? state.renderer.fallbackTiles > 0 &&
            state.renderer.fallbackSamples > 0
          : state.renderer.fallbackTiles === 0;
        const overviewPassed =
          view !== "Regionsansicht" ||
          reference.pixels.some((value) => value.fineOverview);
        result.views.push({
          view,
          power,
          camera: state.camera,
          image,
          reference,
          actualHeights: state.samples,
          renderer: state.renderer,
          passed:
            pixelsPassed &&
            authorsPassed &&
            fallbackPassed &&
            overviewPassed &&
            state.document.revision === initial.document.revision &&
            state.document.sequence === initial.document.sequence,
          pixelsPassed,
          authorsPassed,
          fallbackPassed,
          overviewPassed,
        });
      }
      if (fixture.id === "thresholds-negative-seams") {
        const before = await stateSnapshot(session.page, fixture.points);
        const previous = result.views.at(-1);
        const sourcesBefore = await sourceIdentity(
          session,
          fixture,
          before.sessionId,
        );
        const context = await session.page.evaluateHandle(() => {
          const gl = document.querySelector("canvas")?.getContext("webgl2");
          const extension = gl?.getExtension("WEBGL_lose_context");
          if (!gl || !extension)
            throw new Error(
              "Required WEBGL_lose_context extension unavailable",
            );
          return { gl, extension };
        });
        try {
          await context.evaluate(({ extension }) => extension.loseContext());
          await session.page.waitForFunction(
            () =>
              window.atlasObserve([], { events: false }).renderer
                .contextLost === true,
          );
          const lost = await stateSnapshot(session.page, fixture.points);
          const lostPassed =
            (await context.evaluate(({ gl }) => gl.isContextLost())) &&
            before.renderer.contextLost === false &&
            before.readiness.ready === true &&
            lost.renderer.contextLost === true &&
            lost.renderer.submittedRevision === -1 &&
            lost.renderer.submittedViewGeneration === -1 &&
            lost.renderer.lastSubmittedFrame === 0 &&
            lost.readiness.ready === false &&
            lost.readiness.reason === "terrain" &&
            lost.readiness.sourcesReady === true;
          await context.evaluate(({ extension }) => extension.restoreContext());
          await session.page.waitForFunction(
            () =>
              window.atlasObserve([], { events: false }).renderer
                .contextLost === false,
          );
          await exact(session.page);
          const restored = await stateSnapshot(session.page, fixture.points);
          const image = await capture(
            session,
            "context-restored",
            fixture.points,
          );
          const sourcesAfter = await sourceIdentity(
            session,
            fixture,
            restored.sessionId,
          );
          const pixelsIdentical =
            JSON.stringify(image.pixels) ===
            JSON.stringify(previous.image.pixels);
          const imageIdentical = image.sha256 === previous.image.sha256;
          const cpuPixelsPassed = image.pixels.every(
            (pixel, index) =>
              pixel &&
              pixel.every(
                (value, channel) =>
                  Math.abs(
                    value - previous.reference.pixels[index].rgba[channel],
                  ) <= 1,
              ),
          );
          const modelUnchanged = [lost, restored].every(
            (state) =>
              state.sessionId === before.sessionId &&
              JSON.stringify(state.document) ===
                JSON.stringify(before.document) &&
              JSON.stringify(state.samples) ===
                JSON.stringify(before.samples) &&
              state.renderer.sourceCount === before.renderer.sourceCount &&
              state.renderer.sourceBytes === before.renderer.sourceBytes,
          );
          const sourcesUnchanged =
            sourcesBefore.sha256 === fixture.sourceSha256 &&
            sourcesBefore.sourceTiles === fixture.sourceTiles &&
            JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter);
          const fileUnchanged =
            sha256(await readFile(fixture.file)) === fixture.fileSha256;
          const restoredPassed =
            !(await context.evaluate(({ gl }) => gl.isContextLost())) &&
            restored.renderer.contextLost === false &&
            restored.readiness.ready === true &&
            restored.renderer.lastSubmittedFrame >
              before.renderer.lastSubmittedFrame;
          result.contextRestore = {
            passed:
              lostPassed &&
              restoredPassed &&
              pixelsIdentical &&
              imageIdentical &&
              cpuPixelsPassed &&
              modelUnchanged &&
              sourcesUnchanged &&
              fileUnchanged,
            lostPassed,
            restoredPassed,
            pixelsIdentical,
            imageIdentical,
            cpuPixelsPassed,
            modelUnchanged,
            sourcesUnchanged,
            fileUnchanged,
            before,
            lost,
            restored,
            sourcesBefore,
            sourcesAfter,
            image,
          };
        } finally {
          await context.dispose();
        }
      }
      result.fileUnchanged =
        sha256(await readFile(fixture.file)) === fixture.fileSha256;
      result.passed =
        result.views.every((view) => view.passed) &&
        (fixture.id !== "thresholds-negative-seams" ||
          result.contextRestore?.passed === true) &&
        result.fileUnchanged &&
        session.errors.length === 0;
    } catch (error) {
      result.error = String(error);
    } finally {
      result.pageErrors = session.errors;
      await session.close();
      await writeFile(
        join(sessionDirectory, "electron.log"),
        session.output.join(""),
      );
    }
    console.log(
      `[atlas-p0-gpu] ${fixture.id}: ${result.passed ? "PASS" : "FAIL"}`,
    );
    await writeFile(
      join(directory, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
  report.passed =
    report.cases.length === fixtures.length &&
    report.cases.every((result) => result.passed);
  await writeFile(
    join(directory, "report.json"),
    JSON.stringify(report, null, 2),
  );
  process.exitCode = report.passed ? 0 : 1;
}

if (mode === "--create" && argument)
  console.log(JSON.stringify(await createFixtures(resolve(argument))));
else if (mode === "--reference" && argument)
  console.log(JSON.stringify(await references(resolve(argument))));
else if (mode === undefined || mode === "--out")
  await run(
    resolve(
      argument ?? join(root, "src-tauri/target/diagnostics/atlas-gpu-check"),
    ),
  );
else
  throw new Error(
    "Usage: node scripts/atlas-p0-gpu-check.mjs [--out directory]",
  );
