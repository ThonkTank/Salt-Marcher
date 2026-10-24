import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {createAtlasCanonicalFixture} from './atlas-canonical-fixture.mjs';

const root=process.cwd(),output=path.resolve('.build/atlas-material-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-material-tiles'});
const files=[
 'src/app/atlas-material-tile.ts','src/app/terrain-material.ts','src/app/terrain-relief.ts','src/app/landscape-raster.ts',
 'src/app/atlas-region-contracts.ts','src/app/storage/atlas-tile-cache.ts','src/app/storage/atlas-material-tiles.ts','src/app/storage/terrain-material.ts',
 'src/app/storage/atlas-landscape-region.ts','src/app/storage/atlas-region.ts','src/app/storage/terrain-color-raster.ts',
 'desktop/atlas-region-worker.ts','desktop/atlas-region.ts','desktop/main.ts','desktop/preload.ts',
 'tools/test-desktop-atlas-material-tiles.mjs'
];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const channelNames=['baseColor','water','forest','rock','snow'];
const channelHashes=result=>Object.fromEntries(channelNames.map(name=>[name,createHash('sha256').update(Buffer.from(result.channels[name])).digest('hex')]));

try{
 const fixture=await createAtlasCanonicalFixture({profilePath:native.profile,campaignName:'Persistent material tile qualification'}),before=await hashes();
 const page=await native.launch(),errors=[];page.on('pageerror',error=>errors.push(error.stack));
 const cold=await page.evaluate(async({campaignId,tile})=>{
  const unwrap=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value;};
  const active=unwrap(await window.campaign.activate(campaignId)),revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
  const start=performance.now(),value=unwrap(await window.campaign.atlasMaterialTile(active.token,{tile,revision}));
  return {revision,ms:performance.now()-start,tile:value.tile,fence:value.fence,width:value.width,height:value.height,cache:value.cache,
   channels:Object.fromEntries(Object.entries(value.channels).map(([name,bytes])=>[name,Array.from(bytes)]))};
 },{campaignId:fixture.campaignId,tile:{lod:-2,x:0,y:0}});
 assert.equal(cold.width,256);assert.equal(cold.height,256);assert.deepEqual(cold.tile,{lod:-2,x:0,y:0});
 for(const name of channelNames){assert.equal(cold.cache[name],'built',`${name} is built on cold open`);assert.equal(cold.channels[name].length,256*256*(name==='baseColor'?4:1));}
 const coldHashes=channelHashes(cold),style={version:1,mode:'drawn',land:'#eee5cf',ink:'#172a3a',lightDegrees:37,strength:.31,mountains:true,snowlineM:2500};
 const restyled=await page.evaluate(async({campaignId,style,tile,commandId})=>{
  const unwrap=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value;};
  const active=unwrap(await window.campaign.activate(campaignId));
  unwrap(await window.campaign.executeAtlasCommit({commandId,token:active.token,campaignId,action:{kind:'landscape-terrain-style',style}}));
  const revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision,start=performance.now();
  const value=unwrap(await window.campaign.atlasMaterialTile(active.token,{tile,revision}));
  return {revision,ms:performance.now()-start,cache:value.cache,channels:Object.fromEntries(Object.entries(value.channels).map(([name,bytes])=>[name,Array.from(bytes)]))};
 },{campaignId:fixture.campaignId,style,tile:cold.tile,commandId:randomUUID()});
 for(const name of channelNames){assert.equal(restyled.cache[name],'hit',`${name} survives light/ink/strength changes`);}
 const restyledHashes=channelHashes(restyled);assert.deepEqual(restyledHashes,coldHashes,'display lighting and ink do not alter raw materials');
 const snowline=await page.evaluate(async({campaignId,tile,commandId,style})=>{
  const unwrap=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value;};
  const active=unwrap(await window.campaign.activate(campaignId));
  unwrap(await window.campaign.executeAtlasCommit({commandId,token:active.token,campaignId,action:{kind:'landscape-terrain-style',style:{...style,snowlineM:0}}}));
  const revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision,start=performance.now();
  const value=unwrap(await window.campaign.atlasMaterialTile(active.token,{tile,revision}));
  return {revision,ms:performance.now()-start,cache:value.cache,channels:Object.fromEntries(Object.entries(value.channels).map(([name,bytes])=>[name,Array.from(bytes)]))};
 },{campaignId:fixture.campaignId,tile:cold.tile,commandId:randomUUID(),style});
 for(const name of channelNames)assert.equal(snowline.cache[name],name==='snow'?'built':'hit',`${name} follows only its material dependencies`);
 assert(snowline.channels.snow.some(value=>value>0),'the 140 m canonical hill crosses the lowered snowline');
 const snowlineHashes=channelHashes(snowline);
 assert.notEqual(snowlineHashes.snow,coldHashes.snow);
 for(const name of channelNames.filter(name=>name!=='snow'))assert.equal(snowlineHashes[name],coldHashes[name]);
 await page.evaluate(channels=>{
  const panel=document.createElement('div');panel.id='material-channel-inspector';Object.assign(panel.style,{position:'fixed',inset:'16px',zIndex:'99999',background:'#f8f8f5',padding:'20px',font:'16px sans-serif',display:'grid',gridTemplateColumns:'repeat(3,256px)',gap:'16px',alignContent:'start'});
  const title=document.createElement('h2');title.textContent='M2 Materialkanäle · technische Prüfung';title.style.gridColumn='1 / -1';panel.append(title);
  for(const [name,bytes] of Object.entries(channels)){
   const figure=document.createElement('div'),label=document.createElement('div'),canvas=document.createElement('canvas');label.textContent=name;canvas.width=256;canvas.height=256;
   const context=canvas.getContext('2d'),frame=context.createImageData(256,256);
   if(name==='baseColor')frame.data.set(bytes);else for(let i=0;i<bytes.length;i++){frame.data[i*4]=frame.data[i*4+1]=frame.data[i*4+2]=bytes[i];frame.data[i*4+3]=255;}
   context.putImageData(frame,0,0);figure.append(label,canvas);panel.append(figure);
  }document.body.append(panel);
 },snowline.channels);
 await page.locator('#material-channel-inspector').waitFor({state:'visible'});
 await native.capture(page,'material-channels.png');
 await native.close();

 const fresh=await native.launch();fresh.on('pageerror',error=>errors.push(error.stack));const warm=await fresh.evaluate(async({campaignId,tile})=>{
  const unwrap=r=>{if(!r.ok)throw Error(JSON.stringify(r));return r.value;};
  const active=unwrap(await window.campaign.activate(campaignId)),revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision,start=performance.now();
  const value=unwrap(await window.campaign.atlasMaterialTile(active.token,{tile,revision}));
  return {revision,ms:performance.now()-start,cache:value.cache,tile:value.tile,fence:value.fence,
   channels:Object.fromEntries(Object.entries(value.channels).map(([name,bytes])=>[name,Array.from(bytes)]))};
 },{campaignId:fixture.campaignId,tile:cold.tile});
 const warmHashes=channelHashes(warm);
 assert(warm.tile&&warm.fence);assert.deepEqual(warm.cache,Object.fromEntries(channelNames.map(name=>[name,'hit'])));
 assert.deepEqual(warmHashes,snowlineHashes,'fresh Electron launch returns byte-identical warm channels');
 await native.close();const after=await hashes();assert.deepEqual(after,before);assert.deepEqual(errors,[]);
 await native.finish({complete:true,scope:'Real preload/Main/worker transport for material tiles, independent cache dependencies across style and snowline changes, and byte-identical reuse after a fresh Electron launch; no GPU integration or full M2 acceptance.',fixture,cold:{...cold,channels:undefined,hashes:coldHashes},restyled:{...restyled,channels:undefined,hashes:restyledHashes},snowline:{...snowline,channels:undefined,hashes:snowlineHashes},warm:{...warm,channels:undefined,hashes:warmHashes},errors,hashes:{before,after}});
 console.log(JSON.stringify({complete:true,output}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
