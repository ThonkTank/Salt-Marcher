import {createHash,randomUUID} from 'node:crypto';import type {Room} from '../contracts';import type {DrawingElement} from '../drawing-contracts';import type {DungeonGeometry} from '../dungeon-contracts';import type {DungeonPath,DungeonPassage,PathPreview,PathAction,PassageSide} from '../path-contracts';import {validateDungeonPath,validateDungeonPassage} from '../path-contracts';import {buildPath,resolvePathAnchor} from '../path-model';import {volumeProjection} from '../volume-model';import {volumeRow,readDungeonVolume} from './volume';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),parsed=(r:any)=>{if(!r||hash(r.payload)!==r.checksum)throw new Error('3D-Pfad oder Passage beschädigt.');return JSON.parse(r.payload);};
export function installPathSchema(db:any){db.exec(`CREATE TABLE IF NOT EXISTS dungeon_path(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,room_id TEXT,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_passage(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,room_id TEXT NOT NULL,volume_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;`);}
function checkedPathRow(db:any,r:any,references=true):DungeonPath{
 const p=parsed(r);validateDungeonPath(p,true);
 if(p.id!==r.id||p.scopeId!==r.scope_id||p.roomId!==r.room_id||p.revision!==r.revision)throw new Error('Pfadidentität widersprüchlich.');
 if(references){
  const room=db.prepare('SELECT scope_id FROM room WHERE campaign_id=? AND id=?').get(r.campaign_id,p.roomId);
  const volume=db.prepare('SELECT scope_id,room_id FROM dungeon_volume WHERE campaign_id=? AND id=?').get(r.campaign_id,p.volumeId);
  if(room?.scope_id!==p.scopeId||volume?.scope_id!==p.scopeId||volume?.room_id!==p.roomId)throw new Error('Pfadvolumen gehört nicht zu seinem Raum.');
  for(const anchor of [p.from,p.to]){
   const v=db.prepare('SELECT scope_id,room_id FROM dungeon_volume WHERE campaign_id=? AND id=?').get(r.campaign_id,anchor.volumeId);
   if(v?.scope_id!==p.scopeId||v?.room_id!==anchor.roomId)throw new Error('Pfadendpunkt gehört nicht zu seinem Volumen.');
  }
  for(const passageId of [p.fromPassageId,p.toPassageId]){
   const row=db.prepare('SELECT * FROM dungeon_passage WHERE campaign_id=? AND id=?').get(r.campaign_id,passageId),passage=parsed(row);validateDungeonPassage(passage);
   if(passage.pathId!==p.id||passage.scopeId!==p.scopeId||passage.otherRoomId!==p.roomId)throw new Error('Pfadpassage gehört nicht zu diesem Pfad.');
  }
 }
 return p;
}
function checkedPassageRow(db:any,r:any,references=true):DungeonPassage{
 const p=parsed(r);validateDungeonPassage(p);
 if(p.id!==r.id||p.scopeId!==r.scope_id||p.roomId!==r.room_id||p.volumeId!==r.volume_id||p.revision!==r.revision)throw new Error('Passagenidentität widersprüchlich.');
 if(references)checkPassageReferences(db,r.campaign_id,p);
 return p;
}
function checkPassageReferences(db:any,cam:string,p:DungeonPassage){
 const room=db.prepare('SELECT scope_id FROM room WHERE campaign_id=? AND id=?').get(cam,p.roomId);
 const volume=db.prepare('SELECT scope_id,room_id FROM dungeon_volume WHERE campaign_id=? AND id=?').get(cam,p.volumeId);
 if(room?.scope_id!==p.scopeId||volume&&(volume.scope_id!==p.scopeId||volume.room_id!==p.roomId)||p.assigned&&!volume)throw new Error('Passage gehört nicht zu ihrem Raumvolumen.');
 if(p.pathId){
  const path=checkedPathRow(db,db.prepare('SELECT * FROM dungeon_path WHERE campaign_id=? AND id=?').get(cam,p.pathId),false);
  if(path.scopeId!==p.scopeId||![path.fromPassageId,path.toPassageId].includes(p.id)||path.roomId!==p.otherRoomId)throw new Error('Passage gehört nicht zu diesem Pfad.');
 }
}
export function readDungeonPaths(db:any,cam:string):DungeonPath[]{
 const paths:DungeonPath[]=[];for(const row of db.prepare('SELECT * FROM dungeon_path WHERE campaign_id=? ORDER BY rowid').iterate(cam))paths.push(checkedPathRow(db,row));return paths;
}
export function readDungeonPassages(db:any,cam:string):DungeonPassage[]{
 const passages:DungeonPassage[]=[];for(const row of db.prepare('SELECT * FROM dungeon_passage WHERE campaign_id=? ORDER BY room_id,id').iterate(cam))passages.push(checkedPassageRow(db,row));return passages;
}
export function readDungeonPassage(db:any,cam:string,id:string):DungeonPassage|undefined{
 const row=db.prepare('SELECT * FROM dungeon_passage WHERE campaign_id=? AND id=?').get(cam,id);return row?checkedPassageRow(db,row):undefined;
}
export function validateDungeonPaths(db:any){
 for(const row of db.prepare('SELECT * FROM dungeon_path').iterate())checkedPathRow(db,row);
 for(const row of db.prepare('SELECT * FROM dungeon_passage').iterate())checkedPassageRow(db,row);
}
export function validatePathHistoryRow(db:any,table:string,row:any){if(table==='dungeon_path')checkedPathRow(db,row,false);else checkedPassageRow(db,row,false);}
function checkedPathRequest(db:any,cam:string,p:DungeonPath){
 validateDungeonPath(p);
 const row=db.prepare('SELECT * FROM dungeon_path WHERE campaign_id=? AND id=?').get(cam,p.id);
 if(row){
  const old=checkedPathRow(db,row);
  if(old.mode==='area'||p.mode!==old.mode||p.scopeId!==old.scopeId||p.roomId!==old.roomId||p.volumeId!==old.volumeId||p.fromPassageId!==old.fromPassageId||p.toPassageId!==old.toPassageId)throw new Error('Pfadidentität und erzeugte Geometrie behalten ihre Zuordnung.');
 }else{
  if(p.roomId!==null||p.volumeId!==null||p.mode!=='path')throw new Error('Neue Pfade erhalten eine eigene Geometrie.');
  for(const id of [p.fromPassageId,p.toPassageId])if(db.prepare('SELECT 1 FROM dungeon_passage WHERE campaign_id=? AND id=?').get(cam,id))throw new Error('Passagenidentität ist bereits vergeben.');
 }
}
function pathBasis(db:any,cam:string,p:DungeonPath){return hash(JSON.stringify({rooms:db.prepare("SELECT id,floor_id,json_extract(payload,'$.polygons') footprint FROM room WHERE campaign_id=? AND scope_id=? AND id<>? ORDER BY id").all(cam,p.scopeId,p.roomId??''),volumes:db.prepare('SELECT id,revision FROM dungeon_volume WHERE campaign_id=? AND scope_id=? AND id<>? ORDER BY id').all(cam,p.scopeId,p.volumeId??''),hidden:db.prepare('SELECT id,scope_id,kind,hidden FROM drawing_hidden WHERE campaign_id=? AND scope_id=? ORDER BY id,kind').all(cam,p.scopeId),floors:db.prepare('SELECT id,source_elevation FROM drawing_floor WHERE campaign_id=? AND scope_id=? ORDER BY id').all(cam,p.scopeId),elements:db.prepare('SELECT id,revision FROM drawing_element WHERE campaign_id=? AND scope_id=? ORDER BY id').all(cam,p.scopeId),passages:db.prepare('SELECT id,revision FROM dungeon_passage WHERE campaign_id=? AND scope_id=? AND id NOT IN(?,?) ORDER BY id').all(cam,p.scopeId,p.fromPassageId,p.toPassageId)}));}
export function previewDungeonPath(db:any,cam:string,p:DungeonPath,g:DungeonGeometry):PathPreview{checkedPathRequest(db,cam,p);if(p.mode==='area')throw new Error('Feste Area hat kein automatisches Routing.');return buildPath(g,p,pathBasis(db,cam,p));}
export function pathState(db:any,cam:string,p:DungeonPath){return p.mode==='area'?'fixed':pathBasis(db,cam,p)===p.basis?'ready':'stale';}
function row(cam:string,p:DungeonPath){const payload=JSON.stringify(p);return{campaign_id:cam,id:p.id,scope_id:p.scopeId,room_id:p.roomId,revision:p.revision,payload,checksum:hash(payload)};}
function passageRow(cam:string,p:DungeonPassage){const payload=JSON.stringify(p);return{campaign_id:cam,id:p.id,scope_id:p.scopeId,room_id:p.roomId,volume_id:p.volumeId,revision:p.revision,payload,checksum:hash(payload)};}
const side=(roomId:string):PassageSide=>({description:'',passable:true,sight:true,light:true,sound:true,additionalSeconds:0,target:{kind:'geometry',id:roomId}});
interface Owner {apply:(key:{table:string;id:string},row:any)=>void;room:(id:string)=>Room;create:(scopeId:string,floorId:string,name:string,polygons:Room['polygons'])=>Room;hide:(kind:'room'|'floor',scopeId:string,id:string,hidden:boolean)=>void;element:(e:DrawingElement)=>void;roomRow:(cam:string,r:Room)=>any}
export function executePathAction(db:any,cam:string,a:PathAction,g:DungeonGeometry,owner:Owner){
 if(a.kind==='path-publish'){const existing=db.prepare('SELECT * FROM dungeon_path WHERE campaign_id=? AND id=?').get(cam,a.preview.path.id);if((existing?.revision??null)!==a.expectedRevision)throw new Error('Pfadstand geändert.');const fresh=previewDungeonPath(db,cam,a.preview.path,g);if(JSON.stringify(fresh)!==JSON.stringify(a.preview))throw new Error('Pfadvorschau geändert. Neu berechnen.');const previousPassages=new Map([a.preview.path.fromPassageId,a.preview.path.toPassageId].map(id=>[id,readDungeonPassage(db,cam,id)]));const p=fresh.path,polygons=volumeProjection(fresh.volume),room=p.roomId?owner.room(p.roomId):owner.create(p.scopeId,fresh.volume.floorId,p.name,polygons);p.roomId=room.id;p.volumeId=existing?parsed(existing).volumeId:randomUUID();p.revision=existing?.revision??0;const volume={...fresh.volume,id:p.volumeId!,roomId:room.id,revision:readDungeonVolume(db,cam,room.id)?.revision??0};
 // A vertical connector fills only the outside gap; its headroom continues through its endpoint Passages.
 if(p.segments.every(s=>['shaft','ladder'].includes(s.form))){const from=resolvePathAnchor(g,p.from),to=resolvePathAnchor(g,p.to),min=Math.min((from.world.z-from.base)/1.524,(to.world.z-from.base)/1.524),max=Math.max((from.world.z-from.base)/1.524,(to.world.z-from.base)/1.524);if(max>min)for(const c of volume.columns)c.spans=[{z:min,height:max-min,floor:false,ceiling:false,medium:p.medium}];}
 owner.apply({table:'room',id:room.id},owner.roomRow(cam,{...room,polygons}));owner.apply({table:'dungeon_volume',id:volume.id},volumeRow(cam,volume));for(const [which,id,anchor]of [['from',p.fromPassageId,p.from],['to',p.toPassageId,p.to]] as const){const old=previousPassages.get(id),passage:DungeonPassage={id,revision:old?.revision??0,scopeId:p.scopeId,roomId:anchor.roomId,volumeId:anchor.volumeId!,pathId:p.id,otherRoomId:room.id,anchor,widthSteps:(which==='from'?p.segments[0]:p.segments.at(-1))!.widthSteps,heightSteps:(which==='from'?p.segments[0]:p.segments.at(-1))!.heightSteps,outbound:old?.outbound??side(room.id),inbound:old?.inbound??side(anchor.roomId),assigned:true};owner.apply({table:'dungeon_passage',id},passageRow(cam,passage));}
 owner.apply({table:'dungeon_path',id:p.id},row(cam,p));const saved=parsed(db.prepare('SELECT * FROM dungeon_path WHERE campaign_id=? AND id=?').get(cam,p.id)) as DungeonPath;saved.basis=pathBasis(db,cam,saved);owner.apply({table:'dungeon_path',id:p.id},row(cam,saved));db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(room.id,cam);
 }else if(a.kind==='passage'){const old=db.prepare('SELECT revision FROM dungeon_passage WHERE campaign_id=? AND id=?').get(cam,a.passage.id);if((old?.revision??null)!==a.expectedRevision)throw new Error('Passage geändert.');const p=structuredClone(a.passage);validateDungeonPassage(p);checkPassageReferences(db,cam,p);if(!p.pathId&&p.outbound.target.kind==='geometry'){p.otherRoomId=p.outbound.target.id;if(p.inbound.target.id===null)p.inbound.target={kind:'geometry',id:p.roomId};}if(p.assigned){const resolved=resolvePathAnchor(g,p.anchor);if(p.roomId!==resolved.volume.roomId||p.volumeId!==resolved.volume.id||p.scopeId!==resolved.volume.scopeId)throw new Error('Passage und Anker müssen zum gleichen Volumen gehören.');}owner.apply({table:'dungeon_passage',id:p.id},passageRow(cam,p));
 }else{const record=db.prepare('SELECT * FROM dungeon_path WHERE campaign_id=? AND id=?').get(cam,a.id),p=parsed(record) as DungeonPath;if(record.revision!==a.expectedRevision)throw new Error('Pfad geändert.');if(a.kind==='path-convert'){p.mode='area';owner.apply({table:'dungeon_path',id:p.id},row(cam,p));}else if(p.roomId){owner.hide('room',p.scopeId,p.roomId,a.hidden);for(const passage of readDungeonPassages(db,cam).filter(x=>x.pathId===p.id))owner.apply({table:'dungeon_passage',id:passage.id},passageRow(cam,{...passage,assigned:!a.hidden}));}}
}

