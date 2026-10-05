// Bounded DD-043 raster probe. Every case stays open until its native option
// and the actual editor export command are paired on the same scene.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const mapPath = "Dungeons/ExportGroupQA/Karte.dungeon";
const vttMapPath = "Dungeons/ExportVttGroupQA/Karte.dungeon";
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const state = (page, targetPath) => page.evaluate((targetPath) => {
  const leaf = app.workspace.getLeavesOfType("dungeon-native-map")
    .find((candidate) => !targetPath || candidate.view.file?.path === targetPath);
  const editor = leaf?.view?.editor;
  return editor && { document: editor.session.document(), dirty: editor.session.dirty,
    history: editor.session.historySize, camera: { ...editor.renderer.camera } };
}, targetPath);
const pixelsChanged = (a, b) => {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let count = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3])
      count++;
  return count;
};
async function capture(page, out, name, pixelsPerField, grid) {
  const before = await state(page);
  const result = await page.evaluate(async ({ pixelsPerField, grid }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const canvas = await editor.renderer.captureMap({ pixelsPerField, grid });
    return { width: canvas.width, height: canvas.height,
      dataUrl: canvas.toDataURL("image/png") };
  }, { pixelsPerField, grid });
  const after = await state(page);
  assert(same(before, after), "Export muss Dokument, Dirty-Flag, History und Kamera erhalten");
  assert.equal(result.width, 8 * pixelsPerField);
  assert.equal(result.height, 8 * pixelsPerField);
  assert(result.dataUrl.startsWith("data:image/png;base64,"));
  const bytes = Buffer.from(result.dataUrl.split(",", 2)[1], "base64");
  const image = PNG.sync.read(bytes);
  assert.equal(image.width, result.width);
  assert.equal(image.height, result.height);
  const file = path.join(out, `${name}.png`);
  fs.writeFileSync(file, bytes);
  return { file, bytes, image, sha256: sha256(bytes),
    width: image.width, height: image.height };
}
async function openExportDialog(page) {
  const menu = page.locator(".dungeon-native-editor").last().locator(".dn-menu");
  if (!(await menu.evaluate((element) => element.open)))
    await menu.locator("summary").click();
  await menu.locator(".dn-menu-content")
    .getByRole("button", { name: "Exportieren", exact: true }).click();
  const dialog = page.locator(".modal-container").last();
  await dialog.getByText("Karte exportieren", { exact: true }).waitFor();
  assert.equal((await dialog.locator(".dn-export-dimensions").textContent()).trim(),
    "Ausgabe: 2048 × 2048 Pixel");
  assert.equal(await dialog.locator(".setting-item").filter({ hasText: "Raster exportieren" })
    .locator(".checkbox-container").evaluate((element) => element.classList.contains("is-enabled")), true);
  assert.equal(await dialog.locator(".setting-item").filter({ hasText: "Beleuchtung exportieren" })
    .locator(".checkbox-container").evaluate((element) => element.classList.contains("is-enabled")), true);
  return dialog;
}
async function exportFromMenu(page, out, format, pixelsPerCell, includeGrid) {
  // The Electron CDP connection does not keep Playwright's download artifact.
  // Capture the Blob handed to the real anchor, while leaving its click intact.
  await page.evaluate(() => {
    const create = URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    window.__exportProbe = null;
    URL.createObjectURL = function (blob) {
      window.__exportProbe = { blob };
      return create.call(URL, blob);
    };
    HTMLAnchorElement.prototype.click = function () {
      if (window.__exportProbe) window.__exportProbe.filename = this.download;
      return click.call(this);
    };
    window.__restoreExportProbe = () => {
      URL.createObjectURL = create;
      HTMLAnchorElement.prototype.click = click;
    };
  });
  const dialog = await openExportDialog(page);
  const formatSelect = dialog.locator(".setting-item").filter({ hasText: "Format" })
    .locator("select:not(.is-measuring)");
  await formatSelect.selectOption(format);
  await dialog.locator(".setting-item").filter({ hasText: "Pixel pro Feld" })
    .locator('input[type="number"]').fill(String(pixelsPerCell));
  const grid = dialog.locator(".setting-item").filter({ hasText: "Raster exportieren" })
    .locator(".checkbox-container");
  if ((await grid.evaluate((element) => element.classList.contains("is-enabled"))) !== includeGrid)
    await grid.click();
  await dialog.getByRole("button", { name: "Exportieren", exact: true }).click();
  await page.waitForFunction(() => window.__exportProbe?.filename, null, { timeout: 30000 });
  const result = await page.evaluate(async () => {
    const probe = window.__exportProbe;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(probe.blob);
    });
    window.__restoreExportProbe();
    return { filename: probe.filename, base64: dataUrl.split(",", 2)[1] };
  });
  const filename = result.filename;
  const saved = path.join(out, `ui-${format}-${pixelsPerCell}-${includeGrid ? "grid" : "no-grid"}-${filename}`);
  const bytes = Buffer.from(result.base64, "base64");
  fs.writeFileSync(saved, bytes);
  return { file: saved, filename, bytes };
}
async function cancelFromMenu(page, out) {
  const before = await state(page, mapPath);
  await page.evaluate(() => {
    const create = URL.createObjectURL;
    window.__cancelExportBlobs = 0;
    URL.createObjectURL = function (blob) {
      window.__cancelExportBlobs++;
      return create.call(URL, blob);
    };
    window.__restoreCancelExportProbe = () => { URL.createObjectURL = create; };
  });
  const dialog = await openExportDialog(page);
  const modes = await dialog.locator(".setting-item").filter({ hasText: "Format" })
    .locator("select:not(.is-measuring) option")
    .evaluateAll((options) => options.map((option) => option.value));
  assert.deepEqual(modes, ["png", "jpeg", "webp", "universal-vtt"]);
  const screenshot = path.join(out, "export-dialog-before-x.png");
  await dialog.screenshot({ path: screenshot });
  const box = await dialog.locator(".modal").first().boundingBox();
  assert(box, "Exportdialog hat keine sichtbare Modalfäche");
  await page.mouse.click(box.x + box.width - 25, box.y + 20);
  await dialog.waitFor({ state: "hidden" });
  const blobs = await page.evaluate(() => {
    const count = window.__cancelExportBlobs;
    window.__restoreCancelExportProbe();
    return count;
  });
  assert.equal(blobs, 0);
  assert(same(before, await state(page, mapPath)));
  return { blobs, stateUnchanged: true, screenshot };
}
async function exportMeasuredVttShape(page, out, name) {
  const before = await state(page, vttMapPath);
  const exported = await exportFromMenu(page, out, "universal-vtt", 256, false);
  assert.equal(exported.filename, "Karte.dd2vtt");
  const json = JSON.parse(exported.bytes.toString("utf8"));
  assert.equal(json.format, 0.3);
  assert.deepEqual(json.resolution, { map_origin: { x: 0, y: 0 },
    map_size: { x: 8, y: 8 }, pixels_per_grid: 256 });
  assert.deepEqual(json.line_of_sight, [[
    { x: 6, y: 3.5 }, { x: 6, y: 4 }, { x: 4, y: 5 },
    { x: 2, y: 2 }, { x: 4, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 2.5 },
  ]]);
  assert.deepEqual(json.objects_line_of_sight, []);
  assert.deepEqual(json.portals, [{ position: { x: 6, y: 3 },
    bounds: [{ x: 6, y: 2.5 }, { x: 6, y: 3.5 }],
    rotation: 1.570796, closed: true, freestanding: false }]);
  assert.deepEqual(json.lights, [{ position: { x: 4, y: 2.84375 },
    range: 5, intensity: 1, color: "ffeccd8b", shadows: true }]);
  const image = PNG.sync.read(Buffer.from(json.image, "base64"));
  assert.equal(image.width, 2048);
  assert.equal(image.height, 2048);
  assert(same(before, await state(page, vttMapPath)));
  const embedded = path.join(out, `${name}-embedded.png`);
  fs.writeFileSync(embedded, Buffer.from(json.image, "base64"));
  return { file: exported.file, embedded, imageSha256: sha256(fs.readFileSync(embedded)),
    geometry: { lineOfSight: json.line_of_sight, portals: json.portals,
      lights: json.lights }, stateUnchanged: true };
}

