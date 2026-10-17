import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/city-model.ts'],outfile:'.build/city-frontages.cjs',bundle:true,platform:'node',format:'cjs'});
const {generateCity,posed,inside,roadPoints}=createRequire(import.meta.url)('../.build/city-frontages.cjs');
const square=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
function fixture(){return {header:{id:'city',revision:2,width:300,height:220},units:[{id:'a',kind:'node',point:{x:10,y:100}},{id:'b',kind:'node',point:{x:290,y:100}},{id:'road',kind:'road',nodeIds:['a','b'],width:8,via:[]},{id:'district',kind:'district',outline:square(0,0,300,220)},{id:'inn',kind:'building',protected:true,districtId:'district',position:{x:150,y:87},angle:.2,outline:square(-6,-5,12,10),notes:'Keep the inn',rooms:[{id:'original-room'}]}],demographics:{},factions:[]};}
const recipe={districtId:'district',seed:'Market',density:.75,size:10,reach:70,use:'home'},generate=(v,r=recipe,cancel=()=>false,progress=()=>{})=>generateCity(v,r,cancel,progress);
test('frontages form continuous parallel street edges and reproduce without mutating the original inn',async()=>{
 const v=fixture(),before=JSON.stringify(v),a=await generate(v),b=await generate(v);assert.deepEqual(a,b);assert.equal(JSON.stringify(v),before);assert(!a.replaceIds.includes('inn'));assert(a.buildings.length>25);
 const fronts=a.buildings.filter(u=>{const depth=u.outline[2].y-u.outline[0].y;return Math.abs(Math.abs(u.position.y-100)-(4+depth/2+1.3))<.0001;});assert(fronts.length>a.buildings.length*.65);assert(fronts.some(u=>u.position.y<100)&&fronts.some(u=>u.position.y>100));for(const u of a.buildings){assert(u.recipe.algorithm==='street-frontage-v2');assert(posed(u).every(p=>inside(p,v.units[3].outline)));assert(posed(u).every(p=>Math.abs(p.y-100)>=5.19));}
});
test('density changes frontage spacing; districts using one seed keep separate generated identities',async()=>{
 const v=fixture(),low=await generate(v,{...recipe,density:.2}),high=await generate(v,{...recipe,density:1});assert(high.buildings.length>low.buildings.length);const second={...v,units:v.units.map(u=>u.id==='district'?{...u,id:'south'}:u)};const south=await generate(second,{...recipe,districtId:'south'});assert(!south.buildings.some(u=>high.buildings.some(h=>h.id===u.id)));
});
test('narrow water and plaza strips cannot be straddled by generated house footprints',async()=>{
 const v=fixture();v.units.push({id:'water',kind:'water',outline:square(70,0,1,220)},{id:'plaza',kind:'plaza',outline:square(210,0,3,220)});const result=await generate(v);for(const u of result.buildings){const p=posed(u),min=Math.min(...p.map(p=>p.x)),max=Math.max(...p.map(p=>p.x));assert(!(min<71&&max>70));assert(!(min<213&&max>210));}
});
test('street-frontage generation clips distant segments and remains cancellable',async()=>{
 const v=fixture();v.units[0].point.x=-100000;v.units[1].point.x=100000;const result=await generate(v);assert(result.attempts<1000);await assert.rejects(generate(v,recipe,()=>true),/abgebrochen/);let stop=false,yielded=false;await assert.rejects(generate({...fixture(),units:fixture().units.map(u=>u.kind==='district'?{...u,outline:square(0,0,1000,1000)}:u)},{...recipe,size:3,reach:500},()=>stop,()=>{yielded=true;stop=true;}),/abgebrochen/);assert(yielded);
});
test('angled frontage lots fit beside one another without their bounding boxes forcing alternate gaps',async()=>{
 const v=fixture(),angle=Math.PI/6,c=Math.cos(angle),s=Math.sin(angle);v.units[0].point={x:30,y:40};v.units[1].point={x:260,y:40+230*Math.tan(angle)};const result=await generate(v,{...recipe,density:1});assert(result.buildings.length>30);const local=u=>posed(u).map(p=>({x:p.x*c+p.y*s,y:-p.x*s+p.y*c})),boxes=result.buildings.map(u=>{const p=local(u);return{x0:Math.min(...p.map(p=>p.x)),x1:Math.max(...p.map(p=>p.x)),y0:Math.min(...p.map(p=>p.y)),y1:Math.max(...p.map(p=>p.y))};});for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.y0-b.y1,b.y0-a.y1))>=1.19);}
});
test('even a small frontage proposal can be cancelled before it starts publishing work',async()=>{
 let cancelled=false;const pending=generate(fixture(),recipe,()=>cancelled);cancelled=true;await assert.rejects(pending,/abgebrochen/);
});
test('the low end of the density control permits sparse settlement instead of a dense frontage floor',async()=>{
 const low=await generate(fixture(),{...recipe,density:.05}),high=await generate(fixture(),{...recipe,density:1});assert(low.buildings.length>0);assert(low.buildings.length<high.buildings.length*.25);
});
test('optional side streets connect free blocks to the existing road and are deterministic proposals',async()=>{
 const v=fixture(),before=JSON.stringify(v),r={...recipe,lanes:true},a=await generate(v,r),b=await generate(v,r);assert.equal(JSON.stringify(v),before);assert.deepEqual(a,b);
 const streets=a.streets.filter(u=>u.kind==='road'),nodes=new Map(a.streets.filter(u=>u.kind==='node').map(u=>[u.id,u.point]));assert(streets.length>6);assert(a.buildings.length>(await generate(v)).buildings.length);assert(!a.replaceIds.includes('road'));assert(!a.replaceIds.includes('inn'));
 const connected=new Set(v.units.filter(u=>u.kind==='road').flatMap(u=>u.nodeIds));assert(connected.size>1);let changed=true;while(changed){changed=false;for(const u of streets)if(u.nodeIds.some(id=>connected.has(id)))for(const id of u.nodeIds)if(!connected.has(id)){connected.add(id);changed=true;}}
 assert([...nodes.keys()].every(id=>connected.has(id)),'all streets must join existing road node identities, not only cross their line');for(const p of nodes.values())assert(inside(p,v.units[3].outline));assert(streets.length>=nodes.size,'lateral links form actual cycles, not only detached branches');
});
test('side streets avoid protected houses, narrow water, plazas and walls without changing existing roads',async()=>{
 const v=fixture();v.units.push({id:'water',kind:'water',outline:square(75,0,2,220)},{id:'plaza',kind:'plaza',outline:square(200,125,30,30)},{id:'wall-a',kind:'node',point:{x:5,y:180}},{id:'wall-b',kind:'node',point:{x:295,y:180}},{id:'wall',kind:'wall',nodeIds:['wall-a','wall-b'],via:[],width:4});
 const a=await generate(v,{...recipe,lanes:true}),all=[...v.units,...a.streets];for(const street of a.streets.filter(u=>u.kind==='road')){const [p,q]=roadPoints(street,all);for(let t=0;t<=1;t+=.02){const at={x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};assert(!inside(at,posed(v.units[4])));assert(!inside(at,v.units[5].outline));assert(!inside(at,v.units[6].outline));assert(at.y<177);}}
 assert.equal(a.streets.some(u=>u.id==='road'),false);
});
test('accepted side streets remain individually editable and are not duplicated by later density changes',async()=>{
 const v=fixture(),a=await generate(v,{...recipe,lanes:true});const accepted={...v,units:[...v.units,...a.streets,...a.buildings]};const road=a.streets.find(u=>u.kind==='road');road.name='Glockengasse';road.protected=true;
 const again=await generate({...accepted,units:[...accepted.units].reverse()},{...recipe,lanes:true});assert.deepEqual(again.buildings,a.buildings,'canonical road order survives acceptance and database ordering');
 const before=JSON.stringify(accepted),next=await generate(accepted,{...recipe,lanes:true,density:.3});assert.equal(JSON.stringify(accepted),before);assert.equal(next.streets,undefined);assert(!next.replaceIds.includes(road.id));assert(next.replaceIds.includes(a.buildings[0].id));
});
test('multiple source roads do not lay crossing grids on top of earlier proposed blocks',async()=>{
 const v=fixture();v.units.push({id:'north',kind:'node',point:{x:150,y:10}},{id:'south',kind:'node',point:{x:180,y:210}},{id:'cross-road',kind:'road',nodeIds:['north','south'],width:6,via:[]});
 const a=await generate(v,{...recipe,lanes:true}),all=[...v.units,...a.streets],roads=a.streets.filter(u=>u.kind==='road').map(u=>roadPoints(u,all));
 const turn=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){const [a,b]=roads[i],[c,d]=roads[j];assert(!(turn(a,b,c)*turn(a,b,d)<-1e-9&&turn(c,d,a)*turn(c,d,b)<-1e-9),'new streets must share a junction rather than cross at separate nodes');}
});
test('street planning serves both halves of a district attached to separate existing road segments',async()=>{
 const v=fixture();v.header.width=600;v.units[1].point={x:300,y:100};v.units[3].outline=square(0,0,600,220);v.units.push({id:'east',kind:'node',point:{x:590,y:110}},{id:'east-road',kind:'road',nodeIds:['b','east'],width:8,via:[]});
 const a=await generate(v,{...recipe,lanes:true}),nodes=a.streets.filter(u=>u.kind==='node');assert(nodes.some(u=>u.point.x>400));assert(nodes.some(u=>u.point.x<200));
});
test('side-street settings are validated and planning remains cancellable before publication',async()=>{
 await assert.rejects(generate(fixture(),{...recipe,lanes:'yes'}),/Seed, Dichte/);
 let stop=false;const v=fixture();v.units[3].outline=square(0,0,1500,1500);v.units[0].point={x:10,y:750};v.units[1].point={x:1490,y:750};const pending=generate(v,{...recipe,size:3,reach:500,lanes:true},()=>stop);const timer=setTimeout(()=>stop=true,0);try{await assert.rejects(pending,/abgebrochen/);}finally{clearTimeout(timer);}
});
test('a road crossing a ward without an attachable endpoint stays intact rather than receiving a detached network',async()=>{
 const v=fixture();v.units[0].point={x:-100000,y:100};v.units[1].point={x:100000,y:100};const before=JSON.stringify(v),a=await generate(v,{...recipe,lanes:true});assert.equal(JSON.stringify(v),before);assert.equal(a.streets,undefined);assert(a.buildings.length>0);assert(a.attempts<1000);
});
