const MAP = "Dungeons/Parity/Repair2-Focus.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    return {
      focus: document.hasFocus(), mirrorHeld: editor.objectMirrorHeld,
      rotation: editor.settings.object.rotation,
      assetId: editor.settings.object.assetId,
      objects: editor.session.document().entities.filter((e) => e.kind === "object"),
      trace: window.__mirrorTrace || [],
    };
  });
  const point = (x, y) => page.evaluate(({ x, y }) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + y * renderer.camera.scale };
  }, { x, y });
  const place = async (x, y) => {
    const p = await point(x, y);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
    return (await state()).objects.at(-1);
  };
  const snapshot = async (name) => {
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, name + ".png") });
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  const installTrace = () => page.evaluate(() => {
    window.__mirrorTrace = [];
    for (const type of ["keydown", "keyup", "blur", "focus"]) {
      window.addEventListener(type, (event) => {
        if (type === "keydown" || type === "keyup") {
          if (event.key.toLowerCase() !== "a") return;
        }
        window.__mirrorTrace.push({ type, key: event.key || "", focus: document.hasFocus(),
          time: performance.now() });
      }, { capture: true });
    }
  });
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-repair2-focus",
        settings: { name: "Repair2 Focus", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    await installTrace();
    const initial = await state();
    const atlas = await page.evaluate((id) =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((asset) => asset.id === id), initial.assetId);
    assert.match(atlas.name, /Atlas Globe 01/);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.down("a");
    await snapshot("a-held-preview");
    const held = await place(2, 2);
    await page.keyboard.up("a");
    await snapshot("a-released-preview");
    const released = await place(3, 2);
    assert.equal(held.flip, true);
    assert.equal(released.flip, false);
    checks.push("DD-026.25 held A mirrors; release restores the next object");

    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.down("a");
    const wheelPoint = await point(2, 3);
    await page.mouse.move(wheelPoint.x, wheelPoint.y);
    await page.mouse.wheel(0, -120);
    const wheeled = await place(2, 3);
    await page.keyboard.up("a");
    assert.equal(wheeled.flip, true);
    assert.equal(Math.round(wheeled.rotation * 180 / Math.PI), 15);
    const rotationInput = page.getByRole("spinbutton", { name: "Rotation", exact: true });
    await rotationInput.fill("0");
    await rotationInput.press("Tab");
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.down("a");
    const rightPoint = await point(3, 3);
    await page.mouse.move(rightPoint.x, rightPoint.y);
    await page.mouse.click(rightPoint.x, rightPoint.y, { button: "right" });
    const right = await place(3, 3);
    await page.keyboard.up("a");
    assert.equal(right.flip, true);
    assert.equal(Math.round(right.rotation * 180 / Math.PI), 90);
    await snapshot("a-with-wheel-and-right");
    checks.push("DD-026.25 A with wheel and right click retains mirror and rotates 15 or 90 degrees");

    fs.writeFileSync(path.join(out, "a-gesture-pair.json"), JSON.stringify({
      initialAsset: atlas.name, initialAssetId: initial.assetId,
      baseline: { held, released, wheeled, right },
      final: await state(),
    }, null, 2));
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    fs.copyFileSync(path.join(vault, MAP), path.join(out, "saved-repair2-focus.dungeon"));
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.objects, saved.entities.filter((e) => e.kind === "object"));
    assert.equal(current.objects.length, 4);
    await snapshot("reopened");
    checks.push("DD-026.25 fresh process reloads four A gesture objects");
  }
  async function probeWindowManager() {
    const cp = require("node:child_process");
    const display = process.env.DUNGEON_QA_DISPLAY;
    const sinkScript = path.join(__dirname, "key-release-sink.py");
    assert(display && fs.existsSync(sinkScript),
      "X11 display and key sink script required");
    const xenv = { ...process.env, DISPLAY: display };
    const xdo = (...args) => cp.execFileSync("xdotool", args, {
      env: xenv, encoding: "utf8", timeout: 8000,
    }).trim();
    const sinkLog = path.join(out, "key-sink.jsonl");
    const pck = fixtures.verifyPck();
    await page.evaluate(async (archive) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(archive), pck);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-repair3-focus",
        settings: { name: "Repair3 Focus", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    await installTrace();
    await page.locator(".dn-canvas canvas").focus();
    const obsidianWindow = xdo("getactivewindow");
    const sink = cp.spawn("python3", [sinkScript, sinkLog], {
      env: xenv, stdio: "ignore",
    });
    const record = { display, windows: { obsidian: obsidianWindow },
      events: [] };
    const sample = async (name) => {
      record.events.push({ name, activeWindow: xdo("getactivewindow"),
        focusWindow: xdo("getwindowfocus"),
        sink: fs.existsSync(sinkLog)
          ? fs.readFileSync(sinkLog, "utf8").trim().split("\n")
            .filter(Boolean).map((line) => JSON.parse(line)) : [],
        host: await page.evaluate(() => {
          const editor = app.workspace.activeLeaf.view.editor;
          let electronFocused;
          try { electronFocused = require("electron").remote.getCurrentWindow().isFocused(); }
          catch (error) { electronFocused = String(error); }
          return { documentFocused: document.hasFocus(), electronFocused,
            mirrorHeld: editor.objectMirrorHeld, trace: window.__mirrorTrace,
            objects: editor.session.document().entities.filter((e) => e.kind === "object") };
        }) });
      fs.writeFileSync(path.join(out, "wm-focus-probe.json"),
        JSON.stringify(record, null, 2));
      if (["a-down", "sink-active-a-up", "obsidian-return",
        "after-placement", "held-return", "after-normal-release"].includes(name)) {
        try {
          cp.execFileSync("import", ["-display", display, "-window", "root",
            path.join(out, `${name}.png`)], { env: xenv, timeout: 8000 });
        } catch (error) { record.screenshotError = String(error); }
      }
    };
    try {
      let sinkWindow;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          sinkWindow = xdo("search", "--onlyvisible", "--name", "Codex KeyRelease Sink")
            .split("\n").filter(Boolean).at(-1);
        } catch {}
        if (sinkWindow) break;
        await page.waitForTimeout(200);
      }
      assert(sinkWindow, "KeyRelease sink window not found");
      record.windows.sink = sinkWindow;
      xdo("windowactivate", "--sync", obsidianWindow);
      await page.locator(".dn-canvas canvas").focus();
      await page.waitForTimeout(200);
      await sample("before");
      xdo("keydown", "a");
      await page.waitForTimeout(250);
      await sample("a-down");
      xdo("windowactivate", "--sync", sinkWindow);
      xdo("windowraise", sinkWindow);
      await page.waitForTimeout(300);
      await sample("sink-active-a-held");
      xdo("keyup", "a");
      await page.waitForTimeout(250);
      await sample("sink-active-a-up");
      xdo("windowactivate", "--sync", obsidianWindow);
      await page.waitForTimeout(250);
      await sample("obsidian-return");
      const placed = await place(2, 2);
      record.placed = placed;
      await sample("after-placement");
      assert.equal(placed.flip, true);
      assert(record.events.find((entry) => entry.name === "sink-active-a-up")
        .sink.some((event) => event.type === "KeyRelease" && event.keysym === "a"));
      xdo("keydown", "a");
      xdo("keyup", "a");
      await page.waitForTimeout(250);
      await sample("reset-after-away-release");
      assert.equal((await state()).mirrorHeld, false);
      xdo("keydown", "a");
      await page.waitForTimeout(200);
      xdo("windowactivate", "--sync", sinkWindow);
      xdo("windowraise", sinkWindow);
      await page.waitForTimeout(250);
      await sample("sink-active-a-still-held");
      xdo("windowactivate", "--sync", obsidianWindow);
      await page.waitForTimeout(250);
      await sample("held-return");
      record.placedHeldReturn = await place(3, 2);
      assert.equal(record.placedHeldReturn.flip, true);
      xdo("keyup", "a");
      await page.waitForTimeout(250);
      await sample("after-normal-release");
      record.placedNormalRelease = await place(4, 2);
      assert.equal(record.placedNormalRelease.flip, false);
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await waitForFileAbsent(path.join(vault, MAP + ".draft"));
      fs.copyFileSync(path.join(vault, MAP), path.join(out, "saved-wm-focus.dungeon"));
      fs.writeFileSync(path.join(out, "wm-focus-probe.json"),
        JSON.stringify(record, null, 2));
      checks.push("DD-026.25 WM focus and sink KeyRelease retain mirror; held return and normal release distinguish next placements");
    } finally {
      try { xdo("keyup", "a"); } catch {}
      sink.kill();
    }
  }
  async function probeWindowManagerReopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.objects, saved.entities.filter((e) => e.kind === "object"));
    assert.deepEqual(current.objects.map((e) => e.flip), [true, true, false]);
    checks.push("DD-026.25 fresh process reloads external-release, held-return and normal-release objects");
  }
  return { edit, reopen, probeWindowManager, probeWindowManagerReopen };
};
