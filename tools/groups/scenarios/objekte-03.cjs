// Group host scenario: Object/Scatter/Light color, DD-028 and DD-029.05/.17.
// The common runner owns Obsidian, the exclusive GUI slot, and group-record.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const pickerFlowFile = path.join(__dirname, "../../../tests/object-rgba-host-flow.cjs");
const pickerFlow = fs.existsSync(pickerFlowFile) ? require(pickerFlowFile) : null;

const mapPath = "Dungeons/ObjectColorGroupQA/Karte.dungeon";
const fixture = path.join(__dirname, "../fixtures/objekte-03-colorable.dungeondraft_pack");
const fixtureSha256 = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const expectedColor = 0x4080c0;
const openReasons = {
  "DD-028.01": "Farb-/Sättigungsfeld: Bedienung, RGB-Wert und Platzierung fehlen als gepaarter Original-/Hostfall.",
  "DD-028.02": "Farbtonleiste: Farbtonänderung und gespeichertes Objekt wurden nicht gepaart.",
  "DD-028.03": "R-Zahlenfeld: Kanaländerung und daraus platzierte Farbe wurden nicht gepaart.",
  "DD-028.04": "G-Zahlenfeld: Kanaländerung und daraus platzierte Farbe wurden nicht gepaart.",
  "DD-028.05": "B-Zahlenfeld: Kanaländerung und daraus platzierte Farbe wurden nicht gepaart.",
  "DD-028.06": "RGBA-Picker: A=0/128, Livevorschau, ein Undo-Schritt und Neustart sind hier noch nicht gemeinsam geprüft.",
  "DD-028.07": "Hex-Eingabe: sechsstellige Eingabe bei A<255 und native Alpha-Auslegung sind nicht gepaart.",
  "DD-028.08": "Accept: Livewert, Folgeobjekt und Änderung am ausgewählten Objekt sind noch nicht gemeinsam geprüft.",
  "DD-028.09": "Object-Picker: kreisförmige Taste und Escape-Schließen sind hier nicht direkt gepaart.",
  "DD-028.10": "Object-Palette: Vorgabe, Werkzeugfarbe und unverändertes bereits platziertes Objekt sind nicht gepaart.",
  "DD-028.11": "Colorable-Pixel: selektive Tönung des QA-Objekts ist in dieser Phase nicht belastbar verglichen.",
  "DD-028.12": "Colorable-Alpha: A=0/128/255 und Speichern/Neustart sind in dieser Phase nicht belastbar verglichen.",
  "DD-028.13": "Scatter-Farbe: Farbe und Alpha aller gestreuten Instanzen fehlen als gepaarter Fall.",
  "DD-028.14": "Light-Farbe: ARGB-Speicherung und sichtbarer Lichtverlauf fehlen als gepaarter Fall.",
  "DD-028.15": "Scatter-Palette: Öffnen und Übernahme einer Vorgabe ins Farbfeld fehlen als gepaarter Fall.",
  "DD-028.16": "Scatter-Picker: kreisförmige Taste und Außenklick fehlen als gepaarter Fall.",
  "DD-028.17": "Light-Palette: Öffnen und Übernahme einer Vorgabe ins Farbfeld fehlen als gepaarter Fall.",
  "DD-028.18": "Light-Picker: Taste und Picker-Startfarbe fehlen als gepaarter Fall.",
  "DD-028.19": "Picker-Pipette: Funktion des kleinen Knopfs ist im Original ungeklärt und im Host ungeprüft.",
  "DD-029.05": "Neue Lichtquelle: gewählte Farbe und sichtbarer Lichtverlauf fehlen als gepaarter Fall.",
  "DD-029.17": "Ausgewählte Lichtquelle: Farbänderung, Undo/Redo und Neustart fehlen als gepaarter Fall.",
};

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const editorState = (page) => page.evaluate(() => {
  const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
  return editor && {
    document: editor.session.document(),
    dirty: editor.session.dirty,
    historySize: editor.session.historySize,
  };
});

