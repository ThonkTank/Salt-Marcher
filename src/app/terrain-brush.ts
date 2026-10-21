import {coupleRouteEdits} from './terrain-route-planner';
import {terrainGrid,terrainVisibility,terrainSourceBounds,validateTerrainView,type TerrainView,type TerrainGrid} from './terrain-spatial-model';
import {terrainRoughness} from './terrain-relief';
import type {LandscapeRecord} from './atlas-landscape';
import {strokeBox,validateStroke,type MaskSample} from './land-mask';
import {editHeight,TerrainSampler} from './terrain-height';

/** Strength is metres per second, feather is the soft fraction of the radius. */
export interface HeightStroke {
  mode:'raise'|'lower'|'roughen'|'smooth'|'level';
  radius:number; strength:number; feather:number; targetM?:number;
  roughness?:number; seed?:number;
  samples:MaskSample[];
  visibility?:TerrainView;
}
export function validateHeightStroke(s:HeightStroke){
  if(!s||!['raise','lower','roughen','smooth','level'].includes(s.mode)||
    !Number.isFinite(s.strength)||s.strength<=0||s.strength>100000||
    !Number.isFinite(s.feather)||s.feather<0||s.feather>1||
    (s.targetM!==undefined&&(!Number.isFinite(s.targetM)||Math.abs(s.targetM)>1e6))||
    (s.mode==='level'&&s.targetM===undefined)||
    (s.mode==='roughen'&&s.targetM!==undefined)||
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
/** Authored height bands retain the existing sub-metre editing range. */
export const heightBrushResolution=(radius:number)=>Math.max(2**-24,2**Math.floor(Math.log2(radius/32)));
export const heightBrushPixel=heightBrushResolution;
/** Filter only the legacy base; fine additive bands remain untouched by coarser tools. */
export function scaleHeightSampler(records:LandscapeRecord[],pixel:number){
  const base=new TerrainSampler(records.filter(r=>r.height?.version!==2),false);
  const bands=new TerrainSampler(records.filter(r=>r.height?.version===2&&r.height.pixel>=pixel),false);
  return (p:{x:number;y:number})=>{
    let height=0;
    for(const y of [-.375,-.125,.125,.375])for(const x of [-.375,-.125,.125,.375])height+=base.sample({x:p.x+x*pixel,y:p.y+y*pixel}).heightM/16;
    return height+bands.sample(p).heightM+100;
  };
}
export function applyTerrainBrush(records:LandscapeRecord[],s:HeightStroke,limited?:(factor:number)=>void,canonicalVisibility?:TerrainGrid,scaleHeight?:(p:{x:number;y:number})=>number,uncoupled=false):LandscapeRecord[]{
  validateHeightStroke(s);
  const box=strokeBox(s),pixel=heightBrushPixel(s.radius),edge=64*pixel;
  // Midpoint integration along the whole gesture, independent of event frequency.
  const dabs:{x:number;y:number;seconds:number}[]=[];
  for(let i=1;i<s.samples.length;i++){
    const a=s.samples[i-1]!,b=s.samples[i]!,dt=(b.t-a.t)/1000;
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(s.radius/8)),Math.ceil(dt*30));
    if(n+dabs.length>20000)throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,last=dabs.at(-1);
      // Holding the brush still adds duration, not thousands of identical evaluations.
      if(last&&last.x===x&&last.y===y)last.seconds+=dt/n;else dabs.push({x,y,seconds:dt/n});
    }
  }
  const tiles=(Math.floor((box.x+box.width)/edge)-Math.floor(box.x/edge)+1)*(Math.floor((box.y+box.height)/edge)-Math.floor(box.y/edge)+1);
  if(dabs.length*tiles*4096>60000000)throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
  const needsSource=s.mode==='smooth'||s.targetM!==undefined,source=needsSource?(scaleHeight??scaleHeightSampler(records,pixel)):undefined,visibility=s.visibility?(canonicalVisibility??terrainGrid(records,s.visibility)):null;
  const visible=visibility?terrainVisibility(visibility):undefined;
  const edited=editHeight(records,box,pixel,(p,prior)=>{
    let dose=0;
    for(const d of dabs){
      const r=Math.hypot(p.x-d.x,p.y-d.y)/s.radius;if(r>=1)continue;
      const t=s.feather===0?1:Math.min(1,(1-r)/s.feather);
      dose+=d.seconds*t*t*(3-2*t);
    }
    if(!dose||visible&&!visible(p))return undefined;
    const old=source?.(p)??0;
    let amount=s.strength*dose;
    // Signed, world-anchored noise adds peaks and hollows without changing
    // the existing directional modulation. Preview and commit use the same seed.
    if(s.mode==='roughen')return prior+amount*(2*terrainRoughness(p.x/s.radius,p.y/s.radius,s.seed??0)-1);
    if(s.mode==='raise'||s.mode==='lower'){
      // World-anchored modulation stays fixed throughout preview, retry and commit.
      // Its positive factor preserves direction even at maximum roughness.
      const seed=s.seed??0;
      if(s.roughness)amount*=1-s.roughness*.15*terrainRoughness(p.x/s.radius,p.y/s.radius,seed);
      if(s.mode==='raise')return prior+(s.targetM===undefined?amount:Math.max(0,Math.min(s.targetM-old,amount)));
      return prior-(s.targetM===undefined?amount:Math.max(0,Math.min(old-s.targetM,amount)));
    }
    let target=s.targetM??0;
    if(s.mode==='smooth'){
      // A fixed source snapshot makes smoothing independent of tile traversal.
      // Symmetric samples preserve planes and never overshoot local extrema.
      target=0;
      for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)
        target+=source!({x:p.x+x*s.radius/4,y:p.y+y*s.radius/4})/9;
    }
    return prior+Math.sign(target-old)*Math.min(Math.abs(target-old),amount);
  },2);
  return uncoupled?edited:coupleRouteEdits(records,edited,limited);
}
