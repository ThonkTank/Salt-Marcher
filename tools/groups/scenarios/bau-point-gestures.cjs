// Isolated DD-013.02/.03 and DD-014.01/.02 host flow. The coordinator plugs
// its returned four findings into bau-01's existing group recorder. No GUI is
// launched by importing this module.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CASES = ["DD-013.02", "DD-013.03", "DD-014.01", "DD-014.02"];
const PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/grundriss-bau/" +
  "DD015-017-fixtures/qa-wall-pack.dungeondraft_pack";
const PACK_SHA = "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9";
const STATE = "bau-point-gestures-saved.json";
const names = {
  deletion: "BauPointDeleteQA",
  insertion: "BauPointInsertQA",
  portal: "BauPointPortalQA",
};
const mapPath = (name) => `Dungeons/${name}/Karte.dungeon`;
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const contour = (snap, id) => snap?.document?.entities
  .find((entity) => entity.id === id)?.polygons?.[0]?.outer;
const entity = (snap, id) => snap?.document?.entities.find((item) => item.id === id);
const approx = (a, b) => Math.abs(a - b) < 1e-6;
const pointsEqual = (a, b) => same(a, b);
const output = (out, name, value) => {
  const file = path.join(out, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
  return file;
};
const result = (state, observation, gap, evidence) => ({ state, observation, gap, evidence });

function portalPose(building, door) {
  const points = building?.polygons?.[0]?.outer;
  if (!points || door?.anchor?.boundaryId !== building.id) return null;
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  let distance = door.anchor.at * lengths.reduce((a, b) => a + b, 0);
  for (let index = 0; index < points.length; index++) {
    if (distance <= lengths[index] + 1e-8) {
      const start = points[index], end = points[(index + 1) % points.length];
      const t = distance / lengths[index];
      return { x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        edge: index };
    }
    distance -= lengths[index];
  }
  return null;
}

function helpers(page, vault, out) {
  const view = (p) => page.evaluate((p) => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === p);
    if (!leaf?.view?.editor) throw new Error(`QA-Editor fehlt: ${p}`);
    const editor = leaf.view.editor;
    return {
      document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize, selected: editor.selected,
      hover: editor.hoveredBuildingVertex ?? null,
      previewCount: editor.renderer.preview.context.instructions.length,
      previewActions: editor.renderer.preview.context.instructions
        .map((item) => item.action),
      camera: { ...editor.renderer.camera },
    };
  }, p);
  const at = (p, point) => page.evaluate(({ p, point }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === p)?.view.editor;
    if (!editor) throw new Error(`QA-Editor fehlt: ${p}`);
    const r = editor.renderer, box = r.canvas.getBoundingClientRect();
    const x = box.x + r.camera.x + point.x * r.camera.scale;
    const y = box.y + r.camera.y + point.y * r.camera.scale;
    if (x < box.left || y < box.top || x >= box.right || y >= box.bottom)
      throw new Error(`QA-Punkt außerhalb der Zeichenfläche: ${point.x},${point.y}`);
    return { x, y };
  }, { p, point });
  const click = async (p, point) => {
    const pos = await at(p, point);
    await page.mouse.click(pos.x, pos.y);
  };
  const hover = async (p, point, id, index) => {
    const away = await at(p, { x: point.x + 0.4, y: point.y + 0.4 });
    const pos = await at(p, point);
    await page.mouse.move(away.x, away.y);
    await page.mouse.move(pos.x, pos.y);
    await page.waitForFunction(({ p, id, index }) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")
        .find((leaf) => leaf.view.file?.path === p)?.view.editor;
      return editor?.hoveredBuildingVertex?.buildingId === id &&
        editor.hoveredBuildingVertex.index === index;
    }, { p, id, index }, { timeout: 4000 });
  };
  const select = async (p, point, id) => {
    await page.locator(".dn-group-rail").last()
      .getByRole("button", { name: "Auswahl", exact: true }).click();
    await page.locator(".dn-tool-rail").last()
      .getByRole("button", { name: "Auswahl", exact: true }).click();
    await click(p, point);
    await page.waitForFunction(({ p, id }) => app.workspace
      .getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === p)?.view.editor?.selected === id,
    { p, id }, { timeout: 4000 });
  };
  const shot = async (name) => {
    const file = path.join(out, name + ".png");
    await page.screenshot({ path: file });
    return file;
  };
  const render = (p, id) => page.evaluate(({ p, id }) => {
    const visual = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === p)?.view.editor?.renderer.visuals.get(id);
    if (!visual) return null;
    let sprites = 0;
    const walk = (node) => {
      if (node.texture && typeof node.texture !== "function") sprites++;
      for (const child of node.children ?? []) walk(child);
    };
    walk(visual.container);
    return { sprites };
  }, { p, id });
  const history = async (button) => page.locator(".dungeon-native-editor").last()
    .getByRole("button", { name: button, exact: true }).click();
  const save = async (p) => {
    await page.locator(".dungeon-native-editor").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction((p) => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map")
        .find((leaf) => leaf.view.file?.path === p)?.view.editor;
      return !!e && !e.session.dirty;
    }, p, { timeout: 12000 });
    const snap = await view(p);
    return { path: p, document: snap.document, sha256: sha(path.join(vault, p)) };
  };
  const create = async (name, width, height, additions, assets) => {
    const p = mapPath(name);
    await page.evaluate(async ({ name, width, height, additions, assets }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.create(name, width, height,
        { assetPacks: assets ? ["QAWall01"] : [], builtInAssets: true });
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")
        .find((leaf) => leaf.view.file?.path === `Dungeons/${name}/Karte.dungeon`)?.view.editor;
      if (!editor) throw new Error("QA-Karte wurde nicht geöffnet.");
      const floorId = editor.session.document().floors[0].id;
      const entities = additions.map((item) => ({ ...item, floorId }));
      editor.session.execute({ label: "QA-Ausgangsgeometrie",
        entities: entities.map((item) => ({ id: item.id, before: null, after: item })) });
      editor.renderer.fit();
    }, { name, width, height, additions, assets });
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
      await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
    await page.evaluate((p) => app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === p).view.editor.renderer.fit(), p);
    return p;
  };
  return { view, at, click, hover, select, shot, render, history, save, create };
}

