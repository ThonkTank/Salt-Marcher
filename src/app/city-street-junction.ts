import type {CityPoint,CityUnit} from './city-contracts';
import {posed,roadPoints} from './city-model';

const distance=(a:CityPoint,b:CityPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const epsilon=1e-6;
export type StreetSnap={point:CityPoint;nodeId?:string;roadId?:string;segment?:number};
/** Only street endpoints participate. A nearby wall must never become a street junction. */
export function streetSnap(units:CityUnit[],point:CityPoint):StreetSnap|null{
 const roads=units.filter(u=>u.kind==='road').sort((a,b)=>a.id.localeCompare(b.id));
 const ids=new Set(roads.flatMap(u=>u.nodeIds??[]));
 const nodes=units.filter(u=>u.kind==='node'&&ids.has(u.id)&&u.point).sort((a,b)=>distance(a.point!,point)-distance(b.point!,point)||a.id.localeCompare(b.id));
 if(nodes[0]&&distance(nodes[0].point!,point)<=4)return{point:{...nodes[0].point!},nodeId:nodes[0].id};
 let best:StreetSnap|null=null,bestDistance=Infinity;
 for(const road of roads){
  const points=roadPoints(road,units);
  for(let i=0;i<points.length-1;i++){
   const a=points[i]!,b=points[i+1]!,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
   if(length<=epsilon*epsilon)continue;
   const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length));
   const projected={x:a.x+t*dx,y:a.y+t*dy},d=distance(projected,point);
   if(d>Math.max(4,(road.width??6)/2)||d>=bestDistance)continue;
   bestDistance=d;
   best={point:projected,...(i===0&&t<=epsilon?{nodeId:road.nodeIds![0]}:i===points.length-2&&t>=1-epsilon?{nodeId:road.nodeIds![1]}:{roadId:road.id,segment:i})};
  }
 }
 return best;
}
/** Capsule-to-footprint clearance includes width, bends and rotated buildings. */
export function streetHouseConflicts(units:CityUnit[],path:CityPoint[],width:number){
 if(path.length<2||!Number.isFinite(width)||width<=0)return [];
 const radius=width/2;
 const distanceTo=(p:CityPoint,a:CityPoint,b:CityPoint)=>{const x=b.x-a.x,y=b.y-a.y,d=x*x+y*y,t=d?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/d)):0;return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);};
 const cross=(a:CityPoint,b:CityPoint,c:CityPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const intersects=(a:CityPoint,b:CityPoint,c:CityPoint,d:CityPoint)=>{
  if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return false;
  return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
 };
 const inside=(p:CityPoint,poly:CityPoint[])=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i]!,b=poly[j]!;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
 const minX=Math.min(...path.map(p=>p.x))-radius,maxX=Math.max(...path.map(p=>p.x))+radius,minY=Math.min(...path.map(p=>p.y))-radius,maxY=Math.max(...path.map(p=>p.y))+radius;
 return units.filter(u=>{
  if(u.kind!=='building')return false;const poly=posed(u);if(poly.length<3||Math.max(...poly.map(p=>p.x))<minX||Math.min(...poly.map(p=>p.x))>maxX||Math.max(...poly.map(p=>p.y))<minY||Math.min(...poly.map(p=>p.y))>maxY)return false;
  for(let i=1;i<path.length;i++){
   const a=path[i-1]!,b=path[i]!;if(inside(a,poly)||inside(b,poly))return true;
   for(let j=0;j<poly.length;j++){const c=poly[j]!,d=poly[(j+1)%poly.length]!;if(intersects(a,b,c,d)||Math.min(distanceTo(a,c,d),distanceTo(b,c,d),distanceTo(c,a,b),distanceTo(d,a,b))<radius-1e-7)return true;}
  }return false;
 });
}
export function streetPreview(units:CityUnit[],path:CityPoint[],width=8){
 const points=path.map(p=>({...p})),junctions:StreetSnap[]=[];
 for(const i of new Set([0,points.length-1])){
  if(i<0||!points[i])continue;const snap=streetSnap(units,points[i]!);
  if(snap){points[i]=snap.point;junctions.push(snap);}
 }
 return{path:points,junctions,width,conflicts:streetHouseConflicts(units,points,width)};
}
/** Split only explicitly touched streets; all changes enter the existing atomic history command. */
export function createStreet(units:CityUnit[],path:CityPoint[],width:number,id:()=>string){
 if(path.length<2)throw new Error('Mindestens zwei Straßenpunkte anklicken.');
 const working=new Map(units.map(u=>[u.id,u])),upsert=new Map<string,CityUnit>();
 const put=(u:CityUnit)=>{working.set(u.id,u);upsert.set(u.id,u);};
 const points=path.map(p=>({...p}));
 const end=(index:number)=>{
  const snap=streetSnap([...working.values()],points[index]!);
  if(snap?.nodeId){points[index]=snap.point;return snap.nodeId;}
  const node:CityUnit={id:id(),kind:'node',name:'',protected:true,point:snap?.point??points[index]!};put(node);points[index]=node.point!;
  if(snap?.roadId){
   const road=working.get(snap.roadId)!,line=roadPoints(road,[...working.values()]),segment=snap.segment!;
   const left=[...line.slice(0,segment+1),snap.point],right=[snap.point,...line.slice(segment+1)];
   const compact=(p:CityPoint[])=>p.filter((v,i)=>!i||distance(v,p[i-1]!)>epsilon);
   const a=compact(left),b=compact(right);
   if(a.length<2||b.length<2)throw new Error('Anschluss liegt auf einem Straßenende. Neu ansetzen.');
   put({...road,nodeIds:[road.nodeIds![0]!,node.id],via:a.slice(1,-1)});
   put({...road,id:id(),nodeIds:[node.id,road.nodeIds![1]!],via:b.slice(1,-1)});
  }
  return node.id;
 };
 const nodeIds=[end(0),end(points.length-1)];
 if(nodeIds[0]===nodeIds[1]&&points.length===2||points.some((p,i)=>i>0&&distance(p,points[i-1]!)<=epsilon))throw new Error('Straßenpunkte liegen aufeinander. Zug verwerfen und neu ansetzen.');
 const road:CityUnit={id:id(),kind:'road',name:'Neue Straße',protected:true,nodeIds,via:points.slice(1,-1),width};put(road);
 return{road,upsert:[...upsert.values()]};
}
