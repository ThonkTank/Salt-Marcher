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
  const {
    ProjectStore,
    heightTilesFromControls,
    heightSpacing,
    WORLD_LIMIT,
    HEIGHT_LIMIT,
  } = dependencies();
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
    HEIGHT_LIMIT - 1e-6,
    HEIGHT_LIMIT + 1e-6,
    HEIGHT_LIMIT - 10,
    HEIGHT_LIMIT + 10,
    HEIGHT_LIMIT * 2,
    -HEIGHT_LIMIT + 1e-6,
    -HEIGHT_LIMIT - 1e-6,
    -HEIGHT_LIMIT + 10,
    -HEIGHT_LIMIT - 10,
    -HEIGHT_LIMIT * 2,
  ];
  const thresholdPoints = thresholds.map((_value, index) => [
    -1600 + (index % 5) * 800,
    -1000 + Math.floor(index / 5) * 400,
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
        const row = Math.max(0, Math.min(5, Math.floor((y + 1200) / 400)));
        return 100 + thresholds[row * 5 + column];
      }),
      regional: false,
      fallback: false,
    },
    {
      id: "normal-zoom-level9",
      center: [0, 0],
      points: [
        [-320, 0],
        [0, 0],
        [320, 0],
      ],
      // Ordinary coarse terrain plus finite rounding-sized author values. The
      // latter remain exact in storage and must not force a Float64 raster job.
      tiles: [
        ...field(
          9,
          [-80_000, -80_000, 80_000, 80_000],
          (x, y) => 100 + 20 * Math.sin(x / 30_000) + 10 * Math.cos(y / 25_000),
        ),
        ...field(8, [-80_000, -80_000, 80_000, 80_000], (x) =>
          x < 0 ? -1e-45 : 1e-45,
        ),
      ],
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
        field(level, [-640, -320, 640, 320], (x, y) =>
          level === 0
            ? -30.2 +
              (x < 0 ? 0 : 12) +
              (y < 0 ? -0.5 : 0.5) * DISPLAY_BOUNDARY_EPSILON_FT
            : 4 + level / 5,
        ),
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
        patches: tiles.map((after) => ({
          kind: "height",
          key: after.key,
          after,
        })),
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
function reconstructReference(
  { power, points, pixelWorlds },
  readSources,
  readDisplay,
) {
  const {
    prepareHeightSampler,
    prepareHeightGrid,
    heightFromScaledSum,
    WORLD_LIMIT,
  } = dependencies();
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
    const read = readSources(region(point));
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
    const read = readDisplay(region(centre));
    const coarse = prepareHeightGrid(read.tiles)(bounds, 128, [
      pixel[0],
      pixel[1],
      pixel[0] + 1,
      pixel[1] + 1,
    ])[0];
    const overview = read.overviews.find(
      (value) => value.key === `height-overview:${power}:${tile[0]}:${tile[1]}`,
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
}

async function references(requestFile) {
  const input = JSON.parse(await readFile(requestFile, "utf8"));
  const results = [];
  for (const request of Array.isArray(input) ? input : [input]) {
    if (request.storeSnapshot) {
      const revive = (read) => ({
        ...read,
        tiles: read.tiles.map((tile) => ({
          ...tile,
          values: new Float64Array(tile.values),
        })),
        overviews: read.overviews?.map((tile) => ({
          ...tile,
          values: new Float64Array(tile.values),
        })),
      });
      const sources = revive(request.storeSnapshot.sources);
      const display = revive(request.storeSnapshot.presentation);
      results.push(
        reconstructReference(
          request,
          () => sources,
          () => display,
        ),
      );
      continue;
    }
    const { ProjectStore } = dependencies();
    const store = new ProjectStore(
      join(dirname(requestFile), "reference-work"),
    );
    try {
      const project = await store.openProject(request.file);
      results.push(
        reconstructReference(
          request,
          (bounds) =>
            store.readRegion({
              sessionId: project.sessionId,
              minLevel: 0,
              bounds,
            }),
          (bounds) =>
            store.readPresentation({
              sessionId: project.sessionId,
              power: request.power,
              bounds,
            }),
        ),
      );
    } finally {
      store.close();
    }
  }
  return Array.isArray(input) ? results : results[0];
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
  const {
    brush,
    button,
    exact,
    capture,
    movingStroke,
    navigateTo,
    position,
    snapshot,
    stateSnapshot,
  } = await import("./atlas-p0-interactions.mjs");
  // Ordinary editor actions, with sparse read-only checkpoints outside inputs.
  // All actions reuse one document; the independent CPU oracle runs once per batch.
  async function mutations(session, fixture) {
    const { page } = session;
    const result = {
      actions: [],
      checkpoints: [],
      fineOverview: [],
      passed: false,
    };
    const requests = [];
    const settled = async () => {
      await exact(page);
      await page.waitForFunction(() => {
        const o = window.atlasObserve([], { events: false });
        if (o.state.error || o.state.persistenceError)
          throw new Error(o.state.error ?? o.state.persistenceError);
        return (
          !o.document.active &&
          !o.state.writing &&
          o.document.pendingBytes === 0 &&
          !o.renderer.gpuPending
        );
      });
    };
    const checkpoint = async (id, points) => {
      await page.mouse.move(10, 10);
      await settled();
      const state = await stateSnapshot(page, points);
      const image = await capture(session, id, points);
      const power = state.renderer.presentationPower;
      const pixelWorlds = image.screenPoints.map(({ x, y }) => [
        state.camera.x + (x + 0.5 - image.size.width / 2) / state.camera.scale,
        state.camera.y + (y + 0.5 - image.size.height / 2) / state.camera.scale,
      ]);
      const all = [...points, ...pixelWorlds];
      const halo = 2 ** power + 1;
      const bounds = [
        Math.min(...all.map(([x]) => x)) - halo,
        Math.min(...all.map(([, y]) => y)) - halo,
        Math.max(...all.map(([x]) => x)) + halo,
        Math.max(...all.map(([, y]) => y)) + halo,
      ];
      const storeSnapshot = await page.evaluate(
        async ({ bounds, power, sessionId, sequence }) => {
          const sources = await window.atlasDesktop.readRegion({
            sessionId,
            bounds,
            minLevel: 0,
          });
          const presentation = await window.atlasDesktop.readPresentation({
            sessionId,
            bounds,
            power,
          });
          if (
            [sources, presentation].some(
              (read) =>
                read.sessionId !== sessionId || read.sequence !== sequence,
            )
          )
            throw new Error(
              "GPU checkpoint and stored oracle have different boundaries",
            );
          const serialize = (read) => ({
            ...read,
            tiles: read.tiles.map((tile) => ({
              ...tile,
              values: Array.from(tile.values),
            })),
            overviews: read.overviews?.map((tile) => ({
              ...tile,
              values: Array.from(tile.values),
            })),
          });
          return {
            sources: serialize(sources),
            presentation: serialize(presentation),
          };
        },
        {
          bounds,
          power,
          sessionId: state.sessionId,
          sequence: state.document.sequence,
        },
      );
      requests.push({ points, pixelWorlds, power, storeSnapshot });
      result.checkpoints.push({
        id,
        image,
        power,
        actualHeights: state.samples,
        renderer: state.renderer,
        sequence: state.document.sequence,
      });
    };
    const action = async (kind, point = [100, 100], diameter = 16) => {
      const beforePreparation = await stateSnapshot(page);
      if (kind === "raise" || kind === "lower") {
        await brush(page, diameter, 4000);
        if (kind === "lower") await button(page, /Absenken/);
        const at = await position(page, point);
        await page.mouse.move(at.x, at.y);
        await settled();
      }
      const before = await stateSnapshot(page);
      let stroke;
      if (kind === "undo" || kind === "redo")
        await button(page, kind === "undo" ? /Rückgängig/ : /Wiederholen/);
      else
        stroke = await movingStroke(session, [point, point, point], {
          intervalMs: 64,
        });
      await settled();
      const after = await snapshot(page, [], {
        sinceEvent: beforePreparation.eventCount,
      });
      const preparationEvents =
        before.eventCount - beforePreparation.eventCount;
      const draws = after.events
        .slice(preparationEvents)
        .filter((event) => event.kind === "height-draw");
      const terrain = after.events
        .slice(preparationEvents)
        .filter((event) => event.kind === "height-terrain");
      const preparationTerrain = after.events
        .slice(0, preparationEvents)
        .filter((event) => event.kind === "height-terrain");
      const complete =
        draws.length > 0 && terrain.length > 0 && after.droppedEvents === 0;
      const workOf = (observed, requireDraw) =>
        Object.fromEntries(
          [
            "canonicalSamples",
            "deltaSamples",
            "horizontalSamples",
            "projectionProducts",
            "basisCaptureSamples",
            "canonicalBasisBuilds",
            "colourSamples",
            "anchorCopySamples",
          ].map((key) => [
            key,
            after.droppedEvents === 0 &&
            (!requireDraw || observed.length > 0) &&
            observed.every(
              (event) => Number.isSafeInteger(event[key]) && event[key] >= 0,
            )
              ? observed.reduce((sum, event) => sum + event[key], 0)
              : null,
          ]),
        );
      const work = workOf(terrain, true);
      const preparationWork = workOf(preparationTerrain, false);
      result.actions.push({
        kind,
        diameter,
        level: before.brush.level,
        sequence: after.document.sequence,
        draws: draws.length,
        terrainPackets: terrain.length,
        droppedEvents: after.droppedEvents,
        work,
        preparationWork,
        passed:
          complete &&
          after.document.sequence === before.document.sequence + 1 &&
          (!stroke || (!stroke.timedOut && stroke.time.passed)),
      });
      return after;
    };
    if (fixture.id === "normal-zoom-level9") {
      const points = [
        [-15_000, 4_000],
        [0, 4_000],
        [15_000, 4_000],
      ];
      const startEvent = (await stateSnapshot(page)).eventCount;
      result.zoomSequence = [];
      for (const scale of [0.011, 0.01, 0.009, 0.01]) {
        const before = await stateSnapshot(page);
        const at = await position(page, [before.camera.x, before.camera.y]);
        await page.mouse.move(at.x, at.y);
        // The editor bounds each native wheel event to ±500. Wait for each
        // ordinary event before calculating the next step from the real camera.
        for (let step = 0; step < 8; step++) {
          const current = await stateSnapshot(page);
          if (Math.abs(current.camera.scale - scale) < 1e-7) break;
          const delta = Math.max(
            -500,
            Math.min(500, Math.log(current.camera.scale / scale) / 0.0018),
          );
          const nextScale = current.camera.scale * Math.exp(-delta * 0.0018);
          await page.mouse.wheel(0, delta);
          await page.waitForFunction(
            (expected) =>
              Math.abs(
                window.atlasObserve([], { events: false }).camera.scale -
                  expected,
              ) < 1e-7,
            nextScale,
          );
        }
        await page.waitForFunction(
          (scale) =>
            Math.abs(
              window.atlasObserve([], { events: false }).camera.scale - scale,
            ) < 1e-7,
          scale,
        );
        await action("raise", [0, 4_000], 512);
        const state = await stateSnapshot(page);
        result.zoomSequence.push({
          targetScale: scale,
          scale: state.camera.scale,
          level: state.brush.level,
          fallbackTiles: state.renderer.fallbackTiles,
          fallbackSamples: state.renderer.fallbackSamples,
          passed:
            Math.abs(state.camera.scale - scale) < 1e-7 &&
            state.brush.level === 9 &&
            state.renderer.fallbackTiles === 0 &&
            state.renderer.fallbackSamples === 0,
        });
        await checkpoint(`zoom-${result.zoomSequence.length}-raised`, points);
        await action("undo");
        await checkpoint(`zoom-${result.zoomSequence.length}-undone`, points);
      }
      const observed = await snapshot(page, [], { sinceEvent: startEvent });
      const draws = observed.events.filter(
        (event) => event.kind === "height-draw",
      );
      result.normalGpuPath = {
        draws: draws.length,
        droppedEvents: observed.droppedEvents,
        fallbackDraws: draws.filter(
          (event) => event.fallbackTiles !== 0 || event.fallbackSamples !== 0,
        ).length,
        passed:
          observed.droppedEvents === 0 &&
          draws.length > 0 &&
          draws.every(
            (event) => event.fallbackTiles === 0 && event.fallbackSamples === 0,
          ),
      };
    } else if (fixture.id === "all-22-levels") {
      const points = [
        [100, 100],
        [84, 100],
        [132, 116],
        [-100, 100],
        [100, -100],
        [-100, -100],
        [400, 100],
      ];
      await checkpoint("chain-initial", points);
      // More than 32 real tool-level changes exercise the bounded warm captures,
      // independently of the number of gestures and Undo/Redo transactions.
      for (let index = 0; index < 40; index++) {
        await action(
          index % 2 ? "lower" : "raise",
          points[0],
          [16, 64, 32, 128][index % 4],
        );
        if (index === 0) await checkpoint("chain-first-raised", points);
        await action("undo");
        if ((index + 1) % 3 === 0) {
          await action("redo");
          await action("undo");
        }
        if ([16, 32, 48, 64, 80, 96, 106].includes(result.actions.length))
          await checkpoint(`chain-${result.actions.length}`, points);
      }
      result.chain = {
        transactions: result.actions.length,
        deltaSamples: result.actions.reduce(
          (sum, entry) => sum + (entry.work.deltaSamples ?? 0),
          0,
        ),
        laterCanonicalSamples: result.actions
          .slice(64)
          .reduce(
            (sum, entry) =>
              sum +
              (entry.work.canonicalSamples ?? 0) +
              (entry.preparationWork.canonicalSamples ?? 0),
            0,
          ),
        laterCanonicalBasisBuilds: result.actions
          .slice(64)
          .reduce(
            (sum, entry) =>
              sum +
              (entry.work.canonicalBasisBuilds ?? 0) +
              (entry.preparationWork.canonicalBasisBuilds ?? 0),
            0,
          ),
        factsComplete: result.actions.every((entry) =>
          [
            ...Object.values(entry.work),
            ...Object.values(entry.preparationWork),
          ].every(Number.isFinite),
        ),
      };
      const sameLevelStart = result.actions.length;
      let sameLevelEventStart;
      for (let index = 0; index < 32; index++) {
        const edited = await action(
          index % 2 ? "lower" : "raise",
          points[0],
          512,
        );
        if (index === 0) sameLevelEventStart = edited.eventCount;
        if (index === 0 || index === 31)
          await checkpoint(
            `same-level-${index === 0 ? "first" : "last"}-edited`,
            points,
          );
        await action("undo");
        if ([8, 16, 24, 32].includes(index + 1))
          await checkpoint(`same-level-${(index + 1) * 2}`, points);
      }
      const sameLevelActions = result.actions.slice(sameLevelStart);
      // Include ordinary work triggered by checkpoint hover/reads between actions.
      // A rebuild there must not disappear from the stable-basis claim.
      const sameLevelObservation = await snapshot(page, [], {
        sinceEvent: sameLevelEventStart,
      });
      // Terrain packets have their own slot and may precede a later scene.
      // Count them once even when that RAF cannot submit a scene draw.
      const laterDraws = sameLevelObservation.events.filter(
        (event) => event.kind === "height-terrain",
      );
      const laterFactsComplete =
        laterDraws.length > 0 &&
        sameLevelObservation.droppedEvents === 0 &&
        laterDraws.every((event) =>
          [
            "canonicalSamples",
            "basisCaptureSamples",
            "canonicalBasisBuilds",
          ].every((key) => Number.isSafeInteger(event[key]) && event[key] >= 0),
        );
      result.sameLevelChain = {
        transactions: sameLevelActions.length,
        level: sameLevelActions[0].level,
        sameLevel: sameLevelActions.every((entry) => entry.level === 4),
        deltaSamples: sameLevelActions.reduce(
          (sum, entry) => sum + (entry.work.deltaSamples ?? 0),
          0,
        ),
        eventRange: [sameLevelEventStart, sameLevelObservation.eventCount],
        laterCanonicalSamples: laterFactsComplete
          ? laterDraws.reduce((sum, event) => sum + event.canonicalSamples, 0)
          : null,
        laterBasisCaptureSamples: laterFactsComplete
          ? laterDraws.reduce(
              (sum, event) => sum + event.basisCaptureSamples,
              0,
            )
          : null,
        laterCanonicalBasisBuilds: laterFactsComplete
          ? laterDraws.reduce(
              (sum, event) => sum + event.canonicalBasisBuilds,
              0,
            )
          : null,
        factsComplete:
          laterFactsComplete &&
          sameLevelActions.every((entry) =>
            [
              ...Object.values(entry.work),
              ...Object.values(entry.preparationWork),
            ].every(Number.isFinite),
          ),
      };
      await action("lower", [-100, 100]);
      await checkpoint("zero-lowered", points);
      await action("undo");
      await checkpoint("zero-undone", points);
      // These author levels are already part of the displayed fine overview.
      for (const [scale, diameter, level, power] of [
        [0.125, 8, 0, 3],
        [0.0625, 16, 1, 4],
      ]) {
        const before = await stateSnapshot(page);
        const at = await position(page, [before.camera.x, before.camera.y]);
        await page.mouse.move(at.x, at.y);
        // Native wheel deltas are rounded to Float32. Approach the requested
        // power from just inside its scale interval, never from the coarser side.
        const targetScale = scale * 1.000001;
        await page.mouse.wheel(
          0,
          Math.log(before.camera.scale / targetScale) / 0.0018,
        );
        await page.waitForFunction(
          (scale) =>
            Math.abs(
              window.atlasObserve([], { events: false }).camera.scale - scale,
            ) < 1e-6,
          scale,
        );
        await action("raise", points[0], diameter);
        const state = await stateSnapshot(page);
        result.fineOverview.push({
          requestedScale: scale,
          targetScale,
          scale: state.camera.scale,
          diameter,
          level: state.brush.level,
          power: state.renderer.presentationPower,
          passed:
            state.camera.scale >= scale &&
            state.camera.scale < scale * 1.000003 &&
            state.brush.level === level &&
            state.renderer.presentationPower === power,
        });
        await checkpoint(`fine-overview-${power}-raised`, points.slice(0, 3));
        await action("undo");
        await checkpoint(`fine-overview-${power}-undone`, points.slice(0, 3));
      }
      await button(page, "Nahansicht");
      await settled();
      // Context restoration discards derived anchors and rebuilds from authors.
      const context = await page.evaluateHandle(() => {
        const gl = document.querySelector("canvas").getContext("webgl2");
        const extension = gl.getExtension("WEBGL_lose_context");
        if (!extension)
          throw new Error("Required WEBGL_lose_context extension unavailable");
        return extension;
      });
      try {
        await context.evaluate((extension) => extension.loseContext());
        await page.waitForFunction(
          () => window.atlasObserve([], { events: false }).renderer.contextLost,
        );
        await context.evaluate((extension) => extension.restoreContext());
        await settled();
        await checkpoint("chain-canonical-restored", points);
      } finally {
        await context.dispose();
      }
    } else {
      const points =
        fixture.id === "thresholds-negative-seams"
          ? fixture.points
          : [
              [100, 100],
              [84, 100],
              [132, 116],
            ];
      const point = points[0];
      await action("raise", point);
      await checkpoint("live-raised", points);
      await action("undo");
      await checkpoint("live-undone", points);
      await action("redo");
      await checkpoint("live-redone", points);
    }
    const requestFile = join(session.directory, "live-references.json");
    await writeFile(requestFile, JSON.stringify(requests));
    const expected = child("--reference", requestFile);
    for (const [index, entry] of result.checkpoints.entries()) {
      entry.reference = expected[index];
      entry.pixelsPassed = entry.image.pixels.every(
        (pixel, i) =>
          pixel &&
          pixel.every(
            (value, channel) =>
              Math.abs(value - entry.reference.pixels[i].rgba[channel]) <= 1,
          ),
      );
      entry.authorsPassed = entry.actualHeights.every((value, i) =>
        value === null
          ? entry.power > 2
          : Number.isFinite(value) &&
            Math.abs(value - entry.reference.numeric[i]) <= 1e-7,
      );
      entry.fineOverviewPassed =
        !entry.id.startsWith("fine-overview-") ||
        entry.reference.pixels.some((pixel) => pixel.fineOverview);
      entry.passed =
        entry.pixelsPassed && entry.authorsPassed && entry.fineOverviewPassed;
    }
    if (result.chain) {
      const baseline = result.checkpoints[0];
      const restored = result.checkpoints.at(-1);
      result.chain.restoredPixels =
        JSON.stringify(restored.image.pixels) ===
        JSON.stringify(baseline.image.pixels);
      result.chain.restoredAuthors = restored.actualHeights.every(
        (value, index) =>
          Number.isFinite(value) &&
          Math.abs(value - baseline.actualHeights[index]) <= 1e-7,
      );
    }
    result.passed =
      result.actions.every((entry) => entry.passed) &&
      result.checkpoints.every((entry) => entry.passed) &&
      result.fineOverview.every((entry) => entry.passed) &&
      (!result.zoomSequence ||
        (result.zoomSequence.length === 4 &&
          result.zoomSequence.every((entry) => entry.passed) &&
          result.normalGpuPath?.passed === true)) &&
      (!result.chain ||
        (result.chain.transactions === 106 &&
          result.chain.factsComplete &&
          result.chain.deltaSamples > 0 &&
          result.chain.laterCanonicalSamples > 0 &&
          result.chain.laterCanonicalBasisBuilds > 0 &&
          result.chain.restoredPixels &&
          result.chain.restoredAuthors)) &&
      (!result.sameLevelChain ||
        (result.sameLevelChain.transactions === 64 &&
          result.sameLevelChain.sameLevel &&
          result.sameLevelChain.factsComplete &&
          result.sameLevelChain.deltaSamples > 0 &&
          result.sameLevelChain.laterCanonicalSamples === 0 &&
          result.sameLevelChain.laterBasisCaptureSamples === 0 &&
          result.sameLevelChain.laterCanonicalBasisBuilds === 0));
    return result;
  }
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
      if (
        [
          "all-22-levels",
          "ordinary-22-level-cancellation",
          "thresholds-negative-seams",
          "normal-zoom-level9",
        ].includes(fixture.id)
      )
        result.live = await mutations(session, fixture);
      if (fixture.id === "normal-zoom-level9") {
        const state = await stateSnapshot(session.page);
        result.sourceIdentity = await sourceIdentity(
          session,
          fixture,
          state.sessionId,
        );
        result.sourcesUnchanged =
          result.sourceIdentity.sha256 === fixture.sourceSha256 &&
          result.sourceIdentity.sourceTiles === fixture.sourceTiles;
      }
      result.fileUnchanged =
        sha256(await readFile(fixture.file)) === fixture.fileSha256;
      result.passed =
        result.views.every((view) => view.passed) &&
        (fixture.id !== "thresholds-negative-seams" ||
          result.contextRestore?.passed === true) &&
        (!result.live || result.live.passed) &&
        result.sourcesUnchanged !== false &&
        result.fileUnchanged &&
        session.errors.length === 0;
    } catch (error) {
      result.error = String(error);
      try {
        result.failureState = await stateSnapshot(session.page);
        result.failureEvents = (
          await snapshot(session.page, [], {
            sinceEvent: Math.max(0, result.failureState.eventCount - 500),
          })
        ).events;
      } catch (observationError) {
        result.failureObservationError = String(observationError);
      }
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
