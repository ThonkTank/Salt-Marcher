import {createHash} from 'node:crypto';
import type {NarrativeState,NarrativeAward,NarrativeView} from '../narrative-contracts';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const id=(value:unknown)=>typeof value==='string'&&!!value&&value.length<=1000;
const nullableId=(value:unknown)=>value===null||id(value);
const optionalNullableId=(value:unknown)=>value===undefined||nullableId(value);
const gold=(value:unknown)=>typeof value==='string'&&/^(0|[1-9][0-9]{0,14})([.,][0-9]{1,2})?$/.test(value.trim());
const categories=['coins','equipment','trade-goods','magic','other'];

export function installNarrative(db:any){db.exec(`CREATE TABLE IF NOT EXISTS narrative_state(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_award(campaign_id TEXT NOT NULL,id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;`);}

function parsed<T>(row:any):T{if(!row||hash(row.payload)!==row.checksum)throw new Error('Narrative Belohnung beschädigt.');return JSON.parse(row.payload);}
function narrativeDocument(db:any,cam:string,noteId:string){const row=db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam,noteId);if(!row||hash(row.payload)!==row.checksum)throw new Error('Narrative Notiz nicht verfügbar.');const note=JSON.parse(row.payload);if(!['quest','rumor'].includes(note.kind))throw new Error('Quest oder Gerücht auswählen.');return{row,note};}

export function narrativeNote(db:any,cam:string,noteId:string){const {row,note}=narrativeDocument(db,cam,noteId);if(row.trashed)throw new Error('Narrative Notiz nicht verfügbar.');return note;}

export function checkedNarrativeState(value:unknown):NarrativeState{
 const state=value as NarrativeState;
 if(!state||!id(state.noteId)||!Number.isSafeInteger(state.revision)||state.revision<0||!['open','closed'].includes(state.status)||!optionalNullableId(state.locationId)||!Array.isArray(state.contributors)||state.contributors.length>1000||state.contributors.some(value=>!id(value))||new Set(state.contributors).size!==state.contributors.length||!Number.isSafeInteger(state.poolXp)||state.poolXp<0||!Array.isArray(state.items)||state.items.length>100||!nullableId(state.awardId))throw new Error('Status, Mitwirkende und Belohnung prüfen.');
 for(const item of state.items){
  const reference=item?.reference;
  if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>1000||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>1000000||!categories.includes(item.category)||!gold(item.valueGold)||reference!==undefined&&(reference.kind!=='authored'||!id(reference.definitionId)||!Number.isSafeInteger(reference.revision)||reference.revision<1||reference.historicalDefinitionId!==undefined&&!id(reference.historicalDefinitionId)))throw new Error('Belohnungsgegenstand prüfen.');
 }
 return state;
}

export function checkedNarrativeAward(value:unknown):NarrativeAward{
 const award=value as NarrativeAward;
 if(!award||!id(award.id)||!id(award.noteId)||typeof award.title!=='string'||!award.title.trim()||award.title.length>1000||!nullableId(award.sceneId)||!Number.isSafeInteger(award.poolXp)||award.poolXp<0||!Number.isSafeInteger(award.shareXp)||award.shareXp<0||!Array.isArray(award.recipientIds)||award.recipientIds.length>1000||award.recipientIds.some(value=>!id(value))||new Set(award.recipientIds).size!==award.recipientIds.length||!nullableId(award.treasureId)||typeof award.outcome!=='string'||!award.outcome.trim()||award.outcome.length>10000||typeof award.recordedAt!=='string'||!Number.isFinite(Date.parse(award.recordedAt)))throw new Error('Narrativer Belohnungsbeleg beschädigt.');
 const share=award.recipientIds.length?Number((BigInt(award.poolXp)+BigInt(award.recipientIds.length)-1n)/BigInt(award.recipientIds.length)):0;
 if(award.shareXp!==share)throw new Error('Narrativer XP-Beleg widersprüchlich.');
 return award;
}

