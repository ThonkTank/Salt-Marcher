import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AreaBudgetExceeded, area, integrateMaterialArea, rectangle} from '../tools/atlas-prototypes/material-area.mjs';

const sum = pixels => Array.from(pixels).reduce((total, value) => total + value, 0);
const paintChannel = (channel, value) => values => { values[channel] = value; };

test('forest strip integrates to 150 square metres at coarse and fine resolutions', () => {
  const strip = rectangle(430.12, 100, .25, 600);
  assert.equal(area(strip), 150);
  for (const [width, height] of [[1, 1], [64, 64], [256, 256]]) {
    const result = integrateMaterialArea({
      box: {x: 0, y: 0, width: 1024, height: 1024}, width, height,
      background: [0], layers: [{geometry: strip, paint: paintChannel(0, 1)}],
    });
    assert.ok(Math.abs(sum(result.pixels) * result.pixelArea - 150) < 1e-8,
      `${width}x${height} grid should preserve the known 150 m² area`);
  }
});

test('polygon holes contribute no material area', () => {
  const courtyard = [[
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
  ]];
  assert.equal(area(courtyard), 84);
  const {pixels} = integrateMaterialArea({
    box: {x: 0, y: 0, width: 10, height: 10}, width: 1, height: 1,
    background: [0], layers: [{geometry: courtyard, paint: paintChannel(0, 1)}],
  });
  assert.ok(Math.abs(pixels[0] - 0.84) < 1e-12);
});

test('coincident opaque layers compose in author order over exactly half a cell', () => {
  const halfCell = rectangle(0, 0, 0.5, 1);
  const result = integrateMaterialArea({
    box: {x: 0, y: 0, width: 1, height: 1}, width: 1, height: 1,
    background: [0], layers: [
      {geometry: halfCell, paint: paintChannel(0, 0.25)},
      {geometry: halfCell, paint: paintChannel(0, 0.8)},
    ],
  });
  assert.equal(result.pixels[0], 0.4);
});

test('disjoint opaque halves remain spatially distinct', () => {
  const result = integrateMaterialArea({
    box: {x: 0, y: 0, width: 1, height: 1}, width: 1, height: 1,
    background: [0], layers: [
      {geometry: rectangle(0, 0, 0.5, 1), paint: paintChannel(0, 0.2)},
      {geometry: rectangle(0.5, 0, 0.5, 1), paint: paintChannel(0, 0.8)},
    ],
  });
  assert.equal(result.pixels[0], 0.5);
});

test('coincident translucent layers blend in order only on their shared half-cell', () => {
  const halfCell = rectangle(0, 0, 0.5, 1);
  const blend = (source, alpha) => values => {
    values[0] = values[0] * (1 - alpha) + source * alpha;
  };
  const result = integrateMaterialArea({
    box: {x: 0, y: 0, width: 1, height: 1}, width: 1, height: 1,
    background: [0], layers: [
      {geometry: halfCell, paint: blend(1, 0.5)},
      {geometry: halfCell, paint: blend(0, 0.5)},
    ],
  });
  assert.equal(result.pixels[0], 0.125);
});

test('disjoint translucent halves retain their independent alpha blends', () => {
  const blend = (source, alpha) => values => {
    values[0] = values[0] * (1 - alpha) + source * alpha;
  };
  const result = integrateMaterialArea({
    box: {x: 0, y: 0, width: 1, height: 1}, width: 1, height: 1,
    background: [0], layers: [
      {geometry: rectangle(0, 0, 0.5, 1), paint: blend(1, 0.5)},
      {geometry: rectangle(0.5, 0, 0.5, 1), paint: blend(0.5, 0.5)},
    ],
  });
  assert.equal(result.pixels[0], 0.375);
});

