// Actual copy/discard controls and FileView transitions; owned synthetic terrain only.
module.exports = ({ page, fs, path, assert, qa, vault, out, checks }) => {
  const A = "Atlanten/Hex02 Alpha.overworld",
    B = "Atlanten/Hex02 Beta.overworld",
    proofPath = path.join(qa, "hex02-copy-baseline.json");
  const panel = () => page.locator(".dn-atlas:visible").last();
  const viewport = () => panel().locator(".dn-atlas-viewport");
  const button = (name) => panel().getByRole("button", { name, exact: true });
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  const bytes = (file) => fs.readFileSync(path.join(vault, file), "utf8");
  function files(file) {
    const raw = bytes(file),
      doc = JSON.parse(raw);
    return Object.fromEntries([
      [file, raw],
      ...doc.chunks.map((ref) => {
        const child = `Atlasdaten/${doc.id}/${ref.file}`;
        return [child, bytes(child)];
      }),
    ]);
  }
  async function state() {
    return page.evaluate(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return {
        file: v.file.path,
        world: v.editor.terrain.world,
        cells: v.editor.terrain.cells(),
        camera: v.editor.renderer.camera,
        depth: v.editor.terrain.history.undoDepth,
        dirty: v.repository.dirty,
        draft: v.repository.hasDraft,
      };
    });
  }
  async function open(file, count) {
    // Invoke real Obsidian file navigation/lifecycle; no repository or editing method injection.
    await page.evaluate(
      async (file) =>
        app.workspace
          .getLeaf(false)
          .openFile(app.vault.getAbstractFileByPath(file)),
      file,
    );
    await viewport().locator("canvas").waitFor({ state: "visible" });
    await page.waitForFunction(
      ({ file, count }) => {
        const v = app.workspace
          .getLeavesOfType("dungeon-native-atlas")
          .at(-1).view;
        return (
          v.file.path === file && v.editor?.terrain.cells().length === count
        );
      },
      { file, count },
    );
    await settle();
  }
  async function paint(q) {
    await button("Land malen").click();
    const p = await viewport().evaluate((el, q) => {
      const b = el.getBoundingClientRect();
      return {
        x:
          b.x +
          el.clientWidth / 2 +
          (q * 4828.032 - Number(el.dataset.centerX)) /
            Number(el.dataset.metersPerPixel),
        y:
          b.y +
          el.clientHeight / 2 -
          Number(el.dataset.centerY) / Number(el.dataset.metersPerPixel),
      };
    }, q);
    const old = await state();
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction((count) => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return v.editor.terrain.cells().length === count && v.repository.hasDraft;
    }, old.cells.length + 1);
    await settle();
  }
  async function menu(text) {
    await button("Atlas-Kartenmenü").click();
    await page.locator(".menu-item").filter({ hasText: text }).last().click();
  }
  async function copyDialog() {
    await menu("Speichern unter");
    const modal = page.locator(".modal").filter({
      has: page.getByRole("textbox", { name: "Kopiename", exact: true }),
    });
    await modal.waitFor({ state: "visible" });
    return modal;
  }
  async function discard(confirm) {
    await menu("Entwurf verwerfen");
    const modal = page
      .locator(".modal")
      .filter({ hasText: "Atlasentwurf verwerfen" });
    await modal.waitFor({ state: "visible" });
    await modal
      .getByRole("button", {
        name: confirm ? "Entwurf verwerfen" : "Abbrechen",
        exact: true,
      })
      .click();
    await settle();
  }
  async function edit() {
    const id = "hex02-copy-a",
      cells = [
        { q: -1, r: 0, surface: "land", terrain: "plain", color: "#dbc998" },
        { q: 0, r: 0, surface: "land", terrain: "forest", color: "#66866a" },
        { q: 1, r: 0, surface: "land", terrain: "plain", color: "#dbc998" },
      ],
      chunks = [
        { q: -1, r: 0, cells: cells.slice(0, 1) },
        { q: 0, r: 0, cells: cells.slice(1) },
      ];
    const world = {
      kind: "overworld",
      version: 1,
      id,
      name: "Hex02 Alpha",
      orientation: "pointy",
      origin: { x: 0, y: 0 },
      metersPerMile: 1609.344,
      minHexMiles: 3,
      levelFactor: 3,
      placements: [],
      chunks: chunks.map((c) => ({
        level: 0,
        q: c.q,
        r: c.r,
        file: `terrain/0_${c.q}_${c.r}.json`,
        cellCount: c.cells.length,
        extent: {
          minQ: c.cells[0].q,
          maxQ: c.cells.at(-1).q,
          minR: 0,
          maxR: 0,
        },
      })),
    };
    const seed = {
      [A]: JSON.stringify(world),
      ...Object.fromEntries(
        chunks.map((c) => [
          `Atlasdaten/${id}/terrain/0_${c.q}_${c.r}.json`,
          JSON.stringify({
            kind: "atlas-terrain",
            version: 1,
            worldId: id,
            level: 0,
            ...c,
          }),
        ]),
      ),
    };
    await page.evaluate(async (seed) => {
      for (const [file, text] of Object.entries(seed)) {
        const parts = file.split("/");
        parts.pop();
        let folder = "";
        for (const part of parts) {
          folder += (folder ? "/" : "") + part;
          if (!app.vault.getAbstractFileByPath(folder))
            await app.vault.createFolder(folder);
        }
        await app.vault.create(file, text);
      }
    }, seed);
    await open(A, 3);
    assert(!(await state()).dirty);
    await paint(2);
    const aDraft = bytes(A + ".draft"),
      aCanonical = files(A),
      aState = await state();
    let modal = await copyDialog();
    await modal
      .getByRole("textbox", { name: "Kopiename", exact: true })
      .fill("Hex02 Beta");
    await modal.getByRole("button", { name: "Abbrechen", exact: true }).click();
    assert.deepEqual(await state(), aState);
    assert.equal(bytes(A + ".draft"), aDraft);
    assert(!fs.existsSync(path.join(vault, B)));
    checks.push(
      "Actual SaveAs cancellation preserves source content, ID, camera, history and owned draft; creates no copy",
    );
    modal = await copyDialog();
    await modal
      .getByRole("textbox", { name: "Kopiename", exact: true })
      .fill("Hex02 Beta");
    await modal
      .getByRole("button", { name: "Kopie speichern", exact: true })
      .click({ noWaitAfter: true });
    await page.waitForFunction(
      () =>
        app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.file
          ?.path === "Atlanten/Hex02 Beta.overworld",
    );
    await open(B, 4);
    const b = await state();
    assert.notEqual(b.world.id, id);
    assert(!b.dirty && !b.draft);
    assert.equal(b.depth, 0);
    assert.deepEqual(files(A), aCanonical);
    assert.equal(bytes(A + ".draft"), aDraft);
    for (const ref of b.world.chunks)
      assert.equal(
        JSON.parse(bytes(`Atlasdaten/${b.world.id}/${ref.file}`)).worldId,
        b.world.id,
      );
    await page.screenshot({ path: path.join(out, "01-independent-copy.png") });
    checks.push(
      "Actual SaveAs captures unsaved four-cell content into new world ID and independent native terrain namespace, keeps source canonical/draft bytes exact",
    );
    const bSaved = files(B);
    await paint(3);
    const bDraft = bytes(B + ".draft");
    await open(A, 4);
    assert.equal((await state()).world.id, id);
    assert((await state()).draft);
    assert.equal((await state()).depth, 0);
    await button("Land malen").click();
    const color = panel().getByRole("textbox", {
      name: "Landfarbe",
      exact: true,
    });
    await color.fill("#aa6633");
    await color.press("Enter");
    const bounds = await viewport().boundingBox();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 30,
      bounds.y + bounds.height / 2 + 20,
    );
    await page.mouse.up({ button: "middle" });
    await settle();
    const beforeDiscard = await state();
    await discard(false);
    assert.deepEqual(await state(), beforeDiscard);
    assert.equal(bytes(A + ".draft"), aDraft);
    await discard(true);
    await page.waitForFunction(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return (
        !v.repository.dirty &&
        !v.repository.hasDraft &&
        v.editor.terrain.cells().length === 3
      );
    });
    await settle();
    const restored = await state();
    assert.deepEqual(restored.camera, beforeDiscard.camera);
    assert.equal(restored.world.id, id);
    assert.equal(restored.depth, 0);
    assert.equal(await color.inputValue(), "#aa6633");
    assert.equal(
      await button("Land malen").getAttribute("aria-pressed"),
      "true",
    );
    assert.deepEqual(files(A), aCanonical);
    assert.equal(bytes(B + ".draft"), bDraft);
    await page.screenshot({
      path: path.join(out, "02-discard-same-camera.png"),
    });
    await open(B, 5);
    assert.equal((await state()).world.id, b.world.id);
    assert((await state()).draft);
    assert.deepEqual(files(B), bSaved);
    await page.screenshot({
      path: path.join(out, "03-a-b-a-drafts-preserved.png"),
    });
    checks.push(
      "A↔B real FileView transitions restore each draft; discard Cancel keeps A, confirmed discard restores saved A in same camera/tool/color without touching B or saved bytes",
    );
    fs.writeFileSync(
      proofPath,
      JSON.stringify(
        { a: aCanonical, b: bSaved, bDraft, bId: b.world.id },
        null,
        2,
      ),
    );
  }
  async function reopen() {
    const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    await open(A, 3);
    assert(!(await state()).draft);
    assert.deepEqual(files(A), proof.a);
    await open(B, 5);
    assert((await state()).draft);
    assert.equal((await state()).depth, 0);
    assert.equal((await state()).world.id, proof.bId);
    assert.equal(bytes(B + ".draft"), proof.bDraft);
    assert.deepEqual(files(B), proof.b);
    await viewport().focus();
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return !v.repository.dirty && !v.repository.hasDraft;
    });
    assert.equal(
      JSON.parse(bytes(B)).chunks.reduce((n, r) => n + r.cellCount, 0),
      5,
    );
    assert.deepEqual(files(A), proof.a);
    await page.screenshot({
      path: path.join(out, "04-fresh-copy-draft-saved.png"),
    });
    checks.push(
      "Separate fresh process preserves discarded A and independent B draft/ID; actual CtrlS saves B's five cells while A stays byte-exact",
    );
  }
  return { edit, reopen };
};
