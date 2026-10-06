module.exports = ({ page, fs, path, assert, crypto, root, qa, vault, restart, out, checks, chooseTool, sleep }) => {
async function phase6MigrationWorkflow() {
  const mapPath = "Dungeons/Drachenhöhle/Karte.dungeon";
  const overviewPath = "Dungeons/Drachenhöhle/Drachenhöhle.md";
  await page.waitForFunction(() => !!app.plugins.getPlugin("dnd-ot-spielansicht") &&
    !!app.plugins.getPlugin("dungeon-auswertung"), null, { timeout: 15000 });
  const inventory = await page.evaluate(async (mapPath) => {
    const native = app.plugins.getPlugin("dungeon-editor");
    const rooms = await native.readStructuredRoomDocuments(mapPath);
    const doc = JSON.parse(await app.vault.read(app.vault.getAbstractFileByPath(mapPath)));
    return { rooms: rooms.length, sections: rooms.map(r => r.sections.length),
      version: doc.version, occurrences: doc.content.occurrences.length,
      routes: doc.content.routes.length,
      targets: doc.entities.filter(e => e.keyTarget).length,
      roomFiles: app.vault.getMarkdownFiles().filter(f => f.path.startsWith("Dungeons/Drachenhöhle/Räume/")).length };
  }, mapPath);
  assert.equal(inventory.version, 4);
  assert.equal(inventory.rooms, 15);
  assert.equal(inventory.occurrences, 80);
  assert.equal(inventory.routes, 22);
  assert.equal(inventory.targets, 99);
  assert.equal(inventory.roomFiles, 0);
  checks.push("V4 copy opens with 15 virtual keys, 80 occurrences, 22 routes and 99 object targets after room files are removed");
  await page.evaluate(async path => app.plugins.getPlugin("dnd-ot-spielansicht").restoreLayout(path), overviewPath);
  await page.locator(".dnd-index-key .dnd-index-entry").first().waitFor({ state: "attached", timeout: 15000 });
  assert.equal(await page.locator(".dnd-index-key .dnd-index-entry").count(), 15);
  await page.locator(".dn-room-view .dn-key-section").first().waitFor({ timeout: 15000 });
  await page.locator(".dnd-v4-outline-entry").first().waitFor({ timeout: 15000 });
  const initial = await page.evaluate(() => ({
    detail: app.workspace.getLeavesOfType("dungeon-native-room")[0]?.getViewState()?.state,
    outline: document.querySelectorAll(".dnd-v4-outline-entry").length,
    map: !!document.querySelector(".dnd-play-map-pane .dn-map-card"),
  }));
  assert(initial.detail?.roomId);
  assert(initial.outline > 2);
  assert(initial.map);
  checks.push("Spielansicht shows Key list, right room detail, outline and focused native map");
  await page.evaluate(() => app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("dnd-dungeon-key")[0]));
  await page.locator(".dnd-index-key .dnd-v4-room-link").nth(8).click();
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-room")[0]
    ?.view?.panel?.root?.innerText?.includes("9 Schlafhöhle 2"), null, { timeout: 10000 });
  const selected = await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-room")[0]?.getViewState()?.state);
  assert(selected?.roomId && selected.roomId !== initial.detail.roomId);
  checks.push("Key-list mouse click opens room 9 in the right V4 detail pane");
  for (let i=0;i<8;i++) {
    const scale=await page.evaluate(() => app.workspace.getLeavesOfType("dnd-play-map")[0]?.view?.map?.renderer?.camera?.scale||0);
    if(scale>=20)break;
    await page.locator('.dnd-play-map-pane button[aria-label="+"]').click();
  }
  const marker = await page.evaluate(roomId => {
    const pane=app.workspace.getLeavesOfType("dnd-play-map")[0]?.view,card=pane?.map;
    const occurrence=card?.map?.session.content.occurrences.find(item => item.roomId===roomId && item.marker==="C" && item.entityId);
    const entity=occurrence && card.map.session.entities.get(occurrence.entityId);
    if(!entity||!card.renderer?.canvas)return null;
    const canvas=card.renderer.canvas.getBoundingClientRect(),camera=card.renderer.camera;
    const local={x:camera.x+entity.x*camera.scale,y:camera.y+entity.y*camera.scale};
    return {x:canvas.x+local.x,y:canvas.y+local.y,
      canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},local,scale:camera.scale,
      hit:card.renderer.hitTest({x:entity.x,y:entity.y},candidate=>candidate.kind==="object"&&!!candidate.keyTarget)?.id,
      entityId:entity.id,sectionId:occurrence.sectionId,roomId:occurrence.roomId};
  }, selected.roomId);
  assert(marker && marker.x > 0 && marker.y > 0,"Featuremarker C liegt nicht in der Spielkarte");
  fs.writeFileSync(out+"/phase6-marker.json",JSON.stringify(marker,null,2));
  await page.mouse.click(marker.x,marker.y);
  await page.waitForFunction(target => app.workspace.getLeavesOfType("dungeon-native-room")[0]
    ?.getViewState()?.state?.sectionId===target, marker.sectionId, {timeout:10000});
  checks.push("Migrated map marker C opens its exact V4 Key section by mouse click");
  await page.locator(".dnd-v4-outline-entry").filter({ hasText: "C · Spinnennest:" }).click();
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-room")[0]
    ?.getViewState()?.state?.sectionId, null, { timeout: 10000 });
  checks.push("Outline navigates to the selected existing heading");
  const roomText = await page.locator(".dn-room-view .dn-key-content").first().innerText();
  assert.match(roomText, /Ein Ettercap, drei Riesenspinnen und ein Insektenschwarm/);
  await page.screenshot({ path: out + "/phase6-room-key.png", timeout: 15000 });
  await page.evaluate(() => {
    const file = app.vault.getAbstractFileByPath("Dungeons/Drachenhöhle/Drachenhöhle.md");
    const leaf = app.workspace.getLeavesOfType("markdown").find(item => item.view.file?.path === file.path);
    app.workspace.setActiveLeaf(leaf);
  });
  const stable = page.locator('.dnd-play-overview a[href^="obsidian://dungeon-room?"]').first();
  await stable.waitFor({ timeout: 10000 });
  const stableUrl = await stable.getAttribute("href");
  await stable.click();
  const expectedRoom = new URL(stableUrl).searchParams.get("room");
  await page.waitForFunction(id => app.workspace.getLeavesOfType("dungeon-native-room")
    .some(leaf => leaf.getViewState()?.state?.roomId === id), expectedRoom, { timeout: 10000 });
  checks.push("Overview stable room link opens its V4 target without a room Markdown file");
  const reportInput = await page.evaluate(async path => {
    const input = await app.plugins.getPlugin("dungeon-auswertung").readDungeon(path);
    return { rooms: input.rooms.length, documents: input.documents.length,
      virtual: input.documents.filter(doc => doc.path.startsWith("Dungeons/Drachenhöhle/Räume/")).length,
      boss: input.config.bosses[0]?.feature };
  }, overviewPath);
  assert.equal(reportInput.rooms, 15);
  assert.equal(reportInput.virtual, 15);
  assert.match(reportInput.boss, /\[\[Dungeons\/Drachenhöhle\/Räume\/13 Hort#\^hortwache/);
  const report = await page.evaluate(async () => {
    const file = app.vault.getAbstractFileByPath("Dungeons/Drachenhöhle/Auswertung.md");
    await app.workspace.getLeaf("tab").openFile(file, { state: { mode: "preview" } });
    return file.path;
  });
  assert.equal(report, "Dungeons/Drachenhöhle/Auswertung.md");
  await page.locator(".dungeon-report:visible").first().waitFor({ timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll(".dungeon-report")].some(el => el.offsetParent && el.innerText
    ?.includes("Gesamtdungeon")), null, { timeout: 15000 });
  const reportText = await page.locator(".dungeon-report:visible").first().innerText();
  assert(!reportText.includes("Auswertung nicht möglich"), reportText.slice(0, 400));
  checks.push("Legacy Auswertung loads all virtual room documents and renders the existing report");
  await page.screenshot({ path: out + "/phase6-spielansicht.png", timeout: 15000 });
  fs.writeFileSync(out + "/phase6-inventory.json", JSON.stringify({ inventory, initial, selected, reportInput }, null, 2));
}

async function phase5FeatureWorkflow() {
  const mapPath = "Dungeons/Phase5QA/Karte.dungeon";
  const savedPath = qa + "/phase5-feature-saved.json";
  const documentState = () => page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")[0] ??
      app.workspace.getLeavesOfType("dungeon-native-pending")[0];
    return leaf?.view?.editor?.session?.document();
  });
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    await page.evaluate(async (path) => {
      await app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(path));
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor();
    assert.deepEqual(await documentState(), saved.document);
    await page.evaluate(async ({ mapId, roomId, sectionId }) => {
      await app.plugins.getPlugin("dungeon-editor").openRoomLink({
        map: mapId, room: roomId, section: sectionId,
      });
    }, { mapId: saved.document.id, roomId: saved.sourceRoomId,
      sectionId: saved.occurrence.sectionId });
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
    assert.match(await page.locator(".dn-room-view .dn-key-content").innerText(), /Wortlaut für Phase 5/);
    await page.screenshot({ path: out + "/phase5-feature-reopen.png" });
    checks.push("Fresh Obsidian opens the V4 feature and resolves its moved section ID to the new room");
    return;
  }
  await page.evaluate(async () => {
    await app.plugins.getPlugin("dungeon-editor").create("Phase5QA", 26, 14);
  });
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await page.evaluate(async () => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor;
    const session = editor.session, floorId = session.document().floors[0].id;
    const room = (id, number, left) => ({
      id, kind: "building", floorId,
      polygons: [{ outer: [{ x: left, y: 1 }, { x: left + 8, y: 1 },
        { x: left + 8, y: 10 }, { x: left, y: 10 }], holes: [] }],
      layer: 200, number, name: "Raum " + number,
      key: { sections: [{ id: id + "-section", kind: "markdown", markdown: "" }] },
      fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    });
    const first = room("phase5-room-a", "1", 1), second = room("phase5-room-b", "2", 14);
    const object = { id: "phase5-object", kind: "object", floorId, roomId: first.id,
      x: 3, y: 3, rotation: 0, width: 5, height: 5, color: 0xffffff, label: "Altar" };
    session.execute({ label: "QA-Räume und Objekt", entities: [first, second, object].map((entity) =>
      ({ id: entity.id, before: null, after: entity })) });
    const definition = { id: "phase5-definition", name: "Schrein", kind: "feature",
      xp: 0, lootValue: 0 };
    session.execute({ label: "QA-Definition", content: { before: session.content,
      after: { ...session.content, definitions: [definition] } } });
    await editor.select(object.id);
  });
  await page.locator(".dn-group-rail").getByRole("button", { name: "Inhalte", exact: true }).click();
  await page.locator(".dn-tool-rail").getByRole("button", { name: "Dungeon-Inhalte", exact: true }).click();
  await page.locator(".modal-container .modal").last().getByRole("button", {
    name: "Vorkommen anlegen", exact: true }).first().click();
  const modal = page.locator(".modal-container .modal").last();
  await modal.locator("textarea").fill("*Wortlaut für Phase 5.*\n[[QA/Item|Beute]]\n");
  await modal.getByRole("button", { name: "Vorkommen anlegen", exact: true }).click();
  const created = await documentState();
  const occurrence = created.content.occurrences[0];
  assert.equal(occurrence.marker, "A");
  assert.equal(occurrence.entityId, "phase5-object");
  assert.equal(occurrence.roomId, "phase5-room-a");
  assert.equal(created.entities.find((entity) => entity.id === "phase5-object").label, "Altar");
  assert.match(created.entities.find((entity) => entity.id === "phase5-room-a").key.sections
    .find((section) => section.id === occurrence.sectionId).markdown, /Wortlaut für Phase 5/);
  checks.push("V4 feature dialog stores exact Markdown, assigns A and links the selected object without changing its label");
  await page.keyboard.press("Escape");
  await page.evaluate(async ({ roomId, sectionId }) => {
    await app.plugins.getPlugin("dungeon-editor").openRoomKey("Dungeons/Phase5QA/Karte.dungeon", roomId, sectionId);
  }, { roomId: occurrence.roomId, sectionId: occurrence.sectionId });
  const panel = page.locator(".dn-room-view .dn-structured-key");
  await panel.waitFor();
  assert.equal(await panel.locator(".dn-key-content em").count(), 1);
  const roomText = await panel.locator("textarea").inputValue();
  await panel.locator("textarea").fill(roomText.replace("Wortlaut für Phase 5", "Wortlaut für Phase 5, geändert"));
  await panel.getByRole("button", { name: "Übernehmen", exact: true }).click();
  assert.match(await panel.locator(".dn-key-content").innerText(), /Wortlaut für Phase 5, geändert/);
  await page.screenshot({ path: out + "/phase5-feature-linked.png" });
  checks.push("Right room view renders and edits the same linked Markdown section");
  const beforeMove = await documentState();
  await chooseTool("Auswahl");
  const at = (point) => page.evaluate((point) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor;
    const renderer = editor.renderer, box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const start = await at({ x: 3, y: 3 }), end = await at({ x: 16, y: 3 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0]?.view.editor;
    return editor?.session.content.occurrences[0]?.roomId === "phase5-room-b";
  }, undefined, { timeout: 12000 });
  const moved = await documentState();
  assert.equal(moved.content.occurrences[0].sectionId, occurrence.sectionId);
  assert.equal(moved.content.occurrences[0].marker, "A");
  assert.equal(moved.entities.find((entity) => entity.id === "phase5-object").roomId, "phase5-room-b");
  checks.push("Native drag moves object, feature and stable key section in one operation");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.deepEqual(await documentState(), beforeMove);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.deepEqual(await documentState(), moved);
  checks.push("One Undo and Redo restore object, occurrence and key text together");
  await page.evaluate(async () => {
    await app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.save();
  });
  await page.waitForFunction((path) => !!app.vault.getAbstractFileByPath(path), mapPath);
  const saved = await documentState();
  assert.equal(fs.readdirSync(path.dirname(vault + "/" + mapPath)).some((name) => name.endsWith(".md")), false);
  fs.writeFileSync(savedPath, JSON.stringify({ document: saved, occurrence, sourceRoomId: "phase5-room-a" }, null, 2));
  checks.push("Linked V4 map saves without room Markdown files");
  await page.evaluate(async () => {
    await app.plugins.getPlugin("dungeon-editor").openRoomKey(
      "Dungeons/Phase5QA/Karte.dungeon", "phase5-room-b");
  });
  const objectOnCard = await page.evaluate(() => {
    const card = app.workspace.getLeavesOfType("dungeon-native-room")[0].view.card;
    const renderer = card.renderer, box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + 16 * renderer.camera.scale,
      y: box.y + renderer.camera.y + 3 * renderer.camera.scale };
  });
  await page.mouse.click(objectOnCard.x, objectOnCard.y);
  await page.waitForFunction((id) => {
    const view = app.workspace.getLeavesOfType("dungeon-native-room")[0]?.view;
    return view?.sectionId === id;
  }, occurrence.sectionId, { timeout: 12000 });
  checks.push("Clicking the map object opens its exact room-key section");
}

