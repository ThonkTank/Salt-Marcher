import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML,DOMParser} from 'linkedom';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/city-dom-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/city-ui'; export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui'; export {publicAtlasSVG} from './src/app/campaign-atlas-export'; export {atlasRegionSVG} from './src/app/atlas-region-export'; export {initDrawing,activateDrawing,flushDrawing,atlasDrawingPoint,atlasDrawingDraft} from './src/app/drawing-ui';",resolveDir:process.cwd()},outfile:'.build/city-dom-ui.cjs',bundle:true,platform:'node',format:'cjs'});
for(const [name,entry] of [['service','desktop/room-directory.ts'],['worker','desktop/room-directory-worker.ts']])buildSync({entryPoints:[entry],outfile:'.build/city-dom-directory-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/landscape-raster.ts'],outfile:'.build/city-dom-raster.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/city-dom-store.cjs'),tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){await tick();await tick();await tick();}
async function until(fn){for(let i=0;i<60&&!fn();i++)await tick();assert.ok(fn(),'Expected city state did not arrive.');}
async function setup(){
 const root=mkdtempSync(path.join(tmpdir(),'city-dom-')),store=new CampaignStore(path.join(root,'campaign.sqlite')),directory=new (require('../.build/city-dom-directory-service.cjs').RoomDirectoryService)(path.resolve('.build/city-dom-directory-worker.cjs'));
 const campaignIds={},cityIds={one:randomUUID(),two:randomUUID()},unitIds={one:randomUUID(),two:randomUUID()};
 for(const name of ['Alpha','Beta']){
  const c=store.create(name,[]),w=store.activate(c.id),locationId=randomUUID();campaignIds[name]=c.id;
  store.changePreparation({commandId:randomUUID(),token:w.token,change:{kind:'location',expectedRevision:null,document:{kind:'location',version:1,id:locationId,name:'City location',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}});
  for(const which of ['one','two']){
   const cityId=cityIds[which],header={id:cityId,revision:1,name:name+' '+which,locationId,width:250,height:250,paper:'#aabbcc',roof:'#123456'};
   store.executeCity({commandId:randomUUID(),token:w.token,campaignId:c.id,cityId,expectedRevision:0,action:{kind:'create',header}});
   const nodeIds=[randomUUID(),randomUUID()],districtId=randomUUID(),units=[
    {id:nodeIds[0],kind:'node',name:'',protected:true,point:{x:0,y:125}},
    {id:nodeIds[1],kind:'node',name:'',protected:true,point:{x:250,y:125}},
    {id:randomUUID(),kind:'road',name:'Main street',protected:true,nodeIds,width:6,via:[]},
    {id:districtId,kind:'district',name:'District',protected:true,outline:[{x:0,y:0},{x:250,y:0},{x:250,y:250},{x:0,y:250}]},
    {id:unitIds[which],kind:'building',name:'House '+which,protected:true,position:{x:60,y:60},angle:0,outline:[{x:-4,y:-4},{x:4,y:-4},{x:4,y:4},{x:-4,y:4}],notes:'Original',use:'home',districtId,ownerId:null,rooms:[],interior:false},
   ];
   store.executeCity({commandId:randomUUID(),token:w.token,campaignId:c.id,cityId,expectedRevision:1,action:{kind:'change',upsert:units,remove:[],label:'Structure'}});
  }
 }
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));
 for(const select of document.querySelectorAll('select')){select.add=o=>select.append(o);let chosen='';Object.defineProperty(select,'value',{get(){const options=[...select.querySelectorAll('option')];return options.find(o=>o.value===chosen)?.value??options[0]?.value??'';},set(v){chosen=String(v);}});}
 for(const dialog of document.querySelectorAll('dialog')){dialog.open=false;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 const saved=Object.fromEntries(['window','document','DOMParser','Event','CustomEvent','Option','ResizeObserver','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]])),timers=new Map();let timer=0;
 Object.assign(globalThis,{window,document,DOMParser,Event:window.Event,CustomEvent:window.CustomEvent,ResizeObserver:class{observe(){} disconnect(){}},Option:function(text,value){const o=document.createElement('option');o.textContent=text;o.value=value;return o;},setTimeout:(fn,ms)=>{timers.set(++timer,{fn,ms});return timer;},clearTimeout:id=>timers.delete(id)});
 const writes=[],messages=[];let current;
 const reply=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
 window.campaign={world:async token=>reply(()=>store.world(token)),landscapeFind:async(t,q)=>reply(()=>store.landscapeFind(t,q)),landscapeRegion:async(t,b,m,includePatches)=>reply(()=>store.landscapeRegion(t,b,m,includePatches)),campaignAtlas:async (token,groupView)=>reply(()=>store.campaignAtlas(token,groupView)),npcs:async(t,q)=>reply(()=>store.npcs(t,q)),cities:async t=>reply(()=>store.cities(t)),city:async(t,id)=>reply(()=>store.city(t,id)),executeCity:async command=>{writes.push(structuredClone(command));return reply(()=>store.executeAtlas({...command,action:command.action.kind==='undo'||command.action.kind==='redo'?{kind:command.action.kind}:{kind:'city',command}}).atlas.cities.find(c=>c.header.id===command.cityId));},executeAtlas:async command=>{if(!['city','undo','redo'].includes(command.action.kind))return reply(()=>store.executeAtlas(command));const city=command.action.kind==='city'?command.action.command:{...command,cityId:document.getElementById('city-select').value,action:command.action};const result=await window.campaign.executeCity(city);return result.ok?reply(()=>({atlas:store.campaignAtlas(command.token),result:result.value})):result;},exportCity:async()=>({ok:true,value:{cancelled:false}})};
 // Bounded Atlas APIs use the actual store and browser-safe rasterizer, not a second campaign snapshot.
 Object.assign(window.campaign,{
  atlasRenderView:async(token,groupView)=>reply(()=>store.atlasRenderView(token,groupView)),
  drawingMap:async token=>reply(()=>store.drawingMap(token)),
  drawingElement:async(token,id)=>reply(()=>store.drawingElement(token,id)),
  roomDirectory:async(token,q)=>{try{const source=store.roomReadSource(token,q),value=await directory.read(source,q);if(store.roomReadSource(token).fence!==source.fence)throw new Error('Raumsuche inzwischen geändert.');return{ok:true,value};}catch(error){return{ok:false,error:error.message};}},
  cancelRoomDirectory:async()=>{directory.cancel();return{ok:true,value:undefined};},
  atlasOverview:async token=>reply(()=>store.atlasOverview(token)),
  atlasObjects:async(token,q)=>reply(()=>store.atlasObjects(token,q)),
  atlasRoom:async(token,id)=>reply(()=>store.atlasRoom(token,id)),
  atlasLandscapeObject:async(token,id)=>reply(()=>store.atlasLandscapeObject(token,id)),
  cityBuildings:async(token,q)=>reply(()=>store.cityBuildings(token,q)),
  executeAtlasCommit:async command=>reply(()=>store.executeAtlasCommit(command)),
  cancelLandscapeRaster:async()=>({ok:true,value:undefined}),
  landscapeRaster:async(token,box,width,height)=>reply(()=>{
   const {LandscapeRasterizer}=require('../.build/city-dom-raster.cjs'),raster=new LandscapeRasterizer(box,width,height);
   for(const record of store.landscapeRegion(token,box,0).records)raster.paint(record);
   return {...store.atlasIdentity(token),box,width,height,data:'data:image/png;base64,'+require('pngjs').PNG.sync.write({width,height,data:Buffer.from(raster.finish())}).toString('base64')};
  }),
 });
 delete require.cache[require.resolve('../.build/city-dom-ui.cjs')];const ui=require('../.build/city-dom-ui.cjs');ui.initCity((message,error)=>messages.push({message,error}));
 const activate=async name=>{current=store.activate(campaignIds[name]);ui.activateCity(current);await ui.openCity();};
 const select=async(which='one')=>{document.getElementById('city-tool').value='select';[...document.querySelectorAll('[data-city-unit="'+unitIds[which]+'"]')].at(-1).dispatchEvent(new window.Event('click',{bubbles:true}));await until(()=>document.getElementById('city-unit-name').value==='House '+which).catch(error=>{error.message+=' '+JSON.stringify(messages);throw error;});};
 const choose=async(which,name=current.campaign.name)=>{const input=document.getElementById('city-select');input.value=cityIds[which];input.onchange();await until(()=>document.getElementById('city-title').textContent===name+' '+which);};
 const enter=(id,text)=>{const input=document.getElementById(id);input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const click=id=>document.getElementById(id).click();
 const drain=async()=>{for(let i=0;i<80;i++){const jobs=[...timers].filter(([,job])=>job.ms===0);if(!jobs.length){await settle();if(![...timers.values()].some(job=>job.ms===0))return;}for(const[id,job]of jobs){timers.delete(id);job.fn();}await settle();}throw new Error('Generation did not settle.');};
 document.getElementById('city-zoom').value='1';document.getElementById('city-seed').value='city-seed';document.getElementById('city-density').value='0.5';document.getElementById('city-size').value='8';document.getElementById('city-reach').value='80';
 await activate('Alpha');await select();document.getElementById('city-location').value=store.city(current.token,cityIds.one).header.locationId;
 return{store,ui,window,document,cityIds,unitIds,writes,messages,timers,activate,select,choose,enter,click,drain,current:()=>current,
  async cleanup(){await drain();await directory.close();timers.clear();store.close();Object.assign(globalThis,saved);rmSync(root,{recursive:true,force:true});}
 };
}

test('city inspector drains input typed while its first acknowledgement is delayed',async()=>{
 const x=await setup();let release;
 try{const send=x.window.campaign.executeCity;let first=true;x.window.campaign.executeCity=async command=>{const response=await send(command);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  x.enter('city-unit-notes','First');const flush=x.ui.flushCity();await until(()=>!!release);x.enter('city-unit-notes','  Later edit\r\n');release();assert.equal(await flush,true);
  assert.equal(x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one).notes,'  Later edit\r\n');assert.equal(x.writes.length,2);
 }finally{if(release)release();await x.cleanup();}
});
test('old city acknowledgement cannot replace the new campaign view',async()=>{
 const x=await setup();let release;
 try{const send=x.window.campaign.executeCity;x.window.campaign.executeCity=async command=>{const response=await send(command);return new Promise(resolve=>{release=()=>resolve(response);});};x.enter('city-unit-notes','Alpha saved');const flush=x.ui.flushCity();await until(()=>!!release);await x.activate('Beta');release();assert.equal(await flush,false);assert.equal(x.document.getElementById('city-title').textContent,'Beta one');
 }finally{if(release)release();await x.cleanup();}
});
test('old city opening cannot adopt a different campaign token midway through its reads',async()=>{
 const x=await setup();let release;
 try{const read=x.window.campaign.cities,city=x.window.campaign.city,tokens=[];x.window.campaign.cities=async t=>{const response=await read(t);return new Promise(resolve=>{release=()=>resolve(response);});};const old=x.ui.openCity();await until(()=>!!release);x.window.campaign.cities=read;x.window.campaign.city=async(t,id)=>{tokens.push(t);return city(t,id);};await x.activate('Beta');tokens.length=0;release();await old;assert.deepEqual(tokens,[]);assert.equal(x.document.getElementById('city-title').textContent,'Beta one');
 }finally{if(release)release();await x.cleanup();}
});
test('the latest selected city wins over an older same-campaign response',async()=>{
 const x=await setup();let release;
 try{const read=x.window.campaign.city;x.window.campaign.city=async(t,id)=>{const response=await read(t,id);return id===x.cityIds.two?new Promise(resolve=>{release=()=>resolve(response);}):response;};const input=x.document.getElementById('city-select');input.value=x.cityIds.two;input.onchange();await until(()=>!!release);await x.choose('one');release();await settle();assert.equal(x.document.getElementById('city-title').textContent,'Alpha one');
 }finally{if(release)release();await x.cleanup();}
});
test('cancelling generation cannot publish its late result',async()=>{
 const x=await setup();try{x.click('city-generate');await until(()=>[...x.timers.values()].some(job=>job.ms===0));x.click('city-cancel-preview');await x.drain();assert.equal(x.document.getElementById('city-preview-actions').hidden,true);assert.equal(x.writes.length,0);}finally{await x.cleanup();}
});
test('generation from Alpha cannot leave its preview or error in Beta',async()=>{
 const x=await setup();try{x.click('city-generate');await until(()=>[...x.timers.values()].some(job=>job.ms===0));await x.activate('Beta');await x.drain();assert.equal(x.document.getElementById('city-title').textContent,'Beta one');assert.equal(x.document.getElementById('city-preview-actions').hidden,true);assert.equal(x.messages.filter(m=>m.error).length,0,JSON.stringify(x.messages));}finally{await x.cleanup();}
});
test('generated editable buildings preserve protected authored houses when accepted',async()=>{
 const x=await setup();try{const before=x.store.city(x.current().token,x.cityIds.one),house=before.units.find(u=>u.id===x.unitIds.one);x.click('city-generate');await settle();await x.drain();assert.equal(x.document.getElementById('city-preview-actions').hidden,false);x.click('city-preview-accept');await settle();const after=x.store.city(x.current().token,x.cityIds.one);assert.ok(after.units.filter(u=>u.kind==='building').length>1);assert.deepEqual(after.units.find(u=>u.id===house.id),house);}finally{await x.cleanup();}
});
test('an unknown city action cannot replay redo history',async()=>{
 const x=await setup();try{const w=x.current(),c={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:x.cityIds.one,expectedRevision:2,action:{kind:'undo'}};x.store.executeCity(c);const before=x.store.city(w.token,c.cityId);assert.throws(()=>x.store.executeCity({...c,commandId:randomUUID(),expectedRevision:before.header.revision,action:{kind:'future-city-action'}}));assert.deepEqual(x.store.city(w.token,c.cityId),before);}finally{await x.cleanup();}
});
test('history flags remain correct and a late damaged history record is rejected',async()=>{
 const x=await setup();try{const w=x.current(),before=x.store.city(w.token,x.cityIds.one);assert.equal(before.canUndo,true);assert.equal(before.canRedo,false);const undone=x.store.executeCity({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:x.cityIds.one,expectedRevision:before.header.revision,action:{kind:'undo'}});assert.equal(undone.canUndo,false);assert.equal(undone.canRedo,true);const row=x.store.db.prepare('SELECT * FROM city_history WHERE campaign_id=? AND city_id=?').get(w.campaign.id,x.cityIds.one);x.store.db.prepare('UPDATE city_history SET checksum=? WHERE campaign_id=? AND id=?').run(createHash('sha256').update('damaged').digest('hex'),w.campaign.id,row.id);assert.throws(()=>x.store.city(w.token,x.cityIds.one));}finally{await x.cleanup();}
});
test('city selection cannot discard inspector input typed while its read is pending',async()=>{
 const x=await setup();let release;
 try{const read=x.window.campaign.city;x.window.campaign.city=async(t,id)=>{const response=await read(t,id);return new Promise(resolve=>{release=()=>resolve(response);});};
  const input=x.document.getElementById('city-select');input.value=x.cityIds.two;input.onchange();await until(()=>!!release);x.enter('city-unit-notes','New local draft');release();await settle();
  assert.equal(x.document.getElementById('city-title').textContent,'Alpha one');assert.equal(x.document.getElementById('city-unit-notes').value,'New local draft');assert.equal(await x.ui.flushCity(),true);
  assert.equal(x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one).notes,'New local draft');
 }finally{if(release)release();await x.cleanup();}
});
test('a cancelled generator cannot unlock or replace its newer successor',async()=>{
 const x=await setup();try{
  x.click('city-generate');await until(()=>[...x.timers.values()].some(job=>job.ms===0));const old=[...x.timers].find(([,job])=>job.ms===0);x.click('city-cancel-preview');x.document.getElementById('city-seed').value='new-seed';x.click('city-generate');await settle();
  x.timers.delete(old[0]);old[1].fn();await settle();assert.equal(x.document.getElementById('city-generate').disabled,true);
  await x.drain();assert.match(x.document.getElementById('city-preview-summary').textContent,/new-seed/);assert.equal(x.messages.filter(m=>m.error).length,0,JSON.stringify(x.messages));
 }finally{await x.cleanup();}
});
test('a foreign city revision preserves the draft and can be explicitly reloaded',async()=>{
 const x=await setup();try{
  x.enter('city-unit-notes','My conflict');const w=x.current(),city=x.store.city(w.token,x.cityIds.one),house=city.units.find(u=>u.id===x.unitIds.one);
  x.store.executeCity({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:city.header.id,expectedRevision:city.header.revision,action:{kind:'change',upsert:[{...house,notes:'Other writer'}],remove:[],label:'Other write'}});
  assert.equal(await x.ui.flushCity(),false);assert.equal(x.document.getElementById('city-unit-notes').value,'My conflict');
  assert.ok(x.document.getElementById('city-unit-reload'));x.click('city-unit-reload');await until(()=>x.document.getElementById('city-unit-notes').value==='Other writer');
  x.enter('city-unit-notes','New edit');assert.equal(await x.ui.flushCity(),true);assert.equal(x.store.city(w.token,city.header.id).units.find(u=>u.id===house.id).notes,'New edit');
 }finally{await x.cleanup();}
});
test('explicit element reload preserves newer input typed during its read',async()=>{
 const x=await setup();let release;try{
  x.enter('city-unit-notes','Discard this');const read=x.window.campaign.city;x.window.campaign.city=async(t,id)=>{const response=await read(t,id);return new Promise(resolve=>{release=()=>resolve(response);});};
  x.click('city-unit-reload');await until(()=>!!release);x.enter('city-unit-notes','Newer draft');release();await settle();assert.equal(x.document.getElementById('city-unit-notes').value,'Newer draft');assert.equal(await x.ui.flushCity(),true);
  assert.equal(x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one).notes,'Newer draft');
 }finally{if(release)release();await x.cleanup();}
});
test('creating a city first saves the edited house and keeps its own captured name',async()=>{
 const x=await setup();let release;try{
  const send=x.window.campaign.executeCity;let first=true;x.window.campaign.executeCity=async command=>{const response=await send(command);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  x.enter('city-unit-notes','Keep house edit');x.document.getElementById('city-new-name').value='Captured city';x.document.getElementById('city-new-form').onsubmit(new x.window.Event('submit',{cancelable:true}));await until(()=>!!release);
  assert.equal(x.writes[0].action.kind,'change');x.document.getElementById('city-new-form').onsubmit(new x.window.Event('submit',{cancelable:true}));await settle();assert.equal(x.writes.length,1);x.document.getElementById('city-new-name').value='Later name';release();await until(()=>x.writes.length===2);await settle();
  assert.equal(x.writes[1].action.kind,'create');assert.equal(x.writes[1].action.header.name,'Captured city');
  assert.equal(x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one).notes,'Keep house edit');assert.equal(x.document.getElementById('city-title').textContent,'Captured city');
 }finally{if(release)release();await x.cleanup();}
});

test('new city and canonical city location commit together and replay without duplicates',async()=>{
 const x=await setup();try{
  const w=x.current(),id=randomUUID(),locationId=randomUUID(),command={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:id,expectedRevision:0,action:{kind:'create',header:{id,revision:1,name:'Market map',locationId,width:300,height:200,paper:'#e9dfc8',roof:'#9c604c'},location:{kind:'location',version:1,id:locationId,name:'Eichenfurt',type:'city',sections:[],detailMaps:[],keyLinks:[]}}};
  const before=x.store.cities(w.token);const result=x.store.executeCity(command);assert.equal(result.header.locationId,locationId);
  const location=x.store.preparation(w.token).locations.find(l=>l.document.id===locationId);assert.equal(location.document.name,'Eichenfurt');assert.equal(location.document.type,'city');
  assert.deepEqual(x.store.executeCity(command),result);const after=x.store.cities(w.token);assert.equal(after.locations.length,before.locations.length+1);assert.equal(after.cities.length,before.cities.length+1);
  assert.throws(()=>x.store.executeCity({...command,action:{...command.action,location:{...command.action.location,name:'Changed'}}}),/Kennung|kennung/);
 }finally{await x.cleanup();}
});

test('a late city receipt failure rolls back both the new location and city',async()=>{
 const x=await setup();try{
  const w=x.current(),id=randomUUID(),locationId=randomUUID(),command={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:id,expectedRevision:0,action:{kind:'create',header:{id,revision:1,name:'Market map',locationId,width:300,height:200,paper:'#e9dfc8',roof:'#9c604c'},location:{kind:'location',version:1,id:locationId,name:'Eichenfurt',type:'city',sections:[],detailMaps:[],keyLinks:[]}}};
  const before=x.store.cities(w.token);x.store.db.exec("CREATE TEMP TRIGGER city_create_fault BEFORE INSERT ON city_receipt BEGIN SELECT RAISE(ABORT, 'late city receipt fault'); END");
  assert.throws(()=>x.store.executeCity(command),/late city receipt fault/);assert.deepEqual(x.store.cities(w.token),before);assert.equal(x.store.preparation(w.token).locations.some(l=>l.document.id===locationId),false);
  x.store.db.exec('DROP TRIGGER city_create_fault');assert.equal(x.store.executeCity(command).header.id,id);
 }finally{await x.cleanup();}
});

test('a lost city-create acknowledgement checks the same command and keeps exactly one city',async()=>{
 const x=await setup();try{
  const send=x.window.campaign.executeCity;let lost=true;x.window.campaign.executeCity=async command=>{const result=await send(command);if(lost&&command.action.kind==='create'){lost=false;throw new Error('Reply lost');}return result;};
  x.document.getElementById('city-location').value='new';x.enter('city-new-location-name','Eichenfurt');x.enter('city-new-name','Market map');
  const form=x.document.getElementById('city-new-form');form.onsubmit(new x.window.Event('submit',{cancelable:true}));await until(()=>x.document.getElementById('city-create-submit').textContent==='Ergebnis prüfen'&&!x.document.getElementById('city-create-submit').disabled);
  assert.equal(x.document.getElementById('city-new-name').disabled,true);const first=x.writes.find(c=>c.action.kind==='create');assert.ok(first);
  form.onsubmit(new x.window.Event('submit',{cancelable:true}));await until(()=>x.document.getElementById('city-title').textContent==='Market map');
  const creates=x.writes.filter(c=>c.action.kind==='create');assert.equal(creates.length,2);assert.deepEqual(creates[0],creates[1]);assert.equal(x.store.cities(x.current().token).cities.filter(c=>c.id===first.cityId).length,1);assert.equal(x.document.getElementById('city-new-name').disabled,false);
 }finally{await x.cleanup();}
});

test('editing generated fractional geometry keeps its exact footprint and rooms',async()=>{
 const x=await setup();try{
  const w=x.current(),before=x.store.city(w.token,x.cityIds.one),house=before.units.find(u=>u.id===x.unitIds.one),outline=[{x:-6.181549069751054,y:-4.701152662374079},{x:6.181549069751054,y:-4.701152662374079},{x:6.181549069751054,y:4.701152662374079},{x:-6.181549069751054,y:4.701152662374079}],changed={...house,position:{x:88.06179712671788,y:44.99221806038171},angle:.123456789,outline,rooms:[{id:randomUUID(),name:'Room',outline:[{x:0,y:0},{x:1,y:0},{x:0,y:1}],notes:'Keep'}]};
  x.store.executeCity({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:x.cityIds.one,expectedRevision:before.header.revision,action:{kind:'change',upsert:[changed],remove:[],label:'Fractional generator result'}});await x.ui.openCity();await x.select();
  for(const id of ['city-x','city-y','city-angle','city-house-width','city-house-depth'])assert.equal(x.document.getElementById(id).getAttribute('step'),'any');
  x.enter('city-unit-name','Taverne');x.enter('city-unit-notes','First paragraph\n\nSecond paragraph');assert.equal(await x.ui.flushCity(),true);const saved=x.store.city(w.token,x.cityIds.one).units.find(u=>u.id===house.id);
  assert.deepEqual(saved.position,changed.position);assert.deepEqual(saved.outline,outline);assert.deepEqual(saved.rooms,changed.rooms);assert.equal(saved.angle,changed.angle);assert.equal(saved.notes,'First paragraph\n\nSecond paragraph');assert.equal(saved.protected,true);
 }finally{await x.cleanup();}
});

test('an acknowledged city-create rejection keeps the form editable for correction',async()=>{
 const x=await setup();try{
  const send=x.window.campaign.executeCity;x.window.campaign.executeCity=async()=>({ok:false,error:'Location changed'});x.enter('city-new-name','Correct this city');
  const form=x.document.getElementById('city-new-form');form.onsubmit(new x.window.Event('submit',{cancelable:true}));await until(()=>x.document.getElementById('city-create-status').textContent==='Location changed');
  assert.equal(x.document.getElementById('city-new-name').disabled,false);assert.equal(x.document.getElementById('city-create-submit').textContent,'Stadt anlegen');
  x.window.campaign.executeCity=send;x.enter('city-new-name','Corrected city');form.onsubmit(new x.window.Event('submit',{cancelable:true}));await until(()=>x.document.getElementById('city-title').textContent==='Corrected city');
 }finally{await x.cleanup();}
});

test('late city creation cannot replace or unlock another campaign context',async()=>{
 const x=await setup();let release;try{
  const send=x.window.campaign.executeCity;x.window.campaign.executeCity=async command=>{const response=await send(command);return new Promise(resolve=>{release=()=>resolve(response);});};x.enter('city-new-name','Alpha new city');
  x.document.getElementById('city-new-form').onsubmit(new x.window.Event('submit',{cancelable:true}));await until(()=>!!release);await x.activate('Beta');release();await settle();assert.equal(x.document.getElementById('city-title').textContent,'Beta one');assert.equal(x.document.getElementById('city-new-name').disabled,false);assert.equal(x.store.cities(x.current().token).cities.length,2);
 }finally{if(release)release();await x.cleanup();}
});

test('finishing a drawn city path holds its points and tool until the acknowledgement',async()=>{
 const x=await setup();let release;try{
  const canvas=x.document.getElementById('city-map');canvas.getScreenCTM=()=>({inverse:()=>({})});canvas.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}});
  x.document.getElementById('city-tool').value='road';
  const point=async(a,b)=>{const e=new x.window.Event('click',{bubbles:true});e.clientX=a;e.clientY=b;canvas.dispatchEvent(e);await settle();};
  await point(10,20);await point(90,20);const send=x.window.campaign.executeCity;x.window.campaign.executeCity=async command=>{const result=await send(command);return new Promise(resolve=>{release=()=>resolve(result);});};
  x.click('city-finish');await until(()=>!!release);assert.equal(x.document.getElementById('city-tool').disabled,true);assert.equal(canvas.getAttribute('aria-busy'),'true');await point(200,200);assert.match(x.document.getElementById('city-path-hint').textContent,/gespeichert/);
  release();await until(()=>!x.document.getElementById('city-tool').disabled);const written=x.writes.at(-1).action.upsert;assert.equal(written.find(u=>u.kind==='road').via.length,0);assert.deepEqual(written.filter(u=>u.kind==='node').map(u=>u.point),[{x:10,y:20},{x:90,y:20}]);assert.equal(canvas.getAttribute('aria-busy'),'false');
 }finally{if(release)release();await x.cleanup();}
});

