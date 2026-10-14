import type {Result} from './contracts';
import type {DeskContent,DeskRef} from './scene-desk-contracts';
import type {PreparationCommand} from './preparation-contracts';
export type WorldLinkRef=DeskRef;
export interface WorldLinkNode {ref:WorldLinkRef;kind:'npc'|'faction'|'quest'|'rumor'|'rule'|'location'|'creature'|'item'|'encounter';title:string;revision:number;available:boolean}
export interface WorldLinkEdge {source:WorldLinkRef;target:WorldLinkRef;label:string;authored:boolean}
export interface WorldLinksQuery {text:string;kind:'all'|'world'|WorldLinkNode['kind'];offset:number;focus:WorldLinkRef|null}
export interface WorldLinksPage {matches:WorldLinkNode[];next:number|null;nodes:WorldLinkNode[];edges:WorldLinkEdge[];focus:WorldLinkNode|null;hiddenLinks:number}
export interface WorldLinksAPI {worldLinks(token:string,query:WorldLinksQuery):Promise<Result<WorldLinksPage>>;changePreparationContent(command:PreparationCommand):Promise<Result<DeskContent>>;reconcilePreparationContent(command:PreparationCommand,token:string):Promise<Result<{outcome:'applied'|'not-applied'|'conflict';targetChanged:boolean}>>}
export const worldLinkKey=(ref:WorldLinkRef)=>ref.kind+':'+ref.id;
export const worldLinkKinds={npc:'NSC',faction:'Fraktion',quest:'Quest',rumor:'Gerücht',rule:'Regel',location:'Ort',creature:'Kreatur',item:'Gegenstand',encounter:'Begegnung'} as const;
