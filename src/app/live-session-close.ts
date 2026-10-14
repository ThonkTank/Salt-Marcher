import type {ChronicleEntry} from './chronicle-contracts';

export type SessionCloseReviewExit='discard'|'continue';
export interface SessionCloseHandoffInput{sceneTitle:string;locationTitle?:string|null;masks:{kind:'combat'|'chase';title:string;sceneTitle:string}[];treasureCount:number;xpBooked:boolean}

export function sessionCloseHandoffSuggestion(input:SessionCloseHandoffInput){
  const lines=['Nächster Einstieg: '+(input.sceneTitle||'Unbenannte Gruppe')+(input.locationTitle?' · '+input.locationTitle:'')];
  for(const mask of input.masks)lines.push('- '+(mask.kind==='combat'?'Kampf':'Verfolgung')+' fortsetzen: '+mask.title+(mask.sceneTitle&&mask.sceneTitle!==input.sceneTitle?' ('+mask.sceneTitle+')':''));
  if(input.treasureCount)lines.push('- Unverteilte Beute prüfen: '+input.treasureCount+' '+(input.treasureCount===1?'Schatzposition':'Schatzpositionen'));
  if(!input.xpBooked)lines.push('- Spielabend-XP abrechnen');
  return lines.join('\n');
}

export function latestCompletedSessionHandoff(entries:ChronicleEntry[]){
  return entries.find(entry=>entry.sessionMarker==='end')?.handoff??'';
}

export function leaveSessionCloseReview(dialog:HTMLDialogElement,draft:HTMLTextAreaElement,review:HTMLTextAreaElement,exit:SessionCloseReviewExit){
  if(exit==='continue')draft.value=review.value;
  dialog.close();
}
