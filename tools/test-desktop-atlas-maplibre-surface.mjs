import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createNativeSession} from './native-session.mjs';
import {createAtlasMapLibreCanonicalFixture} from './atlas-maplibre-canonical-fixture.mjs';

const root=process.cwd(),output=path.resolve('.build/atlas-maplibre-surface-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-maplibre-surface'});
const files=['src/app/atlas-maplibre-surface.ts','src/app/atlas-maplibre-runtime.ts',
  'src/app/atlas-maplibre-bridge.ts','src/app/atlas-maplibre-scene.ts','src/app/atlas-maplibre-scene-model.ts',
  'src/app/atlas-maplibre-camera.ts','src/app/atlas-metric-space.ts','src/app/atlas-maplibre-projection.ts',
  'src/app/atlas-maplibre-assets.ts','src/app/atlas-metric-query.ts',
  'tools/atlas-maplibre-canonical-fixture.mjs','tools/test-desktop-atlas-maplibre-surface.mjs',
  '.build/desktop/ui/atlas-maplibre-runtime.js','.build/desktop/ui/atlas-maplibre-worker.mjs',
  '.build/desktop/ui/atlas-maplibre-projection-worker.mjs','.build/desktop/ui/atlas-maplibre.css',
  '.build/desktop/ui/atlas-maplibre-fonts/NotoSans-VF.ttf','.build/desktop/ui/atlas-maplibre-fonts/NotoSansSymbols-VF.ttf',
  'resources/atlas-maplibre-fonts/NotoSans-VF.ttf','resources/atlas-maplibre-fonts/NotoSansSymbols-VF.ttf','package-lock.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
try{
  const fixture=await createAtlasMapLibreCanonicalFixture({profilePath:native.profile}),before=await hashes();
  await writeFile(path.join(output,'inputs.json'),JSON.stringify({fixture,hashes:before},null,2));
  const page=await native.launch(),errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const setup=await page.evaluate(async fixture=>{
    const unwrap=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result.value;};
    const active=unwrap(await window.campaign.activate(fixture.campaignId));
    const runtime=await import('campaign://app/atlas-maplibre-runtime.js');await runtime.initializeAtlasMapLibre();
    const link=document.createElement('link');link.rel='stylesheet';link.href='campaign://app/atlas-maplibre.css';
    await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(Error('Atlas CSS unavailable'));document.head.append(link);});
    const container=document.createElement('div');container.id='atlas-surface-probe';
    Object.assign(container.style,{position:'fixed',left:'20px',top:'60px',width:'900px',height:'650px',zIndex:'99999'});document.body.append(container);
    const view=unwrap(await window.campaign.atlasRegion(active.token,{...fixture.query,width:900,height:650,scopeId:null,floorId:'ground',roofs:true},'view'));
    const projection=unwrap(await window.campaign.atlasTerrainProjection(active.token,{revision:view.revision,fence:view.region.fence,
      view:{box:fixture.viewBox,frame:fixture.viewBox,columns:65,rows:65,focusM:140,tilt:0,rotation:0,exaggeration:1},
      width:64,height:64,contours:0,displayMpp:1,objects:[]},'view'));
    if(projection.fence!==view.region.fence||projection.revision!==view.revision)throw Error('Canonical sources disagree');
    const baseRoot={x:-33554432,y:-33554432,size:67108864},sceneOrigin={x:16,y:12};
    // The source marker is a derived representation of the saved building's anchor.
    const marker={...fixture.buildingAnchor};
    const f={runtime,fixture,container,link,baseRoot,sceneOrigin,marker,snapshot:{view,terrain:projection.grid},
      preparations:[],ownedErrors:[],mode:'normal',gate:null,release:null,removed:[],removedPoses:[],maps:[]};
    const prepare=async(snapshot,root,origin,signal)=>{
      f.preparations.push({root:{...root},revision:snapshot.view.revision});
      if(f.mode==='deferred')await f.gate;
      if(f.mode==='failure')throw Error('Injected preparation failure');
      const maxzoom=22+Math.log2(root.size/baseRoot.size);
      if(maxzoom>24)throw Error('GeoJSON source resolution budget exhausted');
      const coordinates=runtime.metricLngLat(root,marker);
      const model=runtime.buildAtlasMapLibreSceneModel({view:snapshot.view,terrain:snapshot.terrain,root,sceneOrigin:origin,
        display:{metersPerPixel:.5,roofs:true,scopeId:null}});
      return {model,style:{version:8,...runtime.atlasMapLibreFontStyle('campaign://app/'),sources:{anchor:{type:'geojson',maxzoom,
        data:{type:'FeatureCollection',features:[{type:'Feature',id:fixture.buildingId,properties:{id:fixture.buildingId},geometry:{type:'Point',coordinates}}]}}},
        layers:[{id:'base',type:'background',paint:{'background-color':'#d8e0de'}},
          {id:'anchor',source:'anchor',type:'circle',paint:{'circle-color':'#c92324','circle-radius':8}}]}};
    };
    f.surface=await runtime.AtlasMapLibreSurface.create({container,root:baseRoot,sceneOrigin,
      pose:{focus:fixture.buildingAnchor,focusHeightM:145,metersPerPixel:.5,rotation:37,tilt:55},
      snapshot:()=>f.snapshot,prepare,timeoutMs:5000,
      sourceResolution:{sourceIds:['anchor'],baseRootSize:baseRoot.size,baseMaxZoom:22},
      onError:error=>f.ownedErrors.push(String(error)),
      createMap:options=>{
        const map=new runtime.maplibre.Map(options),domain=f.preparations.at(-1).root,remove=map.remove.bind(map);
        f.maps.push(map);map.on('remove',()=>f.removed.push(f.maps.indexOf(map)));
        map.remove=()=>{f.removedPoses.push(runtime.readAtlasMapLibreCamera(map,domain));return remove();};return map;
      }});
    f.render=async()=>{
      const map=f.surface.current.map;
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Frame timeout')),5000);
        map.once('render',()=>{clearTimeout(timer);requestAnimationFrame(()=>requestAnimationFrame(resolve));});map.triggerRepaint();});
    };
    f.measure=()=>{
      const s=f.surface.current,v=s.bridge.overlay._deck.getViewports()[0];
      const screen=v.project([(fixture.buildingAnchor.x-s.sceneOrigin.x)/s.root.size,
        (fixture.buildingAnchor.y-s.sceneOrigin.y)/s.root.size,fixture.expected.roofTopM/s.root.size]);
      const ground=v.project([(marker.x-s.sceneOrigin.x)/s.root.size,(marker.y-s.sceneOrigin.y)/s.root.size,0]);
      const features=runtime.queryRenderedFeaturesMetricSafe(s.map,[ground[0],ground[1]],{layers:['anchor']},runtime.maplibre.getVersion()).features;
      const mapPoint=s.map.project(runtime.metricLngLat(s.root,marker));
      const ids=features=>features.map(feature=>feature.properties.id);
      const diagnostics={mapPoint,
        atMapPoint:ids(runtime.queryRenderedFeaturesMetricSafe(s.map,[mapPoint.x,mapPoint.y],{layers:['anchor']},runtime.maplibre.getVersion()).features),
        rawAtGround:ids(s.map.queryRenderedFeatures([ground[0],ground[1]],{layers:['anchor']})),
        rawAtMapPoint:ids(s.map.queryRenderedFeatures([mapPoint.x,mapPoint.y],{layers:['anchor']})),
        offsetMiss:ids(runtime.queryRenderedFeaturesMetricSafe(s.map,[ground[0]+30,ground[1]],{layers:['anchor']},runtime.maplibre.getVersion()).features),
        loaded:s.map.isSourceLoaded('anchor')};
      return {root:s.root,pose:runtime.readAtlasMapLibreCamera(s.map,s.root,s.model.verticalExaggeration),screen,ground,
        diagnostics,
        hit:s.scene.pick(screen[0],screen[1]),sourceIds:features.map(feature=>feature.properties.id),
        source:s.map.getStyle().sources.anchor,frameUsable:s.bridge.frameUsable,
        viewport:[v.width,v.height],canvases:container.querySelectorAll('canvas').length};
    };
    window.__atlasSurface=f;await f.render();return f.measure();
  },fixture);
  await writeFile(path.join(output,'setup.json'),JSON.stringify(setup,null,2));
  // Expose only the ground marker to compare query coordinates against actual
  // native pixels. Restoring Deck preserves the ordinary depth/selection test.
  await page.evaluate(async()=>{const f=window.__atlasSurface;f.surface.current.scene.update({...f.surface.current.model,objects:[]});await f.render();});
  await native.capture(page,'source-only.png');
  const sourceImage=PNG.sync.read(await readFile(path.join(output,'source-only.png')));
  const sourceBox=await page.locator('#atlas-surface-probe').boundingBox();
  const cssSize=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const sx=sourceImage.width/cssSize.width,sy=sourceImage.height/cssSize.height;
  let count=0,sumX=0,sumY=0;
  for(let y=Math.ceil(sourceBox.y*sy);y<(sourceBox.y+sourceBox.height)*sy;y++)
    for(let x=Math.ceil(sourceBox.x*sx);x<(sourceBox.x+sourceBox.width)*sx;x++){
      const i=(y*sourceImage.width+x)*4;
      if(sourceImage.data[i]>150&&sourceImage.data[i+1]<80&&sourceImage.data[i+2]<80){count++;sumX+=x;sumY+=y;}
    }
  const sourcePixels={count,centroid:[sumX/count/sx-sourceBox.x,sumY/count/sy-sourceBox.y]};
  assert(count>10,'Expected visible native ground marker pixels');
  assert(Math.hypot(sourcePixels.centroid[0]-setup.ground[0],sourcePixels.centroid[1]-setup.ground[1])<2,JSON.stringify(sourcePixels));
  await page.evaluate(async()=>{const f=window.__atlasSurface;f.surface.current.scene.update(f.surface.current.model);await f.render();});
  assert.equal(setup.pose.focusHeightM,145);assert(Math.abs(setup.pose.tilt-55)<1e-8);
  assert.equal(setup.hit?.target.id,fixture.buildingId,JSON.stringify(setup));
  assert(setup.sourceIds.includes(fixture.buildingId),JSON.stringify(setup));
  assert.deepEqual(setup.diagnostics.atMapPoint,[],'The focus plane must not create a false ground-source hit');
  assert.deepEqual(setup.diagnostics.offsetMiss,[]);
  assert.deepEqual(setup.diagnostics.rawAtGround,[],'Reproduce the pinned library ground-query failure');
  assert(setup.diagnostics.rawAtMapPoint.includes(fixture.buildingId),'Reproduce the pinned library focus-plane false hit');
  await page.evaluate(()=>{
    const f=window.__atlasSurface;f.old=f.surface.current;f.old.map.getCanvas().focus();
    f.mode='deferred';f.gate=new Promise(resolve=>{f.release=resolve;});
    f.pending=f.surface.expand({x:70_000_000,y:24,width:1,height:1}).then(value=>{
      f.result={value,published:f.measure()};
    }).catch(error=>{f.result={error:String(error)};});
  });
  const box=await page.locator('#atlas-surface-probe canvas').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2+8,{steps:4});
  const held=await page.evaluate(async()=>{
    const f=window.__atlasSurface;await f.render();const measure=f.measure();f.release();return {measure,currentIsOld:f.surface.current===f.old};
  });
  assert(held.currentIsOld);assert(Math.hypot(held.measure.pose.focus.x-setup.pose.focus.x,held.measure.pose.focus.y-setup.pose.focus.y)>.01,'Trusted drag must move the original map during preparation');
  assert.equal(held.measure.hit?.target.id,fixture.buildingId,'The original rendered scene must remain selectable during preparation');
  assert(held.measure.sourceIds.includes(fixture.buildingId));
  await page.waitForFunction(()=>{
    const f=window.__atlasSurface;return f.maps.length===2&&f.maps[1].isStyleLoaded();
  });
  const stillHeld=await page.evaluate(async()=>{
    const f=window.__atlasSurface;
    f.container.style.width='800px';f.container.style.height='580px';f.old.map.resize();
    await new Promise(resolve=>setTimeout(resolve,150));
    return {old:f.surface.current===f.old,published:!!f.result};
  });
  assert.deepEqual(stillHeld,{old:true,published:false},'A pressed pointer must prevent publication');
  await page.mouse.up();
  await page.waitForFunction(()=>!!window.__atlasSurface.result);
  const transition=await page.evaluate(async()=>{
    const f=window.__atlasSurface;await f.pending;await f.render();const after=f.measure(),s=f.surface.current;
    const stale=f.runtime.metricLngLat(f.baseRoot,f.marker),p=s.map.project(stale);
    const actual=s.map.project(f.runtime.metricLngLat(s.root,f.marker));
    const wrongZoom=f.runtime.metricMapCamera(f.baseRoot,after.pose).zoom;
    return {result:f.result,after,removed:[...f.removed],sourcePoseAtRemoval:f.removedPoses[0],focusTransferred:document.activeElement===s.map.getCanvas(),
      negativeControls:{staleCoordinatesDistancePx:Math.hypot(p.x-actual.x,p.y-actual.y),
        unchangedZoomMpp:s.root.size/512/2**wrongZoom},preparations:f.preparations};
  });
  assert.equal(transition.result.value,true,JSON.stringify(transition.result));
  assert.equal(transition.result.published.hit?.target.id,fixture.buildingId,'Selection must be ready at publication without extra probe frames');
  assert(transition.result.published.sourceIds.includes(fixture.buildingId));
  assert(transition.result.published.frameUsable);assert.deepEqual(transition.removed,[0]);assert(transition.focusTransferred);
  assert.equal(transition.after.canvases,1);assert(transition.after.frameUsable);
  assert.deepEqual(transition.after.viewport,[800,580]);
  assert.equal(transition.after.root.size,setup.root.size*2);
  for(const key of ['focusHeightM','metersPerPixel','rotation','tilt'])assert(Math.abs(transition.after.pose[key]-transition.sourcePoseAtRemoval[key])<1e-7,`${key} changed`);
  assert(Math.hypot(transition.after.pose.focus.x-transition.sourcePoseAtRemoval.focus.x,transition.after.pose.focus.y-transition.sourcePoseAtRemoval.focus.y)<1e-5);
  assert.equal(transition.after.hit?.target.id,fixture.buildingId,JSON.stringify(transition));
  assert(Math.abs(transition.after.hit.point.heightM-fixture.expected.roofTopM)<.0001);
  assert(transition.after.sourceIds.includes(fixture.buildingId));
  assert.notDeepEqual(transition.after.source.data.features[0].geometry.coordinates,setup.source.data.features[0].geometry.coordinates);
  assert.equal(transition.after.source.maxzoom,setup.source.maxzoom+1);
  assert(transition.negativeControls.staleCoordinatesDistancePx>1000);
  assert.equal(transition.negativeControls.unchangedZoomMpp,setup.pose.metersPerPixel*2);
  await native.capture(page,'expanded-canonical-surface.png');
  const rollback=await page.evaluate(async()=>{
    const f=window.__atlasSurface;f.mode='failure';const previous=f.surface.current;let message;
    try{await f.surface.expand({x:140_000_000,y:24,width:1,height:1});}catch(error){message=String(error);}
    await f.render();const after=f.measure();f.mode='normal';
    return {message,same:f.surface.current===previous,after};
  });
  assert.match(rollback.message,/Injected preparation failure/);assert(rollback.same);
  assert.equal(rollback.after.canvases,1);assert.equal(rollback.after.hit?.target.id,fixture.buildingId);
  const stale=await page.evaluate(async()=>{
    const f=window.__atlasSurface,previous=f.surface.current;f.mode='deferred';f.gate=new Promise(resolve=>{f.release=resolve;});
    const pending=f.surface.expand({x:140_000_000,y:24,width:1,height:1});
    f.snapshot={...f.snapshot};f.release();let result;
    try{result={value:await pending};}catch(error){result={error:String(error)};}
    await f.render();f.mode='normal';return {result,same:f.surface.current===previous,after:f.measure()};
  });
  assert(stale.same);assert.notEqual(stale.result.value,true);assert.equal(stale.after.canvases,1);
  assert.equal(stale.after.hit?.target.id,fixture.buildingId);
  const outside=await page.evaluate(async()=>{
    const f=window.__atlasSurface,s=f.surface.current,pose=f.runtime.readAtlasMapLibreCamera(s.map,s.root);
    f.runtime.applyAtlasMapLibreCamera(s.map,s.root,{...pose,focus:{x:70_000_000,y:24}});await f.render();
    const expandedPose=f.runtime.readAtlasMapLibreCamera(s.map,s.root);
    f.runtime.applyAtlasMapLibreCamera(s.map,s.root,pose);await f.render();
    return {expandedPose,restored:f.measure()};
  });
  assert(Math.abs(outside.expandedPose.focus.x-70_000_000)<1e-6);
  assert.equal(outside.restored.hit?.target.id,fixture.buildingId);
  const cleanup=await page.evaluate(async()=>{
    const f=window.__atlasSurface;f.mode='deferred';f.gate=new Promise(resolve=>{f.release=resolve;});
    const pending=f.surface.expand({x:140_000_000,y:24,width:1,height:1});
    f.surface.dispose();f.surface.dispose();f.release();let result;
    try{result={value:await pending};}catch(error){result={error:String(error)};}
    const canvases=f.container.querySelectorAll('canvas').length;
    f.container.remove();f.link.remove();return {canvases,result,removed:f.removed,ownedErrors:f.ownedErrors};
  });
  assert.equal(cleanup.canvases,0);assert.deepEqual(cleanup.removed,[0,1]);assert.notEqual(cleanup.result.value,true);
  assert.deepEqual(errors,[]);const after=await hashes();assert.deepEqual(after,before);
  await native.close();await native.finish({complete:true,scope:'Native replacement-root ownership and source/scene rebinding, not regular Atlas authoring or product acceptance.',
    fixture,setup,sourcePixels,held,stillHeld,transition,rollback,stale,outside,cleanup,hashes:{before,after},consoleErrors:errors});
  console.log(JSON.stringify({complete:true,output}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
