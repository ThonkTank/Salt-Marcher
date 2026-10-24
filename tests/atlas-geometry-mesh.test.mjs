import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';

buildSync({entryPoints:['src/app/atlas-geometry-mesh.ts'],outfile:'.build/atlas-geometry-mesh-test.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/atlas-scene-geometry.ts'],outfile:'.build/atlas-scene-geometry-mesh-test.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url);
const {buildAtlasGeometryMesh}=require('../.build/atlas-geometry-mesh-test.cjs');
const {buildAtlasCanonicalSceneModel}=require('../.build/atlas-scene-geometry-mesh-test.cjs');

function view({farX=0,farY=0}={}){
  const cityFrame={x:farX,y:farY,angle:0};
  const scopeFrame={x:farX+256,y:farY+128,angle:Math.PI/6};
  const building={id:'house',kind:'building',name:'House',protected:false,position:{x:240,y:128},angle:Math.PI/7,
    outline:[{x:-12,y:-10},{x:24,y:-10},{x:24,y:10},{x:-12,y:10}],
    terrain:{mode:'ground',offsetM:2,wallM:4,roofM:0},floorElevations:[0]};
  const room={id:'room-ground',scopeId:'interior',floorId:'ground',name:'Room',number:'1',revision:1,
    polygons:[{outer:[{x:-32,y:-16},{x:32,y:-16},{x:32,y:16},{x:-32,y:16}],holes:[]}]};
  return {region:{coverage:{mode:'detail',complete:true,unreadable:0},frames:{city:cityFrame,scope:scopeFrame},interiors:{house:'interior'}},
    bindings:[{id:'city',kind:'city',ownerId:'city-1',parent:'world',parentId:null,x:cityFrame.x,y:cityFrame.y,angle:cityFrame.angle,revision:1},
      {id:'scope',kind:'dungeon',ownerId:'interior',parent:'building',parentId:'house',x:scopeFrame.x,y:scopeFrame.y,angle:scopeFrame.angle,revision:1}],
    cities:[{header:{id:'city-1'},units:[building]}],geometry:{floors:[{id:'ground',scopeId:'interior',name:'Ground',elevation:3}],drawing:{elements:[]}},
    workspace:{rooms:[room],floors:[]}};
}
const flatSurface={contains:()=>true,heightAt:()=>50};
function worldPoint(mesh,index){const i=index*3;return{x:mesh.origin.x+mesh.positions[i],y:mesh.origin.y+mesh.positions[i+1],z:mesh.origin.heightM+mesh.positions[i+2]};}
function projectedArea(mesh){let area=0;for(let i=0;i<mesh.indices.length;i+=3){const a=worldPoint(mesh,mesh.indices[i]),b=worldPoint(mesh,mesh.indices[i+1]),c=worldPoint(mesh,mesh.indices[i+2]);area+=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;}return area;}
function verticalTriangles(mesh){let count=0;for(let i=0;i<mesh.indices.length;i+=3){const a=worldPoint(mesh,mesh.indices[i]),b=worldPoint(mesh,mesh.indices[i+1]),c=worldPoint(mesh,mesh.indices[i+2]);const xy=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(xy)<1e-8&&(Math.abs(a.z-b.z)>1e-5||Math.abs(b.z-c.z)>1e-5||Math.abs(c.z-a.z)>1e-5))count++;}return count;}
function surfaceArea(mesh,pointAt){let area=0;for(let i=0;i<mesh.indices.length;i+=3){const a=pointAt(mesh,mesh.indices[i]),b=pointAt(mesh,mesh.indices[i+1]),c=pointAt(mesh,mesh.indices[i+2]);const u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[c.x-a.x,c.y-a.y,c.z-a.z],cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];area+=Math.hypot(...cross)/2;}return area;}
function allWithin(mesh,tile){for(const object of mesh.objects)for(let i=0;i<object.positions.length;i+=3){const x=object.origin.x+object.positions[i],y=object.origin.y+object.positions[i+1];assert(x>=tile.x*256-1e-4&&x<=(tile.x+1)*256+1e-4);assert(y>=tile.y*256-1e-4&&y<=(tile.y+1)*256+1e-4);}}

