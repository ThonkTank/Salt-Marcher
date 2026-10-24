import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {pigmentStrokeSource} from '../tools/atlas-prototypes/pigment-stroke.mjs';

let production;
test('bundled production coverage is the scalar point oracle for every pigment tip',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saltmarcher-pigment-'));
 try {
  const outfile=join(dir,'coverage.mjs');
  await build({entryPoints:['src/app/landscape-pigment-coverage.ts'],bundle:true,platform:'node',format:'esm',outfile});
  production=await import(pathToFileURL(outfile).href);
 } finally { await rm(dir,{recursive:true,force:true}); }
 for(const tip of ['round','soft','textured']){
  const record={points:[],polygons:[],paint:{version:2,tip,radius:3.25,flow:.37,opacity:.73,seed:0xfedcba98,
   strokes:[[{x:1000000000.125,y:-230000000.5},{x:1000000002.75,y:-229999999.125},{x:999999997.75,y:-229999998.25}],[],
    [{x:1000000001.25,y:-230000002.5},{x:1000000000.75,y:-230000002.5}],
    [{x:999999999,y:-230000000},{x:1000000003,y:-230000000}]]}};
  const source=pigmentStrokeSource(record);
  const box={x:999999993,y:-230000007,width:16,height:14},w=128,h=112,mask=new Uint8Array(w*h*4);
  for(let i=3;i<mask.length;i+=4)mask[i]=255;
  const gen=production.pigmentStrokeCoverage(box,w,h,record,mask,function*(){});
  const raster=gen.next().value;
  assert.ok(source.stampCount>0&&source.stampCount<4000);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const point={x:box.x+(x+.5)/w*box.width,y:box.y+(y+.5)/h*box.height};
   assert.equal(source.coverage(point),raster[y*w+x],`${tip} at ${point.x},${point.y}`);
  }
 }
});

function pointInTriangle(a,b,c,u,v){return{x:a.x*(1-u-v)+b.x*u+c.x*v,y:a.y*(1-u-v)+b.y*u+c.y*v};}
test('triangle alpha intervals contain deterministic samples around stamp and texture boundaries',()=>{
 const triangles=[
  [{x:-.14,y:.91},{x:.12,y:.91},{x:-.14,y:1.17}],
  [{x:1.01,y:1.01},{x:1.34,y:1.01},{x:1.01,y:1.34}],
  [{x:2.47,y:-.13},{x:2.78,y:-.13},{x:2.47,y:.18}],
 ];
 for(const tip of ['round','soft','textured']){
  const record={points:[],paint:{version:2,tip,radius:1,flow:.43,opacity:.81,seed:19,strokes:[
   [{x:0,y:1},{x:2.1,y:1}], [{x:1.1,y:1.1},{x:1.1,y:1.1}], [{x:2.45,y:0}],
  ]}};
  const source=pigmentStrokeSource(record);
  for(const tri of triangles){
   const [lo,hi]=source.alphaRange(tri);
   for(let i=0;i<=60;i++)for(let j=0;j<=60-i;j++){
    const q=pointInTriangle(...tri,(i+.17)/61,(j+.23)/61);
    const value=source.alpha(q);
    assert.ok(value>=lo-1e-12&&value<=hi+1e-12,`${tip} ${JSON.stringify(q)} alpha ${value} outside [${lo},${hi}]`);
   }
  }
 }
});

test('stamp cap rejects the complete stroke instead of silently truncating',()=>{
 const p={version:2,tip:'round',radius:.1,flow:.5,opacity:1,seed:0,strokes:[[{x:0,y:0},{x:201,y:0}]]};
 assert.throws(()=>pigmentStrokeSource({points:[],paint:p}),/4000 stamps/);
});

test('v2 schema ranges and numerically unusable radii or texture extents are rejected',()=>{
 const base={version:2,tip:'soft',radius:1,flow:.5,opacity:.5,seed:0,fill:false,strokes:[[{x:0,y:0}]]};
 for(const paint of [
  {...base,flow:.099}, {...base,flow:1.001}, {...base,opacity:.099}, {...base,opacity:1.001},
  {...base,seed:-1}, {...base,seed:0x100000000}, {...base,radius:0},
  {...base,radius:1e-200}, {...base,radius:1e200},
  {...base,tip:'textured',radius:Number.MIN_VALUE},
  {...base,tip:'textured',radius:1e-300,strokes:[[{x:1,y:0}]]},
  {...base,fill:true}, {...base,operation:'smear'}, {...base,target:'sky'},
 ]) assert.throws(()=>pigmentStrokeSource({points:[],paint}),/Invalid pigment stroke/);
 const textured=pigmentStrokeSource({points:[],paint:{...base,tip:'textured',radius:1,strokes:[]}});
 assert.throws(()=>textured.coverage({x:Number.MAX_VALUE,y:0}),/texture extent/);
 assert.throws(()=>textured.alpha({x:Number.MAX_VALUE,y:0}),/texture extent/);
 assert.throws(()=>textured.alphaRange([{x:Number.MAX_VALUE,y:0},{x:0,y:1},{x:0,y:0}]),/texture extent/);
});

test('constant round interiors and empty or fully outside triangles return exact singleton intervals',()=>{
 const record={points:[],paint:{version:2,tip:'round',radius:2,flow:.37,opacity:.73,seed:3,
  strokes:[[{x:0,y:0},{x:1,y:0}],[{x:0,y:0}]]}};
 const source=pigmentStrokeSource(record);
 const inside=[{x:.1,y:.1},{x:.2,y:.1},{x:.1,y:.2}];
 const interval=source.alphaRange(inside);
 assert.equal(interval[0],interval[1]);
 assert.equal(interval[0],source.alpha({x:.15,y:.15}));
 assert.deepEqual(source.alphaRange([{x:20,y:20},{x:21,y:20},{x:20,y:21}]),[0,0]);
 assert.deepEqual(pigmentStrokeSource({points:[],paint:{...record.paint,strokes:[]}}).alphaRange(inside),[0,0]);
});

test('guarded boundary intervals remain conservative through overlap and reversed stamp order',()=>{
 const tri=[{x:1,y:-.001},{x:1.001,y:.001},{x:.999,y:.001}];
 const strokes=[[{x:0,y:0},{x:1.5,y:0}],[{x:1,y:0}],[{x:1,y:0}]];
 for(const tip of ['round','soft','textured']) for(const ordered of [strokes,[...strokes].reverse()]){
  const source=pigmentStrokeSource({points:[],paint:{version:2,tip,radius:1,flow:.61,opacity:.89,seed:77,strokes:ordered}});
  const [lo,hi]=source.alphaRange(tri);
  for(let i=0;i<=100;i++) for(let j=0;j<=100-i;j++){
   const q=pointInTriangle(...tri,(i+.31)/101,(j+.47)/101), value=source.alpha(q);
   assert.ok(value>=lo-1e-12&&value<=hi+1e-12,`${tip} ${value} outside [${lo}, ${hi}]`);
  }
 }
});

test('subnormal radius squares fail explicitly before relative distance bounds are used',()=>{
 assert.throws(()=>pigmentStrokeSource({points:[{x:0,y:0}],paint:{version:2,tip:'soft',radius:1e-160,flow:1,opacity:1,seed:0}}),/parameters/);
});
