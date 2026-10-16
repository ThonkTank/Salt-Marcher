// Fresh Obsidian/VaultStore recovery from an isolated multi-write Atlas state.
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(qa, "dd036-s01-recovery-case.json"), "utf8"));
  const writes = JSON.parse(fs.readFileSync(path.join(qa, "writes.json"), "utf8"));
  const worldPath = "Atlanten/Hex02 Insel.overworld";
  const journalPath = worldPath + ".journal";
  const files = [...new Set([...writes.map((entry) => entry.path), worldPath, journalPath])];
  const read = (file) => {
    const full = path.join(vault, file);
    return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
  };
  const sha = (value) => value === null ? null : crypto.createHash("sha256").update(value).digest("hex");
  const snapshot = () => Object.fromEntries(files.map((file) => [file, sha(read(file))]));
  const before = snapshot();
  assert.deepEqual(before, fixture.before, "Preseeded fixture bytes must match its manifest");
  assert.equal(JSON.parse(read(worldPath)).id, fixture.worldId);
  await page.evaluate(async (file) => {
    const target = app.vault.getAbstractFileByPath(file);
    if (!target) throw new Error("Recovery world fixture missing");
    await app.workspace.getLeaf(false).openFile(target);
  }, worldPath);
  const view = page.locator(".dn-atlas-viewport:visible").last();
  const expectedConflict = fixture.kind === "conflict";
  if (expectedConflict)
    await page.getByText("Atlas konnte nicht geöffnet werden. Error: Extern geändert:").waitFor();
  else await view.locator("canvas").waitFor({ state: "visible", timeout: 30000 });
  const observed = await page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1);
    const v = leaf?.view;
    return {
      file: v?.file?.path,
      error: v?.contentEl?.innerText?.includes("Atlas konnte nicht geöffnet werden")
        ? v.contentEl.innerText : null,
      editor: !!v?.editor,
      worldId: v?.editor?.renderer?.world?.id,
      references: v?.editor?.terrain?.references()?.length,
      dirty: v?.repository?.dirty,
      draft: v?.repository?.hasDraft,
      status: v?.contentEl?.querySelector(".dn-atlas-save-status")?.textContent,
    };
  });
  assert.equal(observed.file, worldPath);
  if (expectedConflict) {
    assert.equal(observed.editor, false);
    assert.match(observed.error, /Extern geändert:/);
  } else {
    assert.equal(observed.editor, true);
    assert.equal(observed.worldId, fixture.worldId);
    assert.equal(observed.references, 5);
    assert.equal(observed.draft, fixture.kind === "prepared");
    assert.equal(observed.dirty, fixture.kind === "prepared");
  }
  const after = snapshot();
  assert.deepEqual(after, fixture.after, "Recovery must match every expected file hash");
  if (expectedConflict) assert.deepEqual(after, before, "Conflict must preserve all bytes");
  else assert.equal(read(journalPath), null, "Recovered journal must be absent");
  await page.screenshot({ path: path.join(out, "01-recovery.png") });
  fs.writeFileSync(path.join(out, "s01-recovery-result.json"), JSON.stringify({
    fixture, before, after, observed,
  }, null, 2));
  checks.push("DD-036.03 fresh Obsidian VaultStore recovery matches all Atlas manifest files and journal for " + fixture.kind + " boundary " + fixture.boundary);
};