async function phase4KeyWorkflow() {
  const mapPath = "Dungeons/Phase4QA/Karte.dungeon";
  const savedPath = qa + "/phase4-key-saved.json";
  const documentState = () => page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")[0] ??
      app.workspace.getLeavesOfType("dungeon-native-pending")[0];
    return leaf?.view?.editor?.session?.document();
  });
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    await page.evaluate(async (path) => {
      await app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(path));
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor();
    assert.deepEqual(await documentState(), saved.document);
    await page.evaluate(async ({ mapId, roomId, sectionId }) => {
      await app.plugins.getPlugin("dungeon-editor").openRoomLink({
        map: mapId, room: roomId, section: sectionId,
      });
    }, { mapId: saved.document.id, roomId: saved.roomId,
      sectionId: saved.document.entities.find((entity) => entity.id === saved.roomId).key.sections[0].id });
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
    assert.match(await page.locator(".dn-room-view .dn-key-content").innerText(), /Wortlaut für Phase 4/);
    assert.equal(fs.readdirSync(path.dirname(vault + "/" + mapPath)).some((name) => name.endsWith(".md")), false);
    await page.screenshot({ path: out + "/phase4-key-reopen.png" });
    checks.push("Fresh Obsidian process opens the exact V4 map and rendered room section without a room Markdown file");
    return;
  }
  await page.evaluate(async () => {
    await app.plugins.getPlugin("dungeon-editor").create("Phase4QA", 20, 20);
  });
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  assert.equal((await documentState()).version, 4);
  await chooseTool("Raum");
  const at = (point) => page.evaluate((point) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor;
    const renderer = editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const a = await at({ x: 2, y: 2 });
  const b = await at({ x: 9, y: 9 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() =>
    app.workspace.getLeavesOfType("dungeon-native-pending")[0]
      ?.view?.editor?.session?.document()?.entities?.some((entity) =>
        entity.kind === "building" && !entity.number));
  const building = (await documentState()).entities.find((entity) =>
    entity.kind === "building" && !entity.number);
  await page.evaluate(async (id) => {
    await app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.select(id);
  }, building.id);
  await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
  const room = (await documentState()).entities.find((entity) =>
    entity.kind === "building" && entity.number);
  assert(room?.key?.sections?.length === 1);
  assert.equal(room.note, undefined);
  checks.push("Native room tool adopts a V4 room without creating Markdown");
  await page.evaluate(async ({ path, roomId }) => {
    await app.plugins.getPlugin("dungeon-editor").openRoomKey(path, roomId);
  }, { path: mapPath, roomId: room.id });
  const panel = page.locator(".dn-room-view .dn-structured-key");
  await panel.waitFor();
  await panel.locator("textarea").fill("## A · Test:\n*Wortlaut für Phase 4.*\n");
  await panel.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await panel.getByRole("button", { name: "+ Abschnitt", exact: true }).click();
  await panel.locator("textarea").fill("## Zweiter Abschnitt\nNoch ein Text.\n");
  await panel.getByRole("button", { name: "Übernehmen", exact: true }).click();
  assert.match(await panel.locator(".dn-key-content").innerText(), /Wortlaut für Phase 4/);
  assert.equal(await panel.locator(".dn-key-content em").count(), 1);
  const beforeUndo = await documentState();
  await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.session.undo());
  assert.notDeepEqual(await documentState(), beforeUndo);
  await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.session.redo());
  assert.deepEqual(await documentState(), beforeUndo);
  checks.push("Obsidian room view edits exact Markdown sections with formatted preview and undo/redo");
  await page.evaluate(async () => {
    await app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.save();
  });
  await page.waitForFunction((path) => !!app.vault.getAbstractFileByPath(path), mapPath);
  const saved = await documentState();
  assert.equal(saved.version, 4);
  assert.equal(fs.readdirSync(path.dirname(vault + "/" + mapPath)).some((name) => name.endsWith(".md")), false);
  fs.writeFileSync(savedPath, JSON.stringify({ document: saved, roomId: room.id }, null, 2));
  await page.screenshot({ path: out + "/phase4-key-saved.png" });
  checks.push("V4 map saved in isolated Vault with no room Markdown files");
}

