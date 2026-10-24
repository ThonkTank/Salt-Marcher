import {validateAtlasReadRequest,type AtlasReadRequest} from '../src/app/atlas-read-request';
import {AtlasWriteActivity} from './atlas-write-activity';
import {clearCampaignStaging,discardCampaignTickets,cancelCampaignTicket} from './campaign-erasure';
import {atlasGeometryTileBox} from '../src/app/atlas-geometry-tile';
import {clearCorruptAtlasTileCaches} from '../src/app/storage/atlas-tile-cache';
import {atlasTerrainTileQuery} from '../src/app/atlas-terrain-tile';
import {atlasMaterialTileQuery} from '../src/app/atlas-material-tile';
import {clearProjectionWork} from '../src/app/storage/atlas-projection-index';
import {openUpdateRuntime} from './update-runtime';
import {UpdateService} from './update-service';
import {terrainSnapshotStillValid} from '../src/app/terrain-presentation';
import {validateTerrainColor} from '../src/app/terrain-color';
import {validateTerrainProjection} from '../src/app/terrain-projection';
import {spatialRoutePreview,closeSpatialRoutePreview} from './terrain-route-service';
import {AtlasRegionService} from './atlas-region';
import {validateRegion} from '../src/app/atlas-region-contracts';
import {RoomDirectoryService} from './room-directory';
import {readItemReferenceCatalog} from '../src/app/storage/item-reference';
import type {NpcCommand,NpcQuery,NpcDraft} from '../src/app/npc-contracts';
import {audioResponse} from './audio-response';
import {extensionPackageLimit} from '../src/app/storage/extensions';
import {dungeonKeyMarkdown,dungeonKeyDocument} from '../src/app/key-document';
import {CommitTracker} from './commit-tracker';
import {dungeonSvg} from '../src/app/drawing-model';
import {PlayerDisplay} from './player-window';
import {installPlayerResources} from './player-resources';
import {citySvg} from '../src/app/city-model';
import {writeFile,mkdir,open} from 'node:fs/promises';
import {checkCampaignContents,campaignMediaPath,type CampaignManifest} from './campaign-files';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import {copyAudio,exportAudioBundle,importAudioBundle,type TransferHooks} from './audio-files';
import { app, BrowserWindow, dialog,shell, ipcMain, protocol, net,screen,nativeImage,session } from 'electron';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { StoreClient } from './store-client';
import { inspectDungeon } from '../src/app/import-dungeon';
import type { Edit, DungeonImportPreview, Result, Room, WorkingRoomDraft, CampaignRename } from '../src/app/contracts';
import type { PreparationCommand, PreparationSelection, PreparationDraft, PreparationEdit } from '../src/app/preparation-contracts';
import type { LiveCommand } from '../src/app/live-contracts';
import type { CombatCommand } from '../src/app/combat-contracts';
import type { ProgressCommand } from '../src/app/progression';
import {exportChronicleFile} from './chronicle-export';
import type {ChronicleCategory} from '../src/app/chronicle-contracts';
import { creatureInfo, searchCreatures, readCreature } from '../src/app/storage/encounters';
import type { CreatureCatalogQuery } from '../src/features/catalog/creature-catalog';
import type { EncounterPlanCommand } from '../src/app/encounter-contracts';
import type { GenerationCommand, GenerationRequest, LootRollCommand } from '../src/app/generation-contracts';
import type { SessionCommand, SessionGenerationRequest } from '../src/app/session-contracts';
import type {SceneRuleCommand} from '../src/app/rule-reference-contracts';
import type {SceneCheckCommand} from '../src/app/scene-check-contracts';
declare const __APP_VERSION__: string;

app.setName('SaltMarcher');

