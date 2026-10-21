import {createHash} from 'node:crypto';
import {heightInfluenceBounds} from '../terrain-interpolation';
import {validateTerrain} from '../terrain-height';

const fingerprint=(row:unknown)=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
function expandedRow(row:any){
 if(!row)return row;
 const record=JSON.parse(row.payload);if(!record.height)return row;
 validateTerrain(record);
 const b=heightInfluenceBounds(record.height);
 return{...row,min_x:b.x,max_x:b.x+b.width,min_y:b.y,max_y:b.y+b.height};
}
/** Read one complete row at a time, closing the SQLite statement before writes.
 * Text cursors preserve the full rowid range without retaining all payloads. */
function* migrationRows(db:any,table:string,where='1'):Generator<any>{
 const select=`SELECT CAST(rowid AS TEXT) migration_cursor,* FROM ${table} WHERE ${where}`;
 const first=db.prepare(select+' ORDER BY rowid LIMIT 1'),next=db.prepare(select+' AND rowid>CAST(? AS INTEGER) ORDER BY rowid LIMIT 1');
 let row=first.get();while(row){const {migration_cursor,...value}=row;yield value;row=next.get(migration_cursor);}
}
/** Schema 54 changes derived influence bounds, never authored samples or payloads.
 * Runs inside the store/import migration transaction. Normalize historical rows
 * too: otherwise Undo would silently restore the old one-cell read footprint. */
export function installTerrainReconstruction(db:any){
 if(db.pragma('user_version',{simple:true})>=54)return;
 const current=db.prepare('SELECT * FROM atlas_landscape WHERE campaign_id=? AND id=?');
 const saveCommand=db.prepare('UPDATE atlas_command SET payload=? WHERE campaign_id=? AND ordinal=?');
 for(const command of migrationRows(db,'atlas_command')){
  const changes=JSON.parse(command.payload);let changed=false;
  for(const delta of changes){
   if(delta.table!=='atlas_landscape')continue;
   const before=expandedRow(delta.before),after=expandedRow(delta.after);
   if(JSON.stringify(before)===JSON.stringify(delta.before)&&JSON.stringify(after)===JSON.stringify(delta.after))continue;
   const live=current.get(delta.key.campaign_id,delta.key.id)??null;
   // Rebase only a known old fingerprint. An already-conflicting command must
   // remain conflicting, even if its row was subsequently changed externally.
   for(const old of [delta.before,delta.after,live])if(fingerprint(old)===delta.guard){delta.guard=fingerprint(expandedRow(old));break;}
   delta.before=before;delta.after=after;changed=true;
  }
  if(changed)saveCommand.run(JSON.stringify(changes),command.campaign_id,command.ordinal);
 }
 const update=db.prepare('UPDATE atlas_landscape SET min_x=?,max_x=?,min_y=?,max_y=? WHERE campaign_id=? AND id=?');
 for(const row of migrationRows(db,'atlas_landscape',"json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL")){
  const next=expandedRow(row);if(next.min_x===row.min_x&&next.max_x===row.max_x&&next.min_y===row.min_y&&next.max_y===row.max_y)continue;
  update.run(next.min_x,next.max_x,next.min_y,next.max_y,row.campaign_id,row.id);
 }
}
