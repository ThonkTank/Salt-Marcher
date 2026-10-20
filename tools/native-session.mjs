import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {currentProcessGroup} from './process-group.mjs';

const artifacts=['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,ms,message){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}
}
export function assertNativeCompletion(launches,errors){
 assert(launches.length>0,'No native launches recorded');
 assert.deepEqual(errors,[],'Renderer errors prevent qualification');
 for(const launch of launches){assert.deepEqual(launch.exit,{code:0,signal:null},'Every launch must close normally');assert.equal(launch.pidAbsent,true,'Closed native PID must be absent');}
}

/** Technical evidence only. The caller owns the actual user task and its assertions. */
export async function createNativeSession({root=process.cwd(),output,name,resultName='result.json'}){
 const require=createRequire(root+'/package.json');
 await mkdir(output,{recursive:true});
 // Remove success before fixture setup: even a setup failure must not leave an old pass.
 await rm(path.join(output,resultName),{force:true});await rm(path.join(output,'failure.json'),{force:true});
 const profiles=path.join(homedir(),'.cache/saltmarcher/ui');await mkdir(profiles,{recursive:true});
 const profile=await mkdtemp(path.join(profiles,name+'-')),group=await currentProcessGroup();
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const dirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
 const hashes=async()=>Object.fromEntries(await Promise.all(artifacts.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,'.build/desktop',file))).digest('hex')])));
 const build=await hashes(),launches=[],errors=[];let app=null,processHandle=null,proxy=null,proxyError=null;
 const bus=path.join(profile,'bus');
 const evidence=()=>({source,dirty,profile,artifacts:build,launches,errors});
 async function startBus(){
  if(proxy)return;
  assert(process.env.DBUS_SESSION_BUS_ADDRESS,'Native session bus missing');
  proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
  proxy.on('error',error=>{proxyError=error;});
  for(let i=0;i<100;i++){if(proxyError)throw proxyError;if(await stat(bus).catch(()=>null))return;if(proxy.exitCode!==null)throw Error('Native bus proxy exited');await delay(20);}
  throw Error('Native bus proxy did not start');
 }
 async function launch(zoom=1){
  assert.equal(app,null,'Close the previous native process before restarting');
  assert.deepEqual(await hashes(),build,'Native artifacts changed during this workflow');await startBus();
  app=await require('playwright-core')._electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron'),args:[path.join(root,'.build/desktop/main.cjs'),'--ozone-platform=x11','--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus},timeout:20000});
  processHandle=app.process();const pid=processHandle.pid,entry={pid,zoom,cgroup:group};launches.push(entry);
  app.process().once('exit',(code,signal)=>{entry.exit={code,signal};});
  assert((await readFile('/proc/'+pid+'/cmdline','utf8')).includes(profile),'Native profile ownership missing');
  assert.equal((await readFile('/proc/'+pid+'/cgroup','utf8')).trim().split('::')[1],group);
  const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.stack));
  await page.waitForURL(/\/index\.html$/);await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  await app.evaluate(({BrowserWindow},zoom)=>{const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));window.webContents.setZoomFactor(zoom);window.show();window.focus();},zoom);
  return page;
 }
 async function close(){
  assert(app,'No native process to close');const child=app.process(),entry=launches.at(-1);
  assert.equal(child.exitCode,null,'Native process already exited');
  const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  assert.deepEqual(await bounded(exited,10000,'Normal close timed out'),{code:0,signal:null});
  await assert.rejects(stat('/proc/'+child.pid),{code:'ENOENT'});entry.pidAbsent=true;app=null;processHandle=null;
 }
 async function capture(page,name,selector){
  assert(app,'Native capture requires an open application');
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.show();w.focus();});
  if(selector)await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise((resolve,reject)=>{let frame;const timer=setTimeout(()=>{cancelAnimationFrame(frame);reject(Error('No fresh native capture frames'));},2500);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});});}));
  const bytes=Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG()));
  const png=require('pngjs').PNG.sync.read(bytes),colors=new Set();for(let i=0;i<png.data.length;i+=4*31)colors.add(png.data.readUInt32BE(i));
  assert(colors.size>8,'Native capture is blank');await writeFile(path.join(output,name.endsWith('.png')?name:name+'.png'),bytes);
 }
 async function finish(extra={}){
  assert.equal(app,null,'Close all native windows before publishing success');assertNativeCompletion(launches,errors);
  assert.deepEqual(await hashes(),build,'Native artifacts changed during this workflow');
  await writeFile(path.join(output,resultName),JSON.stringify({...extra,...evidence()},null,2));
 }
 async function fail(error){
  await rm(path.join(output,resultName),{force:true});await writeFile(path.join(output,'failure.json'),JSON.stringify({...evidence(),error:error.stack??String(error)},null,2));
  if(app)try{await capture(await app.firstWindow(),'failure.png');}catch{}
 }
 async function dispose(){
  // Emergency cleanup is never counted as normal completion.
  if(app){const child=processHandle;try{await bounded(app.close(),3000,'Emergency close timed out');}catch{}finally{if(child&&child.exitCode===null&&(await readFile('/proc/'+child.pid+'/cmdline','utf8').catch(()=>'' )).includes(profile))child.kill('SIGKILL');app=null;processHandle=null;}}
  if(proxy){proxy.kill();proxy=null;}
 }
 return{profile,source,dirty,artifacts:build,launches,errors,get app(){return app;},launch,close,capture,finish,fail,dispose};
}