const dataFlag = process.argv.indexOf('--data-dir');
const dataDir = dataFlag >= 0 ? path.resolve(process.argv[dataFlag + 1]!) : path.join(app.getPath('appData'), 'CampaignWorkbench');
mkdirSync(dataDir, { recursive: true }); app.setPath('userData', dataDir);
protocol.registerSchemesAsPrivileged([{ scheme: 'campaign', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let win: BrowserWindow;
  let store: StoreClient;
  const playerOrigin='campaign://player/player-display.html';
  let closeAllowed = false;
  let stopping=false,storeClosed=false;
  let timer:ReturnType<typeof setInterval>|undefined;
  let backupTask:Promise<void>|null=null;
  const activeOperations=new Set<Promise<unknown>>();
  let updateRuntime:Awaited<ReturnType<typeof openUpdateRuntime>>|null=null;
  let backupRunning = false;
  let backupError: string | null = null;
  let campaignErasing=false;
  const finishPendingCampaignErasure=(id:string)=>store.finishCampaignErasureFiles(id);
  const dungeonImportPreviews = new Map<string, { bytes: Buffer; name: string; rooms: Room[] }>();
  const root = path.join(__dirname, 'ui');
  const origin = 'campaign://app/index.html';
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    updateRuntime=await openUpdateRuntime(process.execPath,dataDir);
    const updates=new UpdateService({version:__APP_VERSION__,root:updateRuntime.root,settings:path.join(dataDir,'update-settings.json'),publicKey:updateRuntime.root?await updateRuntime.publicKey():'',emit:status=>{if(win&&!win.isDestroyed())win.webContents.send('update:status',status);}});
    await updates.init();
    store = new StoreClient(path.join(dataDir, 'workbench.sqlite'), __APP_VERSION__);
    await store.ready;
    await clearProjectionWork(path.join(dataDir,'atlas-region-cache'));await clearCorruptAtlasTileCaches(path.join(dataDir,'atlas-region-cache'));
    clearCampaignStaging(dataDir);
    for(const id of (await store.pendingCampaignErasures()))await finishPendingCampaignErasure(id);
    protocol.handle('campaign', async request => {
      const url = new URL(request.url);
      if(url.host==='app'&&url.pathname.startsWith('/audio/')){try{const id=decodeURIComponent(url.pathname.slice(7)),filename=(await store.audioFile(id));return audioResponse(filename,request,(url,options)=>net.fetch(url,options)).catch(()=>new Response('Audio unavailable',{status:404}));}catch{return new Response('Audio unavailable',{status:404});}}
      if(url.pathname.startsWith('/player/art/')&&url.host==='app'){try{const id=decodeURIComponent(url.pathname.split('/').at(-1)!),frame=(await store.currentPlayerFrame());if(frame.mode!=='image'||frame.imageId!==id)return new Response('Image unavailable',{status:404});return net.fetch(pathToFileURL((await store.playerImageFile(id))).href);}catch{return new Response('Image unavailable',{status:404});}}
      const name = url.pathname.slice(1);

      if (url.host !== 'app' || !['index.html', 'renderer.js', 'atlas-brush-worker.js', 'preset-settings.js','preset-settings.css','app.css','player.css',
        'atlas-deck-runtime.js',
        'atlas-fonts/NotoSans-VF.ttf','atlas-fonts/NotoSansSymbols-VF.ttf'].includes(name)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(root, name)).href);
    });
    win = new BrowserWindow({ show:!updateRuntime.transaction, width: 1280, height: 880, minWidth: 640, minHeight: 480, title: 'SaltMarcher', backgroundColor: '#edf1f6',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('campaign://app/') && !details.url.startsWith('campaign://player/') && !details.url.startsWith(pathToFileURL(root + path.sep).href) && !details.url.startsWith(pathToFileURL(path.join(dataDir,'audio')+path.sep).href) && !details.url.startsWith(pathToFileURL(path.join(dataDir,'player-images')+path.sep).href) }));
    const playerSession=session.fromPartition('player-display');
    installPlayerResources(playerSession,{
      windowId:()=>playerDisplay.window?.webContents.id??null,
      current:async()=>{const window=playerDisplay.window;if(!window)return null;const frame=(await playerDisplay.frame()).frame;return{windowId:window.webContents.id,imageId:frame.mode==='image'?frame.imageId??null:null};},
      uiFile:name=>path.join(root,name),imageFile:async id=>(await store.playerImageFile(id)),fetchFile:filename=>net.fetch(pathToFileURL(filename).href),
    });
    const playerDisplay=new PlayerDisplay({
      current:async ()=>(await store.currentPlayerDisplay()),origin:playerOrigin,stopping:()=>stopping||closeAllowed,
      create:()=>{
        const window=new BrowserWindow({width:1280,height:720,minWidth:400,minHeight:300,title:'Spieleranzeige',backgroundColor:'#000000',show:false,webPreferences:{session:playerSession,preload:path.join(__dirname,'player-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
        window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());return window;
      },
      layout:settings=>{const displays=screen.getAllDisplays(),display=displays.find(d=>d.id===settings.displayId)??displays.find(d=>d.id!==screen.getPrimaryDisplay().id)??screen.getPrimaryDisplay();return{bounds:display.workArea,fullscreen:settings.fullscreen};},
      closed:async token=>(await store.closePlayerWindow(token)),
      error:error=>console.error('Spieleranzeige konnte nicht aktualisiert werden.',error instanceof Error?error.message:error),
    });
    ipcMain.handle('player:frame',async event=>{const window=playerDisplay.window;if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==playerOrigin)return{ok:false,error:'Zugriff verweigert.'};return{ok:true,value:await playerDisplay.frame()};});
    const atlasWriteActivity=new AtlasWriteActivity();
    function handle<T>(name: string, operation: (...args: any[]) => T | Promise<T>) {
      ipcMain.handle(name, async (event, ...args): Promise<Result<T>> => {
        if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== origin) return { ok: false, error: 'Zugriff verweigert.' };
        if(stopping&&!name.startsWith('update:'))return {ok:false,error:'SaltMarcher wird für das Update oder Schließen angehalten.'};
        const task=Promise.resolve().then(async()=>{if(campaignErasing)throw Error('Kampagnenlöschung läuft. Danach erneut versuchen.');const value=await operation(...args);if(name.includes(':execute')||['atlas:travel-commit','atlas:commit','atlas:room-commit','atlas:drawing-commit','campaign:activate','campaign:activate-shell','campaign:catalog-shell','campaign:catalog','campaign:catalog-workspace','campaign:transfer-accept','player:window','player:art'].includes(name))await playerDisplay.sync();return value;});if(!name.startsWith('update:'))activeOperations.add(task);
        try { return { ok: true, value:await task }; }
        catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Vorgang fehlgeschlagen.' }; }
        finally{activeOperations.delete(task);}
      });
    }
    handle('campaign:installation-settings',async ()=>(await store.campaignInstallationSettings()));
    async function catalogOperation(c:import('../src/app/campaign-contracts').CampaignCatalogCommand,outcome=false){
      const erasing=c.kind==='erase';
      // Native file operations may await dialogs or streams. Do not delete their bytes mid-flight.
      if(erasing&&(activeOperations.size>1||campaignBusy||audioBusy))throw Error('Laufende Vorgänge zuerst abschließen. Kampagnenlöschung danach erneut versuchen.');
      if(erasing)campaignErasing=true;
      try{
        const result=outcome?(await store.campaignCatalogOutcome(c)):(await store.campaignCatalog(c));
        if(!outcome&&(c.kind==='open'||c.kind==='create'))dungeonImportPreviews.clear();
        if(!outcome&&(c.kind==='trash'||c.kind==='erase')&&currentCampaignSource===c.id){campaignCancelled=true;Atomics.store(new Int32Array(campaignCancel),0,1);}
        if(erasing&&result){
          await backupTask;
          await Promise.all([atlasRegions.cancelAndWait(),atlasExportRegions.cancelAndWait()]);
          discardCampaignTickets(campaignTickets,c.id);
          await finishPendingCampaignErasure(c.id);
        }
        return result;
      }finally{if(erasing)campaignErasing=false;}
    }
    handle('campaign:catalog',(c:import('../src/app/campaign-contracts').CampaignCatalogCommand)=>catalogOperation(c));
    handle('campaign:catalog-outcome',(c:import('../src/app/campaign-contracts').CampaignCatalogCommand)=>catalogOperation(c,true));
    handle('campaign:catalog-shell',async (id:string)=>{roomDirectory.cancel();atlasRoomDirectory.cancel();atlasRegions.cancel();atlasExportRegions.cancel();return (await store.campaignCatalogWorkspace(id,true));});
    handle('campaign:activate-shell',async (id:string)=>{roomDirectory.cancel();atlasRoomDirectory.cancel();atlasRegions.cancel();atlasExportRegions.cancel();dungeonImportPreviews.clear();return (await store.activateShell(id));});
    handle('campaign:workspace-geometry',async (token:string)=>(await store.workspaceGeometry(token)));
    const roomDirectory=new RoomDirectoryService(),atlasRoomDirectory=new RoomDirectoryService(),atlasRegions=new AtlasRegionService(undefined,16*1024*1024,path.join(dataDir,'atlas-region-cache')),atlasExportRegions=new AtlasRegionService(undefined,16*1024*1024,path.join(dataDir,'atlas-region-cache'));
    let graphSourceReadBarrierDepth=0;
    async function withGraphSourceReadBarrier<T>(operation:()=>T|Promise<T>):Promise<T>{
      graphSourceReadBarrierDepth++;
      try{await Promise.all([roomDirectory.cancelAndWait(),atlasRoomDirectory.cancelAndWait(),atlasRegions.cancelAndWait(),atlasExportRegions.cancelAndWait()]);return await operation();}
      finally{graphSourceReadBarrierDepth--;}
    }
    handle('campaign:room-directory-cancel',async (token:string,consumer:'atlas'|'directory'='directory')=>{(await store.roomReadSource(token));if(!['atlas','directory'].includes(consumer))throw new Error('Raumsuche prüfen.');(consumer==='atlas'?atlasRoomDirectory:roomDirectory).cancel();});
    handle('campaign:room-directory',async(token:string,q:import('../src/app/contracts').RoomDirectoryQuery,consumer:'atlas'|'directory'='directory')=>{if(graphSourceReadBarrierDepth)throw new Error('Graphwechsel läuft. Raumsuche danach aktualisieren.');if(!['atlas','directory'].includes(consumer))throw new Error('Raumsuche prüfen.');const source=(await store.roomReadSource(token,q));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');const result=await(consumer==='atlas'?atlasRoomDirectory:roomDirectory).read(source,q);if((await store.roomReadSource(token)).fence!==source.fence)throw new Error('Raumsuche inzwischen geändert. Suche erneut beginnen.');return result;});
    handle('campaign:catalog-workspace',async (id:string)=>(await store.campaignCatalogWorkspace(id)));
    handle('campaign:list', async () => (await store.list()));
    handle('extensions:preview',async()=>{const selected=await dialog.showOpenDialog(win,{title:'Extensionpaket prüfen',properties:['openFile'],filters:[{name:'Extensionpaket (JSON)',extensions:['json']}]});if(selected.canceled||!selected.filePaths[0])return null;const file=await open(selected.filePaths[0],'r');try{if(!(await file.stat()).isFile())throw new Error('Eine Paketdatei wählen.');const bytes=Buffer.alloc(extensionPackageLimit+1);let length=0;while(length<bytes.length){const r=await file.read(bytes,length,bytes.length-length,length);if(!r.bytesRead)break;length+=r.bytesRead;}return (await store.extensionPreview(bytes.subarray(0,length)));}finally{await file.close();}});
    handle('extensions:list',async (after:string|null)=>(await store.extensions(after)));
    handle('extensions:execute',async (command:import('../src/app/extension-contracts').ExtensionCommand)=>(await store.executeExtension(command)));
    handle('extensions:outcome',async (command:import('../src/app/extension-contracts').ExtensionCommand)=>(await store.extensionOutcome(command)));

    handle('campaign:create', async (name: string) => (await store.create(name)));
    handle('campaign:rename', async (command: CampaignRename) => (await store.renameCampaign(command)));
    handle('campaign:activate', async (id: string) => { dungeonImportPreviews.clear(); return (await store.activate(id)); });
    handle('campaign:select', async (token: string, id: string) => (await store.select(token, id)));
    handle('campaign:add-room', async (token: string) => (await store.addRoom(token)));
    handle('campaign:edit', async (edit: Edit) => (await store.edit(edit)));
    handle('campaign:reconcile', async (edit: Edit, token?: string) => (await store.reconcile(edit, token)));
    handle('campaign:room-draft', async (token: string, roomId: string) => (await store.roomDraft(token, roomId)));
    handle('campaign:keep-room-draft', async (token: string, roomId: string, draft: WorkingRoomDraft | null) => (await store.keepRoomDraft(token, roomId, draft)));
    handle('campaign:preparation', async (token: string, search: string) => (await store.preparation(token, search)));
    handle('campaign:note-merge-preview',async (token:string,sourceId:string,targetId:string)=>(await store.noteMergePreview(token,sourceId,targetId)));
    handle('campaign:note-room-uses', async (token:string,id:string,offset:number) => (await store.noteRoomUses(token,id,offset)));
    handle('campaign:note-thread',async (token:string,id:string,offset:number,active:boolean,history=false)=>(await store.noteThread(token,id,offset,active,history)));
    handle('campaign:check-note-thread',async (token:string,s:import('../src/app/note-thread-contracts').NoteThreadSelection)=>(await store.checkNoteThread(token,s)));
    handle('campaign:key-note-choices',async (token:string,query:string)=>(await store.keyNoteChoices(token,query)));
    handle('campaign:capture-key-note', async (c:import('../src/app/key-note-capture-contracts').KeyNoteCaptureCommand) => (await store.captureKeyNote(c)));
    handle('campaign:key-note-capture-status', async (c:import('../src/app/key-note-capture-contracts').KeyNoteCaptureCommand,token:string) => (await store.keyNoteCaptureStatus(c,token)));
    handle('campaign:scene-visits',async (token:string,sceneId:string,after:string|null)=>(await store.sceneVisits(token,sceneId,after)));
    handle('campaign:session-progress',async (token:string,id:string,sceneId?:string)=>(await store.sessionProgress(token,id,sceneId)));
    handle('campaign:session-packet',async (token:string,id:string)=>(await store.sessionPacket(token,id)));
    handle('campaign:session-packet-export',async(token:string,id:string,basis:string)=>{const packet=(await store.sessionPacket(token,id));if(packet.basis!==basis)throw new Error('Mappenquellen geändert. Aktualisiere die Spielabendmappe.');const safe=(packet.planName||'Spielabend').replace(/[\\/:*?"<>|]+/g,'-'),pick=await dialog.showSaveDialog(win,{title:'GM-Spielabendmappe speichern',defaultPath:safe+' – GM-Mappe.md',filters:[{name:'Markdown',extensions:['md']}]});if(pick.canceled||!pick.filePath)return{cancelled:true};await store.exportSessionPacketFile(pick.filePath,packet,token,id,basis);return{cancelled:false};});
    handle('campaign:session', async (token: string,id: string)=>(await store.session(token,id)));
    handle('campaign:execute-session', async (command: SessionCommand)=>(await store.executeSession(command)));
    handle('campaign:generate-session', async (token: string,request: SessionGenerationRequest)=>(await store.generateSession(token,request)));
    handle('campaign:regenerate-session-reward',async (token:string,id:string,index:number,seed:string)=>(await store.regenerateSessionReward(token,id,index,seed)));
    handle('campaign:regenerate-session', async (token: string,id: string,index: number,seed: string)=>(await store.regenerateSessionProposal(token,id,index,seed)));
    handle('campaign:session-runs', async (token: string,id: string)=>(await store.sessionRuns(token,id)));
    handle('campaign:session-run', async (token: string,id: string)=>(await store.sessionRun(token,id)));
    handle('campaign:scene-encounter-selection',async (token:string,id:string)=>(await store.sceneEncounterSelection(token,id)));
    handle('campaign:scene-preparation', async (token: string,id: string)=>(await store.scenePreparation(token,id)));
    handle('campaign:scene-rules',async (token:string,id:string)=>(await store.sceneRules(token,id)));
    handle('campaign:execute-scene-rule',async (command:SceneRuleCommand)=>(await store.executeSceneRule(command)));
    handle('campaign:scene-checks',async (token:string,id:string)=>(await store.sceneChecks(token,id)));
    handle('campaign:execute-scene-check',async (command:SceneCheckCommand)=>(await store.executeSceneCheck(command)));
    handle('campaign:location-activities',async (token:string,q:import('../src/app/location-activity-contracts').LocationActivityQuery)=>(await store.locationActivities(token,q)));
    handle('campaign:location-materials',async (token:string,q:import('../src/app/location-notebook-contracts').LocationMaterialsQuery)=>(await store.locationMaterials(token,q)));
    handle('campaign:world-links',async (token:string,q:import('../src/app/world-links-contracts').WorldLinksQuery)=>(await store.worldLinks(token,q)));
    handle('campaign:change-preparation-content',async (command:PreparationCommand)=>(await store.changePreparationContent(command)));
    handle('campaign:reconcile-preparation-content',async (command:PreparationCommand,token:string)=>(await store.reconcilePreparationContent(command,token)));
    handle('campaign:execute-world-relation-pair',async (command:import('../src/app/world-relation-pair-contracts').WorldRelationPairCommand)=>(await store.executeWorldRelationPair(command)));
    handle('campaign:reconcile-world-relation-pair',async (command:import('../src/app/world-relation-pair-contracts').WorldRelationPairCommand,token:string)=>(await store.reconcileWorldRelationPair(command,token)));
    handle('campaign:world-relation-pair-draft',async (token:string,sourceId:string)=>(await store.worldRelationPairDraft(token,sourceId)));
    handle('campaign:keep-world-relation-pair-draft',async (token:string,draft:import('../src/app/world-relation-pair-contracts').WorldRelationPairDraft,expected:string|null)=>(await store.keepWorldRelationPairDraft(token,draft,expected)));
    handle('campaign:discard-world-relation-pair-draft',async (token:string,sourceId:string,writeId:string)=>(await store.discardWorldRelationPairDraft(token,sourceId,writeId)));
    handle('campaign:world-relation-pair-history',async (token:string)=>(await store.worldRelationPairHistory(token)));
    handle('campaign:execute-world-relation-pair-history',async (command:import('../src/app/world-relation-pair-contracts').WorldRelationPairHistoryCommand)=>(await store.executeWorldRelationPairHistory(command)));
    handle('campaign:reconcile-world-relation-pair-history',async (command:import('../src/app/world-relation-pair-contracts').WorldRelationPairHistoryCommand,token:string)=>(await store.reconcileWorldRelationPairHistory(command,token)));
    handle('campaign:npc-cast',async (token:string,q:import('../src/app/npc-cast-contracts').NpcCastQuery)=>(await store.npcCast(token,q)));
    handle('campaign:npc-building-choices',async (token:string,id:string,q:import('../src/app/npc-places-contracts').NpcBuildingQuery)=>(await store.npcBuildingChoices(token,id,q)));
    handle('campaign:npc-places',async (token:string,id:string,offset:number)=>(await store.npcPlaces(token,id,offset)));
    handle('campaign:npc-plan-calendar',async (token:string)=>(await store.npcPlanCalendar(token)));
    handle('campaign:npc-dossier',async (token:string,sceneId:string,id:string)=>(await store.npcDossier(token,sceneId,id)));
    handle('campaign:npc-drafts',async (token:string)=>(await store.npcDrafts(token)));
    handle('campaign:npc-draft',async (token:string,id:string)=>(await store.npcDraft(token,id)));
    handle('campaign:keep-npc-draft',async (token:string,d:NpcDraft,expected:string|null)=>(await store.keepNpcDraft(token,d,expected)));
    handle('campaign:discard-npc-draft',async (token:string,id:string,writeId:string)=>(await store.discardNpcDraft(token,id,writeId)));
    handle('campaign:npcs',async (token:string,q:NpcQuery)=>(await store.npcs(token,q)));
    handle('campaign:npc',async (token:string,id:string)=>(await store.npc(token,id)));
    handle('campaign:reconcile-npc',async (c:NpcCommand,token:string)=>(await store.reconcileNpc(c,token)));
    handle('campaign:execute-npc',async (c:NpcCommand)=>(await store.executeNpc(c)));
    handle('campaign:generation-sources', async (token:string)=>(await store.generationSources(token)));
    handle('campaign:encounter-tables', async (token: string, trashed: boolean) => (await store.encounterTables(token,trashed)));
    handle('campaign:loot-tables', async (token: string, trashed: boolean) => (await store.lootTables(token,trashed)));
    handle('campaign:preset-registry',async (campaignId:string|null)=>(await store.presetRegistry(campaignId)));
    handle('campaign:preset-command',async (command:import('../src/app/generation-contracts').PresetCommand)=>(await store.presetCommand(command)));
    handle('campaign:preset-outcome',async (command:import('../src/app/generation-contracts').PresetCommand)=>(await store.presetOutcome(command)));
    handle('campaign:generator-registry', async (token: string) => (await store.generatorRegistry(token)));
    handle('campaign:execute-generation', async (command: GenerationCommand) => (await store.executeGeneration(command)));
    handle('campaign:generate-encounters', async (token: string, request: GenerationRequest) => (await store.generateEncounters(token,request)));
    handle('campaign:accept-generation', async (command: Parameters<typeof store.acceptGeneration>[0]) => (await store.acceptGeneration(command)));
    handle('campaign:generation-runs', async (token: string) => (await store.generationRuns(token)));
    handle('campaign:generation-run', async (token: string,id: string) => (await store.generationRun(token,id)));
    handle('campaign:roll-loot', async (command: LootRollCommand) => (await store.rollLoot(command)));
    handle('catalog:items',(query:import('../src/app/item-reference-contracts').ItemReferenceQuery)=>readItemReferenceCatalog(query));
    handle('catalog:info', () => creatureInfo());
    handle('catalog:search', (query: CreatureCatalogQuery) => searchCreatures(query));
    handle('catalog:creature', (id: string) => readCreature(id));
    handle('campaign:encounter-plans', async (token: string, search: string,limit?:number) => (await store.encounterPlans(token,search,limit)));
    handle('campaign:encounter-plan', async (token: string,id: string) => (await store.encounterPlan(token,id)));
    handle('campaign:save-encounter-plan', async (command: EncounterPlanCommand) => (await store.saveEncounterPlan(command)));
    handle('campaign:ledger-parties',async (token:string)=>(await store.ledgerParties(token)));
    handle('campaign:open-item-source',async(token:string,id:string)=>{(await store.live(token));const d=(await store.itemDefinition(id)),url=d.source.url;if(!url||!/^https:\/\/media\.wizards\.com\/2023\/downloads\/dnd\/SRD_CC_v5\.1\.pdf#page=[1-9][0-9]{0,2}$/.test(url))throw new Error('Keine verfügbare SRD-Quellenseite.');await shell.openExternal(url);});
    handle('campaign:treasury-draft',async (token:string,id:string)=>(await store.treasuryDraft(token,id)));
    handle('campaign:keep-treasury-draft',async (token:string,draft:any,expected:string|null)=>(await store.keepTreasuryDraft(token,draft,expected)));
    handle('campaign:discard-treasury-draft',async (token:string,id:string,writeId:string)=>(await store.discardTreasuryDraft(token,id,writeId)));
    handle('campaign:treasure-history',async (token:string,id:string,after:string|null)=>(await store.treasureHistory(token,id,after)));
    handle('campaign:scene-desk',async (token:string,id:string)=>(await store.sceneDesk(token,id)));
    handle('campaign:search-desk',async (token:string,kind:string,search:string,offset:number)=>(await store.searchDesk(token,kind,search,offset)));
    handle('campaign:desk-content',async (token:string,ref:any)=>(await store.deskContent(token,ref)));
    handle('campaign:pin-scene-desk',async (token:string,id:string,revision:number,ref:any,pin:boolean)=>(await store.pinSceneDesk(token,id,revision,ref,pin)));
    handle('campaign:scene-creation-draft',async (token:string,id:string)=>(await store.sceneCreationDraft(token,id)));
    handle('campaign:keep-scene-creation-draft',async (token:string,id:string,draft:any,expected:string|null)=>(await store.keepSceneCreationDraft(token,id,draft,expected)));
    handle('campaign:keep-desk-draft',async (token:string,draft:any,expected:string|null)=>(await store.keepDeskDraft(token,draft,expected)));
    handle('campaign:finish-draft',async (token:string,owner:any)=>(await store.finishDraft(token,owner)));
    handle('campaign:keep-finish-draft',async (token:string,draft:any,expected:string|null)=>(await store.keepFinishDraft(token,draft,expected)));
    handle('campaign:discard-finish-draft',async (token:string,owner:any,writeId:string)=>(await store.discardFinishDraft(token,owner,writeId)));
    handle('campaign:keep-narrative-draft',async (token:string,draft:any,expected:string|null)=>(await store.keepNarrativeDraft(token,draft,expected)));
    handle('campaign:discard-narrative-draft',async (token:string,id:string,writeId:string)=>(await store.discardNarrativeDraft(token,id,writeId)));
    handle('campaign:narrative-journal',async (token:string,query:import('../src/app/narrative-journal-contracts').NarrativeJournalQuery)=>(await store.narrativeJournal(token,query)));
    handle('campaign:narrative',async (token:string,id:string)=>(await store.narrative(token,id)));
    handle('campaign:progress-history', async (token: string, characterId: string, after: string | null) => (await store.progressHistory(token, characterId, after)));
    handle('campaign:adventuring-day',async (token:string,request:import('../src/app/adventuring-day-contracts').DayRequest)=>(await store.adventuringDay(token,request)));
    handle('campaign:progress', async (token: string) => (await store.progress(token)));
    handle('campaign:treasures', async (token: string, after: string | null,query?:import('../src/app/treasury-contracts').TreasureQuery) => (await store.treasures(token, after,query)));
    handle('campaign:treasure', async (token: string, id: string) => (await store.treasure(token, id)));
    handle('campaign:ledger', async (token: string, query: import('../src/app/progression').LedgerQuery) => (await store.ledger(token, query)));
    handle('campaign:ledger-inventory',async (token:string,query:import('../src/app/progression').LedgerInventoryQuery)=>(await store.ledgerInventory(token,query)));
    handle('campaign:ledger-item', async (token: string, id: string) => (await store.ledgerItem(token, id)));
    const campaignJobsRoot=path.join(dataDir,'campaign-jobs');await mkdirSync(campaignJobsRoot,{recursive:true});
    type CampaignTicket={dir:string;manifest:CampaignManifest;copy:boolean;fence:{id:string;revision:number}|null;basis?:string;problems?:string[]};
    const campaignTickets=new Map<string,CampaignTicket>();let campaignBusy=false,campaignCancelled=false,audioBusy=false,audioCancelled=false,currentCampaignSource:string|null=null,acceptingTicket:string|null=null;let acceptanceFinished:Promise<void>|null=null;
    const campaignProgress=(p:import('../src/app/campaign-contracts').CampaignTransferProgress)=>{if(!win.isDestroyed())win.webContents.send('campaign:transfer-progress',p);};
    async function campaignJob<T>(fn:()=>Promise<T>){
      if(campaignBusy||audioBusy)throw new Error('Eine Kampagnen- oder Medienübertragung läuft bereits.');
      campaignBusy=true;campaignCancelled=false;Atomics.store(new Int32Array(campaignCancel),0,0);
      try{
        campaignProgress({phase:'Kampagnenübertragung vorbereiten',records:0,bytes:0,busy:true});
        return await fn();
      }finally{campaignBusy=false;currentCampaignSource=null;campaignProgress({phase:campaignCancelled?'Abgebrochen':'Fertig',records:0,bytes:0,busy:false});}
    }
    const campaignCancel=new SharedArrayBuffer(4);
    function campaignAuthority(fence:CampaignTicket['fence']){return{fence,cancel:campaignCancel};}
    store.on('progress',campaignProgress);
    async function captureCampaign(token:string){
      const dir=await mkdtemp(path.join(campaignJobsRoot,'snapshot-')),dbFile=path.join(dir,'campaign.sqlite');
      try{
        const snapshot=await store.campaignSnapshot(token,dbFile);currentCampaignSource=snapshot.id;
        const fence={id:snapshot.id,revision:snapshot.fence},authority=campaignAuthority(fence),media=new Map(snapshot.media.map(f=>[f.name,f]));
        const files=[{name:'campaign.sqlite',filename:dbFile},...snapshot.media.map(f=>({name:f.name,filename:campaignMediaPath(dataDir,f.name)})),
          {name:'catalog/srd-5.1.generated.json',filename:path.join(__dirname,'catalog','srd-5.1.generated.json')},
          {name:'catalog/srd-5.1-attribution.md',filename:path.join(__dirname,'catalog','SRD-5.1-ATTRIBUTION.md')}];
        const manifest:CampaignManifest={format:'Kampagnenwerkstatt Campaign',version:1,campaignId:snapshot.id,name:snapshot.name,applicationVersion:__APP_VERSION__,schema:snapshot.schema,createdAt:new Date().toISOString(),files:[]};
        for(const file of files){
          const actual={name:file.name,sha256:await store.campaignFileDigest(file.filename,authority),bytes:(await stat(file.filename)).size},expected=media.get(file.name);
          if(expected&&(actual.sha256!==expected.sha256||actual.bytes!==expected.bytes))throw new Error('Kampagnenmedien fehlen oder sind verändert: '+file.name);
          manifest.files.push(actual);
        }
        checkCampaignContents(manifest,snapshot);if(campaignCancelled)throw new Error('Kampagnenübertragung abgebrochen.');await store.campaignFence(fence.id,fence.revision);
        return{dir,manifest,files,fence};
      }catch(e){await rm(dir,{recursive:true,force:true});throw e;}
    }
    async function campaignPreview(ticket:CampaignTicket){
      try{
        const preview=(await store.campaignPreview(path.join(ticket.dir,'campaign.sqlite')));
        checkCampaignContents(ticket.manifest,preview);
        const catalog=ticket.manifest.files.find(f=>f.name==='catalog/srd-5.1.generated.json'),problems:string[]=[];
        if(!catalog||catalog.sha256!==await store.campaignFileDigest(path.join(__dirname,'catalog','srd-5.1.generated.json'),campaignAuthority(ticket.fence)))problems.push('Der Kreaturkatalog des Pakets passt nicht zu dieser Produktversion.');
        const key=randomUUID();ticket.basis=JSON.stringify(preview.conflicts);ticket.problems=problems;campaignTickets.set(key,ticket);
        return{ticket:key,name:preview.name,campaignId:preview.id,applicationVersion:ticket.manifest.applicationVersion,schema:preview.schema,counts:preview.counts,audioFiles:ticket.manifest.files.filter(f=>f.name.startsWith('audio/')).length,bytes:ticket.manifest.files.reduce((n,f)=>n+f.bytes,0),conflicts:preview.conflicts,problems,copy:ticket.copy};
      }catch(error){await rm(ticket.dir,{recursive:true,force:true});throw error;}
    }
    handle('campaign:overview',async ()=>(await store.campaignOverview()));
    handle('campaign:export', (token:string)=>campaignJob(async()=>{
      const campaign=(await store.campaignIdentity(token));
      const selection=await dialog.showSaveDialog(win,{title:'Kampagne vollständig exportieren',defaultPath:campaign.name+'.kwcampaign',filters:[{name:'SaltMarcher Kampagne',extensions:['kwcampaign']}]});
      if(selection.canceled||!selection.filePath||campaignCancelled)return{cancelled:true};
      const capture=await captureCampaign(token);
      try{await store.exportCampaignFile(selection.filePath,capture.manifest,capture.files,campaignAuthority(capture.fence));return{cancelled:false};}
      finally{await rm(capture.dir,{recursive:true,force:true});}
    }));
    handle('campaign:copy-preview',(token:string)=>campaignJob(async()=>{const capture=await captureCampaign(token);return campaignPreview({dir:capture.dir,manifest:capture.manifest,copy:true,fence:capture.fence});}));
    handle('campaign:import-preview',()=>campaignJob(async()=>{const selection=await dialog.showOpenDialog(win,{title:'Kampagnenpaket auswählen',properties:['openFile'],filters:[{name:'SaltMarcher Kampagne',extensions:['kwcampaign']}]});if(selection.canceled)return null;const extracted=await store.extractCampaignFile(selection.filePaths[0]!,campaignJobsRoot,campaignAuthority(null));return campaignPreview({...extracted,copy:false,fence:null});}));
    handle('campaign:transfer-status',async (ticketId:string)=>{
      const pending=acceptingTicket===ticketId;const campaign=(await store.campaignTransferOutcome(ticketId));
      return campaign?{state:'applied' as const,campaign}:{state:pending||acceptingTicket===ticketId?'pending' as const:'not-applied' as const};
    });
    handle('campaign:transfer-accept',(ticketId:string,name:string,choices:Record<string,import('../src/app/campaign-contracts').ConflictChoice>)=>campaignJob(async()=>{
      acceptingTicket=ticketId;let finishAcceptance!:()=>void;acceptanceFinished=new Promise<void>(resolve=>{finishAcceptance=resolve;});
      try{
        const confirmed=(await store.campaignTransferOutcome(ticketId,{name,choices}));if(confirmed)return confirmed;
        const ticket=campaignTickets.get(ticketId);if(!ticket)throw new Error('Importvorschau nicht mehr verfügbar.');
        const campaign=await store.acceptPreparedCampaignFile({...ticket,acceptanceId:ticketId},name,choices,campaignAuthority(ticket.fence));
        campaignTickets.delete(ticketId);try{await rm(ticket.dir,{recursive:true,force:true});}catch(e){console.error('Kampagne übernommen; temporäre Paketbereinigung steht aus.',e instanceof Error?e.message:e);}return campaign;
      }finally{acceptingTicket=null;acceptanceFinished=null;finishAcceptance();}
    }));
    handle('campaign:transfer-cancel',async(ticketId?:string)=>{campaignCancelled=true;Atomics.store(new Int32Array(campaignCancel),0,1);if(ticketId)await cancelCampaignTicket(campaignTickets,ticketId,acceptingTicket===ticketId?acceptanceFinished:null);});
    const hooks:TransferHooks={cancelled:()=>audioCancelled,progress:p=>{if(!win.isDestroyed())win.webContents.send('music:progress',p);}};
    async function transfer<T>(task:()=>Promise<T>){if(audioBusy||campaignBusy)throw new Error('Eine Kampagnen- oder Medienübertragung läuft bereits.');audioBusy=true;audioCancelled=false;try{return await task();}finally{audioBusy=false;hooks.progress({phase:audioCancelled?'Abgebrochen':'Fertig',bytes:0,files:0,busy:false});}}
    handle('campaign:music-favorites',async (token:string,after:string|null)=>(await store.musicFavorites(token,after)));
    handle('music:assets',async (query:import('../src/app/music-contracts').AudioQuery)=>(await store.audioAssets(query)));
    handle('music:asset',async (id:string)=>(await store.audioAsset(id)));
    handle('music:view',async (token:string)=>(await store.music(token)));
    handle('music:subject',async (token:string,kind:import('../src/app/music-contracts').MusicSubject['kind'],id:string)=>(await store.musicSubject(token,kind,id)));
    handle('music:execute',async (command:import('../src/app/music-contracts').MusicCommand)=>(await store.executeMusic(command)));
    handle('music:position',async (token:string,id:string,seconds:number)=>(await store.musicPosition(token,id,seconds)));
    handle('music:cancel',()=>{audioCancelled=true;});
    handle('music:pick',(token:string)=>transfer(async()=>{(await store.music(token));const selection=await dialog.showOpenDialog(win,{title:'Lokale Audiodateien hinzufügen',properties:['openFile','multiSelections'],filters:[{name:'Audio',extensions:['mp3','ogg','oga','opus','wav','flac','m4a','aac']}]});if(selection.canceled)return{cancelled:true,ids:[]};const medias:import('../src/app/music-contracts').AudioAsset['media'][]=[];for(const filename of selection.filePaths)medias.push(await copyAudio(filename,path.join(dataDir,'audio'),hooks));if(audioCancelled)throw new Error('Audioimport abgebrochen.');return{cancelled:false,ids:(await store.ingestAudios(token,medias)).map(a=>a.id)};}));
    handle('music:export',(token:string)=>transfer(async()=>{const library=(await store.audioLibrary(token)),selection=await dialog.showSaveDialog(win,{title:'Musikbibliothek mit Medien exportieren',defaultPath:'Musikbibliothek.kwmusic',filters:[{name:'SaltMarcher Musikbibliothek',extensions:['kwmusic']}]});if(selection.canceled||!selection.filePath)return{cancelled:true};await exportAudioBundle(selection.filePath,path.join(dataDir,'audio'),library,hooks);return{cancelled:false};}));
    handle('music:import',(token:string)=>transfer(async()=>{(await store.music(token));const selection=await dialog.showOpenDialog(win,{title:'Musikbibliothek importieren',properties:['openFile'],filters:[{name:'SaltMarcher Musikbibliothek',extensions:['kwmusic']}]});if(selection.canceled)return{cancelled:true,ids:[]};const library=await importAudioBundle(selection.filePaths[0]!,path.join(dataDir,'audio'),hooks);if(audioCancelled)throw new Error('Bibliotheksimport abgebrochen.');return{cancelled:false,ids:(await store.mergeAudioLibrary(token,library))};}));
    handle('dungeon:command-state',async (command:import('../src/app/dungeon-contracts').DungeonCommand)=>(await store.dungeonCommandState(command)));
    handle('dungeon:authoring',async (token:string)=>(await store.dungeonAuthoring(token)));
    handle('dungeon:view',async (token:string)=>(await store.dungeon(token)));
    handle('dungeon:preview',async (token:string,r:import('../src/app/dungeon-contracts').DungeonRequest)=>(await store.previewDungeon(token,r)));
    handle('dungeon:execute',async (c:import('../src/app/dungeon-contracts').DungeonCommand)=>(await store.executeDungeon(c)));
    handle('campaign:groups',async (token:string,search:string,after:string|null)=>(await store.preparedGroups(token,search,after)));
    handle('campaign:group-view',async (token:string,id:string)=>(await store.groupView(token,id)));
    handle('campaign:group-draft',async (token:string,id:string)=>(await store.groupDraft(token,id)));
    handle('campaign:keep-group-draft',async (token:string,draft:import('../src/app/groups-contracts').GroupDraft,expected:string|null)=>(await store.keepGroupDraft(token,draft,expected)));
    handle('campaign:discard-group-draft',async (token:string,id:string,writeId:string)=>(await store.discardGroupDraft(token,id,writeId)));
    handle('campaign:prepared-group',async (token:string,id:string)=>(await store.preparedGroup(token,id)));
    handle('graph:view',async (token:string,scopeId:string)=>(await store.graph(token,scopeId)));
    handle('graph:execute',async(c:import('../src/app/graph-contracts').GraphCommand)=>{if(['restore','accept'].includes(c.action?.kind))return withGraphSourceReadBarrier(async ()=>(await store.executeGraph(c)));return (await store.executeGraph(c));});
    handle('drawing:path-preview',async (token:string,p:import('../src/app/path-contracts').DungeonPath)=>(await store.previewPath(token,p)));
    handle('drawing:map',async (token:string,roomId?:string,elementId?:string)=>(await store.drawingMap(token,roomId,elementId)));
    handle('drawing:element',async (token:string,id:string)=>(await store.drawingElement(token,id)));
    handle('drawing:view',async (token:string)=>(await store.drawing(token)));
    handle('drawing:execute',async (c:import('../src/app/drawing-contracts').DrawingCommand)=>(await store.executeDrawing(c)));
    handle('drawing:feature',async (token:string,id:string,sceneId:string,expected:number,action:'activate'|'reset'|'correct',charges:number|null,commandId:string)=>(await store.activateFeature(token,id,sceneId,expected,action,charges,commandId)));
    handle('drawing:export',async(token:string,scopeId:string,floorId:string,format:'svg'|'json'|'keys'|'document',publicOnly:boolean)=>{if(!['svg','json','keys','document'].includes(format))throw new Error('Ausgabeformat unbekannt.');(await store.drawing(token));const g=(await store.dungeon(token)),v=g.drawing,rooms=g.rooms.filter(r=>r.scopeId===scopeId&&r.floorId===floorId),text=format==='svg'?dungeonSvg(rooms.filter(r=>!publicOnly||!v.keyContent?.some(c=>c.id===r.id&&c.secret)),v,scopeId,floorId,publicOnly):format==='document'?dungeonKeyDocument(g,scopeId,publicOnly):format==='keys'?dungeonKeyMarkdown(g,scopeId,publicOnly,floorId):publicOnly?JSON.stringify({format:'Kampagnenwerkstatt Dungeon public',version:1,scopeId,floorId,svg:dungeonSvg(rooms.filter(r=>!v.keyContent?.some(c=>c.id===r.id&&c.secret)),v,scopeId,floorId,true),key:dungeonKeyMarkdown(g,scopeId,true,floorId)},null,2):JSON.stringify({format:'Kampagnenwerkstatt Dungeon',version:1,scopeId,floorId,rooms,view:{...v,keyContent:v.keyContent?.filter(k=>k.scopeId===scopeId),paths:v.paths?.filter(p=>p.scopeId===scopeId),passages:v.passages?.filter(p=>p.scopeId===scopeId),volumes:v.volumes?.filter(p=>p.scopeId===scopeId),elements:v.elements.filter(e=>e.scopeId===scopeId),styles:v.styles.filter(e=>e.scopeId===scopeId),hiddenRooms:v.hiddenRooms.filter(e=>e.scopeId===scopeId),hiddenFloors:v.hiddenFloors.filter(e=>e.scopeId===scopeId),features:[]}},null,2);const extension=format==='keys'?'md':format==='document'?'html':format,selection=await dialog.showSaveDialog(win,{defaultPath:'Dungeon.'+extension,filters:[{name:'Dungeon',extensions:[extension]}]});if(selection.canceled||!selection.filePath)return{cancelled:true};await writeFile(selection.filePath,text);return{cancelled:false};});
    handle('autonomy:decision',async (token:string,actorId:string)=>(await store.autonomyDecision(token,actorId)));
    handle('autonomy:view',async (token:string)=>(await store.autonomy(token)));
    handle('autonomy:execute',async (c:import('../src/app/autonomy-contracts').AutonomyCommand)=>(await store.executeAutonomy(c)));
    handle('player:view',async (token:string,query?:import('../src/app/player-contracts').PlayerMapQuery)=>(await store.playerView(token,query)));
    handle('player:execute',async (command:import('../src/app/player-contracts').PlayerCommand)=>(await store.executePlayer(command)));
    handle('player:screens',()=>screen.getAllDisplays().map(d=>({id:d.id,name:d.label||'Bildschirm '+d.id+' · '+d.size.width+' × '+d.size.height})));
    handle('player:window',async (token:string,open:boolean)=>{if(typeof open!=='boolean')throw new Error('Fensteraktion prüfen.');(await store.playerWindowOpen(token,open));});
    handle('player:art',async(token:string,kind:import('../src/app/player-contracts').PlayerAsset['kind'],subjectId:string|null,title:string)=>{(await store.playerView(token));const pick=await dialog.showOpenDialog(win,{title:'Bild für Spieleranzeige hinterlegen',properties:['openFile'],filters:[{name:'Bilder',extensions:['png','jpg','jpeg','webp']}]});if(pick.canceled||!pick.filePaths[0])return null;const filename=pick.filePaths[0];if((await stat(filename)).size>32*1024*1024)throw new Error('Bild ist größer als 32 MiB.');const image=nativeImage.createFromPath(filename),size=image.getSize();if(image.isEmpty()||size.width>8192||size.height>8192)throw new Error('Bildformat oder Bildmaße prüfen (maximal 8192 × 8192).');const bytes=image.resize({width:Math.min(size.width,2400),height:Math.round(size.height*Math.min(1,2400/size.width))}).toPNG(),sha256=createHash('sha256').update(bytes).digest('hex'),dir=path.join(dataDir,'player-images');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,sha256+'.png'),bytes);return (await store.registerPlayerAsset(token,{id:randomUUID(),kind,subjectId,title,sha256,extension:'.png',bytes:bytes.length}));});
    handle('city:activities',async (token:string,q:import('../src/app/city-activity-contracts').CityActivityQuery)=>(await store.cityActivities(token,q)));
    handle('city:buildings',async (token:string,q:import('../src/app/city-contracts').CityBuildingQuery)=>(await store.cityBuildings(token,q)));
    handle('atlas:travel-preview',async (token:string,p:import('../src/app/contracts').Point)=>(await store.previewAtlasTravel(token,p)));
    handle('atlas:travel-commit',async (c:import('../src/app/atlas-travel-contracts').AtlasTravelCommand)=>(await store.executeAtlasTravelCommit(c)));
    handle('atlas:travel',async (c:import('../src/app/atlas-travel-contracts').AtlasTravelCommand)=>(await store.executeAtlasTravel(c)));
    handle('atlas:find',async (token:string,text:string)=>(await store.landscapeFind(token,text)));
    const referencePreviewCache=new Map<string,string>();let referencePreviewBytes=0;
    handle('atlas:reference-preview',async (token:string,id:string,size:number)=>{
      if(typeof id!=='string'||!id||![256,512,1024,2048].includes(size))throw new Error('Bildvorschau prüfen.');
      const before=(await store.atlasRegionSource(token)),key=JSON.stringify([before.campaignId,before.fence,id,size]),cached=referencePreviewCache.get(key);
      if(cached){referencePreviewCache.delete(key);referencePreviewCache.set(key,cached);return cached;}
      const source=(await store.referenceAssetSource(token,id)),image=nativeImage.createFromBuffer(source.bytes),dimensions=image.getSize();
      if(image.isEmpty()||dimensions.width<1||dimensions.height<1)throw new Error('Bildvorlage nicht lesbar. Original bleibt erhalten.');
      const byteLimit=(size<=1024?128:256)*1024;let edge=Math.min(size,Math.max(dimensions.width,dimensions.height)),bytes:Buffer;
      do{const factor=Math.min(1,edge/Math.max(dimensions.width,dimensions.height));bytes=image.resize({width:Math.max(1,Math.round(dimensions.width*factor)),height:Math.max(1,Math.round(dimensions.height*factor))}).toPNG();edge=Math.floor(edge/2);}while(bytes.length>byteLimit&&edge>=32);
      if(bytes.length>byteLimit||(await store.atlasRegionSource(token)).fence!==before.fence)throw new Error('Bildvorschau inzwischen geändert oder zu groß. Erneut laden.');
      const data='data:image/png;base64,'+bytes.toString('base64');while(referencePreviewBytes+data.length*2>8*1024*1024&&referencePreviewCache.size){const [old,value]=referencePreviewCache.entries().next().value!;referencePreviewBytes-=value.length*2;referencePreviewCache.delete(old);}referencePreviewCache.set(key,data);referencePreviewBytes+=data.length*2;return data;
    });
    handle('atlas:reference-import',async(token:string)=>{(await store.atlasIdentity(token));const pick=await dialog.showOpenDialog(win,{title:'Nachzeichenvorlage wählen',properties:['openFile'],filters:[{name:'Bild',extensions:['png','jpg','jpeg','webp']}]});if(pick.canceled||!pick.filePaths[0])return null;const file=pick.filePaths[0];if((await stat(file)).size>32*1024*1024)throw new Error('Vorlage ist größer als 32 MiB.');const image=nativeImage.createFromPath(file),size=image.getSize();if(image.isEmpty()||size.width>16384||size.height>16384)throw new Error('Bildmaße prüfen (bis 16384 Pixel).');const bytes=image.toPNG(),id=(await store.registerReference(token,'image/png',bytes));return{id,...size};});
    handle('atlas:export-png',async(token:string,bytes:Uint8Array,audience:'gm'|'public',format:'png'|'jpeg'='png',sourceFence?:string)=>{const fence=(await store.atlasRegionSource(token)).fence;if(sourceFence!==undefined&&sourceFence!==fence)throw new Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');if(!['gm','public'].includes(audience)||!(bytes instanceof Uint8Array)||bytes.length>64*1024*1024||bytes.length<8)throw new Error('Ungültige PNG-Ausgabe.');const buffer=Buffer.from(bytes);if(format!=='png'&&format!=='jpeg')throw new Error('Bildformat prüfen.');if(format==='png'?buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a':buffer.subarray(0,2).toString('hex')!=='ffd8')throw new Error('Bildsignatur fehlt.');const selection=await dialog.showSaveDialog(win,{title:'Atlas ausgeben',defaultPath:(audience==='public'?'Atlas-Spieler.':'Atlas-GM.')+(format==='jpeg'?'jpg':'png'),filters:[{name:format.toUpperCase(),extensions:[format==='jpeg'?'jpg':'png']}]});if(selection.canceled||!selection.filePath)return{cancelled:true};if((await store.atlasRegionSource(token)).fence!==fence)throw new Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');await writeFile(selection.filePath,buffer);return{cancelled:false};});
    handle('atlas:import',async (c:{commandId:string;token:string;campaignId:string;ticket:string;x:number;y:number})=>{const pending=dungeonImportPreviews.get(c.ticket);if(!pending)throw new Error('Importvorschau abgelaufen. Datei erneut wählen.');const result=(await store.executeAtlas({...c,action:{kind:'drawing-import',name:pending.name,rooms:pending.rooms,source:pending.bytes.toString('utf8'),x:c.x,y:c.y}}));return{atlas:result.atlas,roomId:(result.result as {roomId:string|null}|null)?.roomId??null};});
    handle('atlas:territories',async (token:string,box?:import('../src/app/atlas-landscape').LandscapeBox)=>(await store.atlasTerritories(token,box)));
    handle('atlas:overview',async (token:string)=>(await store.atlasOverview(token)));
    handle('atlas:objects',async (token:string,q:import('../src/app/campaign-atlas-contracts').AtlasObjectQuery)=>(await store.atlasObjects(token,q)));
    handle('atlas:vegetation-scene',async (token:string,box:import('../src/app/atlas-landscape').LandscapeBox,mpp:number)=>(await store.atlasVegetationScene(token,box,mpp)));
    handle('atlas:spatial-scene',async (token:string,box:import('../src/app/atlas-landscape').LandscapeBox,mpp:number,draft?:import('../src/app/spatial-terrain').SpatialTerrainDraft,fence?:string)=>draft?spatialRoutePreview(store,token,box,mpp,draft,fence):(await store.atlasSpatialScene(token,box,mpp,draft,fence)));
    handle('atlas:terrain-profile',async (token:string,points:import('../src/app/contracts').Point[])=>(await store.atlasTerrainProfile(token,points)));
    handle('atlas:height',async (token:string,point:import('../src/app/contracts').Point)=>(await store.atlasHeight(token,point)));
    handle('atlas:terrain-frame',async(token:string,request:import('../src/app/terrain-presentation').TerrainFrameRequest)=>{
      const q=request?.frame;
      if(request?.refinement!==undefined&&typeof request.refinement!=='boolean')throw Error('Geländeverfeinerung prüfen.');
      if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(q?.kind==='top')validateRegion(q.query);
      else if(q?.kind==='tilted'){validateTerrainProjection(q.query);if(q.query.color||q.query.heightStroke)throw Error('Nur gespeichertes Gelände.');}
      else throw Error('Geländeansicht prüfen.');
      const source=(await store.atlasRegionSource(token,atlasRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(request.source?.revision!==source.revision||request.source?.fence!==source.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      const value=await atlasRegions.liveTerrain(source,q,request.base,request.refinement),current=(await store.atlasRegionSource(token));
      // A completed, versioned snapshot remains useful during later Atlas writes.
      // Unversioned journal changes, workspace/preview changes and rollbacks fail closed.
      if(!terrainSnapshotStillValid(source,current))throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      return value;
    });
    handle('atlas:terrain-color',async(token:string,q:import('../src/app/terrain-color').TerrainColorRequest)=>{
      if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');validateTerrainColor(q);
      const source=(await store.atlasRegionSource(token,atlasRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(source.revision!==q.revision||q.fence!==undefined&&source.fence!==q.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      const value=await atlasRegions.terrainColor(source,q);
      if((await store.atlasRegionSource(token)).fence!==source.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');return value;
    });
    handle('atlas:geometry-tile',async(token:string,q:import('../src/app/atlas-geometry-tile').AtlasGeometryTileRequest)=>{
      if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');atlasGeometryTileBox(q);
      const source=(await store.atlasRegionSource(token,atlasRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(source.revision!==q.revision)throw Error('Geometriekachel inzwischen geändert.');
      const value=await atlasRegions.geometryTile(source,q);
      if((await store.atlasRegionSource(token)).fence!==source.fence)throw Error('Geometriekachel inzwischen geändert.');
      return value;
    });
    handle('atlas:cancel-read',async (token:string,control:AtlasReadRequest)=>{(await store.atlasRegionSource(token));if(!control)throw Error('Kartenleseauftrag fehlt.');validateAtlasReadRequest(control);atlasRegions.cancelRead(control,token);atlasExportRegions.cancelRead(control,token);});
    handle('atlas:terrain-tile',async(token:string,q:import('../src/app/atlas-terrain-tile').AtlasTerrainTileRequest,control?:AtlasReadRequest)=>{
      validateAtlasReadRequest(control);
      if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');atlasTerrainTileQuery(q);
      const source=(await store.atlasRegionSource(token,atlasExportRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(source.revision!==q.revision)throw Error('Atlaskachel inzwischen geändert.');
      const value=await atlasExportRegions.terrainTile(source,q,control);
      if((await store.atlasRegionSource(token)).fence!==source.fence)throw Error('Atlaskachel inzwischen geändert.');
      return value;
    });
    handle('atlas:material-tile',async(token:string,q:import('../src/app/atlas-material-tile').AtlasMaterialTileRequest,control?:AtlasReadRequest)=>{
      validateAtlasReadRequest(control);
      if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');atlasMaterialTileQuery(q);
      const source=(await store.atlasRegionSource(token,atlasExportRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(source.revision!==q.revision)throw Error('Materialkachel inzwischen geändert.');
      const value=await atlasExportRegions.materialTile(source,q,control);
      if((await store.atlasRegionSource(token)).fence!==source.fence)throw Error('Materialkachel inzwischen geändert.');
      return value;
    });
    handle('atlas:terrain-source',async (token:string)=>{if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');const source=(await store.atlasRegionSource(token));return{revision:source.revision,fence:source.fence};});
    handle('atlas:terrain-projection',async(token:string,q:import('../src/app/terrain-projection').TerrainProjectionRequest,consumer:'view'|'export'='view',control?:AtlasReadRequest)=>{
      validateAtlasReadRequest(control);
      if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');validateTerrainProjection(q);if(!['view','export'].includes(consumer))throw Error('Kartenleser prüfen.');
      const reader=consumer==='view'?atlasRegions:atlasExportRegions,source=(await store.atlasRegionSource(token,reader.cursor));
      if(source.revision!==q.revision||q.fence!==undefined&&source.fence!==q.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      const value=await reader.terrain(source,q,control);if((await store.atlasRegionSource(token)).fence!==source.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');if(!value.draft&&!value.heightOnly)(await store.rememberTerrainGrid(token,source.fence,value.grid));return value;
    });
    handle('atlas:mask-region',async (token:string,box:import('../src/app/atlas-landscape').LandscapeBox)=>(await store.atlasMaskRegion(token,box)));
    handle('atlas:object',async (token:string,id:string)=>(await store.atlasLandscapeObject(token,id)));
    handle('atlas:room-commit',(edit:import('../src/app/contracts').Edit)=>atlasWriteActivity.run(edit.commandId,async ()=>(await store.atlasRoomCommit(edit))));
    handle('atlas:room',async (token:string,id:string)=>(await store.atlasRoom(token,id)));
    handle('atlas:drawing-commit',(command:import('../src/app/drawing-contracts').DrawingCommand)=>atlasWriteActivity.run(command.commandId,async ()=>(await store.atlasDrawingCommit(command))));
    handle('atlas:reconcile-commit',async (c:import('../src/app/campaign-atlas-contracts').AtlasCommand)=>(await store.reconcileAtlasCommit(c,atlasWriteActivity.has(c.commandId))));
    handle('atlas:commit',(c:import('../src/app/campaign-atlas-contracts').AtlasCommand)=>atlasWriteActivity.run(c.commandId,async()=>{
      if(c.action?.kind==='graph-accept')return withGraphSourceReadBarrier(async ()=>(await store.executeAtlasCommit(c)));
      if(c.action?.kind==='landscape-height-stroke'){
        const source=(await store.terrainStrokeSource(c,atlasRegions.cursor));
        if(source){const prepared=await atlasRegions.prepareTerrainStroke(source,c.action.stroke);return (await store.executeAtlasCommit(c,prepared));}
      }
      return (await store.executeAtlasCommit(c));
    }));
    handle('campaign:workspace-initial',async (token:string)=>(await store.workspaceInitial(token)));
    handle('atlas:region-cancel',async (token:string,consumer:'view'|'export'='view')=>{(await store.roomReadSource(token));if(!['view','export'].includes(consumer))throw new Error('Kartenleser prüfen.');(consumer==='view'?atlasRegions:atlasExportRegions).cancel();});
    handle('atlas:geometry-region',async(token:string,query:import('../src/app/atlas-region-contracts').AtlasRegionQuery,consumer:'view'|'export'='view')=>{
      if(graphSourceReadBarrierDepth)throw new Error('Graphwechsel läuft. Ausschnitt danach aktualisieren.');validateRegion(query);
      if(!['view','export'].includes(consumer))throw new Error('Kartenleser prüfen.');const reader=consumer==='view'?atlasRegions:atlasExportRegions;
      const source=(await store.atlasRegionSource(token,reader.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');const region=await reader.read(source,query);
      return (await store.atlasRegionView(token,region,query.perception===true,query.entranceId));
    });
    handle('atlas:focus',async(token:string,kind:'room'|'city'|'building'|'element'|'scope',id:string)=>{
      if(graphSourceReadBarrierDepth||!['room','city','building','element','scope'].includes(kind)||typeof id!=='string'||!id)throw new Error('Kartenauswahl prüfen.');
      const source=(await store.atlasRegionSource(token,atlasRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');const value=await atlasRegions.focus(source,kind,id);
      if((await store.atlasRegionSource(token)).fence!==source.fence)throw new Error('Atlas inzwischen geändert. Auswahl erneut öffnen.');return value;
    });
    handle('atlas:region-candidates',async(token:string,query:import('../src/app/atlas-region-contracts').AtlasRegionQuery,point:import('../src/app/contracts').Point,fence:string,offset=0,layer:'geometry'|'landscape'|'all'='geometry',visualElementId?:string)=>{
      if(visualElementId!==undefined&&(typeof visualElementId!=='string'||!visualElementId))throw new Error('Kartenauswahl prüfen.');
      if(graphSourceReadBarrierDepth||!['geometry','landscape','all'].includes(layer)||!Number.isSafeInteger(offset)||offset<0)throw new Error('Kartenauswahl prüfen.');validateRegion(query);const source=(await store.atlasRegionSource(token,atlasRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(source.fence!==fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
      const value=await atlasRegions.candidates(source,query,point,offset,layer,visualElementId);if((await store.atlasRegionSource(token)).fence!==fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');return value;
    });
    handle('atlas:region-hit',async(token:string,query:import('../src/app/atlas-region-contracts').AtlasRegionQuery,point:import('../src/app/contracts').Point,fence:string)=>{
      if(graphSourceReadBarrierDepth)throw new Error('Graphwechsel läuft.');validateRegion(query);const source=(await store.atlasRegionSource(token,atlasRegions.cursor));if(graphSourceReadBarrierDepth)throw Error('Graphwechsel läuft.');
      if(source.fence!==fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
      const value=await atlasRegions.hit(source,query,point);if((await store.atlasRegionSource(token)).fence!==source.fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');return value;
    });
    handle('atlas:city-site',async (token:string,cityId:string,id?:string)=>(await store.atlasCitySite(token,cityId,id)));
    handle('atlas:render-view',async (token:string)=>(await store.atlasRenderView(token)));
    handle('atlas:view',async (token:string)=>(await store.campaignAtlas(token)));
    handle('atlas:execute',(c:import('../src/app/campaign-atlas-contracts').AtlasCommand)=>atlasWriteActivity.run(c.commandId,async()=>{if(c.action?.kind==='graph-accept')return withGraphSourceReadBarrier(async ()=>(await store.executeAtlas(c)));return (await store.executeAtlas(c));}));
    handle('city:list',async (token:string)=>(await store.cities(token)));
    handle('city:view',async (token:string,id:string)=>(await store.city(token,id)));
    handle('city:execute',(c:import('../src/app/city-contracts').CityCommand)=>atlasWriteActivity.run(c.commandId,()=>store.executeCity(c)));
    handle('city:export',async(token:string,id:string,format:'svg'|'json')=>{if(!['svg','json'].includes(format))throw new Error('Ausgabeformat unbekannt.');const city=(await store.city(token,id)),destination=await dialog.showSaveDialog(win,{defaultPath:city.header.name+'.'+format,filters:[{name:'Stadtplan',extensions:[format]}]});if(destination.canceled||!destination.filePath)return{cancelled:true};const text=format==='svg'?citySvg(city):JSON.stringify({format:'Kampagnenwerkstatt City',version:1,...city},null,2);await writeFile(destination.filePath,text);return{cancelled:false};});
    handle('world:time-preview',async (token:string,request:import('../src/app/time-plan-contracts').TimeRequest)=>(await store.previewTime(token,request)));
    handle('world:agenda',async (token:string,query:import('../src/app/agenda-contracts').AgendaQuery)=>(await store.agenda(token,query)));
    handle('world:view',async (token:string)=>(await store.world(token)));
    handle('world:scene',async (token:string,id:string)=>(await store.sceneWorld(token,id)));
    handle('world:travel-preview',async (token:string,request:import('../src/app/world-contracts').TravelRequest)=>(await store.previewTravel(token,request)));
    handle('world:reconcile',async (command:import('../src/app/world-contracts').WorldCommand,token:string)=>(await store.reconcileWorld(command,token)));
    handle('world:execute',async (command:import('../src/app/world-contracts').WorldCommand)=>(await store.executeWorld(command)));
    handle('items:definitions',async (query:import('../src/app/items-contracts').ItemQuery)=>(await store.itemDefinitions(query)));
    handle('items:definition',async (id:string,revision?:number)=>(await store.itemDefinition(id,revision)));
    handle('items:shops',async (token:string,trashed:boolean)=>(await store.shops(token,trashed)));
    handle('items:shop',async (token:string,id:string)=>(await store.shop(token,id)));
    handle('items:shop-history',async (token:string,id:string,after:string|null)=>(await store.shopHistory(token,id,after)));
    handle('items:scene-shops',async (token:string,id:string)=>(await store.sceneShops(token,id)));
    const commits=new CommitTracker(async (ref,token)=>(await store.commitStatus(ref,token)));
    handle('campaign:commit-status',(ref:import('../src/app/commit-receipt').CommitReference,token:string)=>commits.status(ref,token));
    handle('items:execute',(command:import('../src/app/items-contracts').ItemShopCommand)=>commits.execute('items',command,async ()=>(await store.executeItemShop(command))));
    handle('campaign:execute-progress', (command: ProgressCommand) => commits.execute('progress',command,async ()=>(await store.executeProgress(command))));
    handle('campaign:loot-balance',async (token:string)=>(await store.lootBalance(token)));
    handle('campaign:chronicle',async (token:string,category:ChronicleCategory|'all'='all',search='')=>(await store.chronicle(token,category,search)));
    handle('campaign:chronicle-page',async (token:string,category:ChronicleCategory|'all',search:string,cursor:import('../src/app/chronicle-contracts').ChronicleCursor|null)=>(await store.chroniclePage(token,category,search,cursor)));
    handle('campaign:chronicle-close',async (token:string,id:string)=>(await store.closeChroniclePage(token,id)));
    let chronicleExport:{id:string;cancelled:boolean}|null=null;
    handle('campaign:chronicle-export-cancel',(id:string)=>{if(chronicleExport?.id===id)chronicleExport.cancelled=true;});
    handle('campaign:chronicle-export',async(token:string,category:ChronicleCategory|'all',search:string,requestId= randomUUID())=>{
      if(chronicleExport)throw new Error('Eine Chronik-Ausgabe läuft bereits.');if(typeof requestId!=='string'||!requestId||requestId.length>100)throw new Error('Chronik-Ausgabeauftrag ungültig.');
      const state={id:requestId,cancelled:false};chronicleExport=state;let written=0,snapshot:{id:string}|undefined;
      const progress=(busy:boolean)=>{if(!win.isDestroyed())win.webContents.send('campaign:chronicle-export-progress',{requestId,written,busy});},check=()=>{if(state.cancelled||win.isDestroyed())throw new Error('Chronik-Ausgabe abgebrochen.');};
      try{snapshot=await store.chronicleExportSnapshot(token);const snapshotId=snapshot.id;const initial=await store.chronicleSnapshotRead(snapshotId,category,search,null,1),safe=initial.campaignName.replace(/[\\/:*?"<>|]+/g,'-').trim()||'Kampagne';progress(true);const destination=await dialog.showSaveDialog(win,{defaultPath:safe+' – Chronik.md',filters:[{name:'Markdown',extensions:['md']}]});if(destination.canceled||!destination.filePath||state.cancelled)return{cancelled:true};written=await exportChronicleFile({read:(...args)=>store.chronicleSnapshotRead(snapshotId,...args)},category,search,destination.filePath,{check,progress:n=>{written=n;progress(true);}});return{cancelled:false,written};}
      catch(e){if(state.cancelled)return{cancelled:true};throw e;}finally{try{if(snapshot)await store.chronicleSnapshotClose(snapshot.id);}finally{if(chronicleExport===state)chronicleExport=null;progress(false);}}
    });
    handle('campaign:combat-draft',async (token:string,id:string,kind:import('../src/app/combat-draft-contracts').CombatDraftKind,target:string)=>(await store.combatDraft(token,id,kind,target)));
    handle('campaign:combat-drafts',async (token:string,id:string,after:string|null)=>(await store.combatDrafts(token,id,after)));
    handle('campaign:keep-combat-draft',async (token:string,draft:import('../src/app/combat-draft-contracts').CombatWorkingDraft,expected:string|null)=>(await store.keepCombatDraft(token,draft,expected)));
    handle('campaign:discard-combat-draft',async (token:string,id:string,kind:import('../src/app/combat-draft-contracts').CombatDraftKind,target:string,writeId:string)=>(await store.discardCombatDraft(token,id,kind,target,writeId)));
    handle('campaign:combat-resolution',async (token:string,sceneId:string,id:string,after:string|null)=>(await store.combatResolution(token,sceneId,id,after)));
    handle('campaign:combat', async (token: string, sceneId: string, id?: string) => (await store.combat(token, sceneId, id)));
    handle('campaign:keep-chase-draft',async (token:string,draft:import('../src/app/chase-draft-contracts').ChaseWorkingDraft,expected:string|null)=>(await store.keepChaseDraft(token,draft,expected)));
    handle('campaign:mask-history',async (token:string,sceneId:string,query:import('../src/app/mask-history-contracts').MaskHistoryQuery)=>(await store.maskHistory(token,sceneId,query)));
    handle('campaign:chase',async (token:string,sceneId:string,id?:string)=>(await store.chase(token,sceneId,id)));
    handle('campaign:execute-chase',(command:import('../src/app/chase-contracts').ChaseCommand)=>commits.execute('chase',command,async ()=>(await store.executeChase(command))));
    handle('campaign:execute-combat', (command: CombatCommand) => commits.execute('combat',command,async ()=>(await store.executeCombat(command))));
    handle('campaign:archived-roster',async (token:string,after:string|null,search:string)=>(await store.archivedRoster(token,after,search)));
    handle('campaign:live', async (token: string) => (await store.live(token)));
    handle('campaign:live-scene', async (token: string, id: string) => (await store.liveScene(token, id)));
    handle('campaign:live-archives', async (token: string, after: string | null) => (await store.liveArchives(token, after)));
    handle('campaign:keep-live-moment-draft',async (token:string,id:string,draft:any,expected:any)=>(await store.keepLiveMomentDraft(token,id,draft,expected)));
    handle('campaign:keep-session-recap-draft',async (token:string,draft:any,expected:any)=>(await store.keepSessionRecapDraft(token,draft,expected)));
    handle('campaign:execute-live', async (command: LiveCommand) => (await store.executeLive(command)));
    handle('campaign:live-status', async (command: LiveCommand, token: string) => (await store.liveStatus(command, token)));
    handle('campaign:reconcile-preparation-plan',async (command:PreparationCommand,token?:string)=>(await store.reconcilePreparationPlan(command,token)));
    handle('campaign:change-preparation-plan',async (command:PreparationCommand)=>(await store.changePreparationPlan(command)));
    handle('campaign:change-preparation', async (command: PreparationCommand) => (await store.changePreparation(command)));
    handle('campaign:select-preparation', async (token: string, selection: PreparationSelection) => (await store.selectPreparation(token, selection)));
    handle('campaign:reconcile-preparation', async (command: PreparationCommand, token?: string) => (await store.reconcilePreparation(command, token)));
    handle('campaign:preparation-draft', async (token: string, kind: PreparationEdit['kind'], id: string) => (await store.preparationDraft(token, kind, id)));
    handle('campaign:keep-preparation-drafts', async (token: string, drafts: PreparationDraft[]) => (await store.keepPreparationDrafts(token, drafts)));
    handle('campaign:discard-preparation-draft', async (token: string, kind: PreparationEdit['kind'], id: string, writeId: string) => (await store.discardPreparationDraft(token, kind, id, writeId)));
    handle('campaign:history', async (token: string, direction: 'undo' | 'redo') => (await store.history(token, direction)));
    handle('campaign:preview-import', async (): Promise<DungeonImportPreview | null> => {
      const chosen = await dialog.showOpenDialog(win, { title: 'Dungeon in die Kampagnenwelt einfügen', filters: [{ name: 'Dungeon', extensions: ['dungeon'] }], properties: ['openFile'] });
      if (chosen.canceled || !chosen.filePaths[0]) return null;
      const bytes = readFileSync(chosen.filePaths[0]);
      if (bytes.length > 64 * 1024 * 1024) throw new Error('Dieser erste Import kann Dateien bis 64 MiB prüfen.');
      const inspected = inspectDungeon(bytes.toString('utf8')), ticket = randomUUID();
      dungeonImportPreviews.clear(); dungeonImportPreviews.set(ticket, { bytes, name: inspected.name, rooms: inspected.rooms });
      return { ticket, name: inspected.name, roomCount: inspected.rooms.length, sourceHash: createHash('sha256').update(bytes).digest('hex'), warnings: inspected.warnings };
    });
    handle('campaign:import', async (ticket: string) => {
      const pending = dungeonImportPreviews.get(ticket); if (!pending) throw new Error('Importvorschau abgelaufen. Bitte Datei erneut auswählen.');
      const result = (await store.create(pending.name, pending.rooms, pending.bytes)); dungeonImportPreviews.delete(ticket); return result;
    });
    handle('campaign:backup-status', () => backupError);
    handle('campaign:tutorial', async (state?: 'shown' | 'finished' | 'skipped') => (await store.tutorial(state)));
    async function finishClose(updateRequest?:string){
      if(stopping)return;stopping=true;clearInterval(timer);
      await Promise.allSettled([...activeOperations]);
      const shutdown=store.close();await backupTask;
      await Promise.all([closeSpatialRoutePreview(),roomDirectory.close(),atlasRoomDirectory.close(),atlasRegions.close(),atlasExportRegions.close()]);
      playerDisplay.shutdown();const ended=await shutdown;storeClosed=true;if(!ended.databaseClosed)dialog.showErrorBox('Speicherprozess unerwartet beendet','Speicherbestätigungen bleiben ungeklärt. Nach Neustart die Buchungsbelege prüfen.');
      if(updateRequest)await updateRuntime!.handoff(updateRequest);
      await updateRuntime!.close();closeAllowed=true;app.quit();
    }
    handle('update:status',()=>updates.status());
    handle('update:automatic',(enabled:boolean)=>updates.automatic(enabled));
    handle('update:check',()=>updates.check());
    handle('update:download',()=>updates.download());
    handle('update:cancel',()=>updates.cancel());
    handle('update:runtime-ready',async()=>{await updateRuntime!.ready();if(updateRuntime!.transaction)win.show();});
    handle('update:install',async()=>{
      if(stopping)throw new Error('Die Anwendung wird bereits geschlossen.');
      const request=await updateRuntime!.prepare(updates.installation());updates.installing();
      try{await finishClose(request);}catch(e){updates.installationFailed(e);if(storeClosed){dialog.showErrorBox('Update konnte nicht gestartet werden',String(e));await updateRuntime!.close();closeAllowed=true;app.quit();}else stopping=false;throw e;}
    });
    ipcMain.on('campaign:close-ready',event=>{
      if(event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url===origin)void finishClose().catch(error=>{dialog.showErrorBox('Schließen fehlgeschlagen',String(error));});
    });
    win.on('close',event=>{if(!closeAllowed){event.preventDefault();if(!stopping)win.webContents.send('campaign:close');}});
    timer=setInterval(async ()=>{
      if(campaignErasing||backupRunning||stopping)return;
      backupRunning=true;
      backupTask=store.backup(path.join(dataDir,'recovery.sqlite')).then(()=>{backupError=null;},()=>{backupError='Wiederherstellungskopie fehlgeschlagen. Die gespeicherten Änderungen liegen im Arbeitsstore.';}).finally(()=>{backupRunning=false;});
    },30000);
    win.on('closed',()=>{clearInterval(timer);playerDisplay.shutdown();});
    const updateTimer=setTimeout(()=>{if(!stopping)void updates.autoCheck();},15000);updateTimer.unref();
    await win.loadURL(origin);
    app.on('before-quit', event => { if (!closeAllowed && win && !win.isDestroyed()) { event.preventDefault(); win.close(); } });
  }).catch(error => { console.error(error);dialog.showErrorBox('SaltMarcher kann nicht starten', String(error)); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
  // finishClose awaits the writer's closed acknowledgement and actual exit before app.quit.
}