async function placementPoint(x,a,b){const canvas=x.document.getElementById('city-map');canvas.getScreenCTM=()=>({inverse:()=>({})});canvas.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}});const e=new x.window.Event('click',{bubbles:true});e.clientX=a;e.clientY=b;canvas.dispatchEvent(e);await settle();}
async function beginPlacement(x){x.click('city-place-open');await until(()=>!x.document.getElementById('city-placement').hidden);}

test('city placement previews on the map and cancels without a write or camera jump',async()=>{
 const x=await setup();try{
  const canvas=x.document.getElementById('city-map'),before=canvas.getAttribute('viewBox'),house=x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one);
  await beginPlacement(x);await placementPoint(x,160,80);x.click('city-placement-right');assert.equal(x.writes.length,0);assert.equal(canvas.getAttribute('viewBox'),before);assert.equal(x.document.getElementById('city-x').value,'160');assert.equal(x.document.getElementById('city-angle').value,'90');assert.equal(x.document.getElementById('city-unit-fields').disabled,true);assert.equal(await x.ui.flushCity(),false);
  x.click('city-placement-cancel');assert.equal(x.document.getElementById('city-placement').hidden,true);assert.equal(x.document.getElementById('city-unit-fields').disabled,false);assert.equal(x.document.getElementById('city-x').value,String(house.position.x));assert.deepEqual(x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===house.id),house);assert.equal(x.writes.length,0);
 }finally{await x.cleanup();}
});

