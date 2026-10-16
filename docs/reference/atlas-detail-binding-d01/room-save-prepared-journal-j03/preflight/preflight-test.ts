
test("J03 preflight: actual visible prepared Room Save retains partial After and fresh entry restores native Before plus exact unsaved draft", async () => {
 const f=await fixture(true),initial=active(f),editor=f.editor()!;
 const oldApp=(globalThis as any).app;(globalThis as any).app={vault:f.vault};
 const room=initial.inventory.records.find(r=>r.kind==='room')!;
 const dungeonPath='Dungeons/E2E-01-Testdungeon/Karte.dungeon',draftPath=aPath+'.draft',journalPath=aPath+'.journal',campaignPath=seed.campaign.path;
 const nativeBefore=new Map(f.vault.bytes);
 await f.host().navigate({kind:'room',documentId:room.documentId,recordId:room.id,roomId:null});
 const text='## Eingang\nJ03: Vorbereiteter Room-Save erhält ungespeicherten Text.  \n\n';
 f.input('[aria-label="Raumtext 1"]',text);await editor.flush();
 const withDraft=new Map(f.vault.bytes),draftBefore=f.vault.bytes.get(draftPath)!;
 const expectedDungeon=JSON.parse(JSON.stringify((initial.repository.detail('dungeon',room.documentId) as any).read().document));
 const camera=editor.renderer.relativeCamera,depth=initial.history.undoDepth;
 const editorRoot=editor.viewport.closest<HTMLElement>('.dn-atlas')!;
 const trash=f.vault.trash.bind(f.vault),process=f.vault.process.bind(f.vault);
 const install=require('/home/aaron/.cache/dungeon-native-qa/hex-04/room-save-prepared-journal-j03-20261011/prepared-save-fault.cjs');
 let closed=false;
 try{
  install({journalPath,draftPath,dungeonPath,campaignPath});
  f.click(f.content.querySelector<HTMLElement>('[aria-label="Atlas speichern"]')!);
  await (editor as any).work;
  const probe=(f.window as any).__roomSavePreparedFault;
  assert.equal(probe.draftDeleteFailures,1);assert(probe.rollbackFailures>=1);
  assert.equal(f.host().state.kind,'unavailable');assert.equal(f.editor(),undefined);
  assert.equal(editorRoot.inert,true);
  assert.equal(editorRoot.querySelector('.dn-atlas-save-status')!.textContent,'Entwurf erhalten; Bearbeitung angehalten.');
  assert.equal(editorRoot.querySelector<HTMLTextAreaElement>('[aria-label="Raumtext 1"]')!.value,text);
  assert.equal(initial.history.undoDepth,depth);assert.deepEqual(editor.renderer.relativeCamera,camera);
  const raw=f.vault.bytes.get(journalPath)!,journal=JSON.parse(raw);
  assert.equal(journal.state,'prepared');assert.equal(journal.writes.length,3);
  assert.deepEqual(journal.writes.map((w:any)=>w.path),[dungeonPath,draftPath,campaignPath]);
  assert.equal(f.vault.bytes.get(dungeonPath),journal.writes[0].after);
  assert.equal(f.vault.bytes.get(draftPath),draftBefore);
  assert.equal(f.vault.bytes.get(campaignPath),nativeBefore.get(campaignPath));
  for(const [path,bytes] of withDraft)if(path!==dungeonPath)assert.equal(f.vault.bytes.get(path),bytes,path);
  assert.deepEqual(JSON.parse(f.vault.bytes.get(dungeonPath)!),expectedDungeon);
  f.vault.trash=trash;f.vault.process=process;
  await f.close();closed=true;
  assert.equal(f.vault.bytes.get(journalPath),raw);
  const app={document:f.document,vault:f.vault} as any;
  const services=atlasCampaignServices(new VaultCampaignRuntimeStorage(app),sha);
  const view=new AtlasView({app,contentEl:f.content,openFile:async()=>{}} as any,services);
  try{
   await view.onLoadFile(f.vault.files.get(aPath)!);
   const fresh=((view as any).campaignHost as AtlasCampaignHost).state;
   assert.equal(fresh.kind,'active');if(fresh.kind!=='active')assert.fail(fresh.reason);
   assert.equal(f.vault.bytes.has(journalPath),false);
   assert.deepEqual(f.vault.bytes,withDraft);
   assert.equal(f.vault.bytes.get(draftPath),draftBefore);
   assert.deepEqual((fresh.repository.detail('dungeon',room.documentId) as any).read().document,expectedDungeon);
   assert.equal(fresh.repository.dirty,true);assert.equal(fresh.repository.hasDraft,true);
   assert.equal(fresh.history.undoDepth,0);assert.equal(fresh.history.canRedo,false);
   const observation={scope:'DOM/Vault adapter preflight, no native Obsidian process',passed:true,source:'54c3ddd53507f358ac99efd8c8d08c2e7edb5902',nativeSaveJournalHandcrafted:false,saveViaVisibleButton:true,journalState:'prepared',writes:journal.writes.map((w:any)=>w.path),fault:probe,onlyDungeonNativePartialAfter:true,campaignBeforeExact:true,draftBeforeExact:true,oldMountUnavailable:true,retainedStatusStopped:true,retainedStateCameraHistoryExact:true,freshNormalFileEntry:true,allOriginalNativeBytesRestored:true,unsavedFullDungeonExact:true,literalMarkdown:text,dirty:true,hasDraft:true,historyDepth:0,canRedo:false,journalAbsent:true,normalElectronQuit:false,nativeFreshProcess:false};
   require('node:fs').writeFileSync('/home/aaron/.cache/dungeon-native-qa/hex-04/room-save-prepared-journal-j03-20261011/preflight-observations.json',JSON.stringify(observation,null,2)+'\n');
  }finally{await view.onUnloadFile();services.close();}
 }finally{
  f.vault.trash=trash;f.vault.process=process;(globalThis as any).app=oldApp;
  if(!closed)await f.close();
 }
});

