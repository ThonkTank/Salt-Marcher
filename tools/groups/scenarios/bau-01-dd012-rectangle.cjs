// Isolated rectangle corner drag for DD-012.01/.02. GUI slot required.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const stateName = "dd012-rectangle-state.json";
const entityId = "dd012-rectangle";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const initial = [{ x: 2, y: 1 }, { x: 4, y: 1 },
  { x: 4, y: 3 }, { x: 2, y: 3 }];
const moved = [{ x: 1, y: 1 }, ...initial.slice(1)];

async function point(page, mapPath, p) {
  return page.evaluate(({ mapPath, p }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("DD-012 QA map editor missing");
    const r = editor.renderer, box = r.canvas.getBoundingClientRect();
    const x = box.x + r.camera.x + p.x * r.camera.scale;
    const y = box.y + r.camera.y + p.y * r.camera.scale;
    if (x <= box.left || x >= box.right || y <= box.top || y >= box.bottom)
      throw new Error(`DD-012 point outside canvas: ${p.x},${p.y}`);
    return { x, y };
  }, { mapPath, p });
}

async function snapshot(page, mapPath) {
  return page.evaluate((mapPath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("DD-012 QA editor not loaded");
    const r = editor.renderer;
    const building = editor.session.entities.get("dd012-rectangle");
    const preview = r.buildingPreview;
    return { document: editor.session.document(), building,
      selected: editor.selected, history: editor.session.historySize,
      dirty: editor.session.dirty,
      hover: r.buildingPointHover ?? null,
      gripColors: r.selection.context.instructions
        .filter((item) => item.action === "fill")
        .map((item) => item.data.style.color),
      preview: preview ? {
        sourceId: preview.sourceId,
        point: preview.entity.polygons[0].outer[0],
        originalVisible: r.visuals.get("dd012-rectangle")?.container.visible,
        actions: preview.graphic.context.instructions.map((item) => item.action),
      } : null };
  }, mapPath);
}

async function waitForSavedMap(page, mapPath, expected, timeout = 90000) {
  await page.waitForFunction(({ mapPath, expected }) => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((candidate) => candidate.view.file?.path === mapPath);
    const editor = leaf?.view.editor;
    const building = editor?.session.entities.get("dd012-rectangle");
    return !!editor && !editor.session.dirty && !!building &&
      JSON.stringify(building.polygons[0].outer) === JSON.stringify(expected) &&
      editor.renderer.visuals.has("dd012-rectangle") &&
      !!editor.renderer.canvas?.isConnected;
  }, { mapPath, expected }, { timeout });
}

