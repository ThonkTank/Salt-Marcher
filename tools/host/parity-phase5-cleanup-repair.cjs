const ASSET_ID = "pack:dungeondraft-builtin-1.2.0.1:object:res%3A%2F%2Ftextures%2Fobjects%2Factivities%2Fadministration%2Fatlas_globe_01.png";
const mapPath = (size, repetition) =>
  `Dungeons/Parity/Phase5-Cleanup-Repair-${size}-${repetition}.dungeon`;

module.exports = ({ page, fs, path, assert, crypto, out, checks, chooseTool }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const expected = process.env.DUNGEON_QA_BUILD_EXPECTED_SHA256;
  const build = crypto.createHash("sha256").update(fs.readFileSync(
    path.join(process.env.DUNGEON_PLUGIN_ROOT || path.resolve(__dirname, "../.."),
      "main.js"))).digest("hex");
  assert.equal(build, expected, "Review-Buildhash fehlt oder weicht ab");
  const phase = process.env.DUNGEON_QA_PHASE;
  assert.ok(phase === "baseline" || phase === "candidate");

  const settle = () => page.evaluate(async () => {
    const r = app.workspace.activeLeaf.view.editor.renderer;
    await Promise.all([...r.pendingLights]);
    await r.textures.ready();
    await new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(resolve)));
    await Promise.all([...r.pendingLights]);
  });
  const state = async () => {
    await settle();
    return page.evaluate(() => {
      const e = app.workspace.activeLeaf.view.editor;
      const r = e.renderer;
      const probe = r.__phase5RepairProbe;
      for (const visual of probe.trackedLights) {
        if (visual.gradient && !probe.seenGradients.has(visual.gradient)) {
          probe.seenGradients.add(visual.gradient);
          probe.counts.newGradients++;
        }
      }
      const selected = ["blocker", "light-path", "light-wall", "light-door",
        "near", "far", "near-second", "far-second"];
      return {
        counts: structuredClone(probe.counts),
        poolId: probe.poolId(r.textures),
        poolEntries: r.textures.entries.size,
        poolBytes: r.textures.bytes,
        palette: e.session.settings.objectPalette ?? null,
        history: e.session.historySize,
        renderCount: r.renderCount,
        camera: { ...r.camera },
        geometry: Object.fromEntries(selected.map((id) =>
          [id, e.session.entities.get(id) ?? null])),
        settings: { name: e.session.settings.name,
          width: e.session.settings.width,
          height: e.session.settings.height },
      };
    });
  };
  const median = (values) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] :
      (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const delta = (before, after) => {
    const b = before.counts, a = after.counts;
    const renderMs = a.renderMs.slice(b.renderMs.length);
    return {
      rebuilds: a.rebuilds - b.rebuilds,
      masks: a.masks - b.masks,
      syncs: a.syncs - b.syncs,
      newVisuals: a.newVisuals - b.newVisuals,
      destroyedVisuals: a.destroyedVisuals - b.destroyedVisuals,
      textureAcquireCalls: a.textureAcquireCalls - b.textureAcquireCalls,
      colorableAcquireCalls: a.colorableAcquireCalls - b.colorableAcquireCalls,
      textureNewEntries: a.textureNewEntries - b.textureNewEntries,
      textureNewIdentities: a.textureNewIdentities - b.textureNewIdentities,
      textureReuses: a.textureReuses - b.textureReuses,
      textureReleases: a.textureReleases - b.textureReleases,
      newGradients: a.newGradients - b.newGradients,
      lightIds: a.lightIds.slice(b.lightIds.length),
      visibilityRequests: a.visibilityRequests - b.visibilityRequests,
      polygons: a.polygons.slice(b.polygons.length),
      renderMs,
      renderFrames: renderMs.length,
      renderMsSum: renderMs.reduce((sum, value) => sum + value, 0),
      renderMsMedian: median(renderMs),
      renderMsMax: Math.max(0, ...renderMs),
      poolBefore: { id: before.poolId, entries: before.poolEntries,
        bytes: before.poolBytes },
      poolAfter: { id: after.poolId, entries: after.poolEntries,
        bytes: after.poolBytes },
    };
  };

  async function open(size, repetition) {
    const name = mapPath(size, repetition);
    await page.evaluate(async ({ name, size, repetition, assetId }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      const near = { id: "near", kind: "light", floorId: "floor-1",
        x: 2, y: 2, radius: 3, intensity: 1, color: 0xffffff, shadows: true };
      const far = { ...near, id: "far", x: size - 3, y: size - 3 };
      const blocker = { id: "blocker", kind: "object", floorId: "floor-1",
        x: 3, y: 2, rotation: 0, width: 1, height: 1,
        color: 0xffffff, alpha: 255, label: "", layer: 100,
        shadow: false, blocksLight: false, flip: false };
      const decoration = Array.from({ length: size === 8 ? 6 : 64 }, (_, i) => ({
        ...blocker, id: `decoration-${i}`,
        x: 5 + (i % 8) * (size === 8 ? 0.2 : 8),
        y: 5 + Math.floor(i / 8) * (size === 8 ? 0.2 : 8),
        ...(i === 0 ? { assetId, width: 1.01953125, height: 1.03125 } : {}),
      }));
      const upper = size === 128 ? [
        { ...near, id: "near-second", floorId: "floor-2" },
        { ...far, id: "far-second", floorId: "floor-2" },
      ] : [];
      const doc = { format: "dungeon-map", version: 3,
        id: `phase5-cleanup-repair-${size}-${repetition}`,
        settings: { name: "Phase 5 Cleanup Repair", width: size,
          height: size, feetPerField: 5, builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0,
          ambient: 0.2 }, ...(size === 128 ?
          [{ id: "floor-2", name: "Upper", elevation: 1,
            ambient: 0.2 }] : [])],
        entities: [near, far, ...upper, blocker, ...decoration],
        content: { definitions: [], occurrences: [], routes: [], archive: [] } };
      await app.vault.create(name, JSON.stringify(doc, null, 2));
      await app.workspace.getLeaf(false).openFile(
        app.vault.getAbstractFileByPath(name));
    }, { name, size, repetition, assetId: ASSET_ID });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.evaluate(() => {
      const r = app.workspace.activeLeaf.view.editor.renderer;
      r.camera = { scale: 64,
        x: r.canvas.clientWidth / 2 - 2 * 64,
        y: r.canvas.clientHeight / 2 - 2 * 64 };
      r.cameraChanged();
      r.setGridVisible(false);
    });
    await settle();
    await page.evaluate(() => {
      const r = app.workspace.activeLeaf.view.editor.renderer;
      const texturePrototype = r.textures.constructor.prototype;
      let patch = window.__phase5RepairTexturePatch;
      if (!patch) {
        patch = { active: null, poolIds: new WeakMap(), nextPoolId: 0 };
        const acquire = texturePrototype.acquire;
        texturePrototype.acquire = function (...args) {
          const active = patch.active;
          if (!active) return acquire.apply(this, args);
          active.counts.textureAcquireCalls++;
          const key = args[1] ? args[0] + "\0raw" : args[0];
          const existed = this.entries.has(key);
          const promise = acquire.apply(this, args);
          if (existed) active.counts.textureReuses++;
          else active.counts.textureNewEntries++;
          void promise.then((texture) => {
            if (!active.seenTextures.has(texture)) {
              active.seenTextures.add(texture);
              active.counts.textureNewIdentities++;
            }
          });
          return promise;
        };
        const acquireColorable = texturePrototype.acquireColorableObject;
        texturePrototype.acquireColorableObject = function (...args) {
          const active = patch.active;
          if (!active) return acquireColorable.apply(this, args);
          active.counts.colorableAcquireCalls++;
          const before = this.entries.size;
          const result = acquireColorable.apply(this, args);
          if (this.entries.size > before) active.counts.textureNewEntries++;
          else active.counts.textureReuses++;
          void result.texture.then((texture) => {
            if (!active.seenTextures.has(texture)) {
              active.seenTextures.add(texture);
              active.counts.textureNewIdentities++;
            }
          });
          return result;
        };
        const release = texturePrototype.release;
        texturePrototype.release = function (...args) {
          if (patch.active) patch.active.counts.textureReleases++;
          return release.apply(this, args);
        };
        window.__phase5RepairTexturePatch = patch;
      }
      const counts = { rebuilds: 0, masks: 0, syncs: 0,
        newVisuals: 0, destroyedVisuals: 0,
        textureAcquireCalls: 0, colorableAcquireCalls: 0,
        textureNewEntries: 0, textureNewIdentities: 0,
        textureReuses: 0, textureReleases: 0,
        newGradients: 0, lightIds: [], visibilityRequests: 0,
        polygons: [], renderMs: [] };
      const active = { counts, trackedLights: new Set(),
        seenTextures: new WeakSet(), seenGradients: new WeakSet(),
        poolId: (pool) => {
          if (!patch.poolIds.has(pool))
            patch.poolIds.set(pool, ++patch.nextPoolId);
          return patch.poolIds.get(pool);
        } };
      for (const entry of r.textures.entries.values())
        if (entry.texture) active.seenTextures.add(entry.texture);
      for (const visual of r.visuals.values())
        if (visual.gradient) active.seenGradients.add(visual.gradient);
      patch.active = active;
      const wrap = (method, key) => {
        const original = r[method];
        r[method] = function (...args) {
          counts[key]++;
          return original.apply(this, args);
        };
      };
      wrap("rebuild", "rebuilds");
      wrap("drawMapMask", "masks");
      const sync = r.sync;
      r.sync = function (id) {
        counts.syncs++;
        const before = this.visuals.get(id);
        const result = sync.call(this, id);
        if (this.visuals.get(id) && before !== this.visuals.get(id))
          counts.newVisuals++;
        return result;
      };
      const clear = r.clearVisual;
      r.clearVisual = function (id) {
        if (this.visuals.has(id)) counts.destroyedVisuals++;
        return clear.call(this, id);
      };
      const updateLight = r.updateLight;
      r.updateLight = function (visual) {
        counts.lightIds.push(visual.entity.id);
        active.trackedLights.add(visual);
        return updateLight.call(this, visual);
      };
      const request = r.compute.request;
      r.compute.request = function (payload) {
        if (payload.kind === "visibility") counts.visibilityRequests++;
        const pending = request.call(this, payload);
        if (payload.kind === "visibility")
          void pending.then((points) => counts.polygons.push({
            id: payload.light.id, points,
          }));
        return pending;
      };
      const render = r.app.render;
      r.app.render = function (...args) {
        const start = performance.now();
        try { return render.apply(this, args); }
        finally { counts.renderMs.push(performance.now() - start); }
      };
      r.__phase5RepairProbe = active;
    });
    return name;
  }

  async function shot(size, repetition, label, stage) {
    await settle();
    await page.mouse.move(12, 12);
    const name = `${size}-${repetition}-${label.replaceAll(" ", "-")}-${stage}.png`;
    const file = path.join(out, name);
    const bytes = await page.locator(".dn-canvas canvas").screenshot({ path: file });
    return { file, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  }
  async function action(label, command) {
    const before = await state();
    const start = performance.now();
    await page.evaluate((command) => {
      const s = app.workspace.activeLeaf.view.editor.session;
      if (command === "undo") s.undo();
      else if (command === "redo") s.redo();
      else if (command === "settings") s.execute({ label: "Review Kartenoption",
        settings: { before: s.settings,
          after: { ...s.settings, name: "Review changed" } } });
      else {
        const current = s.entities.get(command.id);
        const after = command.after === "delete" ? null
          : command.patch ? { ...current, ...command.patch } : command.after;
        s.execute({ label: `Review ${command.id}`,
          entities: [{ id: command.id, before: current ?? null, after }] });
      }
    }, command);
    const after = await state();
    return { label, before, after, delta: delta(before, after),
      wallMs: performance.now() - start };
  }

  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    const rows = [], matrix = [], images = [];
    for (const size of [8, 128]) {
      for (let repetition = 0; repetition < 3; repetition++) {
        const map = await open(size, repetition);
        const beforePalette = await state();
        const paletteStart = performance.now();
        await page.getByRole("button", {
          name: "Objektfarbe zur Palette hinzufügen" }).click();
        await page.getByRole("button", { name: "Accept", exact: true }).click();
        const afterPalette = await state();
        const paletteWallMs = performance.now() - paletteStart;
        const beforeBlocker = afterPalette;
        const blockerStart = performance.now();
        await page.evaluate(() => {
          const s = app.workspace.activeLeaf.view.editor.session;
          const before = s.entities.get("blocker");
          s.execute({ label: "Review blocker", entities: [{ id: before.id,
            before, after: { ...before, blocksLight: true } }] });
        });
        const afterBlocker = await state();
        const blockerWallMs = performance.now() - blockerStart;
        rows.push({ size, repetition, map,
          palette: { before: beforePalette, after: afterPalette,
            delta: delta(beforePalette, afterPalette),
            wallMs: paletteWallMs },
          blocker: { before: beforeBlocker, after: afterBlocker,
            delta: delta(beforeBlocker, afterBlocker),
            wallMs: blockerWallMs } });
        if (size === 128) {
          await chooseTool("Auswahl");
          await page.evaluate(() => app.workspace.activeLeaf.view.editor.renderer
            .setComparison("floor-2"));
          const run = async (label, command, image = false) => {
            const beforeImage = image ? await shot(size, repetition, label,
              "before") : null;
            const result = await action(label, command);
            const afterImage = image ? await shot(size, repetition, label,
              "after") : null;
            matrix.push({ size, repetition, map, ...result });
            if (image) images.push({ size, repetition, label,
              before: beforeImage, after: afterImage });
          };
          await run("object move nearby", { id: "blocker",
            patch: { x: 3.5 } }, true);
          await run("object move undo", "undo", true);
          await run("object move redo", "redo", true);
          await run("object delete", { id: "blocker", after: "delete" }, true);
          await run("object delete undo", "undo", true);
          const pathBlocker = { id: "light-path", kind: "path",
            floorId: "floor-1", points: [{ x: 3, y: 3 },
              { x: 4, y: 3 }], closed: false, smooth: false,
            width: 0.2, style: "road", color: 0xffffff,
            outlineColor: 0, outlineWidth: 0, layer: 100,
            start: "round", end: "round", blocksLight: true };
          await run("path add", { id: "light-path", after: pathBlocker }, true);
          await run("path move nearby", { id: "light-path",
            patch: { points: [{ x: 3.25, y: 3 },
              { x: 4.25, y: 3 }] } }, true);
          await run("path delete", { id: "light-path",
            after: "delete" }, true);
          const wall = { id: "light-wall", kind: "wall",
            floorId: "floor-1", points: [{ x: 3, y: 3 },
              { x: 4, y: 3 }], closed: false, smooth: false,
            color: 0xffffff, width: 0.2 };
          await run("wall add", { id: "light-wall", after: wall });
          const door = { id: "light-door", kind: "door",
            floorId: "floor-1",
            anchor: { boundaryId: "light-wall", contour: 0, at: 0.5 },
            width: 0.5, variant: "door", blocksLight: true };
          await run("door add", { id: "light-door", after: door }, true);
          await run("door open", { id: "light-door",
            patch: { blocksLight: false } }, true);
          await run("object to upper floor", { id: "blocker",
            patch: { floorId: "floor-2" } });
          await run("object floor undo", "undo");
          await run("map settings", "settings");
        }
        await page.evaluate(() => app.workspace.activeLeaf.detach());
      }
    }
    const result = { phase, buildSha256: build,
      pckSha256: fixtures.pckSha256, rows, matrix, images };
    fs.writeFileSync(path.join(out, "phase5-cleanup-repair.json"),
      JSON.stringify(result, null, 2));
    assert.equal(rows.length, 6);
    assert.equal(matrix.length, 42);
    assert.equal(images.length, 30);
    assert.ok(rows.every((row) => row.palette.delta.poolBefore.id ===
      row.palette.delta.poolAfter.id));
    if (phase === "candidate") {
      assert.ok(rows.every((row) => row.palette.delta.rebuilds === 0 &&
        row.palette.delta.visibilityRequests === 0 &&
        row.palette.delta.newVisuals === 0));
      assert.ok(matrix.filter((row) => row.label !== "map settings" &&
        !row.label.includes("floor")).every((row) =>
        !row.delta.lightIds.includes("far") &&
        !row.delta.lightIds.includes("far-second")));
    }
    checks.push("Phase 5 cleanup repair: six fresh maps, 42 light actions, " +
      "30 paired images, direct texture/gradient/render counters");
  }
  return { edit };
};
