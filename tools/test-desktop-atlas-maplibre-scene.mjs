import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {createAtlasMapLibreCanonicalFixture} from './atlas-maplibre-canonical-fixture.mjs';

const root=process.cwd(),output=path.resolve('.build/atlas-maplibre-scene-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-maplibre-scene'});
const files=['src/app/atlas-maplibre-scene.ts','src/app/atlas-maplibre-scene-model.ts',
  'src/app/atlas-maplibre-picking.ts',
  'src/app/atlas-maplibre-runtime.ts','src/app/atlas-maplibre-bridge.ts',
  'src/app/atlas-metric-space.ts','src/app/atlas-maplibre-projection.ts',
  'tools/atlas-maplibre-canonical-fixture.mjs','tools/test-desktop-atlas-maplibre-scene.mjs',
  '.build/desktop/ui/atlas-maplibre-runtime.js','.build/desktop/ui/atlas-maplibre-worker.mjs',
  '.build/desktop/ui/atlas-maplibre-projection-worker.mjs','package-lock.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
let page;
try{
  const fixture=await createAtlasMapLibreCanonicalFixture({profilePath:native.profile}),before=await hashes();
  page=await native.launch();
  const errors=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const setup=await page.evaluate(async fixture=>{
    const unwrap=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result.value;};
    const active=unwrap(await window.campaign.activate(fixture.campaignId));
    const runtime=await import('campaign://app/atlas-maplibre-runtime.js');await runtime.initializeAtlasMapLibre();
    const link=document.createElement('link');link.rel='stylesheet';link.href='campaign://app/atlas-maplibre.css';
    await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(Error('Atlas CSS unavailable'));document.head.append(link);});
    const container=document.createElement('div');container.id='atlas-canonical-scene-probe';
    Object.assign(container.style,{position:'fixed',left:'20px',top:'60px',width:'900px',height:'650px',zIndex:'99999'});document.body.append(container);
    const root={x:-33554432,y:-33554432,size:67108864},sceneOrigin={x:16,y:12};
    const crs=runtime.atlasMetricCRS('atlas:canonical-scene',root);runtime.maplibre.addProjection(crs);
    const camera=runtime.metricMapCamera(root,{focus:fixture.buildingAnchor,metersPerPixel:.75,rotation:0,tilt:0});
    const map=new runtime.maplibre.Map({container,...camera,minZoom:-10,maxZoom:30,maxPitch:75,attributionControl:false,renderWorldCopies:false,
      style:{version:8,projection:{type:crs.name},sources:{},layers:[{id:'base',type:'background',paint:{'background-color':'#d8e0de'}}]}});
    const bridge=new runtime.AtlasMapLibreBridge({map,root,sceneOrigin});
    await bridge.attach([]);const scene=new runtime.AtlasMapLibreScene(bridge);
    const render=()=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{map.off('render',done);reject(Error('Scene render timeout'));},10000);
      function done(){clearTimeout(timer);requestAnimationFrame(()=>requestAnimationFrame(resolve));}
      map.once('render',done);map.triggerRepaint();
    });
    const load=async(scopeId,floorId,roofs)=>{
      const view=unwrap(await window.campaign.atlasRegion(active.token,{...fixture.query,width:900,height:650,scopeId,floorId,roofs},'view'));
      const projection=unwrap(await window.campaign.atlasTerrainProjection(active.token,{revision:view.revision,fence:view.region.fence,
        view:{box:fixture.viewBox,frame:fixture.viewBox,columns:65,rows:65,focusM:140,tilt:0,rotation:0,exaggeration:1},
        width:64,height:64,contours:0,displayMpp:1,objects:[]},'view'));
      if(projection.fence!==view.region.fence||projection.revision!==view.revision)throw Error('Scene reads differ in revision/fence');
      const model=runtime.buildAtlasMapLibreSceneModel({view,terrain:projection.grid,root,sceneOrigin,
        display:{metersPerPixel:.5,roofs,scopeId}});
      scene.update(model);await render();
      return {view,projection,model};
    };
    window.__atlasCanonicalScene={runtime,fixture,map,bridge,scene,root,sceneOrigin,container,link,render,load,active};
    const data=await load(null,'ground',true);window.__atlasCanonicalScene.data=data;
    return {revision:data.view.revision,fence:data.view.region.fence,
      targets:data.model.objects.map(o=>o.target),coverage:data.model.coverage,terrainSamples:data.projection.grid.heights.length};
  },fixture);
  assert(setup.targets.some(t=>t.kind==='building'&&t.id===fixture.buildingId));
  assert(setup.targets.some(t=>t.kind==='terrain'));assert.equal(setup.terrainSamples,4225);

  const occlusion=await page.evaluate(async()=>{
    const f=window.__atlasCanonicalScene,model=f.data.model;
    const room=model.objects.find(o=>o.target.kind==='room'&&o.target.scopeId==='local');
    if(!room)throw Error('Canonical room at hill foot missing');
    const p=room.positions,i=room.indices;
    const local=[0,1,2].map(axis=>(p[i[0]*3+axis]+p[i[1]*3+axis]+p[i[2]*3+axis])/3);
    const screen=f.bridge.overlay._deck.getViewports()[0].project(local);
    const withTerrain=f.scene.pick(screen[0],screen[1]);
    // Counterexample: omit only the derived terrain mesh to expose the same
    // buried canonical room. Never change authored records or its geometry.
    f.scene.update({...model,objects:model.objects.filter(o=>o.target.kind!=='terrain')});await f.render();
    const withoutTerrain=f.scene.pick(screen[0],screen[1]);
    f.scene.update({...model,objects:model.objects.filter(o=>o.target.kind==='terrain')});await f.render();
    const terrainOnly=f.scene.pick(screen[0],screen[1]);
    f.scene.update(model);await f.render();
    return {roomTarget:room.target,screen,withTerrain,withoutTerrain,terrainOnly,restored:f.scene.pick(screen[0],screen[1])};
  });
  assert.equal(occlusion.withTerrain?.target.kind,'terrain',JSON.stringify(occlusion));
  assert.equal(occlusion.withoutTerrain?.target.id,occlusion.roomTarget.id,JSON.stringify(occlusion));
  assert.equal(occlusion.restored?.target.kind,'terrain');

  const cameraChecks=[];
  for(const [rotation,tilt] of [[0,0],[37,55],[-143,75]]){
    const check=await page.evaluate(async({rotation,tilt})=>{
      const f=window.__atlasCanonicalScene;
      f.map.jumpTo({bearing:rotation,pitch:tilt});await f.render();
      const viewport=f.bridge.overlay._deck.getViewports()[0];
      const points=[{x:8,y:13},{x:50,y:47},{x:25,y:34}];
      const alignment=points.map(p=>{
        const mapPoint=f.map.project(f.runtime.metricLngLat(f.root,p));
        const deckPoint=viewport.project([(p.x-f.sceneOrigin.x)/f.root.size,(p.y-f.sceneOrigin.y)/f.root.size,0]);
        return {world:p,errorPx:Math.hypot(mapPoint.x-deckPoint[0],mapPoint.y-deckPoint[1])};
      });
      const p=f.fixture.buildingAnchor,z=f.fixture.expected.roofTopM;
      const screen=viewport.project([(p.x-f.sceneOrigin.x)/f.root.size,(p.y-f.sceneOrigin.y)/f.root.size,z/f.root.size]);
      const hit=f.scene.pick(screen[0],screen[1]);
      return {rotation,tilt,alignment,screen,hit};
    },{rotation,tilt});
    assert(check.alignment.every(p=>p.errorPx<.01),'MapLibre and scene diverge away from Y=0');
    assert.equal(check.hit?.target.kind,'building',JSON.stringify(check));
    assert.equal(check.hit.target.id,fixture.buildingId);
    assert(check.hit.point&&Math.abs(check.hit.point.heightM-fixture.expected.roofTopM)<1,JSON.stringify(check));
    cameraChecks.push(check);
  }
  await native.capture(page,'canonical-hill-building.png');
  const floors=[];
  for(const floorId of ['ground',fixture.upperFloorId]){
    const result=await page.evaluate(async floorId=>{
      const f=window.__atlasCanonicalScene;
      f.map.jumpTo({bearing:23,pitch:0});await f.render();
      const data=await f.load(f.fixture.scopeId,floorId,false);
      const room=data.model.objects.find(o=>o.target.kind==='room'&&o.target.scopeId===f.fixture.scopeId&&o.target.floorId===floorId);
      if(!room)throw Error('Canonical room absent for '+floorId);
      const i=room.indices,p=room.positions;
      const local=[0,1,2].map(axis=>(p[i[0]*3+axis]+p[i[1]*3+axis]+p[i[2]*3+axis])/3);
      const viewport=f.bridge.overlay._deck.getViewports()[0],screen=viewport.project(local),hit=f.scene.pick(screen[0],screen[1]);
      return {floorId,target:room.target,hit,heightM:local[2]*f.root.size,coverage:data.model.coverage};
    },floorId);
    assert.equal(result.hit?.target.kind,'room',JSON.stringify(result));
    assert.equal(result.hit.target.id,result.target.id);
    assert(Math.abs(result.heightM-fixture.expected.floorHeightsM[floorId==='ground'?0:1])<.001,JSON.stringify(result));
    floors.push(result);
  }
  await native.capture(page,'canonical-upper-room.png');
  const lifecycle=await page.evaluate(async()=>{
    const f=window.__atlasCanonicalScene;
    f.container.style.width='800px';f.container.style.height='580px';f.map.resize();await f.render();
    const styleReady=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Style reload timed out')),10000);
      f.map.once('style.load',()=>{clearTimeout(timer);resolve();});
    });
    f.map.setStyle({version:8,projection:{type:'atlas:canonical-scene'},sources:{},layers:[{id:'base-reloaded',type:'background',paint:{'background-color':'#d8e0de'}}]},{diff:false});
    await styleReady;
    await f.bridge.waitForStyleReconciliation();await f.render();
    const data=await f.load(f.fixture.scopeId,f.fixture.upperFloorId,false);
    const room=data.model.objects.find(o=>o.target.kind==='room'&&o.target.scopeId===f.fixture.scopeId);
    const p=room.positions,i=room.indices,local=[0,1,2].map(axis=>(p[i[0]*3+axis]+p[i[1]*3+axis]+p[i[2]*3+axis])/3);
    const viewport=f.bridge.overlay._deck.getViewports()[0],screen=viewport.project(local),hit=f.scene.pick(screen[0],screen[1]);
    const picker=f.bridge.overlay._deck.deckPicker;
    return {width:viewport.width,height:viewport.height,hit,expected:room.target,
      pickingDepth:picker.pickingFBO.depthStencilAttachment.texture.format,
      heightDepth:picker.depthFBO.depthStencilAttachment.texture.format,
      pickingSize:[picker.pickingFBO.width,picker.pickingFBO.height],canvasSize:[f.map.getCanvas().width,f.map.getCanvas().height]};
  });
  assert.equal(lifecycle.hit?.target.id,lifecycle.expected.id,JSON.stringify(lifecycle));
  assert.equal(lifecycle.pickingDepth,'depth24plus');assert.equal(lifecycle.heightDepth,'depth24plus');
  assert.deepEqual(lifecycle.pickingSize,lifecycle.canvasSize);assert.equal(lifecycle.width,800);assert.equal(lifecycle.height,580);
  const cleanup=await page.evaluate(()=>{
    const f=window.__atlasCanonicalScene;f.scene.dispose();f.bridge.dispose();f.map.remove();f.container.remove();f.link.remove();
    delete window.__atlasCanonicalScene;return !document.getElementById('atlas-canonical-scene-probe');
  });
  assert(cleanup);assert.deepEqual(errors,[]);const after=await hashes();assert.deepEqual(after,before);
  await native.close();await native.finish({complete:true,scope:'Canonical preload data in shared GPU scene; not complete Atlas product acceptance.',fixture,setup,occlusion,cameraChecks,floors,lifecycle,hashes:{before,after},consoleErrors:errors,cleanup});
  console.log(JSON.stringify({complete:true,output,cameraChecks:cameraChecks.length,floors:floors.length}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