test('one accepted placement preserves all house content and is one undo and redo step',async()=>{
 const x=await setup();try{
  const w=x.current(),before=x.store.city(w.token,x.cityIds.one),original=before.units.find(u=>u.id===x.unitIds.one);
  await beginPlacement(x);await placementPoint(x,160,80);x.click('city-placement-right');x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement').hidden);
  assert.equal(x.writes.length,1);const saved=x.store.city(w.token,x.cityIds.one).units.find(u=>u.id===original.id);assert.deepEqual(saved,{...original,position:{x:160,y:80},angle:Math.PI/2,protected:true});
  x.click('city-undo');await until(()=>x.document.getElementById('city-x').value===String(original.position.x));assert.deepEqual(x.store.city(w.token,x.cityIds.one).units.find(u=>u.id===original.id),original);
  x.click('city-redo');await until(()=>x.document.getElementById('city-x').value==='160');assert.deepEqual(x.store.city(w.token,x.cityIds.one).units.find(u=>u.id===original.id),saved);
 }finally{await x.cleanup();}
});

test('city placement checks the identical command after a lost acknowledgement',async()=>{
 const x=await setup();try{
  const send=x.window.campaign.executeCity;let lost=true;x.window.campaign.executeCity=async c=>{const result=await send(c);if(lost){lost=false;throw new Error('Placement reply lost');}return result;};
  await beginPlacement(x);await placementPoint(x,160,80);x.click('city-placement-right');x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement-accept').textContent==='Ergebnis prüfen'&&!x.document.getElementById('city-placement-accept').disabled);
  assert.equal(x.document.getElementById('city-placement-cancel').disabled,true);await placementPoint(x,200,100);assert.equal(x.document.getElementById('city-x').value,'160');x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement').hidden);assert.equal(x.writes.length,2);assert.deepEqual(x.writes[0],x.writes[1]);
  const saved=x.store.city(x.current().token,x.cityIds.one);assert.equal(saved.header.revision,3);assert.equal(saved.units.find(u=>u.id===x.unitIds.one).position.x,160);
 }finally{await x.cleanup();}
});

test('late placement acknowledgements cannot replace another campaign or its open preview',async()=>{
 const x=await setup();let release;try{
  const send=x.window.campaign.executeCity;x.window.campaign.executeCity=async c=>{const result=await send(c);return new Promise(resolve=>{release=()=>resolve(result);});};await beginPlacement(x);await placementPoint(x,160,80);x.click('city-placement-accept');await until(()=>!!release);
  await x.activate('Beta');await x.select();await beginPlacement(x);await placementPoint(x,200,90);release();await settle();assert.equal(x.document.getElementById('city-title').textContent,'Beta one');assert.equal(x.document.getElementById('city-placement').hidden,false);assert.equal(x.document.getElementById('city-x').value,'200');assert.equal(x.document.getElementById('city-placement-cancel').disabled,false);
 }finally{if(release)release();await x.cleanup();}
});

test('a placement cannot overwrite a foreign revision and retains its local preview',async()=>{
 const x=await setup();try{
  const w=x.current();await beginPlacement(x);await placementPoint(x,160,80);const city=x.store.city(w.token,x.cityIds.one),house=city.units.find(u=>u.id===x.unitIds.one);x.store.executeCity({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:city.header.id,expectedRevision:city.header.revision,action:{kind:'change',upsert:[{...house,notes:'Foreign note'}],remove:[],label:'Foreign edit'}});
  x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement-status').textContent.includes('Stadtstand geändert'));assert.equal(x.document.getElementById('city-placement').hidden,false);assert.equal(x.document.getElementById('city-x').value,'160');assert.equal(x.store.city(w.token,city.header.id).units.find(u=>u.id===house.id).notes,'Foreign note');x.click('city-placement-cancel');x.click('city-unit-reload');await until(()=>x.document.getElementById('city-unit-notes').value==='Foreign note');
 }finally{await x.cleanup();}
});

test('city camera zoom and view history do not save authoring or move with house selection',async()=>{
 const x=await setup();try{
  const canvas=x.document.getElementById('city-map'),before=canvas.getAttribute('viewBox'),zoom=x.document.getElementById('city-zoom');zoom.value='2';zoom.oninput();const closer=canvas.getAttribute('viewBox');assert.notEqual(closer,before);await x.select();assert.equal(canvas.getAttribute('viewBox'),closer);assert.equal(x.writes.length,0);
  const back=[...x.document.querySelector('[data-canvas-for="city-map"]').querySelectorAll('button')][0];back.click();assert.equal(canvas.getAttribute('viewBox'),before);assert.equal(x.writes.length,0);
 }finally{await x.cleanup();}
});