async function chooseTool(page, group, tool) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  await page.locator(".dn-group-rail").getByRole("button", { name: group, exact: true }).click();
  await page.locator(".dn-tool-rail").getByRole("button", { name: tool, exact: true }).click();
}
const chooseObject = (page) => chooseTool(page, "Objekte", "Objekte platzieren");
const chooseScatter = (page) => chooseTool(page, "Objekte", "Streuen");
const chooseLight = (page) => chooseTool(page, "Beleuchtung", "Lichtquelle");
const chooseByOldName = (page, label) => {
  if (label === "Auswahl") return chooseTool(page, "Auswahl", "Auswahl");
  if (label === "Möbel") return chooseObject(page);
  throw new Error("Unbekanntes Werkzeug: " + label);
};

async function panelSnapshot(page) {
  const panels = {};
  for (const [name, choose] of [
    ["object", chooseObject], ["scatter", chooseScatter], ["light", chooseLight],
  ]) {
    await choose(page);
    panels[name] = await page.locator(".dn-properties").evaluate((host) => ({
      labels: [...host.querySelectorAll("label")].map((node) => node.textContent?.trim()).filter(Boolean),
      buttons: [...host.querySelectorAll("button")].map((node) => ({
        text: node.textContent?.trim(), label: node.getAttribute("aria-label"), title: node.title,
      })),
      inputs: [...host.querySelectorAll("input")].map((node) => ({
        type: node.type, label: node.getAttribute("aria-label"), value: node.value,
      })),
    }));
  }
  return panels;
}

async function pointAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale };
  }, { x, y });
}

async function setPlainBackground(page) {
  await page.evaluate(() => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    renderer.appearance.mapFill = 0x252525;
    renderer.appearance.grid = false;
    renderer.drawGrid();
    renderer.invalidate();
  });
}

async function screenshotSamples(page, file) {
  const png = PNG.sync.read(await page.locator(".dn-canvas canvas").screenshot({ path: file }));
  const rgb = (x, y) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
  assert(png.width > 388 && png.height > 500, "Canvas zu klein für feste QA-Probe");
  return {
    colorable: [60, 204, 348].map((x) => rgb(x, 500)),
    fixed: [100, 244, 388].map((x) => rgb(x, 500)),
  };
}

function selectivePixelResult(samples, alphaOrder) {
  const { colorable: c, fixed: f } = samples;
  const a0 = alphaOrder.indexOf(0);
  const a128 = alphaOrder.indexOf(128);
  const a255 = alphaOrder.indexOf(255);
  assert(a0 >= 0 && a128 >= 0 && a255 >= 0, "Alpha-Probe braucht A0/A128/A255");
  const a0IsBackground = c[a0].every((channel) => channel === 37);
  const a128IsHalf = c[a128].every((channel, index) =>
    Math.abs(channel - (37 + (c[a255][index] - 37) * 128 / 255)) <= 2);
  const fixedUnaffected = f[a128].every((channel, index) => Math.abs(channel - f[a255][index]) <= 1) &&
    f[a0].every((channel, index) => Math.abs(channel - f[a255][index]) <= 1);
  return { a0IsBackground, a128IsHalf, fixedUnaffected };
}

async function placedObjectPixels(page, file, baselineId, placedId) {
  const positions = await page.evaluate(([baseId, nextId]) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const base = editor.session.entities.get(baseId);
    const next = editor.session.entities.get(nextId);
    if (!base || !next) throw new Error("Pixelreferenz-Objekt fehlt");
    return { x: Math.round(60 + (next.x - base.x) * editor.renderer.camera.scale),
      y: Math.round(500 + (next.y - base.y) * editor.renderer.camera.scale) };
  }, [baselineId, placedId]);
  const png = PNG.sync.read(await page.locator(".dn-canvas canvas").screenshot({ path: file }));
  const read = (x, y) => {
    assert(x >= 0 && x < png.width && y >= 0 && y < png.height, "Pixelprobe außerhalb des Canvas");
    return [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
  };
  return { ...positions, colorable: read(positions.x, positions.y),
    fixed: read(positions.x + 40, positions.y) };
}

