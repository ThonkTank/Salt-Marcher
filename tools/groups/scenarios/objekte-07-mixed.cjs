// Supplemental DD-042.01/.07 probe. The caller owns the isolated host and GUI slot.
// Returns case records instead of adding to group-record: objekte-07 already records
// these IDs, so the coordinator can replace those two records when integrating.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const stateName = "objekte-07-mixed-state.json";
const dataPath = ".obsidian/plugins/dungeon-editor/data.json";
const hash = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const write = (file, value) => fs.writeFileSync(file,
  JSON.stringify(value, null, 2) + "\n");

async function editor(page, mapPath) {
  return page.evaluate((mapPath) => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === mapPath);
    const current = leaf?.view.editor;
    if (!current) throw new Error("Gemischte Prefab-QA-Karte ist nicht geöffnet.");
    return { selected: [...current.selection],
      document: current.session.document(),
      historySize: current.session.historySize,
      dirty: current.session.dirty };
  }, mapPath);
}

async function clickWorld(page, mapPath, x, y, shift = false) {
  const point = await page.evaluate(({ mapPath, x, y }) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor?.renderer;
    if (!renderer) throw new Error("Gemischte Prefab-QA: Renderer fehlt.");
    const box = renderer.canvas.getBoundingClientRect();
    const point = { x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale };
    if (point.x < box.left || point.x >= box.right ||
        point.y < box.top || point.y >= box.bottom)
      throw new Error("Gemischte Prefab-QA: Quelle liegt außerhalb des Canvas.");
    return point;
  }, { mapPath, x, y });
  if (shift) await page.keyboard.down("Shift");
  try { await page.mouse.click(point.x, point.y); }
  finally { if (shift) await page.keyboard.up("Shift"); }
}

