// DD-020 pilot. The shared runner owns the isolated host and graphics slot.
// This scenario is deliberately not an acceptance of the whole Pattern tool.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mapName = "PatternGroupQA";
const mapPath = `Dungeons/${mapName}/Karte.dungeon`;
const savedName = "material-muster-saved.json";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const patterns = (state) => state?.document.entities.filter((entity) =>
  entity.kind === "surface" && entity.category === "pattern") ?? [];

module.exports = async function materialMuster({ page, out, qa, vault, restart,
  group, record }) {
  assert.equal(group.id, "material-muster");
  const results = new Map();
  const steps = { groupId: group.id, phase: restart ? "reopen" : "edit",
    mapPath, stages: [], error: null };
  const stepsPath = path.join(out, "material-muster-steps.json");
  const savedPath = path.join(qa, savedName);
  const set = (id, state, observation, gap = null, evidence = []) => {
    assert(group.caseIds.includes(id) && !results.has(id), `Doppelter Fall ${id}`);
    results.set(id, { state, observation, gap, evidence });
  };
  const snap = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) return null;
    return { document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize, tool: editor.tool,
      draft: editor.pathDraft?.points.map((point) => ({ ...point })) ?? null,
      previewInstructions: editor.renderer.preview.context.instructions.length };
  });
  const stage = async (name) => {
    const value = await snap();
    const screen = path.join(out, `${name}.png`);
    await page.screenshot({ path: screen });
    steps.stages.push({ name, value, screen });
    return { value, screen };
  };
  const point = (world) => page.evaluate((world) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const screen = { x: box.x + renderer.camera.x + world.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + world.y * renderer.camera.scale };
    if (screen.x < box.left || screen.x >= box.right ||
        screen.y < box.top || screen.y >= box.bottom)
      throw new Error(`Musterpunkt außerhalb Canvas: ${world.x},${world.y}`);
    return screen;
  }, world);
  const choose = async () => {
    if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
      await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
    await page.locator(".dn-group-rail").last()
      .getByRole("button", { name: "Bauwerk", exact: true }).click();
    await page.locator(".dn-tool-rail").last()
      .getByRole("button", { name: "Musterflächen", exact: true }).click();
  };
  const finish = () => {
    fs.writeFileSync(stepsPath, JSON.stringify(steps, null, 2) + "\n");
    for (const id of group.caseIds) {
      const item = results.get(id) ?? { state: "open", observation: null,
        gap: [group.originalGaps?.[id] && `Original: ${group.originalGaps[id]}`,
          steps.error
            ? `Host: Gruppenfolge abgebrochen (${steps.error.split("\n", 1)[0]}).`
            : "Host: Dieser Unterfall wurde im begrenzten Musterlauf nicht ausgeführt."].filter(Boolean).join(" "),
        evidence: [] };
      record.add(id, item.state, item.observation,
        [stepsPath, ...item.evidence], item.gap);
    }
  };

  try {
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
      assert.equal(saved.mapPath, mapPath);
      assert.equal(digest(path.join(vault, mapPath)), saved.mapSha256);
      await page.evaluate(async (target) => {
        const file = app.vault.getAbstractFileByPath(target);
        if (!file) throw new Error(`Musterkarte fehlt: ${target}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, mapPath);
      await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
      await choose();
      const reopened = await stage("fresh-open");
      const equalDocument = same(reopened.value?.document, saved.document) &&
        !reopened.value.dirty && patterns(reopened.value).length === 1;
      const surface = patterns(reopened.value)[0];
      const sameColor = surface?.color === 0x3366cc &&
        Math.round((surface.opacity ?? 1) * 255) === 160;
      set("DD-020.17", equalDocument ? "open" : "deviation",
        `Ein gespeichertes X-Farbrechteck nach frischem Prozess: Dokument und Anzahl gleich=${equalDocument}.`,
        equalDocument
          ? "Original/Host: nur X, RGB und Alpha gepaart; Material, Rotation, Outline und bearbeitete Form fehlen im Frischstartvergleich."
          : "Host: Karte oder Musterparameter nach Neustart verändert.",
        [savedPath, reopened.screen]);
      set("DD-020.13", sameColor && equalDocument ? "pass" : "deviation",
        `Frischstart: gleiches Dokument=${equalDocument}, RGB #3366cc und Alpha 160/255 erhalten=${sameColor}.`,
        sameColor && equalDocument ? null : "Host: Dokument, RGB oder 8-Bit-Alpha nach Neustart verändert.",
        [savedPath, reopened.screen]);
      set("DD-020.12", "open",
        `Farbfläche ohne Materialreferenz nach frischem Öffnen vorhanden=${!surface?.material}.`,
        "Original: reine X-Füllung und Hostfläche sind noch nicht an derselben Geometrie pixelweise gepaart.",
        [reopened.screen]);
      return;
    }

    await page.evaluate((name) => app.plugins.getPlugin("dungeon-editor")
      .create(name, 12, 8, { assetPacks: [], builtInAssets: true }), mapName);
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    await choose();
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      renderer.fit();
      renderer.zoom(40 / renderer.camera.scale);
      renderer.canvas.focus();
    });
    const initial = await stage("pattern-tool");
    const shape = page.getByRole("combobox", { name: "Flächenform" });
    assert.equal(await shape.inputValue(), "rectangle");
    set("DD-020.01", "open", "Musterwerkzeug geöffnet; Form- und Farbfelder fotografiert.",
      "Original: gesamte Optionsoberfläche einschließlich eingebauter Bibliothek fehlt im Host noch.",
      [initial.screen]);

    const picker = page.locator(".dn-pattern-color-picker");
    await picker.locator("summary").click();
    await picker.getByRole("textbox", { name: "Musterfarbe Hex" }).fill("ff00ff");
    const beforeAccept = await snap();
    await picker.getByRole("button", { name: "Accept", exact: true }).click();
    const afterAccept = await stage("picker-magenta-accepted");
    const defaults = await page.evaluate(() => app.workspace
      .getLeavesOfType("dungeon-native-map")[0].view.editor.settings.surfaces.pattern);
    const visibleColor = await page.locator('input[aria-label="Flächenfarbe"]').last().inputValue();
    const pickerClosed = !(await picker.evaluate((element) => element.open));
    const accepted = defaults.color === 0xff00ff &&
      Math.round((defaults.opacity ?? 1) * 255) === 255 &&
      same(beforeAccept.document, afterAccept.value.document);
    const visibleMagenta = visibleColor.toLowerCase() === "#ff00ff";
    set("DD-020.26", accepted && visibleMagenta ? "pass" : "deviation",
      `Hex ff00ff nach Accept im Muster-Farbwert und sichtbaren Farbfeld=${accepted && visibleMagenta}.`,
      accepted && visibleMagenta ? null : "Host: Hex-Eingabe wurde nicht sichtbar als RGB ff00ff übernommen.",
      [afterAccept.screen]);
    set("DD-020.27", accepted && visibleMagenta && pickerClosed ? "pass" : "deviation",
      `Accept schließt Picker=${pickerClosed}, zeigt Magenta=${visibleMagenta} und lässt die Karte unverändert=${accepted}.`,
      accepted && visibleMagenta && pickerClosed ? null
        : "Host: Picker schloss nicht, zeigte nicht Magenta oder veränderte bereits die Karte.",
      [afterAccept.screen]);
    await picker.locator("summary").click();
    await picker.getByRole("textbox", { name: "Musterfarbe Hex" }).fill("3366cc");
    await picker.getByRole("spinbutton", { name: "Musterfarbe Alpha 0–255" }).fill("160");
    await picker.getByRole("button", { name: "Accept", exact: true }).click();
    const configured = await stage("picker-original-color");
    const exactOriginalColor = await page.evaluate(() => {
      const surface = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.settings.surfaces.pattern;
      return surface.color === 0x3366cc &&
        Math.round((surface.opacity ?? 1) * 255) === 160;
    });
    assert(exactOriginalColor, "DD-020.13 Referenz-RGBA nicht eingestellt");

    const from = await point({ x: 2, y: 2 });
    const to = await point({ x: 5, y: 4 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    const preview = await stage("rectangle-preview");
    await page.mouse.up();
    await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.document().entities.filter((entity) =>
        entity.kind === "surface" && entity.category === "pattern").length === 1);
    const created = await stage("rectangle-created");
    const surface = patterns(created.value)[0];
    const createdCorrect = surface?.color === 0x3366cc &&
      Math.round((surface.opacity ?? 1) * 255) === 160 &&
      !surface.material && patterns(created.value).length === 1;
    set("DD-020.02", "open", `Host-Rechteck erzeugt=${!!surface}; Vorschau=${preview.value.previewInstructions}.`,
      "Original: DD-020.02 zeigt eine gemusterte Fläche; diese QA-Folge nutzt X ohne Textur.",
      [preview.screen, created.screen]);
    set("DD-020.12", "open", `Host-X-Farbfläche ohne Material mit RGB/Alpha korrekt=${createdCorrect}.`,
      "Original: Pixel-/Geometriewirkung der gleichen X-Fläche noch nicht direkt gepaart.",
      [configured.screen, created.screen]);

    await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
    const undone = await stage("rectangle-undone");
    const removed = patterns(undone.value).length === 0;
    set("DD-020.16", removed ? "pass" : "deviation",
      `Undo entfernt die eine Musterfläche=${removed}.`,
      removed ? null : "Host: Undo ließ die Fläche stehen.", [undone.screen]);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).last().click();
    const redone = await stage("rectangle-redone");
    const restored = patterns(redone.value).length === 1 &&
      same(patterns(redone.value)[0], surface);
    set("DD-020.29", restored ? "pass" : "deviation",
      `Redo stellt die Musterfläche wieder her=${restored}.`,
      restored ? null : "Host: Redo stellte die Fläche nicht wieder her.", [redone.screen]);

    await shape.selectOption("polygon");
    const a = await point({ x: 7, y: 2 });
    const b = await point({ x: 9, y: 3 });
    await page.mouse.click(a.x, a.y);
    await page.mouse.move(b.x, b.y);
    const draft = await stage("polygon-preview");
    set("DD-020.05", draft.value?.draft && draft.value.previewInstructions > 0
      ? "pass" : "deviation",
      `Polygonentwurf und Linienvorschau=${!!draft.value?.draft && draft.value.previewInstructions > 0}.`,
      draft.value?.draft && draft.value.previewInstructions > 0 ? null
        : "Host: sichtbarer Polygonentwurf fehlt.", [draft.screen]);
    await page.locator(".dn-canvas canvas").last().focus();
    await page.keyboard.press("Escape");
    const canceled = await stage("polygon-canceled");
    const noDraft = !canceled.value?.draft && patterns(canceled.value).length === 1 &&
      canceled.value.history === draft.value.history;
    set("DD-020.06", noDraft ? "pass" : "deviation",
      `Escape verwirft Entwurf ohne Entitäts- oder Historyänderung=${noDraft}.`,
      noDraft ? null : "Host: Escape ließ Entwurf, Karteneintrag oder Historyänderung zurück.",
      [draft.screen, canceled.screen]);

    await page.getByRole("button", { name: "Speichern", exact: true }).last().click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.dirty);
    const saved = await stage("saved");
    const mapSha256 = digest(path.join(vault, mapPath));
    fs.writeFileSync(savedPath, JSON.stringify({ mapPath, mapSha256,
      document: saved.value.document }, null, 2) + "\n");
    set("DD-020.17", "open", "X-Farbfläche gespeichert und Prüfsumme protokolliert.",
      "Host: Frischer Prozess und Original-/Hostbild folgen im Reopen-Lauf.",
      [savedPath, saved.screen]);
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    throw error;
  } finally {
    finish();
  }
};
