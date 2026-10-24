import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pigmentStrokeSource} from '../tools/atlas-prototypes/pigment-stroke.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers} from '../tools/atlas-prototypes/material-sources.mjs';

const palette={water:'#203040',plains:'#809060'};
const landColor='#809060';
const polygon=(x0,y0,x1,y1)=>[{outer:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],holes:[]}];
const record=(strokes,more={})=>({id:'stroke',kind:'color',points:[],polygons:polygon(-100,-100,100,100),paint:{version:2,tip:'round',radius:2,flow:.7,opacity:.8,color:'#c04080',seed:17,fill:false,target:'ground',operation:'paint',strokes,...more}});
const source=strokes=>pigmentStrokeSource(record(strokes));
const bounds=multi=>{
  const ring=multi[0][0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
};
const inSupport=(g,p)=>{
  const b=bounds(g);return p.x>=b.x0&&p.x<=b.x1&&p.y>=b.y0&&p.y<=b.y1;
};
const layersFor=(r,extra={})=>landscapeMaterialLayers({palette,landColor,colorRecords:[r],...extra});
const onSegment=(p,a,b)=>{
  const cross=(p.y-a[1])*(b[0]-a[0])-(p.x-a[0])*(b[1]-a[1]);
  return Math.abs(cross)<=Number.EPSILON*16*Math.max(1,Math.abs(p.x),Math.abs(p.y),Math.abs(a[0]),Math.abs(a[1]),Math.abs(b[0]),Math.abs(b[1]))&&p.x>=Math.min(a[0],b[0])&&p.x<=Math.max(a[0],b[0])&&p.y>=Math.min(a[1],b[1])&&p.y<=Math.max(a[1],b[1]);
};
const inRing=(ring,p)=>{
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];if(onSegment(p,a,b))return true;
    if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};
const contains=(multi,p)=>multi.some(poly=>inRing(poly[0],p)&&!poly.slice(1).some(ring=>inRing(ring,p)));
const channelsAt=(layers,p)=>{
  const v=[...landscapeMaterialBackground(landColor)];
  for(const layer of layers)if(contains(layer.geometry,p))layer.paint(v,p);
  return v;
};

test('support contains production-predicate-positive cardinal, diagonal, and adjacent-float samples',()=>{
  const r=record([[{x:0,y:0}]]),s=pigmentStrokeSource(r),b=bounds(s.supportGeometry),rad=r.paint.radius;
  const rim=[{x:rad,y:0},{x:-rad,y:0},{x:0,y:rad},{x:0,y:-rad},
    {x:rad/Math.sqrt(2),y:rad/Math.sqrt(2)},{x:-rad/Math.sqrt(2),y:rad/Math.sqrt(2)},
    {x:rad/Math.sqrt(2),y:-rad/Math.sqrt(2)},{x:-rad/Math.sqrt(2),y:-rad/Math.sqrt(2)}];
  const next=(x,direction)=>{const buf=new ArrayBuffer(8),v=new DataView(buf);v.setFloat64(0,x);let q=v.getBigUint64(0);q+=(x>=0)===(direction>0)?1n:-1n;v.setBigUint64(0,q);return v.getFloat64(0);};
  const probes=[...rim,{x:next(rad,1),y:0},{x:next(rad,-1),y:0},{x:0,y:next(rad,1)},{x:0,y:next(rad,-1)}];
  for(const p of probes)if(s.alpha(p)>0)assert.ok(inSupport(s.supportGeometry,p),`positive alpha sample ${JSON.stringify(p)} escaped ${JSON.stringify(b)}`);
  assert.ok(b.x0< -rad&&b.x1>rad&&b.y0< -rad&&b.y1>rad,'support rounds outward beyond nominal radius');
});

