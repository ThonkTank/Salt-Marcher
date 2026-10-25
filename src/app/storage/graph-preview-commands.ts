import {createHash} from 'node:crypto';
import type {GraphPreviewTarget,GraphPreviewState} from '../graph-contracts';
import {prepareSpatialCapture,capturedSpatialRow,restoreSpatialRow,type SpatialDelta} from './campaign-atlas';

export interface PreviewCommand {commandId:string;campaignId:string;target?:GraphPreviewTarget;action:unknown}
const json=JSON.stringify,hash=(v:unknown)=>createHash('sha256').update(json(v)).digest('hex');
export const previewCommandFingerprint=(c:PreviewCommand)=>hash({campaignId:c.campaignId,target:c.target,action:c.action});
export function requirePreviewTarget(target:GraphPreviewTarget|undefined):GraphPreviewTarget {
  if(!target||target.kind!=='graph-preview'||typeof target.previewId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(target.previewId)||typeof target.scopeId!=='string'||!target.scopeId||!Number.isSafeInteger(target.revision)||target.revision<0)throw Error('Explizites Vorschauziel fehlt oder ist ungültig.');
  return target;
}

/** One database owns preview edits, side effects, history, revision and receipts.
 * Only graph-local tables are captured; no world/Atlas tables are copied. */
export class GraphPreviewCommands {
  constructor(private db:any,readonly id:string,readonly campaignId:string,readonly scopeId:string,tables:readonly string[]){
    db.exec(`CREATE TABLE IF NOT EXISTS preview_meta(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,scope_id TEXT NOT NULL,phase TEXT NOT NULL,revision INTEGER NOT NULL,cursor INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS preview_command(ordinal INTEGER PRIMARY KEY,command_id TEXT NOT NULL,label TEXT NOT NULL,payload TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS preview_receipt(command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,revision INTEGER NOT NULL) STRICT;`);
    const rows=db.prepare('SELECT * FROM preview_meta').all();
    if(!rows.length)db.prepare("INSERT INTO preview_meta VALUES(?,?,?,'graph',0,0)").run(id,campaignId,scopeId);
    else if(rows.length!==1||rows[0].id!==id||rows[0].campaign_id!==campaignId||rows[0].scope_id!==scopeId)throw Error('Vorschaubesitzer widersprüchlich.');
    prepareSpatialCapture(db,tables);
  }
  private meta(){return this.db.prepare('SELECT * FROM preview_meta').get();}
  get state():GraphPreviewState {const m=this.meta();return{id:this.id,scopeId:this.scopeId,phase:m.phase,revision:m.revision,protected:true};}
  set phase(value:'graph'|'raster'){this.db.prepare('UPDATE preview_meta SET phase=? WHERE id=?').run(value,this.id);}
  get history(){const m=this.meta(),max=this.db.prepare('SELECT max(ordinal) n FROM preview_command').get().n??0;return{canUndo:m.cursor>0,canRedo:m.cursor<max};}
  assertTarget(c:PreviewCommand){const t=requirePreviewTarget(c.target);if(t.previewId!==this.id||t.scopeId!==this.scopeId||c.campaignId!==this.campaignId||typeof c.commandId!=='string'||!c.commandId)throw Error('Auftrag gehört zu einer anderen Graphvorschau.');}
  receipt(c:PreviewCommand){
    this.assertTarget(c);const r=this.db.prepare('SELECT * FROM preview_receipt WHERE command_id=?').get(c.commandId);
    if(r&&r.fingerprint!==previewCommandFingerprint(c))throw Error('Vorschaukennung anders verwendet.');
    return r;
  }
  execute<T>(c:PreviewCommand,apply:()=>T,validate:()=>void):T|undefined {
    this.assertTarget(c);
    return this.db.transaction(()=>{
      if(this.receipt(c))return;
      if(c.target!.revision!==this.state.revision)throw Error('Graphvorschau inzwischen geändert. Aktuellen Stand laden.');
      const kind=(c.action as {kind?:string})?.kind;
      let result:T|undefined;
      if(kind==='undo'||kind==='redo')this.moveHistory(kind);
      else{
        this.db.prepare('DELETE FROM atlas_delta').run();
        this.db.prepare('INSERT INTO atlas_capture VALUES(?)').run(this.campaignId);
        try{result=apply();validate();}finally{this.db.prepare('DELETE FROM atlas_capture').run();}
        const changes=new Map<string,SpatialDelta>();
        for(const row of this.db.prepare('SELECT * FROM atlas_delta ORDER BY rowid').all()){
          const key=row.table_name+':'+row.key_json,old=changes.get(key),after=row.after_json?JSON.parse(row.after_json):null;
          changes.set(key,{table:row.table_name,key:JSON.parse(row.key_json),before:old?old.before:row.before_json?JSON.parse(row.before_json):null,after,guard:hash(after)});
        }
        const meaningful=[...changes.values()].filter(d=>hash(d.before)!==hash(d.after));
        if(meaningful.length){const cursor=this.meta().cursor;this.db.prepare('DELETE FROM preview_command WHERE ordinal>?').run(cursor);this.db.prepare('INSERT INTO preview_command VALUES(?,?,?,?)').run(cursor+1,c.commandId,kind??'graph',json(meaningful));this.db.prepare('UPDATE preview_meta SET cursor=cursor+1').run();}
        this.db.prepare('DELETE FROM atlas_delta').run();
      }
      if(kind==='undo'||kind==='redo')validate();
      this.db.prepare('UPDATE preview_meta SET revision=revision+1').run();
      this.db.prepare('INSERT INTO preview_receipt VALUES(?,?,?)').run(c.commandId,previewCommandFingerprint(c),this.state.revision);
      return result;
    }).immediate();
  }
  private moveHistory(direction:'undo'|'redo'){
    const cursor=this.meta().cursor,ordinal=direction==='undo'?cursor:cursor+1,row=this.db.prepare('SELECT payload FROM preview_command WHERE ordinal=?').get(ordinal);
    if(!row)throw Error('Keine Vorschauänderung zum Rücknehmen.');
    const changes=JSON.parse(row.payload) as SpatialDelta[];
    for(const d of changes)if(hash(capturedSpatialRow(this.db,d))!==d.guard)throw Error('Vorschauhistory passt nicht zum aktuellen Inhalt.');
    this.db.pragma('defer_foreign_keys=ON');
    for(const d of direction==='undo'?[...changes].reverse():changes)restoreSpatialRow(this.db,d,direction==='undo'?d.before:d.after);
    const next=direction==='undo'?cursor-1:cursor+1;this.db.prepare('UPDATE preview_meta SET cursor=?').run(next);
    for(const d of changes)for(const [sign,order] of [['<=','DESC'],['>','ASC']]){
      for(const candidate of this.db.prepare('SELECT ordinal,payload FROM preview_command WHERE ordinal '+sign+'? ORDER BY ordinal '+order).all(next)){
        const deltas=JSON.parse(candidate.payload) as SpatialDelta[],entry=deltas.find(v=>v.table===d.table&&json(v.key)===json(d.key));if(!entry)continue;
        entry.guard=hash(capturedSpatialRow(this.db,d));this.db.prepare('UPDATE preview_command SET payload=? WHERE ordinal=?').run(json(deltas),candidate.ordinal);break;
      }
    }
  }
}
