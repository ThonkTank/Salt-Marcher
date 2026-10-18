import {newLocation} from '../features/location/location-schema';
import type {Result,Point} from './contracts';
import type {WorldReconciliation} from './world-contracts';
import type {WorldAck,WorldCommand} from './world-contracts';
export interface AtlasLocationOwner {token:string;campaignId:string;mapId:string;mapRevision:number;mapName:string;point?:Point;hex:{q:number;r:number}}
const sameTarget=(a:AtlasLocationOwner,b:AtlasLocationOwner|null)=>!!b&&a.token===b.token&&a.campaignId===b.campaignId&&a.mapId===b.mapId&&a.hex.q===b.hex.q&&a.hex.r===b.hex.r&&a.point?.x===b.point?.x&&a.point?.y===b.point?.y;
export class AtlasLocationComposer {
 private dialog=document.createElement('dialog');private owner:AtlasLocationOwner|null=null;private generation=0;private busy=false;private opening=false;private confirmed=false;private uncertain:WorldCommand|null=null;private id='';private sections:[string,string]=['',''];
 constructor(private target:()=>AtlasLocationOwner|null,private drain:()=>Promise<boolean>,private saved:(ack:WorldAck,id:string,owner:AtlasLocationOwner)=>Promise<void>,private tell:(message:string,error?:boolean)=>void,private transport:{prefix?:string;send?:(command:WorldCommand,owner:AtlasLocationOwner)=>Promise<Result<WorldAck>>;check?:(command:WorldCommand,owner:AtlasLocationOwner)=>Promise<Result<WorldReconciliation>>}={}){
  this.dialog.id='atlas-location-dialog';this.dialog.setAttribute('aria-labelledby','atlas-location-heading');
  this.dialog.innerHTML='<form id="atlas-location-form"><div class="toolbar"><h2 id="atlas-location-heading">Ort auf der Karte anlegen</h2><button id="atlas-location-close" type="button">Abbrechen</button></div><p id="atlas-location-target"></p><p id="atlas-location-feedback" role="status"></p><fieldset id="atlas-location-fields"><label>Ortsname<input id="atlas-location-name" required maxlength="200"></label><label>Art<select id="atlas-location-type"><option value="poi">Ort</option><option value="city">Stadt</option></select></label><label>Beschreibung<textarea id="atlas-location-description" rows="4" maxlength="2000000"></textarea></label><label>Notizen für die Spielleitung<textarea id="atlas-location-notes" rows="4" maxlength="2000000"></textarea></label></fieldset><div class="toolbar"><button id="atlas-location-save" type="submit">Ort und Marker anlegen</button><button id="atlas-location-check" type="button" hidden>Speicherauftrag prüfen</button></div></form>';
  this.dialog.classList.add('atlas-location-composer');this.dialog.id=(this.transport.prefix??'atlas-location')+'-dialog';this.dialog.setAttribute('aria-labelledby',(this.transport.prefix??'atlas-location')+'-heading');if(this.transport.prefix)this.dialog.innerHTML=this.dialog.innerHTML.replaceAll('atlas-location',this.transport.prefix);
  document.body.append(this.dialog);this.get<HTMLFormElement>('atlas-location-form').onsubmit=e=>{e.preventDefault();void this.submit();};
  this.get('atlas-location-close').onclick=()=>this.close();this.get('atlas-location-check').onclick=()=>void this.check();
  this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
 }
 private get<T extends HTMLElement=HTMLElement>(id:string){return this.dialog.querySelector('#'+id.replace(/^atlas-location/,this.transport.prefix??'atlas-location')) as T;}
 private message(text:string,error=false){this.get('atlas-location-feedback').textContent=text;this.get('atlas-location-feedback').classList.toggle('error',error);}
 private lock(){this.get<HTMLFieldSetElement>('atlas-location-fields').disabled=this.busy||!!this.uncertain;this.get<HTMLButtonElement>('atlas-location-save').disabled=this.busy||!!this.uncertain;this.get<HTMLButtonElement>('atlas-location-close').disabled=this.busy||!!this.uncertain;this.get('atlas-location-check').hidden=!this.uncertain;this.get<HTMLButtonElement>('atlas-location-check').disabled=this.busy;}
 flush(){if(!this.dialog.open)return true;this.tell('Ortsanlage zuerst abschließen oder abbrechen.',true);return false;}
 contextChanged(){this.generation++;this.owner=null;this.uncertain=null;this.busy=false;this.opening=false;this.confirmed=false;if(this.dialog.open)this.dialog.close();}
 async open(){
  if(this.opening||this.dialog.open)return;const initial=this.target();if(!initial)return;const generation=++this.generation;this.opening=true;
  try{
   if(!await this.drain()||generation!==this.generation||!sameTarget(initial,this.target()))return;
   this.owner=structuredClone(this.target()!);this.id=crypto.randomUUID();this.sections=[crypto.randomUUID(),crypto.randomUUID()];this.uncertain=null;this.confirmed=false;
   for(const id of ['atlas-location-name','atlas-location-description','atlas-location-notes'])this.get<HTMLInputElement>(id).value='';this.get<HTMLSelectElement>('atlas-location-type').value='poi';
   this.get('atlas-location-target').textContent=this.owner.mapName+' · Hex '+this.owner.hex.q+','+this.owner.hex.r;this.message('Beschreibung und Notizen gehören zum Ort; der Marker verweist auf dieselbe Ortsmappe.');this.lock();this.dialog.showModal();this.get('atlas-location-name').focus();
  }finally{if(generation===this.generation)this.opening=false;}
 }

