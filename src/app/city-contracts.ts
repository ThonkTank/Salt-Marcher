import type {Result} from './contracts';
export interface CityPoint {x:number;y:number}
export interface CityHeader {id:string;revision:number;name:string;locationId:string;width:number;height:number;paper:string;roof:string}
export interface CityUnit {id:string;kind:'node'|'road'|'district'|'plaza'|'water'|'wall'|'building';name:string;protected:boolean;point?:CityPoint;nodeIds?:string[];via?:CityPoint[];width?:number;outline?:CityPoint[];position?:CityPoint;angle?:number;use?:string;notes?:string;districtId?:string|null;ownerId?:string|null;recipe?:{seed:string;algorithm:string};rooms?:{id:string;name:string;outline:CityPoint[];notes:string}[];interior?:boolean}
export interface CityView {header:CityHeader;units:CityUnit[];canUndo:boolean;canRedo:boolean}
export interface CityOverview {cities:CityHeader[];locations:{id:string;name:string}[]}
export interface CityCommand {commandId:string;token:string;campaignId:string;cityId:string;expectedRevision:number;action:{kind:'create';header:CityHeader}|{kind:'change';upsert:CityUnit[];remove:string[];header?:CityHeader;label:string}|{kind:'undo'|'redo'}}
export interface CityRecipe {seed:string;density:number;size:number;reach:number;districtId:string;use:string}
export interface CityPreview {cityId:string;baseRevision:number;recipe:CityRecipe;buildings:CityUnit[];replaceIds:string[];attempts:number}
export interface CityAPI {cities(token:string):Promise<Result<CityOverview>>;city(token:string,id:string):Promise<Result<CityView>>;executeCity(command:CityCommand):Promise<Result<CityView>>;exportCity(token:string,id:string,format:'svg'|'json'):Promise<Result<{cancelled:boolean}>>}
