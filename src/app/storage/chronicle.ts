import {formatInstant} from '../live-contracts';
import {createHash} from 'node:crypto';
import type {ChronicleCategory,ChronicleEntry,ChronicleView} from '../chronicle-contracts';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function payload(row:any):Record<string,any>{
  if(!row||typeof row.payload!=='string'||hash(row.payload)!==row.checksum)throw new Error('Chronikquelle ist beschädigt.');
  const value=JSON.parse(row.payload);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Chronikquelle hat ein ungültiges Format.');return value;
}
export function readSessionBoundary(db:any,cam:string){
 const row=db.prepare("SELECT rowid AS cursor,* FROM world_history WHERE campaign_id=? AND json_extract(payload,'$.facts.kind')='session-marker' ORDER BY rowid DESC LIMIT 1").get(cam);
 if(!row)return null;const body=payload(row);if(!['start','end'].includes(body.facts?.marker))throw new Error('Chronikquelle hat eine ungültige Spielabend-Markierung.');return{row,body};
}
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const quantity=(item:any)=>item&&Number.isSafeInteger(item.quantity)?item.quantity+' × '+text(item.currentName??item.name,'Gegenstand'):'Gegenstand';
const nameList=(ids:unknown,names:Map<string,string>)=>Array.isArray(ids)?ids.map(id=>names.get(String(id))??'Unbekannte Figur'):[];
const sceneName=(id:unknown,scenes:Map<string,string>)=>typeof id==='string'?scenes.get(id)??'Unbekannte Gruppe':null;
const timeUnit=(unit:unknown)=>({seconds:'Sekunden',minutes:'Minuten',hours:'Stunden',days:'Tage'}[String(unit)]??String(unit));

