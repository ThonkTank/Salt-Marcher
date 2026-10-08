const mapPath = (size) => `Dungeons/Parity/Phase5-Cleanup-Benchmark-${size}.dungeon`;

module.exports = ({ page, fs, path, out, checks, chooseTool }) => {
  async function open(size) {
    await page.evaluate(async ({ name, size }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      const near = { id: "near", kind: "light", floorId: "floor-1",
        x: 2, y: 2, radius: 3, intensity: 1, color: 0xffffff, shadows: true };
      const far = { ...near, id: "far", x: size - 3, y: size - 3 };
      const blocker = { id: "blocker", kind: "object", floorId: "floor-1",
        x: 3, y: 2, rotation: 0, width: 1, height: 1,
        color: 0xffffff, alpha: 255, label: "", layer: 100,
        shadow: false, blocksLight: false, flip: false };
      const decoration = Array.from({ length: size === 8 ? 6 : 64 }, (_, i) => ({
        ...blocker, id: `decoration-${i}`, x: 5 + (i % 8) * (size === 8 ? 0.2 : 8),
        y: 5 + Math.floor(i / 8) * (size === 8 ? 0.2 : 8) }));
      const secondFloor = size === 128 ? [
        { ...near, id: "near-second", floorId: "floor-2" },
        { ...far, id: "far-second", floorId: "floor-2" },
      ] : [];
      const document = { format: "dungeon-map", version: 3,
        id: `phase5-cleanup-benchmark-${size}`,
        settings: { name: "Phase 5 Cleanup Benchmark", width: size, height: size,
          feetPerField: 5, builtInAssets: true, wallShadows: true,
          objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 0.2 },
          ...(size === 128 ? [{ id: "floor-2", name: "Upper", elevation: 1,
            ambient: 0.2 }] : [])],
        entities: [near, far, ...secondFloor, blocker, ...decoration],
        content: { definitions: [], occurrences: [], routes: [], archive: [] } };
      const existing = app.vault.getAbstractFileByPath(name);
      if (existing) await app.vault.modify(existing, JSON.stringify(document, null, 2));
      else await app.vault.create(name, JSON.stringify(document, null, 2));
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name));
    }, { name: mapPath(size), size });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.evaluate(async () => {
      const r = app.workspace.activeLeaf.view.editor.renderer;
      await Promise.all([...r.pendingLights]);
      const counts = { rebuild: 0, mask: 0, sync: 0, newVisuals: 0,
        destroyedVisuals: 0, lights: [], requests: [], polygons: [] };
      for (const [key, bucket] of [["rebuild", "rebuild"],
        ["drawMapMask", "mask"]]) {
        const original = r[key];
        r[key] = function (...args) { counts[bucket]++; return original.apply(this, args); };
      }
      const sync = r.sync;
      r.sync = function (id) {
        counts.sync++;
        const before = this.visuals.get(id);
        const result = sync.call(this, id);
        const after = this.visuals.get(id);
        if (after && after !== before) counts.newVisuals++;
        return result;
      };
      const clear = r.clearVisual;
      r.clearVisual = function (id) {
        if (this.visuals.has(id)) counts.destroyedVisuals++;
        return clear.call(this, id);
      };
      const light = r.updateLight;
      r.updateLight = function (visual) {
        counts.lights.push(visual.entity.id);
        return light.call(this, visual);
      };
      const request = r.compute.request;
      r.compute.request = function (payload) {
        counts.requests.push(payload.kind);
        const pending = request.call(this, payload);
        if (payload.kind === "visibility")
          void pending.then((points) => counts.polygons.push({
            id: payload.light.id, points,
          }));
        return pending;
      };
      r.__cleanupProbe = counts;
    });
  }
  const state = () => page.evaluate(() => {
    const e = app.workspace.activeLeaf.view.editor;
    const r = e.renderer;
    return { counts: structuredClone(r.__cleanupProbe),
      paletteLength: e.session.settings.objectPalette?.length ?? 30,
      width: e.session.settings.width,
      lightRequests: r.lightRequests,
      pendingLights: r.pendingLights.size };
  });
  const delta = (before, after) => ({
    rebuild: after.counts.rebuild - before.counts.rebuild,
    mask: after.counts.mask - before.counts.mask,
    sync: after.counts.sync - before.counts.sync,
    lights: after.counts.lights.slice(before.counts.lights.length),
    polygons: after.counts.polygons.slice(before.counts.polygons.length),
    visibilityRequests: after.counts.requests.slice(before.counts.requests.length)
      .filter(kind => kind === "visibility").length,
    newVisuals: after.counts.newVisuals - before.counts.newVisuals,
    destroyedVisuals: after.counts.destroyedVisuals - before.counts.destroyedVisuals,
    paletteLength: after.paletteLength,
    pendingLights: after.pendingLights,
  });
  async function edit() {
    const rows = [];
    const lightMatrix = [];
    for (const size of [8, 128]) {
      await open(size);
      for (let repetition = 0; repetition < 3; repetition++) {
        const beforePalette = await state();
        const paletteStart = Date.now();
        await page.getByRole("button", { name: "Objektfarbe zur Palette hinzufügen" }).click();
        await page.getByRole("button", { name: "Accept", exact: true }).click();
        const paletteEnd = Date.now();
        const afterPalette = await state();
        const beforeBlocker = afterPalette;
        const blockStart = Date.now();
        await page.evaluate((enabled) => {
          const s = app.workspace.activeLeaf.view.editor.session;
          const before = s.entities.get("blocker");
          s.execute({ label: "Benchmark Lichtblocker", entities: [{ id: before.id,
            before, after: { ...before, blocksLight: enabled } }] });
        }, repetition % 2 === 0);
        await page.evaluate(async () => {
          const r = app.workspace.activeLeaf.view.editor.renderer;
          await Promise.all([...r.pendingLights]);
        });
        const blockEnd = Date.now();
        const afterBlocker = await state();
        rows.push({ size, actualWidth: afterBlocker.width, repetition,
          palette: { ...delta(beforePalette, afterPalette), wallMs: paletteEnd - paletteStart },
          blocker: { ...delta(beforeBlocker, afterBlocker), wallMs: blockEnd - blockStart } });
      }
      if (size === 128) {
        await page.evaluate(() => app.workspace.activeLeaf.view.editor.renderer
          .setComparison("floor-2"));
        const action = async (label, command) => {
          const before = await state();
          await page.evaluate((command) => {
            const s = app.workspace.activeLeaf.view.editor.session;
            if (command === "undo") s.undo();
            else if (command === "redo") s.redo();
            else if (command === "settings") s.execute({ label: "Benchmark Kartenoption",
              settings: { before: s.settings,
                after: { ...s.settings, name: "Changed" } } });
            else {
              const current = s.entities.get(command.id);
              const after = command.after === "delete" ? null
                : command.patch ? { ...current, ...command.patch } : command.after;
              s.execute({ label: `Benchmark ${command.id}`,
                entities: [{ id: command.id, before: current ?? null, after }] });
            }
          }, command);
          await page.evaluate(async () => {
            const r = app.workspace.activeLeaf.view.editor.renderer;
            await Promise.all([...r.pendingLights]);
          });
          lightMatrix.push({ label, ...delta(before, await state()) });
        };
        await action("object move nearby", { id: "blocker", patch: { x: 3.5 } });
        await action("object move undo", "undo");
        await action("object move redo", "redo");
        await action("object delete", { id: "blocker", after: "delete" });
        await action("object delete undo", "undo");
        const pathBlocker = { id: "light-path", kind: "path", floorId: "floor-1",
          points: [{ x: 3, y: 3 }, { x: 4, y: 3 }], closed: false,
          smooth: false, width: 0.2, style: "road", color: 0xffffff,
          outlineColor: 0, outlineWidth: 0, layer: 100,
          start: "round", end: "round", blocksLight: true };
        await action("path add", { id: "light-path", after: pathBlocker });
        await action("path move nearby", { id: "light-path",
          patch: { points: [{ x: 3.25, y: 3 }, { x: 4.25, y: 3 }] } });
        await action("path delete", { id: "light-path", after: "delete" });
        const wall = { id: "light-wall", kind: "wall", floorId: "floor-1",
          points: [{ x: 3, y: 3 }, { x: 4, y: 3 }], closed: false,
          smooth: false, color: 0xffffff, width: 0.2 };
        await action("wall add", { id: "light-wall", after: wall });
        const door = { id: "light-door", kind: "door", floorId: "floor-1",
          anchor: { boundaryId: "light-wall", contour: 0, at: 0.5 },
          width: 0.5, variant: "door", blocksLight: true };
        await action("door add", { id: "light-door", after: door });
        await action("door open", { id: "light-door", patch: { blocksLight: false } });
        await action("object to upper floor", { id: "blocker",
          patch: { floorId: "floor-2" } });
        await action("object floor undo", "undo");
        await action("map settings", "settings");
      }
      await page.evaluate(() => app.workspace.activeLeaf.detach());
    }
    await open(8);
    await page.evaluate(() => {
      const e = app.workspace.activeLeaf.view.editor;
      const originalSample = e.sampleMapColor;
      e.sampleMapColor = function (...args) {
        const pending = originalSample.apply(this, args);
        window.__phase5CleanupSample = pending;
        return pending;
      };
      const doc = e.renderer.canvas.ownerDocument;
      const add = doc.addEventListener;
      const remove = doc.removeEventListener;
      const active = new Map();
      doc.addEventListener = function (type, listener, options) {
        if (type === "pointerdown" || type === "keydown")
          active.set(listener, type);
        return add.call(this, type, listener, options);
      };
      doc.removeEventListener = function (type, listener, options) {
        active.delete(listener);
        return remove.call(this, type, listener, options);
      };
      window.__phase5CleanupListeners = { active, restore: () => {
        doc.addEventListener = add;
        doc.removeEventListener = remove;
      } };
    });
    await page.getByRole("button", { name: "Objektfarbe RGBA öffnen" }).click();
    await page.getByRole("button", { name: "Objektfarbe Pipette" }).click();
    const beforeClose = await page.evaluate(() => ({
      samplePending: !!window.__phase5CleanupSample,
      sampleCancelRegistered: !!app.workspace.activeLeaf.view.editor.cancelColorSample,
      listeners: [...window.__phase5CleanupListeners.active.values()],
    }));
    const afterClose = await page.evaluate(async () => {
      const leaf = app.workspace.activeLeaf;
      leaf.detach();
      const settled = await Promise.race([
        window.__phase5CleanupSample.then((value) => ({ done: true, value })),
        new Promise((resolve) => setTimeout(() => resolve({ done: false }), 2000)),
      ]);
      const listeners = [...window.__phase5CleanupListeners.active.values()];
      window.__phase5CleanupListeners.restore();
      return { settled, listeners };
    });
    await open(8);
    await chooseTool("Raum");
    await page.evaluate(() => {
      const e = app.workspace.activeLeaf.view.editor;
      const originalSample = e.sampleMapColor;
      e.sampleMapColor = function (...args) {
        const pending = originalSample.apply(this, args);
        window.__phase5CleanupSample = pending;
        return pending;
      };
      const doc = e.renderer.canvas.ownerDocument;
      const add = doc.addEventListener;
      const remove = doc.removeEventListener;
      const active = new Map();
      doc.addEventListener = function (type, listener, options) {
        if (type === "pointerdown" || type === "keydown")
          active.set(listener, type);
        return add.call(this, type, listener, options);
      };
      doc.removeEventListener = function (type, listener, options) {
        active.delete(listener);
        return remove.call(this, type, listener, options);
      };
      window.__phase5CleanupListeners = { active, restore: () => {
        doc.addEventListener = add;
        doc.removeEventListener = remove;
      } };
    });
    await page.getByRole("button", { name: "Bodenfarbe RGBA" }).click();
    await page.getByRole("dialog", { name: "Bodenfarbe" })
      .getByRole("button", { name: "Pipette" }).click();
    const buildingBeforeClose = await page.evaluate(() => ({
      samplePending: !!window.__phase5CleanupSample,
      sampleCancelRegistered: !!app.workspace.activeLeaf.view.editor.cancelColorSample,
      listeners: [...window.__phase5CleanupListeners.active.values()],
    }));
    const buildingAfterClose = await page.evaluate(async () => {
      app.workspace.activeLeaf.detach();
      const settled = await Promise.race([
        window.__phase5CleanupSample.then((value) => ({ done: true, value })),
        new Promise((resolve) => setTimeout(() => resolve({ done: false }), 2000)),
      ]);
      const listeners = [...window.__phase5CleanupListeners.active.values()];
      window.__phase5CleanupListeners.restore();
      return { settled, listeners };
    });
    fs.writeFileSync(path.join(out, "phase5-cleanup-benchmark.json"),
      JSON.stringify({ rows, lightMatrix,
        picker: { beforeClose, afterClose },
        buildingPicker: { beforeClose: buildingBeforeClose,
          afterClose: buildingAfterClose } }, null, 2));
    checks.push("Phase 5 cleanup baseline: 8x8 and 128x128, three palette and blocker samples each");
  }
  return { edit };
};
