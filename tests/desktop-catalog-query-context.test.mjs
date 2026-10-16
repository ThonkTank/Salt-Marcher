import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
buildSync({entryPoints:['src/app/catalog-ui.ts'],outfile:'.build/catalog-query-context.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),tick=()=>new Promise(r=>setImmediate(r));
async function until(fn){for(let i=0;i<100&&!fn();i++)await tick();assert.ok(fn());}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const page=(name,offset=0,total=100)=>({rows:[{id:name,name,challengeRating:'1',type:'Humanoid',size:'Medium',ac:12,hp:10,xp:200}],offset,total,limit:25});
async function fixture(t,metadataFailure=false){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};Object.assign(globalThis,{window,document});const timers=new Map();let timer=0;globalThis.setTimeout=(fn,delay)=>{timers.set(++timer,{fn,delay});return timer;};globalThis.clearTimeout=id=>timers.delete(id);t.after(()=>Object.assign(globalThis,previous));
 const el=id=>document.getElementById(id),ok=value=>({ok:true,value}),reads=[],messages=[],liveAdds=[];
 window.campaign={creatureInfo:async()=>metadataFailure?{ok:false,error:'Catalog index unavailable'}:ok({notice:'Offlinequelle',hash:'pinned',types:[],sizes:[],habitats:[],alignments:[],subtypes:[]}),creatures:query=>{const d=deferred();reads.push({...d,query});return d.promise;},encounterPlans:async()=>ok([]),encounterTables:async()=>ok([]),lootTables:async()=>ok([]),generatorRegistry:async()=>ok({revision:1,presets:[]}),generationRuns:async()=>ok([]),generationSources:async()=>ok({sources:[],factions:[],locations:[]}),npcs:async()=>ok({rows:[],next:null,total:0})};
 el('catalog-form').reset=()=>{for(const input of el('catalog-form').querySelectorAll('input'))input.value='';for(const select of el('catalog-form').querySelectorAll('select'))select.value=select.options[0]?.value??'';};
 delete require.cache[require.resolve('../.build/catalog-query-context.cjs')];const ui=require('../.build/catalog-query-context.cjs');ui.initCatalog((...args)=>messages.push(args),async()=>{},async(...args)=>{liveAdds.push(args);});for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,writable:true,value:select.options[0]?.getAttribute('value')??''});for(const dialog of document.querySelectorAll('dialog')){dialog.close=()=>{dialog.open=false;};dialog.showModal=()=>{dialog.open=true;};}const w={token:'one',campaign:{id:'camp'}};ui.activateCatalog(w);const opened=ui.openCatalog();await until(()=>metadataFailure?messages.length>0:reads.length===1);
 const resolve=async(index,name,offset=0,total=100)=>{reads[index].resolve(ok(page(name,offset,total)));await tick();await tick();};
 const type=text=>{el('catalog-search').value=text;el('catalog-search').oninput();};
 const debounce=async()=>{for(const [id,entry]of [...timers])if(entry.delay===200){timers.delete(id);entry.fn();}await tick();};
 return{ui,w,el,reads,messages,liveAdds,timers,opened,resolve,type,debounce};
}
test('typing invalidates an older query before debounce and clears old actionable rows',async t=>{
 const x=await fixture(t);x.type('Dragon');await x.resolve(0,'Old goblin');assert.equal(x.el('catalog-rows').querySelectorAll('button').length,0);assert.match(x.el('catalog-page').textContent,/gesucht|geladen|Suche/i);await x.debounce();assert.equal(x.reads[1].query.text,'Dragon');await x.resolve(1,'Dragon');assert.match(x.el('catalog-rows').textContent,/Dragon/);assert.doesNotMatch(x.el('catalog-rows').textContent,/Old goblin/);
});
test('a failed current query has a local error and no stale result or page actions, and submit recovers',async t=>{
 const x=await fixture(t);await x.resolve(0,'Goblin');x.type('Broken');await x.debounce();x.reads[1].resolve({ok:false,error:'Catalog unavailable'});await tick();await tick();assert.equal(x.el('catalog-rows').querySelectorAll('button').length,0);assert.match(x.el('catalog-page').textContent,/Catalog unavailable/);assert.equal(x.el('catalog-prev').disabled,true);assert.equal(x.el('catalog-next').disabled,true);x.el('catalog-form').onsubmit({preventDefault(){}});await until(()=>x.reads.length===3);assert.equal(x.reads[2].query.text,'Broken');await x.resolve(2,'Recovered');assert.match(x.el('catalog-rows').textContent,/Recovered/);
});
test('reset cancels a pending debounce and requests only the unfiltered first page',async t=>{
 const x=await fixture(t);await x.resolve(0,'Goblin');x.el('catalog-next').click();await until(()=>x.reads.length===2);await x.resolve(1,'Second',25);x.type('Dragon');x.el('catalog-reset').click();await until(()=>x.reads.length===3);assert.equal(x.reads[2].query.text,'');assert.equal(x.reads[2].query.offset,0);await x.resolve(2,'Reset');await x.debounce();assert.equal(x.reads.length,3);
});
test('sort cancels debounce and a late error cannot replace the newer sorted page',async t=>{
 const x=await fixture(t);x.type('Dragon');const sort=x.el('catalog-table').querySelector('thead button');sort.click();await until(()=>x.reads.length===2);assert.equal(x.reads[1].query.offset,0);assert.equal(x.reads[1].query.text,'Dragon');await x.resolve(1,'Sorted Dragon');x.reads[0].reject(new Error('Old failure'));await tick();await tick();await x.debounce();assert.equal(x.reads.length,2);assert.match(x.el('catalog-rows').textContent,/Sorted Dragon/);assert.equal(x.messages.filter(m=>m[1]).length,0);
});
test('activation invalidates old rows and late campaign responses',async t=>{
 const x=await fixture(t);await x.resolve(0,'Old campaign');x.ui.activateCatalog({...x.w,token:'two',campaign:{id:'other'}});assert.equal(x.el('catalog-rows').querySelectorAll('button').length,0);const next=x.ui.openCatalog();await until(()=>x.reads.length===2);await x.resolve(1,'Current');await next;assert.match(x.el('catalog-rows').textContent,/Current/);
});

