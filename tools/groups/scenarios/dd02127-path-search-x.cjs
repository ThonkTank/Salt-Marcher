// DD-021.27 only. The shared group runner owns the isolated Obsidian process.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = require("../fixtures/dd02127-path-search-x.json");
const stateName = "dd02127-path-search-x-state.json";
const sha256 = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const write = (file, value) => fs.writeFileSync(file,
  JSON.stringify(value, null, 2) + "\n");
const buildHash = () => sha256(path.join(
  process.env.DUNGEON_PLUGIN_ROOT || path.resolve(__dirname, "../../.."),
  "main.js"));

async function visibleEditor(page) {
  const editor = page.locator(".dungeon-native-editor:visible").last();
  await editor.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  return editor;
}

async function choosePath(page) {
  let editor = await visibleEditor(page);
  if (!(await editor.evaluate((element) =>
    element.classList.contains("dn-maximized")))) {
    await editor.getByRole("button", { name: "Maximieren", exact: true }).click();
    editor = await visibleEditor(page);
  }
  await editor.locator(".dn-group-rail")
    .getByRole("button", { name: "Gelände", exact: true }).click();
  await editor.locator(".dn-tool-rail")
    .getByRole("button", { name: "Pfade", exact: true }).click();
  return visibleEditor(page);
}

async function mapState(page) {
  return page.evaluate(() => {
    const leaves = [
      ...app.workspace.getLeavesOfType("dungeon-native-map"),
      ...app.workspace.getLeavesOfType("dungeon-native-pending"),
    ];
    const leaf = leaves.find((item) => item === app.workspace.activeLeaf) ??
      leaves.find((item) => item.view?.editor?.root?.offsetParent !== null) ??
      leaves[0];
    const editor = leaf?.view?.editor;
    if (!editor?.session) return null;
    return {
      path: leaf.view.file?.path ?? leaf.view.mapPath ?? null,
      document: editor.session.document(),
      history: editor.session.historySize,
      dirty: editor.session.dirty,
      tool: editor.tool,
    };
  });
}

