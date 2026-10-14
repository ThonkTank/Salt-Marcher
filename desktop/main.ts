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
import {acceptPreparedCampaign} from './campaign-accept';
import {exportCampaignArchive,extractCampaignArchive,fileDigest,checkCampaignContents,campaignMediaPath,type CampaignManifest,type CampaignFileHooks} from './campaign-files';
import {mkdtemp,readdir,stat,rm} from 'node:fs/promises';
import {copyAudio,exportAudioBundle,importAudioBundle,type TransferHooks} from './audio-files';
import { app, BrowserWindow, dialog,shell, ipcMain, protocol, net,screen,nativeImage,session } from 'electron';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CampaignStore } from '../src/app/storage/store';
import { inspectDungeon } from '../src/app/import-dungeon';
import type { Edit, ImportPreview, Result, Room, WorkingRoomDraft, CampaignRename } from '../src/app/contracts';
import type { PreparationCommand, PreparationSelection, PreparationDraft, PreparationEdit } from '../src/app/preparation-contracts';
import type { LiveCommand } from '../src/app/live-contracts';
import type { CombatCommand } from '../src/app/combat-contracts';
import type { ProgressCommand } from '../src/app/progression';
import {chronicleMarkdown} from '../src/app/storage/chronicle';
import type {ChronicleCategory} from '../src/app/chronicle-contracts';
import { creatureInfo, searchCreatures, readCreature } from '../src/app/storage/encounters';
import type { CreatureCatalogQuery } from '../src/features/catalog/creature-catalog';
import type { EncounterPlanCommand } from '../src/app/encounter-contracts';
import type { GenerationCommand, GenerationRequest, LootRollCommand } from '../src/app/generation-contracts';
import type { SessionCommand, SessionGenerationRequest } from '../src/app/session-contracts';
import type {SceneRuleCommand} from '../src/app/rule-reference-contracts';
import type {SceneCheckCommand} from '../src/app/scene-check-contracts';
declare const __APP_VERSION__: string;

