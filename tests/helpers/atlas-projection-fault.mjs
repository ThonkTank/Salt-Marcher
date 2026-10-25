import {buildSync} from './build.mjs';
import {mainHostBuildRoot} from './desktop-main-host.mjs';
import path from 'node:path';

/** Inject a read failure into the real Store, before loading the real worker.
 * Receipt checks use SQLite itself. No result/error marker is synthesized. */
export function atlasProjectionFault({target,reader,blockReceipt=false,shadowReceipt=false,previewPostcommit=false}){
 const stem=`projection-${target}-${reader}-${blockReceipt}-${shadowReceipt}-${previewPostcommit}`,file=path.join(mainHostBuildRoot,stem+'.cjs'),trace=path.join(mainHostBuildRoot,stem+'.jsonl');
 buildSync({stdin:{resolveDir:process.cwd(),contents:`
import {CampaignStore} from './src/app/storage/store';
import {parentPort} from 'node:worker_threads';
import {appendFileSync} from 'node:fs';
const config=${JSON.stringify({target,reader,blockReceipt,shadowReceipt,previewPostcommit,trace})};
let current;
parentPort.on('message',message=>{current=message.kind==='call'?{method:message.method,command:message.value.value[0]}:undefined;});
const log=value=>appendFileSync(config.trace,JSON.stringify(value)+'\\n');
const originals=new WeakMap();
function receipt(store){const db=config.previewPostcommit?store.graphShadow?.db:store.db;if(!db)return false;const prepare=originals.get(db)??db.prepare.bind(db);return current?.command?.commandId&&prepare('SELECT 1 FROM '+(config.previewPostcommit?'preview_receipt':config.shadowReceipt?'receipt':'atlas_receipt')+' WHERE command_id=?').get(current.command.commandId);}
function fail(store,reader){
 log({reader,commandId:current.command.commandId,receipt:!!receipt(store),inTransaction:store.db.inTransaction});
 throw Error('Injected '+reader+' projection read failure');
}
const apply=CampaignStore.prototype.applyAtlas;
CampaignStore.prototype.applyAtlas=function(...args){
 if(!originals.has(this.db)){
  const prepare=this.db.prepare.bind(this.db);originals.set(this.db,prepare);
  this.db.prepare=sql=>{
   if(current?.method===config.target&&config.reader==='canonical-geometry'&&sql.startsWith('SELECT 1 FROM scene_position WHERE campaign_id=? AND (json_type')){log({reader:config.reader,commandId:current.command.commandId,inTransaction:this.db.inTransaction});return prepare("SELECT json_extract('broken', '$.dungeon') WHERE ? IS NOT NULL");}
   const ack=current?.method===config.target&&config.reader==='ack'&&!this.db.inTransaction;
   const reconciliation=config.blockReceipt&&current?.method==='reconcileAtlasCommit';
   if(!config.shadowReceipt&&!config.previewPostcommit&&(ack||reconciliation)&&sql==='SELECT * FROM campaign_atlas WHERE campaign_id=?'&&receipt(this))fail(this,reconciliation?'receipt':'ack');
   return prepare(sql);
  };
 }
 return apply.apply(this,args);
};
for(const name of ['campaignAtlas','workspace','dungeonAuthoring','readRoomCommit','atlasRegionSource','city']){
 const read=CampaignStore.prototype[name];
 CampaignStore.prototype[name]=function(...args){
  if(current?.method===config.target&&name===config.reader){
   if(config.previewPostcommit){if(!this.graphRouting&&receipt(this))fail(this,name);}
   else if(config.shadowReceipt){if(this.graphRouting&&receipt(this))fail(this,name);}
   else if(originals.has(this.db)&&receipt(this)&&(!this.db.inTransaction||name==='atlasRegionSource'))fail(this,name);
  }
  return read.apply(this,args);
 };
}
const edit=CampaignStore.prototype.edit;
CampaignStore.prototype.edit=function(...args){if(current?.method===config.target)log({edit:true,commandId:args[0].commandId});return edit.apply(this,args);};
const graph=CampaignStore.prototype.executeGraph;
CampaignStore.prototype.executeGraph=function(...args){const value=graph.apply(this,args);if((config.shadowReceipt||config.reader==='canonical-geometry')&&this.graphShadow)log({shadow:this.graphShadow.db.name});return value;};
require('./desktop/store-worker');
`},outfile:file,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
 return{file,trace};
}
