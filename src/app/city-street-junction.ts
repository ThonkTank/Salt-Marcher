import type {CityPoint,CityUnit} from './city-contracts';
import {roadPoints} from './city-model';

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
export function streetPreview(units:CityUnit[],path:CityPoint[]){
 const points=path.map(p=>({...p})),junctions:StreetSnap[]=[];
 for(const i of new Set([0,points.length-1])){
  if(i<0||!points[i])continue;const snap=streetSnap(units,points[i]!);
  if(snap){points[i]=snap.point;junctions.push(snap);}
 }
 return{path:points,junctions};
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
