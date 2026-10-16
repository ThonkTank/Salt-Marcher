// DD-036.03: save an already saved Atlas again without an intervening edit.
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => async () => {
  const worldPath = "Atlanten/Hex02 Insel.overworld";
  const baseline = JSON.parse(fs.readFileSync(path.join(qa, "dd036-s01-noop-baseline.json"), "utf8"));
  const files = Object.keys(baseline.saved).sort();
  const persistedCells = files.filter((file) => file.includes("/terrain/"))
    .reduce((count, file) => count + JSON.parse(baseline.saved[file]).cells.length, 0);
  assert.equal(persistedCells, 36);
  const readFiles = () => Object.fromEntries(files.map((file) => [file,
    fs.readFileSync(path.join(vault, file), "utf8")]));
  const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
  assert.deepEqual(readFiles(), baseline.saved, "QA fixture is the exact saved baseline");
  assert(!fs.existsSync(path.join(vault, worldPath + ".draft")));
  assert(!fs.existsSync(path.join(vault, worldPath + ".journal")));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async (file) => {
    const target = app.vault.getAbstractFileByPath(file);
    if (!target) throw new Error("Missing saved Atlas fixture");
    await app.workspace.getLeaf(false).openFile(target);
  }, worldPath);
  const viewport = page.locator(".dn-atlas-viewport:visible").last();
  await viewport.locator("canvas").waitFor({ state: "visible" });
  const state = () => page.evaluate(() => {
    const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view;
    return {
      path: view?.file?.path,
      worldId: view?.editor?.renderer?.world?.id,
      cells: view?.editor?.terrain?.cells(),
      references: view?.editor?.terrain?.references(),
      dirty: view?.repository?.dirty,
      draft: view?.repository?.hasDraft,
      undoDepth: view?.editor?.terrain?.history?.undoDepth,
      camera: view?.editor?.renderer?.camera,
      status: view?.contentEl?.querySelector(".dn-atlas-save-status")?.textContent,
    };
  });
  const before = await state();
  assert.equal(before.path, worldPath);
  assert.equal(before.worldId, baseline.worldId);
  assert(before.cells.length > 0 && before.cells.length <= persistedCells,
    "Only visible terrain chunks may be loaded in memory");
  assert.equal(before.references.length, 5);
  assert.equal(before.dirty, false);
  assert.equal(before.draft, false);
  assert.equal(before.status, "Gespeichert");
  await page.screenshot({ path: path.join(out, "01-before-repeat-save.png") });
  await page.locator(".dn-atlas-toolbar:visible").last()
    .getByRole("button", { name: "Atlas speichern", exact: true }).click();
  await page.evaluate(async () => {
    const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view;
    await view.editor.flush();
  });
  const after = await state();
  assert.deepEqual(after, before, "Repeat Save preserves editor state");
  const savedAfter = readFiles();
  assert.deepEqual(savedAfter, baseline.saved, "Repeat Save preserves every saved file byte");
  assert(!fs.existsSync(path.join(vault, worldPath + ".draft")));
  assert(!fs.existsSync(path.join(vault, worldPath + ".journal")));
  await page.screenshot({ path: path.join(out, "02-after-repeat-save.png") });
  fs.writeFileSync(path.join(out, "s01-noop-result.json"), JSON.stringify({
    before, after, files: files.map((file) => ({ path: file,
      beforeSha256: hash(baseline.saved[file]), afterSha256: hash(savedAfter[file]) })),
    draftAbsent: true, journalAbsent: true,
  }, null, 2));
  checks.push("DD-036.03 repeated visible Atlas Save on clean 36-cell/five-chunk world preserves all six saved file bytes and editor state without draft/journal");
};