module.exports = async function exportGroup({ page, out, qa, vault, restart, group, record }) {
  assert.equal(group.id, "verwaltung-export");
  const dataFile = path.join(qa, "export-saved.json");
  const resultFile = path.join(out, restart ? "reopen-export.json" : "edit-export.json");
  const findings = new Map();
  const note = (id, observation, evidence, gap, state = "open") =>
    findings.set(id, { observation, evidence, gap, state });
  const finish = (summary) => {
    writeJson(resultFile, summary);
    for (const id of group.caseIds) {
      const item = findings.get(id);
      record.add(id, item?.state ?? "open", item?.observation ??
        `${restart ? "Frischstart" : "Bearbeitung"}: Dieser Export-Unterfall wurde im begrenzten Rasterlauf nicht gepaart.`,
      [resultFile, ...(item?.evidence ?? [])], item
        ? item.gap : group.originalGaps?.[id] ??
          "Originalwirkung und Hostbedienung noch nicht gemeinsam geprüft.");
    }
  };

  if (restart) {
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const disk = fs.readFileSync(path.join(vault, mapPath));
    assert.equal(sha256(disk), saved.diskSha256);
    await page.evaluate(async (file) => app.workspace.getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(file)), mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const reopened = await state(page);
    assert.equal(reopened.dirty, false);
    assert(same(reopened.document, saved.document));
    const exported = await capture(page, out, "fresh-png-64-grid", 64, true);
    const before = PNG.sync.read(fs.readFileSync(saved.gridFile));
    const rasterSame = pixelsChanged(before, exported.image) === 0;
    const uiPng = await exportFromMenu(page, out, "png", 256, true);
    const uiPngImage = PNG.sync.read(uiPng.bytes);
    assert.equal(uiPngImage.width, 2048);
    assert.equal(uiPngImage.height, 2048);
    assert.equal(uiPngImage.colorType, 6);
    assert.equal(uiPngImage.depth, 8);
    const cancelled = await cancelFromMenu(page, out);
    note("DD-043.01", "Frischstart: Editormenü öffnet erneut den Exportdialog mit vier Formaten.",
      [uiPng.file, resultFile], null, "pass");
    note("DD-043.02", "Frischstart: PNG-Export der 8×8-Karte bei 256 Pixel/Feld erzeugt ein 2048×2048-PNG.",
      [uiPng.file], "Die identische Original-Wand-/Portal-/Licht-Szene ist noch nicht als PNG verglichen.");
    note("DD-043.15", "Frischstart: Der Menüexport ergibt 2048×2048 Pixel bei 8×8 Feldern und 256 Pixel/Feld.",
      [uiPng.file, cancelled.screenshot], null, "pass");
    note("DD-043.23", `Frischstart: sichtbares Dialog-X schließt ohne Export-Blob; Kartenzustand unverändert=${cancelled.stateUnchanged}.`,
      [cancelled.screenshot], null, "pass");
    let vtt = null;
    if (process.env.DUNGEON_QA_EXPORT_VTT === "1") {
      await page.evaluate(async (file) => app.workspace.getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(file)), vttMapPath);
      await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
      vtt = await exportMeasuredVttShape(page, out, "fresh-vtt");
      note("DD-043.22", "Frischstart: VTT-JSON enthält gemessene Wandöffnung, Portal und Licht; eingebettetes 2048×2048-PNG.",
        [vtt.file, vtt.embedded],
        "Bildwirkung und übrige Wand-/Türvarianten sind noch nicht gleichwertig verglichen.");
    }
    finish({ phase: "reopen", rasterSame, pngSha256: exported.sha256,
      uiPng: uiPng.filename, cancelled, documentStable: true,
      diskSha256: saved.diskSha256, vtt });
    return;
  }

  await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
    .create("ExportGroupQA", 8, 8));
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  await page.locator(".dn-group-rail").getByRole("button", { name: "Bauwerk", exact: true }).click();
  await page.locator(".dn-tool-rail").getByRole("button", { name: "Rechteck", exact: true }).click();
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const bounds = renderer.canvas.getBoundingClientRect();
    return { x: bounds.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: bounds.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const a = await screen({ x: 1, y: 1 }), b = await screen({ x: 6, y: 6 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.document().entities.some((entity) => entity.kind === "building"));
  const grid = await capture(page, out, "png-64-grid", 64, true);
  const noGrid = await capture(page, out, "png-64-no-grid", 64, false);
  const high = await capture(page, out, "png-128-grid", 128, true);
  const nativePpi = await capture(page, out, "png-256-grid", 256, true);
  const gridPixels = pixelsChanged(grid.image, noGrid.image);
  assert(gridPixels > 0, "Raster an/aus muss sichtbare Bildpixel ändern");
  const uiPng = await exportFromMenu(page, out, "png", 256, true);
  assert.equal(uiPng.filename, "Karte.png");
  const uiImage = PNG.sync.read(uiPng.bytes);
  assert.equal(uiImage.colorType, 6);
  assert.equal(uiImage.depth, 8);
  const uiPixelsChanged = pixelsChanged(nativePpi.image, uiImage);
  assert.equal(uiPixelsChanged, 0, "Menüexport und direkte Kartenerfassung müssen gleich aussehen");
  const uiJpeg = await exportFromMenu(page, out, "jpeg", 64, false);
  assert.equal(uiJpeg.filename, "Karte.jpg");
  assert(uiJpeg.bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])));
  const uiWebp = await exportFromMenu(page, out, "webp", 64, false);
  assert.equal(uiWebp.filename, "Karte.webp");
  assert.equal(uiWebp.bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(uiWebp.bytes.toString("ascii", 8, 12), "WEBP");
  const cancelled = await cancelFromMenu(page, out);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.dirty);
  const saved = await state(page);
  const diskSha256 = sha256(fs.readFileSync(path.join(vault, mapPath)));
  writeJson(dataFile, { document: saved.document, diskSha256,
    gridFile: grid.file, gridSha256: grid.sha256 });
  let vtt = null;
  if (process.env.DUNGEON_QA_EXPORT_VTT === "1") {
  await page.evaluate(async () => {
    await app.plugins.getPlugin("dungeon-editor").create("ExportVttGroupQA", 8, 8);
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === "Dungeons/ExportVttGroupQA/Karte.dungeon").view.editor;
    const floorId = editor.renderer.floorId;
    const points = [{ x: 4, y: 5 }, { x: 2, y: 2 }, { x: 4, y: 1 },
      { x: 6, y: 2 }, { x: 6, y: 4 }];
    const lengths = points.map((point, index) => Math.hypot(
      points[(index + 1) % points.length].x - point.x,
      points[(index + 1) % points.length].y - point.y));
    const perimeter = lengths.reduce((sum, value) => sum + value, 0);
    const wall = { kind: "wall", id: "vtt-wall", floorId, points,
      closed: true, smooth: false, shadow: true, color: 0x726e65, width: 0.22 };
    const door = { kind: "door", id: "vtt-door", floorId,
      anchor: { boundaryId: wall.id, contour: 0,
        at: (lengths[0] + lengths[1] + lengths[2] + 1) / perimeter },
      width: 1, variant: "door", blocksLight: true,
      passage: { description: "", state: "closed", hidden: false } };
    const light = { kind: "light", id: "vtt-light", floorId,
      x: 4, y: 2.84375, radius: 5, intensity: 1,
      color: 0xeccd8b, shadows: true };
    editor.session.execute({ label: "VTT Originalgeometrie", entities: [wall, door, light]
      .map((entity) => ({ id: entity.id, before: null, after: entity })) });
  });
  await page.getByRole("button", { name: "Speichern", exact: true }).last().click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")
    .find((leaf) => leaf.view.file?.path === "Dungeons/ExportVttGroupQA/Karte.dungeon")
    .view.editor.session.dirty);
  vtt = await exportMeasuredVttShape(page, out, "native-shape-vtt");
  note("DD-043.22", "Kandidat schreibt VTT-JSON 0.3 mit derselben Wandöffnung, Portalform und Lichtwerten wie die Originalprobe; eingebettetes 2048×2048-PNG.",
    [vtt.file, vtt.embedded],
    "Bildwirkung und übrige Wand-/Türvarianten sind noch nicht gleichwertig verglichen.");
  }
  note("DD-043.03", `Bildraster an/aus änderte ${gridPixels} Pixel; Dokument, History und Kamera blieben unverändert.`,
    [grid.file, noGrid.file],
    "Original-Rasterwirkung und UI-Vorgaben im selben Exportfall sind noch nicht gepaart.");
  note("DD-043.14", `64 und 128 Pixel/Feld lieferten ${grid.width}×${grid.height} und ${high.width}×${high.height} PNG.`,
    [grid.file, high.file],
    "Original-PPI-Grenzen und Pixelwirkung im gleichen Fall sind noch nicht gepaart.");
  note("DD-043.01", "Editormenü öffnet den Exportdialog mit PNG, JPEG, WEBP und Universal VTT.",
    [uiPng.file, resultFile], null, "pass");
  note("DD-043.02", "Menüexport erzeugt für 8×8 Felder bei 256 Pixel/Feld ein dekodierbares 2048×2048-PNG.",
    [uiPng.file], "Die identische Original-Wand-/Portal-/Licht-Szene ist noch nicht als PNG verglichen.");
  note("DD-043.15", "8×8 Felder und 256 Pixel/Feld ergeben 2048×2048 Ausgabepixel.",
    [nativePpi.file, uiPng.file, cancelled.screenshot], null, "pass");
  note("DD-043.19", "Menüexport übergab PNG, JPEG und WEBP als Dateien an den Downloadlink; ein System-Dateidialog ist hier nicht belegt.",
    [uiPng.file, uiJpeg.file, uiWebp.file],
    "Dateiablage im produktiven Vault-Host und frisches Öffnen der Exportdatei fehlen.");
  note("DD-043.20", "JPEG-Menüexport lieferte JFIF/JPEG-Signatur und Dateiendung .jpg.",
    [uiJpeg.file], group.originalGaps?.["DD-043.20"]);
  note("DD-043.21", "WEBP-Menüexport lieferte RIFF/WEBP-Signatur und Dateiendung .webp.",
    [uiWebp.file], group.originalGaps?.["DD-043.21"]);
  note("DD-043.23", `Sichtbares Dialog-X schließt ohne Export-Blob; Kartenzustand unverändert=${cancelled.stateUnchanged}.`,
    [cancelled.screenshot], null, "pass");
  finish({ phase: "edit", gridPixels, grid: { width: grid.width, height: grid.height,
    sha256: grid.sha256 }, noGrid: { sha256: noGrid.sha256 },
  high: { width: high.width, height: high.height, sha256: high.sha256 },
  nativePpi: { width: nativePpi.width, height: nativePpi.height,
    sha256: nativePpi.sha256 },
  uiPngPixelsChanged: uiPixelsChanged,
  uiFormats: [uiPng.filename, uiJpeg.filename, uiWebp.filename],
  cancelled,
  documentStable: true, diskSha256, vtt });
};