async function phase3ObjectWorkflow(view) {
  const mapPath = "Dungeons/Drachenhöhle/Karte.dungeon",
    mapFile = path.join(vault, mapPath),
    savedPath = qa + "/phase3-object-saved.json",
    packPath = process.env.DUNGEON_OBJECT_PACK;
  const hash = (file) => crypto.createHash("sha256")
    .update(fs.readFileSync(file)).digest("hex");
  const protectedFiles = () => {
    const files = {};
    const walk = (directory) => {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, item.name);
        if (item.isDirectory()) walk(absolute);
        else if (absolute !== mapFile)
          files[path.relative(vault, absolute)] = hash(absolute);
      }
    };
    walk(path.join(vault, "Dungeons/Drachenhöhle"));
    return files;
  };
  await page.evaluate(async (path) => {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error("Drachenhöhlenkopie fehlt: " + path);
    await app.workspace.getLeaf("tab").openFile(file);
  }, mapPath);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  const starting = await view(),
    room16 = starting.document.entities.find((entity) =>
      entity.kind === "building" && entity.number === "16"),
    spareBuilding = starting.document.entities.find((entity) =>
      entity.kind === "building" && !entity.number &&
      entity.polygons.some((polygon) =>
        Math.min(...polygon.outer.map((point) => point.x)) === 10 &&
        Math.max(...polygon.outer.map((point) => point.x)) === 15 &&
        Math.min(...polygon.outer.map((point) => point.y)) === 2 &&
        Math.max(...polygon.outer.map((point) => point.y)) === 5));
  assert(room16?.note?.path, "Testraum 16 fehlt");
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    assert.equal(starting.dirty, false);
    assert.deepEqual(starting.document, saved.document);
    assert.equal(hash(mapFile), saved.mapHash);
    assert.deepEqual(protectedFiles(), saved.protected);
    assert.equal(fs.readFileSync(path.join(vault, saved.room17.note.path), "utf8"),
      saved.room17Text);
    await chooseTool("Auswahl");
    await page.evaluate((id) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor;
      editor.renderer.focus(id, 5);
      return editor.select(id);
    }, saved.moved.id);
    await page.waitForFunction((notePath) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        ?.view?.editor;
      return editor?.notePath === notePath &&
        editor.text.value.includes("# 17 Raum 17");
    }, saved.room17.note.path);
    await page.screenshot({ path: out + "/phase3-object-reopen.png" });
    checks.push("Fresh Obsidian process restores both objects, their room IDs and the destination key");
    return;
  }
  assert(packPath && fs.existsSync(packPath), "QA-Objektpaket fehlt");
  assert(spareBuilding, "Unnummerierter angrenzender Grundriss fehlt");
  const protectedBefore = protectedFiles();
  await chooseTool("Raum");
  await page.evaluate(async ({ focusId, selectedId }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor;
    editor.renderer.focus(focusId, 6);
    await editor.select(selectedId);
  }, { focusId: room16.id, selectedId: spareBuilding.id });
  const at = (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect(),
      screen = { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
    if (screen.x < box.x || screen.x >= box.right ||
        screen.y < box.y || screen.y >= box.bottom)
      throw new Error("Testpunkt liegt außerhalb der Karte");
    return screen;
  }, point);
  const drag = async (from, to) => {
    const a = await at(from), b = await at(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
  const room17 = (await view()).document.entities.find((entity) =>
    entity.kind === "building" && entity.number === "17");
  assert(room17?.note?.path, "QA-Raum 17 wurde nicht angelegt");
  checks.push("Adjacent QA room 17 and its key are adopted through the room tool");

  const encoded = fs.readFileSync(packPath).toString("base64");
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    const [record] = await plugin.assets.add([new Blob([bytes])]);
    await plugin.reloadAssets();
    const session = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session;
    const before = session.settings;
    session.execute({ label: "QA-Paket für Karte aktivieren",
      settings: { before, after: { ...before, assetPacks: [record.metadata.id] } } });
  }, encoded);
  const asset = await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").listAssets()
      .find((candidate) => candidate.kind === "object" && candidate.name === "qa_chest"));
  assert(asset, "qa_chest fehlt in der Objektwahl");
  await chooseTool("Möbel");
  await page.getByRole("combobox", { name: "Paketobjekt", exact: true })
    .selectOption(asset.id);
  await page.getByRole("spinbutton", { name: "Breite in Feldern" }).fill("2");
  await page.getByRole("spinbutton", { name: "Höhe in Feldern" }).fill("2");
  await page.evaluate((id) => {
    app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer.focus(id, 6);
  }, room16.id);
  const beforeObjects = await view(),
    beforeIds = new Set(beforeObjects.document.entities.map((entity) => entity.id));
  for (const point of [{ x: 3, y: 3 }, { x: 6, y: 3 }]) {
    const screen = await at(point);
    await page.mouse.click(screen.x, screen.y);
  }
  const placed = await view(),
    additions = placed.document.entities.filter((entity) => !beforeIds.has(entity.id));
  assert.equal(additions.length, 2);
  assert(additions.every((entity) => entity.kind === "object" &&
    entity.roomId === room16.id && entity.assetId === asset.id));
  assert.equal(placed.history, beforeObjects.history + 2);
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.tool),
    "object");
  checks.push("Two consecutive clicks place two distinct room-bound objects without a tool change");

  await chooseTool("Auswahl");
  const firstScreen = await at({ x: 3, y: 3 });
  await page.mouse.click(firstScreen.x, firstScreen.y);
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.selected),
    additions[0].id);
  await page.waitForFunction((notePath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor;
    return editor?.notePath === notePath &&
      editor.text.value.includes("# 16 Raum 16");
  }, room16.note.path);
  await drag({ x: 3, y: 3 }, { x: 12, y: 3 });
  await page.waitForFunction((notePath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor;
    return editor?.notePath === notePath &&
      editor.text.value.includes("# 17 Raum 17");
  }, room17.note.path);
  const movedState = await view(),
    moved = movedState.document.entities.find((entity) => entity.id === additions[0].id),
    still = movedState.document.entities.find((entity) => entity.id === additions[1].id);
  assert.equal(moved?.x, 12);
  assert.equal(moved?.y, 3);
  assert.equal(moved?.roomId, room17.id);
  assert.deepEqual(still, additions[1]);
  assert.equal(movedState.history, placed.history + 1);
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.selected),
    additions[0].id);
  checks.push("Selection drag moves one object and switches its room ID and key context");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.deepEqual((await view()).document, placed.document);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.deepEqual((await view()).document, movedState.document);
  checks.push("One Undo and Redo restore exact positions and room ownership");

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor;
    return !!editor && !editor.session.dirty && !editor.saving;
  }, null, { timeout: 20000 });
  const saved = await view(),
    afterProtected = protectedFiles(),
    room17Path = path.relative(vault, path.join(vault, room17.note.path));
  for (const [file, digest] of Object.entries(protectedBefore))
    assert.equal(afterProtected[file], digest, "Bestandstext geändert: " + file);
  const room17Text = fs.readFileSync(path.join(vault, room17.note.path), "utf8");
  assert.match(room17Text, /^---\nroom_id: /);
  assert.match(room17Text, /# 17 Raum 17/);
  const protectedSaved = { ...afterProtected };
  assert(protectedSaved[room17Path]);
  fs.writeFileSync(savedPath, JSON.stringify({ document: saved.document,
    moved, room17, room17Text, mapHash: hash(mapFile), protected: protectedSaved }, null, 2));
  await page.screenshot({ path: out + "/phase3-object-saved.png" });
  checks.push("V3 map and new QA key save while all existing dungeon texts stay byte-identical");
}

