import {coupleRouteEdits} from './terrain-route-planner';
import {terrainGrid,terrainVisible,terrainSourceBounds,validateTerrainView,type TerrainView} from './terrain-spatial-model';
import {terrainRoughness} from './terrain-relief';
import type {LandscapeRecord} from './atlas-landscape';
import {strokeBox,validateStroke,type MaskSample} from './land-mask';
import {editHeight,TerrainSampler} from './terrain-height';

/** Strength is metres per second, feather is the soft fraction of the radius. */
export interface HeightStroke {
  mode:'raise'|'lower'|'smooth'|'level';
  radius:number; strength:number; feather:number; targetM?:number;
  roughness?:number; seed?:number;
  samples:MaskSample[];
  visibility?:TerrainView;
}
export function validateHeightStroke(s:HeightStroke){
  if(!s||!['raise','lower','smooth','level'].includes(s.mode)||
    !Number.isFinite(s.strength)||s.strength<=0||s.strength>100000||
    !Number.isFinite(s.feather)||s.feather<0||s.feather>1||
    (s.targetM!==undefined&&(!Number.isFinite(s.targetM)||Math.abs(s.targetM)>1e6))||
    (s.mode==='level'&&s.targetM===undefined)||
    (s.roughness!==undefined&&(!Number.isFinite(s.roughness)||s.roughness<0||s.roughness>2))||
    (s.seed!==undefined&&(!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff))||
    Object.keys(s).some(k=>!['mode','radius','strength','feather','targetM','roughness','seed','samples','visibility'].includes(k)))
    throw Error('Höhenpinsel prüfen.');
  if(s.visibility)validateTerrainView(s.visibility);
  validateStroke({...s,mode:'raise',roughness:0,seed:0});
}
export function heightBrushBounds(s:HeightStroke){
  validateHeightStroke(s);
  const b=strokeBox(s),pad=s.mode==='smooth'?s.radius/2:0;
  const box={x:b.x-pad,y:b.y-pad,width:b.width+2*pad,height:b.height+2*pad};
  return s.visibility?terrainSourceBounds(s.visibility,pad):box;
}
export function applyTerrainBrush(records:LandscapeRecord[],s:HeightStroke,limited?:(factor:number)=>void):LandscapeRecord[]{
  validateHeightStroke(s);
  const box=strokeBox(s),pixel=Math.max(1/64,2**Math.floor(Math.log2(s.radius/32))),edge=64*pixel;
  // Midpoint integration along the whole gesture, independent of event frequency.
  const dabs:{x:number;y:number;seconds:number}[]=[];
  for(let i=1;i<s.samples.length;i++){
    const a=s.samples[i-1]!,b=s.samples[i]!,dt=(b.t-a.t)/1000;
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(s.radius/8)),Math.ceil(dt*30));
    if(n+dabs.length>20000)throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    for(let j=0;j<n;j++){const t=(j+.5)/n;dabs.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,seconds:dt/n});}
  }
  const tiles=(Math.floor((box.x+box.width)/edge)-Math.floor(box.x/edge)+1)*(Math.floor((box.y+box.height)/edge)-Math.floor(box.y/edge)+1);
  if(dabs.length*tiles*4096>60000000)throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
  const source=new TerrainSampler(records,false),visibility=s.visibility?terrainGrid(records,s.visibility):null;
  const edited=editHeight(records,box,pixel,(p,old)=>{
    let dose=0;
    for(const d of dabs){
      const r=Math.hypot(p.x-d.x,p.y-d.y)/s.radius;if(r>=1)continue;
      const t=s.feather===0?1:Math.min(1,(1-r)/s.feather);
      dose+=d.seconds*t*t*(3-2*t);
    }
    if(!dose||visibility&&!terrainVisible(visibility,p))return undefined;
    let amount=s.strength*dose;
    if(s.mode==='raise'||s.mode==='lower'){
      // World-anchored modulation stays fixed throughout preview, retry and commit.
      // Its positive factor preserves direction even at maximum roughness.
      const seed=s.seed??0;
      amount*=1-(s.roughness??0)*.15*terrainRoughness(p.x/s.radius,p.y/s.radius,seed);
      if(s.mode==='raise')return s.targetM===undefined?old+amount:Math.max(old,Math.min(s.targetM,old+amount));
      return s.targetM===undefined?old-amount:Math.min(old,Math.max(s.targetM,old-amount));
    }
    let target=s.targetM??0;
    if(s.mode==='smooth'){
      // A fixed source snapshot makes smoothing independent of tile traversal.
      // Symmetric samples preserve planes and never overshoot local extrema.
      target=0;
      for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)
        target+=source.sample({x:p.x+x*s.radius/4,y:p.y+y*s.radius/4}).heightM/9;
    }
    return old+Math.sign(target-old)*Math.min(Math.abs(target-old),amount);
  });
  return coupleRouteEdits(records,edited,limited);
}
