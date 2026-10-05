// DD-021.02 only. The group runner owns the isolated Obsidian process.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../fixtures/material-pfad.json"), "utf8"));
const nativeImage = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/04-horizontal-preview.png";
const nativeSha256 = "6a716ec0600903a25eedca78012789f60220b23297ae9f843ebf7f9ca876710e";
const stateName = "dd02102-preview-state.json";
const sha256 = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const pluginRoot = process.env.DUNGEON_PLUGIN_ROOT ||
  path.resolve(__dirname, "../../..");
const buildHash = () => sha256(path.join(pluginRoot, "main.js"));
const write = (file, value) => fs.writeFileSync(file,
  JSON.stringify(value, null, 2) + "\n");

const activeState = (page) => page.evaluate(() => {
  const leaves = [];
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view?.editor?.session && leaf.view.editor.root?.isConnected)
      leaves.push(leaf);
  });
  const leaf = leaves.find((item) => item === app.workspace.activeLeaf) ??
    leaves.find((item) => item.view.editor.root.offsetParent !== null) ?? leaves[0];
  const editor = leaf?.view.editor;
  if (!editor) return null;
  const renderer = editor.renderer;
  const spec = renderer.previewPathSpec;
  const texture = spec && renderer.textures.entries.get(spec.reference)?.texture;
  return {
    viewType: leaf.view.getViewType(),
    filePath: leaf.view.file?.path ?? null,
    document: editor.session.document(),
    history: editor.session.historySize,
    dirty: editor.session.dirty,
    tool: editor.tool,
    draft: editor.pathDraft?.points.map((point) => ({ ...point })) ?? null,
    cameraScale: renderer.camera.scale,
    preview: {
      meshCount: renderer.previewTextureLayer.children.length,
      meshPresent: !!renderer.previewMesh,
      textureMatchesSelectedAsset: !!texture &&
        renderer.previewMesh?.texture === texture,
      triangleIndices: renderer.previewGeometry?.indices.length ?? 0,
      reference: spec?.reference ?? null,
      points: spec?.points.map((point) => ({ ...point })) ?? null,
      width: spec?.width ?? null,
      repeatLength: spec?.repeatLength ?? null,
      fallbackInstructions: renderer.preview.context.instructions.length,
    },
  };
});

async function visibleEditor(page) {
  const editor = page.locator(".dungeon-native-editor:visible").last();
  await editor.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  return editor;
}

async function atField(page, point) {
  return page.evaluate((point) => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    if (!editor?.renderer) throw new Error("Aktiver Kartenrenderer fehlt");
    const renderer = editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const at = {
      x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale,
    };
    if (at.x <= box.left || at.x >= box.right ||
      at.y <= box.top || at.y >= box.bottom)
      throw new Error(`Pfadpunkt außerhalb des Canvas: ${point.x},${point.y}`);
    return at;
  }, point);
}

async function previewHorizontal(page) {
  const first = await atField(page, fixture.horizontal[0]);
  const last = await atField(page, fixture.horizontal[1]);
  await page.mouse.click(first.x, first.y);
  await page.mouse.move(last.x, last.y);
  await page.waitForFunction(() => {
    const renderer = app.workspace.activeLeaf?.view?.editor?.renderer;
    return renderer?.previewTextureLayer.children.length === 1 &&
      !!renderer.previewMesh && !!renderer.previewPathSpec;
  }, null, { timeout: 30000 });
  return { first, last };
}

