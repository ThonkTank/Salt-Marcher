// One real isolated Obsidian process; synthetic picker/key input, no physical acceptance.
module.exports = ({ page, fs, path, assert, crypto, root, vault, out, checks }) => async () => {
  const aRoot = path.join(root, "tests/fixtures/atlas-e2e-spatial-v2");
  const bRoot = path.join(root, "tests/fixtures/atlas-e2e-campaign-b-v1");
  const a = JSON.parse(fs.readFileSync(path.join(aRoot, "manifest.json"), "utf8"));
  const b = JSON.parse(fs.readFileSync(path.join(bRoot, "manifest.json"), "utf8"));
  const aRuntime = JSON.parse(fs.readFileSync(path.join(aRoot, a.campaign.input.fixtureFile), "utf8"));
  const aid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const panel = () => page.locator(".dn-atlas-canvas-host > .dn-atlas");
  const key = () => panel().locator(".dn-location-key:not(.dn-atlas-room-key)");
  const picker = (name) => page.locator(".dn-campaign-entry li").filter({ hasText: name }).getByRole("button");
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const snapshots = [];
  async function snapshot(label) {
    const value = await page.evaluate(() => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      const s = v.campaignHost.state;
      if (s.kind !== "active") return { kind: s.kind, reason: s.reason };
      s.assertCurrent();
      const refs = window.__hexABA.refs;
      return { kind: s.kind, managed: v.managed, campaignId: s.context.campaignId,
        token: s.context.contextToken, generation: s.generation, worldId: s.inventory.worldId,
        worldName: v.editor.terrain.world.name, records: s.inventory.records.length,
        registryRevision: s.projection.registryRevision, inventoryRevision: s.inventory.registryRevision,
        repositoryMatches: s.repository === v.repository, historyMatches: s.history === v.editor.terrain.history,
        rendererMatches: s.renderer === v.editor.renderer, camera: v.editor.renderer.camera,
        depth: s.history.undoDepth, dirty: s.repository.dirty, draft: s.repository.hasDraft,
        previous: refs.map((p) => ({ sameToken: p.state.context.contextToken === s.context.contextToken,
          sameRepository: p.state.repository === s.repository, sameHistory: p.state.history === s.history,
          sameRenderer: p.state.renderer === s.renderer, sameSource: p.editor.terrain === v.editor.terrain })),
        retainedDraftCount: v.campaigns.retainedDrafts.length,
        canvasCount: v.contentEl.querySelectorAll(".dn-atlas-canvas-host > .dn-atlas").length };
    });
    assert.equal(value.kind, "active", value.reason);
    for (const k of ["managed", "repositoryMatches", "historyMatches", "rendererMatches"]) assert.equal(value[k], true, k);
    assert.equal(value.registryRevision, value.inventoryRevision);
    assert.equal(value.canvasCount, 1);
    snapshots.push({ label, ...value });
    fs.writeFileSync(path.join(out, "campaign-aba.json"), JSON.stringify(snapshots, null, 2));
    return value;
  }
  async function remember() {
    await page.evaluate(() => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      window.__hexABA.refs.push({ state: v.campaignHost.state, editor: v.editor,
        callback: v.editor.storage.navigation.navigate });
    });
  }
  async function location(id) {
    await page.evaluate(async (id) => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      await v.campaignHost.navigate({ kind: "location", documentId: id, recordId: id, roomId: null });
    }, id);
    await key().getByRole("textbox", { name: "Ortsname", exact: true }).waitFor();
    await settle();
  }
  async function switched(id) {
    await page.waitForFunction((id) => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      return v.campaignHost.state.kind === "active" && v.campaignHost.state.context.campaignId === id && !!v.editor;
    }, id);
    await panel().locator("canvas").waitFor({ state: "visible" });
    await settle();
  }
  await page.evaluate(async (file) => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), a.input[0].path);
  await panel().locator("canvas").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__hexABA = { refs: [] }; });
  const first = await snapshot("A1 initial");
  assert.equal(first.campaignId, aid(1));
  await remember();
  await location(aid(11));
  const field = () => key().getByRole("textbox", { name: "Ortsname", exact: true });
  await field().fill("");
  await picker(b.initialOracle.picker.label).click();
  await page.locator(".dn-campaign-active-error").waitFor({ state: "visible" });
  assert.equal(await field().inputValue(), "");
  const blocked = await snapshot("Invalid A key blocks actual picker activation");
  assert.equal(blocked.token, first.token);
  assert.equal(blocked.previous[0].sameRepository, true);
  checks.push("Actual picker cannot leave invalid A Key; same Context/Repository/History/Renderer and text remain");

  const aDraft = "A – Entwurf bleibt in seinem Atlas";
  await field().fill(aDraft);
  // Delay only the delivery of an actual native capture; never synthesize its payload/authority.
  await page.evaluate((id) => {
    const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
    const p = window.__hexABA, repo = v.repository, capture = repo.captureNative;
    let release;
    const gate = new Promise((r) => { release = r; });
    p.release = release;
    repo.captureNative = async function (...args) {
      const actual = await capture.apply(this, args);
      repo.captureNative = capture; p.captureReady = true;
      await gate; return actual;
    };
    p.late = v.campaignHost.navigate({ kind: "location", documentId: id, recordId: id, roomId: null })
      .then(() => ({ resolved: true }), (e) => ({ rejected: String(e) }));
  }, aid(12));
  await page.waitForFunction(() => window.__hexABA.captureReady);
  await picker(b.initialOracle.picker.label).click();
  await switched(b.initialOracle.campaignId);
  const second = await snapshot("B fresh activation");
  assert.equal(second.worldId, b.initialOracle.worldId);
  assert.equal(second.worldName, b.initialOracle.worldName);
  assert.equal(second.records, b.initialOracle.inventoryRecordCount);
  assert.equal(second.depth, 0);
  for (const value of Object.values(second.previous[0])) assert.equal(value, false);
  await remember();
  const obsolete = await page.evaluate(async (id) => {
    const p = window.__hexABA, old = p.refs[0];
    const failures = {};
    for (const [name, call] of Object.entries({ lease: () => old.state.assertCurrent(),
      undo: () => old.state.history.undo(), redo: () => old.state.history.redo(),
      callback: () => old.callback({ kind: "location", documentId: id, recordId: id, roomId: null }) })) {
      try { await call(); failures[name] = null; } catch (e) { failures[name] = String(e); }
    }
    p.release(); failures.lateReply = (await p.late).rejected ?? null;
    return failures;
  }, aid(12));
  for (const [name, value] of Object.entries(obsolete)) assert.ok(value, name + " must be rejected");
  fs.writeFileSync(path.join(out, "obsolete-a.json"), JSON.stringify(obsolete, null, 2));
  const untouchedB = await snapshot("B after obsolete A callbacks and delayed native reply");
  assert.equal(untouchedB.token, second.token);
  assert.equal(untouchedB.depth, second.depth);
  assert.deepEqual(untouchedB.camera, second.camera);
  assert.ok(untouchedB.retainedDraftCount >= 1);
  checks.push("B has independent Context/Repository/Source/History/Renderer; old A lease, Undo/Redo, callback and late native reply are rejected without B camera/history effects");

  await location(b.initialOracle.locationIds[0]);
  assert.equal(await field().inputValue(), b.initialOracle.locationNames[0]);
  const bDraft = "B – eigener Ortsentwurf";
  await field().fill(bDraft);
  await key().getByRole("button", { name: "Übernehmen", exact: true }).click();
  await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.flush());
  const editedB = await snapshot("B independent editable Key");
  assert.ok(editedB.depth > 0);
  const toolbar = () => panel().locator(".dn-atlas-toolbar");
  await toolbar().getByRole("button", { name: "Atlasänderung rückgängig", exact: true }).click();
  await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.flush());
  assert.equal(await field().inputValue(), b.initialOracle.locationNames[0]);
  await toolbar().getByRole("button", { name: "Atlasänderung wiederholen", exact: true }).click();
  await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.flush());
  assert.equal(await field().inputValue(), bDraft);
  checks.push("B actual native Key edit and its own Undo/Redo operate on independently supplied B contents");
  await picker(aRuntime.snapshot.name).click();
  await switched(aid(1));
  const third = await snapshot("A2 fresh activation with retained draft");
  for (const previous of third.previous) for (const value of Object.values(previous)) assert.equal(value, false);
  assert.ok(third.retainedDraftCount >= 2);
  await location(aid(11));
  assert.equal(await field().inputValue(), aDraft);
  const retained = await page.evaluate(({ aId, bId }) => {
    const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
    const p = window.__hexABA;
    return { a: p.refs[0].state.repository.location(aId).read().name,
      b: p.refs[1].state.repository.location(bId).read().name,
      activeA: v.repository.location(aId).read().name };
  }, { aId: aid(11), bId: b.initialOracle.locationIds[0] });
  assert.deepEqual(retained, { a: aDraft, b: bDraft, activeA: aDraft });
  fs.writeFileSync(path.join(out, "retained-drafts.json"), JSON.stringify(retained, null, 2));
  checks.push("Actual picker A→B→A remounts fresh identities and restores A durable draft; both old campaigns retain separate unsaved Key contents");
  const nativeBytes = [];
  for (const [fixture, rows] of [[aRoot, [...a.input, { path: a.campaign.path, ...a.campaign.input }]], [bRoot, [...b.input, b.campaign]]]) {
    for (const row of rows) {
      const actual = fs.readFileSync(path.join(vault, row.path));
      assert.deepEqual(actual, fs.readFileSync(path.join(fixture, row.fixtureFile)), row.path);
      nativeBytes.push({ path: row.path, bytes: actual.length, sha256: crypto.createHash("sha256").update(actual).digest("hex") });
    }
  }
  fs.writeFileSync(path.join(out, "native-input-bytes.json"), JSON.stringify(nativeBytes, null, 2));
  checks.push("All sixteen confirmed A/B native and Campaign input files remain byte-exact; navigation stores drafts without publishing a new saved baseline");
  await page.screenshot({ path: path.join(out, "actual-picker-aba.png") });
};
