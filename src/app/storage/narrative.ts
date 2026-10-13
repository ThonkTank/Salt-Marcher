import {copper} from '../progression';
import {worldNoteDocument} from '../../features/world/world-notes';
import {createHash} from 'node:crypto';import type {NarrativeState,NarrativeAward,NarrativeView,NarrativeDraft} from '../narrative-contracts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const id=(value:unknown)=>typeof value==='string'&&!!value&&value.length<=1000;
const nullableId=(value:unknown)=>value===null||id(value);
const optionalNullableId=(value:unknown)=>value===undefined||nullableId(value);
const gold=(value:unknown)=>typeof value==='string'&&/^(0|[1-9][0-9]{0,14})([.,][0-9]{1,2})?$/.test(value.trim());
const categories=['coins','equipment','trade-goods','magic','other'];

export function installNarrative(db:any){db.exec(`CREATE TABLE IF NOT EXISTS narrative_state(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_award(campaign_id TEXT NOT NULL,id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_draft(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS ledger_parent_lookup ON character_ledger(campaign_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.parentId') END);
CREATE INDEX IF NOT EXISTS ledger_credit_lookup ON character_ledger(campaign_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.rewardCreditId') END);
CREATE INDEX IF NOT EXISTS narrative_award_note ON narrative_award(campaign_id,note_id);`);}
export function narrativeNote(db:any,cam:string,id:string,retained=false){const r=db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam,id);if(!r||!retained&&r.trashed||hash(r.payload)!==r.checksum)throw new Error('Narrative Notiz nicht verfügbar.');const n=worldNoteDocument(JSON.parse(r.payload));if(n.id!==r.id||n.revision!==r.revision)throw new Error('Narrative Notizzuordnung widersprüchlich.');if(!retained&&!['quest','rumor'].includes(n.kind))throw new Error('Quest oder Gerücht auswählen.');return n;}
function parsed<T>(r:any):T{if(!r||hash(r.payload)!==r.checksum)throw new Error('Narrative Belohnung beschädigt.');return JSON.parse(r.payload);}
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

