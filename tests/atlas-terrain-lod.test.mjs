import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';
const {outputFiles}=await build({stdin:{contents:"export * from './src/app/atlas-terrain-tile-model';export {refineAtlasDeckRayHit} from './src/app/atlas-deck-ray';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {atlasTerrainTileModels,atlasTerrainTileModel,atlasTerrainDisplayedGrid,atlasTerrainTextureSample,refineAtlasDeckRayHit,withAtlasTerrainModelMeasurements,atlasTerrainModelRetained}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
function tile(x,y,lod=0){
 const address={lod,x,y},size=256*2**lod,box={x:x*size,y:y*size,width:size,height:size},view={box,frame:box,columns:65,rows:65};
 const heights=Float32Array.from({length:65*65},(_,i)=>{const xx=box.x+i%65*size/64,yy=box.y+Math.floor(i/65)*size/64;return 300+.002*xx*xx+.003*yy*yy;});
 return{tile:address,revision:1,fence:'a',terrain:{tile:address,revision:1,fence:'a',projection:{grid:{view,heights}}},material:{tile:address,revision:1,fence:'a',width:256,height:256,channels:emptyMaterialChannels(65536)}};
}
test('shared signed tile edge normals use both neighbours without changing authored heights or mesh positions',()=>{
 const a=tile(-1,0),b=tile(0,0),tiles=[a,b],before=a.terrain.projection.grid.heights.slice(),oldA=atlasTerrainTileModel(a.terrain,a.material),oldB=atlasTerrainTileModel(b.terrain,b.material),models=atlasTerrainTileModels(tiles);
 assert.notDeepEqual(oldA.mesh.attributes.NORMAL.value.subarray(64*3,65*3),oldB.mesh.attributes.NORMAL.value.subarray(0,3),'Old one-sided edge derivatives expose the lighting seam');
 for(let y=1;y<64;y++)assert.deepEqual(models[0].mesh.attributes.NORMAL.value.subarray((y*65+64)*3,(y*65+65)*3),models[1].mesh.attributes.NORMAL.value.subarray(y*65*3,(y*65+1)*3));
 assert.deepEqual(a.terrain.projection.grid.heights,before);assert.equal(models[0].mesh.attributes.POSITION,oldA.mesh.attributes.POSITION);assert.equal(atlasTerrainTileModels(tiles),models,'Style changes reuse the immutable partition');
});
test('coarse and fine tiles agree on normals at their shared vertices and do not mix revisions',()=>{
 const coarse=tile(-1,0,1),a=tile(0,0),b=tile(0,1),models=atlasTerrainTileModels([coarse,a,b]);
 for(let y=1;y<64;y++){
  const fine=y<32?models[1]:models[2],fy=(y%32)*2;
  assert.deepEqual(models[0].mesh.attributes.NORMAL.value.subarray((y*65+64)*3,(y*65+65)*3),fine.mesh.attributes.NORMAL.value.subarray(fy*65*3,(fy*65+1)*3));
 }
 b.fence='other';b.terrain.fence='other';b.material.fence='other';assert.doesNotThrow(()=>atlasTerrainTileModels([coarse,b]));
});

test('fine intermediate edge nodes lie on the visible coarse segment and the ray grid equals the actual mesh',()=>{
 const coarse=tile(-1,0,1),fine=tile(0,0),original=fine.terrain.projection.grid.heights.slice(),models=atlasTerrainTileModels([coarse,fine]),grid=models[1].grid;
 for(let y=1;y<64;y+=2){const at=y/2,lo=Math.floor(at),u=at-lo,expected=Math.fround(coarse.terrain.projection.grid.heights[lo*65+64]*(1-u)+coarse.terrain.projection.grid.heights[(lo+1)*65+64]*u);assert.equal(grid.heights[y*65],expected);}
 assert.notDeepEqual(grid.heights,original,'The curved old T-junction was geometrically open');assert.deepEqual(fine.terrain.projection.grid.heights,original,'Author source is immutable');
 const model=models[1];for(let i=0;i<grid.heights.length;i++)assert.equal(model.mesh.attributes.POSITION.value[i*3+2]+model.object.origin.heightM,grid.heights[i]);
});

test('a resident coarse background clips its detailed child and does not flatten internal fine neighbours',()=>{
 const background=tile(-1,-1,3),left=tile(-2,-1),right=tile(-1,-1),models=atlasTerrainTileModels([left,right,background]);
 assert.equal(models[2].clipBounds.length,1);
 for(let y=1;y<64;y++)assert.equal(models[0].grid.heights[y*65+64],left.terrain.projection.grid.heights[y*65+64],'Shared fine edges keep their original form');
 assert.deepEqual(background.terrain.projection.grid.heights,models[2].grid.heights);
});

test('a metre-scale cut in a world-scale parent has exact local vertices and no hidden parent triangles',()=>{
 const parent=tile(-1,-1,20),child=tile(-1,-1,-6);parent.terrain.projection.grid.heights.fill(300);child.terrain.projection.grid.heights.fill(302);
 const models=atlasTerrainTileModels([parent,child]),background=models.find(m=>m.grid.view.box.width>1000000),detail=models.find(m=>m.grid.view.box.width===4);
 const positions=background.mesh.attributes.POSITION.value,vertices=Array.from({length:positions.length/3},(_,i)=>[positions[i*3]+background.object.origin.x,positions[i*3+1]+background.object.origin.y]);
 assert(vertices.some(([x,y])=>x===-4&&y===-4),'The small cut corner survives world-scale coordinate storage');
 assert.equal(refineAtlasDeckRayHit({object:background.object,segment:[[-2,-2,1000],[-2,-2,0]]}),null,'The background has no triangles inside the displayed child');
 assert.equal(refineAtlasDeckRayHit({object:background.object,segment:[[-6,-2,1000],[-6,-2,0]]}).point.heightM,300);
 assert(refineAtlasDeckRayHit({object:detail.object,segment:[[-2,-2,1000],[-2,-2,0]]}));
});

test('unchanged neighbours retain derived buffers and changed height/material sources invalidate only their derivation',()=>{
 const root=tile(-1,-1,3),fine=tile(-1,-1),first=atlasTerrainTileModels([root,fine]),again=atlasTerrainTileModels([root,fine]);
 for(let i=0;i<first.length;i++){assert.equal(again[i].mesh.attributes.POSITION.value,first[i].mesh.attributes.POSITION.value);assert.equal(again[i].gridNormals,first[i].gridNormals);assert.equal(again[i].texture,first[i].texture);}
 const updated=tile(-1,-1,3);updated.terrain.projection.grid.heights.fill(500);updated.material.channels.baseColor.fill(187);
 const changed=atlasTerrainTileModels([updated,fine]);assert.notDeepEqual(changed[1].grid.heights,first[1].grid.heights);assert.notEqual(changed[1].texture,first[1].texture);
 const recoloured={...root,material:{...root.material,channels:{...root.material.channels,baseColor:new Uint8Array(65536*4).fill(83)}}},colour=atlasTerrainTileModels([recoloured,fine])[0];assert.equal(colour.mesh.attributes.POSITION.value,first[0].mesh.attributes.POSITION.value);assert(colour.texture.data.every(v=>v===83),'A reused cut mesh cannot retain the old material');
});

test('LOD geometry, material and ray heights interpolate together, including interrupted transitions',()=>{
 const owner={},first=tile(0,0);first.terrain.projection.grid.heights.fill(300);first.material.channels.baseColor.fill(40);
 const canonical=first.terrain.projection.grid.heights.slice();atlasTerrainTileModels([first],{owner,now:0});
 const second=tile(0,0);second.terrain.projection.grid.heights.fill(310);second.material.channels.baseColor.fill(200);
 const pair=[second],model=atlasTerrainTileModels(pair,{owner,now:100})[0],t=model.transition;
 assert(t);assert.equal(t.start,100);assert.equal(t.duration,180);assert.equal(t.heights.length,model.mesh.attributes.POSITION.value.length/3);
 assert(atlasTerrainDisplayedGrid(model).heights.every(h=>h===300));assert(t.texture.data.every(v=>v===40));
 t.progress=.5;assert(atlasTerrainDisplayedGrid(model).heights.every(h=>h===305));
 const same={...second};
 const retained=atlasTerrainTileModels([same],{owner,now:125})[0];assert.equal(retained.transition,t,'An unchanged publication cannot finish or restart an active morph');assert.equal(t.start,100);assert(atlasTerrainDisplayedGrid(retained).heights.every(h=>h===305));
 const third=tile(0,0);third.terrain.projection.grid.heights.fill(320);
 const follow=atlasTerrainTileModels([third],{owner,now:150})[0];assert(follow.transition.grid.heights.every(h=>h===305),'An interrupted transition starts at the displayed field');
 assert.equal(atlasTerrainTileModels(pair,{owner})[0],model,'A frozen pick snapshot retains its matching display geometry');
 follow.transition.progress=1;assert.equal(atlasTerrainDisplayedGrid(follow),follow.grid);
 assert.deepEqual(first.terrain.projection.grid.heights,canonical,'No transition writes author heights');
 const local=tile(0,0);assert.equal(atlasTerrainTileModels([local],{owner,animate:false})[0].transition,undefined,'Direct local brush feedback stays immediate');
});

test('refinement samples its previous parent material through the matching world UV transform',()=>{
 const owner={},parent=tile(0,0,1);parent.terrain.projection.grid.heights.fill(300);for(let i=0;i<65536;i++)parent.material.channels.baseColor.fill(i%256,i*4,i*4+4);
 const before=atlasTerrainTileModels([parent],{owner,now:0})[0],child=tile(0,0);child.terrain.projection.grid.heights.fill(300);child.material.channels.baseColor.fill(200);
 const model=atlasTerrainTileModels([child],{owner,now:100})[0],t=model.transition;assert.equal(t.texture,before.texture);assert.equal(t.materialGrid,before.grid);assert.deepEqual(t.materialUv,[0,0,.5,.5]);
 const p={x:128,y:128};assert.deepEqual(atlasTerrainTextureSample(t.texture,t.materialGrid,p),atlasTerrainTextureSample(before.texture,before.grid,p));t.progress=.5;
 const next=tile(0,0);next.terrain.projection.grid.heights.fill(310);const interrupted=atlasTerrainTileModels([next],{owner,now:150})[0].transition,sample=atlasTerrainTextureSample(interrupted.texture,interrupted.materialGrid,p)[0];assert(Math.abs(sample-(63.5+200)/2)<1,'An interrupted parent UV blend remains world-anchored');
});

test('publications superseded before their first GPU frame reuse the same visible ancestor material',()=>{
 const owner={},parent=tile(0,0,2);parent.material.channels.baseColor.fill(71);parent.terrain.projection.grid.heights.fill(300);const initial=atlasTerrainTileModels([parent],{owner,now:0})[0];
 for(const lod of [1,0,-1]){const child=tile(0,0,lod);child.terrain.projection.grid.heights.fill(310);child.material.channels.baseColor.fill(170);const model=atlasTerrainTileModels([child],{owner,now:100+lod})[0];assert.equal(model.transition.texture,initial.texture);assert.equal(model.transition.materialGrid,initial.grid);assert(model.transition.grid.heights.every(h=>h===300));assert.equal(model.transition.presented,false);assert.equal(model.transition.progress,0);}
});


test('unchanged actual normal support survives an irrelevant new child but a changed sampled neighbour invalidates it',()=>{
 const root=tile(-1,-1,20),adjacent=tile(0,-1,20);root.terrain.projection.grid.heights.fill(300);adjacent.terrain.projection.grid.heights.fill(400);
 const before=atlasTerrainTileModels([root,adjacent]),child=tile(1,-1,-4);child.terrain.projection.grid.heights.fill(300);
 const next=atlasTerrainTileModels([root,adjacent,child]);
 assert.equal(next[0].gridNormals,before[0].gridNormals,'A child missing all derivative queries cannot invalidate a world normal field');
 const changed=tile(0,-1,20);changed.terrain.projection.grid.heights.fill(700);const after=atlasTerrainTileModels([root,changed,child]);
 assert.notEqual(after[0].gridNormals,before[0].gridNormals,'An actual sampled source must invalidate the normal field');
 assert(atlasTerrainModelRetained([root,changed,child],after).length>after.length,'Accounting includes reachable caches as well as published meshes');
});

test('morphing an unchanged tile keeps its exact previous grid instead of resampling it',()=>{
 const owner={},a=tile(-1,-1),before=atlasTerrainTileModels([a],{owner})[0],b=tile(-1,-1);b.terrain.projection.grid.heights.fill(400);
 const next=atlasTerrainTileModels([b],{owner})[0];assert.equal(next.transition.grid,before.grid);assert.deepEqual(next.transition.grid.heights,a.terrain.projection.grid.heights);
});


test('material support ignores children missing all texel centres and invalidates a sampled neighbour',()=>{
 const a=tile(-1,-1,10),b=tile(0,-1,12);a.material.channels.baseColor.fill(20);b.material.channels.baseColor.fill(200);
 const first=atlasTerrainTileModels([a,b])[0],tiny=tile(0,-1,-8);tiny.material.channels.baseColor.fill(80);
 const again=atlasTerrainTileModels([a,b,tiny])[0];assert.equal(again.texture,first.texture,'A one-metre child misses the 1024-metre texel-centre lattice');
 const changed=tile(0,-1,12);changed.material.channels.baseColor.fill(90);const next=atlasTerrainTileModels([a,changed,tiny])[0];assert.notEqual(next.texture,first.texture);assert.notDeepEqual(next.texture.data,first.texture.data);
});


test('incremental normal updates equal a fresh derivation after an actual local support change',()=>{
 const root=tile(-1,-1,12),right=tile(0,-1,12),child=tile(0,-1,0);root.terrain.projection.grid.heights.fill(300);right.terrain.projection.grid.heights.fill(400);child.terrain.projection.grid.heights.fill(600);
 atlasTerrainTileModels([root,right]);const incremental=atlasTerrainTileModels([root,right,child]),fresh=atlasTerrainTileModels(structuredClone([root,right,child]));
 for(let i=0;i<incremental.length;i++){assert.deepEqual(incremental[i].gridNormals,fresh[i].gridNormals);assert.deepEqual(incremental[i].mesh.attributes.NORMAL.value,fresh[i].mesh.attributes.NORMAL.value);}
});
