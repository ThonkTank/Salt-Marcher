// DD-020.21–.25: isolated color-pair workflow. The shared runner owns the GUI.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mapName = "PatternPickerNativeQA";
const mapPath = `Dungeons/${mapName}/Karte.dungeon`;
const savedName = "material-muster-colors-saved.json";
const caseColors = [
  { id: "DD-020.21", label: "field", color: 0x424958, area: [1, 1, 2, 2] },
  { id: "DD-020.22", label: "hue", color: 0x7ccc33, area: [3, 1, 4, 2] },
  { id: "DD-020.23", label: "red", color: 0x6466cc, area: [5, 1, 6, 2] },
  { id: "DD-020.24", label: "green", color: 0x3396cc, area: [7, 1, 8, 2] },
  { id: "DD-020.25", label: "blue", color: 0x336632, area: [9, 1, 10, 2] },
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const sha256 = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const patterns = (state) => state?.document.entities.filter((item) =>
  item.kind === "surface" && item.category === "pattern") ?? [];

module.exports = async function materialMusterColors({ page, out, qa, vault,
  restart, group, record }) {
  assert.equal(group.id, "material-muster");
  const ids = new Set(caseColors.map((item) => item.id));
  assert.equal(ids.size, 5);
  assert(caseColors.every((item) => group.caseIds.includes(item.id)));
  const result = new Map();
  const stepsPath = path.join(out, "material-muster-colors-steps.json");
  const savedPath = path.join(qa, savedName);
  const steps = { groupId: group.id, phase: restart ? "reopen" : "edit",
    original: "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd020-color-native/RESULT.md",
    mapPath, stages: [], error: null };
  const set = (id, state, observation, gap, evidence = []) => {
    assert(ids.has(id) && !result.has(id), `Doppelter Farbfall ${id}`);
    result.set(id, { state, observation, gap, evidence });
  };
  const snapshot = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) return null;
    return { document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize,
      preview: editor.renderer.preview.context.instructions.length };
  });
  const stage = async (label, detail = null) => {
    const state = await snapshot();
    const image = path.join(out, `dd020-color-${label}.png`);
    await page.screenshot({ path: image });
    steps.stages.push({ label, detail, state, image });
    return { state, image };
  };
  const finish = () => {
    write(stepsPath, steps);
    for (const id of group.caseIds) {
      const entry = result.get(id) ?? { state: "open", observation: null,
        gap: [group.originalGaps?.[id] && `Original: ${group.originalGaps[id]}`,
          steps.error && `Host: Farblauf abgebrochen (${steps.error.split("\n", 1)[0]}).`,
          "Host: Dieser Fall wurde im begrenzten Farblauf nicht ausgeführt."].filter(Boolean).join(" "),
        evidence: [] };
      record.add(id, entry.state, entry.observation,
        [stepsPath, ...entry.evidence], entry.gap);
    }
  };
  const chooseTool = async () => {
    if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
      await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
    await page.locator(".dn-group-rail").last()
      .getByRole("button", { name: "Bauwerk", exact: true }).click();
    await page.locator(".dn-tool-rail").last()
      .getByRole("button", { name: "Musterflächen", exact: true }).click();
  };
  const picker = () => page.locator(".dn-pattern-color-picker").last();
  const openPicker = async () => {
    const target = picker();
    if (!(await target.evaluate((element) => element.open)))
      await target.locator("summary").click();
    return target;
  };
  const inputState = async () => {
    const target = picker();
    return {
      hex: await target.getByRole("textbox", { name: "Musterfarbe Hex" }).inputValue(),
      r: await target.getByRole("spinbutton", { name: "Musterfarbe R" }).inputValue(),
      g: await target.getByRole("spinbutton", { name: "Musterfarbe G" }).inputValue(),
      b: await target.getByRole("spinbutton", { name: "Musterfarbe B" }).inputValue(),
      a: await target.getByRole("spinbutton", { name: "Musterfarbe Alpha 0–255" }).inputValue(),
    };
  };
  const screenPoint = (world) => page.evaluate((world) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const screen = { x: box.x + renderer.camera.x + world.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + world.y * renderer.camera.scale };
    if (screen.x < box.left || screen.x >= box.right ||
        screen.y < box.top || screen.y >= box.bottom)
      throw new Error(`Farbprobe außerhalb Canvas: ${world.x},${world.y}`);
    return screen;
  }, world);
  const setBase = async () => {
    const target = await openPicker();
    const hex = target.getByRole("textbox", { name: "Musterfarbe Hex" });
    await hex.fill("3366cc");
    await hex.press("Tab");
    const alpha = target.getByRole("spinbutton", { name: "Musterfarbe Alpha 0–255" });
    await alpha.fill("255");
    await alpha.press("Tab");
    await target.getByRole("button", { name: "Accept", exact: true }).click();
    const base = await page.evaluate(() => app.workspace
      .getLeavesOfType("dungeon-native-map")[0].view.editor.settings.surfaces.pattern);
    assert.equal(base.color, 0x3366cc);
    assert.equal(Math.round((base.opacity ?? 1) * 255), 255);
  };
  const applyGesture = async (item) => {
    const target = await openPicker();
    if (item.label === "field") {
      const box = await target.locator(".dn-pattern-color-field").boundingBox();
      assert(box && box.width > 0 && box.height > 0);
      await page.mouse.click(box.x + box.width * 0.25,
        box.y + box.height * (168 / 257));
    } else if (item.label === "hue") {
      // Deterministic normalized control input corresponding to the native
      // measured strip position. Pointer-track equivalence remains open.
      await target.getByRole("slider", { name: "Musterfarbe Farbton" })
        .evaluate((element) => {
          element.value = "253";
          element.dispatchEvent(new Event("input", { bubbles: true }));
        });
    } else {
      const channel = { red: "R", green: "G", blue: "B" }[item.label];
      const value = { red: "100", green: "150", blue: "50" }[item.label];
      const field = target.getByRole("spinbutton", { name: `Musterfarbe ${channel}` });
      await field.fill(value);
      await field.press("Tab");
    }
    return inputState();
  };

  try {
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
      assert.equal(saved.mapPath, mapPath);
      assert.equal(sha256(path.join(vault, mapPath)), saved.sha256,
        "Farbkarte zwischen Edit und Frischstart verändert");
      await page.evaluate(async (target) => {
        const file = app.vault.getAbstractFileByPath(target);
        if (!file) throw new Error(`Farbkarte fehlt: ${target}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, mapPath);
      await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
      const reopened = await stage("fresh-open");
      const list = patterns(reopened.state);
      const documentSame = same(reopened.state?.document, saved.document) &&
        !reopened.state.dirty && list.length === caseColors.length;
      for (const item of caseColors) {
        const old = saved.entities[item.id];
        const current = list.find((entry) => entry.id === old?.id);
        const storedSame = documentSame && current?.color === item.color &&
          Math.round((current.opacity ?? 1) * 255) === 255 && same(current, old);
        set(item.id, storedSame ? "open" : "deviation",
          `Frischstart: Dokument gleich=${documentSame}, ${item.label} RGB ${item.color.toString(16)} und Entität gleich=${storedSame}.`,
          storedSame
            ? "Original: Für diese Farbflächen fehlen getrennte Pixelproben und ein frischer Originalprozess."
            : "Host: gespeicherte RGB/Alpha-/Entitätswirkung änderte sich beim Frischstart.",
          [savedPath, reopened.image]);
      }
      return;
    }

    await page.evaluate((name) => app.plugins.getPlugin("dungeon-editor")
      .create(name, 12, 8, { assetPacks: [], builtInAssets: true }), mapName);
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    await chooseTool();
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      renderer.fit();
      renderer.zoom(40 / renderer.camera.scale);
      renderer.canvas.focus();
    });
    await stage("tool-open");
    const shape = page.getByRole("combobox", { name: "Flächenform" });
    assert.equal(await shape.inputValue(), "rectangle");
    for (let index = 0; index < caseColors.length; index++) {
      const item = caseColors[index];
      // Drawing selects the new surface. Re-entering the tool clears that
      // selection so the next color changes defaults, not a previous probe.
      await chooseTool();
      assert.equal(await shape.inputValue(), "rectangle");
      await setBase();
      const before = await snapshot();
      const visible = await applyGesture(item);
      const beforeAccept = await stage(`${item.label}-before-accept`, { visible });
      const expected = item.color.toString(16).padStart(6, "0");
      const channels = {
        r: (item.color >>> 16) & 255,
        g: (item.color >>> 8) & 255,
        b: item.color & 255,
      };
      const pickerCorrect = visible.hex.toLowerCase() === expected &&
        Number(visible.r) === channels.r && Number(visible.g) === channels.g &&
        Number(visible.b) === channels.b && Number(visible.a) === 255 &&
        same(before.document, beforeAccept.state.document);
      await picker().getByRole("button", { name: "Accept", exact: true }).click();
      const accepted = await stage(`${item.label}-accepted`, { pickerCorrect });
      const configured = await page.evaluate(() => app.workspace
        .getLeavesOfType("dungeon-native-map")[0].view.editor.settings.surfaces.pattern);
      const acceptedCorrect = configured.color === item.color &&
        Math.round((configured.opacity ?? 1) * 255) === 255 &&
        same(before.document, accepted.state.document);
      const [x1, y1, x2, y2] = item.area;
      const from = await screenPoint({ x: x1, y: y1 });
      const to = await screenPoint({ x: x2, y: y2 });
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      const preview = await stage(`${item.label}-preview`);
      await page.mouse.up();
      await page.waitForFunction((count) => app.workspace
        .getLeavesOfType("dungeon-native-map")[0].view.editor.session.document()
        .entities.filter((entity) => entity.kind === "surface" &&
          entity.category === "pattern").length === count,
      index + 1, { timeout: 12000 });
      const drawn = await stage(`${item.label}-drawn`);
      const created = patterns(drawn.state).at(-1);
      const drawnCorrect = patterns(drawn.state).length === index + 1 &&
        created?.color === item.color &&
        Math.round((created.opacity ?? 1) * 255) === 255 &&
        preview.state.preview > 0;
      await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
      const undone = await stage(`${item.label}-undo`);
      const undoCorrect = patterns(undone.state).length === index;
      await page.getByRole("button", { name: "Wiederholen", exact: true }).last().click();
      const redone = await stage(`${item.label}-redo`);
      const redoCorrect = patterns(redone.state).length === index + 1 &&
        same(patterns(redone.state).at(-1), created);
      const hostCorrect = pickerCorrect && acceptedCorrect && drawnCorrect &&
        undoCorrect && redoCorrect;
      set(item.id, hostCorrect ? "open" : "deviation",
        `Picker=${pickerCorrect}, Accept=${acceptedCorrect}, Fläche/Preview=${drawnCorrect}, Undo=${undoCorrect}, Redo=${redoCorrect}; RGB=${expected}, A=255.`,
        hostCorrect
          ? [item.label === "hue" && "Host: normierter Hue-Wert per DOM-Input; Pointerzuordnung offen.",
            "Original/Host: Pixelgleichheit und Original-Frischstart bleiben offen."].filter(Boolean).join(" ")
          : "Host: Picker-/ARGB-/History-Wirkung wich vom gemessenen Originalwert ab.",
        [beforeAccept.image, accepted.image, preview.image, drawn.image,
          undone.image, redone.image]);
    }
    await page.getByRole("button", { name: "Speichern", exact: true }).last().click();
    await page.waitForFunction(() => !app.workspace
      .getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
    const saved = await stage("saved");
    const entities = {};
    for (let index = 0; index < caseColors.length; index++)
      entities[caseColors[index].id] = patterns(saved.state)[index];
    write(savedPath, { mapPath, sha256: sha256(path.join(vault, mapPath)),
      document: saved.state.document, entities });
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    throw error;
  } finally {
    finish();
  }
};
