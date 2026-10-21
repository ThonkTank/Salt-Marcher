// Main Atlas at equal logical size on 100% and 200% displays; no alternate renderer.
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/contour-display');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';"},outfile:'.build/contour-display-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord}=require(root+'/.build/contour-display-store.cjs'),native=await createNativeSession({root,output:out,name:'contour-display'});
const store=new CampaignStore(native.profile+'/workbench.sqlite'),campaign=store.create('Konturen im Hauptatlas'),token=store.activate(campaign.id).token;
for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)store.executeAtlasCommit({token,campaignId:campaign.id,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>20+90*Math.exp(-((x*1024+i%64*16)**2+(y*1024+Math.floor(i/64)*16)**2)/40000)))}});
store.tutorial('skipped');store.close();const measurements=[];
const row=page=>page.evaluate(()=>{
 const c=document.querySelector('#atlas-terrain-spatial'),gl=c.getContext('webgl2'),bytes=new Uint8Array(c.width*4);
 gl.readPixels(0,Math.floor(c.height/2),c.width,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
 if(gl.getError()!==gl.NO_ERROR)throw Error('Main Atlas pixel read failed');
 return {width:c.clientWidth,height:c.clientHeight,physicalWidth:c.width,physicalHeight:c.height,dpr:devicePixelRatio,values:Array.from({length:c.width},(_,i)=>bytes[i*4])};
});
const runs=(on,off)=>{
 assert.equal(on.physicalWidth,off.physicalWidth);const ratio=on.physicalWidth/on.width,segments=[];
 let begin=null;
 for(let i=0;i<=on.values.length;i++){
  const ink=i<on.values.length&&off.values[i]-on.values[i]>6;
  if(ink&&begin===null)begin=i;
  if(!ink&&begin!==null){segments.push((begin+i)/2/ratio);begin=null;}
 }
 return segments;
};
try{
 for(const zoom of [1,2]){
  const page=await native.launch(zoom);
  await native.app.evaluate(({BrowserWindow},zoom)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.unmaximize();const frame=w.getBounds().height-w.getContentBounds().height;w.setMinimumSize(1100*zoom,800*zoom+frame);w.setContentSize(1100*zoom,800*zoom);w.setMinimumSize(320,240);},zoom);
  await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-450,y:-300,width:900,height:600})),campaign.id);
  await page.locator('.campaign-card').filter({hasText:'Konturen im Hauptatlas'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
  await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
  await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:45000});
  assert.equal(await page.locator('#campaign-map').getAttribute('data-terrain-view'),'main');const surface=await page.locator('#atlas-terrain-spatial').elementHandle();
  const capture=async value=>{await page.locator('#atlas-display').click();await page.locator('#land-contours').selectOption(value);await page.keyboard.press('Escape');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return row(page);};
  const automatic=await capture('-1');await native.capture(page,zoom+'00-percent-auto.png');
  const disabled=await capture('0'),fixed=await capture('50');await capture('-1');
  assert(await surface.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));
  const autoRuns=runs(automatic,disabled),fixedRuns=runs(fixed,disabled);assert(autoRuns.length>=10,'automatic contours must be visible');assert(fixedRuns.length>=2&&fixedRuns.length<autoRuns.length);
  measurements.push({zoom,...automatic,values:undefined,autoRuns,fixedRuns,view:JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'))});
  await native.close();
 }
 await writeFile(out+'/measurements.json',JSON.stringify(measurements,null,2));
 const [a,b]=measurements;assert.equal(a.width,b.width);assert(Math.abs(a.height-b.height)<=1,'window chrome can round by at most one logical pixel');
 assert.equal(a.view.width,b.view.width);assert.equal(a.view.x,b.view.x);
 assert(Math.abs((a.view.y+a.view.height/2)-(b.view.y+b.view.height/2))<1e-6,'the sampled row crosses the same world centre');
 assert(Math.abs(a.view.height-b.view.height)<=a.view.height/a.height*1.01);
 assert(Math.abs(a.physicalWidth/a.width-1)<.01);assert(Math.abs(b.physicalWidth/b.width-1.5)<.01);
 for(const key of ['autoRuns','fixedRuns']){
  const matching=(xs,ys)=>xs.filter(x=>ys.some(y=>Math.abs(y-x)<2)).length/xs.length;
  assert(matching(a[key],b[key])>=.95&&matching(b[key],a[key])>=.95,JSON.stringify({key,a:a[key],b:b[key]}));
 }
 await native.finish({measurements,checks:['Normal campaign navigation opens one main Atlas at 100% and 200%.','Automatic and fixed contour positions agree within 2 logical pixels at equal world frame; the same canvas handles all display changes.']});
 console.log('Main Atlas contour display passed at 100% and 200%.');
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
