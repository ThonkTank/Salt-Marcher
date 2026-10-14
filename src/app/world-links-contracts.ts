import type {Result} from './contracts';
export interface WorldLinkRef {kind:'note'|'location';id:string}
export interface WorldLinkNode {ref:WorldLinkRef;kind:'npc'|'faction'|'quest'|'rumor'|'rule'|'location';title:string;revision:number;available:boolean}
export interface WorldLinkEdge {source:WorldLinkRef;target:WorldLinkRef;label:string;authored:boolean}
export interface WorldLinksQuery {text:string;kind:'all'|WorldLinkNode['kind'];offset:number;focus:WorldLinkRef|null}
export interface WorldLinksPage {matches:WorldLinkNode[];next:number|null;nodes:WorldLinkNode[];edges:WorldLinkEdge[];focus:WorldLinkNode|null;hiddenLinks:number}
export interface WorldLinksAPI {worldLinks(token:string,query:WorldLinksQuery):Promise<Result<WorldLinksPage>>}
export const worldLinkKey=(ref:WorldLinkRef)=>ref.kind+':'+ref.id;
export const worldLinkKinds={npc:'NSC',faction:'Fraktion',quest:'Quest',rumor:'Gerücht',rule:'Regel',location:'Ort'} as const;