test('large world coordinates retain local subcell area and world samples', () => {
  const origin = 1e12;
  let sample;
  const result = integrateMaterialArea({
    box: {x: origin, y: -origin, width: 10, height: 10}, width: 1, height: 1,
    background: [0], layers: [{
      geometry: rectangle(origin + 2, -origin + 3, 2, 4),
      paint: (_values, world) => { sample = world; },
    }],
  });
  assert.equal(result.pixels[0], 0);
  assert.ok(sample.x >= origin + 2 && sample.x <= origin + 4);
  assert.ok(sample.y >= -origin + 3 && sample.y <= -origin + 7);
  const filled = integrateMaterialArea({
    box: {x: origin, y: -origin, width: 10, height: 10}, width: 1, height: 1,
    background: [0], layers: [{geometry: rectangle(origin + 2, -origin + 3, 2, 4), paint: paintChannel(0, 1)}],
  });
  assert.equal(filled.pixels[0], 0.08);
});

test('water and pigment retain subcell correlation and exclude forest only where wet', () => {
  const left=rectangle(0,0,.5,1),right=rectangle(.5,0,.5,1),whole=rectangle(0,0,1,1);
  const run=water=>integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,
    background:[0,0,0],layers:[
      {geometry:water,paint(v){v[1]=1;}},
      {geometry:whole,paint(v){if(!v[1])v[2]=1;}},
      {geometry:left,paint(v){if(v[1])v[0]=1;}}
    ]}).pixels;
  assert.deepEqual([...run(left)],[.5,.5,.5]);
  assert.deepEqual([...run(right)],[0,.5,.5],'same water fraction, different pigment intersection');
});

test('erasing pigment leaves the underlying base material intact', () => {
  const wholeCell = rectangle(0, 0, 1, 1);
  const result = integrateMaterialArea({
    box: {x: 0, y: 0, width: 1, height: 1}, width: 1, height: 1,
    background: [0.35, 0],
    layers: [
      {geometry: wholeCell, paint: values => { values[1] = 0.9; }},
      {geometry: rectangle(0, 0, 0.5, 1), paint: values => { values[1] = 0; }},
    ],
  });
  assert.deepEqual(Array.from(result.pixels), [0.35, 0.45]);
});

test('face budget rejects an overlay that would exceed the configured limit', () => {
  assert.throws(() => integrateMaterialArea({
    box: {x: 0, y: 0, width: 1, height: 1}, width: 1, height: 1,
    background: [0], layers: [{geometry: rectangle(0, 0, 0.5, 1), paint: paintChannel(0, 1)}],
    limits: {faces: 1},
  }), AreaBudgetExceeded);
});

test('smooth vegetation integrates with a conservative channel error bound',()=>{
  const radius=1;
  const run=(width,height)=>integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width,height,background:[0],
    layers:[{geometry:rectangle(0,0,1,1),varying:true,paint(value,{x,y}){
      const t=Math.min(1,Math.min(x,1-x,y,1-y)/radius);value[0]=t*t*(3-2*t);
    }}],lipschitz:1.5/radius,tolerance:.02});
  // Integrate smoothstep(d) over square inset rings: integral_0^.5 (4-8d)*(3d²-2d³) dd = .1.
  for(const [width,height] of [[1,1],[4,4]]){
    const r=run(width,height),actual=r.pixels.reduce((a,b)=>a+b,0)*r.pixelArea;
    const bound=r.errorBounds.reduce((a,b)=>a+b,0)*r.pixelArea;
    assert.ok(Math.abs(actual-.1)<=bound,`${actual}, bound ${bound}`);
    assert.ok(Math.abs(actual-.1)<.001,'actual convergence is materially tighter than the conservative bound');
    assert.ok(bound<=.02);
  }
});

test('variable material rejects an unknown error bound and refuses excessive work',()=>{
  const input={box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],
    layers:[{geometry:rectangle(0,0,1,1),varying:true,paint(v,p){v[0]=p.x;}}]};
  assert.throws(()=>integrateMaterialArea(input),/Lipschitz/);
  assert.throws(()=>integrateMaterialArea({...input,lipschitz:1,tolerance:1e-12,limits:{work:100}}),AreaBudgetExceeded);
});


