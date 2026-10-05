// DD-001.04 only. The common group runner owns the isolated Obsidian process.
// Run the edit phase and then the same QA root with --restart; never use a user vault.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const stateName = "dd00104-first-save-state.json";
const hash = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const pluginRoot = process.env.DUNGEON_PLUGIN_ROOT ||
  path.resolve(__dirname, "../../..");
const buildHash = () => hash(path.join(pluginRoot, "main.js"));
const write = (file, data) => fs.writeFileSync(file,
  JSON.stringify(data, null, 2) + "\n");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForFile(file, timeoutMs = 12000) {
  const end = Date.now() + timeoutMs;
  while (!fs.existsSync(file)) {
    if (Date.now() >= end) throw new Error(`Erster Save erzeugte keine Karte: ${file}`);
    await pause(50);
  }
}

// A Pending ItemView may have a different view type from a saved FileView.
// Both must expose their visible DungeonEditor as view.editor for this QA adapter.
const editorState = (page) => page.evaluate(() => {
  const leaves = [];
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view?.editor?.session && leaf.view.editor.root?.isConnected)
      leaves.push(leaf);
  });
  const leaf = leaves.find((item) => item === app.workspace.activeLeaf) ??
    leaves.find((item) => item.view.editor.root.offsetParent !== null) ?? leaves[0];
  const editor = leaf?.view.editor;
  if (!editor) return null;
  const lights = editor.session.document().entities.filter((entity) =>
    entity.kind === "light");
  return {
    viewType: leaf.view.getViewType(),
    filePath: leaf.view.file?.path ?? null,
    sameSessionAsBeforeSave: window.__dd00104Session === editor.session,
    settings: editor.session.document().settings,
    lights,
    dirty: editor.session.dirty,
    canUndo: editor.session.canUndo,
    canRedo: editor.session.canRedo,
    historySize: editor.session.historySize,
  };
});

async function currentEditor(page) {
  const editor = page.locator(".dungeon-native-editor:visible").last();
  await editor.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  return editor;
}

async function placeLight(page, editor) {
  await editor.locator(".dn-group-rail")
    .getByRole("button", { name: "Beleuchtung", exact: true }).click();
  await editor.locator(".dn-tool-rail")
    .getByRole("button", { name: "Lichtquelle", exact: true }).click();
  const p = await page.evaluate(() => {
    const leaves = [];
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view?.editor?.session && leaf.view.editor.root?.isConnected)
        leaves.push(leaf);
    });
    const leaf = leaves.find((item) => item === app.workspace.activeLeaf) ??
      leaves.find((item) => item.view.editor.root.offsetParent !== null) ?? leaves[0];
    const renderer = leaf?.view.editor?.renderer;
    if (!renderer) throw new Error("Renderer der neuen Karte fehlt");
    const box = renderer.canvas.getBoundingClientRect();
    const x = box.x + renderer.camera.x + 4 * renderer.camera.scale;
    const y = box.y + renderer.camera.y + 4 * renderer.camera.scale;
    if (x <= box.left || x >= box.right || y <= box.top || y >= box.bottom)
      throw new Error(`Lichtpunkt außerhalb des Canvas: ${x}, ${y}`);
    return { x, y };
  });
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => {
    let count = 0;
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view?.editor?.root?.isConnected)
        count = leaf.view.editor.session.document().entities
          .filter((entity) => entity.kind === "light").length;
    });
    return count === 1;
  });
  return p;
}

async function openCreation(page) {
  await page.waitForFunction(() => !!app.commands.commands[
    "dungeon-editor:create-dungeon"]);
  assert.equal(await page.evaluate(() => app.commands.executeCommandById(
    "dungeon-editor:create-dungeon")), true);
  const modal = page.locator(".modal-container:visible").last();
  await modal.getByText("Dungeon anlegen", { exact: true }).waitFor();
  return modal;
}

async function openSavedMap(page, mapPath) {
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error(`Gespeicherte Karte fehlt: ${mapPath}`);
    await app.workspace.getLeaf(false).openFile(file);
  }, mapPath);
  await currentEditor(page);
  await page.waitForFunction((mapPath) => {
    let found = false;
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.file?.path === mapPath && leaf.view.editor?.session)
        found = true;
    });
    return found;
  }, mapPath);
}