function progressEntry(row:any,f:any,names:Map<string,string>,scenes:Map<string,string>,locations:Map<string,string>,narrativeLocations:Map<string,string|null>,combats:Map<string,{title:string;sceneId:string;outcome:string}>):ChronicleEntry|null{
  const person=row.character_id?names.get(row.character_id)??'Unbekannte Figur':null;
  let category:ChronicleCategory='party',title='',summary='',people=person?[person]:[],sceneId:string|null=null,locationId:string|null=null;
  const item=f.entry??f.portion??f.handed;
  if(row.kind==='party-award'){category='party';title='XP-Abrechnung: '+text(f.reason,'Spielabend');summary=String(f.poolXp)+' Gruppen-XP → '+String(f.shareXp)+' je Figur / '+String(f.totalXp)+' insgesamt · Tagesbelastung '+String(f.loadXp)+' → '+String(f.shareLoad)+' je beteiligter Figur';people=nameList(f.recipientIds,names);}
  else if(row.kind==='narrative-state'){if(f.after?.status===undefined)return null;if(!['open','closed'].includes(f.after.status))throw new Error('Narrativer Chronikstatus ist beschädigt.');category='narrative';title='Auftragsstatus: '+text(f.title,'Quest oder Gerücht');summary=(f.after?.status==='closed'?'Geschlossen':'Offen')+' · '+String(f.after?.poolXp??0)+' Gruppen-XP vorbereitet'+(f.after?.items?.length?' · '+f.after.items.map(quantity).join(', '):'');people=nameList(f.after?.contributors,names);locationId=f.after?.locationId??null;}
  else if(row.kind==='narrative-award'){category='narrative';title='Quest abgeschlossen: '+text(f.title,'Ohne Titel');summary=text(f.outcome,'Ergebnis bestätigt.');people=nameList(f.recipientIds,names);sceneId=f.sceneId??null;locationId=narrativeLocations.get(String(f.noteId))??null;}
  else if(row.kind==='combat-award'){const combat=combats.get(String(f.combatId));category='combat';title='Kampf abgeschlossen: '+(combat?.title??'Begegnung');summary=(combat?.outcome||'Ergebnis bestätigt.')+(Number(f.xp)>0?' · '+f.xp+' XP für '+person:'');sceneId=combat?.sceneId??null;}
  else if(row.kind==='treasure-created'){const treasure=f.treasure;category='reward';title='Beute gesichert: '+text(treasure?.title,'Fund');summary=Array.isArray(treasure?.items)&&treasure.items.length?treasure.items.map(quantity).join(', '):'Leerer Fund';sceneId=treasure?.sceneId??null;locationId=treasure?.locationId??null;}
  else if(row.kind==='loot-award'){category='reward';title='Beute zugewiesen';summary=(person?person+': ':'')+quantity(item);sceneId=item?.sceneId??null;locationId=item?.locationId??null;}
  else if(row.kind==='manual-loot'){category='reward';title='Persönlicher Gegenstand';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · '+item.counterparty:'');sceneId=item?.sceneId??null;locationId=item?.locationId??null;}
  else if(['loot-sold','shop-sale'].includes(row.kind)){category='reward';title='Gegenstand verkauft';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · '+item.counterparty:'');locationId=item?.locationId??null;}
  else if(row.kind==='shop-purchase'){category='reward';title='Gegenstand gekauft';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · '+item.counterparty:'');locationId=item?.locationId??null;}
  else if(['loot-given','loot-transfer'].includes(row.kind)){category='reward';title='Gegenstand weitergegeben';summary=(person?person+': ':'')+quantity(item)+(item?.counterparty?' · an '+item.counterparty:'');}
  else if(row.kind==='loot-transfer-received'){category='reward';title='Gegenstand erhalten';summary=(person?person+': ':'')+quantity(item);}
  else if(row.kind==='group-created'||row.kind==='group-edited'){category='world';title=(row.kind==='group-created'?'Gruppe angelegt: ':'Gruppe bearbeitet: ')+text(f.after?.title,'Gruppe');summary=String(f.after?.actors?.length??0)+' Figuren';locationId=f.after?.locationId??null;}
  else if(row.kind==='treasure-edited'){category='reward';title='Schatz nachbearbeitet: '+text(f.after?.title,'Fund');summary=text(f.reason,'Unverteilte Beute angepasst.');locationId=f.after?.locationId??null;}
  else if(row.kind==='treasure-moved'){category='reward';title='Beute verschoben: '+text(f.before?.title,'Fund')+' → '+text(f.targetAfter?.title,'Zielschatz');summary=String(f.quantity??0)+' Einheiten · '+text(f.reason);locationId=f.targetAfter?.locationId??null;}
  else if(row.kind==='loot-correction'){category='reward';title='Beutestand korrigiert';summary=(person?person+': ':'')+text(f.reason,'Bestand angepasst');}
  else if(row.kind==='xp'){category='party';title='XP korrigiert';summary=(person?person+': ':'')+String(f.before?.xp??'offen')+' → '+String(f.after?.xp??'offen')+(f.reason?' · '+f.reason:'');}
  else if(row.kind==='health'){category='party';title='Trefferpunkte geändert';summary=(person?person+': ':'')+String(f.before?.health?.hp??'offen')+' → '+String(f.after?.health?.hp??'offen')+' HP'+(f.reason?' · '+f.reason:'');}
  else if(row.kind==='death-save'){category='party';title='Todesrettungswurf';const d=f.after?.health?.death;summary=(person?person+': ':'')+(d?.dead?'tot':d?.stable?'stabilisiert':(d?.successes??0)+' Erfolge · '+(d?.failures??0)+' Fehlschläge');}
  else if(row.kind==='rest'){category='party';title=f.rest==='long'?'Lange Rast':'Kurze Rast';summary=(person??'Partyfortschritt gespeichert')+(f.duration?' · '+f.duration.amount+' '+({seconds:'Sekunden',minutes:'Minuten',hours:'Stunden',days:'Tage'}[f.duration.unit as string]??f.duration.unit):'')+(f.restoreHp?' · HP '+String(f.before?.health?.hp??'offen')+' → '+String(f.after?.health?.hp??'offen'):'');sceneId=f.sceneId??null;}
  else if(['combat-entry','combat-exit','combat-return'].includes(row.kind)){category='combat';title=row.kind==='combat-entry'?'Initiative betreten':row.kind==='combat-exit'?'Initiative verlassen':'In Initiative zurückgekehrt';summary=(person?person+' · ':'')+text(f.title,'Begegnung');const combat=combats.get(String(f.combatId));sceneId=combat?.sceneId??null;}
  else return null;
  const scene=sceneId?scenes.get(sceneId)??null:null,location=locationId?locations.get(locationId)??null:null;
  return{id:'progress:'+row.id,recordedAt:text(f.recordedAt,new Date(0).toISOString()),category,title,summary,people,scene,location};
}

// Stream relevant source records in bounded portions under the same read snapshot.
const progressKinds=['party-award','group-created','group-edited','narrative-state','narrative-award','combat-award','treasure-created','treasure-edited','treasure-moved','loot-award','manual-loot','loot-sold','shop-sale','shop-purchase','loot-given','loot-transfer','loot-transfer-received','loot-correction','xp','health','death-save','rest','combat-entry','combat-exit','combat-return'];
const sourceLimit=2000;
function* sourceRows(db:any,cam:string,table:'progress_event'|'world_history'|'scene_time_step',kinds?:string[]){
  let before=Number.MAX_SAFE_INTEGER;
  for(;;){
    let count=0,cursor=before;
    const filter=kinds?" AND kind IN ("+kinds.map(()=>'?').join(',')+") AND (kind<>'narrative-state' OR json_type(payload,'$.after.status') IS NOT NULL)":'';
    for(const row of db.prepare('SELECT rowid AS cursor,* FROM '+table+' WHERE campaign_id=? AND rowid<?'+filter+' ORDER BY rowid DESC LIMIT ?').iterate(cam,before,...(kinds??[]),sourceLimit+1)){
      count++;cursor=row.cursor;yield row;
    }
    if(count<sourceLimit+1||!Number.isSafeInteger(cursor)||cursor>=before)return;
    before=cursor;
  }
}

export function chronicleMatches(entry:ChronicleEntry,category:ChronicleCategory|'all',search:string){
  const needle=search.trim().toLocaleLowerCase();
  return(category==='all'||entry.category===category)&&(!needle||[entry.title,entry.summary,entry.handoff,entry.scene,entry.location,...entry.people].some(value=>value?.toLocaleLowerCase().includes(needle)));
}

export function readChronicle(db:any,cam:string,category:ChronicleCategory|'all'='all',search=''):ChronicleView{
  if(!['all','combat','narrative','reward','travel','party','world'].includes(category)||typeof search!=='string'||search.length>1000)throw new Error('Chronikfilter ungültig.');
  return db.transaction(()=>{
    const campaign=db.prepare('SELECT name FROM campaign WHERE id=?').get(cam);if(!campaign)throw new Error('Kampagne fehlt.');
    const names=new Map<string,string>(db.prepare('SELECT id,payload,checksum FROM character_profile WHERE campaign_id=?').all(cam).map((r:any)=>{const p=payload(r);return[r.id,text(p.name,'Unbekannte Figur')];}));
    const sceneRows=db.prepare('SELECT id,title,location_id FROM live_scene WHERE campaign_id=?').all(cam),scenes=new Map<string,string>(sceneRows.map((r:any)=>[r.id,r.title]));
    const locations=new Map<string,string>(db.prepare('SELECT id,payload,checksum FROM location WHERE campaign_id=?').all(cam).map((r:any)=>[r.id,text(payload(r).name,'Unbekannter Ort')]));
    const narrativeLocations=new Map<string,string|null>(db.prepare('SELECT note_id,payload,checksum FROM narrative_state WHERE campaign_id=?').all(cam).map((r:any)=>[r.note_id,payload(r).locationId??null]));
    const combats=new Map<string,{title:string;sceneId:string;outcome:string}>();for(const r of db.prepare("SELECT id,scene_id,payload,checksum FROM combat WHERE campaign_id=? AND phase='finished'").all(cam)){const p=payload(r);combats.set(r.id,{title:text(p.title,'Begegnung'),sceneId:r.scene_id,outcome:text(p.outcome)});}
    const progressEntries:ChronicleEntry[]=[];let progressTruncated=false;
    for(const row of sourceRows(db,cam,'progress_event',progressKinds.filter(kind=>kind!=='combat-award'))){
      const f=payload(row);
      const entry=progressEntry(row,f,names,scenes,locations,narrativeLocations,combats);if(!entry)continue;
      if(row.kind==='combat-award'||!chronicleMatches(entry,category,search))continue;
      progressEntries.push(entry);if(progressEntries.length>2000){progressTruncated=true;break;}
    }
    // Awards have one receipt per person. Match the complete group while retaining
    // only one group's prose plus the newest bounded set of matching entries.
    const combatEntries:ChronicleEntry[]=[];
    let awardKey:string|null=null,awardEntry:ChronicleEntry|null=null;
    const compare=(a:ChronicleEntry,b:ChronicleEntry)=>b.recordedAt.localeCompare(a.recordedAt)||(worldOrder.get(b.id)??0)-(worldOrder.get(a.id)??0)||b.id.localeCompare(a.id);
    const finishAward=()=>{
      if(awardEntry&&chronicleMatches(awardEntry,category,search)){
        combatEntries.push(awardEntry);
        if(combatEntries.length>2001){combatEntries.sort(compare);combatEntries.length=2001;}
      }
    };
    if(category==='all'||category==='combat')for(const row of db.prepare("SELECT * FROM progress_event WHERE campaign_id=? AND kind='combat-award' ORDER BY CASE WHEN json_valid(payload) THEN json_extract(payload,'$.awardId') END,rowid DESC").iterate(cam)){
      if(row.kind!=='combat-award')continue;
      const f=payload(row),entry=progressEntry(row,f,names,scenes,locations,narrativeLocations,combats);if(!entry)continue;
      const key=typeof f.awardId==='string'&&f.awardId?'award:'+f.awardId:'event:'+row.id;
      if(key!==awardKey){finishAward();awardKey=key;awardEntry=entry;}
      else if(awardEntry){awardEntry.people.push(...entry.people);if(Number(f.xp)>0)awardEntry.summary+=(awardEntry.summary.includes(' XP für ')?', ':' · '+f.xp+' XP für ')+(entry.people[0]??'Unbekannt');}
    }
    finishAward();
    const worldEntries:ChronicleEntry[]=[],worldOrder=new Map<string,number>();let worldTruncated=false;
    for(const row of sourceRows(db,cam,'world_history')){
      const f=payload(row),facts=f.facts??{},sceneId=row.scene_id as string|null,scene=sceneId?scenes.get(sceneId)??null:null,locationId=facts.locationId??facts.after?.position?.locationId??facts.preview?.request?.destinationLocationId??sceneRows.find((r:any)=>r.id===sceneId)?.location_id??null;
      const title=text(f.text,'Weltereignis'),party=facts.kind==='party-membership'||facts.kind==='party-move',travel=!party&&/^(Reise|Gruppe|Ort besucht|Ort verlassen)/.test(title),manualCategory=facts.kind==='live-moment'&&['combat','narrative','reward','travel','party','world'].includes(facts.category)?facts.category as ChronicleCategory:null;
      if(facts.kind==='live-moment'&&!manualCategory)throw new Error('Chronikquelle hat einen ungültigen Bereich.');
      const sessionMarker=facts.kind==='session-marker'&&['start','end'].includes(facts.marker)?facts.marker as 'start'|'end':undefined;
      if(facts.kind==='session-marker'&&!sessionMarker)throw new Error('Chronikquelle hat eine ungültige Spielabend-Markierung.');
      let summary=facts.kind==='live-moment'||sessionMarker?text(facts.summary):'';
      if(facts.kind==='visit-outcome')summary=text(facts.outcome)+' · Weltzeit '+formatInstant(text(facts.sceneInstantMs,'0'));
      else if(facts.kind==='party-membership')summary=facts.active?'Aktiviert'+(sceneName(facts.toSceneId,scenes)?' in '+sceneName(facts.toSceneId,scenes):''):'Deaktiviert'+(sceneName(facts.fromSceneId,scenes)?' aus '+sceneName(facts.fromSceneId,scenes):'');
      else if(facts.kind==='party-move')summary=(sceneName(facts.fromSceneId,scenes)??'Unbekannte Gruppe')+' → '+(sceneName(facts.toSceneId,scenes)??'Unbekannte Gruppe')+(facts.createdScene?' · neue Gruppe':'');
      const followUp=facts.kind==='live-moment'&&['quest','rumor'].includes(facts.followUpKind)&&typeof facts.followUpId==='string'&&facts.followUpId?{kind:facts.followUpKind as 'quest'|'rumor',id:facts.followUpId}:undefined;
      const id='world:'+row.id;worldOrder.set(id,Number(row.cursor));
      const handoff=sessionMarker==='end'?text(facts.handoff):'';const entry:ChronicleEntry={...(handoff?{handoff}:{}),...(sessionMarker?{sessionMarker}:{}),id:'world:'+row.id,recordedAt:text(f.recordedAt,new Date(0).toISOString()),category:manualCategory??(facts.kind==='visit-outcome'?'narrative':party?'party':travel?'travel':'world'),title,summary,people:party||facts.kind==='visit-outcome'||facts.kind==='live-moment'||sessionMarker?nameList(facts.characterIds,names):[],scene,location:locationId?locations.get(locationId)??null:null,...(followUp?{followUp}:{})};if(!chronicleMatches(entry,category,search))continue;worldEntries.push(entry);if(worldEntries.length>2000){worldTruncated=true;break;}
    }
    const timeEntries:ChronicleEntry[]=[];let timeTruncated=false;
    for(const row of sourceRows(db,cam,'scene_time_step')){
      const f=payload(row),recordedAt=text(f.recordedAt);if(!recordedAt)continue;
      if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(recordedAt)||!Number.isFinite(Date.parse(recordedAt)))throw new Error('Chronikquelle hat einen ungültigen Zeitpunkt.');
      const reason=text(f.reason);if(reason.startsWith('Reise '))continue;
      const travel=reason==='Dungeonbewegung'||reason==='Bestätigter Passagenlink',sceneRow=sceneRows.find((r:any)=>r.id===row.scene_id),locationId=sceneRow?.location_id??null;
      const entry:ChronicleEntry={id:'time:'+row.id,recordedAt,category:travel?'travel':'world',title:travel?'Reisezeit fortgeschrieben':'Zeit fortgeschrieben',summary:'+'+String(f.amount)+' '+timeUnit(f.unit)+(reason?' · '+reason:''),people:[],scene:scenes.get(row.scene_id)??null,location:locationId?locations.get(locationId)??null:null};if(!chronicleMatches(entry,category,search))continue;timeEntries.push(entry);if(timeEntries.length>2000){timeTruncated=true;break;}
    }
    const boundary=readSessionBoundary(db,cam),latestSessionMarker=boundary?{id:'world:'+boundary.row.id,recordedAt:text(boundary.body.recordedAt),category:'world' as const,title:text(boundary.body.text),summary:text(boundary.body.facts.summary),people:nameList(boundary.body.facts.characterIds,names),scene:sceneName(boundary.row.scene_id,scenes),location:locations.get(boundary.body.facts.locationId)??null,sessionMarker:boundary.body.facts.marker as 'start'|'end',...(boundary.body.facts.marker==='end'&&text(boundary.body.facts.handoff)?{handoff:text(boundary.body.facts.handoff)}:{})}:null;
    const entries=[...progressEntries,...combatEntries,...worldEntries,...timeEntries];

    entries.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||(worldOrder.get(b.id)??0)-(worldOrder.get(a.id)??0)||b.id.localeCompare(a.id));
    return{...(latestSessionMarker?{latestSessionMarker}:{}),campaignName:campaign.name,entries:entries.slice(0,sourceLimit),truncated:progressTruncated||worldTruncated||timeTruncated||entries.length>sourceLimit};
  })();
}

export function chronicleMarkdown(view:ChronicleView,category:ChronicleCategory|'all',search:string){
  const entries=view.entries.filter(entry=>chronicleMatches(entry,category,search));
  const labels:Record<ChronicleCategory,string>={combat:'Kampf',narrative:'Quest',reward:'Beute',travel:'Reise',party:'Party',world:'Welt'};
  return '# Kampagnenchronik: '+view.campaignName+'\n\nExportiert am '+new Date().toLocaleString('de-DE')+'\n\n'+(view.truncated?'> Unvollständiger Ausschnitt: Auf die neuesten 2.000 passenden Ereignisse begrenzt; ältere passende Einträge fehlen. Suche oder Bereich eingrenzen.\n\n':'')+(entries.map(e=>'## '+e.title+'\n\n- Zeitpunkt: '+new Date(e.recordedAt).toLocaleString('de-DE')+'\n- Bereich: '+labels[e.category]+(e.scene?'\n- Gruppe: '+e.scene:'')+(e.location?'\n- Ort: '+e.location:'')+(e.people.length?'\n- Beteiligte: '+[...new Set(e.people)].join(', '):'')+(e.followUp?'\n- Folgespur: '+(e.followUp.kind==='quest'?'Quest':'Gerücht'):'')+(e.summary?'\n\n'+e.summary:'')+(e.handoff?'\n\n### Nächster Spielabend\n\n'+e.handoff:'')).join('\n\n')||'_Keine passenden Einträge._')+'\n';
}
