// DD-026 object placement group. The common host runner owns the GUI and records.
// Only the narrow click/Undo/Redo result is marked passed; original gaps stay open.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mapPath = "Dungeons/ObjectPlacementGroupQA/Karte.dungeon";
const fixture = path.join(__dirname, "../fixtures/objekte-03-colorable.dungeondraft_pack");
const fixtureSha256 = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const openReasons = {
  "DD-026.01": "Original öffnet Platzierungsparameter und All/Used/Tags-Bildbibliothek; die aktuelle Werkzeugfläche ist nicht vollständig gepaart.",
  "DD-026.02": "Native All-Bildkachelgalerie einschließlich eingebauter Objekte fehlt im geprüften Hostablauf.",
  "DD-026.03": "Used muss platzierte statt nur gewählte Assets zeigen; Host-Used und natives Mehrkartenverhalten sind ungeprüft.",
  "DD-026.05": "Atlas-/Nichttreffer-Suche und gemeinsame Kachelwirkung sind in dieser Hostfolge nicht paarbar.",
  "DD-026.06": "Wirkung und Treffergrenzen von Fuzzy/Exact im Original sind nicht gemessen.",
  "DD-026.07": "Der native Papierkorb stellt Galerie und Markierung bei stehendem Suchtext um; gleichartige Hoststeuerung fehlt.",
  "DD-026.08": "Die Host-Combobox wählt das QA-Asset, aber die native Bildkachelwahl ist damit nicht abgenommen.",
  "DD-026.09": "Layerwert und sichtbare Stapelwirkung derselben überlappenden QA-Objekte sind nicht gepaart.",
  "DD-026.10": "Exakte Originalwirkung von Sorting Over ist offen; Hoststeuerung fehlt.",
  "DD-026.11": "Sorting Under ist im Original fehlerbehaftet protokolliert; belastbare Stapelwirkung und Hoststeuerung fehlen.",
  "DD-026.12": "45-Grad-Rotation muss für dasselbe Asset durch UI, sichtbare Wirkung und Karte gepaart werden.",
  "DD-026.13": "Einheitliche native Scale 1,99 und Host-Breite/Höhe sind ohne gemeinsame Bildmessung nicht gleichwertig.",
  "DD-026.14": "Shadow-Schalter ist vorhanden, aber seine Bildwirkung mit demselben Asset ist nicht gepaart.",
  "DD-026.15": "Native Speicherung und konkrete Lichtabschattung bei Block Light sind noch offen.",
  "DD-026.16": "Custom Color und selektive Colorable-Wirkung werden in DD-028 geprüft; dieser Werkzeugfall bleibt offen.",
  "DD-026.18": "Native Atlas-Cursorbildvorschau und Hostvorschau mit gleichem Asset fehlen als Paar.",
  "DD-026.19": "Wenn die Klick-, Datei- oder Reopen-Prüfung scheitert, bleibt die konkrete Platzierungswirkung offen.",
  "DD-026.20": "Original-Escape erhielt das Object Tool; maximierter Host verlässt bisher den Editor.",
  "DD-026.21": "Zwei Hostinstanzen sind belegt, aber wiederholte Platzierung mit Optionswechsel nicht gepaart.",
  "DD-026.22": "Native Speicherwirkung von Mausrad-Drehung ist nicht gemessen; Host-Wheel navigiert die Kamera.",
  "DD-026.23": "Native Speicherwirkung von Alt+Mausrad-Scale ist nicht gemessen; Hostfolge fehlt.",
  "DD-026.24": "Native Speicherwirkung von Umschalt+Mausrad-Assetwechsel ist nicht gemessen; Hostfolge fehlt.",
  "DD-026.25": "A-Halten-Spiegelung blieb in der alten Originalprobe ohne bestätigte Wirkung; Host hat einen Umschalter.",
  "DD-026.26": "Native Wirkung von Rechtsklick-90-Grad ist nicht gemessen; Host startet damit keine Objektaktion.",
  "DD-026.27": "Native Wirkung von Z+Mausrad-Feindrehung ist nicht gemessen; Hostfolge fehlt.",
  "DD-026.28": "Undo/Redo nach mehrfacher Platzierung und Optionswechsel bleibt im Original offen.",
  "DD-026.29": "Host-Speichern und frisches Öffnen werden geprüft; ein frischer Original-Reopen für DD-026 fehlt.",
  "DD-026.30": "Die Wirkung des nativen Suchfeld-X auf Text, Kacheln und Folgeplatzierung ist offen.",
};

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const state = (page) => page.evaluate(() => {
  const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
  return editor && {
    document: editor.session.document(),
    dirty: editor.session.dirty,
    historySize: editor.session.historySize,
  };
});

