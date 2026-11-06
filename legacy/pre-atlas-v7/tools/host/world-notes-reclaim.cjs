// Isolated real Obsidian two-view ownership handoff and explicit draft reclaim.
module.exports = ({ page, fs, path, assert, crypto, root, vault, out, checks }) => async () => {
  const fixture = path.join(root, "tests/fixtures/atlas-e2e-spatial-v2");
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, "manifest.json"), "utf8"));
  const bytes = [...manifest.input, { path: manifest.campaign.path, ...manifest.campaign.input }]
    .map((row) => ({ path: row.path,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, row.path))).digest("hex") }));
  await page.evaluate(async (file) => app.workspace.getLeaf(false)
    .openFile(app.vault.getAbstractFileByPath(file)), manifest.input[0].path);
  await page.locator(".dn-atlas-host .dn-atlas-canvas-host canvas").waitFor({ state: "visible" });
  await page.evaluate(() => app.commands.executeCommandById("dungeon-editor:open-world-notes"));
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-world-notes")[0]?.view.panel?.root?.hidden === false);
  await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-world-notes")[0].view.contentEl.dataset.qa = "first");
  const first = page.locator('[data-qa="first"]');
  await first.getByRole("button", { name: "NPC anlegen" }).click();
  await first.locator(".dn-world-notes form label").filter({ hasText: "Name" }).locator("input")
    .fill("Erster ungespeicherter Text");
  await page.evaluate(async () => {
    const leaf = app.workspace.getLeaf("split", "vertical");
    await leaf.setViewState({ type: "dungeon-world-notes", active: true });
    leaf.view.contentEl.dataset.qa = "second";
  });
  const second = page.locator('[data-qa="second"]');
  await second.locator(".dn-world-notes").waitFor({ state: "visible" });
  const secondName = second.locator(".dn-world-notes form label").filter({ hasText: "Name" }).locator("input");
  assert.equal(await secondName.inputValue(), "Erster ungespeicherter Text");
  assert.equal(await first.locator(".dn-world-notes").evaluate((node) => node.hidden), true);
  await secondName.fill("Neuester ungespeicherter Text");
  await first.getByRole("button", { name: "Erneut versuchen" }).click();
  await first.locator(".dn-world-notes").waitFor({ state: "visible" });
  const firstName = first.locator(".dn-world-notes form label").filter({ hasText: "Name" }).locator("input");
  assert.equal(await firstName.inputValue(), "Neuester ungespeicherter Text");
  assert.equal(await second.locator(".dn-world-notes").evaluate((node) => node.hidden), true);
  await secondName.evaluate((node) => {
    node.value = "Späte alte Eingabe";
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await firstName.inputValue(), "Neuester ungespeicherter Text");
  for (const row of bytes) {
    const actual = fs.readFileSync(path.join(vault, row.path));
    assert.equal(crypto.createHash("sha256").update(actual).digest("hex"), row.sha256, row.path);
  }
  fs.writeFileSync(path.join(out, "world-notes-reclaim.json"), JSON.stringify({ bytes,
    finalDraft: await firstName.inputValue(), firstHidden: false, secondHidden: true }, null, 2));
  await page.screenshot({ path: path.join(out, "world-notes-reclaim.png") });
  checks.push("Real Obsidian two-view draft handoff and explicit retry reclaim latest text; revoked input inert and native files unchanged");
};
