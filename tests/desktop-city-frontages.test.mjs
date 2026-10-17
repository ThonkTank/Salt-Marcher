import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/city-model.ts'],outfile:'.build/city-frontages.cjs',bundle:true,platform:'node',format:'cjs'});
const {generateCity,posed,inside}=createRequire(import.meta.url)('../.build/city-frontages.cjs');
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
