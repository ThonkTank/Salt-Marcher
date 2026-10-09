// Early I01b native island: actual canvas gestures, synthetic input, isolated owned vault only.
module.exports = ({ page, fs, path, assert, out, checks, vault }) => {
  const WORLD = "Atlanten/Hex02 Insel.overworld";
  const viewport = () => page.locator(".dn-atlas-viewport:visible").last();
  const toolbar = () => page.locator(".dn-atlas-toolbar:visible").last();
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function data() {
    return page.evaluate(() => {
      const e = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor;
      return { cells: e.terrain.cells(), refs: e.terrain.references(), depth: e.terrain.history.undoDepth, camera: e.renderer.camera, preview: e.renderer.preview.length };
    });
  }
  async function state() { return viewport().evaluate(el => { const b=el.getBoundingClientRect(); return { x:b.x,y:b.y,w:el.clientWidth,h:el.clientHeight,cx:Number(el.dataset.centerX),cy:Number(el.dataset.centerY),mpp:Number(el.dataset.metersPerPixel) }; }); }
  async function point(q,r) {
    const s=await state(), wx=4828.032*(q+r/2),wy=4828.032*Math.sqrt(3)/2*r;
    const x=s.x+s.w/2+(wx-s.cx)/s.mpp,y=s.y+s.h/2+(wy-s.cy)/s.mpp;
    assert(x>s.x+2&&x<s.x+s.w-2&&y>s.y+2&&y<s.y+s.h-2,`Hex ${q},${r} must be visible`);
    return {x,y};
  }
  async function choose(label) { await toolbar().getByRole("button",{name:label,exact:true}).click(); }
  async function stroke(tool,from,to=from,held=false) {
    await choose(tool); const a=await point(...from),b=await point(...to), before=await data();
    await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y);
    await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.renderer.preview.length>0);
    const preview=await data(); assert.deepEqual(preview.cells,before.cells,"Preview does not mutate committed terrain");
    if(!held) {await page.mouse.up();await page.waitForFunction(d=>app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.terrain.history.undoDepth===d+1,before.depth);await settle();}
    return before;
  }
  async function clickCell(tool,q,r) { return stroke(tool,[q,r]); }
  async function edit() {
    // First-use vault trust can leave commands registered before their modals open reliably.
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => typeof app !== "undefined" && app.workspace?.layoutReady && !!app.plugins.getPlugin("dungeon-editor"));
    await page.setViewportSize({width:1440,height:1000}); await settle();
    await page.locator(".workspace-tab-header:visible").first().click();
    const modal=page.locator(".modal").filter({has:page.getByRole("textbox",{name:"Atlasname",exact:true})});
    await page.evaluate(() => app.commands.executeCommandById("dungeon-editor:create-atlas"));
    await modal.waitFor({state:"visible"});
    await modal.getByRole("textbox",{name:"Atlasname",exact:true}).fill("Hex02 Insel"); await modal.getByRole("button",{name:"Atlas anlegen",exact:true}).click({noWaitAfter:true});
    await viewport().locator("canvas").waitFor({state:"visible"});await settle();
    const original=fs.readFileSync(path.join(vault,WORLD),"utf8");
    await stroke("Land malen",[-3,0],[3,0],true);
    await page.screenshot({path:path.join(out,"01-live-land-preview.png")});
    await page.mouse.up();await page.waitForFunction(()=>app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.terrain.history.undoDepth===1);await settle();
    assert.equal((await data()).cells.length,7,"Sparse long pointer jump paints all seven hexes");
    await stroke("Land malen",[-3,-1],[3,-1]); await stroke("Land malen",[-3,1],[3,1]);
    await stroke("Meer malen",[-4,0],[-4,2]); await stroke("Wald malen",[-1,0],[1,0]);
    const island=await data();assert.equal(island.cells.length,24);assert.equal(island.depth,5);assert.equal(island.cells.filter(c=>c.terrain==="forest").length,3);
    await page.screenshot({path:path.join(out,"02-visible-island.png")}); checks.push("Actual same-canvas Land/Sea/Forest island, sparse seven-hex long jump, live preview and one command per gesture");
    const beforeEscape=await stroke("Land malen",[4,0],[4,2],true); await page.keyboard.press("Escape");
    await page.waitForFunction(d=>app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.terrain.history.undoDepth===d+1,beforeEscape.depth);
    await page.mouse.move((await point(4,3)).x,(await point(4,3)).y); await page.mouse.up(); await settle();
    const escaped=await data();assert.equal(escaped.cells.length,27);assert(!escaped.cells.some(c=>c.q===4&&c.r===3));
    await choose("Atlasänderung rückgängig");await settle();assert.deepEqual((await data()).cells,beforeEscape.cells);
    await choose("Atlasänderung wiederholen");await settle();assert.deepEqual((await data()).cells,escaped.cells);
    checks.push("Original WD004.02 Escape retains held land stroke, exact undo/redo, movement after Escape adds no terrain");
    const field=toolbar().getByRole("textbox",{name:"Landfarbe",exact:true});
    await field.fill("#112233"); await field.press("Tab"); await clickCell("Land malen",-2,2);
    assert.equal((await data()).cells.find(c=>c.q===-2&&c.r===2).color,"#dbc998","Tab must not commit paint color");
    await field.fill("#112233");await field.press("Enter");await clickCell("Land malen",-1,2);assert.equal((await data()).cells.find(c=>c.q===-1&&c.r===2).color,"#112233");
    const textDepth=(await data()).depth;await field.fill("#bb8844");await field.press("Control+z");assert.equal((await data()).depth,textDepth,"Text focus cannot undo the canvas");
    await field.fill("#bb8844");await field.press("Enter");await clickCell("Land malen",0,2);assert.equal((await data()).cells.find(c=>c.q===0&&c.r===2).color,"#bb8844");
    await field.fill("gggggg");await field.press("Enter");await clickCell("Land malen",1,2);assert.equal((await data()).cells.find(c=>c.q===1&&c.r===2).color,"#000000");
    await field.fill("#ff00ff");await field.press("Escape");await clickCell("Land malen",2,2);assert.equal((await data()).cells.find(c=>c.q===2&&c.r===2).color,"#000000","Escape keeps committed paint color");
    checks.push("Bounded original text-color behavior: Tab/Enter/Escape, two colors, invalid black, text CtrlZ isolation; full picker remains open");
    const beforeReset=await data();await clickCell("Gelände zurücksetzen",0,0);assert(!(await data()).cells.some(c=>c.q===0&&c.r===0));
    await choose("Atlasänderung rückgängig");await settle();assert.deepEqual((await data()).cells,beforeReset.cells);
    const beforePan=await data();await choose("Land malen");
    for(let i=0;i<8;i++) {const s=await state();const x=s.x+s.w/2,y=s.y+s.h/2;await page.mouse.move(x,y);await page.mouse.down({button:"middle"});await page.mouse.move(x+400,y,{steps:3});await page.mouse.up({button:"middle"});}
    await settle();assert.deepEqual((await data()).cells,beforePan.cells,"Temporary pan paints no extra terrain");
    await stroke("Land malen",[-34,0],[-31,0]);const far=await data();assert.equal(far.cells.length,beforePan.cells.length+4);
    assert(far.refs.some(c=>c.q===-2&&c.r===0));assert(far.refs.some(c=>c.q===-1&&c.r===0));
    await page.screenshot({path:path.join(out,"03-negative-chunk-boundary.png")});
    await choose("Atlasinhalt einpassen");await settle();const fit=await data();assert.deepEqual(fit.cells,far.cells);
    assert.equal(Number(await viewport().getAttribute("data-visible-terrain-cells")),far.cells.length,"Fit includes all occupied content, including far negative hexes");
    await page.screenshot({path:path.join(out,"04-content-fit.png")});
    assert.equal(fs.readFileSync(path.join(vault,WORLD),"utf8"),original,"I01b preview/command iteration does not pretend to save terrain");
    checks.push("Reset exact undo, temporary pan, boundless negative chunk crossing and content-derived fit without camera/file allocation");
    fs.writeFileSync(path.join(out,"terrain-state.json"),JSON.stringify({island,escaped,far,limits:"I01b visible editing only; Save/draft/fresh-terrain reopening are I01c, not approved here."},null,2));
  }
  return {edit};
};