function checkedState(db:any,cam:string,row:any):NarrativeState {
 const s=checkedNarrativeState(parsed<NarrativeState>(row));
 if(s.noteId!==row.note_id||s.revision!==row.revision||!Number.isSafeInteger(s.revision)||s.revision<1||s.awardId!==null&&(typeof s.awardId!=='string'||!s.awardId))throw new Error('Narrativer Status gehört zu einer anderen Notiz oder Revision.');
 narrativeNote(db,cam,row.note_id,true);validateNarrativeState(db,cam,s,true);
 for(const item of s.items)if(item.reference&&!db.prepare('SELECT 1 FROM authored_item WHERE id=?').get(item.reference.definitionId))throw new Error('Narrative Belohnung verweist auf einen fehlenden Gegenstand.');
 return s;
}
function checkedAward(db:any,cam:string,row:any):NarrativeAward {
 const a=checkedNarrativeAward(parsed<NarrativeAward>(row));
 if(a.id!==row.id||a.noteId!==row.note_id||typeof a.title!=='string'||a.title.length>1000||typeof a.outcome!=='string'||!a.outcome.trim()||a.outcome.length>10000||typeof a.recordedAt!=='string'||a.recordedAt.length>100||!Number.isFinite(Date.parse(a.recordedAt))||![a.poolXp,a.shareXp].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(a.recipientIds)||a.recipientIds.length>1000||new Set(a.recipientIds).size!==a.recipientIds.length)throw new Error('Narrative Belohnung besitzt einen widersprüchlichen Inhalts-/Ownervertrag.');
 narrativeNote(db,cam,row.note_id,true);
 for(const id of a.recipientIds)if(typeof id!=='string'||!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam,id))throw new Error('Belohnungsempfänger gehört nicht zur Kampagne.');
 for(const [id,table]of [[a.sceneId,'live_scene'],[a.treasureId,'treasure']] as const)if(id!==null&&(typeof id!=='string'||!db.prepare('SELECT 1 FROM '+table+' WHERE campaign_id=? AND id=?').get(cam,id)))throw new Error('Belohnungsreferenz fehlt oder gehört zu einer anderen Kampagne.');
 if(a.treasureId){const treasure=parsed<any>(db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam,a.treasureId));if(treasure.id!==a.treasureId||treasure.sourceNoteId!==a.noteId||treasure.awardId!==a.id)throw new Error('Narrative Beute ist falsch zugeordnet.');}
 return a;
}
function linkedAward(db:any,cam:string,s:NarrativeState):NarrativeAward|null {
 const rows=db.prepare('SELECT * FROM narrative_award WHERE campaign_id=? AND note_id=? LIMIT 2').all(cam,s.noteId);
 if(rows.length>1||rows.length===0&&s.awardId!==null||rows.length===1&&rows[0].id!==s.awardId)throw new Error('Bestätigte narrative Belohnung und Statusverweis widersprüchlich.');
 return rows.length?checkedAward(db,cam,rows[0]):null;
}
export function readNarrative(db:any,cam:string,id:string):NarrativeView {
 const n=narrativeNote(db,cam,id),r=db.prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?').get(cam,id),state: NarrativeState=r?checkedState(db,cam,r):{noteId:id,revision:0,status:'open',locationId:null,contributors:[],poolXp:0,items:[],awardId:null};
 return{state,award:linkedAward(db,cam,state),noteRevision:n.revision,draft:readNarrativeDraft(db,cam,id)};
}
export function validateNarrativeBackup(db:any){
 const exists=(name:string)=>!!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(name),state=exists('narrative_state'),award=exists('narrative_award');
 if(!state&&!award&&db.pragma('user_version',{simple:true})<35)return;
 if(!state||!award)throw new Error('Narratives Datenschema fehlt oder ist unvollständig.');
 if(exists('narrative_draft'))for(const row of db.prepare('SELECT * FROM narrative_draft').iterate())validateNarrativeDraft(db,row.campaign_id,parsed<NarrativeDraft>(row),row.note_id);
 for(const row of db.prepare('SELECT * FROM narrative_state').iterate())linkedAward(db,row.campaign_id,checkedState(db,row.campaign_id,row));
 for(const row of db.prepare('SELECT * FROM narrative_award').iterate()){const a=checkedAward(db,row.campaign_id,row),s=db.prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?').get(row.campaign_id,a.noteId);if(!s||checkedState(db,row.campaign_id,s).awardId!==a.id)throw new Error('Narrative Belohnung besitzt keinen passenden Statusverweis.');}
}
export function saveNarrative(db:any,cam:string,state:NarrativeState){checkedNarrativeState(state);const payload=JSON.stringify(state);db.prepare('INSERT INTO narrative_state VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(cam,state.noteId,state.revision,payload,hash(payload));}
export function saveNarrativeAward(db:any,cam:string,award:NarrativeAward){checkedNarrativeAward(award);const payload=JSON.stringify(award);db.prepare('INSERT INTO narrative_award VALUES(?,?,?,?,?)').run(cam,award.id,award.noteId,payload,hash(payload));}
export function validateNarrativeState(db:any,cam:string,s:NarrativeState,retained=false){checkedNarrativeState(s);if(!s||!['open','closed'].includes(s.status)||!Number.isSafeInteger(s.poolXp)||s.poolXp<0||!Array.isArray(s.contributors)||s.contributors.length>1000||new Set(s.contributors).size!==s.contributors.length||!Array.isArray(s.items)||s.items.length>100)throw new Error('Status, Mitwirkende und Belohnung prüfen.');if(s.locationId&&!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND (? OR trashed=0)').get(cam,s.locationId,Number(retained)))throw new Error('Verknüpfter Ort nicht verfügbar.');for(const id of s.contributors)if(!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam,id))throw new Error('Mitwirkende Figur fehlt.');for(const i of s.items)if(!i||typeof i.name!=='string'||!i.name.trim()||!Number.isSafeInteger(i.quantity)||i.quantity<1||typeof i.valueGold!=='string')throw new Error('Belohnungsgegenstand prüfen.');for(const i of s.items){copper(i.valueGold);if(!['coins','equipment','trade-goods','magic','other'].includes(i.category))throw new Error('Belohnungskategorie ungültig.');}}

function validateNarrativeDraft(db:any,cam:string,d:NarrativeDraft,id:string) {
 if(!d||d.noteId!==id)throw new Error('Narrativer Entwurf gehört zu einer anderen Notiz.');
 narrativeNote(db,cam,id,true);
      const text = (v: unknown, max = 1000) =>
        typeof v === "string" && v.length <= max;
      if (
        !d.writeId ||
        !text(d.writeId) ||
        !Number.isSafeInteger(d.revision) ||
        d.revision < 0 ||
        !["open", "closed"].includes(d.status) ||
        (d.locationId !== null && !text(d.locationId)) ||
        !text(d.poolXp) ||
        !Array.isArray(d.contributors) ||
        d.contributors.length > 1000 ||
        d.contributors.some((v) => !text(v)) ||
        !Array.isArray(d.items) ||
        d.items.length > 100 ||
        d.items.some(
          (i) =>
            !i ||
            !text(i.name) ||
            !text(i.quantity) ||
            !text(i.valueGold) ||
            !["coins", "equipment", "trade-goods", "magic", "other"].includes(
              i.category,
            ),
        ) ||
        Buffer.byteLength(JSON.stringify(d)) > 256000
      )
        throw new Error("Narrative Eingabe ist zu groß oder ungültig.");

 if(d.locationId!==null&&!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam,d.locationId))throw new Error('Entwurfsort gehört nicht zur Kampagne.');
 if(new Set(d.contributors).size!==d.contributors.length)throw new Error('Entwurfsmitwirkende dürfen nicht doppelt vorkommen.');
 for(const characterId of d.contributors)if(!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam,characterId))throw new Error('Entwurfsmitwirkende Figur gehört nicht zur Kampagne.');
}

export function readNarrativeDraft(
  db: any,
  cam: string,
  id: string,
): NarrativeDraft | null {
  const r = db
    .prepare("SELECT * FROM narrative_draft WHERE campaign_id=? AND note_id=?")
    .get(cam, id);
  if(!r)return null;
  const d=parsed<NarrativeDraft>(r);validateNarrativeDraft(db,cam,d,r.note_id);return d;
}
export function keepNarrativeDraft(
  db: any,
  cam: string,
  d: NarrativeDraft,
  expected: string | null,
) {
  return db
    .transaction(() => {
      narrativeNote(db, cam, d.noteId);
      validateNarrativeDraft(db,cam,d,d.noteId);
      const old = readNarrativeDraft(db, cam, d.noteId),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if ((old?.writeId ?? null) !== expected)
        throw new Error("Narrativer Entwurf inzwischen geändert.");
      db.prepare(
        "INSERT INTO narrative_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum",
      ).run(cam, d.noteId, payload, hash(payload));
    })
    .immediate();
}
export function discardNarrativeDraft(
  db: any,
  cam: string,
  id: string,
  writeId: string,
) {
  return db
    .transaction(() => {
      narrativeNote(db, cam, id);
      consumeNarrativeDraft(db, cam, id, writeId);
    })
    .immediate();
}
export function consumeNarrativeDraft(
  db: any,
  cam: string,
  id: string,
  writeId?: string,
) {
  const d = readNarrativeDraft(db, cam, id);
  if (d && d.writeId !== writeId)
    throw new Error(
      "Offene narrative Eingabe zuerst speichern oder verwerfen.",
    );
  if (d)
    db.prepare(
      "DELETE FROM narrative_draft WHERE campaign_id=? AND note_id=?",
    ).run(cam, id);
}
