import {createHash} from 'node:crypto';
import type {ChronicleCategory,ChronicleEntry,ChronicleView} from '../chronicle-contracts';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function payload(row:any):Record<string,any>{
  if(!row||typeof row.payload!=='string'||hash(row.payload)!==row.checksum)throw new Error('Chronikquelle ist beschädigt.');
  const value=JSON.parse(row.payload);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Chronikquelle hat ein ungültiges Format.');return value;
}
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const quantity=(item:any)=>item&&Number.isSafeInteger(item.quantity)?item.quantity+' × '+text(item.currentName??item.name,'Gegenstand'):'Gegenstand';
const nameList=(ids:unknown,names:Map<string,string>)=>Array.isArray(ids)?ids.map(id=>names.get(String(id))??'Unbekannte Figur'):[];

function progressEntry(row:any,f:any,names:Map<string,string>,scenes:Map<string,string>,locations:Map<string,string>,narrativeLocations:Map<string,string|null>,combats:Map<string,{title:string;sceneId:string;outcome:string}>):ChronicleEntry|null{
  const person=row.character_id?names.get(row.character_id)??'Unbekannte Figur':null;
  let category:ChronicleCategory='party',title='',summary='',people=person?[person]:[],sceneId:string|null=null,locationId:string|null=null;
  const item=f.entry??f.portion??f.handed;
  if(row.kind==='narrative-award'){category='narrative';title='Quest abgeschlossen: '+text(f.title,'Ohne Titel');summary=text(f.outcome,'Ergebnis bestätigt.');people=nameList(f.recipientIds,names);sceneId=f.sceneId??null;locationId=narrativeLocations.get(String(f.noteId))??null;}
  else if(row.kind==='combat-award'){const combat=combats.get(String(f.combatId));category='combat';title='Kampf abgeschlossen: '+(combat?.title??'Begegnung');summary=(combat?.outcome||'Ergebnis bestätigt.')+(Number(f.xp)>0?' · '+f.xp+' XP für '+person:'');sceneId=combat?.sceneId??null;}
  else if(row.kind==='treasure-created'){const treasure=f.treasure;category='reward';title='Beute gesichert: '+text(treasure?.title,'Fund');summary=Array.isArray(treasure?.items)&&treasure.items.length?treasure.items.map(quantity).join(', '):'Leerer Fund';sceneId=treasure?.sceneId??null;locationId=treasure?.locationId??null;}
  else if(row.kind==='loot-award'){category='reward';title='Beute zugewiesen';summary=(person?person+': ':'')+quantity(item);sceneId=item?.sceneId??null;locationId=item?.locationId??null;}
  else if(row.kind==='manual-loot'){category='reward';title='Persönlicher Gegenstand';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · '+item.counterparty:'');sceneId=item?.sceneId??null;locationId=item?.locationId??null;}
  else if(['loot-sold','shop-sale'].includes(row.kind)){category='reward';title='Gegenstand verkauft';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · '+item.counterparty:'');locationId=item?.locationId??null;}
  else if(row.kind==='shop-purchase'){category='reward';title='Gegenstand gekauft';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · '+item.counterparty:'');locationId=item?.locationId??null;}
  else if(['loot-given','loot-transfer'].includes(row.kind)){category='reward';title='Gegenstand weitergegeben';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · an '+item.counterparty:'');}
  else if(row.kind==='loot-transfer-received'){category='reward';title='Gegenstand erhalten';summary=(person?person+': ':'')+quantity(item);}
  else if(row.kind==='loot-correction'){category='reward';title='Beutestand korrigiert';summary=(person?person+': ':'')+text(f.reason,'Bestand angepasst');}
  else if(row.kind==='xp'){category='party';title='XP korrigiert';summary=(person?person+': ':'')+String(f.before?.xp??'offen')+' → '+String(f.after?.xp??'offen')+(f.reason?' · '+f.reason:'');}
  else if(row.kind==='health'){category='party';title='Trefferpunkte geändert';summary=(person?person+': ':'')+String(f.before?.health?.hp??'offen')+' → '+String(f.after?.health?.hp??'offen')+' HP'+(f.reason?' · '+f.reason:'');}
  else if(row.kind==='rest'){category='party';title=f.rest==='long'?'Lange Rast':'Kurze Rast';summary=person??'Partyfortschritt gespeichert';}
  else if(['combat-entry','combat-exit','combat-return'].includes(row.kind)){category='combat';title=row.kind==='combat-entry'?'Initiative betreten':row.kind==='combat-exit'?'Initiative verlassen':'In Initiative zurückgekehrt';summary=(person?person+' · ':'')+text(f.title,'Begegnung');const combat=combats.get(String(f.combatId));sceneId=combat?.sceneId??null;}
  else return null;
  const scene=sceneId?scenes.get(sceneId)??null:null,location=locationId?locations.get(locationId)??null:null;
  return{id:'progress:'+row.id,recordedAt:text(f.recordedAt,new Date(0).toISOString()),category,title,summary,people,scene,location};
}

// These are the event kinds represented by progressEntry; bookkeeping has no chronicle row.
const progressKinds=['narrative-award','combat-award','treasure-created','loot-award','manual-loot','loot-sold','shop-sale','shop-purchase','loot-given','loot-transfer','loot-transfer-received','loot-correction','xp','health','rest','combat-entry','combat-exit','combat-return'];
const sourceLimit=2000;

export function readChronicle(db:any,cam:string):ChronicleView{
  return db.transaction(()=>{
    const campaign=db.prepare('SELECT name FROM campaign WHERE id=?').get(cam);if(!campaign)throw new Error('Kampagne fehlt.');
    const names=new Map<string,string>(db.prepare('SELECT id,payload FROM character_profile WHERE campaign_id=?').all(cam).map((r:any)=>{const p=JSON.parse(r.payload);return[r.id,text(p.name,'Unbekannte Figur')];}));
    const sceneRows=db.prepare('SELECT id,title,location_id FROM live_scene WHERE campaign_id=?').all(cam),scenes=new Map<string,string>(sceneRows.map((r:any)=>[r.id,r.title]));
    const locations=new Map<string,string>(db.prepare('SELECT id,payload FROM location WHERE campaign_id=?').all(cam).map((r:any)=>[r.id,text(JSON.parse(r.payload).name,'Unbekannter Ort')]));
    const narrativeLocations=new Map<string,string|null>(db.prepare('SELECT note_id,payload FROM narrative_state WHERE campaign_id=?').all(cam).map((r:any)=>[r.note_id,JSON.parse(r.payload).locationId??null]));
    const combats=new Map<string,{title:string;sceneId:string;outcome:string}>();for(const r of db.prepare("SELECT id,scene_id,payload FROM combat WHERE campaign_id=? AND phase='finished'").all(cam)){const p=JSON.parse(r.payload);combats.set(r.id,{title:text(p.title,'Begegnung'),sceneId:r.scene_id,outcome:text(p.outcome)});}
    const entries:ChronicleEntry[]=[],awards=new Map<string,ChronicleEntry>();
    const progressRows=db.prepare('SELECT rowid AS cursor,* FROM progress_event WHERE campaign_id=? AND kind IN ('+progressKinds.map(()=>'?').join(',')+') ORDER BY rowid DESC LIMIT ?').all(cam,...progressKinds,sourceLimit+1);
    const worldRows=db.prepare('SELECT rowid AS cursor,* FROM world_history WHERE campaign_id=? ORDER BY rowid DESC LIMIT ?').all(cam,sourceLimit+1);
    const sourceTruncated=progressRows.length>sourceLimit||worldRows.length>sourceLimit;
    for(const row of progressRows){
      const f=payload(row);
      const entry=progressEntry(row,f,names,scenes,locations,narrativeLocations,combats);if(!entry)continue;
      if(row.kind==='combat-award'&&f.awardId){const prior=awards.get(f.awardId);if(prior){prior.people.push(...entry.people);if(Number(f.xp)>0)prior.summary+=(prior.summary.includes(' XP für ')?', ':' · '+f.xp+' XP für ')+(entry.people[0]??'Unbekannt');continue;}awards.set(f.awardId,entry);}
      entries.push(entry);
    }
    for(const row of worldRows){const f=payload(row),sceneId=row.scene_id as string|null,scene=sceneId?scenes.get(sceneId)??null:null,locationId=f.facts?.locationId??f.facts?.after?.position?.locationId??f.facts?.preview?.request?.destinationLocationId??sceneRows.find((r:any)=>r.id===sceneId)?.location_id??null;const title=text(f.text,'Weltereignis'),travel=/^(Reise|Gruppe|Ort besucht|Ort verlassen)/.test(title);entries.push({id:'world:'+row.id,recordedAt:text(f.recordedAt,new Date(0).toISOString()),category:travel?'travel':'world',title,summary:'',people:[],scene,location:locationId?locations.get(locationId)??null:null});}
    entries.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||b.id.localeCompare(a.id));
    return{campaignName:campaign.name,entries:entries.slice(0,sourceLimit),truncated:sourceTruncated||entries.length>sourceLimit};
  })();
}

export function chronicleMarkdown(view:ChronicleView,category:ChronicleCategory|'all',search:string){
  const needle=search.trim().toLocaleLowerCase(),entries=view.entries.filter(e=>(category==='all'||e.category===category)&&(!needle||[e.title,e.summary,e.scene,e.location,...e.people].some(v=>v?.toLocaleLowerCase().includes(needle))));
  const labels:Record<ChronicleCategory,string>={combat:'Kampf',narrative:'Quest',reward:'Beute',travel:'Reise',party:'Party',world:'Welt'};
  return '# Kampagnenchronik: '+view.campaignName+'\n\nExportiert am '+new Date().toLocaleString('de-DE')+'\n\n'+(view.truncated?'_Unvollständiger Ausschnitt: Ältere Ereignisse und passende Suchtreffer können fehlen._\n\n':'')+(entries.map(e=>'## '+e.title+'\n\n- Zeitpunkt: '+new Date(e.recordedAt).toLocaleString('de-DE')+'\n- Bereich: '+labels[e.category]+(e.scene?'\n- Gruppe: '+e.scene:'')+(e.location?'\n- Ort: '+e.location:'')+(e.people.length?'\n- Beteiligte: '+[...new Set(e.people)].join(', '):'')+(e.summary?'\n\n'+e.summary:'')).join('\n\n')||'_Keine passenden Einträge._')+'\n';
}
