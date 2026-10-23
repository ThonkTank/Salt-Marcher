import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {createAtlasMapLibreCanonicalFixture} from './atlas-maplibre-canonical-fixture.mjs';

const root=process.cwd(),output=path.resolve('.build/atlas-maplibre-scene-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-maplibre-scene'});
const files=['src/app/atlas-maplibre-scene.ts','src/app/atlas-maplibre-scene-model.ts',
  'src/app/atlas-maplibre-picking.ts',
  'src/app/atlas-maplibre-camera.ts','src/app/atlas-maplibre-ray.ts','src/app/atlas-maplibre-matrices.ts',
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
      const data={view,projection,model};window.__atlasCanonicalScene.latestData=data;return data;
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
      const object=hit&&!hit.point?f.data.model.objects.find(object=>object.id===hit.id):null;
      const rayDebug=object?{object:{...object,positions:Array.from(object.positions),indices:Array.from(object.indices)},
        frame:f.bridge.frame,viewport:{x:viewport.x,y:viewport.y,width:viewport.width,height:viewport.height},
        pixel:{x:screen[0],y:screen[1]},root:f.root,sceneOrigin:f.sceneOrigin,
        verticalOriginM:f.data.model.verticalOriginM,verticalExaggeration:f.data.model.verticalExaggeration}:null;
      return {rotation,tilt,alignment,screen,hit,rayDebug};
    },{rotation,tilt});
    if(check.rayDebug)await writeFile(path.join(output,'ray-miss.json'),JSON.stringify(check.rayDebug,null,2));
    assert(check.alignment.every(p=>p.errorPx<.01),'MapLibre and scene diverge away from Y=0');
    assert.equal(check.hit?.target.kind,'building',JSON.stringify({...check,rayDebug:check.rayDebug?'saved in ray-miss.json':null}));
    assert.equal(check.hit.target.id,fixture.buildingId);
    assert(check.hit.point&&Math.abs(check.hit.point.heightM-fixture.expected.roofTopM)<.0001,JSON.stringify({...check,rayDebug:check.rayDebug?'saved in ray-miss.json':null}));
    assert(Math.hypot(check.hit.point.x-fixture.buildingAnchor.x,check.hit.point.y-fixture.buildingAnchor.y)<.0001,JSON.stringify({...check,rayDebug:undefined}));
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
  const scales=await page.evaluate(async()=>{
    const f=window.__atlasCanonicalScene,inside=f.latestData,results=[];
    const room=inside.model.objects.find(o=>o.target.kind==='room'&&o.target.scopeId===f.fixture.scopeId);
    const p=room.positions,i=room.indices,local=[0,1,2].map(axis=>(p[i[0]*3+axis]+p[i[1]*3+axis]+p[i[2]*3+axis])/3);
    const focus={x:f.sceneOrigin.x+local[0]*f.root.size,y:f.sceneOrigin.y+local[1]*f.root.size};
    const focusHeightM=f.fixture.expected.floorHeightsM[1];
    // Counterexample: explicit height alone is not retained by MapLibre's DEM
    // clamp when terrain is rendered in Deck rather than a MapLibre DEM source.
    f.map.setCenterClampedToGround(true);
    f.map.jumpTo(f.runtime.metricMapCamera(f.root,{focus,focusHeightM,metersPerPixel:20/900,rotation:37,tilt:55}));
    await f.render();await f.render();
    const clampedHeight=f.map.getCenterElevation();
    for(const [name,span] of [['world',40_000_000],['continent',16_000_000],['kingdom',4_000_000],['city',3000],['interior',20]]){
      const model=name==='interior'?inside.model:f.data.model;
      f.scene.update(model);
      f.runtime.applyAtlasMapLibreCamera(f.map,f.root,{focus,focusHeightM,metersPerPixel:span/900,rotation:37,tilt:55});
      await f.render();const viewport=f.bridge.overlay._deck.getViewports()[0];
      const alignment=[{x:8,y:13},{x:50,y:47},focus].map(point=>{
        const a=f.map.project(f.runtime.metricLngLat(f.root,point)),b=viewport.project([
          (point.x-f.sceneOrigin.x)/f.root.size,(point.y-f.sceneOrigin.y)/f.root.size,focusHeightM/f.root.size]);
        return Math.hypot(a.x-b[0],a.y-b[1]);
      });
      const target=name==='interior'?local:[(f.fixture.buildingAnchor.x-f.sceneOrigin.x)/f.root.size,(f.fixture.buildingAnchor.y-f.sceneOrigin.y)/f.root.size,f.fixture.expected.roofTopM/f.root.size];
      const screen=viewport.project(target),hit=f.scene.pick(screen[0],screen[1]);
      results.push({name,span,pose:f.runtime.readAtlasMapLibreCamera(f.map,f.root),alignment,hit,
        sharedBuffers:model.objects.every((object,index)=>f.bridge.overlay._deck.props.layers[index].props.mesh.attributes.POSITION.value===object.positions)});
    }
    const exaggerations=[];
    for(const exaggeration of [.25,1,8]){
      const terrain={...inside.projection.grid,view:{...inside.projection.grid.view,exaggeration}};
      const model=f.runtime.buildAtlasMapLibreSceneModel({view:inside.view,terrain,root:f.root,sceneOrigin:f.sceneOrigin,
        display:{metersPerPixel:.5,roofs:false,scopeId:f.fixture.scopeId}});
      f.scene.update(model);
      f.runtime.applyAtlasMapLibreCamera(f.map,f.root,{focus,focusHeightM,metersPerPixel:20/900,rotation:37,tilt:55},exaggeration);
      await f.render();const screen=f.bridge.overlay._deck.getViewports()[0].project([local[0],local[1],local[2]*exaggeration]);
      exaggerations.push({exaggeration,elevation:f.map.getCenterElevation(),pose:f.runtime.readAtlasMapLibreCamera(f.map,f.root,exaggeration),hit:f.scene.pick(screen[0],screen[1])});
    }
    f.scene.update(inside.model);
    f.runtime.applyAtlasMapLibreCamera(f.map,f.root,{focus,focusHeightM,metersPerPixel:20/900,rotation:-143,tilt:75});
    await f.render();const screen=f.bridge.overlay._deck.getViewports()[0].project(local);
    return {clampedHeight,results,exaggerations,focus,roomTarget:room.target,closeTiltHit:f.scene.pick(screen[0],screen[1]),focusHeightM};
  });
  assert.equal(scales.clampedHeight,0,'Negative control must reproduce the absent-DEM height reset');
  for(const scale of scales.results){
    assert.equal(scale.pose.focusHeightM,145);assert(scale.alignment.every(error=>error<.01),JSON.stringify(scale));
    assert(scale.sharedBuffers,'Camera-only scale changes must retain scene buffers');
    if(scale.name==='city')assert.equal(scale.hit?.target.id,fixture.buildingId,JSON.stringify(scale));
    if(scale.name==='interior')assert.equal(scale.hit?.target.id,scales.roomTarget.id,JSON.stringify(scale));
  }
  assert.equal(scales.closeTiltHit?.target.id,scales.roomTarget.id,JSON.stringify(scales));
  for(const row of scales.exaggerations){
    assert.equal(row.pose.focusHeightM,145);assert.equal(row.elevation,145*row.exaggeration);
    assert.equal(row.hit?.target.id,scales.roomTarget.id,JSON.stringify(row));
    assert(Math.abs(row.hit?.point?.heightM-145)<.0001,JSON.stringify(row));
    assert(Math.hypot(row.hit.point.x-scales.focus.x,row.hit.point.y-scales.focus.y)<.0001,JSON.stringify(row));
  }
  assert(Math.abs(scales.closeTiltHit?.point?.heightM-145)<.0001,JSON.stringify(scales.closeTiltHit));
  assert(Math.hypot(scales.closeTiltHit.point.x-scales.focus.x,scales.closeTiltHit.point.y-scales.focus.y)<.0001,JSON.stringify(scales.closeTiltHit));
  await native.capture(page,'canonical-elevated-interior.png');
  const canvasBox=await page.locator('#atlas-canonical-scene-probe canvas').boundingBox();
  await page.mouse.move(canvasBox.x+canvasBox.width/2,canvasBox.y+canvasBox.height/2);
  await page.mouse.down();await page.mouse.move(canvasBox.x+canvasBox.width/2+16,canvasBox.y+canvasBox.height/2+8,{steps:4});await page.mouse.up();
  const beforeWheel=await page.evaluate(()=>window.__atlasCanonicalScene.map.getZoom());
  await page.mouse.wheel(0,-120);
  await page.waitForFunction(zoom=>{
    const map=window.__atlasCanonicalScene.map;
    return map.getZoom()>zoom+.01&&!map.isZooming()&&!map.isMoving();
  },beforeWheel,{timeout:10000});
  const elevatedInput=await page.evaluate(async()=>{
    const f=window.__atlasCanonicalScene;await f.render();await f.render();
    return {pose:f.runtime.readAtlasMapLibreCamera(f.map,f.root),clamped:f.map.getCenterClampedToGround()};
  });
  assert.equal(elevatedInput.pose.focusHeightM,145);assert.equal(elevatedInput.clamped,false);
  assert(elevatedInput.pose.metersPerPixel<20/900,'Trusted wheel input must change scale');
  const lifecycle=await page.evaluate(async()=>{
    const f=window.__atlasCanonicalScene;
    f.map.jumpTo({bearing:f.map.getBearing()+1});
    const afterMove=f.scene.pick(450,325),moveUsable=f.bridge.frameUsable;
    await f.render();
    f.container.style.width='800px';f.container.style.height='580px';f.map.resize();
    const afterResize=f.scene.pick(400,290),resizeUsable=f.bridge.frameUsable;
    await f.render();
    const styleReady=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Style reload timed out')),10000);
      f.map.once('style.load',()=>{clearTimeout(timer);resolve();});
    });
    f.map.setStyle({version:8,projection:{type:'atlas:canonical-scene'},sources:{},layers:[{id:'base-reloaded',type:'background',paint:{'background-color':'#d8e0de'}}]},{diff:false});
    const afterStyle=f.scene.pick(400,290),styleUsable=f.bridge.frameUsable;
    await styleReady;
    await f.bridge.waitForStyleReconciliation();await f.render();
    const data=await f.load(f.fixture.scopeId,f.fixture.upperFloorId,false);
    const room=data.model.objects.find(o=>o.target.kind==='room'&&o.target.scopeId===f.fixture.scopeId);
    const p=room.positions,i=room.indices,local=[0,1,2].map(axis=>(p[i[0]*3+axis]+p[i[1]*3+axis]+p[i[2]*3+axis])/3);
    const viewport=f.bridge.overlay._deck.getViewports()[0],screen=viewport.project(local),hit=f.scene.pick(screen[0],screen[1]);
    const picker=f.bridge.overlay._deck.deckPicker;
    return {freshness:{afterMove,moveUsable,afterResize,resizeUsable,afterStyle,styleUsable,recovered:f.bridge.frameUsable},width:viewport.width,height:viewport.height,hit,expected:room.target,focusHeightM:f.runtime.readAtlasMapLibreCamera(f.map,f.root).focusHeightM,
      pickingDepth:picker.pickingFBO.depthStencilAttachment.texture.format,
      heightDepth:picker.depthFBO.depthStencilAttachment.texture.format,
      pickingSize:[picker.pickingFBO.width,picker.pickingFBO.height],canvasSize:[f.map.getCanvas().width,f.map.getCanvas().height]};
  });
  assert.equal(lifecycle.hit?.target.id,lifecycle.expected.id,JSON.stringify(lifecycle));
  assert.deepEqual(lifecycle.freshness,{afterMove:null,moveUsable:false,afterResize:null,resizeUsable:false,afterStyle:null,styleUsable:false,recovered:true});
  assert.equal(lifecycle.pickingDepth,'depth24plus');assert.equal(lifecycle.heightDepth,'depth24plus');
  assert.equal(lifecycle.focusHeightM,145);
  assert.deepEqual(lifecycle.pickingSize,lifecycle.canvasSize);assert.equal(lifecycle.width,800);assert.equal(lifecycle.height,580);
  const cleanup=await page.evaluate(()=>{
    const f=window.__atlasCanonicalScene;f.scene.dispose();f.bridge.dispose();f.map.remove();f.container.remove();f.link.remove();
    delete window.__atlasCanonicalScene;return !document.getElementById('atlas-canonical-scene-probe');
  });
  assert(cleanup);assert.deepEqual(errors,[]);const after=await hashes();assert.deepEqual(after,before);
  await native.close();await native.finish({complete:true,scope:'Canonical preload data in shared GPU scene; not complete Atlas product acceptance.',fixture,setup,occlusion,cameraChecks,floors,scales,elevatedInput,lifecycle,hashes:{before,after},consoleErrors:errors,cleanup});
  console.log(JSON.stringify({complete:true,output,cameraChecks:cameraChecks.length,floors:floors.length}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
