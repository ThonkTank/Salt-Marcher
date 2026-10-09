// Actual native host flow in the harness-owned vault. Synthetic input; no user vault.
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const WORLD = "Atlanten/Hex01 Welt.overworld", FLAT = "Atlanten/Hex01 Flach.overworld";
  const DUNGEON = "Dungeons/Hex01 Regression.dungeon", BAD = "Atlanten/Hex01 Ungueltig.overworld";
  const baselinePath = path.join(qa, "hex01-baseline.json");
  const viewport = () => page.locator(".dn-atlas-viewport:visible").last();
  const selected = () => page.locator(".dn-atlas-selection:visible").last();
  const toolbar = () => page.locator(".dn-atlas-toolbar:visible").last();
  const bytes = (file) => fs.readFileSync(path.join(vault, file), "utf8");
  const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
  const near = (a, b, label, tolerance = 1e-6) => assert(Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function open(file) {
    await page.evaluate(async file => {
      const target = app.vault.getAbstractFileByPath(file);
      if (!target) throw new Error("Missing owned test file: " + file);
      await app.workspace.getLeaf(false).openFile(target);
    }, file);
    await viewport().locator("canvas").waitFor({ state: "visible" }); await settle();
  }
  async function state() {
    return viewport().evaluate(el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: el.clientWidth, height: el.clientHeight,
        cx: Number(el.dataset.centerX), cy: Number(el.dataset.centerY),
        mpp: Number(el.dataset.metersPerPixel), level: Number(el.dataset.hexLevel),
        id: el.parentElement.dataset.worldId };
    });
  }
  async function create(name, orientation) {
    await page.keyboard.press("Control+p");
    await page.locator(".prompt-input").waitFor({ state: "visible" });
    await page.locator(".prompt-input").fill("Atlas anlegen");
    await page.locator(".suggestion-item").filter({ hasText: "Atlas anlegen" }).first().click();
    const modal = page.locator(".modal").filter({ has: page.getByRole("textbox", { name: "Atlasname", exact: true }) });
    await modal.waitFor({ state: "visible" });
    const fields = await modal.locator(".setting-item-name").allTextContents();
    assert.deepEqual(fields.filter(Boolean), ["Name", "Hex-Ausrichtung"], "Only real atlas settings; Obsidian focus guards are not fields");
    assert.equal(await modal.locator('input[type="number"]').count(), 0, "No size/pixel controls");
    fs.writeFileSync(path.join(out, "create-fields.json"), JSON.stringify({ fields, inputs: await modal.locator("input").evaluateAll(inputs => inputs.map(el => ({ type: el.type, label: el.getAttribute("aria-label"), className: el.className }))) }, null, 2));
    await modal.getByRole("textbox", { name: "Atlasname", exact: true }).fill(name);
    await modal.getByRole("combobox", { name: "Hex-Ausrichtung", exact: true }).selectOption(orientation);
    await modal.getByRole("button", { name: "Atlas anlegen", exact: true }).click({ noWaitAfter: true });
    return modal;
  }
  async function choose(q, r, orientation) {
    const s = await state(), distance = 4828.032 * 3 ** s.level;
    const wx = orientation === "pointy" ? distance * (q + r / 2) : distance * Math.sqrt(3) / 2 * q;
    const wy = orientation === "pointy" ? distance * Math.sqrt(3) / 2 * r : distance * (r + q / 2);
    const x = s.x + s.width / 2 + (wx - s.cx) / s.mpp;
    const y = s.y + s.height / 2 + (wy - s.cy) / s.mpp;
    assert(x > s.x && x < s.x + s.width && y > s.y && y < s.y + s.height, "Known center is visible");
    await page.mouse.click(x, y); await settle();
    assert.equal(await selected().getAttribute("data-hex-address"), `${s.id}/${s.level}/${q}/${r}`);
    assert.equal(await selected().getAttribute("data-hex-q"), String(q));
    assert.equal(await selected().getAttribute("data-hex-r"), String(r));
    return { q, r, level: s.level, key: `${s.id}/${s.level}/${q}/${r}` };
  }
  async function fit() { await toolbar().getByRole("button", { name: "Atlasinhalt einpassen" }).click(); await settle(); }
  async function drag(button, dx, dy) {
    const s = await state(), x = s.x + s.width / 2, y = s.y + s.height / 2;
    await page.mouse.move(x, y); await page.mouse.down({ button });
    await page.mouse.move(x + dx, y + dy, { steps: 5 }); await page.mouse.up({ button }); await settle();
    return { before: s, after: await state() };
  }
  async function dungeonRegression() {
    const text = bytes(DUNGEON), before = hash(text);
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), DUNGEON);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas").last().waitFor({ state: "visible" });
    const actual = await page.evaluate(() => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view.editor;
      return { id: e.session.document().id, count: e.session.entities.size };
    });
    assert.equal(actual.id, "hex01-regression"); assert.equal(actual.count, 1);
    assert.equal(hash(bytes(DUNGEON)), before);
    await page.screenshot({ path: path.join(out, "dungeon-regression.png") });
    checks.push("Existing native dungeon opens with unchanged stable entity and file bytes");
  }
  async function edit() {
    await create("Hex01 Welt", "pointy");
    await viewport().locator("canvas").waitFor({ state: "visible" }); await settle();
    const original = bytes(WORLD), world = JSON.parse(original);
    assert.equal(world.orientation, "pointy"); assert.equal(world.minHexMiles, 3);
    assert.equal(world.metersPerMile, 1609.344); assert.equal(world.levelFactor, 3);
    assert.deepEqual(world.chunks, []); assert.deepEqual(world.placements, []);
    assert(!("width" in world) && !("height" in world));
    const positive = await choose(2, 1, "pointy");
    await page.screenshot({ path: path.join(out, "01-positive.png") });
    const negative = await choose(-2, -1, "pointy");
    await page.screenshot({ path: path.join(out, "02-negative.png") });
    checks.push("Command palette creates native boundless pointy atlas; positive and negative hex addresses are visible");
    const middle = await drag("middle", 210, 70);
    near(middle.after.cx, middle.before.cx - 210 * middle.before.mpp, "Middle pan X");
    near(middle.after.cy, middle.before.cy - 70 * middle.before.mpp, "Middle pan Y");
    await page.keyboard.down("Space"); const space = await drag("left", -150, 60); await page.keyboard.up("Space");
    near(space.after.cx, space.before.cx + 150 * space.before.mpp, "Space pan X");
    near(space.after.cy, space.before.cy - 60 * space.before.mpp, "Space pan Y");
    const b = await state(), ax = Math.round(b.x + b.width * .7) - b.x, ay = Math.round(b.y + b.height * .4) - b.y;
    const anchorBefore = { x: b.cx + (ax - b.width / 2) * b.mpp, y: b.cy + (ay - b.height / 2) * b.mpp };
    await page.mouse.move(b.x + ax, b.y + ay); await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200); await page.keyboard.up("Control");
    await page.waitForFunction(mpp => Number(document.querySelector(".dn-atlas-viewport").dataset.metersPerPixel) !== mpp, b.mpp);
    await settle(); const z = await state(); assert(z.mpp < b.mpp);
    near(z.cx + (ax - z.width / 2) * z.mpp, anchorBefore.x, "Wheel anchor X", 1);
    near(z.cy + (ay - z.height / 2) * z.mpp, anchorBefore.y, "Wheel anchor Y", 1);
    await fit();
    await toolbar().getByRole("button", { name: "Karte verschieben", exact: true }).click();
    for (let i = 0; i < 5; i++) await drag("left", -260, 0);
    const far = await state(); assert(far.cx > far.width * far.mpp, "Navigation crosses the starting viewport");
    await toolbar().getByRole("button", { name: "Hex auswählen", exact: true }).click();
    const farAddress = await choose(14, 0, "pointy");
    await page.screenshot({ path: path.join(out, "03-beyond-start.png") });
    for (let i = 0; i < 25; i++) await toolbar().getByRole("button", { name: "Atlas verkleinern", exact: true }).click();
    await settle(); const overview = await state(); assert(overview.level >= 4);
    assert((await toolbar().innerText()).includes("Meilen pro Hex"));
    await page.screenshot({ path: path.join(out, "04-overview.png") });
    assert.equal(bytes(WORLD), original, "Navigation allocates no landscape or document bounds");
    await fit(); checks.push("Middle/Space/Hand pan, pointer-anchored zoom and coarse grid overview preserve file bytes");
    const collision = await create("Hex01 Welt", "flat");
    await page.getByText("Ein Atlas mit diesem Namen ist bereits vorhanden. Einen anderen Namen wählen.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(bytes(WORLD), original); assert(await collision.isVisible()); await page.keyboard.press("Escape");
    checks.push("Duplicate atlas creation retains existing file and entered modal");
    await create("Hex01 Flach", "flat");
    await viewport().locator("canvas").waitFor({ state: "visible" }); await settle();
    assert.equal(JSON.parse(bytes(FLAT)).orientation, "flat");
    const flatNegative = await choose(-2, -1, "flat");
    await page.screenshot({ path: path.join(out, "05-flat.png") });
    const dungeon = { format: "dungeon-map", version: 4, id: "hex01-regression",
      settings: { name: "Hex01 Regression", width: 20, height: 20, feetPerField: 5, assetPacks: [], builtInAssets: true, wallShadows: true, objectShadows: true, buildingWear: 0 },
      floors: [{ id: "hex01-floor", name: "Erdgeschoss", elevation: 0 }],
      entities: [{ id: "hex01-room", kind: "building", floorId: "hex01-floor", polygons: [{ outer: [{ x: 2, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 9 }, { x: 2, y: 9 }], holes: [] }], layer: 200, fill: 12562586, floorAlpha: 255, wall: 4210233, wallAlpha: 255, wallWidth: .2, number: "1", name: "Raum 1", key: { sections: [{ id: "hex01-text", kind: "markdown", markdown: "Unveränderter eigener Testtext." }] } }],
      content: { definitions: [], occurrences: [], routes: [], archive: [] } };
    await page.evaluate(async ({ file, text }) => { await app.vault.createFolder("Dungeons").catch(() => {}); await app.vault.create(file, text); }, { file: DUNGEON, text: JSON.stringify(dungeon) });
    await dungeonRegression(); await open(WORLD); await choose(-2, -1, "pointy");
    const badText = JSON.stringify({ ...world, width: 1000 });
    await page.evaluate(async ({ file, text }) => { await app.vault.create(file, text); }, { file: BAD, text: badText });
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), BAD);
    await page.getByText(/Atlas konnte nicht geöffnet werden.*Unbekannte Atlasdaten/).waitFor({ state: "visible" });
    assert.equal(bytes(BAD), badText); checks.push("Unknown document fields show an opening error and remain unchanged");
    await open(WORLD); await choose(-2, -1, "pointy");
    fs.writeFileSync(baselinePath, JSON.stringify({ worldId: world.id, worldHash: hash(original), flatId: JSON.parse(bytes(FLAT)).id,
      flatHash: hash(bytes(FLAT)), positive, negative, farAddress, flatNegative, dungeonHash: hash(bytes(DUNGEON)), badHash: hash(badText) }, null, 2));
    await page.screenshot({ path: path.join(out, "06-created.png") });
  }
  async function reopen() {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    assert.equal(hash(bytes(WORLD)), baseline.worldHash); assert.equal(hash(bytes(FLAT)), baseline.flatHash);
    assert.equal(hash(bytes(DUNGEON)), baseline.dungeonHash); assert.equal(hash(bytes(BAD)), baseline.badHash);
    await open(WORLD); assert.equal((await state()).id, baseline.worldId);
    assert.deepEqual(await choose(2, 1, "pointy"), baseline.positive);
    assert.deepEqual(await choose(-2, -1, "pointy"), baseline.negative);
    await page.screenshot({ path: path.join(out, "01-fresh-pointy.png") });
    await open(FLAT); assert.equal((await state()).id, baseline.flatId);
    assert.deepEqual(await choose(-2, -1, "flat"), baseline.flatNegative);
    await page.screenshot({ path: path.join(out, "02-fresh-flat.png") });
    await dungeonRegression(); await open(WORLD); await choose(-2, -1, "pointy");
    await page.screenshot({ path: path.join(out, "03-fresh-atlas.png") });
    checks.push("Fresh native process preserves both world identities, orientations, addresses and all fixture bytes");
    const collision = await create("Hex01 Welt", "flat");
    await page.getByText("Ein Atlas mit diesem Namen ist bereits vorhanden. Einen anderen Namen wählen.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await collision.getByRole("textbox", { name: "Atlasname", exact: true }).inputValue(), "Hex01 Welt");
    assert.equal(hash(bytes(WORLD)), baseline.worldHash); assert.equal((await state()).id, baseline.worldId);
    await page.screenshot({ path: path.join(out, "04-existing-name.png") });
    await page.keyboard.press("Escape");
    checks.push("Existing atlas name has clear next action; entered modal, identity and file bytes preserved");
  }
  async function layout() {
    const original = bytes(WORLD); await page.setViewportSize({ width: 1440, height: 1000 }); await open(WORLD);
    async function measure(label) {
      const data = await viewport().evaluate(async el => {
        const style = node => {
          const s = getComputedStyle(node), r = node.getBoundingClientRect();
          return { width: r.width, height: r.height, x: r.x, y: r.y, clientWidth: node.clientWidth, clientHeight: node.clientHeight,
            display: s.display, minHeight: s.minHeight, heightCss: s.height, flex: s.flex, position: s.position, overflow: s.overflow };
        };
        const canvas = el.querySelector("canvas"), gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        const samples = [];
        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          samples.push({ width: el.clientWidth, height: el.clientHeight, bitmapWidth: canvas.width, bitmapHeight: canvas.height });
          if (el.clientHeight > window.innerHeight * 2) break;
        }
        return { innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio, root: style(el.parentElement),
          pane: style(el.closest(".workspace-leaf-content")), viewport: style(el), canvas: style(canvas),
          samples, gridLevel: el.dataset.hexLevel, mpp: el.dataset.metersPerPixel,
          webgl: gl ? { maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), lost: gl.isContextLost() } : null };
      });
      fs.writeFileSync(path.join(out, label + "-layout.json"), JSON.stringify(data, null, 2));
      await page.screenshot({ path: path.join(out, label + ".png") });
      assert(data.viewport.height <= data.innerHeight && data.viewport.height > 0, "Canvas viewport must stay in available window height");
      assert.equal(data.samples.at(-1).height, data.samples[0].height, "Viewport has no frame-to-frame resize growth");
      assert(data.webgl && !data.webgl.lost, "Live WebGL context");
      return data;
    }
    const full = await measure("01-full");
    await page.evaluate(async file => { await app.workspace.getLeaf("split", "vertical").openFile(app.vault.getAbstractFileByPath(file)); }, WORLD);
    await viewport().locator("canvas").waitFor({ state: "visible" }); await settle();
    const split = await measure("02-split"); assert(split.viewport.width < full.viewport.width);
    const before = await state(); await toolbar().getByRole("button", { name: "Atlas vergrößern", exact: true }).click(); await settle();
    assert((await state()).mpp < before.mpp); await fit(); await choose(1, 0, "pointy");
    const b = await state(), ax = Math.round(b.x + b.width * .6) - b.x, ay = Math.round(b.y + b.height * .45) - b.y;
    const worldAnchor = { x: b.cx + (ax - b.width / 2) * b.mpp, y: b.cy + (ay - b.height / 2) * b.mpp };
    await page.mouse.move(b.x + ax, b.y + ay); await page.keyboard.down("Control"); await page.mouse.wheel(0, -200); await page.keyboard.up("Control"); await settle();
    const z = await state(); assert(z.mpp < b.mpp);
    near(z.cx + (ax - z.width / 2) * z.mpp, worldAnchor.x, "Split zoom anchor X", 1);
    near(z.cy + (ay - z.height / 2) * z.mpp, worldAnchor.y, "Split zoom anchor Y", 1);
    await fit(); await measure("03-split-fit"); assert.equal(bytes(WORLD), original);
    checks.push("Own native full/split layout measured across60frames; pane-bounded live renderer and zoom preserve native bytes; no Cloud approval");
  }
  return { edit, reopen, layout };
};
