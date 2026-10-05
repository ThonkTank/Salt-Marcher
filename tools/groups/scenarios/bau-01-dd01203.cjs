// Isolated DD-012.02/.03 host sequence. Run only through host-test --group bau-01
// with DUNGEON_QA_ONLY_DD01203=1 in an isolated QA root and an exclusive GUI slot.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const caseIds = ["DD-012.02", "DD-012.03"];
const stateFile = "dd01203-held-point-state.json";
const sha = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pixels = [
  1276,1031, 1396,1053, 1507,1088, 1604,1136, 1684,1194, 1743,1261,
  1779,1333, 1792,1408, 1779,1482, 1743,1554, 1684,1621, 1604,1679,
  1507,1727, 1396,1762, 1276,1784, 1152,1792, 1027,1784, 907,1762,
  796,1727, 699,1679, 619,1621, 560,1554, 524,1482, 512,1408,
  524,1333, 560,1261, 619,1194, 699,1136, 796,1088, 907,1053,
  1027,1031, 1152,1024,
];
const nativePoints = Array.from({ length: pixels.length / 2 }, (_, index) => ({
  x: pixels[index * 2] / 256, y: pixels[index * 2 + 1] / 256,
}));

function editorState(page, mapPath) {
  return page.evaluate((mapPath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error(`Gespeicherter QA-Editor fehlt: ${mapPath}`);
    const r = editor.renderer, preview = r.buildingPreview,
      building = editor.session.document().entities.find((e) => e.id === "dd01203-ellipse"),
      visual = r.visuals.get("dd01203-ellipse");
    return {
      document: editor.session.document(),
      history: editor.session.historySize,
      dirty: editor.session.dirty,
      selected: editor.selected,
      gesture: editor.gesture?.buildingVertex ?? null,
      building,
      preview: preview ? {
        sourceId: preview.sourceId,
        point: preview.entity.polygons[0].outer[23],
        fillAndWallActions: preview.graphic.context.instructions
          .map((instruction) => instruction.action),
        shadowActions: preview.shadow?.context.instructions.length ?? 0,
        originalVisible: visual?.container.visible,
        originalShadowVisible: visual?.shadow?.visible ?? null,
        assetCount: preview.assets.length,
      } : null,
    };
  }, mapPath);
}

function at(page, mapPath, point) {
  return page.evaluate(({ mapPath, point }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("QA-Kartenansicht fehlt.");
    const r = editor.renderer, box = r.canvas.getBoundingClientRect(),
      x = box.x + r.camera.x + point.x * r.camera.scale,
      y = box.y + r.camera.y + point.y * r.camera.scale;
    if (x <= box.left || x >= box.right || y <= box.top || y >= box.bottom)
      throw new Error(`QA-Griff außerhalb des Canvas: ${point.x},${point.y}`);
    return { x, y };
  }, { mapPath, point });
}

