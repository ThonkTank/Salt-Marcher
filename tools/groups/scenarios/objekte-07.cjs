// DD-042.09 only. The common group runner owns the isolated Obsidian host and
// records every other objekte-07 case as open. Importing this file starts no GUI.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CASE = "DD-042.09";
const STATE = "objekte-07-dd04209-saved.json";
const DATA = ".obsidian/plugins/dungeon-editor/data.json";
const digest = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const write = (file, value) => fs.writeFileSync(file,
  JSON.stringify(value, null, 2) + "\n");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function snapshot(page, mapPath) {
  return page.evaluate((mapPath) => {
    const plugin = app.plugins.getPlugin("dungeon-editor");
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("DD-042.09 QA-Karte ist nicht geöffnet.");
    return {
      prefabs: plugin.prefabs(),
      document: editor.session.document(),
      historySize: editor.session.historySize,
      selected: editor.selected,
      dirty: editor.session.dirty,
    };
  }, mapPath);
}

async function waitWrites(page) {
  await page.evaluate(async () => {
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.pluginDataWrites;
  });
}

async function chooseSelection(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
  await page.locator(".dn-group-rail").last()
    .getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.locator(".dn-tool-rail").last()
    .getByRole("button", { name: "Auswahl", exact: true }).click();
}

async function clickWorld(page, mapPath, x, y) {
  const screen = await page.evaluate(({ mapPath, x, y }) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor?.renderer;
    if (!renderer) throw new Error("DD-042.09 Renderer fehlt.");
    const box = renderer.canvas.getBoundingClientRect();
    const point = { x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale };
    if (point.x < box.left || point.x >= box.right ||
        point.y < box.top || point.y >= box.bottom)
      throw new Error("DD-042.09 Objekt liegt außerhalb des Canvas.");
    return point;
  }, { mapPath, x, y });
  await page.mouse.click(screen.x, screen.y);
}

async function makeDialog(page) {
  await page.getByRole("button", { name: "Vorlage erstellen", exact: true }).last().click();
  const modal = page.locator(".modal-container").last();
  await modal.getByText("Vorlage erstellen", { exact: true }).waitFor();
  return modal;
}