module.exports = async function dd02102Preview({ page, out, qa, vault,
  restart, group, record }) {
  assert.equal(group.id, "material-pfad");
  assert(group.caseIds.includes("DD-021.02"));
  const stateFile = path.join(qa, stateName);
  const stepsFile = path.join(out, "dd02102-preview-steps.json");
  const steps = { phase: restart ? "reopen" : "edit", stages: [], error: null,
    nativeImage, nativeSha256, buildSha256: buildHash() };
  const evidence = [stepsFile, nativeImage];
  const problems = [];
  let hostReachedPreview = false;
  const check = (condition, reason) => {
    if (!condition) problems.push(reason);
  };
  const stage = async (label, details, canvas = false) => {
    const image = path.join(out, `dd02102-${label}.png`);
    await page.screenshot({ path: image });
    evidence.push(image);
    let canvasImage = null;
    if (canvas) {
      canvasImage = path.join(out, `dd02102-${label}-canvas.png`);
      await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
        .last().screenshot({ path: canvasImage });
      evidence.push(canvasImage);
    }
    steps.stages.push({ label, details, image, canvasImage });
  };
  let outcome;
  try {
    assert.equal(sha256(nativeImage), nativeSha256,
      "Original-Vorschauaufnahme hat eine andere Prüfsumme");
    assert.equal(sha256(fixture.pckPath), fixture.pckSha256,
      "Original-PCK hat eine andere Prüfsumme");
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      hostReachedPreview = true;
      const disk = path.join(vault, saved.mapPath);
      check(saved.buildSha256 === buildHash(),
        "Edit und Frischstart verwenden verschiedene Plugin-Builds.");
      check(fs.existsSync(disk) && sha256(disk) === saved.mapSha256,
        "Gespeicherte QA-Karte änderte sich vor dem Frischstart.");
      await page.evaluate(async (mapPath) => {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!file) throw new Error(`QA-Karte fehlt: ${mapPath}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, saved.mapPath);
      await visibleEditor(page);
      const fresh = await activeState(page);
      await stage("fresh-open", fresh, true);
      check(fresh?.filePath === saved.mapPath && !fresh?.dirty,
        "Frischstart öffnete die gespeicherte Karte nicht sauber.");
      check(fresh?.document.entities.filter((entity) =>
        entity.kind === "path").length === 0,
      "Abgebrochene Vorschau hinterließ nach Frischstart Pfadgeometrie.");
      for (const reason of saved.problems ?? []) problems.push(`Edit: ${reason}`);
      outcome = {
        state: problems.length ? "fail" : "open",
        observation: "Battlements-Vorschau im Host als Texturmesh aufgenommen; Escape und Werkzeugwechsel hinterließen keine Pfad-Entity. Die nach Erstsave frisch geöffnete Karte enthält ebenfalls keinen Pfad.",
        gap: problems.length ? problems.join(" ") :
          "Visuelle Paarung mit der Originalaufnahme und direkte Original-Abbruchwirkung fehlen; die uneinheitliche Original-Enter-Regel bleibt offen.",
      };
    } else {
      fs.rmSync(stateFile, { force: true });
      await page.evaluate(async (sourcePath) =>
        app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(sourcePath),
      fixture.pckPath);
      await page.evaluate(async ({ name, size }) =>
        app.plugins.getPlugin("dungeon-editor").create(name, size[0], size[1],
          { assetPacks: [], builtInAssets: true }),
      { name: fixture.mapName, size: fixture.mapSize });
      let editor = await visibleEditor(page);
      const created = await activeState(page);
      check(created?.viewType === "dungeon-native-pending" &&
        created?.filePath === null,
      "Kartenstart öffnete keinen dateilosen Pending-View.");
      check(created?.document.settings.width === 12 &&
        created?.document.settings.height === 8,
      "Prüfkarte misst nicht 12×8 Felder.");
      check(created?.document.entities.filter((entity) =>
        entity.kind === "path").length === 0,
      "Prüfkarte enthält bereits Pfadgeometrie.");
      await stage("created", created);

      if (!(await editor.evaluate((element) =>
        element.classList.contains("dn-maximized")))) {
        await editor.getByRole("button", { name: "Maximieren", exact: true }).click();
        editor = await visibleEditor(page);
      }
      await editor.locator(".dn-group-rail")
        .getByRole("button", { name: "Gelände", exact: true }).click();
      await editor.locator(".dn-tool-rail")
        .getByRole("button", { name: "Pfade", exact: true }).click();
      const snap = editor.getByRole("button", { name: "Snap", exact: true });
      if (await snap.getAttribute("aria-pressed") === "true") await snap.click();
      check(await snap.getAttribute("aria-pressed") === "false",
        "Snap blieb für den fallgleichen Pfadzug eingeschaltet.");
      const tile = editor.locator(
        `.dn-path-library-tiles button[aria-label="${fixture.assetName}"]`);
      await tile.waitFor();
      await tile.locator("img").evaluate((image) => image.decode());
      await tile.click();
      const assetId = await editor.getByRole("combobox", {
        name: "Paketmaterial" }).inputValue();
      const asset = await page.evaluate(({ assetId }) =>
        app.plugins.getPlugin("dungeon-editor").listAssets([], true)
          .find((item) => item.id === assetId), { assetId });
      assert(asset && asset.name === fixture.assetName &&
        asset.packId === fixture.assetPackId &&
        asset.files?.image === fixture.assetSourcePath,
      "Gewählte Pfadkachel ist nicht das eingebaute Battlements-Material");
      await page.evaluate(() => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer;
        renderer.fit();
        renderer.zoom(64 / renderer.camera.scale);
        renderer.canvas.focus();
      });
      const before = await activeState(page);
      await stage("before-preview", { before, assetId });
      check(Math.abs(before?.cameraScale - 64) < 1e-6,
        "Hostvorschau steht nicht bei 64 Bildschirmpixeln pro Feld.");
      hostReachedPreview = true;
      const points = await previewHorizontal(page);
      const live = await activeState(page);
      await stage("horizontal-preview", { live, points, assetId }, true);
      check(live?.preview.meshCount === 1 &&
        live.preview.meshPresent &&
        live.preview.textureMatchesSelectedAsset &&
        live.preview.triangleIndices >= 6 &&
        live.preview.reference === assetId + "\0image",
      "Livevorschau enthält kein einzelnes Battlements-Texturmesh.");
      check(live?.preview.points?.length === 2 &&
        Math.abs(live.preview.points[0].x - fixture.horizontal[0].x) < 1e-6 &&
        Math.abs(live.preview.points[1].x - fixture.horizontal[1].x) < 1e-6,
      "Vorschaugeometrie entspricht nicht dem waagerechten Originalzug.");
      check(live?.document.entities.filter((entity) =>
        entity.kind === "path").length === 0 &&
        live.history === before.history && live.dirty === before.dirty,
      "Livevorschau änderte Karteninhalt, History oder Speicherstatus.");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => {
        const editor = app.workspace.activeLeaf?.view?.editor;
        return !!editor && !editor.pathDraft &&
          editor.renderer.previewTextureLayer.children.length === 0;
      });
      const cancelled = await activeState(page);
      await stage("escape-cancelled", cancelled, true);
      check(cancelled?.document.entities.filter((entity) =>
        entity.kind === "path").length === 0 &&
        cancelled.history === before.history &&
        cancelled.preview.meshCount === 0,
      "Escape ließ Pfadgeometrie, History oder Vorschau-Mesh zurück.");

      await previewHorizontal(page);
      await editor.locator(".dn-group-rail")
        .getByRole("button", { name: "Auswahl", exact: true }).click();
      await editor.locator(".dn-tool-rail")
        .getByRole("button", { name: "Auswahl", exact: true }).click();
      const switched = await activeState(page);
      await stage("tool-switch-cancelled", switched);
      check(switched?.preview.meshCount === 0 &&
        switched?.document.entities.filter((entity) =>
          entity.kind === "path").length === 0 &&
        switched?.history === before.history,
      "Werkzeugwechsel ließ Vorschau oder Pfadänderung zurück.");
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction((mapPath) =>
        app.workspace.getLeavesOfType("dungeon-native-map")
          .some((leaf) => leaf.view.file?.path === mapPath &&
            leaf.view.editor?.session && !leaf.view.editor.session.dirty) &&
        !app.workspace.getLeavesOfType("dungeon-native-pending")
          .some((leaf) => leaf.view.mapPath === mapPath),
      fixture.mapPath, { timeout: 30000 });
      const disk = path.join(vault, fixture.mapPath);
      const saved = JSON.parse(fs.readFileSync(disk, "utf8"));
      check(saved.entities.filter((entity) => entity.kind === "path").length === 0,
        "Erstsave speicherte trotz Abbruch eine Pfad-Entity.");
      const mapSha256 = sha256(disk);
      await stage("saved-without-path", { mapSha256,
        savedPathCount: saved.entities.filter((entity) => entity.kind === "path").length });
      write(stateFile, { mapPath: fixture.mapPath, mapSha256,
        buildSha256: buildHash(), problems });
      evidence.push(stateFile);
      outcome = {
        state: problems.length ? "fail" : "open",
        observation: "Battlements-Texturmesh während des waagerechten Punktzugs sichtbar; Escape und Werkzeugwechsel entfernten den Entwurf. Erstsave enthält keinen Pfad.",
        gap: problems.length ? problems.join(" ") :
          "Frischstart und visuelle Paarung mit der Originalaufnahme stehen noch aus; Original-Escape-Wirkung und Enter-Abschlussregel sind offen.",
      };
    }
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    outcome = { state: problems.length || hostReachedPreview ? "fail" : "open",
      observation: problems.length || hostReachedPreview
        ? `Hostfolge nach Beginn des Fallvergleichs gestoppt: ${String(error)}` : null,
      gap: [problems.join(" "), `Hostfolge gestoppt: ${String(error)}`]
        .filter(Boolean).join(" ") };
  } finally {
    write(stepsFile, steps);
    record.add("DD-021.02", outcome.state, outcome.observation,
      evidence, outcome.gap);
  }
};