const channelsNear = (actual, expected, tolerance = 2) =>
  actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance);

async function waitForPlacedPixels(page, file, baselineId, placedId, samples) {
  const deadline = Date.now() + 5000;
  let pixels;
  do {
    pixels = await placedObjectPixels(page, file, baselineId, placedId);
    if (channelsNear(pixels.colorable, samples.colorable[1]) &&
        channelsNear(pixels.fixed, samples.fixed[1])) return pixels;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  throw new Error(`Neu platziertes QA-Objekt zeigt nicht RGB 4080c0/A128: ${JSON.stringify(pixels)}`);
}

function recordRemaining(group, record, phase, panelFile, panels, covered, facts) {
  for (const id of group.caseIds) {
    if (covered.has(id)) continue;
    const reason = openReasons[id];
    assert(reason, `Fehlende Fallbeschreibung: ${id}`);
    const area = id === "DD-028.19" ? "object/scatter/light" :
      ["DD-028.13", "DD-028.15", "DD-028.16"].includes(id) ? "scatter" :
      ["DD-028.14", "DD-028.17", "DD-028.18", "DD-029.05", "DD-029.17"].includes(id)
        ? "light" : "object";
    const names = area.split("/");
    const visible = Object.fromEntries(names.map((name) => [name, {
      colorInputs: panels[name].inputs.filter((item) => /farbe|color|hex|alpha/i.test(item.label ?? ""))
        .map((item) => `${item.label}=${item.value}`),
      colorButtons: panels[name].buttons.filter((item) => /farbe|color|palette|rgba/i.test(
        `${item.text} ${item.label} ${item.title}`))
        .map((item) => item.label || item.text || item.title),
    }]));
    record.add(id, "open",
      `${phase === "edit" ? "Edit" : "Frischöffnung"}: ${facts}; sichtbare ${area}-Farbsteuerung ${JSON.stringify(visible)}. ${reason}`,
      [panelFile], reason);
  }
}

async function createFixture(page, vault, out) {
  const bytes = fs.readFileSync(fixture);
  assert.equal(digest(bytes), fixtureSha256);
  await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").create("ObjectColorGroupQA", 12, 8));
  await page.locator(".dungeon-native-editor:visible").last()
    .getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction((path) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === path)?.view.editor;
    return !!editor && !editor.session.mutationsHeld;
  }, mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.assets.add([new Blob([bytes])]);
    await plugin.reloadAssets();
    const session = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const before = session.settings;
    session.execute({ label: "QA-Paket für Karte aktivieren",
      settings: { before, after: { ...before, assetPacks: ["QAObjASl"] } } });
  }, bytes.toString("base64"));
  const asset = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
    .listAssets().find((item) => item.name === "QA Object Color"));
  assert(asset?.kind === "object" && asset.tintable, "Colorable-QA-Objekt fehlt");
  await chooseObject(page);
  await page.getByRole("combobox", { name: "Paketobjekt", exact: true }).selectOption(asset.id);
  await page.locator('input[aria-label="Objektfarbe"]').fill("#4080c0");
  await page.locator('input[aria-label="Objektfarbe"]').press("Tab");
  for (const label of ["Breite in Feldern", "Höhe in Feldern"]) {
    const input = page.locator(`input[aria-label="${label}"]`);
    await input.fill("2.8");
    await input.press("Tab");
  }
  await page.locator('input[aria-label="Schatten"]').uncheck();
  await setPlainBackground(page);
  const ids = [];
  for (const [index, alpha] of [255, 128, 0].entries()) {
    await chooseObject(page);
    const input = page.locator('input[aria-label="Objektfarbe Alpha (0–255)"]');
    await input.fill(String(alpha));
    await input.press("Tab");
    const before = (await editorState(page)).document.entities.length;
    const point = await pointAt(page, 2 + index * 3, 4);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction((count) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.document().entities.length === count + 1, before);
    const placed = (await editorState(page)).document.entities.at(-1);
    assert.equal(placed?.kind, "object");
    assert.equal(placed.assetId, asset.id);
    assert.equal(placed.color, expectedColor);
    assert.equal(placed.alpha, alpha);
    ids.push(placed.id);
  }
  await page.waitForFunction((ids) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    return ids.every((id) => renderer.visuals.get(id)?.container.children.some((child) => !!child.texture));
  }, ids);
  const samples = await screenshotSamples(page, path.join(out, "colorable-a255-a128-a0.png"));
  const pixelResult = selectivePixelResult(samples, [255, 128, 0]);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  const disk = fs.readFileSync(path.join(vault, mapPath));
  const saved = JSON.parse(disk);
  assert.equal(saved.version, 3);
  const savedAlpha = ids.map((id) => saved.entities.find((entity) => entity.id === id)?.alpha);
  return { mapPath, ids, assetId: asset.id, fixtureSha256, color: expectedColor,
    savedAlpha, savedSha256: digest(disk), samples, pixelResult };
}