async function phase2ObjectWorkflow(view) {
  const mapPath = "Dungeons/Drachenhöhle/Karte.dungeon",
    savedPath = qa + "/phase2-object-saved.json",
    mapFile = path.join(vault, mapPath),
    packPath = process.env.DUNGEON_OBJECT_PACK;
  const hash = (file) => crypto.createHash("sha256")
    .update(fs.readFileSync(file)).digest("hex");
  const protectedFiles = (base) => {
    const result = {};
    const visit = (directory) => {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, item.name);
        if (item.isDirectory()) visit(absolute);
        else if (absolute !== path.join(base, mapPath))
          result[path.relative(base, absolute)] = hash(absolute);
      }
    };
    visit(path.join(base, "Dungeons/Drachenhöhle"));
    return result;
  };
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error("Drachenhöhlenkopie fehlt: " + mapPath);
    await app.workspace.getLeaf("tab").openFile(file);
  }, mapPath);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
  const room = (await view()).document.entities.find((entity) =>
    entity.kind === "building" && entity.number === "16");
  assert(room?.note?.path, "Der Phase-1-Testraum 16 fehlt");
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    const fresh = await view();
    assert.equal(fresh.dirty, false);
    assert.deepEqual(fresh.document, saved.document);
    assert.equal(hash(mapFile), saved.mapHash);
    assert.deepEqual(protectedFiles(vault), saved.protected);
    const object = fresh.document.entities.find((entity) => entity.id === saved.object.id);
    assert.deepEqual(object, saved.object);
    await page.waitForFunction((id) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        ?.view?.editor?.renderer;
      renderer?.focus(id, 1);
      return !!renderer?.visuals.get(id)?.container.children
        .some((child) => !!child.texture);
    }, object.id, { timeout: 12000 });
    await page.screenshot({ path: out + "/phase2-object-reopen.png" });
    checks.push("Fresh Obsidian process opens the same visible object and unchanged room texts");
    return;
  }
  assert(packPath && fs.existsSync(packPath), "QA-Objektpaket fehlt");
  assert.equal(hash(packPath),
    "fa57fbd15cfb8339b00b0f780b90e6fa2abda743e8ef271b84dbb5eaa74f1628");
  const protectedBefore = protectedFiles(vault);
  const encoded = fs.readFileSync(packPath).toString("base64");
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    const [record] = await plugin.assets.add([new Blob([bytes])]);
    await plugin.reloadAssets();
    const session = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session;
    const before = session.settings;
    session.execute({ label: "QA-Paket für Karte aktivieren",
      settings: { before, after: { ...before, assetPacks: [record.metadata.id] } } });
  }, encoded);
  const asset = await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").listAssets()
      .find((candidate) => candidate.kind === "object" && candidate.name === "qa_chest"));
  assert(asset, "qa_chest fehlt in der Objektwahl");
  await chooseTool("Möbel");
  await page.getByRole("combobox", { name: "Paketobjekt", exact: true })
    .selectOption(asset.id);
  const image = page.locator('img[alt="Paketobjekt Vorschau"]');
  await page.waitForFunction(() =>
    document.querySelector('img[alt="Paketobjekt Vorschau"]')?.naturalWidth > 0);
  assert(await image.isVisible());
  await page.evaluate((roomId) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    renderer.focus(roomId, 1);
  }, room.id);
  const at = (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const screen = {
      x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale,
    };
    if (screen.x < box.x || screen.x >= box.right ||
        screen.y < box.y || screen.y >= box.bottom)
      throw new Error("Testpunkt liegt außerhalb der Karte");
    return screen;
  }, point);
  const initial = await view();
  await page.evaluate((assetId) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor;
    const point = { x: 4, y: 3 };
    editor.renderer.previewObject(point, { ...editor.settings.object, assetId });
    editor.renderer.previewObject(point, { ...editor.settings.object, assetId: undefined });
  }, asset.id);
  await sleep(300);
  assert.equal(await page.evaluate(() => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const stale = !!renderer.objectPreviewSprite;
    renderer.clearObjectPreview();
    return stale;
  }), false, "Ein verspätetes Assetbild darf die neue Vorschau nicht ersetzen");
  const position = await at({ x: 4, y: 3 });
  await page.mouse.move(position.x, position.y);
  await page.waitForFunction((assetId) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor?.renderer;
    return renderer?.objectPreview.visible &&
      renderer.objectPreviewSettings?.assetId === assetId &&
      !!renderer.objectPreviewSprite?.texture;
  }, asset.id, { timeout: 12000 });
  const hover = await page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor;
    return { point: { x: editor.renderer.objectPreview.x,
      y: editor.renderer.objectPreview.y },
      sprite: { width: editor.renderer.objectPreviewSprite.width,
        height: editor.renderer.objectPreviewSprite.height },
      settings: { ...editor.settings.object },
      visible: editor.renderer.objectPreview.visible };
  });
  assert.deepEqual(hover.point, { x: 4, y: 3 });
  assert.equal(hover.sprite.width, hover.settings.width);
  assert.equal(hover.sprite.height, hover.settings.height);
  const beforeClick = await view();
  assert.deepEqual(beforeClick.document, initial.document);
  assert.equal(beforeClick.history, initial.history);
  assert.equal(beforeClick.dirty, initial.dirty);
  await page.screenshot({ path: out + "/phase2-object-hover.png" });
  await page.mouse.move(10, 10);
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer.objectPreview.visible), false);
  await page.mouse.move(position.x, position.y);
  await page.waitForFunction(() =>
    !!app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor?.renderer?.objectPreviewSprite?.texture);
  checks.push("Selected qa_chest visibly follows the cursor without document or history changes");
  await page.mouse.click(position.x, position.y);
  const placed = await view();
  const previousIds = new Set(initial.document.entities.map((entity) => entity.id));
  const additions = placed.document.entities.filter((entity) => !previousIds.has(entity.id));
  assert.equal(additions.length, 1);
  const object = additions[0];
  assert.equal(object.kind, "object");
  assert.equal(object.assetId, asset.id);
  assert.equal(object.roomId, room.id);
  assert.equal(object.x, 4);
  assert.equal(object.y, 3);
  assert.equal(placed.history, initial.history + 1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.deepEqual((await view()).document, initial.document);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.deepEqual((await view()).document, placed.document);
  checks.push("One click places one room-bound object; Undo and Redo restore the exact map state");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor;
    return !!editor && !editor.session.dirty && !editor.saving;
  }, null, { timeout: 20000 });
  const saved = await view();
  assert.deepEqual(protectedFiles(vault), protectedBefore);
  fs.writeFileSync(savedPath, JSON.stringify({
    document: saved.document, object, mapHash: hash(mapFile),
    protected: protectedBefore,
  }, null, 2));
  await page.mouse.move(10, 10);
  await page.screenshot({ path: out + "/phase2-object-saved.png" });
  checks.push("V3 map saves the object while every other copied dungeon file stays byte-identical");
}

return { phase6MigrationWorkflow, phase5FeatureWorkflow, phase4KeyWorkflow, phase3ObjectWorkflow, phase2ObjectWorkflow };
};
