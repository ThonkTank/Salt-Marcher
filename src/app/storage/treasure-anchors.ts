import {createHash} from 'node:crypto';
import type {TreasureAnchor} from '../treasury-contracts';
import type {Treasure} from '../progression';
/** Old scene rewards also contain a historical location; the Scene is their current anchor. */
export function treasureAnchor(t:Pick<Treasure,'sceneId'|'locationId'>):TreasureAnchor{return t.sceneId?{kind:'scene',id:t.sceneId}:t.locationId?{kind:'location',id:t.locationId}:{kind:'unplaced'};}
export function treasureAnchorLabel(db:any,cam:string,a:TreasureAnchor):{name:string;available:boolean}{
 if(a.kind==='unplaced')return{name:'Nicht platziert',available:true};
 if(a.kind==='scene'){const row=db.prepare('SELECT s.title,l.retired FROM live_scene s JOIN scene_lifecycle l ON l.campaign_id=s.campaign_id AND l.id=s.id WHERE s.campaign_id=? AND s.id=?').get(cam,a.id);return row?{name:'Gruppe: '+(row.title||'Unbenannte Gruppe · '+a.id.slice(0,8))+(row.retired?' · archiviert':''),available:!row.retired}:{name:'Gruppe fehlt · '+a.id.slice(0,8),available:false};}
 const row=db.prepare('SELECT payload,checksum,trashed FROM location WHERE campaign_id=? AND id=?').get(cam,a.id);
 if(!row)return{name:'Ort fehlt · '+a.id.slice(0,8),available:false};
 try{if(createHash('sha256').update(row.payload).digest('hex')!==row.checksum)throw new Error();const p=JSON.parse(row.payload);if(p.id!==a.id||typeof p.name!=='string'||!p.name.trim())throw new Error();return{name:'Ort: '+p.name+(row.trashed?' · Papierkorb':''),available:!row.trashed};}catch{return{name:'Ortszuordnung unlesbar · '+a.id.slice(0,8),available:false};}
}
