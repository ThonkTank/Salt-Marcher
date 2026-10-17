import type {RoomGeometry,WorkspaceGeometry,Point} from './contracts';
import type {AtlasBinding,AtlasRenderView} from './campaign-atlas-contracts';
import type {DrawingMapView} from './drawing-contracts';
import type {CityHeader,CityUnit} from './city-contracts';
import type {LandscapeBox} from './atlas-landscape';
export const REGION_VECTOR_OBJECTS=1500;
export const REGION_REPLY_BYTES=2*1024*1024;
export const REGION_ACTIVE_BYTES=16*1024*1024;
export const REGION_CACHE_BYTES=64*1024*1024;
/** Geometry is display-only. In particular it is never a CityCommand upsert. */
export type CityUnitGeometry=Pick<CityUnit,'id'|'kind'|'name'|'protected'|'point'|'outline'|'position'|'angle'|'width'|'interior'>;
export interface CityGeometry {header:CityHeader;units:CityUnitGeometry[]}
export interface AtlasRegionQuery {
 box:LandscapeBox; width:number;height:number;scopeId:string|null;floorId:string;
 slice:number|null;roofs:boolean;perception?:boolean;revision?:number;fence?:string;
}
export interface AtlasRegionGeometry {
 campaignId:string;token:string;revision:number;fence:string;box:LandscapeBox;slice:number|null;scopeId:string|null;floorId:string;
 rooms:RoomGeometry[];floors:WorkspaceGeometry['floors'];drawing:DrawingMapView;
 cities:CityGeometry[];bindings:AtlasBinding[];scopes:{id:string;name:string}[];
 frames:Record<string,{x:number;y:number;angle:number}>;scopeBounds:Record<string,LandscapeBox>;interiors:Record<string,string>;
 coverage:{complete:boolean;mode:'detail'|'raster';objects:number;unreadable:number;index:'rtree'|'scan'};
 raster?:{box:LandscapeBox;width:number;height:number;data:string};
}
export interface AtlasRegionView extends AtlasRenderView {
 region:Omit<AtlasRegionGeometry,'rooms'|'floors'|'drawing'|'cities'|'bindings'|'scopes'>;
}
export interface AtlasObjectFocus {
 kind:'room'|'city'|'building'|'element'|'scope'|'city-unit';id:string;cityId?:string;scopeId?:string;floorId?:string;
 point:Point;box:LandscapeBox;revision:number;interiorScopeId?:string;
}
export interface AtlasRegionCursor {epoch:string;sequence:number;shadow?:{epoch:string;sequence:number}}
export interface AtlasRegionSource {
 filename:string;campaignId:string;token:string;fence:string;revision:number;epoch:string;sequence:number;
 shadow?:{filename:string;scopeId:string;epoch:string;sequence:number};
 reset:boolean;changes:{table:string;id:string}[];
}
export interface AtlasCitySite {header:CityHeader;unit:CityUnit|null;related:CityUnit[];factions:{id:string;name:string}[];canUndo:boolean;canRedo:boolean}
export interface AtlasRegionAPI {
 atlasRegion(token:string,query:AtlasRegionQuery,consumer?:'view'|'export'):Promise<import('./contracts').Result<AtlasRegionView>>;
 atlasObjectFocus(token:string,kind:'room'|'city'|'building'|'element'|'scope',id:string):Promise<import('./contracts').Result<AtlasObjectFocus>>;
 atlasRegionHit(token:string,query:AtlasRegionQuery,point:Point,fence:string):Promise<import('./contracts').Result<AtlasObjectFocus|null>>;
 cancelAtlasRegion(token:string,consumer?:'view'|'export'):Promise<import('./contracts').Result<void>>;
 atlasCitySite(token:string,cityId:string,id?:string):Promise<import('./contracts').Result<AtlasCitySite>>;
}
export const emptyDrawing=():DrawingMapView=>({elements:[],styles:[],hiddenRooms:[],hiddenFloors:[],features:[]});
export function validateRegion(q:AtlasRegionQuery){
 if(!q||!q.box||![q.box.x,q.box.y,q.box.width,q.box.height].every(Number.isFinite)||q.box.width<=0||q.box.height<=0||!Number.isFinite(q.box.x+q.box.width)||!Number.isFinite(q.box.y+q.box.height)||!Number.isSafeInteger(q.width)||!Number.isSafeInteger(q.height)||q.width<1||q.height<1||q.width>8192||q.height>8192||q.scopeId!==null&&(typeof q.scopeId!=='string'||!q.scopeId)||typeof q.floorId!=='string'||!q.floorId||q.slice!==null&&!Number.isFinite(q.slice)||typeof q.roofs!=='boolean'||q.perception!==undefined&&typeof q.perception!=='boolean'||q.revision!==undefined&&(!Number.isSafeInteger(q.revision)||q.revision<0)||q.fence!==undefined&&(typeof q.fence!=='string'||!q.fence))throw new Error('Kartenausschnitt prüfen.');
}

/** Structured-clone turns null-prototype records into ordinary objects. */
export const regionValue=<T>(values:Record<string,T>|undefined,id:string):T|undefined=>values&&Object.hasOwn(values,id)?values[id]:undefined;
