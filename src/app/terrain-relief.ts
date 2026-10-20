import type {Point} from './contracts';

/** Shared by the canvas raster, worker preview and export. Heights never choose a biome. */
export interface TerrainStyle {
  version:1;
  mode:'drawn'|'shaded'|'height';
  land:string;
  ink:string;
  lightDegrees:number;
  strength:number;
}
export const DEFAULT_TERRAIN_STYLE:Readonly<TerrainStyle>=Object.freeze({
  version:1,mode:'drawn',land:'#eee5cf',ink:'#685639',lightDegrees:315,strength:.65,
});
export function validateTerrainStyle(s:TerrainStyle){
  if(!s||s.version!==1||!['drawn','shaded','height'].includes(s.mode)||
    !/^#[0-9a-f]{6}$/i.test(s.land)||!/^#[0-9a-f]{6}$/i.test(s.ink)||
    !Number.isFinite(s.lightDegrees)||s.lightDegrees<0||s.lightDegrees>=360||
    !Number.isFinite(s.strength)||s.strength<0||s.strength>1||
    Object.keys(s).some(k=>!['version','mode','land','ink','lightDegrees','strength'].includes(k)))throw Error('Reliefstil prüfen.');
}
export const reliefRgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function reliefLighting(style:TerrainStyle){
  const angle=style.lightDegrees*Math.PI/180,sin=Math.sin(angle),cos=Math.cos(angle),strength=style.strength*.55;
  return (sx:number,sy:number)=>1+strength*((-sx*sin+sy*cos+1)/Math.hypot(sx,sy,1)-1);
}
export function reliefLight(sx:number,sy:number,style:TerrainStyle){return reliefLighting(style)(sx,sy);}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Explicit analysis mode, relative to sea level. No snow or terrain-type writes. */
export function elevationColor(heightM:number,seaLevelM:number){
  const t=Math.min(1,Math.max(0,(heightM-seaLevelM)/3000)),low=[189,209,148],mid=[206,177,111],high=[145,105,92];
  return low.map((v,i)=>t<.4?mix(v,mid[i]!,t/.4):mix(mid[i]!,high[i]!,(t-.4)/.6));
}
function noise(x:number,y:number,salt:number){
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^salt;
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
export interface ReliefMark {points:Point[];opacity:number;width:number}
/** Two world-anchored dyadic lattices crossfade; pan/tile origin never seeds marks. */
export function reliefMarks(
  box:{x:number;y:number;width:number;height:number},mpp:number,
  sample:(p:Point)=>{heightM:number;sx:number;sy:number;water:boolean},strength:number,
):ReliefMark[]{
  if(!Number.isFinite(mpp)||mpp<=0||!strength)return [];
  const level=Math.log2(mpp*11),base=Math.floor(level),blend=level-base,out:ReliefMark[]=[];
  for(const [exponent,opacity]of [[base,1-blend],[base+1,blend]]){
    if(opacity!<.001)continue;
    const spacing=2**exponent!,pad=spacing*.65;
    const x0=Math.floor((box.x-pad)/spacing),x1=Math.ceil((box.x+box.width+pad)/spacing),y0=Math.floor((box.y-pad)/spacing),y1=Math.ceil((box.y+box.height+pad)/spacing);
    if((x1-x0+1)*(y1-y0+1)>100000)throw Error('Reliefausschnitt zu groß.');
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      if(noise(x,y,31)<.18)continue;
      const p={x:(x+.15+.7*noise(x,y,13))*spacing,y:(y+.15+.7*noise(x,y,71))*spacing};
      const q=sample(p),slope=Math.hypot(q.sx,q.sy),density=Math.min(1,Math.max(0,(slope-.065)/.32));
      if(q.water||density===0)continue;
      const length=spacing*(.28+.28*noise(x,y,19))*Math.min(1,.5+slope),dx=-q.sx/slope*length,dy=-q.sy/slope*length,bend=(noise(x,y,47)-.5)*.22;
      const end={x:p.x+dx,y:p.y+dy};
      if(sample(end).water)continue;
      out.push({points:[p,{x:p.x+dx*.5-dy*bend,y:p.y+dy*.5+dx*bend},end],opacity:opacity!*strength*density*(.22+.2*noise(x,y,97)),width:mpp*.8});
    }
  }
  return out;
}

/** Smooth, non-periodic world texture avoids the old sine-product checkerboard. */
export function terrainRoughness(x:number,y:number,seed:number){
  const octave=(x:number,y:number)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,tx=fx*fx*(3-2*fx),ty=fy*fy*(3-2*fy);
    return mix(mix(noise(ix,iy,seed),noise(ix+1,iy,seed),tx),mix(noise(ix,iy+1,seed),noise(ix+1,iy+1,seed),tx),ty);
  };
  return octave(x*3,y*3)*.65+octave(x*7,y*7)*.25+octave(x*15,y*15)*.1;
}
