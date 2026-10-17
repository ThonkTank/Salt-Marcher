import {randomUUID} from 'node:crypto';
const journals=new WeakMap<object,{epoch:string;external:number}>();
const tables=['atlas_landscape','atlas_reference_asset','location','room','city_document','city_unit','drawing_element','drawing_profile','drawing_hidden','drawing_floor','dungeon_volume','dungeon_key_content','atlas_binding','scope'];
/** Bounded TEMP invalidation log: participates in the writer transaction, never in archives/history. */
export function atlasReadJournal(db:any){
 let state=journals.get(db);const external=db.pragma('data_version',{simple:true});if(state){if(state.external!==external){state.epoch=randomUUID();state.external=external;}return state;}
 db.transaction(()=>{
  db.exec('CREATE TEMP TABLE atlas_read_changes(sequence INTEGER PRIMARY KEY AUTOINCREMENT,table_name TEXT NOT NULL,campaign_id TEXT NOT NULL,id TEXT NOT NULL)');
  for(const table of tables.filter(name=>db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)))for(const [op,ref] of [['INSERT','new'],['UPDATE','new'],['DELETE','old']])db.exec(`CREATE TEMP TRIGGER atlas_read_${table}_${op} AFTER ${op} ON main.${table} BEGIN
   INSERT INTO atlas_read_changes(table_name,campaign_id,id) VALUES('${table}',${ref}.campaign_id,${ref}.id);
   DELETE FROM atlas_read_changes WHERE sequence<=last_insert_rowid()-10000; END;`);
 })();state={epoch:randomUUID(),external};journals.set(db,state);return state;
}
export function atlasReadChanges(db:any,cam:string,cursor?:{epoch:string;sequence:number}){
 const {epoch}=atlasReadJournal(db),{low,high}=db.prepare('SELECT coalesce(min(sequence),0) low,coalesce(max(sequence),0) high FROM temp.atlas_read_changes').get();
 let reset=!cursor||cursor.epoch!==epoch||cursor.sequence<low-1||cursor.sequence>high;
 const changes:{table:string;id:string}[]=[];let bytes=0;
 if(!reset)for(const row of db.prepare('SELECT DISTINCT table_name AS "table",id FROM temp.atlas_read_changes WHERE campaign_id=? AND sequence>?').iterate(cam,cursor!.sequence)){
  bytes+=(row.table.length+row.id.length)*2;if(bytes>1024*1024){changes.length=0;reset=true;break;}changes.push(row);
 }
 return{epoch,sequence:high,reset,changes};
}
