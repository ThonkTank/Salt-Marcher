import type {VegetationInstance,VegetationSpec} from './vegetation';

export function vegetationRandom(seed:number,x:number,y:number,salt=0) {
  let h=(seed^Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(salt,2246822519))>>>0;
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
/** A parent always chooses one of its four children's representatives. The
 * canonical fine-cell candidate is independent of camera, density and tiling. */
export function vegetationRepresentative(seed:number,x:number,y:number,stride:number){
  while(stride>1){
    const half=stride/2,quadrant=Math.floor(vegetationRandom(seed,x,y,91+Math.log2(stride))*4);
    x+=(quadrant%2)*half;y+=Math.floor(quadrant/2)*half;stride=half;
  }
  return {x,y};
}
export function vegetationStride(spacing:number,mpp:number){
  return mpp<=2?1:2**Math.max(0,Math.ceil(Math.log2(Math.max(1,mpp*7/spacing))));
}
/** Last scale at which this automatic candidate belongs to the hierarchy.
 * No per-instance display fields are stored or sent through the bridge. */
export function vegetationScaleLimit(i:VegetationInstance,spec?:VegetationSpec){
  if(i.protected||!spec)return 0; // zero means an explicitly retained object
  if(i.asset==='grass'||i.asset==='shrub'||i.asset==='rock'&&(spec.preset.density>0||spec.preset.rocks<=.2))return 2;
  const parts=i.id.split(':'),x=Number(parts[1]),y=Number(parts[2]);
  if(!Number.isFinite(x)||parts[0]!=='row'&&!Number.isFinite(y))return 0;
  const maximum=vegetationStride(spec.spacing,80);
  let stride=1;
  for(let next=2;next<=maximum;next*=2){
    if(parts[0]==='row'){if(x%next)break;}
    else{
      const p=vegetationRepresentative(spec.seed,Math.floor(x/next)*next,Math.floor(y/next)*next,next);
      if(p.x!==x||p.y!==y)break;
    }
    stride=next;
  }
  return Math.min(80,Math.max(2,spec.spacing*stride/7));
}
export function vegetationOpacity(mpp:number,limit:number){
  if(!limit)return 1;
  const t=Math.max(0,Math.min(1,(mpp-limit*.75)/(limit*.25)));
  return 1-t*t*(3-2*t);
}
/** Horizontal crown scale only; height and protected dimensions stay physical. */
export function vegetationCrownScale(size:number,mpp:number,overviewWidth:number){
  return Math.max(1,mpp*overviewWidth/size);
}
