// Real Obsidian Campaign A→B→A→B with two unsaved World Notes drafts.
module.exports = ({ page, fs, path, assert, crypto, root, vault, out, checks }) => async () => {
  const aRoot = path.join(root, "tests/fixtures/atlas-e2e-spatial-v2");
  const bRoot = path.join(root, "tests/fixtures/atlas-e2e-campaign-b-v1");
  const a = JSON.parse(fs.readFileSync(path.join(aRoot, "manifest.json"), "utf8"));
  const b = JSON.parse(fs.readFileSync(path.join(bRoot, "manifest.json"), "utf8"));
  const aRuntime = JSON.parse(fs.readFileSync(path.join(aRoot, a.campaign.input.fixtureFile), "utf8"));
  const aName = aRuntime.snapshot.name;
  const bName = b.initialOracle.picker.label;
  const atlas = () => page.locator(".dn-atlas-host");
  const notes = () => page.locator(".dn-world-notes:visible");
  const picker = (name) => atlas().locator(".dn-atlas-campaign-dock .dn-campaign-entry li")
    .filter({ hasText: name }).getByRole("button");
  const formName = () => notes().locator("form label").filter({ hasText: "Name" }).locator("input");
  async function active(campaignId) {
    await page.waitForFunction((id) => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view;
      const notesView = app.workspace.getLeavesOfType("dungeon-world-notes").at(-1)?.view;
      return v?.campaignHost.state.kind === "active" && v.campaignHost.state.context.campaignId === id &&
        notesView?.mountedContext?.campaignId === id && notesView.panel?.root?.hidden === false;
    }, campaignId);
    await notes().waitFor();
    const value = await page.evaluate(() => {
      const atlasView = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      const notesView = app.workspace.getLeavesOfType("dungeon-world-notes").at(-1).view;
      return { campaignId: atlasView.campaignHost.state.context.campaignId,
        atlasToken: atlasView.campaignHost.state.context.contextToken,
        notesToken: notesView.mountedContext?.contextToken ?? null };
    });
    assert.equal(value.campaignId, campaignId);
    return value;
  }
  await page.evaluate(async (file) => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), a.input[0].path);
  await atlas().locator(".dn-atlas-canvas-host canvas").waitFor({ state: "visible" });
  await page.evaluate(() => app.commands.executeCommandById("dungeon-editor:open-world-notes"));
  await notes().waitFor();
  const aFirst = await active(aRuntime.snapshot.campaignId);
  await notes().getByRole("button", { name: "NPC anlegen" }).click();
  await formName().fill("A – ungespeicherter Weltwissenentwurf");
  await picker(bName).click();
  const bFirst = await active(b.initialOracle.campaignId);
  assert.equal(await notes().locator("form").count(), 0);
  await notes().getByRole("button", { name: "Quest anlegen" }).click();
  await formName().fill("B – ungespeicherter Weltwissenentwurf");
  await picker(aName).click();
  const aSecond = await active(aFirst.campaignId);
  assert.equal(await formName().inputValue(), "A – ungespeicherter Weltwissenentwurf");
  assert.notEqual(aSecond.atlasToken, aFirst.atlasToken);
  await picker(bName).click();
  const bSecond = await active(bFirst.campaignId);
  assert.equal(await formName().inputValue(), "B – ungespeicherter Weltwissenentwurf");
  assert.notEqual(bSecond.atlasToken, bFirst.atlasToken);
  const bytes = [];
  for (const [fixture, rows] of [[aRoot, [...a.input, { path: a.campaign.path, ...a.campaign.input }]],
    [bRoot, [...b.input, b.campaign]]]) {
    for (const row of rows) {
      const actual = fs.readFileSync(path.join(vault, row.path));
      assert.deepEqual(actual, fs.readFileSync(path.join(fixture, row.fixtureFile)), row.path);
      bytes.push({ path: row.path, sha256: crypto.createHash("sha256").update(actual).digest("hex") });
    }
  }
  fs.writeFileSync(path.join(out, "world-notes-drafts.json"), JSON.stringify({ aFirst, bFirst, aSecond, bSecond, bytes }, null, 2));
  await page.screenshot({ path: path.join(out, "world-notes-drafts.png") });
  checks.push("Real Obsidian A→B→A→B retains two separate unsaved World Notes forms; all native inputs remain byte exact");
};
