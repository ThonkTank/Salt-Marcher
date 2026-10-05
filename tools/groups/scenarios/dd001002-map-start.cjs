// DD-001/002 only. The common runner owns the isolated Obsidian process.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const stateName = "dd001002-map-start-state.json";
const sha256 = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const write = (file, value) => fs.writeFileSync(file,
  JSON.stringify(value, null, 2) + "\n");

async function openCreation(page) {
  await page.waitForFunction(() => !!app.commands.commands[
    "dungeon-editor:create-dungeon"]);
  assert.equal(await page.evaluate(() => app.commands.executeCommandById(
    "dungeon-editor:create-dungeon")), true);
  const modal = page.locator(".modal-container:visible").last();
  await modal.getByText("Dungeon anlegen", { exact: true }).waitFor();
  await modal.getByPlaceholder("Vorlagenname").waitFor();
  return modal;
}

async function dialogState(modal) {
  return {
    width: await modal.locator(".setting-item input").nth(1).inputValue(),
    height: await modal.locator(".setting-item input").nth(2).inputValue(),
    templates: await modal.getByRole("combobox").first()
      .locator("option").allTextContents(),
  };
}

async function setSize(modal, width, height) {
  await modal.locator(".setting-item input").nth(1).fill(String(width));
  await modal.locator(".setting-item input").nth(2).fill(String(height));
}

async function catalog(page) {
  return page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
    .sizePresets().map(({ name, width, height }) => ({ name, width, height })));
}

async function mapState(page, mapPath) {
  return page.evaluate((mapPath) => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === mapPath);
    const editor = leaf?.view.editor;
    if (!editor) return null;
    return { document: editor.session.document(), dirty: editor.session.dirty,
      historySize: editor.session.historySize };
  }, mapPath);
}

async function openMap(page, mapPath) {
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error(`Karte fehlt: ${mapPath}`);
    await app.workspace.getLeaf(false).openFile(file);
  }, mapPath);
  await page.waitForFunction((mapPath) => app.workspace
    .getLeavesOfType("dungeon-native-map")
    .some((leaf) => leaf.view.file?.path === mapPath && leaf.view.editor), mapPath);
}