async function installWallPack(page) {
  if (sha(PACK) !== PACK_SHA) throw new Error("QAWall01-Paket hat andere Prüfsumme.");
  const bytes = fs.readFileSync(PACK).toString("base64");
  return page.evaluate(async (encoded) => {
    const payload = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.assets.add([new Blob([payload])]);
    await plugin.reloadAssets();
    const asset = plugin.listAssets().find((item) =>
      item.packId === "QAWall01" && item.kind === "wall");
    if (!asset) throw new Error("QAWall01-Wand fehlt im Assetkatalog.");
    return asset.id;
  }, bytes);
}

async function edit({ page, out, qa, vault }) {
  const h = helpers(page, vault, out);
  const details = { phase: "edit", scenes: {}, errors: [] };
  const cases = Object.fromEntries(CASES.map((id) => [id,
    result("open", null, "Die Hostgeste wurde noch nicht vollständig ausgeführt.", [])]));
  const wallAssetId = await installWallPack(page);
  const deletion = { id: "qa-building-delete", kind: "building",
    polygons: [{ outer: [{ x: 10, y: 5 }, { x: 1, y: 5 },
      { x: 1, y: 2 }, { x: 10, y: 2 }], holes: [] }],
    layer: 100, fill: 0x9c8c7a, wall: 0x726e65, wallWidth: 0.22,
    wallAssetId };
  const deletePath = await h.create(names.deletion, 16, 10, [deletion], true);
  await h.select(deletePath, { x: 5, y: 3 }, deletion.id);
  const before = await h.view(deletePath);
  await h.hover(deletePath, { x: 10, y: 2 }, deletion.id, 3);
  const hoverScreen = await h.shot("delete-grip-hover");
  await page.keyboard.press("Backspace");
  const removed = await h.view(deletePath);
  const removedRender = await h.render(deletePath, deletion.id);
  const removedScreen = await h.shot("delete-three-point-result");
  await h.history("Rückgängig");
  const undo = await h.view(deletePath);
  await h.history("Wiederholen");
  const redo = await h.view(deletePath);
  const expectedTriangle = deletion.polygons[0].outer.slice(0, 3);
  const deleteOkay = pointsEqual(contour(removed, deletion.id), expectedTriangle) &&
    removed.history === before.history + 1 &&
    pointsEqual(contour(undo, deletion.id), deletion.polygons[0].outer) &&
    pointsEqual(contour(redo, deletion.id), expectedTriangle) &&
    entity(redo, deletion.id)?.wallAssetId === wallAssetId &&
    (removedRender?.sprites ?? 0) > 0;
  await h.hover(deletePath, { x: 1, y: 2 }, deletion.id, 2);
  const minimumBefore = await h.view(deletePath);
  const minScreen = await h.shot("triangle-minimum-hover");
  await page.keyboard.press("Backspace");
  const minimumAfter = await h.view(deletePath);
  const minimumOkay = same(minimumBefore.document, minimumAfter.document) &&
    same(minimumBefore.history, minimumAfter.history) &&
    pointsEqual(contour(minimumAfter, deletion.id), expectedTriangle);
  const deletionSaved = await h.save(deletePath);
  details.scenes.deletion = { before, removed, undo, redo, minimumBefore,
    minimumAfter, removedRender, saved: deletionSaved, deleteOkay, minimumOkay };
  cases["DD-013.02"] = result(deleteOkay ? "pass" : "deviation",
    `QAWall01-Viereck 4→3; Undo 3→4; Redo 4→3: ${deleteOkay}.`,
    deleteOkay ? null : "Backspace, Wandbindung oder Undo/Redo wich vom Original ab.",
    [hoverScreen, removedScreen]);
  cases["DD-013.03"] = result(minimumOkay ? "pass" : "deviation",
    `Erneutes Backspace am markierten Dreipunkt-Griff erhält Kontur/History: ${minimumOkay}.`,
    minimumOkay ? null : "Dreipunkt-Minimum oder History wich vom Original ab.",
    [minScreen]);

  const triangle = { id: "qa-building-insert", kind: "building",
    polygons: [{ outer: [{ x: 4, y: 5 }, { x: 2, y: 2 },
      { x: 6, y: 2 }], holes: [] }],
    layer: 100, fill: 0x9c8c7a, wall: 0x726e65, wallWidth: 0.22 };
  const insertPath = await h.create(names.insertion, 8, 8, [triangle], false);
  await h.select(insertPath, { x: 4, y: 3 }, triangle.id);
  const triangleBefore = await h.view(insertPath);
  const edgeFrom = await h.at(insertPath, { x: 4, y: 2 });
  const edgeTo = await h.at(insertPath, { x: 4, y: 1 });
  await page.mouse.move(edgeFrom.x, edgeFrom.y);
  await page.mouse.down();
  await page.mouse.move(edgeTo.x, edgeTo.y, { steps: 8 });
  const insertPreview = await h.view(insertPath);
  const insertPreviewScreen = await h.shot("triangle-edge-preview");
  await page.mouse.up();
  const inserted = await h.view(insertPath);
  const insertResultScreen = await h.shot("triangle-edge-result");
  await h.history("Rückgängig");
  const insertUndo = await h.view(insertPath);
  await h.history("Wiederholen");
  const insertRedo = await h.view(insertPath);
  const four = [{ x: 4, y: 5 }, { x: 2, y: 2 },
    { x: 4, y: 1 }, { x: 6, y: 2 }];
  const insertOkay = insertPreview.previewCount > 0 &&
    same(insertPreview.document, triangleBefore.document) &&
    pointsEqual(contour(inserted, triangle.id), four) &&
    inserted.history === triangleBefore.history + 1 &&
    pointsEqual(contour(insertUndo, triangle.id), triangle.polygons[0].outer) &&
    pointsEqual(contour(insertRedo, triangle.id), four) &&
    entity(insertRedo, triangle.id)?.wallWidth > 0;
  const insertionSaved = await h.save(insertPath);
  details.scenes.insertion = { triangleBefore, insertPreview, inserted,
    insertUndo, insertRedo, saved: insertionSaved, insertOkay };
  cases["DD-014.01"] = result(insertOkay ? "open" : "deviation",
    `Kantenmittelpunkt-Zug 3→4, Vorschau ohne Dokumentänderung, Undo/Redo: ${insertOkay}.`,
    insertOkay
      ? "Original zeigt beim Zug Boden und Wand; der Editor zeichnet statisch nur eine Konturvorschau. Bildvergleich und Original-Frischöffnung genau dieses Stands fehlen."
      : "Kantenvorschau, Punktzahl, Wand oder Undo/Redo wich vom Original ab.",
    [insertPreviewScreen, insertResultScreen]);

  const portalBuilding = { ...triangle, id: "qa-building-portal",
    polygons: [{ outer: [{ x: 4, y: 5 }, { x: 2, y: 2 },
      { x: 6, y: 2 }, { x: 6, y: 4 }], holes: [] }] };
  const perimeter = Math.hypot(2, 3) + 4 + 2 + Math.hypot(2, 1);
  const door = { id: "qa-bound-portal", kind: "door", width: 1,
    variant: "door", blocksLight: true,
    anchor: { boundaryId: portalBuilding.id, contour: 0,
      at: (Math.hypot(2, 3) + 4 + 1) / perimeter },
    passage: { description: "", state: "closed", hidden: false } };
  const portalPath = await h.create(names.portal, 8, 8, [portalBuilding, door], false);
  await h.select(portalPath, { x: 4, y: 3 }, portalBuilding.id);
  const portalBefore = await h.view(portalPath);
  const portalFrom = await h.at(portalPath, { x: 4, y: 2 });
  const portalTo = await h.at(portalPath, { x: 4, y: 1 });
  await page.mouse.move(portalFrom.x, portalFrom.y);
  await page.mouse.down();
  await page.mouse.move(portalTo.x, portalTo.y, { steps: 8 });
  const portalPreview = await h.view(portalPath);
  const portalPreviewScreen = await h.shot("bound-portal-edge-preview");
  await page.mouse.up();
  const portalAfter = await h.view(portalPath);
  const portalResultScreen = await h.shot("bound-portal-edge-result");
  await h.history("Rückgängig");
  const portalUndo = await h.view(portalPath);
  await h.history("Wiederholen");
  const portalRedo = await h.view(portalPath);
  const beforePose = portalPose(entity(portalBefore, portalBuilding.id), entity(portalBefore, door.id));
  const afterPose = portalPose(entity(portalAfter, portalBuilding.id), entity(portalAfter, door.id));
  const redoPose = portalPose(entity(portalRedo, portalBuilding.id), entity(portalRedo, door.id));
  const portalOkay = portalPreview.previewCount > 0 &&
    same(portalPreview.document, portalBefore.document) &&
    contour(portalAfter, portalBuilding.id)?.length === 5 &&
    portalAfter.history === portalBefore.history + 1 &&
    pointsEqual(contour(portalUndo, portalBuilding.id), portalBuilding.polygons[0].outer) &&
    same(portalRedo.document, portalAfter.document) &&
    [beforePose, afterPose, redoPose].every((pose) =>
      pose && approx(pose.x, 6) && approx(pose.y, 3)) &&
    beforePose.edge === 2 && afterPose.edge === 3 && redoPose.edge === 3 &&
    entity(portalRedo, door.id)?.anchor?.boundaryId === portalBuilding.id;
  const portalSaved = await h.save(portalPath);
  details.scenes.portal = { portalBefore, portalPreview, portalAfter,
    portalUndo, portalRedo, beforePose, afterPose, redoPose,
    saved: portalSaved, portalOkay };
  cases["DD-014.02"] = result(portalOkay ? "open" : "deviation",
    `Portal bleibt bei (6,3), Kantenindex 2→3, Undo/Redo: ${portalOkay}.`,
    portalOkay
      ? "Portallage und Bindung sind geprüft; die Boden-/Wandvorschau des Originalzugs fehlt im Editor statisch und der Bildvergleich steht aus."
      : "Portalposition, Bindung, Boden/Wand oder Undo/Redo wich vom Original ab.",
    [portalPreviewScreen, portalResultScreen]);

  const steps = output(out, "bau-point-gestures-edit.json", details);
  for (const id of CASES) cases[id].evidence.unshift(steps);
  output(qa, STATE, { scenes: {
    deletion: deletionSaved, insertion: insertionSaved, portal: portalSaved,
  }, editCases: cases, wallAssetId });
  return cases;
}