test('four quarter turns and an unchanged placement create no authoring history',async()=>{
 const x=await setup();try{const before=x.store.city(x.current().token,x.cityIds.one);await beginPlacement(x);for(let i=0;i<4;i++)x.click('city-placement-right');x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement').hidden);assert.equal(x.writes.length,0);assert.deepEqual(x.store.city(x.current().token,x.cityIds.one),before);}finally{await x.cleanup();}
});

test('starting placement drains newer text typed during a held inspector acknowledgement',async()=>{
 const x=await setup();let release;try{
  const send=x.window.campaign.executeCity;let first=true;x.window.campaign.executeCity=async c=>{const result=await send(c);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(result);});}return result;};x.enter('city-unit-notes','First note');x.click('city-place-open');await until(()=>!!release);x.enter('city-unit-notes','Later note\n\nKeep both paragraphs');release();await until(()=>!x.document.getElementById('city-placement').hidden);await placementPoint(x,160,80);x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement').hidden);const house=x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one);assert.equal(house.notes,'Later note\n\nKeep both paragraphs');assert.deepEqual(house.position,{x:160,y:80});assert.equal(x.writes.length,3);
 }finally{if(release)release();await x.cleanup();}
});

test('city chooser shows the confirmed map and retains it while placement prevents leaving',async()=>{
 const x=await setup();try{
  await x.choose('two');assert.equal(x.document.getElementById('city-select').value,x.cityIds.two);await x.select('two');await beginPlacement(x);const chooser=x.document.getElementById('city-select');chooser.value=x.cityIds.one;chooser.onchange();await settle();assert.equal(chooser.value,x.cityIds.two);assert.equal(x.document.getElementById('city-title').textContent,'Alpha two');assert.equal(x.document.getElementById('city-placement').hidden,false);x.click('city-placement-cancel');await x.choose('one');assert.equal(chooser.value,x.cityIds.one);
 }finally{await x.cleanup();}
});

test('a city reference cannot discard an unfinished house placement',async()=>{
 const x=await setup();try{await beginPlacement(x);await placementPoint(x,160,80);await assert.rejects(x.ui.openCityReference(x.cityIds.two,x.unitIds.two),/Stadteingabe bleibt offen/);assert.equal(x.document.getElementById('city-title').textContent,'Alpha one');assert.equal(x.document.getElementById('city-placement').hidden,false);assert.equal(x.document.getElementById('city-x').value,'160');assert.equal(x.writes.length,0);}finally{await x.cleanup();}
});

test('building placement cannot silently replace an unfinished generation preview',async()=>{
 const x=await setup();try{x.click('city-generate');await settle();await x.drain();assert.equal(x.document.getElementById('city-preview-actions').hidden,false);x.click('city-place-open');await settle();assert.equal(x.document.getElementById('city-placement').hidden,true);assert.equal(x.document.getElementById('city-preview-actions').hidden,false);assert.equal(x.writes.length,0);}finally{await x.cleanup();}
});

test('a placement replay keeps its original revision after a post-acknowledgement UI failure',async()=>{
 const x=await setup();const get=x.document.getElementById.bind(x.document);let fail=false;
 try{
  x.document.getElementById=id=>{if(fail&&id==='city-count'){fail=false;throw new Error('UI refresh fault');}return get(id);};
  const send=x.window.campaign.executeCity;let first=true;x.window.campaign.executeCity=async command=>{const result=await send(command);if(first){first=false;fail=true;}return result;};
  await beginPlacement(x);await placementPoint(x,160,80);x.click('city-placement-accept');await until(()=>get('city-placement-accept').textContent==='Ergebnis prüfen'&&!get('city-placement-accept').disabled);x.click('city-placement-accept');await until(()=>get('city-placement').hidden);assert.equal(x.writes.length,2);assert.deepEqual(x.writes[0],x.writes[1]);assert.equal(x.store.city(x.current().token,x.cityIds.one).header.revision,3);
 }finally{x.document.getElementById=get;await x.cleanup();}
});

test('shared Atlas routes target clicks into the house preview and retains selection and camera through history',async()=>{
 const x=await setup(),saved=Object.fromEntries(['DOMPoint','requestAnimationFrame','cancelAnimationFrame','localStorage'].map(k=>[k,globalThis[k]]));let atlas;
 try{
  const w=x.current(),storage=new Map();Object.assign(globalThis,{DOMPoint:class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return{x:this.x,y:this.y};}},requestAnimationFrame:fn=>{queueMicrotask(()=>fn(0));return 0;},cancelAnimationFrame:()=>{},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});
  const binding={id:randomUUID(),kind:'city',ownerId:x.cityIds.one,parent:'world',parentId:null,x:1000,y:2000,angle:0,revision:0};x.store.executeAtlas({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'bind',binding,expectedRevision:null}});
  x.window.campaign.atlasRenderView=async token=>({ok:true,value:x.store.atlasRenderView(token)});
  atlas=new x.ui.CampaignAtlasWorkbench({selectRoom:async()=>{},roomDraft:()=>null,flush:()=>x.ui.flushCity(),updated:async()=>{},status:(message,error)=>x.messages.push({message,error})});
  for(const select of x.document.querySelectorAll('#campaign-atlas select'))if(!Object.hasOwn(select,'value')){select.add=o=>select.append(o);let chosen='';Object.defineProperty(select,'value',{get(){const options=[...select.querySelectorAll('option')];return options.find(o=>o.value===chosen)?.value??options[0]?.value??'';},set(v){chosen=String(v);}});}
  const svg=x.document.getElementById('campaign-map');Object.defineProperty(svg,'clientWidth',{value:800});Object.defineProperty(svg,'clientHeight',{value:500});svg.getScreenCTM=()=>({inverse:()=>({})});
  atlas.activate(w);await atlas.open();await atlas.navigate('city',x.cityIds.one,x.unitIds.one);await settle();
  const original=x.store.city(w.token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one),before=x.writes.length;
  await beginPlacement(x);const event=new x.window.Event('click',{bubbles:true});event.button=0;event.clientX=1160-Number(svg.dataset.atlasOriginX);event.clientY=2080-Number(svg.dataset.atlasOriginY);svg.dispatchEvent(event);await settle();x.click('city-placement-right');await settle();
  assert.equal(x.document.getElementById('city-x').value,'160');assert.equal(x.document.getElementById('city-y').value,'80');assert.equal(x.ui.atlasCityState().placement.draft.angle,Math.PI/2);assert.equal(svg.querySelectorAll('[data-city-placement-origin]').length,1);assert.equal(x.writes.length,before);
  const camera=()=>[svg.getAttribute('viewBox'),svg.dataset.atlasOriginX,svg.dataset.atlasOriginY],held=camera();x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement').hidden);await settle();assert.deepEqual(camera(),held);
  x.click('atlas-undo');await until(()=>!x.document.getElementById('city-inspector').hidden&&x.document.getElementById('city-x').value===String(original.position.x));assert.equal(x.document.getElementById('city-unit-name').value,original.name);assert.deepEqual(camera(),held);
  x.click('atlas-redo');await until(()=>!x.document.getElementById('city-inspector').hidden&&x.document.getElementById('city-x').value==='160');assert.equal(x.document.getElementById('city-angle').value,'90');assert.deepEqual(camera(),held);
 }finally{try{atlas?.hide();}finally{await x.cleanup();Object.assign(globalThis,saved);}}
});

test('shared Atlas receives generation preview changes before a city write',async()=>{
 const x=await setup(),snapshots=[];const changed=()=>snapshots.push(x.ui.atlasCityState());x.document.addEventListener('atlas-draft',changed);
 try{x.click('city-generate');await settle();await x.drain();const draft=snapshots.at(-1),stored=x.store.city(x.current().token,x.cityIds.one);assert.ok(draft.view.units.filter(u=>u.kind==='building').length>stored.units.filter(u=>u.kind==='building').length);assert.equal(x.writes.length,0);x.click('city-cancel-preview');assert.deepEqual(x.ui.atlasCityState().view.units,stored.units);}finally{x.document.removeEventListener('atlas-draft',changed);await x.cleanup();}
});

test('a definitively rejected Atlas placement replay unlocks the retained preview after a lost request',async()=>{
 const x=await setup();try{
  const send=x.window.campaign.executeCity;let lost=true;x.window.campaign.executeCity=async c=>{if(lost){lost=false;throw new Error('Request outcome lost before commit');}return send(c);};
  await beginPlacement(x);await placementPoint(x,160,80);x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement-accept').textContent==='Ergebnis prüfen');assert.equal(x.document.getElementById('city-placement-cancel').disabled,true);
  const w=x.current(),city=x.store.city(w.token,x.cityIds.one),house=city.units.find(u=>u.id===x.unitIds.one);x.store.executeCity({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,cityId:city.header.id,expectedRevision:city.header.revision,action:{kind:'change',upsert:[{...house,notes:'Foreign writer must survive'}],remove:[],label:'Foreign edit'}});
  x.click('city-placement-accept');await until(()=>x.document.getElementById('city-placement-accept').textContent==='Platzierung übernehmen');assert.equal(x.document.getElementById('city-placement-cancel').disabled,false);assert.equal(x.document.getElementById('city-x').value,'160');
  x.click('city-placement-cancel');assert.equal(x.document.getElementById('city-placement').hidden,true);assert.equal(x.store.city(w.token,x.cityIds.one).units.find(u=>u.id===house.id).notes,'Foreign writer must survive');
 }finally{await x.cleanup();}
});

async function placeSurface(x,callbacks={}){
 const saved=Object.fromEntries(['DOMPoint','requestAnimationFrame','cancelAnimationFrame','localStorage'].map(k=>[k,globalThis[k]])),storage=new Map();Object.assign(globalThis,{DOMPoint:class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return{x:this.x,y:this.y};}},requestAnimationFrame:fn=>{queueMicrotask(()=>fn(0));return 0;},cancelAnimationFrame:()=>{},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});
 const atlas=new x.ui.CampaignAtlasWorkbench({selectRoom:async()=>{},roomDraft:()=>null,flush:()=>x.ui.flushCity(),updated:async()=>{},status:(message,error)=>x.messages.push({message,error}),...callbacks});
 for(const select of x.document.querySelectorAll('select'))if(!Object.hasOwn(select,'value')){select.add=o=>select.append(o);let chosen='';Object.defineProperty(select,'value',{get(){const options=[...select.querySelectorAll('option')];return options.find(o=>o.value===chosen)?.value??options[0]?.value??'';},set(v){chosen=String(v);}});}
 for(const dialog of x.document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 const svg=x.document.getElementById('campaign-map');Object.defineProperty(svg,'clientWidth',{value:800});Object.defineProperty(svg,'clientHeight',{value:500});svg.getScreenCTM=()=>({inverse:()=>({})});atlas.activate(x.current());await atlas.open();await settle();
 return {atlas,svg,point:async(a,b)=>{const event=new x.window.Event('click',{bubbles:true});event.button=0;event.clientX=a-Number(svg.dataset.atlasOriginX);event.clientY=b-Number(svg.dataset.atlasOriginY);svg.dispatchEvent(event);await settle();},async close(){try{atlas.hide();await x.cleanup();}finally{Object.assign(globalThis,saved);}}};
}