module.exports = async function dd01203({ page, out, qa, vault,
  restart, group, record }) {
  if (group.id !== "bau-01" ||
    !caseIds.every((id) => group.caseIds.includes(id)))
    throw new Error("DD-012.03 benötigt die Bau-01-Gruppe.");
  const statePath = path.join(qa, stateFile),
    stepsPath = path.join(out, "dd01203-held-point-steps.json"),
    steps = { phase: restart ? "reopen" : "edit", stages: [], gaps: [] },
    evidence = [stepsPath],
    stage = async (name, mapPath, screenshot = false) => {
      const value = await editorState(page, mapPath),
        image = screenshot ? path.join(out, `dd01203-${name}.png`) : null;
      if (image) {
        await page.screenshot({ path: image });
        evidence.push(image);
      }
      steps.stages.push({ name, state: value, image });
      return value;
    },
    write = (file, data) => fs.writeFileSync(file,
      JSON.stringify(data, null, 2) + "\n");
  let result;
  try {
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(statePath, "utf8")),
        disk = path.join(vault, saved.mapPath);
      if (sha(disk) !== saved.sha256)
        throw new Error("QA-Karte änderte sich vor dem Frischstart.");
      await page.evaluate(async (mapPath) => {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!file) throw new Error(`QA-Karte fehlt: ${mapPath}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, saved.mapPath);
      await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
        .last().waitFor({ timeout: 30000 });
      const reopened = await stage("fresh-open", saved.mapPath, true);
      const okay = saved.structuralOkay && !reopened.dirty &&
        same(reopened.document, saved.document) &&
        sha(disk) === saved.sha256 && !reopened.preview;
      result = {
        state: okay ? "open" : "fail",
        observation: `Frischstart: gespeicherte 32-Punkt-Kontur und Datei unverändert=${okay}.`,
        gap: okay
          ? "Original-Frischstart genau des Ellipsenpunktzugs und unabhängiger Bildvergleich der gehaltenen Vorschau fehlen."
          : "Kontur, Dateiprüfsumme oder transiente Vorschau wich beim Frischstart ab.",
      };
    } else {
      fs.rmSync(statePath, { force: true });
      const name = `DD01203HeldQA${Date.now()}`,
        mapPath = `Dungeons/${name}/Karte.dungeon`,
        disk = path.join(vault, mapPath);
      await page.evaluate(async (name) =>
        app.plugins.getPlugin("dungeon-editor").create(name, 10, 10), name);
      const editor = page.locator(".dungeon-native-editor:visible").last();
      await editor.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction((mapPath) => app.workspace
        .getLeavesOfType("dungeon-native-map")
        .some((leaf) => leaf.view.file?.path === mapPath), mapPath,
      { timeout: 30000 });
      await page.evaluate(({ mapPath, nativePoints }) => {
        const editor = app.workspace.getLeavesOfType("dungeon-native-map")
          .find((leaf) => leaf.view.file?.path === mapPath).view.editor;
        const floorId = editor.session.document().floors[0].id;
        editor.session.execute({ label: "QA-Originalellipse vorbereiten", entities: [{
          id: "dd01203-ellipse", before: null,
          after: { id: "dd01203-ellipse", kind: "building", floorId,
            polygons: [{ outer: nativePoints, holes: [] }],
            layer: 100, fill: 0x7f7e71, wall: 0x403e39, wallWidth: 0.2 },
        }] });
        editor.renderer.fit();
        editor.renderer.zoom(40 / editor.renderer.camera.scale);
      }, { mapPath, nativePoints });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction((mapPath) => {
        const e = app.workspace.getLeavesOfType("dungeon-native-map")
          .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
        return !!e && !e.session.dirty;
      }, mapPath);
      await editor.locator(".dn-group-rail")
        .getByRole("button", { name: "Auswahl", exact: true }).click();
      await editor.locator(".dn-tool-rail")
        .getByRole("button", { name: "Auswahl", exact: true }).click();
      const center = await at(page, mapPath, { x: 4.5, y: 5.5 });
      await page.mouse.click(center.x, center.y);
      await page.waitForFunction((mapPath) => app.workspace
        .getLeavesOfType("dungeon-native-map")
        .find((leaf) => leaf.view.file?.path === mapPath)
        ?.view.editor.selected === "dd01203-ellipse", mapPath);
      const before = await stage("before-drag", mapPath, true),
        diskBefore = sha(disk),
        from = await at(page, mapPath, { x: 2, y: 5.5 }),
        // D05 native hold uses screen (456,456), i.e. pointer (1.125,5.5).
        // With Snap ON its stored vertex rounds from x=2 to x=1 field.
        to = await at(page, mapPath, { x: 1.125, y: 5.5 });
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      const held = await stage("held", mapPath, true),
        heldDiskUnchanged = sha(disk) === diskBefore;
      await page.mouse.up();
      const after = await stage("released", mapPath, true),
        expected = before.building.polygons[0].outer.map((point, index) =>
          index === 23 ? { x: 1, y: 5.5 } : point);
      await editor.getByRole("button", { name: "Rückgängig", exact: true }).click();
      const undone = await stage("undo", mapPath);
      await editor.getByRole("button", { name: "Wiederholen", exact: true }).click();
      const redone = await stage("redo", mapPath, true);
      const okay = held.preview?.sourceId === "dd01203-ellipse" &&
        held.preview.originalVisible === false &&
        held.gesture?.index === 23 &&
        same(held.preview.point, { x: 1, y: 5.5 }) &&
        held.preview.fillAndWallActions.includes("fill") &&
        held.preview.fillAndWallActions.includes("stroke") &&
        same(held.document, before.document) &&
        held.history === before.history && heldDiskUnchanged &&
        same(after.building.polygons[0].outer, expected) &&
        after.history === before.history + 1 && !after.preview &&
        same(undone.document, before.document) &&
        same(redone.document, after.document);
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction((mapPath) => {
        const e = app.workspace.getLeavesOfType("dungeon-native-map")
          .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
        return !!e && !e.session.dirty;
      }, mapPath);
      const saved = await stage("saved", mapPath, true);
      const savedOkay = okay && same(saved.document, redone.document) &&
        saved.preview === null && !saved.dirty;
      write(statePath, { mapPath, document: saved.document, sha256: sha(disk),
        structuralOkay: savedOkay });
      result = {
        state: savedOkay ? "open" : "fail",
        observation: `Halten: Boden-/Wandvorschau=${!!held.preview}, Dokument/History/Datei unverändert=${same(held.document, before.document) && held.history === before.history && heldDiskUnchanged}; Loslassen/Undo/Redo=${okay}.`,
        gap: savedOkay
          ? "Unabhängiger Bildvergleich mit dem Originalbeleg D05 und Original-Frischstart dieses Punktzugs fehlen."
          : "Gehaltene Vorschau, atomarer Commit oder History/Speicherung wich von der Originalfolge ab.",
      };
    }
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    result = { state: "fail", observation: steps.error,
      gap: "Isolierter DD-012.03-Hostlauf konnte nicht vollständig ausgeführt werden." };
  }
  write(stepsPath, steps);
  for (const id of caseIds)
    record.add(id, result.state, result.observation, evidence, result.gap);
};
