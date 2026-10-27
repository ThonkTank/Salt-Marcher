import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
const run=promisify(execFile);

/** A temporary KWin script activates only this disposable native process.
 * No configuration, shortcuts or installed scripts are changed. API:
 * https://develop.kde.org/docs/plasma/kwin/api/ (workspace.activeWindow). */
export async function focusTerrainWindow(app,{output,profile,titleIncludes}){
 assert(titleIncludes,'Focus diagnostics require the unique owned test-window title');
 const pid=app.process().pid,name=`saltmarcher-terrain-focus-${pid}-${Date.now()}`;
 // Chromium may own its Wayland connection in the GPU child. Electron reports
 // only this application's native process family, never another app's PID.
 const ownedPids=await app.evaluate(({app})=>app.getAppMetrics().map(m=>m.pid));
 assert(ownedPids.includes(pid),'Native app metrics must include its browser process');
 // native-session already checked this exact app handle's launch/profile.
 // Electron may reorder Linux argv; do not create another ownership parser.
 const identity=await app.evaluate(({app})=>({pid:process.pid,userData:app.getPath('userData'),argv:process.argv}));
 await writeFile(path.join(output,name+'-identity.json'),JSON.stringify({profile,identity,ownedPids},null,2));
 const service=`org.saltmarcher.TerrainProbe.p${pid}_${Date.now()}`,reportFile=path.join(output,name+'.json');
 let startupTimer,loadAttempted=false,loaded=false;
 const source=`const pids=${JSON.stringify(ownedPids)},wanted=${JSON.stringify(titleIncludes)};\nconst own=workspace.windowList().filter(w=>pids.includes(w.pid));\nconst candidates=workspace.windowList().filter(w=>w.caption.includes(wanted));\nconst target=own.find(w=>w.caption.includes(wanted));\nconst before=target?{activeWindowMatches:workspace.activeWindow===target,active:target.active}:null;\nif(target)workspace.activeWindow=target;\nconst after=target?{activeWindowMatches:workspace.activeWindow===target,active:target.active,wantsInput:target.wantsInput,className:String(target),waylandClient:target.waylandClient,x11Client:target.x11Client,minimized:target.minimized}:null;\nconst report=JSON.stringify({ownedPids:pids,wanted,ownMatches:own.map(w=>({pid:w.pid,title:w.caption,className:String(w),wantsInput:w.wantsInput,waylandClient:w.waylandClient,x11Client:w.x11Client})),titleCandidates:candidates.map(w=>({pid:w.pid,title:w.caption,className:String(w),wantsInput:w.wantsInput,waylandClient:w.waylandClient,x11Client:w.x11Client})),targetFound:!!target,assignmentExecuted:!!target,before,after});\ncallDBus(${JSON.stringify(service)},'/Probe','org.saltmarcher.TerrainProbe','Report',report);\n`;
 const filename=path.join(output,name+'.js');await writeFile(filename,source);
 const reporter=spawn('python',[path.resolve('tools/terrain-water-focus-reporter.py'),service,reportFile],{stdio:['ignore','pipe','pipe']});
 const call=async(object,method,...args)=>(await run('gdbus',['call','--session','--dest','org.kde.KWin','--object-path',object,'--method',method,...args],{timeout:5000})).stdout.trim();
 try{
  await new Promise((resolve,reject)=>{const finish=error=>{clearTimeout(startupTimer);error?reject(error):resolve();};startupTimer=setTimeout(()=>finish(Error('Private focus reporter did not start')),5000);reporter.once('error',finish);reporter.once('exit',code=>finish(Error('Private focus reporter exited: '+code)));reporter.stdout.once('data',bytes=>finish(String(bytes).includes('ready')?null:Error('Private focus reporter returned no ready marker')));});
  loadAttempted=true;const result=await call('/Scripting','org.kde.kwin.Scripting.loadScript',filename,name),id=Number(result.match(/^\((?:int32 )?(-?\d+),\)$/)?.[1]);
  assert(Number.isSafeInteger(id)&&id>=0,'KWin must return an owned temporary script id');loaded=true;
  await call('/Scripting/Script'+id,'org.kde.kwin.Script.run');
  const start=Date.now();let report;
  while(!report&&Date.now()-start<5000){
   report=await readFile(reportFile,'utf8').then(JSON.parse).catch(()=>null);
   if(!report)await new Promise(r=>setTimeout(r,50));
  }
  const focused=await app.evaluate(({BrowserWindow},title)=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes(title))?.isFocused()??false,titleIncludes);
  await writeFile(path.join(output,name+'-status.json'),JSON.stringify({browserFocused:focused,report},null,2));
  assert(report?.targetFound,'KWin must find this owned PID/title window');
  assert(report.after?.activeWindowMatches&&report.after.active,'KWin must activate this owned window');
  // BrowserWindow.isFocused is diagnostic on Wayland. The caller separately
  // proves real document focus and the trusted window blur consumed by product.
  return{method:'temporary KWin workspace.activeWindow',pid,ownedPids,titleIncludes,browserFocused:focused,report,scriptHash:createHash('sha256').update(source).digest('hex'),unloaded:true};
 }finally{
  clearTimeout(startupTimer);
  try{if(loadAttempted){const removed=await call('/Scripting','org.kde.kwin.Scripting.unloadScript',name);if(loaded)assert.equal(removed,'(true,)','Temporary KWin script must be unloaded');}}
  finally{reporter.kill();}
 }
}
