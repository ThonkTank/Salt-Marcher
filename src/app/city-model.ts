import {lineParts,linePoints,legacyLine} from './landscape-line';
import type {LandscapeRecord} from './atlas-landscape';
import {atlasPaint} from "./atlas-paint";
import {paintMarkup} from "./atlas-paint-svg";
import type {CityPoint as P,CityUnit,CityView,CityRecipe,CityPreview} from './city-contracts';
export function inside(p:P,poly:P[]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i]!,b=poly[j]!;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
export function posed(u:CityUnit):P[]{const c=Math.cos(u.angle??0),s=Math.sin(u.angle??0),p=u.position??{x:0,y:0};return(u.outline??[]).map(a=>({x:p.x+a.x*c-a.y*s,y:p.y+a.x*s+a.y*c}));}
export function roadPoints(u:CityUnit,units:CityUnit[]):P[]{const nodes=new Map(units.filter(n=>n.kind==='node').map(n=>[n.id,n.point!]));const ids=u.nodeIds??[];return ids.length>=2?[nodes.get(ids[0]!)!,...(u.via??[]),nodes.get(ids.at(-1)!)!].filter(Boolean):u.outline??[];}
const distance=(p:P,a:P,b:P)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),x=a.x+t*dx,y=a.y+t*dy;return{distance:Math.hypot(p.x-x,p.y-y),angle:Math.atan2(dy,dx)};};
function seedNumber(s:string){let v=2166136261;for(const c of s)v=Math.imul(v^c.charCodeAt(0),16777619);return v>>>0;}
export async function generateCity(view:CityView,r:CityRecipe,cancel:()=>boolean,progress:(n:number)=>void):Promise<CityPreview>{
 if(!r.seed.trim()||!Number.isFinite(r.density)||r.density<.05||r.density>1||!Number.isFinite(r.size)||r.size<3||r.size>80||!Number.isFinite(r.reach)||r.reach<10||r.reach>500)throw new Error('Seed, Dichte, Hausgröße und Straßenabstand prüfen.');
 const district=view.units.find(u=>u.id===r.districtId&&u.kind==='district');if(!district?.outline)throw new Error('Wähle ein Viertel als Bebauungsfläche.');
 const roads=view.units.filter(u=>u.kind==='road').flatMap(u=>{const p=linePoints(cityRoadRecord(u,view.units));return p.slice(1).map((b,i)=>({a:p[i]!,b,width:u.width??6}));});if(!roads.length)throw new Error('Lege zuerst eine Straße an.');
 const replacement=view.units.filter(u=>u.kind==='building'&&u.districtId===r.districtId&&!u.protected),replaceIds=replacement.map(u=>u.id),obstacles=view.units.filter(u=>u.kind==='building'&&!replaceIds.includes(u.id)),excluded=view.units.filter(u=>['water','plaza'].includes(u.kind));
 const points=district.outline,minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),step=r.size*1.55;
 if((maxX-minX)*(maxY-minY)/(step*step)>150000)throw new Error('Fläche für diese Hausgröße zu groß. Teile sie in kleinere Viertel.');
 let state=seedNumber(r.seed)||1;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 const bins=new Map<string,{minX:number;minY:number;maxX:number;maxY:number}[]>(),cell=Math.max(8,r.size*3);
 const bounds=(p:P[])=>({minX:Math.min(...p.map(a=>a.x))-1,minY:Math.min(...p.map(a=>a.y))-1,maxX:Math.max(...p.map(a=>a.x))+1,maxY:Math.max(...p.map(a=>a.y))+1});
 const keys=(b:ReturnType<typeof bounds>)=>{const a:string[]=[];for(let x=Math.floor(b.minX/cell);x<=Math.floor(b.maxX/cell);x++)for(let y=Math.floor(b.minY/cell);y<=Math.floor(b.maxY/cell);y++)a.push(x+':'+y);return a;};
 const index=(b:ReturnType<typeof bounds>)=>{for(const k of keys(b)){const v=bins.get(k)??[];v.push(b);bins.set(k,v);}};for(const u of obstacles)index(bounds(posed(u)));
 const buildings:CityUnit[]=[];let attempts=0;
 for(let y=minY+step/2;y<maxY;y+=step)for(let x=minX+step/2;x<maxX;x+=step){
  if(cancel())throw new Error('Bebauungsvorschau abgebrochen.');attempts++;if(attempts%200===0){progress(buildings.length);await new Promise<void>(resolve=>setTimeout(resolve,0));}
  if(random()>r.density)continue;const p={x:x+(random()-.5)*step*.4,y:y+(random()-.5)*step*.4};if(!inside(p,points)||excluded.some(u=>inside(p,u.outline??[])))continue;
  let nearest={distance:Infinity,angle:0,width:6};for(const road of roads){const d=distance(p,road.a,road.b);if(d.distance<nearest.distance)nearest={...d,width:road.width};}if(nearest.distance>r.reach)continue;
  const w=r.size*(.7+random()*.5),h=r.size*(.7+random()*.7),u:CityUnit={id:view.header.id+':building:'+seedNumber(r.seed)+':'+attempts,kind:'building',name:'',protected:false,position:p,angle:nearest.angle,outline:[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}],use:r.use,notes:'',districtId:r.districtId,ownerId:null,recipe:{seed:r.seed,algorithm:'street-infill-v1'},rooms:[],interior:false};
  if(obstacles.some(a=>a.id===u.id))continue;const corners=posed(u);if(corners.some(a=>!inside(a,points)||excluded.some(e=>inside(a,e.outline??[]))))continue;
  if(roads.some(a=>distance(p,a.a,a.b).distance<a.width/2+Math.hypot(w,h)/2+1))continue;
  const b=bounds(corners);if(keys(b).some(k=>(bins.get(k)??[]).some(a=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY)))continue;
  index(b);buildings.push(u);if(buildings.length>=5000)throw new Error('Mehr als 5.000 Häuser in einer Vorschau. Teile das Viertel auf.');
 }
 return{cityId:view.header.id,baseRevision:view.header.revision,recipe:{...r},buildings,replaceIds,attempts};
}
export function cityRoadRecord(u:CityUnit,units:CityUnit[]=[]):LandscapeRecord{return {id:u.id,revision:u.roadRevision??0,kind:'road',name:u.name,points:roadPoints(u,units),width:u.width??6,polygons:[],resolution:1,values:{},line:u.line??{...legacyLine('road'),color:'#c1ae8b'},routeId:u.routeId,routeLength:u.routeLength};}
export function cityPaint(v:import("./atlas-region-contracts").CityGeometry,mpp=0,phase:'all'|'surfaces'|'objects'='all'){
 const pts=(p:P[])=>p,h=v.header,root=atlasPaint("group", {size:{width:h.width,height:h.height}});
 root.title=h.name;if(phase!=='objects')root.append(atlasPaint("rect", {width: h.width, height: h.height, style: {fill: h.paper}}));
 if(phase!=='objects')for(const u of v.units.filter(u=>['district','water','plaza'].includes(u.kind)))root.append(atlasPaint("polygon", {points: pts(u.outline??[]), style: {fill: u.kind==='water'?'#8eafb9':u.kind==='plaza'?'#d9c6a4':'#e0d2b9', stroke: '#a69071', lineWidth: .7}}),atlasPaint("text", {x: u.outline?.[0]?.x??0, y: u.outline?.[0]?.y??0, style: {fontSize: 8, fill: '#52452e'}}, u.name));
 if(phase!=='surfaces')for(const u of v.units.filter(u=>u.kind==='road'||u.kind==='wall')){
  if(u.kind==='wall'){root.append(atlasPaint('polyline',{points:roadPoints(u,v.units),style:{fill:null,stroke:'#625e52',lineWidth:u.width??6,lineJoin:'round',lineCap:'round'}}));continue;}
  for(const p of lineParts(cityRoadRecord(u,v.units),mpp))root.append(atlasPaint(p.polygons?'polygons':'polyline',{points:p.points,polygons:p.polygons,opacity:p.opacity,style:{fill:p.polygons?p.color:null,stroke:p.polygons?null:p.color,lineWidth:p.width,lineDash:p.dash,lineDashOffset:p.dashOffset,lineJoin:'round',lineCap:'round'}}));
 }
 if(phase!=='surfaces') for(const u of v.units.filter(u=>u.kind==='building')){
  const group=atlasPaint("group", {data: {cityUnit: String(u.id)}});group.append(atlasPaint("polygon", {points: pts(posed(u)), style: {fill: h.roof, stroke: '#624337', lineWidth: .8}}));
  if(u.name)group.append(atlasPaint("text", {x: u.position!.x, y: u.position!.y, style: {fontSize: 6, textAlign: 'center', fill: '#352822'}}, u.name));root.append(group);
 }
 return root;
}
export function citySvg(v:import("./atlas-region-contracts").CityGeometry,mpp=0){return paintMarkup(cityPaint(v,mpp));}
