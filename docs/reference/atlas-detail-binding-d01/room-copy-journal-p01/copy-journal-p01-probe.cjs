// QA only. Real visible Copy -> controlled Vault boundary failure -> fresh visible Recovery.
// No handcrafted journal, model/handler writes, hard crash, fixture replay or user vault access.
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
 const stage=process.env.DUNGEON_COPY_JOURNAL_STAGE;assert(['fault','fresh'].includes(stage));
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(vault,f),'utf8'));
 const expected=JSON.parse(fs.readFileSync(path.join(qa,'input-native-hashes.json'),'utf8')),lineage=JSON.parse(fs.readFileSync(path.join(qa,'input-lineage.json'),'utf8'));
 const originalHashes=()=>Object.fromEntries(Object.keys(expected).map(f=>[f,sha(fs.readFileSync(path.join(vault,f)))]));
 const originalPath='Atlanten/Gemeinsamer-Testatlas.overworld',draftPath=originalPath+'.draft',copyName='R03 Kopiejournal P01',copyPath='Atlanten/'+copyName+'.overworld';
 const original=read(originalPath),draft=read(draftPath);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);assert.deepEqual(originalHashes(),expected);
 const originalDocuments=original.placements.map(p=>read('Orte/'+p.locationId+'.location'));
 for(const p of original.detailPlacements){const f=p.kind==='city'?'Städte/'+p.documentId+'.city':'Dungeons/E2E-01-Testdungeon/Karte.dungeon';const delta=draft.details.find(d=>d.id===p.documentId);originalDocuments.push(delta?JSON.parse(delta.after):read(f));}
 const expectedRoom=originalDocuments.find(d=>d.format)?.entities.find(e=>e.id==='00000000-0000-4000-8000-000000000031');assert(expectedRoom);
 const prior=stage==='fresh'?JSON.parse(fs.readFileSync(path.join(qa,'fault-after-normal-quit.json'),'utf8')):null;
 if(prior){assert(prior.normalQuit&&prior.pidsGone&&prior.runnerExit===0);for(const[f,h]of Object.entries(prior.partialNativeHashes))assert.equal(fs.existsSync(path.join(vault,f))?sha(fs.readFileSync(path.join(vault,f))):null,h);}
 else assert(!fs.existsSync(path.join(vault,copyPath)));
 const manifestPath=path.join(root,'tests/fixtures/atlas-e2e-spatial-v2/manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const triplet=Object.fromEntries(['main.js','manifest.json','styles.css'].map(f=>[f,{source:sha(fs.readFileSync(path.join(pluginRoot,f))),installed:sha(fs.readFileSync(path.join(vault,'.obsidian/plugins/dungeon-editor',f)))}]));for(const t of Object.values(triplet))assert.equal(t.source,t.installed);
 const cdp=await page.context().newCDPSession(page),result={kind:'hex-room-copy-prepared-journal-p01',stage,fixtureVersion:manifest.fixtureVersion,fixtureManifestSha256:sha(fs.readFileSync(manifestPath)),inputLineage:lineage,triplet,browserVersion:await cdp.send('Browser.getVersion'),process:resolveQaAppCgroup(),beforeHashes:originalHashes(),originalDraftSha256Before:lineage.actualDraftSha256,copyPath,copyName,priorNormalQuit:prior,syntheticPointer:true,syntheticText:true,physicalInput:false,fixtureReseeded:false,saveReplayed:false,hardCrash:false,journalHandcrafted:false,controlledNativeFault:stage==='fault',outcome:'running'};
 const panel=()=>page.locator('.dn-atlas:visible').last(),viewport=()=>panel().locator('.dn-atlas-viewport'),toolbar=name=>panel().locator('.dn-atlas-toolbar').getByRole('button',{name,exact:true}),room=()=>panel().locator('.dn-atlas-room-key'),text=()=>room().getByRole('textbox',{name:'Raumtext 1',exact:true});
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));});
 const state=()=>page.evaluate(()=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view,w=v.editor.terrain.spatialState(),d=w.detailPlacements.find(p=>p.kind==='dungeon'),h=v.editor.terrain.history;v.assertCurrent();return{file:v.file.path,managed:v.managed,oneRepository:v.editor.terrain===v.repository.terrainSource,oneHistory:h===v.repository.terrainSource.history,spatial:w,world:v.repository.spatialGraph.world(),dungeon:v.repository.detail('dungeon',d.documentId).read().document,depth:h.undoDepth,canRedo:h.canRedo,dirty:v.repository.dirty,draft:v.repository.hasDraft,pending:!!v.editor.pendingKey,camera:v.editor.renderer.camera};});
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
  await page.setViewportSize({width:1024,height:800});await page.evaluate(async f=>app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(f)),originalPath);await viewport().locator('canvas').waitFor({state:'visible'});await settle();
  await toolbar('Atlasinhalt einpassen').click();await toolbar('Hex auswählen').click();await settle();await openOriginalRoom();result.originalBefore=await state();assert(result.originalBefore.managed&&result.originalBefore.oneRepository&&result.originalBefore.oneHistory);assert(result.originalBefore.dirty&&result.originalBefore.draft&&!result.originalBefore.pending);assert.equal(await text().inputValue(),expectedRoom.key.sections[0].markdown);
  const modal=await copyModal();await modal.getByRole('textbox',{name:'Kopiename',exact:true}).fill(copyName);
  if(stage==='fault'){
   await page.evaluate(journalPath=>{
    const probe=window.__hexCopyJournal={journal:null,created:[],createFailures:0,rollbackFailures:0,events:[]};const create=app.vault.create,trash=app.vault.trash;
    app.vault.create=async function(file,bytes,...args){
     if(probe.journal?.writes.some(w=>w.path===file)&&probe.created.length===1){probe.createFailures++;probe.events.push({kind:'controlled_create_failure',path:file});throw new Error('HEX P01 controlled second Copy native create failure');}
     const output=await create.call(this,file,bytes,...args);
     if(file===journalPath){probe.journal=JSON.parse(bytes);probe.events.push({kind:'actual_journal_created',path:file,state:probe.journal.state,transactionId:probe.journal.transactionId});}
     else if(probe.journal?.writes.some(w=>w.path===file)){probe.created.push(file);probe.events.push({kind:'actual_Copy_target_created',path:file});}
     return output;
    };
    app.vault.trash=async function(file,...args){if(probe.created.includes(file.path)){probe.rollbackFailures++;probe.events.push({kind:'controlled_rollback_failure',path:file.path});throw new Error('HEX P01 controlled Copy rollback trash failure');}return trash.call(this,file,...args);};
   },copyPath+'.journal');
   await modal.getByRole('button',{name:'Kopie speichern',exact:true}).click();
   await page.waitForFunction(()=>window.__hexCopyJournal.createFailures===1&&window.__hexCopyJournal.rollbackFailures>=1);await modal.getByRole('status').filter({hasText:'Kopie konnte nicht gespeichert werden.'}).waitFor();assert.equal(await modal.getAttribute('aria-busy'),'false');
   result.visibleFailure=await modal.getByRole('status').innerText();result.nativeFault=await page.evaluate(()=>window.__hexCopyJournal);
   const raw=fs.readFileSync(path.join(vault,copyPath+'.journal'),'utf8'),journal=JSON.parse(raw);assert.equal(journal.state,'prepared');assert.equal(journal.writes.length,7);assert(journal.writes.every(w=>w.before===null&&typeof w.after==='string'));assert.equal(result.nativeFault.created.length,1);assert(!fs.existsSync(path.join(vault,copyPath)));assert.equal(journal.transactionId,result.nativeFault.journal.transactionId);
   const hashes={};for(const w of journal.writes){const full=path.join(vault,w.path),bytes=fs.existsSync(full)?fs.readFileSync(full,'utf8'):null;assert.equal(bytes,result.nativeFault.created.includes(w.path)?w.after:null);hashes[w.path]=bytes===null?null:sha(bytes);}hashes[copyPath+'.journal']=sha(raw);
   result.partialNativeHashes=hashes;result.actualJournal=journal;result.actualJournalSha256=sha(raw);fs.writeFileSync(path.join(out,'actual-prepared-copy-journal.json'),raw);await page.screenshot({path:path.join(out,'visible-copy-write-failure.png')});await modal.getByRole('button',{name:'Abbrechen',exact:true}).click();await settle();result.originalAfterFault=await state();assert.deepEqual(result.originalAfterFault,result.originalBefore);assert.deepEqual(originalHashes(),expected);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);
   result.outcome='actual_native_prepared_Copy_interruption_retained_PASS';checks.push('Visible Copy creates its own seven-write prepared native journal and one real target, then controlled second-target create and rollback trash failures preserve journal/partial After bytes and exact original Room draft/8 native files. Fault stays installed until normal process exit; no synthetic journal or hidden handler.');
   return;
  }
  assert(prior,'Fresh requires verified prior normal quit');result.freshBeforeRecovery=await state();result.preRecoveryJournalSha256=sha(fs.readFileSync(path.join(vault,copyPath+'.journal')));assert.equal(result.preRecoveryJournalSha256,prior.actualJournalSha256);
  await modal.getByRole('button',{name:'Unterbrochene Kopie wiederherstellen',exact:true}).click();await modal.getByRole('status').filter({hasText:'Unvollständige Kopie zurückgenommen.'}).waitFor();result.visibleRecovery=await modal.getByRole('status').innerText();assert.equal(await modal.getAttribute('aria-busy'),'false');assert(!fs.existsSync(path.join(vault,copyPath+'.journal')));for(const w of prior.actualJournal.writes)assert(!fs.existsSync(path.join(vault,w.path)),w.path+' rolled back');result.originalAfterRecovery=await state();assert.deepEqual(result.originalAfterRecovery,result.freshBeforeRecovery);assert.deepEqual(originalHashes(),expected);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);result.preparedTargetsRolledBack=prior.actualJournal.writes.map(w=>w.path);await page.screenshot({path:path.join(out,'fresh-visible-copy-recovery.png')});
  await modal.getByRole('button',{name:'Kopie speichern',exact:true}).click();await page.waitForFunction(p=>{const v=app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1)?.view;return v?.file?.path===p&&v.editor?.terrain.world.name==='R03 Kopiejournal P01'&&!v.managed;},copyPath,{timeout:15000});await viewport().locator('canvas').waitFor({state:'visible'});await settle();
  const native=nativeCopy();result.copyNative=native;await openCopiedRoom(native);result.copiedRuntime=await state();const current=result.copiedRuntime;assert.equal(current.file,copyPath);assert.equal(current.managed,false);assert(current.oneRepository&&current.oneHistory);assert.equal(current.depth,0);assert.equal(current.canRedo,false);assert.equal(current.dirty,false);assert.equal(current.draft,false);assert.equal(current.pending,false);assert.deepEqual(current.spatial,{version:native.world.version,detailPlacements:native.world.detailPlacements});assert.deepEqual(current.world,native.world);assert.deepEqual(current.dungeon,native.dungeon);assert.deepEqual(originalHashes(),expected);assert.equal(sha(fs.readFileSync(path.join(vault,draftPath))),lineage.actualDraftSha256);
  result.originalDraftSha256After=sha(fs.readFileSync(path.join(vault,draftPath)));result.afterHashes=originalHashes();result.copyNativeHashes=native.hashes;await page.screenshot({path:path.join(out,'fresh-recovered-retried-copy-room-key.png')});result.outcome='native_actual_prepared_Copy_fresh_visible_Recovery_and_retry_PASS';checks.push('Actual fresh Obsidian process consumes prior native generated prepared journal through visible Copy Recovery, rolls all seven targets back, leaves whole current original/camera/history/draft unchanged, then visible Copy retry creates seven closed fresh files/23 local IDs with exact Room text/full geometry on one unregistered Repository/History clean0. Original8/Campaign/R03draft exact; normal exit verified separately.');
 }catch(error){result.rawFailure={message:error.message,stack:error.stack};result.outcome='native_prepared_Copy_journal_probe_FAILED';throw error;}
 finally{result.finalHashes=originalHashes();result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'copy-journal-'+stage+'-probe.json'),JSON.stringify(result,null,2));}
}});
module.exports.closureOracle=closureOracle;