async function chooseObject(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  await page.locator(".dn-group-rail").getByRole("button", { name: "Objekte", exact: true }).click();
  await page.locator(".dn-tool-rail").getByRole("button", { name: "Objekte platzieren", exact: true }).click();
}

async function pointAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale };
  }, { x, y });
}

async function panelSnapshot(page, file) {
  const snapshot = await page.locator(".dn-properties").evaluate((panel) => ({
    labels: [...panel.querySelectorAll("label")].map((node) => node.textContent?.trim()),
    buttons: [...panel.querySelectorAll("button")].map((node) => ({
      text: node.textContent?.trim(), label: node.getAttribute("aria-label"),
    })),
    selects: [...panel.querySelectorAll("select")].map((node) => ({
      label: node.getAttribute("aria-label"), value: node.value,
      options: [...node.options].map((item) => ({ value: item.value, text: item.text })),
    })),
    inputs: [...panel.querySelectorAll("input")].map((node) => ({
      type: node.type, label: node.getAttribute("aria-label"), value: node.value,
    })),
  }));
  writeJson(file, snapshot);
  return snapshot;
}

async function place(page, x, y, expectedCount, assetId) {
  const point = await pointAt(page, x, y);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction((count) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.document().entities.length === count, expectedCount);
  const current = await state(page);
  const object = current.document.entities.at(-1);
  assert.equal(object?.kind, "object");
  assert.equal(object.assetId, assetId);
  await page.waitForFunction((id) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.renderer.visuals.get(id)?.container.children.some((child) => !!child.texture),
  object.id);
  return { current, object };
}

async function recordOpen(group, record, covered, phase, panelFile, flowFile, facts) {
  for (const id of group.caseIds) {
    if (covered.has(id)) continue;
    const reason = openReasons[id];
    assert(reason, `Fehlende Fallbeschreibung: ${id}`);
    const gap = [reason, group.originalGaps?.[id]].filter(Boolean).join(" Originalgrenze: ");
    record.add(id, "open", `${phase}: ${facts}. ${reason}`, [panelFile, flowFile], gap);
  }
}

