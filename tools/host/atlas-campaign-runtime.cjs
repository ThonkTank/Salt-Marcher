// Real isolated Obsidian Campaign Host. Synthetic input; no physical acceptance.
module.exports = (context) => {
  const { page, fs, path, assert, root, vault, out, checks, restart } = context;
  const fixture = path.join(root, "tests/fixtures/atlas-e2e-spatial-v2");
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, "manifest.json"), "utf8"));
  const journalPath = manifest.input[0].path + ".journal";
  const cityPath = manifest.input.find((row) => row.path.endsWith(".city")).path;
  const button = () => page.locator(".dn-atlas:visible").last()
    .locator(".dn-atlas-toolbar").getByRole("button", { name: "Atlas speichern", exact: true });
  function exactCampaign(group) {
    assert.equal(fs.readFileSync(path.join(vault, manifest.campaign.path), "utf8"),
      fs.readFileSync(path.join(fixture, manifest.campaign[group].fixtureFile), "utf8"));
  }
  async function membership() {
    const state = await page.evaluate(() => {
      const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      const active = view.campaignHost.state;
      if (active.kind !== "active") return { kind: active.kind, reason: active.reason };
      active.assertCurrent();
      return { kind: active.kind, managed: view.managed,
        campaignId: active.context.campaignId, token: active.context.contextToken,
        generation: active.generation, registryRevision: active.projection.registryRevision,
        inventoryRevision: active.inventory.registryRevision,
        repositoryMatches: view.repository === active.repository,
        historyMatches: view.editor.terrain.history === active.history,
        rendererMatches: view.editor.renderer === active.renderer };
    });
    assert.equal(state.kind, "active");
    assert.equal(state.managed, true);
    assert.equal(state.campaignId, "00000000-0000-4000-8000-000000000001");
    assert.equal(state.repositoryMatches, true);
    assert.equal(state.historyMatches, true);
    assert.equal(state.rendererMatches, true);
    assert.equal(state.inventoryRevision, state.registryRevision);
    return state;
  }
  async function identity() {
    const current = await page.evaluate(() => {
      const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      const active = view.campaignHost.state, before = window.__hexCampaignProbe;
      if (active.kind !== "active") return { kind: active.kind };
      active.assertCurrent();
      return { kind: active.kind,
        sameRepository: active.repository === before.repository,
        sameHistory: active.history === before.history,
        sameRenderer: active.renderer === before.renderer,
        sameSource: view.editor.terrain === before.source,
        sameToken: active.context.contextToken === before.token,
        sameGeneration: active.generation === before.generation,
        depth: active.history.undoDepth, camera: view.editor.renderer.camera,
        dirty: active.repository.dirty, draft: active.repository.hasDraft,
        registryRevision: active.projection.registryRevision,
        transactions: before.transactions, failures: before.failures };
    });
    assert.equal(current.kind, "active");
    for (const key of ["sameRepository", "sameHistory", "sameRenderer", "sameSource", "sameToken", "sameGeneration"])
      assert.equal(current[key], true, key);
    return current;
  }
  let before;
  return require("./atlas-spatial.cjs")({ ...context,
    afterOpen: async () => {
      exactCampaign(restart ? "expected" : "input");
      const actual = await membership();
      fs.writeFileSync(path.join(out, "campaign-membership.json"), JSON.stringify(actual, null, 2));
      checks.push("Actual Campaign manifest mounts its confirmed native repository/history/renderer");
    },
    beforeSave: async () => {
      before = await membership();
      await page.evaluate(({ cityPath, journalPath }) => {
        const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
        const active = view.campaignHost.state;
        const probe = window.__hexCampaignProbe = {
          repository: active.repository, history: active.history, renderer: active.renderer,
          source: view.editor.terrain, token: active.context.contextToken,
          generation: active.generation, transactions: [], failures: 0,
          process: app.vault.process, create: app.vault.create };
        const observe = (file, bytes) => {
          if (file === journalPath && bytes) {
            const journal = JSON.parse(bytes);
            if (journal.state === "prepared") probe.transactions.push(journal.transactionId);
          }
        };
        app.vault.create = async function(file, bytes, ...args) {
          observe(file, bytes);
          return probe.create.call(this, file, bytes, ...args);
        };
        app.vault.process = async function(file, change, ...args) {
          if (file.path === cityPath && !probe.failures) {
            probe.failures++;
            throw new Error("HEX-H01 controlled first native CAS failure");
          }
          return probe.process.call(this, file, (bytes) => {
            const after = change(bytes); observe(file.path, after); return after;
          }, ...args);
        };
      }, { cityPath, journalPath });
      const initial = await identity();
      await button().click();
      await page.waitForFunction(() => window.__hexCampaignProbe.failures === 1);
      await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.flush());
      const rolledBack = await identity();
      assert.equal(rolledBack.dirty, true);
      assert.equal(rolledBack.draft, true);
      assert.equal(rolledBack.depth, initial.depth);
      assert.deepEqual(rolledBack.camera, initial.camera);
      assert.equal(rolledBack.registryRevision, before.registryRevision);
      assert.equal(fs.existsSync(path.join(vault, journalPath)), false);
      for (const row of manifest.input)
        assert.equal(fs.readFileSync(path.join(vault, row.path), "utf8"),
          fs.readFileSync(path.join(fixture, row.fixtureFile), "utf8"), row.path);
      exactCampaign("input");
      fs.writeFileSync(path.join(out, "actual-rollback.json"), JSON.stringify(rolledBack, null, 2));
      checks.push("Actual first-native CAS failure restores every Before byte and removes journal without remount/history loss");
      before = { ...before, depth: initial.depth, camera: initial.camera };
    },
    afterSave: async () => {
      const saved = await identity();
      assert.equal(saved.dirty, false);
      assert.equal(saved.draft, false);
      assert.equal(saved.depth, before.depth);
      assert.deepEqual(saved.camera, before.camera);
      assert.notEqual(saved.registryRevision, before.registryRevision);
      assert.equal(new Set(saved.transactions).size, 2);
      assert.equal(fs.existsSync(path.join(vault, journalPath)), false);
      exactCampaign("expected");
      await membership();
      await page.evaluate(() => {
        const probe = window.__hexCampaignProbe;
        app.vault.process = probe.process; app.vault.create = probe.create;
      });
      // The actual toolbar remains usable after refresh; a no-op Save must not issue a new revision.
      await button().click();
      await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.flush());
      assert.equal((await identity()).registryRevision, saved.registryRevision);
      fs.writeFileSync(path.join(out, "actual-save-refresh.json"), JSON.stringify(saved, null, 2));
      checks.push("Retry has a new transaction UUID; exact Campaign After bytes and same camera/history/mount remain usable after Save");
    },
  });
};
