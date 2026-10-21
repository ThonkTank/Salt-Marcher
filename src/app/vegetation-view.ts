import {vegetationOpacity,vegetationScaleLimit} from './vegetation-lod';
import {atlasPaint,type AtlasPaint} from './atlas-paint';
import type {LandscapeRecord,LandscapeBox} from './atlas-landscape';
import type {VegetationInstance} from './vegetation';

export const vegetationColors={oak:'#55764b',pine:'#3e6654',shrub:'#7f945b',grass:'#96a564',rock:'#8e8778'};
export function drawVegetation(root:AtlasPaint,r:LandscapeRecord,box:LandscapeBox,mpp:number) {
  if(!r.vegetation)return;
  // The transparent footprint participates in picking without covering water or
  // the canonical terrain-aware surface raster.
  root.append(atlasPaint('polygons',{polygons:r.polygons.map(p=>({outer:p.outer.map(v=>({x:v.x-box.x,y:v.y-box.y})),holes:p.holes.map(h=>h.map(v=>({x:v.x-box.x,y:v.y-box.y})))})),style:{fill:'#000000',fillOpacity:.001},data:{landscapeId:r.id}}));
  for(const i of r.vegetationView?.instances??[])drawVegetationInstance(root,i,r.id,box,mpp,r.vegetationView?.mode==='canopy',vegetationOpacity(mpp,vegetationScaleLimit(i,r.vegetation)));
}
export function drawVegetationInstance(root:AtlasPaint,i:VegetationInstance,areaId:string,box:LandscapeBox,mpp:number,canopy=false,opacity=1) {
  if(opacity<.001)return;
  const tree=i.asset==='oak'||i.asset==='pine',radius=Math.max(i.size*(tree?.32:.5),canopy&&!i.protected&&tree?mpp*3:0),
    x=i.x-box.x,y=i.y-box.y,color=vegetationColors[i.asset];
  const category=tree?'trees':i.asset==='rock'?'rocks':'undergrowth';
  const group=atlasPaint('group',{opacity,data:{landscapeId:areaId,vegetationInstance:i.id,['vegetation-'+category]:i.id},title:i.conflict?'Geschütztes Objekt: Konflikt mit Gelände oder Bebauung':i.protected?'Geschütztes Einzelobjekt':i.asset==='rock'?'Felsen':'Bewuchs'});
  group.append(atlasPaint('circle',{x:x+radius*.2,y:y+radius*.3,radius,opacity:.18,style:{fill:'#354738'},pointer:false}));
  const sides=i.asset==='rock'?6:i.asset==='pine'?10:12;
  const points=Array.from({length:sides},(_,n)=>{
    const a=n/sides*Math.PI*2+i.angle,rad=radius*(i.asset==='pine'&&n%2?.65:1);
    return{x:x+Math.cos(a)*rad,y:y+Math.sin(a)*rad};
  });
  group.append(atlasPaint('polygon',{points,style:{fill:color,stroke:i.conflict?'#b95828':'#334c3e',lineWidth:Math.min(radius*.12,mpp*.7)}}));
  group.append(atlasPaint('circle',{x:x-radius*.22,y:y-radius*.22,radius:radius*.42,opacity:.2,style:{fill:'#e6e5b9'},pointer:false}));
  root.append(group);
}
