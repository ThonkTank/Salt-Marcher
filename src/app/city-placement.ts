import type {CityPoint,CityUnit,CityCommand} from './city-contracts';

export interface CityPlacementOwner {token:string;cityId:string;revision:number;unit:CityUnit}
interface Placement {
 owner:CityPlacementOwner;original:CityUnit;draft:CityUnit;busy:boolean;
 attempt:{id:string;action:CityCommand['action']}|null;message:string;
}
const identity=(owner:CityPlacementOwner)=>JSON.stringify([owner.token,owner.cityId,owner.unit.id]);
const samePose=(a:CityUnit,b:CityUnit)=>a.position!.x===b.position!.x&&a.position!.y===b.position!.y&&Math.abs(Math.sin(((a.angle??0)-(b.angle??0))/2))<1e-12;

/** A local placement preview. Only acceptance sends one complete, revision-bound edit. */
export class CityPlacement {
 private value:Placement|null=null;
 private generation=0;
 opening=false;
 constructor(private port:{
  current:()=>CityPlacementOwner|null;drain:()=>Promise<boolean>;
  send:(action:CityCommand['action'],id:string,revision:number)=>Promise<unknown>;
  rejected:(error:unknown)=>boolean;changed:()=>void;
 }){}
 get state(){return this.value;}
 get active(){return!!this.value;}
 get locked(){return!!this.value&&(this.value.busy||!!this.value.attempt);}
 private owns(state:Placement){const current=this.port.current();return this.value===state&&!!current&&identity(current)===identity(state.owner);}
 contextChanged(){this.generation++;this.value=null;this.opening=false;}
 async begin(){
  if(this.opening||this.value)return;
  const owner=this.port.current(),generation=++this.generation;if(owner?.unit.kind!=='building')return;
  this.opening=true;this.port.changed();
  try{
   if(!await this.port.drain()||generation!==this.generation)return;
   const current=this.port.current();if(!current||identity(current)!==identity(owner))return;
   const original=structuredClone(current.unit);
   this.value={owner:current,original,draft:structuredClone(original),busy:false,attempt:null,message:'Zielpunkt in der Karte anklicken. Ausrichtung wählen, dann übernehmen.'};
  }finally{if(generation===this.generation){this.opening=false;this.port.changed();}}
 }
 point(point:CityPoint){
  const state=this.value;if(!state||!this.owns(state)||this.locked)return;
  if(!Number.isFinite(point.x+point.y)||Math.abs(point.x)>100000||Math.abs(point.y)>100000)return;
  state.draft={...state.draft,position:{x:point.x,y:point.y}};
  state.message='Position als Vorschau gesetzt. Erneut klicken zum Korrigieren oder übernehmen.';this.port.changed();
 }
 angle(degrees:number){
  const state=this.value;if(!state||!this.owns(state)||this.locked||!Number.isFinite(degrees))return;
  const angle=degrees*Math.PI/180,original=state.original.angle??0;
  state.draft={...state.draft,angle:Math.abs(Math.sin((angle-original)/2))<1e-12?original:angle};
  state.message='Ausrichtung als Vorschau gesetzt. Position und Drehung werden gemeinsam übernommen.';this.port.changed();
 }
 turn(degrees:number){const state=this.value;if(state)this.angle((state.draft.angle??0)*180/Math.PI+degrees);}
 cancel(){if(this.locked)return false;this.value=null;this.generation++;this.port.changed();return true;}
 async accept(){
  const state=this.value;if(!state||state.busy||!this.owns(state))return;
  const current=this.port.current()!;
  if(!state.attempt&&current.revision!==state.owner.revision){state.message='Stadtstand geändert. Vorschau verwerfen und den aktuellen Stadtplan laden.';this.port.changed();return;}
  if(!state.attempt&&samePose(state.original,state.draft)){this.value=null;this.port.changed();return;}
  state.attempt??={id:crypto.randomUUID(),action:{kind:'change',upsert:[{...structuredClone(state.draft),protected:true}],remove:[],label:'Haus versetzen und drehen'}};
  state.busy=true;state.message='Hausplatzierung wird gespeichert…';this.port.changed();
  try{
   await this.port.send(state.attempt.action,state.attempt.id,state.owner.revision);
   if(this.value===state)this.value=null;
  }catch(error){
   if(this.owns(state)){
    if(this.port.rejected(error)){state.attempt=null;state.message=(error as Error).message;}
    else state.message='Speicherung nicht bestätigt. „Ergebnis prüfen“ verwendet denselben Auftrag. '+(error as Error).message;
   }
  }finally{if(this.owns(state)){state.busy=false;this.port.changed();}else if(!this.value)this.port.changed();}
 }
}
