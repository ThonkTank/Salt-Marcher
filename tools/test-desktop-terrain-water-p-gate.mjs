/**
 * Capture adapter for the ONE already planned TW06-P/E 30-attempt native gate.
 * Preparation only until S1/S2 freeze and a separate root start. No --smoke,
 * shorter count, replacement sample, synthetic pointer or preflight run mode.
 * The returned capture is evidence for direct review, not automatic acceptance.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {createRequire} from 'node:module';
import {copyFile,mkdir,readdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createNativeSession} from './native-session.mjs';
import {createTerrainWaterFixture,heightPayloadHash} from './terrain-water-fixture.mjs';
import {installTerrainFieldGateObserver,loadTerrainFieldProgramExpectation} from './terrain-water-field-gate.mjs';
import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
import {currentProcessGroup} from './process-group.mjs';
import {build} from 'esbuild';

assert.equal(process.env.TW_VIRTUAL_SESSION,'1','Use the existing private Wayland wrapper.');
const root=process.cwd(),hash=value=>createHash('sha256').update(value).digest('hex');
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const match=/^--([^=]+)=(.+)$/.exec(arg);assert(match,`Expected --name=value: ${arg}`);
  return[match[1],match[2]];
}));
assert(args['source-freeze']&&args['program-expectation']&&args.case&&args.output&&args['resource-contract'],
  'Required: --source-freeze=FILE --program-expectation=FILE --case=FILE --resource-contract=FILE --output=DIR');
const output=path.resolve(args.output);
assert(output.startsWith(path.join(root,'.build')+path.sep),'Evidence must be under .build.');
const freeze=JSON.parse(await readFile(args['source-freeze'],'utf8'));
assert.equal(freeze.accepted,true,'Only the accepted source freeze can enter the gate.');
assert.equal(freeze.acceptedS1S2,true,'S1/S2 must be independently accepted.');
assert(freeze.sourceHashes&&typeof freeze.sourceHashes==='object');
for(const [file,digest] of Object.entries(freeze.sourceHashes)){
  assert(!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'));
  assert.equal(hash(await readFile(path.join(root,file))),digest,`Frozen source drift: ${file}`);
}
const gateCase=JSON.parse(await readFile(args.case,'utf8'));
assert.equal(gateCase.schema,'terrain-water-p-early-case/v1');
assert.equal(gateCase.attempts,30);
assert.equal(gateCase.frozenBeforeLaunch,true);
assert.deepEqual(gateCase.trip,{worldWidthM:40000000,roomWidthM:20,returnWidthM:40000000});
assert.deepEqual(gateCase.cameraPose,{tilt:45,rotation:0,exaggeration:1,focusHeightM:250},
  'The camera pose must be fixed in the before-launch case.');
assert(gateCase.style&&gateCase.style.fixed===true&&gateCase.style.radiusM>0&&
  gateCase.style.strength>0&&gateCase.style.contours===-1&&gateCase.style.seaLevelM===0,
  'The initial contour, sea-level and brush style must be fixed before launch.');
assert(gateCase.strokePixels?.length>=3&&gateCase.followupPixels?.length>=2);
assert.equal(gateCase.requireIntermediateAlpha,true,
  'A confirmed naturally drawn intermediate-alpha press is required.');
assert.equal(gateCase.alphaTrigger,'first-confirmed-20m-intermediate-screen',
  'The predeclared natural intermediate-alpha trigger is fixed for all 30 attempts.');
assert.equal(gateCase.largeDrawCase?.activeTransitionDraws,1117,
  'The original K2 1117-draw load stage is required, separately from the normal trip.');
assert(Array.isArray(gateCase.pickPixels)&&gateCase.pickPixels.length===2&&
  gateCase.pickPixels.every(point=>Array.isArray(point)&&point.length===2&&
    point.every(value=>Number.isFinite(value)&&Math.abs(value)<.45)),
  'Two predeclared visible packed-field pick pixels are required.');
const caseBytes=await readFile(args.case),caseHash=hash(caseBytes);
const resourceContract=JSON.parse(await readFile(args['resource-contract'],'utf8'));
assert.equal(resourceContract.schema,'terrain-p-limited-resource-contract/v1');
assert.equal(resourceContract.reviewedBeforeLaunch,true);
assert(Number.isSafeInteger(resourceContract.projectedPeakBytes)&&resourceContract.projectedPeakBytes>0);
assert(Number.isSafeInteger(resourceContract.cgroupMaxBytes)&&
  resourceContract.cgroupMaxBytes>=resourceContract.projectedPeakBytes+512*1024**2,
  'The effective cgroup cap needs at least 512 MiB above the reviewed projected peak.');
assert(Number.isSafeInteger(resourceContract.hostReserveBytes)&&resourceContract.hostReserveBytes>0);
assert(resourceContract.classes&&['prepared','author','transport','gpu','workerAndSqlite',
  'dtoAndBrowser','adapterFramesAndWrites','largeDraw1117','miscReserve'].every(key=>
  Number.isSafeInteger(resourceContract.classes[key])&&resourceContract.classes[key]>=0));
assert(Object.values(resourceContract.classes).reduce((a,b)=>a+b,0)<=resourceContract.projectedPeakBytes,
  'The reviewed projected peak must include every named class without alias deductions.');
assert(resourceContract.hostReserveBytes>=2*1024**3&&
  resourceContract.classes.adapterFramesAndWrites>=64*1024**2&&
  resourceContract.classes.workerAndSqlite>=256*1024**2&&
  resourceContract.classes.dtoAndBrowser>=256*1024**2&&
  resourceContract.classes.largeDraw1117>=128*1024**2&&
  resourceContract.classes.miscReserve>=256*1024**2,
  'The limited gate needs explicit host, adapter, K2, worker/SQLite, browser and unknown reserves.');
assert(resourceContract.classes.gpu>=512*1024**2,
  'The full prepared GPU budget must be reserved without a CPU alias deduction.');
assert(resourceContract.classes.transport>=250_320_928,
  'Separate author/result transport copies must fit the reviewed reserve.');
assert(Number.isSafeInteger(resourceContract.releaseGrowthAllowanceBytes)&&
  resourceContract.releaseGrowthAllowanceBytes>=0&&
  resourceContract.releaseGrowthAllowanceBytes<=512*1024**2,
  'A reviewed post-close plateau growth allowance is required.');
const countInput=resourceContract.counts;
assert(countInput?.prepared&&countInput?.author&&
  Number.isSafeInteger(countInput.prepared.simultaneousGroups)&&countInput.prepared.simultaneousGroups>=1,
  'Bound allocation counts and simultaneous groups are required.');
await mkdir(output,{recursive:true});
const resourceFunctionsFile=path.join(output,'bound-resource-functions.mjs');
await build({entryPoints:[path.join(root,'src/app/atlas-terrain-prepared-budget.ts')],
  outfile:resourceFunctionsFile,bundle:true,platform:'node',format:'esm',target:'node22'});
const {terrainPreparedAllocation,terrainPreparedAuthorBound}=await import(pathToFileURL(resourceFunctionsFile).href);
const plannedPrepared=terrainPreparedAllocation(...['vertices','indices','nodes','rayNodes','triangles']
  .map(key=>countInput.prepared[key]));
const plannedAuthor=terrainPreparedAuthorBound(...['lattices','windowPages','editPages','suffix']
  .map(key=>countInput.author[key]));
const plannedPreparedBytes=Object.values(plannedPrepared).reduce((a,b)=>a+b,0)*
  countInput.prepared.simultaneousGroups;
const largestPreparedStoreBytes=Math.max(...Object.values(plannedPrepared));
const plannedAuthorBytes=plannedAuthor.backingBytes+plannedAuthor.adapterUtf16+
  plannedAuthor.actionNumericContent+plannedAuthor.metadataNumericContent;
assert(resourceContract.classes.prepared>=plannedPreparedBytes&&
  resourceContract.classes.author>=plannedAuthorBytes,
  'Reviewed classes undercount exact prepared/author formula results.');
assert(resourceContract.classes.adapterFramesAndWrites>=64*1024**2+largestPreparedStoreBytes,
  'Adapter reserve must cover an additional packed-store digest/read buffer.');
assert(freeze.sourceHashes['src/app/atlas-terrain-prepared-budget.ts']&&
  freeze.sourceHashes['src/app/atlas-terrain-field-presentation.ts']&&
  freeze.sourceHashes['src/app/atlas-terrain-prepared-field.ts']&&
  freeze.sourceHashes['tools/terrain-water-field-gate.mjs']&&
  freeze.sourceHashes['tools/test-desktop-terrain-water-p-gate.mjs'],
  'Allocation, K2, packed vertex, FieldGate and adapter must be in the accepted freeze.');
const k2HelperFile=path.join(output,'k2-1117-producer.js');
await build({stdin:{resolveDir:root,contents:
  "export {prepareAtlasTerrainFieldGeometry} from './src/app/atlas-terrain-field-presentation.ts'; export {terrainEvaluateVertex} from './src/app/atlas-terrain-prepared-field.ts';"},
  outfile:k2HelperFile,bundle:true,platform:'browser',format:'iife',globalName:'TWK2'});
const k2HelperSha256=hash(await readFile(k2HelperFile));
const expectationPath=path.resolve(args['program-expectation']);
const expectationBytes=await readFile(expectationPath);
const expectation=await loadTerrainFieldProgramExpectation(expectationPath);
const k2Source=path.resolve(gateCase.largeDrawCase.sourceReference);
assert.equal(path.relative(root,k2Source),
  '.build/terrain-water-k2/tw06-k2-20261026/partition-count.mjs',
  'The original exact K2 producer script is required.');
assert.equal(hash(await readFile(k2Source)),gateCase.largeDrawCase.sourceSha256,
  'The original 1117-draw K2 producer must be pinned before native launch.');
const native=await createNativeSession({root,output,name:'terrain-water-p-gate',resultName:'native-capture-result.json'});
assert.deepEqual(expectation.runtimeHashes,native.artifacts,
  'The 13 actual native runtime artifacts differ from the offline expected program.');
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
const result={schema:'terrain-water-p-early-capture/v1',qualified:false,
  scope:'One unchanged 30-attempt P/E hardware gate; direct visual review and resource qualification pending',
  started:new Date().toISOString(),sourceFreeze:{path:path.resolve(args['source-freeze']),sha256:hash(await readFile(args['source-freeze']))},
  programExpectation:{path:expectationPath,sha256:hash(expectationBytes),identity:expectation.identity},
  case:{path:path.resolve(args.case),sha256:caseHash,plan:gateCase},
  resourceContract:{path:path.resolve(args['resource-contract']),sha256:hash(await readFile(args['resource-contract'])),
    budget:resourceContract,formulaSourceSha256:hash(await readFile(path.join(root,'src/app/atlas-terrain-prepared-budget.ts'))),
    plannedPrepared,plannedAuthor,plannedPreparedBytes,plannedAuthorBytes,
    largestPreparedStoreBytes},
  inputProvenance:{wheel:'Electron webContents.sendInputEvent (Chromium)',mouse:'Playwright page.mouse (Chromium)',
    osMouseProof:false,eisHelper:'keyboard only'},attempts:[],failure:null};
let page,fixture,seedFile,frameStream,frameWrites=[],activeAttempt,resourceMonitor;
let firstReleaseCurrentBytes=null;
let terminalFailure=null;
function abort(message){if(!terminalFailure){terminalFailure=Error(message);
  if(native.app)void native.app.evaluate((_,text)=>{globalThis.twPTerminal??=text;},
    String(message)).catch(()=>{});
}return terminalFailure;}
function assertNotTerminal(){if(terminalFailure)throw terminalFailure;}
async function healthy(){
  assertNotTerminal();
  if(page){
    const state=await page.evaluate(()=>({terminal:window.__twP?.terminal??null,
      ready:document.querySelector('#campaign-map')?.dataset.terrainReady}));
    if(state.terminal)throw abort('Renderer terminal: '+state.terminal);
    if(state.ready==='failed')throw abort('Terrain ready failed');
  }
  const main=await native.app.evaluate(()=>globalThis.twPTerminal??null);
  if(main)throw abort('Main terminal: '+main);
}
const cgroupOf=async pid=>(await readFile(`/proc/${pid}/cgroup`,'utf8'))
  .split('\n').find(row=>row.startsWith('0::'))?.slice(3)??null;
const numberFile=async filename=>{
  const value=(await readFile(filename,'utf8')).trim();
  return value==='max'?Infinity:Number(value);
};
const memoryEvents=async directory=>Object.fromEntries((await readFile(path.join(directory,'memory.events'),'utf8'))
  .trim().split('\n').map(row=>{const [key,value]=row.split(' ');return[key,Number(value)];}));
const memAvailable=async()=>Number((await readFile('/proc/meminfo','utf8'))
  .match(/^MemAvailable:\s+(\d+) kB/m)?.[1])*1024;
async function startResourceMonitor(){
  const group=await currentProcessGroup();
  assert(group!=='/'&&group.length>12,'A dedicated protected private-session cgroup is required.');
  assert.equal(group,resourceContract.expectedCgroup,
    'The reviewed external memory guard must contain the harness before native launch.');
  const directory='/sys/fs/cgroup'+group;
  const limit=await numberFile(path.join(directory,'memory.max'));
  assert(Number.isFinite(limit)&&limit===resourceContract.cgroupMaxBytes,
    'A finite, exact reviewed cgroup memory.max is required.');
  assert(resourceContract.projectedPeakBytes<limit);
  const compositorPid=Number(execFileSync('gdbus',['call','--session',
    '--dest','org.freedesktop.DBus','--object-path','/org/freedesktop/DBus',
    '--method','org.freedesktop.DBus.GetConnectionUnixProcessID','org.kde.KWin'],
    {encoding:'utf8',timeout:5000}).match(/uint32 (\d+)/)?.[1]);
  const covered=member=>member===group||member?.startsWith(group+'/');
  assert(Number.isSafeInteger(compositorPid)&&compositorPid>0&&
    covered(await cgroupOf(compositorPid)),
    'The private compositor is outside the effective harness memory guard.');
  const available=await memAvailable(),current=await numberFile(path.join(directory,'memory.current'));
  assert(available-(resourceContract.projectedPeakBytes-current)>=resourceContract.hostReserveBytes,
    'The projected peak would consume the reviewed host reserve.');
  const initialEvents=await memoryEvents(directory),series=path.join(output,'resource-series.jsonl');
  assert.equal(await stat(series).then(()=>true,()=>false),false,
    'A fresh protected resource series is required for this gate.');
  const stream=createWriteStream(series,{flags:'wx'}),started=Date.now();
  stream.on('error',error=>abort('Protected resource-series write failed: '+error));
  let count=0,busy=false,lastAt=null,maxGapMs=0,peakCurrent=0,peakHarnessRss=0,
    terminal=null,cdp=null,app=null,timer=null;
  const sample=async()=>{
    if(busy)return;busy=true;
    try{
      const at=Date.now(),gap=lastAt===null?0:at-lastAt;lastAt=at;
      maxGapMs=Math.max(maxGapMs,gap);
      if(gap>500)terminal??='Resource sampling gap exceeded 500 ms';
      const [currentBytes,peakBytes,events,hostAvailable]=await Promise.all([
        numberFile(path.join(directory,'memory.current')),
        numberFile(path.join(directory,'memory.peak')),
        memoryEvents(directory),memAvailable()]);
      const pending=[directory],pidSet=new Set();let groups=0;
      while(pending.length){
        const next=pending.pop();if(++groups>128)throw Error('Guarded cgroup tree too broad to census');
        const [members,entries]=await Promise.all([
          readFile(path.join(next,'cgroup.procs'),'utf8').catch(()=>''),
          readdir(next,{withFileTypes:true}).catch(()=>[])]);
        for(const value of members.trim().split(/\s+/)){const pid=Number(value);if(pid)pidSet.add(pid);}
        for(const entry of entries)if(entry.isDirectory())pending.push(path.join(next,entry.name));
      }
      const pids=[...pidSet];
      const processes=[];
      for(const pid of pids){
        const [status,cmdline]=await Promise.all([
          readFile(`/proc/${pid}/status`,'utf8').catch(()=>null),
          readFile(`/proc/${pid}/cmdline`).catch(()=>null)]);
        if(!status)continue;
        const kb=key=>Number(status.match(new RegExp(`^${key}:\\s+(\\d+) kB`,'m'))?.[1]??0);
        const command=cmdline?.toString('utf8').replaceAll('\0',' ').slice(0,400)??'';
        processes.push({pid,kind:pid===process.pid?'harness':pid===compositorPid?'private-compositor':
          command.includes('--type=gpu-process')?'electron-gpu':
          command.includes('--type=renderer')?'electron-renderer':
          command.includes('electron')?'electron-other':'private-session-other',
          rssBytes:kb('VmRSS')*1024,rssHighBytes:kb('VmHWM')*1024,
          rssAnonBytes:kb('RssAnon')*1024,swapBytes:kb('VmSwap')*1024});
      }
      let rendererHeap=null,appMetrics=null;
      if(cdp&&count%5===0){
        const metrics=await cdp.send('Performance.getMetrics').catch(()=>null);
        rendererHeap=metrics?Object.fromEntries(metrics.metrics.filter(row=>
          row.name==='JSHeapUsedSize'||row.name==='JSHeapTotalSize').map(row=>[row.name,row.value])):null;
      }
      if(app&&count%10===0)appMetrics=await app.evaluate(({app})=>app.getAppMetrics()).catch(()=>null);
      const harnessMemory=process.memoryUsage();
      peakCurrent=Math.max(peakCurrent,currentBytes);
      peakHarnessRss=Math.max(peakHarnessRss,harnessMemory.rss);
      if(currentBytes>limit)terminal??='Guarded cgroup exceeded reviewed memory.max';
      if(hostAvailable<resourceContract.hostReserveBytes)terminal??='Host memory reserve breached';
      if((events.oom??0)>(initialEvents.oom??0)||
        (events.oom_kill??0)>(initialEvents.oom_kill??0))terminal??='Guarded cgroup OOM event';
      if(!processes.some(item=>item.pid===process.pid)||
        !processes.some(item=>item.pid===compositorPid))terminal??='Harness/compositor left guarded cgroup';
      if(app&&appMetrics&&!appMetrics.every(item=>pids.includes(item.pid)))
        terminal??='Electron child outside guarded cgroup';
      stream.write(JSON.stringify({at,elapsedMs:at-started,gapMs:gap,attempt:activeAttempt,
        currentBytes,peakBytes,hostAvailable,events,processes,
        harnessMemory,rendererHeap,appMetrics})+'\n');
      if(stream.writableLength>resourceContract.classes.adapterFramesAndWrites/4)
        terminal??='Resource-series write buffer exceeded reviewed adapter reserve';
      if(terminal)abort('Resource monitor: '+terminal);
      count++;
    }catch(error){terminal??=String(error);abort('Resource monitor failed: '+terminal);}
    finally{busy=false;}
  };
  await sample();timer=setInterval(()=>{void sample();},100);
  return{group,directory,limit,compositorPid,initialEvents,series,
    async checkpoint(phase){
      const [currentBytes,events,hostAvailable]=await Promise.all([
        numberFile(path.join(directory,'memory.current')),memoryEvents(directory),memAvailable()]);
      if((events.oom??0)>(initialEvents.oom??0)||
        (events.oom_kill??0)>(initialEvents.oom_kill??0)||
        hostAvailable<resourceContract.hostReserveBytes)
        throw abort('Protected resource checkpoint failed: '+phase);
      return{phase,at:Date.now(),currentBytes,events,hostAvailable};
    },
    async bindPage(activePage,activeApp){
      app=activeApp;cdp=await activePage.context().newCDPSession(activePage);
      await cdp.send('Performance.enable');
    },
    async unbindPage(){if(cdp){await cdp.detach().catch(()=>{});cdp=null;}app=null;},
    async stop(){clearInterval(timer);while(busy)await new Promise(resolve=>setTimeout(resolve,10));
      await sample();await new Promise(resolve=>stream.end(resolve));
      const finalEvents=await memoryEvents(directory),finalPeak=await numberFile(path.join(directory,'memory.peak'));
      return{group,limit,compositorPid,initialEvents,finalEvents,samples:count,
        maxGapMs,peakCurrentBytes:peakCurrent,cgroupPeakBytes:finalPeak,
        peakHarnessRssBytes:peakHarnessRss,series:path.relative(output,series),terminal};}
  };
}

function canonical(){
  const db=new Database(fixture.filename,{readonly:true});
  try{
    const rows=db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
      .all(fixture.campaignId).map(row=>JSON.parse(row.payload));
    const revision=db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
      .get(fixture.campaignId)?.revision;
    return{revision,hash:heightPayloadHash(rows)};
  }finally{db.close();}
}
async function restoreInitial(){
  // The profile is private and the previous Electron process has exited.
  // Retain only the native-session bus socket; browser caches/local storage
  // from the preceding attempt must not warm the next initial state.
  for(const entry of await readdir(native.profile))
    if(entry!=='bus')await rm(path.join(native.profile,entry),{recursive:true,force:true});
  await copyFile(seedFile,fixture.filename);
  assert.equal(canonical().hash,fixture.fixtureHash,'The initial canonical fixture changed.');
}
async function installMainWitness(){
  await native.app.evaluate(({ipcMain,BrowserWindow})=>{
    globalThis.twPReferences=[];globalThis.twPCommits=[];globalThis.twPStatuses=[];
    globalThis.twPTerminal=null;
    const fail=text=>{globalThis.twPTerminal??=String(text);
      const contents=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'))?.webContents;
      if(contents)void contents.executeJavaScript('window.__twPTerminalSignal?.('+JSON.stringify(String(text))+')').catch(()=>{});
    };
    const keep=ipcMain._invokeHandlers.get('atlas:write-reference-keep');
    const commit=ipcMain._invokeHandlers.get('atlas:commit');
    const status=ipcMain._invokeHandlers.get('atlas:write-status');
    if(!keep||!commit||!status)throw Error('Actual reference/commit/status handlers missing.');
    ipcMain.removeHandler('atlas:write-reference-keep');
    ipcMain.handle('atlas:write-reference-keep',async(...params)=>{
      let answer;try{answer=await keep(...params);}catch(error){fail(error);throw error;}
      if(answer?.ok)globalThis.twPReferences.push(structuredClone(params[1]));
      else fail('Reference keep failed: '+JSON.stringify(answer));
      return answer;
    });
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit',async(...params)=>{
      const command=structuredClone(params[1]);
      let answer;try{answer=await commit(...params);}catch(error){fail(error);throw error;}
      if(command.action?.kind==='landscape-height-stroke')
        globalThis.twPCommits.push({command,answer:structuredClone(answer),at:performance.now(),wall:Date.now()});
      if(!answer?.ok)fail('Commit failed: '+JSON.stringify(answer));
      return answer;
    });
    ipcMain.removeHandler('atlas:write-status');
    ipcMain.handle('atlas:write-status',async(...params)=>{
      let answer;try{answer=await status(...params);}catch(error){fail(error);throw error;}
      globalThis.twPStatuses.push({commandId:params[1]?.commandId,answer:structuredClone(answer),
        at:performance.now(),wall:Date.now()});
      if(!answer?.ok||answer?.value?.outcome==='unknown'||answer?.errorKind==='store-outcome-unknown')
        fail('Write status terminal: '+JSON.stringify(answer));
      return answer;
    });
  });
}
async function installRendererWitness(runId){
  // E-R3 wraps GL dispatch and Deck rendering. The original product callbacks
  // remain installed; observePreparedScreens is deliberately untouched.
  await page.exposeBinding('__twPTerminalSignal',async(_,reason)=>{
    abort('Renderer terminal: '+reason);
    await native.app.evaluate((_,text)=>{globalThis.twPTerminal??=text;},String(reason)).catch(()=>{});
  });
  await page.addInitScript(installTerrainFieldGateObserver,{runId,programExpectation:expectation});
  await page.addInitScript(()=>{
    const p=window.__twP={pointer:[],screens:[],frames:[],drawFrames:[],errors:[],fieldErrors:[],wheel:[],worker:[],firstDraft:null,
      firstPixel:null,lastNoDraftPixel:null,pixelFrames:0,
      pixelReadback:{count:0,totalMs:0,maxMs:0},pixelRoi:null,terminal:null,
      captureRequest:null,capturedField:null,resourcePhases:[]};
    const fail=reason=>{if(p.terminal)return;p.terminal=String(reason);
      void Promise.resolve(window.__twPTerminalSignal?.(p.terminal)).catch(()=>{});};
    const previousFrameProbe=window.__atlasTerrainFrameProbe;
    window.__atlasTerrainFrameProbe=drawn=>{
      previousFrameProbe?.(drawn);
      const surface=window.__twSurface,screen=surface?.preparedScreenSnapshot,roi=p.pixelRoi;
      const map=document.querySelector('#campaign-map');
      const width=JSON.parse(map?.dataset.atlasView??'null')?.width;
      const request=p.captureRequest;
      if(request&&!p.capturedField&&screen?.alpha===1&&screen.endFrame===true&&
        drawn?.complete&&drawn.field?.prepared&&width&&
        Math.abs(width/request.targetWidth-1)<.002&&
        (request.notContent===null||screen.content!==request.notContent)){
        const frame=window.__twFieldGate?.currentFrame;
        if(!frame){fail('Natural field capture missed frame observer');return;}
        p.capturedField={frameId:frame.binding.frameId,
          content:screen.content,alpha:screen.alpha,screen:{...screen},at:performance.now(),
          inventory:surface.preparedResourceInventory()};
      }
      if(!roi||p.firstPixel||!screen||!drawn?.field?.prepared)return;
      if(!width||Math.abs(width/20-1)>.002)return;
      const canvas=document.querySelector('#atlas-terrain-spatial canvas'),gl=canvas?.getContext('webgl2');
      if(!gl||gl.isContextLost()){fail('Prepared terrain pixel context unavailable');return;}
      const rect=canvas.getBoundingClientRect(),scaleX=gl.drawingBufferWidth/rect.width,
        scaleY=gl.drawingBufferHeight/rect.height;
      const x=Math.round((roi.x-rect.left)*scaleX)-8,
        y=gl.drawingBufferHeight-Math.round((roi.y-rect.top)*scaleY)-8;
      if(x<0||y<0||x+16>gl.drawingBufferWidth||y+16>gl.drawingBufferHeight){fail('Terrain pixel ROI offscreen');return;}
      const pixels=new Uint8Array(16*16*4);
      const readStart=performance.now();
      gl.readPixels(x,y,16,16,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const readbackMs=performance.now()-readStart;
      p.pixelReadback.count++;p.pixelReadback.totalMs+=readbackMs;
      p.pixelReadback.maxMs=Math.max(p.pixelReadback.maxMs,readbackMs);
      const error=gl.getError();if(error){fail('Terrain pixel read GL error '+error);return;}
      p.pixelFrames++;
      const at=performance.now(),same=(a,b)=>!!a&&a.length===b.length&&a.every((v,i)=>v===b[i]);
      if(screen.draftRevision===p.baselineDraftRevision){
        p.lastNoDraftPixel={at,pixels,alpha:screen.alpha,content:screen.content,
          cameraWidth:width,fieldState:screen.fieldState};
      }else if(map.dataset.terrainDraft==='height'&&!p.firstPixel){
        const base=p.lastNoDraftPixel;
        if(!base){fail('No 20m no-draft raw terrain baseline before accepted draft');return;}
        if(!same(base.pixels,pixels)){
          p.firstPixel={at,baseAt:base.at,alpha:screen.alpha,baseAlpha:base.alpha,
            content:screen.content,fieldState:screen.fieldState,draftRevision:screen.draftRevision,
            cameraWidth:width,rawTerrainCanvas:true,jpeg:false,roi:{x,y,width:16,height:16},
            readbackMs,sampleGapMs:at-base.at,
            changedChannels:pixels.reduce((n,v,i)=>n+(v!==base.pixels[i]),0),
            baselineRgba:[...base.pixels],changedRgba:[...pixels]};
        }
      }
    };
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
      constructor(...params){
        super(...params);
        if(!String(params[0]).includes('atlas-terrain-model-worker'))return;
        this.addEventListener('message',event=>{
          const reply=event.data;
          if(reply?.error||reply?.kind==='error')fail('Terrain worker error '+String(reply?.error??reply?.message));
          p.worker.push({at:performance.now(),kind:reply?.kind,job:reply?.job,
            error:reply?.error??reply?.message??null,
            workerBackingBytes:reply?.workerBackingBytes??reply?.metrics?.workerHeldBytes??null,
            workerBufferIds:reply?.workerBufferIds??null,
            transports:reply?.buffers?.map(entry=>({id:entry.id,byteLength:entry.buffer?.byteLength}))??[]});
        });
      }
    };
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])
      addEventListener(type,event=>{if(event.target?.id==='campaign-map'){
        const screen=type==='pointerdown'?window.__twSurface?.preparedScreenSnapshot:null;
        p.pointer.push({type,at:performance.now(),wall:Date.now(),stamp:event.timeStamp,x:event.clientX,y:event.clientY,
          trusted:event.isTrusted,buttons:event.buttons,
          frozenScreen:screen?{...screen}:null});
      }},true);
    addEventListener('wheel',event=>p.wheel.push({at:performance.now(),deltaY:event.deltaY,
      trusted:event.isTrusted}),true);
    addEventListener('error',event=>{p.errors.push(String(event.message));fail(event.message);});
    addEventListener('unhandledrejection',event=>{p.errors.push(String(event.reason));fail(event.reason);});
    addEventListener('webglcontextlost',()=>{p.errors.push('WebGL context lost');fail('WebGL context lost');},true);
    let last=null;
    const tick=at=>{
      const s=window.__twSurface,map=document.querySelector('#campaign-map');
      if(s&&map){
        for(const fieldFrame of window.__twFieldGate?.frames??[]){
          const key=fieldFrame.binding?.frameId;
          if(key>=(p.lastFieldFrameId??0)+1){
            p.lastFieldFrameId=key;
            p.drawFrames.push({frameId:key,startedAt:fieldFrame.startedAt,
              finishedAt:fieldFrame.finishedAt,complete:fieldFrame.snapshot?.complete??false,
              alpha:fieldFrame.binding?.alpha??null,width:JSON.parse(map.dataset.atlasView??'null')?.width,
              ready:map.dataset.terrainReady,draws:fieldFrame.draws?.length??0});
            if(fieldFrame.errors?.length||fieldFrame.contextLost||fieldFrame.glError){
              p.fieldErrors.push({frameId:key,errors:fieldFrame.errors,
                contextLost:fieldFrame.contextLost,glError:fieldFrame.glError});
              fail('Field GL/context error frame '+key);
            }
          }
        }
        const drawn=s.terrainSnapshot,screen=s.preparedScreenSnapshot;
        const row={at,wall:Date.now(),width:JSON.parse(map.dataset.atlasView??'null')?.width,
          ready:map.dataset.terrainReady,draft:map.dataset.terrainDraft??null,
          content:drawn?.content??null,alpha:drawn?.alpha??null,
          fieldState:screen?.fieldState??null,packedBasis:screen?.basis??null,
          draftRevision:screen?.draftRevision??null};
        if(row.ready==='failed')fail('Terrain ready failed');
        if(last!==null)row.frameMs=at-last;
        p.frames.push(row);if(p.frames.length>20000)p.frames.shift();
        if(row.draft==='height'&&screen&&
          screen.draftRevision!==p.baselineDraftRevision&&p.firstDraft===null){
          p.firstDraft=row;
          p.resourcePhases.push({phase:'first-draft',at,inventory:s.preparedResourceInventory()});
        }
        if(p.pointer.filter(e=>e.type==='pointerdown').length>=2&&
          !p.resourcePhases.some(e=>e.phase==='followup-overlap'))
          p.resourcePhases.push({phase:'followup-overlap',at,inventory:s.preparedResourceInventory()});
        if(screen&&(!p.screens.length||p.screens.at(-1).content!==screen.content||
          p.screens.at(-1).alpha!==screen.alpha||
          p.screens.at(-1).draftRevision!==screen.draftRevision))
          p.screens.push({...row,screen:{...screen}});
      }
      last=at;requestAnimationFrame(tick);
    };requestAnimationFrame(tick);
  });
  await page.reload();
  await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
}
async function openAttempt(index){
  page=await native.launch(1);page.setDefaultTimeout(20000);
  page.on('pageerror',error=>abort('Renderer page error: '+error));
  page.on('crash',()=>abort('Renderer crashed'));
  await resourceMonitor.bindPage(page,native.app);
  await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()
    .find(w=>w.webContents.getURL().endsWith('/index.html')).setContentSize(1920,1080));
  await installMainWitness();
  await installRendererWitness(`tw06-p-${caseHash}-${index}`);
  await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({
    x:-20000000,y:-11250000,width:40000000,height:22500000,
    pose:{tilt:45,rotation:0,exaggeration:1,focusHeightM:250}})),fixture.campaignId);
  await page.reload();
  await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  // Patch only this freshly loaded renderer module, before campaign creation.
  // Calling the original create preserves the productive Session observer,
  // Settle and Lease chain; no observePreparedScreens callback is replaced.
  await page.evaluate(async()=>{
    const runtime=await import('./atlas-deck-runtime.js');
    const original=runtime.AtlasDeckSurface.create;
    runtime.AtlasDeckSurface.create=async function(options){
      const surface=await original.call(this,options);
      window.__twObserveFieldSurface(surface);
      window.__twSurface=surface;
      return surface;
    };
  });
  await page.locator('.campaign-card').filter({hasText:fixture.campaignName})
    .getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
  await page.waitForFunction(()=>!document.querySelector('main').inert&&
    ['ready','failed'].includes(document.querySelector('#campaign-map')?.dataset.terrainReady),
    null,{timeout:90000});
  assert.notEqual(await page.locator('#campaign-map').getAttribute('data-terrain-ready'),'failed');
  if(await page.locator('#campaign-atlas').isHidden()){
    if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();
    await page.locator('#atlas-tab').click();
  }
  await page.waitForFunction(()=>window.__twSurface?.preparedScreenSnapshot,
    null,{timeout:90000,polling:'raf'});
  await page.addScriptTag({path:k2HelperFile});
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await page.locator('[data-preset="3"]').click();
  await page.locator('[data-direction="raise"]').click();
  await setBrushWorldRadius(page,'land-radius',gateCase.style.radiusM);
  await page.locator('#land-height-strength').fill(String(gateCase.style.strength));
  await page.locator('#land-height-strength').press('Tab');
  assert.equal(await page.locator('#land-contours').inputValue(),String(gateCase.style.contours));
  assert.equal(Number(await page.locator('#land-sea-level').inputValue()),gateCase.style.seaLevelM);
  const actual=await page.evaluate(()=>{
    const c=document.querySelector('#atlas-terrain-spatial canvas'),gl=c.getContext('webgl2');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
      drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],dpr:devicePixelRatio};
  });
  assert.match(actual.renderer,/Intel.*620/i);
  return actual;
}
async function startFrames(index){
  const cdp=await page.context().newCDPSession(page),dir=path.join(output,`attempt-${index}`);
  await mkdir(path.join(dir,'frames'),{recursive:true});
  let serial=0,pendingBytes=0,peakPendingBytes=0;frameWrites=new Set();const records=[];
  cdp.on('Page.screencastFrame',event=>{
    const bytes=Buffer.from(event.data,'base64');pendingBytes+=bytes.byteLength;
    peakPendingBytes=Math.max(peakPendingBytes,pendingBytes);
    if(pendingBytes>resourceContract.classes.adapterFramesAndWrites){
      abort('Frame capture exceeded its reviewed pending-write memory class');return;
    }
    const frameNumber=serial++,relative=`frames/${String(frameNumber).padStart(6,'0')}.jpg`;
    const file=path.join(dir,relative);
    const record={frameNumber,file:relative,receivedAtWall:Date.now(),metadata:event.metadata,
      encodedBytes:bytes.byteLength};records.push(record);
    const writeStart=Date.now();
    const task=writeFile(file,bytes).then(()=>cdp.send('Page.screencastFrameAck',
      {sessionId:event.sessionId})).catch(error=>{abort('Frame write/ack: '+error);})
      .finally(()=>{record.writeAndAckMs=Date.now()-writeStart;
        pendingBytes-=bytes.byteLength;frameWrites.delete(task);});
    frameWrites.add(task);
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:78,
    maxWidth:1920,maxHeight:1080,everyNthFrame:1});
  frameStream={cdp,dir,records,get count(){return serial;},get peakPendingBytes(){return peakPendingBytes;}};
}
async function stopFrames(){
  if(!frameStream)return null;
  const {records,peakPendingBytes}=frameStream;
  await frameStream.cdp.send('Page.stopScreencast').catch(()=>{});
  await Promise.all([...frameWrites]);
  await frameStream.cdp.detach().catch(()=>{});
  frameStream=null;
  return{records,peakPendingBytes};
}
async function navigate(direction){
  await healthy();
  const target=direction<0?20:40000000;
  const startedAt=await page.evaluate(()=>performance.now());
  const wheelStart=await page.evaluate(()=>window.__twP.wheel.length);
  const rect=await page.locator('#campaign-map').boundingBox();
  assert(rect?.width&&rect?.height,'Map bounds missing');
  const anchor={x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2)};
  const distance=Math.log(40000000/20),plan=[];
  let elapsed=0,remaining=distance;
  while(remaining>1e-10){const exponent=Math.min(.24,remaining);
    plan.push({atMs:elapsed,deltaY:direction*exponent/.002});remaining-=exponent;elapsed+=80;}
  const sent=await native.app.evaluate(({BrowserWindow},{plan,anchor})=>new Promise(resolve=>{
    const contents=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents;
    const start=performance.now(),rows=[];let stopped=false;
    for(const event of plan)setTimeout(()=>{
      if(stopped)return;
      if(globalThis.twPTerminal){stopped=true;resolve({rows,error:globalThis.twPTerminal});return;}
      contents.sendInputEvent({type:'mouseWheel',x:anchor.x,y:anchor.y,deltaX:0,
        deltaY:-event.deltaY,canScroll:true});
      rows.push({...event,sentAtMs:performance.now()-start});
      if(rows.length===plan.length)resolve({rows,error:null});
    },event.atMs);
  }),{plan,anchor});
  if(sent.error)throw abort('Wheel dispatch stopped: '+sent.error);
  assert.equal(sent.rows.length,plan.length);
  // This waits for the actual reached camera frame, never for a fixed drain.
  await page.waitForFunction(target=>{
    const n=document.querySelector('#campaign-map'),width=JSON.parse(n?.dataset.atlasView??'null')?.width;
    return width&&Math.abs(width/target-1)<.002&&
      window.__twP.frames.some(frame=>Math.abs(frame.width/target-1)<.002);
  },target,{timeout:90000,polling:'raf'});
  const reachedAt=await page.evaluate(()=>performance.now());
  const received=await page.evaluate(start=>window.__twP.wheel.slice(start),wheelStart);
  await healthy();
  const expected=Math.log(40000000/20)/.002;
  assert(Math.abs(received.reduce((sum,event)=>sum+Math.max(0,event.deltaY*direction),0)-expected)<.01,
    'Every planned native wheel delta must reach the renderer, including coalesced events.');
  return{target,startedAt,reachedAt,sent:sent.rows,received};
}
async function prepositionStroke(points){
  const rect=await page.locator('#campaign-map').boundingBox();
  const first=points[0];
  await page.mouse.move(rect.x+rect.width*(.5+first[0]),rect.y+rect.height*(.5+first[1]));
  await page.evaluate(({x,y})=>{window.__twP.pixelRoi={x,y};},{
    x:rect.x+rect.width*(.5+first[0]),y:rect.y+rect.height*(.5+first[1])});
  return rect;
}
async function normalStroke(points,rect){
  const xy=point=>({x:rect.x+rect.width*(.5+point[0]),y:rect.y+rect.height*(.5+point[1])});
  assertNotTerminal();
  await page.mouse.down();
  for(const point of points.slice(1)){assertNotTerminal();const p=xy(point);await page.mouse.move(p.x,p.y,{steps:8});}
  assertNotTerminal();
  await page.mouse.up();
}
async function followupEscape(points){
  const rect=await page.locator('#campaign-map').boundingBox();
  const xy=point=>({x:rect.x+rect.width*(.5+point[0]),y:rect.y+rect.height*(.5+point[1])});
  await healthy();const first=xy(points[0]);await page.mouse.move(first.x,first.y);assertNotTerminal();await page.mouse.down();
  for(const point of points.slice(1)){assertNotTerminal();const p=xy(point);await page.mouse.move(p.x,p.y,{steps:8});}
  assertNotTerminal();
  await page.keyboard.press('Escape');await page.mouse.up();
}
async function independentPackedPicks(){
  const evidence=await page.evaluate(points=>{
    const s=window.__twSurface,shown=s?.terrainSnapshot,screen=s?.preparedScreenSnapshot,
      field=shown?.field,g=field?.geometry,frame=s?.frameValue;
    if(!shown||!screen||!field?.prepared||!g?.preparedBasis||!frame||
      !window.TWK2?.terrainEvaluateVertex)
      throw Error('No actual packed P screen and independent vertex evaluator for both picks.');
    const xys=points.map(([dx,dy])=>({x:frame.viewport.width*(.5+dx),
      y:frame.viewport.height*(.5+dy)}));
    const alpha=Math.fround(shown.alpha),draft=g.preparedDraft??null,
      evaluate=window.TWK2.terrainEvaluateVertex;
    const vertex=(index,draw)=>{
      const at=index*14,value=evaluate(g.vertices,draft,index,alpha,frame.origin.z);
      return[g.vertices[at]+draw.origin.x,g.vertices[at+1]+draw.origin.y,value.height];
    };
    const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
      cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
      dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const independent=segment=>{
      const [start,end]=segment,direction=subtract(end,start),
        x0=Math.min(start[0],end[0]),x1=Math.max(start[0],end[0]),
        y0=Math.min(start[1],end[1]),y1=Math.max(start[1],end[1]);
      let best=null;
      const draws=field.endFrameDraws??g.draws;
      for(let drawIndex=0;drawIndex<draws.length;drawIndex++){
        const draw=draws[drawIndex],b=draw.bounds;
        if(draw.oldSlot<0&&draw.newSlot<0||b.x>x1||b.x+b.width<x0||b.y>y1||b.y+b.height<y0)continue;
        for(let i=draw.firstIndex;i<draw.firstIndex+draw.indexCount;i+=3){
          const a=vertex(g.indices[i],draw),c=vertex(g.indices[i+1],draw),d=vertex(g.indices[i+2],draw),
            u=subtract(c,a),v=subtract(d,a),p=cross(direction,v),det=dot(u,p);
          if(Math.abs(det)<1e-18)continue;
          const inv=1/det,t=subtract(start,a),baryU=dot(t,p)*inv;
          if(baryU<0||baryU>1)continue;
          const q=cross(t,u),baryV=dot(direction,q)*inv;
          if(baryV<0||baryU+baryV>1)continue;
          const fraction=dot(v,q)*inv;
          if(fraction<0||fraction>1||best&&fraction>=best.segmentFraction)continue;
          best={point:[start[0]+fraction*direction[0],
            start[1]+fraction*direction[1],start[2]+fraction*direction[2]],
            segmentFraction:fraction,drawIndex,triangleIndex:i/3};
        }
      }
      return best;
    };
    const rows=xys.map(pixel=>{
      const segment=frame.ray(pixel);
      if(!segment)throw Error('Packed pick pixel produced no camera ray.');
      const expected=independent(segment),terrain=s.terrainRay(segment),gpu=s.pick(pixel.x,pixel.y);
      if(!expected||!terrain?.point||!gpu?.point)
        throw Error('A packed geometry, terrainRay or GPU pick did not hit the same screen.');
      const productTerrain=[...terrain.point],productGpu=[gpu.point.x,gpu.point.y,gpu.point.heightM],
        tolerance=Math.max(.01,Math.abs(expected.point[2])*1e-5),
        distance=value=>Math.hypot(...expected.point.map((n,i)=>n-value[i]));
      if(distance(productTerrain)>tolerance||distance(productGpu)>tolerance)
        throw Error('Both product pick entrances must match independent packed P14 triangle interpolation.');
      return{pixel,expected,productTerrain,productGpu,tolerance,
        terrainError:distance(productTerrain),gpuError:distance(productGpu)};
    });
    if(s.preparedScreenSnapshot?.content!==screen.content||
      s.preparedScreenSnapshot?.fieldState!==screen.fieldState)
      throw Error('Packed screen changed during independent pick comparison.');
    return{screen:{...screen},alpha,geometryIndices:g.indices.length,
      geometryVertices:g.vertices.length/14,rows};
  },gateCase.pickPixels);
  assert.equal(evidence.rows.length,2);
  return evidence;
}
async function armFieldCapture(targetWidth,notContent=null){
  return page.evaluate(({targetWidth,notContent})=>{
    const p=window.__twP;const at=performance.now();
    p.captureRequest={at,targetWidth,notContent};p.capturedField=null;
    return at;
  },{targetWidth,notContent});
}
async function writeCurrentFieldScreen(index,label){
  await page.waitForFunction(()=>{
    const p=window.__twP,c=p.capturedField;
    return c&&window.__twFieldGate.frames.some(frame=>frame.binding?.frameId===c.frameId);
  },null,{timeout:90000,polling:'raf'});
  await healthy();
  const sample=await page.evaluate(async()=>{
    const surface=window.__twSurface,capture=window.__twP.capturedField,
      request=window.__twP.captureRequest;
    if(!surface?.preparedScreenSnapshot||!capture||!request)
      throw Error('Actual naturally drawn preparedScreenSnapshot missing.');
    const frame=window.__twFieldGate.frames.find(row=>row.binding?.frameId===capture.frameId);
    if(!frame||frame.startedAt<request.at||!frame.afterRender||!frame.snapshot?.complete)
      throw Error('No naturally completed current field frame after capture arm.');
    const prepared=surface.terrainSnapshot?.field?.prepared;
    if(!prepared?.buffers?.size)throw Error('Current packed field backing stores missing.');
    const stores=[];
    for(const [id,buffer] of prepared.buffers){
      const digest=await crypto.subtle.digest('SHA-256',buffer);
      stores.push({id,byteLength:buffer.byteLength,
        sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')});
    }
    stores.sort((a,b)=>a.id-b.id);
    return{expected:{binding:frame.binding,afterAt:request.at,indexCapacity:frame.indexCapacity,
      partitions:frame.required},frame,screen:capture.screen,
      packedStores:stores,inventory:surface.preparedResourceInventory()};
  });
  const dir=path.join(output,`attempt-${index}`),image=`${label}-field-${index}.png`;
  await native.capture(page,path.join(`attempt-${index}`,image));
  const bytes=await readFile(path.join(dir,image));
  const captured=await page.evaluate(()=>({at:performance.now(),
    binding:window.__twFieldGate.frames.at(-1)?.binding??null}));
  assert.deepEqual(captured.binding,sample.expected.binding,'Frame changed during image capture.');
  const evidence={schema:'terrain-field-screen-gate/v1',runtimeHashes:native.artifacts,
    expected:sample.expected,frame:sample.frame,image:{path:image,sha256:hash(bytes),
      binding:captured.binding,capturedAt:captured.at}};
  await writeFile(path.join(dir,`${label}-gate-evidence.json`),JSON.stringify(evidence,null,2));
  return{screen:sample.screen,packedStores:sample.packedStores,
    inventory:sample.inventory,gateEvidence:`attempt-${index}/${label}-gate-evidence.json`};
}
async function largeK2DrawStage(){
  // This is a separate synthetic load stage after the 30 normal attempts.
  // Reuse the original K2 producer function, not its JSON count result.
  activeAttempt='k2-1117';
  await restoreInitial();
  const display=await openAttempt('k2-1117');
  const prepared=await page.evaluate(largeDrawBudget=>{
    const surface=window.__twSurface,deck=surface?.deckValue;
    const field=deck?.props.layers.find(layer=>layer?.id?.startsWith('atlas-terrain-field:')&&
      layer.props?.visible!==false);
    if(!field||!surface.terrainFieldOwner||!window.TWK2?.prepareAtlasTerrainFieldGeometry)
      throw Error('Product field owner/layer or exact K2 producer unavailable.');
    const model=(x,y,size)=>({object:{id:`k2:${x}:${y}:${size}`},
      grid:{view:{box:{x,y,width:size,height:size},columns:65,rows:65}}});
    const old=[model(0,0,2**28),...Array.from({length:31},(_,i)=>model(1000+i*10000,1000+i*10000,1))];
    const next=[model(0,0,2**28),...Array.from({length:31},(_,i)=>model(5000+i*10000,7000+i*10000,1))];
    const prepareStart=performance.now(),oldGeometry=window.TWK2.prepareAtlasTerrainFieldGeometry([],old),
      k2=window.TWK2.prepareAtlasTerrainFieldGeometry(old,next,32,oldGeometry.gpuGeometryBytes,{
      retainedDrawMetadataBytes:oldGeometry.gpuDrawMetadataBytes,
      reserve:(_,allocation)=>{
        // The original K2 stores and new P14 stores overlap until the draw.
        const upper=oldGeometry.gpuGeometryBytes+oldGeometry.gpuDrawMetadataBytes+
          allocation.vertexBytes+allocation.indexBytes+
          allocation.vertexBytes*14/4+allocation.indexBytes+allocation.drawMetadataBytes+
          1117*51200;
        if(upper>largeDrawBudget)throw Error('1117 draw preallocation exceeds reviewed load class');
      }}),
      prepareMs=performance.now()-prepareStart;
    if(k2.draws.length!==1117)throw Error('Actual K2 producer no longer generates 1117 transition draws.');
    const vertices=new Float32Array(k2.vertices.length/4*14);
    for(let i=0;i<k2.vertices.length/4;i++){
      vertices[i*14]=k2.vertices[i*4];vertices[i*14+1]=k2.vertices[i*4+1];
    }
    const geometry={...k2,vertices,preparedBasis:{syntheticZeroHeight:true},
      gpuGeometryBytes:vertices.byteLength+k2.indices.byteLength};
    const layer=new field.constructor({...field.props,id:'atlas-terrain-field:k2-1117',
      geometry,mesh:geometry,oldModels:old,newModels:next,draftModels:[],
      endFrameDraws:undefined,alpha:Math.fround(.5),onDrawSuccess:()=>{}});
    const originalUpload=surface.terrainFieldOwner.uploadSlotMetadata;
    let uploads=0,uploadMs=0;
    surface.terrainFieldOwner.uploadSlotMetadata=function(...args){
      const start=performance.now();try{return originalUpload.apply(this,args);}
      finally{uploads++;uploadMs+=performance.now()-start;}
    };
    const originalDraw=layer.draw;
    layer.draw=function(...args){const start=performance.now();try{return originalDraw.apply(this,args);}
      finally{window.__twK2DrawCpuMs=performance.now()-start;}};
    window.__twK2OwnerRestore=()=>{surface.terrainFieldOwner.uploadSlotMetadata=originalUpload;};
    window.__twK2ResourceBefore=surface.preparedResourceInventory();
    window.__twK2Layer=layer;
    window.__twK2Prepared={prepareMs,geometryBytes:geometry.gpuGeometryBytes,
      vertexBytes:vertices.byteLength,indexBytes:k2.indices.byteLength,
      drawMetadataBytes:k2.gpuDrawMetadataBytes,
      retainedOldGeometryBytes:oldGeometry.gpuGeometryBytes,
      retainedOldMetadataBytes:oldGeometry.gpuDrawMetadataBytes,
      oldSources:old.length,newSources:next.length};
    window.__twK2Upload=()=>({uploads,uploadMs});
    deck.setProps({layers:[...deck.props.layers,layer]});
    return window.__twK2Prepared;
  },resourceContract.classes.largeDraw1117);
  await page.waitForFunction(()=>window.__twFieldGate.frames.some(frame=>
    frame.draws.filter(draw=>draw.partitionKey?.startsWith('atlas-terrain-field:k2-1117:')&&
      draw.target==='screen'&&draw.picking===false&&draw.fieldProgram===true).length===1117),
  null,{timeout:90000,polling:'raf'});
  await healthy();
  const measured=await page.evaluate(()=>{
    const frame=window.__twFieldGate.frames.findLast(item=>item.draws.filter(draw=>
      draw.partitionKey?.startsWith('atlas-terrain-field:k2-1117:')&&
      draw.target==='screen'&&draw.picking===false&&draw.fieldProgram===true).length===1117);
    const draws=frame.draws.filter(draw=>draw.partitionKey?.startsWith('atlas-terrain-field:k2-1117:')&&
      draw.target==='screen'&&draw.picking===false&&draw.fieldProgram===true);
    const result={frameBinding:frame.binding,draws:draws.length,
      indexCount:draws.reduce((sum,draw)=>sum+draw.indices,0),
      valid:draws.every(draw=>draw.glDispatch&&draw.modelResult&&draw.glError===0&&
        draw.contextLost===false&&draw.indices>0),
      renderFrameCpuMs:frame.finishedAt-frame.startedAt,
      drawCpuMs:window.__twK2DrawCpuMs,upload:window.__twK2Upload(),
      prepared:window.__twK2Prepared,before:window.__twK2ResourceBefore,
      after:window.__twSurface.preparedResourceInventory()};
    window.__twK2OwnerRestore();return result;
  });
  assert.equal(measured.draws,1117);assert(measured.valid&&measured.indexCount>0,
    'Actual K2 load did not dispatch 1117 error-free indexed screen draws.');
  await native.capture(page,'k2-1117-native.png');
  const stage={schema:'terrain-p-k2-1117-native-load/v1',helperSha256:k2HelperSha256,
    originalProducer:{path:path.relative(root,k2Source),sha256:gateCase.largeDrawCase.sourceSha256},
    display,measured,image:{path:'k2-1117-native.png',
      sha256:hash(await readFile(path.join(output,'k2-1117-native.png')))},
    caveat:'Synthetic zero-height P14 geometry from original K2 partitions; real GL draw/upload load, not typical stream or material correctness.'};
  await writeFile(path.join(output,'k2-1117-load.json'),JSON.stringify(stage,null,2));
  await resourceMonitor.unbindPage();await native.close();page=null;
  activeAttempt=null;
  return stage;
}
async function attempt(index){
  activeAttempt=index;
  const initial=canonical();assert.equal(initial.hash,fixture.fixtureHash);
  const display=await openAttempt(index);
  await startFrames(index);
  const resourcesBefore=await page.evaluate(()=>window.__twSurface.preparedResourceInventory());
  const initialScreen=await page.evaluate(()=>window.__twSurface.preparedScreenSnapshot);
  assert(initialScreen,'Initial packed screen absent.');
  await page.evaluate(revision=>{window.__twP.baselineDraftRevision=revision;},initialScreen.draftRevision);
  const mapRect=await prepositionStroke(gateCase.strokePixels);
  const inward=await navigate(-1);
  const at20=await page.evaluate(()=>({screen:window.__twSurface.preparedScreenSnapshot,
    usable:window.__twSurface.preparedInputUsable,
    drawnWidth:window.__twSurface.terrainSnapshot?.frame?.camera?.metersPerPixel??null,
    currentWidth:window.__twSurface.frame?.camera?.metersPerPixel??null}));
  const pointerBaseline=at20.screen;
  assert(at20.usable&&at20.drawnWidth===at20.currentWidth&&
    pointerBaseline&&pointerBaseline.alpha>0&&pointerBaseline.alpha<1,
    'The fixed first-confirmed-20m trigger missed natural intermediate alpha.');
  assert.equal(pointerBaseline.draftRevision,initialScreen.draftRevision,
    'Draft already changed before the planned product pointerdown.');
  await normalStroke(gateCase.strokePixels,mapRect);
  await healthy();
  const activeStroke=await page.evaluate(()=>{
    const p=window.__twP,down=p.pointer.find(event=>event.type==='pointerdown'),
      up=p.pointer.find(event=>event.type==='pointerup'&&event.at>down?.at);
    return{down,up,firstDraft:p.firstDraft,firstPixel:p.firstPixel,
      ready:document.querySelector('#campaign-map')?.dataset.terrainReady};
  });
  assert(activeStroke.down&&activeStroke.up&&activeStroke.ready==='ready'&&
    activeStroke.firstDraft?.at>=activeStroke.down.at&&
    activeStroke.firstDraft.at<=activeStroke.up.at&&
    activeStroke.firstPixel?.at>=activeStroke.down.at&&
    activeStroke.firstPixel.at<=activeStroke.up.at,
    'No accepted and visibly drawn Terrain Draft during the complete normal gesture; stop before follow-up input.');
  await followupEscape(gateCase.followupPixels);
  await armFieldCapture(40000000,pointerBaseline.content);
  const outward=await navigate(1);
  // Commit is a dependency of the exact Undo proof; waiting for that real
  // result occurs after timed input and never lengthens the measured stroke.
  const deadline=Date.now()+90000;let commits;
  do{commits=await native.app.evaluate(()=>globalThis.twPCommits);
    if(commits.length)break;await new Promise(resolve=>setTimeout(resolve,20));}
  while(Date.now()<deadline);
  assert.equal(commits.length,1,'Exactly one completed normal height commit required.');
  const references=await native.app.evaluate(()=>globalThis.twPReferences);
  const statuses=await native.app.evaluate(()=>globalThis.twPStatuses);
  assert(!statuses.some(row=>row.answer?.value?.outcome==='unknown'||row.answer?.errorKind==='store-outcome-unknown'),
    'Unknown write status is a terminal gate failure.');
  const ref=references.find(item=>item.commandId===commits[0].command.commandId);
  assert(ref?.fingerprint&&commits[0].answer?.ok===true,'Matching reference and commit Ack missing.');
  const committed=canonical();assert.notEqual(committed.hash,initial.hash);
  const field=await writeCurrentFieldScreen(index,'committed');
  const picks=await independentPackedPicks();await healthy();
  const beforeUndo=await page.evaluate(()=>({frames:window.__twP.frames,
    screens:window.__twP.screens,pointer:window.__twP.pointer,wheel:window.__twP.wheel,
    errors:window.__twP.errors,fieldErrors:window.__twP.fieldErrors,firstDraft:window.__twP.firstDraft,
    firstPixel:window.__twP.firstPixel,pixelFrames:window.__twP.pixelFrames,
    pixelReadback:window.__twP.pixelReadback,
    drawFrames:window.__twP.drawFrames,resourcePhases:window.__twP.resourcePhases,
    worker:window.__twP.worker}));
  assert.deepEqual(beforeUndo.errors,[],'Renderer error during normal drive.');
  assert.deepEqual(beforeUndo.fieldErrors,[],'Field GL/context error during normal drive.');
  assert(!beforeUndo.worker.some(message=>message.error),'Worker error during normal drive.');
  assert(beforeUndo.firstDraft,'Initial Draft did not reach an actual prepared screen.');
  const firstDown=beforeUndo.pointer.find(event=>event.type==='pointerdown');
  assert(firstDown,'Normal product pointerdown missing.');
  assert(firstDown.frozenScreen&&firstDown.frozenScreen.alpha>0&&
    firstDown.frozenScreen.alpha<1,
    'Pointerdown did not freeze a confirmed natural intermediate-alpha packed screen.');
  assert.equal(firstDown.frozenScreen.content,pointerBaseline.content,
    'Pointerdown was not bound to the reached 20m packed content.');
  const firstUp=beforeUndo.pointer.find(event=>event.type==='pointerup'&&event.at>firstDown.at);
  assert(firstUp&&beforeUndo.firstDraft.at<=firstUp.at,
    'First Draft must be drawn during the uninterrupted active gesture.');
  const firstDraftMs=beforeUndo.firstDraft.at-firstDown.at;
  assert(firstDraftMs>=0,'First Draft predates product input.');
  const firstPixel=beforeUndo.firstPixel;
  assert(firstPixel&&firstPixel.at>=firstDown.at&&firstPixel.at<=firstUp.at&&
    firstPixel.changedChannels>0&&firstPixel.rawTerrainCanvas===true,
    'No first changed raw terrain canvas pixel during the normal active gesture.');
  // AfterRender/raw-canvas observation is an upper bound, not an invented
  // exact display-scanout timestamp. It includes the first Draft's setup.
  const firstObservedPixelMsUpperBound=firstPixel.at-firstDown.at;
  const changedScreen=beforeUndo.screens.find(screen=>screen.at>=firstDown.at&&
    (screen.content!==firstDown.frozenScreen.content||
      screen.draftRevision!==firstDown.frozenScreen.draftRevision));
  assert(changedScreen,'No changed packed screen after product input.');
  const secondDown=beforeUndo.pointer.filter(event=>event.type==='pointerdown')[1];
  assert(secondDown&&secondDown.at>firstUp.at,
    'Regular follow-up pointerdown/Escape after the initial gesture is missing.');
  assert(beforeUndo.screens.some(row=>row.alpha===0)&&
    beforeUndo.screens.some(row=>row.alpha>0&&row.alpha<1)&&
    beforeUndo.screens.some(row=>row.alpha===1),
    'Actual packed alpha 0/intermediate/1 screens were not observed.');
  await armFieldCapture(40000000,field.screen.content);
  await page.locator('#atlas-undo').click();
  const undoDeadline=Date.now()+90000;let undone=canonical();
  while(undone.hash!==initial.hash&&Date.now()<undoDeadline){
    await new Promise(resolve=>setTimeout(resolve,20));undone=canonical();}
  assert.equal(undone.hash,initial.hash,'Undo did not restore the exact canonical height hash.');
  await page.waitForFunction(previous=>{
    const s=window.__twSurface,map=document.querySelector('#campaign-map');
    return map?.dataset.terrainReady==='ready'&&s?.preparedScreenSnapshot?.alpha===1&&
      s.preparedScreenSnapshot.content!==previous&&s.terrainSnapshot?.complete===true&&
      s.pendingField==null&&s.preparedEscape==null&&s.terrainFrozen===false;
  },field.screen.content,{timeout:90000,polling:'raf'});
  const undoField=await writeCurrentFieldScreen(index,'undo');
  const resourcesAfter=await page.evaluate(()=>window.__twSurface.preparedResourceInventory());
  const appMetrics=await native.app.evaluate(({app})=>app.getAppMetrics());
  const screenshotFrames=await stopFrames();
  const at20m=beforeUndo.screens.filter(row=>Math.abs(row.width/20-1)<.002);
  const imageFor=screen=>{
    const candidate=screenshotFrames.records.reduce((best,frame)=>{
      const gap=Math.abs(frame.receivedAtWall-screen.wall);
      return !best||gap<best.gap?{file:frame.file,gap,receivedAtWall:frame.receivedAtWall}:best;
    },null);
    assert(candidate&&candidate.gap<=150,
      'Continuous screencast has no bounded image for a required alpha screen.');
    return{alpha:screen.alpha,screenAtWall:screen.wall,...candidate,
      note:'CDP receive time bounds image association; it is not exact pixel scanout time.'};
  };
  const alphaImageBindings=[at20m.find(row=>row.alpha===0),
    at20m.find(row=>row.alpha>0&&row.alpha<1),at20m.find(row=>row.alpha===1)]
    .map(screen=>{assert(screen,'A 20m alpha 0/intermediate/1 screen is missing.');return imageFor(screen);});
  const navigationLegs=[inward,outward].map(leg=>{
    const frames=beforeUndo.drawFrames.filter(frame=>frame.ready==='ready'&&
      frame.startedAt>=leg.startedAt&&frame.startedAt<=leg.reachedAt);
    return{target:leg.target,frames:frames.map((frame,i)=>({
      ...frame,renderMs:frame.finishedAt-frame.startedAt,
      intervalMs:i?frame.startedAt-frames[i-1].startedAt:null}))};
  });
  const navFrames=navigationLegs.flatMap(leg=>leg.frames);
  assert(navFrames.length>0,'No loaded productive navigation frames observed.');
  const row={index,initial,display,inward,outward,commits,references,statuses,committed,undone,
    initialScreen,pointerBaseline,firstDraftMs,firstObservedPixelMsUpperBound,changedScreen,
    firstChangedPackedScreenMs:changedScreen.at-firstDown.at,
    field,undoField,picks,beforeUndo,navigationLegs,
    resources:{before:resourcesBefore,after:resourcesAfter,appMetrics},
    screenshotFrames,alphaImageBindings,
    completeCapture:true,inputProvenance:result.inputProvenance};
  await writeFile(path.join(output,`attempt-${index}`,'capture.json'),JSON.stringify(row,null,2));
  result.attempts.push({index,path:`attempt-${index}/capture.json`,
    sha256:hash(await readFile(path.join(output,`attempt-${index}`,'capture.json'))),
    firstObservedPixelMsUpperBound,firstDraftMs,loadedNavigationFrames:navFrames.length,
    loadedNavigationRenderMs:navFrames.map(frame=>frame.renderMs),
    loadedNavigationIntervalMs:navFrames.filter(frame=>frame.intervalMs!==null).map(frame=>frame.intervalMs)});
  await resourceMonitor.unbindPage();
  await native.close();page=null;
  const release=await resourceMonitor.checkpoint('attempt-'+index+'-after-normal-close');
  firstReleaseCurrentBytes??=release.currentBytes;
  if(release.currentBytes>firstReleaseCurrentBytes+resourceContract.releaseGrowthAllowanceBytes)
    throw abort('Unexplained post-close private-session memory growth');
  result.attempts.at(-1).release=release;
  activeAttempt=null;
}

try{
  resourceMonitor=await startResourceMonitor();
  fixture=await createTerrainWaterFixture(native.profile);
  await mkdir(output,{recursive:true});
  seedFile=path.join(output,'frozen-initial.sqlite');
  await copyFile(fixture.filename,seedFile);
  result.fixture={...fixture,initialSqliteSha256:hash(await readFile(seedFile))};
  for(let index=1;index<=30;index++){
    if(index>1)await restoreInitial();
    await attempt(index);
    await writeFile(path.join(output,'capture-progress.json'),JSON.stringify(result,null,2));
  }
  assert.equal(result.attempts.length,30);
  result.largeDrawStage=await largeK2DrawStage();
  const p95=values=>{
    assert.equal(values.length,30,'All 30 planned comparable samples are required.');
    return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  };
  const readback=await Promise.all(result.attempts.map(async row=>{
    const capture=JSON.parse(await readFile(path.join(output,row.path),'utf8'));
    return{index:row.index,...capture.beforeUndo.pixelReadback,
      firstPixelReadbackMs:capture.beforeUndo.firstPixel?.readbackMs??null,
      firstPixelSampleGapMs:capture.beforeUndo.firstPixel?.sampleGapMs??null,
      framePendingPeakBytes:capture.screenshotFrames.peakPendingBytes,
      frameWriteAndAckPeakMs:Math.max(0,...capture.screenshotFrames.records.map(frame=>frame.writeAndAckMs??0))};
  }));
  result.metrics={firstObservedTerrainPixelP95UpperBoundMs:p95(result.attempts.map(row=>row.firstObservedPixelMsUpperBound)),
    firstDraftP95Ms:p95(result.attempts.map(row=>row.firstDraftMs)),
    measurementCosts:readback,
    loadedNavigationRenderMs:result.attempts.flatMap(row=>row.loadedNavigationRenderMs),
    loadedNavigationIntervalMs:result.attempts.flatMap(row=>row.loadedNavigationIntervalMs),
    thresholds:{firstObservedTerrainPixelP95UpperBoundMs:100,loadedNavigationFrameMs:33.3}};
  result.metrics.loadedNavigationFramesOver33_3Ms={render:result.metrics.loadedNavigationRenderMs
    .filter(value=>value>33.3).length,interval:result.metrics.loadedNavigationIntervalMs
    .filter(value=>value>33.3).length};
  result.metrics.pixelTimingInterpretation='Observed afterRender/raw-WebGL terrain change is an upper bound from pointerdown, not exact first scanout. Blocking readPixels, sampling gap and capture writes are recorded separately; a slow measured gate needs instrumentation-cost review and is not silently attributed wholly to product.';
  assert(result.metrics.firstObservedTerrainPixelP95UpperBoundMs<=100,
    'The unchanged 30-attempt first-terrain-pixel p95 exceeded 100 ms.');
  result.resources=await resourceMonitor.stop();resourceMonitor=null;
  assert.equal(result.resources.terminal,null,'Protected resource series has a terminal failure.');
  result.finished=new Date().toISOString();
  result.pending=['Direct visual review of bound field images/alpha transitions',
    'Review limited resource envelope, protected process series and release',
    'Independent E-R3 evaluation after direct review',
    'Explicit loaded-navigation 33.3 ms decision and 1117-draw load review'];
  await native.finish(result);
}catch(error){
  result.failure={attempt:activeAttempt,error:error.stack??String(error)};
  if(page)result.lastRenderer=await page.evaluate(()=>({
    map:{...document.querySelector('#campaign-map')?.dataset},
    errors:window.__twP?.errors,fieldGate:window.__twFieldGate?.frames?.at(-1)})).catch(()=>null);
  await writeFile(path.join(output,'capture-progress.json'),JSON.stringify(result,null,2));
  await native.fail(error);throw error;
}finally{
  await stopFrames().catch(()=>{});
  if(resourceMonitor){result.resources=await resourceMonitor.stop().catch(error=>({terminal:String(error)}));resourceMonitor=null;}
  await native.dispose();
  await rm(native.profile,{recursive:true,force:true});
  await writeFile(path.join(output,'cleanup.json'),JSON.stringify({
    profileRemoved:await stat(native.profile).then(()=>false,()=>true),
    nativeLaunches:native.launches,resources:result.resources??null,
    failure:result.failure??null},null,2));
}
