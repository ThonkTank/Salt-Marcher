// Native P1 repair proof. Only owned fixtures and a delayed actual VaultStore write.
module.exports = ({ page, fs, path, assert, qa, vault, out, checks }) => {
  const A = "Atlanten/Reparatur Quelle.overworld",
    B = "Atlanten/Reparatur Kopie.overworld",
    C = "Atlanten/Reparatur Andere.overworld",
    R = "Atlanten/Unterbrochen.overworld",
    K = "Atlanten/Abgeschlossen.overworld",
    F = "Atlanten/Fremde Kopie.overworld";
  const evidence = path.join(qa, "hex02-copy-repair.json");
  const read = (p) => fs.readFileSync(path.join(vault, p), "utf8");
  const panel = () => page.locator(".dn-atlas:visible").last();
  const modal = () =>
    page
      .locator(".modal")
      .filter({
        has: page.getByRole("textbox", { name: "Kopiename", exact: true }),
      });
  async function settle() {
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  }
  async function open(file, count) {
    await page.evaluate(
      (file) =>
        app.workspace
          .getLeaf(false)
          .openFile(app.vault.getAbstractFileByPath(file)),
      file,
    );
    await panel().locator("canvas").waitFor({ state: "visible" });
    await page.waitForFunction(
      ({ file, count }) => {
        const v = app.workspace
          .getLeavesOfType("dungeon-native-atlas")
          .at(-1)?.view;
        return (
          v?.file?.path === file && v.editor?.terrain.cells().length === count
        );
      },
      { file, count },
    );
    await settle();
  }
  async function dialog(name) {
    await page.evaluate((expected) => {
      if (app.vault.adapter.basePath !== expected)
        throw new Error("Wrong QA vault");
      app.setting.close();
      window.electron.remote.getCurrentWindow().focus();
    }, vault);
    await page.waitForFunction(() => activeWindow === window);
    await panel()
      .getByRole("button", { name: "Atlas-Kartenmenü", exact: true })
      .click();
    await page
      .locator(".menu-item")
      .filter({ hasText: "Speichern unter" })
      .last()
      .click();
    await modal().waitFor({ state: "visible" });
    await modal()
      .getByRole("textbox", { name: "Kopiename", exact: true })
      .fill(name);
  }
  async function put(files) {
    await page.evaluate(async (files) => {
      for (const [file, text] of Object.entries(files)) {
        if (
          app.vault.getAbstractFileByPath(file) ||
          (await app.vault.adapter.exists(file))
        )
          throw new Error("Fixture already exists: " + file);
        const parts = file.split("/");
        parts.pop();
        let folder = "";
        for (const part of parts) {
          folder = folder ? folder + "/" + part : part;
          if (!(await app.vault.adapter.exists(folder)))
            await app.vault.createFolder(folder);
        }
        await app.vault.create(file, text);
      }
    }, files);
  }
  function world(id, name, cells = []) {
    const grouped = new Map();
    for (const cell of cells) {
      const q = Math.floor(cell.q / 32),
        r = Math.floor(cell.r / 32),
        key = `${q}_${r}`;
      if (!grouped.has(key)) grouped.set(key, { q, r, cells: [] });
      grouped.get(key).cells.push(cell);
    }
    const chunks = [...grouped.values()],
      files = {};
    const doc = {
      kind: "overworld",
      version: 1,
      id,
      name,
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
          minQ: Math.min(...c.cells.map((c) => c.q)),
          maxQ: Math.max(...c.cells.map((c) => c.q)),
          minR: Math.min(...c.cells.map((c) => c.r)),
          maxR: Math.max(...c.cells.map((c) => c.r)),
        },
      })),
    };
    for (const c of chunks)
      files[`Atlasdaten/${id}/terrain/0_${c.q}_${c.r}.json`] = JSON.stringify({
        kind: "atlas-terrain",
        version: 1,
        worldId: id,
        level: 0,
        ...c,
      });
    return { doc, files };
  }
  function interrupted(file, id, state, cells) {
    const f = world(id, path.basename(file, ".overworld"), cells),
      writes = [
        ...Object.entries(f.files).map(([path, after]) => ({
          path,
          before: null,
          after,
        })),
        { path: file, before: null, after: JSON.stringify(f.doc) },
      ];
    const journal = {
      kind: "atlas-file-transaction",
      version: 1,
      journalPath: file + ".journal",
      transactionId: "12345678-1234-1234-1234-123456789abc",
      state,
      writes,
    };
    return { journal, writes };
  }
  async function edit() {
    const cells = [-1, 0, 1].map((q) => ({
      q,
      r: 0,
      surface: "land",
      terrain: "plain",
      color: "#dbc998",
    }));
    const source = world("repair-source", "Reparatur Quelle", cells),
      other = world("repair-other", "Reparatur Andere");
    const protectedFiles = {
      [A]: JSON.stringify(source.doc),
      ...source.files,
      [C]: JSON.stringify(other.doc),
    };
    await put(protectedFiles);
    await open(A, 3);
    await dialog("Reparatur Kopie");
    await modal()
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    assert.equal(fs.existsSync(path.join(vault, B)), false);
    await page.evaluate((B) => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      const store = v.repository.store,
        original = store.compareAndWrite.bind(store);
      window.__copyRepair = { reached: false };
      store.compareAndWrite = async (p, b, a) => {
        await original(p, b, a);
        if (p === B + ".journal" && a && JSON.parse(a).state === "prepared") {
          window.__copyRepair.reached = true;
          await new Promise((r) => {
            window.__copyRepair.release = r;
          });
        }
      };
    }, B);
    await dialog("Reparatur Kopie");
    await modal()
      .getByRole("button", { name: "Kopie speichern", exact: true })
      .click();
    await page.waitForFunction(() => window.__copyRepair.reached);
    assert.equal(
      await modal()
        .getByRole("button", { name: "Abbrechen", exact: true })
        .isDisabled(),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await modal().isVisible(), true);
    await modal()
      .locator(".modal-header-button, .modal-close-button")
      .first()
      .click({ force: true });
    assert.equal(await modal().isVisible(), true);
    const box = await modal().boundingBox();
    assert(box.x > 15 || box.y > 15);
    await page.mouse.click(8, 8);
    assert.equal(await modal().isVisible(), true);
    await page.screenshot({
      path: path.join(out, "01-copy-busy-dismiss-locked.png"),
    });
    // Real FileView navigation increments generation before the delayed write resolves.
    await page.evaluate((C) => {
      window.__copyRepair.switching = app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(C));
    }, C);
    await page.evaluate(() => window.__copyRepair.release());
    await modal().waitFor({ state: "hidden" });
    await page.evaluate(() => window.__copyRepair.switching);
    await open(C, 0);
    await page.waitForFunction(() =>
      document.body.innerText.includes("Reparatur Kopie“ ist gespeichert"),
    );
    assert.equal(JSON.parse(read(B)).chunks.length, 2);
    for (const [p, b] of Object.entries(protectedFiles))
      assert.equal(read(p), b, p);
    await page.screenshot({
      path: path.join(out, "02-copy-source-switch-completed.png"),
    });
    checks.push(
      "Native accepted Copy ignores Escape/X/outside click, disables Cancel/name and remains visible; source switch prevents late Open and reports successful named copy",
    );
    await open(A, 3);
    await dialog("Reparatur Kopie");
    await modal()
      .getByRole("button", { name: "Kopie speichern", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('.modal [role="status"]')
        ?.textContent.includes("bereits vorhanden"),
    );
    assert.equal(
      await modal()
        .getByRole("textbox", { name: "Kopiename", exact: true })
        .inputValue(),
      "Reparatur Kopie",
    );
    assert.equal(
      await modal()
        .getByRole("button", { name: "Kopie speichern", exact: true })
        .isEnabled(),
      true,
    );
    await page.screenshot({
      path: path.join(out, "03-copy-error-name-retained.png"),
    });
    await modal()
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    const prepared = interrupted(R, "repair-incomplete", "prepared", cells),
      committed = interrupted(K, "repair-committed", "committed", cells),
      foreign = interrupted(F, "repair-foreign", "prepared", cells);
    foreign.journal.writes.push({ path: C, before: null, after: read(C) });
    const fixtures = {
      [R + ".journal"]: JSON.stringify(prepared.journal),
      [prepared.writes[0].path]: prepared.writes[0].after,
      [K + ".journal"]: JSON.stringify(committed.journal),
      ...Object.fromEntries(committed.writes.map((w) => [w.path, w.after])),
      [F + ".journal"]: JSON.stringify(foreign.journal),
    };
    await put(fixtures);
    const proof = {
      protectedFiles,
      prepared,
      committed,
      foreign,
      fixtures,
      copy: read(B),
    };
    fs.writeFileSync(evidence, JSON.stringify(proof, null, 2));
    assert.equal(fs.existsSync(path.join(vault, R)), false);
    checks.push(
      "Native collision restores controls/name; fresh recovery fixture has only prepared journal and first own child, no root; committed and foreign closures separately seeded",
    );
  }
  async function reopen() {
    const proof = JSON.parse(fs.readFileSync(evidence, "utf8"));
    for (const [p, b] of Object.entries(proof.protectedFiles))
      assert.equal(read(p), b, p);
    await open(A, 3);
    assert.equal(fs.existsSync(path.join(vault, R)), false);
    await dialog("Unterbrochen");
    await modal()
      .getByRole("button", {
        name: "Unterbrochene Kopie wiederherstellen",
        exact: true,
      })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('.modal [role="status"]')
        ?.textContent.includes("zurückgenommen"),
    );
    assert.equal(fs.existsSync(path.join(vault, R + ".journal")), false);
    for (const w of proof.prepared.writes)
      assert.equal(fs.existsSync(path.join(vault, w.path)), false);
    await page.screenshot({
      path: path.join(out, "04-fresh-missing-root-recovered.png"),
    });
    await modal()
      .getByRole("button", { name: "Kopie speichern", exact: true })
      .click();
    await modal().waitFor({ state: "hidden" });
    await open(R, 3);
    assert.notEqual(JSON.parse(read(R)).id, "repair-incomplete");
    checks.push(
      "Fresh native process explicitly recovers missing-root prepared Copy through named dialog; removes only own partial files and allows successful retry",
    );
    await open(A, 3);
    await dialog("Abgeschlossen");
    await modal()
      .getByRole("button", {
        name: "Unterbrochene Kopie wiederherstellen",
        exact: true,
      })
      .click();
    await modal().waitFor({ state: "hidden" });
    await open(K, 3);
    assert.equal(fs.existsSync(path.join(vault, K + ".journal")), false);
    for (const w of proof.committed.writes) assert.equal(read(w.path), w.after);
    await page.screenshot({
      path: path.join(out, "05-fresh-committed-copy-retained.png"),
    });
    await open(A, 3);
    await dialog("Fremde Kopie");
    await modal()
      .getByRole("button", {
        name: "Unterbrochene Kopie wiederherstellen",
        exact: true,
      })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('.modal [role="status"]')
        ?.textContent.includes("Dateien bleiben erhalten"),
    );
    assert.equal(read(F + ".journal"), proof.fixtures[F + ".journal"]);
    for (const [p, b] of Object.entries(proof.protectedFiles))
      assert.equal(read(p), b, p);
    assert.equal(read(B), proof.copy);
    assert.equal(fs.existsSync(path.join(vault, F)), false);
    await page.screenshot({
      path: path.join(out, "06-foreign-journal-preserved.png"),
    });
    await modal()
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    checks.push(
      "Fresh committed recovery keeps exact complete target; foreign journal rejected visibly with exact source, other map and original successful Copy bytes unchanged",
    );
  }
  return { edit, reopen };
};
