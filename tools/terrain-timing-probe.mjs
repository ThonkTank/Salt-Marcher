// Timings are clock-local. A revision plus two animation frames measures a
// submitted committed frame with a presentation opportunity, not physical scanout.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
export async function measureTerrainGestures({app,page,campaignId,filename,world,out,require}){
 const db=new (require('better-sqlite3'))(filename,{readonly:true}),state=()=>db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(campaignId);
 const hash=()=>{const digest=createHash('sha256');for(const row of db.prepare("SELECT id,json_extract(payload,'$.height') height FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL ORDER BY id").iterate(campaignId))digest.update(JSON.stringify(row)+'\n');return digest.digest('hex');};
 const {TerrainSampler}=require(process.cwd()+'/.build/terrain-output-native-store.cjs');
 const centerHeight=p=>new TerrainSampler(db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND min_x<=? AND max_x>=? AND min_y<=? AND max_y>=?').all(campaignId,p.x+2048,p.x-2048,p.y+2048,p.y-2048).map(r=>JSON.parse(r.payload)),false).sample(p).heightM;
 const samples=[];
 try{
 await page.locator('#atlas-units').selectOption('metric');
 await page.locator('#atlas-view').click();await page.locator('#atlas-terrain-tilt').click();
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDetail==='detail',null,{timeout:120000});
 // Exclude editor line overlays from the framebuffer measurement. Terrain, roads and
 // houses remain actual GPU draws; a cursor moving on a subpixel height is not relief.
 await page.locator('#atlas-terrain-spatial').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2');for(const name of ['drawArrays','drawElements']){
   const draw=gl[name].bind(gl);gl[name]=function(mode,...args){if(mode===gl.LINES||mode===gl.LINE_LOOP||mode===gl.LINE_STRIP)return;return draw(mode,...args);};
  }
 });
 await page.locator('#atlas-view').click();await page.locator('[data-tool-group="land"]').click();await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
 await page.locator('#land-radius').fill(world?(process.env.TERRAIN_RADIUS_M??'12000'):'48');await page.locator('#land-height-strength').fill(world?'1000':'120');
 for(const temperature of ['cold','warm']){
  await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled&&document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:90000});
  const before=state(),initial=hash(),box=await page.locator('#campaign-map').boundingBox();
  const center=await page.locator('#campaign-map').evaluate(c=>{const v=JSON.parse(c.dataset.terrainProjection).frame;return{x:v.x+v.width/2,y:v.y+v.height/2};}),initialCenterHeight=centerHeight(center);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.evaluate(before=>{
   window.terrainLatency={before:before.revision,start:null,frames:[]};
   window.addEventListener('pointerdown',()=>{window.terrainLatency.start=performance.now();},{once:true,capture:true});
   window.addEventListener('pointerup',()=>{window.terrainLatency.releaseMs=performance.now()-window.terrainLatency.start;},{once:true,capture:true});
   const canvas=document.querySelector('#atlas-terrain-spatial'),gl=canvas.getContext('webgl2');
   const width=canvas.width,height=canvas.height,x=0,y=0;
   const previous=new Uint8Array(width*height*4),pixels=new Uint8Array(previous.length);
   gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,previous);
   if(gl.getError()!==gl.NO_ERROR)throw Error('Initial framebuffer read failed');
   let last=before.revision;
   const frame=()=>{const m=window.terrainLatency;if(m.stop)return;const rev=Number(document.querySelector('#campaign-map').dataset.terrainRevision);
    if(m.start!==null&&rev>last){last=rev;const submitted=performance.now();
     gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let changedPixels=0;
     for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==previous[i]||pixels[i+1]!==previous[i+1]||pixels[i+2]!==previous[i+2])changedPixels++;
     previous.set(pixels);const pixelReadMs=performance.now()-submitted,error=gl.getError();
     if(changedPixels&&!m.firstImage)m.firstImage=canvas.toDataURL('image/png');
     requestAnimationFrame(()=>requestAnimationFrame(()=>m.frames.push({revision:rev,changedPixels,pixelReadMs,error,submittedMs:submitted-m.start,presentedMs:performance.now()-m.start})));}requestAnimationFrame(frame);};requestAnimationFrame(frame);
  },before);
  await page.mouse.down();
  await page.waitForFunction(()=>window.terrainLatency.frames.filter(f=>f.changedPixels>0).length>=1,null,{timeout:90000});
  assert.notEqual(hash(),initial,'the first observed revision must contain a persisted height change');
  const firstCenterHeight=centerHeight(center);assert(firstCenterHeight>initialCenterHeight,'A changed LOD or a hidden coarse edit must not pass as a visible raise at the brush centre');
  await page.waitForFunction(()=>window.terrainLatency.frames.filter(f=>f.changedPixels>0).length>=3,null,{timeout:90000});
  await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled,null,{timeout:90000});await atlasCanvasReady(page);
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:90000});
  const timing=await page.evaluate(()=>{window.terrainLatency.stop=true;return window.terrainLatency;});
  await writeFile(out+'/'+temperature+'-first.png',Buffer.from(timing.firstImage.split(',')[1],'base64'));delete timing.firstImage;
  assert.equal(state().cursor,before.cursor+1);assert.notEqual(hash(),initial);
  const held=timing.frames.filter(f=>f.presentedMs<=timing.releaseMs&&f.changedPixels>0);
  if(process.env.TERRAIN_REQUIRE_VISIBLE_FRAMES==='1')assert(held.length>=3,'At least three confirmed held frames must change terrain RGB pixels with cursor draws excluded');
  const visible=timing.frames.filter(f=>f.changedPixels>0);assert(timing.frames.every(f=>f.error===0),'framebuffer reads must succeed');
  samples.push({temperature,initialCenterHeight,firstCenterHeight,firstSubmittedMs:visible[0]?.submittedMs??null,firstPresentedMs:visible[0]?.presentedMs??null,firstCommittedFrameMs:timing.frames[0].presentedMs,releaseMs:timing.releaseMs,frames:timing.frames,sustainedIntervalsMs:timing.frames.slice(1,3).map((f,i)=>f.presentedMs-timing.frames[i].presentedMs),visibleHeldFrames:held.length,visibleHeldIntervalsMs:held.slice(1).map((f,i)=>f.presentedMs-held[i].presentedMs),committedIncrements:state().revision-before.revision,memory:await app.evaluate(({app})=>app.getAppMetrics())});
  const beforeUndo=state().revision;await page.locator('#atlas-undo').click();await atlasCanvasReady(page);
  await page.waitForFunction(revision=>Number(document.querySelector('#campaign-map').dataset.terrainRevision)>revision&&document.querySelector('#campaign-map').dataset.terrainReady==='ready',beforeUndo,{timeout:90000});
  assert.equal(hash(),initial,'paired cold/warm gestures start from identical height bytes');
 }
 return{method:'editor cursor/selection line draws excluded; pointerdown -> confirmed GPU revision with changed RGB pixels in the complete terrain framebuffer -> two requestAnimationFrame callbacks; no physical scanout measurement',coldMeaning:'first authored gesture in a fresh application/profile, after initial scene load',warmMeaning:'same brush, camera and height bytes after Undo in the same process',samples};
 }finally{db.close();}
}
