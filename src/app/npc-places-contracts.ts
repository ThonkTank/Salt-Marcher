import type {Result} from './contracts';
export type NpcPlaceSite=({kind:'home'|'work';cityId:string;unitId:string}|{kind:'dungeon';roomId:string;scopeId:string;floorId:string})&{id:string;title:string;detail:string;available:boolean};
export interface NpcPlaces {npcId:string;name:string;locationTitle:string;sites:NpcPlaceSite[];next:number|null}
export interface NpcPlacesAPI {npcPlaces(token:string,id:string,offset:number):Promise<Result<NpcPlaces>>}