// A graph preview owns geometry, while location existence remains canonical.
// The binding lives only as long as that preview connection is open.
const passageLocationLookups=new WeakMap<object,(campaignId:string,id:string)=>boolean>();
export function bindPassageLocations(db:object,lookup:(campaignId:string,id:string)=>boolean){
 passageLocationLookups.set(db,lookup);return()=>{passageLocationLookups.delete(db);};
}
function passageLocationExists(db:any,cam:string,id:string|null){
 if(id===null)return false;
 const lookup=passageLocationLookups.get(db);
 return lookup?lookup(cam,id):!!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0').get(cam,id);
}
export function passageStatuses(db:any,cam:string,passages=readDungeonPassages(db,cam)){return passages.map(p=>{const status=(s:PassageSide)=>!p.assigned?'ungebunden':s.target.kind==='geometry'?s.target.id===p.otherRoomId||s.target.id===p.roomId?'bereit':'Geometrieziel fehlt':s.target.kind==='passage'?db.prepare("SELECT 1 FROM dungeon_passage WHERE campaign_id=? AND id=? AND json_extract(payload,'$.assigned')=1").get(cam,s.target.id)?'verlinkt':'Passagenziel fehlt':passageLocationExists(db,cam,s.target.id)?'Ortslink':'Ortsziel fehlt';return{id:p.id,outbound:status(p.outbound),inbound:status(p.inbound)};});}