const dataFlag = process.argv.indexOf('--data-dir');
const dataDir = dataFlag >= 0 ? path.resolve(process.argv[dataFlag + 1]!) : path.join(app.getPath('appData'), 'CampaignWorkbench');
mkdirSync(dataDir, { recursive: true }); app.setPath('userData', dataDir);
protocol.registerSchemesAsPrivileged([{ scheme: 'campaign', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let win: BrowserWindow;
  let store: CampaignStore;
  const playerOrigin='campaign://player/player-display.html';
  let closeAllowed = false;
  let backupRunning = false;
  let backupError: string | null = null;
  const imports = new Map<string, { bytes: Buffer; name: string; rooms: Room[] }>();
  const root = path.join(__dirname, 'ui');
  const origin = 'campaign://app/index.html';
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    store = new CampaignStore(path.join(dataDir, 'workbench.sqlite'), __APP_VERSION__);
    protocol.handle('campaign', request => {
      const url = new URL(request.url);
      if(url.host==='app'&&url.pathname.startsWith('/audio/')){try{const id=decodeURIComponent(url.pathname.slice(7)),filename=store.audioFile(id);return audioResponse(filename,request,(url,options)=>net.fetch(url,options)).catch(()=>new Response('Audio unavailable',{status:404}));}catch{return new Response('Audio unavailable',{status:404});}}
      if(url.pathname.startsWith('/player/art/')&&url.host==='app'){try{const id=decodeURIComponent(url.pathname.split('/').at(-1)!),frame=store.currentPlayerFrame();if(frame.mode!=='image'||frame.imageId!==id)return new Response('Image unavailable',{status:404});return net.fetch(pathToFileURL(store.playerImageFile(id)).href);}catch{return new Response('Image unavailable',{status:404});}}
      const name = url.pathname.slice(1);

      if (url.host !== 'app' || !['index.html', 'renderer.js', 'app.css','player.css'].includes(name)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(root, name)).href);
    });
    win = new BrowserWindow({ width: 1280, height: 880, minWidth: 640, minHeight: 480, title: 'Kampagnenwerkstatt', backgroundColor: '#edf1f6',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('campaign://app/') && !details.url.startsWith('campaign://player/') && !details.url.startsWith(pathToFileURL(root + path.sep).href) && !details.url.startsWith(pathToFileURL(path.join(dataDir,'audio')+path.sep).href) && !details.url.startsWith(pathToFileURL(path.join(dataDir,'player-images')+path.sep).href) }));
    const playerSession=session.fromPartition('player-display');
    installPlayerResources(playerSession,{
      windowId:()=>playerDisplay.window?.webContents.id??null,
      current:()=>{const window=playerDisplay.window;if(!window)return null;const frame=playerDisplay.frame().frame;return{windowId:window.webContents.id,imageId:frame.mode==='image'?frame.imageId??null:null};},
      uiFile:name=>path.join(root,name),imageFile:id=>store.playerImageFile(id),fetchFile:filename=>net.fetch(pathToFileURL(filename).href),
    });
    const playerDisplay=new PlayerDisplay({
      current:()=>store.currentPlayerDisplay(),origin:playerOrigin,stopping:()=>closeAllowed,
      create:()=>{
        const window=new BrowserWindow({width:1280,height:720,minWidth:400,minHeight:300,title:'Spieleranzeige',backgroundColor:'#000000',show:false,webPreferences:{session:playerSession,preload:path.join(__dirname,'player-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
        window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());return window;
      },
      layout:settings=>{const displays=screen.getAllDisplays(),display=displays.find(d=>d.id===settings.displayId)??displays.find(d=>d.id!==screen.getPrimaryDisplay().id)??screen.getPrimaryDisplay();return{bounds:display.workArea,fullscreen:settings.fullscreen};},
      closed:token=>store.closePlayerWindow(token),
      error:error=>console.error('Spieleranzeige konnte nicht aktualisiert werden.',error instanceof Error?error.message:error),
    });
    ipcMain.handle('player:frame',event=>{const window=playerDisplay.window;if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==playerOrigin)return{ok:false,error:'Zugriff verweigert.'};return{ok:true,value:playerDisplay.frame()};});
    function handle<T>(name: string, operation: (...args: any[]) => T | Promise<T>) {
      ipcMain.handle(name, async (event, ...args): Promise<Result<T>> => {
        if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== origin) return { ok: false, error: 'Zugriff verweigert.' };
        try { const value=await operation(...args);if(name.includes(':execute')||['campaign:activate','campaign:trash','campaign:erase','campaign:transfer-accept','player:window','player:art'].includes(name))playerDisplay.sync();return { ok: true, value }; }
        catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Vorgang fehlgeschlagen.' }; }
      });
    }
    handle('campaign:list', () => store.list());
    handle('extensions:preview',async()=>{const selected=await dialog.showOpenDialog(win,{title:'Extensionpaket prüfen',properties:['openFile'],filters:[{name:'Extensionpaket (JSON)',extensions:['json']}]});if(selected.canceled||!selected.filePaths[0])return null;const file=await open(selected.filePaths[0],'r');try{if(!(await file.stat()).isFile())throw new Error('Eine Paketdatei wählen.');const bytes=Buffer.alloc(extensionPackageLimit+1);let length=0;while(length<bytes.length){const r=await file.read(bytes,length,bytes.length-length,length);if(!r.bytesRead)break;length+=r.bytesRead;}return store.extensionPreview(bytes.subarray(0,length));}finally{await file.close();}});
    handle('extensions:list',(after:string|null)=>store.extensions(after));
    handle('extensions:execute',(command:import('../src/app/extension-contracts').ExtensionCommand)=>store.executeExtension(command));
    handle('extensions:outcome',(command:import('../src/app/extension-contracts').ExtensionCommand)=>store.extensionOutcome(command));

    handle('campaign:create', (name: string) => store.create(name));
    handle('campaign:rename', (command: CampaignRename) => store.renameCampaign(command));
    handle('campaign:activate', (id: string) => { imports.clear(); return store.activate(id); });
    handle('campaign:select', (token: string, id: string) => store.select(token, id));
    handle('campaign:add-room', (token: string) => store.addRoom(token));
    handle('campaign:edit', (edit: Edit) => store.edit(edit));
    handle('campaign:reconcile', (edit: Edit, token?: string) => store.reconcile(edit, token));
    handle('campaign:room-draft', (token: string, roomId: string) => store.roomDraft(token, roomId));
    handle('campaign:keep-room-draft', (token: string, roomId: string, draft: WorkingRoomDraft | null) => store.keepRoomDraft(token, roomId, draft));
    handle('campaign:preparation', (token: string, search: string) => store.preparation(token, search));
    handle('campaign:session', (token: string,id: string)=>store.session(token,id));
    handle('campaign:execute-session', (command: SessionCommand)=>store.executeSession(command));
    handle('campaign:generate-session', (token: string,request: SessionGenerationRequest)=>store.generateSession(token,request));
    handle('campaign:regenerate-session', (token: string,id: string,index: number,seed: string)=>store.regenerateSessionProposal(token,id,index,seed));
    handle('campaign:session-runs', (token: string,id: string)=>store.sessionRuns(token,id));
    handle('campaign:session-run', (token: string,id: string)=>store.sessionRun(token,id));
    handle('campaign:scene-preparation', (token: string,id: string)=>store.scenePreparation(token,id));
    handle('campaign:scene-rules',(token:string,id:string)=>store.sceneRules(token,id));
    handle('campaign:execute-scene-rule',(command:SceneRuleCommand)=>store.executeSceneRule(command));
    handle('campaign:scene-checks',(token:string,id:string)=>store.sceneChecks(token,id));
    handle('campaign:execute-scene-check',(command:SceneCheckCommand)=>store.executeSceneCheck(command));
    handle('campaign:npc-drafts',(token:string)=>store.npcDrafts(token));
    handle('campaign:npc-draft',(token:string,id:string)=>store.npcDraft(token,id));
    handle('campaign:keep-npc-draft',(token:string,d:NpcDraft,expected:string|null)=>store.keepNpcDraft(token,d,expected));
    handle('campaign:discard-npc-draft',(token:string,id:string,writeId:string)=>store.discardNpcDraft(token,id,writeId));
    handle('campaign:npcs',(token:string,q:NpcQuery)=>store.npcs(token,q));
    handle('campaign:npc',(token:string,id:string)=>store.npc(token,id));
    handle('campaign:execute-npc',(c:NpcCommand)=>store.executeNpc(c));
    handle('campaign:generation-sources', (token:string)=>store.generationSources(token));
    handle('campaign:encounter-tables', (token: string, trashed: boolean) => store.encounterTables(token,trashed));
    handle('campaign:loot-tables', (token: string, trashed: boolean) => store.lootTables(token,trashed));
    handle('campaign:generator-registry', (token: string) => store.generatorRegistry(token));
    handle('campaign:execute-generation', (command: GenerationCommand) => store.executeGeneration(command));
    handle('campaign:generate-encounters', (token: string, request: GenerationRequest) => store.generateEncounters(token,request));
    handle('campaign:accept-generation', (command: Parameters<typeof store.acceptGeneration>[0]) => store.acceptGeneration(command));
    handle('campaign:generation-runs', (token: string) => store.generationRuns(token));
    handle('campaign:generation-run', (token: string,id: string) => store.generationRun(token,id));
    handle('campaign:roll-loot', (command: LootRollCommand) => store.rollLoot(command));
    handle('catalog:info', () => creatureInfo());
    handle('catalog:search', (query: CreatureCatalogQuery) => searchCreatures(query));
    handle('catalog:creature', (id: string) => readCreature(id));
    handle('campaign:encounter-plans', (token: string, search: string) => store.encounterPlans(token,search));
    handle('campaign:encounter-plan', (token: string,id: string) => store.encounterPlan(token,id));
    handle('campaign:save-encounter-plan', (command: EncounterPlanCommand) => store.saveEncounterPlan(command));
    handle('campaign:ledger-parties',(token:string)=>store.ledgerParties(token));
    handle('campaign:open-item-source',async(token:string,id:string)=>{store.live(token);const d=store.itemDefinition(id),url=d.source.url;if(!url||!/^https:\/\/media\.wizards\.com\/2023\/downloads\/dnd\/SRD_CC_v5\.1\.pdf#page=[1-9][0-9]{0,2}$/.test(url))throw new Error('Keine verfügbare SRD-Quellenseite.');await shell.openExternal(url);});
    handle('campaign:treasury-draft',(token:string,id:string)=>store.treasuryDraft(token,id));
    handle('campaign:keep-treasury-draft',(token:string,draft:any,expected:string|null)=>store.keepTreasuryDraft(token,draft,expected));
    handle('campaign:discard-treasury-draft',(token:string,id:string,writeId:string)=>store.discardTreasuryDraft(token,id,writeId));
    handle('campaign:treasure-history',(token:string,id:string,after:string|null)=>store.treasureHistory(token,id,after));
    handle('campaign:scene-desk',(token:string,id:string)=>store.sceneDesk(token,id));
    handle('campaign:search-desk',(token:string,kind:string,search:string,offset:number)=>store.searchDesk(token,kind,search,offset));
    handle('campaign:desk-content',(token:string,ref:any)=>store.deskContent(token,ref));
    handle('campaign:pin-scene-desk',(token:string,id:string,revision:number,ref:any,pin:boolean)=>store.pinSceneDesk(token,id,revision,ref,pin));
    handle('campaign:keep-desk-draft',(token:string,draft:any,expected:string|null)=>store.keepDeskDraft(token,draft,expected));
    handle('campaign:finish-draft',(token:string,owner:any)=>store.finishDraft(token,owner));
    handle('campaign:keep-finish-draft',(token:string,draft:any,expected:string|null)=>store.keepFinishDraft(token,draft,expected));
    handle('campaign:discard-finish-draft',(token:string,owner:any,writeId:string)=>store.discardFinishDraft(token,owner,writeId));
    handle('campaign:keep-narrative-draft',(token:string,draft:any,expected:string|null)=>store.keepNarrativeDraft(token,draft,expected));
    handle('campaign:discard-narrative-draft',(token:string,id:string,writeId:string)=>store.discardNarrativeDraft(token,id,writeId));
    handle('campaign:narrative',(token:string,id:string)=>store.narrative(token,id));
    handle('campaign:progress-history', (token: string, characterId: string, after: string | null) => store.progressHistory(token, characterId, after));
    handle('campaign:progress', (token: string) => store.progress(token));
    handle('campaign:treasures', (token: string, after: string | null) => store.treasures(token, after));
    handle('campaign:treasure', (token: string, id: string) => store.treasure(token, id));
    handle('campaign:ledger', (token: string, query: import('../src/app/progression').LedgerQuery) => store.ledger(token, query));
    handle('campaign:ledger-inventory',(token:string,query:import('../src/app/progression').LedgerInventoryQuery)=>store.ledgerInventory(token,query));
    handle('campaign:ledger-item', (token: string, id: string) => store.ledgerItem(token, id));
    const campaignJobsRoot=path.join(dataDir,'campaign-jobs');await mkdirSync(campaignJobsRoot,{recursive:true});
    type CampaignTicket={dir:string;manifest:CampaignManifest;copy:boolean;fence:{id:string;revision:number}|null;basis?:string;problems?:string[]};
    const campaignTickets=new Map<string,CampaignTicket>();let campaignBusy=false,campaignCancelled=false,audioBusy=false,audioCancelled=false,currentCampaignSource:string|null=null,acceptingTicket:string|null=null;
    const campaignProgress=(p:import('../src/app/campaign-contracts').CampaignTransferProgress)=>{if(!win.isDestroyed())win.webContents.send('campaign:transfer-progress',p);};
    async function campaignJob<T>(fn:()=>Promise<T>){if(campaignBusy||audioBusy)throw new Error('Eine Kampagnen- oder Medienübertragung läuft bereits.');campaignBusy=true;campaignCancelled=false;try{return await fn();}finally{campaignBusy=false;currentCampaignSource=null;campaignProgress({phase:campaignCancelled?'Abgebrochen':'Fertig',records:0,bytes:0,busy:false});}}
    function campaignHooks(fence:CampaignTicket['fence']):CampaignFileHooks{return{cancelled:()=>campaignCancelled,progress:campaignProgress,fence:()=>{if(fence)store.campaignFence(fence.id,fence.revision);}};}
    async function captureCampaign(token:string){
      const dir=await mkdtemp(path.join(campaignJobsRoot,'snapshot-')),dbFile=path.join(dir,'campaign.sqlite');
      try{
        const snapshot=await store.campaignSnapshot(token,dbFile);currentCampaignSource=snapshot.id;
        const fence={id:snapshot.id,revision:snapshot.fence},hooks=campaignHooks(fence),media=new Map(snapshot.media.map(f=>[f.name,f]));
        const files=[{name:'campaign.sqlite',filename:dbFile},...snapshot.media.map(f=>({name:f.name,filename:campaignMediaPath(dataDir,f.name)})),
          {name:'catalog/srd-5.1.generated.json',filename:path.join(__dirname,'catalog','srd-5.1.generated.json')},
          {name:'catalog/srd-5.1-attribution.md',filename:path.join(__dirname,'catalog','SRD-5.1-ATTRIBUTION.md')}];
        const manifest:CampaignManifest={format:'Kampagnenwerkstatt Campaign',version:1,campaignId:snapshot.id,name:snapshot.name,applicationVersion:__APP_VERSION__,schema:snapshot.schema,createdAt:new Date().toISOString(),files:[]};
        for(const file of files){
          const actual={name:file.name,sha256:await fileDigest(file.filename,hooks),bytes:(await stat(file.filename)).size},expected=media.get(file.name);
          if(expected&&(actual.sha256!==expected.sha256||actual.bytes!==expected.bytes))throw new Error('Kampagnenmedien fehlen oder sind verändert: '+file.name);
          manifest.files.push(actual);
        }
        checkCampaignContents(manifest,snapshot);if(hooks.cancelled())throw new Error('Kampagnenübertragung abgebrochen.');hooks.fence();
        return{dir,manifest,files,fence};
      }catch(e){await rm(dir,{recursive:true,force:true});throw e;}
    }
    async function campaignPreview(ticket:CampaignTicket){
      try{
        const preview=store.campaignPreview(path.join(ticket.dir,'campaign.sqlite'));
        checkCampaignContents(ticket.manifest,preview);
        const catalog=ticket.manifest.files.find(f=>f.name==='catalog/srd-5.1.generated.json'),problems:string[]=[];
        if(!catalog||catalog.sha256!==await fileDigest(path.join(__dirname,'catalog','srd-5.1.generated.json'),campaignHooks(ticket.fence)))problems.push('Der Kreaturkatalog des Pakets passt nicht zu dieser Produktversion.');
        const key=randomUUID();ticket.basis=JSON.stringify(preview.conflicts);ticket.problems=problems;campaignTickets.set(key,ticket);
        return{ticket:key,name:preview.name,campaignId:preview.id,applicationVersion:ticket.manifest.applicationVersion,schema:preview.schema,counts:preview.counts,audioFiles:ticket.manifest.files.filter(f=>f.name.startsWith('audio/')).length,bytes:ticket.manifest.files.reduce((n,f)=>n+f.bytes,0),conflicts:preview.conflicts,problems,copy:ticket.copy};
      }catch(error){await rm(ticket.dir,{recursive:true,force:true});throw error;}
    }
    handle('campaign:overview',()=>store.campaignOverview());
    handle('campaign:trash',(command:Parameters<typeof store.trashCampaign>[0])=>{if(currentCampaignSource===command.id)campaignCancelled=true;store.trashCampaign(command);});
    handle('campaign:erase',async(command:Parameters<typeof store.eraseCampaign>[0])=>{if(currentCampaignSource===command.id)campaignCancelled=true;for(const [id,ticket]of campaignTickets)if(ticket.fence?.id===command.id){campaignTickets.delete(id);await rm(ticket.dir,{recursive:true,force:true});}store.eraseCampaign(command);for(const name of await readdir(dataDir))if(name==='recovery.sqlite'||name.startsWith('recovery.sqlite.candidate-'))await rm(path.join(dataDir,name),{force:true});store.finishCampaignErasure(command.id);});
    handle('campaign:export', (token:string)=>campaignJob(async()=>{const capture=await captureCampaign(token);try{const selection=await dialog.showSaveDialog(win,{title:'Kampagne vollständig exportieren',defaultPath:capture.manifest.name+'.kwcampaign',filters:[{name:'Kampagnenwerkstatt Campaign',extensions:['kwcampaign']}]});if(selection.canceled||!selection.filePath)return{cancelled:true};await exportCampaignArchive(selection.filePath,capture.manifest,capture.files,campaignHooks(capture.fence));return{cancelled:false};}finally{await rm(capture.dir,{recursive:true,force:true});}}));
    handle('campaign:copy-preview',(token:string)=>campaignJob(async()=>{const capture=await captureCampaign(token);return campaignPreview({dir:capture.dir,manifest:capture.manifest,copy:true,fence:capture.fence});}));
    handle('campaign:import-preview',()=>campaignJob(async()=>{const selection=await dialog.showOpenDialog(win,{title:'Kampagnenpaket auswählen',properties:['openFile'],filters:[{name:'Kampagnenwerkstatt Campaign',extensions:['kwcampaign']}]});if(selection.canceled)return null;const extracted=await extractCampaignArchive(selection.filePaths[0]!,campaignJobsRoot,campaignHooks(null));return campaignPreview({...extracted,copy:false,fence:null});}));
    handle('campaign:transfer-status',(ticketId:string)=>{
      const campaign=store.campaignTransferOutcome(ticketId);
      return campaign?{state:'applied' as const,campaign}:{state:acceptingTicket===ticketId?'pending' as const:'not-applied' as const};
    });
    handle('campaign:transfer-accept',(ticketId:string,name:string,choices:Record<string,import('../src/app/campaign-contracts').ConflictChoice>)=>campaignJob(async()=>{
      const confirmed=store.campaignTransferOutcome(ticketId,{name,choices});if(confirmed)return confirmed;
      acceptingTicket=ticketId;
      try{
        const ticket=campaignTickets.get(ticketId);if(!ticket)throw new Error('Importvorschau nicht mehr verfügbar.');
        const hooks=campaignHooks(ticket.fence);
        const campaign=await acceptPreparedCampaign(store,{...ticket,acceptanceId:ticketId},dataDir,name,choices,{...hooks,fence:()=>{
          if(campaignTickets.get(ticketId)!==ticket)throw new Error('Importvorschau nicht mehr verfügbar.');
          hooks.fence();
        }});
        campaignTickets.delete(ticketId);try{await rm(ticket.dir,{recursive:true,force:true});}catch(e){console.error('Kampagne übernommen; temporäre Paketbereinigung steht aus.',e instanceof Error?e.message:e);}return campaign;
      }finally{acceptingTicket=null;}
    }));
    handle('campaign:transfer-cancel',async(ticketId?:string)=>{campaignCancelled=true;if(ticketId){const ticket=campaignTickets.get(ticketId);if(ticket){campaignTickets.delete(ticketId);await rm(ticket.dir,{recursive:true,force:true});}}});
    const hooks:TransferHooks={cancelled:()=>audioCancelled,progress:p=>{if(!win.isDestroyed())win.webContents.send('music:progress',p);}};
    async function transfer<T>(task:()=>Promise<T>){if(audioBusy||campaignBusy)throw new Error('Eine Kampagnen- oder Medienübertragung läuft bereits.');audioBusy=true;audioCancelled=false;try{return await task();}finally{audioBusy=false;hooks.progress({phase:audioCancelled?'Abgebrochen':'Fertig',bytes:0,files:0,busy:false});}}
    handle('music:assets',(query:import('../src/app/music-contracts').AudioQuery)=>store.audioAssets(query));
    handle('music:asset',(id:string)=>store.audioAsset(id));
    handle('music:view',(token:string)=>store.music(token));
    handle('music:subject',(token:string,kind:import('../src/app/music-contracts').MusicSubject['kind'],id:string)=>store.musicSubject(token,kind,id));
    handle('music:execute',(command:import('../src/app/music-contracts').MusicCommand)=>store.executeMusic(command));
    handle('music:position',(token:string,id:string,seconds:number)=>store.musicPosition(token,id,seconds));
    handle('music:cancel',()=>{audioCancelled=true;});
    handle('music:pick',(token:string)=>transfer(async()=>{store.music(token);const selection=await dialog.showOpenDialog(win,{title:'Lokale Audiodateien hinzufügen',properties:['openFile','multiSelections'],filters:[{name:'Audio',extensions:['mp3','ogg','oga','opus','wav','flac','m4a','aac']}]});if(selection.canceled)return{cancelled:true,ids:[]};const medias:import('../src/app/music-contracts').AudioAsset['media'][]=[];for(const filename of selection.filePaths)medias.push(await copyAudio(filename,path.join(dataDir,'audio'),hooks));if(audioCancelled)throw new Error('Audioimport abgebrochen.');return{cancelled:false,ids:store.ingestAudios(token,medias).map(a=>a.id)};}));
    handle('music:export',(token:string)=>transfer(async()=>{const library=store.audioLibrary(token),selection=await dialog.showSaveDialog(win,{title:'Musikbibliothek mit Medien exportieren',defaultPath:'Musikbibliothek.kwmusic',filters:[{name:'Kampagnenwerkstatt Musikbibliothek',extensions:['kwmusic']}]});if(selection.canceled||!selection.filePath)return{cancelled:true};await exportAudioBundle(selection.filePath,path.join(dataDir,'audio'),library,hooks);return{cancelled:false};}));
    handle('music:import',(token:string)=>transfer(async()=>{store.music(token);const selection=await dialog.showOpenDialog(win,{title:'Musikbibliothek importieren',properties:['openFile'],filters:[{name:'Kampagnenwerkstatt Musikbibliothek',extensions:['kwmusic']}]});if(selection.canceled)return{cancelled:true,ids:[]};const library=await importAudioBundle(selection.filePaths[0]!,path.join(dataDir,'audio'),hooks);if(audioCancelled)throw new Error('Bibliotheksimport abgebrochen.');return{cancelled:false,ids:store.mergeAudioLibrary(token,library)};}));
    handle('dungeon:view',(token:string)=>store.dungeon(token));
    handle('dungeon:preview',(token:string,r:import('../src/app/dungeon-contracts').DungeonRequest)=>store.previewDungeon(token,r));
    handle('dungeon:execute',(c:import('../src/app/dungeon-contracts').DungeonCommand)=>store.executeDungeon(c));
    handle('campaign:groups',(token:string,search:string,after:string|null)=>store.preparedGroups(token,search,after));
    handle('campaign:group-view',(token:string,id:string)=>store.groupView(token,id));
    handle('campaign:group-draft',(token:string,id:string)=>store.groupDraft(token,id));
    handle('campaign:keep-group-draft',(token:string,draft:import('../src/app/groups-contracts').GroupDraft,expected:string|null)=>store.keepGroupDraft(token,draft,expected));
    handle('campaign:discard-group-draft',(token:string,id:string,writeId:string)=>store.discardGroupDraft(token,id,writeId));
    handle('campaign:prepared-group',(token:string,id:string)=>store.preparedGroup(token,id));
    handle('graph:view',(token:string,scopeId:string)=>store.graph(token,scopeId));
    handle('graph:execute',(c:import('../src/app/graph-contracts').GraphCommand)=>store.executeGraph(c));
    handle('drawing:path-preview',(token:string,p:import('../src/app/path-contracts').DungeonPath)=>store.previewPath(token,p));
    handle('drawing:view',(token:string)=>store.drawing(token));
    handle('drawing:execute',(c:import('../src/app/drawing-contracts').DrawingCommand)=>store.executeDrawing(c));
    handle('drawing:feature',(token:string,id:string,sceneId:string,expected:number,action:'activate'|'reset'|'correct',charges:number|null,commandId:string)=>store.activateFeature(token,id,sceneId,expected,action,charges,commandId));
    handle('drawing:export',async(token:string,scopeId:string,floorId:string,format:'svg'|'json'|'keys'|'document',publicOnly:boolean)=>{if(!['svg','json','keys','document'].includes(format))throw new Error('Ausgabeformat unbekannt.');store.drawing(token);const g=store.dungeon(token),v=g.drawing,rooms=g.rooms.filter(r=>r.scopeId===scopeId&&r.floorId===floorId),text=format==='svg'?dungeonSvg(rooms.filter(r=>!publicOnly||!v.keyContent?.some(c=>c.id===r.id&&c.secret)),v,scopeId,floorId,publicOnly):format==='document'?dungeonKeyDocument(g,scopeId,publicOnly):format==='keys'?dungeonKeyMarkdown(g,scopeId,publicOnly,floorId):publicOnly?JSON.stringify({format:'Kampagnenwerkstatt Dungeon public',version:1,scopeId,floorId,svg:dungeonSvg(rooms.filter(r=>!v.keyContent?.some(c=>c.id===r.id&&c.secret)),v,scopeId,floorId,true),key:dungeonKeyMarkdown(g,scopeId,true,floorId)},null,2):JSON.stringify({format:'Kampagnenwerkstatt Dungeon',version:1,scopeId,floorId,rooms,view:{...v,keyContent:v.keyContent?.filter(k=>k.scopeId===scopeId),paths:v.paths?.filter(p=>p.scopeId===scopeId),passages:v.passages?.filter(p=>p.scopeId===scopeId),volumes:v.volumes?.filter(p=>p.scopeId===scopeId),elements:v.elements.filter(e=>e.scopeId===scopeId),styles:v.styles.filter(e=>e.scopeId===scopeId),hiddenRooms:v.hiddenRooms.filter(e=>e.scopeId===scopeId),hiddenFloors:v.hiddenFloors.filter(e=>e.scopeId===scopeId),features:[]}},null,2);const extension=format==='keys'?'md':format==='document'?'html':format,selection=await dialog.showSaveDialog(win,{defaultPath:'Dungeon.'+extension,filters:[{name:'Dungeon',extensions:[extension]}]});if(selection.canceled||!selection.filePath)return{cancelled:true};await writeFile(selection.filePath,text);return{cancelled:false};});
    handle('autonomy:view',(token:string)=>store.autonomy(token));
    handle('autonomy:execute',(c:import('../src/app/autonomy-contracts').AutonomyCommand)=>store.executeAutonomy(c));
    handle('player:view',(token:string)=>store.playerView(token));
    handle('player:execute',(command:import('../src/app/player-contracts').PlayerCommand)=>store.executePlayer(command));
    handle('player:screens',()=>screen.getAllDisplays().map(d=>({id:d.id,name:d.label||'Bildschirm '+d.id+' · '+d.size.width+' × '+d.size.height})));
    handle('player:window',(token:string,open:boolean)=>{if(typeof open!=='boolean')throw new Error('Fensteraktion prüfen.');store.playerWindowOpen(token,open);});
    handle('player:art',async(token:string,kind:import('../src/app/player-contracts').PlayerAsset['kind'],subjectId:string|null,title:string)=>{store.playerView(token);const pick=await dialog.showOpenDialog(win,{title:'Bild für Spieleranzeige hinterlegen',properties:['openFile'],filters:[{name:'Bilder',extensions:['png','jpg','jpeg','webp']}]});if(pick.canceled||!pick.filePaths[0])return null;const filename=pick.filePaths[0];if((await stat(filename)).size>32*1024*1024)throw new Error('Bild ist größer als 32 MiB.');const image=nativeImage.createFromPath(filename),size=image.getSize();if(image.isEmpty()||size.width>8192||size.height>8192)throw new Error('Bildformat oder Bildmaße prüfen (maximal 8192 × 8192).');const bytes=image.resize({width:Math.min(size.width,2400),height:Math.round(size.height*Math.min(1,2400/size.width))}).toPNG(),sha256=createHash('sha256').update(bytes).digest('hex'),dir=path.join(dataDir,'player-images');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,sha256+'.png'),bytes);return store.registerPlayerAsset(token,{id:randomUUID(),kind,subjectId,title,sha256,extension:'.png',bytes:bytes.length});});
    handle('city:list',(token:string)=>store.cities(token));
    handle('city:view',(token:string,id:string)=>store.city(token,id));
    handle('city:execute',(c:import('../src/app/city-contracts').CityCommand)=>store.executeCity(c));
    handle('city:export',async(token:string,id:string,format:'svg'|'json')=>{if(!['svg','json'].includes(format))throw new Error('Ausgabeformat unbekannt.');const city=store.city(token,id),destination=await dialog.showSaveDialog(win,{defaultPath:city.header.name+'.'+format,filters:[{name:'Stadtplan',extensions:[format]}]});if(destination.canceled||!destination.filePath)return{cancelled:true};const text=format==='svg'?citySvg(city):JSON.stringify({format:'Kampagnenwerkstatt City',version:1,...city},null,2);await writeFile(destination.filePath,text);return{cancelled:false};});
    handle('world:view',(token:string)=>store.world(token));
    handle('world:scene',(token:string,id:string)=>store.sceneWorld(token,id));
    handle('world:travel-preview',(token:string,request:import('../src/app/world-contracts').TravelRequest)=>store.previewTravel(token,request));
    handle('world:reconcile',(command:import('../src/app/world-contracts').WorldCommand,token:string)=>store.reconcileWorld(command,token));
    handle('world:execute',(command:import('../src/app/world-contracts').WorldCommand)=>store.executeWorld(command));
    handle('items:definitions',(query:import('../src/app/items-contracts').ItemQuery)=>store.itemDefinitions(query));
    handle('items:definition',(id:string,revision?:number)=>store.itemDefinition(id,revision));
    handle('items:shops',(token:string,trashed:boolean)=>store.shops(token,trashed));
    handle('items:shop',(token:string,id:string)=>store.shop(token,id));
    handle('items:scene-shops',(token:string,id:string)=>store.sceneShops(token,id));
    const commits=new CommitTracker((ref,token)=>store.commitStatus(ref,token));
    handle('campaign:commit-status',(ref:import('../src/app/commit-receipt').CommitReference,token:string)=>commits.status(ref,token));
    handle('items:execute',(command:import('../src/app/items-contracts').ItemShopCommand)=>commits.execute('items',command,()=>store.executeItemShop(command)));
    handle('campaign:execute-progress', (command: ProgressCommand) => commits.execute('progress',command,()=>store.executeProgress(command)));
    handle('campaign:loot-balance',(token:string)=>store.lootBalance(token));
    handle('campaign:chronicle',(token:string,category:ChronicleCategory|'all'='all',search='')=>store.chronicle(token,category,search));
    handle('campaign:chronicle-export',async(token:string,category:ChronicleCategory|'all',search:string)=>{if(!['all','combat','narrative','reward','travel','party','world'].includes(category)||typeof search!=='string'||search.length>1000)throw new Error('Chronikfilter ungültig.');const view=store.chronicle(token,category,search),safe=view.campaignName.replace(/[\\/:*?"<>|]+/g,'-').trim()||'Kampagne',destination=await dialog.showSaveDialog(win,{defaultPath:safe+' – Chronik.md',filters:[{name:'Markdown',extensions:['md']}]});if(destination.canceled||!destination.filePath)return{cancelled:true};await writeFile(destination.filePath,chronicleMarkdown(view,category,search),'utf8');return{cancelled:false};});
    handle('campaign:combat-draft',(token:string,id:string,kind:import('../src/app/combat-draft-contracts').CombatDraftKind,target:string)=>store.combatDraft(token,id,kind,target));
    handle('campaign:combat-drafts',(token:string,id:string,after:string|null)=>store.combatDrafts(token,id,after));
    handle('campaign:keep-combat-draft',(token:string,draft:import('../src/app/combat-draft-contracts').CombatWorkingDraft,expected:string|null)=>store.keepCombatDraft(token,draft,expected));
    handle('campaign:discard-combat-draft',(token:string,id:string,kind:import('../src/app/combat-draft-contracts').CombatDraftKind,target:string,writeId:string)=>store.discardCombatDraft(token,id,kind,target,writeId));
    handle('campaign:combat', (token: string, sceneId: string, id?: string) => store.combat(token, sceneId, id));
    handle('campaign:chase',(token:string,sceneId:string,id?:string)=>store.chase(token,sceneId,id));
    handle('campaign:execute-chase',(command:import('../src/app/chase-contracts').ChaseCommand)=>commits.execute('chase',command,()=>store.executeChase(command)));
    handle('campaign:execute-combat', (command: CombatCommand) => commits.execute('combat',command,()=>store.executeCombat(command)));
    handle('campaign:live', (token: string) => store.live(token));
    handle('campaign:live-scene', (token: string, id: string) => store.liveScene(token, id));
    handle('campaign:live-archives', (token: string, after: string | null) => store.liveArchives(token, after));
    handle('campaign:execute-live', (command: LiveCommand) => store.executeLive(command));
    handle('campaign:live-status', (command: LiveCommand, token: string) => store.liveStatus(command, token));
    handle('campaign:change-preparation', (command: PreparationCommand) => store.changePreparation(command));
    handle('campaign:select-preparation', (token: string, selection: PreparationSelection) => store.selectPreparation(token, selection));
    handle('campaign:reconcile-preparation', (command: PreparationCommand, token?: string) => store.reconcilePreparation(command, token));
    handle('campaign:preparation-draft', (token: string, kind: PreparationEdit['kind'], id: string) => store.preparationDraft(token, kind, id));
    handle('campaign:keep-preparation-drafts', (token: string, drafts: PreparationDraft[]) => store.keepPreparationDrafts(token, drafts));
    handle('campaign:discard-preparation-draft', (token: string, kind: PreparationEdit['kind'], id: string, writeId: string) => store.discardPreparationDraft(token, kind, id, writeId));
    handle('campaign:history', (token: string, direction: 'undo' | 'redo') => store.history(token, direction));
    handle('campaign:preview-import', async (): Promise<ImportPreview | null> => {
      const chosen = await dialog.showOpenDialog(win, { title: 'v4-Dungeon als neue Kampagne übernehmen', filters: [{ name: 'Dungeon', extensions: ['dungeon'] }], properties: ['openFile'] });
      if (chosen.canceled || !chosen.filePaths[0]) return null;
      const bytes = readFileSync(chosen.filePaths[0]);
      if (bytes.length > 64 * 1024 * 1024) throw new Error('Dieser erste Import kann Dateien bis 64 MiB prüfen.');
      const inspected = inspectDungeon(bytes.toString('utf8')), ticket = randomUUID();
      imports.clear(); imports.set(ticket, { bytes, name: inspected.name, rooms: inspected.rooms });
      return { ticket, name: inspected.name, roomCount: inspected.rooms.length, sourceHash: createHash('sha256').update(bytes).digest('hex'), warnings: inspected.warnings };
    });
    handle('campaign:import', (ticket: string) => {
      const pending = imports.get(ticket); if (!pending) throw new Error('Importvorschau abgelaufen. Bitte Datei erneut auswählen.');
      const result = store.create(pending.name, pending.rooms, pending.bytes); imports.delete(ticket); return result;
    });
    handle('campaign:backup-status', () => backupError);
    handle('campaign:tutorial', (state?: 'shown' | 'finished' | 'skipped') => store.tutorial(state));
    ipcMain.on('campaign:close-ready', event => { if (event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === origin) { closeAllowed = true; win.close(); } });
    win.on('close', event => { if (!closeAllowed) { event.preventDefault(); win.webContents.send('campaign:close'); } });
    const timer = setInterval(async () => {
      if (backupRunning) return;
      backupRunning = true;
      try { await store.backup(path.join(dataDir, 'recovery.sqlite')); backupError = null; }
      catch { backupError = 'Wiederherstellungskopie fehlgeschlagen. Die gespeicherten Änderungen liegen im Arbeitsstore.'; }
      finally { backupRunning = false; }
    }, 30000);
    win.on('closed', () => { clearInterval(timer);playerDisplay.shutdown(); });
    await win.loadURL(origin);
    app.on('before-quit', event => { if (!closeAllowed && win && !win.isDestroyed()) { event.preventDefault(); win.close(); } });
  }).catch(error => { console.error(error);dialog.showErrorBox('Kampagnenwerkstatt kann nicht starten', String(error)); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => { if (!backupRunning) store?.close(); });
}
