// Native FileView/UI probe in an owned isolated vault. Synthetic input, not physical acceptance.
module.exports = ({ page, fs, path, assert, qa, vault, out, checks }) => {
  const A = "Atlanten/Hex03 Welt.overworld",
    B = "Atlanten/Hex03 Kopie.overworld";
  const proofPath = path.join(qa, "hex03-location-baseline.json");
  const panel = () => page.locator(".dn-atlas:visible").last();
  const viewport = () => panel().locator(".dn-atlas-viewport");
  const key = () => panel().locator(".dn-location-key:visible");
  const button = (name) => panel().getByRole("button", { name, exact: true });
  const bytes = (file) => fs.readFileSync(path.join(vault, file), "utf8");
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  async function state() {
    return page.evaluate(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return {
        path: v.file.path,
        placements: v.editor.terrain.placements(),
        cells: v.editor.terrain.cells(),
        depth: v.editor.terrain.history.undoDepth,
        dirty: v.repository.dirty,
        draft: v.repository.hasDraft,
        camera: v.editor.renderer.camera,
        selected: v.editor.selectedLocation,
      };
    });
  }
  async function open(file) {
    await page.evaluate(
      async (file) =>
        app.workspace
          .getLeaf(false)
          .openFile(app.vault.getAbstractFileByPath(file)),
      file,
    );
    await viewport().locator("canvas").waitFor({ state: "visible" });
    await settle();
    assert.equal((await state()).path, file);
  }
  async function screen(position) {
    const s = await state(),
      b = await viewport().boundingBox();
    return {
      x:
        b.x +
        b.width / 2 +
        (position.x - s.camera.center.x) / s.camera.metersPerPixel,
      y:
        b.y +
        b.height / 2 +
        (position.y - s.camera.center.y) / s.camera.metersPerPixel,
    };
  }
  async function select(id) {
    await button("Hex auswählen").click();
    const p = (await state()).placements.find((p) => p.locationId === id);
    const s = await screen(p.position);
    await page.mouse.click(s.x, s.y);
    await key().waitFor({ state: "visible" });
    await page.waitForFunction(
      (id) =>
        document.querySelector(".dn-location-key:not([hidden])")?.dataset
          .locationId === id,
      id,
    );
    await settle();
  }
  async function drag(id, dx, dy, cancel = false) {
    const before = await state(),
      p = before.placements.find((p) => p.locationId === id),
      s = await screen(p.position);
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    await page.mouse.move(s.x + dx, s.y + dy, { steps: 5 });
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle();
    if (!cancel)
      await page.waitForFunction(
        (depth) =>
          app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view
            .editor.terrain.history.undoDepth ===
          depth + 1,
        before.depth,
      );
    const after = await state();
    if (cancel) assert.deepEqual(after.placements, before.placements);
    else {
      const position = after.placements.find(
        (p) => p.locationId === id,
      ).position;
      assert(
        Math.abs(
          position.x - p.position.x - dx * before.camera.metersPerPixel,
        ) < 1,
      );
      assert(
        Math.abs(
          position.y - p.position.y - dy * before.camera.metersPerPixel,
        ) < 1,
      );
    }
    return { before, after };
  }
  async function save() {
    await button("Atlas speichern").click();
    await page.waitForFunction(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return (
        !v.repository.dirty && !v.repository.hasDraft && !v.editor.pendingKey
      );
    });
    await settle();
  }
  function capture(file) {
    const raw = bytes(file),
      doc = JSON.parse(raw);
    return Object.fromEntries([
      [file, raw],
      ...doc.placements.map((p) => {
        const file = `Orte/${p.locationId}.location`;
        return [file, bytes(file)];
      }),
      ...doc.chunks.map((c) => {
        const file = `Atlasdaten/${doc.id}/${c.file}`;
        return [file, bytes(file)];
      }),
    ]);
  }
  async function menu(text) {
    await page.evaluate((expected) => {
      if (app.vault.adapter.basePath !== expected)
        throw new Error("Unbekanntes Testfenster");
      app.setting.close();
      window.electron.remote.getCurrentWindow().focus();
    }, vault);
    await page.waitForFunction(() => activeWindow === window);
    await button("Atlas-Kartenmenü").click();
    await page.locator(".menu-item").filter({ hasText: text }).last().click();
  }
  async function edit() {
    const world = {
      kind: "overworld",
      version: 1,
      id: "hex03-world",
      name: "Hex03 Welt",
      orientation: "pointy",
      origin: { x: 0, y: 0 },
      metersPerMile: 1609.344,
      minHexMiles: 3,
      levelFactor: 3,
      chunks: [],
      placements: [],
    };
    await page.evaluate(
      async ({ file, text }) => {
        if (!app.vault.getAbstractFileByPath("Atlanten"))
          await app.vault.createFolder("Atlanten");
        await app.vault.create(file, text);
      },
      { file: A, text: JSON.stringify(world) },
    );
    await open(A);
    await button("Atlasinhalt einpassen").click(); await settle();
    assert.deepEqual((await state()).camera.center, world.origin);
    await button("Stadt in Kartenmitte anlegen").click();
    await key().waitFor({ state: "visible" });
    const city = await key().getAttribute("data-location-id");
    await button("Atlasänderung rückgängig").click(); await settle();
    assert.equal((await state()).placements.length, 0);
    assert.equal(await key().count(), 0);
    await button("Atlasänderung wiederholen").click(); await settle();
    assert.equal((await state()).placements[0].locationId, city);
    assert.equal(await key().getAttribute("data-location-id"), city);
    await key()
      .getByRole("textbox", { name: "Ortsname", exact: true })
      .fill("Ödhafen 🐉");
    const description = "# Hafen\n\n**日本語**  \n[[Chronik]]\n";
    const notes = "  Wörtliche Notiz\n\tEnde\n";
    await key()
      .getByRole("textbox", { name: "Abschnitt 1: Markdown", exact: true })
      .fill(description);
    await key()
      .getByRole("textbox", { name: "Abschnitt 2: Markdown", exact: true })
      .fill(notes);
    await key()
      .getByRole("button", { name: "Abschnitt nach oben", exact: true })
      .nth(1)
      .click();
    await key()
      .getByRole("button", { name: "Übernehmen", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".dn-location-key:not([hidden])")?.dataset
          .pending === "false",
    );
    await button("POI in Kartenmitte anlegen").click();
    await page.waitForFunction(
      (city) =>
        document.querySelector(".dn-location-key:not([hidden])")?.dataset
          .locationId !== city,
      city,
    );
    const poi = await key().getAttribute("data-location-id");
    await key()
      .getByRole("textbox", { name: "Ortsname", exact: true })
      .fill("Wachturm");
    await key()
      .getByRole("textbox", { name: "Abschnitt 1: Markdown", exact: true })
      .fill("**Ein POI**\n");
    // A map action adopts the text before moving its marker; one camera and one History.
    await button("Hex auswählen").click();
    await drag(poi, 110, 65);
    await select(city);
    await drag(city, -50, -20, true);
    const moved = await drag(city, -120, -70);
    await button("Atlasänderung rückgängig").click();
    await settle();
    assert.deepEqual((await state()).placements, moved.before.placements);
    await button("Atlasänderung wiederholen").click();
    await settle();
    assert.deepEqual((await state()).placements, moved.after.placements);
    await button("Atlasinhalt einpassen").click(); await settle();
    assert.equal((await state()).cells.length, 0);
    for (const placement of (await state()).placements) {
      const point = await screen(placement.position), bounds = await viewport().boundingBox();
      assert(point.x > bounds.x && point.x < bounds.x + bounds.width && point.y > bounds.y && point.y < bounds.y + bounds.height);
    }
    await button("Wald malen").click();
    const p = await screen({ x: -4828.032, y: 0 });
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(
      () =>
        app.workspace
          .getLeavesOfType("dungeon-native-atlas")
          .at(-1)
          .view.editor.terrain.cells().length === 1,
    );
    await button("Atlasänderung rückgängig").click();
    await settle();
    assert.equal((await state()).cells.length, 0);
    await button("Atlasänderung wiederholen").click();
    await settle();
    assert.equal((await state()).cells.length, 1);
    await save();
    const saved = capture(A),
      cityDoc = JSON.parse(saved[`Orte/${city}.location`]);
    assert.deepEqual(
      cityDoc.sections.map((s) => s.markdown),
      [notes, description],
    );
    checks.push(
      "Native create/select city + POI, exact Key order/Unicode, Escape cancels marker drag, one-command movement and shared terrain Undo/Redo + Save",
    );
    await select(city);
    // Read-only delay injection: exercise a slow owner lookup through the real UI without writing a document.
    await page.evaluate(() => {
      const repository = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.repository;
      const original = repository.ensureLocation;
      const slow = window.__hex03Slow = {started: false, finished: false};
      slow.gate = new Promise(resolve => {slow.release = resolve;});
      repository.ensureLocation = async function(id) {
        slow.started = true;
        const result = await original.call(this, id);
        await slow.gate; slow.finished = true; return result;
      };
      slow.restore = () => {repository.ensureLocation = original;};
    });
    const cityPoint = await screen((await state()).placements.find(p => p.locationId === city).position);
    await page.mouse.click(cityPoint.x, cityPoint.y);
    await page.waitForFunction(() => window.__hex03Slow.started);
    const bounds = await viewport().boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + 30);
    await page.evaluate(() => {window.__hex03Slow.restore(); window.__hex03Slow.release();});
    await page.waitForFunction(() => window.__hex03Slow.finished); await settle();
    assert.equal((await state()).selected, undefined);
    assert.equal(await key().count(), 0);
    await page.evaluate(() => {delete window.__hex03Slow;});
    await select(city);
    checks.push("Empty and location-only Fit, creation Undo/Redo restore both owner and visible marker/Key, delayed read cannot overwrite newer Hex selection (explicit read-delay fault injection)");
    await button("Atlasinhalt einpassen").click();
    await settle();
    for (const p of (await state()).placements) {
      const s = await screen(p.position),
        b = await viewport().boundingBox();
      assert(
        s.x > b.x && s.x < b.x + b.width && s.y > b.y && s.y < b.y + b.height,
      );
    }
    await page.screenshot({ path: path.join(out, "01-marker-key.png") });
    await menu("Speichern unter");
    const modal = page
      .locator(".modal")
      .filter({
        has: page.getByRole("textbox", { name: "Kopiename", exact: true }),
      });
    await modal
      .getByRole("textbox", { name: "Kopiename", exact: true })
      .fill("Hex03 Kopie");
    await modal
      .getByRole("button", { name: "Kopie speichern", exact: true })
      .click();
    await page.waitForFunction(
      (file) =>
        app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.file
          .path === file,
      B,
    );
    await settle();
    const copy = capture(B),
      copyWorld = JSON.parse(copy[B]);
    assert.notEqual(copyWorld.id, world.id);
    assert.equal(copyWorld.placements.length, 2);
    for (const p of copyWorld.placements)
      assert(![city, poi].includes(p.locationId));
    for (const [file, raw] of Object.entries(saved))
      assert.equal(bytes(file), raw);
    await open(A);
    await button("Atlasinhalt einpassen").click();
    await settle();
    await select(city);
    const camera = (await state()).camera;
    await key()
      .getByRole("textbox", { name: "Ortsname", exact: true })
      .fill("Verwerfen");
    await button("Hex auswählen").click();
    await drag(city, 40, 20);
    await menu("Entwurf verwerfen");
    await page
      .locator(".modal")
      .getByRole("button", { name: "Entwurf verwerfen", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view
          .repository.dirty,
    );
    await settle();
    assert.deepEqual(
      (await state()).placements,
      JSON.parse(saved[A]).placements,
    );
    assert.deepEqual((await state()).camera, camera);
    for (const [file, raw] of Object.entries(saved))
      assert.equal(bytes(file), raw);
    await key()
      .getByRole("textbox", { name: "Ortsname", exact: true })
      .fill("Konfliktentwurf");
    const external = JSON.stringify({
      ...JSON.parse(saved[`Orte/${city}.location`]),
      name: "Externe Fassung",
    });
    await page.evaluate(
      async ({ file, text }) =>
        app.vault.modify(app.vault.getAbstractFileByPath(file), text),
      { file: `Orte/${city}.location`, text: external },
    );
    await button("Atlas speichern").click();
    await page
      .getByText(/Bearbeitung angehalten.*Extern geändert/)
      .waitFor({ state: "visible" });
    assert.equal(bytes(`Orte/${city}.location`), external);
    assert.equal(
      await key()
        .getByRole("textbox", { name: "Ortsname", exact: true })
        .inputValue(),
      "Konfliktentwurf",
    );
    await page.evaluate(
      async ({ file, text }) =>
        app.vault.modify(app.vault.getAbstractFileByPath(file), text),
      { file: `Orte/${city}.location`, text: saved[`Orte/${city}.location`] },
    );
    await save();
    const finalSaved = capture(A);
    await open(B);
    await button("Atlasinhalt einpassen").click();
    await settle();
    const copyCity = copyWorld.placements.find(
      (p) => JSON.parse(copy[`Orte/${p.locationId}.location`]).type === "city",
    ).locationId;
    await select(copyCity);
    await key()
      .getByRole("textbox", { name: "Ortsname", exact: true })
      .fill("Wiederhergestellter Hafen");
    // Real file transition flushes the still-local text into the recovery draft.
    await open(A);
    assert(fs.existsSync(path.join(vault, B + ".draft")));
    assert.deepEqual(capture(B), copy);
    fs.writeFileSync(
      proofPath,
      JSON.stringify(
        { saved: finalSaved, copy, city, poi, copyCity, camera },
        null,
        2,
      ),
    );
    await page.screenshot({ path: path.join(out, "02-saved.png") });
    checks.push(
      "Actual Copy remaps owner identities, Discard preserves camera/saved bytes, external Location conflict retains entered Key, file transition retains pending text in a draft",
    );
  }
  async function reopen() {
    const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    for (const [file, raw] of Object.entries(proof.saved))
      assert.equal(bytes(file), raw);
    await open(A);
    await button("Atlasinhalt einpassen").click();
    await settle();
    await select(proof.city);
    assert.equal(
      await key()
        .getByRole("textbox", { name: "Ortsname", exact: true })
        .inputValue(),
      "Konfliktentwurf",
    );
    assert.deepEqual(
      (await state()).placements,
      JSON.parse(proof.saved[A]).placements,
    );
    assert.equal((await state()).cells.length, 1);
    const source = JSON.parse(proof.saved[`Orte/${proof.city}.location`]);
    assert.deepEqual(
      await key()
        .locator("textarea")
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      source.sections.map((s) => s.markdown),
    );
    await page.screenshot({ path: path.join(out, "01-fresh-saved.png") });
    await open(B);
    await button("Atlasinhalt einpassen").click();
    await settle();
    await select(proof.copyCity);
    assert.equal(
      await key()
        .getByRole("textbox", { name: "Ortsname", exact: true })
        .inputValue(),
      "Wiederhergestellter Hafen",
    );
    assert((await state()).dirty && (await state()).draft);
    assert.deepEqual(capture(B), proof.copy);
    await save();
    assert.equal(
      JSON.parse(bytes(`Orte/${proof.copyCity}.location`)).name,
      "Wiederhergestellter Hafen",
    );
    await page.screenshot({ path: path.join(out, "02-fresh-recovery.png") });
    checks.push(
      "Fresh native process opens exact saved World/placements/terrain/Keys and a separate copied Atlas recovery draft; Save writes recovered owner bytes",
    );
  }
  return { edit, reopen };
};