async function reopen({ page, out, qa, vault }) {
  const saved = JSON.parse(fs.readFileSync(path.join(qa, STATE), "utf8"));
  const h = helpers(page, vault, out);
  const details = { phase: "reopen", scenes: {} };
  const checks = {};
  for (const [name, scene] of Object.entries(saved.scenes)) {
    if (sha(path.join(vault, scene.path)) !== scene.sha256)
      throw new Error(`QA-Kartendatei änderte sich vor Frischöffnung: ${scene.path}`);
    await page.evaluate(async (p) => {
      const file = app.vault.getAbstractFileByPath(p);
      if (!file) throw new Error(`QA-Karte fehlt: ${p}`);
      await app.workspace.getLeaf(false).openFile(file);
    }, scene.path);
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    const snap = await h.view(scene.path);
    const render = name === "deletion"
      ? await h.render(scene.path, "qa-building-delete") : null;
    const exact = !snap.dirty && same(snap.document, scene.document) &&
      sha(path.join(vault, scene.path)) === scene.sha256 &&
      (name !== "deletion" || (render?.sprites ?? 0) > 0);
    details.scenes[name] = { path: scene.path, exact,
      document: snap.document, render, sha256: scene.sha256 };
    checks[name] = exact;
  }
  const steps = output(out, "bau-point-gestures-reopen.json", details);
  const cases = {};
  for (const id of CASES) {
    const name = id.startsWith("DD-013") ? "deletion" :
      id === "DD-014.01" ? "insertion" : "portal";
    const edit = saved.editCases[id];
    const exact = checks[name];
    const state = exact ? edit.state : "deviation";
    cases[id] = result(state,
      `Frischöffnung ${name}: Dokument und Dateiprüfsumme unverändert=${exact}.`,
      !exact ? "Gespeicherte Kontur, Paketwand oder Portalbindung wich beim frischen Öffnen ab."
        : edit.gap,
      [steps, ...edit.evidence]);
  }
  return cases;
}

module.exports = { runEdit: edit, verifyReopen: reopen, caseIds: CASES };
