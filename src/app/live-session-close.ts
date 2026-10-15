import type {ChronicleEntry} from './chronicle-contracts';
import type {LiveSessionRecap} from './live-session-recap';
import type {Result} from './contracts';

export type SessionCloseReviewExit='discard'|'continue';
export interface SessionCloseHandoffInput{sceneTitle:string;locationTitle?:string|null;masks:{kind:'combat'|'chase';title:string;sceneTitle:string}[];treasureCount:number;xpBooked:boolean;nextVisit?:{title:string;location?:string|null}|null;journey?:string|null;agenda?:string[];narratives?:string[];notices?:string[]}

export function sessionCloseHandoffSuggestion(input:SessionCloseHandoffInput){
  const lines=['Nächster Einstieg: '+(input.sceneTitle||'Unbenannte Gruppe')+(input.locationTitle?' · '+input.locationTitle:'')];
  if(input.nextVisit)lines.push('- Nächster Besuch: '+(input.nextVisit.title||'Unbenannter Besuch')+(input.nextVisit.location?' · '+input.nextVisit.location:''));
  if(input.journey)lines.push('- Reise: '+input.journey);
  for(const event of input.agenda??[])lines.push('- Frist: '+event);
  for(const narrative of input.narratives??[])lines.push('- Offener Auftrag: '+narrative);
  for(const notice of input.notices??[])lines.push('- Weltentscheidung: '+notice);
  for(const mask of input.masks)lines.push('- '+(mask.kind==='combat'?'Kampf':'Verfolgung')+' fortsetzen: '+mask.title+(mask.sceneTitle&&mask.sceneTitle!==input.sceneTitle?' ('+mask.sceneTitle+')':''));
  if(input.treasureCount)lines.push('- Unverteilte Beute prüfen: '+input.treasureCount+' '+(input.treasureCount===1?'Schatzposition':'Schatzpositionen'));
  if(!input.xpBooked)lines.push('- Spielabend-XP abrechnen');
  return lines.join('\n');
}

export async function settleSessionCloseSources<A,P>(audit:Promise<A>,preparation:Promise<P>){
  const [checked,enrichment]=await Promise.allSettled([audit,preparation]);
  if(checked.status==='rejected')throw checked.reason;
  return{audit:checked.value,preparation:enrichment.status==='fulfilled'?enrichment.value:null,preparationError:enrichment.status==='rejected'?enrichment.reason:null};
}

export async function settleOptionalSessionSource<T>(source:Promise<Result<T>>){
  try{const result=await source;return result.ok?{value:result.value,error:null}:{value:null,error:result.error};}
  catch(error){return{value:null,error:(error as Error).message};}
}

export function latestCompletedSessionHandoff(entries:ChronicleEntry[]){
  return entries.find(entry=>entry.sessionMarker==='end')?.handoff??'';
}

export function handoffVisitSeed(handoff:string,sceneTitle:string){
  const text=handoff.trim(),first=text.split(/\r?\n/).map(line=>line.trim()).find(Boolean)??'',named=first.replace(/^Nächster Einstieg:\s*/i,'').replace(/^[-*]\s*/,''),title=(named||'Nächster Spielabend: '+(sceneTitle.trim()||'Unbenannte Gruppe')).slice(0,1000);
  return{title,notes:'Übergabe vom letzten Spielabend\n\n'+handoff};
}

export function sessionStartControls(recap:Pick<LiveSessionRecap,'open'|'marker'>){
  return{start:!recap.open&&!recap.marker,resume:!recap.open&&!!recap.marker};
}

export function leaveSessionCloseReview(dialog:HTMLDialogElement,draft:HTMLTextAreaElement,review:HTMLTextAreaElement,exit:SessionCloseReviewExit){
  if(exit==='continue')draft.value=review.value;
  dialog.close();
}
