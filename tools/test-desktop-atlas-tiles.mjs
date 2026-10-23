import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {createAtlasCanonicalFixture} from './atlas-canonical-fixture.mjs';
const root=process.cwd(),output=path.resolve('.build/atlas-tile-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-tiles'});
const files=['src/app/atlas-terrain-tile.ts','src/app/atlas-tile-plan.ts','src/app/atlas-tile-stream.ts',
  'src/app/storage/atlas-terrain-tiles.ts','src/app/storage/atlas-tile-cache.ts','desktop/atlas-region-worker.ts','desktop/atlas-region.ts',
  'desktop/main.ts','desktop/preload.ts','tools/test-desktop-atlas-tiles.mjs','.build/desktop/ui/atlas-deck-runtime.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
try{
  const fixture=await createAtlasCanonicalFixture({profilePath:native.profile,campaignName:'Persistent tile qualification'}),before=await hashes();
  const page=await native.launch(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cold=await page.evaluate(async fixture=>{
    const unwrap=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value;},active=unwrap(await window.campaign.activate(fixture.campaignId));
    const runtime=await import('campaign://app/atlas-deck-runtime.js');
    const view=unwrap(await window.campaign.atlasRegion(active.token,{...fixture.query,width:800,height:600}));
    const stream=new runtime.AtlasTileStream(),frames=[],reads=[],container=document.createElement('div');
    Object.assign(container.style,{position:'fixed',left:'20px',top:'60px',width:'800px',height:'600px',background:'#d8e0de',zIndex:'99999'});document.body.append(container);
    const camera={focus:{x:32,y:32},focusHeightM:65,metersPerPixel:.35,rotation:25,tilt:45,exaggeration:1};
    let surface,release;const hold=new Promise(resolve=>release=resolve);window.__tiles={release,stream,frames,reads,container,active,fixture,runtime,view};
    const model=tiles=>{
      const models=tiles.map(t=>runtime.buildAtlasDeckSceneModel({view,terrain:t.projection.grid}));
      const objects=models.flatMap((m,i)=>m.objects.filter(o=>o.target.kind==='terrain').map(o=>({...o,id:'terrain:'+JSON.stringify(tiles[i].tile)})));
      return {...models[0],objects,targets:new Map(objects.map(o=>[o.id,o.target]))};
    };
    // Publish is synchronous; serialize asynchronous GPU frame preparation in
    // the probe so captures refer to the exact delivered tile set.
    let draw=Promise.resolve();
    const ready=stream.load({box:fixture.viewBox,metersPerPixel:.25,revision:view.revision,source:view.region.fence},async request=>{
      if(request.tile.lod<0)await hold;
      const start=performance.now(),value=unwrap(await window.campaign.atlasTerrainTile(active.token,request));
      reads.push({tile:value.tile,cache:value.cache,ms:performance.now()-start});return value;
    },frame=>{
      frames.push({tiles:frame.tiles.map(t=>t.tile),complete:frame.complete});
      if(!frame.tiles.length)return;
      draw=draw.then(async()=>{
        if(!surface){surface=await runtime.AtlasDeckSurface.create({container,camera,model:model(frame.tiles)});window.__tiles.surface=surface;}
        else{surface.setScene(model(frame.tiles));await surface.waitForFrame();}
        window.__tiles.visible=frame.tiles;window.__tiles.complete=frame.complete;
      });
    });
    window.__tiles.ready=ready.then(()=>draw);
    return {revision:view.revision,fence:view.region.fence};
  },fixture);
  await page.waitForFunction(()=>window.__tiles?.visible?.length>0);
  const overview=await page.evaluate(()=>({frames:window.__tiles.frames,reads:window.__tiles.reads,canvases:window.__tiles.container.querySelectorAll('canvas').length}));
  assert(overview.reads.every(r=>r.tile.lod===0));assert.equal(overview.canvases,1);
  await native.capture(page,'overview.png');
  const detail=await page.evaluate(async()=>{
    const f=window.__tiles;f.release();await f.ready;
    const t=f.visible[0],g=t.projection.grid,b=g.view.box,p={x:48,y:48};
    const x=Math.round((p.x-b.x)/b.width*(g.view.columns-1)),y=Math.round((p.y-b.y)/b.height*(g.view.rows-1));
    const expected={...p,heightM:g.heights[y*g.view.columns+x]},screen=f.surface.frame.project(expected),hit=f.surface.pick(screen.x,screen.y);
    return {frames:f.frames,reads:f.reads,complete:f.complete,expected,hit,revision:t.revision,pixels:t.projection.pixels.length,forest:t.projection.forest.length};
  });
  assert.equal(detail.complete,true);assert.equal(detail.reads.at(-1).tile.lod,-2);assert.equal(detail.hit?.target.kind,'terrain');
  assert(Math.abs(detail.hit.point.heightM-detail.expected.heightM)<.001);assert.equal(detail.pixels,256*256*4);assert.equal(detail.forest,256*256);
  await native.capture(page,'detail.png');await native.close();
  const fresh=await native.launch();
  const reopened=await fresh.evaluate(async fixture=>{
    const unwrap=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value;},active=unwrap(await window.campaign.activate(fixture.campaignId));
    const {revision}=unwrap(await window.campaign.atlasTerrainSource(active.token)),rows=[];
    for(const lod of [0,-2]){const start=performance.now(),value=unwrap(await window.campaign.atlasTerrainTile(active.token,{tile:{lod,x:0,y:0},revision}));
      rows.push({tile:value.tile,cache:value.cache,ms:performance.now()-start,maxHeight:Math.max(...value.projection.grid.heights),revision:value.revision});}
    return rows;
  },fixture);
  assert(reopened.every(r=>r.cache==='hit'&&r.revision===cold.revision));assert.equal(reopened.at(-1).maxHeight,140);
  await native.close();const after=await hashes();assert.deepEqual(after,before);assert.deepEqual(errors,[]);
  await native.finish({complete:true,scope:'Isolated terrain tile overview/detail and warm fresh-process reuse; not full M2 geometry or whole Atlas performance acceptance.',fixture,cold,overview,detail,reopened,errors,hashes:{before,after}});
  console.log(JSON.stringify({complete:true,output}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