test('shared Atlas creates a precise canonical place, reads it and returns from editing to the same view',async()=>{
 const x=await setup();let read,edit;const surface=await placeSurface(x,{readLocation:async(id,current)=>{if(current())read=id;},editLocation:async(id,current,back)=>{if(current())edit={id,back};}});
 try{const original=x.store.world(x.current().token).places.length,view=()=>[surface.svg.getAttribute('viewBox'),surface.svg.dataset.atlasOriginX,surface.svg.dataset.atlasOriginY];await surface.point(123.25,456.75);const before=view();x.click('atlas-create-place');await until(()=>x.document.getElementById('atlas-place-dialog').open);x.enter('atlas-place-name','Canonical chapel');x.enter('atlas-place-description','First prose\n\nSecond prose');x.enter('atlas-place-notes','Private\n\nKeep exact');x.document.getElementById('atlas-place-form').dispatchEvent(new x.window.Event('submit',{cancelable:true}));await until(()=>!x.document.getElementById('atlas-place-dialog').open);assert.deepEqual(view(),before);
  const place=x.store.campaignAtlas(x.current().token).places.find(p=>p.name==='Canonical chapel');assert.deepEqual(place.point,{x:123.25,y:456.75});assert.equal(surface.svg.querySelectorAll('[data-kind="place"][data-id="'+place.locationId+'"]').length,1);const marker=surface.svg.querySelector('[data-kind="place"][data-id="'+place.locationId+'"]');assert.equal(marker.querySelector('text').getAttribute('x'),marker.querySelector('circle').getAttribute('cx'));x.click('atlas-place-read');await until(()=>read===place.locationId);x.click('atlas-place-edit');await until(()=>!!edit);await edit.back();assert.deepEqual(view(),before);assert.equal(x.document.getElementById('atlas-selection-title').textContent,'Canonical chapel');
  x.click('atlas-undo');await until(()=>x.store.world(x.current().token).places.length===original);assert.equal(x.store.preparation(x.current().token).locations.some(p=>p.document.id===place.locationId),false);x.click('atlas-redo');await until(()=>x.store.world(x.current().token).places.length===original+1);assert.equal(x.store.preparation(x.current().token).locations.find(p=>p.document.id===place.locationId).document.sections[1].markdown,'Private\n\nKeep exact');
 }finally{await surface.close();}
});

test('lost shared-place acknowledgements replay the identical command and create no duplicate location',async()=>{
 const x=await setup(),surface=await placeSurface(x);let lost=true;const send=x.window.campaign.executeAtlas,commands=[];x.window.campaign.executeAtlas=async c=>{commands.push(structuredClone(c));const result=await send(c);if(lost){lost=false;throw new Error('lost precise-place response');}return result;};
 try{await surface.point(12.5,20.5);x.click('atlas-create-place');await until(()=>x.document.getElementById('atlas-place-dialog').open);x.enter('atlas-place-name','Only once');x.enter('atlas-place-notes','Unchanged draft');x.document.getElementById('atlas-place-form').dispatchEvent(new x.window.Event('submit',{cancelable:true}));await until(()=>!x.document.getElementById('atlas-place-check').hidden);assert.equal(x.document.getElementById('atlas-place-save').disabled,true);assert.equal(x.document.getElementById('atlas-place-notes').value,'Unchanged draft');x.click('atlas-place-check');await until(()=>!x.document.getElementById('atlas-place-dialog').open);assert.equal(commands.length,2);assert.deepEqual(commands[0],commands[1]);assert.equal(x.store.preparation(x.current().token).locations.filter(p=>p.document.name==='Only once').length,1);
 }finally{await surface.close();}
});



function mapEvidence(svg,name){
 if(!process.env.ATLAS_QA_OUTPUT)return;
 const copy=svg.cloneNode(true),[,,width,height]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
 copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width','800');copy.setAttribute('height',String(Math.round(800*height/width)));
 mkdirSync(process.env.ATLAS_QA_OUTPUT,{recursive:true});writeFileSync(path.join(process.env.ATLAS_QA_OUTPUT,name),copy.outerHTML);
}

// The actual shared surface, drawing controller and SQLite transactions together.
async function interiorSurface(x){
 let workspace=x.current(),selected=null,surface;
 x.store.executeAtlas({commandId:randomUUID(),token:workspace.token,campaignId:workspace.campaign.id,action:{kind:'bind',binding:{id:randomUUID(),kind:'city',ownerId:x.cityIds.one,parent:'world',parentId:null,x:1000,y:2000,angle:0,revision:0},expectedRevision:null}});
 x.window.campaign.drawing=async token=>({ok:true,value:x.store.drawing(token)});
 x.ui.initDrawing((message,error)=>x.messages.push({message,error}),()=>workspace,()=>workspace.rooms.find(r=>r.id===selected)??null,async()=>true,async next=>{workspace=next;await surface.atlas.refresh();},()=>surface?.atlas.render());
 await x.ui.activateDrawing(workspace);
 surface=await placeSurface(x,{flush:()=>x.ui.flushDrawing(),selectRoom:async id=>{selected=id;},updated:async next=>{workspace=next;await x.ui.activateDrawing(next);}});
 surface.svg.setPointerCapture=()=>{};
 await surface.atlas.navigate('city',x.cityIds.one,x.unitIds.one);
 x.click('atlas-building-interior');await until(()=>surface.atlas.family==='interior');await settle();
 const point=(type,at,target=surface.svg)=>{const e=new x.window.Event(type,{bubbles:true});Object.assign(e,{button:0,pointerId:7,clientX:at.x-Number(surface.svg.dataset.atlasOriginX),clientY:at.y-Number(surface.svg.dataset.atlasOriginY)});target.dispatchEvent(e);};
 const tool=name=>x.document.querySelector('[data-drawing-tool="'+name+'"]').click();
 return {...surface,tool,point,workspace:()=>workspace,async activate(name){await x.activate(name);workspace=x.current();selected=null;await x.ui.activateDrawing(workspace);surface.atlas.activate(workspace);},async rectangle(name,a,b,target){tool('room-rectangle');x.enter('drawing-room-name',name);point('pointerdown',a,typeof target==='string'?surface.svg.querySelector(target):target);point('pointermove',b);point('pointerup',b);await until(()=>x.store.campaignAtlas(x.current().token).workspace.rooms.some(r=>r.name===name)).catch(error=>{error.message+=' '+JSON.stringify(x.messages);throw error;});await x.drain();await settle();}};
}

test('invalid Atlas image size clears its error when the export is retried and cancelled',async()=>{
 const x=await setup(),s=await placeSurface(x),get=id=>x.document.getElementById(id);let release;
 try{
  const before=x.store.db.serialize();get('atlas-export-size').value='128';x.click('atlas-export-png');await until(()=>get('atlas-save-status').dataset.error==='true');assert.match(get('atlas-save-status').textContent,/256 und 8192/);
  x.window.campaign.landscapeRegion=()=>new Promise(resolve=>release=resolve);x.window.campaign.cancelLandscapeRaster=async()=>({ok:true,value:undefined});
  get('atlas-export-size').value='2048';x.click('atlas-export-png');await until(()=>!!release);assert.equal(get('atlas-save-status').dataset.error,'false');assert.match(get('atlas-save-status').textContent,/vorbereitet/);
  x.click('atlas-export-cancel');release({ok:false,error:'Cancelled'});await until(()=>!get('atlas-export-png').disabled);assert.equal(get('atlas-save-status').textContent,'Ausgabe abgebrochen');assert.equal(get('atlas-save-status').dataset.error,'false');assert.ok(x.store.db.serialize().equals(before));
 }finally{await s.close();}
});

test('house interior reopens through the same visible action without creating a second scope',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const first=s.atlas.scopeId,before=x.store.campaignAtlas(x.current().token),binding=before.bindings.find(b=>b.ownerId===first);
  assert.equal(binding.parentId,x.unitIds.one);
  assert.equal(x.document.getElementById('drawing-quick-tools').parentElement.id,'atlas-drawing-tools');
  assert.equal(x.document.getElementById('drawing-toolbar').parentElement.id,'atlas-drawing-tools');
  assert.equal(x.document.getElementById('atlas-new-name').closest('label').hidden,true);
  assert.equal(x.document.getElementById('atlas-room-draw'),null);
  x.click('atlas-interior-house');await until(()=>s.atlas.family==='city');await settle();
  assert.equal(s.atlas.selection.id,x.unitIds.one);
  assert.equal(x.document.getElementById('atlas-building-interior').textContent,'Innenraum öffnen');
  x.click('atlas-building-interior');await until(()=>s.atlas.family==='interior');await settle();
  assert.equal(s.atlas.scopeId,first);assert.equal(x.store.campaignAtlas(x.current().token).scopes.length,before.scopes.length);
  assert.equal(x.document.getElementById('atlas-interior-context').hidden,false);
  assert.equal(x.document.getElementById('atlas-building-interior').hidden,true);
 }finally{await s.close();}
});

test('house inspector counts canonical rooms and opens the same interior after return and fresh activation',async()=>{
 const x=await setup(),s=await interiorSurface(x),get=id=>x.document.getElementById(id);
 try{
  const scope=s.atlas.scopeId,frame=s.atlas.frame(scope);
  await s.rectangle('Taproom',{x:frame.x-3,y:frame.y-3},{x:frame.x,y:frame.y+3});
  await s.rectangle('Store',{x:frame.x,y:frame.y-3},{x:frame.x+3,y:frame.y+3});
  const returnHome=async()=>{x.click('atlas-interior-house');await until(()=>s.atlas.family==='city');await settle();assert.equal(get('city-interior').textContent,'Innenraum öffnen');assert.equal(get('city-interior-status').textContent,'Innenraum angelegt · 2 Räume');};
  await returnHome();
  assert.equal(x.store.city(x.current().token,x.cityIds.one).units.find(u=>u.id===x.unitIds.one).rooms.length,0);
  const before=x.store.db.serialize();x.click('city-interior');await until(()=>s.atlas.family==='interior');await settle();assert.equal(s.atlas.scopeId,scope);assert.ok(x.store.db.serialize().equals(before));
  await s.activate('Alpha');await s.atlas.open();await s.atlas.navigate('city',x.cityIds.one,x.unitIds.one);await settle();
  assert.equal(get('city-interior-status').textContent,'Innenraum angelegt · 2 Räume');
  x.click('city-interior');await until(()=>s.atlas.family==='interior');assert.equal(s.atlas.scopeId,scope);
  await returnHome();
  x.store.executeAtlas({commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action:{kind:'bind',binding:{id:randomUUID(),kind:'city',ownerId:x.cityIds.two,parent:'world',parentId:null,x:1500,y:2000,angle:0,revision:0},expectedRevision:null}});
  await s.atlas.refresh();await s.atlas.navigate('city',x.cityIds.two,x.unitIds.two);await settle();
  assert.equal(get('city-interior-status').textContent,'Innenraum noch nicht angelegt.');assert.equal(get('city-interior').textContent,'Innenraum anlegen');
  x.click('city-interior');await until(()=>s.atlas.family==='interior');assert.notEqual(s.atlas.scopeId,scope);
  x.click('atlas-interior-house');await until(()=>s.atlas.family==='city');await settle();assert.equal(get('city-interior-status').textContent,'Innenraum angelegt · 0 Räume');
 }finally{await s.close();}
});

