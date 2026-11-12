import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureCanvas } from "./atlas-p0-desktop.mjs";
import {
  button,
  brush,
  heightMode,
  capture,
  exact,
  landPixel,
  position,
  stateSnapshot,
  storeActivityPosition,
  waitForSaveCompletion,
  waterPixel,
} from "./atlas-p0-interactions.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const self = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const ids = {
  lake: "prepared-lake",
  river: "prepared-river",
  house: "prepared-house",
};
const probes = [
  [-240, 40], // Lake mask; natural plane is 28.4 ft, below the 32 ft level.
  [-40, 80], // Same mask; natural plane is 33.8 ft, above the level.
  [-180, -30], // Explicit island hole, although its natural height is below 32 ft.
  [80, -60], // Confirmed river: water 35 ft, bed 33 ft, natural plane 35.4 ft.
  [132, 55], // Roof interior.
  [120, 28], // Dry river bank, outside the rotated roof and within its transition.
  [250, 50], // Bare natural terrain beside the prepared objects.
];
const strokePoint = [-100, 0];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, tolerance = 1e-6) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
const pixelDistance = (a, b) =>
  a?.length === 4 && b?.length === 4
    ? Math.max(...a.map((value, index) => Math.abs(value - b[index])))
    : Number.NaN;
const samePixels = (a, b) =>
  a?.length === b?.length &&
  a.every((pixel, i) => pixelDistance(pixel, b[i]) <= 2);
