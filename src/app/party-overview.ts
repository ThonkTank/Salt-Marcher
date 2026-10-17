import {restFrame,xpLevel,type Progress} from './progression';
import type {Character} from './live-contracts';
export const partyQuickFields=[['characterClass','Klasse'],['level','Level'],['species','Volk'],['playerName','Spieler'],['armorClass','RK'],['speedFeet','Bewegung'],['passivePerception','Passive Wahrnehmung'],['passiveInsight','Passive Einsicht'],['passiveInvestigation','Passive Untersuchung'],['languages','Sprachen']] as const;
export type PartyQuickField=typeof partyQuickFields[number][0];
export const defaultPartyQuickFields:PartyQuickField[]=['characterClass','level','armorClass','speedFeet','passivePerception'];
export function checkedPartyQuickFields(value:unknown):PartyQuickField[]{
 if(!Array.isArray(value)||value.some(v=>!partyQuickFields.some(([key])=>key===v))||new Set(value).size!==value.length)throw new Error('Gespeicherte Schnellwerte sind nicht lesbar. Auswahl erneut speichern.');
 return partyQuickFields.filter(([key])=>value.includes(key)).map(([key])=>key);
}
export function partyQuickFacts(c:Character,p:Progress|undefined,keys:PartyQuickField[]){return keys.map(key=>{
 const label=partyQuickFields.find(([id])=>id===key)![1],v=key==='level'?p?.xp==null?undefined:xpLevel(p.xp).level:c.profile[key];
 return{key,label,value:v===undefined?'offen':Array.isArray(v)?v.length?v.join(', '):'offen':String(v)+(key==='speedFeet'?' ft':'')};
});}
export function partyRestOverview(members:(Progress|undefined)[]){
 const frames=members.map(p=>p?restFrame(p):null).filter(p=>p!==null),sections=frames[0]?.sections??null;
 return{fill:frames.length?frames.reduce((sum,f)=>sum+f.fill,0)/frames.length:null,sections:frames.length&&frames.every(f=>f.sections===sections)?sections:null,included:frames.length,total:members.length,partial:frames.length<members.length};
}
export function characterRestHint(p:Progress|undefined){
 if(!p)return'Fortschritt nicht verfügbar.';
 const f=restFrame(p);if(!f)return(p.xp===null?'XP und damit Tagesbudget offen. ':'Rastabschnitte nicht verlässlich bekannt. ')+'Gespeicherte Tagesbelastung '+p.rest.longXp+' XP; kurze Rast '+p.rest.shortXp+' XP.';
 return'Tagesbelastung '+p.rest.longXp+' / '+f.budget+' XP; kurze Rast '+p.rest.shortXp+' XP; '+f.sections+' verbleibende Rastabschnitte.'+(f.overdue?' Lange Rast fällig.':' Nächste Rastmarke bei '+Math.ceil(f.nextRest)+' XP Tagesbelastung.');
}

/** Place and present membership describe a destination without renaming stored scenes. */
export function partySceneLabels(view:import('./live-contracts').LiveView){
 const labels=view.scenes.map(scene=>({id:scene.id,label:(scene.locationTitle||'Ohne Ort')+' · '+(view.roster.filter(c=>c.active&&c.sceneId===scene.id).map(c=>c.profile.name).join(', ')||'Keine Figuren')}));
 const groups=new Map<string,typeof labels>();
 for(const scene of labels){const key=scene.label.normalize('NFC'),group=groups.get(key)??[];group.push(scene);groups.set(key,group);}
 const result=new Map<string,string>(labels.map(scene=>[scene.id,scene.label]));
 for(const group of groups.values()){
  // Adjacent sorted IDs determine the longest shared prefix without pairwise scans.
  const ids=group.map(scene=>scene.id).sort();let width=8;
  for(let i=1;i<ids.length;i++){const a=ids[i-1]!,b=ids[i]!;let shared=0;while(shared<a.length&&shared<b.length&&a[shared]===b[shared])shared++;width=Math.max(width,shared+1);}
  for(const scene of group)result.set(scene.id,scene.label+(group.length>1?' · '+scene.id.slice(0,width):''));
 }
 return result;
}
