// DD-021 group scenario. The common runner owns the isolated Obsidian host and
// the graphics slot; this file only specifies the path-library workflow.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../fixtures/material-pfad.json"), "utf8"));
const savedFile = "material-pfad-saved.json";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const paths = (state) => state?.document.entities.filter((entity) => entity.kind === "path") ?? [];
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const fileSha256 = (file) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha256");
  fs.createReadStream(file).on("data", (chunk) => hash.update(chunk))
    .on("error", reject).on("end", () => resolve(hash.digest("hex")));
});

async function choosePath(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  const active = await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor?.tool === "path");
  if (active) return;
  await page.locator(".dn-group-rail").getByRole("button", { name: "Gelände", exact: true }).click();
  await page.locator(".dn-tool-rail").getByRole("button", { name: "Pfade", exact: true }).click();
}

async function screenPoint(page, point) {
  return page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const at = { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
    if (at.x < box.x || at.y < box.y || at.x >= box.right || at.y >= box.bottom)
      throw new Error(`Pfadpunkt außerhalb des Canvas: ${point.x},${point.y}`);
    return at;
  }, point);
}

async function waitTexture(page, entityIds, assetId) {
  await page.waitForFunction(({ entityIds, assetId }) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor?.renderer;
    const texture = renderer?.textures.entries.get(assetId + "\0image")?.texture;
    if (!texture) return false;
    return entityIds.every((id) => {
      const visual = renderer.visuals.get(id);
      return visual?.assets?.includes(assetId + "\0image") &&
        visual.pathMesh?.texture === texture && visual.pathGeometry?.indices.length >= 6;
    });
  }, { entityIds, assetId }, { timeout: 30000 });
}

