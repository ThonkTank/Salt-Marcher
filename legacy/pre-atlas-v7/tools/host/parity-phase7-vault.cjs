const MAP = "Dungeons/Drachenhöhle/Karte.dungeon";
const OVERVIEW = "Dungeons/Drachenhöhle/Drachenhöhle.md";
const DIR = "Dungeons/Drachenhöhle";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, sourceVault,
  out, checks, chooseTool }) => {
  const savedPath = path.join(qa, "phase7-vault-saved.json");
  const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const files = (base) => {
    const result = {};
    const visit = (directory) => {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, item.name);
        if (item.isDirectory()) visit(absolute);
        else result[path.relative(base, absolute)] = hash(absolute);
      }
    };
    visit(path.join(base, DIR));
    return result;
  };
  const sourceMap = () => JSON.parse(fs.readFileSync(path.join(sourceVault, MAP), "utf8"));
  const widths = (document) => document.entities
    .filter((entity) => entity.kind === "building" && entity.key)
    .flatMap((entity) => entity.key.sections
      .filter((section) => section.kind === "markdown")
      .flatMap((section) => [...section.markdown.matchAll(/!\[\[([^\]]+?)\|(\d+)\]\]/g)]
        .map((match) => ({ room: entity.number, target: match[1], width: Number(match[2]) }))));
  const play = async () => {
    await page.waitForFunction(() => !!app.plugins.getPlugin("dnd-ot-spielansicht") &&
      !!app.plugins.getPlugin("dungeon-editor"), null, { timeout: 20000 });
    await page.evaluate(async (overview) =>
      app.plugins.getPlugin("dnd-ot-spielansicht").restoreLayout(overview), OVERVIEW);
    await page.locator(".dnd-index-key .dnd-index-entry").first()
      .waitFor({ state: "attached", timeout: 20000 });
    await page.locator(".dn-room-view .dn-structured-key").first()
      .waitFor({ timeout: 20000 });
    await page.locator(".dnd-v4-outline-entry").first()
      .waitFor({ timeout: 20000 });
    return page.evaluate(() => ({
      indexCount: document.querySelectorAll(".dnd-index-key .dnd-index-entry").length,
      outlineCount: document.querySelectorAll(".dnd-v4-outline-entry").length,
      playMap: !!document.querySelector(".dnd-play-map-pane .dn-map-card"),
      detail: app.workspace.getLeavesOfType("dungeon-native-room")[0]?.getViewState()?.state,
    }));
  };
  const openRoom = async (roomId, sectionId) => {
    await page.evaluate(async ({ mapPath, roomId, sectionId }) =>
      app.plugins.getPlugin("dungeon-editor").openRoomKey(mapPath, roomId, sectionId),
    { mapPath: MAP, roomId, sectionId });
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
  };
  async function edit() {
    const original = files(sourceVault), copied = files(vault);
    assert.deepEqual(copied, original);
    assert(Object.keys(copied).length >= 60);
    const document = sourceMap();
    assert.equal(document.version, 4);
    const savedWidths = widths(document);
    for (const width of [379, 275, 503, 508])
      assert(savedWidths.some((entry) => entry.width === width),
        "Gespeicherte Bildbreite fehlt: " + width);
    const overviewText = fs.readFileSync(path.join(vault, OVERVIEW), "utf8");
    assert.equal((overviewText.match(/!\[\[Dungeons\/Drachenhöhle\/Karte\.dungeon\]\]/g) ?? []).length, 2);
    fs.writeFileSync(path.join(out, "p7-vault-baseline.json"), JSON.stringify({
      sourceFiles: original, savedWidths,
      overviewHash: hash(path.join(vault, OVERVIEW)),
      sourceMapHash: original[MAP] }, null, 2));
    checks.push("All protected Dragon Cave copy files and four saved image widths match the source byte-for-byte");

    const layout = await play();
    assert.equal(layout.indexCount, 15);
    assert(layout.outlineCount > 2 && layout.playMap && layout.detail?.roomId);
    const firstRoom = document.entities.find((entity) => entity.kind === "building" && entity.number === "1");
    assert(firstRoom?.key);
    await openRoom(firstRoom.id);
    await page.waitForFunction(() => [...document.querySelectorAll(".dn-room-view img")]
      .some((image) => (image.getAttribute("src") ?? "").includes("Tor")),
    null, { timeout: 20000 });
    const imageView = await page.evaluate(() => [...document.querySelectorAll(".dn-room-view img")]
      .map((image) => ({ alt: image.alt, src: image.getAttribute("src"),
        width: image.getAttribute("width"), styleWidth: image.style.width,
        clientWidth: image.clientWidth })));
    assert(imageView.some((image) => image.src?.includes("Tor") &&
      (Number(image.width) === 275 || image.clientWidth === 275 || image.styleWidth === "275px")),
    "Bildbreite 275 wird rechts nicht angewandt");
    await page.screenshot({ path: path.join(out, "p7-vault-room-and-image.png"), timeout: 30000 });
    fs.writeFileSync(path.join(out, "p7-vault-play-layout.json"),
      JSON.stringify({ layout, imageView }, null, 2));
    checks.push("Spielansicht shows 15 V4 keys, right detail, outline, map and original 275-pixel image width");

    await page.evaluate(() => app.workspace.setActiveLeaf(
      app.workspace.getLeavesOfType("dnd-dungeon-key")[0]));
    await page.locator(".dnd-index-key .dnd-v4-room-link").nth(8).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-room")[0]
      ?.view?.panel?.root?.innerText?.includes("9 Schlafhöhle 2"), null, { timeout: 12000 });
    const room9 = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-room")[0]?.getViewState()?.state);
    assert(room9?.roomId && room9.roomId !== firstRoom.id);
    await page.evaluate((overview) => {
      const leaf = app.workspace.getLeavesOfType("markdown")
        .find((item) => item.view.file?.path === overview);
      if (!leaf) throw new Error("Spielansicht-Übersicht fehlt");
      app.workspace.setActiveLeaf(leaf);
    }, OVERVIEW);
    const stable = page.locator('.dnd-play-overview a[href^="obsidian://dungeon-room?"]').first();
    await stable.waitFor({ timeout: 12000 });
    const stableUrl = await stable.getAttribute("href");
    await stable.click();
    const expectedRoom = new URL(stableUrl).searchParams.get("room");
    await page.waitForFunction((id) => app.workspace.getLeavesOfType("dungeon-native-room")
      .some((leaf) => leaf.getViewState()?.state?.roomId === id),
    expectedRoom, { timeout: 12000 });
    checks.push("Key list and stable overview room link open their exact right-hand V4 room");

    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(mapPath)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 30000 });
    await chooseTool("Auswahl");
    const before = await page.evaluate(() => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
      return e.session.document();
    });
    const target = before.entities.find((entity) => entity.kind === "object" && !entity.locked);
    assert(target, "Editierbares QA-Objekt fehlt");
    await page.evaluate(async (id) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.select(id), target.id);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("a");
    const changed = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.document());
    const afterTarget = changed.entities.find((entity) => entity.id === target.id);
    assert.equal(afterTarget.flip, !target.flip);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor?.session.dirty, null, { timeout: 30000 });
    assert.notEqual(hash(path.join(vault, MAP)), original[MAP]);
    const afterFiles = files(vault);
    for (const [file, digest] of Object.entries(original))
      if (file !== MAP) assert.equal(afterFiles[file], digest, "Geschützter Text oder Karte verändert: " + file);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8")), changed);
    const finalLayout = await play();
    assert.equal(finalLayout.indexCount, 15);
    fs.writeFileSync(savedPath, JSON.stringify({ original, editedMapHash: afterFiles[MAP],
      targetId: target.id, flipped: afterTarget.flip, savedWidths,
      overviewHash: original[OVERVIEW], imageView, finalLayout }, null, 2));
    await page.screenshot({ path: path.join(out, "p7-vault-after-edit.png"), timeout: 30000 });
    checks.push("One functional map edit saves while all other protected Dragon Cave files stay byte-identical");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    const current = files(vault);
    assert.equal(current[MAP], saved.editedMapHash);
    for (const [file, digest] of Object.entries(saved.original))
      if (file !== MAP) assert.equal(current[file], digest);
    const document = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.equal(document.entities.find((entity) => entity.id === saved.targetId)?.flip,
      saved.flipped);
    assert.deepEqual(widths(document), saved.savedWidths);
    const layout = await play();
    assert.equal(layout.indexCount, 15);
    assert(layout.outlineCount > 2 && layout.playMap);
    fs.writeFileSync(path.join(out, "p7-vault-reopen.json"),
      JSON.stringify({ current, layout }, null, 2));
    await page.screenshot({ path: path.join(out, "p7-vault-reopen.png"), timeout: 30000 });
    checks.push("Fresh process retains copied links, image widths, play layout and isolated map edit without protected text changes");
  }
  return { edit, reopen };
};
