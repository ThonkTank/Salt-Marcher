import type {ChronicleEntry} from './chronicle-contracts';
import type {LiveAction} from './live-contracts';

export interface LiveSessionRecap {
  open:boolean;
  marker:ChronicleEntry|null;
  entries:ChronicleEntry[];
}

export function liveSessionRecap(entries:ChronicleEntry[]):LiveSessionRecap{
  const markerIndex=entries.findIndex(entry=>!!entry.sessionMarker);
  if(markerIndex<0)return{open:false,marker:null,entries:[]};
  const marker=entries[markerIndex]!;
  if(marker.sessionMarker==='start')return{open:true,marker,entries:entries.slice(0,markerIndex).filter(entry=>!entry.sessionMarker)};
  const startIndex=entries.findIndex((entry,index)=>index>markerIndex&&entry.sessionMarker==='start');
  return{open:false,marker,entries:entries.slice(markerIndex+1,startIndex<0?entries.length:startIndex).filter(entry=>!entry.sessionMarker)};
}

export const liveActionUpdatesRecap=(action:LiveAction)=>['membership','move','live-moment','session-marker','advance-clock'].includes(action.kind);