export function readNarrative(db:any,cam:string,noteId:string):NarrativeView{
 const note=narrativeNote(db,cam,noteId),row=db.prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?').get(cam,noteId);
 const state: NarrativeState=row?checkedNarrativeState(parsed(row)):{noteId,revision:0,status:'open',locationId:null,contributors:[],poolXp:0,items:[],awardId:null};
 if(row&&(row.note_id!==state.noteId||row.revision!==state.revision))throw new Error('Narrativer Status widerspricht seinem Datensatz.');
 let award:NarrativeAward|null=null;
 if(state.awardId){const awardRow=db.prepare('SELECT * FROM narrative_award WHERE campaign_id=? AND id=?').get(cam,state.awardId);award=checkedNarrativeAward(parsed(awardRow));if(awardRow.id!==award.id||awardRow.note_id!==award.noteId||award.noteId!==noteId)throw new Error('Narrativer Belohnungsbeleg ist falsch zugeordnet.');}
 return{state,award,noteRevision:note.revision};
}

export function saveNarrative(db:any,cam:string,state:NarrativeState){checkedNarrativeState(state);const payload=JSON.stringify(state);db.prepare('INSERT INTO narrative_state VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(cam,state.noteId,state.revision,payload,hash(payload));}
export function saveNarrativeAward(db:any,cam:string,award:NarrativeAward){checkedNarrativeAward(award);const payload=JSON.stringify(award);db.prepare('INSERT INTO narrative_award VALUES(?,?,?,?,?)').run(cam,award.id,award.noteId,payload,hash(payload));}

export function validateNarrativeState(db:any,cam:string,state:NarrativeState){checkedNarrativeState(state);if(state.locationId&&!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0').get(cam,state.locationId))throw new Error('Verknüpfter Ort nicht verfügbar.');for(const contributor of state.contributors)if(!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam,contributor))throw new Error('Mitwirkende Figur fehlt.');}

export function validateNarrativeBackup(db:any){
 const tables=new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('narrative_state','narrative_award')").all().map((row:any)=>row.name));
 if(!tables.size&&db.pragma('user_version',{simple:true})<35)return;
 if(!tables.has('narrative_state')||!tables.has('narrative_award'))throw new Error('Narrativer Speicherstand ist unvollständig.');
 const states=new Map<string,NarrativeState>(),awards=new Set<string>();
 for(const row of db.prepare('SELECT * FROM narrative_state').iterate()){
  const state=checkedNarrativeState(parsed(row)),key=row.campaign_id+'\0'+row.note_id;
  if(row.note_id!==state.noteId||row.revision!==state.revision)throw new Error('Narrativer Status widerspricht seinem Datensatz.');
  narrativeDocument(db,row.campaign_id,row.note_id);
  if(state.locationId&&!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(row.campaign_id,state.locationId))throw new Error('Narrativer Status verweist auf einen fehlenden Ort.');
  for(const contributor of state.contributors)if(!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(row.campaign_id,contributor))throw new Error('Narrativer Status verweist auf eine fehlende Figur.');
  for(const item of state.items)if(item.reference&&!db.prepare('SELECT 1 FROM authored_item WHERE id=?').get(item.reference.definitionId))throw new Error('Narrative Belohnung verweist auf einen fehlenden Gegenstand.');
  states.set(key,state);
 }
 for(const row of db.prepare('SELECT * FROM narrative_award').iterate()){
  const award=checkedNarrativeAward(parsed(row)),key=row.campaign_id+'\0'+row.note_id,state=states.get(key);
  if(row.id!==award.id||row.note_id!==award.noteId||state?.awardId!==award.id)throw new Error('Narrativer Belohnungsbeleg ist falsch zugeordnet.');
  narrativeDocument(db,row.campaign_id,row.note_id);
  for(const recipient of award.recipientIds)if(!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(row.campaign_id,recipient))throw new Error('Narrativer Belohnungsbeleg verweist auf eine fehlende Figur.');
  if(award.sceneId&&!db.prepare('SELECT 1 FROM live_scene WHERE campaign_id=? AND id=?').get(row.campaign_id,award.sceneId))throw new Error('Narrativer Belohnungsbeleg verweist auf eine fehlende Szene.');
  if(award.treasureId){const treasureRow=db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(row.campaign_id,award.treasureId),treasure=parsed<any>(treasureRow);if(treasure.id!==award.treasureId||treasure.sourceNoteId!==award.noteId||treasure.awardId!==award.id)throw new Error('Narrative Beute ist falsch zugeordnet.');}
  awards.add(row.campaign_id+'\0'+award.id);
 }
 for(const [key,state]of states)if(state.awardId&&!awards.has(key.slice(0,key.indexOf('\0'))+'\0'+state.awardId))throw new Error('Narrativer Status verweist auf einen fehlenden Belohnungsbeleg.');
}
