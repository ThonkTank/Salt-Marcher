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
  position,
  navigateTo,
  setRangeValue,
  stateSnapshot,
  storeActivityPosition,
  waitForSaveCompletion,
  waterPixel,
} from "./atlas-p0-interactions.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const self = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const origin = [500, 200];
const movement = [300, 200];
const destination = origin.map((value, index) => value + movement[index]);
// At 90 degrees a 200 by 100 foot rectangle covers the second probe but not
// the first. These independent world probes do not call product geometry.
const probes = [
  [origin[0] + 70, origin[1] + 10],
  [origin[0] + 10, origin[1] + 70],
  [destination[0] + 20, destination[1] + 30],
  [destination[0] + 150, destination[1]],
];
const samePixel = (a, b) =>
  a?.length === 4 &&
  b?.length === 4 &&
  a.every((value, index) => Math.abs(value - b[index]) <= 2);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, tolerance = 0.000001) =>
  Number.isFinite(a) && Math.abs(a - b) <= tolerance;
const sameHouse = (a, b) =>
  a &&
  b &&
  [
    "id",
    "revision",
    "x",
    "y",
    "width",
    "depth",
    "rotation",
    "foundationHeight",
    "foundationTransition",
  ].every((key) =>
    typeof a[key] === "number" ? near(a[key], b[key]) : a[key] === b[key],
  );

function electronNode(args) {
  const result = spawnSync(require("electron"), args, {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `House fixture process failed: ${result.error ?? result.stderr}`,
    );
  return JSON.parse(result.stdout);
}

/** Inspect the saved SQLite author rows directly, without the product reader. */
function inspect(file) {
  const Database = require("better-sqlite3");
  const database = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const headers = database
      .prepare(
        `SELECT house_id AS id, revision, x, y, width, depth, rotation,
           foundation_height AS foundationHeight,
           foundation_transition AS foundationTransition
         FROM house_headers ORDER BY house_id`,
      )
      .all();
    const rawHeaders = database
      .prepare("SELECT * FROM house_headers ORDER BY house_id")
      .all();
    const heightHash = createHash("sha256");
    for (const row of database
      .prepare(
        "SELECT level, tile_x, tile_y, values_blob FROM height_tiles ORDER BY level, tile_x, tile_y",
      )
      .iterate()) {
      heightHash.update(`${row.level}:${row.tile_x}:${row.tile_y}\0`);
      heightHash.update(row.values_blob);
    }
    const spatialAt = ([x, y]) =>
      database
        .prepare(
          `SELECT h.house_id FROM house_spatial s
           JOIN house_headers h ON h.row_id = s.row_id
           WHERE s.min_x <= ? AND s.max_x >= ?
             AND s.min_y <= ? AND s.max_y >= ?
             AND h.min_x <= ? AND h.max_x >= ?
             AND h.min_y <= ? AND h.max_y >= ?
           ORDER BY h.house_id`,
        )
        .all(x, x, y, y, x, x, y, y)
        .map((row) => row.house_id);
    return {
      headers,
      rawHeaders,
      headerDigest: createHash("sha256")
        .update(JSON.stringify(rawHeaders))
        .digest("hex"),
      heightDigest: heightHash.digest("hex"),
      oldPosition: spatialAt(origin),
      newPosition: spatialAt(destination),
    };
  } finally {
    database.close();
  }
}

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
        state.houses?.ready === true &&
        !state.state.writing &&
        !state.state.fileAction
      );
    },
    null,
    { timeout: 30_000 },
  );
  return stateSnapshot(page);
}

async function number(page, label, value) {
  await setRangeValue(page, label, value);
  await settled(page);
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
  await pointer(page, point);
  await page.mouse.down();
  await page.mouse.up();
  return settled(page);
}

async function drag(page, from, to, release = true) {
  await pointer(page, from);
  const target = await position(page, to);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  if (release) {
    await page.mouse.up();
    return settled(page);
  }
  await page.waitForFunction(
    (from) => {
      const state = window.atlasObserve([], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      return (
        state.document.active &&
        state.houses.headers.some(
          (header) => Math.hypot(header.x - from[0], header.y - from[1]) > 100,
        )
      );
    },
    from,
    { timeout: 30_000 },
  );
  return stateSnapshot(page);
}

async function image(session, name) {
  const box = await session.page.locator("canvas").boundingBox();
  if (!box) throw new Error("House canvas is unavailable");
  await session.page.mouse.move(box.x + 20, box.y + 20);
  await settled(session.page);
  return capture(session, name, probes);
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
    throw new Error("House save did not start");
  }, since);
  await waitForSaveCompletion(session, start);
  await settled(session.page);
}