module.exports = async function rectangle({ page, out, qa, vault,
  restart, group, record }) {
  assert.equal(group.id, "bau-01");
  const statePath = path.join(qa, stateName);
  const stepsPath = path.join(out, "dd012-rectangle-steps.json");
  const steps = { phase: restart ? "reopen" : "edit", stages: [] };
  const evidence = [stepsPath];
  const stage = async (name, mapPath) => {
    const value = await snapshot(page, mapPath);
    const image = path.join(out, `dd012-rectangle-${name}.png`);
    await page.screenshot({ path: image });
    steps.stages.push({ name, value, image });
    evidence.push(image);
    return value;
  };
  let result;
  try {
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(statePath, "utf8"));
      const disk = path.join(vault, saved.mapPath);
      assert.equal(sha(disk), saved.sha256);
      await page.evaluate(async (mapPath) => {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!file) throw new Error("DD-012 saved QA map missing");
        await app.workspace.getLeaf(false).openFile(file);
      }, saved.mapPath);
      await waitForSavedMap(page, saved.mapPath, moved);
      const reopened = await stage("fresh-loaded", saved.mapPath);
      assert(same(reopened.document, saved.document));
      assert.equal(reopened.preview, null);
      assert.equal(sha(disk), saved.sha256);
      result = { state: "open", observation: "Rechteck-Eckzug ist nach tatsächlichem Kartenladen und frischem Hoststart gespeichert.",
        gap: "Gleicher Rechteck-Eckzug im Original und Original-Frischöffnung der verformten Ellipse stehen noch aus." };
    } else {
      fs.rmSync(statePath, { force: true });
      const name = `DD012RectangleQA${Date.now()}`;
      const mapPath = `Dungeons/${name}/Karte.dungeon`;
      const disk = path.join(vault, mapPath);
      await page.evaluate(async (name) =>
        app.plugins.getPlugin("dungeon-editor").create(name, 10, 10), name);
      const editor = page.locator(".dungeon-native-editor:visible").last();
      await editor.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction((mapPath) => app.workspace
        .getLeavesOfType("dungeon-native-map")
        .some((leaf) => leaf.view.file?.path === mapPath), mapPath,
      { timeout: 30000 });
      await page.evaluate(({ mapPath, initial }) => {
        const editor = app.workspace.getLeavesOfType("dungeon-native-map")
          .find((leaf) => leaf.view.file?.path === mapPath).view.editor;
        const floorId = editor.session.document().floors[0].id;
        editor.session.execute({ label: "DD-012 QA rectangle fixture", entities: [{
          id: "dd012-rectangle", before: null,
          after: { id: "dd012-rectangle", kind: "building", floorId,
            polygons: [{ outer: initial, holes: [] }], layer: 100,
            fill: 0x7f7e71, wall: 0x403e39, wallWidth: 0.2 },
        }] });
        editor.renderer.fit();
        editor.renderer.zoom(40 / editor.renderer.camera.scale);
      }, { mapPath, initial });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await waitForSavedMap(page, mapPath, initial);
      await editor.locator(".dn-group-rail")
        .getByRole("button", { name: "Auswahl", exact: true }).click();
      await editor.locator(".dn-tool-rail")
        .getByRole("button", { name: "Auswahl", exact: true }).click();
      const inside = await point(page, mapPath, { x: 3, y: 2 });
      await page.mouse.click(inside.x, inside.y);
      await page.waitForFunction((mapPath) => app.workspace
        .getLeavesOfType("dungeon-native-map")
        .find((leaf) => leaf.view.file?.path === mapPath)
        ?.view.editor.selected === "dd012-rectangle", mapPath);
      const before = await stage("selected", mapPath);
      const diskBefore = sha(disk);
      const from = await point(page, mapPath, initial[0]);
      const to = await point(page, mapPath, moved[0]);
      await page.mouse.move(from.x, from.y);
      const hover = await stage("corner-hover", mapPath);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      const held = await stage("corner-held", mapPath);
      assert.equal(sha(disk), diskBefore);
      await page.mouse.up();
      const after = await stage("corner-released", mapPath);
      await editor.getByRole("button", { name: "Rückgängig", exact: true }).click();
      const undone = await stage("undo", mapPath);
      await editor.getByRole("button", { name: "Wiederholen", exact: true }).click();
      const redone = await stage("redo", mapPath);
      assert.equal(before.selected, entityId);
      assert.equal(before.gripColors.length, 4);
      assert.equal(hover.hover?.index, 0);
      assert.equal(hover.gripColors.filter((color) => color === 0x29c85a).length, 1);
      assert.equal(held.preview?.sourceId, entityId);
      assert.equal(held.preview?.originalVisible, false);
      assert(same(held.preview?.point, moved[0]));
      assert(same(held.document, before.document));
      assert.equal(held.history, before.history);
      assert(same(after.building.polygons[0].outer, moved));
      assert.equal(after.history, before.history + 1);
      assert(same(undone.document, before.document));
      assert(same(redone.document, after.document));
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await waitForSavedMap(page, mapPath, moved);
      const saved = await stage("saved", mapPath);
      fs.writeFileSync(statePath, JSON.stringify({ mapPath,
        document: saved.document, sha256: sha(disk) }, null, 2) + "\n");
      evidence.push(statePath);
      result = { state: "open", observation: "Vier Rechteckgriffe, grüner Hover, gehaltene Vorschau, Einzelpunkt-Commit, Undo/Redo und Save im Host gemessen.",
        gap: "Gleicher Rechteck-Eckzug im Original und Frischstart dieses Hostlaufs stehen noch aus." };
    }
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    result = { state: "fail", observation: steps.error,
      gap: "Rechteck-Eckgriff-Folge im isolierten Host fehlgeschlagen." };
  }
  fs.writeFileSync(stepsPath, JSON.stringify(steps, null, 2) + "\n");
  for (const id of ["DD-012.01", "DD-012.02"])
    record.add(id, result.state, result.observation, evidence, result.gap);
};