test('rotated building and room crossing a seam partition without losing horizontal area',()=>{
  const source=view(),left={lod:0,x:0,y:0},right={lod:0,x:1,y:0};
  const a=buildAtlasGeometryMesh(source,left,flatSurface),b=buildAtlasGeometryMesh(source,right,flatSurface);
  const roomA=a.objects.find(o=>o.target.kind==='room'),roomB=b.objects.find(o=>o.target.kind==='room');
  assert(roomA&&roomB);assert(Math.abs(projectedArea(roomA)+projectedArea(roomB)-2048)<1e-3);
  const houseA=a.objects.find(o=>o.target.kind==='building'),houseB=b.objects.find(o=>o.target.kind==='building');assert(houseA&&houseB);
  assert(verticalTriangles(houseA)+verticalTriangles(houseB)>0,'vertical 3D wall faces must survive XY clipping');
  const original=buildAtlasCanonicalSceneModel({view:source,terrain:null,surface:flatSurface}).objects.find(o=>o.target.kind==='building');assert(original);
  const clippedArea=surfaceArea(houseA,(m,i)=>worldPoint(m,i))+surfaceArea(houseB,(m,i)=>worldPoint(m,i));
  assert(Math.abs(clippedArea-surfaceArea(original,(m,i)=>({x:m.positions[i*3],y:m.positions[i*3+1],z:m.positions[i*3+2]})))<1e-2,'clipped tile meshes should reconstruct the source building surface');
  assert.notEqual(houseA.id,houseB.id);assert.equal(houseA.target.id,'house');assert.equal(houseB.target.id,'house');
  allWithin(a,left);allWithin(b,right);assert.equal(a.verticalExaggeration,1);assert.equal(a.coverage.complete,true);
});

test('negative far-world tile preserves supplied physical heights and clips before localization',()=>{
  const farX=70_000_000,farY=-90_000_000,source=view({farX,farY}),tile={lod:0,x:Math.floor((farX+128)/256),y:Math.floor((farY+128)/256)};
  const surface={contains:()=>true,heightAt:p=>17+p.x*1e-7+p.y*2e-7};
  const model=buildAtlasGeometryMesh(source,tile,surface);assert(model.objects.length>=2);allWithin(model,tile);
  const room=model.objects.find(o=>o.target.kind==='room');assert(room);
  const zs=Array.from({length:room.positions.length/3},(_,i)=>worldPoint(room,i).z);
  const expected=17+(farX+240)*1e-7+(farY+128)*2e-7+2+3;
  assert(zs.every(z=>Math.abs(z-expected)<1e-4));
  assert(model.objects.every(o=>o.positions.every(Number.isFinite)));
});

test('display choices do not remove geometry and absent feature kinds remain explicit',()=>{
  const source=view();source.geometry.drawing.elements=[{id:'not-modeled'}];
  const model=buildAtlasGeometryMesh(source,{lod:0,x:0,y:0},flatSurface);
  assert(model.objects.some(o=>o.target.kind==='building'));
  assert(model.objects.some(o=>o.target.kind==='room'));
  assert.equal(model.verticalExaggeration,1);
  assert(model.coverage.unsupported.some(item=>item.code==='scene-feature-kinds-not-modeled'));
});

test('a vertical wall exactly on a shared edge belongs to its minimum-edge tile once',()=>{
  const source=view();source.workspace.rooms=[];
  source.cities[0].units[0]={...source.cities[0].units[0],angle:0,position:{x:240,y:128},outline:[{x:-16,y:-10},{x:16,y:-10},{x:16,y:10},{x:-16,y:10}]};
  const a=buildAtlasGeometryMesh(source,{lod:0,x:0,y:0},flatSurface).objects.find(o=>o.target.kind==='building');
  const b=buildAtlasGeometryMesh(source,{lod:0,x:1,y:0},flatSurface).objects.find(o=>o.target.kind==='building');assert(a&&b);
  for(let i=0;i<b.positions.length/3;i++)assert.equal(worldPoint(b,i).x,256);
  for(let i=0;i<a.indices.length;i+=3)assert(![0,1,2].every(j=>worldPoint(a,a.indices[i+j]).x===256));
  const original=buildAtlasCanonicalSceneModel({view:source,terrain:null,surface:flatSurface}).objects.find(o=>o.target.kind==='building');
  assert(Math.abs(surfaceArea(a,worldPoint)+surfaceArea(b,worldPoint)-surfaceArea(original,(m,i)=>({x:m.positions[i*3],y:m.positions[i*3+1],z:m.positions[i*3+2]})))<1e-4);
});
