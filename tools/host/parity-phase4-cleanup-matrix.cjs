const MAP = "Dungeons/Parity/Object-Library.dungeon";
const ORIGINAL_PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/objekte-bearbeitung/native-dd028/assets/own-object-color.dungeondraft_pack";
const ORIGINAL_PACK_SHA = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const UPDATED_PACK = "/home/aaron/.cache/dungeon-native-qa/parity-phase4-cleanup-repair-20261008/qaobjasl-updated.dungeondraft_pack";
const UPDATED_PACK_SHA = "bec2f21d79b50d358d0002956a79a0fc85c8e8a07f9dfe2fbb2382c64be1422e";

module.exports = ({ page, fs, path, assert, crypto, out, checks, chooseTool,
  resolveQaAppCgroup }) => {
  const matrix = { fixture: { map: MAP, originalPack: ORIGINAL_PACK,
    originalPackSha256: ORIGINAL_PACK_SHA, updatedPack: UPDATED_PACK,
    updatedPackSha256: UPDATED_PACK_SHA }, states: {}, actions: {},
    timing: "Renderer synchronous event time excludes a separate two-frame visible-image observation (or a recorded one-second timeout). Action memory.peak is reset through one open descriptor in the validated Obsidian cgroup scope." };
  const tiles = () => page.locator(".dn-object-library-tile");
  const tab = (name) => page.locator(".dn-object-library-tabs")
    .getByRole("button", { name, exact: true });
  const ids = () => tiles().evaluateAll((nodes) => nodes.map((node) => node.dataset.assetId));
  const record = async (name) => { matrix.states[name] = await ids(); };
  const save = (name) => fs.writeFileSync(path.join(out, name), JSON.stringify(matrix, null, 2));
  const readPeak = (fd) => {
    const buffer = Buffer.alloc(64);
    const count = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const value = Number(buffer.subarray(0, count).toString("utf8").trim());
    assert(Number.isFinite(value) && value > 0, "Invalid Obsidian memory.peak value");
    return value;
  };
  const measureMemory = async (action) => {
    const target = resolveQaAppCgroup();
    const current = () => Number(fs.readFileSync(target.currentPath, "utf8"));
    const fd = fs.openSync(target.peakPath, "r+");
    try {
      const currentBeforeBytes = current();
      const inheritedPeakBytes = readPeak(fd);
      fs.writeSync(fd, Buffer.from("0"), 0, 1, 0);
      const resetPeakBytes = readPeak(fd);
      const currentAtResetBytes = current();
      assert(Math.abs(resetPeakBytes - currentAtResetBytes) < 64 * 1048576,
        `Obsidian memory.peak did not reset near current usage: ${JSON.stringify({
          inheritedPeakBytes, resetPeakBytes, currentAtResetBytes })}`);
      const result = await action();
      const currentAfterBytes = current();
      const actionPeakBytes = readPeak(fd);
      assert(actionPeakBytes >= resetPeakBytes,
        "Obsidian action peak fell below its reset value");
      return { result, memory: { method: "cgroup-v2-memory.peak-reset-open-fd",
        serviceName: target.serviceName, group: target.group, pids: target.pids,
        currentBeforeBytes, inheritedPeakBytes, resetPeakBytes,
        currentAtResetBytes, currentAfterBytes, actionPeakBytes } };
    } finally { fs.closeSync(fd); }
  };
  const visible = async (modal) => page.evaluate((modal) => {
    const root = document.querySelector(modal ? ".dn-object-tag-grid" : ".dn-object-library-tiles");
    const capturedAtEpochMs = Date.now();
    if (!root) return { capturedAtEpochMs, rootPresent: false,
      visibleTileCount: 0, visibleWithSrcCount: 0, visibleDecodedCount: 0, tiles: [] };
    const rootRect = root.getBoundingClientRect();
    const viewport = { left: Math.max(0, rootRect.left), top: Math.max(0, rootRect.top),
      right: Math.min(innerWidth, rootRect.right), bottom: Math.min(innerHeight, rootRect.bottom) };
    const selector = modal ? ".dn-object-tag-tile" : ".dn-object-library-tile";
    const tiles = [...root.querySelectorAll(selector)].flatMap((tile) => {
      const rect = tile.getBoundingClientRect();
      if (!(rect.bottom > viewport.top && rect.top < viewport.bottom &&
          rect.right > viewport.left && rect.left < viewport.right)) return [];
      const image = tile.querySelector("img");
      return [{ id: modal ? null : tile.dataset.assetId ?? null,
        name: tile.getAttribute("aria-label"),
        src: image?.hasAttribute("src") ? image.src : null,
        complete: image?.complete ?? null, naturalWidth: image?.naturalWidth ?? null,
        box: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }];
    });
    return { capturedAtEpochMs, rootPresent: true, viewport,
      visibleTileCount: tiles.length, visibleWithSrcCount: tiles.filter((tile) => !!tile.src).length,
      visibleDecodedCount: tiles.filter((tile) => tile.complete && tile.naturalWidth > 0).length,
      tiles };
  }, modal);
  const settleImages = () => page.evaluate(() => new Promise((resolve) => {
    const timeout = setTimeout(() => resolve("timeout"), 1000);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(timeout); resolve("two-animation-frames");
    }));
  }));
  const measure = async (kind, input) => {
    const modal = kind === "modalOpen" || kind === "membership";
    const visibleBefore = await visible(modal);
    const { result, memory } = await measureMemory(() => page.evaluate(({ kind, input }) => {
      const editor = app.workspace.activeLeaf.view.editor;
      const isModal = kind === "modalOpen" || kind === "membership";
      const gridSelector = isModal ? ".dn-object-tag-grid" : ".dn-object-library-tiles";
      const selector = isModal ? ".dn-object-tag-tile" : ".dn-object-library-tile";
      const grid = document.querySelector(gridSelector);
      const beforeButtons = new Set(grid?.querySelectorAll(selector) ?? []);
      const beforeImages = new Set(grid?.querySelectorAll(`${selector} img`) ?? []);
      const libraryBefore = new Set(document.querySelectorAll(".dn-object-library-tile"));
      const focused = document.activeElement;
      const before = { rootPresent: !!grid, scrollTop: grid?.scrollTop ?? null,
        selectedId: editor.settings.object.assetId,
        ids: isModal ? null : [...beforeButtons].map((node) => node.dataset.assetId),
        tileNames: isModal ? [...beforeButtons].map((node) => node.getAttribute("aria-label")) : null,
        heapBytes: performance.memory?.usedJSHeapSize ?? null };
      const start = performance.now();
      const click = (selector) => {
        const node = document.querySelector(selector);
        if (!node) throw new Error(`Missing ${selector}`);
        node.click();
      };
      if (kind === "openAll") click('.dn-object-library-tabs button:nth-child(1)');
      else if (kind === "searchReturn") {
        const text = document.querySelector('input[aria-label="Objektbibliothek durchsuchen"]');
        text.value = input;
        text.dispatchEvent(new Event("input", { bubbles: true }));
        text.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        click('button[aria-label="Suche zurücksetzen"]');
      } else if (kind === "tagSwitch") {
        const button = [...document.querySelectorAll('.dn-object-library-tags button')]
          .find((node) => node.textContent === input);
        if (!button) throw new Error(`Missing tag ${input}`);
        button.click();
      } else if (kind === "modalOpen") click('.dn-object-library-tag-controls button');
      else if (kind === "membership") click('.dn-object-tag-tile[aria-label="Atlas Globe 01"]');
      else if (kind === "settingsRefresh") {
        const session = editor.session;
        const beforeSettings = session.settings;
        session.execute({ label: "QA Einstellungen", settings: {
          before: beforeSettings, after: { ...beforeSettings, name: beforeSettings.name + " " } } });
        session.undo();
      } else if (kind === "assetRefresh") {
        const panel = editor.objectLibrary;
        if (typeof panel.refreshAssets === "function") panel.refreshAssets(true);
        else panel.refresh();
      } else throw new Error(`Unknown action ${kind}`);
      const elapsedMs = performance.now() - start;
      const afterGrid = document.querySelector(gridSelector);
      const buttons = [...(afterGrid?.querySelectorAll(selector) ?? [])];
      const images = [...(afterGrid?.querySelectorAll(`${selector} img`) ?? [])];
      return { kind, input, elapsedMs, before,
        after: { rootPresent: !!afterGrid, scrollTop: afterGrid?.scrollTop ?? null,
          selectedId: editor.settings.object.assetId,
          ids: isModal ? null : buttons.map((node) => node.dataset.assetId),
          tileNames: isModal ? buttons.map((node) => node.getAttribute("aria-label")) : null,
          heapBytes: performance.memory?.usedJSHeapSize ?? null },
        newButtons: buttons.filter((node) => !beforeButtons.has(node)).length,
        newImages: images.filter((node) => !beforeImages.has(node)).length,
        libraryNewButtons: [...document.querySelectorAll(".dn-object-library-tile")]
          .filter((node) => !libraryBefore.has(node)).length,
        sameFocusedNode: focused === document.activeElement };
    }, { kind, input }));
    const settledBy = await settleImages();
    const visibleAfter = await visible(modal);
    return { ...result, memory, visibleBefore, visibleAfter, settledBy };
  };
  const repeat = async (name, kind, input, beforeEach, afterEach) => {
    const trials = [];
    for (let i = 0; i < 4; i++) {
      if (beforeEach) await beforeEach(i);
      trials.push(await measure(kind, input));
      if (afterEach) await afterEach(i);
    }
    const values = trials.map((trial) => trial.elapsedMs).sort((a, b) => a - b);
    matrix.actions[name] = { trials, medianMs: (values[1] + values[2]) / 2,
      firstRun: "warm: base Phase-4 scenario has already opened the editor" };
  };
  const search = () => page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
  const query = async (value) => { await search().fill(value); await search().press("Enter"); };
  const reset = () => page.getByRole("button", { name: "Suche zurücksetzen" }).click();

  async function edit() {
    await tab("All").click();
    await record("all");
    await repeat("openAll", "openAll", null, () => tab("Tags").click());
    for (const [name, value] of [["book", "book"], ["atlasGlobe", "atlas globe"]]) {
      await query(value); await record(name); await reset();
    }
    const slider = page.getByRole("slider", { name: "Fuzzy/Exact" });
    await slider.evaluate((node) => { node.value = "1"; node.dispatchEvent(new Event("input", { bubbles: true })); });
    await query("atla"); await record("exactAtla");
    await slider.evaluate((node) => { node.value = "0.5"; node.dispatchEvent(new Event("input", { bubbles: true })); });
    await search().press("Enter"); await record("fuzzyAtla");
    await page.getByRole("button", { name: "Suchtext leeren" }).click(); await record("searchX");
    await reset(); await record("searchTrash");
    await repeat("searchReturn", "searchReturn", "book");
    await tab("Tags").click();
    const tag = (name) => page.locator(".dn-object-library-tags")
      .getByRole("button", { name, exact: true });
    await tag("Administration").click(); await record("tagAdministration");
    await tag("Alchemy").click(); await record("tagAlchemyPlain");
    await tag("Administration").click({ modifiers: ["Control"] });
    await record("tagAlchemyAdministrationCtrl");
    await repeat("tagSwitch", "tagSwitch", "Administration", async () => tag("Alchemy").click());
    const picker = page.getByRole("combobox", { name: "Custom Set" });
    await picker.selectOption("Crafts & Trades"); await record("setCraftsTrades");
    await picker.selectOption("---"); await record("setDashes");
    await picker.selectOption(""); await record("customSet");
    await repeat("modalOpen", "modalOpen", null, undefined,
      () => page.locator(".dn-object-tags-modal").getByRole("button", { name: "Close", exact: true }).click());
    assert(matrix.actions.modalOpen.trials.every((trial) =>
      !trial.before.rootPresent && trial.after.rootPresent &&
      trial.newButtons === 1793 && trial.newImages === 1793 &&
      trial.libraryNewButtons === 0 && trial.visibleAfter.visibleTileCount > 0));
    await page.getByRole("button", { name: "Tags bearbeiten" }).click();
    const modal = page.locator(".dn-object-tags-modal");
    await modal.locator('input[type="radio"]').nth(1).click();
    await modal.getByRole("combobox", { name: "Tag wählen" }).selectOption("QA Phase4 Tag");
    await repeat("membership", "membership");
    await modal.getByRole("button", { name: "Close", exact: true }).click();
    await tab("All").click();
    await page.locator(".dn-object-library-tiles").evaluate((node) => { node.scrollTop = 168; });
    await search().focus();
    await repeat("assetRefresh", "assetRefresh");
    await repeat("settingsRefresh", "settingsRefresh");
    if (process.env.DUNGEON_PARITY4_MATRIX_REFERENCE !== "1") {
      assert(matrix.actions.assetRefresh.trials.every((trial) => trial.sameFocusedNode));
      assert(matrix.actions.settingsRefresh.trials.every((trial) => trial.sameFocusedNode));
    }

    if (process.env.DUNGEON_PARITY4_MATRIX_REFERENCE === "1") {
      save("cleanup-matrix-edit.json");
      checks.push("Reference ordered object-ID matrix and four repeated actions recorded");
      return;
    }

    const updated = fs.readFileSync(UPDATED_PACK);
    assert.equal(crypto.createHash("sha256").update(updated).digest("hex"), UPDATED_PACK_SHA);
    const qaTile = page.locator('.dn-object-library-tile[aria-label="QA Object Color"]');
    await qaTile.scrollIntoViewIfNeeded();
    await qaTile.focus();
    await page.waitForFunction(() => {
      const img = document.querySelector('.dn-object-library-tile[aria-label="QA Object Color"] img');
      return img?.complete && img.naturalWidth > 0;
    });
    matrix.reload = await page.evaluate(async (encoded) => {
      const editor = app.workspace.activeLeaf.view.editor;
      const grid = document.querySelector(".dn-object-library-tiles");
      const tile = document.querySelector('.dn-object-library-tile[aria-label="QA Object Color"]');
      const image = tile.querySelector("img");
      const before = { ids: [...grid.querySelectorAll(".dn-object-library-tile")]
        .map((node) => node.dataset.assetId), src: image.src,
        selectedId: editor.settings.object.assetId, scrollTop: grid.scrollTop,
        tileFocused: document.activeElement === tile };
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      const afterTile = document.querySelector('.dn-object-library-tile[aria-label="QA Object Color"]');
      const afterGrid = document.querySelector(".dn-object-library-tiles");
      const afterImage = afterTile.querySelector("img");
      await afterImage.decode();
      return { before, after: { ids: [...afterGrid.querySelectorAll(".dn-object-library-tile")]
        .map((node) => node.dataset.assetId), src: afterImage.src,
        selectedId: editor.settings.object.assetId, scrollTop: afterGrid.scrollTop,
        naturalWidth: afterImage.naturalWidth }, sameTile: tile === afterTile,
        sameImage: image === afterImage, sameFocus: document.activeElement === tile };
    }, updated.toString("base64"));
    assert.deepEqual(matrix.reload.after.ids, matrix.reload.before.ids);
    assert(matrix.reload.sameTile && matrix.reload.sameImage);
    assert(matrix.reload.before.tileFocused && matrix.reload.sameFocus);
    assert.notEqual(matrix.reload.after.src, matrix.reload.before.src);
    assert(matrix.reload.after.naturalWidth > 0);
    await page.evaluate(() => {
      const editor = app.workspace.activeLeaf.view.editor;
      const before = editor.session.settings;
      editor.session.execute({ label: "QA Paket ausblenden", settings: {
        before, after: { ...before, assetPacks: [] } } });
    });
    matrix.removedPackage = await ids();
    assert.equal(matrix.removedPackage.length, 1792);
    await page.evaluate(() => app.workspace.activeLeaf.view.editor.session.undo());
    matrix.restoredPackage = await ids();
    assert.deepEqual(matrix.restoredPackage, matrix.states.all);
    save("cleanup-matrix-edit.json");
    checks.push("Complete ordered object-ID matrix and four repeated cleanup actions recorded");
    checks.push("Same-ID package image reload preserves nodes and decodes the new Blob URL");
  }

  async function reopen() {
    for (const [name, file] of [["usedA", "Used-Two-Floor"], ["usedB", "Used-Other-Map"],
      ["usedAAgain", "Used-Two-Floor"]]) {
      await page.evaluate(async (mapPath) => app.workspace.getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(mapPath)),
      MAP.replace("Object-Library", file));
      await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
      await chooseTool("Möbel");
      await tab("Used").click();
      await record(name);
      if (name === "usedA") {
        await page.evaluate(() => app.workspace.activeLeaf.view.editor.renderer.setFloor("floor-2"));
        await record("usedAUpperFloor");
      }
    }
    save("cleanup-matrix-reopen.json");
    checks.push("Ordered Used IDs retained across two floors and A-B-A map switches");
  }
  return { edit, reopen };
};
