import {readEncounterPlan} from './encounters';
import {assessEncounter,type EncounterParty} from '../encounter-contracts';
import {xpShare,type Progress} from '../progression';
import {projectDayPacing} from '../adventuring-day-model';
import type {DayPlanEntry,DayItinerary} from '../adventuring-day-contracts';

/** Read saved source revisions only. Each fight is rounded separately like a real award. */
export function readDayItinerary(db:any,cam:string,entries:DayPlanEntry[],party:EncounterParty[],active:(Progress&{name:string})[]|null):DayItinerary{
 if(!Array.isArray(entries)||entries.length>20||entries.some(e=>!e||typeof e.id!=='string'||!e.id||!Number.isSafeInteger(e.revision)||e.revision<1||!Number.isSafeInteger(e.count)||e.count<1||e.count>99))throw new Error('Tagesplan: höchstens 20 gespeicherte Vorlagen mit jeweils 1–99 Wiederholungen wählen.');
 const partySize=party.reduce((n,p)=>n+p.count,0),out:DayItinerary={partySize,stages:[],rawLoadXp:0,rawRewardXp:0,totalLoadXp:0,totalRewardXp:0};
 if(!partySize&&entries.length)throw new Error('Für den Encounter-Tagesplan zuerst eine Party oder eigene Rechnerzeilen wählen.');
 for(const entry of entries){
  const plan=readEncounterPlan(db,cam,entry.id);
  if(plan.revision!==entry.revision)throw new Error('Vorlage „'+plan.name+'“ wurde geändert. Im Tagesplan „Vorlagen aktualisieren“ wählen.');
  const assessment=assessEncounter(party,plan.entries.map(e=>({count:e.count,xp:plan.sources.find(c=>c.id===e.creatureId)?.xp})));
  if(assessment.missingXp)throw new Error('Vorlage „'+plan.name+'“: XP fehlen für '+assessment.missingXp+' Kreaturen. Quelle im Encounter-Editor ergänzen.');
  if(!assessment.count)throw new Error('Vorlage „'+plan.name+'“ enthält keine Gegner.');
  const load=xpShare(assessment.adjustedXp,partySize),reward=xpShare(assessment.baseXp,partySize);
  out.rawLoadXp+=assessment.adjustedXp*entry.count;out.rawRewardXp+=assessment.baseXp*entry.count;
  out.totalLoadXp+=load.total*entry.count;out.totalRewardXp+=reward.total*entry.count;
  if(![out.rawLoadXp,out.rawRewardXp,out.totalLoadXp,out.totalRewardXp].every(n=>Number.isSafeInteger(n)&&n<=1e12))throw new Error('Tagesplan überschreitet 1 Billion XP. Wiederholungen verringern.');
  const pacing=active?projectDayPacing(active,out.totalLoadXp):null;
  out.stages.push({...entry,name:plan.name,difficulty:assessment.difficulty,baseXp:assessment.baseXp,adjustedXp:assessment.adjustedXp,multiplier:assessment.multiplier,loadShare:load.share,rewardShare:reward.share,cumulativeLoadXp:out.totalLoadXp,cumulativeRewardXp:out.totalRewardXp,
   shortDue:pacing?.known?pacing.members.filter(m=>m.after?.due==='short').length:null,longDue:pacing?.known?pacing.members.filter(m=>m.after?.due==='long').length:null});
 }
 return out;
}
