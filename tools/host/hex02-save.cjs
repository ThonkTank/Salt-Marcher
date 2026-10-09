// Durable island through the actual UI, isolated harness-owned vault only.
module.exports = ({ page, fs, path, assert, qa, vault, out, checks }) => {
  const WORLD = "Atlanten/Hex02 Insel.overworld",
    proofPath = path.join(qa, "hex02-save-baseline.json");
  let leafIndex = -1;
  const current = (locator) =>
    leafIndex < 0 ? locator.last() : locator.nth(leafIndex);
  const viewport = () => current(page.locator(".dn-atlas-viewport:visible"));
  const toolbar = () => current(page.locator(".dn-atlas-toolbar:visible"));
  const status = () => current(page.locator(".dn-atlas-save-status:visible"));
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  const bytes = (file) => fs.readFileSync(path.join(vault, file), "utf8");
  async function data() {
    return page.evaluate((index) => {
      const leaves = app.workspace.getLeavesOfType("dungeon-native-atlas"),
        v = (index < 0 ? leaves.at(-1) : leaves[index]).view;
      return {
        cells: v.editor.terrain.cells(),
        refs: v.editor.terrain.references(),
        dirty: v.repository.dirty,
        draft: v.repository.hasDraft,
        depth: v.editor.terrain.history.undoDepth,
      };
    }, leafIndex);
  }
  function savedFiles() {
    const raw = bytes(WORLD),
      doc = JSON.parse(raw);
    return Object.fromEntries([
      [WORLD, raw],
      ...doc.chunks.map((ref) => {
        const file = `Atlasdaten/${doc.id}/${ref.file}`;
        return [file, bytes(file)];
      }),
    ]);
  }
  async function paint(q, r) {
    await toolbar()
      .getByRole("button", { name: "Land malen", exact: true })
      .click();
    const s = await viewport().evaluate((el) => {
      const b = el.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        w: el.clientWidth,
        h: el.clientHeight,
        cx: +el.dataset.centerX,
        cy: +el.dataset.centerY,
        mpp: +el.dataset.metersPerPixel,
      };
    });
    const x = s.x + s.w / 2 + (4828.032 * (q + r / 2) - s.cx) / s.mpp,
      y = s.y + s.h / 2 + (((4828.032 * Math.sqrt(3)) / 2) * r - s.cy) / s.mpp;
    assert(
      x > s.x + 2 && x < s.x + s.w - 2 && y > s.y + 2 && y < s.y + s.h - 2,
      "Fixture hex visible",
    );
    const before = (await data()).depth;
    await page.mouse.click(x, y);
    await page.waitForFunction(
      ({ d, index }) => {
        const leaves = app.workspace.getLeavesOfType("dungeon-native-atlas"),
          v = (index < 0 ? leaves.at(-1) : leaves[index]).view;
        return (
          v.editor.terrain.history.undoDepth === d + 1 && v.repository.hasDraft
        );
      },
      { d: before, index: leafIndex },
    );
    await status().filter({ hasText: "Entwurf gesichert" }).waitFor();
    await settle();
  }
  async function save(keyboard = false) {
    if (keyboard) {
      await viewport().focus();
      await page.keyboard.press("Control+s");
    } else
      await toolbar()
        .getByRole("button", { name: "Atlas speichern", exact: true })
        .click();
    await page.waitForFunction(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return !v.repository.dirty && !v.repository.hasDraft;
    });
    await settle();
    assert.equal(await status().textContent(), "Gespeichert");
    assert(!fs.existsSync(path.join(vault, WORLD + ".draft")));
    assert(!fs.existsSync(path.join(vault, WORLD + ".journal")));
  }
  async function open() {
    await page.evaluate(async (file) => {
      await app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(file));
    }, WORLD);
    await viewport().locator("canvas").waitFor({ state: "visible" });
    await settle();
    await toolbar()
      .getByRole("button", { name: "Atlasinhalt einpassen", exact: true })
      .click();
    await settle();
  }
  async function edit() {
    const before = await data();
    assert.equal(before.cells.length, 36);
    assert(before.dirty);
    await save();
    assert.deepEqual((await data()).cells, before.cells);
    assert.equal(
      (await data()).depth,
      before.depth,
      "Save retains undo history",
    );
    const saved = savedFiles();
    assert.equal(JSON.parse(saved[WORLD]).chunks.length, 5);
    await page.screenshot({ path: path.join(out, "05-saved-island.png") });
    checks.push(
      "Visible Save commits all 36 terrain cells/five chunks and manifest, removes own draft/journal, preserves IDs/history",
    );
    // Open the second clean leaf before the first creates its owned draft.
    await page.evaluate(async (file) => {
      await app.workspace
        .getLeaf("split")
        .openFile(app.vault.getAbstractFileByPath(file));
    }, WORLD);
    leafIndex = 1;
    await viewport().locator("canvas").waitFor({ state: "visible" });
    await settle();
    await toolbar()
      .getByRole("button", { name: "Atlasinhalt einpassen", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        app.workspace
          .getLeavesOfType("dungeon-native-atlas")[1]
          .view.editor.terrain.cells().length === 36,
    );
    assert(!(await data()).dirty);
    leafIndex = 0;
    await toolbar()
      .getByRole("button", { name: "Atlasinhalt einpassen", exact: true })
      .click();
    await settle();
    await paint(0, 3);
    const draft = await data();
    assert.equal(draft.cells.length, 37);
    assert.deepEqual(savedFiles(), saved);
    const draftRaw = bytes(WORLD + ".draft");
    assert.equal(JSON.parse(draftRaw).baselineWorld, saved[WORLD]);
    await page.screenshot({
      path: path.join(out, "06-unsaved-durable-draft.png"),
    });
    leafIndex = 1;
    await toolbar()
      .getByRole("button", { name: "Atlas speichern", exact: true })
      .click();
    await status().filter({ hasText: "Extern geändert" }).waitFor();
    assert.deepEqual(savedFiles(), saved);
    assert.equal(bytes(WORLD + ".draft"), draftRaw);
    await page.screenshot({
      path: path.join(out, "07-second-leaf-protected-draft.png"),
    });
    assert.equal((await data()).cells.length, 36);
    assert(
      !(await data()).dirty,
      "Conflicted second leaf has no own changes to discard",
    );
    await page.evaluate(() => {
      app.workspace.getLeavesOfType("dungeon-native-atlas")[1].detach();
    });
    await page.waitForFunction(
      () => app.workspace.getLeavesOfType("dungeon-native-atlas").length === 1,
    );
    leafIndex = -1;
    await settle();
    assert.deepEqual(savedFiles(), saved);
    assert.equal(bytes(WORLD + ".draft"), draftRaw);
    fs.writeFileSync(
      proofPath,
      JSON.stringify(
        {
          saved,
          savedCells: before.cells,
          draftCells: draft.cells,
          draftRaw,
          worldId: JSON.parse(saved[WORLD]).id,
        },
        null,
        2,
      ),
    );
    checks.push(
      "Two native Atlas leaves use shared vault scope; clean second-leaf Save conflicts visibly and retains first leaf's 37-cell draft and all saved bytes; closing clean second leaf preserves owned draft",
    );
  }
  async function reopen() {
    const baseline = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    assert.deepEqual(savedFiles(), baseline.saved);
    assert.equal(bytes(WORLD + ".draft"), baseline.draftRaw);
    await open();
    await page.waitForFunction(
      (count) =>
        app.workspace
          .getLeavesOfType("dungeon-native-atlas")
          .at(-1)
          .view.editor.terrain.cells().length === count,
      baseline.draftCells.length,
    );
    const fresh = await data();
    assert.deepEqual(
      [...fresh.cells].sort((a, b) => a.q - b.q || a.r - b.r),
      [...baseline.draftCells].sort((a, b) => a.q - b.q || a.r - b.r),
    );
    assert(fresh.dirty && fresh.draft);
    assert.equal(
      fresh.depth,
      0,
      "Fresh draft does not pretend to restore undo history",
    );
    await page.screenshot({
      path: path.join(out, "01-fresh-restored-island.png"),
    });
    await save(true);
    const saved = savedFiles();
    checks.push(
      "Actual fresh process restores complete 37-cell draft/IDs; CtrlS commits it and removes draft/journal",
    );
    await paint(0, 4);
    const draftRaw = bytes(WORLD + ".draft");
    await page.evaluate((file) => {
      const store = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)
          .view.repository.store,
        original = store.compareAndWrite.bind(store);
      let once = true;
      store.compareAndWrite = async (p, b, a) => {
        if (p === file && once) {
          once = false;
          throw new Error("Native one-time write interruption");
        }
        return original(p, b, a);
      };
    }, WORLD);
    await toolbar()
      .getByRole("button", { name: "Atlas speichern", exact: true })
      .click();
    await status()
      .filter({ hasText: "Native one-time write interruption" })
      .waitFor();
    assert.deepEqual(savedFiles(), saved);
    assert.equal(bytes(WORLD + ".draft"), draftRaw);
    assert(!fs.existsSync(path.join(vault, WORLD + ".journal")));
    await page.screenshot({
      path: path.join(out, "02-save-interruption-draft-retained.png"),
    });
    checks.push(
      "Native UI Save interrupted after terrain write: rollback retains exact saved scene and complete draft, no journal leftover",
    );
    await page.evaluate(async (file) => {
      await app.vault.process(app.vault.getAbstractFileByPath(file), (raw) => {
        const d = JSON.parse(raw);
        d.name += " extern";
        return JSON.stringify(d, null, 2) + "\n";
      });
    }, WORLD);
    const external = savedFiles();
    await toolbar()
      .getByRole("button", { name: "Atlas speichern", exact: true })
      .click();
    await status().filter({ hasText: "Extern geändert" }).waitFor();
    assert.deepEqual(savedFiles(), external);
    assert.equal(bytes(WORLD + ".draft"), draftRaw);
    await page.screenshot({
      path: path.join(out, "03-external-conflict-both-states-retained.png"),
    });
    fs.writeFileSync(
      path.join(qa, "hex02-conflict-baseline.json"),
      JSON.stringify({ files: external, draftRaw }, null, 2),
    );
    checks.push(
      "External valid world edit conflicts visibly; external world/terrain and local durable draft remain byte-exact",
    );
  }
  async function reopenConflict() {
    const baseline = JSON.parse(
      fs.readFileSync(path.join(qa, "hex02-conflict-baseline.json"), "utf8"),
    );
    await page.evaluate(async (file) => {
      await app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(file));
    }, WORLD);
    await page
      .locator(".view-content:visible")
      .filter({ hasText: "Atlas konnte nicht geöffnet werden." })
      .last()
      .waitFor();
    assert.deepEqual(savedFiles(), baseline.files);
    assert.equal(bytes(WORLD + ".draft"), baseline.draftRaw);
    await page.screenshot({
      path: path.join(out, "01-fresh-conflict-preserved.png"),
    });
    checks.push(
      "Separate fresh process refuses conflicting draft visibly and preserves both external saved files and protected local draft",
    );
  }
  return { edit, reopen, reopenConflict };
};