module.exports = async function materialPath({ page, out, qa, vault, restart, group, record }) {
  if (process.env.DUNGEON_QA_ONLY_DD02120 === "1")
    return require("./material-pfad-undo.cjs")({ page, out, qa, vault,
      restart, group, record });
  assert.equal(group.id, "material-pfad");
  assert.deepEqual(group.caseIds, Array.from({ length: 27 }, (_, index) =>
    `DD-021.${String(index + 1).padStart(2, "0")}`));
  const outcomes = new Map();
  const stepsFile = path.join(out, "material-pfad-steps.json");
  const savedPath = path.join(qa, savedFile);
  const steps = { phase: restart ? "reopen" : "edit", groupId: group.id,
    source: { path: fixture.pckPath, expectedSha256: fixture.pckSha256 },
    stages: [], error: null };
  const set = (id, state, observation, evidence = [], gap = null) => {
    if (!group.caseIds.includes(id) || outcomes.has(id))
      throw new Error(`Ungültiges oder doppeltes Material-Ergebnis ${id}`);
    outcomes.set(id, { state, observation, evidence, gap });
  };
  const snapshot = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) return null;
    return {
      document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize, tool: editor.tool,
      draft: editor.pathDraft?.points.map((point) => ({ ...point })) ?? null,
      previewInstructions: editor.renderer.preview.context.instructions.length,
      selected: editor.selected,
    };
  });
  const stage = async (name, screenshot = false) => {
    const value = await snapshot();
    const image = screenshot ? path.join(out, `${name}.png`) : null;
    if (image) await page.screenshot({ path: image });
    steps.stages.push({ name, value, image });
    return value;
  };
  const finish = () => {
    writeJson(stepsFile, steps);
    for (const id of group.caseIds) {
      const item = outcomes.get(id) ?? {
        state: "open", observation: null, evidence: [],
        gap: [group.originalGaps?.[id] && `Original: ${group.originalGaps[id]}`,
          steps.error
            ? `Host: Ablauf vor diesem Detailfall abgebrochen (${steps.error.split("\n", 1)[0]}).`
            : "Host: Dieser Detailfall wurde in der Pfad-Gruppensitzung nicht ausgeführt."].filter(Boolean).join(" "),
      };
      record.add(id, item.state, item.observation,
        [stepsFile, ...item.evidence], item.gap);
    }
  };

  try {
    assert.equal(fixture.originalVersion, "1.2.0.1");
    assert(fs.existsSync(fixture.pckPath), `Original-PCK fehlt: ${fixture.pckPath}`);
    steps.source.actualSha256 = await fileSha256(fixture.pckPath);
    assert.equal(steps.source.actualSha256, fixture.pckSha256,
      "Original-PCK hat nicht die protokollierte 1.2.0.1-Prüfsumme");
    writeJson(path.join(out, "material-pfad-source.json"), steps.source);

    if (restart) {
      const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
      assert.equal(saved.mapPath, fixture.mapPath);
      const diskSha256 = await fileSha256(path.join(vault, saved.mapPath));
      assert.equal(diskSha256, saved.diskSha256,
        "QA-Karte zwischen Edit und Frischstart verändert");
      await page.evaluate(async (mapPath) => {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!file) throw new Error(`Gespeicherte Pfadkarte fehlt: ${mapPath}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, saved.mapPath);
      await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
      await waitTexture(page, saved.entityIds, saved.assetId);
      await choosePath(page);
      const reopened = await stage("fresh-open", true);
      const persistence = !!reopened && !reopened.dirty &&
        same(reopened.document, saved.document) &&
        saved.entityIds.every((id, index) => paths(reopened).some((entity) =>
          entity.id === id && entity.material?.assetId === saved.assetId &&
          Math.abs(entity.width - fixture.sourcePixels[1] /
            fixture.nativePixelsPerField * (index + 1)) < 1e-8 &&
          entity.material?.tileSize === fixture.sourcePixels[0] /
            fixture.nativePixelsPerField * (index + 1)));
      steps.persistence = { documentAndIds: persistence, diskSha256 };
      const tiles = page.locator(".dn-path-library-tiles button");
      const nativeTile = page.locator(`.dn-path-library-tiles button[aria-label="${fixture.assetName}"]`);
      const libraryAvailable = await nativeTile.count() === 1 && await tiles.count() > 1;
      set("DD-021.15", libraryAvailable && persistence ? "open" : "fail",
        `Frischstart: native Kachel=${libraryAvailable}, zwei Pfade mit nativer ID und unverändertem Dokument=${persistence}.`,
        [path.join(out, "fresh-open.png"), savedPath],
        libraryAvailable && persistence
          ? "Original: Kachelwahl und Kartenwirkung auf gleicher Geometrie bleiben ungepaart."
          : null);
      set("DD-021.21", persistence ? "open" : "fail",
        `Frischstart: beide gespeicherten Pfade samt Assetreferenz sichtbar/geladen, Dokument unverändert=${persistence}.`,
        [path.join(out, "fresh-open.png"), savedPath],
        persistence ? "Original: Texturwirkung und Übergänge nach Neustart nicht auf gleicher Geometrie gepaart." : null);
      set("DD-021.06", persistence ? "open" : "fail",
        `Frischstart bewahrte Width 1=69/256 und Width 2=138/256 Feld samt proportionalem Materialmaß=${persistence}.`,
        [path.join(out, "fresh-open.png"), savedPath],
        persistence ? "Weitere Width-Werte und Texturen sind noch nicht gepaart." : null);
      const search = page.getByRole("searchbox", { name: "Pfadbibliothek durchsuchen" });
      await search.fill(fixture.assetName);
      await search.press("Enter");
      const searchedAgain = await tiles.count() === 1 &&
        await nativeTile.count() === 1;
      set("DD-021.22", searchedAgain ? "pass" : "fail",
        `Frischstart: Return-Suche nach ${fixture.assetName} zeigt genau die native Kachel=${searchedAgain}.`,
        [path.join(out, "fresh-open.png")],
        group.originalGaps?.["DD-021.22"] ?? null);
      for (const id of ["DD-021.20", "DD-021.26"])
        set(id, "not_applicable",
          "Undo beziehungsweise Redo wurde in der Bearbeitungsphase gemessen; der frische Prozess prüft die gespeicherte Pfadwirkung unter DD-021.21.",
          [savedPath]);
      finish();
      return;
    }

    await page.evaluate(async (sourcePath) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(sourcePath),
    fixture.pckPath);
    await page.evaluate(async ({ name, size }) =>
      app.plugins.getPlugin("dungeon-editor").create(name, size[0], size[1],
        { assetPacks: [], builtInAssets: true }),
    { name: fixture.mapName, size: fixture.mapSize });
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    await choosePath(page);
    await page.getByRole("button", { name: "Snap", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Snap", exact: true })
      .getAttribute("aria-pressed"), "false");
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
      renderer.fit();
      renderer.zoom(40 / renderer.camera.scale);
      renderer.canvas.focus();
    });
    const before = await stage("library-before", true);
    assert.deepEqual(before.document.settings.assetPacks, [], "QA-Karte hat Zusatzpakete");
    assert.equal(before.document.settings.builtInAssets, true);
    const assets = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").listAssets([], true));
    const asset = assets.find((item) => item.kind === "path" &&
      item.name === fixture.assetName && item.packId === fixture.assetPackId &&
      item.files?.image === fixture.assetSourcePath);
    const tiles = page.locator(".dn-path-library-tiles button");
    const nativeTile = page.locator(`.dn-path-library-tiles button[aria-label="${fixture.assetName}"]`);
    const initialTiles = await tiles.count();
    if (!asset || await nativeTile.count() !== 1 || initialTiles < 2) {
      set("DD-021.15", "fail",
        `Ohne Zusatzpaket: Providerasset=${!!asset}, Battlements-Kachel=${await nativeTile.count()}, sichtbare Kacheln=${initialTiles}.`,
        [path.join(out, "library-before.png")]);
      throw new Error("Eingebaute Pfadbibliothek fehlt oder ist nicht angebunden");
    }
    assert.deepEqual(asset.pathTexturePixels,
      { width: fixture.sourcePixels[0], height: fixture.sourcePixels[1] });
    const preview = nativeTile.locator("img");
    await preview.evaluate((image) => image.decode());
    assert(await preview.evaluate((image) => image.naturalWidth > 0),
      "Battlements-Vorschau konnte nicht geladen werden");

    const search = page.getByRole("searchbox", { name: "Pfadbibliothek durchsuchen" });
    await search.fill(fixture.assetName);
    await search.press("Enter");
    const searched = await stage("battlements-search", true);
    const searchPass = await tiles.count() === 1 && await nativeTile.count() === 1 &&
      await search.inputValue() === fixture.assetName;
    set("DD-021.22", searchPass ? "pass" : "fail",
      `Return-Suche nach ${fixture.assetName}: genau eine native Kachel=${searchPass}; weitere Suchbegriffe/Pakete nicht geprüft.`,
      [path.join(out, "battlements-search.png")],
      group.originalGaps?.["DD-021.22"] ?? null);
    if (!searchPass) throw new Error("Battlements-Return-Suche wich ab");
    await nativeTile.click();
    const selectedId = await page.getByRole("combobox", { name: "Paketmaterial" }).inputValue();
    assert.equal(selectedId, asset.id);
    await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
    const cleared = await stage("clear-search", true);
    const clearPass = await tiles.count() === initialTiles &&
      await search.inputValue() === fixture.assetName &&
      await nativeTile.getAttribute("aria-pressed") === "true";
    set("DD-021.24", clearPass ? "open" : "fail",
      `Clear Search: Kacheln=${await tiles.count()}/${initialTiles}, Text erhalten und Wahl erhalten=${clearPass}.`,
      [path.join(out, "clear-search.png")],
      clearPass ? group.originalGaps?.["DD-021.24"] ??
        "Original: Auswahlzustand nach Clear Search noch nicht gepaart." : null);
    if (!clearPass) throw new Error("Clear Search beschädigte Kachelwahl oder Text");

    const draw = async (points, label, widthFactor) => {
      await choosePath(page);
      for (let index = 0; index < points.length; index++) {
        const at = await screenPoint(page, points[index]);
        if (index === points.length - 1) {
          await page.mouse.move(at.x, at.y);
          await stage(`${label}-preview`, true);
        }
        await page.mouse.click(at.x, at.y);
      }
      await page.keyboard.press("Enter");
      await page.waitForFunction((count) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.document().entities.filter((entity) => entity.kind === "path").length === count,
      label === "horizontal" ? 1 : 2, { timeout: 12000 });
      const after = await stage(`${label}-placed`, true);
      const placed = paths(after).at(-1);
      assert.equal(placed?.material?.assetId, asset.id);
      assert.equal(placed?.material?.assetPart, "image");
      assert(Math.abs(placed.width - fixture.sourcePixels[1] /
        fixture.nativePixelsPerField * widthFactor) < 1e-8,
      `Battlements Width=${widthFactor} entspricht nativer Bildhöhe × Faktor in 256-Pixel-Feldern`);
      assert.equal(placed.material.tileSize,
        fixture.sourcePixels[0] / fixture.nativePixelsPerField * widthFactor);
      assert(placed.points.length === points.length &&
        placed.points.every((point, index) =>
          Math.abs(point.x - points[index].x) < 1e-6 &&
          Math.abs(point.y - points[index].y) < 1e-6),
      "Der Hostpfad muss die Originalpunkte ohne Snap-Verformung speichern");
      await waitTexture(page, [placed.id], asset.id);
      return { after, placed };
    };
    const horizontal = await draw(fixture.horizontal, "horizontal", 1);
    set("DD-021.15", "open",
      `Eingebaute Battlements-Kachel gewählt, horizontale Texturreferenz ${asset.id} platziert und decodiert.`,
      [path.join(out, "library-before.png"), path.join(out, "horizontal-placed.png")],
      group.originalGaps?.["DD-021.15"] ?? "Original: gleiche Kachelwahl und Kartenwirkung ungepaart.");
    set("DD-021.02", "open",
      `Nach zwei Klickpunkten commitet schon das erste Enter im Host; in einem Originalzug blieb der Pfad nach dem ersten Enter Vorschau und wurde erst mit dem zweiten Enter erstellt. Ein anderer Originalzug brauchte einen Doppelklick.`,
      [path.join(out, "horizontal-preview.png"), path.join(out, "horizontal-placed.png")],
      "Original: Die unterschiedlichen Enter-Reaktionen sind nicht erklärt; die Abschlussregel kann noch nicht verbindlich verglichen werden.");

    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    const undone = await stage("horizontal-undo", true);
    const undoPass = paths(undone).length === 0;
    set("DD-021.20", undoPass ? "pass" : "fail",
      `Ein Undo entfernte den fertig gezeichneten Battlements-Pfad=${undoPass}.`,
      [path.join(out, "horizontal-undo.png")],
      group.originalGaps?.["DD-021.20"] ?? null);
    if (!undoPass) throw new Error("Pfad-Undo fehlgeschlagen");
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    const redone = await stage("horizontal-redo", true);
    const redoPass = paths(redone).length === 1 &&
      paths(redone)[0].id === horizontal.placed.id &&
      paths(redone)[0].material?.assetId === asset.id;
    set("DD-021.26", redoPass ? "pass" : "fail",
      `Ein Redo stellte dieselbe Pfad-ID und Battlements-Referenz wieder her=${redoPass}.`,
      [path.join(out, "horizontal-redo.png")],
      group.originalGaps?.["DD-021.26"] ?? null);
    if (!redoPass) throw new Error("Pfad-Redo fehlgeschlagen");

    const widthInput = page.getByRole("spinbutton", { name: "Pfadbreite (Originalfaktor)" });
    await widthInput.fill("2");
    await widthInput.press("Tab");
    assert.equal(await widthInput.inputValue(), "2");
    const bent = await draw(fixture.bent, "bent", 2);
    assert.equal(bent.placed.points.length, 3,
      "Geknickter QA-Pfad hat keine drei gespeicherten Punkte");
    set("DD-021.06", "open",
      `Battlements Width 1=69/256 Feld und Width 2=138/256 Feld; die Texturlänge skaliert von 4 auf 8 Felder.`,
      [path.join(out, "horizontal-placed.png"), path.join(out, "bent-placed.png")],
      "Zwischenwerte, Reglergrenzen und andere Texturhöhen sind noch nicht gepaart.");
    steps.bent = { points: bent.placed.points,
      nativeWidth: 138, nativePixelsPerField: 256,
      originalCommit: "Doppelklick auf den Endpunkt; die genaue Enter-Regel blieb uneindeutig." };
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.dirty, null, { timeout: 12000 });
    const saved = await stage("saved", true);
    const disk = path.join(vault, fixture.mapPath);
    const diskSha256 = await fileSha256(disk);
    writeJson(savedPath, { mapPath: fixture.mapPath, assetId: asset.id,
      entityIds: paths(saved).map((entity) => entity.id),
      document: saved.document, diskSha256 });
    set("DD-021.21", "open",
      `Zwei Texturpfade gespeichert; Dokument- und Dateiprüfsumme für Frischstart gesichert (${diskSha256}).`,
      [path.join(out, "saved.png"), savedPath],
      "Host: Frischstart steht aus. Original: Bildwirkung bei gleicher Geometrie ungepaart.");
  } catch (error) {
    steps.error = String(error?.stack ?? error);
  }
  finish();
};