 private close(){if(this.busy||this.uncertain){this.message('Laufenden Speicherauftrag zuerst prüfen.',true);return;}this.owner=null;this.generation++;this.dialog.close();}
 private current(owner:AtlasLocationOwner,generation:number){return this.owner===owner&&this.generation===generation&&sameTarget(owner,this.target());}
 private async finish(ack:WorldAck,id:string,owner:AtlasLocationOwner,generation:number){
  if(!this.current(owner,generation))return;await this.saved(ack,id,owner);if(!this.current(owner,generation))return;this.owner=null;this.uncertain=null;this.dialog.close();this.tell('Ort und Marker angelegt.');
 }
 private async submit(){
  const owner=this.owner,generation=this.generation;if(!owner||this.busy||this.uncertain)return;
  if(!this.current(owner,generation)){this.message('Kartenkontext geändert. Eingaben bleiben erhalten; Abbrechen führt zur aktuellen Karte.',true);return;}
  this.busy=true;this.lock();
  try{
   const base=newLocation(this.id,this.get<HTMLInputElement>('atlas-location-name').value,this.get<HTMLSelectElement>('atlas-location-type').value as 'city'|'poi',this.sections);
   const document={...base,sections:base.sections.map((s,i)=>({...s,markdown:this.get<HTMLTextAreaElement>(i?'atlas-location-notes':'atlas-location-description').value}))};
   const command:WorldCommand={commandId:crypto.randomUUID(),token:owner.token,campaignId:owner.campaignId,action:{kind:'place-create',mapId:owner.mapId,expectedMapRevision:owner.mapRevision,hex:owner.hex,document}};
   let result;try{result=await (this.transport.send?.(command,owner)??window.campaign.executeWorld(command));}catch(error){if(this.current(owner,generation))this.uncertain=command;throw error;}
   if(!this.current(owner,generation))return;if(!result.ok)throw new Error(result.error);this.confirmed=true;this.uncertain=command;await this.finish(result.value,this.id,owner,generation);
  }catch(error){if(this.current(owner,generation))this.message(this.confirmed?'Ort gespeichert; Anzeige konnte nicht aktualisiert werden. Auftrag prüfen.':this.uncertain?'Speicherantwort fehlt. Auftrag prüfen, bevor erneut angelegt wird.':(error as Error).message,true);}
  finally{if(generation===this.generation){this.busy=false;this.lock();}}
 }
 private async check(){
  const owner=this.owner,generation=this.generation,command=this.uncertain;if(!owner||!command||this.busy)return;this.busy=true;this.lock();
  try{const result=await (this.transport.check?.(command,owner)??window.campaign.reconcileWorld(command,owner.token));if(!this.current(owner,generation)||this.uncertain!==command)return;if(!result.ok)throw new Error(result.error);
   if(result.value.outcome==='applied'){this.confirmed=true;await this.finish(result.value.ack,this.id,owner,generation);}else{this.uncertain=null;this.confirmed=false;this.message('Nicht angelegt. Eingaben bleiben erhalten; du kannst erneut speichern.');}
  }catch(error){if(this.current(owner,generation))this.message((error as Error).message,true);}finally{if(generation===this.generation){this.busy=false;this.lock();}}
 }
}