module.exports = async function firstSave({ page, out, qa, vault, restart,
  group, record }) {
  assert.equal(group.id, "verwaltung-karte-datei");
  assert(group.caseIds.includes("DD-001.04"));
  const steps = { phase: restart ? "reopen" : "edit", stages: [], error: null };
  const stepsFile = path.join(out, "dd00104-first-save-steps.json");
  const stateFile = path.join(qa, stateName);
  const evidence = [stepsFile];
  const problems = [];
  let result;
  const stage = async (label, detail) => {
    const image = path.join(out, `dd00104-${label}.png`);
    await page.screenshot({ path: image });
    steps.stages.push({ label, detail, image });
    evidence.push(image);
  };
  const check = (condition, reason) => {
    if (!condition) problems.push(reason);
  };
  try {
    if (restart) {
      if (!fs.existsSync(stateFile))
        throw new Error("Erstsave-Editphase fehlt; kein Frischstartbeleg möglich");
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (!saved.reopenReady)
        throw new Error("Erstsave-Editphase hat keine gespeicherte Prüfkarte");
      check(saved.buildSha256 === buildHash(),
        "Plugin-Build unterscheidet sich zwischen Edit und Frischstart.");
      for (const reason of saved.problems ?? []) problems.push(`Editphase: ${reason}`);
      const disk = path.join(vault, saved.mapPath);
      check(fs.existsSync(disk), "Gespeicherte Kartendatei fehlt beim Frischstart.");
      if (fs.existsSync(disk))
        check(hash(disk) === saved.sha256,
          "Kartendatei änderte sich zwischen Edit und Frischstart.");
      await openSavedMap(page, saved.mapPath);
      const fresh = await editorState(page);
      await stage("fresh-open", { fresh, diskSha256: hash(disk) });
      check(fresh?.filePath === saved.mapPath,
        "Frisch geöffneter View zeigt nicht die gespeicherte Karte.");
      check(fresh?.settings.width === 8 && fresh?.settings.height === 8,
        "Frisch geöffnete Karte misst nicht 8×8 Felder.");
      check(fresh?.lights.length === 1 &&
        JSON.stringify(fresh.lights[0]) === JSON.stringify(saved.light),
      "Frisch geöffnete Karte enthält nicht exakt die zuvor gespeicherte Lichtquelle.");
      check(fresh?.dirty === false, "Frisch geöffnete Karte ist unerwartet ungespeichert.");
      result = problems.length ? {
        state: "deviation",
        observation: `Frischstart: ${JSON.stringify(fresh)}.`,
        gap: problems.join(" "),
      } : {
        state: "pass",
        observation: "New blieb bis Save ohne Kartendatei; Undo/Redo blieb über den ersten Save erhalten; die 8×8-Karte öffnet im frischen Prozess mit derselben Lichtquelle.",
        gap: null,
      };
    } else {
      const name = `DD00104FirstSaveQA${Date.now()}`;
      const mapPath = `Dungeons/${name}/Karte.dungeon`;
      const disk = path.join(vault, mapPath);
      fs.rmSync(stateFile, { force: true });
      assert(!fs.existsSync(disk), "QA-Zielkarte existiert bereits vor New");
      const modal = await openCreation(page);
      await modal.getByPlaceholder("Name des Dungeons").fill(name);
      await modal.locator(".setting-item input").nth(1).fill("8");
      await modal.locator(".setting-item input").nth(2).fill("8");
      await modal.getByRole("button", { name: "Anlegen", exact: true }).click();
      await modal.waitFor({ state: "detached", timeout: 30000 });
      let editor = await currentEditor(page);
      const created = await editorState(page);
      const absentAfterNew = !fs.existsSync(disk);
      check(absentAfterNew,
        "New erzeugte die .dungeon-Kartendatei bereits vor manuellem Save.");
      check(created?.viewType === "dungeon-native-pending" &&
        created?.filePath === null,
      "New öffnete keinen dateilosen Pending-View.");
      check(created?.settings.width === 8 && created?.settings.height === 8,
        "Neue Karte ist nicht als bearbeitbare 8×8-Karte geöffnet.");
      check(created?.lights.length === 0,
        "Neue leere Karte enthält bereits eine Lichtquelle.");
      check(created?.canUndo === false && created?.canRedo === false,
        "Undo/Redo ist unmittelbar nach New nicht im Ausgangszustand.");
      await stage("created-unsaved", { created, diskExists: !absentAfterNew });
      await page.evaluate(() => {
        const leaf = app.workspace.activeLeaf;
        if (!leaf?.view?.editor?.session)
          throw new Error("Aktiver Pending-View muss DungeonEditor als .editor halten");
        window.__dd00104Session = leaf.view.editor.session;
      });
      const click = await placeLight(page, editor);
      const placed = await editorState(page);
      const light = placed?.lights[0];
      check(placed?.lights.length === 1 && placed?.canUndo === true && !!light,
        "Lichtbearbeitung vor Save erzeugte keinen erreichbaren Undo-Schritt.");
      check(!fs.existsSync(disk), "Kartendatei entstand durch Zeichnung vor Save.");
      await stage("drawn-unsaved", { click, placed, diskExists: fs.existsSync(disk) });
      await editor.getByRole("button", { name: "Rückgängig", exact: true }).click();
      const undone = await editorState(page);
      check(undone?.lights.length === 0 && undone?.canRedo === true,
        "Undo vor Save entfernte die Lichtquelle nicht oder Redo ist nicht erreichbar.");
      check(!fs.existsSync(disk), "Kartendatei entstand durch Undo vor Save.");
      await stage("undo-before-save", { undone, diskExists: fs.existsSync(disk) });
      await editor.getByRole("button", { name: "Wiederholen", exact: true }).click();
      const redone = await editorState(page);
      check(redone?.lights.length === 1 &&
        JSON.stringify(redone.lights[0]) === JSON.stringify(light),
      "Redo vor Save stellte dieselbe Lichtquelle nicht wieder her.");
      check(!fs.existsSync(disk), "Kartendatei entstand durch Redo vor Save.");
      await stage("redo-before-save", { redone, diskExists: fs.existsSync(disk) });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await waitForFile(disk);
      await page.waitForFunction((mapPath) => {
        const saved = app.workspace.getLeavesOfType("dungeon-native-map")
          .some((leaf) => leaf.view.file?.path === mapPath &&
            leaf.view.editor?.session && !leaf.view.editor.session.dirty);
        const oldPending = app.workspace.getLeavesOfType("dungeon-native-pending")
          .some((leaf) => leaf.view.mapPath === mapPath);
        return saved && !oldPending;
      }, mapPath);
      editor = await currentEditor(page);
      const afterSave = await editorState(page);
      const savedBytes = fs.readFileSync(disk);
      const savedMap = JSON.parse(savedBytes);
      const savedHash = hash(disk);
      check(savedMap.settings?.width === 8 && savedMap.settings?.height === 8,
        "Erster Save schrieb keine 8×8-Karte.");
      check(savedMap.entities?.filter((entity) => entity.kind === "light")
        .some((entity) => entity.id === light?.id),
      "Erster Save schrieb die zuvor platzierte Lichtquelle nicht.");
      check(afterSave?.canUndo === true,
        "Erster Save kappte den vor Save entstandenen Undo-Schritt.");
      check(afterSave?.viewType === "dungeon-native-map" &&
        afterSave?.filePath === mapPath &&
        afterSave?.sameSessionAsBeforeSave === true,
      "Erster Save übergab die laufende Sitzung nicht an den Datei-View.");
      await stage("first-saved", { afterSave, savedHash,
        diskBytes: savedBytes.length });
      await editor.getByRole("button", { name: "Rückgängig", exact: true }).click();
      const undoAfterSave = await editorState(page);
      check(undoAfterSave?.lights.length === 0 && undoAfterSave?.canRedo === true,
        "Undo nach erstem Save erreicht die davor gezeichnete Lichtquelle nicht.");
      check(hash(disk) === savedHash,
        "Undo nach erstem Save änderte die gespeicherte Datei ohne Save.");
      await stage("undo-after-save", { undoAfterSave, diskSha256: hash(disk) });
      await editor.getByRole("button", { name: "Wiederholen", exact: true }).click();
      const redoAfterSave = await editorState(page);
      check(redoAfterSave?.lights.length === 1 &&
        JSON.stringify(redoAfterSave.lights[0]) === JSON.stringify(light),
      "Redo nach erstem Save stellte dieselbe Lichtquelle nicht wieder her.");
      check(hash(disk) === savedHash,
        "Redo nach erstem Save änderte die gespeicherte Datei ohne Save.");
      await stage("redo-after-save", { redoAfterSave, diskSha256: hash(disk) });
      write(stateFile, { mapPath, sha256: savedHash, buildSha256: buildHash(), light,
        reopenReady: true,
        problems });
      evidence.push(stateFile);
      result = problems.length ? {
        state: "deviation",
        observation: `New, Licht, History und Erstsave geprüft; gespeicherte Karte ${mapPath}, SHA-256 ${savedHash}.`,
        gap: problems.join(" "),
      } : {
        state: "open",
        observation: "Editphase: New zeigt 8×8 ohne Kartendatei; Licht mit Undo/Redo vor Save; erster Save erzeugt die Karte und erhält dieselbe History; Undo/Redo danach verändert die gespeicherte Datei nicht.",
        gap: "Frisches Öffnen im zweiten Obsidian-Prozess steht noch aus.",
      };
    }
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    result = {
      state: problems.length ? "deviation" : "open",
      observation: problems.length ?
        `Bereits belegte Hostabweichung; Prüffolge stoppte: ${String(error)}` :
        null,
      gap: [problems.join(" "), `Host-Prüffolge stoppte: ${String(error)}`]
        .filter(Boolean).join(" "),
    };
  } finally {
    write(stepsFile, steps);
    record.add("DD-001.04", result.state, result.observation,
      evidence, result.gap);
  }
};