test('support handles negative, large, and accepted extreme normal coordinates and radii',()=>{
  const negative=source([[{x:-17,y:-31}]]);
  assert.ok(inSupport(negative.supportGeometry,{x:-17,y:-31}));
  const large=source([[{x:2**53,y:-(2**53)}]]);
  assert.ok(inSupport(large.supportGeometry,{x:2**53,y:-(2**53)}));
  const tinyRadius=2**-511; // its square is the smallest normal binary64
  const tiny=pigmentStrokeSource(record([[{x:-1e100,y:1e100}]],{radius:tinyRadius}));
  assert.ok(tiny.supportGeometry,'the minimum accepted normal radius retains finite support');
  assert.ok(inSupport(tiny.supportGeometry,{x:-1e100,y:1e100}));
  const tinyNearZero=pigmentStrokeSource(record([[{x:0,y:0}]],{radius:tinyRadius}));
  assert.ok(tinyNearZero.supportGeometry,'minimum normal-square radius centered near zero also retains support');
  assert.ok(inSupport(tinyNearZero.supportGeometry,{x:tinyRadius/2,y:-tinyRadius/2}));
  const hugeCoordinate=pigmentStrokeSource(record([[{x:Number.MAX_VALUE,y:0}]],{radius:1e154}));
  assert.equal(hugeCoordinate.supportGeometry,undefined,'outward adjacent-float overflow disables pruning');
});

test('support is record-wide across joined stamps and remains bounded for 4000 stamps',()=>{
  const joined=source([[{x:-10,y:0},{x:-9,y:0}],[{x:20,y:4}]]);
  assert.equal(joined.stampCount,3);
  const b=bounds(joined.supportGeometry);
  assert.ok(b.x0< -12&&b.x1>22&&b.y0< -2&&b.y1>6);
  const strokes=Array.from({length:4000},(_,i)=>[{x:i*3,y:(i%7)-3}]);
  const maxed=source(strokes);
  assert.equal(maxed.stampCount,4000);
  assert.equal(maxed.supportGeometry[0][0].length,5,'one rectangle bounds construction regardless of stamp count');
  assert.ok(inSupport(maxed.supportGeometry,strokes[0][0])&&inSupport(maxed.supportGeometry,strokes.at(-1)[0]));
});

test('empty strokes expose empty support, fills bypass it, and adapter keeps authored and water clips',()=>{
  const authored=polygon(-8,-8,8,8),water=polygon(-1,-1,1,1);
  const empty=record([[]]);
  assert.deepEqual(pigmentStrokeSource(empty).supportGeometry,[]);
  assert.equal(layersFor(empty).length,0);
  const fill=record([[]],{fill:true});
  assert.equal(layersFor(fill).length,1,'filled v2 pigment has no stroke support source');
  const stroke={...record([[{x:0,y:0}]]),polygons:authored};
  const visible=layersFor(stroke,{waterGeometry:water});
  assert.equal(visible.length,2); // supplied water base layer and pigment layer
  const coords=visible.at(-1).geometry[0][0];
  assert.ok(coords.every(([x,y])=>Math.abs(x)<=2.1&&Math.abs(y)<=2.1),'land target intersects source polygon, water exclusion, and stamp support');
  const waterStroke={...stroke,paint:{...stroke.paint,target:'water'}};
  const wet=layersFor(waterStroke,{waterGeometry:water});
  assert.equal(wet.length,2); // supplied water base layer and pigment layer
  assert.ok(wet.at(-1).geometry[0][0].every(([x,y])=>Math.abs(x)<=1&&Math.abs(y)<=1),'water pigment remains clipped to supplied water');
  assert.ok(coords.some(([x,y])=>Math.abs(x)>1||Math.abs(y)>1),'ground pigment remains outside supplied water');
});

