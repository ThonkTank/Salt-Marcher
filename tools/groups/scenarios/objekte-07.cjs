// DD-042 grouped prefab UI. The common runner owns the isolated Obsidian host.
// Importing this file starts no GUI.
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

async function makeDialog(page, out) {
  await page.getByRole("button", { name: "Vorlage erstellen", exact: true }).last().click();
  await page.waitForTimeout(200);
  if (out) {
    const state = await page.evaluate(() => ({
      modals: [...document.querySelectorAll(".modal-container")].map((el) => el.textContent),
      notices: [...document.querySelectorAll(".notice")].map((el) => el.textContent),
      selected: app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view.editor?.selected,
      selection: [...(app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view.editor?.selection ?? [])],
    }));
    write(path.join(out, "make-dialog-after-click.json"), state);
    await page.screenshot({ path: path.join(out, "make-dialog-after-click.png") });
  }
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
    temporarySet = `DD042 Empty ${suffix}`,
    statePath = path.join(qa, STATE),
    dataFile = path.join(vault, DATA),
    mapFile = path.join(vault, mapPath);
  await page.evaluate((mapName) =>
    app.plugins.getPlugin("dungeon-editor").create(mapName, 8, 8), mapName);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  await page.evaluate(async (mapPath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("DD-042.09 QA-Editor fehlt.");
    const floorId = editor.session.floors.keys().next().value;
    const light = { id: "dd04209-source-light", kind: "light", floorId,
      x: 4, y: 4, radius: 3, intensity: 1, color: 0xeccd8b, shadows: false };
    editor.session.execute({ label: "DD-042.09 QA-Licht",
      entities: [{ id: light.id, before: null, after: light }] });
    editor.renderer.fit();
    await app.plugins.getPlugin("dungeon-editor").savePrefab({
      id: "dd04212-control", set: "Allgemein", name: "Kontrolllicht",
      center: { x: 4, y: 4 }, entities: [light],
    });
  }, mapPath);
  await chooseSelection(page);
  await clickWorld(page, mapPath, 4, 4);
  await page.waitForFunction((mapPath) =>
    app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor
      ?.selected === "dd04209-source-light", mapPath);
  const beforeFirst = await snapshot(page, mapPath);
  assert(!beforeFirst.prefabs.some((prefab) => prefab.set === set));

  let modal = await makeDialog(page, out);
  const firstOpen = path.join(out, "prefab-create-open.png");
  await modal.screenshot({ path: firstOpen });
  record.add("DD-042.01", "open",
    "Ausgewähltes Licht öffnet den Dialog mit Sammlung, Name und Bestätigung.",
    [firstOpen], "Gemischte Objekt-Licht-Auswahl und Zuverlässigkeit der Dialogöffnung sind noch nicht gepaart.");
  await modal.getByRole("button", { name: "Sammlung hinzufügen", exact: true }).click();
  await modal.locator("input").fill(temporarySet);
  await modal.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  const temporarySelected = await modal.locator('select:not([aria-hidden="true"])').inputValue() === temporarySet;
  const emptyAdded = path.join(out, "empty-set-added.png");
  await modal.screenshot({ path: emptyAdded });
  await modal.getByRole("button", { name: "Leere Sammlung entfernen", exact: true }).click();
  const afterEmpty = await modal.locator('select:not([aria-hidden="true"])').evaluate((select, removed) => ({
    selected: select.value,
    removedPresent: [...select.options].some((option) => option.value === removed),
  }), temporarySet);
  const emptyRemoved = path.join(out, "empty-set-removed.png");
  await modal.screenshot({ path: emptyRemoved });
  record.add("DD-042.04", temporarySelected && !afterEmpty.removedPresent ? "open" : "deviation",
    `Leere temporäre Sammlung entfernt=${temporarySelected && !afterEmpty.removedPresent}; Rückwahl=${afterEmpty.selected}.`,
    [emptyAdded, emptyRemoved], temporarySelected && !afterEmpty.removedPresent ?
    "Dauerhaften Katalogzustand nach Minus und Frischstart noch prüfen." :
    "Temporäre Sammlung blieb nach Minus im Dialog.");
  await modal.getByRole("button", { name: "Sammlung hinzufügen", exact: true }).click();
  await modal.locator("input").fill(set);
  await modal.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  assert.equal(await modal.locator('select:not([aria-hidden="true"])').inputValue(), set);
  const setAdded = path.join(out, "named-set-added.png");
  await modal.screenshot({ path: setAdded });
  record.add("DD-042.03", "pass",
    "Plus öffnet den Sammlungsnamen; Hinzufügen wählt die neue Sammlung.",
    [emptyAdded, setAdded]);
  await modal.locator('select:not([aria-hidden="true"])').selectOption("Allgemein");
  const switchedDefault = await modal.locator('select:not([aria-hidden="true"])').inputValue();
  await modal.locator('select:not([aria-hidden="true"])').selectOption(set);
  const switchedBack = await modal.locator('select:not([aria-hidden="true"])').inputValue();
  const setSwitchWorks = switchedDefault === "Allgemein" && switchedBack === set;
  record.add("DD-042.02", setSwitchWorks ? "pass" : "deviation",
    `Sammlungswahl Allgemein → ${set} im Erstellen-Dialog: ${switchedDefault} → ${switchedBack}.`,
    [setAdded], setSwitchWorks ? null : "Set-Dropdown wechselte die gewählte Sammlung nicht.");
  await modal.locator("input").fill(name);
  const named = path.join(out, "first-prefab-dialog.png");
  await modal.screenshot({ path: named });
  record.add("DD-042.06", "pass", "Vorlagenname ist im ausgewählten Set eingetragen und Bestätigung aktiv.", [named]);
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
  const stored = path.join(out, "prefab-created.json");
  write(stored, { prefab: matches[0], source: first.document.entities.find((entity) =>
    entity.id === "dd04209-source-light"), prefabs: first.prefabs });
  record.add("DD-042.07", "open",
    "Bestätigung speichert genau eine benannte Lichtvorlage und bindet das Quelllicht daran.",
    [named, stored], "Gemischte Objekt-Licht-Vorlage und relative Lage im Host noch nicht gepaart.");
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
  const minusFilled = modal.getByRole("button", { name: "Leere Sammlung entfernen", exact: true });
  const filledDisabled = await minusFilled.isDisabled();
  const filledSetScreen = path.join(out, "filled-set-minus-disabled.png");
  await modal.screenshot({ path: filledSetScreen });
  record.add("DD-042.05", filledDisabled ? "pass" : "deviation",
    `Minus der befüllten Sammlung ist gesperrt=${filledDisabled}.`,
    [filledSetScreen], filledDisabled ? null : "Befüllte Sammlung lässt Minus zu.");
  await modal.locator("input").fill("Abgebrochene Vorlage");
  await page.keyboard.press("Escape");
  const afterCancel = await snapshot(page, mapPath);
  const cancelUnchanged = same(afterCancel.prefabs, beforeDuplicate.prefabs) &&
    same(afterCancel.document, beforeDuplicate.document) &&
    afterCancel.historySize === beforeDuplicate.historySize &&
    digest(dataFile) === dataSha && digest(mapFile) === mapSha;
  const cancelEvidence = path.join(out, "prefab-create-cancel.json");
  write(cancelEvidence, { cancelUnchanged, beforeDuplicate, afterCancel,
    dataSha, mapSha });
  record.add("DD-042.08", cancelUnchanged ? "open" : "deviation",
    `Dialogschließen per Escape erzeugt keine neue Vorlage und ändert weder Karte noch Verlauf=${cancelUnchanged}; Original-Cancel gesondert zu prüfen.`,
    [cancelEvidence], cancelUnchanged ?
    "Sichtbares X als Entsprechung des Original-Cancel noch im Host prüfen." :
    "Dialogabbruch veränderte Vorlage, Karte oder Verlauf.");

  modal = await makeDialog(page);
  await modal.locator('select:not([aria-hidden="true"])').selectOption(set);
  await modal.locator("input").fill(name);
  await modal.screenshot({ path: path.join(out, "duplicate-prefab-dialog.png") });
  const createButton = modal.getByRole("button", { name: "Erstellen", exact: true });
  const error = modal.getByRole("alert").filter({ hasText:
    "In dieser Sammlung gibt es bereits eine Vorlage mit diesem Namen." });
  await error.waitFor({ timeout: 5000 });
  const duplicateDisabled = await createButton.isDisabled();
  const duplicateDialogOpen = await modal.isVisible();
  const duplicateNotice = await page.locator(".notice").filter({ hasText:
    "In dieser Sammlung gibt es bereits eine Vorlage mit diesem Namen." }).count();
  await modal.locator("input").fill(`${name} korrigiert`);
  const correctionEnabled = await createButton.isEnabled();
  const correctionCleared = !(await error.isVisible());
  await modal.locator("input").fill(name);
  const duplicateDisabledAgain = await createButton.isDisabled();
  await modal.screenshot({ path: path.join(out, "duplicate-rejected-inline.png") });
  await page.keyboard.press("Escape");
  const dismissedWithoutSave = !(await modal.isVisible());
  await waitWrites(page);
  const afterDuplicate = await snapshot(page, mapPath);
  const dataUnchanged = digest(dataFile) === dataSha;
  const mapUnchanged = digest(mapFile) === mapSha;
  const catalogUnchanged = same(afterDuplicate.prefabs, beforeDuplicate.prefabs);
  const documentUnchanged = same(afterDuplicate.document, beforeDuplicate.document);
  const historyUnchanged = afterDuplicate.historySize === beforeDuplicate.historySize;
  const unchanged = duplicateDisabled && duplicateDialogOpen &&
    duplicateNotice === 0 && correctionEnabled && correctionCleared &&
    duplicateDisabledAgain && dismissedWithoutSave &&
    dataUnchanged && mapUnchanged && catalogUnchanged &&
    documentUnchanged && historyUnchanged && !afterDuplicate.dirty &&
    afterDuplicate.selected === "dd04209-source-light";
  const screen = path.join(out, "duplicate-rejected.png");
  await page.screenshot({ path: screen });
  const details = { mapPath, set, name, sourceId: "dd04209-source-light",
    prefab: matches[0], beforeFirst, beforeDuplicate, afterDuplicate,
    dataSha, mapSha, dataUnchanged, mapUnchanged, catalogUnchanged,
    documentUnchanged, historyUnchanged, duplicateDisabled,
    duplicateDialogOpen, duplicateNotice, correctionEnabled,
    correctionCleared, duplicateDisabledAgain, dismissedWithoutSave,
    unchanged };
  const steps = path.join(out, "dd04209-edit.json");
  write(steps, details);
  write(statePath, { mapPath, set, name, sourceId: details.sourceId,
    prefab: matches[0], dataSha, mapSha,
    document: beforeDuplicate.document });
  record.add(CASE, unchanged ? "pass" : "deviation",
    `Duplikat im Dialog gemeldet, Erstellen gesperrt, Name korrigierbar; Definition, data.json, Karte und History unverändert=${unchanged}.`,
    [steps, screen, path.join(out, "duplicate-rejected-inline.png")],
    unchanged ? null : "Dialogvalidierung oder Erhalt von Katalog, Datei, Karte und History wich ab.");

  await page.locator(".dn-group-rail").last()
    .getByRole("button", { name: "Objekte", exact: true }).click();
  await page.locator(".dn-tool-rail").last()
    .getByRole("button", { name: "Zeichenvorlagen", exact: true }).click();
  const choice = page.getByRole("combobox", { name: "Vorlage", exact: true });
  await choice.waitFor();
  const toolScreen = path.join(out, "prefab-tool.png");
  await page.screenshot({ path: toolScreen });
  const toolState = await page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view.editor;
    const select = document.querySelector('select[aria-label="Vorlage"]');
    return { tool: editor?.tool, options: select ? [...select.options].map((o) =>
      ({ value: o.value, text: o.textContent })) : [] };
  });
  const toolOpened = toolState.tool === "prefab" && toolState.options.length > 1;
  const setChoice = page.getByRole("combobox", { name: "Sammlung", exact: true });
  const setSelectorCount = await setChoice.count();
  const forgetExists = await page.getByRole("button", {
    name: "Vorlage vergessen", exact: true,
  }).count();
  const toolComplete = toolOpened && !!setSelectorCount && !!forgetExists;
  record.add("DD-042.11", toolComplete ? "pass" : "deviation",
    `Zeichenvorlagen-Werkzeug=${toolState.tool}, Einträge=${toolState.options.length}, Sammlungsauswahl=${setSelectorCount}, Vergessen=${forgetExists}.`,
    [toolScreen], toolComplete ? null : "Werkzeug, Setwahl, Liste oder Forget fehlt.");
  let setFilterWorks = false;
  if (setSelectorCount) {
    await setChoice.selectOption(set);
    const targetOptions = await choice.locator("option").evaluateAll((items) =>
      items.map((item) => item.value));
    await setChoice.selectOption("Allgemein");
    const controlOptions = await choice.locator("option").evaluateAll((items) =>
      items.map((item) => item.value));
    setFilterWorks = targetOptions.includes(matches[0].id) &&
      !targetOptions.includes("dd04212-control") &&
      controlOptions.includes("dd04212-control") &&
      !controlOptions.includes(matches[0].id);
    await setChoice.selectOption(set);
  }
  const setFilterScreen = path.join(out, "prefab-set-filter.png");
  await page.screenshot({ path: setFilterScreen });
  record.add("DD-042.12", setFilterWorks ? "pass" : "deviation",
    `Eigenständige Sammlungsauswahl=${setSelectorCount}; die Liste trennt Allgemein und ${set}=${setFilterWorks}.`,
    [toolScreen, setFilterScreen], setFilterWorks ? null :
    "Die native Setwahl mit auf die Sammlung beschränkter Vorlagenliste fehlt.");
  const visibleOptions = await choice.locator("option").evaluateAll((items) =>
    items.map((item) => ({ value: item.value, text: item.textContent })));
  const listed = visibleOptions.some((option) =>
    option.value === matches[0].id && option.text === `${set} / ${name}`);
  record.add("DD-042.13", listed ? "open" : "deviation",
    `Vorlage ${set} / ${name} im kombinierten Auswahlfeld sichtbar=${listed}.`,
    [toolScreen], listed ? "Reihenfolge mehrerer Vorlagen im Original und Host noch nicht gepaart." :
    "Gespeicherte Vorlage fehlt in der Werkzeugliste.");
  await choice.selectOption(matches[0].id);
  const forget = page.getByRole("button", { name: "Vorlage vergessen", exact: true });
  const selectedChoice = await choice.inputValue();
  const forgetEnabled = await forget.isEnabled();
  const chosenScreen = path.join(out, "prefab-selected.png");
  await page.screenshot({ path: chosenScreen });
  const chosen = selectedChoice === matches[0].id && forgetEnabled;
  record.add("DD-042.14", chosen ? "open" : "deviation",
    `Vorlage gewählt=${selectedChoice === matches[0].id}; Vergessen aktiv=${forgetEnabled}.`,
    [chosenScreen], chosen ? "Gewählte Vorschau und nächste Platzierung noch nicht geprüft." :
    "Vorlagenwahl oder darauf folgende Aktion nicht aktiv.");

  const beforeForget = await snapshot(page, mapPath);
  const beforeForgetSha = { data: digest(dataFile), map: digest(mapFile) };
  await forget.click();
  let warning = page.locator("dialog.dn-confirm-dialog");
  await warning.waitFor();
  const cancelScreen = path.join(out, "forget-warning-cancel.png");
  await warning.screenshot({ path: cancelScreen });
  await warning.getByRole("button", { name: "Abbrechen", exact: true }).click();
  const afterForgetCancel = await snapshot(page, mapPath);
  const cancelKept = same(beforeForget.prefabs, afterForgetCancel.prefabs) &&
    same(beforeForget.document, afterForgetCancel.document) &&
    beforeForget.historySize === afterForgetCancel.historySize &&
    digest(dataFile) === beforeForgetSha.data && digest(mapFile) === beforeForgetSha.map;
  const forgetCancelJson = path.join(out, "forget-cancel.json");
  write(forgetCancelJson, { beforeForget, afterForgetCancel, beforeForgetSha, cancelKept });
  record.add("DD-042.22", cancelKept ? "pass" : "deviation",
    `Warnung per Abbrechen geschlossen; Vorlage, Karte, Datei und History unverändert=${cancelKept}.`,
    [cancelScreen, forgetCancelJson], cancelKept ? null :
    "Abbrechen der Vergessen-Warnung änderte Daten.");

  await forget.click();
  warning = page.locator("dialog.dn-confirm-dialog");
  await warning.waitFor();
  const xScreen = path.join(out, "forget-warning-x.png");
  await warning.screenshot({ path: xScreen });
  await warning.getByRole("button", { name: "Schließen", exact: true }).click();
  const afterForgetX = await snapshot(page, mapPath);
  const xKept = same(beforeForget.prefabs, afterForgetX.prefabs) &&
    same(beforeForget.document, afterForgetX.document) &&
    beforeForget.historySize === afterForgetX.historySize &&
    digest(dataFile) === beforeForgetSha.data && digest(mapFile) === beforeForgetSha.map;
  const forgetXJson = path.join(out, "forget-x.json");
  write(forgetXJson, { beforeForget, afterForgetX, beforeForgetSha, xKept });
  record.add("DD-042.23", xKept ? "pass" : "deviation",
    `Warnung per X geschlossen; Vorlage, Karte, Datei und History unverändert=${xKept}.`,
    [xScreen, forgetXJson], xKept ? null :
    "Schließen per X änderte Vorlagen- oder Kartendaten.");
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
  record.add("DD-042.07", unchanged ? "open" : "deviation",
    `Benannte Vorlage und Quellkarte nach frischem Obsidian-Prozess unverändert=${unchanged}.`,
    [steps], unchanged ? "Gemischte Objekt-Licht-Vorlage im Host noch nicht gepaart." :
    "Vorlagendefinition oder Karte änderte sich beim Frischstart.");
  record.add(CASE, unchanged ? "pass" : "deviation",
    `Frischstart enthält genau eine gleichnamige Vorlage; gespeicherte Definition und Karte unverändert=${unchanged}.`,
    [steps], unchanged ? null : "Duplikat oder Änderung der Definition beim Frischstart.");
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
  await page.locator(".dn-group-rail").last()
    .getByRole("button", { name: "Objekte", exact: true }).click();
  await page.locator(".dn-tool-rail").last()
    .getByRole("button", { name: "Zeichenvorlagen", exact: true }).click();
  const choice = page.getByRole("combobox", { name: "Vorlage", exact: true });
  await choice.waitFor();
  const setChoice = page.getByRole("combobox", { name: "Sammlung", exact: true });
  const setSelectorCount = await setChoice.count();
  if (setSelectorCount) await setChoice.selectOption(saved.set);
  const screenshot = path.join(out, "prefab-reopened-tool.png");
  await page.screenshot({ path: screenshot });
  const options = await choice.locator("option").evaluateAll((items) =>
    items.map((item) => ({ value: item.value, text: item.textContent })));
  const listed = options.some((option) => option.value === saved.prefab.id &&
    option.text === `${saved.set} / ${saved.name}`);
  record.add("DD-042.11", listed && !!setSelectorCount ? "pass" : "deviation",
    `Vorlagen-Werkzeug nach Frischstart geöffnet; gespeicherte Vorlage vorhanden=${listed}; Sammlungsauswahl=${setSelectorCount}.`,
    [screenshot], listed && !!setSelectorCount ? null :
    "Gespeicherte Vorlage oder Sammlungsauswahl fehlt nach Frischstart.");
  const controlHidden = !options.some((option) => option.value === "dd04212-control");
  const setFilterWorks = !!setSelectorCount && listed && controlHidden;
  record.add("DD-042.12", setFilterWorks ? "pass" : "deviation",
    `Nach Frischstart Sammlung=${setSelectorCount ? await setChoice.inputValue() : "fehlt"}; Zielvorlage sichtbar=${listed}, andere Sammlung ausgeblendet=${controlHidden}.`,
    [screenshot], setFilterWorks ? null :
    "Native Setwahl mit gefilterter Liste fehlt weiterhin.");
  record.add("DD-042.13", listed ? "open" : "deviation",
    `Gespeicherte Vorlage in kombinierter Liste vorhanden=${listed}.`,
    [screenshot], listed ? "Reihenfolge mehrerer Vorlagen im Original und Host noch nicht gepaart." :
    "Gespeicherte Vorlage fehlt nach Frischstart in der Liste.");
  await choice.selectOption(saved.prefab.id);
  const selected = await choice.inputValue() === saved.prefab.id;
  const forgetEnabled = await page.getByRole("button", {
    name: "Vorlage vergessen", exact: true,
  }).isEnabled();
  record.add("DD-042.14", selected && forgetEnabled ? "open" : "deviation",
    `Vorlage nach Frischstart wählbar=${selected}, Vergessen aktiv=${forgetEnabled}.`,
    [screenshot], selected && forgetEnabled ?
    "Gewählte Vorschau und nächste Platzierung noch nicht geprüft." :
    "Vorlagenwahl oder Folgeaktion nach Frischstart nicht verfügbar.");
  for (const id of ["DD-042.01", "DD-042.02", "DD-042.03", "DD-042.04",
    "DD-042.05", "DD-042.06", "DD-042.08", "DD-042.22", "DD-042.23"])
    record.add(id, "not_applicable", "Nur im Editlauf als Dialogaktion geprüft; Frischstart prüft gespeicherte Definition und Werkzeugliste.");
}

module.exports = async function objekte07(context) {
  if (context.restart) await reopen(context);
  else await edit(context);
};
