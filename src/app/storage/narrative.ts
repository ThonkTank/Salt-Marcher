import {copper} from '../progression';
import {worldNoteDocument} from '../../features/world/world-notes';
import {createHash} from 'node:crypto';import type {NarrativeState,NarrativeAward,NarrativeView} from '../narrative-contracts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function installNarrative(db:any){db.exec(`CREATE TABLE IF NOT EXISTS narrative_state(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_award(campaign_id TEXT NOT NULL,id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS narrative_award_note ON narrative_award(campaign_id,note_id);`);}
export function narrativeNote(db:any,cam:string,id:string,retained=false){const r=db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam,id);if(!r||!retained&&r.trashed||hash(r.payload)!==r.checksum)throw new Error('Narrative Notiz nicht verfügbar.');const n=worldNoteDocument(JSON.parse(r.payload));if(n.id!==r.id||n.revision!==r.revision)throw new Error('Narrative Notizzuordnung widersprüchlich.');if(!retained&&!['quest','rumor'].includes(n.kind))throw new Error('Quest oder Gerücht auswählen.');return n;}
function parsed<T>(r:any):T{if(!r||hash(r.payload)!==r.checksum)throw new Error('Narrative Belohnung beschädigt.');return JSON.parse(r.payload);}
function checkedState(db:any,cam:string,row:any):NarrativeState {
 const s=parsed<NarrativeState>(row);
 if(s.noteId!==row.note_id||s.revision!==row.revision||!Number.isSafeInteger(s.revision)||s.revision<1||s.awardId!==null&&(typeof s.awardId!=='string'||!s.awardId))throw new Error('Narrativer Status gehört zu einer anderen Notiz oder Revision.');
 narrativeNote(db,cam,row.note_id,true);validateNarrativeState(db,cam,s,true);
 return s;
}
function checkedAward(db:any,cam:string,row:any):NarrativeAward {
 const a=parsed<NarrativeAward>(row);
 if(a.id!==row.id||a.noteId!==row.note_id||typeof a.title!=='string'||a.title.length>1000||typeof a.outcome!=='string'||!a.outcome.trim()||a.outcome.length>10000||typeof a.recordedAt!=='string'||a.recordedAt.length>100||!Number.isFinite(Date.parse(a.recordedAt))||![a.poolXp,a.shareXp].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(a.recipientIds)||a.recipientIds.length>1000||new Set(a.recipientIds).size!==a.recipientIds.length)throw new Error('Narrative Belohnung besitzt einen widersprüchlichen Inhalts-/Ownervertrag.');
 narrativeNote(db,cam,row.note_id,true);
 for(const id of a.recipientIds)if(typeof id!=='string'||!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam,id))throw new Error('Belohnungsempfänger gehört nicht zur Kampagne.');
 for(const [id,table]of [[a.sceneId,'live_scene'],[a.treasureId,'treasure']] as const)if(id!==null&&(typeof id!=='string'||!db.prepare('SELECT 1 FROM '+table+' WHERE campaign_id=? AND id=?').get(cam,id)))throw new Error('Belohnungsreferenz fehlt oder gehört zu einer anderen Kampagne.');
 return a;
}
function linkedAward(db:any,cam:string,s:NarrativeState):NarrativeAward|null {
 const rows=db.prepare('SELECT * FROM narrative_award WHERE campaign_id=? AND note_id=? LIMIT 2').all(cam,s.noteId);
 if(rows.length>1||rows.length===0&&s.awardId!==null||rows.length===1&&rows[0].id!==s.awardId)throw new Error('Bestätigte narrative Belohnung und Statusverweis widersprüchlich.');
 return rows.length?checkedAward(db,cam,rows[0]):null;
}
export function readNarrative(db:any,cam:string,id:string):NarrativeView {
 const n=narrativeNote(db,cam,id),r=db.prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?').get(cam,id),state: NarrativeState=r?checkedState(db,cam,r):{noteId:id,revision:0,status:'open',locationId:null,contributors:[],poolXp:0,items:[],awardId:null};
 return{state,award:linkedAward(db,cam,state),noteRevision:n.revision};
}
export function validateNarrativeBackup(db:any){
 const exists=(name:string)=>!!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(name),state=exists('narrative_state'),award=exists('narrative_award');
 if(!state&&!award&&db.pragma('user_version',{simple:true})<35)return;
 if(!state||!award)throw new Error('Narratives Datenschema fehlt oder ist unvollständig.');
 for(const row of db.prepare('SELECT * FROM narrative_state').iterate())linkedAward(db,row.campaign_id,checkedState(db,row.campaign_id,row));
 for(const row of db.prepare('SELECT * FROM narrative_award').iterate()){const a=checkedAward(db,row.campaign_id,row),s=db.prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?').get(row.campaign_id,a.noteId);if(!s||checkedState(db,row.campaign_id,s).awardId!==a.id)throw new Error('Narrative Belohnung besitzt keinen passenden Statusverweis.');}
}
export function saveNarrative(db:any,cam:string,state:NarrativeState){const payload=JSON.stringify(state);db.prepare('INSERT INTO narrative_state VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(cam,state.noteId,state.revision,payload,hash(payload));}
export function saveNarrativeAward(db:any,cam:string,award:NarrativeAward){const payload=JSON.stringify(award);db.prepare('INSERT INTO narrative_award VALUES(?,?,?,?,?)').run(cam,award.id,award.noteId,payload,hash(payload));}
export function validateNarrativeState(db:any,cam:string,s:NarrativeState,retained=false){if(!s||!['open','closed'].includes(s.status)||!Number.isSafeInteger(s.poolXp)||s.poolXp<0||!Array.isArray(s.contributors)||s.contributors.length>1000||new Set(s.contributors).size!==s.contributors.length||!Array.isArray(s.items)||s.items.length>100)throw new Error('Status, Mitwirkende und Belohnung prüfen.');if(s.locationId&&!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND (? OR trashed=0)').get(cam,s.locationId,Number(retained)))throw new Error('Verknüpfter Ort nicht verfügbar.');for(const id of s.contributors)if(!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam,id))throw new Error('Mitwirkende Figur fehlt.');for(const i of s.items)if(!i||typeof i.name!=='string'||!i.name.trim()||!Number.isSafeInteger(i.quantity)||i.quantity<1||typeof i.valueGold!=='string')throw new Error('Belohnungsgegenstand prüfen.');for(const i of s.items){copper(i.valueGold);if(!['coins','equipment','trade-goods','magic','other'].includes(i.category))throw new Error('Belohnungskategorie ungültig.');}}
