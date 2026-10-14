import {createHash} from 'node:crypto';
import type {NpcRecord,NpcRole} from '../npc-contracts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function installNpcRecords(db:any){db.exec(`CREATE TABLE IF NOT EXISTS npc_record(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,faction_id TEXT,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES world_note(campaign_id,id),FOREIGN KEY(campaign_id,faction_id) REFERENCES world_note(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS npc_draft(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS npc_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);}
export function npcRecord(db:any,cam:string,id:string):NpcRecord{
 const row=db.prepare("SELECT 1 FROM sqlite_schema WHERE name='npc_record'").get()?db.prepare('SELECT * FROM npc_record WHERE campaign_id=? AND id=?').get(cam,id):null;
 if(row){if(hash(row.payload)!==row.checksum)throw new Error('NPC-Weltprofil beschädigt.');return JSON.parse(row.payload);}
 return{id,revision:0,factionId:null,modifier:db.prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?').get(cam,id)?-1:0,lifecycle:'active',appearance:'',behavior:'',history:''};
}
export function npcDisposition(db:any,cam:string,record:NpcRecord):{disposition:number;role:NpcRole}{let base=0;if(record.factionId&&db.prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND trashed=0').get(cam,record.factionId)){const row=db.prepare("SELECT payload,checksum FROM world_source WHERE campaign_id=? AND kind='faction' AND id=?").get(cam,record.factionId);if(row){if(hash(row.payload)!==row.checksum)throw new Error('Fraktionsquelle beschädigt.');base=JSON.parse(row.payload).disposition??0;}}const disposition=Math.max(-100,Math.min(100,base+record.modifier));return{disposition,role:disposition>0?'friendly':disposition<0?'hostile':'neutral'};}