module.exports = async function mapStart({ page, out, qa, vault, restart,
  group, record }) {
  assert.equal(group.id, "verwaltung-karte-datei");
  const ids = group.caseIds.filter((id) => /^DD-00[12]\./.test(id));
  assert.equal(ids.length, 15);
  const outcomes = new Map();
  const steps = { phase: restart ? "reopen" : "edit", stages: [], error: null };
  const stepsPath = path.join(out, "dd001002-steps.json");
  const savedPath = path.join(qa, stateName);
  const set = (id, state, observation, gap = null, evidence = []) => {
    assert(ids.includes(id) && !outcomes.has(id), `Ungültiger Fall ${id}`);
    outcomes.set(id, { state, observation, gap, evidence });
  };
  const stage = async (label, detail, screenshot = true) => {
    const image = screenshot ? path.join(out, `dd001002-${label}.png`) : null;
    if (image) await page.screenshot({ path: image });
    steps.stages.push({ label, detail, image });
    return image;
  };
  const result = () => {
    write(stepsPath, steps);
    for (const id of ids) {
      const item = outcomes.get(id) ?? {
        state: "open", observation: null,
        gap: [group.originalGaps?.[id] &&
            `Original: ${group.originalGaps[id]}`,
          steps.error && `Host: Lauf abgebrochen (${steps.error.split("\n", 1)[0]}).`,
          "Host: In dieser begrenzten Folge nicht fallgleich geprüft."].filter(Boolean).join(" "),
        evidence: [],
      };
      record.add(id, item.state, item.observation,
        [stepsPath, ...item.evidence], item.gap);
    }
  };

  try {
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
      const disk = path.join(vault, saved.mapPath);
      assert.equal(sha256(disk), saved.sha256,
        "Prüfkarte hat sich zwischen Edit und Frischstart verändert");
      await openMap(page, saved.mapPath);
      const map = await mapState(page, saved.mapPath);
      const presets = await catalog(page);
      const freshImage = await stage("fresh-open", { map, presets });
      assert.deepEqual(map?.document, saved.document);
      assert.equal(map?.dirty, false);
      assert(presets.some((item) => item.name === saved.presetName &&
        item.width === 8 && item.height === 8));
      set("DD-001.03", "pass",
        "8 Felder Höhe bleiben nach Speichern und frischem Prozess erhalten.",
        null, [savedPath, freshImage]);
      for (const id of ["DD-002.02", "DD-002.03", "DD-002.04"])
        set(id, "open",
          "Host: Name und Maße der 8×8-Vorlage sind nach frischem Prozess erhalten.",
          "Original: Vorlagenpersistenz beim regulären Nutzerprofil nicht direkt bestätigt; der isolierte Profilversuch verlor sie.",
          [savedPath, freshImage]);

      const modal = await openCreation(page);
      const selector = modal.getByRole("combobox").first();
      await selector.selectOption(saved.presetName);
      const selected = await dialogState(modal);
      const selectedImage = await stage("preset-selected", selected);
      set("DD-002.01", "open",
        `Host: benannte Vorlage setzt Maße auf ${selected.width}×${selected.height}.`,
        "Original: erneute Auswahl im nativen Dropdown war in der isolierten Sitzung nicht zuverlässig bedienbar.",
        [selectedImage]);
      await setSize(modal, 12, 8);
      const beforeDelete = await dialogState(modal);
      const beforeCatalog = await catalog(page);
      assert(beforeCatalog.some((item) => item.name === saved.presetName));
      await modal.getByLabel("Gewählte Vorlage löschen").click();
      await page.waitForFunction((name) => !app.plugins
        .getPlugin("dungeon-editor").sizePresets()
        .some((item) => item.name === name), saved.presetName);
      await modal.getByRole("combobox").first()
        .locator("option", { hasText: saved.presetName })
        .waitFor({ state: "detached" });
      const afterDelete = await dialogState(modal);
      const deletedImage = await stage("preset-deleted", {
        beforeDelete, afterDelete, beforeCatalog,
        afterCatalog: await catalog(page),
      });
      const sameDimensions = afterDelete.width === beforeDelete.width &&
        afterDelete.height === beforeDelete.height;
      set("DD-002.09", sameDimensions ? "pass" : "deviation",
        `Vorlage entfernt; angezeigte Maße ${beforeDelete.width}×${beforeDelete.height} → ${afterDelete.width}×${afterDelete.height}.`,
        sameDimensions ? null :
          "Original: nach − blieben im direkten Fall die angezeigten Maße 12×8; Host setzt den Dialog neu auf.",
        [deletedImage]);
      return;
    }

    const name = `DD001002QA${Date.now()}`;
    const presetName = `DD002QA${Date.now()}`;
    const mapPath = `Dungeons/${name}/Karte.dungeon`;
    let modal = await openCreation(page);
    const initial = await dialogState(modal);
    const initialImage = await stage("new-open", initial);
    const defaultDimensions = initial.width === "35" && initial.height === "20";
    set("DD-001.01", defaultDimensions ? "open" : "deviation",
      `New öffnet den Hostdialog mit ${initial.width}×${initial.height}; Original startet ohne Vorlage mit 35×20.`,
      defaultDimensions ? "Host: vollständige Vorlagen- und Startoptionswirkung noch nicht fallgleich geprüft."
        : "Der direkt belegte Original-Startwert 35×20 fehlt.",
      [initialImage]);
    await modal.getByPlaceholder("Name des Dungeons").fill(`${name}Cancel`);
    await setSize(modal, 12, 8);
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "detached" });
    const noCanceledFile = !fs.existsSync(path.join(vault,
      `Dungeons/${name}Cancel/Karte.dungeon`));
    modal = await openCreation(page);
    const afterCancel = await dialogState(modal);
    const canceledImage = await stage("cancel", { noCanceledFile,
      afterCancel });
    const returnedToDefault = afterCancel.width === initial.width &&
      afterCancel.height === initial.height;
    set("DD-001.05", noCanceledFile && returnedToDefault ? "pass" : "deviation",
      `Dialogabbruch mit Escape hinterlässt keine Karte=${noCanceledFile}; erneutes New zeigt die Ausgangsmaße=${returnedToDefault}.`,
      noCanceledFile && returnedToDefault ? null :
        "Host erzeugte trotz Abbruch eine Karte oder übernahm unbestätigte Maße.",
      [canceledImage]);

    await modal.getByPlaceholder("Name des Dungeons").fill(`${name}Zero`);
    await setSize(modal, 0, 20);
    await modal.getByRole("button", { name: "Anlegen", exact: true }).click();
    await page.waitForFunction((mapPath) => {
      const button = [...document.querySelectorAll(".modal-container button")]
        .find((item) => item.textContent?.trim() === "Anlegen");
      return !!app.vault.getAbstractFileByPath(mapPath) || button?.disabled === false;
    }, `Dungeons/${name}Zero/Karte.dungeon`);
    const zeroPath = path.join(vault, `Dungeons/${name}Zero/Karte.dungeon`);
    const zeroCreated = fs.existsSync(zeroPath);
    const zeroImage = await stage("zero-width", { zeroCreated });
    set("DD-001.02", zeroCreated ? "open" : "deviation",
      `Breite 0/ Höhe 20: Hostdatei angelegt=${zeroCreated}.`,
      zeroCreated
        ? "Host: Dateimaße noch nicht gegen Original 8×20 geprüft."
        : "Original: Eingabe 0 ergab eine 8×20-Karte; Host verwirft sie.",
      [zeroImage]);
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "detached" });

    modal = await openCreation(page);
    await setSize(modal, 8, 8);
    await modal.getByPlaceholder("Vorlagenname").fill(presetName);
    await modal.getByRole("button", { name: "Merken", exact: true }).click();
    await page.waitForFunction((name) => app.plugins.getPlugin("dungeon-editor")
      .sizePresets().some((item) => item.name === name), presetName);
    await modal.getByRole("combobox").first()
      .locator("option", { hasText: presetName }).waitFor();
    const afterAccept = await dialogState(modal);
    const preset = (await catalog(page)).find((item) => item.name === presetName);
    const presetImage = await stage("preset-accepted", { preset, afterAccept });
    const dimensionsRight = preset?.width === 8 && preset?.height === 8;
    set("DD-002.02", preset?.name === presetName ? "pass" : "deviation",
      `Vorlagenname nach Merken=${preset?.name ?? "fehlt"}.`,
      preset?.name === presetName ? null : "Host übernahm den Namen nicht.",
      [presetImage]);
    set("DD-002.03", dimensionsRight ? "pass" : "deviation",
      `Benannte Vorlagenbreite nach Merken=${preset?.width}.`,
      dimensionsRight ? null : "Host übernahm die Breite 8 nicht.", [presetImage]);
    set("DD-002.04", dimensionsRight ? "pass" : "deviation",
      `Benannte Vorlagenhöhe nach Merken=${preset?.height}.`,
      dimensionsRight ? null : "Host übernahm die Höhe 8 nicht.", [presetImage]);
    const keepsDimensions = afterAccept.width === "8" &&
      afterAccept.height === "8";
    set("DD-002.05", keepsDimensions && dimensionsRight ? "pass" : "deviation",
      `Nach Vorlagenübernahme zeigt New Map ${afterAccept.width}×${afterAccept.height}.`,
      keepsDimensions && dimensionsRight ? null :
        "Original: Accept ließ die aktuelle Kartenmaßanzeige auf 8×8; Host rendert den Dialog neu.",
      [presetImage]);
    const selector = modal.getByRole("combobox").first();
    await selector.selectOption(presetName);
    const selected = await dialogState(modal);
    const selectable = selected.width === "8" && selected.height === "8";
    const selectedImage = await stage("preset-selected", selected);
    set("DD-002.07", selectable && dimensionsRight ? "open" : "deviation",
      `Benannte 8×8-Vorlage angelegt und erneut gewählt=${selectable && dimensionsRight}.`,
      selectable && dimensionsRight
        ? "Original: Anlegen ist belegt, die erneute Wahl im nativen Dropdown wurde im isolierten Lauf nicht zuverlässig bestätigt."
        : "Host: Plus-äquivalente Anlage oder erneute Auswahl einer 8×8-Vorlage misslang.",
      [presetImage, selectedImage]);
    await modal.getByPlaceholder("Name des Dungeons").fill(name);
    await modal.getByRole("button", { name: "Anlegen", exact: true }).click();
    await page.waitForFunction((mapPath) => app.workspace.getLeavesOfType(
      "dungeon-native-map").some((leaf) => leaf.view.file?.path === mapPath &&
      leaf.view.editor), mapPath);
    const disk = path.join(vault, mapPath);
    const existsBeforeSave = fs.existsSync(disk);
    const created = await mapState(page, mapPath);
    const createImage = await stage("created", { selected, created,
      existsBeforeSave });
    set("DD-001.04", existsBeforeSave ? "deviation" : "pass",
      `8×8-Karte sichtbar; Kartendatei vor manuellem Speichern vorhanden=${existsBeforeSave}.`,
      existsBeforeSave ?
        "Original: Karte war nach OK ungespeichert; erst Save schrieb die Datei."
        : null, [createImage]);
    const editor = page.locator(".dungeon-native-editor:visible").last();
    await editor.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction((mapPath) => app.workspace.getLeavesOfType(
      "dungeon-native-map").find((leaf) =>
      leaf.view.file?.path === mapPath)?.view.editor?.session.dirty === false,
    mapPath);
    const saved = await mapState(page, mapPath);
    assert.equal(saved?.document.settings.width, 8);
    assert.equal(saved?.document.settings.height, 8);
    const sha = sha256(disk);
    write(savedPath, { mapPath, presetName, document: saved.document,
      sha256: sha });
    await stage("saved", { mapPath, sha256: sha, saved });
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    throw error;
  } finally {
    result();
  }
};