const hashJson = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function electronNode(args) {
  const result = spawnSync(require("electron"), args, {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Water source inspection failed: ${result.error ?? result.stderr}`,
    );
  return JSON.parse(result.stdout);
}

/** Independent implementation of the documented persisted dependency byte format. */
function heightIdentity(rows, bounds) {
  const hash = createHash("sha256").update("height-controls-v1\0");
  const header = Buffer.alloc(32);
  bounds.forEach((value, index) =>
    header.writeDoubleLE(value === 0 ? 0 : value, index * 8),
  );
  hash.update(header);
  for (const row of rows) {
    const spacing = 5 * 2 ** row.level;
    for (let y = 0; y < 64; y++) {
      const cy = row.tile_y * 64 + y;
      if (
        Math.abs(cy * spacing) > 100_000_000 ||
        cy <= bounds[1] / spacing - 2 ||
        cy >= bounds[3] / spacing + 2
      )
        continue;
      for (let x = 0; x < 64; x++) {
        const cx = row.tile_x * 64 + x;
        if (
          Math.abs(cx * spacing) > 100_000_000 ||
          cx <= bounds[0] / spacing - 2 ||
          cx >= bounds[2] / spacing + 2
        )
          continue;
        const value = row.values_blob.readDoubleLE((y * 64 + x) * 8);
        if (value === 0) continue;
        const record = Buffer.alloc(17);
        record.writeUInt8(row.level, 0);
        record.writeInt32LE(cx, 1);
        record.writeInt32LE(cy, 5);
        record.writeDoubleLE(value, 9);
        hash.update(record);
      }
    }
  }
  return `height-controls-v1:${hash.digest("hex")}`;
}

/** Tensor cubic reconstruction from raw author bytes, without product imports. */
function naturalSamples(rows, points) {
  const tiles = new Map(
    rows.map((row) => [`${row.level}:${row.tile_x}:${row.tile_y}`, row]),
  );
  const weights = (t) => [
    (1 - t) ** 3 / 6,
    (3 * t ** 3 - 6 * t ** 2 + 4) / 6,
    (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6,
    t ** 3 / 6,
  ];
  return points.map(([x, y]) => {
    let total = -100;
    for (let level = 0; level <= 21; level++) {
      const spacing = 5 * 2 ** level;
      const ix = Math.floor(x / spacing),
        iy = Math.floor(y / spacing);
      const wx = weights(x / spacing - ix),
        wy = weights(y / spacing - iy);
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++) {
          const cx = ix + dx - 1,
            cy = iy + dy - 1;
          if (
            Math.abs(cx * spacing) > 100_000_000 ||
            Math.abs(cy * spacing) > 100_000_000
          )
            continue;
          const tx = Math.floor(cx / 64),
            ty = Math.floor(cy / 64);
          const row = tiles.get(`${level}:${tx}:${ty}`);
          if (!row) continue;
          const index = (cy - ty * 64) * 64 + cx - tx * 64;
          total += row.values_blob.readDoubleLE(index * 8) * wx[dx] * wy[dy];
        }
    }
    return Math.max(-100_000, Math.min(100_000, total));
  });
}

/** Confirmed profile geometry, evaluated independently from the saved payload. */
function referenceRiverBed(water, point, natural) {
  let result = natural;
  for (const source of water) {
    if (source.kind !== "river") continue;
    for (let index = 1; index < source.samples.length; index++) {
      const a = source.samples[index - 1],
        b = source.samples[index];
      const dx = b.point[0] - a.point[0],
        dy = b.point[1] - a.point[1];
      const along = Math.max(
        0,
        Math.min(
          1,
          ((point[0] - a.point[0]) * dx + (point[1] - a.point[1]) * dy) /
            (dx * dx + dy * dy),
        ),
      );
      const distance = Math.hypot(
        point[0] - a.point[0] - along * dx,
        point[1] - a.point[1] - along * dy,
      );
      const width = a.width + (b.width - a.width) * along;
      const level = a.level + (b.level - a.level) * along;
      const fullBedRadius = width / 2 + Math.sqrt(2) * 5;
      const blend = Math.max(
        0,
        Math.min(1, 1 - (distance - fullBedRadius) / Math.max(width, 5)),
      );
      result = Math.min(
        result,
        natural +
          Math.min(0, level - 2 - natural) * blend * blend * (3 - 2 * blend),
      );
    }
  }
  return result;
}

/** Rectangle distance uses inverse pose, separately from product edge geometry. */
function referenceFoundationTransition(house, point, naturalBed, base) {
  const angle = (house.rotation * Math.PI) / 180;
  const dx = point[0] - house.x,
    dy = point[1] - house.y;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const distance = Math.hypot(
    Math.max(0, Math.abs(localX) - house.width / 2),
    Math.max(0, Math.abs(localY) - house.depth / 2),
  );
  if (distance === 0) return base;
  if (house.foundation_transition === 0) return naturalBed;
  const blend = Math.max(0, 1 - distance / house.foundation_transition);
  // Foundation height changes the upper edge of the building, never this plateau.
  return (
    naturalBed +
    Math.max(0, base - naturalBed) * blend * blend * (3 - 2 * blend)
  );
}

/** Read author rows from the actual saved file, never a product reader/cache. */
function inspect(file) {
  const Database = require("better-sqlite3");
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const rawWater = db
      .prepare("SELECT * FROM water_sources ORDER BY water_id")
      .all();
    const water = rawWater.map((row) => JSON.parse(row.source_json));
    const houses = db
      .prepare("SELECT * FROM house_headers ORDER BY house_id")
      .all();
    const height = db
      .prepare(
        "SELECT level,tile_x,tile_y,revision,values_blob FROM height_tiles ORDER BY level,tile_y,tile_x",
      )
      .all();
    const payload = createHash("sha256");
    for (const row of height) {
      payload.update(`${row.level}:${row.tile_x}:${row.tile_y}\0`);
      payload.update(row.values_blob);
    }
    const natural = naturalSamples(height, probes);
    return {
      water,
      houses,
      waterDigest: hashJson(rawWater),
      houseDigest: hashJson(houses),
      heightDigest: payload.digest("hex"),
      heightRevisions: height.map(({ level, tile_x, tile_y, revision }) => ({
        level,
        tile_x,
        tile_y,
        revision,
      })),
      dependencies: water.map((source) => ({
        id: source.id,
        sourceIdentity: source.terrain.identity,
        currentIdentity: heightIdentity(height, source.terrain.bounds),
      })),
      natural,
      riverBed: probes.map((point, index) =>
        referenceRiverBed(water, point, natural[index]),
      ),
      waterIndex: db
        .prepare(
          "SELECT w.water_id FROM water_spatial s JOIN water_sources w ON w.row_id=s.row_id ORDER BY w.water_id",
        )
        .all()
        .map((row) => row.water_id),
    };
  } finally {
    db.close();
  }
}

const waterState = (state, id) =>
  state.surfaces.water.find((source) => source.id === id);
const foundation = (state) =>
  state.surfaces.foundations.find((value) => value.id === ids.house);
const expectedWater = (state, status) =>
  [ids.lake, ids.river].every((id) => waterState(state, id)?.status === status);
const identitiesMatch = (state, stored) =>
  stored.dependencies.every((entry) => {
    const observed = waterState(state, entry.id);
    return (
      observed?.sourceIdentity === entry.sourceIdentity &&
      observed?.currentIdentity === entry.currentIdentity
    );
  });
const transitionMatches = (state, stored) => {
  const point = state.surfaces.points[5];
  const house = stored.houses.find((entry) => entry.house_id === ids.house);
  const expected = referenceFoundationTransition(
    house,
    probes[5],
    stored.riverBed[5],
    foundation(state).base,
  );
  return (
    near(point?.naturalHeight, stored.natural[5]) &&
    near(point?.riverBedHeight, stored.riverBed[5]) &&
    near(point?.surfaceHeight, expected, 1e-4) &&
    point.surfaceHeight > point.riverBedHeight + 1 &&
    point.wet === false
  );
};

async function settled(page, previousSessionId) {
  if (previousSessionId)
    await page.waitForFunction(
      (previous) => {
        const state = window.atlasObserve([], { events: false });
        if (state.state.error) throw new Error(state.state.error);
        return state.sessionId !== previous && !state.state.fileAction;
      },
      previousSessionId,
      { timeout: 30_000 },
    );
  await exact(page, 30_000);
  await page.waitForFunction(
    () => {
      const state = window.atlasObserve([], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      return (
        state.surfaces?.ready === true &&
        state.houses?.ready === true &&
        !state.state.writing &&
        !state.state.fileAction &&
        !state.renderer.gpuPending
      );
    },
    null,
    { timeout: 30_000 },
  );
  return stateSnapshot(page, probes);
}

async function image(session, name) {
  const box = await session.page.locator("canvas").boundingBox();
  if (!box) throw new Error("Water canvas is unavailable");
  await session.page.mouse.move(box.x + 20, box.y + 20);
  await settled(session.page);
  return capture(session, name, probes);
}

async function pointer(page, point) {
  const at = await position(page, point);
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(
    () => {
      const state = window.atlasObserve([], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      return state.readiness.ready;
    },
    null,
    { timeout: 30_000 },
  );
  return at;
}

async function click(page, point) {
  const at = await pointer(page, point);
  await page.mouse.click(at.x, at.y);
  return settled(page);
}

async function terrainClick(page, kind, rate) {
  await brush(page, 512, rate);
  await heightMode(page, kind);
  await settled(page);
  return click(page, strokePoint);
}

async function saveAs(session, file) {
  await session.app.evaluate((_electron, file) => {
    process.env.ATLAS_P0_DIALOG_SAVE = file;
  }, file);
  const since = await storeActivityPosition(session);
  await button(session.page, "Speichern unter");
  const start = await session.app.evaluate(async (_electron, since) => {
    const deadline = performance.now() + 20_000;
    while (performance.now() < deadline) {
      const activity = globalThis.__atlasHost.storeActivity({
        sinceEvent: since,
      });
      if (activity.droppedEvents)
        throw new Error("Save observations were dropped");
      const start = activity.events.find(
        (event) => event.kind === "snapshot" && event.phase === "start",
      );
      if (start) return start;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Water save did not start");
  }, since);
  await waitForSaveCompletion(session, start);
  await settled(session.page);
  return electronNode([self, "inspect", file]);
}

async function statusText(page, expected, count = 2) {
  const panel = page.getByRole("region", {
    name: "Gewässer und Fundamente",
    exact: true,
  });
  await panel.waitFor({ state: "visible" });
  const water = panel.getByRole("group", { name: /^Gewässer: / });
  return (
    (await water.count()) === count &&
    (await water.getByText(expected, { exact: true }).count()) === count
  );
}

export async function runWaterScenario({ launch, out, recordCheck }) {
  const files = {
    initial: join(out, "water-initial.saltatlas"),
    a: join(out, "water-a.saltatlas"),
    b: join(out, "water-b.saltatlas"),
    undo: join(out, "water-undo-a.saltatlas"),
    lower: join(out, "water-lowered.saltatlas"),
  };
  const evidence = {
    purpose:
      "P3.3 real prepared water/foundation/history/file content; no native performance acceptance",
    probes,
    images: {},
  };
  let session = await launch({
    label: "water-edit",
    diagnostics: true,
    env: { ATLAS_P0_DIALOG_OPEN: files.b },
  });
  try {
    const { page } = session;
    const prior = await stateSnapshot(page);
    await button(page, "Gewässerszene öffnen");
    await settled(page, prior.sessionId);
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    const initial = (evidence.initial = await settled(page));
    const initialImage = (evidence.images.initial = await image(
      session,
      "water-initial",
    ));
    const initialSources = (evidence.initialSources = await saveAs(
      session,
      files.initial,
    ));
    recordCheck(
      "water: regular prepared scene contains real lake, river and house authors",
      initialSources.water.length === 2 &&
        initialSources.houses.length === 1 &&
        same(initialSources.waterIndex, [ids.lake, ids.river]) &&
        initialSources.water.find((source) => source.id === ids.lake)?.kind ===
          "lake" &&
        initialSources.water.find((source) => source.id === ids.river)?.kind ===
          "river" &&
        initialSources.houses[0].house_id === ids.house,
      initialSources,
    );
    recordCheck(
      "water: prepared source identities match an independent SQLite dependency digest",
      initialSources.dependencies.every(
        (entry) => entry.sourceIdentity === entry.currentIdentity,
      ) &&
        identitiesMatch(initial, initialSources) &&
        expectedWater(initial, "current"),
    );
    recordCheck(
      "water: original lake clips dry terrain and preserves its real island hole",
      waterPixel(initialImage.pixels[0]) &&
        landPixel(initialImage.pixels[1]) &&
        landPixel(initialImage.pixels[2]) &&
        waterPixel(initialImage.pixels[3]) &&
        near(initialSources.natural[0], 28.4) &&
        near(initialSources.natural[1], 33.8) &&
        near(initialSources.natural[2], 29.2),
      initialImage,
    );
    const riverPoint = initial.surfaces.points[3];
    recordCheck(
      "water: confirmed river bed lowers the current surface below its fixed water profile",
      near(initialSources.natural[3], 35.4) &&
        near(riverPoint?.naturalHeight, initialSources.natural[3]) &&
        near(riverPoint?.riverBedHeight, 33) &&
        near(riverPoint?.waterLevel, 35) &&
        riverPoint?.wet === true,
      riverPoint,
    );
    recordCheck(
      "water: the ordinary panel exposes current water and foundation heights",
      (await statusText(page, "Aktuell")) &&
        (await page.getByText(/Fundamentbasis/).count()) > 0 &&
        (await page.getByText(/Fundamentoberkante/).count()) > 0 &&
        foundation(initial)?.ready === true &&
        near(foundation(initial).top - foundation(initial).base, 1),
    );
    recordCheck(
      "water: the dry river-bank transition uses the proven terrain base rather than the building top",
      near(foundation(initial).base, 35.83153278908144, 1.1e-4) &&
        transitionMatches(initial, initialSources),
      initial.surfaces.points[5],
    );
    const adjust = page.getByRole("button", {
      name: "Gewässer an Gelände anpassen",
      exact: true,
    });
    recordCheck(
      "water: the ordinary panel exposes the explicit terrain-adaptation action",
      (await adjust.count()) === 1,
    );

    // A large but legal upper-edge setting must leave the base and its terrain
    // transition untouched. A later terrain edit supplies the visible change.
    await button(page, /Haus auswählen$/);
    await click(page, [132, 55]);
    await page.getByLabel("Fundamenthöhe", { exact: true }).fill("30.48");
    await page.getByLabel("Fundamenthöhe", { exact: true }).press("Enter");
    await settled(page);
    await click(page, [-500, -300]);
    const configured = (evidence.configured = await settled(page));
    const configuredImage = (evidence.images.configured = await image(
      session,
      "water-foundation-configured",
    ));
    recordCheck(
      "water: foundation height changes the upper edge in one action while its terrain base and transition remain unchanged",
      configured.document.sequence === initial.document.sequence + 1 &&
        configured.document.historyActions ===
          initial.document.historyActions + 1 &&
        near(foundation(configured).base, foundation(initial).base) &&
        near(foundation(configured).top - foundation(configured).base, 100) &&
        near(
          configured.surfaces.points[5].surfaceHeight,
          initial.surfaces.points[5].surfaceHeight,
        ) &&
        pixelDistance(configuredImage.pixels[5], initialImage.pixels[5]) <= 1 &&
        pixelDistance(configuredImage.pixels[4], initialImage.pixels[4]) <= 2,
    );
    await button(page, /Rückgängig/);
    const foundationUndo = await settled(page);
    const foundationUndoImage = (evidence.images.foundationUndo = await image(
      session,
      "water-foundation-undone",
    ));
    recordCheck(
      "water: shared Undo restores the upper edge while retaining the same terrain pixels",
      near(foundation(foundationUndo).top, foundation(initial).top) &&
        samePixels(foundationUndoImage.pixels, initialImage.pixels),
    );
    await button(page, /Wiederholen/);
    const a = (evidence.a = await settled(page));
    const aImage = (evidence.images.a = await image(session, "water-a"));
    const aSources = (evidence.aSources = await saveAs(session, files.a));
    recordCheck(
      "water: foundation derivation leaves every height and water author unchanged",
      aSources.heightDigest === initialSources.heightDigest &&
        aSources.waterDigest === initialSources.waterDigest &&
        near(foundation(a).top, foundation(configured).top) &&
        transitionMatches(a, aSources) &&
        expectedWater(a, "current") &&
        identitiesMatch(a, aSources) &&
        samePixels(aImage.pixels, configuredImage.pixels),
    );

    const b = (evidence.b = await terrainClick(page, "raise", 2400));
    const bImage = (evidence.images.b = await image(session, "water-b"));
    recordCheck(
      "water: coarse terrain edit dries the lake without removing the confirmed profile",
      b.document.sequence === a.document.sequence + 1 &&
        b.document.historyActions === a.document.historyActions + 1 &&
        b.brush.level > 0 &&
        landPixel(bImage.pixels[0]) &&
        waterPixel(bImage.pixels[3]) &&
        !samePixels([bImage.pixels[0]], [aImage.pixels[0]]),
      bImage,
    );
    recordCheck(
      "water: current foundation follows changed terrain while confirmed water becomes stale",
      expectedWater(b, "stale") &&
        (await statusText(page, "Veraltet")) &&
        foundation(b)?.ready === true &&
        foundation(b).base > foundation(a).base + 1 &&
        near(foundation(b).top - foundation(b).base, 100) &&
        pixelDistance(bImage.pixels[5], aImage.pixels[5]) > 0,
    );
    const bSources = (evidence.bSources = await saveAs(session, files.b));
    recordCheck(
      "water: terrain changes preserve exact mask, level, profile and house author bytes",
      bSources.heightDigest !== aSources.heightDigest &&
        bSources.waterDigest === aSources.waterDigest &&
        bSources.houseDigest === aSources.houseDigest &&
        bSources.dependencies.every(
          (entry) => entry.sourceIdentity !== entry.currentIdentity,
        ) &&
        identitiesMatch(b, bSources) &&
        transitionMatches(b, bSources) &&
        bSources.natural[0] > 32,
      bSources,
    );

    await button(page, /Rückgängig/);
    const undo = (evidence.undo = await settled(page));
    const undoImage = (evidence.images.undo = await image(
      session,
      "water-undo-a",
    ));
    const undoSources = (evidence.undoSources = await saveAs(
      session,
      files.undo,
    ));
    recordCheck(
      "water: Undo restores source A and its dependency identity despite a newer execution revision",
      undo.document.revision > b.document.revision &&
        undo.document.sequence === b.document.sequence + 1 &&
        undoSources.heightDigest === aSources.heightDigest &&
        undoSources.waterDigest === aSources.waterDigest &&
        undoSources.houseDigest === aSources.houseDigest &&
        same(undoSources.dependencies, aSources.dependencies) &&
        expectedWater(undo, "current") &&
        identitiesMatch(undo, undoSources) &&
        (await statusText(page, "Aktuell")) &&
        near(foundation(undo).top, foundation(a).top) &&
        samePixels(undoImage.pixels, aImage.pixels),
    );
    await button(page, /Wiederholen/);
    const redo = (evidence.redo = await settled(page));
    const redoImage = (evidence.images.redo = await image(
      session,
      "water-redo-b",
    ));
    recordCheck(
      "water: Redo restores B, stale dependencies and the same visible result",
      redo.document.sequence === undo.document.sequence + 1 &&
        expectedWater(redo, "stale") &&
        identitiesMatch(redo, bSources) &&
        near(foundation(redo).top, foundation(b).top) &&
        samePixels(redoImage.pixels, bImage.pixels),
    );

    // Several ordinary low-dose clicks can re-expose the retained local lake.
    // Each click is a complete real action; no accepted path or time is altered.
    const lowering = (evidence.lowering = []);
    let lowerImage;
    for (let index = 0; index < 8; index++) {
      const state = await terrainClick(page, "lower", 480);
      lowerImage = await image(session, `water-lowered-${index + 1}`);
      lowering.push({ state, image: lowerImage });
      if (waterPixel(lowerImage.pixels[0])) break;
    }
    const lowerSources = (evidence.lowerSources = await saveAs(
      session,
      files.lower,
    ));
    recordCheck(
      "water: later lowering reveals the retained local mask without a water author edit",
      waterPixel(lowerImage.pixels[0]) &&
        lowerSources.natural[0] > 0 &&
        lowerSources.natural[0] < 32 &&
        lowerSources.waterDigest === aSources.waterDigest &&
        lowerSources.houseDigest === aSources.houseDigest,
      { lowerSources, image: lowerImage },
    );
    for (let index = 0; index < lowering.length; index++) {
      await button(page, /Rückgängig/);
      await settled(page);
    }
    const finalState = (evidence.final = await settled(page));
    const finalImage = (evidence.images.final = await image(
      session,
      "water-final-stale",
    ));
    const finalSources = (evidence.finalSources = await saveAs(
      session,
      files.b,
    ));
    recordCheck(
      "water: undoing the later terrain actions restores the unchanged saved B state",
      finalSources.heightDigest === bSources.heightDigest &&
        same(finalSources.dependencies, bSources.dependencies) &&
        expectedWater(finalState, "stale") &&
        samePixels(finalImage.pixels, bImage.pixels),
    );

    const panBox = await page.locator("canvas").boundingBox();
    if (!panBox)
      throw new Error("Canvas is unavailable for cold water navigation");
    for (let index = 0; index < 2; index++) {
      await page.mouse.move(
        panBox.x + panBox.width - 60,
        panBox.y + panBox.height / 2,
      );
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(panBox.x + 60, panBox.y + panBox.height / 2, {
        steps: 8,
      });
      await page.mouse.up({ button: "middle" });
      await settled(page);
    }
    const away = (evidence.away = await settled(page));
    recordCheck(
      "water: distant navigation releases local water and foundation residency",
      away.surfaces.water.length === 0 &&
        away.surfaces.foundations.length === 0 &&
        away.document.sequence === finalState.document.sequence,
    );
    const beforeColdRead = await page.evaluate(() =>
      window.atlasDesktop.metrics(),
    );
    await button(page, "Nahansicht");
    const cold = (evidence.cold = await settled(page));
    const afterColdRead = await page.evaluate(() =>
      window.atlasDesktop.metrics(),
    );
    const coldImage = (evidence.images.cold = await image(
      session,
      "water-cold-return",
    ));
    recordCheck(
      "water: cold return reloads stable dependencies and derives the current surface locally",
      afterColdRead.reads > beforeColdRead.reads &&
        identitiesMatch(cold, bSources) &&
        expectedWater(cold, "stale") &&
        near(foundation(cold).top, foundation(b).top) &&
        cold.document.sequence === finalState.document.sequence &&
        samePixels(coldImage.pixels, bImage.pixels),
      { beforeColdRead, afterColdRead },
    );

    const previousSessionId = cold.sessionId;
    await button(page, "Neu");
    const empty = await settled(page, previousSessionId);
    recordCheck(
      "water: New removes the prepared sources and their derived status",
      empty.surfaces.water.length === 0 &&
        empty.surfaces.foundations.length === 0 &&
        empty.houses.headers.length === 0,
    );
    await button(page, "Öffnen");
    await settled(page, empty.sessionId);
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    const reopened = (evidence.reopened = await settled(page));
    const reopenedImage = (evidence.images.reopened = await image(
      session,
      "water-reopened-stale",
    ));
    recordCheck(
      "water: ordinary Open preserves stale identity, clipping, confirmed profile and foundation",
      expectedWater(reopened, "stale") &&
        identitiesMatch(reopened, bSources) &&
        (await statusText(page, "Veraltet")) &&
        near(foundation(reopened).top, foundation(b).top) &&
        samePixels(reopenedImage.pixels, bImage.pixels),
    );
    recordCheck(
      "water: editing and reopening cause no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
    await session.close();

    // The product itself must render and explain a stale saved scene without
    // any diagnostic entry point or host observation binding.
    session = await launch({ label: "water-restart", project: files.b });
    await button(session.page, "Nahansicht");
    await session.page.getByLabel("Raster anzeigen").uncheck();
    const restartBox = await session.page.locator("canvas").boundingBox();
    if (!restartBox) throw new Error("Restarted water canvas is unavailable");
    await session.page.mouse.move(restartBox.x + 20, restartBox.y + 20);
    const deadline = Date.now() + 30_000;
    let restarted;
    do {
      restarted = await captureCanvas(
        session,
        "water-restarted",
        bImage.screenPoints,
      );
      if (
        samePixels(restarted.pixels, bImage.pixels) &&
        (await statusText(session.page, "Veraltet"))
      )
        break;
      await session.page.waitForTimeout(100);
    } while (Date.now() < deadline);
    evidence.images.restarted = restarted;
    recordCheck(
      "water: fresh ordinary process preserves stale status and all saved surface pixels",
      samePixels(restarted.pixels, bImage.pixels) &&
        (await statusText(session.page, "Veraltet")),
    );
    recordCheck(
      "water: fresh process has no diagnostic binding or renderer exception",
      session.errors.length === 0 &&
        (await session.page.evaluate(
          () =>
            typeof window.atlasObserve === "undefined" &&
            window.atlasDesktop.diagnostics === false,
        )) &&
        (await session.app.evaluate(
          () => typeof globalThis.__atlasHost === "undefined",
        )),
      session.errors,
    );
    await button(session.page, "Gewässerszene öffnen");
    await button(session.page, "Nahansicht");
    await session.page.getByLabel("Raster anzeigen").uncheck();
    const templateDeadline = Date.now() + 30_000;
    let ordinaryTemplate;
    do {
      ordinaryTemplate = await captureCanvas(
        session,
        "water-ordinary-template",
        initialImage.screenPoints,
      );
      if (
        samePixels(ordinaryTemplate.pixels, initialImage.pixels) &&
        (await statusText(session.page, "Aktuell"))
      )
        break;
      await session.page.waitForTimeout(100);
    } while (Date.now() < templateDeadline);
    evidence.images.ordinaryTemplate = ordinaryTemplate;
    recordCheck(
      "water: a fresh ordinary process can open the prepared scene through its normal UI",
      samePixels(ordinaryTemplate.pixels, initialImage.pixels) &&
        (await statusText(session.page, "Aktuell")) &&
        session.errors.length === 0,
    );
    const afterRestart = (evidence.afterRestart = electronNode([
      self,
      "inspect",
      files.b,
    ]));
    recordCheck(
      "water: source inspection and process restart leave saved author bytes unchanged",
      afterRestart.waterDigest === bSources.waterDigest &&
        afterRestart.houseDigest === bSources.houseDigest &&
        afterRestart.heightDigest === bSources.heightDigest &&
        same(afterRestart.dependencies, bSources.dependencies),
    );
  } catch (error) {
    evidence.error = String(error);
    try {
      evidence.failure = await stateSnapshot(session.page, probes);
    } catch (captureError) {
      evidence.failureObservationError = String(captureError);
    }
    throw error;
  } finally {
    await writeFile(
      join(out, "water-evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    await session.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === self &&
  process.argv[2] === "inspect"
)
  console.log(JSON.stringify(inspect(resolve(process.argv[3]))));