test('support pruning preserves point channels across tips, targets, paint and erase with polygon holes',()=>{
  // The authored square cuts through the stroke support. Water has a hole and
  // a second polygon, exercising all polygon and hole membership paths.
  const authored=polygon(-1, -1, 1, 1),water=[
    {outer:[{x:-.8,y:-.8},{x:.8,y:-.8},{x:.8,y:.8},{x:-.8,y:.8}],holes:[[{x:-.25,y:-.25},{x:-.25,y:.25},{x:.25,y:.25},{x:.25,y:-.25}]]},
    {outer:[{x:2,y:2},{x:2.5,y:2},{x:2.5,y:2.5},{x:2,y:2.5}],holes:[]}
  ];
  const fill={...record([[]],{fill:true,opacity:.65,color:'#305ac0',target:'ground'}),polygons:authored};
  const strokes=[[{x:0,y:0},{x:.2,y:0}],[{x:.75,y:.75}]];
  const probes=[];
  for(let iy=-8;iy<=8;iy++)for(let ix=-8;ix<=8;ix++)probes.push({x:ix/8,y:iy/8});
  probes.push({x:-1,y:0},{x:1,y:0},{x:-.8,y:0},{x:.8,y:0},{x:-.25,y:0},{x:0,y:0},{x:.25,y:0},{x:.75,y:.75},{x:.95,y:.95},{x:1.01,y:0},{x:2,y:2},{x:2.25,y:2.25},{x:2.5,y:2.5});
  for(const tip of ['round','soft','textured'])for(const target of ['ground','water'])for(const operation of ['paint','erase']){
    const stroke={...record(strokes,{tip,radius:1.5,flow:.61,opacity:.73,seed:913,target,operation}),polygons:authored};
    const underlay={...fill,paint:{...fill.paint,target}};
    const args={palette,landColor,colorRecords:[underlay,stroke],waterGeometry:water};
    const supported=landscapeMaterialLayers(args),reference=landscapeMaterialLayers({...args,strokeSupport:false});
    for(const point of probes){
      const a=channelsAt(supported,point),b=channelsAt(reference,point);
      assert.deepEqual(a,b,`${tip}/${target}/${operation} diverged at ${JSON.stringify(point)}`);
    }
    const pigmentLayer=supported.at(-1),sourceForStroke=pigmentStrokeSource(stroke);
    assert.equal(contains(pigmentLayer.geometry,{x:.5,y:0}),target==='water','ground pigment excludes water interior and water pigment includes it');
    assert.equal(contains(pigmentLayer.geometry,{x:0,y:0}),target==='ground','the water polygon hole remains ground at its center');
    if(target==='ground')assert.equal(channelsAt(supported,{x:.5,y:0})[8],0,'water center receives no ground pigment overlay');
    assert.ok(inSupport(sourceForStroke.supportGeometry,{x:1.2,y:0}));
    assert.ok(!contains(pigmentLayer.geometry,{x:1.2,y:0}),'authored polygon clips the larger support rectangle');
    for(const point of probes)if(!inSupport(sourceForStroke.supportGeometry,point))assert.equal(sourceForStroke.alpha(point),0,'no positive alpha outside support');
  }
});

test('actual pruning of a wide authored footprint preserves painted and erased channels',()=>{
 const authored=polygon(-4,-4,4,4),water=polygon(-4,-4,0,4);
 for(const target of ['ground','water'])for(const operation of ['paint','erase']){
  const fill={...record([[]],{fill:true,target,opacity:.65}),polygons:authored};
  const stroke={...record([[{x:0,y:0}]],{target,operation,radius:1}),polygons:authored};
  const args={palette,landColor,colorRecords:[fill,stroke],waterGeometry:water};
  const clipped=landscapeMaterialLayers(args),reference=landscapeMaterialLayers({...args,strokeSupport:false});
  const outside={x:target==='ground'?3:-3,y:0};
  assert.ok(contains(reference.at(-1).geometry,outside));
  assert.ok(!contains(clipped.at(-1).geometry,outside),'this case actually prunes source geometry');
  for(let y=-3.75;y<4;y+=.25)for(let x=-3.75;x<4;x+=.25)
   assert.deepEqual(channelsAt(clipped,{x,y}),channelsAt(reference,{x,y}));
  const center={x:target==='ground'?.25:-.25,y:0};
  const initial=channelsAt(landscapeMaterialLayers({...args,colorRecords:[fill]}),center)[8];
  const result=channelsAt(clipped,center)[8];
  assert.ok(operation==='erase'?result<initial:result>initial,'the operation has an observable effect');
 }
});
