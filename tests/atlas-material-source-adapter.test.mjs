import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialLipschitz} from '../tools/atlas-prototypes/material-sources.mjs';

let production;
test.before(async()=>{
  const out=resolve('.build/atlas-material-source-raster.mjs');
  await mkdir(resolve('.build'),{recursive:true});
  const built=await build({stdin:{contents:`import {LandscapeRasterizer} from ${JSON.stringify(resolve('src/app/landscape-raster.ts'))};\nimport {terrainColors} from ${JSON.stringify(resolve('src/app/world-model.ts'))};\nimport {DEFAULT_TERRAIN_STYLE} from ${JSON.stringify(resolve('src/app/terrain-relief.ts'))};\nexport {LandscapeRasterizer,terrainColors,DEFAULT_TERRAIN_STYLE};`,resolveDir:process.cwd(),sourcefile:'material-source-test-entry.ts'},bundle:true,platform:'node',format:'esm',write:false});
  await writeFile(out,built.outputFiles[0].contents);
  production=await import(pathToFileURL(out).href+`?t=${Date.now()}`);
});

const poly=geometry=>({outer:geometry[0][0].slice(0,-1).map(([x,y])=>({x,y})),holes:geometry[0].slice(1).map(r=>r.slice(0,-1).map(([x,y])=>({x,y})))});
const full=box=>[{outer:[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}],holes:[]}];
const record=(id,polygons,values={})=>({id,revision:0,kind:'patch',name:id,points:[],polygons,resolution:1,width:1,values});
const cover=(polygons,edits=[],preset={})=>({...record('cover',polygons,{terrain:'forest'}),kind:'vegetation',vegetation:{preset:{ground:'#89956b',density:.4,edge:0,...preset},edits}});
const pigment=(polygons,operation='paint',color='#c04080',target='ground',opacity=.6)=>({...record('pigment',polygons),paint:{version:2,operation,color,target,opacity,fill:true}});
const areaPixel=(args)=>integrateMaterialArea({box:args.box,width:1,height:1,background:landscapeMaterialBackground(production.DEFAULT_TERRAIN_STYLE.land),layers:landscapeMaterialLayers({...args,palette:production.terrainColors,landColor:production.DEFAULT_TERRAIN_STYLE.land})}).pixels;
const actualPixel=({box,baseRecords,coverRecords=[],colorRecords=[],water=false})=>{
  const image=new production.LandscapeRasterizer(box,1,1,0,1,true),lattice=image.sampleLattice(),n=lattice.columns*lattice.rows;
  image.setTerrainField({heights:new Float32Array(n),water:new Uint8Array(n).fill(water?1:0)});
  for(const r of baseRecords??[])image.paint(r);
  for(const r of coverRecords)image.paintCover(r);
  for(const r of colorRecords)image.paintColor(r);
  const iterator=image.materialChannelsSteps(function*(){},new Set(['baseColor','forest']));let result=iterator.next();while(!result.done)result=iterator.next();
  return {color:Array.from(result.value.baseColor),forest:result.value.forest[0]};
};
const close=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} vs ${b} (tol ${tol})`);

test('dry and wet aligned base patches match raw production channels',()=>{
  for(const wet of [false,true]){
    const box={x:0,y:0,width:1,height:1},image=new production.LandscapeRasterizer(box,1,1),polygons=full(image.sampleBox),base=[record('base',polygons,{terrain:'plains'})];
    const water=wet?polygons:[],expected=actualPixel({box,baseRecords:base,water:wet});
    const pixel=areaPixel({box,baseRecords:base,waterGeometry:water});
    for(let c=0;c<4;c++)close(pixel[9+c]*255,expected.color[c],1.1,`${wet?'wet':'dry'} base channel ${c}`);
    assert.equal(expected.forest,0);
  }
});

test('default land and full water cells match production without base patches',()=>{
  for(const wet of [false,true]){
    const box={x:0,y:0,width:1,height:1},probe=new production.LandscapeRasterizer(box,1,1),polygons=full(probe.sampleBox);
    const expected=actualPixel({box,baseRecords:[],water:wet}),pixel=areaPixel({box,baseRecords:[],waterGeometry:wet?polygons:[]});
    for(let c=0;c<4;c++)close(pixel[9+c]*255,expected.color[c],1.1,`${wet?'wet':'dry'} default channel ${c}`);
    close(pixel[4]*255,expected.forest,1.1,`${wet?'wet':'dry'} default forest`);
  }
});

test('an authored water terrain patch over a dry supplied field resets to production land',()=>{
  const box={x:0,y:0,width:1,height:1},probe=new production.LandscapeRasterizer(box,1,1),polygons=full(probe.sampleBox);
  const waterPatch=[record('water-patch',polygons,{terrain:'water'})],expected=actualPixel({box,baseRecords:waterPatch,water:false});
  const pixel=areaPixel({box,baseRecords:waterPatch,waterGeometry:[]});
  for(let c=0;c<4;c++)close(pixel[9+c]*255,expected.color[c],1.1,`dry water-patch channel ${c}`);
});

test('ordered cover edits and filled paint then erase match production, with forest kept separate',()=>{
  const box={x:0,y:0,width:1,height:1},probe=new production.LandscapeRasterizer(box,1,1),polygons=full(probe.sampleBox);
  const base=[record('base',polygons,{terrain:'plains'})],forest=cover(polygons,[{mode:'thin',polygons},{mode:'dense',polygons},{mode:'clear',polygons},{mode:'dense',polygons}]);
  const paints=[pigment(polygons,'paint','#c04080','ground',.7),pigment(polygons,'erase','#c04080','ground',.25)];
  const expected=actualPixel({box,baseRecords:base,coverRecords:[forest],colorRecords:paints}),pixel=areaPixel({box,baseRecords:base,coverRecords:[forest],colorRecords:paints});
  for(let c=0;c<4;c++)close(pixel[9+c]*255,expected.color[c],1.1,`pigmented channel ${c}`);
  close(pixel[4]*255,expected.forest,1.1,'forest semantic coverage');
  assert.ok(pixel[4]>.6,'the final dense edit survives pigment erase');
});

test('supplied water footprint gates water pigment and semantic forest on the same cells',()=>{
  for(const wet of [false,true]){
    const box={x:0,y:0,width:1,height:1},probe=new production.LandscapeRasterizer(box,1,1),polygons=full(probe.sampleBox);
    const base=[record('base',polygons,{terrain:'plains'})],water=wet?polygons:[],canopy=cover(polygons),paint=[pigment(polygons,'paint','#30a0d0','water',.5)];
    const expected=actualPixel({box,baseRecords:base,coverRecords:[canopy],colorRecords:paint,water:wet});
    const pixel=areaPixel({box,baseRecords:base,coverRecords:[canopy],colorRecords:paint,waterGeometry:water});
    for(let c=0;c<4;c++)close(pixel[9+c]*255,expected.color[c],1.1,`${wet?'wet':'dry'} water-target channel ${c}`);
    close(pixel[4]*255,expected.forest,1.1,`${wet?'wet':'dry'} forest channel`);
  }
});

test('exact half-cell cover and pigment preserve analytic subpixel area',()=>{
  const box={x:0,y:0,width:1,height:1},whole=full(box),half=[poly([rectangle(0,0,.5,1)[0]])];
  const base=[record('base',whole,{terrain:'plains'})],canopy=cover(half),painted=pigment(half,'paint','#000000','ground',1);
  const pixel=areaPixel({box,baseRecords:base,coverRecords:[canopy],colorRecords:[painted]});
  const baseRgb=[1,3,5].map(i=>parseInt(production.terrainColors.plains.slice(i,i+2),16)/255);
  const coverRgb=[137/255,149/255,107/255],afterCover=baseRgb.map((v,i)=>coverRgb[i]*.78+v*.22);
  for(let c=0;c<3;c++){
    const expected=baseRgb[c]*.5;
    close(pixel[9+c],expected,1e-12,`half-cell black pigment channel ${c}`);
    // Check the unsupported half remains exactly the authored base outside pigment.
    close(pixel[0+c],afterCover[c]*.5+baseRgb[c]*.5,1e-12,`half-cell cover base ${c}`);
  }
  close(pixel[4],.25,1e-12,'half-cell semantic forest coverage');
});

test('half-cell clear, thin and add edits have analytic forest means and retain edit order',()=>{
  const box={x:0,y:0,width:1,height:1},whole=full(box),half=[poly(rectangle(0,0,.5,1))];
  // Production calls the add operation `dense`; it adds 0.5 density.
  const expectedFor={clear:.25,thin:(.5+.15)/2,dense:(.5+1)/2};
  for(const [mode,expected] of Object.entries(expectedFor)){
    const forest=cover(whole,[{mode,polygons:half}]);
    const pixel=areaPixel({box,coverRecords:[forest]});
    close(pixel[4],expected,1e-12,`${mode} half-cell forest mean`);
  }
  const clearThenAdd=cover(whole,[{mode:'clear',polygons:half},{mode:'dense',polygons:half}]);
  const addThenClear=cover(whole,[{mode:'dense',polygons:half},{mode:'clear',polygons:half}]);
  close(areaPixel({box,coverRecords:[clearThenAdd]})[4],.5625,1e-12,'clear then add order');
  close(areaPixel({box,coverRecords:[addThenClear]})[4],.25,1e-12,'add then clear order');
});

test('overlapping covers with subpixel edits match production ordering and coverage',()=>{
  const box={x:0,y:0,width:1,height:1},probe=new production.LandscapeRasterizer(box,1,1),polygons=full(probe.sampleBox),left=[poly(rectangle(probe.sampleBox.x,probe.sampleBox.y,probe.sampleBox.width/2,probe.sampleBox.height))];
  const base=[record('base',polygons,{terrain:'plains'})];
  const covers=[cover(polygons,[{mode:'clear',polygons:left}],{ground:'#c04040',density:.8}),cover(polygons,[{mode:'dense',polygons:left}],{ground:'#4050c0',density:.4})];
  const expected=actualPixel({box,baseRecords:base,coverRecords:covers}),pixel=areaPixel({box,baseRecords:base,coverRecords:covers});
  for(let c=0;c<4;c++)close(pixel[9+c]*255,expected.color[c],1.1,`overlap channel ${c}`);
  close(pixel[4]*255,expected.forest,1.1,'later cover owns semantic forest coverage');
});

test('unsupported records fail explicitly instead of disappearing',()=>{
  const box={x:0,y:0,width:1,height:1},polygons=full(box),palette=production.terrainColors,landColor=production.DEFAULT_TERRAIN_STYLE.land;
  const soft=cover(polygons);soft.vegetation.preset.edge=2;
  assert.throws(()=>landscapeMaterialLayers({palette,landColor,coverRecords:[soft]}),/Soft-edged/);
  const stroke=pigment(polygons);stroke.paint.fill=false;
  assert.throws(()=>landscapeMaterialLayers({palette,landColor,colorRecords:[stroke]}),/filled version-2/);
  assert.throws(()=>landscapeMaterialLayers({palette,landColor,baseRecords:[{...record('masked',polygons,{terrain:'plains'}),mask:{}}]}),/masks/);
});


test('explicit world-edge policy composes actual convex cover records at a stable authored radius',()=>{
  const box={x:0,y:0,width:1,height:1},whole=full(box),forest=cover(whole,[],{edge:1}),landColor=production.DEFAULT_TERRAIN_STYLE.land;
  const base=[record('base',whole,{terrain:'plains'})],args={palette:production.terrainColors,landColor,baseRecords:base,coverRecords:[forest],edgePolicy:'authored-world'};
  const baseRgb=[1,3,5].map(i=>parseInt(production.terrainColors.plains.slice(i,i+2),16)/255),coverRgb=[137/255,149/255,107/255];
  for(const width of [1,4,16]){
    const r=integrateMaterialArea({box,width,height:width,background:landscapeMaterialBackground(landColor),layers:landscapeMaterialLayers(args)});
    const means=Array.from({length:14},(_,c)=>r.pixels.reduce((sum,v,i)=>sum+(i%14===c?v:0),0)/(width*width));
    close(means[4],1/12,1e-12,'linear authored density ramp');
    for(let c=0;c<3;c++)close(means[9+c],baseRgb[c]*(1-.078)+coverRgb[c]*.078,1e-12,'world radius smooth ground pigment');
    assert.equal(r.stats.subdivisions,0);
  }
  const reference=actualPixel({box,baseRecords:base,coverRecords:[forest]});
  assert.ok(Math.abs(reference.forest/255-1/12)>.03,'old screen-radius smoothstep mask intentionally differs from the authored density contract');
});

test('overlapping world-edge covers use a declared bound when polynomial degree exceeds three',()=>{
 const box={x:0,y:0,width:1,height:1},whole=full(box),covers=[cover(whole,[],{edge:1,density:.4}),cover(whole,[],{edge:1,density:.8})];
 const landColor=production.DEFAULT_TERRAIN_STYLE.land;
 const layers=landscapeMaterialLayers({palette:production.terrainColors,landColor,coverRecords:covers,edgePolicy:'authored-world'});
 const r=integrateMaterialArea({box,width:1,height:1,background:landscapeMaterialBackground(landColor),layers,lipschitz:landscapeMaterialLipschitz(covers),tolerance:.05});
 // E[1.5d-.5d²] = 1.5/6 - .5/24 = 11/48 for square boundary distance d.
 close(r.pixels[4],11/48,r.errorBounds[0],'declared bound contains the analytic forest integral');
 close(r.pixels[4],11/48,.001,'adaptive composition converges');
 assert.ok(r.stats.subdivisions>0);
});
