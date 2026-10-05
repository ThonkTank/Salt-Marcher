// DD-021.20 only. The common group runner owns the isolated Obsidian host.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = require("../fixtures/material-pfad.json");
const mapName = "MaterialPathUndoQA";
const mapPath = `Dungeons/${mapName}/Karte.dungeon`;
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const paths = (state) => state?.document.entities.filter((entity) =>
  entity.kind === "path") ?? [];
const fileSha256 = (file) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha256");
  fs.createReadStream(file).on("data", (chunk) => hash.update(chunk))
    .on("error", reject).on("end", () => resolve(hash.digest("hex")));
});

module.exports = async function materialPathUndo({ page, out, restart, group, record }) {
  assert.equal(group.id, "material-pfad");
  assert(group.caseIds.includes("DD-021.20"));
  const stepsPath = path.join(out, "dd02120-steps.json");
  const steps = { phase: restart ? "reopen" : "edit", groupId: group.id,
    mapPath, source: fixture.pckPath, sourceSha256: null, stages: [], error: null };
  let outcome;
  const snapshot = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) return null;
    return { document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize,
      previewInstructions: editor.renderer.preview.context.instructions.length };
  });
  const stage = async (name, detail = null) => {
    const state = await snapshot();
    const image = path.join(out, `dd02120-${name}.png`);
    await page.screenshot({ path: image });
    steps.stages.push({ name, detail, state, image });
    return { state, image };
  };
  const screenPoint = (world) => page.evaluate((world) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const screen = { x: box.x + renderer.camera.x + world.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + world.y * renderer.camera.scale };
    if (screen.x < box.left || screen.x >= box.right ||
        screen.y < box.top || screen.y >= box.bottom)
      throw new Error(`Pfadpunkt außerhalb Canvas: ${world.x},${world.y}`);
    return screen;
  }, world);
  const finish = () => {
    write(stepsPath, steps);
    for (const id of group.caseIds) {
      const item = id === "DD-021.20" && outcome ? outcome : {
        state: "open", observation: null,
        gap: [group.originalGaps?.[id] && `Original: ${group.originalGaps[id]}`,
          steps.error && `Host: DD-021.20-Lauf abgebrochen (${steps.error.split("\n", 1)[0]}).`,
          "Host: Dieser Fall wurde im Undo-Regressionslauf nicht ausgeführt."].filter(Boolean).join(" "),
        evidence: [],
      };
      record.add(id, item.state, item.observation,
        [stepsPath, ...item.evidence], item.gap);
    }
  };

  try {
    assert(!restart, "DD-021.20 Undo-Regressionslauf hat keine Reopenphase");
    assert.equal(fixture.originalVersion, "1.2.0.1");
    assert(fs.existsSync(fixture.pckPath), "Original-PCK fehlt");
    steps.sourceSha256 = await fileSha256(fixture.pckPath);
    assert.equal(steps.sourceSha256, fixture.pckSha256,
      "Native Pfadquelle weicht von der protokollierten 1.2.0.1-PCK ab");
    await page.evaluate(async (source) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(source),
    fixture.pckPath);
    await page.evaluate(async ({ name, size }) =>
      app.plugins.getPlugin("dungeon-editor").create(name, size[0], size[1],
        { assetPacks: [], builtInAssets: true }),
    { name: mapName, size: fixture.mapSize });
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
      await page.getByRole("button", { name: "Maximieren", exact: true }).last().click();
    await page.locator(".dn-group-rail").last()
      .getByRole("button", { name: "Gelände", exact: true }).click();
    await page.locator(".dn-tool-rail").last()
      .getByRole("button", { name: "Pfade", exact: true }).click();
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      renderer.fit();
      renderer.zoom(40 / renderer.camera.scale);
      renderer.canvas.focus();
    });
    const assets = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
      .listAssets([], true));
    const asset = assets.find((item) => item.kind === "path" &&
      item.name === fixture.assetName && item.packId === fixture.assetPackId &&
      item.files?.image === fixture.assetSourcePath);
    assert(asset, "Eingebauter Battlements-Pfad fehlt");
    const tile = page.locator(`.dn-path-library-tiles button[aria-label="${fixture.assetName}"]`);
    await tile.waitFor({ timeout: 30000 });
    await tile.click();
    assert.equal(await page.getByRole("combobox", { name: "Paketmaterial" }).inputValue(),
      asset.id);
    const initial = await stage("before", { assetId: asset.id });
    assert.equal(paths(initial.state).length, 0);
    for (const point of fixture.horizontal) {
      const at = await screenPoint(point);
      await page.mouse.click(at.x, at.y);
    }
    const preview = await stage("preview");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => app.workspace
      .getLeavesOfType("dungeon-native-map")[0].view.editor.session.document()
      .entities.filter((entity) => entity.kind === "path").length === 1,
    null, { timeout: 12000 });
    const placed = await stage("placed");
    const entity = paths(placed.state)[0];
    assert.equal(entity?.material?.assetId, asset.id);
    assert.equal(entity?.material?.assetPart, "image");
    assert(placed.state.history > initial.state.history,
      "Pfadplatzierung erzeugte keinen Historyschritt");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
    const undone = await stage("undone");
    const removed = paths(undone.state).length === 0 &&
      same(undone.state.document, initial.state.document) &&
      undone.state.history === initial.state.history;
    outcome = {
      state: removed ? "pass" : "deviation",
      observation: `Battlements-Pfad nach Enter platziert=${!!entity}; Undo entfernt ihn einschließlich Dokument- und Historyrückkehr=${removed}.`,
      gap: removed ? null : "Host: fertiger Pfad, Dokument oder History blieb nach Undo verändert.",
      evidence: [initial.image, preview.image, placed.image, undone.image],
    };
    if (!removed) throw new Error("DD-021.20 Undo-Pfad nicht vollständig entfernt");
  } catch (error) {
    steps.error = String(error?.stack ?? error);
    throw error;
  } finally {
    finish();
  }
};
