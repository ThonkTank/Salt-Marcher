// QA only. Visible Copy modal and Room hit; normal file entry, readonly payload/lifecycle oracles.
const ID_FIELDS=new Set(['id','floorId','roomId','sectionId','doorId','boundaryId','entityId','textId','fromRoomId','toRoomId','startNodeId','endNodeId','plotId','districtId','buildingId','worldId','documentId','atlasId','locationId','cityId','surfaceFloorId','routeId','prerequisites']);
function closureOracle(assert,original,copied,originalDocuments,copiedDocuments){
 const priorIds=new Set(),mapping=new Map(),inverse=new Map();
 const ids=v=>{if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(k==='id'&&typeof x==='string')priorIds.add(x);else ids(x);}};
 ids(original);for(const d of originalDocuments)ids(d);
 const pair=(a,b,inDefinitions=false)=>{
  if(Array.isArray(a)){assert(Array.isArray(b));assert.equal(a.length,b.length);a.forEach((v,i)=>pair(v,b[i],inDefinitions));return;}
  if(a&&typeof a==='object'){assert(b&&typeof b==='object'&&!Array.isArray(b));assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort());for(const[k,x]of Object.entries(a)){if(k==='definitions'){assert.deepEqual(b[k],x);continue;}if(k==='id'&&typeof x==='string'){
    const y=b[k];assert.equal(typeof y,'string');assert.match(y,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert(!priorIds.has(y),'fresh local id');
    if(mapping.has(x))assert.equal(mapping.get(x),y);else{assert(!inverse.has(y),'unique copied local id');mapping.set(x,y);inverse.set(y,x);}
   }else pair(x,b[k],inDefinitions);}
  }
 };
 pair(original,copied);assert.equal(originalDocuments.length,copiedDocuments.length);originalDocuments.forEach((d,i)=>pair(d,copiedDocuments[i]));
 const undo=(v,k='')=>{if(typeof v==='string')return ID_FIELDS.has(k)?inverse.get(v)??v:v;if(Array.isArray(v))return v.map(x=>undo(x,k));if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.entries(v).map(([key,x])=>[key,key==='definitions'?x:undo(x,key)]));};
 const normalized=undo(copied);normalized.name=original.name;assert.deepEqual(normalized,original,'world geometry and closed remapped bindings');
 copiedDocuments.forEach((d,i)=>assert.deepEqual(undo(d),originalDocuments[i],'entire native document preserves every nonidentity field and literal text'));
 return{localIdsRemapped:mapping.size,allLocalIdsFresh:true,closedBindingsAndAllNonidentityFieldsExact:true,idMapping:Object.fromEntries(mapping)};
}
module.exports=({page,fs,path,assert,crypto,root,pluginRoot,vault,qa,out,checks,resolveQaAppCgroup})=>({reopen:async()=>{
 const stage=process.env.DUNGEON_ROOM_COPY_STAGE;assert(['copy','fresh'].includes(stage));
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(vault,f),'utf8'));
 const expected=JSON.parse(fs.readFileSync(path.join(qa,'input-native-hashes.json'),'utf8')),lineage=JSON.parse(fs.readFileSync(path.join(qa,'input-lineage.json'),'utf8'));
 const originalHashes=()=>Object.fromEntries(Object.keys(expected).map(f=>[f,sha(fs.readFileSync(path.join(vault,f)))]));
 const originalPath='Atlanten/Gemeinsamer-Testatlas.overworld',draftPath=originalPath+'.draft',copyName='R03 Raumdraft Kopie C02',copyPath='Atlanten/'+copyName+'.overworld';
 const original=read(originalPath),draft=read(draftPath);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);assert.deepEqual(originalHashes(),expected);
 const originalDocuments=original.placements.map(p=>read('Orte/'+p.locationId+'.location'));
 for(const p of original.detailPlacements){const f=p.kind==='city'?'Städte/'+p.documentId+'.city':'Dungeons/E2E-01-Testdungeon/Karte.dungeon';const delta=draft.details.find(d=>d.id===p.documentId);originalDocuments.push(delta?JSON.parse(delta.after):read(f));}
 const expectedRoom=originalDocuments.find(d=>d.format)?.entities.find(e=>e.id==='00000000-0000-4000-8000-000000000031');assert(expectedRoom);
 const prior=stage==='fresh'?JSON.parse(fs.readFileSync(path.join(qa,'copy-after-normal-quit.json'),'utf8')):null;
 if(prior){assert(prior.normalQuit&&prior.pidsGone&&prior.runnerExit===0);for(const[f,h]of Object.entries(prior.copyNativeHashes))assert.equal(sha(fs.readFileSync(path.join(vault,f))),h);}
 else assert(!fs.existsSync(path.join(vault,copyPath)));
 const manifestPath=path.join(root,'tests/fixtures/atlas-e2e-spatial-v2/manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const triplet=Object.fromEntries(['main.js','manifest.json','styles.css'].map(f=>[f,{source:sha(fs.readFileSync(path.join(pluginRoot,f))),installed:sha(fs.readFileSync(path.join(vault,'.obsidian/plugins/dungeon-editor',f)))}]));for(const t of Object.values(triplet))assert.equal(t.source,t.installed);
 const cdp=await page.context().newCDPSession(page),result={kind:'hex-room-draft-copy-c02',stage,fixtureVersion:manifest.fixtureVersion,fixtureManifestSha256:sha(fs.readFileSync(manifestPath)),inputLineage:lineage,triplet,browserVersion:await cdp.send('Browser.getVersion'),process:resolveQaAppCgroup(),beforeHashes:originalHashes(),originalDraftSha256Before:lineage.actualDraftSha256,copyPath,copyName,priorNormalQuit:prior,syntheticPointer:true,syntheticText:stage==='copy',physicalInput:false,fixtureReseeded:false,saveReplayed:false,outcome:'running'};
 const panel=()=>page.locator('.dn-atlas:visible').last(),viewport=()=>panel().locator('.dn-atlas-viewport'),toolbar=name=>panel().locator('.dn-atlas-toolbar').getByRole('button',{name,exact:true}),room=()=>panel().locator('.dn-atlas-room-key'),text=()=>room().getByRole('textbox',{name:'Raumtext 1',exact:true});
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));});
 const state=()=>page.evaluate(()=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view,w=v.editor.terrain.spatialState(),d=w.detailPlacements.find(p=>p.kind==='dungeon'),h=v.editor.terrain.history;v.assertCurrent();return{file:v.file.path,managed:v.managed,oneRepository:v.editor.terrain===v.repository.terrainSource,oneHistory:h===v.repository.terrainSource.history,world:w,dungeon:v.repository.detail('dungeon',d.documentId).read().document,depth:h.undoDepth,canRedo:h.canRedo,dirty:v.repository.dirty,draft:v.repository.hasDraft,pending:!!v.editor.pendingKey,camera:v.editor.renderer.camera};});
 const openOriginalRoom=async()=>{
  const position=await page.evaluate(()=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;return{marker:v.editor.terrain.placements().find(p=>p.locationId==='00000000-0000-4000-8000-000000000011'),camera:v.editor.renderer.camera};});assert(position.marker);const b=await viewport().boundingBox(),c=position.camera,p=position.marker.position;
  await page.mouse.click(b.x+b.width/2+(p.x-c.center.x)/c.metersPerPixel,b.y+b.height/2+(p.y-c.center.y)/c.metersPerPixel);
  await panel().getByRole('textbox',{name:'Ortsname',exact:true}).waitFor({state:'visible'});await settle();
  const entry=await page.evaluate(()=>app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view.campaignHost.details('00000000-0000-4000-8000-000000000011').entries.find(e=>e.target.kind==='room'&&e.target.recordId==='00000000-0000-4000-8000-000000000031'));assert(entry);
  await panel().locator('.dn-atlas-detail-entry > ul').getByRole('button',{name:entry.label,exact:true}).click();await text().waitFor({state:'visible'});await text().scrollIntoViewIfNeeded();await settle();
 };
 const copyModal=async()=>{await toolbar('Atlas-Kartenmenü').click();await page.locator('.menu:visible .menu-item').filter({hasText:'Speichern unter …'}).click();const modal=page.locator('.modal:visible').filter({hasText:'Atlas speichern unter'});await modal.getByRole('textbox',{name:'Kopiename',exact:true}).waitFor({state:'visible'});return modal;};
 const nativeCopy=()=>{
  const world=read(copyPath),documents=world.placements.map(p=>read('Orte/'+p.locationId+'.location')),files=[copyPath,...world.placements.map(p=>'Orte/'+p.locationId+'.location')];assert.equal(world.name,copyName);
  for(const p of world.detailPlacements){const f=p.kind==='city'?'Städte/'+p.documentId+'.city':'Dungeons/'+p.documentId+'/Karte.dungeon';documents.push(read(f));files.push(f);}
  for(const r of world.chunks){const f='Atlasdaten/'+world.id+'/'+r.file;const before=read('Atlasdaten/'+original.id+'/'+r.file),after=read(f);assert.equal(after.worldId,world.id);assert.deepEqual({...after,worldId:before.worldId},before);files.push(f);}
  assert.equal(files.length,7);assert(!fs.existsSync(path.join(vault,copyPath+'.draft'))&&!fs.existsSync(path.join(vault,copyPath+'.journal')));
  const closure=closureOracle(assert,original,world,originalDocuments,documents),dungeon=documents.find(d=>d.format),copiedRoom=dungeon.entities.find(e=>e.name===expectedRoom.name);assert(copiedRoom);assert.notEqual(copiedRoom.id,expectedRoom.id);assert.deepEqual(copiedRoom.key.sections.map(s=>s.markdown),expectedRoom.key.sections.map(s=>s.markdown));
  return{world,documents,closure,room:copiedRoom,dungeon,hashes:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(vault,f)))]))};
 };
 const openCopiedRoom=async native=>{
  await toolbar('Atlasinhalt einpassen').click();await toolbar('Hex auswählen').click();await settle();
  result.visibleCopyZoomSteps=[];
  // An unregistered Copy has no Campaign detail-link panel. Reach its real Room LOD by ordinary Ctrl-wheel.
  for(let i=0;i<18;i++){
   const focus=await page.evaluate(({owner,polygon})=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view,e=v.editor,f=v.repository.spatialGraph.frame(owner),c=e.renderer.camera;
    const points=polygon.map(p=>{const x=(p.x-f.originUnits.x)*f.metersPerUnit,y=(p.y-f.originUnits.y)*f.metersPerUnit;const wx=f.anchor.x+f.offsetsMeters.reduce((s,p)=>s+p.x,0)+x*Math.cos(f.rotationRadians)-y*Math.sin(f.rotationRadians),wy=f.anchor.y+f.offsetsMeters.reduce((s,p)=>s+p.y,0)+x*Math.sin(f.rotationRadians)+y*Math.cos(f.rotationRadians);return e.renderer.screenPoint({x:wx,y:wy});});
    return{point:{x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length},minPixels:Math.min(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))),viewport:e.renderer.viewport,metersPerPixel:c.metersPerPixel};},{owner:native.dungeon.id,polygon:native.room.polygons[0].outer});
   result.visibleCopyZoomSteps.push(focus);if(focus.minPixels>=120)break;
   assert(focus.point.x>=0&&focus.point.y>=0&&focus.point.x<=focus.viewport.width&&focus.point.y<=focus.viewport.height,'ordinary Fit places the Room zoom focus inside visible canvas');const b=await viewport().boundingBox();await page.mouse.move(b.x+focus.point.x,b.y+focus.point.y);await page.keyboard.down('Control');await page.mouse.wheel(0,-400);await page.keyboard.up('Control');await settle();
  }
  assert(result.visibleCopyZoomSteps.at(-1).minPixels>=120,'ordinary Ctrl-wheel reaches visible Room scale');
  // Readonly hit query identifies a visible Room pixel; only the real canvas click changes selection.
  const point=await page.evaluate(({owner,room})=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view,e=v.editor,b=e.renderer.viewport,c={x:b.width/2,y:b.height/2};for(let radius=0;radius<Math.max(b.width,b.height);radius+=6)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){const p={x:c.x+radius*Math.cos(angle),y:c.y+radius*Math.sin(angle)};if(p.x<8||p.y<8||p.x>b.width-8||p.y>b.height-8||e.renderer.locationAt(p))continue;const hit=e.spatial.hit(p);if(hit?.kind==='room'&&hit.ownerId===owner&&hit.roomId===room)return p;}return null;},{owner:native.dungeon.id,room:native.room.id});assert(point,'copied Room visible through ordinary Fit/select');const b=await viewport().boundingBox();await page.mouse.click(b.x+point.x,b.y+point.y);
  await room().waitFor({state:'visible'});assert.equal(await room().getAttribute('data-room-id'),native.room.id);await text().scrollIntoViewIfNeeded();await settle();
  result.visibleCopiedName=await room().getByRole('textbox',{name:'Raumname',exact:true}).inputValue();result.visibleCopiedNumber=await room().getByRole('textbox',{name:'Raumnummer',exact:true}).inputValue();result.visibleCopiedExactMarkdown=await text().inputValue();assert.equal(result.visibleCopiedName,expectedRoom.name);assert.equal(result.visibleCopiedNumber,expectedRoom.number);assert.equal(result.visibleCopiedExactMarkdown,expectedRoom.key.sections[0].markdown);
 };
 try{
  await page.setViewportSize({width:1024,height:800});await page.evaluate(async f=>app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(f)),stage==='copy'?originalPath:copyPath);await viewport().locator('canvas').waitFor({state:'visible'});await settle();
  if(stage==='copy'){
   await toolbar('Atlasinhalt einpassen').click();await toolbar('Hex auswählen').click();await settle();await openOriginalRoom();result.originalBefore=await state();assert(result.originalBefore.managed&&result.originalBefore.oneRepository&&result.originalBefore.oneHistory);assert(result.originalBefore.dirty&&result.originalBefore.draft&&!result.originalBefore.pending);assert.equal(result.originalBefore.depth,0);assert.equal(await text().inputValue(),expectedRoom.key.sections[0].markdown);
   const cancelled=await copyModal();await cancelled.getByRole('textbox',{name:'Kopiename',exact:true}).fill(copyName);await page.screenshot({path:path.join(out,'copy-modal-before-cancel.png')});await cancelled.getByRole('button',{name:'Abbrechen',exact:true}).click();await settle();result.originalAfterCancel=await state();assert.deepEqual(result.originalAfterCancel,result.originalBefore);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);assert(!fs.existsSync(path.join(vault,copyPath)));assert.deepEqual(originalHashes(),expected);
   const modal=await copyModal();await modal.getByRole('textbox',{name:'Kopiename',exact:true}).fill(copyName);await modal.getByRole('button',{name:'Kopie speichern',exact:true}).click();
   await page.waitForFunction(p=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1)?.view;return v?.file?.path===p&&v.editor?.terrain.world.name==='R03 Raumdraft Kopie C02'&&!v.managed;},copyPath,{timeout:15000});await viewport().locator('canvas').waitFor({state:'visible'});await settle();
  }
  const native=nativeCopy();result.copyNative= native;await openCopiedRoom(native);result.copiedRuntime=await state();const s=result.copiedRuntime;assert.equal(s.file,copyPath);assert.equal(s.managed,false);assert(s.oneRepository&&s.oneHistory);assert.equal(s.depth,0);assert.equal(s.canRedo,false);assert.equal(s.dirty,false);assert.equal(s.draft,false);assert.equal(s.pending,false);assert.deepEqual(s.world,native.world);assert.deepEqual(s.dungeon,native.dungeon);
  assert.deepEqual(originalHashes(),expected);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);if(prior)assert.deepEqual(native.hashes,prior.copyNativeHashes);
  result.originalDraftSha256After=sha(fs.readFileSync(path.join(vault,draftPath)));result.afterHashes=originalHashes();result.copyNativeHashes=native.hashes;await page.screenshot({path:path.join(out,stage==='copy'?'visible-copied-room-key.png':'fresh-process-copied-room-key.png')});result.outcome=stage==='copy'?'native_visible_Copy_Cancel_and_closed_Room_draft_Copy_PASS':'native_actual_Copy_fresh_process_reopen_PASS';
  checks.push('Visible '+stage+' Copy workflow: original eight saved native files/Campaign/actual R03 draft byteexact; seven new native files, fresh closed IDs, exact Room text/full geometry, unregistered copy on one current Repository/History clean0. Synthetic UI, normal quit verified after runner; no reseed/Save replay/direct handler/model writes or copied Campaignmanifest claim.');
 }catch(error){result.rawFailure={message:error.message,stack:error.stack};result.outcome='native_Room_Copy_probe_FAILED';throw error;}
 finally{result.finalHashes=originalHashes();result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'copy-room-'+stage+'-probe.json'),JSON.stringify(result,null,2));}
}});
module.exports.closureOracle=closureOracle;