async function toolPickerPlacement(page, vault, out, baseline) {
  await chooseObject(page);
  const rgbInput = page.locator('input[aria-label="Objektfarbe"]');
  await rgbInput.fill("#ff0000");
  await rgbInput.press("Tab");
  const alphaInput = page.locator('input[aria-label="Objektfarbe Alpha (0–255)"]');
  await alphaInput.fill("255");
  await alphaInput.press("Tab");
  const beforePicker = await editorState(page);
  const opener = page.getByRole("button", { name: "Objektfarbe RGBA öffnen", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
  await dialog.waitFor();
  const hex = dialog.getByRole("textbox", { name: "Hex ARGB" });
  assert.equal(await hex.inputValue(), "ff0000");
  for (const [channel, value] of [["R", "64"], ["G", "128"], ["B", "192"], ["A", "128"]])
    await dialog.getByRole("spinbutton", { name: channel, exact: true }).fill(value);
  assert.equal(await hex.inputValue(), "804080c0");
  const swatchColor = await dialog.locator(".dn-object-rgba-swatch")
    .evaluate((node) => node.style.backgroundColor);
  assert.match(swatchColor, /^rgba\(64, 128, 192, 0\./);
  await dialog.screenshot({ path: path.join(out, "tool-picker-before-accept.png") });
  const beforeAccept = await editorState(page);
  assert.equal(beforeAccept.document.entities.length, beforePicker.document.entities.length);
  assert.equal(beforeAccept.historySize, beforePicker.historySize);
  await dialog.getByRole("button", { name: "Accept", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  const afterAccept = await editorState(page);
  assert.equal(afterAccept.document.entities.length, beforePicker.document.entities.length);
  assert.equal(afterAccept.historySize, beforePicker.historySize);

  const placeAt = await pointAt(page, 10, 1.5);
  await page.mouse.move(placeAt.x, placeAt.y);
  await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "tool-before-placement.png") });
  await page.mouse.click(placeAt.x, placeAt.y);
  await page.waitForFunction((count) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.document().entities.length === count + 1,
  beforePicker.document.entities.length);
  const placedState = await editorState(page);
  const placed = placedState.document.entities.at(-1);
  assert.equal(placed?.kind, "object");
  assert.equal(placed.assetId, baseline.assetId);
  assert.equal(placed.color, expectedColor);
  assert.equal(placed.alpha, 128);
  assert.equal(placedState.historySize, beforePicker.historySize + 1);
  await page.waitForFunction((id) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.renderer.visuals.get(id)?.container.children.some((child) => !!child.texture),
  placed.id);
  const pixels = await waitForPlacedPixels(page,
    path.join(out, "tool-object-placed.png"), baseline.ids[0], placed.id,
    baseline.samples);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  const undone = await editorState(page);
  assert(!undone.document.entities.some((entity) => entity.id === placed.id));
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  const redone = await editorState(page);
  assert.deepEqual(redone.document.entities.find((entity) => entity.id === placed.id), placed);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.dirty);
  const disk = fs.readFileSync(path.join(vault, mapPath));
  const saved = JSON.parse(disk);
  assert.equal(saved.version, 3);
  const diskObject = saved.entities.find((entity) => entity.id === placed.id);
  assert.equal(diskObject?.kind, "object");
  assert.equal(diskObject.assetId, baseline.assetId);
  assert.equal(diskObject.color, expectedColor);
  assert.equal(diskObject.alpha, 128);
  const result = { id: placed.id, assetId: placed.assetId, color: placed.color,
    alpha: placed.alpha, pickerHex: "804080c0", rgbFields: [64, 128, 192],
    swatchColor,
    historyBefore: beforePicker.historySize, historyAfterPlacement: placedState.historySize,
    undoRemoved: true, redoRestored: true, pixels, savedSha256: digest(disk) };
  writeJson(path.join(out, "tool-placement.json"), result);
  return result;
}

// One installed-build acceptance probe. The common group recorder leaves every
// unrelated manifest case open in this run; importing this module starts no GUI.
async function dd02808Only({ page, out, qa, vault, restart, group, record }) {
  assert.equal(group.id, "objekte-03");
  assert(group.caseIds.includes("DD-028.08"));
  const stateFile = path.join(qa, "objekte-03-dd02808-installed-saved.json");
  if (!restart) {
    const baseline = await createFixture(page, vault, out);
    const placed = await toolPickerPlacement(page, vault, out, baseline);
    const state = { mapPath, baselineIds: baseline.ids,
      baselineSamples: baseline.samples, placed,
      mapSha256: digest(fs.readFileSync(path.join(vault, mapPath))) };
    writeJson(stateFile, state);
    record.add("DD-028.08", "pass",
      "Object-Tool-Picker: RGB 4080c0/A128 und Hex 804080c0 vor Accept; die folgende Colorable-Platzierung speichert den Wert, Undo entfernt sie, Redo stellt sie wieder her.",
      [path.join(out, "tool-picker-before-accept.png"),
        path.join(out, "tool-before-placement.png"),
        path.join(out, "tool-object-placed.png"),
        path.join(out, "tool-placement.json"), stateFile]);
    return;
  }

  const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(digest(fs.readFileSync(path.join(vault, saved.mapPath))),
    saved.mapSha256, "DD-028.08: Karte zwischen Edit und Frischstart geändert");
  await page.evaluate(async (file) => app.workspace.getLeaf(false)
    .openFile(app.vault.getAbstractFileByPath(file)), saved.mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await setPlainBackground(page);
  await page.waitForFunction((ids) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return ids.every((id) => renderer.visuals.get(id)?.container.children
      .some((child) => !!child.texture));
  }, [...saved.baselineIds, saved.placed.id]);
  const reopened = await editorState(page);
  const object = reopened.document.entities.find((entity) => entity.id === saved.placed.id);
  const propertiesMatch = object?.kind === "object" &&
    object.assetId === saved.placed.assetId &&
    object.color === expectedColor && object.alpha === 128 && !reopened.dirty;
  const pixels = await waitForPlacedPixels(page,
    path.join(out, "dd02808-object-reopened.png"), saved.baselineIds[0],
    saved.placed.id, saved.baselineSamples);
  const pixelsMatch = channelsNear(pixels.colorable,
    saved.baselineSamples.colorable[1]) &&
    channelsNear(pixels.fixed, saved.baselineSamples.fixed[1]);
  const resultFile = path.join(out, "dd02808-reopen.json");
  writeJson(resultFile, { object, propertiesMatch, pixels, pixelsMatch,
    dirty: reopened.dirty, mapSha256: saved.mapSha256 });
  record.add("DD-028.08", propertiesMatch && pixelsMatch ? "pass" : "deviation",
    `Frisch geöffnet: platziertes Objekt RGB ${object?.color?.toString(16)}, A=${object?.alpha}; Karte unverändert=${propertiesMatch}, färbbare/feste Pixel erhalten=${pixelsMatch}.`,
    [resultFile, path.join(out, "dd02808-object-reopened.png")],
    propertiesMatch && pixelsMatch ? null :
      "RGBA-Wert, gespeicherte Instanz oder Pixelwirkung nach Frischstart abweichend.");
}

module.exports = async function objectColorGroup({ page, out, qa, vault, restart, group, record }) {
  assert.equal(group.id, "objekte-03");
  assert.deepEqual([...group.caseIds].sort(), Object.keys(openReasons).sort());
  if (process.env.DUNGEON_QA_DD02816_ONLY === "1")
    return require("./objekte-03-scatter-outside.cjs")({
      page, out, qa, vault, restart, group, record,
    });
  if (process.env.DUNGEON_QA_DD02817_ONLY === "1")
    return require("./objekte-03-light-palette.cjs")({
      page, out, qa, vault, restart, group, record,
    });
  if (process.argv.includes("--dd028-picker-lifecycle"))
    return require("./objekte-03-picker-lifecycle.cjs")({
      page, out, qa, vault, restart, group, record,
      helpers: { createFixture, chooseTool, editorState, screenshotSamples,
        setPlainBackground, writeJson, digest, mapPath },
    });
  if (process.argv.includes("--dd02808-only"))
    return dd02808Only({ page, out, qa, vault, restart, group, record });
  const covered = new Set();
  const stateFile = path.join(qa, "objekte-03-saved.json");
  const pickerStateFile = path.join(qa, "objekte-03-picker.json");
  const add = (id, state, observation, evidence, gap) => {
    record.add(id, state, observation, evidence, gap);
    covered.add(id);
  };
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const disk = fs.readFileSync(path.join(vault, mapPath));
    assert.equal(digest(disk), saved.savedSha256, "Karte zwischen Edit und Frischöffnung geändert");
    await page.evaluate(async (file) => app.workspace.getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(file)), mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await setPlainBackground(page);
    await page.waitForFunction((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
      return ids.every((id) => renderer.visuals.get(id)?.container.children.some((child) => !!child.texture));
    }, saved.ids);
    const reopened = await editorState(page);
    const alpha = saved.ids.map((id) => reopened.document.entities.find((entity) => entity.id === id)?.alpha);
    const samples = await screenshotSamples(page, path.join(out, "colorable-reopened.png"));
    const pixels = selectivePixelResult(samples, saved.alphaAfter);
    const resultFile = path.join(out, "object-color-reopen.json");
    writeJson(resultFile, { saved, alpha, samples, pixels, dirty: reopened.dirty });
    const byteStable = !reopened.dirty && JSON.stringify(alpha) === JSON.stringify(saved.alphaAfter);
    add("DD-028.11", pixels.a0IsBackground && pixels.a128IsHalf && pixels.fixedUnaffected ? "pass" : "fail",
      `Frisch geöffnet: selektive Pixel bei A0/A128; Messung ${JSON.stringify(pixels)}.`,
      [resultFile, path.join(out, "colorable-reopened.png")]);
    add("DD-028.12", byteStable && pixels.a0IsBackground && pixels.a128IsHalf ? "pass" : "fail",
      `Frisch geöffnet: Alpha je Objekt ${alpha.join("/")}, gespeichert ${saved.alphaAfter.join("/")}; dirty=${reopened.dirty}.`,
      [resultFile]);
    if (saved.pickerExecuted) {
      assert(pickerFlow, "Picker-Helfer fehlt beim Wiederöffnen eines Picker-Laufs");
      await pickerFlow.verifyReopen({ page,
        chooseTool: (label) => chooseByOldName(page, label),
        view: () => editorState(page), stateFile: pickerStateFile, vault, out });
    }
    let toolReopenFile;
    if (saved.toolPlacement) {
      const placed = reopened.document.entities.find((entity) => entity.id === saved.toolPlacement.id);
      const coreStable = placed?.kind === "object" && placed.assetId === saved.toolPlacement.assetId &&
        placed.color === expectedColor && placed.alpha === 128 && !reopened.dirty;
      await page.waitForFunction((id) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer.visuals.get(id)?.container.children.some((child) => !!child.texture),
      saved.toolPlacement.id);
      const toolPixels = await waitForPlacedPixels(page,
        path.join(out, "tool-object-reopened.png"), saved.ids[0], saved.toolPlacement.id,
        saved.samples);
      const colorableStable = channelsNear(toolPixels.colorable, saved.samples.colorable[1]);
      const fixedStable = channelsNear(toolPixels.fixed, saved.samples.fixed[1]);
      toolReopenFile = path.join(out, "tool-placement-reopen.json");
      writeJson(toolReopenFile, { id: saved.toolPlacement.id, coreStable,
        colorableStable, fixedStable, toolPixels, savedSha256: saved.savedSha256 });
      for (const id of ["DD-028.06", "DD-028.08"])
        add(id, coreStable && colorableStable && fixedStable ? "pass" : "fail",
          `Frisch geöffnet: neu per Object-Tool-Picker platzierte Instanz RGB ${placed?.color?.toString(16)}, A=${placed?.alpha}; färbbarer A128-Pixel=${toolPixels.colorable.join("/")}, fester Pixel=${toolPixels.fixed.join("/")}.`,
          [toolReopenFile, path.join(out, "tool-object-reopened.png")]);
    }
    if (saved.toolPickerOpened) {
      await chooseObject(page);
      const opener = page.getByRole("button", { name: "Objektfarbe RGBA öffnen", exact: true });
      const available = await opener.count() === 1;
      if (available) {
        await opener.click();
        const dialog = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
        await dialog.waitFor();
        await dialog.screenshot({ path: path.join(out, "object-picker-reopen-open.png") });
        await dialog.press("Escape");
        await dialog.waitFor({ state: "detached" });
      }
      add("DD-028.09", available ? "pass" : "fail",
        `Frisch geöffnet: kreisförmiger Object-Picker-Öffner sichtbar=${available}; Escape schließt den Picker ${available ? "erneut" : "nicht geprüft"}.`,
        available ? [resultFile, path.join(out, "object-picker-reopen-open.png")] : [resultFile]);
    }
    const panels = await panelSnapshot(page);
    const panelFile = path.join(out, "color-panels-reopen.json");
    writeJson(panelFile, panels);
    recordRemaining(group, record, "reopen", panelFile, panels, covered,
      `QA-Objekte Alpha ${alpha.join("/")}; Object/Scatter/Light-Bedienfelder gesichert`);
    return;
  }

  const baseline = await createFixture(page, vault, out);
  add("DD-028.11", Object.values(baseline.pixelResult).every(Boolean) ? "pass" : "fail",
    `A255/A128/A0: färbbare Pixel und feste Pixel getrennt gemessen; ${JSON.stringify(baseline.pixelResult)}.`,
    [path.join(out, "colorable-a255-a128-a0.png")]);
  add("DD-028.12", JSON.stringify(baseline.savedAlpha) === JSON.stringify([255, 128, 0]) &&
    baseline.pixelResult.a0IsBackground && baseline.pixelResult.a128IsHalf ? "pass" : "fail",
    `V3-Datei speichert QA-Objekt-Alpha ${baseline.savedAlpha.join("/")}; A0 und A128 sind sichtbar wirksam.`,
    [path.join(out, "colorable-a255-a128-a0.png"), stateFile]);
  await chooseObject(page);
  const opener = page.getByRole("button", { name: "Objektfarbe RGBA öffnen", exact: true });
  let toolPickerOpened = false;
  let toolPlacement = null;
  let pickerExecuted = false;
  let pickerResult = null;
  if (await opener.count() === 1) {
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
    await dialog.waitFor();
    await dialog.screenshot({ path: path.join(out, "object-picker-tool-open.png") });
    await dialog.press("Escape");
    await dialog.waitFor({ state: "detached" });
    toolPickerOpened = true;
    add("DD-028.09", "pass", "Object Tool: kreisförmige Taste öffnet den RGBA/Hex-Picker; Escape schließt ihn.",
      [path.join(out, "object-picker-tool-open.png"), path.join(out, "object-color-panels.json")]);
    const tileResult = await require("./objekte-03-library-tile.cjs")({
      page, out, assetId: baseline.assetId,
    });
    toolPlacement = await toolPickerPlacement(page, vault, out, baseline);
    await require("./objekte-03-library-tile.cjs").verifyAfterPlacement({
      page, out, expectedHash: tileResult.a128BeforeAccept.hash,
    });
    if (pickerFlow) {
      pickerResult = await pickerFlow.runEdit({ page,
        chooseTool: (label) => chooseByOldName(page, label),
        ids: baseline.ids, mapPath, vault, out, stateFile: pickerStateFile });
      pickerExecuted = true;
    }
    const finalDiskObject = JSON.parse(fs.readFileSync(path.join(vault, mapPath), "utf8"))
      .entities.find((entity) => entity.id === toolPlacement.id);
    assert.equal(finalDiskObject?.color, expectedColor);
    assert.equal(finalDiskObject?.alpha, 128);
    add("DD-028.06", "pass",
      `Object-Tool-Picker R/G/B=64/128/192, A=128: Bibliothekskachel ändert vor Accept und Escape ihre färbbaren Pixel (${tileResult.pixels.transparentColorable}); neue Instanz ${toolPlacement.id} mit RGB 4080c0/A128 platziert, sichtbar gemessen, durch Undo entfernt, Redo wiederhergestellt und gespeichert.${pickerExecuted ? " Ausgewählte Instanzen zusätzlich geprüft." : ""}`,
      [path.join(out, "tool-placement.json"), path.join(out, "tool-picker-before-accept.png"),
        path.join(out, "tool-object-placed.png"), path.join(out, "object-library-tile-result.json"),
        path.join(out, "object-library-tile-a128-before-accept.png"),
        path.join(out, "object-library-tile-a0-before-escape.png"),
        path.join(out, "object-library-tile-a128-after-refresh.png"),
        path.join(out, "object-library-tile-a0-after-refresh.png"),
        path.join(out, "object-library-tile-after-placement.png"),
        ...(pickerExecuted ? [pickerStateFile] : [])]);
    add("DD-028.08", "pass",
      `Accept im Object-Tool-Picker schließt mit Hex 804080c0; die folgende neue Instanz ${toolPlacement.id} speichert RGB 4080c0/A128 ohne Rundung, Undo/Redo erhalten sie.`,
      [path.join(out, "tool-placement.json"), path.join(out, "tool-before-placement.png"),
        path.join(out, "tool-object-placed.png")]);
  }
  const panels = await panelSnapshot(page);
  const panelFile = path.join(out, "object-color-panels.json");
  writeJson(panelFile, { panels, toolPickerOpened, toolPlacement, pickerExecuted, pickerResult });
  const current = await editorState(page);
  const alphaAfter = baseline.ids.map((id) => current.document.entities.find((entity) => entity.id === id)?.alpha);
  const disk = fs.readFileSync(path.join(vault, mapPath));
  writeJson(stateFile, { ...baseline, toolPickerOpened, toolPlacement, pickerExecuted,
    alphaAfter, savedSha256: digest(disk) });
  recordRemaining(group, record, "edit", panelFile, panels, covered,
    `QA-Objekte Alpha ${alphaAfter.join("/")}; Tool-Picker geöffnet=${toolPickerOpened}; neue Folgeplatzierung=${!!toolPlacement}; Object/Scatter/Light-Bedienfelder gesichert`);
};