test('index failure is local to the catalog and keeps browsing actions disabled',async t=>{
 const x=await fixture(t,true);await x.opened;assert.match(x.el('catalog-page').textContent,/Catalog index unavailable/);assert.equal(x.el('catalog-page').getAttribute('role'),'alert');assert.equal(x.el('catalog-next').disabled,true);assert.equal(x.reads.length,0);
});
test('an old campaign query cannot overwrite a completed new campaign query',async t=>{
 const x=await fixture(t);x.ui.activateCatalog({...x.w,token:'two',campaign:{id:'other'}});const next=x.ui.openCatalog();await until(()=>x.reads.length===2);await x.resolve(1,'Current');await next;await x.resolve(0,'Old');await x.opened;assert.match(x.el('catalog-rows').textContent,/Current/);assert.doesNotMatch(x.el('catalog-rows').textContent,/Old/);
});
test('a delayed detail read cannot replace a later query error with a false empty result',async t=>{
 const x=await fixture(t),detail=deferred();window.campaign.creature=()=>detail.promise;await x.resolve(0,'Goblin');x.el('catalog-rows').querySelector('button').click();x.type('Broken');await x.debounce();x.reads[1].reject(new Error('Current search failed'));await tick();await tick();detail.resolve({ok:true,value:{id:'Goblin',name:'Goblin',abilities:{},traits:[],actions:[],legendaryActions:[]}});await tick();await tick();assert.match(x.el('catalog-page').textContent,/Current search failed/);assert.equal(x.el('catalog-page').getAttribute('role'),'alert');assert.equal(x.el('catalog-rows').querySelectorAll('button').length,0);
});


