import type {CityPoint as P,CityUnit,CityView,CityRecipe,CityPreview,CityInfillRecipe} from './city-contracts';
export function inside(p:P,poly:P[]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i]!,b=poly[j]!;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
export function posed(u:CityUnit):P[]{const c=Math.cos(u.angle??0),s=Math.sin(u.angle??0),p=u.position??{x:0,y:0};return(u.outline??[]).map(a=>({x:p.x+a.x*c-a.y*s,y:p.y+a.x*s+a.y*c}));}
export function roadPoints(u:CityUnit,units:CityUnit[]):P[]{const nodes=new Map(units.filter(n=>n.kind==='node').map(n=>[n.id,n.point!]));const ids=u.nodeIds??[];return ids.length>=2?[nodes.get(ids[0]!)!,...(u.via??[]),nodes.get(ids.at(-1)!)!].filter(Boolean):u.outline??[];}
const distance=(p:P,a:P,b:P)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),x=a.x+t*dx,y=a.y+t*dy;return{distance:Math.hypot(p.x-x,p.y-y),angle:Math.atan2(dy,dx)};};

const edges=(p:P[]):[P,P][]=>p.map((a,i)=>[a,p[(i+1)%p.length]!] as [P,P]);
const turn=(a:P,b:P,c:P)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function crosses(a:P,b:P,c:P,d:P){return turn(a,b,c)*turn(a,b,d)<-1e-9&&turn(c,d,a)*turn(c,d,b)<-1e-9;}
function polygonNearSegment(poly:P[],a:P,b:P,gap:number){return inside(a,poly)||inside(b,poly)||edges(poly).some(([c,d])=>crosses(a,b,c,d)||Math.min(distance(c,a,b).distance,distance(d,a,b).distance,distance(a,c,d).distance,distance(b,c,d).distance)<gap+1e-8);}
function polygonsNear(a:P[],b:P[],gap:number){return !!a.length&&!!b.length&&(inside(a[0]!,b)||inside(b[0]!,a)||edges(b).some(([c,d])=>polygonNearSegment(a,c,d,gap)));}
function segmentRange(a:P,b:P,minX:number,maxX:number,minY:number,maxY:number):[number,number]|null{
 let lo=0,hi=1;for(const [origin,delta,min,max] of [[a.x,b.x-a.x,minX,maxX],[a.y,b.y-a.y,minY,maxY]] as const){if(Math.abs(delta)<1e-12){if(origin<min||origin>max)return null;continue;}const t1=(min-origin)/delta,t2=(max-origin)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>=hi)return null;}return[lo,hi];
}
function seedNumber(s:string){let v=2166136261;for(const c of s)v=Math.imul(v^c.charCodeAt(0),16777619);return v>>>0;}
export function checkedCityInfill(r:CityInfillRecipe){
 if(!r||(r.lanes!==undefined&&typeof r.lanes!=='boolean')||typeof r.seed!=='string'||!r.seed.trim()||r.seed.length>1000||typeof r.use!=='string'||r.use.length>1000||!Number.isFinite(r.density)||r.density<.05||r.density>1||!Number.isFinite(r.size)||r.size<3||r.size>80||!Number.isFinite(r.reach)||r.reach<10||r.reach>500)throw new Error('Seed, Dichte, Hausgröße und Straßenabstand prüfen.');
}
// A proposed street network is ordinary editable city geometry after acceptance.
// Existing roads, including accepted generated lanes, are never rewritten by infill.
type StreetSegment={a:P;b:P;width:number};
const streetOrder=(a:StreetSegment,b:StreetSegment)=>Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y)-Math.hypot(a.b.x-a.a.x,a.b.y-a.a.y)||a.a.x-b.a.x||a.a.y-b.a.y||a.b.x-b.b.x||a.b.y-b.b.y||a.width-b.width;
async function sideStreets(view:CityView,r:CityRecipe,points:P[],cancel:()=>boolean):Promise<CityUnit[]>{
 if(!r.lanes||view.units.some(u=>u.kind==='road'&&u.districtId===r.districtId&&u.recipe?.algorithm==='district-lanes-v1'))return[];
 const sources=view.units.filter(u=>u.kind==='road').flatMap(u=>{const p=roadPoints(u,view.units);return p.slice(1).map((b,i)=>({a:p[i]!,b,width:u.width??6}));}).sort(streetOrder);
 const proposed:CityUnit[]=[];
 for(const source of sources){
  const next=await streetGrid({...view,units:[...view.units,...proposed]},r,points,source,cancel);proposed.push(...next);
  if(proposed.filter(u=>u.kind==='road').length>2500)throw new Error('Zu viele Nebenstraßen. Teile das Viertel in kleinere Flächen.');
 }
 return proposed;
}
async function streetGrid(view:CityView,r:CityRecipe,points:P[],source:StreetSegment,cancel:()=>boolean):Promise<CityUnit[]>{
 const roads=view.units.filter(u=>u.kind==='road').flatMap(u=>{const p=roadPoints(u,view.units);return p.slice(1).map((b,i)=>({a:p[i]!,b,width:u.width??6,generated:u.recipe?.algorithm==='district-lanes-v1'}));});
 const bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
 if(!segmentRange(source.a,source.b,bounds.minX,bounds.maxX,bounds.minY,bounds.maxY))return[];
 const length=Math.hypot(source.b.x-source.a.x,source.b.y-source.a.y);if(length<r.size*2)return[];
 const ux=(source.b.x-source.a.x)/length,uy=(source.b.y-source.a.y)/length,local=(p:P)=>({x:(p.x-source.a.x)*ux+(p.y-source.a.y)*uy,y:-(p.x-source.a.x)*uy+(p.y-source.a.y)*ux});
 const world=(x:number,y:number):P=>({x:Math.round((source.a.x+x*ux-y*uy)*1e6)/1e6,y:Math.round((source.a.y+x*uy+y*ux)*1e6)/1e6});
 const projected=points.map(local),minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x)),minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y));
 const width=Math.max(3,Math.min(5,r.size*.35)),gap=width/2+1.2,block=r.size*5+width;
 const blocked=view.units.filter(u=>['plaza','water'].includes(u.kind)||(u.kind==='building'&&(u.protected||u.districtId!==r.districtId))).map(u=>u.kind==='building'?posed(u):u.outline??[]);
 const walls=view.units.filter(u=>u.kind==='wall').flatMap(u=>{const p=roadPoints(u,view.units);return p.slice(1).map((b,i)=>({a:p[i]!,b,width:u.width??6}));});
 const districtEdges=edges(points),nodes=new Map<string,CityUnit>(),network:CityUnit[]=[],existingIds=new Set(view.units.map(u=>u.id));
 const prefix=view.header.id+':lanes:'+r.districtId+':'+seedNumber(r.seed)+':';let attempts=0;
 const allowed=(a:P,b:P)=>{
  // Sample the full corridor, including boundaries of concave districts.
  if([a,b,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}].some(p=>!inside(p,points)))return false;
  if(districtEdges.some(([c,d])=>crosses(a,b,c,d)||Math.min(distance(a,c,d).distance,distance(b,c,d).distance)<gap))return false;
  if(blocked.some(poly=>polygonNearSegment(poly,a,b,gap)))return false;
  if(roads.some(s=>s.generated&&crosses(a,b,s.a,s.b)))return false;
  if(walls.some(w=>crosses(a,b,w.a,w.b)||Math.min(distance(a,w.a,w.b).distance,distance(b,w.a,w.b).distance,distance(w.a,a,b).distance,distance(w.b,a,b).distance)<width/2+w.width/2+1.2))return false;
  // Crossing another road is a junction. Closely parallel duplicates are omitted.
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  return !roads.some(s=>{const sx=s.b.x-s.a.x,sy=s.b.y-s.a.y,sl=Math.hypot(sx,sy);return sl>0&&Math.abs(dx*sy-dy*sx)/(len*sl)<.2&&Math.min(distance(a,s.a,s.b).distance,distance(b,s.a,s.b).distance)<width/2+s.width/2+r.size;});
 };
 const add=async(a:P,b:P)=>{
  if(cancel())throw new Error('Bebauungsvorschau abgebrochen.');if(++attempts%100===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  if(!allowed(a,b))return false;
  const key=(p:P)=>p.x+','+p.y,ak=key(a),bk=key(b),id=prefix+'road:'+ak+':'+bk;if([id,prefix+'node:'+ak,prefix+'node:'+bk].some(id=>existingIds.has(id)))return false;
  for(const [k,p] of [[ak,a],[bk,b]] as const)if(!nodes.has(k))nodes.set(k,{id:prefix+'node:'+k,kind:'node',name:'',protected:false,point:p,districtId:r.districtId});
  network.push({id,kind:'road',name:'Nebenstraße',protected:false,nodeIds:[nodes.get(ak)!.id,nodes.get(bk)!.id],via:[],width,districtId:r.districtId,recipe:{seed:r.seed,algorithm:'district-lanes-v1'}});
  if(network.length>2500)throw new Error('Zu viele Nebenstraßen. Teile das Viertel in kleinere Flächen.');return true;
 };
 // Columns attach to the existing main road. Lateral links join only reached columns,
 // producing connected blocks rather than isolated rear houses or detached streets.
 const columns:{x:number;reached:Set<number>}[]=[];
 const phase=(seedNumber(r.seed+'lanes')%1000)/1000;
 for(let x=Math.max(0,minX)+block*(.35+phase*.3);x<Math.min(length,maxX);x+=block*(1+(Math.sin(x*.017+phase)*.12))){
  const origin=world(x,0);if(!inside(origin,points))continue;const reached=new Set([0]);
  for(const side of [-1,1]){let previous=origin;for(let row=1;row*block<=Math.min(r.reach*2,side<0?-minY:maxY);row++){
   const next=world(x,side*row*block);if(!await add(previous,next))break;reached.add(side*row);previous=next;
  }}
  if(reached.size>1)columns.push({x,reached});
 }
 for(let i=1;i<columns.length;i++){const a=columns[i-1]!,b=columns[i]!;if(b.x-a.x>block*1.5)continue;for(const row of a.reached)if(row&&b.reached.has(row))await add(world(a.x,row*block),world(b.x,row*block));}
 return[...nodes.values(),...network];
}
export async function generateCity(view:CityView,r:CityRecipe,cancel:()=>boolean,progress:(n:number)=>void):Promise<CityPreview>{
 checkedCityInfill(r);
 await new Promise<void>(resolve=>setTimeout(resolve,0));if(cancel())throw new Error('Bebauungsvorschau abgebrochen.');
 const district=view.units.find(u=>u.id===r.districtId&&u.kind==='district');if(!district?.outline)throw new Error('Wähle ein Viertel als Bebauungsfläche.');
 const points=district.outline,minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),step=r.size*1.55;
 if((maxX-minX)*(maxY-minY)/(step*step)>150000)throw new Error('Fläche für diese Hausgröße zu groß. Teile sie in kleinere Viertel.');
 const streets=await sideStreets(view,r,district.outline,cancel),streetUnits=[...view.units,...streets];
 const roads=streetUnits.filter(u=>u.kind==='road').flatMap(u=>{const p=roadPoints(u,streetUnits);return p.slice(1).map((b,i)=>({a:p[i]!,b,width:u.width??6}));}).sort(streetOrder);if(!roads.length)throw new Error('Lege zuerst eine Straße an.');
 const replacement=view.units.filter(u=>u.kind==='building'&&u.districtId===r.districtId&&!u.protected),replaceIds=replacement.map(u=>u.id),replaceSet=new Set(replaceIds),obstacles=view.units.filter(u=>u.kind==='building'&&!replaceSet.has(u.id)),excluded=view.units.filter(u=>['water','plaza'].includes(u.kind));
 let state=seedNumber(r.seed)||1;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 // Frontages get first claim on space. Rear infill only fills remaining lots.
 const gap=1.2,cell=Math.max(8,r.size*3),bins=new Map<string,{minX:number;minY:number;maxX:number;maxY:number;poly:P[]}[]>();
 const bounds=(poly:P[])=>({minX:Math.min(...poly.map(p=>p.x))-gap,minY:Math.min(...poly.map(p=>p.y))-gap,maxX:Math.max(...poly.map(p=>p.x))+gap,maxY:Math.max(...poly.map(p=>p.y))+gap,poly});
 const keys=(b:ReturnType<typeof bounds>)=>{const a:string[]=[];for(let x=Math.floor(b.minX/cell);x<=Math.floor(b.maxX/cell);x++)for(let y=Math.floor(b.minY/cell);y<=Math.floor(b.maxY/cell);y++)a.push(x+':'+y);return a;};
 const index=(b:ReturnType<typeof bounds>)=>{for(const k of keys(b)){const v=bins.get(k)??[];v.push(b);bins.set(k,v);}};for(const u of obstacles)index(bounds(posed(u)));
 const obstacleIds=new Set(obstacles.map(u=>u.id)),districtEdges=edges(points);
 const buildings:CityUnit[]=[];let attempts=0;
 const add=async(p:P,w:number,h:number,angle:number)=>{
  if(cancel())throw new Error('Bebauungsvorschau abgebrochen.');attempts++;if(attempts%200===0){progress(buildings.length);await new Promise<void>(resolve=>setTimeout(resolve,0));}
  if(!inside(p,points))return;
  const u:CityUnit={id:view.header.id+':building:frontage-v2:'+r.districtId+':'+seedNumber(r.seed)+':'+attempts,kind:'building',name:'',protected:false,position:p,angle,outline:[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}],use:r.use,notes:'',districtId:r.districtId,ownerId:null,recipe:{seed:r.seed,algorithm:'street-frontage-v2'},rooms:[],interior:false};
  if(obstacleIds.has(u.id))return;const corners=posed(u);if(corners.some(a=>!inside(a,points))||edges(corners).some(([a,b])=>districtEdges.some(([c,d])=>crosses(a,b,c,d))))return;
  if(excluded.some(e=>polygonsNear(corners,e.outline??[],0)))return;
  if(roads.some(a=>polygonNearSegment(corners,a.a,a.b,a.width/2+gap)))return;
  const b=bounds(corners),seen=new Set<object>();for(const k of keys(b))for(const a of bins.get(k)??[]){if(seen.has(a))continue;seen.add(a);if(a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY&&polygonsNear(corners,a.poly,gap))return;}
  index(b);buildings.push(u);if(buildings.length>=5000)throw new Error('Mehr als 5.000 Häuser in einer Vorschau. Teile das Viertel auf.');
 };
 for(const road of roads){
  const dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,length=Math.hypot(dx,dy);if(length<r.size)continue;
  const range=segmentRange(road.a,road.b,minX-r.reach,maxX+r.reach,minY-r.reach,maxY+r.reach);if(!range)continue;
  const ux=dx/length,uy=dy/length,angle=Math.atan2(dy,dx);
  for(const side of [-1,1]){
   let along=range[0]*length+r.size*(.2+random()*.4);
   while(along<range[1]*length){
    const w=r.size*(.75+random()*.5),h=r.size*(.8+random()*.65),offset=road.width/2+h/2+gap+.1,center=along+w/2;
    if(center<range[1]*length&&offset<=r.reach)await add({x:road.a.x+ux*center-uy*offset*side,y:road.a.y+uy*center+ux*offset*side},w,h,angle);
    along+=(w+r.size*(.15+1.6*(1-r.density))*(.85+random()*.3))*Math.max(1,.4/r.density);
   }
  }
 }
 for(let y=minY+step/2;y<maxY;y+=step)for(let x=minX+step/2;x<maxX;x+=step){
  if(cancel())throw new Error('Bebauungsvorschau abgebrochen.');if(random()>r.density*.2)continue;
  const p={x:x+(random()-.5)*step*.4,y:y+(random()-.5)*step*.4};let nearest={distance:Infinity,angle:0};for(const road of roads){const d=distance(p,road.a,road.b);if(d.distance<nearest.distance)nearest=d;}if(nearest.distance>r.reach)continue;
  await add(p,r.size*(.7+random()*.5),r.size*(.7+random()*.7),nearest.angle);
 }
 return{cityId:view.header.id,baseRevision:view.header.revision,recipe:{...r},buildings,...(streets.length?{streets}:{}),replaceIds,attempts};
}
const escaped=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function citySvg(v:import("./atlas-region-contracts").CityGeometry){const pts=(p:P[])=>p.map(a=>a.x+','+a.y).join(' '),h=v.header;let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${h.width} ${h.height}" width="${h.width}" height="${h.height}"><title>${escaped(h.name)}</title><rect width="100%" height="100%" fill="${escaped(h.paper)}"/>`;
 for(const u of v.units.filter(u=>['district','water','plaza'].includes(u.kind)))out+=`<polygon points="${pts(u.outline??[])}" fill="${u.kind==='water'?'#8eafb9':u.kind==='plaza'?'#d9c6a4':'#e0d2b9'}" stroke="#a69071" stroke-width="0.7"/><text x="${u.outline?.[0]?.x??0}" y="${u.outline?.[0]?.y??0}" font-size="8" fill="#52452e">${escaped(u.name)}</text>`;
 for(const u of v.units.filter(u=>u.kind==='road'||u.kind==='wall'))out+=`<polyline points="${pts(roadPoints(u,v.units))}" fill="none" stroke="${u.kind==='wall'?'#625e52':'#c1ae8b'}" stroke-width="${u.width??6}" stroke-linejoin="round" stroke-linecap="round"/>`;
 for(const u of v.units.filter(u=>u.kind==='building'))out+=`<g data-city-unit="${escaped(u.id)}"><polygon points="${pts(posed(u))}" fill="${escaped(h.roof)}" stroke="#624337" stroke-width="0.8"/>${u.name?`<text x="${u.position!.x}" y="${u.position!.y}" font-size="6" text-anchor="middle" fill="#352822">${escaped(u.name)}</text>`:''}</g>`;
 return out+'</svg>';}
