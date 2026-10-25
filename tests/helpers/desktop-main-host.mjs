import assert from 'node:assert/strict';
import {buildSync} from './build.mjs';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const require=createRequire(import.meta.url);
export const mainHostBuildRoot=path.resolve('.build/desktop-main-host',String(process.pid));
mkdirSync(mainHostBuildRoot,{recursive:true});
for(const [name,file] of [['store-client','desktop/store-client.ts'],['store-worker','desktop/store-worker.ts'],['backup-validation-worker','desktop/backup-validation-worker.ts'],['atlas-region-worker','desktop/atlas-region-worker.ts'],['room-directory-worker','desktop/room-directory-worker.ts']]){
 buildSync({entryPoints:[file],outfile:path.join(mainHostBuildRoot,name+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
}
mkdirSync(path.join(mainHostBuildRoot,'catalog'),{recursive:true});
copyFileSync('src/features/catalog/data/srd-5.1.generated.json',path.join(mainHostBuildRoot,'catalog/srd-5.1.generated.json'));
export const {StoreClient,StoreOutcomeUnknownError}=require(path.join(mainHostBuildRoot,'store-client.cjs'));
const main=buildSync({entryPoints:['desktop/main.ts'],bundle:true,platform:'node',format:'cjs',write:false,
 external:['electron','better-sqlite3','./store-client','./update-runtime','./update-service'],define:{__APP_VERSION__:'"0.190.1"'}}).outputFiles[0].text;
const preload=buildSync({entryPoints:['desktop/preload.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['electron']}).outputFiles[0].text;

/** Faults surround the real worker entry, never alter product code or replay a call. */
export function storeFaultWorker(method,mode){
 assert(['before-execution','lost-response','uncloneable-response','misleading-error'].includes(mode));
 const filename=path.join(mainHostBuildRoot,`fault-${method}-${mode}.cjs`);
 writeFileSync(filename,`const {parentPort}=require('node:worker_threads');let target;
parentPort.on('message',message=>{if(message.method===${JSON.stringify(method)}){target=message.id;if(${JSON.stringify(mode)}==='before-execution')process.exit(8);}});
const send=parentPort.postMessage.bind(parentPort);
parentPort.postMessage=message=>{
 if(message.id===target){
  if(message.kind==='result'&&${JSON.stringify(mode)}==='lost-response')process.exit(7);
  if(message.kind==='result'&&${JSON.stringify(mode)}==='uncloneable-response')message.uncloneable=()=>{};
  if(message.kind==='error'&&${JSON.stringify(mode)}==='misleading-error')message.error='Speicherbestätigung ungeklärt. Keine automatische Wiederholung. Nach Neustart den Buchungsbeleg prüfen. StoreOutcomeUnknownError';
 }
 return send(message);
};
require('./store-worker.cjs');\n`);
 return filename;
}

/** Exact Main registrations + preload + real canonical writer. Only Electron's
 * native shell and update startup are substituted. No general Store port is
 * exposed to the renderer; tests get store/dispatches separately for assertions.
 * restart() is an explicit ordered application restart, never an automatic retry. */
export async function desktopMainHost(t,{workerFile}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'desktop-main-host-')),sessions=[];
 t.after(async()=>{for(const host of sessions)await host.close();rmSync(dir,{recursive:true,force:true});});
 async function open(file){
  const handlers=new Map(),events=new Map(),dispatches=[],errors=[];let store,win,api,readyResolve,readyReject,closedResolve,closedReject,closing;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const closed=new Promise((resolve,reject)=>{closedResolve=resolve;closedReject=reject;});
  const event=()=>({sender:win.webContents,senderFrame:win.webContents.mainFrame});
  const session={setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){},webRequest:{onBeforeRequest(){}},protocol:{handle(){}}};
  const electron={app:{setName(){},getPath:()=>dir,setPath(){},requestSingleInstanceLock:()=>true,quit:()=>closedResolve(),exit:code=>readyReject(Error('Startup exited '+code)),on(){},whenReady:()=>Promise.resolve()},
   BrowserWindow:class {constructor(){win=this;this.webContents={mainFrame:{url:'campaign://app/index.html'},session,setWindowOpenHandler(){},on(){},send(){}};}on(){}isDestroyed(){return false;}async loadURL(){readyResolve();}},
   dialog:{showErrorBox:(...args)=>{errors.push(args);readyReject(Error(args.join(': ')));if(args[0]==='Schließen fehlgeschlagen')closedReject(Error(args.join(': ')));}},
   ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>events.set(name,fn)},
   protocol:{registerSchemesAsPrivileged(){},handle(){}},session:{fromPartition:()=>session}};
  class HostStoreClient extends StoreClient {
   constructor(filename,version){
    super(filename,version,file??path.join(mainHostBuildRoot,'store-worker.cjs'));store=this;
    const send=this.worker.postMessage.bind(this.worker);
    this.worker.postMessage=message=>{if(message.kind==='call')dispatches.push(structuredClone(message));return send(message);};
   }
  }
  const mocks={electron,'./store-client':{StoreClient:HostStoreClient,StoreOutcomeUnknownError},
   './update-runtime':{openUpdateRuntime:async()=>({root:null,transaction:null,close:async()=>{}})},'./update-service':{UpdateService:class {async init(){}}}};
  const host={dir,dispatches,errors,get store(){return store;},get api(){return api;},
   close:()=>closing??=(async()=>{const stop=events.get('campaign:close-ready');if(stop){stop(event());await closed;}else if(store)await store.close();})(),
   restart:async()=>{await host.close();return open();}};
  sessions.push(host);
  const mainGlobals={require:name=>mocks[name]??require(name),__dirname:mainHostBuildRoot,process:{...process,argv:['node','main','--data-dir',dir]},
   console,Buffer,Uint8Array,URL,Response,Error,SharedArrayBuffer,Int32Array,Atomics,setInterval:()=>0,clearInterval(){},setTimeout:()=>({unref(){}})};
  // Main and StoreClient share one JS realm in Electron. Preserve that here so
  // strict plain-DTO checks also accept objects constructed by Main itself.
  new Function(...Object.keys(mainGlobals),main)(...Object.values(mainGlobals));
  await ready;
  // Electron IPC uses structured clone in both directions; preserve that boundary.
  const invoke=async(name,...args)=>structuredClone(await handlers.get(name)(event(),...structuredClone(args)));
  new Function('require',preload)(name=>{assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'campaign');api=value;}},ipcRenderer:{invoke}};});
  return host;
 }
 return open(workerFile);
}
