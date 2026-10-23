import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile,writeFile,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';

const repo=resolve('.'),build=resolve('.build/atlas-maplibre-interop');
const output=process.env.ATLAS_INTEROP_OUTPUT;
assert(output,'The runner must provide a unique evidence directory');
await mkdir(output,{recursive:true});
const require=createRequire(join(repo,'package.json')),{_electron}=require('playwright-core');
const profiles=join(homedir(),'.cache/saltmarcher/ui');await mkdir(profiles,{recursive:true});
const profile=await mkdtemp(join(profiles,'ami-')),bus=join(profile,'bus');
const result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),profile,errors:[],console:[],lifecycle:{normalExit:false}};
const inputs=['tools/atlas-maplibre-interop-main.cjs','tools/atlas-maplibre-interop-driver.mjs',
  'tools/atlas-maplibre-interop/package.json','tools/atlas-maplibre-interop/package-lock.json',
  'tools/atlas-maplibre-interop-probe.mjs','src/app/atlas-metric-space.ts','src/app/atlas-metric-query.ts',
  'tools/atlas-maplibre-interop.html','tools/atlas-maplibre-interop.css','tools/atlas-maplibre-interop-projection-handler.mjs',
  '.build/atlas-maplibre-interop/probe.bundle.mjs','.build/atlas-maplibre-interop/package-lock.json',
  '.build/atlas-maplibre-interop/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
  '.build/atlas-maplibre-interop/node_modules/maplibre-gl/dist/maplibre-gl.css'];