test('a prepared house interior shares its actual camera and selection through the live portal and return',async()=>{
 const x=await setup(),s=await interiorSurface(x),get=id=>x.document.getElementById(id);
 try{
  const frame=s.atlas.frame(s.atlas.scopeId);await s.rectangle('Prepared tavern',{x:frame.x-3,y:frame.y-3},{x:frame.x+3,y:frame.y+3});
  const room=x.store.campaignAtlas(x.current().token).workspace.rooms.find(r=>r.name==='Prepared tavern');await s.atlas.navigate('room',room.id);
  const view=()=>[s.svg.getAttribute('viewBox'),s.svg.dataset.atlasOriginX,s.svg.dataset.atlasOriginY],before=view(),root=get('campaign-atlas'),home=root.parentNode,db=x.store.db.serialize();
  const map=x.document.createElement('section'),navigation=x.document.createElement('aside'),console=x.document.createElement('aside');x.document.body.append(map,navigation,console);
  const portal=s.atlas.liveSurface();portal.mount(map,navigation,console);portal.show(true);await settle();await settle();
  assert.equal(map.contains(s.svg),true);assert.equal(x.document.querySelectorAll('#campaign-map').length,1);assert.deepEqual(view(),before);assert.equal(s.atlas.selection.id,room.id);
  assert.equal(navigation.contains(get('atlas-to-party')),true);assert.equal(console.contains(get('atlas-save-status')),true);
  portal.show(false);assert.equal(root.hidden,true);portal.show(true);await settle();await settle();assert.deepEqual(view(),before);
  portal.unmount();await s.atlas.open();assert.equal(root.parentNode,home);assert.equal(root.contains(get('atlas-to-party')),true);assert.equal(root.contains(get('atlas-save-status')),true);
  await s.atlas.navigate('room',room.id);assert.equal(s.atlas.scopeId,room.scopeId);assert.equal(s.atlas.selection.id,room.id);assert.ok(x.store.db.serialize().equals(db));
 }finally{await s.close();}
});

test('Atlas search navigation retains an unfinished room instead of silently discarding it',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const scope=s.atlas.scopeId,before=x.store.db.serialize();
  s.tool('room-rectangle');x.enter('drawing-room-name','Unfinished store');await x.ui.atlasDrawingPoint({x:-3,y:-3});
  await s.atlas.navigate('city',x.cityIds.two);
  assert.equal(s.atlas.family,'interior');assert.equal(s.atlas.scopeId,scope);
  assert.equal(x.ui.atlasDrawingDraft().path.length,1);assert.ok(x.store.db.serialize().equals(before));
  assert.ok(x.messages.some(m=>m.error&&/abschließen oder verwerfen/.test(m.message)));
  await x.ui.atlasDrawingPoint({x:3,y:3});x.click('drawing-finish');await until(()=>x.store.campaignAtlas(x.current().token).workspace.rooms.some(r=>r.name==='Unfinished store'));await x.drain();
  await s.atlas.navigate('city',x.cityIds.two);assert.equal(s.atlas.family,'city');assert.equal(s.atlas.cityId,x.cityIds.two);
  assert.equal(x.store.campaignAtlas(x.current().token).workspace.rooms.find(r=>r.name==='Unfinished store').scopeId,scope);
 }finally{await s.close();}
});

test('Atlas finds complete room prose through the directory worker while its map retains geometry only',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const f=s.atlas.frame(s.atlas.scopeId);await s.rectangle('Cellar',{x:f.x-3,y:f.y-3},{x:f.x+3,y:f.y+3});
  const room=x.store.campaignAtlas(x.current().token).workspace.rooms.find(r=>r.name==='Cellar'),edit={commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,roomId:room.id,expectedRevision:room.revision,name:room.name,polygons:room.polygons,sections:room.sections.map(section=>section.kind==='markdown'?{...section,markdown:'Only in prose: azurblauer Kellerfund'}:section)};
  x.store.executeAtlas({...edit,action:{kind:'room-edit',edit}});await s.atlas.refresh();
  assert.equal(JSON.stringify(s.atlas.data).includes('azurblauer Kellerfund'),false);assert.ok(s.atlas.data.workspace.rooms.every(r=>!('sections' in r)));
  const read=x.window.campaign.roomDirectory;let searched;x.window.campaign.roomDirectory=(...args)=>(searched=read(...args));
  x.document.getElementById('atlas-search').value='azurblauer Kellerfund';x.document.getElementById('atlas-search').oninput();assert.ok(searched);assert.equal((await searched).ok,true);await settle();
  const match=[...x.document.getElementById('atlas-search-results').querySelectorAll('button')].find(b=>b.textContent.includes('Cellar'));assert.ok(match);match.click();await until(()=>s.atlas.selection?.id===room.id);
  assert.equal(s.atlas.scopeId,room.scopeId);assert.equal(x.store.atlasRoom(x.current().token,room.id).sections[0].markdown,edit.sections[0].markdown);
 }finally{await s.close();}
});

test('a scope search result retains an unfinished room and opens after explicit cancellation',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const scope=s.atlas.scopeId;
  const created=await s.atlas.write({kind:'dungeon-create',name:'Other cellar',x:300,y:400},true),other=created.result.id;
  const before=x.store.db.serialize();s.tool('room-rectangle');await x.ui.atlasDrawingPoint({x:-3,y:-3});
  await s.atlas.chooseScope(other);
  assert.equal(s.atlas.scopeId,scope);assert.equal(x.ui.atlasDrawingDraft().path.length,1);assert.ok(x.store.db.serialize().equals(before));
  s.atlas.cancel();await s.atlas.chooseScope(other);
  assert.equal(s.atlas.scopeId,other);assert.equal(x.ui.atlasDrawingDraft().floor.scopeId,other);assert.equal(x.ui.atlasDrawingDraft().path.length,0);
 }finally{await s.close();}
});

test('a city navigation waiting for editors cannot move the next campaign',async()=>{
 const x=await setup(),s=await interiorSurface(x);let release;
 try{
  s.atlas.opts.flush=()=>new Promise(resolve=>release=resolve);
  const pending=s.atlas.navigate('city',x.cityIds.two);await until(()=>!!release);
  await s.activate('Beta');await s.atlas.open();
  const before=x.store.db.serialize(),family=s.atlas.family,box=s.svg.getAttribute('viewBox');
  release(true);await pending;
  assert.equal(s.atlas.scopeId,null);assert.equal(s.atlas.selection,null);assert.equal(s.atlas.family,family);assert.equal(s.svg.getAttribute('viewBox'),box);assert.ok(x.store.db.serialize().equals(before));
 }finally{if(release)release(false);await s.close();}
});

test('a newer Atlas navigation wins over an older request waiting for editors',async()=>{
 const x=await setup(),s=await interiorSurface(x);let release;
 try{
  let first=true;s.atlas.opts.flush=()=>{if(first){first=false;return new Promise(resolve=>release=resolve);}return Promise.resolve(true);};
  const pending=s.atlas.navigate('city',x.cityIds.two);await until(()=>!!release);
  await s.atlas.navigate('city',x.cityIds.one,x.unitIds.one);
  const box=s.svg.getAttribute('viewBox');release(true);await pending;
  assert.equal(s.atlas.cityId,x.cityIds.one);assert.equal(s.atlas.selection.id,x.unitIds.one);assert.equal(s.svg.getAttribute('viewBox'),box);
 }finally{if(release)release(false);await s.close();}
});

test('a late Atlas navigation read cannot select an object in the next campaign',async()=>{
 const x=await setup(),s=await interiorSurface(x);let release;
 try{
  const read=x.window.campaign.atlasRenderView;let first=true;
  x.window.campaign.atlasRenderView=async(...args)=>{const result=await read(...args);if(first){first=false;return new Promise(resolve=>release=()=>resolve(result));}return result;};
  const pending=s.atlas.navigate('city',x.cityIds.two);await until(()=>!!release);
  await s.activate('Beta');await s.atlas.open();
  const box=s.svg.getAttribute('viewBox'),before=x.store.db.serialize();release();await pending;
  assert.equal(s.atlas.selection,null);assert.equal(s.atlas.cityId,null);assert.equal(s.atlas.scopeId,null);assert.equal(s.svg.getAttribute('viewBox'),box);assert.ok(x.store.db.serialize().equals(before));
 }finally{if(release)release();await s.close();}
});

test('drawing a second house room from a selected corner does not move the first room',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const f=s.atlas.frame(s.atlas.scopeId),at=(a,b)=>({x:f.x+a,y:f.y+b});
  await s.rectangle('Taproom',at(-4,-4),at(0,4));
  const first=x.store.campaignAtlas(x.current().token).workspace.rooms.find(r=>r.name==='Taproom');
  s.tool('select');await s.point('click',at(-2,0),s.svg.querySelector('[data-kind="room"][data-id="'+first.id+'"]'));await settle();
  const handle=s.svg.querySelector('[data-atlas-vertex][data-id="'+first.id+'"]');assert.ok(handle);
  const vertex=first.polygons[0].outer[0];
  await s.rectangle('Store',at(vertex.x,vertex.y),at(vertex.x-3,vertex.y+3),'[data-atlas-vertex][data-id="'+first.id+'"]');
  const after=x.store.campaignAtlas(x.current().token).workspace.rooms;
  assert.equal(after.length,2);assert.deepEqual(after.find(r=>r.id===first.id).polygons,first.polygons);assert.equal(after.find(r=>r.id===first.id).revision,first.revision);
  s.tool('door');assert.equal(s.atlas.rectangleDrag,null);assert.equal(x.document.querySelector('[data-drawing-tool="room-rectangle"]').getAttribute('aria-pressed'),'false');
  assert.equal(x.document.querySelector('[data-drawing-tool="door"]').getAttribute('aria-pressed'),'true');
 }finally{await s.close();}
});