async function objectPlacementGroup({ page, out, qa, vault, restart, group, record }) {
  assert.equal(group.id, "objekte-01");
  assert.deepEqual([...group.caseIds].sort(), Object.keys(openReasons).sort());
  const covered = new Set();
  const stateFile = path.join(qa, "objekte-01-saved.json");
  const resultFile = path.join(out, restart ? "reopen-flow.json" : "edit-flow.json");
  const panelFile = path.join(out, restart ? "reopen-panel.json" : "edit-panel.json");
  const add = (id, status, observation, evidence, gap) => {
    record.add(id, status, observation, evidence, gap);
    covered.add(id);
  };

  if (restart) {
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const disk = fs.readFileSync(path.join(vault, mapPath));
    assert.equal(sha256(disk), saved.savedSha256, "Karte zwischen Edit und Frischöffnung geändert");
    await page.evaluate(async (file) => app.workspace.getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(file)), mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const opened = await state(page);
    assert.equal(opened.document.version, 3);
    assert.equal(opened.dirty, false);
    assert.deepEqual(saved.objects.map((object) => opened.document.entities.find((e) => e.id === object.id)),
      saved.objects);
    await page.waitForFunction((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
      return ids.every((id) => renderer.visuals.get(id)?.container.children.some((child) => !!child.texture));
    }, saved.objects.map((object) => object.id));
    await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "reopened.png") });
    await chooseObject(page);
    await panelSnapshot(page, panelFile);
    writeJson(resultFile, { savedSha256: saved.savedSha256, reopenedIds: saved.objects.map((o) => o.id),
      documentVersion: opened.document.version, dirty: opened.dirty, texturesVisible: true });
    add("DD-026.19", "pass",
      `Frisch geöffnet: beide platzierten Paketobjekte ${saved.objects.map((o) => o.id).join("/")} mit exakt gespeicherten Entitätswerten und Texturen.`,
      [resultFile, path.join(out, "reopened.png")]);
    add("DD-026.28", "pass",
      `Frisch geöffnet: die durch Undo entfernte und durch Redo wiederhergestellte erste Instanz ${saved.objects[0].id} blieb exakt gespeichert; Verlauf selbst wurde im Editlauf geprüft.`,
      [resultFile, path.join(out, "reopened.png")]);
    await recordOpen(group, record, covered, "Frischöffnung", panelFile, resultFile,
      "zwei Paketobjekte bytegleich aus V3-Karte geladen; History wurde nicht als prozessübergreifend behauptet");
    return;
  }

  const bytes = fs.readFileSync(fixture);
  assert.equal(sha256(bytes), fixtureSha256);
  await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").create("ObjectPlacementGroupQA", 12, 8));
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await page.evaluate(async (encoded) => {
    const payload = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.assets.add([new Blob([payload])]);
    await plugin.reloadAssets();
    const session = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const before = session.settings;
    session.execute({ label: "QA-Paket für Karte aktivieren",
      settings: { before, after: { ...before, assetPacks: ["QAObjASl"] } } });
  }, bytes.toString("base64"));
  const asset = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
    .listAssets().find((item) => item.name === "QA Object Color"));
  assert(asset?.kind === "object", "QA-Paketobjekt fehlt");
  await chooseObject(page);
  const before = await state(page);
  assert.equal(before.document.entities.length, 0);
  await panelSnapshot(page, panelFile);
  await page.locator(".dn-properties").screenshot({ path: path.join(out, "object-tool-panel.png") });
  await page.getByRole("combobox", { name: "Paketobjekt", exact: true }).selectOption(asset.id);
  const first = await place(page, 2, 4, 1, asset.id);
  assert.equal(first.current.historySize, before.historySize + 1);
  await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "first-placed.png") });
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  const undone = await state(page);
  assert.equal(undone.document.entities.length, 0);
  await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "first-undone.png") });
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  const redone = await state(page);
  assert.deepEqual(redone.document.entities, [first.object]);
  await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "first-redone.png") });
  const second = await place(page, 6, 4, 2, asset.id);
  assert.notEqual(second.object.id, first.object.id);
  await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "two-objects.png") });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.dirty);
  const disk = fs.readFileSync(path.join(vault, mapPath));
  const document = JSON.parse(disk);
  assert.equal(document.version, 3);
  const serializedObjects = JSON.parse(JSON.stringify([first.object, second.object]));
  assert.deepEqual(document.entities, serializedObjects);
  const saved = { mapPath, assetId: asset.id, fixtureSha256,
    objects: serializedObjects, savedSha256: sha256(disk) };
  writeJson(stateFile, saved);
  writeJson(resultFile, { ...saved, history: { before: before.historySize,
    afterFirst: first.current.historySize, afterUndo: undone.historySize,
    afterRedo: redone.historySize, afterSecond: second.current.historySize },
  undoRemovedFirst: true, redoRestoredFirst: true, dirtyAfterSave: false });
  add("DD-026.19", "pass",
    `Object Tool: Klick erzeugte QA-Paketobjekt ${first.object.id}, zweiter Klick ${second.object.id}; beide sind sichtbar und als V3-Entitäten gespeichert.`,
    [resultFile, path.join(out, "first-placed.png"), path.join(out, "two-objects.png")]);
  add("DD-026.28", "pass",
    `Erste Platzierung ${first.object.id}: Undo entfernte das einzige Objekt, Redo stellte dieselben Werte wieder her; Speichern erhielt den Redo-Zustand.`,
    [resultFile, path.join(out, "first-undone.png"), path.join(out, "first-redone.png")]);
  await recordOpen(group, record, covered, "Edit", panelFile, resultFile,
    `QA-Paketobjekt ${asset.id} gewählt, zwei Instanzen platziert und V3 gespeichert`);
}

objectPlacementGroup.caseIds = Object.freeze(Object.keys(openReasons));
module.exports = objectPlacementGroup;