test('clear, thin and add edits are composed spatially in author order',()=>{
  const whole=rectangle(0,0,1,1),left=rectangle(0,0,.5,1);
  const clear={geometry:left,paint(v){v[0]=0;}},thin={geometry:whole,paint(v){v[0]*=.3;}},add={geometry:left,paint(v){v[0]=Math.min(1,v[0]+.5);}};
  const run=layers=>integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[.8],layers}).pixels[0];
  assert.ok(Math.abs(run([clear,thin,add])-.37)<1e-12);
  assert.ok(Math.abs(run([add,thin,clear])-.12)<1e-12);
});

test('varying faces retain hole and disconnected-component areas during triangulation',()=>{
  const geometry=[[[[0,0],[2,0],[2,2],[0,2],[0,0]],[[.5,.5],[1.5,.5],[1.5,1.5],[.5,1.5],[.5,.5]]]],
    disconnected=[...rectangle(0,0,1,1),...rectangle(2,0,1,1)];
  for(const [shape,box,expected] of [[geometry,{x:0,y:0,width:2,height:2},.75],[disconnected,{x:0,y:0,width:3,height:1},1]]){
    const r=integrateMaterialArea({box,width:1,height:1,background:[0],layers:[{geometry:shape,varying:true,paint(v,p){v[0]=p.x;}}],lipschitz:1,tolerance:.05});
    assert.ok(Math.abs(r.pixels[0]-expected)<1e-10);
  }
});

test('boundary-only clipping matches full clipping for diagonals, holes and overlapping parts',()=>{
  const diamond=[[[[-.3,2],[2,-.3],[4.3,2],[2,4.3],[-.3,2]],[[1.9,1.9],[2.1,1.9],[2.1,2.1],[1.9,2.1],[1.9,1.9]]]],
    islands=[...rectangle(.03,.07,.12,3.7),...rectangle(.09,.07,.12,3.7),...rectangle(3.6,.05,.1,3.8)];
  const input={box:{x:-1,y:-1,width:6,height:6},width:12,height:12,background:[0],layers:[{geometry:diamond,paint(v){v[0]=.3;}},{geometry:islands,paint(v){v[0]=v[0]*.5+.5;}}]};
  const fast=integrateMaterialArea(input),full=integrateMaterialArea({...input,interiorFastPath:false});
  fast.pixels.forEach((v,i)=>assert.ok(Math.abs(v-full.pixels[i])<1e-12,`cell ${i}`));
  assert.ok(fast.stats.clipCalls<full.stats.clipCalls);
});

test('hierarchical source clipping preserves detailed boundaries and holes across blocks',()=>{
  const ring=(cx,cy,r,n)=>Array.from({length:n+1},(_,i)=>[cx+r*Math.cos(i%n*2*Math.PI/n),cy+r*Math.sin(i%n*2*Math.PI/n)]);
  const shape=[[ring(31,33,29,96),ring(32,32,4,24)]];
  const input={box:{x:0,y:0,width:64,height:64},width:64,height:64,background:[0],layers:[{geometry:shape,paint(v){v[0]=1;}}]};
  const local=integrateMaterialArea(input),full=integrateMaterialArea({...input,localClipping:false});
  local.pixels.forEach((v,i)=>assert.ok(Math.abs(v-full.pixels[i])<1e-10,`cell ${i}`));
  assert.ok(local.stats.peakClipSourceVertices<full.stats.peakClipSourceVertices);
  assert.throws(()=>integrateMaterialArea({...input,limits:{cachedVertices:1}}),AreaBudgetExceeded);
  assert.throws(()=>integrateMaterialArea({...input,limits:{cachedPieces:1}}),AreaBudgetExceeded);
});
