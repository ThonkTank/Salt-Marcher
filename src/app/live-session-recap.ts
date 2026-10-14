import type {ChronicleEntry} from './chronicle-contracts';

export interface LiveSessionRecap {
  open:boolean;
  marker:ChronicleEntry|null;
  entries:ChronicleEntry[];
}

export function liveSessionRecap(entries:ChronicleEntry[],latest?:ChronicleEntry):LiveSessionRecap{
  const marker=latest??entries.find(entry=>!!entry.sessionMarker);
  if(!marker)return{open:false,marker:null,entries:[]};
  const markerIndex=entries.findIndex(entry=>entry.id===marker.id);
  if(marker.sessionMarker==='start')return{open:true,marker,entries:(markerIndex<0?entries:entries.slice(0,markerIndex)).filter(entry=>!entry.sessionMarker)};
  if(markerIndex<0)return{open:false,marker,entries:[]};
  const startIndex=entries.findIndex((entry,index)=>index>markerIndex&&entry.sessionMarker==='start');
  return{open:false,marker,entries:entries.slice(markerIndex+1,startIndex<0?entries.length:startIndex).filter(entry=>!entry.sessionMarker)};
}
