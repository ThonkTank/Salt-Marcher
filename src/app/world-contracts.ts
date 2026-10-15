import type {DungeonPose} from './dungeon-contracts';
import type {Result} from './contracts';
import type {LiveScene} from './live-contracts';
export type Terrain='plains'|'forest'|'hills'|'mountains'|'water'|'marsh'|'desert'|'snow';
export type Climate='temperate'|'cold'|'arid'|'tropical';
export interface Hex {q:number;r:number}
export interface AtlasCell extends Hex {level:number;terrain:Terrain;elevationM:number;climate:Climate|null;road:boolean;river:boolean;label:string;faction:string;interrupt:string}
export interface AtlasMap {id:string;revision:number;name:string;hexMeters:number;climate:Climate;seed:string;cells:AtlasCell[]}
export interface AtlasPlace extends Hex {mapId:string;locationId:string;revision:number;name:string;trashed:boolean}
export interface FantasyCalendar {revision:number;name:string;startYear:number;daySeconds:number;months:{name:string;days:number}[];weekdays:string[]}
export interface CalendarEvent {id:string;revision:number;name:string;startMs:string;durationMs:string;repeatMs:string|null;locationId:string|null;notes:string;trashed:boolean}
export interface WeatherEffects {visibilityMeters:number;travelFactor:number;perception:string;temperatureC:number;ambience:string[];combatNote:string}
export interface Weather {label:string;kind:'clear'|'clouds'|'rain'|'snow'|'fog'|'storm';intensity:number;windKmh:number;effects:WeatherEffects;source:string}
export interface WeatherPhenomenon {id:string;revision:number;mapId:string;name:string;kind:Weather['kind'];intensity:number;center:Hex;radiusHexes:number;movement:Hex;startMs:string;durationMs:string;state:'active'|'paused'|'ended';pausedAtMs:string|null;temperatureC:number|null;travelFactor:number|null;notes:string}
export interface ScenePosition extends Hex {revision:number;mapId:string|null;locationId:string|null;dungeon?:DungeonPose|null}
export interface Journey {id:string;revision:number;sceneId:string;mapId:string;mapRevision:number;clockRevision:number;positionRevision:number;environmentBasis:string;actorIds:string[];membershipRevision:number;status:'active'|'paused'|'interrupted'|'arrived'|'ended';route:Hex[];nextIndex:number;paceKmh:number;factor:number;finalSeconds:number|null;plannedSeconds:number;segmentSeconds:number[];destinationLocationId:string|null;reason:string;createdAt:string;continuedFrom?:{id:string;revision:number;completedSteps:number}}
export interface WorldView {calendar:FantasyCalendar;maps:AtlasMap[];places:AtlasPlace[];events:CalendarEvent[];phenomena:WeatherPhenomenon[]}
export interface SceneWorld {scene:LiveScene;position:ScenePosition;date:string;weather:Weather|null;weatherOverrideRevision:number|null;events:CalendarEvent[];notices:{id:string;text:string}[];journey:Journey|null;knowledge:{mapId:string;q:number;r:number}[];history:{id:string;text:string}[]}
export interface TravelRequest {sceneId:string;destination:Hex;mapId:string;destinationLocationId:string|null;waypoints:Hex[];paceKmh:number;factor:number;finalSeconds:number|null;continuation?:{journeyId:string;expectedRevision:number}}
export interface TravelStage {index:number;hex:Hex;seconds:number;arrival:string;placeName:string;terrain:Terrain;weather:Weather;interrupt:string}
export interface TravelPreview {environmentBasis:string;request:TravelRequest;route:Hex[];distanceMeters:number;durationSeconds:number;segmentSeconds:number[];calendarRevision:number;mapRevision:number;clockRevision:number;positionRevision:number;membershipRevision:number;actorIds:string[];weather:Weather|null;departure:string;arrival:string;warnings:string[];stages:TravelStage[];events:{name:string;date:string;state:'active'|'upcoming'}[];continuation?:{journeyId:string;revision:number;completedSteps:number;previousRemainingSeconds:number}}
export type WorldAction=
 |{kind:'calendar';calendar:FantasyCalendar;expectedRevision:number}
 |{kind:'map';map:AtlasMap;expectedRevision:number|null}
 |{kind:'cell';mapId:string;expectedRevision:number;cell:AtlasCell}
 |{kind:'place';mapId:string;locationId:string;expectedRevision:number|null;hex:Hex}
 |{kind:'calendar-event';event:CalendarEvent;expectedRevision:number|null;basis?:import('./agenda-contracts').AgendaBasis}
 |{kind:'phenomenon';phenomenon:WeatherPhenomenon;expectedRevision:number|null}
 |{kind:'weather-override';sceneId:string;expectedClockRevision:number;expectedOverrideRevision:number|null;weather:Weather|null}
 |{kind:'notice-dismiss';sceneId:string;id:string}
 |{kind:'reveal';sceneId:string;mapId:string;hex:Hex;expectedMembershipRevision:number}
 |{kind:'place-scene';sceneId:string;position:Omit<ScenePosition,'revision'>;expectedSceneRevision:number;expectedPositionRevision:number}
 |{kind:'journey';preview:TravelPreview}
 |{kind:'journey-step';id:string;expectedRevision:number;maxSteps:number}
 |{kind:'journey-state';id:string;expectedRevision:number;state:'active'|'paused'|'ended'};
export interface WorldCommand {commandId:string;campaignId:string;token:string;action:WorldAction}
export interface WorldAck {world:WorldView;scene:SceneWorld|null}
export type WorldReconciliation = {outcome:'applied';ack:WorldAck}|{outcome:'not-applied';ack:null};
export interface WorldAPI {reconcileWorld(command:WorldCommand,token:string):Promise<Result<WorldReconciliation>>;world(token:string):Promise<Result<WorldView>>;sceneWorld(token:string,sceneId:string):Promise<Result<SceneWorld>>;previewTravel(token:string,request:TravelRequest):Promise<Result<TravelPreview>>;executeWorld(command:WorldCommand):Promise<Result<WorldAck>>}
