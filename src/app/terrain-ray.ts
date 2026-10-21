import type {TerrainGrid} from './terrain-spatial-model';
import {terrainGridLayout,terrainGridCoordinate} from './terrain-grid-layout';

interface Vector {x:number;y:number;z:number}
/** Intersect the exact two triangles per heightfield cell. The ray parameter
 * stays in the caller's units, including when vertical exaggeration is undone.
 * Walk crossed cells rather than scanning every triangle on pointer movement. */
export function terrainRaycast(grid:TerrainGrid,origin:Vector,direction:Vector,near=0,far=Infinity):number|null{
  const v=grid.view,b=v.box,l=terrainGridLayout(v),h=grid.heights;
  let enter=Math.max(0,near),leave=far;
  for(const [at,delta,min,max]of [[origin.x,direction.x,b.x,b.x+b.width],[origin.y,direction.y,b.y,b.y+b.height]] as const){
    if(delta===0){if(at<min||at>max)return null;continue;}
    const a=(min-at)/delta,z=(max-at)/delta;enter=Math.max(enter,Math.min(a,z));leave=Math.min(leave,Math.max(a,z));
  }
  if(leave<enter)return null;
  const cell=(coordinate:number,count:number,direction:number)=>Math.max(0,Math.min(count-2,Math.floor(coordinate)-(direction<0&&coordinate===Math.floor(coordinate)?1:0)));
  let ix=cell(terrainGridCoordinate(l.x,origin.x+direction.x*enter),v.columns,direction.x),iy=cell(terrainGridCoordinate(l.y,origin.y+direction.y*enter),v.rows,direction.y);
  let start=enter;
  for(let n=0;n<v.columns+v.rows+4;n++){
    const x0=l.x.values[ix]!,y0=l.y.values[iy]!,sx=l.x.values[ix+1]!-x0,sy=l.y.values[iy+1]!-y0,i=iy*v.columns+ix;
    const tx=direction.x===0?Infinity:(l.x.values[ix+(direction.x>0?1:0)]!-origin.x)/direction.x;
    const ty=direction.y===0?Infinity:(l.y.values[iy+(direction.y>0?1:0)]!-origin.y)/direction.y;
    const end=Math.min(tx,ty,leave);
    let closest=Infinity;
    for(let triangle=0;triangle<2;triangle++){
      const z0=triangle?h[i+1]!+h[i+v.columns]!-h[i+v.columns+1]!:h[i]!;
      const dx=(triangle?h[i+v.columns+1]!-h[i+v.columns]!:h[i+1]!-h[i]!)/sx;
      const dy=(triangle?h[i+v.columns+1]!-h[i+1]!:h[i+v.columns]!-h[i]!)/sy;
      const denominator=direction.z-dx*direction.x-dy*direction.y;
      if(denominator>=0)continue; // Same front-face rule as the displayed mesh.
      const t=(z0+dx*(origin.x-x0)+dy*(origin.y-y0)-origin.z)/denominator;
      const epsilon=Math.max(1,Math.abs(t))*1e-10;
      if(t<near||t>far||t<start-epsilon||t>end+epsilon||t>=closest)continue;
      const u=(origin.x+direction.x*t-x0)/sx,w=(origin.y+direction.y*t-y0)/sy;
      if(u< -1e-9||w< -1e-9||u>1+1e-9||w>1+1e-9||(triangle?u+w<1-1e-9:u+w>1+1e-9))continue;
      closest=t;
    }
    if(closest!==Infinity)return closest;
    if(end>=leave||!Number.isFinite(end)||end<=start)return null;
    if(tx<=ty)ix+=direction.x>0?1:-1;
    if(ty<=tx)iy+=direction.y>0?1:-1;
    if(ix<0||iy<0||ix>=v.columns-1||iy>=v.rows-1)return null;
    start=end;
  }
  return null;
}
