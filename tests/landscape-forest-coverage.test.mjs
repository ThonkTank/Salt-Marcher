import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/landscape-raster';export * from './src/app/vegetation';export {newLine} from './src/app/landscape-line';"},outfile:'.build/forest-coverage-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {LandscapeRasterizer,vegetationSpec,newLine}=createRequire(import.meta.url)('../.build/forest-coverage-test.cjs');
const box={x:-50,y:-50,width:100,height:100};
const rect=(x,y,w,h)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
const cover=(id='deciduous',polygons=[rect(-40,-40,80,80)],edge=0)=>{
 const vegetation=vegetationSpec(id);vegetation.preset.edge=edge;
 return {id,kind:'vegetation',polygons,vegetation,points:[],values:{terrain:vegetation.preset.terrain},resolution:1};
};
function draw(records,{forest=true,area=box,width=100,height=100,water=()=>false,lines=[],stepped=false}={}){
 const image=new LandscapeRasterizer(area,width,height,0,1,forest),l=image.sampleLattice(),size=l.columns*l.rows;
 image.setTerrainField({heights:new Float32Array(size).fill(100),water:Uint8Array.from({length:size},(_,i)=>water(l.x+i%l.columns*l.dx,l.y+Math.floor(i/l.columns)*l.dy)?1:0)});
 let checkpoints=0;function* checkpoint(){checkpoints++;yield;}
 for(const record of records){
  if(record.vegetation&&stepped)for(const _ of image.paintCoverSteps(record,checkpoint)){}
  else image.paint(record);
 }
 for(const line of lines)image.paintRecordLine(line,1);
 return {pixels:image.finish(),forest:image.forest,checkpoints,image};
}
const at=(f,x,y)=>f[(y+50)*100+x+50];
test('optional semantic channel leaves colour bytes and authored records unchanged',()=>{
 const records=[cover()],before=structuredClone(records),a=draw(records),b=draw(records,{forest:false});
 assert.deepEqual(a.pixels,b.pixels);assert.deepEqual(records,before);assert.equal(b.forest,undefined);
 assert.equal(at(a.forest,0,0),255);assert.equal(at(a.forest,45,0),0);
 assert.deepEqual(a.image.finish(),a.pixels);assert.equal(at(a.forest,0,0),255);
});
test('semantic forest follows holes, water and the same feather as ground colour',()=>{
 const r=cover('deciduous',[{...rect(-40,-40,80,80),holes:[rect(-10,-10,20,20).outer]}],8);
 const {forest}=draw([r],{water:x=>x>20});
 assert.equal(at(forest,0,0),0);assert.equal(at(forest,25,0),0);assert.equal(at(forest,-45,0),0);
 assert(at(forest,-39,0)>0);assert(at(forest,-39,0)<at(forest,-36,0));assert.equal(at(forest,-25,0),255);
});
test('clear, thin and dense corrections compose once over overlapping parts and stay inside their owner',()=>{
 const r=cover();r.vegetation.edits=[
  {mode:'thin',polygons:[rect(-30,-20,30,40),rect(-20,-20,30,40)]},
  {mode:'clear',polygons:[rect(-5,-15,20,30)]},
  {mode:'dense',polygons:[rect(0,-10,10,20),rect(5,-10,10,20)]},
  {mode:'dense',polygons:[rect(40,-20,30,40)]},
 ];
 const {forest,pixels}=draw([r]),uncorrected=structuredClone(r);uncorrected.vegetation.edits=[];
 assert.equal(at(forest,-25,0),77);assert.equal(at(forest,-15,0),77);assert.equal(at(forest,-3,0),0);
 assert.equal(at(forest,3,0),159);assert.equal(at(forest,8,0),159);assert.equal(at(forest,45,0),0);
 assert.deepEqual(pixels,draw([uncorrected]).pixels,'semantic edits must not repaint authored ground colour');
});
test('base forest and later meadow are semantic, arbitrary green pigments are not forest',()=>{
 const base={id:'base',kind:'patch',resolution:10,points:[],polygons:[rect(-40,-40,80,80)],values:{terrain:'forest'}};
 const meadow=cover('meadow',[rect(-20,-20,40,40)]);
 const {forest}=draw([base,meadow]);assert.equal(at(forest,0,0),0);assert.equal(at(forest,30,0),255);
 const image=draw([]).image;image.paintPolygons([rect(-40,-40,80,80)],'#008800');image.finish();assert(image.forest.every(v=>v===0));
 const pigmented=draw([cover()]).image,before=pigmented.forest.slice();
 pigmented.paintColor({id:'pigment',kind:'patch',resolution:1,order:1,points:[],polygons:[rect(-20,-20,40,40)],values:{},paint:{version:2,operation:'paint',target:'ground',color:'#d04040',opacity:.8,flow:1,tip:'round',radius:20,seed:1,fill:true}});
 pigmented.finish();assert.deepEqual(pigmented.forest,before,'ground pigment cannot redefine vegetation');
 const reset={...base,id:'plains',values:{terrain:'plains'},polygons:[rect(-20,-20,40,40)]};
 assert.equal(at(draw([base,reset]).forest,0,0),0);
});
test('baked roads erase the pattern only where ink is painted, including styled dashes',()=>{
 const road={id:'road',kind:'road',points:[{x:-45,y:0},{x:45,y:0}],polygons:[],width:6,resolution:1,values:{}};
 const plain=draw([cover()],{lines:[road]}).forest;assert.equal(at(plain,0,0),0);assert.equal(at(plain,0,10),255);
 const dashed=draw([cover()],{lines:[{...road,line:{...newLine('road'),curve:'linear',style:'dashed',roughness:0}}]}).forest;
 const centre=Array.from({length:70},(_,i)=>at(dashed,i-35,0));assert(centre.includes(0));assert(centre.includes(255));
 // Public polygon/line painters are also used by styled route parts.
 const image=draw([cover()]).image;image.paintLine([{x:-40,y:15},{x:40,y:15}],4,'#aa8855',.5);image.finish();
 assert(at(image.forest,0,15)<255);assert(at(image.forest,0,15)>0);assert.equal(at(image.forest,0,25),255);
});
test('forest tiles and far origins agree exactly, and synchronous and cooperative coverage agree',()=>{
 const r=cover('deciduous',[{...rect(-40,-40,80,80),holes:[rect(-10,-10,20,20).outer]}],8);
 r.vegetation.edits=[{mode:'thin',polygons:[rect(-40,-30,35,60)]}];
 const whole=draw([r]),left=draw([r],{area:{...box,width:50},width:50}),right=draw([r],{area:{...box,x:0,width:50},width:50});
 for(let y=0;y<100;y++){
  assert.deepEqual(left.forest.slice(y*50,(y+1)*50),whole.forest.slice(y*100,y*100+50));
  assert.deepEqual(right.forest.slice(y*50,(y+1)*50),whole.forest.slice(y*100+50,(y+1)*100));
 }
 for(const offset of [-1e9,1e9]){
  const move=p=>({outer:p.outer.map(v=>({x:v.x+offset,y:v.y+offset})),holes:p.holes.map(r=>r.map(v=>({x:v.x+offset,y:v.y+offset})))});
  const shifted=structuredClone(r);shifted.polygons=shifted.polygons.map(move);shifted.vegetation.edits.forEach(e=>e.polygons=e.polygons.map(move));
  assert.deepEqual(draw([shifted],{area:{...box,x:box.x+offset,y:box.y+offset}}).forest,whole.forest);
 }
 const stepped=draw([r],{stepped:true});assert(stepped.checkpoints>10);assert.deepEqual(stepped.forest,whole.forest);assert.deepEqual(stepped.pixels,whole.pixels);
});
