const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const dd041 = require("../../dd041-host-navigation.cjs");

const mapPath = "Dungeons/NavigationQA/Karte.dungeon";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const close = (a, b) => Math.abs(a - b) <= 0.03;
const rectBounds = (points) => ({
  minX: Math.min(...points.map((point) => point.x)),
  maxX: Math.max(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxY: Math.max(...points.map((point) => point.y)),
});
const boundsNear = (actual, expected) => actual &&
  Object.entries(expected).every(([key, value]) => close(actual[key], value));
const buildingBounds = (snapshot, expected) => snapshot.document.entities
  .filter((entity) => entity.kind === "building")
  .flatMap((entity) => entity.polygons.map((polygon) => rectBounds(polygon.outer)))
  .find((bounds) => boundsNear(bounds, expected));

function changedPixels(before, after) {
  const a = PNG.sync.read(before), b = PNG.sync.read(after);
  assert.equal(a.width, b.width, "Grid screenshots have the same width");
  assert.equal(a.height, b.height, "Grid screenshots have the same height");
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3])
      changed++;
  return changed;
}

module.exports = async function navigationGroup({ page, out, qa, restart, group, record }) {
  const savedPath = path.join(qa, "group-saved.json");
  const snap = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    return editor && {
      document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize,
      camera: { x: editor.renderer.camera.x, y: editor.renderer.camera.y,
        scale: editor.renderer.camera.scale },
      renderCount: editor.renderer.renderCount,
      paintActive: !!editor.paintWorker,
    };
  });
  const stable = (a, b) => same(a.document, b.document) &&
    a.dirty === b.dirty && a.history === b.history && same(a.camera, b.camera);
  const gap = (id) => group.originalGaps[id];
  assert(gap("DD-048.05") && gap("DD-048.06"), "Native Grid/Snap gaps stay explicit");
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    assert.equal(saved.mapPath, mapPath);
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const reopened = await snap();
    const persisted = !reopened.dirty &&
      same(reopened.document, saved.document);
    const offBounds = buildingBounds(reopened, saved.snap.off.expected);
    const onBounds = buildingBounds(reopened, saved.snap.on.expected);
    const geometryPersisted = !!offBounds && !!onBounds;
    const evidencePath = path.join(out, "reopened.json");
    fs.writeFileSync(evidencePath, JSON.stringify({ saved, reopened, persisted,
      geometryPersisted, offBounds, onBounds }, null, 2) + "\n");
    for (const id of ["DD-041.02", "DD-041.03", "DD-041.04"])
      record.add(id, persisted ? "pass" : "fail",
        "Die nach Navigation gespeicherte Karte wurde im frischen Hostprozess ohne Kartenänderung geöffnet.",
        [evidencePath]);
    record.add("DD-048.05", persisted && saved.grid.hostPassed ? "open" : "fail",
      `Host: Grid OFF/ON dokumentfrei=${saved.grid.documentStable}, sichtbare Pixel=${saved.grid.offPixels}, Wiederherstellung=${saved.grid.restorePixels}; Karte frisch geöffnet=${persisted}.`,
      [savedPath, evidencePath], persisted && saved.grid.hostPassed ? gap("DD-048.05") : null);
    record.add("DD-048.06", persisted && geometryPersisted && saved.snap.hostPassed ? "open" : "fail",
      `Host: Snap-OFF-Kontur=${JSON.stringify(offBounds)}, Snap-ON-Kontur=${JSON.stringify(onBounds)}; Undo/Redo=${saved.snap.historyPassed}; frisch geöffnet=${persisted && geometryPersisted}.`,
      [savedPath, evidencePath], persisted && geometryPersisted && saved.snap.hostPassed ? gap("DD-048.06") : null);
    return;
  }

  const result = await dd041({ page, out });
  const evidencePath = path.join(out, "dd041-navigation-result.json");
  for (const id of ["DD-041.02", "DD-041.03", "DD-041.04"]) {
    const observations = result.records.filter((item) => item.caseId === id);
    const passed = observations.length > 0 && observations.every((item) => item.passed);
    record.add(id, passed ? "pass" : "fail",
      `${observations.length} Navigationsteilprüfungen; Kamera, Weltpunkt, Karte und Verlauf gemessen.`,
      [evidencePath]);
  }
  const canvas = page.locator(".dn-canvas canvas").last();
  const gridButton = page.locator(".dn-view-toggles").getByRole("button", { name: "Raster", exact: true });
  const snapButton = page.locator(".dn-view-toggles").getByRole("button", { name: "Snap", exact: true });
  const shot = (name) => canvas.screenshot({ path: path.join(out, `${name}.png`) });
  const waitRender = (count) => page.waitForFunction((previous) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    return editor && editor.renderer.renderCount > previous;
  }, count);

  await page.evaluate(() => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    renderer.fit();
    renderer.zoom(64 / renderer.camera.scale);
  });
  const gridBefore = await snap();
  const gridBeforePressed = await gridButton.getAttribute("aria-pressed");
  const gridOnImage = await shot("dd048-grid-on-before");
  await gridButton.click();
  await waitRender(gridBefore.renderCount);
  const gridOff = await snap();
  const gridOffPressed = await gridButton.getAttribute("aria-pressed");
  const gridOffImage = await shot("dd048-grid-off");
  await gridButton.click();
  await waitRender(gridOff.renderCount);
  const gridAgain = await snap();
  const gridAgainPressed = await gridButton.getAttribute("aria-pressed");
  const gridAgainImage = await shot("dd048-grid-on-again");
  const grid = {
    states: [gridBeforePressed, gridOffPressed, gridAgainPressed],
    documentStable: stable(gridBefore, gridOff) && stable(gridBefore, gridAgain),
    offPixels: changedPixels(gridOnImage, gridOffImage),
    restorePixels: changedPixels(gridOnImage, gridAgainImage),
  };
  grid.hostPassed = grid.documentStable && grid.offPixels > 0 &&
    grid.restorePixels === 0 && same(grid.states, ["true", "false", "true"]);

  // Two disjoint building contours expose the exact unsnapped and snapped
  // endpoints without relying on a transient visual preview.
  const at = (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const x = box.x + renderer.camera.x + point.x * renderer.camera.scale;
    const y = box.y + renderer.camera.y + point.y * renderer.camera.scale;
    if (x < box.x || y < box.y || x >= box.right || y >= box.bottom)
      throw new Error(`World point outside canvas: ${point.x},${point.y}`);
    return { x, y };
  }, point);
  const draw = async (mode, start, end, expected) => {
    const before = await snap();
    const a = await at(start), b = await at(end);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction((history) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
      return editor && !editor.paintWorker && editor.session.historySize > history;
    }, before.history, { timeout: 12000 });
    const after = await snap();
    const bounds = buildingBounds(after, expected);
    await shot(`dd048-snap-${mode}`);
    await page.keyboard.press("Control+z");
    const undone = await snap();
    await page.keyboard.press("Control+y");
    const redone = await snap();
    return { expected, bounds, image: path.join(out, `dd048-snap-${mode}.png`),
      geometryPassed: !!bounds,
      historyPassed: same(undone.document, before.document) && same(redone.document, after.document) };
  };
  const snapBefore = await snap();
  const snapBeforePressed = await snapButton.getAttribute("aria-pressed");
  await snapButton.click();
  const snapOff = await snap();
  const offPressed = await snapButton.getAttribute("aria-pressed");
  await page.locator(".dn-group-rail").getByRole("button", { name: "Bauwerk", exact: true }).click();
  await page.locator(".dn-tool-rail").getByRole("button", { name: "Rechteck", exact: true }).click();
  const off = await draw("off", { x: 1.2, y: 1.2 }, { x: 3.7, y: 2.8 },
    { minX: 1.2, maxX: 3.7, minY: 1.2, maxY: 2.8 });
  const beforeSnapOn = await snap();
  await snapButton.click();
  const snapOn = await snap();
  const onPressed = await snapButton.getAttribute("aria-pressed");
  const on = await draw("on", { x: 8.2, y: 4.2 }, { x: 10.7, y: 6.8 },
    { minX: 8, maxX: 11, minY: 4, maxY: 7 });
  const snapResult = { off, on, states: [snapBeforePressed, offPressed, onPressed],
    switchStable: stable(snapBefore, snapOff) && stable(beforeSnapOn, snapOn),
    historyPassed: off.historyPassed && on.historyPassed };
  snapResult.hostPassed = snapResult.switchStable &&
    same(snapResult.states, ["true", "false", "true"]) &&
    off.geometryPassed && on.geometryPassed && snapResult.historyPassed;

  await page.evaluate(async () => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    await editor.save();
  });
  const saved = await snap();
  assert(saved && !saved.dirty, "Grid/Snap drawing left unsaved changes");
  const gridSnapEvidence = path.join(out, "dd048-grid-snap-result.json");
  fs.writeFileSync(gridSnapEvidence, JSON.stringify({ grid, snap: snapResult, saved }, null, 2) + "\n");
  record.add("DD-048.05", grid.hostPassed ? "open" : "fail",
    `Host: Raster OFF verändert ${grid.offPixels} Canvaspixel, ON hat ${grid.restorePixels} abweichende Pixel; Dokument/History/Kamera unverändert=${grid.documentStable}.`,
    [gridSnapEvidence, path.join(out, "dd048-grid-on-before.png"),
      path.join(out, "dd048-grid-off.png"), path.join(out, "dd048-grid-on-again.png")],
    grid.hostPassed ? gap("DD-048.05") : null);
  record.add("DD-048.06", snapResult.hostPassed ? "open" : "fail",
    `Host: Snap OFF=${JSON.stringify(off.bounds)}, ON=${JSON.stringify(on.bounds)}; Schalter dokument-/historyneutral=${snapResult.switchStable}, Undo/Redo=${snapResult.historyPassed}.`,
    [gridSnapEvidence, off.image, on.image], snapResult.hostPassed ? gap("DD-048.06") : null);
  fs.writeFileSync(savedPath, JSON.stringify({ mapPath, ...saved, grid, snap: {
    off: { expected: off.expected }, on: { expected: on.expected },
    hostPassed: snapResult.hostPassed, historyPassed: snapResult.historyPassed,
  } }, null, 2) + "\n");
};
