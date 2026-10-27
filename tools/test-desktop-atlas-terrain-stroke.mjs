import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';

const root = process.cwd();
const output = path.resolve('.build/atlas-terrain-stroke', `${Date.now()}-${process.pid}`);
await mkdir(output, { recursive: true });
const native = await createNativeSession({ root, output, name: 'atlas-terrain-stroke' });
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const PNG = require('pngjs').PNG;
let page;
let fixture;
let phase = 'fixture setup';
const consoleEvents = [];
const evidence = { output, phases: [], gestures: {}, consoleEvents, runtime: null };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['./tools/test-desktop-atlas-terrain-stroke.mjs','./tools/atlas-canonical-fixture.mjs','./tools/native-session.mjs','./tools/atlas-brush-probe.mjs'];
const persist = async () => writeFile(path.join(output, 'evidence.partial.json'), JSON.stringify(evidence, null, 2));
const phaseMark = (name) => { phase = name; evidence.phases.push({ name, at: new Date().toISOString(), launch: native.launches.length }); native.mark(name); };
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async (f) => [f, sha(await readFile(f))])));
const revision = () => { const db = new Database(path.join(native.profile, 'workbench.sqlite'), {readonly:true}); try { return db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(fixture.campaignId).revision; } finally { db.close(); } };
const heights = () => { const db = new Database(path.join(native.profile, 'workbench.sqlite'), {readonly:true}); try { return db.prepare("SELECT id,payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL ORDER BY id").all(fixture.campaignId).map(({id,payload}) => {const h=JSON.parse(payload).height; return {id,version:h.version,x:h.x,y:h.y,pixel:h.pixel,data:h.data};}); } finally { db.close(); } };
async function sample(x,y) {
  return page.evaluate(({x,y}) => {
    const canvas = document.querySelector('#atlas-terrain-spatial canvas');
    const gl = canvas?.getContext('webgl2'); if (!gl) throw Error('Terrain WebGL2 canvas unavailable');
    const rect = canvas.getBoundingClientRect(), size=128;
    const cx=Math.round((x-rect.left)/rect.width*gl.drawingBufferWidth), cy=Math.round((1-(y-rect.top)/rect.height)*gl.drawingBufferHeight);
    const left=Math.max(0,Math.min(gl.drawingBufferWidth-size,cx-size/2)), bottom=Math.max(0,Math.min(gl.drawingBufferHeight-size,cy-size/2));
    const bytes=new Uint8Array(size*size*4), old=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null); gl.readPixels(left,bottom,size,size,gl.RGBA,gl.UNSIGNED_BYTE,bytes); gl.bindFramebuffer(gl.READ_FRAMEBUFFER,old);
    return {bytes:Array.from(bytes), sampledAt:performance.now(), patch:{left,bottom,size}, buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight], rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}, cursor: {x:window.__terrainPointer?.x??null,y:window.__terrainPointer?.y??null}};
  },{x,y});
}
function pixelDelta(a,b) { let count=0; for(let i=0;i<a.length;i+=4) if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12) count++; return count; }
async function savePatch(name, bytes) { const png=new PNG({width:128,height:128}); for(let y=0;y<128;y++) for(let x=0;x<128;x++){const from=((127-y)*128+x)*4,to=(y*128+x)*4; for(let c=0;c<4;c++) png.data[to+c]=bytes[from+c];} const out=PNG.sync.write(png); await writeFile(path.join(output,name),out); return {file:name,sha256:sha(out)}; }
async function open() {
  page=await native.launch();
  page.on('console',m=>{if(m.type()==='error'){const event={launch:native.launches.length,phase,at:new Date().toISOString(),text:m.text()};consoleEvents.push(event);native.errors.push(m.text());void persist();console.log('renderer-console-error',JSON.stringify(event));}});
  await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
  await page.evaluate(id=>{sessionStorage.setItem('atlas-raster-workbench','true');localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:0,y:0,width:64,height:64}));},fixture.campaignId);
  await page.reload(); await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  await page.locator('.campaign-card').filter({hasText:'Terrain Stroke'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
  await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  if(await page.locator('#campaign-atlas').isHidden()){if(!(await page.locator('#atlas-tab').isVisible())) await page.locator('#workspace-nav-summary').click(); await page.locator('#atlas-tab').click();}
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:60000});
  assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'),'deck');
  await page.locator('#atlas-section').selectOption('terrain'); await page.locator('[data-tool-group="land"]').click(); await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await page.locator('#atlas-units').selectOption('metric'); await setBrushWorldRadius(page,'land-radius',8); await setHeightDirection(page,'raise');
  await page.locator('#land-height-strength').fill('1'); await page.locator('#land-height-strength').press('Tab');
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
  evidence.runtime=await page.evaluate(()=>{const c=document.querySelector('#atlas-terrain-spatial canvas'),g=c?.getContext('webgl2'),i=g?.getExtension('WEBGL_debug_renderer_info');return {ua:navigator.userAgent,dpr:devicePixelRatio,content:[innerWidth,innerHeight],canvas:c&&[c.width,c.height],unmaskedVendor:i&&g.getParameter(i.UNMASKED_VENDOR_WEBGL),unmaskedRenderer:i&&g.getParameter(i.UNMASKED_RENDERER_WEBGL),renderer:g&&g.getParameter(g.RENDERER),vendor:g&&g.getParameter(g.VENDOR),context:g?.getContextAttributes(),map:{...document.querySelector('#campaign-map').dataset},platform:{userAgent:navigator.userAgent}};}); await persist();
}
async function gesture(label, coords, box, baseline, durationMs) {
  const point=(u,v)=>({x:box.x+box.width*u,y:box.y+box.height*v});
  const start=point(...coords[0]), end=point(...coords[1]), watch=point(...coords[2]);
  // Keep pointer away from the 128px observation patch during the sampled frames.
  await page.mouse.move(start.x,start.y); const down=Date.now(); await page.mouse.down(); const downMono=await page.evaluate(()=>performance.now());
  const record={downAt:new Date(down).toISOString(),downMono,watchPoint:watch,baseline:baseline.file,baselineSha256:baseline.sha256,firstChanged:null,upAt:null,upMono:null,heldMs:null,maxChangedPixels:0};
  evidence.gestures[label]=record; await persist();
  const sampleWorldX=(watch.x-box.x)/box.width*64, sampleWorldY=(watch.y-box.y)/box.height*64;
  for(let n=1;n<=24;n++){
    const elapsed=await page.evaluate(()=>performance.now())-downMono;
    const p=Math.min(1,elapsed/durationMs); await page.mouse.move(start.x+(end.x-start.x)*p,start.y+(end.y-start.y)*p);
    await page.waitForTimeout(100);
    const current=await sample(watch.x,watch.y), delta=pixelDelta(baseline.bytes,current.bytes); record.maxChangedPixels=Math.max(record.maxChangedPixels,delta);
    // Compare only after pointer moved well beyond an 8m brush and patch footprint.
    const cursor=point(coords[0][0]+(coords[1][0]-coords[0][0])*p,coords[0][1]+(coords[1][1]-coords[0][1])*p);
    const safe=Math.hypot(cursor.x-watch.x,cursor.y-watch.y)>box.width*0.20;
    if(safe&&delta>10&&!record.firstChanged){const patch=await savePatch(`${label}-first-changed.png`,current.bytes); record.firstChanged={sampledAt:current.sampledAt,afterDownMs:current.sampledAt-downMono,changedPixels:delta,patch,...current,worldPoint:{x:sampleWorldX,y:sampleWorldY}}; await persist();}
    if(p>=1) break;
  }
  const elapsedEnd=await page.evaluate(()=>performance.now())-downMono;
  if(elapsedEnd<durationMs) await page.waitForTimeout(durationMs-elapsedEnd);
  const up=Date.now(); record.upAt=new Date(up).toISOString(); record.upMono=await page.evaluate(()=>performance.now()); await page.mouse.up(); record.heldMs=record.upMono-downMono; await persist(); return record;
}
try {
  phaseMark('fixture creation');
  fixture=await createAtlasCanonicalFixture({profilePath:native.profile,campaignName:'Terrain Stroke',includeCity:false,peak:{x:32,y:32},baseHeightM:2,peakRiseM:1.5,hillScale:350}); evidence.fixture=fixture; evidence.sourceHashes=await hashes(); evidence.fixtureSha256=sha(await readFile('./tools/atlas-canonical-fixture.mjs')); evidence.probeSha256=sha(await readFile('./tools/test-desktop-atlas-terrain-stroke.mjs')); evidence.launchSource=native.source; evidence.artifacts=native.artifacts; evidence.profile=native.profile; evidence.display={requestedContent:[1920,1080],sessionType:process.env.XDG_SESSION_TYPE??null,waylandDisplay:process.env.WAYLAND_DISPLAY??null,ozone:process.env.QA_OZONE_PLATFORM??null}; await persist();
  const initialHeights=heights(), initialRevision=revision(); await open(); phaseMark('initial baseline and first gesture');
  const box=await page.locator('#campaign-map').boundingBox(); assert(box);
  const point=(u,v)=>({x:box.x+box.width*u,y:box.y+box.height*v});
  await page.mouse.move(box.x+box.width*.03,box.y+box.height*.95); await page.waitForTimeout(300);
  const w1=point(.5,.3), w2=point(.5,.68);
  const baseline1=await sample(w1.x,w1.y), b1=await savePatch('gesture1-baseline.png',baseline1.bytes);
  await page.waitForTimeout(200); const quietControl=await sample(w1.x,w1.y);
  evidence.quietStartControl={parkedPointerAt:[box.x+box.width*.03,box.y+box.height*.95],delayMs:200,changedPixels:pixelDelta(baseline1.bytes,quietControl.bytes),rule:'Baseline viewport patch is compared only after the brush cursor is parked outside it; no cursor/overlay/LOD is counted.'};
  assert(evidence.quietStartControl.changedPixels<=10,'Terrain patch was not stable with pointer parked before input');
  const baseline2=await sample(w2.x,w2.y), b2=await savePatch('gesture2-baseline.png',baseline2.bytes);
  evidence.gestures.one={baseline:b1,...baseline1}; evidence.gestures.two={baseline:b2,...baseline2};
  await native.capture(page,'01-before.png'); await persist();
  const one=await gesture('one',[[.12,.3],[.88,.3],[.5,.3]],box,{...b1,bytes:baseline1.bytes},3600);
  phaseMark('immediate second gesture');
  const two=await gesture('two',[[.12,.68],[.88,.68],[.5,.68]],box,{...b2,bytes:baseline2.bytes},1800);
  evidence.gestures.transitionMs=new Date(two.downAt).getTime()-new Date(one.upAt).getTime(); await persist();
  await native.capture(page,'02-first-stroke.png'); await native.capture(page,'03-follow-up-stroke.png');
  assert(one.heldMs>=3000&&one.heldMs<=5000,`First gesture duration ${one.heldMs}ms outside 3–5s`);
  assert(one.firstChanged,'No pre-pointerup terrain pixel change observed for first gesture');
  assert(two.firstChanged,'No pre-pointerup terrain pixel change observed for second gesture');
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready'&&document.querySelector('#campaign-map').dataset.terrainDraft===undefined&&!document.querySelector('#atlas-undo').disabled,null,{timeout:60000});
  const saved=heights(), savedRevision=revision(); const byId=new Map(initialHeights.map(t=>[t.id,t]));
  const changed=saved.filter(t=>byId.get(t.id)?.data!==t.data);
  const added=saved.filter(t=>!byId.has(t.id));
  evidence.canonical={initialRevision,savedRevision,initialTiles:initialHeights.length,savedTiles:saved.length,changed:changed.map(t=>({id:t.id,kind:byId.has(t.id)?'changed':'added',beforeSha256:byId.has(t.id)?sha(Buffer.from(byId.get(t.id).data)) :null,afterSha256:sha(Buffer.from(t.data)),data:t.data})),bothGesturePixels:[one.firstChanged.changedPixels,two.firstChanged.changedPixels]}; await persist();
  assert(changed.length+added.length>0,'No canonical height tile changed');
  // Each row is independently sampled within a spatially separated stroke band; canonical tile diff is persisted for review.
  evidence.canonical.regions=[{gesture:'one',screenBand:[.12,.3,.88,.3]},{gesture:'two',screenBand:[.12,.68,.88,.68]}];
  evidence.sourceHashes=await hashes(); await persist(); phaseMark('close initial app'); await native.close(); page=null;
  phaseMark('reopen campaign'); await open(); phaseMark('fresh canonical height comparison');
  const reopened=heights(); assert.deepEqual(reopened.map(({id,data})=>[id,data]),saved.map(({id,data})=>[id,data]),'Fresh open changed canonical height bytes'); assert.equal(revision(),savedRevision);
  evidence.fresh={savedTiles:saved.length,reopenedTiles:reopened.length,byteIdentical:true,revision:revision()}; await native.capture(page,'04-reopened.png'); await persist();
  phaseMark('close reopened app'); await native.close(); page=null; evidence.launches=native.launches; evidence.nativeErrors=native.errors; await writeFile(path.join(output,'phase-errors.json'),JSON.stringify(consoleEvents,null,2)); await persist(); await native.finish({scope:'Two spatially separated dry terrain height strokes, immediate follow-up, fresh canonical height-byte reopen.',evidencePath:path.join(output,'evidence.partial.json')});
  console.log(output);
} catch(error) {
  evidence.error={phase,at:new Date().toISOString(),message:error.message,stack:error.stack}; evidence.launches=native.launches; evidence.nativeErrors=native.errors; await persist(); await writeFile(path.join(output,'phase-errors.json'),JSON.stringify(consoleEvents,null,2)); await native.fail(error); throw error;
} finally { await native.dispose(); }