async function edit({ page, out, qa, vault, group, record }) {
  assert.equal(group.id, "objekte-07");
  assert(group.caseIds.includes(CASE));
  const suffix = String(Date.now()),
    mapName = `PrefabDuplicateQA${suffix}`,
    mapPath = `Dungeons/${mapName}/Karte.dungeon`,
    set = `DD04209 QA ${suffix}`,
    name = "Doppelname",
    statePath = path.join(qa, STATE),
    dataFile = path.join(vault, DATA),
    mapFile = path.join(vault, mapPath);
  await page.evaluate((mapName) =>
    app.plugins.getPlugin("dungeon-editor").create(mapName, 8, 8), mapName);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  await page.evaluate((mapPath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("DD-042.09 QA-Editor fehlt.");
    const floorId = editor.session.floors.keys().next().value;
    const light = { id: "dd04209-source-light", kind: "light", floorId,
      x: 4, y: 4, radius: 3, intensity: 1, color: 0xeccd8b, shadows: false };
    editor.session.execute({ label: "DD-042.09 QA-Licht",
      entities: [{ id: light.id, before: null, after: light }] });
    editor.renderer.fit();
  }, mapPath);
  await chooseSelection(page);
  await clickWorld(page, mapPath, 4, 4);
  await page.waitForFunction((mapPath) =>
    app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor
      ?.selected === "dd04209-source-light", mapPath);
  const beforeFirst = await snapshot(page, mapPath);
  assert(!beforeFirst.prefabs.some((prefab) => prefab.set === set));

  let modal = await makeDialog(page);
  await modal.getByRole("button", { name: "Sammlung hinzufügen", exact: true }).click();
  await modal.locator("input").fill(set);
  await modal.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  assert.equal(await modal.locator('select:not([aria-hidden="true"])').inputValue(), set);
  await modal.locator("input").fill(name);
  await modal.screenshot({ path: path.join(out, "first-prefab-dialog.png") });
  await modal.getByRole("button", { name: "Erstellen", exact: true }).click();
  await page.waitForFunction(({ set, name }) => app.plugins.getPlugin("dungeon-editor")
    .prefabs().some((prefab) => prefab.set === set && prefab.name === name),
  { set, name });
  await waitWrites(page);
  const first = await snapshot(page, mapPath);
  const matches = first.prefabs.filter((prefab) => prefab.set === set && prefab.name === name);
  assert.equal(matches.length, 1);
  assert.equal(first.document.entities.find((entity) =>
    entity.id === "dd04209-source-light")?.prefabId, matches[0].id);
  await page.getByRole("button", { name: "Speichern", exact: true }).last().click();
  await page.waitForFunction((mapPath) => !app.workspace
    .getLeavesOfType("dungeon-native-map")
    .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor?.session.dirty,
  mapPath);
  await waitWrites(page);
  const beforeDuplicate = await snapshot(page, mapPath);
  const dataSha = digest(dataFile), mapSha = digest(mapFile);

  modal = await makeDialog(page);
  await modal.locator('select:not([aria-hidden="true"])').selectOption(set);
  await modal.locator("input").fill(name);
  await modal.screenshot({ path: path.join(out, "duplicate-prefab-dialog.png") });
  await modal.getByRole("button", { name: "Erstellen", exact: true }).click();
  await page.locator(".notice").filter({ hasText:
    "In dieser Sammlung gibt es bereits eine Vorlage mit diesem Namen." })
    .waitFor({ timeout: 5000 });
  await waitWrites(page);
  const afterDuplicate = await snapshot(page, mapPath);
  const dataUnchanged = digest(dataFile) === dataSha;
  const mapUnchanged = digest(mapFile) === mapSha;
  const catalogUnchanged = same(afterDuplicate.prefabs, beforeDuplicate.prefabs);
  const documentUnchanged = same(afterDuplicate.document, beforeDuplicate.document);
  const historyUnchanged = afterDuplicate.historySize === beforeDuplicate.historySize;
  const unchanged = dataUnchanged && mapUnchanged && catalogUnchanged &&
    documentUnchanged && historyUnchanged && !afterDuplicate.dirty &&
    afterDuplicate.selected === "dd04209-source-light";
  const screen = path.join(out, "duplicate-rejected.png");
  await page.screenshot({ path: screen });
  const details = { mapPath, set, name, sourceId: "dd04209-source-light",
    prefab: matches[0], beforeFirst, beforeDuplicate, afterDuplicate,
    dataSha, mapSha, dataUnchanged, mapUnchanged, catalogUnchanged,
    documentUnchanged, historyUnchanged, unchanged };
  const steps = path.join(out, "dd04209-edit.json");
  write(steps, details);
  write(statePath, { mapPath, set, name, sourceId: details.sourceId,
    prefab: matches[0], dataSha, mapSha,
    document: beforeDuplicate.document });
  record.add(CASE, unchanged ? "pass" : "deviation",
    `Identischer Vorlagenname im selben Set abgelehnt; Definition, data.json, Karte und History unverändert=${unchanged}.`,
    [steps, screen, path.join(out, "duplicate-prefab-dialog.png")],
    unchanged ? null : "Duplikatversuch änderte Katalog, Datei, Karte oder History.");
}

async function reopen({ page, out, qa, vault, group, record }) {
  assert.equal(group.id, "objekte-07");
  const saved = JSON.parse(fs.readFileSync(path.join(qa, STATE), "utf8"));
  const dataFile = path.join(vault, DATA),
    mapFile = path.join(vault, saved.mapPath);
  assert.equal(digest(dataFile), saved.dataSha,
    "Prefab-Katalog änderte sich vor dem Frischstart.");
  assert.equal(digest(mapFile), saved.mapSha,
    "QA-Karte änderte sich vor dem Frischstart.");
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error("DD-042.09 QA-Karte fehlt beim Frischstart.");
    await app.workspace.getLeaf(false).openFile(file);
  }, saved.mapPath);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  const current = await snapshot(page, saved.mapPath);
  const entries = current.prefabs.filter((prefab) =>
    prefab.set === saved.set && prefab.name === saved.name);
  const unchanged = entries.length === 1 &&
    same(entries[0], saved.prefab) &&
    same(current.document, saved.document) && !current.dirty &&
    digest(dataFile) === saved.dataSha && digest(mapFile) === saved.mapSha;
  const steps = path.join(out, "dd04209-reopen.json");
  write(steps, { saved, current, unchanged });
  record.add(CASE, unchanged ? "pass" : "deviation",
    `Frischstart enthält genau eine gleichnamige Vorlage; gespeicherte Definition und Karte unverändert=${unchanged}.`,
    [steps], unchanged ? null : "Duplikat oder Änderung der Definition beim Frischstart.");
}

module.exports = async function objekte07(context) {
  if (context.restart) await reopen(context);
  else await edit(context);
};
