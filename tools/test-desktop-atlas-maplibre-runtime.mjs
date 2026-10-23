import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';

const root=process.cwd();
const output=path.resolve(root,'.build/atlas-maplibre-runtime-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-maplibre-runtime'});
const assets=[
  '.build/desktop/ui/atlas-maplibre-runtime.js',
  '.build/desktop/ui/atlas-maplibre-worker.mjs',
  '.build/desktop/ui/atlas-maplibre-projection-worker.mjs',
  '.build/desktop/ui/atlas-maplibre.css'
];
const sources=[
  'package.json','package-lock.json','desktop/main.ts','src/app/index.html',
  'src/app/atlas-maplibre-runtime.ts','src/app/atlas-maplibre-bridge.ts',
  'src/app/atlas-maplibre-projection.ts','src/app/atlas-maplibre-projection-worker.ts',
  'src/app/atlas-metric-space.ts','src/app/atlas-metric-query.ts','tools/build-desktop.mjs'
];
const hashFiles=async files=>Object.fromEntries(await Promise.all(files.map(async file=>[
  file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')
])));
async function bounded(promise,ms,message){
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}
  finally{clearTimeout(timer);}
}

let page=null,consoleErrors=[],before;
try{
  before={built:await hashFiles(assets),sources:await hashFiles(sources)};
  page=await native.launch();
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  const responseCapture=await native.app.evaluate(({BrowserWindow},assetNames)=>{
    const win=BrowserWindow.getAllWindows().find(item=>item.webContents.getURL().endsWith('/index.html'));
    if(!win)throw new Error('Campaign main window missing before Atlas runtime smoke');
    const allowed=new Set(assetNames),session=win.webContents.session;
    globalThis.__atlasMapLibreResourceResponses=[];
    session.webRequest.onCompleted({urls:['<all_urls>']},details=>{
      const url=new URL(details.url),name=url.pathname.slice(1);
      if(url.protocol==='campaign:'&&url.host==='app'&&allowed.has(name))
        globalThis.__atlasMapLibreResourceResponses.push({name,statusCode:details.statusCode,url:details.url,resourceType:details.resourceType});
    });
    const preferences=win.webContents.getLastWebPreferences();
    return {url:win.webContents.getURL(),webPreferences:{nodeIntegration:preferences.nodeIntegration,
      contextIsolation:preferences.contextIsolation,sandbox:preferences.sandbox}};
  },assets.map(file=>path.basename(file)));
  assert.match(responseCapture.url,/^campaign:\/\/app\/index\.html$/);
  assert.deepEqual(responseCapture.webPreferences,{nodeIntegration:false,contextIsolation:true,sandbox:true});

  const pageBridge=await bounded(page.evaluate(async()=>{
    if(typeof window.require!=='undefined')throw new Error('Renderer exposes require');
    const runtime=await import('campaign://app/atlas-maplibre-runtime.js');
    const first=runtime.initializeAtlasMapLibre(),second=runtime.initializeAtlasMapLibre();
    if(first!==second)throw new Error('Atlas runtime initialization is not idempotent');
    const ready=await first;
    const link=document.createElement('link');link.rel='stylesheet';link.href='campaign://app/atlas-maplibre.css';link.dataset.atlasMaplibreSmoke='true';
    const cssReady=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Atlas MapLibre stylesheet timeout')),10_000);
      link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);reject(new Error('Atlas MapLibre stylesheet failed'));};
    });
    document.head.append(link);await cssReady;
    const container=document.createElement('div');container.dataset.atlasMaplibreSmoke='true';
    Object.assign(container.style,{position:'fixed',left:'24px',top:'80px',width:'720px',height:'480px',zIndex:'99999',background:'#dce5ea'});
    document.body.append(container);
    const root={x:-33554432,y:-33554432,size:67108864},crs=runtime.atlasMetricCRS('atlas:runtime-smoke',root);
    runtime.maplibre.addProjection(crs);
    const map=new runtime.maplibre.Map({container,center:[0,0],zoom:Math.log2(root.size*720/(512*3000)),bearing:0,pitch:75,
      maxPitch:75,attributionControl:false,renderWorldCopies:false,
      style:{version:8,projection:{type:crs.name},sources:{marker:{type:'geojson',maxzoom:24,data:{type:'FeatureCollection',features:[
        {type:'Feature',id:'runtime-marker',properties:{id:'runtime-marker'},geometry:{type:'Point',coordinates:[0,0]}}
      ]}}},layers:[{id:'smoke-background',type:'background',paint:{'background-color':'#c3d0c5'}},
        {id:'runtime-marker-layer',type:'circle',source:'marker',paint:{'circle-radius':10,'circle-color':'#b63345','circle-stroke-width':2,'circle-stroke-color':'#ffffff'}}]}});
    const waitEvent=(target,type,ms,message)=>new Promise((resolve,reject)=>{
      if(type==='load'&&target.loaded())return resolve();
      let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);target.off(type,onEvent);error?reject(error):resolve();};
      const onEvent=()=>finish();const timer=setTimeout(()=>finish(new Error(message)),ms);target.once(type,onEvent);
    });
    await waitEvent(map,'load',15_000,'MapLibre style/load timeout');
    await new Promise((resolve,reject)=>{
      let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);map.off('sourcedata',check);error?reject(error):resolve();};
      const check=()=>{if(map.isSourceLoaded('marker'))finish();};
      const timer=setTimeout(()=>finish(new Error('Metric CRS marker source readiness timeout')),10_000);
      map.on('sourcedata',check);check();
    });
    const bridge=new runtime.AtlasMapLibreBridge({map,root,sceneOrigin:{x:0,y:0},sourceIds:['marker']});
    const overlay=await bridge.attach([]);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{map.off('render',finish);reject(new Error('Atlas runtime render timeout'));},8_000);
      function finish(){clearTimeout(timer);map.off('render',finish);resolve();}
      map.once('render',finish);map.triggerRepaint();
    });
    await Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Atlas runtime frame settle timeout')),2_000))]);
    const point=map.project([0,0]);
    const query=runtime.queryRenderedFeaturesMetricSafe(map,[point.x,point.y],{layers:['runtime-marker-layer']},runtime.maplibre.getVersion());
    const gl=map.getCanvas().getContext('webgl2'),deckGl=overlay._deck?.device?.gl??overlay._deck?.device?.handle;
    if(query.features[0]?.properties?.id!=='runtime-marker')throw new Error('Metric CRS marker query missed its GeoJSON feature');
    if(overlay.getCanvas()!==map.getCanvas()||deckGl!==gl||!(gl instanceof WebGL2RenderingContext))
      throw new Error('Atlas runtime bridge did not share MapLibre WebGL2 canvas/context');
    if(!bridge.frame||bridge.frame.mvp.length!==16||bridge.frame.mainMatrix.length!==16||bridge.frame.projection.length!==16||
      ![...bridge.frame.mvp,...bridge.frame.mainMatrix,...bridge.frame.projection].every(Number.isFinite))
      throw new Error('Atlas runtime bridge did not capture a finite MapLibre projection frame');
    window.__atlasMapLibreRuntimeSmoke={runtime,root,crs,map,bridge,container,link,
      details:{ready:ready===undefined,initializationPromiseShared:true,cssLoaded:!!link.sheet,queryId:query.features[0].properties.id,
        queryRestored:query.restored,queryScale:{raw:query.rawScale,adapted:query.adaptedScale},sharedCanvas:overlay.getCanvas()===map.getCanvas(),
        sharedWebgl2:deckGl===gl,frameRevision:bridge.frame.revision,projectionName:crs.name}};
    return window.__atlasMapLibreRuntimeSmoke.details;
  }),60_000,'Atlas MapLibre runtime browser smoke timed out');
  assert.equal(pageBridge.initializationPromiseShared,true);
  assert.equal(pageBridge.cssLoaded,true);
  assert.equal(pageBridge.queryId,'runtime-marker');
  assert.equal(pageBridge.queryRestored,true);
  assert.equal(pageBridge.sharedCanvas,true);
  assert.equal(pageBridge.sharedWebgl2,true);
  assert(pageBridge.frameRevision>0);
  await native.capture(page,'atlas-maplibre-runtime.png');

  const expectedNames=assets.map(file=>path.basename(file));
  const responses=await bounded(native.app.evaluate(()=>globalThis.__atlasMapLibreResourceResponses??[]),5_000,'Resource response read timed out');
  // Electron does not report worker-internal requests through this session's
  // onCompleted hook. Verify all four protocol routes and exact built bytes by
  // an explicit same-origin read, separately from the worker-execution checks.
  const resourceReads=await bounded(page.evaluate(async names=>Promise.all(names.map(async name=>{
    const url=new URL(name,location.href).href,response=await fetch(url),bytes=await response.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return {name,url,status:response.status,bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')};
  })),expectedNames),15_000,'Atlas asset byte verification timed out');
  for(const item of resourceReads){
    assert.equal(item.status,200,`Atlas asset unavailable: ${item.name}`);
    assert(item.bytes>0,`Empty Atlas asset: ${item.name}`);
    assert.equal(item.sha256,before.built['.build/desktop/ui/'+item.name],`Atlas protocol bytes differ from the build: ${item.name}`);
    assert(item.url.startsWith('campaign://app/'),'Atlas asset reads must stay same-origin');
  }
  assert.deepEqual(resourceReads.map(item=>item.name).sort(),expectedNames.sort());
  assert(responses.every(item=>item.statusCode===200),'Observed Atlas resource requests must succeed');
  assert.deepEqual(consoleErrors,[],'Page console errors prevent Atlas runtime smoke');

  const teardown=await page.evaluate(()=>{
    const f=window.__atlasMapLibreRuntimeSmoke;if(!f)return {disposed:false};
    f.bridge.dispose();f.map.remove();f.container.remove();f.link.remove();delete window.__atlasMapLibreRuntimeSmoke;
    return {disposed:true,atlasContainers:document.querySelectorAll('[data-atlas-maplibre-smoke]').length,
      atlasLinks:document.querySelectorAll('link[data-atlas-maplibre-smoke]').length};
  });
  assert.deepEqual(teardown,{disposed:true,atlasContainers:0,atlasLinks:0});
  const mainStillOpen=await native.app.evaluate(({BrowserWindow})=>{
    const windows=BrowserWindow.getAllWindows();return windows.length===1&&windows[0].webContents.getURL()==='campaign://app/index.html'&&!windows[0].isDestroyed();
  });
  assert.equal(mainStillOpen,true,'Atlas runtime smoke must leave the campaign main window intact');
  const after={built:await hashFiles(assets),sources:await hashFiles(sources)};
  assert.deepEqual(after,before,'Atlas runtime build assets, source files, and root lock must remain unchanged');
  await native.close();
  await native.finish({complete:true,scope:'Built desktop runtime/protocol/CSP smoke only; not Atlas product acceptance.',
    hashes:{before,after},webPreferences:responseCapture.webPreferences,resources:responses,resourceReads,bridge:pageBridge,
    cleanup:teardown,mainStillOpen,consoleErrors});
  console.log(JSON.stringify({complete:true,output,packageSource:native.source,resources:resourceReads.map(item=>({name:item.name,statusCode:item.status})),bridge:pageBridge}));
}catch(error){
  await native.fail(error);
  throw error;
}finally{
  if(page)try{await bounded(page.evaluate(()=>{
    const f=window.__atlasMapLibreRuntimeSmoke;if(f){try{f.bridge.dispose();}finally{f.map.remove();f.container.remove();f.link.remove();delete window.__atlasMapLibreRuntimeSmoke;}}
  }),5_000,'Atlas runtime cleanup timed out');}catch{}
  await native.dispose();
}