async function chooseSelection(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
  await page.locator(".dn-group-rail").last()
    .getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.locator(".dn-tool-rail").last()
    .getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.locator('.dn-selection-filter input[type="checkbox"]')
    .evaluateAll((inputs) => {
      const kinds = new Set(["Objekte", "Lichter"]);
      const layers = new Set(["Feste Ebenen", "Benutzerebene 1"]);
      for (const input of inputs) {
        const label = input.getAttribute("aria-label") ?? "";
        let selected;
        if (label.startsWith("Objektarten: ") && label !== "Objektarten: Alle")
          selected = kinds.has(label.slice("Objektarten: ".length));
        if (label.startsWith("Zeichenebenen: ") && label !== "Zeichenebenen: Alle")
          selected = layers.has(label.slice("Zeichenebenen: ".length));
        if (selected !== undefined && input.checked !== selected) {
          input.checked = selected;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
}

function offset(entities) {
  const object = entities.find((item) => item.kind === "object");
  const light = entities.find((item) => item.kind === "light");
  assert(object && light, "Eine Objekt- und eine Lichtquelle sind erforderlich.");
  return [light.x - object.x, light.y - object.y];
}

async function edit({ page, qa, vault, out }) {
  const suffix = String(Date.now());
  const mapName = `PrefabMixedQA${suffix}`;
  const mapPath = `Dungeons/${mapName}/Karte.dungeon`;
  const set = "Allgemein", name = `Objekt und Licht ${suffix}`;
  const objectId = `dd042-mixed-object-${suffix}`;
  const lightId = `dd042-mixed-light-${suffix}`;
  const sourceOffset = [3, 1];
  await page.evaluate((mapName) =>
    app.plugins.getPlugin("dungeon-editor").create(mapName, 8, 8), mapName);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  await page.evaluate(({ mapPath, objectId, lightId }) => {
    const current = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!current) throw new Error("Gemischte Prefab-QA: Editor fehlt.");
    const floorId = current.session.floors.keys().next().value;
    const object = { id: objectId, kind: "object", floorId,
      x: 2, y: 2, rotation: 0, width: 1.25, height: 1.25,
      color: 0x6688aa, label: "", layer: 100, flip: false };
    const light = { id: lightId, kind: "light", floorId,
      x: 5, y: 3, radius: 1.25, intensity: 1,
      color: 0xeccd8b, shadows: false };
    current.session.execute({ label: "Gemischte Prefab-QA-Quellen",
      entities: [object, light].map((entity) =>
        ({ id: entity.id, before: null, after: entity })) });
    current.renderer.fit();
  }, { mapPath, objectId, lightId });
  await chooseSelection(page);
  await clickWorld(page, mapPath, 2, 2);
  await clickWorld(page, mapPath, 5, 3, true);
  const before = await editor(page, mapPath);
  assert.deepEqual(before.selected.slice().sort(), [lightId, objectId].sort(),
    "Die UI-Auswahl muss genau Objekt und Licht enthalten.");
  const selectionImage = path.join(out, "mixed-selected.png");
  await page.screenshot({ path: selectionImage });

  await page.getByRole("button", { name: "Vorlage erstellen", exact: true }).last().click();
  const modal = page.locator(".modal-container:visible").last();
  await modal.getByText("Vorlage erstellen", { exact: true }).waitFor();
  const dialog = { text: await modal.innerText(),
    set: await modal.locator('select:not([aria-hidden="true"])').inputValue(),
    inputs: await modal.locator("input").count(),
    accept: await modal.getByRole("button", { name: "Erstellen", exact: true }).count(),
    cancel: await modal.getByRole("button", { name: "Abbrechen", exact: true }).count() };
  const dialogImage = path.join(out, "mixed-make-dialog.png");
  await modal.screenshot({ path: dialogImage });
  assert(dialog.inputs >= 1 && dialog.accept === 1,
    "Sammlung, Name und Bestätigung müssen im Dialog sichtbar sein.");
  await modal.locator('select:not([aria-hidden="true"])').selectOption(set);
  await modal.locator("input").fill(name);
  await modal.getByRole("button", { name: "Erstellen", exact: true }).click();
  await page.waitForFunction(({ set, name }) => app.plugins.getPlugin("dungeon-editor")
    .prefabs().some((item) => item.set === set && item.name === name),
  { set, name });
  await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").pluginDataWrites);
  const after = await editor(page, mapPath);
  const prefabs = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs());
  const matches = prefabs.filter((item) => item.set === set && item.name === name);
  assert.equal(matches.length, 1, "Accept muss genau eine benannte Vorlage speichern.");
  const prefab = matches[0];
  assert.deepEqual(prefab.entities.map((item) => item.kind).sort(), ["light", "object"]);
  assert.deepEqual(offset(prefab.entities), sourceOffset,
    "Die Vorlage muss den relativen Objekt-Licht-Versatz bewahren.");
  for (const id of [objectId, lightId])
    assert.equal(after.document.entities.find((item) => item.id === id)?.prefabId,
      prefab.id, "Beide Quellentitäten müssen an dieselbe Vorlage gebunden sein.");
  await page.getByRole("button", { name: "Speichern", exact: true }).last().click();
  await page.waitForFunction((mapPath) => !app.workspace
    .getLeavesOfType("dungeon-native-map")
    .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor?.session.dirty,
  mapPath);
  await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").pluginDataWrites);
  const mapFile = path.join(vault, mapPath), dataFile = path.join(vault, dataPath);
  const evidence = path.join(out, "mixed-prefab-edit.json");
  const saved = { mapPath, set, name, objectId, lightId, prefab,
    sourceOffset, mapSha: hash(mapFile), dataSha: hash(dataFile) };
  write(path.join(qa, stateName), saved);
  write(evidence, { dialog, selected: before.selected, prefab,
    source: [objectId, lightId].map((id) => after.document.entities
      .find((item) => item.id === id)), saved });
  return [
    { caseId: "DD-042.01", state: dialog.cancel ? "pass" : "deviation",
      observation: `Gemischte Objekt-Licht-Auswahl öffnet Make Prefab mit Sammlung, Name und Erstellen; sichtbares Abbrechen=${dialog.cancel === 1}.`,
      evidence: [selectionImage, dialogImage, evidence],
      gap: dialog.cancel ? null : "Im Make-Prefab-Hauptdialog fehlt die native Cancel-Aktion als sichtbarer Knopf; Schließen per X/Escape ist separat zu bewerten." },
    { caseId: "DD-042.07", state: "pass",
      observation: "Accept speichert genau eine benannte Vorlage mit Objekt und Licht, gleichem relativen Versatz und gemeinsamer Bindung; Karte und Katalog gespeichert.",
      evidence: [dialogImage, evidence] },
  ];
}

async function reopen({ page, qa, vault, out, catalogMayGrow = false }) {
  const saved = JSON.parse(fs.readFileSync(path.join(qa, stateName), "utf8"));
  const mapFile = path.join(vault, saved.mapPath);
  const dataFile = path.join(vault, dataPath);
  assert.equal(hash(mapFile), saved.mapSha, "QA-Karte änderte sich vor Frischstart.");
  if (!catalogMayGrow)
    assert.equal(hash(dataFile), saved.dataSha, "Prefab-Katalog änderte sich vor Frischstart.");
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error("Gemischte Prefab-QA-Karte fehlt beim Frischstart.");
    await app.workspace.getLeaf(false).openFile(file);
  }, saved.mapPath);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  const current = await editor(page, saved.mapPath);
  const entries = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs());
  const matches = entries.filter((item) => item.set === saved.set && item.name === saved.name);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0], saved.prefab);
  assert.deepEqual(offset(matches[0].entities), saved.sourceOffset);
  for (const id of [saved.objectId, saved.lightId])
    assert.equal(current.document.entities.find((item) => item.id === id)?.prefabId,
      saved.prefab.id);
  assert.equal(current.dirty, false);
  const evidence = path.join(out, "mixed-prefab-reopen.json");
  write(evidence, { saved, prefab: matches[0],
    source: [saved.objectId, saved.lightId].map((id) => current.document.entities
      .find((item) => item.id === id)), mapSha: hash(mapFile), dataSha: hash(dataFile) });
  return [{ caseId: "DD-042.07", state: "pass",
    observation: "Gemischte Vorlage und gebundene Quellentitäten sind nach frischem Obsidian-Prozess unverändert.",
    evidence: [evidence] }];
}

module.exports = { edit, reopen };