test('rotated house room labels remain on the screen axes at projected room positions',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const f=s.atlas.frame(s.atlas.scopeId);
  await s.rectangle('Taproom',{x:f.x-3,y:f.y-3},{x:f.x+3,y:f.y+3});
  const city=x.store.city(x.current().token,x.cityIds.one),u=city.units.find(u=>u.id===x.unitIds.one);
  x.store.executeCity({commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,cityId:x.cityIds.one,expectedRevision:city.header.revision,action:{kind:'change',upsert:[{...u,angle:Math.PI/2}],remove:[],label:'Rotate house'}});
  await s.atlas.refresh();
  const labels=s.svg.querySelector('[data-atlas-room-labels="'+s.atlas.scopeId+'"]');assert.ok(labels);assert.equal(labels.getAttribute('transform'),null);
  assert.ok(labels.querySelector('[data-room-number]'));assert.ok([...labels.querySelectorAll('text')].some(n=>n.textContent==='Taproom'));
  const room=x.store.campaignAtlas(x.current().token).workspace.rooms.find(r=>r.name==='Taproom'),number=labels.querySelector('[data-room-number]'),frame=s.atlas.frame(room.scopeId),vertices=room.polygons[0].outer,center={x:vertices.reduce((n,p)=>n+p.x,0)/4,y:vertices.reduce((n,p)=>n+p.y,0)/4};
  const projected={x:frame.x-center.y,y:frame.y+center.x};
  assert.ok(Math.abs(Number(number.getAttribute('x'))-(projected.x-Number(s.svg.dataset.atlasOriginX)))<1e-7);
  assert.ok(Math.abs(Number(number.getAttribute('y'))-(projected.y-Number(s.svg.dataset.atlasOriginY)))<1e-7);
  const box={x:frame.x-15,y:frame.y-15,width:30,height:30},mpp=box.width/2048,atlas=x.store.campaignAtlas(x.current().token),options={grid:false,level:0,references:false,floorId:'ground',roofs:false,scopeId:room.scopeId,labelUnitsPerPixel:box.width/660};
  const exported=x.ui.atlasRegionSVG(atlas,[],box,2048,new Map(),options),exportLabels=exported.querySelector('[data-atlas-room-labels="'+room.scopeId+'"]'),exportName=exportLabels.querySelector('[data-room-name]'),exportNumber=exportLabels.querySelector('[data-room-number]');
  assert.equal(exportLabels.getAttribute('transform'),null);assert.equal(exportName.textContent,'Taproom');assert.equal(Number(exportName.getAttribute('font-size')),12*options.labelUnitsPerPixel);
  assert.ok(Math.abs(Number(exportNumber.getAttribute('x'))-(projected.x-box.x))<1e-7);assert.ok(Math.abs(Number(exportNumber.getAttribute('y'))-(projected.y-box.y))<1e-7);
  assert.equal(exported.querySelector('[data-city-unit="'+u.id+'"]').querySelector('text'),null);
  const cityExport=x.ui.atlasRegionSVG(atlas,[],box,2048,new Map(),{...options,scopeId:null,roofs:true});
  const caption=cityExport.querySelector('[data-city-unit="'+u.id+'"]').querySelector('text');assert.equal(caption.textContent,u.name);assert.ok(Number(caption.getAttribute('font-size'))<=12*options.labelUnitsPerPixel);
  assert.equal(cityExport.querySelector('[data-atlas-room-labels="'+room.scopeId+'"]'),null);

 }finally{await s.close();}
});


test('switching house floors preserves a pending room on its original floor until it is completed',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const scopeId=s.atlas.scopeId;
  await s.atlas.write({kind:'drawing',command:{commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action:{kind:'floor',scopeId,id:'upper',name:'Obergeschoss',elevation:3,cloneId:null,hidden:false}}},true);
  s.tool('room-rectangle');x.enter('drawing-room-name','Ground room');await x.ui.atlasDrawingPoint({x:-3,y:-3});
  const picker=x.document.getElementById('atlas-floor'),before=x.store.db.serialize();
  picker.value='upper';picker.onchange();await settle();
  assert.equal(s.atlas.floorId,'ground');assert.equal(picker.value,'ground');assert.equal(x.ui.atlasDrawingDraft().floor.floorId,'ground');assert.equal(x.ui.atlasDrawingDraft().path.length,1);assert.ok(x.store.db.serialize().equals(before));
  await x.ui.atlasDrawingPoint({x:3,y:3});x.click('drawing-finish');await until(()=>x.store.campaignAtlas(x.current().token).workspace.rooms.some(r=>r.name==='Ground room'));await x.drain();
  assert.equal(x.store.campaignAtlas(x.current().token).workspace.rooms.find(r=>r.name==='Ground room').floorId,'ground');
  picker.value='upper';picker.onchange();await until(()=>s.atlas.floorId==='upper');assert.equal(x.ui.atlasDrawingDraft().floor.floorId,'upper');
 }finally{await s.close();}
});


test('a newer request to stay on the original floor cancels a waiting floor switch',async()=>{
 const x=await setup(),s=await interiorSurface(x);let release;
 try{
  const scopeId=s.atlas.scopeId;
  await s.atlas.write({kind:'drawing',command:{commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action:{kind:'floor',scopeId,id:'upper',name:'Obergeschoss',elevation:3,cloneId:null,hidden:false}}},true);
  s.atlas.opts.flush=()=>new Promise(resolve=>release=resolve);
  const picker=x.document.getElementById('atlas-floor'),before=x.store.db.serialize();picker.value='upper';picker.onchange();await until(()=>!!release);
  assert.equal(picker.value,'ground');picker.value='ground';picker.onchange();release(true);await settle();
  assert.equal(s.atlas.floorId,'ground');assert.equal(picker.value,'ground');assert.equal(x.ui.atlasDrawingDraft().floor.floorId,'ground');assert.ok(x.store.db.serialize().equals(before));
 }finally{if(release)release(false);await s.close();}
});

test('a waiting floor switch cannot change the next campaign or report success there',async()=>{
 const x=await setup(),s=await interiorSurface(x);let release;
 try{
  const scopeId=s.atlas.scopeId;
  await s.atlas.write({kind:'drawing',command:{commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action:{kind:'floor',scopeId,id:'upper',name:'Obergeschoss',elevation:3,cloneId:null,hidden:false}}},true);
  s.atlas.opts.flush=()=>new Promise(resolve=>release=resolve);const picker=x.document.getElementById('atlas-floor');picker.value='upper';picker.onchange();await until(()=>!!release);
  await s.activate('Beta');const before=x.store.db.serialize(),messages=x.messages.length;
  release(true);await settle();assert.equal(s.atlas.floorId,'ground');assert.equal(s.atlas.scopeId,null);assert.equal(x.messages.length,messages);assert.ok(x.store.db.serialize().equals(before));
 }finally{if(release)release(false);await s.close();}
});


test('group-view room labels come from live public perception rather than GM room names',async()=>{
 const x=await setup(),s=await interiorSurface(x);
 try{
  const f=s.atlas.frame(s.atlas.scopeId),at=(a,b)=>({x:f.x+a,y:f.y+b});
  await s.rectangle('GM: Taproom contact',at(-3,-3),at(3,3));
  await s.rectangle('GM: Hidden vault',at(10,-3),at(13,3));
  const rooms=x.store.campaignAtlas(x.current().token).workspace.rooms,first=rooms.find(r=>r.name==='GM: Taproom contact'),secret=rooms.find(r=>r.name==='GM: Hidden vault'),command=action=>({commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action});
  for(const room of [first,secret]){
   const saved=x.store.drawing(x.current().token).styles.find(t=>t.id===room.id);
   const c=command({kind:'style',expectedRevision:saved?.revision??null,style:{id:room.id,scopeId:room.scopeId,revision:saved?.revision??0,ceilingMeters:3,fill:'#e2dac4',wall:'#3d4b45',publicLabel:room.id===first.id?'Public taproom':'',secret:room.id===secret.id}});x.store.executeAtlas({...c,action:{kind:'drawing',command:c}});
  }
  const pc=x.store.executeLive(command({kind:'create-character',profile:{name:'Iri',speedFeet:30}})).character;
  let live=x.store.live(x.current().token);
  x.store.executeLive(command({kind:'membership',characterId:pc.id,expectedRevision:pc.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:live.focusRevision}));
  const scene=x.store.executeLive(command({kind:'initialize',expectedRosterRevision:x.store.live(x.current().token).rosterRevision})).scene;
  x.store.executeDungeon(command({kind:'place',sceneId:scene.id,expectedPositionRevision:0,pose:{scopeId:first.scopeId,floorId:first.floorId,roomId:first.id,x:0,y:0,z:0}}));
  const player=action=>{const v=x.store.playerView(x.current().token);return x.store.executePlayer({...command(action),expectedRevision:v.settings.revision,expectedFocusId:v.focusId,expectedFocusRevision:v.focusRevision,expectedFocusMembershipRevision:v.focusMembershipRevision,expectedFocusLocationId:v.focusLocationId});};
  player({kind:'observer',observer:{characterId:pc.id,enabled:true,rangeMeters:6,darkvisionMeters:0,eyeHeightMeters:1.7}});
  player({kind:'settings',settings:{blank:true,mode:'follow',imageId:null,title:'',labels:true,light:'daylight',displayId:null,fullscreen:false}});
  await s.atlas.refresh();const a=x.store.campaignAtlas(x.current().token);assert.equal(x.store.playerView(x.current().token).frame.mode,'blank');assert.ok(a.perception);assert.ok(a.perception.labels.some(l=>l.text==='Public taproom'));
  const before=x.store.db.serialize(),toggle=x.document.getElementById('atlas-perception');toggle.checked=true;toggle.onchange();await until(()=>s.svg.querySelector('[data-atlas-public-view]')?.textContent.includes('Public taproom'));
  const labels=s.svg.querySelector('[data-atlas-public-view]');assert.ok(labels);mapEvidence(s.svg,'interior-public.svg');assert.match(labels.textContent,/Public taproom/);assert.doesNotMatch(labels.textContent,/GM:|Hidden vault/);assert.equal(labels.querySelectorAll('[data-room-number]').length,0);assert.equal(labels.getAttribute('transform'),null);assert.ok(x.store.db.serialize().equals(before));assert.equal(x.store.playerView(x.current().token).frame.mode,'blank');
  s.point('pointerdown',at(0,0));s.point('pointermove',at(2,2));s.point('pointerup',at(2,2));s.point('click',at(0,0));await settle();assert.ok(x.store.db.serialize().equals(before));assert.equal(x.ui.atlasDrawingDraft().path.length,0);
  player({kind:'settings',settings:{blank:true,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}});await s.atlas.refresh();assert.equal(s.svg.querySelector('[data-atlas-public-view]').textContent,'');
  const read=x.window.campaign.atlasRenderView,stable=x.store.db.serialize();x.window.campaign.atlasRenderView=async()=>({ok:false,error:'Context unavailable'});await s.atlas.refresh();assert.match(x.document.getElementById('atlas-view-status').textContent,/nicht verfügbar/);assert.equal(x.document.getElementById('atlas-view-refresh').hidden,false);assert.equal(s.svg.querySelector('[data-atlas-public-view]').querySelectorAll('circle,path').length,0);assert.doesNotMatch(s.svg.textContent,/GM:|Public taproom/);
  x.window.campaign.atlasRenderView=read;x.click('atlas-view-refresh');await until(()=>s.atlas.travelReadState==='ready');assert.ok(s.svg.querySelector('[data-atlas-public-view]').querySelector('circle'));assert.ok(x.store.db.serialize().equals(stable));
  toggle.checked=false;toggle.onchange();await until(()=>!s.svg.querySelector('[data-atlas-public-view]'));const gm=s.svg.querySelector('[data-atlas-room-labels="'+first.scopeId+'"]');assert.match(gm.textContent,/GM: Taproom contact/);assert.match(gm.textContent,/GM: Hidden vault/);assert.equal(gm.querySelectorAll('[data-room-number]').length,2);
 }finally{await s.close();}
});


