module.exports = ({ page, fs, path, assert, root, vault, out, checks, chooseTool, waitForFileAbsent }) => {
async function selectionWorkflow() {
  const mapPath = "Dungeons/Auswahl/Karte.dungeon";
  await page.evaluate(async (path) => {
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, mapPath);
  await page.locator(".dn-canvas canvas").waitFor({state: "visible"});
  await chooseTool("Auswahl");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return {
      selected: [...editor.selection],
      objectFlip: editor.session.entities.get("object-1").flip,
      objectLocked: editor.session.entities.get("object-1").locked ?? false,
      lightKind: editor.session.entities.get("light-1")?.kind,
      history: editor.session.historySize,
    };
  });
  const clickWorld = async (x, y, modifier) => {
    const p = await page.evaluate(({x,y}) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer,
        box = renderer.canvas.getBoundingClientRect();
      return {x: box.x + renderer.camera.x + x * renderer.camera.scale,
        y: box.y + renderer.camera.y + y * renderer.camera.scale};
    }, {x,y});
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.click(p.x,p.y);
    if (modifier) await page.keyboard.up(modifier);
  };
  const mirror = page.getByRole("button", {name: "Spiegeln",exact: true});
  const copy = page.getByRole("button", {name: "Kopieren",exact: true});
  const paste = page.getByRole("button", {name: "Einfügen",exact: true});
  const remove = page.getByRole("button", {name: "Löschen",exact: true});
  const setFilter = (title, labels) => page
    .locator('.dn-selection-filter input[type="checkbox"]')
    .evaluateAll((inputs, {title, labels}) => {
      for (const input of inputs) {
        const label = input.getAttribute("aria-label");
        if (!label?.startsWith(title + ": ") || label === title + ": Alle") continue;
        const checked = labels.includes(label.slice(title.length + 2));
        if (input.checked !== checked) {
          input.checked = checked;
          input.dispatchEvent(new Event("change", {bubbles: true}));
        }
      }
    }, {title, labels});
  assert.equal(await page.locator('input[aria-label="Objektarten: Muster"]').count(),1);
  assert.equal(await page.locator('input[aria-label="Objektarten: Materialflächen"]').count(),1);
  assert.equal(await page.locator('input[aria-label="Objektarten: Muster"]').isChecked(),true);
  assert.equal(await page.locator('input[aria-label="Objektarten: Dächer"]').isChecked(),true);
  assert.equal(await page.locator('input[aria-label="Objektarten: Materialflächen"]').isChecked(),false);
  checks.push("Native selection kinds start enabled while editable material surfaces remain opt-in");
  assert.equal(await mirror.isDisabled(), true);
  assert.equal(await copy.isDisabled(), true);
  assert.equal(await paste.isDisabled(), true);
  assert.equal(await remove.isDisabled(), true);
  await clickWorld(10,6);
  assert.deepEqual((await state()).selected,[], "Default Select does not pick painted material");
  await setFilter("Objektarten", ["Wände","Portale","Objekte","Pfade","Lichter","Muster","Dächer","Materialflächen"]);
  await clickWorld(10,6);
  assert.deepEqual((await state()).selected,["material-1"], "Opt-in material filter selects the surface");
  await setFilter("Objektarten", ["Wände","Portale","Objekte","Pfade","Lichter","Muster","Dächer"]);
  checks.push("Painted material is skipped by default and selected only after enabling its extra filter");
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-1"]);
  assert.equal(await mirror.isEnabled(), true);
  assert.equal(await copy.isEnabled(), true);
  assert.equal(await remove.isEnabled(), true);
  await setFilter("Objektarten", ["Lichter"]);
  assert.deepEqual((await state()).selected,["object-1"], "Changing a filter retains the current selection");
  await clickWorld(6,3);
  assert.deepEqual((await state()).selected,[], "The filter excludes new object selections");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  await setFilter("Objektarten", ["Objekte", "Lichter"]);
  await setFilter("Zeichenebenen", ["Feste Ebenen"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,[], "Layer filter excludes objects on user layer 1");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  await setFilter("Zeichenebenen", ["Feste Ebenen", "Benutzerebene 1"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-1"]);
  checks.push("Selection type and layer filters intersect for new clicks and retain the existing selection");
  await mirror.click();
  assert.equal((await state()).objectFlip,true);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal((await state()).objectFlip,false);
  assert.deepEqual((await state()).selected,[], "Undo clears the original selection");
  await clickWorld(3,3);
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("a");
  assert.equal((await state()).objectFlip,true);
  checks.push("Selection Mirror button, A shortcut and Undo change one selected object");
  await copy.click();
  assert.equal(await paste.isEnabled(),true);
  checks.push("Copy and Paste actions follow the current selection and clipboard states");
  await page.evaluate(() => {
    window.__qaSelectionClipboard =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.clipboard;
  });
  await page.locator('input[aria-label="Breite in Feldern"]').focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+z");
  assert.equal(await page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return editor.clipboard === window.__qaSelectionClipboard &&
      editor.session.entities.get("object-1").flip;
  }),true);
  await page.locator(".dn-canvas canvas").focus();
  checks.push("Copy and Undo shortcuts inside a property input do not alter the map selection or history");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  assert.equal(await mirror.isDisabled(),true);
  await clickWorld(3,3);
  await page.getByRole("button",{name:"Sperren",exact:true}).click();
  assert.equal((await state()).objectLocked,true);
  assert.equal(await mirror.isDisabled(),true);
  await clickWorld(0.5,0.5);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,[]);
  await clickWorld(3,3,"Alt");
  assert.deepEqual((await state()).selected,["object-1"]);
  await page.getByRole("button",{name:"Entsperren",exact:true}).click();
  assert.equal((await state()).objectLocked,false);
  assert.equal(await mirror.isEnabled(),true);
  checks.push("Mirror stays disabled for lights and locked objects; Alt selection unlocks the object");
  await page.getByRole("button",{name:"Sperren",exact:true}).click();
  await clickWorld(0.5,0.5);
  await clickWorld(3,3,"Alt");
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("Backspace");
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.has("object-1")),false);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal((await state()).objectLocked,true);
  await clickWorld(3,3,"Alt");
  await page.getByRole("button",{name:"Entsperren",exact:true}).click();
  checks.push("Backspace removes an Alt-selected locked object; Undo restores it with its lock");
  await page.screenshot({path:out+"/selection-mirror.png"});
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() =>
    !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  const saved = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
  const object = saved.entities.find((entity) => entity.id === "object-1");
  assert.equal(object.flip,true);
  assert.equal(object.locked,false);
  checks.push("Selection Mirror and unlock persist in the saved native map");
  const cameraState = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const renderer = editor.renderer;
    const {x,y,scale} = renderer.camera;
    const width = renderer.host.clientWidth, height = renderer.host.clientHeight;
    return {x,y,scale,width,height,rootWidth:editor.root.clientWidth,
      maximized:editor.root.classList.contains("dn-maximized"),
      centerX:(width/2-x)/scale,centerY:(height/2-y)/scale};
  });
  const cameras = {before:await cameraState()};
  await chooseTool("Möbel");
  cameras.object = await cameraState();
  await chooseTool("Auswahl");
  cameras.select = await cameraState();
  await page.getByRole("button",{name:"Vorheriges Werkzeug",exact:true}).click();
  await page.waitForFunction((center) => {
    const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const width=renderer.host.clientWidth,height=renderer.host.clientHeight;
    return Math.abs((width/2-renderer.camera.x)/renderer.camera.scale-center.x)<1e-9 &&
      Math.abs((height/2-renderer.camera.y)/renderer.camera.scale-center.y)<1e-9;
  },{x:cameras.before.centerX,y:cameras.before.centerY});
  cameras.previous = await cameraState();
  fs.writeFileSync(out+"/selection-cameras.json",JSON.stringify(cameras,null,2));
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.tool),"object");
  for (const [stage, current] of Object.entries(cameras)) {
    assert.equal(current.maximized,true,stage + " keeps the maximized editor");
    assert.equal(current.rootWidth,cameras.before.rootWidth,stage + " keeps the editor width");
    assert.ok(current.width>0 && current.height>0,stage + " keeps a visible canvas");
    assert.equal(current.scale,cameras.before.scale,stage + " preserves zoom");
    assert.ok(Math.abs(current.centerX-cameras.before.centerX)<1e-9,stage + " preserves horizontal center");
    assert.ok(Math.abs(current.centerY-cameras.before.centerY)<1e-9,stage + " preserves vertical center");
  }
  checks.push("Previous Tool returns to the last drawing tool without resetting the camera");
  await chooseTool("Auswahl");
  await setFilter("Objektarten",["Objekte"]);
  await setFilter("Zeichenebenen",["Benutzerebene 1"]);
  const worldPoint = (x,y) => page.evaluate(({x,y}) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return {x:box.x+renderer.camera.x+x*renderer.camera.scale,
      y:box.y+renderer.camera.y+y*renderer.camera.scale};
  },{x,y});
  const dragWorld = async (from,to,steps=6) => {
    const a = await worldPoint(...from), b = await worldPoint(...to);
    await page.mouse.move(a.x,a.y);
    await page.mouse.down();
    await page.mouse.move(b.x,b.y,{steps});
    await page.mouse.up();
  };
  await clickWorld(0.5,0.5);
  await dragWorld([1.2,2],[2.8,4]);
  assert.deepEqual((await state()).selected,[],"A box clipping an object without its anchor must not select it");
  await dragWorld([1,1],[8,5]);
  assert.deepEqual(new Set((await state()).selected),new Set(["object-1","object-2"]));
  await dragWorld([3,3],[4,4]);
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-1"),entities.get("object-2")].map(({x,y})=>({x,y}));
  }),[{x:4,y:4},{x:7,y:4}]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-1"),entities.get("object-2")].map(({x,y})=>({x,y}));
  }),[{x:3,y:3},{x:6,y:3}]);
  await dragWorld([1.2,2],[3.2,4],16);
  assert.deepEqual((await state()).selected,["object-1"],"The object is selected when its anchor is inside a clipping box");
  checks.push("Selection marquee, joint movement and one Undo preserve both object positions");
  await setFilter("Objektarten",["Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(11,7);
  assert.deepEqual((await state()).selected,[],"A blank click clears the prior object selection");
  await dragWorld([6.5,1.2],[8.8,3.6]);
  assert.deepEqual((await state()).selected,[],"A box clipping the light symbol without its anchor must not select it");
  await dragWorld([6.5,1.2],[9.2,3.6],16);
  assert.deepEqual((await state()).selected,["light-1"],"The light is selected when its anchor is inside a clipping box");
  await clickWorld(9,3);
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await page.keyboard.press("Control+v");
  const lightCopies = await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      center=editor.renderer.toWorld({x:editor.renderer.host.clientWidth/2,y:editor.renderer.host.clientHeight/2});
    return {center,lights:[...editor.session.entities.values()]
      .filter((entity)=>entity.kind==="light").map(({x,y})=>({x,y}))};
  });
  assert.equal(lightCopies.lights.length,3);
  assert.deepEqual(lightCopies.lights.slice(1),[lightCopies.center,lightCopies.center]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await page.evaluate(() => [...app.workspace
    .getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.values()]
    .filter((entity)=>entity.kind==="light").length),1);
  checks.push("Light copy and repeated paste land at the viewport center; two Undo steps remove the copies");
  await setFilter("Objektarten",["Objekte"]);
  await setFilter("Zeichenebenen",["Benutzerebene 1"]);
  await clickWorld(6,3);
  await dragWorld([6,3],[3,3]);
  const stacking = () => page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      visuals=editor.renderer.visuals,
      first=visuals.get("object-1").container,
      second=visuals.get("object-2").container;
    return {
      order:[...editor.session.entities.keys()],
      drawn:[first.parent.getChildIndex(first),second.parent.getChildIndex(second)],
      hit:editor.renderer.hitTest({x:3,y:3})?.id,
      dirty:editor.session.dirty,
    };
  });
  assert.equal((await stacking()).hit,"object-2");
  await page.getByRole("button",{name:"Ganz nach hinten",exact:true}).click();
  let stack=await stacking();
  assert.deepEqual(stack.order.slice(0,2),["object-2","object-1"]);
  assert(stack.drawn[1]<stack.drawn[0]);
  assert.equal(stack.hit,"object-1");
  assert.equal(stack.dirty,true);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  stack=await stacking();
  assert.deepEqual(stack.order.slice(0,2),["object-1","object-2"]);
  assert.equal(stack.hit,"object-2");
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  assert.deepEqual(JSON.parse(fs.readFileSync(vault+"/"+mapPath,"utf8")).entities.slice(0,2).map(({id})=>id),
    ["object-2","object-1"]);
  checks.push("Overlapping object stack order changes drawing and hit tests, Undo restores it, and save persists the order");
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session,
      source=session.entities.get("object-2"),
      object={...source,id:"object-3",x:3,y:3,layer:200};
    session.execute({label:"Ebenenprobe",entities:[{id:object.id,before:null,after:object}]});
  });
  await setFilter("Zeichenebenen",["Benutzerebene 1","Benutzerebene 2"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  await page.getByRole("button",{name:"Ganz nach hinten",exact:true}).click();
  assert.equal((await stacking()).order[0],"object-3");
  assert.equal((await stacking()).hit,"object-3",
    "The higher numeric layer stays clickable above lower-layer objects after reordering");
  checks.push("Stack actions cross object layers while hit tests still select the visually higher layer");
  await setFilter("Objektarten",["Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(9,3);
  await page.getByRole("button",{name:"Vorlage erstellen",exact:true}).click();
  const prefabModal=page.locator(".modal-container").last();
  await prefabModal.getByRole("button",{name:"Sammlung hinzufügen",exact:true}).click();
  await prefabModal.locator("input").fill("Beispiele");
  await prefabModal.getByRole("button",{name:"Hinzufügen",exact:true}).click();
  assert.equal(await prefabModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await prefabModal.locator("input").fill("Fackel");
  await prefabModal.getByRole("button",{name:"Erstellen",exact:true}).click();
  await page.waitForFunction(() => app.plugins.getPlugin("dungeon-editor").prefabs().length===1);
  const prefabId=await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").prefabs()[0].id);
  await page.getByRole("button",{name:"Vorlage erstellen",exact:true}).click();
  const emptySetModal=page.locator(".modal-container").last();
  assert.equal(await emptySetModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await emptySetModal.getByRole("button",{name:"Sammlung hinzufügen",exact:true}).click();
  await emptySetModal.locator("input").fill("Nur vorübergehend");
  await emptySetModal.getByRole("button",{name:"Hinzufügen",exact:true}).click();
  assert.equal(await emptySetModal.locator('select:not([aria-hidden="true"])').inputValue(),"Nur vorübergehend");
  await emptySetModal.getByRole("button",{name:"Leere Sammlung entfernen",exact:true}).click();
  assert.equal(await emptySetModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await page.keyboard.press("Escape");
  assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length,1);
  checks.push("Removing an empty temporary prefab set restores the previously selected set without saving it");
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.get("light-1").prefabId),prefabId);
  await page.getByRole("button",{name:"Vorlage lösen",exact:true}).click();
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.get("light-1").prefabId),undefined);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.get("light-1").prefabId),prefabId);
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(prefabId);
  await clickWorld(2,6);
  const prefabState=await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      lights=[...editor.session.entities.values()].filter((e)=>e.kind==="light");
    return {lights,tool:editor.tool};
  });
  assert.equal(prefabState.lights.length,2);
  assert.equal(prefabState.tool,"prefab");
  assert.deepEqual([prefabState.lights[1].x,prefabState.lights[1].y],
    [2,6]);
  assert.equal(prefabState.lights[1].prefabId,prefabId);
  assert.deepEqual(
    [prefabState.lights[1].radius,prefabState.lights[1].intensity,
      prefabState.lights[1].color,prefabState.lights[1].shadows],
    [prefabState.lights[0].radius,prefabState.lights[0].intensity,
      prefabState.lights[0].color,prefabState.lights[0].shadows]);
  await clickWorld(7,6);
  const lightCount=() => page.evaluate(() => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity)=>entity.kind==="light").length);
  assert.equal(await lightCount(),3);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await lightCount(),2);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await lightCount(),1);
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  assert.equal(await lightCount(),3);
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.tool),"prefab");
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  await waitForFileAbsent(vault+"/"+mapPath+".draft");
  assert.equal(JSON.parse(fs.readFileSync(vault+"/.obsidian/plugins/dungeon-editor/data.json","utf8")).prefabs.length,1);
  checks.push("Make Prefab persists a named global light drawing, Separate is undoable, and repeated prefab-tool clicks place independent lights with separate Undo steps");
  await chooseTool("Auswahl");
  await setFilter("Objektarten",["Objekte","Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen","Benutzerebene 2"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  await dragWorld([3,3],[4,3]);
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-3"),entities.get("light-1")].map(({x,y})=>({x,y}));
  }),[{x:4,y:3},{x:10,y:3}]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-3"),entities.get("light-1")].map(({x,y})=>({x,y}));
  }),[{x:3,y:3},{x:9,y:3}]);
  assert.deepEqual((await state()).selected,[]);
  checks.push("A mixed object-and-light selection moves together; one Undo restores both positions and clears selection");
  await clickWorld(3,3);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  await copy.click();
  await paste.click();
  const copiedPair=await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return [...editor.selection].map((id) => editor.session.entities.get(id));
  });
  assert.deepEqual(copiedPair.map((entity)=>entity.kind),["object","light"]);
  assert.ok(Math.abs(copiedPair[1].x-copiedPair[0].x-6)<1e-9);
  assert.ok(Math.abs(copiedPair[1].y-copiedPair[0].y)<1e-9);
  const pastedCenterError=await page.evaluate((ids) => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      object=editor.session.entities.get(ids[0]),light=editor.session.entities.get(ids[1]),
      bounds={left:Math.min(object.x-object.width/2,light.x-0.5),
        right:Math.max(object.x+object.width/2,light.x+0.5),
        top:Math.min(object.y-object.height/2,light.y-0.5),
        bottom:Math.max(object.y+object.height/2,light.y+0.5)},
      center=editor.renderer.toWorld({x:editor.renderer.host.clientWidth/2,
        y:editor.renderer.host.clientHeight/2});
    return Math.hypot((bounds.left+bounds.right)/2-center.x,
      (bounds.top+bounds.bottom)/2-center.y);
  },copiedPair.map((entity)=>entity.id));
  assert.ok(pastedCenterError<1e-9,"The pasted pair is centered in the visible viewport");
  await paste.click();
  const secondPair=await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return [...editor.selection].map((id) => editor.session.entities.get(id));
  });
  assert.deepEqual(secondPair.map((entity)=>entity.kind),["object","light"]);
  assert.deepEqual(secondPair.map(({x,y})=>({x,y})),copiedPair.map(({x,y})=>({x,y})));
  const copiedIds=[...copiedPair,...secondPair].map((entity)=>entity.id);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual((await state()).selected,[]);
  assert.deepEqual(await page.evaluate((ids) => ids.map((id) =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.has(id)),copiedIds),[true,true,false,false]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await page.evaluate((ids) => ids.map((id) =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.has(id)),copiedIds),[false,false,false,false]);
  checks.push("Mixed object-and-light Copy/Paste preserves offset and reuses viewport placement; two Undo steps remove each pair");
  await clickWorld(3,3);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  await page.getByRole("button",{name:"Vorlage erstellen",exact:true}).click();
  const mixedModal=page.locator(".modal-container").last();
  assert.equal(await mixedModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await mixedModal.locator("input").fill("Möbellicht");
  await mixedModal.getByRole("button",{name:"Erstellen",exact:true}).click();
  await page.waitForFunction(() => app.plugins.getPlugin("dungeon-editor").prefabs().length===2);
  const mixed=await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs()[1]);
  assert.deepEqual(mixed.entities.map((entity)=>entity.kind),["object","light"]);
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(mixed.id);
  await clickWorld(6,6);
  const mixedCopies=await page.evaluate((id) => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity) => entity.prefabId===id &&
      !["object-3","light-1"].includes(entity.id)),mixed.id);
  assert.equal(mixedCopies.length,2);
  assert.deepEqual(mixedCopies.map((entity)=>entity.kind),["object","light"]);
  assert.deepEqual([mixedCopies[1].x-mixedCopies[0].x,mixedCopies[1].y-mixedCopies[0].y],[6,0]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await page.evaluate((id) => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity) => entity.prefabId===id &&
      !["object-3","light-1"].includes(entity.id)).length,mixed.id),0);
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  await waitForFileAbsent(vault+"/"+mapPath+".draft");
  checks.push("Shift-click creates a mixed object-and-light prefab; click placement preserves both offsets and one Undo restores the pair");
  await chooseTool("Auswahl");
  await setFilter("Objektarten",["Objekte"]);
  await setFilter("Zeichenebenen",["Benutzerebene 2"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  const shape = () => page.evaluate(() => {
    const object=app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.entities.get("object-3");
    return {x:object.x,y:object.y,width:object.width,height:object.height,
      rotation:object.rotation};
  });
  const originalShape=await shape();
  await dragWorld([3.9,3.65],[4.4,4.15]);
  const insetGripShape=await shape();
  assert.ok(insetGripShape.width>originalShape.width &&
    insetGripShape.height>originalShape.height,
  "The inner portion of the corner grip scales instead of moving");
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),originalShape);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  await dragWorld([4.2,3.95],[4.7,4.45]);
  const scaledShape=await shape();
  assert.ok(scaledShape.width>originalShape.width);
  assert.ok(scaledShape.height>originalShape.height);
  assert.ok(Math.abs(scaledShape.width/originalShape.width-
    scaledShape.height/originalShape.height)<1e-9,
  "Corner scaling preserves the object's aspect ratio");
  await dragWorld([6,6],[6,7]);
  const rotatedShape=await shape();
  assert.notEqual(rotatedShape.rotation,scaledShape.rotation);
  const halfWidth=(Math.abs(rotatedShape.width*Math.cos(rotatedShape.rotation))+
    Math.abs(rotatedShape.height*Math.sin(rotatedShape.rotation)))/2,
    halfHeight=(Math.abs(rotatedShape.width*Math.sin(rotatedShape.rotation))+
      Math.abs(rotatedShape.height*Math.cos(rotatedShape.rotation)))/2,
    frameCorner=[rotatedShape.x+halfWidth,rotatedShape.y+halfHeight];
  await dragWorld(frameCorner,[frameCorner[0]+0.5,frameCorner[1]+0.5]);
  const scaledRotatedShape=await shape();
  assert.ok(scaledRotatedShape.width>rotatedShape.width,
    "The axis-aligned grip scales rotated furniture");
  assert.equal(scaledRotatedShape.rotation,rotatedShape.rotation);
  await page.screenshot({path:out+"/selection-transform.png"});
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),rotatedShape);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),scaledShape);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),originalShape);
  checks.push("Single-object inner and outer corner grips scale, outer drag rotates, and rotated furniture scales at its axis-aligned frame with separate Undo steps");
  await setFilter("Objektarten",["Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  const lightRotation = () => page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .session.entities.get("light-1").rotation ?? 0);
  const beforeRotation=await lightRotation();
  await dragWorld([10.8,3],[9,4.8]);
  assert.notEqual(await lightRotation(),beforeRotation);
  await page.screenshot({path:out+"/selection-light-rotation.png"});
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await lightRotation(),beforeRotation);
  checks.push("Selected light rotates around its center, and one Undo restores its angle");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  const lightShape=()=>page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      light=editor.session.entities.get("light-1");
    return {x:light.x,y:light.y,radius:light.radius,
      intensity:light.intensity,rotation:light.rotation??0,
      frame:editor.renderer.selectionLightFrame};
  });
  const originalLight=await lightShape();
  await dragWorld([9.5,3.5],[10,4]);
  const scaledLight=await lightShape();
  assert.ok(scaledLight.x>originalLight.x && scaledLight.y>originalLight.y);
  assert.equal(scaledLight.radius,originalLight.radius);
  assert.equal(scaledLight.intensity,originalLight.intensity);
  assert.equal(scaledLight.rotation,originalLight.rotation);
  assert.ok(scaledLight.frame.width>originalLight.frame.width);
  await page.screenshot({path:out+"/selection-light-scale.png"});
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.dirty);
  const savedLight=JSON.parse(fs.readFileSync(vault+"/"+mapPath,"utf8"))
    .entities.find((entity)=>entity.id==="light-1");
  assert.deepEqual([savedLight.x,savedLight.y,savedLight.radius,
    savedLight.intensity,savedLight.rotation??0],
  [scaledLight.x,scaledLight.y,scaledLight.radius,
    scaledLight.intensity,scaledLight.rotation]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  const restoredLight=await lightShape();
  assert.deepEqual([restoredLight.x,restoredLight.y,restoredLight.radius,
    restoredLight.intensity,restoredLight.rotation],
  [originalLight.x,originalLight.y,originalLight.radius,
    originalLight.intensity,originalLight.rotation]);
  checks.push("Single-light corner grips enlarge the active frame, move the source by half the drag, preserve illumination through save and Undo cleanly");
  const previousLightZoom=await page.evaluate(() => {
    const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer,
      scale=renderer.camera.scale;
    renderer.zoom(32/scale);
    return scale;
  });
  await clickWorld(15,9);
  assert.deepEqual((await state()).selected,[]);
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  const lowZoomLight=await lightShape();
  await dragWorld([9,3],[9.25,3.25]);
  const lowZoomScaled=await lightShape();
  assert.ok(lowZoomScaled.frame.width<lowZoomLight.frame.width,
    "At 50 percent, the native light grip covers the symbol center");
  assert.equal(lowZoomScaled.x,lowZoomLight.x+0.125);
  assert.equal(lowZoomScaled.y,lowZoomLight.y+0.125);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await lightShape(),{...lowZoomLight,frame:undefined});
  assert.deepEqual((await state()).selected,[]);
  await page.evaluate((scale) => {
    const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    renderer.zoom(scale/renderer.camera.scale);
  },previousLightZoom);
  checks.push("At 50 percent zoom, dragging the selected light from its center uses the native top-left scale grip and one Undo restores it");
  await setFilter("Objektarten",["Objekte","Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen","Benutzerebene 2"]);
  await clickWorld(3,3);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  const groupShape = () => page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return ["object-3","light-1"].map((id) => {
      const e=editor.session.entities.get(id);
      return {x:e.x,y:e.y,rotation:e.rotation??0,
        width:e.kind==="object"?e.width:null,
        height:e.kind==="object"?e.height:null,
        radius:e.kind==="light"?e.radius:null};
    });
  });
  const originalGroup=await groupShape();
  const firstFrame=await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .renderer.selectionGroupFrame);
  assert.ok(firstFrame?.width>0);
  const distance=firstFrame.width/2+1;
  await dragWorld([firstFrame.x+distance,firstFrame.y],
    [firstFrame.x+distance*Math.cos(0.65),
      firstFrame.y+distance*Math.sin(0.65)]);
  const rotatedGroup=await groupShape();
  assert.notEqual(rotatedGroup[0].rotation,originalGroup[0].rotation);
  assert.ok(Math.abs(rotatedGroup[0].rotation-rotatedGroup[1].rotation)<1e-9);
  assert.equal(rotatedGroup[1].radius,originalGroup[1].radius);
  const rotatedFrame=await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .renderer.selectionGroupFrame);
  assert.ok(Math.abs(rotatedFrame.rotation)>0.1);
  const c=Math.cos(rotatedFrame.rotation),s=Math.sin(rotatedFrame.rotation),
    corner=(x,y)=>[rotatedFrame.x+x*c-y*s,
      rotatedFrame.y+x*s+y*c],
    scaleStart=corner(rotatedFrame.width/2+0.15,
      rotatedFrame.height/2+0.15),
    scaleEnd=corner(rotatedFrame.width/2+0.65,
      rotatedFrame.height/2+0.65);
  await dragWorld(scaleStart,scaleEnd);
  const scaledGroup=await groupShape();
  assert.ok(scaledGroup[0].width>rotatedGroup[0].width);
  assert.equal(scaledGroup[1].radius,rotatedGroup[1].radius);
  assert.equal(scaledGroup[1].rotation,rotatedGroup[1].rotation);
  await page.screenshot({path:out+"/selection-mixed-transform.png"});
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await groupShape(),rotatedGroup);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await groupShape(),originalGroup);
  checks.push("Mixed object-and-light frame rotates and scales as two shared Undo steps without changing light reach");
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const wall={id:"portal-wall",floorId:"floor-1",kind:"wall",
      points:[{x:2,y:6},{x:6,y:6}],closed:false,smooth:false,
      color:0x665544,width:0.15};
    const bound={id:"portal-bound",floorId:"floor-1",kind:"door",
      anchor:{boundaryId:wall.id,contour:0,at:0.5},width:1,variant:"door"};
    const free={id:"portal-free",floorId:"floor-1",kind:"door",
      x:10,y:6,rotation:0,width:1,variant:"door"};
    session.execute({label:"Portal-Rahmenprobe",entities:[wall,bound,free]
      .map((entity)=>({id:entity.id,before:null,after:entity}))});
  });
  await setFilter("Objektarten",["Portale"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(11,7);
  await dragWorld([2.8,5.3],[5.2,6.7]);
  assert.deepEqual((await state()).selected,[],
    "A wall-bound portal is not captured by a complete marquee");
  await clickWorld(4,6);
  assert.deepEqual((await state()).selected,["portal-bound"],
    "The wall-bound portal remains directly clickable");
  await clickWorld(11,7);
  await dragWorld([9.85,5.3],[10.15,6.7]);
  assert.deepEqual((await state()).selected,["portal-free"],
    "A clipping marquee captures a free portal when its center is inside");
  await clickWorld(11,7);
  await dragWorld([9.3,5.3],[9.7,6.7]);
  assert.deepEqual((await state()).selected,[],
    "A clipping marquee without the free portal center does not capture it");
  await page.screenshot({path:out+"/selection-portals.png"});
  checks.push("Wall-bound portals require direct click; free portals use their center in a marquee");
  await setFilter("Objektarten",["Wände"]);
  await clickWorld(2,6);
  assert.deepEqual((await state()).selected,["portal-wall"],
    "The free wall remains directly clickable");
  await clickWorld(11,7);
  await dragWorld([1.5,5.4],[6.5,6.6]);
  assert.deepEqual((await state()).selected,[],
    "A complete marquee does not select the free wall in the original");
  await page.screenshot({path:out+"/selection-wall.png"});
  checks.push("Free wall direct click works while complete marquee leaves it unselected");
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const roof={id:"selection-roof",floorId:"floor-1",kind:"roof",
      points:[{x:3,y:5},{x:5,y:5},{x:5,y:7},{x:3,y:7}],
      ridge:[{x:3.4,y:6},{x:4.6,y:6}],roofType:"gable",
      color:0x776a60,outlineColor:0x332b29,layer:400};
    session.execute({label:"Dach-Rahmenprobe",entities:[
      {id:roof.id,before:null,after:roof}]});
  });
  await setFilter("Objektarten",["Dächer"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(3.5,5.3);
  assert.deepEqual((await state()).selected,["selection-roof"],
    "The roof remains directly clickable");
  await clickWorld(11,7);
  assert.deepEqual((await state()).selected,[]);
  await dragWorld([2.5,4.5],[4,6]);
  assert.deepEqual((await state()).selected,[],
    "A partial marquee does not select the roof");
  await dragWorld([2.5,4.5],[5.5,7.5]);
  assert.deepEqual((await state()).selected,["selection-roof"],
    "A marquee enclosing the entire roof selects it");
  await page.screenshot({path:out+"/selection-roof.png"});
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const pattern={id:"selection-pattern",floorId:"floor-1",kind:"surface",
      category:"pattern",polygons:[{outer:[{x:6,y:5},{x:8,y:5},
        {x:8,y:7},{x:6,y:7}],holes:[]}],layer:100,
      color:0x7c6c5d,wallColor:0,wallWidth:0};
    session.execute({label:"Muster-Rahmenprobe",entities:[
      {id:pattern.id,before:null,after:pattern}]});
  });
  await setFilter("Objektarten",["Muster"]);
  await setFilter("Zeichenebenen",["Benutzerebene 1"]);
  await clickWorld(7,5.2);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The pattern remains directly clickable");
  await clickWorld(11.5,7.5);
  assert.deepEqual((await state()).selected,[]);
  await dragWorld([5.5,4.5],[7,6],16);
  assert.deepEqual((await state()).selected,[],
    "A partial marquee does not select the pattern");
  await dragWorld([5.5,4.5],[8,7],16);
  assert.deepEqual((await state()).selected,[],
    "A marquee ending exactly at the pattern contour does not select it");
  await dragWorld([5.5,4.5],[8.125,7.125],16);
  assert.deepEqual((await state()).selected,[],
    "The previous movement event has not yet enclosed the pattern");
  await dragWorld([5.5,4.5],[8.25,7.25],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The preceding movement event encloses the pattern");
  await clickWorld(11.5,7.5);
  assert.deepEqual((await state()).selected,[]);
  await dragWorld([6,4.5],[8.5,7.5],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The exact left contour is inside the marquee");
  await clickWorld(11.5,7.5);
  await dragWorld([5.5,5],[8.5,7.5],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The exact top contour is inside the marquee");
  await clickWorld(11.5,7.5);
  await dragWorld([5.5,4.5],[8.5,7.5],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "A marquee enclosing the pattern contour selects it");
  await page.screenshot({path:out+"/selection-pattern.png"});
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  checks.push("Roof direct click and full-extent marquee match the measured original and persist");
  checks.push("Pattern direct click, asymmetric contour bounds and movement-event marquee timing persist");
}
async function selectionReopenWorkflow() {
  const mapPath="Dungeons/Auswahl/Karte.dungeon";
  await page.evaluate(async (path) => {
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  },mapPath);
  await page.locator(".dn-canvas canvas").waitFor({state:"visible"});
  await chooseTool("Auswahl");
  const saved=JSON.parse(fs.readFileSync(vault+"/"+mapPath,"utf8"));
  assert.ok(saved.entities.some((entity)=>entity.id==="selection-roof"));
  assert.ok(saved.entities.some((entity)=>entity.id==="selection-pattern"));
  const existingLights=saved.entities.filter((entity)=>entity.kind==="light").length;
  assert(existingLights>=2);
  const prefabs=await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs());
  assert.equal(prefabs.length,2);
  assert.deepEqual([prefabs[0].set,prefabs[0].name],["Beispiele","Fackel"]);
  assert.deepEqual([prefabs[1].set,prefabs[1].name],["Beispiele","Möbellicht"]);
  const clickAtWorld=async (x,y) => {
    const point=await page.evaluate(({x,y}) => {
      const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer,
        box=renderer.canvas.getBoundingClientRect();
      return {x:box.x+renderer.camera.x+x*renderer.camera.scale,
        y:box.y+renderer.camera.y+y*renderer.camera.scale};
    },{x,y});
    await page.mouse.click(point.x,point.y);
  };
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(prefabs[0].id);
  await clickAtWorld(7,6);
  assert.equal(await page.evaluate(() => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity)=>entity.kind==="light").length),existingLights+1);
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  checks.push("A fresh Obsidian process reloads the named prefab and places another working light");
  const otherPath="Dungeons/Auswahl/Zweite Karte.dungeon";
  const other={...saved,id:"selection-other",settings:{...saved.settings,name:"Zweite Karte"},
    entities:[],content:{definitions:[],occurrences:[],routes:[],archive:[]}};
  await page.evaluate(async ({path,document}) => {
    let file=app.vault.getAbstractFileByPath(path);
    if (file) await app.vault.modify(file,JSON.stringify(document));
    else file=await app.vault.create(path,JSON.stringify(document));
    await app.workspace.getLeaf(false).openFile(file);
  },{path:otherPath,document:other});
  await page.locator(".dn-canvas canvas").waitFor({state:"visible"});
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(prefabs[0].id);
  await clickAtWorld(3,5);
  const otherLights=await page.evaluate(() => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity)=>entity.kind==="light"));
  assert.equal(otherLights.length,1);
  assert.equal(otherLights[0].prefabId,prefabs[0].id);
  assert.equal(otherLights[0].radius,prefabs[0].entities[0].radius);
  assert.deepEqual([otherLights[0].x,otherLights[0].y],[3,5]);
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  assert.equal(JSON.parse(fs.readFileSync(vault+"/"+otherPath,"utf8")).entities.filter((e)=>e.kind==="light").length,1);
  checks.push("The same global prefab places a saved light on a second dungeon map");
}

return { selectionWorkflow, selectionReopenWorkflow };
};