const hashInputs=()=>Promise.all(inputs.map(async name=>[name,createHash('sha256').update(await readFile(name)).digest('hex')]));
result.artifacts=Object.fromEntries(await hashInputs());
let app,child,exitPromise,exitState=null,proxy,proxyError;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function bounded(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}
try{
  assert(process.env.DBUS_SESSION_BUS_ADDRESS,'Native session bus missing');
  proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
  proxy.once('error',error=>{proxyError=error;});
  for(let i=0;i<100;i++){
    if(proxyError)throw proxyError;
    if(await stat(bus).catch(()=>null))break;
    assert.equal(proxy.exitCode,null,'DBus proxy exited before startup');
    if(i===99)throw Error('Private DBus proxy did not start');
    await delay(20);
  }
  console.log('launch');
  app=await _electron.launch({executablePath:join(repo,'node_modules/electron/dist/electron'),args:[join(repo,'tools/atlas-maplibre-interop-main.cjs')],
    env:{...process.env,SALTMARCHER_REPO:repo,ATLAS_INTEROP_PROFILE:profile,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus},timeout:20000});
  child=app.process();result.lifecycle.pid=child.pid;
  exitPromise=new Promise(resolve=>child.once('exit',(code,signal)=>{exitState={code,signal};resolve(exitState);}));
  child.stderr.on('data',data=>process.stderr.write(data));
  const page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>result.errors.push(error.stack??String(error)));
  page.on('console',message=>result.console.push({type:message.type(),text:message.text()}));
  await page.waitForFunction(()=>window.__atlasMapLibreInteropReady===true);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});
  console.log('probe');
  const observed=await bounded(Promise.race([
    page.evaluate(()=>window.runAtlasMapLibreInterop()),
    exitPromise.then(exit=>{throw Error('Electron exited during probe: '+JSON.stringify(exit));})
  ]),180000,'Interop probe did not finish');
  // Preserve driver errors; the renderer carries its own errors under probeErrors.
  const {errors:probeErrors=[],visualDataUrl,projectionVisuals=[],...rest}=observed;
  Object.assign(result,rest,{probeErrors});
  result.projectionVisuals=[];
  for(const {name,dataUrl} of projectionVisuals){
    assert(/^[a-z]+$/.test(name),'Invalid projection image name');
    assert(dataUrl?.startsWith('data:image/png;base64,'),'Invalid projection image');
    const file=`projection-${name}.png`;
    await writeFile(join(output,file),Buffer.from(dataUrl.slice(22),'base64'));
    result.projectionVisuals.push({name,file});
  }
  if(visualDataUrl?.startsWith('data:image/png;base64,')){
    await writeFile(join(output,'shared-canvas.png'),Buffer.from(visualDataUrl.slice(22),'base64'));
    result.visual='shared-canvas.png';
  }
  console.log('native gestures');
  await page.evaluate(()=>window.prepareAtlasMetricGestureProbe());
  const pointer=[680,520];
  const observe=()=>page.evaluate(point=>window.observeAtlasMetricGesture(point),pointer);
  const settle=async()=>{await page.waitForFunction(()=>window.atlasMetricGestureSettled());};
  const before=await observe();
  await page.mouse.move(...pointer);await page.mouse.down();
  await page.mouse.move(pointer[0]+100,pointer[1]+40,{steps:12});await page.mouse.up();
  await settle();const pan=await observe();
  await page.mouse.move(...pointer);const beforeWheel=await observe();
  await page.mouse.wheel(0,-240);
  // Wait for a changed zoom before waiting for rest: wheel processing begins on
  // a later frame, so an immediate !isMoving check could observe the old state.
  await page.waitForFunction(async zoom=>(await window.observeAtlasMetricGesture([680,520])).zoom!==zoom,beforeWheel.zoom);
  await settle();const zoom=await observe();
  const anchor=await page.evaluate(world=>window.projectAtlasMetricGesturePoint(world),beforeWheel.worldAtPointer);
  await page.mouse.move(...pointer);await page.mouse.down({button:'right'});
  await page.mouse.move(pointer[0]+100,pointer[1]-80,{steps:12});await page.mouse.up({button:'right'});
  await settle();const rotateTilt=await observe();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(960,720));
  await page.waitForFunction(async()=>{const row=await window.observeAtlasMetricGesture([680,520]);return row.viewport.width===960&&row.viewport.height===720&&row.viewport.deckWidth===960&&row.viewport.deckHeight===720;});
  await settle();const resized=await observe();
  await page.screenshot({path:join(output,'native-gestures.png')});
  const gestureChecks={
    nativePan:Math.hypot(pan.center.x-before.center.x,pan.center.y-before.center.y)>10&&pan.trusted.pointerdown>before.trusted.pointerdown&&pan.trusted.pointermove>before.trusted.pointermove,
    nativeZoomAtPointer:zoom.zoom>beforeWheel.zoom&&zoom.trusted.wheel>beforeWheel.trusted.wheel&&Math.hypot(anchor.x-pointer[0],anchor.y-pointer[1])<1,
    nativeRotateTilt:Math.abs(rotateTilt.bearing-zoom.bearing)>1&&rotateTilt.pitch>zoom.pitch+1&&rotateTilt.pitch<=75&&rotateTilt.trusted.pointerdown>zoom.trusted.pointerdown&&rotateTilt.trusted.pointermove>zoom.trusted.pointermove,
    nativeResize:resized.viewport.width===960&&resized.viewport.height===720&&resized.viewport.deckWidth===960&&resized.viewport.deckHeight===720,
    nativeCameraAlignment:[pan,zoom,rotateTilt,resized].every(row=>row.projectionErrorPx<.1)
  };
  result.nativeGestures={before,pan,beforeWheel,zoom,anchor,rotateTilt,resized,checks:gestureChecks,passed:Object.values(gestureChecks).every(Boolean)};
  await page.evaluate(()=>window.finishAtlasMetricGestureProbe());
  result.gpu=await bounded(app.evaluate(async({app})=>({features:app.getGPUFeatureStatus(),info:await app.getGPUInfo('basic')})),10000,'GPU information timed out');
  console.log('close');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  const exit=await bounded(exitPromise,10000,'Normal Electron close timed out');
  assert.deepEqual(exit,{code:0,signal:null});
  await assert.rejects(stat('/proc/'+child.pid),{code:'ENOENT'});
  result.lifecycle={...result.lifecycle,exit,normalExit:true,pidAbsent:true};app=null;
  result.artifactsAfter=Object.fromEntries(await hashInputs());
  const checks={planarRoundTrips:result.scaleProjectionPassed===true,maplibrePicking:result.scaleMaplibrePickingPassed===true,
    inputsUnchanged:inputs.every(name=>result.artifacts[name]===result.artifactsAfter[name]),
    terrainMeters:result.terrainMetreContract?.passed===true,
    sharedWebgl2:result.integration?.some(c=>c.check==='map-webgl2'&&c.passed===true)===true,
    styleReload:result.integration?.some(c=>c.check==='style-reload-layer-group-reconciliation'&&c.passed===true)===true,
    fixedWorldGeometry:result.integration?.some(c=>c.check==='pan-zoom-preserves-fixed-deck-world-geometry'&&c.passed===true)===true,
    rotationWrap:result.integration?.some(c=>c.check==='rotation-360-wrap'&&c.passed===true)===true,
    rootExpansion:result.rootExpansion?.passed===true,
    injectedDeckOverlay:result.integration?.some(c=>c.check==='caller-view-overlay'&&c.passed===true)===true,
    deckGeometryPicking:result.integration?.some(c=>c.check==='five-scale-deck-geometry-picking'&&c.passed===true)===true,
    crossEngineDepth:result.integration?.some(c=>c.check==='cross-engine-shared-depth-pixel-proof'&&c.passed===true)===true};
  Object.assign(checks,result.nativeGestures.checks);
  result.qualification={checks,passed:Object.values(checks).every(Boolean)&&!result.errors.length&&!probeErrors.length&&!result.console.some(c=>c.type==='error')};
}catch(error){
  result.harnessError=error.stack??String(error);
  result.qualification={passed:false};
  if(app)try{
    const window=(await app.windows())[0];
    if(window)await window.screenshot({path:join(output,'failure.png')});
    const partial=window&&await bounded(window.evaluate(()=>window.atlasMapLibreInterop),3000,'Partial probe state unavailable');
    if(partial)result.partial=partial;
  }catch{}
}finally{
  if(app){
    result.lifecycle.emergencyCleanup=true;
    try{await bounded(app.close(),3000,'Emergency cleanup timed out');}catch{}
    if(child&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
    result.lifecycle.exit=exitState;
  }
  proxy?.kill();
  await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify({output,lifecycle:result.lifecycle,qualification:result.qualification,harnessError:result.harnessError},null,2));
if(!result.qualification?.passed)process.exitCode=1;