test('world group preview shows public facts and the precise party point through confirmed travel while the player screen stays blank',async()=>{
 const x=await setup(),s=await placeSurface(x),command=action=>({commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action});
 try{
  x.store.executeAtlas({...command(null),action:{kind:'bind',binding:{id:randomUUID(),kind:'city',ownerId:x.cityIds.one,parent:'world',parentId:null,x:1000,y:2000,angle:0,revision:0},expectedRevision:null}});
  const map=x.store.campaignAtlas(x.current().token).terrain;
  const c=command({kind:'cell',mapId:map.id,expectedRevision:map.revision,cell:{q:0,r:0,level:0,terrain:'plains',elevationM:0,climate:null,road:false,river:false,label:'GM: Raid site',faction:'GM',interrupt:''}});x.store.executeAtlas({...c,action:{kind:'world',command:c}});
  const locationId=randomUUID(),rootMap=x.store.campaignAtlas(x.current().token).terrain;x.store.executeAtlas(command({kind:'location-create',mapId:rootMap.id,expectedMapRevision:rootMap.revision,point:{x:1020,y:2030},document:{kind:'location',version:1,id:locationId,name:'GM: Secret plot',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}));
  const pc=x.store.executeLive(command({kind:'create-character',profile:{name:'Iri',speedFeet:30}})).character;let live=x.store.live(x.current().token);
  x.store.executeLive(command({kind:'membership',characterId:pc.id,expectedRevision:pc.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:live.focusRevision}));
  const scene=x.store.executeLive(command({kind:'initialize',expectedRosterRevision:x.store.live(x.current().token).rosterRevision})).scene;
  x.store.executeAtlasTravel({...command({kind:'place',point:{x:1001,y:2001},expectedPositionRevision:0,expectedMembershipRevision:scene.membershipRevision}),sceneId:scene.id});
  const player=action=>{const v=x.store.playerView(x.current().token);return x.store.executePlayer({...command(action),expectedRevision:v.settings.revision,expectedFocusId:v.focusId,expectedFocusRevision:v.focusRevision,expectedFocusMembershipRevision:v.focusMembershipRevision,expectedFocusLocationId:v.focusLocationId});};
  player({kind:'settings',settings:{blank:true,mode:'follow',imageId:null,title:'',labels:true,light:'daylight',displayId:null,fullscreen:false}});
  player({kind:'mask',mapId:map.id,q:0,r:0,hidden:false,blocksSight:false,publicLabel:'Public gate'});
  player({kind:'discover',characterIds:[pc.id],mapId:map.id,q:0,r:0,locationId,publicLabel:'Public shrine'});
  await s.atlas.refresh();const before=x.store.db.serialize(),clock=x.store.liveScene(x.current().token,scene.id).clock.instantMs;
  const toggle=x.document.getElementById('atlas-perception');toggle.checked=true;toggle.onchange();await until(()=>s.svg.querySelector('[data-atlas-public-view]')?.textContent.includes('Public gate'));
  assert.ok(x.store.db.serialize().equals(before));assert.equal(x.store.liveScene(x.current().token,scene.id).clock.instantMs,clock);
  assert.match(s.svg.querySelector('[data-atlas-public-view]').textContent,/Public shrine/);assert.doesNotMatch(s.svg.querySelector('[data-atlas-public-view]').textContent,/GM:|House one|Alpha one/);assert.equal(x.store.currentPlayerFrame().mode,'blank');
  await s.atlas.setFamily('terrain',false);assert.equal(x.document.getElementById('atlas-landscape-tools').hidden,true);assert.equal(s.atlas.landscape.active,false);
  await s.atlas.setFamily('travel',false);assert.ok(x.store.db.serialize().equals(before));
  const checkPoint=()=>{const a=s.atlas.data,p=a.scene.position,at=p.city?{x:1000+p.city.x,y:2000+p.city.y}:p.outdoor,token=[...s.svg.querySelector('[data-atlas-public-view]').querySelectorAll('circle')].at(-1);assert.ok(at);assert.ok(Math.abs(Number(token.getAttribute('cx'))-(at.x-Number(s.svg.dataset.atlasOriginX)))<1e-7);assert.ok(Math.abs(Number(token.getAttribute('cy'))-(at.y-Number(s.svg.dataset.atlasOriginY)))<1e-7);};checkPoint();
  const requests=[];x.window.campaign.executeAtlasTravel=async(c,groupView)=>{requests.push(groupView);try{return{ok:true,value:x.store.executeAtlasTravel(c,groupView)};}catch(e){return{ok:false,error:e.message};}};
  const preview=x.store.previewAtlasTravel(x.current().token,{x:1020,y:2010});assert.equal(await s.atlas.travel({kind:'start',preview}),true);
  let journey=s.atlas.data.localJourney;assert.ok(journey);assert.equal(await s.atlas.travel({kind:'step',id:journey.id,expectedRevision:journey.revision}),true);
  const stable=x.store.db.serialize(),invalid={...command({kind:'place',point:{x:1005,y:2005},expectedPositionRevision:s.atlas.data.scene.position.revision,expectedMembershipRevision:scene.membershipRevision}),sceneId:scene.id};assert.throws(()=>x.store.executeAtlasTravel(invalid,'invalid'),/Gruppensicht/);assert.throws(()=>x.store.campaignAtlas(x.current().token,'invalid'),/Gruppensicht/);assert.ok(x.store.db.serialize().equals(stable));
  assert.deepEqual(requests,[true,true]);assert.ok(s.atlas.data.publicFrame?.map);assert.ok(s.svg.querySelector('[data-atlas-public-view]'));checkPoint();mapEvidence(s.svg,'world-public.svg');assert.ok(BigInt(x.store.liveScene(x.current().token,scene.id).clock.instantMs)>BigInt(clock));assert.equal(x.store.currentPlayerFrame().mode,'blank');
 }finally{await s.close();}
});


test('group map without a focused party has no GM fallback and changes no stored data',async()=>{
 const x=await setup(),s=await placeSurface(x);
 try{
  x.store.playerView(x.current().token);const before=x.store.db.serialize(),toggle=x.document.getElementById('atlas-perception');toggle.checked=true;toggle.onchange();await until(()=>s.atlas.groupView&&s.atlas.travelReadState==='ready');
  const projection=s.svg.querySelector('[data-atlas-public-view]');assert.ok(projection);assert.equal(projection.querySelectorAll('circle,path,text').length,0);assert.equal(projection.textContent,'');assert.match(x.document.getElementById('atlas-view-status').textContent,/Keine fokussierte Gruppe/);assert.ok(x.store.db.serialize().equals(before));
 }finally{await s.close();}
});

test('public region export preserves unseen remembered terrain while drawing current visible landscape',async()=>{
 const x=await setup(),command=action=>({commandId:randomUUID(),token:x.current().token,campaignId:x.current().campaign.id,action});
 try{
  const atlas=x.store.campaignAtlas(x.current().token),map=atlas.terrain,size=map.hexMeters;
  x.store.executeWorld(command({kind:'map',map:{...map,cells:[{q:2,r:0,level:0,terrain:'forest',elevationM:0,climate:null,road:false,river:false,label:'GM old forest',faction:'',interrupt:''}]},expectedRevision:map.revision}));
  const pc=x.store.executeLive(command({kind:'create-character',profile:{name:'Iri',speedFeet:30}})).character,live=x.store.live(x.current().token);
  x.store.executeLive(command({kind:'membership',characterId:pc.id,expectedRevision:pc.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:live.focusRevision}));
  const scene=x.store.executeLive(command({kind:'initialize',expectedRosterRevision:x.store.live(x.current().token).rosterRevision})).scene;
  x.store.executeAtlasTravel({...command({kind:'place',point:{x:0,y:0},expectedPositionRevision:0,expectedMembershipRevision:scene.membershipRevision}),sceneId:scene.id});
  const player=action=>{const v=x.store.playerView(x.current().token);return x.store.executePlayer({...command(action),expectedRevision:v.settings.revision,expectedFocusId:v.focusId,expectedFocusRevision:v.focusRevision,expectedFocusMembershipRevision:v.focusMembershipRevision,expectedFocusLocationId:v.focusLocationId});};
  player({kind:'settings',settings:{blank:true,mode:'follow',imageId:null,title:'',labels:true,light:'daylight',displayId:null,fullscreen:false}});
  player({kind:'observer',observer:{characterId:pc.id,enabled:true,rangeMeters:1,darkvisionMeters:0,eyeHeightMeters:1.7}});
  player({kind:'discover',characterIds:[pc.id],mapId:map.id,q:2,r:0,locationId:null,publicLabel:'Remembered forest'});
  const patch=(x,terrain)=>({id:randomUUID(),revision:0,kind:'patch',name:'GM secret terrain',points:[],polygons:[{outer:[{x:x-200,y:-200},{x:x+200,y:-200},{x:x+200,y:200},{x:x-200,y:200}],holes:[]}],resolution:size,width:0,values:{terrain}});
  x.store.executeAtlas(command({kind:'landscape-batch',records:[{record:patch(0,'hills'),expectedRevision:null},{record:patch(2*size,'water'),expectedRevision:null}]}));
  const a=x.store.campaignAtlas(x.current().token,true),frame=a.publicFrame,box={x:-size,y:-size,width:5*size,height:2*size};assert.equal(frame.mode,'map');
  const remembered=frame.map.cells.find(c=>c.q===2&&c.r===0);assert.equal(remembered.visible,false);assert.equal(remembered.terrain,'forest');assert.equal(frame.map.cells.find(c=>c.q===0&&c.r===0).visible,true);
  const raster={campaignId:a.campaignId,revision:a.revision,box,width:1,height:1,data:'data:image/png;base64,'+require('pngjs').PNG.sync.write({width:1,height:1,data:Buffer.from([127,168,189,255])}).toString('base64')};
  const bytes=x.store.db.serialize(),records=x.store.landscapeRegion(x.current().token,box).records,svg=x.ui.publicAtlasSVG(a,box,frame,records,box.width/800,[raster]);
  const image=svg.querySelector('[data-landscape-raster]');assert.ok(image,'The bounded terrain raster remains available');assert.equal(image.parentElement.getAttribute('clip-path'),'url(#visible-landscape)','Current raster tiles must share the current-visibility clip with vector contours');
  mapEvidence(svg,'public-landscape-export.svg');
  const paths=[...svg.querySelectorAll('clipPath path')],polygons=paths.map(p=>{const values=p.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);return values.reduce((points,v,i)=>{if(i%2===0)points.push({x:v,y:values[i+1]});return points;},[]);});
  const covered=(x,y)=>polygons.some(points=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;});
  assert.equal(covered(-box.x,-box.y),true,'Current visible landscape must remain available');
  assert.equal(covered(2*size-box.x,-box.y),false,'Current GM changes must not cover an unseen remembered hex');
  assert.equal(covered(4*size-box.x,-box.y),false,'Unknown hex must remain outside the landscape projection');
  const allRemembered={...frame,map:{...frame.map,cells:frame.map.cells.map(cell=>({...cell,visible:false}))}},rememberedSVG=x.ui.publicAtlasSVG(a,box,allRemembered,records,box.width/800,[raster]);assert.equal(rememberedSVG.querySelectorAll('[data-landscape-raster]').length,0,'A current raster must not replace remembered terrain');assert.equal(rememberedSVG.querySelectorAll('[data-landscape-id]').length,0,'No current landscape layer may be drawn without current public visibility');
  assert.doesNotMatch(svg.textContent,/GM secret terrain|GM old forest/);assert.ok(x.store.db.serialize().equals(bytes));assert.equal(x.store.currentPlayerFrame().mode,'blank');
 }finally{await x.cleanup();}
});
