import type {ItemInput,ProgressGuard} from './progression';
export interface NarrativeState{noteId:string;revision:number;status:'open'|'closed';locationId?:string|null;contributors:string[];poolXp:number;items:ItemInput[];awardId:string|null}
export interface NarrativeAward{id:string;noteId:string;title:string;sceneId:string|null;poolXp:number;shareXp:number;recipientIds:string[];treasureId:string|null;outcome:string;recordedAt:string}
export type NarrativeAction={kind:'narrative-state';state:NarrativeState;expectedRevision:number;expectedNoteRevision:number}|{kind:'narrative-award';noteId:string;expectedRevision:number;expectedNoteRevision:number;sceneId:string|null;poolXp:number;noXp:boolean;recipients:ProgressGuard[];items:ItemInput[];outcome:string};
export interface NarrativeView{state:NarrativeState;award:NarrativeAward|null;noteRevision:number}