export async function runHouseScenario({ launch, out, recordCheck }) {
  const fixtures = electronNode([
    join(root, "scripts/atlas-p0-fixture.mjs"),
    "create",
    join(out, "house-fixture"),
  ]);
  const beforeTerrainFile = join(out, "house-before-terrain.saltatlas");
  const finalFile = join(out, "house-final.saltatlas");
  const evidence = {
    purpose:
      "P3.2 real header/gesture/file content, no native performance acceptance",
    images: {},
  };
  let session = await launch({
    label: "house-edit",
    diagnostics: true,
    project: fixtures.files.coast,
    env: { ATLAS_P0_DIALOG_OPEN: finalFile },
  });
  try {
    const { page } = session;
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    await button(page, /Haus platzieren$/);
    await number(page, "Hausbreite", 60.96);
    await number(page, "Haustiefe", 30.48);
    await number(page, "Hausdrehung", 0);
    await number(page, "Fundamenthöhe", 0.6096);
    await number(page, "Fundamentübergang", 3.048);
    const initial = (evidence.initial = await settled(page));
    const base = (evidence.images.base = await image(session, "house-base"));
    const originalFile = (evidence.originalFile = electronNode([
      self,
      "inspect",
      fixtures.files.coast,
    ]));
    recordCheck(
      "house: real coast starts without header authors",
      initial.houses.headers.length === 0 && originalFile.headers.length === 0,
    );

    const placedState = (evidence.placed = await click(page, origin));
    const placed = placedState.houses.headers[0];
    recordCheck(
      "house: real placement records one shared action and stable header",
      placedState.houses.headers.length === 1 &&
        typeof placed?.id === "string" &&
        placed.id.length > 0 &&
        placedState.document.sequence === initial.document.sequence + 1 &&
        placedState.document.historyActions ===
          initial.document.historyActions + 1 &&
        near(placed.x, origin[0], 2.1) &&
        near(placed.y, origin[1], 2.1) &&
        near(placed.width, 200) &&
        near(placed.depth, 100) &&
        placed.rotation === 0 &&
        near(placed.foundationHeight, 2) &&
        near(placed.foundationTransition, 10),
      placed,
    );
    const id = placed.id;
    const flatImage = (evidence.images.placed = await image(
      session,
      "house-placed",
    ));
    recordCheck(
      "house: unrotated rectangle is drawn at its real footprint",
      !samePixel(flatImage.pixels[0], base.pixels[0]) &&
        samePixel(flatImage.pixels[1], base.pixels[1]),
    );
    await button(page, /Haus auswählen$/);
    const selected = await click(page, [placed.x, placed.y]);
    recordCheck(
      "house: selection without movement creates no history action",
      selected.houses.selectedId === id &&
        selected.document.sequence === placedState.document.sequence,
    );
    await number(page, "Hausdrehung", 90);
    const rotatedState = (evidence.rotated = await settled(page));
    const rotated = rotatedState.houses.headers.find(
      (header) => header.id === id,
    );
    recordCheck(
      "house: rotation keeps identity and uses the shared journal",
      rotated?.rotation === 90 &&
        rotatedState.document.sequence === selected.document.sequence + 1,
    );
    const rotatedImage = (evidence.images.rotated = await image(
      session,
      "house-rotated",
    ));
    await page.screenshot({
      path: join(session.directory, "house-editor.png"),
    });
    recordCheck(
      "house: rotation removes the old footprint and draws the new footprint",
      samePixel(rotatedImage.pixels[0], base.pixels[0]) &&
        !samePixel(rotatedImage.pixels[1], base.pixels[1]),
    );

    await number(page, "Hausdrehung", 45);
    const beforeMiss = await settled(page);
    const missed = await click(page, [placed.x + 95, placed.y + 95]);
    recordCheck(
      "house: selection rejects an AABB corner outside the rotated rectangle",
      missed.houses.selectedId === null &&
        missed.document.sequence === beforeMiss.document.sequence,
    );
    await click(page, [placed.x, placed.y]);
    await number(page, "Hausdrehung", 90);
    const beforeDrag = (evidence.beforeDrag = await settled(page));
    const starting = beforeDrag.houses.headers.find(
      (header) => header.id === id,
    );
    const target = [starting.x + movement[0], starting.y + movement[1]];
    const preview = (evidence.preview = await drag(
      page,
      [starting.x, starting.y],
      target,
      false,
    ));
    // Document motion alone is insufficient: wait for the real held preview.
    let previewImage;
    const previewDeadline = Date.now() + 10_000;
    do {
      previewImage = await capture(session, "house-drag-preview", probes);
      if (!samePixel(previewImage.pixels[2], base.pixels[2])) break;
      await page.waitForTimeout(50);
    } while (Date.now() < previewDeadline);
    evidence.images.preview = previewImage;
    recordCheck(
      "house: drag changes the actual visible header before Up",
      preview.document.active &&
        preview.document.sequence === beforeDrag.document.sequence &&
        !samePixel(previewImage.pixels[2], base.pixels[2]),
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    const cancelled = (evidence.cancelled = await settled(page));
    const cancelledImage = (evidence.images.cancelled = await image(
      session,
      "house-drag-cancelled",
    ));
    recordCheck(
      "house: Escape restores exact header and pixels without a transaction",
      sameHouse(
        cancelled.houses.headers.find((header) => header.id === id),
        starting,
      ) &&
        cancelled.document.sequence === beforeDrag.document.sequence &&
        cancelled.document.historyActions ===
          beforeDrag.document.historyActions &&
        samePixel(cancelledImage.pixels[1], rotatedImage.pixels[1]) &&
        samePixel(cancelledImage.pixels[2], base.pixels[2]),
    );
    const movedState = (evidence.moved = await drag(
      page,
      [starting.x, starting.y],
      target,
    ));
    const moved = movedState.houses.headers.find((header) => header.id === id);
    recordCheck(
      "house: accepted drag moves the same header in one action",
      moved &&
        near(moved.x, target[0], 2.1) &&
        near(moved.y, target[1], 2.1) &&
        moved.rotation === 90 &&
        movedState.document.sequence === beforeDrag.document.sequence + 1,
    );
    const movedImage = (evidence.images.moved = await image(
      session,
      "house-moved",
    ));
    recordCheck(
      "house: completed move clears the former footprint and draws its destination",
      samePixel(movedImage.pixels[1], base.pixels[1]) &&
        !samePixel(movedImage.pixels[2], base.pixels[2]),
    );
    await button(page, /Rückgängig/);
    const undoMove = await settled(page);
    recordCheck(
      "house: Undo restores original pose and identity",
      sameHouse(
        undoMove.houses.headers.find((header) => header.id === id),
        starting,
      ),
    );
    await button(page, /Wiederholen/);
    const redoMove = await settled(page);
    recordCheck(
      "house: Redo restores the same moved author",
      sameHouse(
        redoMove.houses.headers.find((header) => header.id === id),
        moved,
      ),
    );

    await saveAs(session, beforeTerrainFile);
    const beforeTerrain = (evidence.beforeTerrain = electronNode([
      self,
      "inspect",
      beforeTerrainFile,
    ]));
    recordCheck(
      "house: saved SQLite contains the observed header and only its new spatial location",
      beforeTerrain.headers.length === 1 &&
        sameHouse(beforeTerrain.headers[0], moved) &&
        beforeTerrain.oldPosition.length === 0 &&
        same(beforeTerrain.newPosition, [id]),
    );
    recordCheck(
      "house: placement and movement leave every height payload unchanged",
      beforeTerrain.heightDigest === originalFile.heightDigest,
    );

    await click(page, [0, -300]); // Clear selection before testing residency.
    const panBox = await page.locator("canvas").boundingBox();
    if (!panBox) throw new Error("Canvas is unavailable for cold pan");
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
      "house: leaving the region evicts confirmed header sources",
      away.houses.headers.length === 0 && away.document.readyHouses === 0,
    );
    const beforeColdRead = await page.evaluate(() =>
      window.atlasDesktop.metrics(),
    );
    await navigateTo(page, [initial.camera.x, initial.camera.y]);
    await page.getByText("Zu Koordinaten", { exact: true }).click();
    await button(page, "Nahansicht");
    const cold = (evidence.cold = await settled(page));
    const afterColdRead = await page.evaluate(() =>
      window.atlasDesktop.metrics(),
    );
    recordCheck(
      "house: returning cold reloads the unchanged header through the store",
      sameHouse(
        cold.houses.headers.find((header) => header.id === id),
        moved,
      ) &&
        cold.document.readyHouses === 1 &&
        afterColdRead.reads > beforeColdRead.reads,
      { before: beforeColdRead, after: afterColdRead },
    );

    await brush(page, 128, 10000);
    await heightMode(page, "lower");
    await pointer(page, [moved.x, moved.y]);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await settled(page);
    const lowered = (evidence.images.lowered = await image(
      session,
      "house-terrain-lowered",
    ));
    recordCheck(
      "house: a real height edit visibly changes terrain alongside the house",
      waterPixel(lowered.pixels[3]) &&
        !samePixel(lowered.pixels[3], movedImage.pixels[3]),
    );
    await saveAs(session, finalFile);
    const afterTerrain = (evidence.afterTerrain = electronNode([
      self,
      "inspect",
      finalFile,
    ]));
    recordCheck(
      "house: terrain changes preserve every saved header byte and foundation setting",
      afterTerrain.headerDigest === beforeTerrain.headerDigest &&
        afterTerrain.heightDigest !== beforeTerrain.heightDigest,
    );
    await button(page, /Rückgängig/);
    const undoTerrainImage = (evidence.images.undoTerrain = await image(
      session,
      "house-terrain-undone",
    ));
    recordCheck(
      "house: shared Undo restores terrain without changing the house",
      sameHouse(
        (await settled(page)).houses.headers.find((header) => header.id === id),
        moved,
      ) && samePixel(undoTerrainImage.pixels[3], movedImage.pixels[3]),
    );
    await button(page, /Rückgängig/);
    recordCheck(
      "house: the next shared Undo reaches the prior house movement",
      sameHouse(
        (await settled(page)).houses.headers.find((header) => header.id === id),
        starting,
      ),
    );
    await button(page, /Wiederholen/);
    recordCheck(
      "house: shared Redo restores house movement before the terrain action",
      sameHouse(
        (await settled(page)).houses.headers.find((header) => header.id === id),
        moved,
      ),
    );
    await button(page, /Wiederholen/);
    const finalImage = (evidence.images.final = await image(
      session,
      "house-final",
    ));
    recordCheck(
      "house: mixed Redo returns identical house and terrain pixels",
      finalImage.pixels.every((pixel, index) =>
        samePixel(pixel, lowered.pixels[index]),
      ),
    );
    await saveAs(session, finalFile);

    const priorSessionId = (await stateSnapshot(page)).sessionId;
    await button(page, "Neu");
    // Rendering the old document exactly does not certify a completed New/Open.
    const empty = await settled(page, priorSessionId);
    recordCheck(
      "house: New discards previous header residency and selection",
      empty.houses.headers.length === 0 && empty.houses.selectedId === null,
    );
    await button(page, "Öffnen");
    await settled(page, empty.sessionId);
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    const reopened = (evidence.reopened = await settled(page));
    const reopenImage = (evidence.images.reopened = await image(
      session,
      "house-reopened",
    ));
    recordCheck(
      "house: ordinary Open restores stable ID, complete author settings and pixels",
      sameHouse(
        reopened.houses.headers.find((header) => header.id === id),
        moved,
      ) &&
        reopenImage.pixels.every((pixel, index) =>
          samePixel(pixel, finalImage.pixels[index]),
        ),
    );
    recordCheck(
      "house: editing and reopening have no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
    await session.close();

    session = await launch({ label: "house-restart", project: finalFile });
    await button(session.page, "Nahansicht");
    await session.page.getByLabel("Raster anzeigen").uncheck();
    const restartBox = await session.page.locator("canvas").boundingBox();
    if (!restartBox) throw new Error("Restarted house canvas is unavailable");
    await session.page.mouse.move(restartBox.x + 20, restartBox.y + 20);
    const deadline = Date.now() + 30_000;
    let restarted;
    do {
      restarted = await captureCanvas(
        session,
        "house-restarted",
        finalImage.screenPoints,
      );
      if (
        restarted.pixels.every((pixel, index) =>
          samePixel(pixel, finalImage.pixels[index]),
        )
      )
        break;
      await session.page.waitForTimeout(100);
    } while (Date.now() < deadline);
    evidence.images.restarted = restarted;
    recordCheck(
      "house: fresh ordinary process restores saved house and terrain pixels",
      restarted.pixels.every((pixel, index) =>
        samePixel(pixel, finalImage.pixels[index]),
      ),
    );
    recordCheck(
      "house: restart has no diagnostic binding or renderer exception",
      session.errors.length === 0 &&
        (await session.page.evaluate(
          () => typeof window.atlasObserve === "undefined",
        )),
      session.errors,
    );
    const finalSources = (evidence.finalSources = electronNode([
      self,
      "inspect",
      finalFile,
    ]));
    recordCheck(
      "house: restart leaves the saved author rows unchanged",
      finalSources.headerDigest === afterTerrain.headerDigest &&
        finalSources.heightDigest === afterTerrain.heightDigest,
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
      join(out, "house-evidence.json"),
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