test('table lookups preserve the surrounding filters, paging and generation source even before debounce completes',async t=>{
 const x=await fixture(t);await x.resolve(0,'Guard');await x.opened;
 x.type('Guard');x.el('catalog-cr-max').value='2';x.el('catalog-type').value='Humanoid';await x.debounce();await x.resolve(1,'Guard');
 x.el('catalog-next').click();await until(()=>x.reads.length===3);await x.resolve(2,'Guard page two',25);
 const context=x.el('generation-catalog-summary').textContent;
 x.el('encounter-table-new').click();await tick();assert.equal(x.el('table-manager').open,true);
 x.type('Wolf');await x.debounce();assert.equal(x.reads[3].query.text,'Wolf');
 assert.equal(x.el('generation-catalog-summary').textContent,context);
 // Closing also invalidates a lookup still in flight, before the restored query returns.
 x.el('table-close').click();await until(()=>x.reads.length===5);
 assert.equal(x.el('table-manager').open,false);assert.equal(x.el('catalog-search').value,'Guard');
 assert.equal(x.el('catalog-cr-max').value,'2');assert.equal(x.el('catalog-type').value,'Humanoid');
 assert.equal(x.reads[4].query.text,'Guard');assert.equal(x.reads[4].query.offset,25);assert.deepEqual(x.reads[4].query.types,['Humanoid']);
 await x.resolve(4,'Restored Guard',25);await x.resolve(3,'Late Wolf');
 assert.match(x.el('catalog-rows').textContent,/Restored Guard/);assert.doesNotMatch(x.el('catalog-rows').textContent,/Late Wolf/);
 assert.equal(x.el('generation-catalog-summary').textContent,context);
 // Reset inside another clean manager is local too and its queued lookup is cancelled on close.
 x.el('encounter-table-new').click();await tick();x.type('Goblin');x.el('catalog-reset').click();await until(()=>x.reads.length===6);
 assert.equal(x.reads[5].query.text,'');assert.equal(x.el('generation-catalog-summary').textContent,context);
 x.el('table-close').click();await until(()=>x.reads.length===7);await x.resolve(6,'Guard again',25);await x.debounce();assert.equal(x.reads.length,7);
});

test('closing the table manager cannot transfer its late creature selection into the surrounding catalog',async t=>{
 const x=await fixture(t);await x.resolve(0,'Guard');await x.opened;
 const detail=id=>({id,name:id,abilities:{},traits:[],actions:[],legendaryActions:[]});
 window.campaign.creature=async id=>({ok:true,value:detail(id)});x.el('catalog-rows').querySelector('button').click();await tick();await tick();
 assert.match(x.el('catalog-detail').textContent,/Guard/);
 x.el('encounter-table-new').click();await tick();x.type('Wolf');await x.debounce();await x.resolve(1,'Wolf');
 const pending=deferred();window.campaign.creature=()=>pending.promise;x.el('catalog-rows').querySelector('button').click();
 x.el('table-close').click();await until(()=>x.reads.length===3);pending.resolve({ok:true,value:detail('Wolf')});await tick();await tick();
 assert.match(x.el('catalog-detail').textContent,/Guard/);assert.doesNotMatch(x.el('catalog-detail').textContent,/Wolf/);
 await x.resolve(2,'Guard');
});

test('saving a table keeps its searched entry without making that search a generator filter',async t=>{
 const x=await fixture(t);await x.resolve(0,'Guard');await x.opened;
 window.campaign.creature=async id=>({ok:true,value:{id,name:id,abilities:{},traits:[],actions:[],legendaryActions:[]}});
 const writes=[];window.campaign.executeGeneration=async command=>{writes.push(command);return{ok:true,value:{tables:[{...command.action.table,revision:1}],lootTables:[],registry:{revision:1,presets:[]}}};};
 x.el('encounter-table-new').click();await tick();x.el('table-name').value='Waldsaum';x.el('table-name').oninput();
 x.type('Wolf');await x.debounce();await x.resolve(1,'Wolf');x.el('catalog-rows').querySelector('button').click();await tick();await tick();x.el('table-add-creature').click();
 x.el('table-form').onsubmit({preventDefault(){}});await until(()=>!x.el('table-manager').open);
 assert.equal(writes.length,1);assert.deepEqual(writes[0].action.table.entries,[{creatureId:'Wolf',weight:'1'}]);
 assert.equal(x.el('catalog-search').value,'');assert.match(x.el('generation-catalog-summary').textContent,/Keine zusätzlichen/);
 await x.resolve(2,'Restored catalog');assert.match(x.el('catalog-rows').textContent,/Restored catalog/);
});

