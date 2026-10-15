import type {Result} from './contracts';
import type {DeskRef} from './scene-desk-contracts';
export type LocationMaterialKind='directory'|'npc'|'narrative'|'group'|'shop';
export interface LocationMaterial {id:string;title:string;detail:string;ref?:DeskRef;unavailable?:boolean}
export interface LocationMaterialsQuery {locationId:string|null;kind:LocationMaterialKind;text:string;offset:number}
export interface LocationMaterialsPage {items:LocationMaterial[];next:number|null;locationRevision:number|null}
export interface LocationNotebookAPI {locationMaterials(token:string,query:LocationMaterialsQuery):Promise<Result<LocationMaterialsPage>>}