module.exports = async function dd02127PathSearchX({ page, out, qa, vault,
  restart, group, record }) {
  assert.equal(group.id, "material-pfad");
  assert(group.caseIds.includes("DD-021.27"));
  const stateFile = path.join(qa, stateName);
  const stepsFile = path.join(out, "dd02127-path-search-x-steps.json");
  const steps = { caseId: "DD-021.27", phase: restart ? "reopen" : "edit",
    buildSha256: buildHash(), originalVersion: fixture.originalVersion,
    pckSha256: fixture.pckSha256, stages: [], errors: [] };
  const evidence = [stepsFile];
  const stage = async (name, data) => {
    const image = path.join(out, `dd02127-${name}.png`);
    await page.screenshot({ path: image });
    evidence.push(image);
    steps.stages.push({ name, ...data, image });
  };
  let outcome = "open";
  try {
    assert.equal(sha256(fixture.pckPath), fixture.pckSha256,
      "Original-PCK hat eine andere Prüfsumme");
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      assert.equal(saved.buildSha256, steps.buildSha256,
        "Edit und Frischstart verwenden verschiedene Builds");
      assert.equal(sha256(path.join(vault, saved.mapPath)), saved.mapSha256,
        "QA-Karte änderte sich zwischen Edit und Frischstart");
      await page.evaluate(async (mapPath) => {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!file) throw new Error(`QA-Karte fehlt: ${mapPath}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, saved.mapPath);
    } else {
      fs.rmSync(stateFile, { force: true });
      await page.evaluate(async (sourcePath) =>
        app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(sourcePath),
      fixture.pckPath);
      await page.evaluate(async ({ name, size }) =>
        app.plugins.getPlugin("dungeon-editor").create(name, size[0], size[1],
          { assetPacks: [], builtInAssets: true }),
      { name: fixture.mapName, size: fixture.mapSize });
    }
    const editor = await choosePath(page);
    const search = editor.getByRole("textbox", {
      name: "Pfadbibliothek durchsuchen", exact: true,
    });
    const fieldX = editor.getByRole("button", {
      name: "Pfadbibliothek Suchfeld leeren", exact: true,
    });
    const tiles = editor.locator(".dn-path-library-tiles button");
    const before = await mapState(page);
    assert(before && before.tool === "path");
    assert.equal(before.path, fixture.mapPath);
    const initialCount = await tiles.count();
    assert(initialCount > 1, "Eingebaute Pfadbibliothek hat zu wenige Kacheln");
    assert.equal(await search.inputValue(), "");
    await stage("before", { initialCount, before });

    await search.fill(fixture.assetName);
    await search.press("Enter");
    const filteredCount = await tiles.count();
    assert.equal(filteredCount, 1, "Battlements-Return-Suche filterte nicht");
    assert.equal(await fieldX.isVisible(), true);
    await stage("filtered", { filteredCount, text: await search.inputValue() });
    await fieldX.click();
    const afterXCount = await tiles.count();
    assert.equal(await search.inputValue(), "", "Suchfeld-X leerte den Text nicht");
    assert.equal(await fieldX.isVisible(), false);
    assert.equal(afterXCount, filteredCount,
      "Suchfeld-X änderte unerwartet den angewendeten Filter");
    const focusedAfterX = await search.evaluate((input) =>
      input === input.ownerDocument.activeElement);
    assert(focusedAfterX, "Suchfeld-X gab den Fokus nicht ans Suchfeld zurück");
    await stage("field-x", { afterXCount, focusedAfterX,
      text: await search.inputValue() });

    if (!restart) {
      await search.fill(fixture.assetName);
      await search.press("Enter");
      await editor.getByRole("button", { name: "Suche zurücksetzen" }).click();
      assert.equal(await tiles.count(), initialCount);
      assert.equal(await search.inputValue(), fixture.assetName);
      await fieldX.click();
      assert.equal(await search.inputValue(), "");
      const afterClearThenXCount = await tiles.count();
      assert.equal(afterClearThenXCount, initialCount,
        "Suchfeld-X veränderte die bereits geöffnete Kachelliste");
      await stage("clear-search-then-x", { afterClearThenXCount,
        text: await search.inputValue() });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction(() => !app.workspace.activeLeaf?.view?.editor?.session.dirty);
      const savedMap = path.join(vault, fixture.mapPath);
      assert(fs.existsSync(savedMap), "Suchtest-Karte wurde nicht gespeichert");
      write(stateFile, { mapPath: fixture.mapPath, mapSha256: sha256(savedMap),
        buildSha256: steps.buildSha256 });
      evidence.push(stateFile);
    }
    const after = await mapState(page);
    assert(after && JSON.stringify(after.document) === JSON.stringify(before.document),
      "Suchfeld-X änderte den Karteninhalt");
    assert.equal(after.history, before.history,
      "Suchfeld-X änderte die Kartenhistorie");
    steps.result = { initialCount, filteredCount, afterXCount,
      afterClearThenXCount: steps.stages.find((s) =>
        s.name === "clear-search-then-x")?.afterClearThenXCount ?? null,
      mapUnchanged: true, historyUnchanged: true };
    outcome = "pass";
  } catch (error) {
    outcome = "fail";
    steps.errors.push(String(error));
  } finally {
    write(stepsFile, steps);
    for (const id of group.caseIds) {
      if (id === "DD-021.27") {
        record.add(id, outcome,
          outcome === "fail" ? "Suchfeld-X-Hostfolge schlug fehl." :
            `Suchfeld-X leerte Text in ${steps.phase}; Trefferzahlen und unveränderte Karte/History protokolliert.`,
          evidence,
          outcome === "fail" ? steps.errors.join(" ") : null);
      } else {
        record.add(id, "open", null, [stepsFile],
          `Host: DD-021.27-Sonderlauf prüfte ${id} nicht.`);
      }
    }
  }
};