const detail=id=>({id,name:id,abilities:{str:10},traits:[],actions:[],legendaryActions:[]});
async function detailFixture(t){const x=await fixture(t);window.campaign.creature=async id=>({ok:true,value:detail(id)});window.campaign.saveEncounterPlan=async c=>({ok:true,value:{...c.plan,revision:c.plan.revision+1}});await x.resolve(0,'Guard');await x.opened;x.el('catalog-rows').querySelector('button').click();await until(()=>x.el('catalog-detail').querySelector('h3')?.textContent==='Guard');x.el('encounter-new').click();await until(()=>!x.el('catalog-add').disabled);x.choose=async name=>{const n=x.reads.length;x.el('catalog-form').onsubmit({preventDefault(){}});await until(()=>x.reads.length>n);await x.resolve(n,name);x.el('catalog-rows').querySelector('button').click();await tick();};return x;}
test('pending creature detail removes the previous statblock and its encounter, live and table actions',async t=>{
 const x=await detailFixture(t),held=deferred();x.el('encounter-table-new').click();await until(()=>x.el('table-manager').open);assert.equal(x.el('table-add-creature').disabled,false);window.campaign.creature=()=>held.promise;await x.choose('Wolf');assert.doesNotMatch(x.el('catalog-detail').textContent,/Guard/);assert.match(x.el('catalog-detail').textContent,/geladen/);assert.equal(x.el('catalog-detail').getAttribute('aria-busy'),'true');for(const id of ['catalog-add','catalog-live-add','table-add-creature'])assert.equal(x.el(id).disabled,true);x.el('catalog-add').onclick();x.el('catalog-live-add').onclick();x.el('table-add-creature').onclick();await tick();assert.equal(x.el('encounter-entries').children.length,0);assert.equal(x.el('table-entries').querySelectorAll('input').length,0);assert.deepEqual(x.liveAdds,[]);
 x.el('table-close').click();await until(()=>!x.el('table-manager').open);held.resolve({ok:true,value:detail('Wolf')});await tick();await tick();assert.equal(x.el('catalog-detail').querySelector('h3').textContent,'Guard');assert.equal(x.el('catalog-detail').getAttribute('aria-busy'),'false');
});
for(const message of ['Kreatur nicht gefunden.','Statblock-Speicher ausgefallen'])test(`a failed detail read reports ${message} locally, blocks old actions and retries the same row`,async t=>{
 const x=await detailFixture(t);window.campaign.creature=async()=>({ok:false,error:message});await x.choose('Wolf');assert.equal(x.el('catalog-detail').getAttribute('role'),'alert');assert.match(x.el('catalog-detail').textContent,new RegExp(message));assert.doesNotMatch(x.el('catalog-detail').textContent,/Guard/);assert.equal(x.el('catalog-live-add').disabled,true);x.el('catalog-live-add').onclick();await tick();assert.deepEqual(x.liveAdds,[]);
 window.campaign.creature=async id=>({ok:true,value:detail(id)});x.el('catalog-rows').querySelector('button').click();await until(()=>x.el('catalog-detail').querySelector('h3')?.textContent==='Wolf');assert.equal(x.el('catalog-detail').getAttribute('aria-busy'),'false');assert.notEqual(x.el('catalog-detail').getAttribute('role'),'alert');assert.equal(x.el('catalog-detail').querySelectorAll('input,textarea,button').length,0);x.el('catalog-live-add').onclick();await tick();assert.equal(x.liveAdds[0]?.[0],'Wolf');
});
test('a mismatching creature reply cannot enable handoff for another requested statblock',async t=>{const x=await detailFixture(t);window.campaign.creature=async()=>({ok:true,value:detail('Guard')});await x.choose('Wolf');assert.equal(x.el('catalog-detail').getAttribute('role'),'alert');assert.match(x.el('catalog-detail').textContent,/anderen Kreatur/);assert.equal(x.el('catalog-live-add').disabled,true);});
test('an old detail error cannot clear a newer loaded selection',async t=>{const x=await detailFixture(t),held=deferred();window.campaign.creature=()=>held.promise;await x.choose('Wolf');window.campaign.creature=async id=>({ok:true,value:detail(id)});await x.choose('Dragon');x.messages.length=0;held.resolve({ok:false,error:'Überholter Statblockfehler'});await tick();await tick();assert.equal(x.el('catalog-detail').querySelector('h3').textContent,'Dragon');assert.equal(x.el('catalog-live-add').disabled,false);assert.deepEqual(x.messages,[]);});
test('campaign activation clears the previous statblock, table selection and pending detail authority',async t=>{const x=await detailFixture(t),held=deferred();window.campaign.creature=()=>held.promise;await x.choose('Wolf');x.ui.activateCatalog({...x.w,token:'two',campaign:{id:'other'}});held.resolve({ok:true,value:detail('Wolf')});await tick();await tick();assert.equal(x.el('catalog-detail').querySelector('h3'),null);assert.match(x.el('catalog-detail').textContent,/Wähle eine Kreatur/);assert.equal(x.el('catalog-detail').getAttribute('aria-busy'),'false');assert.match(x.el('table-selected-creature').textContent,/Keine Kreatur/);for(const id of ['catalog-add','catalog-live-add','table-add-creature'])assert.equal(x.el(id).disabled,true);});
